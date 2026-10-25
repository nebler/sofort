use crate::{console as c, mmu as m, user::*};
use core::ptr::{copy_nonoverlapping, write_bytes};
pub unsafe fn call(a: &[usize]) -> isize {
    unsafe {
                crate::trace::terminal(a[0]);

                #[cfg(not(feature="grow-trace"))]
                { c::print("\x1eexit=");
                c::hex(a[0]);
                c::print("\n");
                }
                crate::off()
            
    }
}
