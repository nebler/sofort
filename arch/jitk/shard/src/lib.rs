//! jitk shard: verified snapshots, hypervisor-neutral slots behind the `hv`
//! seam, the Linux arm64 KVM backend with owner-thread VM lifecycle and
//! bounded IPC, and the macOS Hypervisor.framework backend.
//!
//! The two CLI binaries own all fixture, attack and measurement orchestration.
#![deny(clippy::undocumented_unsafe_blocks)]

// The KVM backend and its UAPI constants (constants::kvm) are arm64 only.
#[cfg(all(target_os = "linux", not(target_arch = "aarch64")))]
compile_error!("the jitk shard's Linux KVM backend supports aarch64 only");

pub mod arena;
pub mod calls;
#[cfg(unix)]
pub mod clock;
/// Linux shard confinement (namespaces, Landlock, seccomp); the seccomp
/// compiler and policies are portable.
pub mod confine;
pub mod constants;
pub mod entropy;
/// Fuzz harnesses (`fuzz/`; feature `fuzzing`), replayed by `cargo test`.
#[cfg(all(unix, any(test, feature = "fuzzing")))]
pub mod fuzz;
#[cfg(unix)]
pub mod hv;
#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
pub mod hvf;
pub mod inputs;
#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
pub mod ipc;
#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
pub mod ipc_service;
#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
pub mod kvm;
#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
pub mod lease;
#[cfg(unix)]
pub mod memory;
#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
pub mod owner;
pub mod payload;
pub mod service;
#[cfg(unix)]
pub mod slot;
#[cfg(unix)]
pub mod snapshot;
pub mod streams;
pub mod virtio_console;
/// The process backends' shared deadline watchdog (`hvf process-watchdog`,
/// `real process-watchdog`; `real watchdog` is the shard's lease watchdog,
/// lease.rs); executor/backend.ts.
#[cfg(any(target_os = "linux", target_os = "macos"))]
pub mod watchdog;
