use crate::{syscalls::iovec, user::access};
pub fn call(a: &[usize; 6]) -> isize {
    let fd = a[0] as u32 as usize;
    let console = match crate::fs::kind(fd) {
        Ok(crate::fs::FdKind::Console) if fd == 0 => true,
        Ok(crate::fs::FdKind::Console) => return -9,
        Ok(crate::fs::FdKind::Archive) => false,
        Err(e) => return e,
    };
    if a[2] > 1024 {
        return -22;
    }
    let Some(_) = access(a[1], a[2] * 16, false) else {
        return -14;
    };
    let mut total = 0;
    for i in 0..a[2] {
        let (base, len) = iovec(a[1], i);
        if len == 0 {
            continue;
        }
        // Console input keeps its one-buffer semantics; archive reads fill in order.
        if console {
            return crate::syscalls::read_console(base, len);
        }
        let r = crate::fs::read(fd, base, len);
        if r < 0 {
            return if total > 0 { total } else { r };
        }
        total += r;
        if (r as usize) < len {
            break;
        }
    }
    total
}
