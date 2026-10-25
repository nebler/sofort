use crate::{console as c, mmu as m, user::*};
use core::{arch::asm, ptr::{copy_nonoverlapping, write_bytes}};
pub unsafe fn call(a: &[usize]) -> isize {
 unsafe { let n = 113;
{
                let mut ticks: u64;
                let mut hz: u64;
                asm!("mrs {t},cntvct_el0","mrs {h},cntfrq_el0",t=out(reg) ticks,h=out(reg) hz);
                if a[0] != 0 && a[0] != 1 {
                    return -22;
                }
                if let Some(pa) = access(a[1], 16, true) {
                    let t = pa as *mut u64;
                    t.write_unaligned(ticks / hz);
                    t.add(1).write_unaligned((ticks % hz) * 1_000_000_000 / hz);
                    0
                } else {
                    -14
                }
            }
 }
}
