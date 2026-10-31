pub fn call(a: &[usize]) -> isize {
    // Grown for the console profile; ring builds keep their surface (ENOSYS).
    if cfg!(feature = "transport-ring") {
        return -38;
    }
    if a.len() < 3 {
        return -22;
    }
    match crate::fs::lookup(a[0], a[1], false, true) {
        Ok(_) => -17,
        Err(e) => e,
    }
}
