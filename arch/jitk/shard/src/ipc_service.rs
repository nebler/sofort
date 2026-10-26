//! Reactor for the selectable Node executor backend. No providers, credentials
//! or policy rules live here; only admission and transport bounds are checked.
use crate::{
    ipc::{self, Endpoint, Message},
    ipc_json,
    kvm::{self, Kvm, Request, Snapshot},
    owner::{Event, Job, Mode, Pool},
};
use std::{collections::VecDeque, io, sync::Arc};
const MAX_SLOTS: usize = 64;
const OUTBOUND: usize = MAX_SLOTS * 35 + 1;
pub const STATS: u32 = 22;
#[derive(Clone, Copy, PartialEq)]
enum Phase {
    Idle,
    Running,
    Done,
    Resetting,
}
struct State {
    generation: u64,
    phase: Phase,
    next: u64,
    pending: u32,
}
impl Default for State {
    fn default() -> Self {
        Self {
            generation: 0,
            phase: Phase::Idle,
            next: 1,
            pending: 0,
        }
    }
}
fn invalid(message: &'static str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}
fn ipc_charge(class: crate::arena::Class) -> io::Result<u32> {
    if class != crate::arena::Class::Glue2m {
        return Err(invalid("IPC supports only verified glue-2m snapshots"));
    }
    Ok(class.admission_bytes())
}
fn admission(m: &Message, now: u64, charge: u32) -> io::Result<(u64, String)> {
    let b = &m.bytes;
    if m.id != 0 || b.len() < 24 {
        return Err(invalid("IPC admission header"));
    }
    let deadline = ipc::u64_at(b, 0);
    if deadline > now.saturating_add(60_000_000_000)
        || ipc::u32_at(b, 8) != 32
        || ipc::u32_at(b, 12) != 1024
        || ipc::u32_at(b, 20) != charge
    {
        return Err(invalid("IPC admission limits/deadline"));
    }
    let n = ipc::u32_at(b, 16) as usize;
    if n > 8192 || b.len() != 24 + n || b[24..].iter().any(|b| !b.is_ascii() || *b == 0) {
        return Err(invalid("IPC source bound/encoding"));
    }
    Ok((
        deadline,
        String::from_utf8(b[24..].to_vec()).map_err(|_| invalid("IPC source UTF-8"))?,
    ))
}
fn enqueue(out: &mut VecDeque<Message>, m: Message) -> io::Result<()> {
    if out.len() >= OUTBOUND {
        return Err(invalid("IPC outbound queue bound"));
    }
    out.push_back(m);
    Ok(())
}
pub fn run(base: &str, slots: usize, owners: usize) -> io::Result<()> {
    if slots == 0
        || slots > MAX_SLOTS
        || owners == 0
        || owners > 4
        || owners > std::thread::available_parallelism()?.get()
    {
        return Err(invalid("IPC shard capacity"));
    }
    // PR_SET_PDEATHSIG closes the Node death window without a helper process.
    unsafe extern "C" {
        fn prctl(option: i32, ...) -> i32;
        fn getppid() -> i32;
    }
    let parent = unsafe { getppid() };
    if parent == 1 || unsafe { prctl(1, 9) } != 0 || unsafe { getppid() } != parent {
        return Err(invalid("IPC parent unavailable"));
    }
    let snapshot = Snapshot::load(base);
    let charge = ipc_charge(snapshot.class)?;
    let mut endpoint = unsafe { Endpoint::inherited()? };
    let wake = endpoint.notifier();
    let mut pool = Pool::notified(
        Kvm::new(),
        snapshot,
        slots,
        owners,
        Some(Arc::new(move || wake.signal())),
    );
    let mut states: Vec<State> = (0..slots).map(|_| State::default()).collect();
    let mut outbound = VecDeque::new();
    enqueue(&mut outbound, Message::new(ipc::READY, 0, 0, 0, Vec::new()))?;
    let result = (|| -> io::Result<()> {
        loop {
            let mut progress = false;
            for _ in 0..ipc::CAPACITY {
                let Some(m) = endpoint.receive()? else {
                    break;
                };
                progress = true;
                let id = m.slot as usize;
                if id >= slots || m.generation == 0 || m.generation >= u64::MAX >> 2 {
                    return Err(invalid("IPC slot/generation"));
                }
                let s = &mut states[id];
                match m.kind {
                    ipc::START => {
                        if s.phase != Phase::Idle || m.generation != s.generation + 1 {
                            return Err(invalid("IPC admission generation/state"));
                        }
                        let (deadline, source) = admission(&m, kvm::monotonic_ns(), charge)?;
                        *s = State {
                            generation: m.generation,
                            phase: Phase::Running,
                            ..State::default()
                        };
                        pool.start(
                            id,
                            Job {
                                generation: m.generation,
                                source,
                                mode: Mode::Policy,
                                deadline_ns: deadline,
                                canary: false,
                            },
                        );
                    }
                    ipc::REPLY => {
                        // A reply already in flight may arrive after a watchdog result.
                        // Its generation must still match; it can never target a reused slot.
                        if m.generation != s.generation
                            || m.id == 0
                            || m.id > 32
                            || m.bytes.len() > 1024
                            || !ipc_json::reply(&m.bytes)
                        {
                            return Err(invalid("IPC reply schema/generation"));
                        }
                        let bit = 1u32 << (m.id - 1);
                        if s.pending & bit == 0 {
                            return Err(invalid("IPC duplicate/unknown reply"));
                        }
                        s.pending &= !bit;
                        if s.phase == Phase::Running {
                            pool.reply(
                                id,
                                m.generation,
                                Request {
                                    id: m.id as u64,
                                    bytes: m.bytes,
                                },
                            );
                        }
                    }
                    ipc::CANCEL => {
                        if m.id != 0 || !m.bytes.is_empty() {
                            return Err(invalid("IPC cancel schema"));
                        }
                        if s.phase == Phase::Idle && m.generation == s.generation + 1 {
                            s.generation = m.generation;
                            enqueue(
                                &mut outbound,
                                Message::new(ipc::RELEASED, id, s.generation, 0, Vec::new()),
                            )?;
                        } else if m.generation == s.generation
                            && matches!(s.phase, Phase::Running | Phase::Done)
                        {
                            s.phase = Phase::Resetting;
                            pool.cancel(id);
                        } else {
                            return Err(invalid("IPC cancel generation/state"));
                        }
                    }
                    _ => return Err(invalid("IPC message direction/kind")),
                }
            }
            while let Some(event) = pool.try_recv() {
                progress = true;
                match event {
                    Event::Calls {
                        slot,
                        generation,
                        requests,
                    } => {
                        let s = &mut states[slot];
                        if generation != s.generation {
                            return Err(invalid("IPC owner generation"));
                        }
                        if s.phase == Phase::Resetting {
                            continue;
                        }
                        if s.phase != Phase::Running {
                            return Err(invalid("IPC owner call state"));
                        }
                        for request in requests {
                            if request.id != s.next
                                || request.id > 32
                                || request.bytes.len() > 1024
                                || !ipc_json::request(&request.bytes)
                            {
                                return Err(invalid("IPC guest call schema/id"));
                            }
                            s.next += 1;
                            s.pending |= 1u32 << (request.id - 1);
                            enqueue(
                                &mut outbound,
                                Message::new(
                                    ipc::CALL,
                                    slot,
                                    generation,
                                    request.id,
                                    request.bytes,
                                ),
                            )?;
                        }
                    }
                    Event::Done {
                        slot,
                        generation,
                        completion,
                    } => {
                        let s = &mut states[slot];
                        if generation != s.generation {
                            return Err(invalid("IPC owner completion generation"));
                        }
                        if s.phase == Phase::Resetting {
                            continue;
                        }
                        if s.phase != Phase::Running {
                            return Err(invalid("IPC duplicate completion"));
                        }
                        s.phase = Phase::Done;
                        let mut metrics = Vec::with_capacity(
                            32 + 8 * completion.metrics.policy_round_trips.len(),
                        );
                        for n in [
                            completion.metrics.cpu_ns,
                            completion.stopped_ns,
                            completion.reset_done_ns,
                            completion.metrics.policy_round_trips.len() as u64,
                        ] {
                            metrics.extend_from_slice(&n.to_le_bytes());
                        }
                        for n in &completion.metrics.policy_round_trips {
                            metrics.extend_from_slice(&n.to_le_bytes());
                        }
                        enqueue(
                            &mut outbound,
                            Message::new(STATS, slot, generation, 0, metrics),
                        )?;
                        let (kind, bytes) = match completion.result {
                            Ok(text) => (ipc::DONE, text.into_bytes()),
                            Err(e) => (ipc::ERROR, e.to_string().into_bytes()),
                        };
                        enqueue(
                            &mut outbound,
                            Message::new(kind, slot, generation, 0, bytes),
                        )?;
                    }
                    Event::Reset { slot } => {
                        let s = &mut states[slot];
                        if s.phase != Phase::Resetting {
                            return Err(invalid("IPC unexpected reset"));
                        }
                        s.phase = Phase::Idle;
                        s.pending = 0;
                        enqueue(
                            &mut outbound,
                            Message::new(ipc::RELEASED, slot, s.generation, 0, Vec::new()),
                        )?;
                    }
                    Event::Parked { .. } => return Err(invalid("IPC fixture event in service")),
                }
            }
            while let Some(m) = outbound.front() {
                if !endpoint.send(m)? {
                    break;
                }
                outbound.pop_front();
                progress = true;
            }
            if !progress {
                endpoint.wait()?;
            }
        }
    })();
    if let Err(e) = &result {
        // Fail closed immediately; do not wait behind a malicious busy vCPU
        // in Pool::drop. The independent watchdog observes the shard pidfd.
        eprintln!("shard IPC: {e}");
        std::process::exit(1);
    }
    result
}
/// Offline shared-memory echo/hostile peer. No KVM or watchdog is started.
pub fn probe(mode: &str) -> io::Result<()> {
    let mut endpoint = unsafe { Endpoint::inherited()? };
    let mut out = VecDeque::from([Message::new(ipc::READY, 0, 0, 0, Vec::new())]);
    loop {
        while let Some(m) = endpoint.receive()? {
            if mode != "echo" {
                return Err(invalid("unknown IPC probe mode"));
            }
            if m.kind != ipc::PING || m.slot != 0 || m.generation != 0 || m.bytes.len() > 1024 {
                return Err(invalid("IPC probe frame"));
            }
            enqueue(
                &mut out,
                Message {
                    kind: ipc::PING,
                    ..m
                },
            )?;
        }
        while let Some(m) = out.front() {
            if !endpoint.send(m)? {
                break;
            }
            out.pop_front();
        }
        endpoint.wait()?;
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn ipc_rejects_unsupported_snapshot_classes() {
        assert_eq!(ipc_charge(crate::arena::Class::Glue2m).unwrap(), 2 << 20);
        assert!(ipc_charge(crate::arena::Class::Glue4m).is_err());
    }
    #[test]
    fn malformed_admissions() {
        let mut m = Message::new(ipc::START, 0, 1, 0, vec![0; 24]);
        assert!(admission(&m, 0, 2 << 20).is_err());
        m.bytes[0..8].copy_from_slice(&1u64.to_le_bytes());
        m.bytes[8..12].copy_from_slice(&32u32.to_le_bytes());
        m.bytes[12..16].copy_from_slice(&1024u32.to_le_bytes());
        m.bytes[20..24].copy_from_slice(&(2u32 * 1024 * 1024).to_le_bytes());
        assert!(admission(&m, 0, 2 << 20).is_ok());
        m.bytes[16..20].copy_from_slice(&u32::MAX.to_le_bytes());
        assert!(admission(&m, 0, 2 << 20).is_err());
        m.bytes[16..20].fill(0);
        m.id = 1;
        assert!(admission(&m, 0, 2 << 20).is_err());
    }
}
