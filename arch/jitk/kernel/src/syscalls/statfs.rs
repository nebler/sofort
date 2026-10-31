// The read-only archive every path resolves into: its own size and node
// count, no free space, mounted ro,nosuid,nodev,noexec,relatime.
use super::copyout;

const JITK_MAGIC: u64 = 0x6a69_746b; // "jitk"
const ST_FLAGS: u64 = 0x1027; // RDONLY | NOSUID | NODEV | NOEXEC | RELATIME

pub fn call(a: &[usize]) -> isize {
    // Grown for the console profile; ring builds keep their surface (ENOSYS).
    if cfg!(feature = "transport-ring") {
        return -38;
    }
    if a.len() < 2 {
        return -14;
    }
    if let Err(e) = crate::fs::lookup((-100isize) as usize, a[0], false, false) {
        return e;
    }
    let (bytes, nodes) = crate::fs::usage();
    // f_type, f_bsize, f_blocks, f_bfree, f_bavail, f_files, f_ffree, f_fsid,
    // f_namelen, f_frsize, f_flags, f_spare[4]
    let fields: [u64; 15] = [
        JITK_MAGIC,
        4096,
        bytes.div_ceil(4096) as u64,
        0,
        0,
        nodes as u64,
        0,
        0,
        255,
        4096,
        ST_FLAGS,
        0,
        0,
        0,
        0,
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
