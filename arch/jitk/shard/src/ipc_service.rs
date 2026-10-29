//! Reactor for the selectable Node executor backend. No providers, credentials
//! or policy rules live here; only admission and transport bounds are checked.
//! The per-slot state machine is `service`'s, shared with the HVF zygote.
use crate::constants::ABI_VERSION;
use crate::service::{self, Cancel, State, enqueue, invalid, ipc_charge, released};
use crate::{
    confine::{self, Confinement, Signals},
    ipc::{self, Endpoint, Message},
    kvm::{self, Kvm, Request, Snapshot},
    owner::{Event, Job, Mode, Pool},
};
use std::{collections::VecDeque, io, sync::Arc};
const MAX_SLOTS: usize = crate::constants::ipc::MAX_SLOTS;
pub use crate::constants::ipc::STATS;
pub fn run(base: &str, slots: usize, owners: usize, policy: kvm::ResetPolicy) -> io::Result<()> {
    if slots == 0
        || slots > MAX_SLOTS
        || owners == 0
        || owners > 4
        || owners > std::thread::available_parallelism()?.get()
    {
        return Err(invalid("IPC shard capacity"));
    }
    // Confinement (confine/mod.rs) runs in three steps around the setup:
    // namespaces while this is the only thread; Landlock once every file is
    // open and the watchdog spawned; seccomp once every thread exists. READY
    // goes to Node only after the last step, before any guest code runs.
    let mut confinement = Confinement::new();
    confinement.enter_namespaces();
    // PR_SET_PDEATHSIG closes the Node death window without a helper process.
    // SAFETY: getppid and PR_SET_PDEATHSIG take scalar arguments, retain no
    // pointers, and are called before any owner threads are started.
    let parent = unsafe { libc::getppid() };
    if parent == 1 {
        return Err(invalid("IPC parent unavailable"));
    }
    // SAFETY: PR_SET_PDEATHSIG takes SIGKILL as its integer second argument.
    let armed = unsafe { libc::prctl(libc::PR_SET_PDEATHSIG, libc::SIGKILL) };
    if armed != 0 {
        return Err(invalid("IPC parent unavailable"));
    }
    // SAFETY: getppid has no pointer or lifetime preconditions.
    let current_parent = unsafe { libc::getppid() };
    if current_parent != parent {
        return Err(invalid("IPC parent unavailable"));
    }
    let snapshot = Snapshot::load_identified(base)?;
    let charge = ipc_charge(snapshot.class)?;
    // SAFETY: this binary startup path uniquely adopts the Node-supplied
    // memfd and eventfds 3/4/5 before any owner threads are started.
    let mut endpoint = unsafe { Endpoint::inherited()? };
    let wake = endpoint.notifier();
    let notify: Notify = Arc::new(move || wake.signal());
    let pool = confined_pool(
        &mut confinement,
        snapshot,
        slots,
        owners,
        Some(notify),
        policy,
    )?;
    confinement.report().warn("shard IPC");
    let mut reactor = Reactor {
        pool,
        states: (0..slots).map(|_| State::default()).collect(),
        outbound: VecDeque::new(),
        charge,
    };
    enqueue(
        &mut reactor.outbound,
        Message::new(ipc::READY, 0, 0, 0, ABI_VERSION.to_le_bytes().to_vec()),
    )?;
    let result = reactor.run(&mut endpoint);
    if let Err(e) = &result {
        // Fail closed immediately; do not wait behind a malicious busy vCPU
        // in Pool::drop. The independent watchdog observes the shard pidfd.
        eprintln!("shard IPC: {e}");
        std::process::exit(1);
    }
    result
}
type Notify = Arc<dyn Fn() + Send + Sync>;
/// The shard's pool as `real ipc` runs it, also used by `real confine`:
/// call with the namespaces entered and no thread started. Opens /dev/kvm,
/// the pagemap and entropy and spawns the watchdog; closes file access;
/// starts the clock and owner threads; then filters every thread's syscalls
/// (confine::policy::shard). No guest code has run when this returns.
pub fn confined_pool(
    confinement: &mut Confinement,
    snapshot: Arc<Snapshot>,
    slots: usize,
    owners: usize,
    notify: Option<Notify>,
    policy: kvm::ResetPolicy,
) -> io::Result<Pool> {
    let prepared = Pool::prepare(Kvm::new(), snapshot, slots, owners);
    confinement.close_files(Signals::OwnProcess)?;
    let pool = prepared.start(notify, policy);
    confinement.filter_syscalls(&confine::policy::shard(std::process::id()))?;
    Ok(pool)
}
struct Reactor {
    pool: Pool,
    states: Vec<State>,
    outbound: VecDeque<Message>,
    charge: u32,
}
impl Reactor {
    fn run(&mut self, endpoint: &mut Endpoint) -> io::Result<()> {
        loop {
            let mut progress = false;
            for _ in 0..ipc::CAPACITY {
                let Some(message) = endpoint.receive()? else {
                    break;
                };
                progress = true;
                self.message(message)?;
            }
            while let Some(event) = self.pool.try_recv() {
                progress = true;
                self.event(event)?;
            }
            while let Some(message) = self.outbound.front() {
                if !endpoint.send(message)? {
                    break;
                }
                self.outbound.pop_front();
                progress = true;
            }
            if !progress && endpoint.wait(Some(self.pool.watchdog_exit_fd()))? {
                self.pool.watchdog_exited();
            }
        }
    }
    fn message(&mut self, m: Message) -> io::Result<()> {
        let id = m.slot as usize;
        if id >= self.states.len() || m.generation == 0 || m.generation >= u64::MAX >> 2 {
            return Err(invalid("IPC slot/generation"));
        }
        let s = &mut self.states[id];
        match m.kind {
            ipc::START => {
                let (deadline, source) = s.start(&m, kvm::monotonic_ns(), self.charge)?;
                self.pool.start(
                    id,
                    Job {
                        generation: m.generation,
                        source,
                        mode: Mode::Policy,
                        deadline_ns: deadline,
                        canary: false,
                        entry: None,
                    },
                );
            }
            ipc::REPLY => {
                if s.reply(&m)? {
                    self.pool.reply(
                        id,
                        m.generation,
                        Request {
                            id: m.id as u64,
                            bytes: m.bytes,
                        },
                    );
                }
            }
            ipc::CANCEL => match s.cancel(&m)? {
                Cancel::Unstarted => enqueue(
                    &mut self.outbound,
                    Message::new(ipc::RELEASED, id, s.generation, 0, Vec::new()),
                )?,
                Cancel::Reset => self.pool.cancel(id),
            },
            _ => return Err(invalid("IPC message direction/kind")),
        }
        Ok(())
    }
    fn event(&mut self, event: Event) -> io::Result<()> {
        match event {
            Event::Calls {
                slot,
                generation,
                requests,
                logs,
            } => {
                let s = &mut self.states[slot];
                if generation != s.generation {
                    return Err(invalid("IPC owner generation"));
                }
                // Owners forward only bounded printable calls and console
                // lines (payload::forwarded); a mismatch here is a shard bug,
                // so it fails the whole service.
                for line in logs {
                    if s.log(&line)? {
                        enqueue(
                            &mut self.outbound,
                            Message::new(ipc::LOG, slot, generation, 0, line),
                        )?;
                    }
                }
                for request in requests {
                    if s.call(request.id, &request.bytes)? {
                        enqueue(
                            &mut self.outbound,
                            Message::new(ipc::CALL, slot, generation, request.id, request.bytes),
                        )?;
                    }
                }
            }
            Event::Done {
                slot,
                generation,
                completion,
            } => {
                let s = &mut self.states[slot];
                if generation != s.generation {
                    return Err(invalid("IPC owner completion generation"));
                }
                if !s.complete()? {
                    return Ok(());
                }
                enqueue(
                    &mut self.outbound,
                    service::stats(
                        slot,
                        generation,
                        [
                            completion.metrics.cpu_ns,
                            completion.stopped_ns,
                            completion.reset_done_ns,
                        ],
                        &completion.metrics.policy_round_trips,
                    ),
                )?;
                let (kind, bytes) = match completion.result {
                    Ok(text) => (ipc::DONE, text.into_bytes()),
                    Err(e) => (ipc::ERROR, e.to_string().into_bytes()),
                };
                enqueue(
                    &mut self.outbound,
                    Message::new(kind, slot, generation, 0, bytes),
                )?;
            }
            Event::Reset { slot, quarantined } => {
                let m = released(&mut self.states[slot], slot, quarantined)?;
                enqueue(&mut self.outbound, m)?;
            }
            Event::Parked { .. } => return Err(invalid("IPC fixture event in service")),
        }
        Ok(())
    }
}
