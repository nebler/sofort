#![deny(clippy::undocumented_unsafe_blocks)]
//! Linux shard service and offline harness entry point.
#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
mod harness;

#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
fn main() -> Result<(), Box<dyn std::error::Error>> {
    if std::env::args().nth(1).as_deref() == Some("watchdog") {
        jitk_shard::watchdog::run()
    }
    harness::run()
}

#[cfg(not(all(target_os = "linux", target_arch = "aarch64")))]
fn main() {
    panic!("shard runtime requires Linux arm64; pure library tests run on this host");
}
