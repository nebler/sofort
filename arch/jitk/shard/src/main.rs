#![deny(clippy::undocumented_unsafe_blocks)]
//! Synthetic ABI-v0 benchmark harness.
#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
mod synthetic;

#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
fn main() {
    synthetic::run();
}

#[cfg(not(all(target_os = "linux", target_arch = "aarch64")))]
fn main() {
    panic!("shard runtime requires Linux arm64; pure library tests run on this host");
}
