//! The hypervisor seam (R10 #5): `slot` is generic over these traits, and only
//! their implementations (`kvm` on Linux, `hvf` on macOS) touch ioctls or
//! Hypervisor.framework.
//!
//! What sits behind the seam is what differs per hypervisor:
//! - `Vm`: guest-physical mappings, and the memory half of a reset (KVM reads
//!   pagemap and copies or discards private pages; HVF replaces the writable
//!   mappings or copies and cleans them). A slot owns its `Vm` and one vCPU;
//!   HVF allows one VM per process, so there the engine is one slot per process.
//! - `Vcpu`: running to the next exit, and the register half of a reset. The
//!   register file is per hypervisor (`ArchState`), because neither can read
//!   the other's: KVM enumerates registers (KVM_GET_REG_LIST), HVF has a fixed
//!   API whose coverage is checked against a recorded list at startup.
//!
//! Kicks stay backend-specific: KVM's lease signal sets `immediate_exit`, HVF's
//! `hvf::Kicker` calls hv_vcpus_exit from any thread. Both surface as
//! `Exit::Interrupted`, which the slot retries.
use crate::{
    memory::Mapping, slot::reset::ResetPolicy, slot::reset::ResetReport, snapshot::Snapshot,
};
use std::{cell::Cell, io};

/// Why `Vcpu::run` returned. A `Doorbell` is complete when it is returned
/// except on KVM, whose MMIO completion `Vcpu::settle` finishes.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Exit {
    /// A 32-bit guest store to the doorbell page; the stored value.
    Doorbell(u32),
    /// A guest access outside the writable mappings (a read-only extent or an
    /// unmapped address), including any access to the doorbell page.
    Fault { gpa: u64 },
    /// A doorbell access other than a 32-bit store.
    BadDoorbell,
    /// PSCI CPU_OFF / SYSTEM_OFF; the function id.
    Shutdown(u64),
    /// A kick, or a signal, stopped the run before or during guest execution.
    Interrupted,
    /// The slot's lease (KVM's in-process deadline) expired before entry.
    Expired { deadline_ns: u64 },
    /// Any other exit; the slot reports it as a guest protocol error.
    Other(&'static str),
}

/// A hypervisor's complete guest-visible vCPU state, as a snapshot stores it.
pub trait ArchState: Sized + Send + Sync {
    /// Decode the snapshot's `.regs` file. Must reject other formats.
    fn decode(bytes: &[u8]) -> io::Result<Self>;
    fn encode(&self) -> Vec<u8>;
}

pub trait Vcpu {
    type State: ArchState;
    /// Capture this stopped vCPU's state.
    fn save(&self) -> io::Result<Self::State>;
    /// Restore `s` into a fresh vCPU, every register included. Fails when
    /// the register set this vCPU exposes differs from `s`'s: a register the
    /// snapshot does not hold would carry tenant state across resets.
    fn load(&mut self, s: &Self::State) -> io::Result<()>;
    /// Between tenants: every register a guest or the hypervisor can change
    /// after the first run, and the run state (MP state, pending kicks).
    fn reset(&mut self, s: &Self::State) -> io::Result<()>;
    /// Ids of live registers that differ from `s` (backend-defined; 0 = run
    /// state). Empty when the vCPU matches the snapshot.
    fn mismatches(&self, s: &Self::State) -> Vec<u64>;
    /// Run to the next exit the slot must see.
    fn run(&mut self) -> io::Result<Exit>;
    /// An exit is still half-done (KVM: MMIO pending); `settle` advances the
    /// guest past it.
    fn unsettled(&self) -> bool {
        false
    }
    fn settle(&mut self) -> io::Result<()> {
        Ok(())
    }
    /// Cold boot entry: EL1h, DAIF masked, PC at `pc`.
    fn set_entry(&mut self, pc: u64) -> io::Result<()>;
    /// Offline fault probes: EL1 at `pc` with the MMU and caches off and
    /// x4/x5 = `x4`/`x5`.
    fn redirect(&mut self, pc: u64, x4: u64, x5: u64) -> io::Result<()>;
    /// Test builds: one generation's reset hits a real hypervisor rejection.
    #[cfg(test)]
    fn test_reject(&mut self, _generation: u64) -> io::Result<()> {
        Ok(())
    }
}

/// What the memory half of a reset works on.
pub struct Memory<'a, S> {
    /// The slot's RAM-sized `MAP_PRIVATE` mapping of the snapshot file.
    pub ram: &'a Mapping,
    pub snapshot: &'a Snapshot<S>,
    pub policy: &'a ResetPolicy,
    /// Set when RAM may hold private pages after this call (idle trimming).
    pub resident: &'a Cell<bool>,
}
impl<S> Memory<'_, S> {
    /// The two writable extents (arena, transport) as RAM offsets.
    pub fn writable(&self) -> impl Iterator<Item = (usize, usize)> + use<S> {
        crate::slot::writable(self.snapshot.class)
    }
}

/// What a guest-physical mapping holds.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Region {
    /// A snapshot's immutable extent (kernel, payload): read-only, executable.
    Immutable,
    /// A writable extent (arena, transport): read-write data. A backend that
    /// can withhold execute permission (HVF) does, so no instruction fetch
    /// (and no instruction cache line) ever comes from tenant-writable memory.
    Writable,
    /// The whole of RAM for offline preparation: read-write, executable.
    Boot,
}

pub trait Vm: Sized {
    type Vcpu: Vcpu;
    /// Map `len` host bytes at `host` to guest-physical `gpa` as `kind`.
    ///
    /// # Safety
    /// `host..host + len` is a live mapping that outlives the VM, or every use
    /// of `gpa` by it; `gpa` and `len` are page aligned.
    unsafe fn map(&mut self, gpa: u64, host: *mut u8, len: usize, kind: Region) -> io::Result<()>;
    /// Create the VM's vCPU. HVF: it runs only on the calling thread.
    fn vcpu(&mut self) -> io::Result<Self::Vcpu>;
    /// Return both writable extents of a stopped slot to the snapshot bytes,
    /// in host memory and in what any guest access sees, whatever memory
    /// attributes either tenant used.
    fn restore_memory(
        &mut self,
        m: &Memory<'_, <Self::Vcpu as Vcpu>::State>,
    ) -> io::Result<ResetReport>;
    /// Drop the private pages of a pristine slot (idle trim); the bytes stay
    /// the snapshot's.
    fn discard_memory(&mut self, m: &Memory<'_, <Self::Vcpu as Vcpu>::State>) -> io::Result<()>;
    /// Offline fault probes only: let the guest execute the `len` bytes of a
    /// writable extent at `gpa` (host address `host`), which the host just
    /// wrote, until the next reset. Backends without execute control: no-op.
    fn executable(&mut self, _gpa: u64, _host: *mut u8, _len: usize) -> io::Result<()> {
        Ok(())
    }
    /// Whether the immutable extent `start..end` still reads as the file, if
    /// this backend can tell without reading it (KVM: pagemap). None: the
    /// sampled check compares the bytes.
    fn immutable_intact(
        &self,
        _m: &Memory<'_, <Self::Vcpu as Vcpu>::State>,
        _start: usize,
        _end: usize,
    ) -> Option<bool> {
        None
    }
}
