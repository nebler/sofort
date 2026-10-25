pub fn call(a: &[usize]) -> isize {
    let fd = a[0] as u32 as usize;
    #[cfg(feature = "transport-ring")]
    if fd == 0 && crate::fs::get(0).is_ok() { return crate::fs::close(0); }
    if fd <= 2 { 0 } else { crate::fs::close(fd) }
}
