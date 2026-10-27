pub fn call(a: &[usize]) -> isize {
    if a.len() < 3 {
        return -22;
    }
    let flags = a[2] as u32;
    if flags & !0x200 != 0 {
        return -22;
    }
    let index = match crate::fs::lookup(a[0], a[1], false, true) {
        Ok(index) => index,
        Err(e) => return e,
    };
    let node = match crate::fs::node(index) {
        Ok(node) => node,
        Err(e) => return e,
    };
    if flags == 0 && node.is_dir() {
        return -21;
    }
    if flags == 0x200 && index == 0 {
        return -16;
    }
    -30
}