// struct stat (aarch64, 128 bytes) for archive nodes: files 0444, dirs 0555,
// uid/gid 0, nlink 1, times 0, dev 1, ino = index + 1, blksize 4096.
use crate::{fs, syscalls::copyout};
pub fn call(a: &[usize]) -> isize {
    let flags = a[3] as u32;
    if flags & !0x1900 != 0 { return -22; }
    let i = match fs::lookup(a[0], a[1], flags & 0x1000 != 0, false) { Ok(i) => i, Err(e) => return e };
    let n = match fs::node(i) { Ok(n) => n, Err(e) => return e };
    match copyout(a[2], &fs::stat(Some(n))) { Ok(()) => 0, Err(e) => e }
}
