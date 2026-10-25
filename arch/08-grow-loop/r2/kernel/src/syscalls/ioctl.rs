pub fn call(a: &[usize]) -> isize {
    let fd = match a.first() {
        Some(&fd) => fd,
        None => return -9,
    };
    if fd > 2 {
        return -9;
    }
    match a.get(1) {
        Some(&0x5413) => -25,
        _ => -38,
    }
}
