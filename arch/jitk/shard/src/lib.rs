//! Linux arm64 shard: verified snapshots, owner-thread VM lifecycle and bounded IPC.
//!
//! The two CLI binaries own all fixture, attack and measurement orchestration.
#![deny(clippy::undocumented_unsafe_blocks)]

pub mod arena;
#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
pub mod clock;
pub mod constants;
pub mod entropy;
pub mod inputs;
#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
pub mod ipc;
#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
pub mod ipc_service;
#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
pub mod kvm;
#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
pub mod lease;
#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
pub mod owner;
pub mod payload;
pub mod snapshot;
pub mod streams;
