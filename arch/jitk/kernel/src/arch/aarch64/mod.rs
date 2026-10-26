use core::arch::asm;

// The assembly vectors save x0..x30, ELR and SPSR before SIMD state.
/// # Safety
/// p points to the aligned, exclusive 33-word frame saved by vectors.S. Its allocation lives
/// for the entire returned borrow; no other reference overlaps it.
pub unsafe fn trap_frame<'a>(p: *mut usize) -> &'a mut [usize] {
    // SAFETY: p points to the aligned, exclusive 33-word frame saved by vectors.S. Its
    // allocation lives for the entire returned borrow; no other reference overlaps it.
    unsafe { core::slice::from_raw_parts_mut(p, 33) }
}

pub unsafe fn doorbell(op: u32) {
    // SAFETY: Called at EL1 with the doorbell GPA mapped as device memory. op is a published
    // ABI operation; no borrowed transport payload is accessed by the host until
    // publication.
    unsafe {
        asm!("dmb ishst", "str {op:w}, [{addr}]", op=in(reg)op,
             addr=in(reg)crate::ring_abi::DOORBELL_GPA, options(nostack));
    }
}

/// # Safety
/// The host has published immutable run seed/clock fields while this vCPU is stopped. The sole
/// masked-IRQ vCPU exclusively updates kernel seed/epoch state.
pub unsafe fn boot_info() {
    // SAFETY: The host has published immutable run seed/clock fields while this vCPU is
    // stopped. The sole masked-IRQ vCPU exclusively updates kernel seed/epoch state.
    unsafe {
        core::ptr::copy_nonoverlapping(
            (crate::console::CTRL + crate::ring_abi::SEED) as *const u8,
            (&raw mut crate::SEED).cast::<u8>(),
            16,
        );
        crate::EPOCH_OFFSET = crate::console::load(crate::ring_abi::EPOCH_NS)
            .saturating_sub(crate::console::load(crate::ring_abi::MONOTONIC_NS));
    }
}

/// # Safety
/// vectors is the aligned exception table; sp and entry name validated user mappings. EL1 owns
/// initialized tables and no kernel borrow survives eret.
pub unsafe fn enter_user(vectors: *const u8, sp: usize, entry: usize) -> ! {
    // SAFETY: vectors is the aligned exception table; sp and entry name validated user
    // mappings. EL1 owns initialized tables and no kernel borrow survives eret.
    unsafe {
        asm!("msr vbar_el1,{v}","msr sp_el0,{sp}","msr elr_el1,{entry}",
             "msr spsr_el1,{mask}",".inst 0xd500419f","isb","eret",
             mask=in(reg)0x3c0u64,v=in(reg)vectors,sp=in(reg)sp,
             entry=in(reg)entry,options(noreturn));
    }
}
