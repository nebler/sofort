#![no_std]
#![no_main]
#![allow(static_mut_refs)]
use core::{
    arch::{asm, global_asm},
    panic::PanicInfo,
};
mod console;
mod wait;
static mut EPOCH_OFFSET: u64 = 0;
global_asm!(".section .packed,\"a\"\n.incbin \"/tmp/jitk-02/r2/qjs.flat\"\n");
#[cfg(feature = "qjs")]
mod fdt;
mod mmu;
#[cfg(feature = "qjs")]
static mut SEED: [u8; 16] = [0; 16];
global_asm!(include_str!("boot.S"));
#[unsafe(no_mangle)]
unsafe extern "C" fn kernel_main(fdt: usize) -> ! {
    unsafe {
        let entry_counter = wait::ticks();
        mmu::init();
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
#[panic_handler]
fn panic(_: &PanicInfo) -> ! {
    unsafe {
        console::print("\x1ePANIC\n");
        off()
    }
}
pub unsafe fn off() -> ! {
    unsafe {
        asm!("hvc #0", in("x0") 0x84000008u64);
    }
    loop {
        core::hint::spin_loop()
    }
}
