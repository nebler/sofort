use crate::{console as c, mmu as m, user::*};
use core::ptr::{copy_nonoverlapping, write_bytes};
pub unsafe fn call(a: &[usize]) -> isize {
    unsafe {

                #[cfg(feature = "transport-ring")]
                if crate::console::native() && (a[0] == 1 || a[0] == 2) {
                    return crate::console::native_output(a[0], a[1], a[2]);
                }
                if a[0] == 1 || a[0] == 2 {
                    if a[0] == 2 {
                        crate::syscalls::stderr(a[1], a[2])
                    } else {
                        output(a[1], a[2])
                    }
                } else {
                    -9
                }
            
    }
}
