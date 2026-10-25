use crate::{console as c, mmu as m, user::*};
use core::ptr::{copy_nonoverlapping, write_bytes};
pub unsafe fn call(a: &[usize]) -> isize {
    unsafe {

                let ns = crate::wait::now_ns() + if a[0] == 0 { crate::EPOCH_OFFSET } else { 0 };
                if a[0] != 0 && a[0] != 1 {
                    return -22;
                }
                if let Some(pa) = access(a[1], 16, true) {
                    let t = pa as *mut u64;
                    t.write_unaligned(ns / 1_000_000_000);
                    t.add(1).write_unaligned(ns % 1_000_000_000);
                    0
                } else {
                    -14
                }
            
    }
}
