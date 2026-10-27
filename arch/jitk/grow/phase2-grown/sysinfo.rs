use super::copyout;

pub fn call(a: &[usize]) -> isize {
    let addr = match a.first() {
        Some(&addr) => addr,
        None => return -14,
    };
    if addr == 0 || addr.checked_add(112).is_none() {
        return -14;
    }
    let mut info = [0u8; 112];
    let fields: [u64; 10] = [
        67354, 216224, 207168, 221376,
        8217751552, 855121920, 66109440, 785510400,
        1073737728, 19402752,
    ];
    for (i, value) in fields.iter().enumerate() {
        info[i * 8..i * 8 + 8].copy_from_slice(&value.to_le_bytes());
    }
    info[80..82].copy_from_slice(&1004u16.to_le_bytes());
    info[104..108].copy_from_slice(&1u32.to_le_bytes());
    match copyout(addr, &info) {
        Ok(()) => 0,
        Err(err) => err,
    }
}
