use crate::user::output;
pub fn call(a: &[usize; 6]) -> isize {
    // Linux takes the descriptor as an unsigned int.
    let fd = a[0] as u32 as usize;
    #[cfg(feature = "transport-ring")]
    // SAFETY: the syscall owns initialized TX state; native_output receives
    // only stdout/stderr and validates its user buffer before copying it.
    unsafe {
        if crate::console::native() && (fd == 1 || fd == 2) {
            return crate::console::native_output(fd, a[1], a[2]);
        }
    }
    match fd {
        1 => output(a[1], a[2]),
        2 => crate::syscalls::stderr(a[1], a[2]),
        _ => -9,
    }
}
