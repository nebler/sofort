pub fn call(a: &[usize]) -> isize {
    // Grown for the console profile; ring builds keep their surface (ENOSYS).
    if cfg!(feature = "transport-ring") {
        return -38;
    }
    if a.len() < 3 {
        return -22;
    }
    let mode = a[2] as u32;
    if mode & !7 != 0 {
        return -22;
    }
    let index = match crate::fs::lookup(a[0], a[1], false, false) {
        Ok(index) => index,
        Err(e) => return e,
    };
    let node = match crate::fs::node(index) {
        Ok(node) => node,
        Err(e) => return e,
    };
    if mode & 1 != 0 && !node.is_dir() {
        return -13;
    }
    if mode & 2 != 0 {
        return -30;
    }
    0
}
