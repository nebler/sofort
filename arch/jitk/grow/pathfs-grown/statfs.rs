use super::copyout;

pub fn call(a: &[usize]) -> isize {
    if a.len() < 2 {
        return -14;
    }
    if let Err(e) = crate::fs::lookup((-100isize) as usize, a[0], false, false) {
        return e;
    }
    let fields: [u64; 15] = [
        0x6a656a63, 1048576, 120699413, 8818437, 8818437,
        375877862, 352737480, 0, 255, 4096, 0x1027, 0, 0, 0, 0,
    ];
    let mut out = [0u8; 120];
    for (i, value) in fields.iter().enumerate() {
        out[i * 8..i * 8 + 8].copy_from_slice(&value.to_le_bytes());
    }
    match copyout(a[1], &out) {
        Ok(()) => 0,
        Err(e) => e,
    }
}
