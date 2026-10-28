//! Fixed owner threads construct, run, reset and destroy their own VM/vCPU fds.
//! Waiting slots retain no execution stack. The reactor sends bounded commands;
//! the watchdog shares only generation-fenced leases and eventfd wakeups.
use crate::{
    clock::{self, Clock},
    constants::ring,
    kvm::{self, Kvm, Request, ResetPolicy, ResetReport, RunError, Slot, Snapshot},
    lease::{Lease, Wake, Watchdog},
};
use std::{
    fs::File,
    io,
    sync::{
        Arc,
        mpsc::{self, Receiver, SyncSender},
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};
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
    Calls {
        slot: usize,
        generation: u64,
        requests: Vec<Request>,
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
    Reset {
        slot: usize,
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
struct Mailbox {
    tx: SyncSender<Command>,
    wake: Wake,
}
impl Mailbox {
    fn send(&self, cmd: Command) {
        self.tx.send(cmd).unwrap();
        self.wake.notify();
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
        assert!(
            owners > 0
                && owners <= thread::available_parallelism().unwrap().get()
                && slots > 0
                && slots <= 16384
        );
        let wakes: Vec<_> = (0..owners).map(|_| Wake::new()).collect();
        let watchdog = Watchdog::start(slots, &wakes, 100);
        let clock = Clock::start(slots);
        let (tx, events) = mpsc::sync_channel(slots + owners);
        let mut mailboxes = Vec::new();
        let mut joins = Vec::new();
        for (owner, wake) in wakes.into_iter().enumerate() {
            let capacity = if notify.is_some() {
                slots.saturating_sub(owner).div_ceil(owners) * 34 + 1
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
            joins.push(
                thread::Builder::new()
                    .name(format!("jitk-owner-{owner}"))
                    .spawn(move || {
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
                        }
                        .run()
                    })
                    .unwrap(),
            );
            mailboxes.push(Mailbox { tx: cmd, wake });
        }
        Self {
            owners: mailboxes,
            joins,
            events,
            watchdog,
            slots,
            _clock: clock,
        }
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
        self.watchdog.check();
        self.events.try_recv().ok()
    }
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
    Calls(Vec<Request>),
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
    policy_sent: [u64; 32],
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
        self.cpu.lease = Some(self.lease.clone());
        self.activity = Activity::Running;
        self.started = Instant::now();
        self.waited = None;
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
            if self.behavior.mode == Mode::Policy && (!e.requests.is_empty() || e.op == ring::WAIT)
            {
                // Request bytes are opaque here; Node owns the call schema.
                let sent = kvm::monotonic_ns();
                for r in &e.requests {
                    self.policy_sent[r.id as usize - 1] = sent;
                }
                let calls = e
                    .requests
                    .iter()
                    .map(|r| Request {
                        id: r.id,
                        bytes: r.bytes.clone(),
                    })
                    .collect();
                self.pending.extend(e.requests);
                self.cpu.drain();
                return Ok(Progress::Calls(calls));
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
                self.metrics.policy_round_trips.push(
                    kvm::monotonic_ns().saturating_sub(self.policy_sent[request.id as usize - 1]),
                );
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
impl Worker {
    fn run(self) -> io::Result<()> {
        let mut slots: Vec<Option<Managed>> = (0..self.leases.len()).map(|_| None).collect();
        let mut entropy = File::open("/dev/urandom").unwrap();
        let mut trim_at = None;
        loop {
            self.wake.wait_until(trim_at);
            expire(&mut slots, self.owner, self.owners, &self.events);
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
                        policy_sent: [0; 32],
                    });
                }
                let s = slots[i].as_mut().unwrap();
                if matches!(cmd, Command::Reset(_) | Command::Cancel(_)) {
                    // An errored run was already reset in finish(); its RELEASE
                    // costs nothing. The next begin() finds the slot pristine.
                    s.reset_unless_pristine();
                    if matches!(cmd, Command::Reset(_)) && !s.cpu.is_quarantined() {
                        // Offline verification: the pristine flag must imply
                        // every byte of RAM and every register.
                        assert!(s.cpu.pristine(), "RAM differs from the snapshot");
                        let regs = s.cpu.register_mismatches();
                        assert!(regs.is_empty(), "registers differ: {regs:#x?}");
                    }
                    self.events.send(Event::Reset { slot: id }).unwrap();
                    continue;
                }
                if !s.command(cmd, &mut entropy, id, &self.events) {
                    continue;
                }
                self.drive(&mut slots, i, id, mode);
            }
            // Trim slots now due; resets above may have made others trimmable.
            trim_at = trim_idle(&mut slots);
        }
    }
    fn drive(&self, slots: &mut [Option<Managed>], i: usize, id: usize, mode: Option<Mode>) {
        loop {
            let s = slots[i].as_mut().unwrap();
            if s.activity == Activity::Idle {
                break;
            } // expiry sweep already reported this run
            let t = kvm::clock_ns(libc::CLOCK_THREAD_CPUTIME_ID);
            let until = match mode {
                Some(Mode::Wait | Mode::Ready) => DriveUntil::Wait,
                _ => DriveUntil::Completion,
            };
            let result = s.drive(until);
            s.metrics.cpu_ns += kvm::clock_ns(libc::CLOCK_THREAD_CPUTIME_ID) - t;
            match result {
                Ok(Progress::Interrupted) => expire(slots, self.owner, self.owners, &self.events),
                Ok(Progress::Calls(requests)) => {
                    self.events
                        .send(Event::Calls {
                            slot: id,
                            generation: s.cpu.generation,
                            requests,
                        })
                        .unwrap();
                    break;
                }
                Ok(Progress::Parked) => {
                    self.events
                        .send(Event::Parked {
                            slot: id,
                            generation: s.cpu.generation,
                        })
                        .unwrap();
                    break;
                }
                result => {
                    let result = result.map(|p| match p {
                        Progress::Finished(s) => s,
                        _ => unreachable!(),
                    });
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
                    break;
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
        assert!(matches!(pool.recv(), Event::Reset { slot: 0 }));
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
        assert!(matches!(pool.recv(), Event::Reset { slot: 0 }));
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
        assert!(matches!(pool.recv(), Event::Reset { slot: 0 }));
        pool.reset(0);
        assert!(matches!(pool.recv(), Event::Reset { slot: 0 }));
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
        assert!(matches!(pool.recv(), Event::Reset { slot: 0 }));
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
            assert!(matches!(pool.recv(), Event::Reset { slot: 0 }));
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
        assert!(matches!(pool.recv(), Event::Reset { slot: 0 }));
        pool.shutdown().unwrap();
    }
}
