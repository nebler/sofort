//! The hypervisor seam R10 #5 proposes (`hv::{Vm, Vcpu, ArchState}`), cut down
//! to what the spike needs. Only `hvf.rs` touches Hypervisor.framework; `slot.rs`
//! is generic over `Vcpu` and would be shared with a `kvm_arm64` implementation.
use std::io;

/// Why `Vcpu::run` returned. Doorbell and Shutdown are already completed: the
/// vCPU's PC is past the faulting instruction, so the saved state is resumable.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Exit {
    /// 32-bit guest store to the doorbell page (data abort, ISV=1, decoded).
    Doorbell(u32),
    /// PSCI SYSTEM_OFF / CPU_OFF over HVC; the function id.
    Shutdown(u64),
    /// Stage-2 fault outside the doorbell, or an undecodable doorbell access.
    Fault { gpa: u64, syndrome: u64 },
    /// `Kicker::kick` from another thread (hv_vcpus_exit / immediate_exit).
    Interrupted,
    /// Anything else (unexpected exception class, vtimer).
    Other(String),
}

/// Guest-visible vCPU state the reset restores. Opaque to `slot`.
pub trait ArchState: Clone {
    fn encode(&self) -> Vec<u8>;
    fn decode(b: &[u8]) -> io::Result<Self>;
    /// First differing register, for the verifying reset.
    fn diff(&self, other: &Self) -> Option<String>;
}

pub trait Vcpu {
    type State: ArchState;
    fn save(&self) -> io::Result<Self::State>;
    fn restore(&mut self, s: &Self::State) -> io::Result<()>;
    fn run(&mut self) -> io::Result<Exit>;
    /// Cold boot entry: EL1h, DAIF masked, x0 = boot argument.
    fn set_entry(&mut self, pc: u64, x0: u64) -> io::Result<()>;
    /// General register / system register (AArch64 sysreg encoding) access,
    /// for offline fixtures only.
    fn get_x(&self, n: u32) -> u64;
    fn set_x(&mut self, n: u32, v: u64) -> io::Result<()>;
    fn set_sys(&mut self, id: u16, v: u64) -> io::Result<()>;
}

pub trait Vm {
    type Vcpu: Vcpu;
    /// Map `len` host bytes at `host` to `gpa`. HVF needs 16 KiB alignment.
    fn map(&mut self, host: *mut u8, gpa: u64, len: usize, writable: bool) -> io::Result<()>;
    /// HVF: the vCPU may only run on the calling thread.
    fn vcpu(&mut self) -> io::Result<Self::Vcpu>;
}
