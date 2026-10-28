//! Reactor for the selectable Node executor backend. No providers, credentials
//! or policy rules live here; only admission and transport bounds are checked.
//! The per-slot state machine is `service`'s, shared with the HVF zygote.
use crate::constants::ABI_VERSION;
use crate::service::{self, Cancel, State, enqueue, invalid, ipc_charge, released};
use crate::{
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
    let pool = Pool::notified(
        Kvm::new(),
        snapshot,
        slots,
        owners,
        Some(Arc::new(move || wake.signal())),
        policy,
    );
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
            if !progress {
                endpoint.wait()?;
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
            } => {
                let s = &mut self.states[slot];
                if generation != s.generation {
                    return Err(invalid("IPC owner generation"));
                }
                // Owners forward only bounded printable calls (payload::forwarded);
                // a mismatch here is a shard bug, so it fails the whole service.
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
