pub fn call(a: &[usize; 6]) -> isize {
    let fd = a[0] as u32 as usize;
    match crate::fs::kind(fd) {
        Ok(crate::fs::FdKind::Console) if fd == 0 => {}
        Ok(crate::fs::FdKind::Console) => return -9,
        Ok(crate::fs::FdKind::Archive) => return crate::fs::read(fd, a[1], a[2]),
        Err(e) => return e,
    }
    crate::syscalls::read_console(a[1], a[2])
}
