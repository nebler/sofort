#[cfg(feature = "transport-ring")]
use crate::console as c;
use crate::{mmu as m, user::*};
use core::ptr::write_bytes;
pub fn call(a: &[usize; 6]) -> isize {
    // SAFETY: This masked-IRQ trap exclusively owns BRK and user tables. Bounds precede
    // mapping updates; a newly mapped heap page is zeroed through its own physical
    // backing, and descriptors are flushed before EL0 resumes.
    unsafe {
        let want = a[0];
        #[cfg(feature = "transport-ring")]
        let limit = m::heap_limit();
        #[cfg(not(feature = "transport-ring"))]
        let limit = MMAP;
        if want >= HEAP && want <= limit {
            // As Linux: pages above the new break are unmapped, and pages it
            // maps again read as zero (no stale heap from before a shrink).
            let (old_end, new_end) = ((BRK + 4095) & !4095, (want + 4095) & !4095);
            for va in (old_end..new_end).step_by(4096) {
                pages(va, va + 4096, true, false);
                write_bytes(m::physical(va) as *mut u8, 0, 4096);
            }
            for va in (new_end..old_end).step_by(4096) {
                m::unmap(va);
            }
            BRK = want;
            m::flush();
        }
        #[cfg(feature = "transport-ring")]
        if want > limit {
            c::print("arena brk denied want=");
            c::hex(want);
            c::print(" limit=");
            c::hex(limit);
            c::print("\n");
        }
        BRK as isize
    }
}
