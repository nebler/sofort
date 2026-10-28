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
#[cfg(unix)]
pub mod clock;
pub mod constants;
pub mod entropy;
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
