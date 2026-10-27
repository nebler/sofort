//! AArch64: EL1 kernel, EL0 user, stage-1 4 KiB pages, libkrun/KVM/HVF virt platform.
//! Every function here is `#[inline(always)]`: it replaces inline assembly that
//! used to sit in the core, so the generated code is unchanged.
use core::arch::{asm, global_asm};

#[cfg(not(feature = "transport-ring"))]
global_asm!(include_str!("boot.S"));
#[cfg(feature = "transport-ring")]
global_asm!(include_str!("boot-ring.S"));
#[cfg(feature = "qjs")]
global_asm!(include_str!("vectors.S"));
#[cfg(feature = "qjs")]
mod trap;
#[cfg(feature = "qjs")]
pub use trap::frame;

/// Guest physical RAM base and the packed user image inside it (libkrun aarch64
/// places RAM at 2 GiB; link.ld and the packer use the same numbers).
pub const RAM_GPA: usize = 0x80000000;
pub const PACKED_GPA: usize = 0x80080000;

/// VMM boot handoff: the parsed FDT (x0 at entry) plus the counter value at
/// kernel entry. Borrowed only while kernel_main initializes devices.
#[cfg(all(feature = "qjs", not(feature = "transport-ring")))]
pub struct BootInfo<'a> {
    config: &'a crate::fdt::Config,
    entry_counter: u64,
}
#[cfg(all(feature = "qjs", not(feature = "transport-ring")))]
impl BootInfo<'_> {
    #[inline(always)]
    pub fn seed(&self) -> &[u8; 16] {
        &self.config.seed
    }
    /// Unix epoch minus the monotonic clock. Without a paired counter the
    /// epoch is taken to be kernel entry.
    #[inline(always)]
    pub fn epoch_offset(&self) -> u64 {
        let c = self.config;
        c.epoch
            .saturating_sub(crate::wait::ticks_ns(if c.counter == 0 {
                self.entry_counter
            } else {
                c.counter
            }))
    }
    #[inline(always)]
    pub fn console(&self) -> usize {
        self.config.console
    }
    #[inline(always)]
    pub fn console_irq(&self) -> u32 {
        self.config.irq
    }
}
/// Bring up the kernel address space, parse the boot handoff and run `init`
/// with it (console, interrupt controller, clock baseline).
/// # Safety
/// Called once, first, from kernel_main at EL1 with DAIF masked. `arg` is the VMM's FDT
/// address in boot RAM, immutable until this returns.
#[cfg(all(feature = "qjs", not(feature = "transport-ring")))]
#[inline(always)]
pub unsafe fn boot<R>(arg: usize, init: impl FnOnce(&BootInfo) -> R) -> R {
    // SAFETY: Called once, first, at EL1 with DAIF masked; the VMM keeps the FDT immutable
    // in mapped boot RAM while it is parsed.
    unsafe {
        let entry_counter = crate::wait::ticks();
        crate::mmu::init();
        let config = crate::fdt::read(arg);
        init(&BootInfo {
            config: &config,
            entry_counter,
        })
    }
}
/// # Safety
/// Called once after console init, before EL0, with DAIF masked.
#[cfg(all(feature = "qjs", not(feature = "transport-ring")))]
#[inline(always)]
pub unsafe fn irq_init(info: &BootInfo) {
    let c = info.config;
    // SAFETY: Called once at EL1 before EL0 with DAIF masked; the FDT named the mapped GIC
    // and console SPI.
    unsafe { crate::wait::init(c.dist, c.redist, c.irq, c.tick) }
}

/// Publish code/data written through the kernel alias of user VAs [start, end)
/// before EL0 executes it.
/// # Safety
/// The range is mapped and EL0 is stopped; called at EL1 after the last write.
#[cfg(feature = "qjs")]
#[inline(always)]
pub unsafe fn sync_icache(start: usize, end: usize) {
    // SAFETY: DC CVAU/IC IALLU only clean/invalidate caches for mapped kernel aliases;
    // they lend no references and EL0 is stopped.
    unsafe {
        for va in (start..end).step_by(64) {
            asm!("dc cvau,{a}",a=in(reg) crate::mmu::physical(va));
        }
        asm!("dsb ish", "ic iallu", "dsb ish", "isb");
    }
}

/// Install the exception vectors and drop to EL0 at `entry` with stack `sp`.
/// # Safety
/// sp and entry name validated user mappings. EL1 owns initialized tables and no kernel
/// borrow survives eret.
#[cfg(feature = "qjs")]
#[inline(always)]
pub unsafe fn enter_user(sp: usize, entry: usize) -> ! {
    // SAFETY: these symbols are supplied by the guest linker/assembly with the
    // declared addresses and storage.
    unsafe extern "C" {
        static vectors: u8;
    }
    // SAFETY: vectors is the aligned exception table; sp and entry name validated user
    // mappings. EL1 owns initialized tables and no kernel borrow survives eret.
    unsafe {
        asm!("msr vbar_el1,{v}","msr sp_el0,{sp}","msr elr_el1,{entry}",
             "msr spsr_el1,{mask}",".inst 0xd500419f","isb","eret",
             mask=in(reg)0x3c0u64,v=in(reg)&raw const vectors,sp=in(reg)sp,
             entry=in(reg)entry,options(noreturn));
    }
}

/// PSCI SYSTEM_OFF. Returns only if the VMM ignores it.
/// # Safety
/// Call only at EL1 in the guest; shutdown is terminal.
#[cfg(not(feature = "transport-ring"))]
#[inline(always)]
pub unsafe fn system_off() {
    // SAFETY: Execution is at EL1; PSCI SYSTEM_OFF is terminal and cannot return to user code.
    unsafe {
        asm!("hvc #0", in("x0") 0x84000008u64);
    }
}

/// Ring transport doorbell: order prior stores, then one MMIO write.
/// # Safety
/// Called at EL1 with the doorbell GPA mapped as device memory.
#[cfg(feature = "transport-ring")]
pub unsafe fn doorbell(op: u32) {
    // SAFETY: Called at EL1 with the doorbell GPA mapped as device memory. op is a published
    // ABI operation; no borrowed transport payload is accessed by the host until
    // publication.
    unsafe {
        asm!("dmb ishst", "str {op:w}, [{addr}]", op=in(reg)op,
             addr=in(reg)crate::ring_abi::DOORBELL_GPA, options(nostack));
    }
}
