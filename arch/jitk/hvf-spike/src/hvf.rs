//! `hv` on Hypervisor.framework (macOS arm64). One VM per process; the vCPU
//! runs only on the thread that created it.
use crate::hv::{ArchState, Exit, Vcpu, Vm};
use std::{ffi::c_void, io, ptr};

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
    fn hv_vcpu_create(vcpu: *mut u64, exit: *mut *const ExitInfo, config: *mut c_void) -> i32;
    fn hv_vcpu_destroy(vcpu: u64) -> i32;
    fn hv_vcpu_get_reg(vcpu: u64, reg: u32, value: *mut u64) -> i32;
    fn hv_vcpu_set_reg(vcpu: u64, reg: u32, value: u64) -> i32;
    fn hv_vcpu_get_simd_fp_reg(vcpu: u64, reg: u32, value: *mut [u8; 16]) -> i32;
    fn hv_vcpu_get_sys_reg(vcpu: u64, reg: u16, value: *mut u64) -> i32;
    fn hv_vcpu_set_sys_reg(vcpu: u64, reg: u16, value: u64) -> i32;
    fn hv_vcpu_get_sme_state(vcpu: u64, s: *mut SmeState) -> i32;
    fn hv_vcpu_set_sme_state(vcpu: u64, s: *const SmeState) -> i32;
    fn hv_vcpu_set_vtimer_mask(vcpu: u64, masked: bool) -> i32;
    fn hv_vcpu_run(vcpu: u64) -> i32;
    fn hv_vcpus_exit(vcpus: *const u64, count: u32) -> i32;
}

/// Cross-thread kick: makes a running (or the next) hv_vcpu_run return
/// HV_EXIT_REASON_CANCELED. The deadline path (R10 #9: the supervisor kicks).
#[derive(Clone, Copy)]
pub struct Kicker(u64);
impl Kicker {
    pub fn kick(self) -> io::Result<()> {
        // SAFETY: hv_vcpus_exit may be called from any thread of the VM's process.
        check(unsafe { hv_vcpus_exit(&self.0, 1) }, "hv_vcpus_exit")
    }
}

// hv_vcpu_set_simd_fp_reg takes the vector by value (in q0); stable Rust has no
// SIMD-by-value FFI, so this shim loads q0 from a pointer and tail-calls it.
core::arch::global_asm!(
    ".global _hvf_spike_set_q",
    "_hvf_spike_set_q:",
    "ldr q0, [x2]",
    "b _hv_vcpu_set_simd_fp_reg",
);
unsafe extern "C" {
    fn hvf_spike_set_q(vcpu: u64, reg: u32, value: *const u8) -> i32;
}

pub fn check(r: i32, what: &str) -> io::Result<()> {
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
/// X0..X30, PC, FPCR, FPSR, CPSR.
const CORE: usize = 35;

/// Every EL1/EL0 system register Hypervisor.framework exposes without a GIC or
/// EL2 (hv_vcpu_types.h, macOS 15.2), minus the read-only ID registers. HVF has
/// no KVM_GET_REG_LIST, so this list *is* the reset's coverage; `probe` drops
/// what this OS refuses and the snapshot records what was saved.
const SYS_CANDIDATES: &[u16] = &[
    0x8010, 0x8012, // MDCCINT_EL1, MDSCR_EL1
    0xc080, 0xc081, 0xc082, 0xc094, 0xc096, // SCTLR, ACTLR(EnTSO), CPACR, SMPRI, SMCR
    0xc100, 0xc101, 0xc102, // TTBR0, TTBR1, TCR
    0xc108, 0xc109, 0xc10a, 0xc10b, 0xc110, 0xc111, 0xc112, 0xc113, 0xc118, 0xc119, // PAC keys
    0xc200, 0xc201, 0xc208, // SPSR_EL1, ELR_EL1, SP_EL0
    0xc288, 0xc289, 0xc290, 0xc300, 0xc3a0, // AFSR0/1, ESR, FAR, PAR
    0xc510, 0xc518, 0xc600, // MAIR, AMAIR, VBAR
    0xc681, 0xc684, 0xc687, 0xc708, 0xd000, // CONTEXTIDR, TPIDR_EL1, SCXTNUM_EL1, CNTKCTL, CSSELR
    0xde82, 0xde83, 0xde85, 0xde87, // TPIDR_EL0, TPIDRRO_EL0, TPIDR2_EL0, SCXTNUM_EL0
    0xdf19, 0xdf1a, // CNTV_CTL_EL0, CNTV_CVAL_EL0
    0xe208, // SP_EL1
];
fn debug_regs() -> impl Iterator<Item = u16> {
    // DBGB{V,C}Rn_EL1, DBGW{V,C}Rn_EL1, n = 0..16.
    (0..16u16).flat_map(|n| (4..8u16).map(move |op2| 0x8000 | n << 3 | op2))
}

#[derive(Clone, PartialEq, Eq, Debug)]
pub struct State {
    core: [u64; CORE],
    simd: [[u8; 16]; 32],
    sys: Vec<(u16, u64)>,
    sme: (bool, bool),
}
impl ArchState for State {
    fn encode(&self) -> Vec<u8> {
        let mut b = b"JTKHVF01".to_vec();
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
        let bad = || io::Error::new(io::ErrorKind::InvalidData, "hvf register file");
        if b.get(..8) != Some(b"JTKHVF01") {
            return Err(bad());
        }
        let mut at = 8;
        let mut word = || -> io::Result<u64> {
            let w = b.get(at..at + 8).ok_or_else(bad)?;
            at += 8;
            Ok(u64::from_le_bytes(w.try_into().unwrap()))
        };
        let mut core = [0u64; CORE];
        for v in &mut core {
            *v = word()?;
        }
        let mut simd = [[0u8; 16]; 32];
        for q in &mut simd {
            let lo = word()?.to_le_bytes();
            let hi = word()?.to_le_bytes();
            q[..8].copy_from_slice(&lo);
            q[8..].copy_from_slice(&hi);
        }
        let n = word()? as usize;
        if n > 256 {
            return Err(bad());
        }
        let mut sys = Vec::with_capacity(n);
        for _ in 0..n {
            let id = u16::try_from(word()?).map_err(|_| bad())?;
            sys.push((id, word()?));
        }
        let tail = b.get(at..).ok_or_else(bad)?;
        if tail.len() != 2 || tail[0] > 1 || tail[1] > 1 {
            return Err(bad());
        }
        Ok(Self {
            core,
            simd,
            sys,
            sme: (tail[0] == 1, tail[1] == 1),
        })
    }
    fn diff(&self, o: &Self) -> Option<String> {
        if let Some(i) = (0..CORE).find(|&i| self.core[i] != o.core[i]) {
            return Some(format!("core reg {i}: {:#x} != {:#x}", self.core[i], o.core[i]));
        }
        if let Some(i) = (0..32).find(|&i| self.simd[i] != o.simd[i]) {
            return Some(format!("q{i}"));
        }
        if self.sys != o.sys {
            let d = self.sys.iter().zip(&o.sys).find(|(a, b)| a != b);
            return Some(format!("sys reg {d:x?}"));
        }
        (self.sme != o.sme).then(|| "sme state".into())
    }
}

pub struct HvfVm {
    _private: (),
}
impl HvfVm {
    /// The process's one VM. Dropping it destroys the VM.
    pub fn create() -> io::Result<Self> {
        // SAFETY: NULL selects the default configuration; one VM per process.
        check(unsafe { hv_vm_create(ptr::null_mut()) }, "hv_vm_create")?;
        Ok(Self { _private: () })
    }
}
impl Drop for HvfVm {
    fn drop(&mut self) {
        // SAFETY: every HvfVcpu borrows nothing from the VM but must be dropped
        // first; main() drops slots before the VM.
        unsafe { hv_vm_destroy() };
    }
}
impl Vm for HvfVm {
    type Vcpu = HvfVcpu;
    fn map(&mut self, host: *mut u8, gpa: u64, len: usize, writable: bool) -> io::Result<()> {
        let flags = READ | EXEC | if writable { WRITE } else { 0 };
        // SAFETY: host..host+len is a live mapping owned by the caller for the
        // VM's lifetime; HVF only records the translation.
        check(
            unsafe { hv_vm_map(host.cast(), gpa, len, flags) },
            "hv_vm_map",
        )
    }
    fn vcpu(&mut self) -> io::Result<HvfVcpu> {
        let mut id = 0u64;
        let mut exit = ptr::null();
        // SAFETY: out-pointers are live locals; NULL is the default vCPU config.
        check(
            unsafe { hv_vcpu_create(&mut id, &mut exit, ptr::null_mut()) },
            "hv_vcpu_create",
        )?;
        let mut v = HvfVcpu {
            id,
            exit,
            sys: Vec::new(),
            exits: 0,
        };
        v.probe();
        Ok(v)
    }
}

pub struct HvfVcpu {
    pub id: u64,
    exit: *const ExitInfo,
    /// System registers this OS lets the VMM read and write.
    pub sys: Vec<u16>,
    pub exits: u64,
}
impl HvfVcpu {
    fn probe(&mut self) {
        for r in SYS_CANDIDATES.iter().copied().chain(debug_regs()) {
            let mut v = 0;
            // SAFETY: own vCPU on its creating thread; v is a live local.
            if unsafe { hv_vcpu_get_sys_reg(self.id, r, &mut v) } == 0
                // SAFETY: as above; writing back the value just read.
                && unsafe { hv_vcpu_set_sys_reg(self.id, r, v) } == 0
            {
                self.sys.push(r);
            }
        }
    }
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
    pub fn kicker(&self) -> Kicker {
        Kicker(self.id)
    }
}
impl Drop for HvfVcpu {
    fn drop(&mut self) {
        // SAFETY: own vCPU on its creating thread; not running.
        unsafe { hv_vcpu_destroy(self.id) };
    }
}
impl Vcpu for HvfVcpu {
    type State = State;
    fn save(&self) -> io::Result<State> {
        let mut core = [0u64; CORE];
        for (i, v) in core.iter_mut().enumerate() {
            // SAFETY: own vCPU on its creating thread; live out-pointer.
            check(
                unsafe { hv_vcpu_get_reg(self.id, i as u32, v) },
                "hv_vcpu_get_reg",
            )?;
        }
        let mut simd = [[0u8; 16]; 32];
        for (i, q) in simd.iter_mut().enumerate() {
            // SAFETY: own vCPU on its creating thread; q is a live 16-byte
            // out-buffer with the layout of hv_simd_fp_uchar16_t.
            check(
                unsafe { hv_vcpu_get_simd_fp_reg(self.id, i as u32, q) },
                "hv_vcpu_get_simd_fp_reg",
            )?;
        }
        let mut sys = Vec::with_capacity(self.sys.len());
        for &r in &self.sys {
            let mut v = 0;
            // SAFETY: own vCPU on its creating thread; live out-pointer.
            check(
                unsafe { hv_vcpu_get_sys_reg(self.id, r, &mut v) },
                "hv_vcpu_get_sys_reg",
            )?;
            sys.push((r, v));
        }
        let mut sme = SmeState::default();
        // SAFETY: own vCPU; live out-pointer. Fails (and stays off) pre-M4.
        let sme = if unsafe { hv_vcpu_get_sme_state(self.id, &mut sme) } == 0 {
            (sme.streaming, sme.za)
        } else {
            (false, false)
        };
        Ok(State {
            core,
            simd,
            sys,
            sme,
        })
    }
    fn restore(&mut self, s: &State) -> io::Result<()> {
        // SME first: leaving streaming mode resets the SIMD registers.
        let sme = SmeState {
            streaming: s.sme.0,
            za: s.sme.1,
        };
        // SAFETY: own vCPU; live pointer. Unsupported (pre-M4) is ignored.
        unsafe { hv_vcpu_set_sme_state(self.id, &sme) };
        for (i, v) in s.core.iter().enumerate() {
            self.set(i as u32, *v)?;
        }
        for (i, q) in s.simd.iter().enumerate() {
            // SAFETY: own vCPU on its creating thread; q is 16 readable bytes.
            check(
                unsafe { hvf_spike_set_q(self.id, i as u32, q.as_ptr()) },
                "hv_vcpu_set_simd_fp_reg",
            )?;
        }
        for &(r, v) in &s.sys {
            // SAFETY: own vCPU on its creating thread.
            check(
                unsafe { hv_vcpu_set_sys_reg(self.id, r, v) },
                "hv_vcpu_set_sys_reg",
            )?;
        }
        Ok(())
    }
    fn get_x(&self, n: u32) -> u64 {
        self.reg(n)
    }
    fn set_x(&mut self, n: u32, v: u64) -> io::Result<()> {
        self.set(n, v)
    }
    fn set_sys(&mut self, id: u16, v: u64) -> io::Result<()> {
        // SAFETY: own vCPU on its creating thread.
        check(unsafe { hv_vcpu_set_sys_reg(self.id, id, v) }, "hv_vcpu_set_sys_reg")
    }
    fn set_entry(&mut self, pc: u64, x0: u64) -> io::Result<()> {
        self.set(REG_PC, pc)?;
        self.set(REG_CPSR, 0x3c5)?;
        self.set(0, x0)
    }
    fn run(&mut self) -> io::Result<Exit> {
        loop {
            if let Some(e) = self.run_once()? {
                return Ok(e);
            }
        }
    }
}
impl HvfVcpu {
    /// One hv_vcpu_run. None: an exit handled here (CNTP access), resume.
    fn run_once(&mut self) -> io::Result<Option<Exit>> {
        self.run_raw().map(|e| match e {
            Exit::Other(ref s) if s == "cntp" => None,
            e => Some(e),
        })
    }
    fn run_raw(&mut self) -> io::Result<Exit> {
        // SAFETY: own vCPU on its creating thread.
        check(unsafe { hv_vcpu_run(self.id) }, "hv_vcpu_run")?;
        self.exits += 1;
        // SAFETY: HVF owns this per-vCPU exit record for the vCPU's lifetime and
        // writes it only inside hv_vcpu_run, which has returned.
        let e = unsafe { ptr::read_volatile(self.exit) };
        match e.reason {
            0 => return Ok(Exit::Interrupted),
            1 => {}
            2 => {
                // The ring kernel never arms CNTV; keep it masked and report it.
                // SAFETY: own vCPU on its creating thread.
                unsafe { hv_vcpu_set_vtimer_mask(self.id, true) };
                return Ok(Exit::Other("vtimer".into()));
            }
            r => return Ok(Exit::Other(format!("exit reason {r}"))),
        }
        let esr = e.syndrome;
        match esr >> 26 {
            0x24 => {
                // Data abort from the guest: ISV, SAS, SRT, WnR.
                let isv = esr >> 24 & 1 == 1;
                let sas = esr >> 22 & 3;
                let srt = (esr >> 16 & 31) as u32;
                let wnr = esr >> 6 & 1 == 1;
                if e.physical_address != jitk_shard::constants::ring::DOORBELL_GPA
                    || !isv
                    || !wnr
                    || sas != 2
                {
                    return Ok(Exit::Fault {
                        gpa: e.physical_address,
                        syndrome: esr,
                    });
                }
                let value = if srt == 31 { 0 } else { self.reg(srt) };
                // Complete the emulated store now: the saved PC is resumable.
                self.set(REG_PC, self.reg(REG_PC) + 4)?;
                Ok(Exit::Doorbell(value as u32))
            }
            0x16 => {
                // HVC: ELR already points past it. PSCI CPU_OFF / SYSTEM_OFF.
                let f = self.reg(0);
                if matches!(f, 0x8400_0002 | 0x8400_0008) {
                    Ok(Exit::Shutdown(f))
                } else {
                    Ok(Exit::Other(format!("hvc {f:#x}")))
                }
            }
            // ISS: Op0[21:20] Op2[19:17] Op1[16:14] CRn[13:10] Rt[9:5] CRm[4:1] Dir[0].
            0x18 if esr & 0x31fc1e == 0x30f804 => {
                // MSR/MRS CNTP_{TVAL,CTL,CVAL}_EL0 (op0 3, op1 3, CRn 14, CRm 2):
                // without a GIC, HVF traps the physical timer to the VMM. The
                // ring kernel never uses it: RAZ/WI, so no CNTP state exists
                // for a reset to miss.
                let rt = (esr >> 5 & 31) as u32;
                if esr & 1 == 1 && rt != 31 {
                    self.set(rt, 0)?;
                }
                self.set(REG_PC, self.reg(REG_PC) + 4)?;
                Ok(Exit::Other("cntp".into()))
            }
            ec => Ok(Exit::Other(format!(
                "exception class {ec:#x} esr {esr:#x} pc {:#x} far {:#x}",
                self.reg(REG_PC),
                e.virtual_address
            ))),
        }
    }
}
