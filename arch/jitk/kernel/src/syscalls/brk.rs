#[cfg(feature = "transport-ring")]
use crate::console as c;
use crate::{mmu as m, user::*};
pub fn call(a: &[usize; 6]) -> isize {
    // SAFETY: This masked-IRQ trap exclusively owns BRK and user tables. Bounds precede
    // mapping updates; new descriptors are flushed before EL0 resumes.
    unsafe {
        let want = a[0];
        #[cfg(feature = "transport-ring")]
        let limit = m::heap_limit();
        #[cfg(not(feature = "transport-ring"))]
        let limit = MMAP;
        if want >= HEAP && want <= limit {
            pages(BRK, want.max(BRK), true, false);
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
