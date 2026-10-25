// struct stat (aarch64, 128 bytes) for archive nodes: files 0444, dirs 0555,
// uid/gid 0, nlink 1, times 0, dev 1, ino = index + 1, blksize 4096.
use crate::{fs, syscalls::copyout};
pub fn call(a: &[usize]) -> isize {
    let flags = a[3] as u32;
    if flags & !0x1900 != 0 { return -22; }
    let i = match fs::lookup(a[0], a[1], flags & 0x1000 != 0, false) { Ok(i) => i, Err(e) => return e };
    let n = match fs::node(i) { Ok(n) => n, Err(e) => return e };
    let size = if n.dir { 0 } else { n.b as u64 };
    let mut st = [0u8; 128];
    let mut put = |at: usize, v: &[u8]| st[at..at + v.len()].copy_from_slice(v);
    put(0, &1u64.to_le_bytes());
    put(8, &(n.ino as u64).to_le_bytes());
    put(16, &(if n.dir { 0o40555u32 } else { 0o100444 }).to_le_bytes());
    put(20, &1u32.to_le_bytes());
    put(48, &size.to_le_bytes());
    put(56, &4096u32.to_le_bytes());
    put(64, &((size + 511) / 512).to_le_bytes());
    match copyout(a[2], &st) { Ok(()) => 0, Err(e) => e }
}
