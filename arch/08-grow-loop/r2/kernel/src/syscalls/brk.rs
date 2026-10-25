use crate::{console as c, mmu as m, user::*};
use core::{arch::asm, ptr::{copy_nonoverlapping, write_bytes}};
pub unsafe fn call(a: &[usize]) -> isize {
 unsafe { let n = 214;
{
                let want = a[0];
                if want >= 0x680000 && want <= 0x800000 {
                    pages(BRK, want.max(BRK), true, false);
                    BRK = want;
                    m::flush();
                }
                BRK as isize
            }
 }
}
