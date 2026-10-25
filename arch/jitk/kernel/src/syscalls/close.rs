pub fn call(a: &[usize]) -> isize {
    let fd = a[0] as u32 as usize;
    if fd <= 2 { 0 } else { crate::fs::close(fd) }
}
