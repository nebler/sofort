use crate::user::output;
pub fn call(a: &[usize; 6]) -> isize {
    #[cfg(feature = "transport-ring")]
    // SAFETY: the syscall owns initialized TX state; native_output receives
    // only stdout/stderr and validates its user buffer before copying it.
    unsafe {
        if crate::console::native() && (a[0] == 1 || a[0] == 2) {
            return crate::console::native_output(a[0], a[1], a[2]);
        }
    }
    match a[0] {
        1 => output(a[1], a[2]),
        2 => crate::syscalls::stderr(a[1], a[2]),
        _ => -9,
    }
}
