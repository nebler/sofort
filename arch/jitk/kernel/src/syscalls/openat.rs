// Read-only archive open. Error order follows Linux do_open/may_open on a
// read-only bind mount (O_ACCMODE 3 opens a file with neither read nor write
// access, as Linux does); O_PATH is outside this contract (EINVAL).
use crate::fs;
pub fn call(a: &[usize]) -> isize {
    let flags = a[2] as u32;
    let (creat, excl, trunc, dirflag) = (flags & 0x40 != 0, flags & 0x80 != 0, flags & 0x200 != 0, flags & 0x4000 != 0);
    let write = flags & 3 != 0 || trunc;
    if creat && dirflag || flags & 0x200000 != 0 { return -22; }
    if flags & 0x400000 != 0 { return if flags & 0x4000 == 0 || flags & 3 == 0 { -22 } else { -30 }; }
    let i = match fs::lookup(a[0], a[1], false, creat) { Ok(i) => i, Err(e) => return e };
    let n = match fs::node(i) { Ok(n) => n, Err(e) => return e };
    if creat && excl { return -17; }
    if n.is_dir() && (creat || write) { return -21; }
    if dirflag && !n.is_dir() { return -20; }
    if write && (flags & 3 != 3 || trunc) { return -30; }
    fs::alloc(i, flags & 0x80000 != 0, flags & 3 != 3)
}
