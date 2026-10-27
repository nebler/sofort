use super::{mmap_arena, page_mapped, map_zeroed};

pub fn call(a: &[usize]) -> isize {
    if a.len() < 6 {
        return -22;
    }
    let addr = a[0];
    let len = a[1];
    let flags = a[3];
    if a[5] & 4095 != 0 || len == 0 {
        return -22;
    }
    let size = match len.checked_add(4095) {
        Some(n) => n & !4095,
        None => return -12,
    };
    if flags & 0x20 == 0 {
        return -9;
    }
    if flags & 3 != 1 && flags & 3 != 2 {
        return -22;
    }
    let (start, end) = mmap_arena();
    let low = match start.checked_add(4095) {
        Some(n) => n & !4095,
        None => return -12,
    };
    let high = end & !4095;
    if high < low || size > high - low {
        return -12;
    }
    let fixed = flags & (0x10 | 0x100000) != 0;
    if fixed && addr & 4095 != 0 {
        return -22;
    }
    let hint = addr & !4095;
    if addr != 0 || fixed {
        let stop = hint.checked_add(size);
        if hint >= low && stop.is_some_and(|n| n <= high) {
            let stop = hint + size;
            let mut p = hint;
            while p < stop && !page_mapped(p) {
                p += 4096;
            }
            if p == stop {
                return if map_zeroed(hint, size) { hint as isize } else { -12 };
            }
            if flags & 0x100000 != 0 {
                return -17;
            }
        }
        if fixed {
            return -12;
        }
    }
    let mut top = high;
    while top - low >= size {
        let base = top - size;
        let mut p = top;
        let mut occupied = false;
        while p > base {
            p -= 4096;
            if page_mapped(p) {
                top = p;
                occupied = true;
                break;
            }
        }
        if !occupied {
            return if map_zeroed(base, size) { base as isize } else { -12 };
        }
    }
    -12
}
