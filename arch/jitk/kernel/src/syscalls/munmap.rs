#[cfg(not(feature = "transport-ring"))]
use crate::{mmu as m, user::*};
pub fn call(a: &[usize; 6]) -> isize {
    if a[0] & 4095 != 0 || a[1] == 0 {
        return -22;
    }
    // Ring builds: mmap VA only; pages return to the heap pool (kernel/src/heap.rs).
    #[cfg(feature = "transport-ring")]
    return crate::heap::munmap(a[0], a[1]);
    #[cfg(not(feature = "transport-ring"))]
    {
        let limit = crate::memory::MMAP_END;
        let Some(end) = a[0].checked_add(a[1]).filter(|e| *e <= limit) else {
            return -22;
        };
        if a[0] < MMAP {
            return -22;
        }
        // SAFETY: The checked aligned mmap range keeps every descriptor index in bounds. This
        // masked-IRQ trap owns tables and flushes before EL0 resumes.
        unsafe {
            for va in (a[0]..end).step_by(4096) {
                m::unmap(va);
            }
            m::flush();
        }
        0
    }
}
