use crate::{console as c, mmu as m, user::*};
use core::{arch::asm, ptr::{copy_nonoverlapping, write_bytes}};
pub unsafe fn call(a: &[usize]) -> isize {
 unsafe { let n = 65;
{
                if a[2] > 1024 {
                    return -22;
                }
                let Some(pa) = access(a[1], a[2] * 16, false) else {
                    return -14;
                };
                let mut total = 0;
                if n == 65 {
                    if a[0] != 0 {
                        return -9;
                    }
                    for i in 0..a[2] {
                        let io = (pa + i * 16) as *const usize;
                        let ptr = io.read_unaligned();
                        let len = io.add(1).read_unaligned();
                        if len != 0 {
                            return crate::syscalls::dispatch(63, &[0, ptr, len]);
                        }
                    }
                    return 0;
                }
                if a[0] != 1 && a[0] != 2 {
                    return -9;
                }
                for i in 0..a[2] {
                    let io = (pa + i * 16) as *const usize;
                    let r = output(io.read_unaligned(), io.add(1).read_unaligned(), a[0] == 2);
                    if r < 0 {
                        return if total > 0 { total } else { r };
                    }
                    total += r;
                }
                total
            }
 }
}
