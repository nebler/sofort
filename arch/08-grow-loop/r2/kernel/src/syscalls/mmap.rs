use crate::{console as c, mmu as m, user::*};
use core::{arch::asm, ptr::{copy_nonoverlapping, write_bytes}};
pub unsafe fn call(a: &[usize]) -> isize {
 unsafe { let n = 222;
{
                if a[0] != 0 || a[1] == 0 || a[2] != 3 || a[3] & 0x20 == 0 || a[3] & 0x10 != 0 {
                    return -22;
                }
                let Some(len) = a[1].checked_add(4095).map(|x| x & !4095) else {
                    return -12;
                };
                let base = NEXT;
                let Some(end) = base.checked_add(len) else {
                    return -12;
                };
                if end > 0x1e00000 {
                    return -12;
                }
                pages(base, end, true, false);
                write_bytes(m::physical(base) as *mut u8, 0, len);
                NEXT = end;
                m::flush();
                base as isize
            }
 }
}
