//! Confinement of the Linux shard (`real ipc`), its lease watchdog and the
//! native worker (`real native-worker`, kvm/native.rs `confined`).
//!
//! The layers follow the process model, in this order (`Confinement`):
//! 1. `enter_namespaces`, while the process has one thread and no child:
//!    new user, network and IPC namespaces (an empty network with no
//!    interface up, no System V IPC shared with the host). unshare(2) of a
//!    user namespace needs a single-threaded caller.
//! 2. `close_files`, after the last file open and exec (the shard has
//!    loaded its snapshot, opened /dev/kvm, the pagemap and entropy, and
//!    spawned its watchdog) and before its threads exist: RLIMIT_CORE 0,
//!    no_new_privs, and a Landlock domain with no file system access and no
//!    TCP bind or connect, which also cannot reach abstract Unix sockets or
//!    (for the shard) signal processes outside it. Threads created later
//!    inherit the domain.
//! 3. `filter_syscalls`, once every thread exists and before guest code
//!    runs: one seccomp filter on every thread (TSYNC) that kills the process
//!    on any syscall outside `policy`.
//!
//! No mount or PID namespace: an unprivileged mount namespace is refused on
//! hosts that restrict user namespaces (Ubuntu's AppArmor default) and adds
//! nothing once Landlock closes the file system; a PID namespace needs a
//! fork, and seccomp already denies ptrace and every signal outside the
//! process.
//!
//! A layer the kernel does not offer (Landlock missing, namespaces refused)
//! is recorded in the `Report` and printed (`Report::warn`), never skipped
//! silently; no_new_privs and seccomp are required.
pub mod bpf;
#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
mod linux;
pub mod policy;
#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
pub use linux::{Confinement, Error, Signals};

/// One confinement mechanism.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Layer {
    Namespaces,
    CoreLimit,
    NoNewPrivs,
    Landlock,
    Seccomp,
}
impl Layer {
    pub fn name(self) -> &'static str {
        match self {
            Layer::Namespaces => "user+net+ipc namespaces",
            Layer::CoreLimit => "RLIMIT_CORE 0",
            Layer::NoNewPrivs => "no_new_privs",
            Layer::Landlock => "landlock",
            Layer::Seccomp => "seccomp",
        }
    }
}
impl std::fmt::Display for Layer {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.name())
    }
}

/// The layers in force, and those the host lacks (with why).
#[derive(Debug, Default)]
pub struct Report {
    pub applied: Vec<Layer>,
    pub degraded: Vec<(Layer, String)>,
}
impl Report {
    /// One stderr line per missing layer, naming the process.
    pub fn warn(&self, who: &str) {
        for (layer, why) in &self.degraded {
            eprintln!("{who}: confinement degraded: {layer}: {why}");
        }
    }
    /// The report as one JSON object (`real confine`).
    pub fn json(&self) -> String {
        let applied: Vec<String> = self
            .applied
            .iter()
            .map(|l| format!("{:?}", l.name()))
            .collect();
        let degraded: Vec<String> = self
            .degraded
            .iter()
            .map(|(l, why)| format!("{:?}:{:?}", l.name(), why))
            .collect();
        format!(
            "{{\"applied\":[{}],\"degraded\":{{{}}}}}",
            applied.join(","),
            degraded.join(",")
        )
    }
}
