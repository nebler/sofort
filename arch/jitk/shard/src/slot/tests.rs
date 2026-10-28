//! The slot's ring, run-exit and reset state machines over a fake backend:
//! no hypervisor, so these run on every host (`cargo test`).
use super::{RAM, REQUEST, Request, ResetPolicy, RunError, Slot};
use crate::arena;
use crate::constants::ring;
use crate::hv::{ArchState, Exit, Memory, Vcpu, Vm};
use crate::slot::reset::ResetReport;
use crate::snapshot::{Reference, Snapshot};
use std::{collections::VecDeque, fs::File, io, ptr, sync::Arc};

/// Registers: a word vector the fake vCPU holds.
#[derive(Clone, Debug, PartialEq)]
struct Regs(Vec<u64>);
impl ArchState for Regs {
    fn decode(b: &[u8]) -> io::Result<Self> {
        Ok(Self(
            b.chunks_exact(8)
                .map(|w| u64::from_le_bytes(w.try_into().unwrap()))
                .collect(),
        ))
    }
    fn encode(&self) -> Vec<u8> {
        self.0.iter().flat_map(|w| w.to_le_bytes()).collect()
    }
}
/// Guest RAM writes (offset, bytes) a scripted run makes before its exit.
type Writes = Vec<(usize, Vec<u8>)>;
/// A vCPU that replays scripted exits; each `run` may first write guest RAM.
struct FakeVcpu {
    regs: Regs,
    script: VecDeque<(Writes, Exit)>,
    ram: *mut u8,
    fail_reset: bool,
}
impl Vcpu for FakeVcpu {
    type State = Regs;
    fn save(&self) -> io::Result<Regs> {
        Ok(self.regs.clone())
    }
    fn load(&mut self, s: &Regs) -> io::Result<()> {
        if s.0.len() != 4 {
            return Err(io::Error::other("register set differs"));
        }
        self.regs = s.clone();
        Ok(())
    }
    fn reset(&mut self, s: &Regs) -> io::Result<()> {
        if self.fail_reset {
            return Err(io::Error::other("rejected"));
        }
        self.regs = s.clone();
        Ok(())
    }
    fn mismatches(&self, s: &Regs) -> Vec<u64> {
        (0..4)
            .filter(|&i| self.regs.0[i] != s.0[i])
            .map(|i| i as u64 + 1)
            .collect()
    }
    fn run(&mut self) -> io::Result<Exit> {
        let (writes, exit) = self.script.pop_front().expect("script exhausted");
        for (off, bytes) in writes {
            // SAFETY: test writes inside the slot's live RAM mapping, as a guest would.
            unsafe { ptr::copy_nonoverlapping(bytes.as_ptr(), self.ram.add(off), bytes.len()) };
        }
        self.regs.0[0] += 1; // the guest moved
        Ok(exit)
    }
    fn set_entry(&mut self, pc: u64) -> io::Result<()> {
        self.regs.0[1] = pc;
        Ok(())
    }
    fn redirect(&mut self, pc: u64, _: u64, _: u64) -> io::Result<()> {
        self.regs.0[1] = pc;
        Ok(())
    }
}
#[derive(Default)]
struct FakeVm {
    ram: Option<*mut u8>,
    copies: usize,
}
impl Vm for FakeVm {
    type Vcpu = FakeVcpu;
    unsafe fn map(
        &mut self,
        gpa: u64,
        host: *mut u8,
        _: usize,
        _: crate::hv::Region,
    ) -> io::Result<()> {
        if gpa == ring::RAM_GPA {
            self.ram = Some(host);
        }
        Ok(())
    }
    fn vcpu(&mut self) -> io::Result<FakeVcpu> {
        Ok(FakeVcpu {
            regs: Regs(vec![0; 4]),
            script: VecDeque::new(),
            ram: self.ram.unwrap(),
            fail_reset: false,
        })
    }
    /// Copy both writable extents from the snapshot view (no cache question).
    fn restore_memory(&mut self, m: &Memory<'_, Regs>) -> io::Result<ResetReport> {
        for (start, end) in m.writable() {
            // SAFETY: both views are RAM-sized; extents lie within them.
            unsafe {
                ptr::copy_nonoverlapping(
                    m.snapshot.reference.ptr().add(start),
                    m.ram.ptr.add(start),
                    end - start,
                )
            };
        }
        self.copies += 1;
        m.resident.set(true);
        Ok(ResetReport::default())
    }
    fn discard_memory(&mut self, m: &Memory<'_, Regs>) -> io::Result<()> {
        m.resident.set(false);
        Ok(())
    }
}

/// A RAM-sized, unlinked snapshot file: zeros, a recognisable kernel page, the
/// glue-2m layout record.
fn snapshot() -> Arc<Snapshot<Regs>> {
    use std::os::unix::fs::FileExt;
    let path = std::env::temp_dir().join(format!(
        "jitk-slot-test-{}-{:?}",
        std::process::id(),
        std::thread::current().id()
    ));
    let f = File::options()
        .read(true)
        .write(true)
        .create(true)
        .truncate(true)
        .open(&path)
        .unwrap();
    std::fs::remove_file(&path).unwrap();
    f.set_len(RAM as u64).unwrap();
    f.write_all_at(&[0x5a; 4096], 0).unwrap();
    f.write_all_at(&arena::Class::Glue2m.layout_bytes(), 4096)
        .unwrap();
    f.write_all_at(&[0x11; 64], (arena::Class::Glue2m.start() + 8192) as u64)
        .unwrap();
    Arc::new(Snapshot {
        reference: Reference::map(&f).unwrap(),
        memory: f,
        class: arena::Class::Glue2m,
        regs: Regs(vec![7, 8, 9, 10]),
    })
}
fn fixture(policy: ResetPolicy) -> Slot<FakeVm> {
    Slot::create(FakeVm::default(), snapshot(), policy).unwrap()
}
/// A slot with no snapshot, for the decoder: generation 2, nothing bound.
fn slot() -> Slot<FakeVm> {
    let s = fixture(ResetPolicy::default());
    let mut s = Slot::with(s.vm, s.vcpu, s.ram, None);
    s.generation = 2;
    s
}
fn record(s: &Slot<FakeVm>, kind: u16, id: u64, payload: &[u8]) {
    let len = (32 + payload.len() + 7) & !7;
    let mut b = vec![0; len];
    b[..4].copy_from_slice(&(len as u32).to_le_bytes());
    b[4..6].copy_from_slice(&kind.to_le_bytes());
    b[6..8].copy_from_slice(&ring::JSON_UTF8.to_le_bytes());
    b[8..16].copy_from_slice(&2u64.to_le_bytes());
    b[16..24].copy_from_slice(&id.to_le_bytes());
    b[24..28].copy_from_slice(&(payload.len() as u32).to_le_bytes());
    b[28..32].copy_from_slice(&(if kind == 1 { 1u32 } else { 0 }).to_le_bytes());
    b[32..32 + payload.len()].copy_from_slice(payload);
    s.copy(REQUEST, &b);
    s.store(ring::TX_PRODUCER, len as u64);
}

#[test]
fn guest_ram_reads_are_owned_copies() {
    let s = slot();
    s.copy(0x1800000, &[1, 2, 3, 4]);
    let saved = s.bytes(0x1800000, 4);
    s.copy(0x1800000, &[5, 6, 7, 8]);
    assert_eq!(&saved[..], &[1, 2, 3, 4]);
    assert_eq!(&s.bytes(0x1800000, 4)[..], &[5, 6, 7, 8]);
}
#[test]
fn malformed_guest_records_are_run_errors() {
    for op in [0, 6, u32::MAX] {
        assert!(matches!(
            slot().decode_exit(op),
            Err(RunError::GuestProtocol(_))
        ));
    }
    let mut s = slot();
    record(&s, 5, 0, b"\xff");
    assert!(matches!(
        s.decode_exit(3),
        Err(RunError::GuestProtocol("completion bytes"))
    ));
    // Shared Node/shard corpus through the real decoder: only "shard" rows
    // stop here, as slot-scoped guest errors. Everything else is opaque.
    for (kind, name, outcome, payload) in crate::payload::tests::corpus() {
        let mut s = slot();
        record(&s, kind, u64::from(kind == ring::CALL), &payload);
        let op = if kind == ring::CALL {
            ring::SUBMIT
        } else {
            ring::FINISH
        };
        match s.decode_exit(op) {
            Ok(_) => assert_ne!(outcome, "shard", "{name}"),
            Err(RunError::GuestProtocol(_)) => assert_eq!(outcome, "shard", "{name}"),
            Err(e) => panic!("{name}: {e}"),
        }
    }
    for cursor in [1, 8, 32776, u64::MAX] {
        let mut s = slot();
        s.store(ring::TX_PRODUCER, cursor);
        assert!(s.decode_exit(1).is_err());
    }
    for (kind, id, payload) in [
        (1, 0, &b"[]"[..]),
        (1, 33, &b"[]"[..]),
        (1, 2, &b"[]"[..]),
        (1, 1, &b"[\x01]"[..]),
        (1, 1, &b"[\xff]"[..]),
        (5, 0, &b"\xff"[..]),
        (99, 0, &b""[..]),
    ] {
        let mut s = slot();
        record(&s, kind, id, payload);
        assert!(s.decode_exit(1).is_err());
    }
    for (at, value) in [
        (0, 0),
        (0, 255),
        (6, 2),
        (8, 9),
        (24, 255),
        (28, 2),
        (39, 1),
    ] {
        let mut s = slot();
        record(&s, 1, 1, b"[]");
        s.copy(REQUEST + at, &[value]);
        assert!(s.decode_exit(1).is_err(), "header/padding byte {at}");
    }
}
#[test]
fn reply_notifications_use_host_shadow_not_guest_counter() {
    let mut s = slot();
    s.seen = 1;
    s.store(ring::HOST_EPOCH, u64::MAX);
    s.reply(&Request {
        id: 1,
        bytes: b"[]".to_vec(),
    })
    .unwrap();
    assert_eq!(s.load(ring::HOST_EPOCH), 1);
}
#[test]
fn guest_reply_credit_is_checked() {
    let mut s = slot();
    s.store(ring::RX_CONSUMER, u64::MAX);
    assert!(
        s.reply(&Request {
            id: 1,
            bytes: b"[]".to_vec()
        })
        .is_err()
    );
}
/// Every backend exit maps to one slot outcome; kicks are retried.
#[test]
fn exits_map_to_run_outcomes() {
    let verify = ResetPolicy {
        verify: true,
        ..ResetPolicy::default()
    };
    let mut s = fixture(verify);
    let mut entropy = &[0u8; 16][..];
    s.bind(2, "return 2", &mut entropy);
    let done = |s: &Slot<FakeVm>| {
        let payload = b"{\"ok\":2}";
        let len = ring::record_len(payload.len());
        let h = ring::RecordHeader {
            len: len as u32,
            kind: ring::DONE,
            flags: ring::JSON_UTF8,
            generation: s.generation,
            id: 0,
            n: payload.len() as u32,
            cap: 0,
        };
        let mut b = h.encode().to_vec();
        b.extend_from_slice(payload);
        b.resize(len, 0);
        vec![
            (REQUEST, b),
            (
                super::CTRL + ring::TX_PRODUCER,
                (len as u64).to_le_bytes().to_vec(),
            ),
        ]
    };
    s.vcpu.script.extend([
        (vec![], Exit::Interrupted),
        (done(&s), Exit::Doorbell(ring::FINISH)),
    ]);
    assert!(matches!(s.try_exit(), Ok(None)));
    let step = s.exit().unwrap();
    assert_eq!(
        (step.op, step.finish.as_deref()),
        (ring::FINISH, Some("{\"ok\":2}"))
    );
    assert_eq!(s.exits, 1);
    for (exit, outcome) in [
        (
            Exit::Fault { gpa: 0x8000_0000 },
            "memory_bound: write outside class arena at 0x80000000",
        ),
        (Exit::BadDoorbell, "guest_protocol: invalid doorbell access"),
        (
            Exit::Shutdown(0x8400_0008),
            "guest_protocol: vCPU powered off",
        ),
        (
            Exit::Other("unexpected KVM exit"),
            "guest_protocol: unexpected KVM exit",
        ),
        (Exit::Expired { deadline_ns: 5 }, "deadline_exceeded"),
    ] {
        s.reset().unwrap(); // verify: RAM and registers back to the snapshot
        assert!(s.is_pristine() && s.register_mismatches().is_empty());
        s.vcpu
            .script
            .push_back((vec![(arena::Class::Glue2m.start(), vec![0xee; 4096])], exit));
        assert_eq!(s.try_exit().err().unwrap().to_string(), outcome);
        assert!(!s.is_pristine() && !s.writable_pristine());
    }
    assert_eq!(s.vm.copies, 5);
}
/// A reset the backend rejects quarantines the slot for good; a host write
/// behind the flag's back is caught by the sampled admission check.
#[test]
fn failed_resets_quarantine_and_sampled_checks_repair() {
    let mut s = fixture(ResetPolicy {
        sample_every: 1,
        ..ResetPolicy::default()
    });
    assert!(s.admit().unwrap().is_none() && s.content_mismatch().is_none());
    // SAFETY: test-only write into the writable arena of a stopped slot.
    unsafe {
        s.ram
            .ptr
            .add(arena::Class::Glue2m.start())
            .write_volatile(1)
    };
    assert!(s.is_pristine() && s.content_mismatch().is_some());
    s.admit().unwrap(); // sampled: found, reset, re-checked
    assert!(s.content_mismatch().is_none());
    s.vcpu.fail_reset = true;
    s.copy(arena::Class::Glue2m.start(), &[2]);
    assert!(s.reset().is_err() && s.is_quarantined() && !s.is_pristine());
    s.vcpu.fail_reset = false;
    assert!(s.reset().is_err() && s.admit().is_err());
}
/// A vCPU whose register set differs from the snapshot's is refused.
#[test]
fn register_set_mismatch_refuses_the_slot() {
    let mut snap = Arc::into_inner(snapshot()).unwrap();
    snap.regs = Regs(vec![1, 2, 3]);
    let e = Slot::create(FakeVm::default(), Arc::new(snap), ResetPolicy::default())
        .err()
        .unwrap();
    assert_eq!(e.to_string(), "register set differs");
}
#[test]
fn writable_extents_are_the_class_arena_and_transport() {
    for class in arena::Class::ALL {
        let w: Vec<_> = super::writable(class).collect();
        assert_eq!(
            w,
            [
                (class.start(), class.end()),
                (super::CTRL, super::CTRL + arena::RING_BYTES)
            ]
        );
    }
}
