// Positional reads never alter the open descriptor's seek position.
use crate::{fs, syscalls::copyout};
pub fn call(a: &[usize]) -> isize {
    if (a[3] as i64) < 0 {
        return -22;
    }
    let fd = a[0] as u32 as usize;
    let console = match fs::kind(fd) {
        Ok(kind) => kind == fs::FdKind::Console,
        Err(e) => return e,
    };
    if console {
        return -29;
    }
    fs::with_open(fd, |f| {
        if !f.read {
            return -9;
        }
        if a[2] > isize::MAX as usize || a[1].checked_add(a[2]).is_none() {
            return -14;
        }
        if a[3]
            .checked_add(a[2])
            .is_none_or(|end| end > i64::MAX as usize)
        {
            return -22;
        }
        let n = match fs::node(f.node) {
            Ok(n) => n,
            Err(e) => return e,
        };
        if n.is_dir() {
            return -21;
        }
        let d = fs::data(&n);
        let start = a[3].min(d.len());
        let count = a[2].min(d.len() - start);
        if count == 0 {
            return 0;
        }
        match copyout(a[1], &d[start..start + count]) {
            Ok(()) => count as isize,
            Err(e) => e,
        }
    })
    .unwrap_or_else(|e| e)
}
