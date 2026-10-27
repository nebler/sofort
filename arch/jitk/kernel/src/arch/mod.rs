//! Architecture boundary. The core (syscalls, fs, trace, console/ring protocol,
//! user stack/auxv construction) calls only the items listed in ../../ARCH.md;
//! each `arch/<target_arch>/` directory implements them. The larger subsystems
//! (`crate::mmu`, `crate::wait`, `crate::fdt`) are mounted from main.rs.

// The packed user image follows the kernel (linker `.packed`); assembler-level
// packing is the same on every architecture.
core::arch::global_asm!(concat!(
    ".section .packed,\"a\"\n.incbin \"",
    env!("OUT_DIR"),
    "/payload.flat\"\n"
));

#[cfg(target_arch = "aarch64")]
mod aarch64;
#[cfg(target_arch = "aarch64")]
pub use aarch64::*;
