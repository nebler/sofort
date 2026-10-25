use crate::{console as c, mmu as m, user::*};
use core::{arch::asm, ptr::{copy_nonoverlapping, write_bytes}};
pub unsafe fn call(a: &[usize]) -> isize {
 unsafe { let n = 64;
{
                if a[0] == 1 || a[0] == 2 {
                    output(a[1], a[2], a[0] == 2)
                } else {
                    -9
                }
            }
 }
}
