// Descriptor metadata uses the same checked AArch64 layout as newfstatat.
use crate::{fs, syscalls::copyout};
pub fn call(a: &[usize]) -> isize {
    let fd = a[0] as u32 as usize;
    let console = match fs::kind(fd) {
        Ok(kind) => kind == fs::FdKind::Console,
        Err(e) => return e,
    };
    let n = if console {
        None
    } else {
        let f = match fs::get(fd) {
            Ok(f) => f,
            Err(e) => return e,
        };
        match fs::node(f.node) {
            Ok(n) => Some(n),
            Err(e) => return e,
        }
    };
    match copyout(a[1], &fs::stat(n)) {
        Ok(()) => 0,
        Err(e) => e,
    }
}
