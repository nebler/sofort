//! Fixed owner threads construct, run, reset and destroy their own VM/vCPU fds.
//! Waiting slots retain no execution stack. The reactor sends bounded commands;
//! the watchdog shares only generation-fenced leases and eventfd wakeups.
use crate::{
    kvm::{self, Kvm, Request, RunError, Slot, Snapshot},
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
    Attack,
    RetainAttack,
    Policy,
}
pub struct Job {
    pub generation: u64,
    pub source: String,
    pub mode: Mode,
    pub deadline_ns: u64,
    pub canary: bool,
}
#[derive(Default)]
pub struct Metrics {
    pub reset_ns: u64,
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
}
impl Pool {
    pub fn new(kvm: Arc<Kvm>, snapshot: Arc<Snapshot>, slots: usize, owners: usize) -> Self {
        Self::notified(kvm, snapshot, slots, owners, None)
    }
    pub fn notified(
        kvm: Arc<Kvm>,
        snapshot: Arc<Snapshot>,
        slots: usize,
        owners: usize,
        notify: Option<Arc<dyn Fn() + Send + Sync>>,
    ) -> Self {
        assert!(
            owners > 0
                && owners <= thread::available_parallelism().unwrap().get()
                && slots > 0
                && slots <= 16384
        );
        let wakes: Vec<_> = (0..owners).map(|_| Wake::new()).collect();
        let watchdog = Watchdog::start(slots, &wakes, 100);
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
            let (kvm, snapshot, tx, w) = (kvm.clone(), snapshot.clone(), tx.clone(), wake.clone());
            joins.push(
                thread::Builder::new()
                    .name(format!("jitk-owner-{owner}"))
                    .spawn(move || {
                        worker(
                            (owner, owners),
                            kvm,
                            snapshot,
                            leases,
                            rx,
                            Events { tx, notify },
                            w,
                        )
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
struct Managed {
    cpu: Slot,
    lease: Lease,
    active: bool,
    pending: Vec<Request>,
    seed: [u8; 16],
    metrics: Metrics,
    started: Instant,
    waited: Option<Instant>,
    canary: bool,
    policy: bool,
    policy_sent: [u64; 32],
}
impl Managed {
    fn reset(&mut self) -> u64 {
        let reset = self.cpu.reset();
        if self.active {
            self.lease.acknowledge_reset();
        }
        self.active = false;
        self.pending.clear();
        reset
    }
    fn begin(&mut self, job: Job, entropy: &mut File) {
        let cpu_start = kvm::clock_ns(3); // CLOCK_THREAD_CPUTIME_ID; no parallel-owner double count
        let reset_ns = self.reset();
        assert_eq!(self.cpu.canary(), 0, "stale RAM canary");
        self.seed = self.cpu.bind(job.generation, &job.source, entropy);
        self.lease = self.lease.arm(job.generation, job.deadline_ns);
        self.cpu.lease = Some(self.lease.clone());
        self.active = true;
        self.started = Instant::now();
        self.waited = None;
        self.canary = job.canary;
        self.policy = job.mode == Mode::Policy;
        self.metrics = Metrics {
            reset_ns,
            cpu_ns: kvm::clock_ns(3) - cpu_start,
            ..Metrics::default()
        };
        if job.mode == Mode::Ready {
            self.cpu.pause_after_repair();
        }
        if matches!(job.mode, Mode::Attack | Mode::RetainAttack) {
            self.cpu.attack_arena();
        }
    }
    fn drive(&mut self, hold: bool) -> Result<Progress, RunError> {
        loop {
            let Some(e) = self.cpu.try_exit()? else {
                return Ok(Progress::Interrupted);
            };
            self.metrics.calls += e.requests.len() as u64;
            if e.op == 3 {
                if !self.cpu.repaired() {
                    return Err(RunError::GuestProtocol("missing repair acknowledgement"));
                }
                return e
                    .finish
                    .map(Progress::Finished)
                    .ok_or(RunError::GuestProtocol("missing completion"));
            }
            if (e.op == 5 && !self.cpu.repaired()) || !matches!(e.op, 1 | 2 | 5) {
                return Err(RunError::GuestProtocol("unexpected checkpoint/repair"));
            }
            if e.op == 2 && self.waited.is_none() {
                self.waited = Some(Instant::now());
            }
            if self.policy && (!e.requests.is_empty() || e.op == 2) {
                if e.requests
                    .iter()
                    .any(|r| !crate::ipc_json::request(&r.bytes))
                {
                    return Err(RunError::GuestProtocol("policy call schema"));
                }
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
            if hold && (e.op == 2 || e.op == 5) {
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
    fn finish(&mut self, result: Result<String, RunError>, retain: bool) -> Completion {
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
        let retain = retain && !matches!(result, Err(RunError::Deadline { .. }));
        let mut reset_done_ns = 0;
        if result.is_err() && !retain {
            self.cpu.reset(); // includes MMIO completion, discard, registers, clearing immediate_exit
            self.lease.acknowledge_reset();
            self.active = false;
            reset_done_ns = kvm::monotonic_ns();
        } else {
            // complete() disarmed this stopped slot. Retained dirty pages are measurement-only.
            self.active = false;
            if self.canary {
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
fn worker(
    (owner, owners): (usize, usize),
    kvm: Arc<Kvm>,
    snapshot: Arc<Snapshot>,
    leases: Vec<Lease>,
    commands: Receiver<Command>,
    events: Events,
    wake: Wake,
) -> io::Result<()> {
    let mut slots: Vec<Option<Managed>> = (0..leases.len()).map(|_| None).collect();
    let mut entropy = File::open("/dev/urandom").unwrap();
    loop {
        wake.wait();
        expire(&mut slots, owner, owners, &events);
        while let Ok(cmd) = commands.try_recv() {
            expire(&mut slots, owner, owners, &events);
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
                        let active = s.active;
                        drop(s); // Destroy this stopped VM before acknowledging its lease.
                        if active {
                            lease.acknowledge_reset();
                        }
                    }
                    return Ok(());
                }
            };
            let i = id / owners;
            assert_eq!(id % owners, owner);
            if slots[i].is_none() {
                let cpu = Slot::new(&kvm, snapshot.clone());
                slots[i] = Some(Managed {
                    cpu,
                    lease: leases[i].clone(),
                    active: false,
                    pending: Vec::new(),
                    seed: [0; 16],
                    metrics: Metrics::default(),
                    started: Instant::now(),
                    waited: None,
                    canary: false,
                    policy: false,
                    policy_sent: [0; 32],
                });
            }
            let s = slots[i].as_mut().unwrap();
            if matches!(cmd, Command::Reset(_) | Command::Cancel(_)) {
                s.reset();
                if matches!(cmd, Command::Reset(_)) {
                    assert!(s.cpu.pristine());
                }
                events.send(Event::Reset { slot: id }).unwrap();
                continue;
            }
            match cmd {
                Command::Start(_, job) => {
                    assert!(!s.active);
                    s.begin(job, &mut entropy);
                }
                Command::Reply(_, generation, request) => {
                    if !s.active || generation != s.cpu.generation {
                        continue;
                    }
                    let Some(at) = s.pending.iter().position(|r| r.id == request.id) else {
                        continue;
                    };
                    s.pending.swap_remove(at);
                    let t = kvm::clock_ns(3);
                    if let Err(e) = s.cpu.reply(&request) {
                        let completion = s.finish(Err(e), false);
                        events
                            .send(Event::Done {
                                slot: id,
                                generation,
                                completion,
                            })
                            .unwrap();
                        continue;
                    }
                    s.metrics.policy_round_trips.push(
                        kvm::monotonic_ns().saturating_sub(s.policy_sent[request.id as usize - 1]),
                    );
                    s.metrics.cpu_ns += kvm::clock_ns(3) - t;
                }
                Command::Resume(_, generation) => {
                    if !s.active || generation != s.cpu.generation {
                        continue;
                    }
                    let t = kvm::clock_ns(3);
                    let pending = std::mem::take(&mut s.pending);
                    if let Err(e) = s.reply(&pending) {
                        let completion = s.finish(Err(e), false);
                        events
                            .send(Event::Done {
                                slot: id,
                                generation,
                                completion,
                            })
                            .unwrap();
                        continue;
                    }
                    s.metrics.cpu_ns += kvm::clock_ns(3) - t;
                }
                _ => unreachable!(),
            }
            loop {
                let s = slots[i].as_mut().unwrap();
                if !s.active {
                    break;
                } // expiry sweep already reported this run
                let t = kvm::clock_ns(3);
                let result = s.drive(mode == Some(Mode::Wait) || mode == Some(Mode::Ready));
                s.metrics.cpu_ns += kvm::clock_ns(3) - t;
                match result {
                    Ok(Progress::Interrupted) => expire(&mut slots, owner, owners, &events),
                    Ok(Progress::Calls(requests)) => {
                        events
                            .send(Event::Calls {
                                slot: id,
                                generation: s.cpu.generation,
                                requests,
                            })
                            .unwrap();
                        break;
                    }
                    Ok(Progress::Parked) => {
                        events
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
                        let completion = s.finish(result, mode == Some(Mode::RetainAttack));
                        events
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
}

fn expire(slots: &mut [Option<Managed>], owner: usize, owners: usize, events: &Events) {
    for (i, s) in slots.iter_mut().enumerate() {
        if let Some(s) = s
            && s.active
            && s.lease.expired()
        {
            let completion = s.finish(
                Err(RunError::Deadline {
                    deadline_ns: s.lease.deadline(),
                }),
                false,
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
    use super::*;

    #[test]
    #[ignore = "requires KVM and JITK_SHARD_TEST_SNAPSHOT; run under bench.lock"]
    fn shutdown_interrupts_queued_spins_and_is_idempotent() {
        let snapshot = Snapshot::load(&std::env::var("JITK_SHARD_TEST_SNAPSHOT").unwrap()).unwrap();
        let mut pool = Pool::new(Kvm::new(), snapshot, 1, 1);
        pool.start(
            0,
            Job {
                generation: 2,
                source: "while(true){}".into(),
                mode: Mode::Run,
                deadline_ns: kvm::monotonic_ns() + 30_000_000_000,
                canary: false,
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
            (0, "return await tools.echo(41);", Mode::Policy),
            (1, "return 2;", Mode::Run),
        ] {
            pool.start(
                slot,
                Job {
                    generation: 2,
                    source: source.into(),
                    mode,
                    deadline_ns: kvm::monotonic_ns() + 5_000_000_000,
                    canary: true,
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
                source: "return 2;".into(),
                mode: Mode::Run,
                deadline_ns: kvm::monotonic_ns() + 5_000_000_000,
                canary: true,
            },
        );
        let Event::Done { completion, .. } = pool.recv() else {
            panic!("clean reuse");
        };
        assert_eq!(completion.result.unwrap(), "{\"ok\":2}");
        pool.shutdown().unwrap();
    }
}
