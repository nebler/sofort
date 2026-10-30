//! The transport-independent half of the Node IPC service (executor/ipc/ABI.md):
//! the record envelope and the per-slot state machine that checks every Node
//! message and every guest event against it. The Linux reactor (`ipc_service`,
//! shared-memory queues to Node, owner threads behind it) and the macOS HVF
//! zygote (`hvf::zygote`, a socket to Node, one engine process per slot behind
//! it) both run it, so Node sees one protocol from either.
use crate::calls::Calls;
use crate::constants::ipc as wire;
use crate::constants::ring;
use crate::payload;
use std::{collections::VecDeque, io};

pub use crate::constants::ipc::{
    CALL, CANCEL, DONE, ERROR, HEADER_BYTES, LOG, MESSAGE_BYTES, PAYLOAD, QUARANTINED, READY,
    RELEASED, REPLY, RESTORED, START, STATS,
};

pub fn invalid(message: &'static str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}
pub fn u32_at(b: &[u8], at: usize) -> u32 {
    u32::from_le_bytes(b[at..at + 4].try_into().unwrap())
}
pub fn u64_at(b: &[u8], at: usize) -> u64 {
    u64::from_le_bytes(b[at..at + 8].try_into().unwrap())
}

/// One IPC message: one or more records (kind u32, slot u32, generation
/// u64, id u32, payload length u32, flags u32, reserved u32 = 0, then the
/// payload), all but the last with flags MORE and a full PAYLOAD.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Message {
    pub kind: u32,
    pub slot: u32,
    pub generation: u64,
    pub id: u32,
    pub bytes: Vec<u8>,
}
impl Message {
    pub fn new(kind: u32, slot: usize, generation: u64, id: u64, bytes: Vec<u8>) -> Self {
        Self {
            kind,
            slot: slot as u32,
            generation,
            id: id as u32,
            bytes,
        }
    }
    /// Decode one record from a private copy that starts with its header; the
    /// copy may be longer than the record (a fixed-size queue slot). Returns
    /// the record as a message and whether its message continues (MORE).
    pub fn decode(copy: &[u8]) -> io::Result<(Self, bool)> {
        if copy.len() < HEADER_BYTES {
            return Err(invalid("IPC record header"));
        }
        let n = u32_at(copy, wire::LENGTH_AT) as usize;
        let flags = u32_at(copy, wire::FLAGS_AT);
        if n > PAYLOAD
            || flags & !wire::MORE != 0
            || u32_at(copy, wire::RESERVED_AT) != 0
            || copy.len() < HEADER_BYTES + n
        {
            return Err(invalid("IPC record length/reserved"));
        }
        let more = flags & wire::MORE != 0;
        if more && n != PAYLOAD {
            return Err(invalid("IPC record fragment"));
        }
        Ok((
            Self {
                kind: u32_at(copy, wire::KIND_AT),
                slot: u32_at(copy, wire::SLOT_AT),
                generation: u64_at(copy, wire::GENERATION_AT),
                id: u32_at(copy, wire::ID_AT),
                bytes: copy[HEADER_BYTES..HEADER_BYTES + n].to_vec(),
            },
            more,
        ))
    }
    fn header(&self, n: usize, more: bool) -> [u8; HEADER_BYTES] {
        let mut h = [0u8; HEADER_BYTES];
        h[wire::KIND_AT..wire::KIND_AT + 4].copy_from_slice(&self.kind.to_le_bytes());
        h[wire::SLOT_AT..wire::SLOT_AT + 4].copy_from_slice(&self.slot.to_le_bytes());
        h[wire::GENERATION_AT..wire::GENERATION_AT + 8]
            .copy_from_slice(&self.generation.to_le_bytes());
        h[wire::ID_AT..wire::ID_AT + 4].copy_from_slice(&self.id.to_le_bytes());
        h[wire::LENGTH_AT..wire::LENGTH_AT + 4].copy_from_slice(&(n as u32).to_le_bytes());
        let flags = if more { wire::MORE } else { 0 };
        h[wire::FLAGS_AT..wire::FLAGS_AT + 4].copy_from_slice(&flags.to_le_bytes());
        h
    }
    /// The message's records, each header and payload.
    pub fn records(&self) -> io::Result<Vec<Vec<u8>>> {
        if self.bytes.len() > MESSAGE_BYTES {
            return Err(invalid("IPC local message bound"));
        }
        let count = wire::records(self.bytes.len());
        Ok((0..count)
            .map(|i| {
                let len = self.bytes.len();
                let chunk = &self.bytes[(i * PAYLOAD).min(len)..((i + 1) * PAYLOAD).min(len)];
                let mut b = Vec::with_capacity(HEADER_BYTES + chunk.len());
                b.extend_from_slice(&self.header(chunk.len(), i + 1 < count));
                b.extend_from_slice(chunk);
                b
            })
            .collect())
    }
    /// Every record back to back, for a stream transport.
    pub fn encode(&self) -> io::Result<Vec<u8>> {
        Ok(self.records()?.concat())
    }
}
/// Reassembles one direction's messages: their records are consecutive, so
/// at most one message is partial.
#[derive(Default)]
pub struct Assembler {
    partial: Option<Message>,
}
impl Assembler {
    /// Add a decoded record; the message once its last record arrived.
    pub fn push(&mut self, record: Message, more: bool) -> io::Result<Option<Message>> {
        let message = match self.partial.take() {
            None => record,
            Some(mut m) => {
                if (m.kind, m.slot, m.generation, m.id)
                    != (record.kind, record.slot, record.generation, record.id)
                {
                    return Err(invalid("IPC fragment identity"));
                }
                m.bytes.extend_from_slice(&record.bytes);
                m
            }
        };
        if message.bytes.len() > MESSAGE_BYTES {
            return Err(invalid("IPC message bound"));
        }
        if more {
            self.partial = Some(message);
            return Ok(None);
        }
        Ok(Some(message))
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub enum Phase {
    #[default]
    Idle,
    Running,
    Done,
    Resetting,
    /// Reported QUARANTINED: admits nothing (any message for it is a Node bug)
    /// until the HVF zygote restores it (RESTORED); the Linux shard never does.
    Quarantined,
}
/// One slot's IPC state: the generation Node admitted, its phase, its guest
/// call ids (the calls Node still owes a reply) and its console lines.
#[derive(Default)]
pub struct State {
    pub generation: u64,
    pub phase: Phase,
    pub calls: Calls,
    pub logs: usize,
}
impl State {
    /// Whether a guest message of this slot is forwarded. Ok(false): the
    /// generation is being reset, drop it.
    fn forwarding(&self) -> io::Result<bool> {
        match self.phase {
            Phase::Resetting => Ok(false),
            Phase::Running => Ok(true),
            _ => Err(invalid("IPC owner call state")),
        }
    }
    /// A guest call the engine forwards. Ok(false): the generation is being
    /// reset, drop it. Engines forward only bounded printable calls
    /// (payload::forwarded) in id order within the outstanding bound; anything
    /// else is an engine bug and fails the whole service.
    pub fn call(&mut self, id: u64, bytes: &[u8]) -> io::Result<bool> {
        if !self.forwarding()? {
            return Ok(false);
        }
        if !payload::forwarded(ring::CALL, bytes) || !self.calls.issue(id, 0) {
            return Err(invalid("IPC guest call schema/id"));
        }
        Ok(true)
    }
    /// A guest console line the engine forwards (IPC LOG), at most MAX_LOGS
    /// per generation. Ok(false): drop it, as `call`.
    pub fn log(&mut self, bytes: &[u8]) -> io::Result<bool> {
        if !self.forwarding()? {
            return Ok(false);
        }
        if !payload::forwarded(ring::CONSOLE, bytes) || self.logs >= ring::MAX_LOGS {
            return Err(invalid("IPC guest log schema/budget"));
        }
        self.logs += 1;
        Ok(true)
    }
    /// The generation's completion (STATS then DONE or ERROR). Ok(false): it
    /// is being reset, drop it.
    pub fn complete(&mut self) -> io::Result<bool> {
        if self.phase == Phase::Resetting {
            return Ok(false);
        }
        if self.phase != Phase::Running {
            return Err(invalid("IPC duplicate completion"));
        }
        self.phase = Phase::Done;
        Ok(true)
    }
    /// A Node REPLY for this slot. Ok(true): deliver it to the running guest
    /// (a reply already in flight may arrive after the run ended; its
    /// generation must still match, so it never targets a reused slot).
    pub fn reply(&mut self, m: &Message) -> io::Result<bool> {
        if m.generation != self.generation
            || m.bytes.is_empty()
            || m.bytes.len() > ring::REPLY_BYTES
            || !payload::printable(&m.bytes)
        {
            return Err(invalid("IPC reply schema/generation"));
        }
        if self.calls.answer(m.id.into()).is_none() {
            return Err(invalid("IPC duplicate/unknown reply"));
        }
        Ok(self.phase == Phase::Running)
    }
}
/// What a Node CANCEL asks for.
#[derive(Debug, PartialEq)]
pub enum Cancel {
    /// Of the next generation of an idle slot: nothing ran; RELEASED now.
    Unstarted,
    /// Of the current generation: reset the slot, then RELEASED/QUARANTINED.
    Reset,
}
impl State {
    pub fn cancel(&mut self, m: &Message) -> io::Result<Cancel> {
        if m.id != 0 || !m.bytes.is_empty() {
            return Err(invalid("IPC cancel schema"));
        }
        if self.phase == Phase::Idle && m.generation == self.generation + 1 {
            self.generation = m.generation;
            Ok(Cancel::Unstarted)
        } else if m.generation == self.generation
            && matches!(self.phase, Phase::Running | Phase::Done)
        {
            self.phase = Phase::Resetting;
            Ok(Cancel::Reset)
        } else {
            Err(invalid("IPC cancel generation/state"))
        }
    }
    /// A Node START: the next generation of an idle slot, within the limits.
    /// Returns the admitted deadline and source.
    pub fn start(&mut self, m: &Message, now: u64, charge: u32) -> io::Result<(u64, String)> {
        if self.phase != Phase::Idle || m.generation != self.generation + 1 {
            return Err(invalid("IPC admission generation/state"));
        }
        let admitted = admission(m, now, charge)?;
        *self = State {
            generation: m.generation,
            phase: Phase::Running,
            ..State::default()
        };
        Ok(admitted)
    }
}
/// The START reservation of a snapshot class. IPC serves both JS classes:
/// glue-2m (the default) and glue-4m (larger values; Node selects it with
/// JITK_SHARD_CLASS). Every START must carry exactly this charge.
pub fn ipc_charge(class: crate::arena::Class) -> u32 {
    class.admission_bytes()
}
pub fn admission(m: &Message, now: u64, charge: u32) -> io::Result<(u64, String)> {
    let b = &m.bytes;
    if m.id != 0 || b.len() < wire::START_HEADER_BYTES {
        return Err(invalid("IPC admission header"));
    }
    let deadline = u64_at(b, 0);
    if deadline > now.saturating_add(wire::DEADLINE_HORIZON_NS)
        || u32_at(b, 8) as usize != ring::MAX_CALLS
        || u32_at(b, 12) as usize != ring::CALL_BYTES
        || u32_at(b, 20) != charge
    {
        return Err(invalid("IPC admission limits/deadline"));
    }
    let n = u32_at(b, 16) as usize;
    let source = &b[wire::START_HEADER_BYTES..];
    if n > ring::SOURCE_LIMIT || source.len() != n {
        return Err(invalid("IPC source bound/encoding"));
    }
    // UTF-8 text (the JS profile's run body, NUL, its data); opaque here.
    Ok((
        deadline,
        String::from_utf8(source.to_vec()).map_err(|_| invalid("IPC source UTF-8"))?,
    ))
}
/// The message ending a resetting generation: RELEASED, or QUARANTINED with
/// the reason when the reset took the slot out of service. Node then stops
/// counting the slot as capacity; a later message for it fails the service.
pub fn released(s: &mut State, slot: usize, quarantined: Option<String>) -> io::Result<Message> {
    if s.phase != Phase::Resetting {
        return Err(invalid("IPC unexpected reset"));
    }
    s.calls = Calls::default();
    let Some(why) = quarantined else {
        s.phase = Phase::Idle;
        return Ok(Message::new(RELEASED, slot, s.generation, 0, Vec::new()));
    };
    s.phase = Phase::Quarantined;
    let mut reason: Vec<u8> = why
        .bytes()
        .map(|b| if (0x20..0x7f).contains(&b) { b } else { b'?' })
        .collect();
    reason.truncate(wire::ERROR_BYTES);
    if reason.is_empty() {
        reason = b"quarantined".to_vec();
    }
    Ok(Message::new(QUARANTINED, slot, s.generation, 0, reason))
}
/// The STATS payload: owner CPU, stopped and reset-done times, then the
/// policy round trips (at most ring::MAX_CALLS).
pub fn stats(slot: usize, generation: u64, fixed: [u64; 3], round_trips: &[u64]) -> Message {
    let mut b = Vec::with_capacity(wire::STATS_FIXED_BYTES + 8 * round_trips.len());
    for n in [fixed[0], fixed[1], fixed[2], round_trips.len() as u64] {
        b.extend_from_slice(&n.to_le_bytes());
    }
    for n in round_trips {
        b.extend_from_slice(&n.to_le_bytes());
    }
    Message::new(STATS, slot, generation, 0, b)
}
pub fn enqueue(out: &mut VecDeque<Message>, m: Message) -> io::Result<()> {
    if out.len() >= wire::OUTBOUND {
        return Err(invalid("IPC outbound queue bound"));
    }
    out.push_back(m);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn ipc_charges_the_snapshot_class() {
        assert_eq!(ipc_charge(crate::arena::Class::Glue2m), 2 << 20);
        assert_eq!(ipc_charge(crate::arena::Class::Glue4m), 4 << 20);
        // A START charging another class than the snapshot's is refused.
        let mut m = Message::new(START, 0, 1, 0, vec![0; 24]);
        m.bytes[8..12].copy_from_slice(&(ring::MAX_CALLS as u32).to_le_bytes());
        m.bytes[12..16].copy_from_slice(&(ring::CALL_BYTES as u32).to_le_bytes());
        m.bytes[20..24].copy_from_slice(&(2u32 << 20).to_le_bytes());
        assert!(admission(&m, 0, 2 << 20).is_ok());
        assert!(admission(&m, 0, 4 << 20).is_err());
    }
    #[test]
    fn malformed_admissions() {
        let mut m = Message::new(START, 0, 1, 0, vec![0; 24]);
        assert!(admission(&m, 0, 2 << 20).is_err());
        m.bytes[0..8].copy_from_slice(&1u64.to_le_bytes());
        m.bytes[8..12].copy_from_slice(&(ring::MAX_CALLS as u32).to_le_bytes());
        m.bytes[12..16].copy_from_slice(&(ring::CALL_BYTES as u32).to_le_bytes());
        m.bytes[20..24].copy_from_slice(&(2u32 * 1024 * 1024).to_le_bytes());
        assert!(admission(&m, 0, 2 << 20).is_ok());
        // A source of SOURCE_LIMIT bytes takes several records and is admitted.
        let mut big = m.clone();
        big.bytes[16..20].copy_from_slice(&(ring::SOURCE_LIMIT as u32).to_le_bytes());
        big.bytes
            .extend(std::iter::repeat_n(b'x', ring::SOURCE_LIMIT));
        assert!(admission(&big, 0, 2 << 20).is_ok());
        big.bytes[16..20].copy_from_slice(&(ring::SOURCE_LIMIT as u32 + 1).to_le_bytes());
        big.bytes.push(b'x');
        assert!(admission(&big, 0, 2 << 20).is_err());
        m.bytes[16..20].copy_from_slice(&u32::MAX.to_le_bytes());
        assert!(admission(&m, 0, 2 << 20).is_err());
        m.bytes[16..20].fill(0);
        m.id = 1;
        assert!(admission(&m, 0, 2 << 20).is_err());
    }
    #[test]
    fn a_quarantined_reset_ends_its_slot() {
        let resetting = || {
            let mut calls = Calls::default();
            assert!(calls.issue(1, 0));
            State {
                generation: 5,
                phase: Phase::Resetting,
                calls,
                logs: 0,
            }
        };
        let mut s = resetting();
        let m = released(&mut s, 2, None).unwrap();
        assert_eq!(
            (m.kind, m.slot, m.generation, m.bytes.len()),
            (RELEASED, 2, 5, 0)
        );
        assert!(s.phase == Phase::Idle && s.calls.idle());
        // Only a resetting slot can be released.
        assert!(released(&mut s, 2, None).is_err());
        let mut s = resetting();
        let why = format!("reset failed: \u{1}{}", "x".repeat(600));
        let m = released(&mut s, 2, Some(why)).unwrap();
        assert_eq!((m.kind, m.generation), (QUARANTINED, 5));
        assert_eq!(m.bytes.len(), crate::constants::ipc::ERROR_BYTES);
        assert!(m.bytes.starts_with(b"reset failed: ?x"));
        assert!(s.phase == Phase::Quarantined);
        // Never released again: a later CANCEL/START for it is a Node bug.
        assert!(released(&mut s, 2, None).is_err());
        let mut s = resetting();
        assert_eq!(
            released(&mut s, 0, Some(String::new())).unwrap().bytes,
            b"quarantined"
        );
    }
    #[test]
    fn records_round_trip_and_reject_hostile_envelopes() {
        let m = Message::new(CALL, 3, 0x0102_0304_0506_0708, 7, b"[1]".to_vec());
        let b = m.encode().unwrap();
        assert_eq!(b.len(), HEADER_BYTES + 3);
        assert_eq!(Message::decode(&b).unwrap(), (m, false));
        // Truncated payload, oversized length, unknown flag, nonzero reserved
        // word, a MORE record that is not full.
        assert!(Message::decode(&b[..b.len() - 1]).is_err());
        let mut long = b.clone();
        long[20..24].copy_from_slice(&(PAYLOAD as u32 + 1).to_le_bytes());
        assert!(Message::decode(&long).is_err());
        for (at, value) in [(24, 2), (28, 1), (24, 1)] {
            let mut bad = b.clone();
            bad[at] = value;
            assert!(Message::decode(&bad).is_err(), "header byte {at}");
        }
        assert!(
            Message::new(CALL, 0, 1, 1, vec![0; MESSAGE_BYTES + 1])
                .encode()
                .is_err()
        );
    }
    #[test]
    fn messages_span_records() {
        let m = Message::new(
            REPLY,
            2,
            9,
            4,
            (0..2 * PAYLOAD + 5).map(|i| i as u8).collect(),
        );
        let records = m.records().unwrap();
        assert_eq!(records.len(), 3);
        let mut a = Assembler::default();
        for (i, r) in records.iter().enumerate() {
            let (record, more) = Message::decode(r).unwrap();
            assert_eq!(more, i < 2);
            let done = a.push(record, more).unwrap();
            assert_eq!(done.as_ref(), (i == 2).then_some(&m));
        }
        // A record of another message between two fragments is refused.
        let mut a = Assembler::default();
        let (first, more) = Message::decode(&records[0]).unwrap();
        assert!(a.push(first, more).unwrap().is_none());
        let other = Message::new(REPLY, 2, 9, 5, b"{}".to_vec());
        assert!(a.push(other, false).is_err());
        // An empty message is one record.
        assert_eq!(
            Message::new(CANCEL, 0, 1, 0, vec![])
                .records()
                .unwrap()
                .len(),
            1
        );
    }
    #[test]
    fn slot_state_machine() {
        let mut s = State::default();
        let mut start = Message::new(START, 0, 1, 0, vec![0; 24]);
        start.bytes[8..12].copy_from_slice(&(ring::MAX_CALLS as u32).to_le_bytes());
        start.bytes[12..16].copy_from_slice(&(ring::CALL_BYTES as u32).to_le_bytes());
        start.bytes[20..24].copy_from_slice(&(2u32 << 20).to_le_bytes());
        assert!(s.start(&start, 0, 2 << 20).is_ok());
        assert!(s.start(&start, 0, 2 << 20).is_err(), "replayed START");
        assert!(s.call(2, b"[]").is_err(), "call ids start at 1");
        assert!(s.call(1, b"[]").unwrap());
        let reply = Message::new(REPLY, 0, 1, 1, b"{}".to_vec());
        assert!(s.reply(&reply).unwrap());
        assert!(s.reply(&reply).is_err(), "duplicate reply");
        // Logs have their own budget and need no reply.
        for _ in 0..ring::MAX_LOGS {
            assert!(s.log(b"[\"log\",\"x\"]").unwrap());
        }
        assert!(s.log(b"[\"log\",\"x\"]").is_err(), "log budget");
        assert!(s.call(2, b"[]").unwrap());
        assert!(
            s.reply(&Message::new(REPLY, 0, 1, 2, b"{}".to_vec()))
                .unwrap()
        );
        assert!(s.complete().unwrap());
        assert!(s.complete().is_err(), "duplicate completion");
        let cancel = Message::new(CANCEL, 0, 1, 0, vec![]);
        assert_eq!(s.cancel(&cancel).unwrap(), Cancel::Reset);
        // While resetting, the guest's late events are dropped.
        assert!(!s.call(2, b"[]").unwrap());
        assert!(!s.complete().unwrap());
        released(&mut s, 0, None).unwrap();
        let next = Message::new(CANCEL, 0, 2, 0, vec![]);
        assert_eq!(s.cancel(&next).unwrap(), Cancel::Unstarted);
        assert!(s.cancel(&next).is_err());
    }
}
