// Positional reads never alter the open descriptor's seek position.
use crate::{fs, syscalls::copyout};
pub fn call(a: &[usize]) -> isize {
    if (a[3] as i64) < 0 { return -22; }
    let fd = a[0] as u32 as usize;
    if fd <= 2 { return -29; }
    let f = match fs::get(fd) { Ok(f) if f.read => f, Ok(_) => return -9, Err(e) => return e };
    if a[2] > isize::MAX as usize || a[1].checked_add(a[2]).is_none() { return -14; }
    if a[3].checked_add(a[2]).is_none_or(|end| end > i64::MAX as usize) { return -22; }
    let n = match fs::node(f.node) { Ok(n) => n, Err(e) => return e };
    if n.dir { return -21; }
    let d = fs::data(&n);
    let start = a[3].min(d.len());
    let count = a[2].min(d.len() - start);
    if count == 0 { return 0; }
    match copyout(a[1], &d[start..start + count]) { Ok(()) => count as isize, Err(e) => e }
}
