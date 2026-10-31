pub fn call(a: &[usize]) -> isize {
    // Grown for the console profile; ring builds keep their surface (ENOSYS).
    if cfg!(feature = "transport-ring") {
        return -38;
    }
    let addr = match a.first() {
        Some(&addr) => addr,
        None => return -14,
    };
    match crate::fs::lookup((-100isize) as usize, addr, false, false) {
        Ok(index) => match crate::fs::node(index) {
            Ok(node) => {
                if node.is_dir() {
                    0
                } else {
                    -20
                }
            }
            Err(e) => e,
        },
        Err(e) => e,
    }
}
