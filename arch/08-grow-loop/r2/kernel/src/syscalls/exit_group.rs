use crate::{console as c, mmu as m, user::*};
use core::{arch::asm, ptr::{copy_nonoverlapping, write_bytes}};
pub unsafe fn call(a: &[usize]) -> isize {
 unsafe { let n = 94;
{
                crate::trace::terminal(a[0]);
                c::print("exit=");
                c::hex(a[0]);
                c::print("\n");
                crate::off()
            }
 }
}
