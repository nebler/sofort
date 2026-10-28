//! Hypervisor-neutral slot: guest RAM over a snapshot's memory classes, the
//! bind header, the ring record decoder and reply path, and (reset.rs) reset,
//! admission checks and verification. Generic over `hv::Vm`; the KVM and HVF
//! specifics live behind it (`kvm`, `hvf`).
pub mod reset;
#[cfg(test)]
mod tests;

pub use crate::clock::monotonic_ns;
use crate::constants::ring::{self, RecordHeader};
use crate::hv::{Exit, Region, Vcpu, Vm};
use crate::{arena, memory::Mapping, snapshot::Snapshot};
pub use reset::{
    Discard, QUARANTINED, Quarantined, ResetPolicy, ResetReport, SAMPLE_FAILURES, SAMPLED,
};
use std::{
    cell::Cell,
    fs::File,
    io::{self, Read},
    ptr,
    sync::{
        Arc,
        atomic::{
            AtomicU64,
            Ordering::{Acquire, Release},
        },
    },
    time::{Instant, SystemTime, UNIX_EPOCH},
};
pub const RAM: usize = ring::RAM_BYTES;
pub const CTRL: usize = ring::CONTROL;
pub const REQUEST: usize = ring::TX;
pub const REPLY: usize = ring::RX;

/// The register file type of a backend's vCPU.
pub type State<V> = <<V as Vm>::Vcpu as Vcpu>::State;

pub struct Request {
    pub id: u64,
    pub bytes: Vec<u8>,
}
#[derive(Debug)]
pub enum RunError {
    MemoryBound {
        address: u64,
    },
    GuestFatal,
    /// The slot was quarantined after a failed reset; it never runs again.
    SlotUnavailable,
    GuestProtocol(&'static str),
    Deadline {
        deadline_ns: u64,
    },
}
impl std::fmt::Display for RunError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::MemoryBound { address } => {
                write!(f, "memory_bound: write outside class arena at {address:#x}")
            }
            Self::Deadline { .. } => write!(f, "deadline_exceeded"),
            Self::GuestProtocol(message) => write!(f, "guest_protocol: {message}"),
            Self::GuestFatal => write!(f, "guest_fatal: guest stopped without a completion"),
            Self::SlotUnavailable => {
                write!(f, "slot_unavailable: quarantined after a failed reset")
            }
        }
    }
}
/// One doorbell's decoded TX records.
pub struct Step {
    pub op: u32,
    pub requests: Vec<Request>,
    pub finish: Option<String>,
}
/// The writable extents of `class` (arena, transport) as RAM offsets.
pub fn writable(class: arena::Class) -> impl Iterator<Item = (usize, usize)> {
    class
        .regions(RAM, CTRL)
        .into_iter()
        .filter(|r| r.2)
        .map(|(start, end, _)| (start, end))
}

pub struct Slot<V: Vm> {
    // Drop order: the vCPU (KVM completes pending MMIO), its VM, then RAM.
    pub(crate) vcpu: V::Vcpu,
    pub(crate) vm: V,
    pub(crate) ram: Mapping,
    pub(crate) snapshot: Option<Arc<Snapshot<State<V>>>>,
    pub generation: u64,
    tx: usize,
    rx: usize,
    rx_consumed: usize,
    seen: u32,
    replied: u32,
    pub exits: u64,
    policy: ResetPolicy,
    /// The pristine invariant (reset.rs) holds. Cleared by every host write to
    /// guest RAM or registers and before every run; set only at the end of
    /// `reset` and by `create`. `bind` requires it.
    pristine: Cell<bool>,
    /// RAM may hold private pages: set with every RAM write or run, cleared by
    /// a discard. Only selects idle trimming; never trusted for correctness.
    resident: Cell<bool>,
    reset_at: Instant,
    /// Why a failed reset or content check took this slot out of service.
    quarantined: Option<String>,
    /// Admissions so far: every policy.sample_every-th is content-checked.
    admits: u64,
}
impl<V: Vm> Slot<V> {
    fn with(vm: V, vcpu: V::Vcpu, ram: Mapping, snapshot: Option<Arc<Snapshot<State<V>>>>) -> Self {
        Self {
            vcpu,
            vm,
            ram,
            snapshot,
            generation: 0,
            tx: 0,
            rx: 0,
            rx_consumed: 0,
            seen: 0,
            replied: 0,
            exits: 0,
            policy: ResetPolicy::default(),
            pristine: Cell::new(false),
            resident: Cell::new(false),
            reset_at: Instant::now(),
            quarantined: None,
            admits: 0,
        }
    }
    /// An unpartitioned, all-writable boot VM over a fresh image file, for
    /// trusted offline snapshot preparation.
    pub fn boot_on(mut vm: V, image: &File) -> io::Result<Self> {
        let ram = Mapping::map(image, RAM, libc::MAP_PRIVATE)?;
        // SAFETY: the RAM mapping moves into the slot, which drops it after
        // the VM; RAM_GPA and RAM are page aligned.
        unsafe { vm.map(ring::RAM_GPA, ram.ptr, RAM, Region::Boot)? };
        let mut vcpu = vm.vcpu()?;
        vcpu.set_entry(ring::RAM_GPA)?;
        let slot = Self::with(vm, vcpu, ram, None);
        slot.pristine.set(true); // fresh boot image: no tenant has run here
        Ok(slot)
    }
    /// A slot over a prepared snapshot: `MAP_PRIVATE` RAM whose immutable
    /// extents are read-only on the host and in the VM, and a vCPU holding the
    /// snapshot's registers. Fails when the vCPU's register set is not the
    /// snapshot's (`Vcpu::load`).
    pub fn create(
        mut vm: V,
        snapshot: Arc<Snapshot<State<V>>>,
        policy: ResetPolicy,
    ) -> io::Result<Self> {
        let ram = Mapping::map(&snapshot.memory, RAM, libc::MAP_PRIVATE)?;
        for (start, end, writable) in snapshot.class.regions(RAM, CTRL) {
            let kind = if writable {
                Region::Writable
            } else {
                Region::Immutable
            };
            // SAFETY: a page-aligned extent of the RAM mapping, which the slot
            // drops after the VM.
            unsafe {
                vm.map(
                    ring::RAM_GPA + start as u64,
                    ram.ptr.add(start),
                    end - start,
                    kind,
                )?
            };
            if !writable {
                // SAFETY: the catalogue selects a page-aligned extent within this
                // live RAM mapping; no vCPU has started.
                if unsafe {
                    libc::mprotect(ram.ptr.add(start).cast(), end - start, libc::PROT_READ)
                } != 0
                {
                    return Err(io::Error::other(format!(
                        "mprotect immutable RAM: {}",
                        io::Error::last_os_error()
                    )));
                }
            }
        }
        let mut vcpu = vm.vcpu()?;
        vcpu.load(&snapshot.regs)?;
        let mut s = Self::with(vm, vcpu, ram, Some(snapshot));
        s.policy = policy;
        // A fresh MAP_PRIVATE mapping reads as the file and no vCPU has run.
        s.pristine.set(true);
        Ok(s)
    }
    pub fn snapshot(&self) -> &Snapshot<State<V>> {
        self.snapshot.as_ref().expect("slot without a snapshot")
    }
    /// The backend vCPU (HVF: its `Kicker`; offline preparation: `save`).
    pub fn vcpu(&self) -> &V::Vcpu {
        &self.vcpu
    }
    /// Any host write to guest RAM: the slot is no longer pristine.
    pub(crate) fn wrote_ram(&self) {
        self.pristine.set(false);
        self.resident.set(true);
    }
    pub fn drain(&mut self) {
        self.shutdown().expect("stopped vCPU MMIO drain");
    }
    /// Complete a half-done exit before teardown or reset. The caller owns a
    /// stopped vCPU.
    pub fn shutdown(&mut self) -> io::Result<()> {
        if self.vcpu.unsettled() {
            self.pristine.set(false); // completing the MMIO advances the guest PC
            self.vcpu.settle()?;
        }
        Ok(())
    }
    pub fn corrupt_canary(&self, v: u64) {
        self.wrote_ram();
        self.ram.put(self.snapshot().class.canary(), v);
    }
    pub fn canary(&self) -> u64 {
        self.ram.word(self.snapshot().class.canary())
    }
    fn atomic(&self, off: usize) -> &AtomicU64 {
        assert!(
            off.is_multiple_of(8)
                && off
                    .checked_add(8)
                    .is_some_and(|end| end <= arena::RING_BYTES)
        );
        // SAFETY: mmap is page aligned; the checked control word is aligned and
        // live. Only atomic host accesses are exposed, never a RAM slice.
        unsafe { &*self.ram.ptr.add(CTRL + off).cast() }
    }
    pub(crate) fn load(&self, off: usize) -> u64 {
        self.atomic(off).load(Acquire)
    }
    pub(crate) fn store(&self, off: usize, v: u64) {
        self.wrote_ram();
        self.atomic(off).store(v, Release);
    }
    /// Copy stopped guest RAM; callers never borrow the underlying mapping.
    pub fn bytes(&self, off: usize, n: usize) -> Vec<u8> {
        assert!(off.checked_add(n).is_some_and(|end| end <= RAM));
        (off..off + n)
            .map(|at| {
                // SAFETY: range is checked above; Slot is owner-thread-only, the
                // vCPU is stopped, and the returned Vec owns each copied byte.
                unsafe { self.ram.ptr.add(at).read_volatile() }
            })
            .collect()
    }
    pub(crate) fn copy(&self, off: usize, b: &[u8]) {
        assert!(off.checked_add(b.len()).is_some_and(|end| end <= RAM));
        self.wrote_ram();
        // SAFETY: b owns/borrows host memory, never this mapping. Bounds are
        // checked; only this stopped slot's owner writes its writable RAM.
        unsafe {
            ptr::copy_nonoverlapping(b.as_ptr(), self.ram.ptr.add(off), b.len());
        }
    }
    pub fn bind(&mut self, generation: u64, source: &str, entropy: &mut impl Read) -> [u8; 16] {
        assert!(generation > self.generation && source.len() <= ring::SOURCE_LIMIT);
        // The one gate between tenants: no run binds to a slot a previous run,
        // or any host write since the last reset, has touched.
        assert!(self.pristine.get(), "bind requires a pristine slot");
        self.generation = generation;
        self.store(0, ring::JS_VERSION);
        self.store(ring::GENERATION, generation);
        self.store(
            ring::RING_LIMITS,
            ring::RING_BYTES as u64 | ((ring::RECORD_BYTES as u64) << 32),
        );
        self.store(
            ring::CALL_LIMITS,
            ring::MAX_CALLS as u64 | ((ring::RING_BYTES as u64) << 32),
        );
        let mut seed = [0u8; 16];
        entropy.read_exact(&mut seed).unwrap();
        self.copy(CTRL + ring::SEED, &seed);
        self.store(
            ring::EPOCH_NS,
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos() as u64,
        );
        self.store(ring::MONOTONIC_NS, monotonic_ns());
        self.store(ring::SOURCE_BYTES, source.len() as u64);
        self.copy(CTRL + ring::SOURCE_OFFSET, source.as_bytes());
        seed
    }
    fn ring_copy(&self, base: usize, cursor: usize, n: usize) -> Vec<u8> {
        (0..n)
            .map(|i| {
                // SAFETY: fixed ring geometry is within RAM; the vCPU is stopped.
                unsafe {
                    self.ram
                        .ptr
                        .add(base + (cursor + i) % ring::RING_BYTES)
                        .read_volatile()
                }
            })
            .collect()
    }
    /// Install a stopped EL1 entry in the writable arena with MMU disabled.
    /// Used by offline fault probes; this contains no fixture payload.
    pub fn redirect_entry(&mut self, code: &[u8]) {
        let class = self.snapshot().class;
        self.copy(class.canary(), code);
        let gpa = |off: usize| ring::RAM_GPA + off as u64;
        let host = self.ram.ptr.wrapping_add(class.canary());
        self.vm
            .executable(gpa(class.canary()), host, jitk_abi::arena::CANARY_BYTES)
            .expect("executable fixture page");
        self.vcpu
            .redirect(gpa(class.canary()), gpa(class.start()), gpa(class.end()))
            .expect("redirect entry");
    }
    pub fn exit(&mut self) -> Result<Step, RunError> {
        loop {
            if let Some(e) = self.try_exit()? {
                return Ok(e);
            }
        }
    }
    /// Run to the next doorbell and decode its records. None: interrupted by
    /// a kick (KVM: another slot's expiry); the owner calls again.
    pub fn try_exit(&mut self) -> Result<Option<Step>, RunError> {
        self.store(ring::MONOTONIC_NS, monotonic_ns());
        self.wrote_ram(); // the guest may write RAM and registers
        match self.vcpu.run().expect("vCPU run") {
            Exit::Doorbell(op) => {
                self.exits += 1;
                self.decode_exit(op)
            }
            Exit::Interrupted => Ok(None),
            Exit::Expired { deadline_ns } => Err(RunError::Deadline { deadline_ns }),
            Exit::Fault { gpa } => Err(RunError::MemoryBound { address: gpa }),
            Exit::BadDoorbell => Err(RunError::GuestProtocol("invalid doorbell access")),
            Exit::Shutdown(_) => Err(RunError::GuestProtocol("vCPU powered off")),
            Exit::Other(what) => Err(RunError::GuestProtocol(what)),
        }
    }
    pub(crate) fn decode_exit(&mut self, op: u32) -> Result<Option<Step>, RunError> {
        if !(ring::SUBMIT..=ring::REPAIRED_READY).contains(&op) {
            return Err(RunError::GuestProtocol("unknown doorbell"));
        }
        let prod = self.load(ring::TX_PRODUCER) as usize;
        if prod < self.tx || prod - self.tx > ring::RING_BYTES || !prod.is_multiple_of(8) {
            return Err(RunError::GuestProtocol("TX cursor"));
        }
        let mut requests = Vec::new();
        let mut finish = None;
        while self.tx < prod {
            if prod - self.tx < ring::HEADER_BYTES {
                return Err(RunError::GuestProtocol("truncated TX header"));
            }
            // The copy has the fixed, host-selected header length, so the conversion
            // cannot fail; guest values are validated before indexing the payload.
            let h = RecordHeader::decode(
                &self
                    .ring_copy(REQUEST, self.tx, ring::HEADER_BYTES)
                    .try_into()
                    .unwrap(),
            );
            if !h.framed(prod - self.tx)
                || h.flags != ring::JSON_UTF8
                || h.generation != self.generation
            {
                return Err(RunError::GuestProtocol("TX record header"));
            }
            let (len, kind, id, n, cap) = (h.len as usize, h.kind, h.id, h.n as usize, h.cap);
            // Copy once, then validate/use this owner-private copy.
            let mut payload = self.ring_copy(
                REQUEST,
                self.tx + ring::HEADER_BYTES,
                len - ring::HEADER_BYTES,
            );
            if payload[n..].iter().any(|b| *b != 0) {
                return Err(RunError::GuestProtocol("nonzero TX padding"));
            }
            payload.truncate(n);
            match kind {
                ring::CALL => {
                    if !(1..=ring::MAX_CALLS as u64).contains(&id)
                        || id != u64::from(self.seen.count_ones()) + 1
                        || cap != ring::CALL_CAP
                        || !crate::payload::forwarded(ring::CALL, &payload)
                    {
                        return Err(RunError::GuestProtocol("call identity/schema"));
                    }
                    self.seen |= 1u32 << (id - 1);
                    requests.push(Request { id, bytes: payload });
                }
                ring::DONE => {
                    if id != 0
                        || cap != 0
                        || finish.is_some()
                        || op != ring::FINISH
                        || self.tx + len != prod
                    {
                        return Err(RunError::GuestProtocol("completion identity/order"));
                    }
                    if !crate::payload::forwarded(ring::DONE, &payload) {
                        return Err(RunError::GuestProtocol("completion bytes"));
                    }
                    finish = Some(payload.into_iter().map(char::from).collect());
                }
                ring::LOG => {
                    if id != 0 || cap != 0 {
                        return Err(RunError::GuestProtocol("log identity"));
                    }
                    eprintln!("guest: {}", String::from_utf8_lossy(&payload));
                }
                _ => return Err(RunError::GuestProtocol("unknown TX kind")),
            }
            self.tx += len;
        }
        self.store(ring::TX_CONSUMER, self.tx as u64);
        if op == ring::FINISH {
            if finish.is_none() {
                return Err(RunError::GuestFatal);
            }
            if self.seen != self.replied || !requests.is_empty() {
                return Err(RunError::GuestProtocol("completion with outstanding calls"));
            }
        }
        Ok(Some(Step {
            op,
            requests,
            finish,
        }))
    }
    pub fn reply(&mut self, r: &Request) -> Result<(), RunError> {
        let cons = self.load(ring::RX_CONSUMER) as usize;
        if cons < self.rx_consumed || cons > self.rx || !cons.is_multiple_of(8) {
            return Err(RunError::GuestProtocol("RX consumer cursor"));
        }
        self.rx_consumed = cons;
        let n = r.bytes.len();
        let len = ring::record_len(n);
        if self.rx - cons + len > ring::RING_BYTES {
            return Err(RunError::GuestProtocol("RX credit exhausted"));
        }
        // The trusted broker/fixture must answer a previously decoded request once.
        assert!((1..=ring::MAX_CALLS as u64).contains(&r.id) && n <= ring::REPLY_BYTES);
        let bit = 1u32 << (r.id - 1);
        assert_eq!(self.replied & bit, 0);
        assert_ne!(self.seen & bit, 0);
        let mut b = vec![0u8; len];
        let h = RecordHeader {
            len: len as u32,
            kind: ring::RET,
            flags: ring::JSON_UTF8,
            generation: self.generation,
            id: r.id,
            n: n as u32,
            cap: ring::CALL_CAP,
        };
        b[..ring::HEADER_BYTES].copy_from_slice(&h.encode());
        b[ring::HEADER_BYTES..ring::HEADER_BYTES + n].copy_from_slice(&r.bytes);
        for (i, x) in b.iter().enumerate() {
            self.copy(REPLY + (self.rx + i) % ring::RING_BYTES, &[*x]);
        }
        self.rx += len;
        self.replied |= bit;
        self.store(ring::RX_PRODUCER, self.rx as u64);
        self.store(ring::HOST_EPOCH, u64::from(self.replied.count_ones()));
        self.store(ring::REPLY_READY, 1);
        Ok(())
    }
    pub fn pause_after_repair(&self) {
        self.store(ring::SAMPLE_READY, 1);
    }
    pub fn repaired(&self) -> bool {
        self.load(ring::REPAIRED_GENERATION) == self.generation
    }
}

/// EL1 fixtures from guest/reset-attack.S for the reset tests (on macOS, the
/// Mach-O copy build.rs writes; the instructions are the same bytes).
#[cfg(test)]
pub(crate) mod test_guest {
    /// A slot bound with this generation has its next reset rejected by the
    /// hypervisor (`Vcpu::test_reject`).
    pub const FAIL_RESET_GENERATION: u64 = 0x5eed_0000_0000;
    #[cfg(not(target_os = "macos"))]
    core::arch::global_asm!(include_str!("../../guest/reset-attack.S"));
    #[cfg(target_os = "macos")]
    core::arch::global_asm!(include_str!(concat!(env!("OUT_DIR"), "/reset-attack.S")));
    macro_rules! fixture {
        ($name:ident, $start:ident, $end:ident) => {
            pub fn $name() -> &'static [u8] {
                // SAFETY: the included assembly exports these byte-address labels
                // around read-only payloads; Rust never owns them.
                unsafe extern "C" {
                    static $start: u8;
                    static $end: u8;
                }
                let (start, end) = (std::ptr::addr_of!($start), std::ptr::addr_of!($end));
                // SAFETY: each label pair encloses one fixture in one read-only
                // section that lives for the whole test binary.
                unsafe { std::slice::from_raw_parts(start, end as usize - start as usize) }
            }
        };
    }
    fixture!(fill, jitk_reset_fill_start, jitk_reset_fill_end);
    fixture!(probe, jitk_reset_probe_start, jitk_reset_probe_end);
    fixture!(cpu_off, jitk_reset_cpu_off_start, jitk_reset_cpu_off_end);
    fixture!(
        system_off,
        jitk_reset_system_off_start,
        jitk_reset_system_off_end
    );
}
