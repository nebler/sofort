use crate::user::*;
pub unsafe fn call(a: &[usize]) -> isize {
    unsafe {
        let fd = a[0] as u32 as usize;
        let console = match crate::fs::kind(fd) {
            Ok(crate::fs::FdKind::Console) if fd == 0 => true,
            Ok(crate::fs::FdKind::Console) => return -9,
            Ok(crate::fs::FdKind::Archive) => false,
            Err(e) => return e,
        };
        if a[2] > 1024 { return -22; }
        let Some(pa) = access(a[1], a[2] * 16, false) else { return -14; };
        let mut total = 0;
        for i in 0..a[2] {
            let io = (pa + i * 16) as *const usize;
            let (base, len) = (io.read_unaligned(), io.add(1).read_unaligned());
            if len == 0 { continue; }
            // Console input keeps its one-buffer semantics; archive reads fill in order.
            if console { return super::read::call(&[0, base, len]); }
            let r = crate::fs::read(fd, base, len);
            if r < 0 { return if total > 0 { total } else { r }; }
            total += r;
            if (r as usize) < len { break; }
        }
        total
    }
}
