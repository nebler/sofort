use crate::{console as c, user::*};
pub unsafe fn call(a: &[usize]) -> isize {
    unsafe {
        let fd = a[0] as u32 as usize;
        #[cfg(feature = "transport-ring")]
        if fd == 0 && crate::fs::get(0).is_ok() { return crate::fs::read(0, a[1], a[2]); }
        if fd != 0 {
            return if fd <= 2 { -9 } else { crate::fs::read(fd, a[1], a[2]) };
        }
        if a[2] > 1024 * 1024 {
            return -22;
        }
        if let Some(pa) = access(a[1], a[2], true) {
            c::read(core::slice::from_raw_parts_mut(pa as *mut u8, a[2])) as isize
        } else {
            -14
        }
    }
}
