// Only the close-on-exec flag (F_GETFD/F_SETFD); there is no exec. Else EINVAL.
pub fn call(a: &[usize]) -> isize {
    let fd = a[0] as u32 as usize;
    #[cfg(feature = "transport-ring")]
    if crate::fs::get(fd).is_ok() && (a[1] == 1 || a[1] == 2) {
        return crate::fs::fd_flags(fd, if a[1] == 2 { Some(a[2]) } else { None });
    }
    let f = if fd <= 2 { None } else { match crate::fs::get(fd) { Ok(f) => Some(f), Err(e) => return e } };
    match (a[1] as u32, f) {
        (1, Some(f)) => f.cloexec as isize,
        (2, Some(f)) => { f.cloexec = a[2] & 1 != 0; 0 }
        (1 | 2, None) => 0,
        _ => -22,
    }
}
