use crate::{console as c, mmu as m, user::*};
use core::{arch::asm, ptr::{copy_nonoverlapping, write_bytes}};
pub unsafe fn call(a: &[usize]) -> isize {
 unsafe { let n = 63;
{
                if a[0] != 0 {
                    return -9;
                }
                if a[2] > 1024 * 1024 {
                    return -22;
                }
                if let Some(pa) = access(a[1], a[2], true) {
                    c::read(core::slice::from_raw_parts_mut(pa as *mut u8, a[2])) as isize
                } else {
                    -14
                }
            }
 }
}
