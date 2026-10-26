use crate::{console as c, user::*};
pub unsafe fn call(a: &[usize]) -> isize {
    unsafe {
        let fd = a[0] as u32 as usize;
        match crate::fs::kind(fd) {
            Ok(crate::fs::FdKind::Console) if fd == 0 => {},
            Ok(crate::fs::FdKind::Console) => return -9,
            Ok(crate::fs::FdKind::Archive) => return crate::fs::read(fd, a[1], a[2]),
            Err(e) => return e,
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
