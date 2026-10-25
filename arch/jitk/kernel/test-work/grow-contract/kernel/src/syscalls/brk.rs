use crate::{console as c, mmu as m, user::*};
use core::ptr::{copy_nonoverlapping, write_bytes};
pub unsafe fn call(a: &[usize]) -> isize {
    unsafe {

                let want = a[0];
                if want >= HEAP && want <= MMAP {
                    pages(BRK, want.max(BRK), true, false);
                    BRK = want;
                    m::flush();
                }
                BRK as isize
            
    }
}
