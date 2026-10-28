//! The KVM half of a slot reset (the pristine invariant is in slot/reset.rs).
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
use super::{KvmVcpu, KvmVm, platform::OneReg};
use crate::constants::kvm::*;
use crate::hv::Memory;
use crate::slot::reset::{Discard, ResetReport};
use crate::snapshot::{Register, Registers};
use std::{
    fs::File,
    io,
    os::unix::fs::FileExt,
    ptr,
    sync::{OnceLock, atomic::Ordering::Release},
};

const PAGE: usize = 4096;

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
pub(crate) const fn sysreg(op0: u64, op1: u64, crn: u64, crm: u64, op2: u64) -> u64 {
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

impl KvmVm {
    pub(super) fn restore(&mut self, m: &Memory<'_, Registers>) -> io::Result<ResetReport> {
        let mut report = ResetReport::default();
        match self.private_pages(m) {
            Ok(()) => {
                let src = m.snapshot.reference.ptr();
                let line = dcache_line();
                for &off in &self.dirty {
                    // SAFETY: off is a page-aligned offset inside a writable extent
                    // of both this slot's live RAM mapping and the RAM-sized
                    // read-only snapshot view; KVM is stopped and no RAM borrow
                    // exists. The copy takes raw pointers, never Rust slices, and
                    // DC CIVAC only cleans/invalidates lines of this RW mapping.
                    unsafe {
                        let dst = m.ram.ptr.add(off);
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
                m.resident.set(!self.dirty.is_empty());
            }
            Err(reason) => {
                report.private = self.dirty.len() as u32;
                report.discard = Some(reason);
                self.discard(m)?;
            }
        }
        Ok(report)
    }
    /// Fill `dirty` with the RAM offsets of every private page of both writable
    /// extents, or say why the copy path must not be used.
    fn private_pages(&mut self, m: &Memory<'_, Registers>) -> Result<(), Discard> {
        self.dirty.clear();
        if m.policy.copy_limit == 0 {
            return Err(Discard::Limit);
        }
        let pagemap = pagemap().ok_or(Discard::Unavailable)?;
        for (start, end) in m.writable() {
            let pages = (end - start) / PAGE;
            self.entries.resize(pages * 8, 0);
            let va = m.ram.ptr as usize + start;
            pagemap
                .read_exact_at(&mut self.entries, (va / PAGE * 8) as u64)
                .map_err(|_| Discard::Unavailable)?;
            for (i, e) in self.entries.as_chunks::<8>().0.iter().enumerate() {
                match classify(u64::from_le_bytes(*e)) {
                    None => return Err(Discard::Ambiguous),
                    Some(false) => {}
                    Some(true) => {
                        if self.dirty.len() == m.policy.copy_limit {
                            return Err(Discard::Limit);
                        }
                        self.dirty.push(start + i * PAGE);
                    }
                }
            }
        }
        Ok(())
    }
    pub(super) fn discard(&mut self, m: &Memory<'_, Registers>) -> io::Result<()> {
        for (start, end) in m.writable() {
            // SAFETY: catalogue extents are page aligned and within this stopped
            // slot's live MAP_PRIVATE mapping. No RAM borrow escapes.
            let r = unsafe {
                libc::madvise(
                    m.ram.ptr.add(start).cast(),
                    end - start,
                    libc::MADV_DONTNEED,
                )
            };
            if r != 0 {
                return Err(io::Error::last_os_error());
            }
        }
        m.resident.set(false);
        Ok(())
    }
    /// No private (CoW) page anywhere in the immutable extent, read from
    /// pagemap so the check does not fault its host PTEs in. None without
    /// pagemap: the extent is compared byte for byte.
    pub(super) fn intact(
        &self,
        m: &Memory<'_, Registers>,
        start: usize,
        end: usize,
    ) -> Option<bool> {
        let pagemap = pagemap()?;
        let mut entries = vec![0u8; (end - start) / PAGE * 8];
        let va = m.ram.ptr as usize + start;
        Some(
            pagemap
                .read_exact_at(&mut entries, (va / PAGE * 8) as u64)
                .is_ok()
                && entries
                    .as_chunks::<8>()
                    .0
                    .iter()
                    .all(|e| classify(u64::from_le_bytes(*e)) == Some(false)),
        )
    }
}

impl KvmVcpu {
    pub(super) fn restore_registers(&mut self, regs: &Registers) -> io::Result<()> {
        self.run.immediate_exit().store(0, Release);
        for r in regs.iter() {
            if !invariant(r.id) {
                self.try_set_bytes(r.id, &r.data)?;
            }
        }
        // PSCI CPU_OFF/SYSTEM_OFF from a hostile EL1 leave the vCPU STOPPED, and
        // its next KVM_RUN would sleep until the deadline. Snapshots are RUNNABLE.
        let mp = MpState {
            state: KVM_MP_STATE_RUNNABLE as u32,
        };
        super::try_call(&self.cpu, KVM_SET_MP_STATE, &mp as *const _ as u64)?;
        self.drains = 0;
        Ok(())
    }
    /// Test builds: a real KVM_SET_ONE_REG rejection (an id KVM does not know).
    #[cfg(test)]
    pub(super) fn reject(&mut self) -> io::Result<()> {
        self.try_set_bytes(sysreg(3, 7, 15, 15, 7), &[0; 8])
    }
    /// Registers whose live value differs from the snapshot, plus any id present
    /// on only one side, and a non-RUNNABLE MP state (reported as id 0). Values
    /// KVM computes on read are not state: the virtual and physical counters
    /// return the running count, and a timer CTL's read-only ISTATUS bit (2)
    /// reflects counter >= CVAL now. Every other bit of the CTLs is compared.
    pub(super) fn register_mismatches(&self, snapshot: &[Register]) -> Vec<u64> {
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
            super::call(&self.cpu, KVM_GET_ONE_REG, &r as *const _ as u64);
            regs.push(Register { id, data });
        }
        regs
    }
}

#[cfg(test)]
mod tests {
    use super::{classify, invariant};
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
}
