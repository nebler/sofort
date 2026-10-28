//! Slot reset: return all guest-writable state to the snapshot between tenants.
//!
//! Pristine invariant, established by `Slot::reset` and by `Slot::new`, and
//! required by `Slot::bind`:
//! - every byte of both writable extents (class arena, transport) equals the
//!   snapshot file. The immutable extents cannot differ: they are `PROT_READ`
//!   on the host and read-only memslots in KVM, so neither side can write them;
//! - every register in the snapshot's list was written with its snapshot value
//!   by this reset, except the ID registers in `invariant()`, which neither the
//!   guest nor KVM can change after the first run;
//! - the vCPU is RUNNABLE, no MMIO is pending and `immediate_exit` is clear;
//! - the host's ring cursors and call bitmaps are zero.
//!
//! Memory takes one of two paths. Both leave identical bytes.
//! - **Copy.** `/proc/self/pagemap` names every page of the writable extents
//!   that holds a private (CoW) copy. Each is overwritten from the read-only
//!   snapshot view and then cleaned and invalidated to the point of coherency
//!   (`DC CIVAC`). Host PTEs and KVM stage-2 mappings stay valid, so the next
//!   run does not fault them in again.
//! - **Discard.** `MADV_DONTNEED` drops every private page, and with it the
//!   stage-2 mappings (MMU notifier). The next access maps the file page again.
//!
//! Why every private page is copied and cleaned, not only those that compare
//! different: without FEAT_S2FWB, an EL1 guest with its MMU or caches off reads
//! and writes DRAM directly, and KVM keeps that coherent only by cleaning a page
//! when it maps it. The copy path keeps mappings, so after a plain memcpy the
//! snapshot bytes could sit in host cache lines while DRAM still held the last
//! tenant's data, and a host compare reads only the cached view. Writing every
//! line and cleaning it to PoC leaves DRAM and cache both holding the snapshot,
//! whatever attributes either tenant used.
//!
//! The discard path relies on that same KVM behaviour without S2FWB: the next
//! fault maps a fresh CoW page, and KVM cleans it to PoC before installing the
//! stage-2 entry. This is reasoned from KVM's source, not reproduced: under
//! nested HVF -> KVM an uncached EL1 guest saw coherent memory on both paths
//! even without the copy path's clean. Check both paths on metal without
//! FEAT_S2FWB (e.g. Neoverse N1) with the hostile fill + uncached probe test.
//!
//! The copy path skips a page only if pagemap shows it is either absent with no
//! swap entry (its next access faults in the file's page-cache page) or present
//! as a file page (`MAP_PRIVATE` never writes through to the file). Every other
//! state fails closed to discard for the whole reset: a swap or migration
//! entry, a userfaultfd/guard marker, any unknown bit, a failed or short read, a
//! host page size other than 4 KiB, or more private pages than the policy
//! limit. Misreading a clean page as private is harmless: copying the snapshot
//! over it yields the same bytes. Only the opposite direction could leak, and
//! it has no pagemap state.
use super::{CTRL, RAM, Slot};
use crate::constants::kvm::*;
use std::{
    fs::File,
    io,
    os::unix::fs::FileExt,
    ptr,
    sync::{
        OnceLock,
        atomic::{AtomicU64, Ordering::Relaxed},
    },
    time::{Duration, Instant},
};

const PAGE: usize = 4096;

/// Per-slot reset policy. The shard binary takes it as one option string.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ResetPolicy {
    /// Most private pages a reset restores by copying. Above this the reset
    /// discards, so a hot idle slot never retains more than this many private
    /// pages. 0 always discards (the pre-copy-restore behaviour).
    pub copy_limit: usize,
    /// Discard the private pages of a pristine, idle slot after this long.
    pub idle_trim: Option<Duration>,
    /// After every reset and trim, compare both writable extents with the
    /// snapshot file and every register with the snapshot; panic on mismatch.
    pub verify: bool,
    /// Every Nth admission of a slot, check its content on the live path
    /// (`Slot::admit`); 0 disables it.
    pub sample_every: u32,
}
impl Default for ResetPolicy {
    /// 128 pages (512 KiB): R9 measured 75 (`return 2`), 80 (one tool) and 98
    /// (`Promise.all(10)`) private pages per run, so typical runs stay on the
    /// copy path with ~30% headroom. It also bounds what a hot idle slot holds to
    /// about a third of the glue-2m writable window (340 pages).
    ///
    /// 2 s idle trim: a slot in rotation under any sustained load is reused far
    /// sooner (64 slots at 100 runs/s: every 0.64 s), while memory returns
    /// within ~2 s once load drops. One trimmed reuse costs one discard-path run
    /// (~230 stage-2 faults), at most once per slot per 2 s.
    ///
    /// Sampling every 1,024th admission: one check measured 0.30-0.32 ms (nested,
    /// glue-2m), ~0.3 µs per admission amortized, ~0.1% of a copy-path run.
    fn default() -> Self {
        Self {
            copy_limit: 128,
            idle_trim: Some(Duration::from_secs(2)),
            verify: false,
            sample_every: 1024,
        }
    }
}
impl ResetPolicy {
    /// Parse `copy-limit=N,idle-trim-ms=M|off,sample-every=N,verify`; omitted
    /// keys keep defaults.
    pub fn parse(s: &str) -> Result<Self, String> {
        let mut p = Self::default();
        for item in s.split(',').filter(|i| !i.is_empty()) {
            match item.split_once('=') {
                Some(("copy-limit", n)) => {
                    p.copy_limit = n.parse().map_err(|_| format!("reset policy: {item}"))?;
                }
                Some(("idle-trim-ms", "off")) => p.idle_trim = None,
                Some(("idle-trim-ms", n)) => {
                    let ms: u64 = n.parse().map_err(|_| format!("reset policy: {item}"))?;
                    p.idle_trim = Some(Duration::from_millis(ms));
                }
                Some(("sample-every", n)) => {
                    p.sample_every = n.parse().map_err(|_| format!("reset policy: {item}"))?;
                }
                None if item == "verify" => p.verify = true,
                _ => return Err(format!("reset policy: unknown option {item:?}")),
            }
        }
        if p.copy_limit > RAM / PAGE {
            return Err("reset policy: copy-limit above RAM pages".into());
        }
        Ok(p)
    }
}

/// Why a reset discarded instead of copying.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Discard {
    /// More private pages than `copy_limit` (or the limit is 0).
    Limit,
    /// A pagemap entry the copy path cannot prove clean or private.
    Ambiguous,
    /// pagemap could not be opened or read, or the page size is not 4 KiB.
    Unavailable,
}
/// A slot whose reset failed (or whose content failed a sampled check twice).
/// It is never bound again; its owner keeps serving its other slots.
#[derive(Debug)]
pub struct Quarantined(pub String);
impl std::fmt::Display for Quarantined {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "slot quarantined: {}", self.0)
    }
}
/// Process-wide counts for operators: sampled checks run, sampled checks that
/// found a pristine-flagged slot whose content differed, slots quarantined.
pub static SAMPLED: AtomicU64 = AtomicU64::new(0);
pub static SAMPLE_FAILURES: AtomicU64 = AtomicU64::new(0);
pub static QUARANTINED: AtomicU64 = AtomicU64::new(0);
#[derive(Clone, Copy, Debug, Default)]
pub struct ResetReport {
    pub ns: u64,
    /// Private pages found and restored (copy path); with Limit, how many were
    /// counted before the limit was exceeded.
    pub private: u32,
    pub discard: Option<Discard>,
}

const PRESENT: u64 = 1 << 63;
const FILE_PAGE: u64 = 1 << 61;
const EXCLUSIVE: u64 = 1 << 56;
const SOFT_DIRTY: u64 = 1 << 55;
const PFN: u64 = (1 << 55) - 1;
/// Classify one pagemap entry of a writable extent: Some(true) holds a private
/// copy, Some(false) reads as the file, None is anything else (fail closed).
/// Swap (62), uffd-wp (57), guard (58) and reserved bits are never accepted.
pub(crate) fn classify(entry: u64) -> Option<bool> {
    if entry & PRESENT != 0 {
        if entry & !(PRESENT | FILE_PAGE | EXCLUSIVE | SOFT_DIRTY | PFN) != 0 {
            return None;
        }
        // Not a file page: an anonymous CoW copy, or a special page such as the
        // zero page. Copying is correct for all of them.
        return Some(entry & FILE_PAGE == 0);
    }
    // A hole reports at most soft-dirty (from VM_SOFTDIRTY). Swap and migration
    // entries, markers and anything with PFN/offset bits are not holes.
    if entry & !SOFT_DIRTY == 0 {
        Some(false)
    } else {
        None
    }
}
/// Smallest data cache line, from CTR_EL0.DminLine (log2 of 4-byte words); Linux
/// permits or emulates both the CTR_EL0 read and DC CIVAC at EL0.
fn dcache_line() -> usize {
    static LINE: OnceLock<usize> = OnceLock::new();
    *LINE.get_or_init(|| {
        let ctr: u64;
        // SAFETY: reads an ID register into a general register; no memory access.
        unsafe { core::arch::asm!("mrs {}, ctr_el0", out(reg) ctr, options(nomem, nostack)) };
        let line = 4usize << ((ctr >> 16) & 0xf);
        assert!((16..=PAGE).contains(&line) && PAGE.is_multiple_of(line));
        line
    })
}
fn pagemap() -> Option<&'static File> {
    static PAGEMAP: OnceLock<Option<File>> = OnceLock::new();
    PAGEMAP
        .get_or_init(|| {
            // SAFETY: sysconf takes a scalar name and has no memory effects.
            let page = unsafe { libc::sysconf(libc::_SC_PAGESIZE) };
            let file = if page == PAGE as libc::c_long {
                // Positional reads only: one descriptor serves every owner thread.
                File::open("/proc/self/pagemap").ok()
            } else {
                None
            };
            if file.is_none() {
                eprintln!("shard: pagemap unavailable (page size {page}); every reset discards");
            }
            file
        })
        .as_ref()
}

/// AArch64 ID registers that no restore can change after the first KVM_RUN:
/// - the guest has no write path: all are read-only at every EL, so an MSR is
///   UNDEFINED; KVM traps the ID space (HCR_EL2.TID1-3) and serves reads from
///   per-VM values that only userspace sets;
/// - KVM does not change them while running, and since Linux 6.7 rejects
///   (-EBUSY) any changed value once the VM has run, so after `Slot::new`'s
///   full restore, writing them again is a no-op.
///
/// Classes: (3,0,0,1..7,*) the ID_PFR/DFR/MMFR/ISAR and ID_AA64* feature block;
/// (3,0,0,0,0|6) MIDR_EL1, REVIDR_EL1; (3,1,0,0,1|7) CLIDR_EL1, AIDR_EL1;
/// (3,3,0,0,1|7) CTR_EL0, DCZID_EL0. MPIDR_EL1 (3,0,0,0,5) is still restored.
/// `register_mismatches` compares every register, these included, and the
/// KVM tests run it after hostile runs.
pub(crate) fn invariant(id: u64) -> bool {
    if id >> 16 != sysreg(0, 0, 0, 0, 0) >> 16 {
        return false;
    }
    let e = id & 0xffff;
    let (op0, op1, crn, crm, op2) = (e >> 14, e >> 11 & 7, e >> 7 & 15, e >> 3 & 15, e & 7);
    matches!(
        (op0, op1, crn, crm, op2),
        (3, 0, 0, 1..=7, _) | (3, 0, 0, 0, 0 | 6) | (3, 1, 0, 0, 1 | 7) | (3, 3, 0, 0, 1 | 7)
    )
}

/// KVM id of the 64-bit AArch64 system register (op0, op1, CRn, CRm, op2).
const fn sysreg(op0: u64, op1: u64, crn: u64, crm: u64, op2: u64) -> u64 {
    KVM_REG_ARM64
        | KVM_REG_SIZE_U64
        | KVM_REG_ARM64_SYSREG
        | op0 << 14
        | op1 << 11
        | crn << 7
        | crm << 3
        | op2
}

#[repr(C)]
struct MpState {
    state: u32,
}

impl Slot {
    /// Return this stopped slot to the pristine invariant (module docs). Any
    /// failure (an ioctl or madvise the kernel rejects) quarantines this slot
    /// only: it is never bound again, and its owner keeps serving other slots.
    pub fn reset(&mut self) -> Result<ResetReport, Quarantined> {
        if let Some(why) = &self.quarantined {
            return Err(Quarantined(why.clone()));
        }
        self.pristine.set(false);
        match self.try_reset() {
            Ok(report) => {
                self.reset_at = Instant::now();
                self.pristine.set(true);
                Ok(report)
            }
            Err(e) => Err(self.quarantine(format!("reset failed: {e}"))),
        }
    }
    fn quarantine(&mut self, why: String) -> Quarantined {
        eprintln!("shard: slot quarantined, never bound again: {why}");
        QUARANTINED.fetch_add(1, Relaxed);
        self.pristine.set(false);
        self.quarantined = Some(why.clone());
        Quarantined(why)
    }
    pub fn is_quarantined(&self) -> bool {
        self.quarantined.is_some()
    }
    pub fn quarantine_reason(&self) -> Option<&str> {
        self.quarantined.as_deref()
    }
    fn try_reset(&mut self) -> io::Result<ResetReport> {
        let t = Instant::now();
        self.shutdown()?; // completes pending MMIO
        let mut report = self.restore_memory()?;
        self.run
            .immediate_exit()
            .store(0, std::sync::atomic::Ordering::Release);
        self.restore_registers()?;
        self.tx = 0;
        self.rx = 0;
        self.rx_consumed = 0;
        self.seen = 0;
        self.replied = 0;
        self.exits = 0;
        self.drains = 0;
        report.ns = t.elapsed().as_nanos() as u64;
        if self.policy.verify {
            self.verify("reset");
        }
        Ok(report)
    }
    /// The only way to a bind: reset unless pristine, then, every
    /// `sample_every`th admission, check the content the pristine flag vouches
    /// for. A mismatch is logged and counted, the slot is reset on the discard
    /// path and checked again; a second mismatch quarantines it. A slot is never
    /// handed out with content that failed a check.
    pub fn admit(&mut self) -> Result<Option<ResetReport>, Quarantined> {
        if let Some(why) = &self.quarantined {
            return Err(Quarantined(why.clone()));
        }
        let report = if self.pristine.get() {
            None
        } else {
            Some(self.reset()?)
        };
        self.admits += 1;
        let every = u64::from(self.policy.sample_every);
        if every != 0 && self.admits.is_multiple_of(every) {
            SAMPLED.fetch_add(1, Relaxed);
            if let Some(why) = self.content_mismatch() {
                SAMPLE_FAILURES.fetch_add(1, Relaxed);
                eprintln!(
                    "shard: SECURITY: a pristine-flagged slot failed the sampled content check ({why}); discard-resetting it"
                );
                let limit = std::mem::replace(&mut self.policy.copy_limit, 0);
                let reset = self.reset();
                self.policy.copy_limit = limit;
                reset?;
                if let Some(why) = self.content_mismatch() {
                    return Err(self.quarantine(format!("content after a discard reset: {why}")));
                }
            }
        }
        Ok(report)
    }
    /// The sampled live check: both writable extents byte for byte against the
    /// file; no private (CoW) page anywhere in the immutable extents, read from
    /// pagemap so the check does not fault 30 MiB of host PTEs into every
    /// sampled slot (without pagemap, those extents are compared byte for byte);
    /// every register and the MP state.
    pub fn content_mismatch(&self) -> Option<String> {
        if !self.writable_pristine() {
            return Some("writable RAM".into());
        }
        let class = self.snapshot.as_ref().unwrap().class;
        for (start, end, writable) in class.regions(RAM, CTRL) {
            if writable {
                continue;
            }
            let private = match pagemap() {
                Some(pagemap) => {
                    let mut entries = vec![0u8; (end - start) / PAGE * 8];
                    let va = self.ram.ptr as usize + start;
                    pagemap
                        .read_exact_at(&mut entries, (va / PAGE * 8) as u64)
                        .is_err()
                        || entries
                            .as_chunks::<8>()
                            .0
                            .iter()
                            .any(|e| classify(u64::from_le_bytes(*e)) != Some(false))
                }
                None => !self.matches_file(start, end),
            };
            if private {
                return Some(format!("immutable extent {start:#x}..{end:#x}"));
            }
        }
        let regs = self.register_mismatches();
        (!regs.is_empty()).then(|| format!("registers {regs:#x?}"))
    }
    fn writable(&self) -> impl Iterator<Item = (usize, usize)> + use<> {
        let class = self.snapshot.as_ref().unwrap().class;
        class
            .regions(RAM, CTRL)
            .into_iter()
            .filter(|r| r.2)
            .map(|(start, end, _)| (start, end))
    }
    fn restore_memory(&mut self) -> io::Result<ResetReport> {
        let mut report = ResetReport::default();
        match self.private_pages() {
            Ok(()) => {
                let src = self.snapshot.as_ref().unwrap().reference.ptr();
                let line = dcache_line();
                for &off in &self.dirty {
                    // SAFETY: off is a page-aligned offset inside a writable extent
                    // of both this slot's live RAM mapping and the RAM-sized
                    // read-only snapshot view; KVM is stopped and no RAM borrow
                    // exists. The copy takes raw pointers, never Rust slices, and
                    // DC CIVAC only cleans/invalidates lines of this RW mapping.
                    unsafe {
                        let dst = self.ram.ptr.add(off);
                        ptr::copy_nonoverlapping(src.add(off), dst, PAGE);
                        for at in (0..PAGE).step_by(line) {
                            core::arch::asm!("dc civac, {}", in(reg) dst.add(at), options(nostack));
                        }
                    }
                }
                // SAFETY: a barrier with no operands: the cleans above complete
                // before the reset returns and any later KVM_RUN.
                unsafe { core::arch::asm!("dsb sy", options(nostack)) };
                report.private = self.dirty.len() as u32;
                self.resident.set(!self.dirty.is_empty());
            }
            Err(reason) => {
                report.private = self.dirty.len() as u32;
                report.discard = Some(reason);
                self.discard()?;
            }
        }
        Ok(report)
    }
    /// Fill `dirty` with the RAM offsets of every private page of both writable
    /// extents, or say why the copy path must not be used.
    fn private_pages(&mut self) -> Result<(), Discard> {
        self.dirty.clear();
        if self.policy.copy_limit == 0 {
            return Err(Discard::Limit);
        }
        let pagemap = pagemap().ok_or(Discard::Unavailable)?;
        for (start, end) in self.writable() {
            let pages = (end - start) / PAGE;
            self.entries.resize(pages * 8, 0);
            let va = self.ram.ptr as usize + start;
            pagemap
                .read_exact_at(&mut self.entries, (va / PAGE * 8) as u64)
                .map_err(|_| Discard::Unavailable)?;
            for (i, e) in self.entries.as_chunks::<8>().0.iter().enumerate() {
                match classify(u64::from_le_bytes(*e)) {
                    None => return Err(Discard::Ambiguous),
                    Some(false) => {}
                    Some(true) => {
                        if self.dirty.len() == self.policy.copy_limit {
                            return Err(Discard::Limit);
                        }
                        self.dirty.push(start + i * PAGE);
                    }
                }
            }
        }
        Ok(())
    }
    fn discard(&mut self) -> io::Result<()> {
        for (start, end) in self.writable() {
            // SAFETY: catalogue extents are page aligned and within this stopped
            // slot's live MAP_PRIVATE mapping. No RAM borrow escapes.
            let r = unsafe {
                libc::madvise(
                    self.ram.ptr.add(start).cast(),
                    end - start,
                    libc::MADV_DONTNEED,
                )
            };
            if r != 0 {
                return Err(io::Error::last_os_error());
            }
        }
        self.resident.set(false);
        Ok(())
    }
    fn restore_registers(&self) -> io::Result<()> {
        for r in &self.snapshot.as_ref().unwrap().regs {
            if !invariant(r.id) {
                self.try_set_bytes(r.id, &r.data)?;
            }
        }
        // Test builds: one generation's reset hits a real KVM_SET_ONE_REG
        // rejection (an id KVM does not know), to exercise slot quarantine.
        #[cfg(test)]
        if self.generation == super::test_guest::FAIL_RESET_GENERATION {
            self.try_set_bytes(sysreg(3, 7, 15, 15, 7), &[0; 8])?;
        }
        // PSCI CPU_OFF/SYSTEM_OFF from a hostile EL1 leave the vCPU STOPPED, and
        // its next KVM_RUN would sleep until the deadline. Snapshots are RUNNABLE.
        let mp = MpState {
            state: KVM_MP_STATE_RUNNABLE as u32,
        };
        super::try_call(&self.cpu, KVM_SET_MP_STATE, &mp as *const _ as u64)?;
        Ok(())
    }
    /// A pristine slot idle for the policy's trim time drops its private pages.
    pub fn trim_due(&self) -> Option<Instant> {
        let due = self.reset_at + self.policy.idle_trim?;
        (self.pristine.get() && self.resident.get()).then_some(due)
    }
    /// Discard a pristine slot's private pages. Their bytes already equal the
    /// file, so the slot stays pristine; the next run faults them in again. A
    /// failed madvise quarantines the slot.
    pub fn trim(&mut self) {
        assert!(self.pristine.get(), "trim of a slot that is not pristine");
        if let Err(e) = self.discard() {
            self.quarantine(format!("trim failed: {e}"));
            return;
        }
        if self.policy.verify {
            self.verify("trim");
        }
    }
    pub fn is_pristine(&self) -> bool {
        self.pristine.get()
    }
    /// Whether the slot may hold private pages (false after a discard or trim).
    pub fn is_resident(&self) -> bool {
        self.resident.get()
    }
    fn verify(&self, after: &str) {
        assert!(
            self.writable_pristine(),
            "{after}: a writable page differs from the snapshot"
        );
        let regs = self.register_mismatches();
        assert!(
            regs.is_empty(),
            "{after}: registers differ from the snapshot: {regs:#x?}"
        );
    }
    /// Compare [start, end) of guest RAM with the snapshot file, read through
    /// the descriptor rather than the copy path's view.
    fn matches_file(&self, start: usize, end: usize) -> bool {
        assert!(start <= end && end <= RAM);
        let mut buf = vec![0u8; 1 << 16];
        let memory = &self.snapshot.as_ref().unwrap().memory;
        let mut off = start;
        while off < end {
            let n = (end - off).min(buf.len());
            memory.read_exact_at(&mut buf[..n], off as u64).unwrap();
            // SAFETY: [off, off+n) is inside this live RAM mapping, KVM is stopped,
            // and memcmp reads through raw pointers without a Rust borrow.
            if unsafe { libc::memcmp(self.ram.ptr.add(off).cast(), buf.as_ptr().cast(), n) } != 0 {
                return false;
            }
            off += n;
        }
        true
    }
    /// Every byte of guest RAM equals the snapshot file.
    pub fn pristine(&self) -> bool {
        self.matches_file(0, RAM)
    }
    /// Every byte of both writable extents equals the snapshot file.
    pub fn writable_pristine(&self) -> bool {
        self.writable()
            .all(|(start, end)| self.matches_file(start, end))
    }
    /// Registers whose live value differs from the snapshot, plus any id present
    /// on only one side, and a non-RUNNABLE MP state (reported as id 0). Values
    /// KVM computes on read are not state: the virtual and physical counters
    /// return the running count, and a timer CTL's read-only ISTATUS bit (2)
    /// reflects counter >= CVAL now. Every other bit of the CTLs is compared.
    pub fn register_mismatches(&self) -> Vec<u64> {
        const CNTPCT_EL0: u64 = sysreg(3, 3, 14, 0, 1);
        const CNTP_CTL_EL0: u64 = sysreg(3, 3, 14, 2, 1);
        const CNTV_CTL_EL0: u64 = sysreg(3, 3, 14, 3, 1);
        let same = |id: u64, a: &[u8], b: &[u8]| {
            if id == CNTP_CTL_EL0 || id == CNTV_CTL_EL0 {
                let ctl = |v: &[u8]| u64::from_le_bytes(v.try_into().unwrap()) & !4;
                ctl(a) == ctl(b)
            } else {
                a == b
            }
        };
        let snapshot = &self.snapshot.as_ref().unwrap().regs;
        let live = self.capture();
        let mut differ: Vec<u64> = live
            .iter()
            .filter(|l| l.id != KVM_REG_ARM_TIMER_CNT && l.id != CNTPCT_EL0)
            .filter(|l| {
                !snapshot
                    .iter()
                    .any(|s| s.id == l.id && same(l.id, &s.data, &l.data))
            })
            .map(|l| l.id)
            .collect();
        differ.extend(
            snapshot
                .iter()
                .filter(|s| !live.iter().any(|l| l.id == s.id))
                .map(|s| s.id),
        );
        let mut mp = MpState { state: u32::MAX };
        super::call(&self.cpu, KVM_GET_MP_STATE, &mut mp as *mut _ as u64);
        if u64::from(mp.state) != KVM_MP_STATE_RUNNABLE {
            differ.push(0);
        }
        differ
    }
}

#[cfg(test)]
mod tests {
    use super::{ResetPolicy, classify, invariant};
    use std::time::Duration;
    #[test]
    fn pagemap_states_fail_closed() {
        assert_eq!(classify(0), Some(false), "hole");
        assert_eq!(classify(1 << 55), Some(false), "soft-dirty hole");
        assert_eq!(classify(1 << 63 | 1 << 61), Some(false), "file page");
        assert_eq!(
            classify(1 << 63 | 1 << 61 | 1 << 56 | 0x1234),
            Some(false),
            "file page with PFN"
        );
        assert_eq!(classify(1 << 63), Some(true), "private page");
        assert_eq!(
            classify(1 << 63 | 1 << 56 | 1 << 55 | 0x1234),
            Some(true),
            "private with PFN"
        );
        for bad in [
            1u64 << 62,        // swapped private page
            1 << 62 | 0x3e0,   // swap type/offset
            1 << 62 | 1 << 61, // swapped shmem/file
            1 << 63 | 1 << 62, // never valid together
            1 << 63 | 1 << 57, // uffd-wp
            1 << 58,           // guard marker
            1 << 63 | 1 << 59, // reserved
            1 << 63 | 1 << 60, // reserved
            0x20,              // offset bits without swap
            1 << 61,           // file bit on a hole
            1 << 56,           // exclusive on a hole
        ] {
            assert_eq!(classify(bad), None, "{bad:#x}");
        }
    }
    #[test]
    fn only_id_registers_are_invariant() {
        let sys = |op0: u64, op1: u64, crn: u64, crm: u64, op2: u64| {
            0x6030_0000_0013_0000 | op0 << 14 | op1 << 11 | crn << 7 | crm << 3 | op2
        };
        // The encoding matches the UAPI header's own CNTVCT_EL0 id.
        assert_eq!(
            super::sysreg(3, 3, 14, 3, 2),
            crate::constants::kvm::KVM_REG_ARM_TIMER_CNT
        );
        assert_eq!(super::sysreg(3, 3, 14, 3, 2), sys(3, 3, 14, 3, 2));
        for crm in 1..=7 {
            for op2 in 0..8 {
                assert!(invariant(sys(3, 0, 0, crm, op2)));
            }
        }
        for id in [
            sys(3, 0, 0, 0, 0),
            sys(3, 0, 0, 0, 6),
            sys(3, 1, 0, 0, 1),
            sys(3, 1, 0, 0, 7),
        ] {
            assert!(invariant(id));
        }
        assert!(invariant(sys(3, 3, 0, 0, 1)) && invariant(sys(3, 3, 0, 0, 7)));
        for id in [
            sys(3, 0, 0, 0, 5),                                  // MPIDR_EL1
            sys(3, 0, 1, 0, 0),                                  // SCTLR_EL1
            sys(3, 0, 0, 8, 0),                                  // outside the ID block
            sys(3, 3, 13, 0, 2),                                 // TPIDR_EL0
            sys(3, 3, 13, 0, 3),                                 // TPIDRRO_EL0
            sys(3, 0, 13, 0, 4),                                 // TPIDR_EL1
            sys(3, 2, 0, 0, 0),                                  // CSSELR_EL1
            sys(3, 3, 0, 0, 0),                                  // (3,3,0,0,0) is not CTR_EL0
            sys(2, 0, 0, 1, 0),                                  // op0=2 debug space
            0x6030_0000_0010_0000,                               // core register x0
            0x6030_0000_0014_0000,                               // firmware pseudo-register
            sys(3, 0, 0, 1, 0) & !(0x0030 << 48) | 0x0020 << 48, // 32-bit width
        ] {
            assert!(!invariant(id), "{id:#x}");
        }
    }
    #[test]
    fn reset_policy_parses_and_rejects() {
        assert_eq!(ResetPolicy::parse("").unwrap(), ResetPolicy::default());
        let p = ResetPolicy::parse("copy-limit=0,idle-trim-ms=off,verify").unwrap();
        assert_eq!((p.copy_limit, p.idle_trim, p.verify), (0, None, true));
        let p = ResetPolicy::parse("idle-trim-ms=50").unwrap();
        assert_eq!(p.idle_trim, Some(Duration::from_millis(50)));
        assert_eq!(ResetPolicy::default().sample_every, 1024);
        assert_eq!(
            ResetPolicy::parse("sample-every=0").unwrap().sample_every,
            0
        );
        assert!(ResetPolicy::parse("sample-every=-1").is_err());
        for bad in [
            "copy-limit=-1",
            "copy-limit=9000",
            "idle-trim-ms=x",
            "verify=1",
            "fast",
        ] {
            assert!(ResetPolicy::parse(bad).is_err(), "{bad}");
        }
    }
}
