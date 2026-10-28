pub mod native;
pub use crate::clock::{clock_ns, monotonic_ns};
use crate::constants::ring::RecordHeader;
use crate::snapshot::Register;
pub use crate::snapshot::Snapshot;
use crate::{
    arena,
    constants::{kvm::*, ring},
    lease,
};
use std::{
    cell::Cell,
    fs::File,
    io::{self, Read},
    os::fd::{AsRawFd, FromRawFd},
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

mod platform;
mod reset;
use libc::{ioctl, mprotect};
pub use platform::{Kvm, raise_fds};
use platform::{Mapping, OneReg, Region, call, check, try_call};
pub use reset::{
    Discard, QUARANTINED, Quarantined, ResetPolicy, ResetReport, SAMPLE_FAILURES, SAMPLED,
};

/// `JITK_SHARD_DIAGNOSTICS` set: print JS-profile guest LOG records to stderr
/// (offline debugging; Node starts the shard without it).
fn diagnostics() -> bool {
    static ON: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
    *ON.get_or_init(|| std::env::var_os("JITK_SHARD_DIAGNOSTICS").is_some())
}
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
pub struct Exit {
    pub op: u32,
    pub requests: Vec<Request>,
    pub finish: Option<String>,
}
pub struct Slot {
    run: Mapping,
    ram: Mapping,
    cpu: File,
    _vm: File,
    snapshot: Option<Arc<Snapshot>>,
    pub generation: u64,
    tx: usize,
    rx: usize,
    rx_consumed: usize,
    seen: u32,
    replied: u32,
    pub exits: u64,
    pub drains: u64,
    pending_mmio: bool,
    pub(crate) lease: Option<lease::Lease>,
    policy: ResetPolicy,
    /// The pristine invariant (reset.rs) holds. Cleared by every host write to
    /// guest RAM or registers and before every KVM_RUN; set only at the end of
    /// `reset` and by `new`. `bind` requires it.
    pristine: Cell<bool>,
    /// RAM may hold private pages: set with every RAM write or run, cleared by
    /// a discard. Only selects idle trimming; never trusted for correctness.
    resident: Cell<bool>,
    reset_at: Instant,
    /// Reused reset buffers: private page offsets and raw pagemap entries.
    dirty: Vec<usize>,
    entries: Vec<u8>,
    /// Why a failed reset or content check took this slot out of service.
    quarantined: Option<String>,
    /// Admissions so far: every policy.sample_every-th is content-checked.
    admits: u64,
    /// LOG payload bytes this generation; bounded by ring::LOG_BYTES.
    log_bytes: usize,
    /// The shard clock's cell for this slot (owner::Pool): refreshes the
    /// guest's MONOTONIC_NS word while the vCPU runs.
    pub(crate) clock: Option<crate::clock::Cell>,
}
impl Slot {
    fn create(kvm: &Kvm, file: &File, class: Option<arena::Class>) -> Self {
        // SAFETY: successful KVM_CREATE_VM returns a new descriptor, checked
        // by call(), and transferred exactly once to this File.
        let vm = unsafe { File::from_raw_fd(call(&kvm.fd, KVM_CREATE_VM, 0)) };
        let ram = Mapping::new(file, RAM, libc::MAP_PRIVATE);
        let regions = if let Some(class) = class {
            class.regions(RAM, CTRL).to_vec()
        } else {
            vec![(0, RAM, true)]
        };
        for (slot, (start, end, writable)) in regions.into_iter().enumerate() {
            let region = Region {
                slot: slot as u32,
                flags: if writable { 0 } else { KVM_MEM_READONLY as u32 },
                gpa: ring::RAM_GPA + start as u64,
                size: (end - start) as u64,
                addr: ram.ptr as u64 + start as u64,
            };
            call(
                &vm,
                KVM_SET_USER_MEMORY_REGION as _,
                &region as *const _ as u64,
            );
            if !writable {
                check(
                    // SAFETY: the catalogue selects a page-aligned extent within this
                    // live RAM mapping; the owner has not started the vCPU.
                    unsafe { mprotect(ram.ptr.add(start).cast(), end - start, libc::PROT_READ) },
                    "mprotect immutable RAM",
                );
            }
        }
        // SAFETY: successful KVM_CREATE_VCPU returns a new descriptor, checked
        // by call(), and transferred exactly once to this File.
        let cpu = unsafe { File::from_raw_fd(call(&vm, KVM_CREATE_VCPU, 0)) };
        let mut init = [0u32; 8];
        call(&vm, KVM_ARM_PREFERRED_TARGET, init.as_mut_ptr() as u64);
        init[1] |= 1 << KVM_ARM_VCPU_PSCI_0_2;
        // The reset covers exactly this vCPU: PSCI 0.2 and nothing else (no SVE,
        // SME, PMU, PAC or MTE feature, and no in-kernel irqchip is created).
        // Any other feature would add guest-writable state outside its restore.
        assert_eq!(
            init[1..],
            [1 << KVM_ARM_VCPU_PSCI_0_2, 0, 0, 0, 0, 0, 0],
            "unsupported vCPU init features"
        );
        call(&cpu, KVM_ARM_VCPU_INIT, init.as_ptr() as u64);
        let run = Mapping::new(&cpu, kvm.run_size, libc::MAP_SHARED);
        Self {
            run,
            ram,
            cpu,
            _vm: vm,
            snapshot: None,
            generation: 0,
            tx: 0,
            rx: 0,
            rx_consumed: 0,
            seen: 0,
            replied: 0,
            exits: 0,
            drains: 0,
            pending_mmio: false,
            lease: None,
            policy: ResetPolicy::default(),
            pristine: Cell::new(false),
            resident: Cell::new(false),
            reset_at: Instant::now(),
            dirty: Vec::new(),
            entries: Vec::new(),
            quarantined: None,
            admits: 0,
            log_bytes: 0,
            clock: None,
        }
    }
    /// Create an unpartitioned boot VM for trusted offline snapshot preparation.
    pub fn boot(kvm: &Kvm, memory: &File) -> Self {
        let slot = Self::create(kvm, memory, None);
        slot.set(REG_PC, ring::RAM_GPA);
        slot.set(REG_PSTATE, 0x3c5);
        slot.pristine.set(true); // fresh boot image: no tenant has run here
        slot
    }
    pub fn new(kvm: &Kvm, snapshot: Arc<Snapshot>) -> Self {
        Self::with_policy(kvm, snapshot, ResetPolicy::default())
    }
    pub fn with_policy(kvm: &Kvm, snapshot: Arc<Snapshot>, policy: ResetPolicy) -> Self {
        let mut s = Self::create(kvm, &snapshot.memory, Some(snapshot.class));
        // The reset restores the snapshot's register list. That must be all the
        // state this vCPU exposes: KVM's live list equals the snapshot's, and
        // snapshot loading already rejected any id class the reset does not cover.
        let mut live = s.reg_ids();
        let mut saved: Vec<u64> = snapshot.regs.iter().map(|r| r.id).collect();
        live.sort_unstable();
        saved.sort_unstable();
        assert!(
            live == saved,
            "vCPU register list differs from the snapshot's"
        );
        // Full restore, ID registers included: KVM accepts their values only
        // before the first KVM_RUN. Resets restore all but reset::invariant().
        s.restore_regs(&snapshot.regs);
        s.snapshot = Some(snapshot);
        s.policy = policy;
        // A fresh MAP_PRIVATE mapping reads as the file and no vCPU has run.
        s.pristine.set(true);
        s
    }
    /// Any host write to guest RAM: the slot is no longer pristine.
    fn wrote_ram(&self) {
        self.pristine.set(false);
        self.resident.set(true);
    }
    fn set_bytes(&self, id: u64, b: &[u8]) {
        self.try_set_bytes(id, b).expect("KVM_SET_ONE_REG");
    }
    fn try_set_bytes(&self, id: u64, b: &[u8]) -> io::Result<()> {
        self.pristine.set(false);
        let r = OneReg {
            id,
            addr: b.as_ptr() as u64,
        };
        try_call(&self.cpu, KVM_SET_ONE_REG, &r as *const _ as u64).map(|_| ())
    }
    fn reg_ids(&self) -> Vec<u64> {
        let mut list = vec![0u64; 2049];
        list[0] = 2048;
        call(&self.cpu, KVM_GET_REG_LIST, list.as_mut_ptr() as u64);
        list[1..=list[0] as usize].to_vec()
    }
    fn set(&self, id: u64, v: u64) {
        self.set_bytes(id, &v.to_le_bytes());
    }
    /// Capture this stopped vCPU's complete KVM register set.
    pub fn capture(&self) -> Vec<Register> {
        let mut regs = Vec::new();
        for id in self.reg_ids() {
            let n = 1usize << ((id >> 52) & 15);
            assert!(n <= 256);
            let mut data = vec![0u8; n];
            let r = OneReg {
                id,
                addr: data.as_mut_ptr() as u64,
            };
            call(&self.cpu, KVM_GET_ONE_REG, &r as *const _ as u64);
            regs.push(Register { id, data });
        }
        regs
    }
    fn restore_regs(&self, regs: &[Register]) {
        for r in regs {
            self.set_bytes(r.id, &r.data);
        }
    }
    pub fn drain(&mut self) {
        self.shutdown().expect("stopped vCPU MMIO drain");
    }
    /// Complete pending MMIO before teardown. The caller owns a stopped vCPU.
    pub fn shutdown(&mut self) -> io::Result<()> {
        if self.pending_mmio {
            self.pristine.set(false); // completing the MMIO advances the guest PC
            // SAFETY: the live kvm_run mapping is owned here and no KVM_RUN is
            // active. immediate_exit is the UAPI byte; the pointer cannot escape.
            self.run.immediate_exit().store(1, Release);
            // SAFETY: this owner has the live vCPU/run mappings; no guest RAM
            // reference spans KVM_RUN, which takes a zero scalar argument.
            let r = unsafe { ioctl(self.cpu.as_raw_fd(), KVM_RUN as _, 0u64) };
            let error = io::Error::last_os_error();
            self.run.immediate_exit().store(0, Release);
            if r >= 0 {
                return Err(io::Error::other("MMIO drain did not return EINTR"));
            }
            if error.raw_os_error() != Some(libc::EINTR) {
                return Err(error);
            }
            self.pending_mmio = false;
            self.drains += 1;
        }
        Ok(())
    }
    pub fn corrupt_canary(&self, v: u64) {
        self.wrote_ram();
        self.ram
            .put(self.snapshot.as_ref().unwrap().class.canary(), v);
    }
    pub fn canary(&self) -> u64 {
        self.ram
            .word(self.snapshot.as_ref().unwrap().class.canary())
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
    fn load(&self, off: usize) -> u64 {
        self.atomic(off).load(Acquire)
    }
    fn store(&self, off: usize, v: u64) {
        self.wrote_ram();
        self.atomic(off).store(v, Release);
    }
    /// Copy stopped guest RAM; callers never borrow the underlying mapping.
    pub fn bytes(&self, off: usize, n: usize) -> Vec<u8> {
        assert!(off.checked_add(n).is_some_and(|end| end <= RAM));
        (off..off + n)
            .map(|at| {
                // SAFETY: range is checked above; Slot is owner-thread-only, KVM is
                // stopped, and the returned Vec owns each copied byte.
                unsafe { self.ram.ptr.add(at).read_volatile() }
            })
            .collect()
    }
    fn copy(&self, off: usize, b: &[u8]) {
        assert!(off.checked_add(b.len()).is_some_and(|end| end <= RAM));
        self.wrote_ram();
        // SAFETY: b owns/borrows host memory, never this mapping. Bounds are
        // checked; only this stopped slot's owner writes its writable RAM.
        unsafe {
            ptr::copy_nonoverlapping(b.as_ptr(), self.ram.ptr.add(off), b.len());
        }
    }
    pub fn bind(&mut self, generation: u64, source: &str, entropy: &mut File) -> [u8; 16] {
        assert!(generation > self.generation && source.len() <= ring::SOURCE_LIMIT);
        // The one gate between tenants: no run binds to a slot a previous run,
        // or any host write since the last reset, has touched.
        assert!(self.pristine.get(), "bind requires a pristine slot");
        self.generation = generation;
        self.log_bytes = 0;
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
                // SAFETY: fixed ring geometry is within RAM; KVM is stopped.
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
        self.copy(self.snapshot.as_ref().unwrap().class.canary(), code);
        let class = self.snapshot.as_ref().unwrap().class;
        self.set(REG_X0 + 4 * 2, ring::RAM_GPA + class.start() as u64);
        self.set(REG_X0 + 5 * 2, ring::RAM_GPA + class.end() as u64);
        self.set(REG_SCTLR, 0);
        self.set(REG_PSTATE, 0x3c5);
        self.set(
            REG_PC,
            ring::RAM_GPA + self.snapshot.as_ref().unwrap().class.canary() as u64,
        );
    }
    pub fn exit(&mut self) -> Result<Exit, RunError> {
        loop {
            if let Some(e) = self.try_exit()? {
                return Ok(e);
            }
        }
    }
    pub fn try_exit(&mut self) -> Result<Option<Exit>, RunError> {
        self.store(ring::MONOTONIC_NS, monotonic_ns());
        // Clear before publishing the active pointer. Kicks received before
        // publication remain pending in TLS, including another slot's expiry.
        self.run.immediate_exit().store(0, Release);
        let (running, kicked) = lease::Running::enter(self.run.immediate_exit());
        if kicked {
            return Ok(None);
        }
        {
            if let Some(l) = &self.lease
                && l.expired()
            {
                return Err(RunError::Deadline {
                    deadline_ns: l.deadline(),
                });
            }
            self.wrote_ram(); // the guest may write RAM and registers
            // While the guard lives the shard clock may refresh MONOTONIC_NS;
            // its drop waits out an in-progress store (clock.rs).
            let _ticking = self
                .clock
                .as_ref()
                .map(|c| c.enter(self.atomic(ring::MONOTONIC_NS)));
            // SAFETY: this owner has the live vCPU/run mappings; no guest RAM
            // reference spans KVM_RUN, which takes a zero scalar argument.
            let r = unsafe { ioctl(self.cpu.as_raw_fd(), KVM_RUN as _, 0u64) };
            if r < 0 && io::Error::last_os_error().raw_os_error() == Some(libc::EINTR) {
                return Ok(None); // yield to the owner to service another slot's expiry
            }
            check(r, "KVM_RUN");
        }
        self.pending_mmio = false;
        let reason = self.run.u32(EXIT_REASON);
        if reason as u64 != KVM_EXIT_MMIO {
            return Err(RunError::GuestProtocol("unexpected KVM exit"));
        }
        self.pending_mmio = true;
        if self.run.word(MMIO_ADDR) != ring::DOORBELL_GPA {
            return Err(RunError::MemoryBound {
                address: self.run.word(MMIO_ADDR),
            });
        }
        // SAFETY: UAPI offsets identify aligned fields in the live kvm_run mapping;
        // KVM_RUN has returned and the owner is the sole thread accessing this slot.
        let len = self.run.u32(MMIO_LEN);
        let write = self.run.byte(MMIO_WRITE);
        if len != 4 || write != 1 {
            return Err(RunError::GuestProtocol("invalid doorbell access"));
        }
        let op = self.run.u32(MMIO_DATA);
        self.pending_mmio = true;
        self.exits += 1;
        drop(running); // No KVM_RUN remains active while decoding guest records.
        self.decode_exit(op)
    }
    fn decode_exit(&mut self, op: u32) -> Result<Option<Exit>, RunError> {
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
                    // Kernel diagnostics; tenant code cannot emit LOG, a
                    // compromised kernel can flood it. Shard stderr is bounded
                    // for the shard's lifetime (Node kills it past 64 KiB), so
                    // a flood fails this run only, and the text reaches stderr
                    // only when diagnostics are requested.
                    self.log_bytes += n;
                    if self.log_bytes > ring::LOG_BYTES {
                        return Err(RunError::GuestProtocol("LOG budget"));
                    }
                    if diagnostics() {
                        eprintln!("guest: {}", String::from_utf8_lossy(&payload));
                    }
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
        Ok(Some(Exit {
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
impl Drop for Slot {
    fn drop(&mut self) {
        let _ = self.shutdown();
    }
}

/// EL1 fixtures from guest/reset-attack.S for the reset tests.
#[cfg(test)]
pub(crate) mod test_guest {
    /// A slot bound with this generation has its next reset rejected by KVM.
    pub const FAIL_RESET_GENERATION: u64 = 0x5eed_0000_0000;
    core::arch::global_asm!(include_str!("../../guest/reset-attack.S"));
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

#[cfg(test)]
mod tests {
    use super::{
        CTRL, Kvm, Mapping, RAM, REQUEST, Request, ResetPolicy, RunError, Slot, Snapshot, check,
        test_guest,
    };
    use crate::{arena, constants::ring};
    use std::{fs::File, sync::Arc};
    fn slot() -> Slot {
        let f = File::open("/dev/zero").unwrap();
        Slot {
            run: Mapping::new(&f, 4096, 2),
            ram: Mapping::new(&f, RAM, libc::MAP_PRIVATE),
            cpu: File::open("/dev/null").unwrap(),
            _vm: File::open("/dev/null").unwrap(),
            snapshot: None,
            generation: 2,
            tx: 0,
            rx: 0,
            rx_consumed: 0,
            seen: 0,
            replied: 0,
            exits: 0,
            drains: 0,
            pending_mmio: false,
            lease: None,
            policy: super::ResetPolicy::default(),
            pristine: std::cell::Cell::new(false),
            resident: std::cell::Cell::new(false),
            reset_at: std::time::Instant::now(),
            dirty: Vec::new(),
            entries: Vec::new(),
            quarantined: None,
            admits: 0,
            log_bytes: 0,
            clock: None,
        }
    }
    fn record(s: &Slot, kind: u16, id: u64, payload: &[u8]) {
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
        // At the guest's TX cursor (records already decoded stay consumed).
        s.copy(REQUEST + s.tx, &b);
        s.store(ring::TX_PRODUCER, (s.tx + len) as u64);
    }
    fn test_snapshots() -> Vec<Arc<Snapshot>> {
        let bases = std::env::var("JITK_SHARD_TEST_SNAPSHOTS").unwrap();
        let snapshots: Vec<_> = bases
            .split(':')
            .map(|b| Snapshot::load(b).unwrap())
            .collect();
        for class in arena::Class::ALL {
            assert!(snapshots.iter().any(|s| s.class == class));
        }
        snapshots
    }
    fn present(address: usize) -> bool {
        use std::os::unix::fs::FileExt;
        let mut entry = [0; 8];
        File::open("/proc/self/pagemap")
            .unwrap()
            .read_exact_at(&mut entry, (address / 4096 * 8) as u64)
            .unwrap();
        u64::from_le_bytes(entry) & (1 << 63) != 0
    }
    /// Both reset paths, with the full pristine and register comparison after
    /// every reset and trim.
    fn policies() -> [(&'static str, ResetPolicy); 2] {
        let verify = |copy_limit| ResetPolicy {
            copy_limit,
            idle_trim: None,
            verify: true,
            sample_every: 0,
        };
        [("copy", verify(RAM / 4096)), ("discard", verify(0))]
    }
    fn writable_pages(snapshot: &Snapshot) -> u32 {
        ((snapshot.class.bytes() + arena::RING_BYTES) / 4096) as u32
    }
    /// The probe's hash of the snapshot file itself (read by descriptor, not
    /// through the copy path's view): arena without the code page, transport.
    /// try_exit stores the clock word before each KVM_RUN; it is taken from
    /// `monotonic`, every other word from the file.
    fn snapshot_hash(snapshot: &Snapshot, monotonic: u64) -> u64 {
        use std::os::unix::fs::FileExt;
        let class = snapshot.class;
        let mut h: u64 = 0xcbf2_9ce4_8422_2325;
        for (start, end) in [
            (class.start(), class.canary()),
            (CTRL, CTRL + arena::RING_BYTES),
        ] {
            let mut b = vec![0; end - start];
            snapshot.memory.read_exact_at(&mut b, start as u64).unwrap();
            for (i, w) in b.as_chunks::<8>().0.iter().enumerate() {
                let w = if start + i * 8 == CTRL + ring::MONOTONIC_NS {
                    monotonic
                } else {
                    u64::from_le_bytes(*w)
                };
                h = (h ^ w).wrapping_mul(0x100_0000_01b3);
            }
        }
        h
    }
    fn reg(s: &Slot, id: u64) -> u64 {
        let mut v = 0u64;
        let r = super::OneReg {
            id,
            addr: &mut v as *mut u64 as u64,
        };
        super::call(
            &s.cpu,
            crate::constants::kvm::KVM_GET_ONE_REG,
            &r as *const _ as u64,
        );
        v
    }
    /// Run an EL1 fixture that ends in a read-only store.
    fn attack(s: &mut Slot, code: &[u8]) {
        s.redirect_entry(code);
        assert!(
            matches!(s.exit(), Err(RunError::MemoryBound { address }) if address == ring::RAM_GPA)
        );
    }
    /// Whether what the guest reads back, hashed by the guest itself, is the
    /// snapshot (plus the clock word try_exit stored for this run).
    fn probe(s: &mut Slot) -> bool {
        attack(s, test_guest::probe());
        let seen = reg(s, crate::constants::kvm::REG_X0);
        seen == snapshot_hash(s.snapshot.as_ref().unwrap(), s.load(ring::MONOTONIC_NS))
    }
    /// The slot's private (anonymous) KiB per the kernel's own VMA accounting.
    fn anonymous_kib(s: &Slot) -> u64 {
        let (lo, hi) = (s.ram.ptr as u64, s.ram.ptr as u64 + RAM as u64);
        let smaps = std::fs::read_to_string("/proc/self/smaps").unwrap();
        let mut inside = false;
        let mut kib = 0;
        for line in smaps.lines() {
            if let Some((range, _)) = line.split_once(' ')
                && let Some((a, b)) = range.split_once('-')
                && let (Ok(a), Ok(b)) = (u64::from_str_radix(a, 16), u64::from_str_radix(b, 16))
            {
                inside = a >= lo && b <= hi;
            } else if inside && let Some(v) = line.strip_prefix("Anonymous:") {
                kib += v
                    .trim()
                    .trim_end_matches(" kB")
                    .trim()
                    .parse::<u64>()
                    .unwrap();
            }
        }
        kib
    }
    #[test]
    #[ignore = "requires KVM and both classes in JITK_SHARD_TEST_SNAPSHOTS; run under bench.lock"]
    fn reset_cleans_every_writable_page_and_preserves_immutable_translations() {
        let kvm = Kvm::new();
        for snapshot in test_snapshots() {
            for (name, policy) in policies() {
                let mut s = Slot::with_policy(&kvm, snapshot.clone(), policy);
                let mut pages = 0u32;
                for (start, end, writable) in snapshot.class.regions(RAM, CTRL) {
                    if writable {
                        for off in (start..end).step_by(4096) {
                            s.copy(off, &[0xcc; 4096]);
                            pages += 1;
                        }
                    }
                }
                assert_eq!(
                    pages as usize * 4096,
                    snapshot.class.bytes() + arena::RING_BYTES
                );
                let saved = s.bytes(0, 4096);
                assert!(present(s.ram.ptr as usize));
                let r = s.reset().unwrap();
                if name == "copy" {
                    assert_eq!((r.discard, r.private), (None, pages), "{name}");
                } else {
                    assert_eq!(r.discard, Some(super::Discard::Limit), "{name}");
                }
                assert!(
                    present(s.ram.ptr as usize),
                    "immutable translation was discarded"
                );
                assert_eq!(s.bytes(0, 4096), saved);
                assert!(
                    s.pristine(),
                    "{name}: every arena/ring page must be pristine"
                );
                // Host writes reach the guest through fresh CoW copies; the guest
                // must read the snapshot back, not a stale stage-2 page.
                assert!(probe(&mut s), "{name}: guest view");
                s.shutdown().unwrap();
            }
        }
    }
    #[test]
    #[ignore = "requires KVM and both classes in JITK_SHARD_TEST_SNAPSHOTS; run under bench.lock"]
    fn hostile_guest_writes_and_registers_never_reach_the_next_run() {
        let kvm = Kvm::new();
        for snapshot in test_snapshots() {
            for (name, policy) in policies() {
                let mut s = Slot::with_policy(&kvm, snapshot.clone(), policy);
                assert!(probe(&mut s), "{name}: fresh slot");
                s.reset().unwrap();
                for round in 0..3 {
                    // Every writable byte and every reachable register class.
                    attack(&mut s, test_guest::fill());
                    assert!(!s.is_pristine());
                    let r = s.reset().unwrap(); // verify: RAM + every register + MP state
                    if name == "copy" {
                        // The fill dirties every writable page but its code page;
                        // redirect_entry dirtied that one.
                        assert_eq!((r.discard, r.private), (None, writable_pages(&snapshot)));
                    } else {
                        assert_eq!(r.discard, Some(super::Discard::Limit));
                    }
                    assert!(s.pristine(), "{name} round {round}: RAM");
                    let regs = s.register_mismatches();
                    assert!(regs.is_empty(), "{name} round {round}: {regs:#x?}");
                    assert!(probe(&mut s), "{name} round {round}: guest view");
                    s.reset().unwrap();
                }
                // PSCI SYSTEM_OFF leaves the vCPU STOPPED; the reset makes it
                // RUNNABLE, or the probe's KVM_RUN would sleep.
                s.redirect_entry(test_guest::system_off());
                assert!(matches!(s.exit(), Err(RunError::GuestProtocol(_))));
                s.reset().unwrap();
                assert!(probe(&mut s), "{name}: after SYSTEM_OFF");
                s.shutdown().unwrap();
            }
        }
    }
    #[test]
    #[ignore = "requires KVM and JITK_SHARD_TEST_SNAPSHOT; run under bench.lock"]
    fn copy_limit_boundary_is_exact() {
        let kvm = Kvm::new();
        let snapshot = Snapshot::load(&std::env::var("JITK_SHARD_TEST_SNAPSHOT").unwrap()).unwrap();
        let n = writable_pages(&snapshot) as usize; // the fill's private pages
        for (limit, copies) in [(n - 1, false), (n, true), (n + 1, true)] {
            let policy = ResetPolicy {
                copy_limit: limit,
                idle_trim: None,
                verify: true,
                sample_every: 0,
            };
            let mut s = Slot::with_policy(&kvm, snapshot.clone(), policy);
            attack(&mut s, test_guest::fill());
            let r = s.reset().unwrap();
            if copies {
                assert_eq!((r.discard, r.private as usize), (None, n), "limit {limit}");
                assert!(s.is_resident());
            } else {
                assert_eq!(r.discard, Some(super::Discard::Limit), "limit {limit}");
                assert_eq!(r.private as usize, limit, "counted up to the limit");
                assert!(!s.is_resident());
            }
            assert!(s.pristine(), "limit {limit}");
            assert!(probe(&mut s), "limit {limit}");
            s.shutdown().unwrap();
        }
    }
    #[test]
    #[ignore = "requires KVM and JITK_SHARD_TEST_SNAPSHOT; run under bench.lock"]
    fn sampled_admission_check_catches_a_lying_pristine_flag() {
        let kvm = Kvm::new();
        let snapshot = Snapshot::load(&std::env::var("JITK_SHARD_TEST_SNAPSHOT").unwrap()).unwrap();
        let policy = |sample_every| ResetPolicy {
            copy_limit: RAM / 4096,
            idle_trim: None,
            verify: false,
            sample_every,
        };
        // Flip one byte of a restored arena page without touching the flag.
        let corrupt = |s: &Slot| {
            let p = s.ram.ptr.wrapping_add(snapshot.class.start() + 4096);
            // SAFETY: test-only write inside a writable extent of a stopped slot.
            unsafe { p.write_volatile(!p.read_volatile()) };
        };
        let mut s = Slot::with_policy(&kvm, snapshot.clone(), policy(3));
        attack(&mut s, test_guest::fill());
        s.reset().unwrap(); // copy path: the arena pages stay mapped and private
        corrupt(&s);
        assert!(
            s.is_pristine(),
            "the flag cannot see a write behind its back"
        );
        s.admit().unwrap(); // admissions 1 and 2 are not sampled
        s.admit().unwrap();
        assert!(!s.pristine());
        s.admit().unwrap(); // 3: sampled, found, discard-reset, re-checked
        assert!(s.pristine() && s.register_mismatches().is_empty());
        assert!(probe(&mut s));

        let mut s = Slot::with_policy(&kvm, snapshot.clone(), policy(1));
        // A register changed behind the flag's back (raw ioctl, not set_bytes).
        let v = 0x41u64;
        let r = super::OneReg {
            id: 0x6030_0000_0013_de82, // TPIDR_EL0
            addr: &v as *const u64 as u64,
        };
        super::call(
            &s.cpu,
            crate::constants::kvm::KVM_SET_ONE_REG,
            &r as *const _ as u64,
        );
        assert!(s.is_pristine() && !s.register_mismatches().is_empty());
        s.admit().unwrap();
        assert!(s.register_mismatches().is_empty());
        // Cost of one sampled check on a clean slot (reported in the results doc).
        let t = std::time::Instant::now();
        for _ in 0..20 {
            assert_eq!(s.content_mismatch(), None);
        }
        println!("SAMPLED_CHECK_NS {}", t.elapsed().as_nanos() / 20);

        // A private page in an immutable extent cannot be repaired by a reset:
        // the slot is quarantined and never admitted again.
        let mut s = Slot::with_policy(&kvm, snapshot.clone(), policy(1));
        let page = s.ram.ptr.wrapping_add(0x10000);
        // SAFETY: test-only: unprotect one immutable page of this stopped slot and
        // rewrite one byte with its own value, which still makes the page private.
        unsafe {
            check(
                libc::mprotect(page.cast(), 4096, libc::PROT_READ | libc::PROT_WRITE),
                "mprotect",
            );
            page.write_volatile(page.read_volatile());
        }
        assert!(s.admit().is_err() && s.is_quarantined());
        assert!(s.admit().is_err() && s.reset().is_err());
        s.shutdown().unwrap();
    }
    #[test]
    #[ignore = "requires KVM and JITK_SHARD_TEST_SNAPSHOT; run under bench.lock"]
    fn trim_releases_private_pages_and_stays_pristine() {
        let kvm = Kvm::new();
        let snapshot = Snapshot::load(&std::env::var("JITK_SHARD_TEST_SNAPSHOT").unwrap()).unwrap();
        let policy = ResetPolicy {
            copy_limit: RAM / 4096,
            idle_trim: Some(std::time::Duration::ZERO),
            verify: true,
            sample_every: 0,
        };
        let mut s = Slot::with_policy(&kvm, snapshot.clone(), policy);
        assert_eq!(anonymous_kib(&s), 0, "fresh slot");
        assert_eq!(s.trim_due(), None, "nothing to trim");
        attack(&mut s, test_guest::fill());
        s.reset().unwrap();
        let held = anonymous_kib(&s);
        assert_eq!(
            held,
            u64::from(writable_pages(&snapshot)) * 4,
            "copy path keeps its pages"
        );
        assert!(s.trim_due().is_some());
        s.trim(); // verify: RAM + registers
        assert_eq!(anonymous_kib(&s), 0, "trim released {held} KiB");
        assert!(s.is_pristine() && !s.is_resident() && s.trim_due().is_none());
        assert!(probe(&mut s));
        s.shutdown().unwrap();
    }
    #[test]
    #[ignore = "subprocess target for immutable_host_writes_fault"]
    fn immutable_host_write_child() {
        if std::env::var_os("JITK_IMMUTABLE_WRITE_CHILD").is_none() {
            return;
        }
        // SAFETY: Linux RLIMIT_CORE accepts two u64 limits; zero prevents crash artifacts.
        check(
            unsafe {
                libc::setrlimit(
                    libc::RLIMIT_CORE,
                    &libc::rlimit {
                        rlim_cur: 0,
                        rlim_max: 0,
                    },
                )
            },
            "RLIMIT_CORE",
        );
        let snapshot = Snapshot::load(&std::env::var("JITK_SHARD_TEST_SNAPSHOT").unwrap()).unwrap();
        let s = Slot::new(&Kvm::new(), snapshot);
        s.copy(0, &[0xff]); // The host's immutable extent must fault, independent of KVM.
        panic!("immutable RAM accepted a write");
    }
    #[test]
    #[ignore = "requires KVM and both classes in JITK_SHARD_TEST_SNAPSHOTS; run under bench.lock"]
    fn immutable_host_writes_fault() {
        use std::os::unix::process::ExitStatusExt;
        test_snapshots();
        for base in std::env::var("JITK_SHARD_TEST_SNAPSHOTS")
            .unwrap()
            .split(':')
        {
            let status = std::process::Command::new(std::env::current_exe().unwrap())
                .args([
                    "--exact",
                    "kvm::tests::immutable_host_write_child",
                    "--ignored",
                ])
                .env("JITK_IMMUTABLE_WRITE_CHILD", "1")
                .env("JITK_SHARD_TEST_SNAPSHOT", base)
                .output()
                .unwrap()
                .status;
            assert_eq!(status.signal(), Some(11), "immutable write must SIGSEGV");
        }
    }
    #[test]
    fn drop_does_not_panic_when_mmio_drain_fails() {
        let mut s = slot();
        s.pending_mmio = true;
        assert!(s.shutdown().is_err());
        drop(s); // /dev/null rejects KVM_RUN: cleanup must not assert.
    }
    #[test]
    fn guest_ram_reads_are_owned_copies() {
        let s = slot();
        s.copy(0, &[1, 2, 3, 4]);
        let saved = s.bytes(0, 4);
        s.copy(0, &[5, 6, 7, 8]);
        assert_eq!(&saved[..], &[1, 2, 3, 4]);
        assert_eq!(&s.bytes(0, 4)[..], &[5, 6, 7, 8]);
    }
    #[test]
    fn log_flood_fails_only_its_run() {
        // A compromised kernel writing LOG records: up to ring::LOG_BYTES of
        // payload per run decodes (and prints nothing), the next byte is a run
        // error, never a shard failure.
        let mut s = slot();
        let chunk = vec![b'x'; 4096];
        for _ in 0..ring::LOG_BYTES / chunk.len() {
            record(&s, ring::LOG, 0, &chunk);
            assert!(s.decode_exit(ring::SUBMIT).is_ok());
        }
        record(&s, ring::LOG, 0, b"x");
        assert!(matches!(
            s.decode_exit(ring::SUBMIT),
            Err(RunError::GuestProtocol("LOG budget"))
        ));
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
}
