//! Hypervisor-neutral slot: guest RAM over a snapshot's memory classes, the
//! bind header, the ring record decoder and reply path, and (reset.rs) reset,
//! sampled checks and verification. Generic over `hv::Vm`; the KVM and HVF
//! specifics live behind it (`kvm`, `hvf`).
pub mod reset;
#[cfg(test)]
mod tests;

pub use crate::clock::monotonic_ns;
use crate::constants::ring::{self, RecordHeader};
use crate::hv::{Exit, Region, Vcpu, Vm};
use crate::{arena, calls::Calls, memory::Mapping, snapshot::Snapshot};
pub use reset::{
    Discard, QUARANTINED, Quarantined, ResetPolicy, ResetReport, SAMPLE_FAILURES, SAMPLED,
};
use std::{
    cell::Cell,
    collections::VecDeque,
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

/// The register file type of a back's vCPU.
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
/// A control-page word of guest RAM, for atomic host access only.
fn control_word(ram: &Mapping, off: usize) -> &AtomicU64 {
    assert!(
        off.is_multiple_of(8)
            && off
                .checked_add(8)
                .is_some_and(|end| end <= arena::RING_BYTES)
    );
    // SAFETY: mmap is page aligned; the checked control word is aligned and
    // live. Only atomic host accesses are exposed, never a RAM slice.
    unsafe { &*ram.ptr.add(CTRL + off).cast() }
}
/// `JITK_SHARD_DIAGNOSTICS` set: print JS-profile guest LOG records to stderr
/// (offline debugging; Node starts the shard without it).
fn diagnostics() -> bool {
    static ON: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
    *ON.get_or_init(|| std::env::var_os("JITK_SHARD_DIAGNOSTICS").is_some())
}
/// One doorbell's decoded TX messages: complete calls, console lines (JSON
/// `[level, message]`, one-way) and the completion.
pub struct Step {
    pub op: u32,
    pub requests: Vec<Request>,
    pub logs: Vec<Vec<u8>>,
    pub finish: Option<String>,
}
/// A TX message whose MORE fragments arrived and whose last has not.
struct Partial {
    kind: u16,
    id: u64,
    bytes: Vec<u8>,
}
/// The JSON records of one message: full MORE fragments, then the rest.
fn message_records(kind: u16, generation: u64, id: u64, cap: u32, bytes: &[u8]) -> Vec<Vec<u8>> {
    let count = ring::records(bytes.len());
    (0..count)
        .map(|i| {
            let chunk = &bytes[(i * ring::MAX_PAYLOAD).min(bytes.len())
                ..((i + 1) * ring::MAX_PAYLOAD).min(bytes.len())];
            let more = if i + 1 < count { ring::MORE } else { 0 };
            let len = ring::record_len(chunk.len());
            let mut b = vec![0u8; len];
            let h = RecordHeader {
                len: len as u32,
                kind,
                flags: ring::JSON_UTF8 | more,
                generation,
                id,
                n: chunk.len() as u32,
                cap,
            };
            b[..ring::HEADER_BYTES].copy_from_slice(&h.encode());
            b[ring::HEADER_BYTES..ring::HEADER_BYTES + chunk.len()].copy_from_slice(chunk);
            b
        })
        .collect()
}
/// When to resume a guest that parked (WAIT) with `deadline`, its DEADLINE
/// word on the slot clock (`monotonic_ns`): None when it waits for input
/// only. The run's lease bounds it in any case.
pub fn wake_time(deadline: u64) -> Option<Instant> {
    (deadline != u64::MAX).then(|| {
        Instant::now() + std::time::Duration::from_nanos(deadline.saturating_sub(monotonic_ns()))
    })
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
    /// This generation's call ids: issued by decoded CALLs, answered by replies.
    calls: Calls,
    /// Replies queued this generation (HOST_EPOCH).
    replies: u64,
    /// A TX message still waiting for its last fragment.
    partial: Option<Partial>,
    /// RX records (SOURCE, RET) not yet on the ring: written as the guest
    /// frees ring space, before every vCPU entry. Bounded by the source and
    /// one reply per open call.
    backlog: VecDeque<Vec<u8>>,
    /// CONSOLE messages this generation; bounded by ring::MAX_LOGS.
    logs: usize,
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
    /// Resets so far: every policy.sample_every-th is content-checked.
    resets: u64,
    /// LOG payload bytes this generation; bounded by ring::LOG_BYTES.
    log_bytes: usize,
    /// The shard clock's cell for this slot (owner::Pool): refreshes the
    /// guest's MONOTONIC_NS word while the vCPU runs.
    pub(crate) clock: Option<crate::clock::Cell>,
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
            calls: Calls::default(),
            replies: 0,
            partial: None,
            backlog: VecDeque::new(),
            logs: 0,
            exits: 0,
            policy: ResetPolicy::default(),
            pristine: Cell::new(false),
            resident: Cell::new(false),
            reset_at: Instant::now(),
            quarantined: None,
            resets: 0,
            log_bytes: 0,
            clock: None,
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
    /// Register this slot with a shard clock (`clock::Clock::cell`): its
    /// guest time then advances while the vCPU runs, not only per entry.
    pub fn set_clock(&mut self, cell: crate::clock::Cell) {
        self.clock = Some(cell);
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
        let at = self.snapshot().class.canary();
        self.vm.host_wrote(ring::RAM_GPA + at as u64, 8);
        self.ram.put(at, v);
    }
    pub fn canary(&self) -> u64 {
        self.ram.word(self.snapshot().class.canary())
    }
    fn atomic(&self, off: usize) -> &AtomicU64 {
        control_word(&self.ram, off)
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
        self.vm.host_wrote(ring::RAM_GPA + off as u64, b.len());
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
        // The source is the run's first RX message (none for an empty one).
        self.store(ring::SOURCE_BYTES, source.len() as u64);
        if !source.is_empty() {
            self.backlog =
                message_records(ring::SOURCE, generation, 0, 0, source.as_bytes()).into();
        }
        self.flush().expect("a pristine slot's RX ring is empty");
        seed
    }
    /// Move backlog records onto the RX ring while they fit. The vCPU is
    /// stopped; the guest's consumer cursor is checked against what the host
    /// produced.
    fn flush(&mut self) -> Result<(), RunError> {
        if self.backlog.is_empty() {
            return Ok(());
        }
        let cons = self.load(ring::RX_CONSUMER) as usize;
        if cons < self.rx_consumed || cons > self.rx || !cons.is_multiple_of(8) {
            return Err(RunError::GuestProtocol("RX consumer cursor"));
        }
        self.rx_consumed = cons;
        let start = self.rx;
        while let Some(b) = self.backlog.front() {
            if self.rx - cons + b.len() > ring::RING_BYTES {
                break;
            }
            let at = self.rx % ring::RING_BYTES;
            let first = b.len().min(ring::RING_BYTES - at);
            let b = self.backlog.pop_front().unwrap();
            self.copy(REPLY + at, &b[..first]);
            self.copy(REPLY, &b[first..]);
            self.rx += b.len();
        }
        if self.rx != start {
            self.store(ring::RX_PRODUCER, self.rx as u64);
            self.store(ring::HOST_EPOCH, self.replies);
            self.store(ring::REPLY_READY, 1);
        }
        Ok(())
    }
    /// RX records wait for ring space: the guest must run (it frees space as
    /// it reads) before it needs Node again.
    pub fn backlogged(&self) -> bool {
        !self.backlog.is_empty()
    }
    /// The guest's last WAIT deadline (ppoll timeout or timer), in this
    /// slot's clock (`monotonic_ns`); u64::MAX when it waits for input only.
    pub fn wait_deadline(&self) -> u64 {
        self.load(ring::DEADLINE)
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
        self.flush()?;
        self.store(ring::MONOTONIC_NS, monotonic_ns());
        self.wrote_ram(); // the guest may write RAM and registers
        // While the guard lives the shard clock may refresh MONOTONIC_NS; its
        // drop waits out an in-progress store (clock.rs), so none lands
        // during decode or reset.
        let ticking = self
            .clock
            .as_ref()
            .map(|c| c.enter(control_word(&self.ram, ring::MONOTONIC_NS)));
        let exit = self.vcpu.run().expect("vCPU run");
        drop(ticking);
        match exit {
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
        let mut logs = Vec::new();
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
                || h.flags & !ring::MORE != ring::JSON_UTF8
                || h.generation != self.generation
            {
                return Err(RunError::GuestProtocol("TX record header"));
            }
            let (len, kind, id, n, cap) = (h.len as usize, h.kind, h.id, h.n as usize, h.cap);
            let more = h.flags & ring::MORE != 0;
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
            if more && (n != ring::MAX_PAYLOAD || kind == ring::LOG) {
                return Err(RunError::GuestProtocol("TX fragment"));
            }
            match kind {
                ring::CALL | ring::DONE | ring::CONSOLE => {
                    let first = match self.partial.take() {
                        Some(p) if p.kind == kind && p.id == id => Some(p.bytes),
                        Some(_) => return Err(RunError::GuestProtocol("TX fragment interleaved")),
                        None => None,
                    };
                    if first.is_none() {
                        // A message's identity is checked on its first record.
                        let ok = match kind {
                            ring::CALL => id == self.calls.next() && cap == ring::CALL_CAP,
                            ring::DONE => id == 0 && cap == 0 && finish.is_none(),
                            _ => id == 0 && cap == 0 && self.logs < ring::MAX_LOGS,
                        };
                        if !ok {
                            return Err(RunError::GuestProtocol("message identity"));
                        }
                    } else if cap
                        != if kind == ring::CALL {
                            ring::CALL_CAP
                        } else {
                            0
                        }
                    {
                        return Err(RunError::GuestProtocol("message identity"));
                    }
                    let bytes = match first {
                        Some(mut b) => {
                            b.extend_from_slice(&payload);
                            b
                        }
                        None => payload,
                    };
                    let bounded = crate::payload::forwarded(kind, &bytes);
                    if more {
                        if !bounded {
                            return Err(RunError::GuestProtocol("message bytes"));
                        }
                        self.partial = Some(Partial { kind, id, bytes });
                    } else if kind == ring::CALL {
                        if !bounded || !self.calls.issue(id, 0) {
                            return Err(RunError::GuestProtocol("call identity/schema"));
                        }
                        requests.push(Request { id, bytes });
                    } else if kind == ring::DONE {
                        if op != ring::FINISH || self.tx + len != prod {
                            return Err(RunError::GuestProtocol("completion identity/order"));
                        }
                        if !bounded {
                            return Err(RunError::GuestProtocol("completion bytes"));
                        }
                        finish = Some(bytes.into_iter().map(char::from).collect());
                    } else {
                        if !bounded {
                            return Err(RunError::GuestProtocol("console bytes"));
                        }
                        self.logs += 1;
                        logs.push(bytes);
                    }
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
            if !self.calls.idle() || !requests.is_empty() || self.partial.is_some() {
                return Err(RunError::GuestProtocol("completion with outstanding calls"));
            }
        }
        Ok(Some(Step {
            op,
            requests,
            logs,
            finish,
        }))
    }
    /// Answer open call `r.id`: its RET records join the backlog, and as many
    /// as fit go onto the RX ring now.
    pub fn reply(&mut self, r: &Request) -> Result<(), RunError> {
        // The trusted broker/fixture must answer a previously decoded request
        // once; the broker bounds it by the class (service::State::reply).
        assert!(r.bytes.len() <= ring::MAX_REPLY_BYTES);
        assert!(
            self.calls.answer(r.id).is_some(),
            "reply to an unopened call"
        );
        let records = message_records(ring::RET, self.generation, r.id, ring::CALL_CAP, &r.bytes);
        self.backlog.extend(records);
        self.replies += 1;
        self.flush()
    }
    pub fn pause_after_repair(&self) {
        self.store(ring::SAMPLE_READY, 1);
    }
    /// The stopped run's heap high-water (ring::HEAP_PEAK, which the guest
    /// kernel writes): untrusted, so at most the class's arena bytes. Read
    /// it before the reset, which restores the snapshot's value.
    pub fn heap_peak(&self) -> u64 {
        self.load(ring::HEAP_PEAK)
            .min(self.snapshot().class.bytes() as u64)
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
    /// What a hostile guest's access must end as: the slot's run fails with
    /// this, and no other slot or the process notices.
    #[cfg_attr(not(target_os = "linux"), allow(dead_code))] // KVM tests only, so far
    #[derive(Debug, Clone, Copy, PartialEq)]
    pub enum Outcome {
        /// `RunError::MemoryBound` at this address.
        MemoryBound(u64),
        /// `RunError::GuestProtocol("invalid doorbell access")`.
        BadDoorbell,
    }
    #[cfg_attr(not(target_os = "linux"), allow(dead_code))] // KVM tests only, so far
    impl Outcome {
        /// Whether run error `e` is this. `nisv`: the hypervisor reports a
        /// syndromeless access with its address (HVF; KVM with
        /// KVM_CAP_ARM_NISV_TO_USER), else the run fails as a guest error.
        pub fn is(self, nisv: bool, e: &super::RunError) -> bool {
            use super::RunError::{GuestProtocol, MemoryBound};
            match (nisv, e, self) {
                (true, MemoryBound { address }, Self::MemoryBound(a)) => *address == a,
                (true, GuestProtocol(why), Self::BadDoorbell) => *why == "invalid doorbell access",
                (false, GuestProtocol(why), _) => *why == "guest access without a syndrome",
                _ => false,
            }
        }
    }
    #[cfg_attr(not(target_os = "linux"), allow(dead_code))] // KVM tests only, so far
    fn code(words: &[u32]) -> &'static [u8] {
        Box::leak(words.iter().flat_map(|w| w.to_le_bytes()).collect())
    }
    #[cfg_attr(not(target_os = "linux"), allow(dead_code))] // KVM tests only, so far
    /// EL1 accesses without a valid instruction syndrome (ESR ISV=0: pairs,
    /// writeback) to the doorbell, read-only RAM and an unbacked GPA, each
    /// followed by `b .`. KVM_RUN failed with ENOSYS for these (no MMIO
    /// emulation without a syndrome); `Slot::redirect_entry` enters them.
    pub fn syndromeless() -> Vec<(&'static str, &'static [u8], Outcome)> {
        use crate::constants::ring::{DOORBELL_GPA, RAM_GPA};
        const X2_DOORBELL: u32 = 0xd2a2_0002; // movz x2, #0x1000, lsl #16
        const X2_RAM: u32 = 0xd2b0_0002; // movz x2, #0x8000, lsl #16: the immutable kernel
        const X2_UNBACKED: u32 = 0xd2a8_0002; // movz x2, #0x4000, lsl #16
        const STP: u32 = 0xa900_0440; // stp x0, x1, [x2]
        const LDP: u32 = 0xa940_0440; // ldp x0, x1, [x2]
        const STR_PRE: u32 = 0xb800_4c40; // str w0, [x2, #4]!
        const SPIN: u32 = 0x1400_0000; // b .
        assert_eq!((DOORBELL_GPA, RAM_GPA), (0x1000_0000, 0x8000_0000));
        vec![
            (
                "stp to the doorbell",
                code(&[X2_DOORBELL, STP, SPIN]),
                Outcome::BadDoorbell,
            ),
            (
                "ldp from the doorbell",
                code(&[X2_DOORBELL, LDP, SPIN]),
                Outcome::BadDoorbell,
            ),
            (
                "stp to read-only RAM",
                code(&[X2_RAM, STP, SPIN]),
                Outcome::MemoryBound(RAM_GPA),
            ),
            (
                "writeback str to read-only RAM",
                code(&[X2_RAM, STR_PRE, SPIN]),
                Outcome::MemoryBound(RAM_GPA + 4),
            ),
            (
                "stp to an unbacked GPA",
                code(&[X2_UNBACKED, STP, SPIN]),
                Outcome::MemoryBound(0x4000_0000),
            ),
        ]
    }
    #[cfg_attr(not(target_os = "linux"), allow(dead_code))] // KVM tests only, so far
    /// `b .` at EL1: a guest that never exits.
    pub fn spin() -> &'static [u8] {
        code(&[0x1400_0000])
    }
}
