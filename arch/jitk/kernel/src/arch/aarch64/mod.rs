use core::arch::asm;

// The assembly vectors save x0..x30, ELR and SPSR before SIMD state.
pub unsafe fn trap_frame<'a>(p: *mut usize) -> &'a mut [usize] {
    unsafe { core::slice::from_raw_parts_mut(p, 33) }
}

pub unsafe fn doorbell(op: u32) {
    unsafe {
        asm!("dmb ishst", "str {op:w}, [{addr}]", op=in(reg)op,
             addr=in(reg)0x10000000usize, options(nostack));
    }
}

pub unsafe fn boot_info() {
    unsafe {
        crate::SEED.copy_from_slice(core::slice::from_raw_parts(
            (crate::console::CTRL + 0x208) as *const u8,
            16,
        ));
        crate::EPOCH_OFFSET =
            crate::console::load(0x218).saturating_sub(crate::console::load(0x220));
    }
}

pub unsafe fn enter_user(vectors: *const u8, sp: usize, entry: usize) -> ! {
    unsafe {
        asm!("msr vbar_el1,{v}","msr sp_el0,{sp}","msr elr_el1,{entry}",
             "msr spsr_el1,{mask}",".inst 0xd500419f","isb","eret",
             mask=in(reg)0x3c0u64,v=in(reg)vectors,sp=in(reg)sp,
             entry=in(reg)entry,options(noreturn));
    }
}
