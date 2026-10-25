use crate::{console as c, mmu as m, user::*};
use core::ptr::{copy_nonoverlapping, write_bytes};
pub unsafe fn call(a: &[usize]) -> isize {
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
                BRK as isize
            
    }
}
