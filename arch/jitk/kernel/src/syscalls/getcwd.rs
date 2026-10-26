use crate::syscalls::copyout;
pub fn call(a: &[usize; 6]) -> isize {
    if a[1] < 2 {
        return -34;
    }
    match copyout(a[0], b"/\0") {
        Ok(()) => 2,
        Err(e) => e,
    }
}
