use crate::{console as c, mmu as m, user::*};
use core::ptr::{copy_nonoverlapping, write_bytes};
pub unsafe fn call(a: &[usize]) -> isize {
    unsafe {

                if a[1] < 2 {
                    return -34;
                }
                if let Some(pa) = access(a[0], 2, true) {
                    copy_nonoverlapping(b"/\0".as_ptr(), pa as *mut u8, 2);
                    2
                } else {
                    -14
                }
            
    }
}
