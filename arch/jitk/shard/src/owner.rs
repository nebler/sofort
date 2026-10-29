//! Fixed owner threads construct, run, reset and destroy their own VM/vCPU fds.
//! Waiting slots retain no execution stack. The reactor sends bounded commands;
//! the watchdog shares only generation-fenced leases and eventfd wakeups.
//!
//! An owner serves many slots on one thread, so no slot may hold it: a guest
//! that never exits (`while(true){}`) would otherwise delay every command for
//! the owner's other slots until its deadline. An owner runs a vCPU only for
//! a turn: a command for any of its slots kicks it out of KVM_RUN at once
//! (`Attention`), and while other slots are runnable the clock thread kicks
//! it after `SLICE`. Kicked, it services its mailbox, expiries and timers,
//! then resumes runnable slots round-robin. A kick only interrupts; what
//! happens to a run is decided by its generation-fenced lease and commands.
use crate::{
    calls::Calls,
    clock::{self, Clock},
    constants::ring,
    kvm::{self, Kvm, Request, ResetPolicy, ResetReport, RunError, Slot, Snapshot},
    lease::{self, Lease, Wake, Watchdog},
};
use std::{
    collections::VecDeque,
    fs::File,
    io,
    sync::{
        Arc, Barrier,
        atomic::{AtomicBool, AtomicI32, AtomicU64, Ordering::*},
        mpsc::{self, Receiver, SyncSender},
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};
/// The longest turn a vCPU gets while another slot of its owner is runnable.
pub const SLICE: Duration = Duration::from_millis(10);
#[derive(Clone, Copy, PartialEq)]
pub enum Mode {
    Run,
    Wait,
    Ready,
    Retain,
    Policy,
}
pub struct Job {
    pub generation: u64,
    pub source: String,
    pub mode: Mode,
    pub deadline_ns: u64,
    pub canary: bool,
    /// Optional stopped-slot entry bytes supplied by an offline caller.
    pub entry: Option<&'static [u8]>,
}
#[derive(Default)]
pub struct Metrics {
    /// Reset time in `begin()`; 0 when the slot was already pristine.
    pub reset_ns: u64,
    /// The reset `begin()` performed, if any.
    pub reset: Option<ResetReport>,
    pub run_ns: u64,
    pub cpu_ns: u64,
    pub calls: u64,
    pub tool_ns: u64,
    pub policy_round_trips: Vec<u64>,
    pub wait_to_finish_ns: u64,
    pub exits: u64,
}
pub struct Completion {
    pub result: Result<String, RunError>,
    pub seed: [u8; 16],
    pub metrics: Metrics,
    pub stopped_ns: u64,
    pub reset_done_ns: u64,
}
pub enum Event {
    /// Policy mode: guest calls and console lines to forward to Node.
    Calls {
        slot: usize,
        generation: u64,
        requests: Vec<Request>,
        logs: Vec<Vec<u8>>,
    },
    Parked {
        slot: usize,
        generation: u64,
    },
    Done {
        slot: usize,
        generation: u64,
        completion: Completion,
    },
    /// The slot is reset (or was pristine); `quarantined` names why it is
    /// instead out of service for good.
    Reset {
        slot: usize,
        quarantined: Option<String>,
    },
}
enum Command {
    Start(usize, Job),
    Resume(usize, u64),
    Reply(usize, u64, Request),
    Reset(usize),
    Cancel(usize),
    Stop,
}
/// What an owner thread shares with the reactor (mail) and the clock thread
/// (its time slice), so that neither waits behind a running vCPU.
struct Attention {
    /// The owner thread's id: where kicks go.
    tid: AtomicI32,
    /// The owner is between `enter` and `leave`: it may be inside KVM_RUN.
    driving: AtomicBool,
    /// Commands were queued since the owner last took its mail.
    mail: AtomicBool,
    /// Monotonic ns at which the clock thread kicks the owner; u64::MAX: never.
    slice_end: AtomicU64,
}
impl Attention {
    fn new() -> Self {
        Self {
            tid: AtomicI32::new(0),
            driving: AtomicBool::new(false),
            mail: AtomicBool::new(false),
            slice_end: AtomicU64::new(u64::MAX),
        }
    }
    /// Sender, after queueing a command: kick a driving owner, once per
    /// batch of mail. With `enter` this is Dekker's pattern (SeqCst): either
    /// the owner sees the mail before it drives, or this sees it driving.
    fn post(&self) {
        if !self.mail.swap(true, SeqCst) && self.driving.load(SeqCst) {
            lease::kick_thread(self.tid.load(Relaxed));
        }
    }
    /// Owner, before it drains its mailbox.
    fn take_mail(&self) {
        self.mail.store(false, SeqCst);
    }
    /// Owner, before it drives a slot; false when mail came first (take it,
    /// then drive). `slice_end`: when the clock thread should kick it.
    fn enter(&self, slice_end: u64) -> bool {
        self.slice_end.store(slice_end, SeqCst);
        self.driving.store(true, SeqCst);
        if self.mail.load(SeqCst) {
            self.leave();
            return false;
        }
        true
    }
    fn leave(&self) {
        self.driving.store(false, SeqCst);
        self.slice_end.store(u64::MAX, SeqCst);
    }
    /// Clock thread: kick an owner whose turn is over. A kick that lands
    /// after the turn ended interrupts its next entry once, harmlessly.
    fn tick(&self, now: u64) {
        let end = self.slice_end.load(Acquire);
        if end <= now
            && self
                .slice_end
                .compare_exchange(end, u64::MAX, AcqRel, Relaxed)
                .is_ok()
        {
            lease::kick_thread(self.tid.load(Relaxed));
        }
    }
}
struct Mailbox {
    tx: SyncSender<Command>,
    wake: Wake,
    attention: Arc<Attention>,
}
impl Mailbox {
    fn send(&self, cmd: Command) {
        self.tx.send(cmd).unwrap();
        self.wake.notify();
        self.attention.post();
    }
}
pub struct Pool {
    owners: Vec<Mailbox>,
    joins: Vec<JoinHandle<io::Result<()>>>,
    events: Receiver<Event>,
    watchdog: Watchdog,
    slots: usize,
    // Dropped after the owners have stopped (Drop runs shutdown first).
    _clock: Clock,
}
impl Pool {
    pub fn new(kvm: Arc<Kvm>, snapshot: Arc<Snapshot>, slots: usize, owners: usize) -> Self {
        Self::notified(kvm, snapshot, slots, owners, None, ResetPolicy::default())
    }
    pub fn notified(
        kvm: Arc<Kvm>,
        snapshot: Arc<Snapshot>,
        slots: usize,
        owners: usize,
        notify: Option<Arc<dyn Fn() + Send + Sync>>,
        policy: ResetPolicy,
    ) -> Self {
        Self::prepare(kvm, snapshot, slots, owners).start(notify, policy)
    }
    /// The part of a pool that opens files or creates a process: the owners'
    /// eventfds and entropy, and the watchdog process. No thread exists yet,
    /// so the caller can close its file access (confine) before `start`.
    pub fn prepare(
        kvm: Arc<Kvm>,
        snapshot: Arc<Snapshot>,
        slots: usize,
        owners: usize,
    ) -> Prepared {
        assert!(
            owners > 0
                && owners <= thread::available_parallelism().unwrap().get()
                && slots > 0
                && slots <= 16384
        );
        let wakes: Vec<_> = (0..owners).map(|_| Wake::new()).collect();
        let watchdog = Watchdog::start(slots, &wakes, 100);
        let urandom = File::open("/dev/urandom").unwrap();
        let entropy = (0..owners).map(|_| urandom.try_clone().unwrap()).collect();
        Prepared {
            kvm,
            snapshot,
            slots,
            wakes,
            entropy,
            watchdog,
        }
    }
}
/// A pool before its threads exist (`Pool::prepare`).
pub struct Prepared {
    kvm: Arc<Kvm>,
    snapshot: Arc<Snapshot>,
    slots: usize,
    wakes: Vec<Wake>,
    entropy: Vec<File>,
    watchdog: Watchdog,
}
impl Prepared {
    /// The clock and owner threads; no file is opened from here on. Returns
    /// once every thread runs, past its start-up syscalls, so the caller can
    /// filter syscalls next (confine/mod.rs).
    pub fn start(self, notify: Option<Arc<dyn Fn() + Send + Sync>>, policy: ResetPolicy) -> Pool {
        let Prepared {
            kvm,
            snapshot,
            slots,
            wakes,
            entropy,
            watchdog,
        } = self;
        let owners = wakes.len();
        let attention: Vec<Arc<Attention>> =
            (0..owners).map(|_| Arc::new(Attention::new())).collect();
        let slices = attention.clone();
        let clock = Clock::with_tick(slots, move || {
            let now = kvm::monotonic_ns();
            for a in &slices {
                a.tick(now);
            }
        });
        let started = Arc::new(Barrier::new(owners + 1));
        let (tx, events) = mpsc::sync_channel(slots + owners);
        let mut mailboxes = Vec::new();
        let mut joins = Vec::new();
        for ((owner, wake), entropy) in wakes.into_iter().enumerate().zip(entropy) {
            // Per slot and generation: START, a reply per open call, CANCEL.
            let capacity = if notify.is_some() {
                slots.saturating_sub(owner).div_ceil(owners) * (ring::MAX_OUTSTANDING + 2) + 1
            } else {
                32
            };
            let (cmd, rx) = mpsc::sync_channel(capacity);
            let notify = notify.clone();
            let leases = (owner..slots)
                .step_by(owners)
                .map(|id| watchdog.slot(id))
                .collect::<Vec<_>>();
            let clocks = (owner..slots)
                .step_by(owners)
                .map(|id| clock.cell(id))
                .collect::<Vec<_>>();
            let (kvm, snapshot, tx, w) = (kvm.clone(), snapshot.clone(), tx.clone(), wake.clone());
            let started = started.clone();
            let a = attention[owner].clone();
            joins.push(
                thread::Builder::new()
                    .name(format!("jitk-owner-{owner}"))
                    .spawn(move || {
                        // SAFETY: gettid takes no arguments.
                        a.tid
                            .store(unsafe { libc::syscall(libc::SYS_gettid) } as i32, Relaxed);
                        started.wait();
                        Worker {
                            owner,
                            owners,
                            kvm,
                            snapshot,
                            policy,
                            leases,
                            clocks,
                            commands: rx,
                            events: Events { tx, notify },
                            wake: w,
                            attention: a,
                        }
                        .run(entropy)
                    })
                    .unwrap(),
            );
            mailboxes.push(Mailbox {
                tx: cmd,
                wake,
                attention: attention[owner].clone(),
            });
        }
        started.wait();
        Pool {
            owners: mailboxes,
            joins,
            events,
            watchdog,
            slots,
            _clock: clock,
        }
    }
}
impl Pool {
    /// Readable once the watchdog process has exited (`watchdog_exited`).
    pub fn watchdog_exit_fd(&self) -> std::os::fd::BorrowedFd<'_> {
        self.watchdog.exit_fd()
    }
    pub fn watchdog_exited(&self) -> ! {
        self.watchdog.exited()
    }
    pub fn shutdown(&mut self) -> io::Result<()> {
        if self.joins.is_empty() {
            return self.watchdog.shutdown();
        }
        let mut error = self.watchdog.request_stop().err();
        for owner in &self.owners {
            let mut command = Command::Stop;
            loop {
                match owner.tx.try_send(command) {
                    Ok(()) => break,
                    Err(mpsc::TrySendError::Full(c)) => {
                        command = c;
                        let _ = owner.wake.try_notify();
                        owner.attention.post();
                        let _ = self.events.recv_timeout(Duration::from_millis(10));
                    }
                    Err(mpsc::TrySendError::Disconnected(_)) => {
                        error.get_or_insert_with(|| {
                            io::Error::other("owner exited before shutdown")
                        });
                        break;
                    }
                }
            }
            if let Err(e) = owner.wake.try_notify() {
                error.get_or_insert(e);
            }
            owner.attention.post();
        }
        // Owners can be publishing bounded completion events as they stop.
        // Keep consuming until every owner exits, then observe every join result.
        while self.joins.iter().any(|j| !j.is_finished()) {
            // A queued Start may arm its lease after the first stop request.
            // Continue expediting leases until every owner has consumed Stop.
            if let Err(e) = self.watchdog.request_stop() {
                error.get_or_insert(e);
            }
            let _ = self.events.recv_timeout(Duration::from_millis(10));
        }
        for j in self.joins.drain(..) {
            match j.join() {
                Ok(Ok(())) => {}
                Ok(Err(e)) => {
                    error.get_or_insert(e);
                }
                Err(_) => {
                    error.get_or_insert_with(|| io::Error::other("owner panicked"));
                }
            }
        }
        if let Err(e) = self.watchdog.shutdown() {
            error.get_or_insert(e);
        }
        match error {
            Some(e) => Err(e),
            None => Ok(()),
        }
    }
    fn owner(&self, slot: usize) -> &Mailbox {
        assert!(slot < self.slots);
        &self.owners[slot % self.owners.len()]
    }
    pub fn start(&self, slot: usize, job: Job) {
        self.owner(slot).send(Command::Start(slot, job));
    }
    pub fn resume(&self, slot: usize, generation: u64) {
        self.owner(slot).send(Command::Resume(slot, generation));
    }
    pub fn reply(&self, slot: usize, generation: u64, request: Request) {
        self.owner(slot)
            .send(Command::Reply(slot, generation, request));
    }
    pub fn try_recv(&mut self) -> Option<Event> {
        self.events.try_recv().ok()
    }
    /// Reset `slot` and report it (Event::Reset). A running slot's owner is
    /// kicked out of KVM_RUN (`Attention`), so this never waits for its lease.
    pub fn cancel(&self, slot: usize) {
        self.owner(slot).send(Command::Cancel(slot));
    }
    pub fn reset(&self, slot: usize) {
        self.owner(slot).send(Command::Reset(slot));
    }
    pub fn recv(&mut self) -> Event {
        loop {
            self.watchdog.check();
            match self.events.recv_timeout(Duration::from_millis(10)) {
                Ok(e) => return e,
                Err(mpsc::RecvTimeoutError::Timeout) => {}
                Err(e) => panic!("owners exited: {e}"),
            }
        }
    }
}
impl Drop for Pool {
    fn drop(&mut self) {
        let _ = self.shutdown();
    }
}
enum Progress {
    Parked,
    /// Policy mode: forward these; `parked` when the guest waits for Node
    /// (or for its timer), else it runs on.
    Calls {
        requests: Vec<Request>,
        logs: Vec<Vec<u8>>,
        parked: bool,
    },
    Finished(String),
    Interrupted,
}
#[derive(Clone, Copy, PartialEq)]
enum Activity {
    Idle,
    Running,
}
struct Behavior {
    mode: Mode,
    canary: bool,
}
#[derive(Clone, Copy, PartialEq)]
enum DriveUntil {
    Completion,
    Wait,
}
#[derive(Clone, Copy, PartialEq)]
enum Retention {
    ResetErrors,
    KeepStopped,
}
struct Managed {
    cpu: Slot,
    lease: Lease,
    activity: Activity,
    pending: Vec<Request>,
    seed: [u8; 16],
    metrics: Metrics,
    started: Instant,
    waited: Option<Instant>,
    behavior: Behavior,
    /// Policy mode: calls sent to Node and not answered, with when.
    policy_sent: Calls,
    /// Policy mode: the guest parked with a timer (ppoll deadline); resume
    /// it then if nothing else has.
    wake_at: Option<Instant>,
    /// Policy mode: console lines of the FINISH exit, forwarded before Done.
    finish_logs: Vec<Vec<u8>>,
    /// The mode of the command that made this slot runnable: START's job
    /// mode, None for a reply, resume or timer (`Worker::drive`).
    drive: Option<Mode>,
    /// In the owner's run queue.
    queued: bool,
}
impl Managed {
    /// Reset this slot. A failed reset quarantines only this slot (kvm::reset);
    /// the lease is acknowledged either way, since the vCPU is stopped and will
    /// never run again, so the watchdog does not escalate to the whole shard.
    fn reset(&mut self) -> Result<ResetReport, kvm::Quarantined> {
        let reset = self.cpu.reset();
        if self.activity == Activity::Running {
            self.lease.acknowledge_reset();
        }
        self.activity = Activity::Idle;
        self.pending.clear();
        reset
    }
    /// One reset per lifecycle: reset unless the slot is idle and still pristine
    /// since its last reset (or creation), or quarantined. A running slot is
    /// never pristine.
    fn reset_unless_pristine(&mut self) {
        if self.activity == Activity::Idle && (self.cpu.is_pristine() || self.cpu.is_quarantined())
        {
            return;
        }
        let _ = self.reset(); // a failure quarantined the slot; admit() refuses it
    }
    /// Admit and bind a job. A quarantined slot fails the job instead.
    fn begin(&mut self, job: Job, entropy: &mut File) -> Result<(), RunError> {
        let cpu_start = kvm::clock_ns(libc::CLOCK_THREAD_CPUTIME_ID); // No parallel-owner double count.
        let reset = self.cpu.admit().map_err(|_| RunError::SlotUnavailable)?;
        assert!(self.cpu.is_pristine());
        assert_eq!(self.cpu.canary(), 0, "stale RAM canary");
        self.seed = self.cpu.bind(job.generation, &job.source, entropy);
        self.lease = self.lease.arm(job.generation, job.deadline_ns);
        self.cpu.set_lease(self.lease.clone());
        self.activity = Activity::Running;
        self.started = Instant::now();
        self.waited = None;
        self.policy_sent = Calls::default();
        self.wake_at = None;
        self.finish_logs.clear();
        self.behavior = Behavior {
            mode: job.mode,
            canary: job.canary,
        };
        self.metrics = Metrics {
            reset_ns: reset.map_or(0, |r| r.ns),
            reset,
            cpu_ns: kvm::clock_ns(libc::CLOCK_THREAD_CPUTIME_ID) - cpu_start,
            ..Metrics::default()
        };
        if job.mode == Mode::Ready {
            self.cpu.pause_after_repair();
        }
        if let Some(entry) = job.entry {
            self.cpu.redirect_entry(entry);
        }
        Ok(())
    }
    fn drive(&mut self, until: DriveUntil) -> Result<Progress, RunError> {
        loop {
            let Some(e) = self.cpu.try_exit()? else {
                return Ok(Progress::Interrupted);
            };
            self.metrics.calls += e.requests.len() as u64;
            if e.op == ring::FINISH {
                if !self.cpu.repaired() {
                    return Err(RunError::GuestProtocol("missing repair acknowledgement"));
                }
                // The last console lines often share the FINISH exit.
                if self.behavior.mode == Mode::Policy {
                    self.finish_logs = e.logs;
                }
                return e
                    .finish
                    .map(Progress::Finished)
                    .ok_or(RunError::GuestProtocol("missing completion"));
            }
            if (e.op == ring::REPAIRED_READY && !self.cpu.repaired())
                || !matches!(e.op, ring::SUBMIT | ring::WAIT | ring::REPAIRED_READY)
            {
                return Err(RunError::GuestProtocol("unexpected checkpoint/repair"));
            }
            if e.op == ring::WAIT && self.waited.is_none() {
                self.waited = Some(Instant::now());
            }
            if self.behavior.mode == Mode::Policy {
                // Request bytes are opaque here; Node owns the call schema.
                let sent = kvm::monotonic_ns();
                for r in &e.requests {
                    assert!(self.policy_sent.issue(r.id, sent));
                }
                let calls: Vec<Request> = e
                    .requests
                    .iter()
                    .map(|r| Request {
                        id: r.id,
                        bytes: r.bytes.clone(),
                    })
                    .collect();
                self.pending.extend(e.requests);
                // A WAIT parks the guest until Node answers or its timer is
                // due, unless RX records still wait for ring space: then it
                // runs on, reads them and frees it. SUBMIT (TX full) runs on.
                let parked = e.op == ring::WAIT && !self.cpu.backlogged();
                if parked {
                    self.wake_at = wake_time(self.cpu.wait_deadline());
                    self.cpu.drain();
                }
                if parked || !calls.is_empty() || !e.logs.is_empty() {
                    return Ok(Progress::Calls {
                        requests: calls,
                        logs: e.logs,
                        parked,
                    });
                }
                continue;
            }
            if until == DriveUntil::Wait && (e.op == ring::WAIT || e.op == ring::REPAIRED_READY) {
                self.pending = e.requests;
                self.cpu.drain();
                return Ok(Progress::Parked);
            }
            self.reply(&e.requests)?;
        }
    }
    fn reply(&mut self, requests: &[Request]) -> Result<(), RunError> {
        let t = Instant::now();
        for r in requests.iter().rev() {
            self.cpu.reply(r)?;
        }
        if !requests.is_empty() {
            self.metrics.tool_ns += t.elapsed().as_nanos() as u64;
        }
        Ok(())
    }
    fn command(&mut self, cmd: Command, entropy: &mut File, id: usize, events: &Events) -> bool {
        match cmd {
            Command::Start(_, job) => {
                assert!(self.activity == Activity::Idle);
                let generation = job.generation;
                if let Err(e) = self.begin(job, entropy) {
                    // Nothing was bound and no lease armed: fail just this job.
                    let completion = Completion {
                        result: Err(e),
                        seed: [0; 16],
                        metrics: Metrics::default(),
                        stopped_ns: kvm::monotonic_ns(),
                        reset_done_ns: 0,
                    };
                    events
                        .send(Event::Done {
                            slot: id,
                            generation,
                            completion,
                        })
                        .unwrap();
                    return false;
                }
            }
            Command::Reply(_, generation, request) => {
                if self.activity == Activity::Idle || generation != self.cpu.generation {
                    return false;
                }
                let Some(at) = self.pending.iter().position(|r| r.id == request.id) else {
                    return false;
                };
                self.pending.swap_remove(at);
                let t = kvm::clock_ns(libc::CLOCK_THREAD_CPUTIME_ID);
                if let Err(e) = self.cpu.reply(&request) {
                    let completion = self.finish(Err(e), Retention::ResetErrors);
                    events
                        .send(Event::Done {
                            slot: id,
                            generation,
                            completion,
                        })
                        .unwrap();
                    return false;
                }
                let sent = self.policy_sent.answer(request.id).unwrap_or(0);
                self.metrics
                    .policy_round_trips
                    .push(kvm::monotonic_ns().saturating_sub(sent));
                self.wake_at = None;
                self.metrics.cpu_ns += kvm::clock_ns(libc::CLOCK_THREAD_CPUTIME_ID) - t;
            }
            Command::Resume(_, generation) => {
                if self.activity == Activity::Idle || generation != self.cpu.generation {
                    return false;
                }
                let t = kvm::clock_ns(libc::CLOCK_THREAD_CPUTIME_ID);
                let pending = std::mem::take(&mut self.pending);
                if let Err(e) = self.reply(&pending) {
                    let completion = self.finish(Err(e), Retention::ResetErrors);
                    events
                        .send(Event::Done {
                            slot: id,
                            generation,
                            completion,
                        })
                        .unwrap();
                    return false;
                }
                self.metrics.cpu_ns += kvm::clock_ns(libc::CLOCK_THREAD_CPUTIME_ID) - t;
            }
            _ => unreachable!(),
        }
        true
    }
    fn finish(&mut self, result: Result<String, RunError>, retention: Retention) -> Completion {
        let stopped_ns = kvm::monotonic_ns();
        let timely = stopped_ns < self.lease.deadline();
        let result = if self.lease.complete() && timely {
            result
        } else {
            Err(RunError::Deadline {
                deadline_ns: self.lease.deadline(),
            })
        };
        self.metrics.run_ns = self.started.elapsed().as_nanos() as u64;
        self.metrics.exits = self.cpu.exits;
        self.metrics.wait_to_finish_ns = self.waited.map_or(0, |t| t.elapsed().as_nanos() as u64);
        let retain = retention == Retention::KeepStopped
            && !matches!(result, Err(RunError::Deadline { .. }));
        let mut reset_done_ns = 0;
        if result.is_err() && !retain {
            // MMIO completion, memory, registers, immediate_exit. A failure
            // quarantines this slot; its lease is acknowledged all the same.
            let _ = self.cpu.reset();
            self.lease.acknowledge_reset();
            self.activity = Activity::Idle;
            reset_done_ns = kvm::monotonic_ns();
        } else {
            // complete() disarmed this stopped slot. Retained dirty pages are measurement-only.
            self.activity = Activity::Idle;
            if self.behavior.canary {
                self.cpu.corrupt_canary(self.cpu.generation);
            }
        }
        Completion {
            result,
            seed: self.seed,
            metrics: std::mem::take(&mut self.metrics),
            stopped_ns,
            reset_done_ns,
        }
    }
}
use crate::slot::wake_time;
struct Worker {
    owner: usize,
    owners: usize,
    kvm: Arc<Kvm>,
    snapshot: Arc<Snapshot>,
    policy: ResetPolicy,
    leases: Vec<Lease>,
    clocks: Vec<clock::Cell>,
    commands: Receiver<Command>,
    events: Events,
    wake: Wake,
    attention: Arc<Attention>,
}
/// Trim pristine idle slots whose time is due; return the next due time.
fn trim_idle(slots: &mut [Option<Managed>]) -> Option<Instant> {
    let now = Instant::now();
    let mut next: Option<Instant> = None;
    for s in slots.iter_mut().flatten() {
        if s.activity != Activity::Idle {
            continue;
        }
        match s.cpu.trim_due() {
            Some(due) if due <= now => s.cpu.trim(),
            Some(due) => next = Some(next.map_or(due, |n| n.min(due))),
            None => {}
        }
    }
    next
}
/// The owner's runnable slots, round-robin. A slot is runnable from the
/// command (or timer) that lets its guest go on until it parks or ends; an
/// idle slot found here was cancelled or expired meanwhile and is skipped.
#[derive(Default)]
struct RunQueue {
    ready: VecDeque<usize>,
    /// The slot whose turn it is, and when the turn began (monotonic ns). It
    /// keeps the turn across kicks for mail until SLICE has passed.
    turn: Option<(usize, u64)>,
}
impl RunQueue {
    fn push(&mut self, s: &mut Managed, i: usize, mode: Option<Mode>) {
        s.drive = mode;
        if !s.queued {
            s.queued = true;
            self.ready.push_back(i);
        }
    }
}
/// Why `Worker::drive` returned.
#[derive(PartialEq)]
enum Driven {
    /// The run parked or ended.
    Stopped,
    /// A kick: the guest can go on once the owner has looked around.
    Kicked,
}
impl Worker {
    /// `entropy` is /dev/urandom, opened by `Pool::prepare`.
    fn run(self, mut entropy: File) -> io::Result<()> {
        let mut slots: Vec<Option<Managed>> = (0..self.leases.len()).map(|_| None).collect();
        let mut queue = RunQueue::default();
        let mut trim_at = None;
        loop {
            let timer = slots.iter().flatten().filter_map(|s| s.wake_at).min();
            // With a runnable slot, only collect news; never sleep.
            self.wake.wait_until(if queue.ready.is_empty() {
                [trim_at, timer].into_iter().flatten().min()
            } else {
                Some(Instant::now())
            });
            expire(&mut slots, self.owner, self.owners, &self.events);
            // Guests whose timer is due run again (setTimeout in a job).
            let now = Instant::now();
            for (i, s) in slots.iter_mut().enumerate() {
                if let Some(s) = s
                    && s.activity == Activity::Running
                    && s.wake_at.is_some_and(|at| at <= now)
                {
                    s.wake_at = None;
                    queue.push(s, i, Some(Mode::Policy));
                }
            }
            self.attention.take_mail();
            while let Ok(cmd) = self.commands.try_recv() {
                expire(&mut slots, self.owner, self.owners, &self.events);
                let (id, mode) = match &cmd {
                    Command::Start(id, job) => (*id, Some(job.mode)),
                    Command::Resume(id, _)
                    | Command::Reply(id, _, _)
                    | Command::Reset(id)
                    | Command::Cancel(id) => (*id, None),
                    Command::Stop => {
                        for mut s in slots.iter_mut().filter_map(Option::take) {
                            s.cpu.shutdown()?;
                            let lease = s.lease.clone();
                            let activity = s.activity;
                            drop(s); // Destroy this stopped VM before acknowledging its lease.
                            if activity == Activity::Running {
                                lease.acknowledge_reset();
                            }
                        }
                        return Ok(());
                    }
                };
                let i = id / self.owners;
                assert_eq!(id % self.owners, self.owner);
                if slots[i].is_none() {
                    let mut cpu = Slot::with_policy(&self.kvm, self.snapshot.clone(), self.policy);
                    cpu.clock = Some(self.clocks[i].clone());
                    slots[i] = Some(Managed {
                        cpu,
                        lease: self.leases[i].clone(),
                        activity: Activity::Idle,
                        pending: Vec::new(),
                        seed: [0; 16],
                        metrics: Metrics::default(),
                        started: Instant::now(),
                        waited: None,
                        behavior: Behavior {
                            mode: Mode::Run,
                            canary: false,
                        },
                        policy_sent: Calls::default(),
                        wake_at: None,
                        finish_logs: Vec::new(),
                        drive: None,
                        queued: false,
                    });
                }
                let s = slots[i].as_mut().unwrap();
                if matches!(cmd, Command::Reset(_) | Command::Cancel(_)) {
                    // An errored run was already reset in finish(); its RELEASE
                    // costs nothing. The next begin() finds the slot pristine.
                    // A running slot (its vCPU stopped: the kick that brought
                    // this command) is reset here; if it is still queued, the
                    // run queue skips it as idle.
                    s.reset_unless_pristine();
                    if matches!(cmd, Command::Reset(_)) && !s.cpu.is_quarantined() {
                        // Offline verification: the pristine flag must imply
                        // every byte of RAM and every register.
                        assert!(s.cpu.pristine(), "RAM differs from the snapshot");
                        let regs = s.cpu.register_mismatches();
                        assert!(regs.is_empty(), "registers differ: {regs:#x?}");
                    }
                    let quarantined = s.cpu.quarantine_reason().map(str::to_owned);
                    self.events
                        .send(Event::Reset {
                            slot: id,
                            quarantined,
                        })
                        .unwrap();
                    continue;
                }
                if s.command(cmd, &mut entropy, id, &self.events) {
                    queue.push(s, i, mode);
                }
            }
            // Trim slots now due; resets above may have made others trimmable.
            trim_at = trim_idle(&mut slots);
            self.turn(&mut slots, &mut queue);
        }
    }
    /// Give the next runnable slot the vCPU until it parks or ends, or a
    /// kick: mail, an expiry, a parked slot's timer, or the end of its turn.
    fn turn(&self, slots: &mut [Option<Managed>], queue: &mut RunQueue) {
        let slice = SLICE.as_nanos() as u64;
        let now = kvm::monotonic_ns();
        let i = loop {
            let Some(i) = queue.ready.pop_front() else {
                return;
            };
            let s = slots[i].as_mut().unwrap();
            match queue.turn {
                _ if s.activity == Activity::Idle => s.queued = false,
                // Its turn is over (it may have run alone) and another
                // slot waits: that one goes first.
                Some((t, start)) if t == i && now >= start + slice && !queue.ready.is_empty() => {
                    queue.turn = None;
                    queue.ready.push_back(i);
                }
                _ => {
                    s.queued = false;
                    break i;
                }
            }
        };
        let start = match queue.turn {
            Some((t, start)) if t == i => start,
            _ => now,
        };
        queue.turn = Some((i, start));
        // Kick at the end of the turn if another slot waits for the vCPU,
        // or when a parked slot's timer is due, whichever comes first.
        let mut end = if queue.ready.is_empty() {
            u64::MAX
        } else {
            start + slice
        };
        if let Some(at) = slots.iter().flatten().filter_map(|s| s.wake_at).min() {
            let left = at.saturating_duration_since(Instant::now());
            end = end.min(now + left.as_nanos() as u64);
        }
        if !self.attention.enter(end) {
            // Mail first; this slot keeps its turn.
            slots[i].as_mut().unwrap().queued = true;
            queue.ready.push_front(i);
            return;
        }
        let mode = slots[i].as_ref().unwrap().drive;
        let driven = self.drive(slots, i, self.owner + i * self.owners, mode);
        self.attention.leave();
        if driven == Driven::Stopped {
            queue.turn = None;
            return;
        }
        // Kicked: the guest goes on, first again unless its turn is over and
        // another slot waits (then the next pick sends it to the back).
        slots[i].as_mut().unwrap().queued = true;
        queue.ready.push_front(i);
    }
    fn drive(
        &self,
        slots: &mut [Option<Managed>],
        i: usize,
        id: usize,
        mode: Option<Mode>,
    ) -> Driven {
        loop {
            let s = slots[i].as_mut().unwrap();
            if s.activity == Activity::Idle {
                return Driven::Stopped;
            }
            let t = kvm::clock_ns(libc::CLOCK_THREAD_CPUTIME_ID);
            let until = match mode {
                Some(Mode::Wait | Mode::Ready) => DriveUntil::Wait,
                _ => DriveUntil::Completion,
            };
            let result = s.drive(until);
            s.metrics.cpu_ns += kvm::clock_ns(libc::CLOCK_THREAD_CPUTIME_ID) - t;
            match result {
                // The owner sweeps expiries and reads its mail first.
                Ok(Progress::Interrupted) => return Driven::Kicked,
                Ok(Progress::Calls {
                    requests,
                    logs,
                    parked,
                }) => {
                    self.events
                        .send(Event::Calls {
                            slot: id,
                            generation: s.cpu.generation,
                            requests,
                            logs,
                        })
                        .unwrap();
                    if parked {
                        return Driven::Stopped;
                    }
                }
                Ok(Progress::Parked) => {
                    self.events
                        .send(Event::Parked {
                            slot: id,
                            generation: s.cpu.generation,
                        })
                        .unwrap();
                    return Driven::Stopped;
                }
                result => {
                    let result = result.map(|p| match p {
                        Progress::Finished(s) => s,
                        _ => unreachable!(),
                    });
                    let logs = std::mem::take(&mut s.finish_logs);
                    if !logs.is_empty() {
                        self.events
                            .send(Event::Calls {
                                slot: id,
                                generation: s.cpu.generation,
                                requests: Vec::new(),
                                logs,
                            })
                            .unwrap();
                    }
                    let completion = s.finish(
                        result,
                        if mode == Some(Mode::Retain) {
                            Retention::KeepStopped
                        } else {
                            Retention::ResetErrors
                        },
                    );
                    self.events
                        .send(Event::Done {
                            slot: id,
                            generation: s.cpu.generation,
                            completion,
                        })
                        .unwrap();
                    return Driven::Stopped;
                }
            }
        }
    }
}

fn expire(slots: &mut [Option<Managed>], owner: usize, owners: usize, events: &Events) {
    for (i, s) in slots.iter_mut().enumerate() {
        if let Some(s) = s
            && s.activity == Activity::Running
            && s.lease.expired()
        {
            let completion = s.finish(
                Err(RunError::Deadline {
                    deadline_ns: s.lease.deadline(),
                }),
                Retention::ResetErrors,
            );
            events
                .send(Event::Done {
                    slot: owner + i * owners,
                    generation: s.cpu.generation,
                    completion,
                })
                .unwrap();
        }
    }
}

struct Events {
    tx: SyncSender<Event>,
    notify: Option<Arc<dyn Fn() + Send + Sync>>,
}
impl Events {
    fn send(&self, event: Event) -> io::Result<()> {
        self.tx
            .send(event)
            .map_err(|_| io::Error::new(io::ErrorKind::BrokenPipe, "reactor exited"))?;
        if let Some(notify) = &self.notify {
            notify();
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::{Event, Job, Mode, Pool};
    use crate::kvm::{self, Kvm, RunError, Snapshot};
    use std::time::{Duration, Instant};

    #[test]
    #[ignore = "requires KVM and JITK_SHARD_TEST_SNAPSHOT; run under bench.lock"]
    fn shutdown_interrupts_queued_spins_and_is_idempotent() {
        let snapshot = Snapshot::load(&std::env::var("JITK_SHARD_TEST_SNAPSHOT").unwrap()).unwrap();
        let mut pool = Pool::new(Kvm::new(), snapshot, 1, 1);
        pool.start(
            0,
            Job {
                generation: 2,
                source: include_str!("../fixtures/spin.js").into(),
                mode: Mode::Run,
                deadline_ns: kvm::monotonic_ns() + 30_000_000_000,
                canary: false,
                entry: None,
            },
        );
        let started = Instant::now();
        pool.shutdown().unwrap();
        assert!(
            started.elapsed() < Duration::from_secs(2),
            "shutdown waited for the original lease"
        );
        pool.shutdown().unwrap();
    }
    #[test]
    #[ignore = "requires KVM and JITK_SHARD_TEST_SNAPSHOT; run under bench.lock"]
    fn guest_protocol_error_resets_only_its_run() {
        let snapshot = Snapshot::load(&std::env::var("JITK_SHARD_TEST_SNAPSHOT").unwrap()).unwrap();
        let mut pool = Pool::new(Kvm::new(), snapshot, 2, 2);
        for (slot, source, mode) in [
            (0, include_str!("../fixtures/bad_call.js"), Mode::Policy),
            (1, include_str!("../fixtures/return2.js"), Mode::Run),
        ] {
            pool.start(
                slot,
                Job {
                    generation: 2,
                    source: source.into(),
                    mode,
                    deadline_ns: kvm::monotonic_ns() + 5_000_000_000,
                    canary: true,
                    entry: None,
                },
            );
        }
        for _ in 0..2 {
            let Event::Done {
                slot, completion, ..
            } = pool.recv()
            else {
                panic!("bad guest schema must complete as a run error");
            };
            if slot == 0 {
                assert!(matches!(completion.result, Err(RunError::GuestProtocol(_))));
                assert_ne!(completion.reset_done_ns, 0);
            } else {
                assert_eq!(completion.result.unwrap(), "{\"ok\":2}");
            }
        }
        pool.reset(0);
        assert_eq!(released(&mut pool, 0), None);
        pool.start(
            0,
            Job {
                generation: 3,
                source: include_str!("../fixtures/return2.js").into(),
                mode: Mode::Run,
                deadline_ns: kvm::monotonic_ns() + 5_000_000_000,
                canary: true,
                entry: None,
            },
        );
        let Event::Done { completion, .. } = pool.recv() else {
            panic!("clean reuse");
        };
        assert_eq!(completion.result.unwrap(), "{\"ok\":2}");
        pool.shutdown().unwrap();
    }
    fn job(generation: u64, entry: Option<&'static [u8]>, deadline_ms: u64) -> Job {
        Job {
            generation,
            source: include_str!("../fixtures/return2.js").into(),
            mode: Mode::Run,
            deadline_ns: kvm::monotonic_ns() + deadline_ms * 1_000_000,
            canary: true,
            entry,
        }
    }
    fn completion(pool: &mut Pool) -> super::Completion {
        match pool.recv() {
            Event::Done { completion, .. } => completion,
            _ => panic!("expected completion"),
        }
    }
    /// The next event is this slot's Reset; returns its quarantine reason.
    fn released(pool: &mut Pool, slot: usize) -> Option<String> {
        match pool.recv() {
            Event::Reset {
                slot: s,
                quarantined,
            } if s == slot => quarantined,
            _ => panic!("expected the reset of slot {slot}"),
        }
    }
    #[test]
    #[ignore = "requires KVM and JITK_SHARD_TEST_SNAPSHOT; run under bench.lock"]
    fn one_reset_per_lifecycle() {
        let snapshot = Snapshot::load(&std::env::var("JITK_SHARD_TEST_SNAPSHOT").unwrap()).unwrap();
        let mut pool = Pool::new(Kvm::new(), snapshot, 1, 1);
        // A fresh slot is pristine: the first begin() does not reset.
        pool.start(0, job(2, None, 5_000));
        let c = completion(&mut pool);
        assert_eq!(c.result.unwrap(), "{\"ok\":2}");
        assert!(c.metrics.reset.is_none() && c.metrics.reset_ns == 0);
        // RELEASE (the IPC path) resets once; the next begin() does not.
        pool.cancel(0);
        assert_eq!(released(&mut pool, 0), None);
        pool.start(0, job(3, None, 5_000));
        let c = completion(&mut pool);
        assert_eq!(c.result.unwrap(), "{\"ok\":2}");
        assert!(c.metrics.reset.is_none(), "begin() reset a pristine slot");
        // Without a RELEASE in between, begin() resets the dirty slot itself.
        pool.start(0, job(4, None, 5_000));
        let c = completion(&mut pool);
        assert_eq!(c.result.unwrap(), "{\"ok\":2}");
        let r = c.metrics.reset.expect("begin() must reset a used slot");
        assert!(r.discard.is_none() && r.private > 0, "{r:?}");
        // A RELEASE of a pristine slot is answered without another reset; the
        // Reset command then checks every byte and register.
        pool.cancel(0);
        assert_eq!(released(&mut pool, 0), None);
        pool.reset(0);
        assert_eq!(released(&mut pool, 0), None);
        pool.shutdown().unwrap();
    }
    #[test]
    #[ignore = "requires KVM and JITK_SHARD_TEST_SNAPSHOT; run under bench.lock"]
    fn reset_failure_quarantines_only_its_slot() {
        let snapshot = Snapshot::load(&std::env::var("JITK_SHARD_TEST_SNAPSHOT").unwrap()).unwrap();
        // Two slots on one owner thread: a failure must not take down the other.
        let mut pool = Pool::new(Kvm::new(), snapshot, 2, 1);
        let fail = kvm::test_guest::FAIL_RESET_GENERATION;
        pool.start(0, job(fail, None, 5_000));
        assert_eq!(completion(&mut pool).result.unwrap(), "{\"ok\":2}");
        pool.cancel(0); // the RELEASE reset: KVM rejects a register write
        assert!(released(&mut pool, 0).is_some());
        for generation in [2, 3] {
            pool.start(1, job(generation, None, 5_000));
            assert_eq!(completion(&mut pool).result.unwrap(), "{\"ok\":2}");
        }
        // The quarantined slot fails every later job without binding it.
        for generation in [fail + 1, fail + 2] {
            pool.start(0, job(generation, None, 5_000));
            let c = completion(&mut pool);
            assert!(
                matches!(c.result, Err(RunError::SlotUnavailable)),
                "{:?}",
                c.result
            );
            pool.cancel(0);
            assert!(released(&mut pool, 0).is_some());
        }
        // A run that errors also resets in finish(): that path quarantines too,
        // and still acknowledges the lease (shutdown checks every lease).
        pool.start(1, job(fail, Some(kvm::test_guest::cpu_off()), 300));
        assert!(matches!(
            completion(&mut pool).result,
            Err(RunError::Deadline { .. })
        ));
        pool.start(1, job(fail + 1, None, 5_000));
        assert!(matches!(
            completion(&mut pool).result,
            Err(RunError::SlotUnavailable)
        ));
        // Its release carries the reason (the reactor sends QUARANTINED).
        pool.cancel(1);
        assert!(released(&mut pool, 1).is_some_and(|why| why.starts_with("reset failed")));
        pool.shutdown().unwrap();
    }
    #[test]
    #[ignore = "requires KVM and JITK_SHARD_TEST_SNAPSHOT; run under bench.lock"]
    fn psci_power_off_does_not_stop_the_next_run() {
        let snapshot = Snapshot::load(&std::env::var("JITK_SHARD_TEST_SNAPSHOT").unwrap()).unwrap();
        let mut pool = Pool::new(Kvm::new(), snapshot, 1, 1);
        let mut generation = 2;
        for (name, entry) in [
            ("cpu_off", kvm::test_guest::cpu_off()),
            ("system_off", kvm::test_guest::system_off()),
        ] {
            pool.start(0, job(generation, Some(entry), 300));
            let c = completion(&mut pool);
            assert!(
                matches!(
                    c.result,
                    Err(RunError::Deadline { .. } | RunError::GuestProtocol(_))
                ),
                "{name}"
            );
            // The same slot, next tenant: a STOPPED vCPU would sleep to the deadline.
            pool.start(0, job(generation + 1, None, 5_000));
            assert_eq!(
                completion(&mut pool).result.unwrap(),
                "{\"ok\":2}",
                "{name}"
            );
            generation += 2;
        }
        pool.reset(0);
        assert_eq!(released(&mut pool, 0), None);
        pool.shutdown().unwrap();
    }
    const RETURN2: &str = include_str!("../fixtures/return2.js");
    const SPIN: &str = include_str!("../fixtures/spin.js");
    /// Far below Node's bounds (RELEASE_GRACE_MS 3 s); the old owner answered
    /// after the spinning slot's deadline.
    const PROMPT: Duration = Duration::from_millis(500);
    /// A job as `ipc_service` starts one.
    fn policy(generation: u64, source: &str, deadline_ms: u64) -> Job {
        Job {
            generation,
            source: source.into(),
            mode: Mode::Policy,
            deadline_ns: kvm::monotonic_ns() + deadline_ms * 1_000_000,
            canary: false,
            entry: None,
        }
    }
    fn within(t: Instant, what: &str) {
        let took = t.elapsed();
        println!("{what}: {took:?}");
        assert!(took < PROMPT, "{what} took {took:?}");
    }
    #[test]
    #[ignore = "requires KVM and JITK_SHARD_TEST_SNAPSHOT; run under bench.lock"]
    fn spinning_slot_does_not_hold_its_owners_other_slots() {
        let snapshot = Snapshot::load(&std::env::var("JITK_SHARD_TEST_SNAPSHOT").unwrap()).unwrap();
        // Two slots on one owner thread, as slots k and k+W are with W owners.
        let mut pool = Pool::new(Kvm::new(), snapshot, 2, 1);
        pool.start(1, policy(2, RETURN2, 5_000));
        assert_eq!(completion(&mut pool).result.unwrap(), "{\"ok\":2}");
        // Slot 0 spins inside KVM_RUN with a deadline far away.
        pool.start(0, policy(2, SPIN, 30_000));
        std::thread::sleep(Duration::from_millis(200));
        // CANCEL for slot 1 (Node's release after DONE).
        let t = Instant::now();
        pool.cancel(1);
        assert_eq!(released(&mut pool, 1), None);
        within(t, "CANCEL of another slot");
        // START for slot 1: its tool call arrives, and the REPLY completes it.
        let t = Instant::now();
        pool.start(1, policy(3, include_str!("../fixtures/one_tool.js"), 5_000));
        let requests = loop {
            match pool.recv() {
                Event::Calls {
                    slot: 1,
                    generation: 3,
                    requests,
                    ..
                } if !requests.is_empty() => break requests,
                Event::Calls { slot: 1, .. } => {}
                _ => panic!("expected slot 1's call"),
            }
        };
        within(t, "START of another slot");
        let t = Instant::now();
        for r in requests {
            pool.reply(1, 3, r); // an echo, as the fixture drivers answer
        }
        assert_eq!(completion(&mut pool).result.unwrap(), "{\"ok\":42}");
        within(t, "REPLY to another slot");
        pool.cancel(1);
        assert_eq!(released(&mut pool, 1), None);
        // CANCEL of the spinning slot stops its vCPU and releases it, without
        // a result (Node has its own).
        let t = Instant::now();
        pool.cancel(0);
        assert_eq!(released(&mut pool, 0), None);
        within(t, "CANCEL of the spinning slot");
        // Both serve again from a clean slot.
        for slot in [0, 1] {
            pool.start(slot, policy(4, RETURN2, 5_000));
            assert_eq!(completion(&mut pool).result.unwrap(), "{\"ok\":2}");
            pool.cancel(slot);
            assert_eq!(released(&mut pool, slot), None);
        }
        pool.shutdown().unwrap();
    }
    #[test]
    #[ignore = "requires KVM and JITK_SHARD_TEST_SNAPSHOT; run under bench.lock"]
    fn spinning_slots_share_their_owner() {
        let snapshot = Snapshot::load(&std::env::var("JITK_SHARD_TEST_SNAPSHOT").unwrap()).unwrap();
        let mut pool = Pool::new(Kvm::new(), snapshot, 3, 1);
        // Slot 0 computes for 300 ms of guest time, then slot 1 spins for
        // good: turns (SLICE) keep the spinner from starving the computation.
        let busy = "let t=Date.now();while(Date.now()-t<300){}return 7;";
        let t = Instant::now();
        pool.start(0, policy(2, busy, 5_000));
        std::thread::sleep(Duration::from_millis(50));
        pool.start(1, policy(2, SPIN, 1_500));
        let Event::Done {
            slot: 0,
            completion: c,
            ..
        } = pool.recv()
        else {
            panic!("slot 0 completes first");
        };
        assert_eq!(c.result.unwrap(), "{\"ok\":7}");
        assert!(t.elapsed() < Duration::from_secs(1), "{:?}", t.elapsed());
        // A short run on the same owner completes while the spinner runs.
        pool.cancel(0);
        assert_eq!(released(&mut pool, 0), None);
        let t = Instant::now();
        pool.start(2, policy(2, RETURN2, 5_000));
        assert_eq!(completion(&mut pool).result.unwrap(), "{\"ok\":2}");
        within(t, "a run beside a spinner");
        // The spinner still ends at its deadline (the watchdog's kick).
        let c = completion(&mut pool);
        let Err(RunError::Deadline { deadline_ns }) = c.result else {
            panic!("spinner: {:?}", c.result);
        };
        let late = c.stopped_ns.saturating_sub(deadline_ns);
        assert!(late < 200_000_000, "stopped {late} ns past its deadline");
        pool.shutdown().unwrap();
    }
    #[test]
    #[ignore = "requires KVM and JITK_SHARD_TEST_SNAPSHOT; run under bench.lock"]
    fn syndromeless_guest_access_fails_only_its_slot() {
        let snapshot = Snapshot::load(&std::env::var("JITK_SHARD_TEST_SNAPSHOT").unwrap()).unwrap();
        let kvm = Kvm::new();
        let mut pool = Pool::new(kvm.clone(), snapshot, 2, 1);
        // The other slot on the owner spins throughout.
        pool.start(1, policy(2, SPIN, 30_000));
        let mut generation = 2;
        for (name, code, expected) in kvm::test_guest::syndromeless() {
            // KVM_RUN returned ENOSYS here, and the shard aborted.
            pool.start(0, job(generation, Some(code), 5_000));
            let c = completion(&mut pool);
            let e = c.result.unwrap_err();
            assert!(expected.is(kvm.nisv, &e), "{name}: {e:?}");
            assert_ne!(c.reset_done_ns, 0, "{name}: reset at once");
            pool.cancel(0);
            assert_eq!(released(&mut pool, 0), None, "{name}");
            pool.start(0, job(generation + 1, None, 5_000));
            assert_eq!(
                completion(&mut pool).result.unwrap(),
                "{\"ok\":2}",
                "{name}"
            );
            pool.cancel(0);
            assert_eq!(released(&mut pool, 0), None, "{name}");
            generation += 2;
        }
        pool.cancel(1);
        assert_eq!(released(&mut pool, 1), None);
        pool.shutdown().unwrap();
    }
}
