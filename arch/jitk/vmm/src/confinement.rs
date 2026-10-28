//! Adapter owned by 01. The confinement implementation under sandbox/ belongs to 07.
pub type Error = Box<dyn std::error::Error>;

// build.ts passes `--cfg sandbox_ready` when vmm/sandbox/.READY is present.
// Without it there is no confinement, so refuse to build at all.
#[cfg(not(sandbox_ready))]
compile_error!("vmm/sandbox/.READY is missing: refusing to build an unconfined VMM");

#[path = "../sandbox/mod.rs"]
mod implementation;
pub use implementation::*;
