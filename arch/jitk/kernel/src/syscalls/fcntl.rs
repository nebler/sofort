// Only close-on-exec flags; there is no exec. Other commands return EINVAL.
pub fn call(a: &[usize]) -> isize {
    let fd = a[0] as u32 as usize;
    if let Err(e) = crate::fs::kind(fd) {
        return e;
    }
    match a[1] as u32 {
        1 => crate::fs::fd_flags(fd, None),
        2 => crate::fs::fd_flags(fd, Some(a[2])),
        _ => -22,
    }
}
