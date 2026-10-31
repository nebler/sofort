#[cfg(feature = "transport-ring")]
use crate::console as c;
use crate::{mmu as m, user::*};
use core::ptr::write_bytes;
pub fn call(a: &[usize; 6]) -> isize {
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
    let limit = crate::memory::MMAP_END;
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
        #[cfg(feature = "heap-trace")]
        // SAFETY: this trap owns the trace.
        unsafe {
            crate::heap_trace::enomem(len)
        };
        #[cfg(feature = "transport-ring")]
        {
            // SAFETY: This masked-IRQ trap owns MMU and console state. The
            // allocation scan bounds the writable, nonexecuting mapping; zero-fill
            // uses its disjoint physical backing before EL0 resumes.
            unsafe {
                c::print("arena mmap ENOMEM bytes=");
                c::hex(len);
                c::print(" capacity=");
                c::hex(limit - MMAP);
                c::print("\n");
            }
        }
        return -12;
    }
    let Some(end) = base.checked_add(len) else {
        return -12;
    };
    if end > limit {
        return -12;
    }
    // SAFETY: This masked-IRQ trap owns MMU and console state. The allocation scan bounds
    // the writable, nonexecuting mapping; zero-fill uses its disjoint physical backing
    // before EL0 resumes.
    unsafe {
        pages(base, end, true, false);
        write_bytes(m::physical(base) as *mut u8, 0, len);
        m::flush();
    }
    base as isize
}
