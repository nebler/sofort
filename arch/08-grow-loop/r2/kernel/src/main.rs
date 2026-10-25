#![no_std]
#![no_main]
#![allow(static_mut_refs)]
use core::{
    arch::{asm, global_asm},
    panic::PanicInfo,
};
mod console;
#[cfg(feature = "qjs")]
mod fdt;
mod mmu;
#[cfg(feature = "qjs")]
static mut SEED: [u8; 16] = [0; 16];
global_asm!(include_str!("boot.S"));
#[unsafe(no_mangle)]
unsafe extern "C" fn kernel_main(fdt: usize) -> ! {
    unsafe {
        mmu::init();
        console::init();
        console::print("hello jitk fdt=");
        console::hex(fdt);
        console::print("\n");
        #[cfg(feature = "qjs")]
        {
            SEED = fdt::seed(fdt);
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
        console::print("PANIC\n");
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

#[cfg(feature="qjs")]
mod syscalls;
#[cfg(feature="qjs")]
mod trace;
