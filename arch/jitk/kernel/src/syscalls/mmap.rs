// Anonymous private or shared mappings, always read-write and never
// executable. Ring builds keep the page pool's own policy (kernel/src/heap.rs:
// free pages at the lowest free VA, no hints, no MAP_FIXED). Console builds run
// unmodified static programs and take the grown policy (phase 2, GROWN.json):
// a free hint or MAP_FIXED / MAP_FIXED_NOREPLACE range inside the mmap window,
// else the highest free run below its top, as Linux places them.
//
// prot: PROT_EXEC is refused (EACCES), because heap pages are W^X by design.
// PROT_NONE and PROT_READ mappings are backed read-write, so a guard page
// does not fault; the static corpus does not rely on that.
#[cfg(not(feature = "transport-ring"))]
use super::{map_zeroed, mmap_arena, page_mapped};

#[cfg(not(feature = "transport-ring"))]
const PROT_EXEC: usize = 4;
#[cfg(not(feature = "transport-ring"))]
const MAP_SHARED: usize = 1;
#[cfg(not(feature = "transport-ring"))]
const MAP_PRIVATE: usize = 2;
const MAP_FIXED: usize = 0x10;
const MAP_ANONYMOUS: usize = 0x20;
#[cfg(not(feature = "transport-ring"))]
const MAP_FIXED_NOREPLACE: usize = 0x100000;

pub fn call(a: &[usize; 6]) -> isize {
    // Ring builds: unchanged checks, then free pool pages at the lowest free VA.
    #[cfg(feature = "transport-ring")]
    {
        if a[0] != 0 || a[1] == 0 || a[2] != 3 || a[3] & MAP_ANONYMOUS == 0 || a[3] & MAP_FIXED != 0
        {
            return -22;
        }
        let Some(len) = a[1].checked_add(4095).map(|x| x & !4095) else {
            return -12;
        };
        crate::heap::mmap(len)
    }
    #[cfg(not(feature = "transport-ring"))]
    {
        let (addr, len, prot, flags, offset) = (a[0], a[1], a[2], a[3], a[5]);
        if prot & PROT_EXEC != 0 {
            return -13;
        }
        if flags & MAP_ANONYMOUS == 0 {
            return -9;
        }
        if !matches!(flags & 3, MAP_SHARED | MAP_PRIVATE) || offset & 4095 != 0 || len == 0 {
            return -22;
        }
        let Some(size) = len.checked_add(4095).map(|x| x & !4095) else {
            return -12;
        };
        console(addr, size, flags)
    }
}

#[cfg(not(feature = "transport-ring"))]
fn console(addr: usize, size: usize, flags: usize) -> isize {
    let (start, end) = mmap_arena();
    let Some(low) = start.checked_add(4095).map(|x| x & !4095) else {
        return -12;
    };
    let high = end & !4095;
    if high < low || size > high - low {
        return -12;
    }
    let fixed = flags & (MAP_FIXED | MAP_FIXED_NOREPLACE) != 0;
    if fixed && addr & 4095 != 0 {
        return -22;
    }
    let hint = addr & !4095;
    if addr != 0 || fixed {
        if hint >= low && hint.checked_add(size).is_some_and(|stop| stop <= high) {
            let stop = hint + size;
            if (hint..stop).step_by(4096).all(|p| !page_mapped(p)) {
                return if map_zeroed(hint, size) {
                    hint as isize
                } else {
                    -12
                };
            }
            if flags & MAP_FIXED_NOREPLACE != 0 {
                return -17;
            }
        }
        // MAP_FIXED over a live mapping would have to replace it; that is not
        // implemented, so it fails instead of silently moving the mapping.
        if fixed {
            return -12;
        }
    }
    let mut top = high;
    while top - low >= size {
        let base = top - size;
        match (base..top).step_by(4096).rev().find(|&p| page_mapped(p)) {
            Some(p) => top = p,
            None => {
                return if map_zeroed(base, size) {
                    base as isize
                } else {
                    -12
                };
            }
        }
    }
    -12
}
