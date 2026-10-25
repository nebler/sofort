#![no_std]
#![no_main]
#![allow(static_mut_refs)]
use core::{
    arch::{asm, global_asm},
    panic::PanicInfo,
};
#[cfg(not(feature = "transport-ring"))]
mod console;
#[cfg(feature = "transport-ring")]
#[path = "ring.rs"]
mod console;
#[cfg(feature = "transport-ring")]
mod arch;
mod syscalls;
mod trace;
#[cfg_attr(feature = "transport-ring", path = "arch/aarch64/wait.rs")]
mod wait;
static mut EPOCH_OFFSET: u64 = 0;
global_asm!(concat!(".section .packed,\"a\"\n.incbin \"", env!("OUT_DIR"), "/payload.flat\"\n"));

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
unsafe extern "C" fn kernel_main(fdt: usize) -> ! {
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
        { let _ = fdt; arch::boot_info(); console::init(0); }

        #[cfg(feature = "qjs")]
        {
            user::run();
        }
        #[cfg(not(feature = "qjs"))]
        off()
    }
}
#[cfg(feature = "qjs")]
mod user;
#[cfg(feature = "qjs")]
mod fs;
#[panic_handler]
fn panic(_: &PanicInfo) -> ! {
    unsafe {
        console::print("\x1ePANIC\n");
        off()
    }
}
pub unsafe fn off() -> ! {
    #[cfg(feature = "transport-ring")]
    unsafe { arch::doorbell(3); }
    #[cfg(not(feature = "transport-ring"))]
    unsafe {
        asm!("hvc #0", in("x0") 0x84000008u64);
    }
    loop {
        core::hint::spin_loop()
    }
}
