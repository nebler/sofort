//! EL0 synchronous exceptions. vectors.S saves the frame and calls `trap`; SVC64
//! is handed to the core (`user::syscall`); anything else is fatal.
use core::arch::asm;
const ESR_CLASS_SHIFT: u32 = 26;
const ESR_SVC64: u64 = 0x15;

/// Saved user frame, in words: x0..x30, ELR, SPSR, then SIMD state (vectors.S).
/// Linux arm64 syscall ABI: number in x8, arguments x0..x5, return in x0.
pub mod frame {
    pub const WORDS: usize = 33;
    pub const NR: usize = 8;
    pub const ARGS: usize = 0;
    pub const RET: usize = 0;
    pub const PC: usize = 31;
}

#[unsafe(no_mangle)]
/// # Safety
/// vectors.S supplies an aligned exclusive 33-word saved frame on the live EL1 stack with DAIF
/// masked. EL0 stays stopped, so checked user mappings cannot change during dispatch.
unsafe extern "C" fn trap(frame: *mut usize) {
    // SAFETY: vectors.S supplies an aligned exclusive 33-word saved frame on the live EL1
    // stack with DAIF masked. EL0 stays stopped, so checked user mappings cannot change
    // during dispatch; the expanded user::syscall_entry runs under this contract.
    unsafe {
        let f = core::slice::from_raw_parts_mut(frame, frame::WORDS);
        let esr: u64;
        asm!("mrs {v},esr_el1",v=out(reg) esr);
        if esr >> ESR_CLASS_SHIFT != ESR_SVC64 {
            let far: u64;
            asm!("mrs {v},far_el1",v=out(reg) far);
            crate::console::print("\x1eFAULT esr=");
            crate::console::hex(esr as usize);
            crate::console::print(" far=");
            crate::console::hex(far as usize);
            crate::console::print(" pc=");
            crate::console::hex(f[frame::PC]);
            crate::console::print("\n");
            crate::off();
        }
        // The ring kernel copies user buffers through their EL0 VAs.
        #[cfg(feature = "transport-ring")]
        asm!(".inst 0xd500409f", "isb", options(nostack)); // msr pan, #0
        crate::user::syscall_entry!(f);
    }
}
