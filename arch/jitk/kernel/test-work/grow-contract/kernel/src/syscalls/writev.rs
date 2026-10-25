use crate::{console as c, mmu as m, user::*};
use core::ptr::{copy_nonoverlapping, write_bytes};
pub unsafe fn call(a: &[usize]) -> isize {
    unsafe {

                if a[2] > 1024 {
                    return -22;
                }
                let Some(pa) = access(a[1], a[2] * 16, false) else {
                    return -14;
                };
                let mut total = 0;
                if a[0] != 1 && a[0] != 2 {
                    return -9;
                }
                // Validate the complete writev before emitting any prefix.
                if a[0] == 1 {
                    for i in 0..a[2] {
                        let io = (pa + i * 16) as *const usize;
                        let len = io.add(1).read_unaligned();
                        if len == 0 {
                            continue;
                        }
                        if len > 1024 * 1024 {
                            return -22;
                        }
                        let Some(p) = access(io.read_unaligned(), len, false) else {
                            return -14;
                        };
                        let bytes = core::slice::from_raw_parts(p as *const u8, len);
                        if bytes.iter().any(|&b| (b < 32 && b != 10) || b >= 127) {
                            c::print("\x1efatal control byte\n");
                            crate::off();
                        }
                    }
                }
                for i in 0..a[2] {
                    let io = (pa + i * 16) as *const usize;
                    let r = if a[0] == 2 {
                        crate::syscalls::stderr(io.read_unaligned(), io.add(1).read_unaligned())
                    } else {
                        output(io.read_unaligned(), io.add(1).read_unaligned())
                    };
                    if r < 0 {
                        return if total > 0 { total } else { r };
                    }
                    total += r;
                }
                total
            
    }
}
