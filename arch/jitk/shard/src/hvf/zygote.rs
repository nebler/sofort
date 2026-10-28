//! The macOS HVF engine (`hvf ipc BASE SLOTS`): the Linux shard's IPC service
//! (service.rs) over a socket to Node, with one engine process per slot behind
//! it instead of owner threads (hvf-spike/REPORT.md, "Mac engine shape").
//!
//! HVF allows one VM per process and runs a vCPU only on its creating thread,
//! so this process is a zygote: single-threaded, it loads and maps the
//! verified snapshot, compiles the Seatbelt profile and forks one child per
//! slot (child.rs), but never creates a VM itself. Each child confines itself
//! before it creates its VM. A fork costs ~1 CPU-ms and ~1.2 MiB per slot,
//! once; runs reuse the child with a reset.
//!
//! The zygote is the trusted half. It runs the per-slot state machine on
//! every Node message and every child message, so Node sees exactly the Linux
//! shard's protocol, and it supervises: a child that breaks the protocol, or
//! whose run is still going `ESCALATION` after its deadline (the Linux
//! watchdog's 100 ms), is killed. A dead child takes its slot out of service:
//! its running generation ends with an ERROR (`slot_unavailable`, or
//! `deadline_exceeded` after an escalation) and the next reset is reported
//! QUARANTINED with the reason, as for a failed reset in the child.
//! Node closing the socket ends the zygote; a child sees its socket close
//! and exits, even mid-run.
use super::{State, child, confine::Sandbox, conn::Conn};
use crate::clock;
use crate::constants::{ABI_VERSION, ipc as wire, ring};
use crate::service::{
    self, CALL, CANCEL, Cancel, DONE, ERROR, Message, Phase, QUARANTINED, READY, RELEASED, REPLY,
    START, invalid, released,
};
use crate::slot::ResetPolicy;
use crate::snapshot::Snapshot;
use std::{
    io,
    os::fd::{AsRawFd, FromRawFd, OwnedFd},
    path::{Path, PathBuf},
    sync::Arc,
};

/// A running generation may outlive its deadline by this much before its
/// process is killed (the Linux watchdog's escalation, shard/README.md).
pub const ESCALATION_NS: u64 = 100_000_000;
/// A child must report a CANCEL's reset within this.
const RESET_GRACE_NS: u64 = 1_000_000_000;
/// Records queued for one child: a generation's START, REPLY and CANCEL.
const CHILD_QUEUE: usize = ring::MAX_CALLS + 4;
/// Children must all report READY within this at startup.
const STARTUP_NS: u64 = 10_000_000_000;

struct Child {
    pid: libc::pid_t,
    /// None once the process is gone.
    conn: Option<Conn>,
    /// Why the process is gone; QUARANTINED carries it.
    dead: Option<String>,
    ready: bool,
    /// When the zygote kills a child whose run or reset has not ended.
    kill_at: Option<u64>,
    escalated: bool,
    /// STATS seen for the current generation (it precedes DONE/ERROR).
    stats: bool,
}

pub struct Zygote {
    node: Conn,
    states: Vec<service::State>,
    children: Vec<Child>,
    snapshot: Arc<Snapshot<State>>,
    policy: ResetPolicy,
    sandbox: Sandbox,
    charge: u32,
}

/// The process's thread count (`proc_pidinfo`): fork needs exactly one.
fn threads() -> io::Result<i32> {
    // SAFETY: an all-zero proc_taskinfo is a valid out-value.
    let mut info: libc::proc_taskinfo = unsafe { std::mem::zeroed() };
    let size = std::mem::size_of::<libc::proc_taskinfo>() as libc::c_int;
    // SAFETY: own pid; info is a live, correctly sized out-buffer.
    let n = unsafe {
        libc::proc_pidinfo(
            libc::getpid(),
            libc::PROC_PIDTASKINFO,
            0,
            (&mut info as *mut libc::proc_taskinfo).cast(),
            size,
        )
    };
    if n != size {
        return Err(io::Error::last_os_error());
    }
    Ok(info.pti_threadnum)
}

/// The Seatbelt sandbox every child enters: vmm/sandbox's jitk.sb (deny by
/// default; read only the image directory, here the snapshot's), compiled
/// once by this process for the snapshot's directory.
pub fn sandbox(base: &str) -> io::Result<Sandbox> {
    let other = |e: Box<dyn std::error::Error>| io::Error::other(e.to_string());
    let image = std::fs::canonicalize(format!("{base}.mem"))?;
    let images = image
        .parent()
        .ok_or_else(|| invalid("snapshot directory"))?;
    let blob = std::env::temp_dir().join(format!("jitk-hvf-{}.sbbin", std::process::id()));
    super::confine::compile_profile(images, &blob).map_err(other)?;
    let prepared = Sandbox::prepare(&image, Some(blob.as_path()), None).map_err(other);
    let _ = std::fs::remove_file(&blob);
    prepared
}

impl Zygote {
    /// Adopt Node's socket (fd 3), load the snapshot, fork `slots` children
    /// and wait for each to report READY.
    pub fn start(base: &str, slots: usize, policy: ResetPolicy) -> io::Result<Self> {
        if slots == 0 || slots > wire::MAX_SLOTS {
            return Err(invalid("IPC shard capacity"));
        }
        // SAFETY: an all-zero stat is a valid out-value.
        let mut st: libc::stat = unsafe { std::mem::zeroed() };
        // SAFETY: fstat on fd 3 with a live out-buffer.
        let r = unsafe { libc::fstat(3, &mut st) };
        if r != 0 || st.st_mode & libc::S_IFMT != libc::S_IFSOCK {
            return Err(invalid("IPC: fd 3 must be Node's stream socket"));
        }
        // SAFETY: this startup path uniquely adopts the inherited fd 3.
        let node = Conn::new(unsafe { OwnedFd::from_raw_fd(3) }, wire::OUTBOUND);
        node.set_nonblocking()?;
        super::conn::buffers(node.fd());
        let snapshot = Snapshot::<State>::load_identified(base)?;
        let charge = service::ipc_charge(snapshot.class)?;
        let sandbox = sandbox(base)?;
        super::warm();
        let mut z = Self {
            node,
            states: (0..slots).map(|_| service::State::default()).collect(),
            children: Vec::with_capacity(slots),
            snapshot,
            policy,
            sandbox,
            charge,
        };
        for i in 0..slots {
            z.fork(i)?;
        }
        z.await_ready()?;
        z.node.queue(&Message::new(
            READY,
            0,
            0,
            0,
            ABI_VERSION.to_le_bytes().to_vec(),
        ))?;
        Ok(z)
    }
    /// Fork the child for slot `i`. Called only while this process has one
    /// thread, so the child inherits no lock another thread held.
    fn fork(&mut self, i: usize) -> io::Result<()> {
        if threads()? != 1 {
            return Err(invalid("HVF zygote must be single-threaded to fork"));
        }
        let (ours, theirs) = super::conn::pair()?;
        // SAFETY: fork in a single-threaded process (checked above).
        let pid = unsafe { libc::fork() };
        if pid < 0 {
            return Err(io::Error::last_os_error());
        }
        if pid == 0 {
            // Keep only this slot's socket, the snapshot and stdio: Node's
            // socket and the siblings' are closed (not dropped: this process
            // ends in _exit and never runs their destructors).
            let close = |fd: i32| {
                // SAFETY: closing a descriptor this copy of the process owns.
                unsafe { libc::close(fd) };
            };
            close(self.node.fd());
            close(ours.as_raw_fd());
            for c in self.children.iter().filter_map(|c| c.conn.as_ref()) {
                close(c.fd());
            }
            let code = match child::serve(
                theirs,
                i,
                self.snapshot.clone(),
                self.policy,
                Some(&mut self.sandbox),
            ) {
                Ok(()) => 0,
                Err(e) => {
                    eprintln!("hvf engine slot {i}: {e}");
                    70
                }
            };
            // SAFETY: end the child without unwinding into the zygote's frames.
            unsafe { libc::_exit(code) }
        }
        drop(theirs);
        let conn = Conn::new(ours, CHILD_QUEUE);
        conn.set_nonblocking()?;
        self.children.push(Child {
            pid,
            conn: Some(conn),
            dead: None,
            ready: false,
            kill_at: None,
            escalated: false,
            stats: false,
        });
        Ok(())
    }
    fn await_ready(&mut self) -> io::Result<()> {
        let until = clock::ipc_ns() + STARTUP_NS;
        while !self.children.iter().all(|c| c.ready) {
            let now = clock::ipc_ns();
            if now >= until {
                return Err(invalid("HVF engine: a slot did not start"));
            }
            let mut fds: Vec<libc::pollfd> = self
                .children
                .iter()
                .filter(|c| !c.ready)
                .map(|c| libc::pollfd {
                    fd: c.conn.as_ref().unwrap().fd(),
                    events: libc::POLLIN,
                    revents: 0,
                })
                .collect();
            let ms = ((until - now) / 1_000_000).max(1) as i32;
            // SAFETY: fds is a live array of fds.len() pollfds.
            unsafe { libc::poll(fds.as_mut_ptr(), fds.len() as _, ms) };
            for i in 0..self.children.len() {
                let c = &mut self.children[i];
                if c.ready {
                    continue;
                }
                let conn = c.conn.as_mut().unwrap();
                if !conn.fill()? {
                    let why = reap(c.pid);
                    return Err(io::Error::other(format!(
                        "HVF engine slot {i} failed to start: {why}"
                    )));
                }
                if let Some(m) = conn.next()? {
                    if m.kind != READY
                        || m.slot as usize != i
                        || m.bytes != ABI_VERSION.to_le_bytes()
                    {
                        return Err(invalid("HVF engine: child READY"));
                    }
                    c.ready = true;
                }
            }
        }
        Ok(())
    }

    /// Serve Node until it closes the socket. A Node protocol violation
    /// fails the whole engine closed, as on Linux.
    pub fn serve(&mut self) -> io::Result<()> {
        loop {
            let mut fds = vec![libc::pollfd {
                fd: self.node.fd(),
                events: libc::POLLIN
                    | if self.node.pending() {
                        libc::POLLOUT
                    } else {
                        0
                    },
                revents: 0,
            }];
            let live: Vec<usize> = (0..self.children.len())
                .filter(|&i| self.children[i].conn.is_some())
                .collect();
            for &i in &live {
                let c = self.children[i].conn.as_ref().unwrap();
                fds.push(libc::pollfd {
                    fd: c.fd(),
                    events: libc::POLLIN | if c.pending() { libc::POLLOUT } else { 0 },
                    revents: 0,
                });
            }
            let now = clock::ipc_ns();
            let next = self.children.iter().filter_map(|c| c.kill_at).min();
            let timeout = next.map_or(-1, |at| {
                (at.saturating_sub(now).div_ceil(1_000_000)).min(i32::MAX as u64) as i32
            });
            // SAFETY: fds is a live array of fds.len() pollfds.
            if unsafe { libc::poll(fds.as_mut_ptr(), fds.len() as _, timeout) } < 0 {
                let e = io::Error::last_os_error();
                if e.kind() != io::ErrorKind::Interrupted {
                    return Err(e);
                }
                continue;
            }
            self.escalate();
            if fds[0].revents != 0 {
                if !self.node.fill()? {
                    return Ok(()); // Node is gone
                }
                while let Some(m) = self.node.next()? {
                    self.message(m)?;
                }
            }
            for (k, &i) in live.iter().enumerate() {
                if fds[k + 1].revents != 0 {
                    self.drain_child(i)?;
                }
            }
            self.node.flush()?;
            for i in 0..self.children.len() {
                let flushed = match self.children[i].conn.as_mut() {
                    Some(c) => c.flush(),
                    None => Ok(()),
                };
                if flushed.is_err() {
                    self.died(i)?;
                }
            }
        }
    }
    /// Kill every child whose run or reset outlived its bound.
    fn escalate(&mut self) {
        let now = clock::ipc_ns();
        for c in &mut self.children {
            if c.conn.is_some() && c.kill_at.is_some_and(|at| now >= at) {
                c.kill_at = None;
                c.escalated = true;
                // SAFETY: a child of this process that has not been reaped.
                unsafe { libc::kill(c.pid, libc::SIGKILL) };
            }
        }
    }
    fn drain_child(&mut self, i: usize) -> io::Result<()> {
        let conn = self.children[i].conn.as_mut().unwrap();
        let open = conn.fill().unwrap_or(false);
        loop {
            let m = match self.children[i].conn.as_mut().map(Conn::next) {
                Some(Ok(Some(m))) => m,
                Some(Ok(None)) | None => break,
                Some(Err(_)) => return self.died(i),
            };
            if let Err(e) = self.child_message(i, m) {
                eprintln!("hvf engine: slot {i}: {e}");
                return self.died(i);
            }
        }
        if !open {
            return self.died(i);
        }
        Ok(())
    }
    /// A child's message: checked against its slot's state like the Linux
    /// reactor checks owner events, then forwarded to Node. An error means
    /// the child broke the protocol; the caller kills it.
    fn child_message(&mut self, i: usize, m: Message) -> io::Result<()> {
        let s = &mut self.states[i];
        let c = &mut self.children[i];
        if m.slot as usize != i || m.generation != s.generation || m.generation == 0 {
            return Err(invalid("child slot/generation"));
        }
        match m.kind {
            CALL => {
                if s.call(m.id.into(), &m.bytes)? {
                    self.node.queue(&m)?;
                }
            }
            service::STATS => {
                let n = m.bytes.len();
                if c.stats
                    || !(wire::STATS_FIXED_BYTES
                        ..=wire::STATS_FIXED_BYTES + 8 * wire::STATS_ROUND_TRIPS)
                        .contains(&n)
                    || (n - wire::STATS_FIXED_BYTES) as u64 / 8 != service::u64_at(&m.bytes, 24)
                    || !n.is_multiple_of(8)
                {
                    return Err(invalid("child STATS"));
                }
                c.stats = true;
                if s.phase == Phase::Running {
                    self.node.queue(&m)?;
                }
            }
            DONE | ERROR => {
                let bounded = if m.kind == DONE {
                    crate::payload::forwarded(ring::DONE, &m.bytes)
                } else {
                    m.bytes.len() <= wire::ERROR_BYTES
                };
                if !c.stats || m.id != 0 || !bounded {
                    return Err(invalid("child completion"));
                }
                if s.complete()? {
                    c.kill_at = None;
                    self.node.queue(&m)?;
                }
            }
            RELEASED => {
                c.kill_at = None;
                self.node.queue(&released(s, i, None)?)?;
            }
            QUARANTINED => {
                let why = String::from_utf8_lossy(&m.bytes).into_owned();
                c.kill_at = None;
                self.node.queue(&released(s, i, Some(why.clone()))?)?;
                // It never serves again: free its memory now.
                c.dead = Some(why);
                // SAFETY: a child of this process that has not been reaped.
                unsafe { libc::kill(c.pid, libc::SIGKILL) };
                reap(c.pid);
                c.conn = None;
            }
            _ => return Err(invalid("child message direction/kind")),
        }
        Ok(())
    }
    /// Child `i` is gone (or is killed now): end what it was running.
    fn died(&mut self, i: usize) -> io::Result<()> {
        let c = &mut self.children[i];
        if c.conn.is_none() {
            return Ok(());
        }
        // SAFETY: a child of this process that has not been reaped.
        unsafe { libc::kill(c.pid, libc::SIGKILL) };
        let why = format!("engine process exited ({})", reap(c.pid));
        c.conn = None;
        c.kill_at = None;
        c.dead = Some(why.clone());
        let s = &mut self.states[i];
        match s.phase {
            Phase::Running => {
                let text = if c.escalated {
                    "deadline_exceeded: engine process killed after its deadline".to_string()
                } else {
                    format!("slot_unavailable: {why}")
                };
                s.complete()?;
                self.node.queue(&service::stats(
                    i,
                    s.generation,
                    [0, clock::ipc_ns(), 0],
                    &[],
                ))?;
                self.node
                    .queue(&Message::new(ERROR, i, s.generation, 0, text.into_bytes()))?;
            }
            Phase::Resetting => self.node.queue(&released(s, i, Some(why))?)?,
            _ => {}
        }
        Ok(())
    }
    /// A Node message: the Linux reactor's checks (service::State), then the
    /// child gets it, or the zygote answers for a dead child.
    fn message(&mut self, m: Message) -> io::Result<()> {
        let i = m.slot as usize;
        if i >= self.states.len() || m.generation == 0 || m.generation >= u64::MAX >> 2 {
            return Err(invalid("IPC slot/generation"));
        }
        let now = clock::ipc_ns();
        let s = &mut self.states[i];
        let c = &mut self.children[i];
        match m.kind {
            START => {
                let (deadline, _) = s.start(&m, now, self.charge)?;
                c.stats = false;
                c.escalated = false;
                match (&c.dead, c.conn.as_mut()) {
                    (None, Some(conn)) => {
                        conn.queue(&m)?;
                        c.kill_at = Some(deadline.saturating_add(ESCALATION_NS));
                    }
                    (why, _) => {
                        let text = format!(
                            "slot_unavailable: {}",
                            why.as_deref().unwrap_or("engine process exited")
                        );
                        s.complete()?;
                        self.node
                            .queue(&service::stats(i, s.generation, [0, now, 0], &[]))?;
                        self.node.queue(&Message::new(
                            ERROR,
                            i,
                            s.generation,
                            0,
                            text.into_bytes(),
                        ))?;
                    }
                }
            }
            REPLY => {
                if s.reply(&m)?
                    && let Some(conn) = c.conn.as_mut()
                {
                    conn.queue(&m)?;
                }
            }
            CANCEL => match s.cancel(&m)? {
                Cancel::Unstarted => {
                    self.node
                        .queue(&Message::new(RELEASED, i, s.generation, 0, Vec::new()))?
                }
                Cancel::Reset => match c.conn.as_mut() {
                    Some(conn) => {
                        conn.queue(&m)?;
                        let grace = now.saturating_add(RESET_GRACE_NS);
                        c.kill_at = Some(c.kill_at.map_or(grace, |at| at.min(grace)));
                    }
                    None => {
                        let why = c.dead.clone().unwrap_or_default();
                        self.node.queue(&released(s, i, Some(why))?)?;
                    }
                },
            },
            _ => return Err(invalid("IPC message direction/kind")),
        }
        Ok(())
    }
    /// Kill and reap every child (Node is gone, or the engine fails closed).
    pub fn stop(&mut self) {
        for c in &mut self.children {
            if c.conn.take().is_some() {
                // SAFETY: a child of this process that has not been reaped.
                unsafe { libc::kill(c.pid, libc::SIGKILL) };
                reap(c.pid);
            }
        }
    }
    pub fn pids(&self) -> Vec<libc::pid_t> {
        self.children.iter().map(|c| c.pid).collect()
    }
}
/// Wait for a child; how it ended.
fn reap(pid: libc::pid_t) -> String {
    let mut status = 0;
    loop {
        // SAFETY: a live out-int; pid is this process's child.
        let r = unsafe { libc::waitpid(pid, &mut status, 0) };
        if r == pid {
            break;
        }
        if r < 0 && io::Error::last_os_error().kind() != io::ErrorKind::Interrupted {
            return "not reaped".into();
        }
    }
    if libc::WIFSIGNALED(status) {
        format!("signal {}", libc::WTERMSIG(status))
    } else {
        format!("exit {}", libc::WEXITSTATUS(status))
    }
}

/// `hvf ipc BASE SLOTS [POLICY]`: run the engine until Node closes fd 3.
pub fn run(base: &str, slots: usize, policy: ResetPolicy) -> io::Result<()> {
    let mut z = Zygote::start(base, slots, policy)?;
    let result = z.serve();
    if let Err(e) = &result {
        eprintln!("hvf engine IPC: {e}");
    }
    z.stop();
    result
}

/// What `hvf confine BASE` checks, in a forked child under the production
/// Seatbelt sandbox and in an unconfined control: HVF still works (a corpus
/// run), the snapshot's own directory is readable, and nothing else is.
pub fn confinement(base: &str) -> io::Result<String> {
    let mut sandbox = sandbox(base)?;
    super::warm();
    let listener = std::net::TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    let snapshot = Snapshot::<State>::load_identified(base)?;
    let mut rows = Vec::new();
    for confined in [false, true] {
        let (ours, theirs) = super::conn::pair()?;
        if threads()? != 1 {
            return Err(invalid(
                "HVF confinement check must be single-threaded to fork",
            ));
        }
        // SAFETY: fork in a single-threaded process (checked above).
        let pid = unsafe { libc::fork() };
        if pid == 0 {
            drop(ours);
            let row = probe(base, &snapshot, confined.then_some(&mut sandbox), port);
            let _ = super::conn::send(
                theirs.as_raw_fd(),
                &Message::new(READY, 0, 0, 0, row.into_bytes()),
            );
            // SAFETY: end the child without unwinding.
            unsafe { libc::_exit(0) }
        }
        drop(theirs);
        let mut conn = Conn::new(ours, 1);
        let mut row = None;
        while row.is_none() && conn.fill()? {
            row = conn.next()?;
        }
        reap(pid);
        let row = row.ok_or_else(|| invalid("confinement probe child exited without a report"))?;
        rows.push(String::from_utf8_lossy(&row.bytes).into_owned());
    }
    drop(listener);
    Ok(format!("[{}]", rows.join(",")))
}
fn probe(
    base: &str,
    snapshot: &Arc<Snapshot<State>>,
    sandbox: Option<&mut Sandbox>,
    port: u16,
) -> String {
    let confined = sandbox.is_some();
    let applied = match sandbox {
        Some(s) => s.before_build().map_err(|e| e.to_string()),
        None => Ok(()),
    };
    let allowed = |r: io::Result<()>| match r {
        Ok(()) => "true".to_string(),
        Err(e) => format!("{{\"denied\":{:?}}}", e.to_string()),
    };
    let run = || -> io::Result<()> {
        use crate::slot::Slot;
        let mut s = Slot::create(
            super::HvfVm::create()?,
            snapshot.clone(),
            ResetPolicy::default(),
        )?;
        let mut entropy = std::io::repeat(7);
        s.bind(2, include_str!("../../fixtures/return2.js"), &mut entropy);
        let step = s.exit().map_err(|e| io::Error::other(e.to_string()))?;
        if step.op != ring::FINISH || step.finish.as_deref() != Some("{\"ok\":2}") {
            return Err(io::Error::other("return 2 did not finish with 2"));
        }
        s.reset().map_err(|e| io::Error::other(e.to_string()))?;
        Ok(())
    };
    let own: PathBuf = Path::new(&format!("{base}.identity")).to_path_buf();
    let scratch = std::env::temp_dir().join(format!("jitk-hvf-confine-{}", std::process::id()));
    let ops = [
        ("hvf_run", allowed(run())),
        (
            "read_snapshot_dir",
            allowed(std::fs::read(&own).map(|_| ())),
        ),
        (
            "read_etc_hosts",
            allowed(std::fs::read("/etc/hosts").map(|_| ())),
        ),
        (
            "read_home",
            allowed(
                std::fs::read_dir(std::env::var("HOME").unwrap_or("/Users".into())).map(|_| ()),
            ),
        ),
        ("write_tmp", allowed(std::fs::write(&scratch, b"x"))),
        (
            "tcp_connect_localhost",
            allowed(std::net::TcpStream::connect(("127.0.0.1", port)).map(|_| ())),
        ),
        (
            "udp_send",
            allowed(
                std::net::UdpSocket::bind("127.0.0.1:0")
                    .and_then(|u| u.send_to(b"x", ("127.0.0.1", port)).map(|_| ())),
            ),
        ),
        (
            "spawn_true",
            allowed(
                std::process::Command::new("/usr/bin/true")
                    .status()
                    .map(|_| ()),
            ),
        ),
    ];
    let _ = std::fs::remove_file(&scratch);
    let fields: Vec<String> = ops.iter().map(|(k, v)| format!("\"{k}\":{v}")).collect();
    format!(
        "{{\"confined\":{confined},\"applied\":{},{}}}",
        allowed(applied.map_err(io::Error::other)),
        fields.join(",")
    )
}
