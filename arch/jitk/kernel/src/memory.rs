//! Fixed guest address map; mirrors the linker, packer, and VMM layouts.
//! Physical placement is per architecture; the user virtual layout is not.
pub use crate::arch::{PACKED_GPA, RAM_GPA};
pub const USER_BASE: usize = 0x400000;
pub const USER_END: usize = 0x2400000;
pub const STACK_START: usize = 0x1fe0000;
pub const STACK_END: usize = 0x2000000;
#[cfg(not(feature = "transport-ring"))]
pub const MMAP_END: usize = 0x1e00000;
