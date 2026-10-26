// Console fds are pipes (ESPIPE). Archive fds: SEEK_SET/CUR/END only; a
// directory's offset is its getdents64 entry index and its "size" is 0.
use crate::fs;
pub fn call(a: &[usize]) -> isize {
    let fd = a[0] as u32 as usize;
    #[cfg(feature = "transport-ring")]
    let console = fd <= 2 && fs::get(fd).is_err();
    #[cfg(not(feature = "transport-ring"))]
    let console = fd <= 2;
    if console { return -29; }
    fs::with_open(fd, |f| {
    let n = match fs::node(f.node) { Ok(n) => n, Err(e) => return e };
    let base = match a[2] { 0 => 0, 1 => f.pos as i64, 2 => if n.dir { 0 } else { n.b as i64 }, _ => return -22 };
    match base.checked_add(a[1] as i64) {
        Some(pos) if pos >= 0 => { f.pos = pos as usize; pos as isize }
        _ => -22,
    }
    }).unwrap_or_else(|e| e)
}
