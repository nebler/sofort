// The archive has no symlinks: an existing path is EINVAL, else the walk error.
pub fn call(a: &[usize]) -> isize {
    if a[3] as i32 <= 0 { return -22; }
    match crate::fs::lookup(a[0], a[1], false, false) { Ok(_) => -22, Err(e) => e }
}
