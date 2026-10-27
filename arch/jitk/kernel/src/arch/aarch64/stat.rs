//! Linux arm64 `struct stat` (asm-generic layout, 128 bytes), little-endian.
//! Mounted by fs.rs as `fs::stat_abi` so host harnesses that compile fs.rs
//! need no extra stub module. Unset fields (uid, gid, rdev, times) stay zero.
pub type Bytes = [u8; 128];
pub struct Stat {
    pub dev: u64,
    pub ino: u64,
    pub mode: u32,
    pub nlink: u64,
    pub size: u64,
    pub blksize: u64,
    pub blocks: u64,
}
pub fn encode(s: &Stat) -> Bytes {
    let mut st = [0u8; 128];
    st[0..8].copy_from_slice(&s.dev.to_le_bytes());
    st[8..16].copy_from_slice(&s.ino.to_le_bytes());
    st[16..20].copy_from_slice(&s.mode.to_le_bytes());
    st[20..24].copy_from_slice(&(s.nlink as u32).to_le_bytes());
    st[48..56].copy_from_slice(&s.size.to_le_bytes());
    st[56..60].copy_from_slice(&(s.blksize as u32).to_le_bytes());
    st[64..72].copy_from_slice(&s.blocks.to_le_bytes());
    st
}
