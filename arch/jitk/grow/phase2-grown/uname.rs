use super::copyout;

pub fn call(a: &[usize]) -> isize {
    let Some(&addr) = a.first() else {
        return -14;
    };
    let fields: [&[u8]; 6] = [
        b"Linux",
        b"ef4b947b2570",
        b"6.10.14-linuxkit",
        b"#1 SMP Mon Feb 24 16:35:16 UTC 2025",
        b"aarch64",
        b"(none)",
    ];
    let mut buf = [0u8; 390];
    for (i, field) in fields.iter().enumerate() {
        let start = i * 65;
        buf[start..start + field.len()].copy_from_slice(field);
    }
    match copyout(addr, &buf) {
        Ok(()) => 0,
        Err(e) => e,
    }
}
