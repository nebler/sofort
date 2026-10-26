pub fn call(a: &[usize]) -> isize {
    crate::fs::close(a[0] as u32 as usize)
}
