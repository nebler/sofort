use crate::{console as c, mmu as m, user::*};
use core::ptr::{copy_nonoverlapping, write_bytes};
pub unsafe fn call(a: &[usize]) -> isize {
    unsafe {

                if a[0] != 0 || a[1] == 0 || a[2] != 3 || a[3] & 0x20 == 0 || a[3] & 0x10 != 0 {
                    return -22;
                }
                let Some(len) = a[1].checked_add(4095).map(|x| x & !4095) else {
                    return -12;
                };
                let count = len / 4096;
                #[cfg(feature = "transport-ring")]
                let limit = m::mmap_limit();
                #[cfg(not(feature = "transport-ring"))]
                let limit = 0x1e00000;
                let mut run = 0;
                let mut base = 0;
                for va in (MMAP..limit).step_by(4096) {
                    run = if m::valid(va, false) { 0 } else { run + 1 };
                    if run == count {
                        base = va + 4096 - len;
                        break;
                    }
                }
                if base == 0 {
                    #[cfg(feature = "transport-ring")]
                    {
                        c::print("arena mmap ENOMEM bytes="); c::hex(len);
                        c::print(" capacity="); c::hex(limit - MMAP); c::print("\n");
                    }
                    return -12;
                }
                let Some(end) = base.checked_add(len) else {
                    return -12;
                };
                if end > limit {
                    return -12;
                }
                pages(base, end, true, false);
                write_bytes(m::physical(base) as *mut u8, 0, len);
                m::flush();
                base as isize
            
    }
}
