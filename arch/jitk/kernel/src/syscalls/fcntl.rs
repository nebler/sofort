// Only the close-on-exec flag (F_GETFD/F_SETFD); there is no exec. Else EINVAL.
pub fn call(a: &[usize]) -> isize {
    let fd = a[0] as u32 as usize;
    #[cfg(feature = "transport-ring")]
    if crate::fs::get(fd).is_ok() && (a[1] == 1 || a[1] == 2) {
        return crate::fs::fd_flags(fd, if a[1] == 2 { Some(a[2]) } else { None });
    }
    if fd <= 2 { return if a[1] == 1 || a[1] == 2 { 0 } else { -22 }; }
    if crate::fs::get(fd).is_err() { return -9; }
    match a[1] as u32 {
        1 => crate::fs::fd_flags(fd, None),
        2 => crate::fs::fd_flags(fd, Some(a[2])),
        _ => -22,
    }
}
