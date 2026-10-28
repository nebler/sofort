//! `hv` on Hypervisor.framework (macOS arm64), ported from the W3.0 spike
//! (hvf-spike/REPORT.md). One VM per process; the vCPU runs only on the thread
//! that created it, so the Mac engine is one slot per process.
//!
//! Exits:
//! - the doorbell store arrives as a data-abort exit (ISV=1); the engine reads
//!   the source register and advances the PC past the store, so the saved
//!   state is always resumable (no KVM-style MMIO completion);
//! - PSCI CPU_OFF / SYSTEM_OFF arrive as HVC exits;
//! - without a GIC, physical-timer (CNTP) accesses trap to the VMM and are
//!   RAZ/WI, so no CNTP state exists for a reset to miss;
//! - `Kicker::kick` (hv_vcpus_exit) stops a running vCPU from any thread.
//!
//! Registers (R10 risk 2). HVF cannot enumerate registers the way
//! KVM_GET_REG_LIST does, so the reset's coverage is the recorded table
//! `SYS_REGISTERS` (plus the 35 core and 32 SIMD registers and the SME mode
//! bits). The first vCPU of a process probes the whole register id space
//! (`probe`); if the set this macOS accepts differs from the table in any id or
//! access class, `HvfVm::vcpu` fails and no slot starts. A changed macOS
//! therefore needs a reviewed table update, never a silent gap.
//!
//! Memory (R10 risk 1): see `MemoryReset`.
use crate::constants::ring;
use crate::hv::{self, ArchState, Exit, Memory, Region};
use crate::slot::reset::ResetReport;
use std::{ffi::c_void, io, ptr, sync::OnceLock};

#[repr(C)]
struct ExitInfo {
    reason: u32,
    _pad: u32,
    syndrome: u64,
    virtual_address: u64,
    physical_address: u64,
}
#[repr(C)]
#[derive(Clone, Copy, Default, Debug, PartialEq, Eq)]
struct SmeState {
    streaming: bool,
    za: bool,
}

#[link(name = "Hypervisor", kind = "framework")]
unsafe extern "C" {
    fn hv_vm_create(config: *mut c_void) -> i32;
    fn hv_vm_destroy() -> i32;
    fn hv_vm_map(addr: *mut c_void, ipa: u64, size: usize, flags: u64) -> i32;
    fn hv_vm_unmap(ipa: u64, size: usize) -> i32;
    fn hv_vm_protect(ipa: u64, size: usize, flags: u64) -> i32;
    fn hv_vcpu_create(vcpu: *mut u64, exit: *mut *const ExitInfo, config: *mut c_void) -> i32;
    fn hv_vcpu_destroy(vcpu: u64) -> i32;
    fn hv_vcpu_get_reg(vcpu: u64, reg: u32, value: *mut u64) -> i32;
    fn hv_vcpu_set_reg(vcpu: u64, reg: u32, value: u64) -> i32;
    fn hv_vcpu_get_simd_fp_reg(vcpu: u64, reg: u32, value: *mut [u8; 16]) -> i32;
    fn hv_vcpu_get_sys_reg(vcpu: u64, reg: u16, value: *mut u64) -> i32;
    fn hv_vcpu_set_sys_reg(vcpu: u64, reg: u16, value: u64) -> i32;
    fn hv_vcpu_get_sme_state(vcpu: u64, s: *mut SmeState) -> i32;
    fn hv_vcpu_set_sme_state(vcpu: u64, s: *const SmeState) -> i32;
    fn hv_vcpu_get_vtimer_mask(vcpu: u64, masked: *mut bool) -> i32;
    fn hv_vcpu_set_vtimer_mask(vcpu: u64, masked: bool) -> i32;
    fn hv_vcpu_run(vcpu: u64) -> i32;
    fn hv_vcpus_exit(vcpus: *const u64, count: u32) -> i32;
}
unsafe extern "C" {
    /// libkern: DC CVAU and IC IVAU over the range, then DSB and ISB.
    fn sys_icache_invalidate(start: *mut c_void, len: usize);
}

// hv_vcpu_set_simd_fp_reg takes the vector by value (in q0); stable Rust has no
// SIMD-by-value FFI, so this shim loads q0 from a pointer and tail-calls it.
core::arch::global_asm!(
    ".global _jitk_hvf_set_q",
    "_jitk_hvf_set_q:",
    "ldr q0, [x2]",
    "b _hv_vcpu_set_simd_fp_reg",
);
unsafe extern "C" {
    fn jitk_hvf_set_q(vcpu: u64, reg: u32, value: *const u8) -> i32;
}

fn check(r: i32, what: &str) -> io::Result<()> {
    if r == 0 {
        Ok(())
    } else {
        Err(io::Error::other(format!("{what}: hv_return {r:#x}")))
    }
}

const READ: u64 = 1;
const WRITE: u64 = 2;
const EXEC: u64 = 4;
const REG_PC: u32 = 31;
const REG_CPSR: u32 = 34;
/// X0..X30, PC, FPCR, FPSR, CPSR (hv_reg_t 0..=34).
const CORE: usize = 35;
const SIMD: usize = 32;
const SCTLR_EL1: u16 = 0xc080;

/// How a recorded system register takes part in the reset.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Access {
    /// Read and written by the VMM: saved in the snapshot, restored by every
    /// reset, compared by the verify.
    Restored,
    /// HVF reads and accepts writes, but any VMM write (even of the value just
    /// read) makes the next hv_vcpu_run fail with HV_UNSUPPORTED, so the reset
    /// cannot restore it. Safe only because a guest cannot reach it either
    /// (`impdef_registers_are_out_of_guest_reach`); the verify compares it
    /// with its value at vCPU creation.
    Checked,
    /// HVF reads it but refuses writes.
    Fixed,
}
use Access::{Checked, Fixed, Restored};

/// The system registers Hypervisor.framework exposes on this macOS without a
/// GIC or EL2, by AArch64 encoding (op0<<14 | op1<<11 | CRn<<7 | CRm<<3 | op2,
/// hv_sys_reg_t). Recorded from `Probe` on macOS 26.6.1 (25G76), M4 Pro, and
/// reviewed; startup refuses any difference. Names follow hv_vcpu_types.h;
/// S3_4_C15_* and S3_6_C15_* are implementation-defined (Apple) registers the
/// header does not name. The ID registers (MIDR..ID_AA64MMFR2) are VMM-set and
/// restored like the rest: no guest can write them.
#[rustfmt::skip]
pub const SYS_REGISTERS: &[(u16, Access)] = &[
    (0x8004, Restored), (0x8005, Restored), (0x8006, Restored), (0x8007, Restored), // DBGBVR0_EL1 DBGBCR0_EL1 DBGWVR0_EL1 DBGWCR0_EL1
    (0x800c, Restored), (0x800d, Restored), (0x800e, Restored), (0x800f, Restored), // DBGBVR1_EL1 DBGBCR1_EL1 DBGWVR1_EL1 DBGWCR1_EL1
    (0x8010, Restored), (0x8012, Restored), (0x8014, Restored), (0x8015, Restored), // MDCCINT_EL1 MDSCR_EL1 DBGBVR2_EL1 DBGBCR2_EL1
    (0x8016, Restored), (0x8017, Restored), (0x801c, Restored), (0x801d, Restored), // DBGWVR2_EL1 DBGWCR2_EL1 DBGBVR3_EL1 DBGBCR3_EL1
    (0x801e, Restored), (0x801f, Restored), (0x8024, Restored), (0x8025, Restored), // DBGWVR3_EL1 DBGWCR3_EL1 DBGBVR4_EL1 DBGBCR4_EL1
    (0x8026, Restored), (0x8027, Restored), (0x802c, Restored), (0x802d, Restored), // DBGWVR4_EL1 DBGWCR4_EL1 DBGBVR5_EL1 DBGBCR5_EL1
    (0x802e, Restored), (0x802f, Restored), (0x8034, Restored), (0x8035, Restored), // DBGWVR5_EL1 DBGWCR5_EL1 DBGBVR6_EL1 DBGBCR6_EL1
    (0x8036, Restored), (0x8037, Restored), (0x803c, Restored), (0x803d, Restored), // DBGWVR6_EL1 DBGWCR6_EL1 DBGBVR7_EL1 DBGBCR7_EL1
    (0x803e, Restored), (0x803f, Restored), (0x8044, Restored), (0x8045, Restored), // DBGWVR7_EL1 DBGWCR7_EL1 DBGBVR8_EL1 DBGBCR8_EL1
    (0x8046, Restored), (0x8047, Restored), (0x804c, Restored), (0x804d, Restored), // DBGWVR8_EL1 DBGWCR8_EL1 DBGBVR9_EL1 DBGBCR9_EL1
    (0x804e, Restored), (0x804f, Restored), (0x8054, Restored), (0x8055, Restored), // DBGWVR9_EL1 DBGWCR9_EL1 DBGBVR10_EL1 DBGBCR10_EL1
    (0x8056, Restored), (0x8057, Restored), (0x805c, Restored), (0x805d, Restored), // DBGWVR10_EL1 DBGWCR10_EL1 DBGBVR11_EL1 DBGBCR11_EL1
    (0x805e, Restored), (0x805f, Restored), (0x8064, Restored), (0x8065, Restored), // DBGWVR11_EL1 DBGWCR11_EL1 DBGBVR12_EL1 DBGBCR12_EL1
    (0x8066, Restored), (0x8067, Restored), (0x806c, Restored), (0x806d, Restored), // DBGWVR12_EL1 DBGWCR12_EL1 DBGBVR13_EL1 DBGBCR13_EL1
    (0x806e, Restored), (0x806f, Restored), (0x8074, Restored), (0x8075, Restored), // DBGWVR13_EL1 DBGWCR13_EL1 DBGBVR14_EL1 DBGBCR14_EL1
    (0x8076, Restored), (0x8077, Restored), (0x807c, Restored), (0x807d, Restored), // DBGWVR14_EL1 DBGWCR14_EL1 DBGBVR15_EL1 DBGBCR15_EL1
    (0x807e, Restored), (0x807f, Restored), (0xc000, Restored), (0xc005, Restored), // DBGWVR15_EL1 DBGWCR15_EL1 MIDR_EL1 MPIDR_EL1
    (0xc020, Restored), (0xc021, Restored), (0xc024, Restored), (0xc025, Restored), // ID_AA64PFR0_EL1 ID_AA64PFR1_EL1 ID_AA64ZFR0_EL1 ID_AA64SMFR0_EL1
    (0xc028, Restored), (0xc029, Restored), (0xc030, Restored), (0xc031, Restored), // ID_AA64DFR0_EL1 ID_AA64DFR1_EL1 ID_AA64ISAR0_EL1 ID_AA64ISAR1_EL1
    (0xc038, Restored), (0xc039, Restored), (0xc03a, Restored), (0xc080, Restored), // ID_AA64MMFR0_EL1 ID_AA64MMFR1_EL1 ID_AA64MMFR2_EL1 SCTLR_EL1
    (0xc081, Restored), (0xc082, Restored), (0xc094, Restored), (0xc096, Restored), // ACTLR_EL1 CPACR_EL1 SMPRI_EL1 SMCR_EL1
    (0xc100, Restored), (0xc101, Restored), (0xc102, Restored), (0xc108, Restored), // TTBR0_EL1 TTBR1_EL1 TCR_EL1 APIAKEYLO_EL1
    (0xc109, Restored), (0xc10a, Restored), (0xc10b, Restored), (0xc110, Restored), // APIAKEYHI_EL1 APIBKEYLO_EL1 APIBKEYHI_EL1 APDAKEYLO_EL1
    (0xc111, Restored), (0xc112, Restored), (0xc113, Restored), (0xc118, Restored), // APDAKEYHI_EL1 APDBKEYLO_EL1 APDBKEYHI_EL1 APGAKEYLO_EL1
    (0xc119, Restored), (0xc200, Restored), (0xc201, Restored), (0xc208, Restored), // APGAKEYHI_EL1 SPSR_EL1 ELR_EL1 SP_EL0
    (0xc288, Restored), (0xc289, Restored), (0xc290, Restored), (0xc300, Restored), // AFSR0_EL1 AFSR1_EL1 ESR_EL1 FAR_EL1
    (0xc3a0, Restored), (0xc510, Restored), (0xc518, Restored), (0xc600, Restored), // PAR_EL1 MAIR_EL1 AMAIR_EL1 VBAR_EL1
    (0xc681, Restored), (0xc684, Restored), (0xc687, Restored), (0xc708, Restored), // CONTEXTIDR_EL1 TPIDR_EL1 SCXTNUM_EL1 CNTKCTL_EL1
    (0xd000, Restored), (0xde82, Restored), (0xde83, Restored), (0xde85, Restored), // CSSELR_EL1 TPIDR_EL0 TPIDRRO_EL0 TPIDR2_EL0
    (0xde87, Restored), (0xdf19, Restored), (0xdf1a, Restored), (0xe208, Restored), // SCXTNUM_EL0 CNTV_CTL_EL0 CNTV_CVAL_EL0 SP_EL1
    (0xe784, Checked), (0xe788, Checked), (0xe789, Checked), (0xe78a, Checked), // S3_4_C15_C0_4 S3_4_C15_C1_0 S3_4_C15_C1_1 S3_4_C15_C1_2
    (0xe78c, Checked), (0xe78e, Checked), (0xe78f, Checked), (0xe792, Checked), // S3_4_C15_C1_4 S3_4_C15_C1_6 S3_4_C15_C1_7 S3_4_C15_C2_2
    (0xe793, Checked), (0xe794, Checked), (0xe795, Checked), (0xe7e0, Checked), // S3_4_C15_C2_3 S3_4_C15_C2_4 S3_4_C15_C2_5 S3_4_C15_C12_0
    (0xe7ec, Checked), (0xe7ed, Checked), (0xe7ee, Checked), (0xe7ef, Checked), // S3_4_C15_C13_4 S3_4_C15_C13_5 S3_4_C15_C13_6 S3_4_C15_C13_7
    (0xe7f9, Checked), (0xe7fc, Checked), (0xf781, Checked), (0xf788, Checked), // S3_4_C15_C15_1 S3_4_C15_C15_4 S3_6_C15_C0_1 S3_6_C15_C1_0
    (0xf78a, Checked), (0xf78b, Checked), (0xf78d, Checked), (0xf78e, Checked), // S3_6_C15_C1_2 S3_6_C15_C1_3 S3_6_C15_C1_5 S3_6_C15_C1_6
    (0xf795, Checked), (0xf798, Checked), (0xf799, Checked), (0xf79b, Checked), // S3_6_C15_C2_5 S3_6_C15_C3_0 S3_6_C15_C3_1 S3_6_C15_C3_3
    (0xf79c, Checked), (0xf79d, Checked), (0xf79e, Checked), (0xf79f, Checked), // S3_6_C15_C3_4 S3_6_C15_C3_5 S3_6_C15_C3_6 S3_6_C15_C3_7
    (0xf7a0, Checked), (0xf7a1, Checked), (0xf7a2, Checked), (0xf7a3, Checked), // S3_6_C15_C4_0 S3_6_C15_C4_1 S3_6_C15_C4_2 S3_6_C15_C4_3
    (0xf7a4, Checked), (0xf7a5, Checked), (0xf7a6, Checked), (0xf7a7, Checked), // S3_6_C15_C4_4 S3_6_C15_C4_5 S3_6_C15_C4_6 S3_6_C15_C4_7
    (0xf7a8, Checked), (0xf7c1, Checked), (0xf7c2, Checked), (0xf7c3, Checked), // S3_6_C15_C5_0 S3_6_C15_C8_1 S3_6_C15_C8_2 S3_6_C15_C8_3
    (0xf7c7, Checked), (0xf7d0, Checked), (0xf7d1, Checked), (0xf7d2, Checked), // S3_6_C15_C8_7 S3_6_C15_C10_0 S3_6_C15_C10_1 S3_6_C15_C10_2
    (0xf7d3, Checked), (0xf7d4, Checked), (0xf7d5, Checked), (0xf7d6, Checked), // S3_6_C15_C10_3 S3_6_C15_C10_4 S3_6_C15_C10_5 S3_6_C15_C10_6
    (0xf7d7, Checked), // S3_6_C15_C10_7
];

/// One process-wide probe of the register id spaces this macOS accepts, on a
/// throwaway vCPU (writes to `Checked` registers would poison a real one).
#[derive(Debug, PartialEq, Eq)]
pub struct Probe {
    /// hv_reg_t values hv_vcpu_get_reg accepts.
    pub core: Vec<u32>,
    /// hv_simd_fp_reg_t values hv_vcpu_get_simd_fp_reg accepts.
    pub simd: Vec<u32>,
    /// Every hv_sys_reg_t hv_vcpu_get_sys_reg accepts, with whether writing
    /// the value just read back is accepted.
    pub sys: Vec<(u16, bool)>,
    /// hv_vcpu_get_sme_state succeeds (macOS 15.2+ on SME hardware).
    pub sme: bool,
}
impl Probe {
    fn run(id: u64) -> Self {
        let core = (0..=255u32)
            .filter(|&r| {
                let mut v = 0;
                // SAFETY: own fresh vCPU on its creating thread; live out-pointer.
                unsafe { hv_vcpu_get_reg(id, r, &mut v) == 0 }
            })
            .collect();
        let simd = (0..=255u32)
            .filter(|&r| {
                let mut q = [0u8; 16];
                // SAFETY: as above; q is a 16-byte out-buffer (hv_simd_fp_uchar16_t).
                unsafe { hv_vcpu_get_simd_fp_reg(id, r, &mut q) == 0 }
            })
            .collect();
        let sys = (0..=u16::MAX)
            .filter_map(|r| {
                let mut v = 0;
                // SAFETY: as above; the throwaway vCPU never runs.
                unsafe {
                    if hv_vcpu_get_sys_reg(id, r, &mut v) != 0 {
                        return None;
                    }
                    Some((r, hv_vcpu_set_sys_reg(id, r, v) == 0))
                }
            })
            .collect();
        let mut s = SmeState::default();
        // SAFETY: as above; live out-pointer.
        let sme = unsafe { hv_vcpu_get_sme_state(id, &mut s) } == 0;
        Self {
            core,
            simd,
            sys,
            sme,
        }
    }
    /// Fail closed unless this macOS exposes exactly the recorded registers.
    fn check(&self) -> Result<(), String> {
        let mut problems = Vec::new();
        if self.core != (0..CORE as u32).collect::<Vec<_>>() {
            problems.push(format!(
                "core registers {:?} (recorded 0..={})",
                self.core,
                CORE - 1
            ));
        }
        if self.simd != (0..SIMD as u32).collect::<Vec<_>>() {
            problems.push(format!(
                "SIMD registers {:?} (recorded 0..={})",
                self.simd,
                SIMD - 1
            ));
        }
        let recorded: Vec<(u16, bool)> = SYS_REGISTERS
            .iter()
            .map(|&(r, a)| (r, a != Fixed))
            .collect();
        let extra: Vec<_> = self.sys.iter().filter(|r| !recorded.contains(r)).collect();
        let missing: Vec<_> = recorded.iter().filter(|r| !self.sys.contains(r)).collect();
        if !extra.is_empty() {
            problems.push(format!(
                "system registers (id, writable) not in the recorded list: {extra:04x?}"
            ));
        }
        if !missing.is_empty() {
            problems.push(format!("recorded system registers (id, writable) this macOS does not expose so: {missing:04x?}"));
        }
        if problems.is_empty() {
            Ok(())
        } else {
            Err(format!(
                "Hypervisor.framework on this macOS exposes a different vCPU register set than the reset covers ({}); review it and update hvf::SYS_REGISTERS",
                problems.join("; ")
            ))
        }
    }
}
static PROBE: OnceLock<Result<Probe, String>> = OnceLock::new();
/// This process's checked probe (taken once, on a throwaway vCPU of the
/// process's VM, which must exist).
fn probed() -> Result<&'static Probe, String> {
    let probe = PROBE.get_or_init(|| {
        let mut id = 0u64;
        let mut exit = ptr::null();
        check(
            // SAFETY: out-pointers are live locals; NULL is the default vCPU config.
            unsafe { hv_vcpu_create(&mut id, &mut exit, ptr::null_mut()) },
            "hv_vcpu_create (probe)",
        )
        .map_err(|e| e.to_string())?;
        let p = Probe::run(id);
        // SAFETY: the probe vCPU is ours, on this thread, and never ran.
        unsafe { hv_vcpu_destroy(id) };
        p.check().map(|()| p)
    });
    probe.as_ref().map_err(String::clone)
}
/// The ids of one access class, in table order.
fn registers(access: Access) -> impl Iterator<Item = u16> {
    SYS_REGISTERS
        .iter()
        .filter(move |r| r.1 == access)
        .map(|r| r.0)
}
fn restored() -> impl Iterator<Item = u16> {
    registers(Restored)
}

/// An HVF vCPU's complete restorable state (`.regs`, magic `JTKHVF02`).
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct State {
    core: [u64; CORE],
    simd: [[u8; 16]; SIMD],
    /// (id, value) for every `Restored` register of `SYS_REGISTERS`.
    sys: Vec<(u16, u64)>,
    sme: (bool, bool),
}
const MAGIC: &[u8; 8] = b"JTKHVF02";
impl ArchState for State {
    fn encode(&self) -> Vec<u8> {
        let mut b = MAGIC.to_vec();
        for v in self.core {
            b.extend_from_slice(&v.to_le_bytes());
        }
        for q in &self.simd {
            b.extend_from_slice(q);
        }
        b.extend_from_slice(&(self.sys.len() as u64).to_le_bytes());
        for (id, v) in &self.sys {
            b.extend_from_slice(&u64::from(*id).to_le_bytes());
            b.extend_from_slice(&v.to_le_bytes());
        }
        b.push(self.sme.0 as u8);
        b.push(self.sme.1 as u8);
        b
    }
    fn decode(b: &[u8]) -> io::Result<Self> {
        let bad = |what: &str| {
            io::Error::new(
                io::ErrorKind::InvalidData,
                format!("HVF register file: {what}"),
            )
        };
        if b.get(..8) != Some(&MAGIC[..]) {
            return Err(bad("magic (not prepared by Hypervisor.framework)"));
        }
        let mut at = 8;
        let mut word = || -> io::Result<u64> {
            let w = b.get(at..at + 8).ok_or_else(|| bad("truncated"))?;
            at += 8;
            Ok(u64::from_le_bytes(w.try_into().unwrap()))
        };
        let mut core = [0u64; CORE];
        for v in &mut core {
            *v = word()?;
        }
        let mut simd = [[0u8; 16]; SIMD];
        for q in &mut simd {
            q[..8].copy_from_slice(&word()?.to_le_bytes());
            q[8..].copy_from_slice(&word()?.to_le_bytes());
        }
        let n = word()? as usize;
        if n > 1024 {
            return Err(bad("system register count"));
        }
        let mut sys = Vec::with_capacity(n);
        for _ in 0..n {
            let id = u16::try_from(word()?).map_err(|_| bad("system register id"))?;
            if sys.iter().any(|(i, _)| *i == id) {
                return Err(bad("duplicate system register"));
            }
            sys.push((id, word()?));
        }
        match b.get(at..) {
            Some([0, 0]) => {}
            Some([_, _]) => {
                return Err(bad("streaming SVE / ZA state is not covered by the reset"));
            }
            _ => return Err(bad("trailer")),
        }
        Ok(Self {
            core,
            simd,
            sys,
            sme: (false, false),
        })
    }
}

/// Cross-thread kick: makes a running (or the next) hv_vcpu_run return
/// HV_EXIT_REASON_CANCELED (`Exit::Interrupted`). The deadline path (R10 #9:
/// the supervisor kicks).
#[derive(Clone, Copy, Debug)]
pub struct Kicker(u64);
impl Kicker {
    pub fn kick(self) -> io::Result<()> {
        // SAFETY: hv_vcpus_exit may be called from any thread of the VM's process.
        check(unsafe { hv_vcpus_exit(&self.0, 1) }, "hv_vcpus_exit")
    }
}

/// How a reset returns the writable extents to the snapshot (R10 risk 1: a
/// guest kernel that turns its MMU or caches off).
///
/// Measured on an M4 Pro, macOS 26.6.1 (the `hvf::tests` hostile checks): a
/// cache-off EL1 guest's *data* accesses are coherent with the host's cached
/// view in both directions; it reads host stores that were never cleaned, and
/// the host sees every page it stored to. *Instruction fetch* is not: after a
/// reset that keeps the physical pages, a fixture fetched stale instructions
/// of the previous fixture on the same page in 6 to 14 of 40 runs (0 of 40
/// with an I-cache invalidate or with fresh pages). That is what the spike's
/// unfinished hostile check tripped over.
///
/// So the writable extents are mapped without execute permission at stage 2
/// (`Region::Writable`): no guest instruction fetch, and so no instruction
/// cache line, ever comes from tenant-writable memory. For data, neither mode
/// below relies on the coherency measured above.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MemoryReset {
    /// memcpy both extents from the snapshot view, then DC CIVAC every line
    /// to the point of coherency and DSB SY, as KVM's copy path does. Relies
    /// on the architectural definition of DC CIVAC (by VA, cleaned and
    /// invalidated to PoC in every cache, whatever alias or attributes put
    /// the line there), which macOS executes at EL0 (SCTLR_EL1.UCI): 1.39 MiB
    /// takes ~42 µs, whereas libkern's `sys_dcache_flush` (to PoU) is a
    /// no-op. Afterwards DRAM and every cache hold the snapshot bytes. The
    /// pages stay mapped. The default: ~70 µs per glue-2m reset.
    Copy,
    /// Replace both writable extents with fresh `MAP_PRIVATE` mappings of the
    /// snapshot file (hv_vm_unmap, mmap MAP_FIXED, hv_vm_map). The last
    /// tenant's pages go back to the kernel, so no host-side cache question
    /// remains; what this relies on is the guarantee XNU needs anyway to keep
    /// HVF guests from reading other processes' freed memory: a page a VM can
    /// map is coherent at PoC before the guest can access it. The reset itself
    /// is cheap (~24 µs), but the next run faults every page it touches back
    /// in (~170 µs per glue-2m run). Idle trim always uses it.
    Remap,
    /// memcpy only. Measurement and tests.
    Unclean,
}

pub struct HvfVm {
    /// How resets restore memory.
    pub reset: MemoryReset,
    /// A writable range an offline probe made executable (`executable`); the
    /// next reset makes it non-executable again.
    exec: Option<(u64, usize)>,
}
impl HvfVm {
    /// The process's one VM. Dropping it destroys the VM.
    pub fn create() -> io::Result<Self> {
        // SAFETY: NULL selects the default configuration; one VM per process.
        check(unsafe { hv_vm_create(ptr::null_mut()) }, "hv_vm_create")?;
        Ok(Self {
            reset: MemoryReset::Copy,
            exec: None,
        })
    }
    fn flags(kind: Region) -> u64 {
        match kind {
            Region::Immutable => READ | EXEC,
            Region::Writable => READ | WRITE,
            Region::Boot => READ | WRITE | EXEC,
        }
    }
}
impl Drop for HvfVm {
    fn drop(&mut self) {
        // SAFETY: the slot drops its vCPU before its VM (field order).
        unsafe { hv_vm_destroy() };
    }
}
/// The DC CIVAC stride. CTR_EL0 traps at EL0 on macOS; hw.cachelinesize reports
/// the line (128 on M-series), and 64 is used when it is larger: a shorter
/// stride only repeats work, a longer one could miss lines.
fn dcache_line() -> usize {
    static LINE: OnceLock<usize> = OnceLock::new();
    *LINE.get_or_init(|| {
        let mut line: u64 = 0;
        let mut n = std::mem::size_of::<u64>();
        // SAFETY: NUL-terminated name, live out-pointer and size.
        let r = unsafe {
            libc::sysctlbyname(
                c"hw.cachelinesize".as_ptr(),
                (&mut line as *mut u64).cast(),
                &mut n,
                ptr::null_mut(),
                0,
            )
        };
        assert!(
            r == 0 && n == 8 && line >= 64 && line.is_power_of_two(),
            "hw.cachelinesize"
        );
        64
    })
}
/// DC CIVAC over `len` bytes at `p`, then DSB SY.
///
/// # Safety
/// `p..p + len` is mapped in this process.
pub(crate) unsafe fn clean_to_poc(p: *mut u8, len: usize) {
    for at in (0..len).step_by(dcache_line()) {
        // SAFETY: cache maintenance by VA inside the caller's mapping.
        unsafe { core::arch::asm!("dc civac, {}", in(reg) p.add(at), options(nostack)) };
    }
    // SAFETY: a barrier with no operands: the cleans complete before return.
    unsafe { core::arch::asm!("dsb sy", options(nostack)) };
}
const GRANULE: u64 = 16384;
impl hv::Vm for HvfVm {
    type Vcpu = HvfVcpu;
    unsafe fn map(&mut self, gpa: u64, host: *mut u8, len: usize, kind: Region) -> io::Result<()> {
        check(
            // SAFETY: the caller keeps host..host+len live for the VM's lifetime;
            // HVF only records the translation.
            unsafe { hv_vm_map(host.cast(), gpa, len, Self::flags(kind)) },
            "hv_vm_map",
        )
    }
    fn vcpu(&mut self) -> io::Result<HvfVcpu> {
        // Refuse to start on a register set the reset does not cover.
        probed().map_err(io::Error::other)?;
        let mut id = 0u64;
        let mut exit = ptr::null();
        check(
            // SAFETY: out-pointers are live locals; NULL is the default vCPU config.
            unsafe { hv_vcpu_create(&mut id, &mut exit, ptr::null_mut()) },
            "hv_vcpu_create",
        )?;
        let mut v = HvfVcpu {
            id,
            exit,
            exits: 0,
            syndrome: 0,
            checked: Vec::new(),
        };
        v.checked = v.read(registers(Checked))?;
        Ok(v)
    }
    fn restore_memory(&mut self, m: &Memory<'_, State>) -> io::Result<ResetReport> {
        let mut report = ResetReport::default();
        if let Some((gpa, len)) = self.exec.take() {
            check(
                // SAFETY: a range of a writable extent this VM maps.
                unsafe { hv_vm_protect(gpa, len, Self::flags(Region::Writable)) },
                "hv_vm_protect",
            )?;
        }
        for (start, end) in m.writable() {
            let (gpa, len) = (ring::RAM_GPA + start as u64, end - start);
            report.private += (len as u64 / GRANULE) as u32;
            match self.reset {
                MemoryReset::Copy | MemoryReset::Unclean => {
                    // SAFETY: both views cover RAM; the extent lies within them;
                    // the vCPU is stopped and the reference is read-only.
                    unsafe {
                        let dst = m.ram.ptr.add(start);
                        ptr::copy_nonoverlapping(m.snapshot.reference.ptr().add(start), dst, len);
                        if self.reset == MemoryReset::Copy {
                            clean_to_poc(dst, len);
                        }
                    }
                }
                MemoryReset::Remap => {
                    // SAFETY: the vCPU is stopped on this thread; the extent was
                    // mapped by Slot::create and is mapped again below.
                    check(unsafe { hv_vm_unmap(gpa, len) }, "hv_vm_unmap")?;
                    m.ram.remap(&m.snapshot.memory, start, len)?;
                    let host = m.ram.ptr.wrapping_add(start).cast();
                    // SAFETY: the fresh mapping lives in the slot's RAM mapping,
                    // which outlives the VM.
                    let r = unsafe { hv_vm_map(host, gpa, len, Self::flags(Region::Writable)) };
                    check(r, "hv_vm_map")?;
                }
            }
        }
        m.resident.set(self.reset != MemoryReset::Remap);
        Ok(report)
    }
    fn discard_memory(&mut self, m: &Memory<'_, State>) -> io::Result<()> {
        let mode = std::mem::replace(&mut self.reset, MemoryReset::Remap);
        let r = self.restore_memory(m);
        self.reset = mode;
        r.map(|_| ())
    }
    /// The 16 KiB granules around the range become executable until the next
    /// reset; the range's instruction cache lines (an earlier fixture's code)
    /// are invalidated first.
    fn executable(&mut self, gpa: u64, host: *mut u8, len: usize) -> io::Result<()> {
        let (start, end) = (
            gpa & !(GRANULE - 1),
            (gpa + len as u64).next_multiple_of(GRANULE),
        );
        // SAFETY: the caller's range lies in a writable extent of the slot's RAM
        // mapping; libkern cleans and invalidates it to PoU.
        unsafe { sys_icache_invalidate(host.cast(), len) };
        check(
            // SAFETY: granules of a writable extent this VM maps.
            unsafe { hv_vm_protect(start, (end - start) as usize, READ | WRITE | EXEC) },
            "hv_vm_protect",
        )?;
        self.exec = Some((start, (end - start) as usize));
        Ok(())
    }
}

pub struct HvfVcpu {
    pub id: u64,
    exit: *const ExitInfo,
    pub exits: u64,
    /// ESR of the last exit, for diagnostics.
    pub syndrome: u64,
    /// `Checked` registers at creation: what the verify compares them with.
    checked: Vec<(u16, u64)>,
}
impl HvfVcpu {
    pub fn reg(&self, r: u32) -> u64 {
        let mut v = 0;
        // SAFETY: own vCPU, creating thread, live out-pointer.
        unsafe { hv_vcpu_get_reg(self.id, r, &mut v) };
        v
    }
    fn set(&self, r: u32, v: u64) -> io::Result<()> {
        // SAFETY: own vCPU on its creating thread.
        check(unsafe { hv_vcpu_set_reg(self.id, r, v) }, "hv_vcpu_set_reg")
    }
    fn read(&self, ids: impl Iterator<Item = u16>) -> io::Result<Vec<(u16, u64)>> {
        ids.map(|r| {
            let mut v = 0;
            check(
                // SAFETY: own vCPU on its creating thread; live out-pointer.
                unsafe { hv_vcpu_get_sys_reg(self.id, r, &mut v) },
                "hv_vcpu_get_sys_reg",
            )
            .map(|()| (r, v))
        })
        .collect()
    }
    fn set_sys(&self, r: u16, v: u64) -> io::Result<()> {
        check(
            // SAFETY: own vCPU on its creating thread.
            unsafe { hv_vcpu_set_sys_reg(self.id, r, v) },
            "hv_vcpu_set_sys_reg",
        )
    }
    pub fn kicker(&self) -> Kicker {
        Kicker(self.id)
    }
    fn sme(&self) -> (bool, bool) {
        let mut s = SmeState::default();
        // SAFETY: own vCPU; live out-pointer. Unsupported (pre-M4) reads as off.
        if unsafe { hv_vcpu_get_sme_state(self.id, &mut s) } == 0 {
            (s.streaming, s.za)
        } else {
            (false, false)
        }
    }
    fn vtimer_masked(&self) -> bool {
        let mut m = false;
        // SAFETY: own vCPU; live out-pointer.
        unsafe { hv_vcpu_get_vtimer_mask(self.id, &mut m) };
        m
    }
    fn restore(&mut self, s: &State) -> io::Result<()> {
        // SME first: leaving streaming mode zeroes the SVE and SIMD registers,
        // and ZA is zeroed whenever it is next enabled, so (off, off) leaves no
        // tenant SME state behind; the SIMD registers are restored after it.
        if probed().map_err(io::Error::other)?.sme {
            let sme = SmeState {
                streaming: s.sme.0,
                za: s.sme.1,
            };
            check(
                // SAFETY: own vCPU; live pointer.
                unsafe { hv_vcpu_set_sme_state(self.id, &sme) },
                "hv_vcpu_set_sme_state",
            )?;
        }
        for (i, v) in s.core.iter().enumerate() {
            self.set(i as u32, *v)?;
        }
        for (i, q) in s.simd.iter().enumerate() {
            check(
                // SAFETY: own vCPU on its creating thread; q is 16 readable bytes.
                unsafe { jitk_hvf_set_q(self.id, i as u32, q.as_ptr()) },
                "hv_vcpu_set_simd_fp_reg",
            )?;
        }
        for &(r, v) in &s.sys {
            self.set_sys(r, v)?;
        }
        // A vtimer exit masks the timer (run_once); snapshots run unmasked.
        check(
            // SAFETY: own vCPU on its creating thread.
            unsafe { hv_vcpu_set_vtimer_mask(self.id, false) },
            "hv_vcpu_set_vtimer_mask",
        )
    }
    /// One hv_vcpu_run. None: an exit handled here (CNTP access); resume.
    fn run_once(&mut self) -> io::Result<Option<Exit>> {
        // SAFETY: own vCPU on its creating thread.
        check(unsafe { hv_vcpu_run(self.id) }, "hv_vcpu_run")?;
        self.exits += 1;
        // SAFETY: HVF owns this per-vCPU exit record for the vCPU's lifetime and
        // writes it only inside hv_vcpu_run, which has returned.
        let e = unsafe { ptr::read_volatile(self.exit) };
        self.syndrome = e.syndrome;
        match e.reason {
            0 => return Ok(Some(Exit::Interrupted)),
            1 => {}
            2 => {
                // The ring kernel never arms CNTV; mask it (the reset unmasks).
                // SAFETY: own vCPU on its creating thread.
                unsafe { hv_vcpu_set_vtimer_mask(self.id, true) };
                return Ok(Some(Exit::Other("unexpected vtimer exit")));
            }
            _ => return Ok(Some(Exit::Other("unexpected HVF exit"))),
        }
        let esr = e.syndrome;
        Ok(Some(match esr >> 26 {
            0x24 => {
                // Data abort from the guest: ISV, SAS, SRT, WnR.
                if e.physical_address != ring::DOORBELL_GPA {
                    return Ok(Some(Exit::Fault {
                        gpa: e.physical_address,
                    }));
                }
                let isv = esr >> 24 & 1 == 1;
                let sas = esr >> 22 & 3;
                let srt = (esr >> 16 & 31) as u32;
                let wnr = esr >> 6 & 1 == 1;
                if !isv || !wnr || sas != 2 {
                    return Ok(Some(Exit::BadDoorbell));
                }
                let value = if srt == 31 { 0 } else { self.reg(srt) };
                // Complete the emulated store now: the saved PC is resumable.
                self.set(REG_PC, self.reg(REG_PC) + 4)?;
                Exit::Doorbell(value as u32)
            }
            0x16 => {
                // HVC: ELR already points past it. PSCI CPU_OFF / SYSTEM_OFF.
                let f = self.reg(0);
                if matches!(f, 0x8400_0002 | 0x8400_0008) {
                    Exit::Shutdown(f)
                } else {
                    Exit::Other("unexpected HVC")
                }
            }
            // ISS: Op0[21:20] Op2[19:17] Op1[16:14] CRn[13:10] Rt[9:5] CRm[4:1] Dir[0].
            0x18 if esr & 0x31fc1e == 0x30f804 => {
                // MSR/MRS CNTP_{TVAL,CTL,CVAL}_EL0 (op0 3, op1 3, CRn 14, CRm 2):
                // without a GIC, HVF traps the physical timer to the VMM. The
                // ring kernel never uses it: RAZ/WI.
                let rt = (esr >> 5 & 31) as u32;
                if esr & 1 == 1 && rt != 31 {
                    self.set(rt, 0)?;
                }
                self.set(REG_PC, self.reg(REG_PC) + 4)?;
                return Ok(None);
            }
            _ => Exit::Other("unexpected guest exception"),
        }))
    }
}
impl Drop for HvfVcpu {
    fn drop(&mut self) {
        // SAFETY: own vCPU on its creating thread; not running.
        unsafe { hv_vcpu_destroy(self.id) };
    }
}
impl hv::Vcpu for HvfVcpu {
    type State = State;
    fn save(&self) -> io::Result<State> {
        let mut core = [0u64; CORE];
        for (i, v) in core.iter_mut().enumerate() {
            check(
                // SAFETY: own vCPU on its creating thread; live out-pointer.
                unsafe { hv_vcpu_get_reg(self.id, i as u32, v) },
                "hv_vcpu_get_reg",
            )?;
        }
        let mut simd = [[0u8; 16]; SIMD];
        for (i, q) in simd.iter_mut().enumerate() {
            check(
                // SAFETY: own vCPU on its creating thread; q is a live 16-byte
                // out-buffer with the layout of hv_simd_fp_uchar16_t.
                unsafe { hv_vcpu_get_simd_fp_reg(self.id, i as u32, q) },
                "hv_vcpu_get_simd_fp_reg",
            )?;
        }
        let sys = self.read(restored())?;
        Ok(State {
            core,
            simd,
            sys,
            sme: self.sme(),
        })
    }
    fn load(&mut self, s: &State) -> io::Result<()> {
        let saved: Vec<u16> = s.sys.iter().map(|r| r.0).collect();
        if !saved.iter().copied().eq(restored()) {
            return Err(io::Error::other(
                "snapshot register file differs from the registers this engine restores (hvf::SYS_REGISTERS); prepare the snapshot again",
            ));
        }
        self.restore(s)
    }
    fn reset(&mut self, s: &State) -> io::Result<()> {
        self.restore(s)
    }
    /// Ids: core register n = 0x1_0000 + n, SIMD n = 0x2_0000 + n, system
    /// registers their encoding, SME mode 0x3_0000, a masked vtimer 0.
    fn mismatches(&self, s: &State) -> Vec<u64> {
        let Ok(live) = self.save() else {
            return vec![u64::MAX];
        };
        let mut differ: Vec<u64> = (0..CORE)
            .filter(|&i| live.core[i] != s.core[i])
            .map(|i| 0x1_0000 + i as u64)
            .collect();
        differ.extend(
            (0..SIMD)
                .filter(|&i| live.simd[i] != s.simd[i])
                .map(|i| 0x2_0000 + i as u64),
        );
        differ.extend(
            live.sys
                .iter()
                .zip(&s.sys)
                .filter(|(a, b)| a != b)
                .map(|(a, _)| u64::from(a.0)),
        );
        if live.sme != s.sme {
            differ.push(0x3_0000);
        }
        match self.read(registers(Checked)) {
            Ok(now) => differ.extend(
                now.iter()
                    .zip(&self.checked)
                    .filter(|(a, b)| a != b)
                    .map(|(a, _)| u64::from(a.0)),
            ),
            Err(_) => differ.push(u64::MAX),
        }
        if self.vtimer_masked() {
            differ.push(0);
        }
        differ
    }
    fn run(&mut self) -> io::Result<Exit> {
        loop {
            if let Some(e) = self.run_once()? {
                return Ok(e);
            }
        }
    }
    fn set_entry(&mut self, pc: u64) -> io::Result<()> {
        self.set(REG_PC, pc)?;
        self.set(REG_CPSR, 0x3c5)
    }
    fn redirect(&mut self, pc: u64, x4: u64, x5: u64) -> io::Result<()> {
        self.set(4, x4)?;
        self.set(5, x5)?;
        self.set_sys(SCTLR_EL1, 0)?; // MMU and caches off
        self.set_entry(pc)
    }
    /// A real hv_vcpu_set_sys_reg rejection: an id outside the framework's set.
    #[cfg(test)]
    fn test_reject(&mut self, generation: u64) -> io::Result<()> {
        if generation == crate::slot::test_guest::FAIL_RESET_GENERATION {
            return self.set_sys(0xc7ff, 0);
        }
        Ok(())
    }
}

/// Host state a confined engine process can no longer read (Seatbelt denies
/// sysctl): the zygote reads it once before forking, and every child inherits
/// the cached value.
pub(crate) fn warm() {
    dcache_line();
}

mod child;
/// jitk-vmm's confinement (vmm/sandbox, owner 07), compiled into the engine
/// unchanged: the HVF children enter the same Seatbelt profile, in the same
/// order (before the VM exists), as the libkrun VMM.
#[allow(dead_code, clippy::all)]
#[path = "../../vmm/sandbox/mod.rs"]
mod confine;
mod conn;
mod seatbelt;
pub mod zygote;

#[cfg(test)]
mod tests;
