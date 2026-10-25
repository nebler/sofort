use crate::{console as c, mmu as m, user::*};
use core::ptr::{copy_nonoverlapping, write_bytes};
pub unsafe fn call(a: &[usize]) -> isize {
    unsafe {

                if a[0] & 4095 != 0 || a[1] == 0 {
                    return -22;
                }
                #[cfg(feature = "transport-ring")]
                let limit = m::mmap_limit();
                #[cfg(not(feature = "transport-ring"))]
                let limit = 0x1e00000;
                let Some(end) = a[0].checked_add(a[1]).filter(|e| *e <= limit) else {
                    return -22;
                };
                if a[0] < MMAP {
                    return -22;
                }
                for va in (a[0]..end).step_by(4096) {
                    m::unmap(va);
                }
                m::flush();
                0
            
    }
}
