//! One HVF engine process: one VM, one slot, its vCPU on this process's main
//! thread (HVF runs a vCPU only on the thread that created it). Forked by the
//! zygote, which speaks the Node IPC protocol (service.rs) for this one slot
//! over a socket; the child runs the KVM owner's per-generation logic
//! (owner.rs, Mode::Policy) on it.
//!
//! Two more threads, neither of which touches the vCPU's state:
//! - the reader owns the socket's read side. It forwards every message to the
//!   main thread and, without waiting for it, stops a running vCPU
//!   (`Kicker`, hv_vcpus_exit) on a CANCEL and at the START deadline. These
//!   are the lease and kick of the Linux shard, in-process; the zygote kills
//!   the process if neither ends the run (zygote.rs, escalation).
//! - the job clock (clock.rs) keeps the guest's MONOTONIC_NS current inside
//!   a run.
//!
//! Deadlines and STATS times are on `clock::ipc_ns` (Node's process.hrtime).
use super::{HvfVm, Kicker, State, conn};
use crate::calls::Calls;
use crate::clock::{self, Clock};
use crate::constants::{ABI_VERSION, ipc::ERROR_BYTES, ring};
use crate::service::{
    self, CALL, CANCEL, DONE, ERROR, LOG, Message, QUARANTINED, READY, RELEASED, REPLY, START,
    invalid, u64_at,
};
use crate::slot::{Request, ResetPolicy, RunError, Slot};
use crate::snapshot::Snapshot;
use std::{
    io::{self, Read},
    os::fd::{AsRawFd, OwnedFd, RawFd},
    sync::{
        Arc,
        atomic::{AtomicBool, AtomicU64, Ordering::SeqCst},
        mpsc::{Receiver, RecvTimeoutError, SyncSender, sync_channel},
    },
    time::Instant,
};

enum Cmd {
    Msg(Message),
    /// The reader's deadline for this generation passed.
    Expired(u64),
}
/// What the main thread and the reader share.
struct Signals {
    kicker: Kicker,
    /// The generation bound to the slot and not finished; 0 when none.
    active: AtomicU64,
    /// The last generation the reader stopped (CANCEL or deadline).
    stopped: AtomicU64,
    /// The zygote closed the socket: stop and return.
    closed: AtomicBool,
}
impl Signals {
    fn stop(&self, generation: u64) {
        self.stopped.store(generation, SeqCst);
        // A kick outside hv_vcpu_run makes the next one return at once, so
        // only kick the generation that is running; one that is not active
        // yet sees `stopped` before its first run (`Engine::start`).
        if self.active.load(SeqCst) == generation {
            let _ = self.kicker.kick();
        }
    }
}
/// getentropy(2): no descriptor, so nothing to open after confinement.
struct Entropy;
impl Read for Entropy {
    fn read(&mut self, b: &mut [u8]) -> io::Result<usize> {
        let n = b.len().min(256);
        // SAFETY: b has at least n writable bytes.
        if unsafe { libc::getentropy(b.as_mut_ptr().cast(), n) } != 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(n)
    }
}
fn thread_cpu() -> u64 {
    clock::clock_ns(libc::CLOCK_THREAD_CPUTIME_ID)
}
/// One generation from START to its completion.
struct Run {
    generation: u64,
    deadline: u64,
    /// Calls sent to Node and not yet answered, and when each was sent.
    calls: Calls,
    round_trips: Vec<u64>,
    cpu_ns: u64,
    /// The guest parked with a timer (its ppoll deadline): resume it then.
    wake_at: Option<Instant>,
}
struct Engine {
    slot: Slot<HvfVm>,
    index: usize,
    out: RawFd,
    /// What the current command produced, written to the zygote in one
    /// write when it is done (`flush`).
    outbox: Vec<Message>,
    signals: Arc<Signals>,
    charge: u32,
    run: Option<Run>,
}

/// What an engine process does to its inherited confinement before its VM
/// exists. It runs under the zygote's profile (zygote.rs `zygote_profile`:
/// jitk.sb plus fork and signalling children), because macOS
/// refuses a second sandbox_apply in a sandboxed process. It takes the fork
/// grant away itself: RLIMIT_NPROC 0, which an unprivileged process cannot
/// raise again. That does not bind root, so the engine refuses to run as root.
pub fn confine() -> io::Result<()> {
    // SAFETY: no arguments.
    if unsafe { libc::geteuid() } == 0 {
        return Err(io::Error::other(
            "HVF engine: refusing to run as root (RLIMIT_NPROC does not bind root)",
        ));
    }
    let none = libc::rlimit {
        rlim_cur: 0,
        rlim_max: 0,
    };
    // SAFETY: a live rlimit value.
    if unsafe { libc::setrlimit(libc::RLIMIT_NPROC, &none) } != 0 {
        return Err(io::Error::last_os_error());
    }
    Ok(())
}

/// Serve slot `index` on `fd` until the zygote closes it. `confined` (the
/// production path): drop the fork grant first, before the VM exists
/// (`confine`).
pub fn serve(
    fd: OwnedFd,
    index: usize,
    snapshot: Arc<Snapshot<State>>,
    policy: ResetPolicy,
    confined: bool,
) -> io::Result<()> {
    if confined {
        confine()?;
    }
    let charge = service::ipc_charge(snapshot.class);
    let mut slot = Slot::create(HvfVm::create()?, snapshot, policy)?;
    let clock = Clock::start(1);
    slot.set_clock(clock.cell(0));
    let signals = Arc::new(Signals {
        kicker: slot.vcpu().kicker(),
        active: AtomicU64::new(0),
        stopped: AtomicU64::new(0),
        closed: AtomicBool::new(false),
    });
    // A generation brings at most START, a REPLY per open call and CANCEL,
    // plus the reader's Expired; the zygote bounds what it queues for this child.
    let (tx, rx) = sync_channel(ring::MAX_OUTSTANDING + 4);
    let read = fd.try_clone()?;
    let reader = signals.clone();
    std::thread::Builder::new()
        .name("jitk-hvf-reader".into())
        .spawn(move || reader_loop(read, reader, tx))?;
    let mut engine = Engine {
        slot,
        index,
        out: fd.as_raw_fd(),
        outbox: Vec::new(),
        signals,
        charge,
        run: None,
    };
    engine.outbox.push(Message::new(
        READY,
        index,
        0,
        0,
        ABI_VERSION.to_le_bytes().to_vec(),
    ));
    engine.flush()?;
    let result = engine.serve(&rx);
    drop(engine); // the vCPU and VM, on this thread
    drop(clock);
    drop(fd);
    result
}

impl Engine {
    /// Write the outbox to the zygote in one write.
    fn flush(&mut self) -> io::Result<()> {
        let sent = conn::send(self.out, &self.outbox);
        self.outbox.clear();
        sent
    }
    fn serve(&mut self, rx: &Receiver<Cmd>) -> io::Result<()> {
        loop {
            // An idle pristine slot drops its pages once due (ResetPolicy
            // idle_trim); a parked guest's timer resumes it.
            let due = match &self.run {
                None => self.slot.trim_due(),
                Some(run) => run.wake_at,
            };
            // None: `due` passed first.
            let cmd = match due {
                Some(due) => match rx.recv_timeout(due.saturating_duration_since(Instant::now())) {
                    Ok(cmd) => Some(cmd),
                    Err(RecvTimeoutError::Timeout) => None,
                    Err(RecvTimeoutError::Disconnected) => return Ok(()),
                },
                None => match rx.recv() {
                    Ok(cmd) => Some(cmd),
                    Err(_) => return Ok(()),
                },
            };
            match cmd {
                None => match self.run.as_mut() {
                    None => self.slot.trim(),
                    Some(run) => {
                        run.wake_at = None;
                        self.drive()?;
                    }
                },
                Some(Cmd::Msg(m)) if m.slot as usize != self.index => {
                    return Err(invalid("HVF child: message for another slot"));
                }
                Some(Cmd::Msg(m)) => match m.kind {
                    START => self.start(m)?,
                    REPLY => self.reply(m)?,
                    CANCEL => self.cancel(m.generation),
                    _ => return Err(invalid("HVF child: message direction/kind")),
                },
                Some(Cmd::Expired(generation)) => {
                    if self
                        .run
                        .as_ref()
                        .is_some_and(|r| r.generation == generation)
                    {
                        let deadline_ns = self.run.as_ref().unwrap().deadline;
                        self.finish(Err(RunError::Deadline { deadline_ns }));
                    }
                }
            }
            // What the command's last exit produced leaves in one write:
            // console lines with the calls of a WAIT, or with STATS and the
            // completion.
            self.flush()?;
        }
    }
    fn start(&mut self, m: Message) -> io::Result<()> {
        // The zygote admitted it (service::State::start); a second check here
        // costs nothing and keeps the child's own bounds local.
        let (deadline, source) = service::admission(&m, clock::ipc_ns(), self.charge)?;
        if self.run.is_some() {
            return Err(invalid("HVF child: START while a run is active"));
        }
        let cpu = thread_cpu();
        let generation = m.generation;
        if self.slot.admit().is_err() {
            // Quarantined: nothing is bound; fail just this job.
            self.outbox.push(service::stats(
                self.index,
                generation,
                [thread_cpu() - cpu, clock::ipc_ns(), 0, 0],
                &[],
            ));
            self.outbox.push(Message::new(
                ERROR,
                self.index,
                generation,
                0,
                RunError::SlotUnavailable.to_string().into_bytes(),
            ));
            return Ok(());
        }
        self.slot.bind(generation, &source, &mut Entropy);
        self.signals.active.store(generation, SeqCst);
        self.run = Some(Run {
            generation,
            deadline,
            calls: Calls::default(),
            round_trips: Vec::new(),
            cpu_ns: thread_cpu() - cpu,
            wake_at: None,
        });
        // The reader may have stopped this generation (a CANCEL read with
        // the START, or its deadline) before `active` was set, so without a
        // kick: its CANCEL or Expired follows; the vCPU must not run first.
        // Set active, then read stopped (Signals::stop: the reverse), so one
        // of the two sees the other. A kick that does land as well makes the
        // next run return once at once, which `drive` tolerates.
        if self.signals.stopped.load(SeqCst) == generation {
            return Ok(());
        }
        if clock::ipc_ns() >= deadline {
            self.finish(Err(RunError::Deadline {
                deadline_ns: deadline,
            }));
            return Ok(());
        }
        self.drive()
    }
    fn reply(&mut self, m: Message) -> io::Result<()> {
        let Some(run) = self.run.as_mut() else {
            return Ok(()); // a reply in flight when the run ended
        };
        if run.generation != m.generation {
            return Ok(());
        }
        let Some(sent) = run.calls.answer(m.id.into()) else {
            return Ok(());
        };
        let cpu = thread_cpu();
        run.round_trips.push(clock::ipc_ns().saturating_sub(sent));
        run.wake_at = None;
        let request = Request {
            id: m.id.into(),
            bytes: m.bytes,
        };
        let replied = self.slot.reply(&request);
        let run = self.run.as_mut().unwrap();
        run.cpu_ns += thread_cpu() - cpu;
        match replied {
            Ok(()) => self.drive(),
            Err(e) => {
                self.finish(Err(e));
                Ok(())
            }
        }
    }
    /// Node released this generation: reset (one reset per lifecycle: a run
    /// that failed was reset in `finish`) and report RELEASED, or QUARANTINED
    /// with the reason when the reset failed.
    fn cancel(&mut self, generation: u64) {
        self.run = None;
        self.signals.active.store(0, SeqCst);
        if !self.slot.is_pristine() && !self.slot.is_quarantined() {
            let _ = self.slot.reset(); // a failure quarantines the slot
        }
        let m = match self.slot.quarantine_reason() {
            Some(why) => {
                let mut b = why.as_bytes().to_vec();
                b.truncate(ERROR_BYTES);
                Message::new(QUARANTINED, self.index, generation, 0, b)
            }
            None => Message::new(RELEASED, self.index, generation, 0, Vec::new()),
        };
        self.outbox.push(m);
    }
    /// Run the vCPU to the next point that needs Node (calls to answer, or a
    /// WAIT), or to the end of the run.
    fn drive(&mut self) -> io::Result<()> {
        loop {
            // Calls and console lines of an exit the guest runs on from
            // (SUBMIT) go out before it runs again.
            if !self.outbox.is_empty() {
                self.flush()?;
            }
            let run = self.run.as_mut().unwrap();
            let generation = run.generation;
            let cpu = thread_cpu();
            let exit = self.slot.try_exit();
            let run = self.run.as_mut().unwrap();
            run.cpu_ns += thread_cpu() - cpu;
            let step = match exit {
                Err(e) => {
                    self.finish(Err(e));
                    return Ok(());
                }
                Ok(None) => {
                    // Kicked: the reader's command (CANCEL, Expired) follows.
                    if self.signals.stopped.load(SeqCst) == generation
                        || self.signals.closed.load(SeqCst)
                    {
                        return Ok(());
                    }
                    if clock::ipc_ns() >= run.deadline {
                        let deadline_ns = run.deadline;
                        self.finish(Err(RunError::Deadline { deadline_ns }));
                        return Ok(());
                    }
                    continue;
                }
                Ok(Some(step)) => step,
            };
            // Console lines first: the last ones often share the FINISH exit.
            for line in step.logs {
                let log = Message::new(LOG, self.index, generation, 0, line);
                self.outbox.push(log);
            }
            if step.op == ring::FINISH {
                let result = if !self.slot.repaired() {
                    Err(RunError::GuestProtocol("missing repair acknowledgement"))
                } else {
                    step.finish
                        .ok_or(RunError::GuestProtocol("missing completion"))
                };
                self.finish(result);
                return Ok(());
            }
            if (step.op == ring::REPAIRED_READY && !self.slot.repaired())
                || !matches!(step.op, ring::SUBMIT | ring::WAIT | ring::REPAIRED_READY)
            {
                self.finish(Err(RunError::GuestProtocol("unexpected checkpoint/repair")));
                return Ok(());
            }
            // Request bytes are opaque here; Node owns the call schema.
            let now = clock::ipc_ns();
            for r in step.requests {
                if !run.calls.issue(r.id, now) {
                    return Err(invalid("HVF child: call outside the outstanding bound"));
                }
                let call = Message::new(CALL, self.index, generation, r.id, r.bytes);
                self.outbox.push(call);
            }
            // A WAIT parks the guest until Node answers or its timer is due,
            // unless RX records still wait for ring space: then it runs on,
            // reads them and frees it. SUBMIT (TX full) runs on.
            if step.op == ring::WAIT && !self.slot.backlogged() {
                run.wake_at = crate::slot::wake_time(self.slot.wait_deadline());
                return Ok(());
            }
        }
    }
    /// End the run: past its deadline any result is a deadline; an error
    /// resets the slot now (KVM's Retention::ResetErrors). STATS, then DONE
    /// or ERROR.
    fn finish(&mut self, result: Result<String, RunError>) {
        let run = self.run.take().unwrap();
        self.signals.active.store(0, SeqCst);
        let stopped = clock::ipc_ns();
        let result = if stopped < run.deadline {
            result
        } else {
            Err(RunError::Deadline {
                deadline_ns: run.deadline,
            })
        };
        let mut cpu_ns = run.cpu_ns;
        let mut reset_done = 0;
        let heap_peak = self.slot.heap_peak();
        if result.is_err() {
            let cpu = thread_cpu();
            let _ = self.slot.reset(); // a failure quarantines the slot
            cpu_ns += thread_cpu() - cpu;
            reset_done = clock::ipc_ns();
        }
        self.outbox.push(service::stats(
            self.index,
            run.generation,
            [cpu_ns, stopped, reset_done, heap_peak],
            &run.round_trips,
        ));
        let (kind, bytes) = match result {
            Ok(text) => (DONE, text.into_bytes()),
            Err(e) => (ERROR, e.to_string().into_bytes()),
        };
        self.outbox
            .push(Message::new(kind, self.index, run.generation, 0, bytes));
    }
}

/// The socket's read side. When the zygote goes away (or the stream breaks),
/// the vCPU is stopped whatever it is doing and the command channel closes,
/// so the main thread returns and the process exits.
fn reader_loop(fd: OwnedFd, signals: Arc<Signals>, tx: SyncSender<Cmd>) {
    let _ = read_commands(
        conn::Conn::new(fd, 0).carrying_node_messages(),
        &signals,
        &tx,
    );
    signals.closed.store(true, SeqCst);
    let _ = signals.kicker.kick();
}
/// Forward every message; stop the vCPU on CANCEL and at the START deadline.
/// Returns at the end of the stream.
fn read_commands(mut conn: conn::Conn, signals: &Signals, tx: &SyncSender<Cmd>) -> io::Result<()> {
    let send = |c| {
        tx.send(c)
            .map_err(|_| invalid("HVF child: main thread gone"))
    };
    // The START deadline of the running generation, until it fires or the
    // generation is cancelled.
    let mut armed: Option<(u64, u64)> = None;
    loop {
        let timeout = armed.map_or(-1, |(_, deadline)| {
            let left = deadline.saturating_sub(clock::ipc_ns());
            left.div_ceil(1_000_000).min(i32::MAX as u64) as i32
        });
        let mut p = libc::pollfd {
            fd: conn.fd(),
            events: libc::POLLIN,
            revents: 0,
        };
        // SAFETY: one live pollfd.
        if unsafe { libc::poll(&mut p, 1, timeout) } < 0 {
            let e = io::Error::last_os_error();
            if e.kind() != io::ErrorKind::Interrupted {
                return Err(e);
            }
        }
        if let Some((generation, deadline)) = armed
            && clock::ipc_ns() >= deadline
        {
            armed = None;
            signals.stop(generation);
            send(Cmd::Expired(generation))?;
        }
        if p.revents == 0 {
            continue;
        }
        if !conn.fill()? {
            return Ok(());
        }
        while let Some(m) = conn.next()? {
            match m.kind {
                START if m.bytes.len() >= 8 => armed = Some((m.generation, u64_at(&m.bytes, 0))),
                CANCEL => {
                    if armed.is_some_and(|(g, _)| g == m.generation) {
                        armed = None;
                    }
                    signals.stop(m.generation);
                }
                _ => {}
            }
            send(Cmd::Msg(m))?;
        }
    }
}
