//! Linux arm64 shard: verified snapshots, owner-thread VM lifecycle and bounded IPC.
//!
//! The two CLI binaries own all fixture, attack and measurement orchestration.
pub mod arena;
pub mod entropy;
mod inputs;
pub mod ipc;
mod ipc_json;
pub mod ipc_service;
pub mod kvm;
pub mod lease;
pub mod owner;
mod streams;
