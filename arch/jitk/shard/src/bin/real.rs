#![deny(clippy::undocumented_unsafe_blocks)]
//! Linux shard service and offline harness entry point.
#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
mod harness;

#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
fn main() -> Result<(), Box<dyn std::error::Error>> {
    one_malloc_arena();
    if std::env::args().nth(1).as_deref() == Some("process-watchdog") {
        jitk_shard::watchdog::run()
    }
    harness::run()
}

/// glibc gives every thread that allocates its own malloc arena, and with
/// transparent huge pages each arena's first use faults in a 2 MiB page:
/// about 9.7 MiB of private memory per shard for heaps that hold a few KiB.
/// The shard's threads allocate little, so one arena is enough. It has to
/// be set before the first thread starts, and in-process: Node starts the
/// shard with only PATH in its environment, so MALLOC_ARENA_MAX never
/// reaches it.
#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
fn one_malloc_arena() {
    #[cfg(target_env = "gnu")]
    // SAFETY: mallopt takes two integers; no other thread exists yet.
    unsafe {
        libc::mallopt(libc::M_ARENA_MAX, 1);
    }
}

#[cfg(not(all(target_os = "linux", target_arch = "aarch64")))]
fn main() {
    panic!("shard runtime requires Linux arm64; pure library tests run on this host");
}
