#![no_std]
#![no_main]
#[cfg(not(feature = "transport-ring"))]
use core::arch::asm;
use core::{arch::global_asm, panic::PanicInfo};
#[cfg(feature = "transport-ring")]
mod arch;
#[cfg(not(feature = "transport-ring"))]
mod console;
#[cfg(feature = "transport-ring")]
#[path = "ring.rs"]
mod console;
mod memory;
#[cfg(feature = "transport-ring")]
mod ring_abi;
mod syscalls;
mod trace;
#[cfg_attr(feature = "transport-ring", path = "arch/aarch64/wait.rs")]
mod wait;
static mut EPOCH_OFFSET: u64 = 0;
global_asm!(concat!(
    ".section .packed,\"a\"\n.incbin \"",
    env!("OUT_DIR"),
    "/payload.flat\"\n"
));

#[cfg(all(feature = "qjs", not(feature = "transport-ring")))]
mod fdt;
#[cfg_attr(feature = "transport-ring", path = "arch/aarch64/page_tables.rs")]
mod mmu;
#[cfg(feature = "qjs")]
static mut SEED: [u8; 16] = [0; 16];
#[cfg(not(feature = "transport-ring"))]
global_asm!(include_str!("boot.S"));
#[cfg(feature = "transport-ring")]
global_asm!(include_str!("arch/aarch64/boot.S"));
#[unsafe(no_mangle)]
/// # Safety
/// The boot stub enters once at EL1 on the sole vCPU with DAIF masked, a valid stack and mapped
/// VMM boot data. No EL0 or interrupt handler runs during initialization.
unsafe extern "C" fn kernel_main(fdt: usize) -> ! {
    // SAFETY: The boot stub enters once at EL1 on the sole vCPU with DAIF masked, a valid
    // stack and mapped VMM boot data. No EL0 or interrupt handler runs during
    // initialization.
    unsafe {
        #[cfg(not(feature = "transport-ring"))]
        let entry_counter = wait::ticks();
        mmu::init();
        #[cfg(not(feature = "transport-ring"))]
        {
            let config = fdt::read(fdt);
            SEED = config.seed;
            EPOCH_OFFSET = config
                .epoch
                .saturating_sub(wait::ticks_ns(if config.counter == 0 {
                    entry_counter
                } else {
                    config.counter
                }));
            console::init(config.console);
            wait::init(config.dist, config.redist, config.irq, config.tick);
            #[cfg(feature = "trace")]
            {
                console::print("\x1eirq ");
                console::hex(config.irq as usize);
                console::print("\n");
            }
        }
        #[cfg(feature = "transport-ring")]
        {
            let _ = fdt;
            arch::boot_info();
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
        arch::doorbell(ring_abi::FINISH);
    }
    #[cfg(not(feature = "transport-ring"))]
    // SAFETY: Execution is at EL1; the FINISH doorbell or PSCI SYSTEM_OFF call is terminal
    // and cannot return to user code.
    unsafe {
        asm!("hvc #0", in("x0") 0x84000008u64);
    }
    loop {
        core::hint::spin_loop()
    }
}
