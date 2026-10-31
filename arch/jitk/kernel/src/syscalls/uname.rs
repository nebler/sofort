// The guest's own identity, not the reference machine's: the kernel answers
// the Linux ABI, so it reports sysname Linux and a release that names jitk.
use super::copyout;

pub fn call(a: &[usize]) -> isize {
    // Grown for the console profile; ring builds keep their surface (ENOSYS).
    if cfg!(feature = "transport-ring") {
        return -38;
    }
    let Some(&addr) = a.first() else {
        return -14;
    };
    let fields: [&[u8]; 6] = [
        b"Linux",
        b"jitk",
        b"6.10.0-jitk",
        b"#1 jitk",
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
