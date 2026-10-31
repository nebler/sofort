#![no_std]
#![no_main]
use core::panic::PanicInfo;
// Architecture layer: small primitives live in `arch`; the larger arch subsystems
// below keep fixed crate-root paths (see ARCH.md, "Crate-root mounts").
mod arch;
#[cfg(not(feature = "transport-ring"))]
mod console;
#[cfg(feature = "transport-ring")]
#[path = "ring.rs"]
mod console;
// The ring ABI crate (../abi), mounted as a module rather than a Cargo
// dependency: a dependency changes this crate's metadata hash and with it
// codegen, so the images would no longer be byte-identical (ARCH.md).
#[cfg(feature = "transport-ring")]
#[allow(unused_attributes, dead_code)]
#[path = "../../abi/src/lib.rs"]
mod abi;
#[cfg(feature = "heap-trace")]
mod heap_trace;
mod memory;
mod syscalls;
mod trace;
#[cfg_attr(
    all(target_arch = "aarch64", not(feature = "transport-ring")),
    path = "arch/aarch64/wait.rs"
)]
#[cfg_attr(feature = "transport-ring", path = "wait_ring.rs")]
mod wait;
static mut EPOCH_OFFSET: u64 = 0;

#[cfg(all(feature = "qjs", not(feature = "transport-ring")))]
#[cfg_attr(target_arch = "aarch64", path = "arch/aarch64/fdt.rs")]
mod fdt;
#[cfg_attr(
    all(target_arch = "aarch64", not(feature = "transport-ring")),
    path = "arch/aarch64/mmu.rs"
)]
#[cfg_attr(
    all(target_arch = "aarch64", feature = "transport-ring"),
    path = "arch/aarch64/mmu_ring.rs"
)]
mod mmu;
#[cfg(feature = "qjs")]
static mut SEED: [u8; 16] = [0; 16];
#[unsafe(no_mangle)]
/// # Safety
/// The boot stub enters once at EL1 on the sole vCPU with DAIF masked, a valid stack and mapped
/// VMM boot data. No EL0 or interrupt handler runs during initialization.
unsafe extern "C" fn kernel_main(boot: usize) -> ! {
    // SAFETY: The boot stub enters once at EL1 on the sole vCPU with DAIF masked, a valid
    // stack and mapped VMM boot data. No EL0 or interrupt handler runs during
    // initialization.
    unsafe {
        // The VMM boot handoff (aarch64: FDT) names the console and interrupt
        // controller; arch::boot also brings up the kernel address space.
        #[cfg(not(feature = "transport-ring"))]
        {
            let _irq = arch::boot(
                boot,
                #[inline(always)]
                |info| {
                    SEED = *info.seed();
                    EPOCH_OFFSET = info.epoch_offset();
                    console::init(info.console());
                    arch::irq_init(info);
                    info.console_irq()
                },
            );
        }
        // The ring control page replaces the boot handoff.
        #[cfg(feature = "transport-ring")]
        {
            let _ = boot;
            mmu::init();
            console::boot_info();
            console::init(0);
        }

        #[cfg(feature = "qjs")]
        {
            user::run();
        }
        #[cfg(not(feature = "qjs"))]
        off()
    }
}
#[cfg(feature = "qjs")]
mod fs;
#[cfg(feature = "qjs")]
mod user;
#[panic_handler]
fn panic(_: &PanicInfo) -> ! {
    // SAFETY: The guest remains at EL1 with IRQs masked. Diagnostics are terminal and never
    // resume the interrupted kernel operation.
    unsafe {
        console::print("\x1ePANIC\n");
        off()
    }
}
/// # Safety
/// Call only at EL1 in the guest; host shutdown/FINISH is terminal.
pub unsafe fn off() -> ! {
    #[cfg(feature = "transport-ring")]
    // SAFETY: Execution is at EL1; the FINISH doorbell or PSCI SYSTEM_OFF call is terminal
    // and cannot return to user code.
    unsafe {
        arch::doorbell(crate::abi::ring::FINISH);
    }
    #[cfg(not(feature = "transport-ring"))]
    // SAFETY: Execution is at EL1; the FINISH doorbell or PSCI SYSTEM_OFF call is terminal
    // and cannot return to user code.
    unsafe {
        arch::system_off();
    }
    loop {
        core::hint::spin_loop()
    }
}
