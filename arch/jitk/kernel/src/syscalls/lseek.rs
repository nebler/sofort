// Console fds are pipes (ESPIPE). Archive fds: SEEK_SET/CUR/END only; a
// directory's offset is its getdents64 entry index and its "size" is 0.
use crate::fs;
pub fn call(a: &[usize]) -> isize {
    let fd = a[0] as u32 as usize;
    let console = match fs::kind(fd) { Ok(kind) => kind == fs::FdKind::Console, Err(e) => return e };
    if console { return -29; }
    fs::with_open(fd, |f| {
    let n = match fs::node(f.node) { Ok(n) => n, Err(e) => return e };
    let base = match a[2] { 0 => 0, 1 => f.pos as i64, 2 => if n.is_dir() { 0 } else { n.file_len() as i64 }, _ => return -22 };
    match base.checked_add(a[1] as i64) {
        Some(pos) if pos >= 0 => { f.pos = pos as usize; pos as isize }
        _ => -22,
    }
    }).unwrap_or_else(|e| e)
}
