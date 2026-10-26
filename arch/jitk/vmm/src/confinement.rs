//! Adapter owned by 01. The confinement implementation under sandbox/ belongs to 07.
#[cfg(not(sandbox_ready))]
use std::path::Path;
pub type Error = Box<dyn std::error::Error>;

#[cfg(sandbox_ready)]
#[path = "../sandbox/mod.rs"]
mod implementation;
#[cfg(sandbox_ready)]
pub use implementation::*;

#[cfg(not(sandbox_ready))]
pub struct Sandbox;
#[cfg(not(sandbox_ready))]
impl Sandbox {
    pub fn prepare(
        _: &Path,
        _: Option<&Path>,
        _: Option<std::os::fd::OwnedFd>,
    ) -> Result<Self, Error> {
        Err("area 07 sandbox module not ready; refusing unconfined launch".into())
    }
    pub fn before_build(&mut self) -> Result<(), Error> {
        Ok(())
    }
    pub fn after_build(&mut self) -> Result<(), Error> {
        Ok(())
    }
}
#[cfg(not(sandbox_ready))]
pub fn compile_profile(_: &Path, _: &Path) -> Result<(), Error> {
    Err("area 07 sandbox module not ready".into())
}
