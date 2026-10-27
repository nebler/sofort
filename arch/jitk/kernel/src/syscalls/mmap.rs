#[cfg(feature = "transport-ring")]
use crate::console as c;
use crate::syscalls::{map_zeroed, mmap_arena, page_mapped};
pub fn call(a: &[usize; 6]) -> isize {
    if a[0] != 0 || a[1] == 0 || a[2] != 3 || a[3] & 0x20 == 0 || a[3] & 0x10 != 0 {
        return -22;
    }
    let Some(len) = a[1].checked_add(4095).map(|x| x & !4095) else {
        return -12;
    };
    let count = len / 4096;
    let (start, limit) = mmap_arena();
    let mut run = 0;
    let mut base = 0;
    for va in (start..limit).step_by(4096) {
        run = if page_mapped(va) { 0 } else { run + 1 };
        if run == count {
            base = va + 4096 - len;
            break;
        }
    }
    if base == 0 {
        #[cfg(feature = "transport-ring")]
        // SAFETY: This masked-IRQ trap owns console state; the record is
        // written synchronously before EL0 resumes.
        unsafe {
            c::print("arena mmap ENOMEM bytes=");
            c::hex(len);
            c::print(" capacity=");
            c::hex(limit - start);
            c::print("\n");
        }
        return -12;
    }
    // map_zeroed re-checks the range against the arena and the page tables.
    if !map_zeroed(base, len) {
        return -12;
    }
    base as isize
}
