//! The macOS HVF engine (`hvf ipc BASE SLOTS`): the Linux shard's IPC service
//! (service.rs) over a socket to Node, with one engine process per slot behind
//! it instead of owner threads (hvf-spike/REPORT.md, "Mac engine shape").
//!
//! HVF allows one VM per process and runs a vCPU only on its creating thread,
//! so this process is a zygote: single-threaded, it loads and maps the
//! verified snapshot, enters its Seatbelt profile (`zygote_profile`) and
//! forks one child per slot (child.rs), but never creates a VM itself. Each
//! child inherits the profile and drops its fork grant (`child::confine`)
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
//!
//! Capacity comes back. Once a slot is QUARANTINED (or its process dies
//! while the slot is idle, which Node never sees), the zygote forks it a
//! fresh child from the snapshot it still holds; when that child is READY,
//! a QUARANTINED slot is reported RESTORED and admits its next generation.
//! Re-forks are budgeted (`Restores`): more than `restore_budget(slots)`
//! within `RESTORE_WINDOW_NS` is a crash loop, and the engine fails closed
//! instead of spinning.
use super::{State, child, conn::Conn};
use crate::clock;
use crate::constants::{ABI_VERSION, ipc as wire, ring};
use crate::service::{
    self, CALL, CANCEL, Cancel, DONE, ERROR, Message, Phase, QUARANTINED, READY, RELEASED, REPLY,
    RESTORED, START, invalid, released,
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
/// Children must all report READY within this at startup, and a re-forked
/// child within this of its fork (or it is killed and re-forked again).
const STARTUP_NS: u64 = 10_000_000_000;
/// The window of the re-fork budget.
pub const RESTORE_WINDOW_NS: u64 = 60_000_000_000;
/// Re-forks allowed within `RESTORE_WINDOW_NS`: two per slot, at least 4.
/// A slot is re-forked only after its process died or its reset failed;
/// neither happens to a healthy engine whatever its tenants run.
pub fn restore_budget(slots: usize) -> usize {
    (2 * slots).max(4)
}

/// The re-fork budget: when each re-fork within the window happened.
pub struct Restores {
    budget: usize,
    window: u64,
    at: std::collections::VecDeque<u64>,
}
impl Restores {
    pub fn new(budget: usize, window: u64) -> Self {
        Self {
            budget,
            window,
            at: std::collections::VecDeque::new(),
        }
    }
    /// Charge one re-fork at `now`. Err: the window already holds the whole
    /// budget (a crash loop).
    pub fn charge(&mut self, now: u64) -> io::Result<()> {
        while self
            .at
            .front()
            .is_some_and(|&t| now.saturating_sub(t) >= self.window)
        {
            self.at.pop_front();
        }
        if self.at.len() >= self.budget {
            return Err(io::Error::other(format!(
                "HVF engine: {} engine processes re-forked within {} s (crash loop); failing closed",
                self.budget,
                self.window / 1_000_000_000
            )));
        }
        self.at.push_back(now);
        Ok(())
    }
}

struct Child {
    pid: libc::pid_t,
    /// None once the process is gone.
    conn: Option<Conn>,
    /// Why the process is gone; QUARANTINED carries it.
    dead: Option<String>,
    ready: bool,
    /// A re-forked child must report READY by then.
    ready_by: Option<u64>,
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
    charge: u32,
    restores: Restores,
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

/// The Seatbelt profile the zygote enters before its first fork, compiled
/// for the snapshot's directory: vmm/sandbox's jitk.sb (deny by default;
/// read only the image directory, here the snapshot's; one sysctl) plus
/// `zygote.sb` (fork, signal its children). No other file, no write, network
/// or exec. Engine processes inherit it (macOS refuses a second
/// sandbox_apply) and drop the fork grant themselves (`child::confine`).
pub fn zygote_profile(base: &str) -> io::Result<Vec<u8>> {
    let image = std::fs::canonicalize(format!("{base}.mem"))?;
    let images = image
        .parent()
        .ok_or_else(|| invalid("snapshot directory"))?;
    let source = format!(
        "{}\n{}",
        super::confine::SEATBELT_PROFILE,
        super::seatbelt::ZYGOTE_RULES
    );
    super::seatbelt::compile(&source, images)
}

impl Zygote {
    /// Adopt Node's socket (fd 3), load the snapshot, confine this process
    /// (`zygote.sb`), fork `slots` children
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
        super::warm();
        // What needs a file outside the snapshot directory or a sysctl is
        // done: confine this process before the first fork, so every engine
        // process starts confined too.
        super::seatbelt::apply(&zygote_profile(base)?)?;
        let mut z = Self {
            node,
            states: (0..slots).map(|_| service::State::default()).collect(),
            children: Vec::with_capacity(slots),
            snapshot,
            policy,
            charge,
            restores: Restores::new(restore_budget(slots), RESTORE_WINDOW_NS),
        };
        for i in 0..slots {
            let child = z.fork(i)?;
            z.children.push(child);
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
    fn fork(&mut self, i: usize) -> io::Result<Child> {
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
            let code = match child::serve(theirs, i, self.snapshot.clone(), self.policy, true) {
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
        Ok(Child {
            pid,
            conn: Some(conn),
            dead: None,
            ready: false,
            ready_by: None,
            kill_at: None,
            escalated: false,
            stats: false,
        })
    }
    /// Replace slot `i`'s dead process with a fresh child of the snapshot,
    /// within the re-fork budget (spent: the engine fails closed). It reports
    /// READY later (`child_message`); what Node sends meanwhile queues on
    /// its socket.
    fn restore(&mut self, i: usize) -> io::Result<()> {
        self.restores.charge(clock::ipc_ns())?;
        let mut child = self.fork(i)?;
        child.ready_by = Some(clock::ipc_ns().saturating_add(STARTUP_NS));
        self.children[i] = child;
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
            let next = self
                .children
                .iter()
                .flat_map(|c| [c.kill_at, c.ready_by])
                .flatten()
                .min();
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
            // Capacity comes back: a slot without a process that Node has
            // been told is gone, or that was idle, gets a fresh one.
            for i in 0..self.children.len() {
                if self.children[i].conn.is_none()
                    && matches!(self.states[i].phase, Phase::Idle | Phase::Quarantined)
                {
                    self.restore(i)?;
                }
            }
        }
    }
    /// Kill every child whose run or reset outlived its bound, and every
    /// re-forked child that did not start in time.
    fn escalate(&mut self) {
        let now = clock::ipc_ns();
        for c in &mut self.children {
            if c.conn.is_none() {
                continue;
            }
            if c.kill_at.is_some_and(|at| now >= at) {
                c.kill_at = None;
                c.escalated = true;
                // SAFETY: a child of this process that has not been reaped.
                unsafe { libc::kill(c.pid, libc::SIGKILL) };
            }
            if c.ready_by.is_some_and(|at| now >= at) {
                c.ready_by = None;
                // SAFETY: as above.
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
        if !c.ready {
            // A re-forked child's first message is READY, as at startup.
            if m.kind != READY || m.slot as usize != i || m.bytes != ABI_VERSION.to_le_bytes() {
                return Err(invalid("HVF engine: child READY"));
            }
            c.ready = true;
            c.ready_by = None;
            if s.phase == Phase::Quarantined {
                // Node was told the slot is gone; it is back, at the
                // generation QUARANTINED ended.
                s.phase = Phase::Idle;
                self.node
                    .queue(&Message::new(RESTORED, i, s.generation, 0, Vec::new()))?;
            }
            return Ok(());
        }
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
                // This process never serves again: free its memory now
                // (`serve` forks the slot a fresh one).
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
    /// Child `i` is gone (or is killed now): end what it was running. `serve`
    /// re-forks the slot once Node knows (QUARANTINED) or need not (idle); a
    /// run this ends stays Done until Node's CANCEL quarantines the slot.
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
        c.ready_by = None;
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

/// Who a `hvf confine` probe process is.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Probed {
    /// The control: allowed everything below.
    Unconfined,
    /// An engine process as the zygote forks it: the zygote's profile, then
    /// `child::confine` (no fork).
    Engine,
    /// The zygote: its profile (`zygote_profile`).
    Zygote,
}
impl Probed {
    pub const ALL: [Probed; 3] = [Probed::Unconfined, Probed::Engine, Probed::Zygote];
    pub fn name(self) -> &'static str {
        match self {
            Probed::Unconfined => "unconfined",
            Probed::Engine => "engine",
            Probed::Zygote => "zygote",
        }
    }
}

/// What `hvf confine BASE` checks, in forked children confined as in
/// production and in an unconfined control (one JSON row each, in
/// `Probed::ALL` order): an engine process still runs HVF (a corpus run) and
/// reads its snapshot directory, nothing else (no fork); the zygote can still
/// fork an engine process (which confines itself, runs HVF and cannot fork),
/// signal and reap a child, count its own threads and read the snapshot
/// directory, nothing else.
pub fn confinement(base: &str) -> io::Result<String> {
    let zygote = zygote_profile(base)?;
    super::warm();
    let listener = std::net::TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    let snapshot = Snapshot::<State>::load_identified(base)?;
    let mut rows = Vec::new();
    for who in Probed::ALL {
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
            let row = probe(base, &snapshot, who, &zygote, port);
            let _ = super::conn::send(
                theirs.as_raw_fd(),
                &Message::new(READY, 0, 0, 0, row.into_bytes()),
            );
            // SAFETY: end the child without unwinding.
            unsafe { libc::_exit(0) }
        }
        drop(theirs);
        rows.push(String::from_utf8_lossy(&report(ours, pid)?).into_owned());
    }
    drop(listener);
    Ok(format!("[{}]", rows.join(",")))
}
/// The one record a probe process sends, after it exits.
fn report(ours: OwnedFd, pid: libc::pid_t) -> io::Result<Vec<u8>> {
    let mut conn = Conn::new(ours, 1);
    let mut row = None;
    while row.is_none() && conn.fill()? {
        row = conn.next()?;
    }
    reap(pid);
    row.map(|m| m.bytes)
        .ok_or_else(|| invalid("confinement probe child exited without a report"))
}
/// `return 2` in a fresh slot of this process's one VM, then a reset.
fn hvf_run(snapshot: &Arc<Snapshot<State>>) -> io::Result<()> {
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
}
/// What the zygote does per slot: fork a child that runs HVF. A confined
/// caller's child confines itself as an engine process does
/// (`child::confine`) and must then be unable to fork.
fn fork_engine(snapshot: &Arc<Snapshot<State>>, confined: bool) -> io::Result<()> {
    let (ours, theirs) = super::conn::pair()?;
    if threads()? != 1 {
        return Err(invalid("probe must be single-threaded to fork"));
    }
    // SAFETY: fork in a single-threaded process (checked above).
    let pid = unsafe { libc::fork() };
    if pid < 0 {
        return Err(io::Error::last_os_error());
    }
    if pid == 0 {
        drop(ours);
        let unforkable = || {
            // SAFETY: a probe fork; a child that exists exits at once.
            match unsafe { libc::fork() } {
                // SAFETY: the forked copy ends without unwinding.
                0 => unsafe { libc::_exit(0) },
                pid if pid > 0 => {
                    reap(pid);
                    Err(io::Error::other("a confined engine process could fork"))
                }
                _ => Ok(()),
            }
        };
        let result = if confined {
            child::confine()
                .and_then(|()| hvf_run(snapshot))
                .and_then(|()| unforkable())
        } else {
            hvf_run(snapshot)
        };
        let text = match result {
            Ok(()) => "ok".to_string(),
            Err(e) => e.to_string(),
        };
        let _ = super::conn::send(
            theirs.as_raw_fd(),
            &Message::new(READY, 0, 0, 0, text.into_bytes()),
        );
        // SAFETY: end the child without unwinding.
        unsafe { libc::_exit(0) }
    }
    drop(theirs);
    match report(ours, pid)? {
        b if b == b"ok" => Ok(()),
        b => Err(io::Error::other(format!(
            "engine process: {}",
            String::from_utf8_lossy(&b)
        ))),
    }
}
/// Kill and reap a child, as the zygote does on escalation.
fn signal_child() -> io::Result<()> {
    // SAFETY: fork in a single-threaded probe process; the child only pauses.
    let pid = unsafe { libc::fork() };
    if pid < 0 {
        return Err(io::Error::last_os_error());
    }
    if pid == 0 {
        loop {
            // SAFETY: waits for the parent's signal.
            unsafe { libc::pause() };
        }
    }
    // SAFETY: own unreaped child.
    let killed = unsafe { libc::kill(pid, libc::SIGKILL) };
    let e = io::Error::last_os_error();
    if killed != 0 {
        // SAFETY: the kill was refused: the child must still go.
        unsafe { libc::kill(pid, libc::SIGTERM) };
    }
    let how = reap(pid);
    if killed != 0 {
        return Err(e);
    }
    if how != "signal 9" {
        return Err(io::Error::other(format!("child ended with {how}")));
    }
    Ok(())
}
fn probe(
    base: &str,
    snapshot: &Arc<Snapshot<State>>,
    who: Probed,
    zygote: &[u8],
    port: u16,
) -> String {
    let applied = match who {
        Probed::Unconfined => Ok(()),
        Probed::Engine => super::seatbelt::apply(zygote).and_then(|()| child::confine()),
        Probed::Zygote => super::seatbelt::apply(zygote),
    };
    let allowed = |r: io::Result<()>| match r {
        Ok(()) => "true".to_string(),
        Err(e) => format!("{{\"denied\":{:?}}}", e.to_string()),
    };
    // Forks first, while this process has one thread and no VM.
    let forked = allowed(fork_engine(snapshot, who != Probed::Unconfined));
    let signalled = allowed(signal_child());
    let counted = allowed(threads().map(|_| ()));
    // The zygote never creates a VM (HVF is not mediated, so it could).
    let run = match who {
        Probed::Zygote => "null".to_string(),
        _ => allowed(hvf_run(snapshot)),
    };
    let own: PathBuf = Path::new(&format!("{base}.identity")).to_path_buf();
    let scratch = std::env::temp_dir().join(format!("jitk-hvf-confine-{}", std::process::id()));
    let ops = [
        ("fork_engine", forked),
        ("signal_child", signalled),
        ("count_threads", counted),
        ("hvf_run", run),
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
        "{{\"confined\":\"{}\",\"applied\":{},{}}}",
        who.name(),
        allowed(applied),
        fields.join(",")
    )
}

#[cfg(test)]
mod restore_tests {
    use super::{RESTORE_WINDOW_NS, Restores, restore_budget};
    #[test]
    fn restore_budget_fails_a_crash_loop_and_refills_with_time() {
        assert_eq!((restore_budget(1), restore_budget(8)), (4, 16));
        let s = 1_000_000_000;
        let mut r = Restores::new(3, 10 * s);
        for t in [0, s, 2 * s] {
            r.charge(t).unwrap();
        }
        let e = r.charge(3 * s).unwrap_err().to_string();
        assert!(e.contains("crash loop"), "{e}");
        // The first re-fork leaves the window at 10 s, the next at 11 s.
        r.charge(10 * s).unwrap();
        assert!(r.charge(10 * s + 1).is_err());
        r.charge(11 * s).unwrap();
        assert!(RESTORE_WINDOW_NS >= 10 * s);
    }
}
