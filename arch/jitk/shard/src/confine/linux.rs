//! The Linux mechanisms behind `Confinement` (see mod.rs for the order).
use super::{Layer, Report, bpf};
use std::{
    io,
    os::fd::{AsRawFd, FromRawFd, OwnedFd},
};

/// A layer that could not be applied although the kernel offers it.
#[derive(Debug)]
pub struct Error {
    pub layer: Layer,
    pub source: io::Error,
}
impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "confinement: {}: {}", self.layer, self.source)
    }
}
impl std::error::Error for Error {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        Some(&self.source)
    }
}
impl From<Error> for io::Error {
    fn from(e: Error) -> Self {
        io::Error::other(e)
    }
}
fn os_error(layer: Layer) -> Error {
    Error {
        layer,
        source: io::Error::last_os_error(),
    }
}

/// Whom the Landlock domain may still signal.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Signals {
    /// Only processes inside the domain: the shard signals its own threads.
    OwnProcess,
    /// Anyone the other layers allow: the watchdog kicks the shard, which is
    /// outside the watchdog's domain.
    Unscoped,
}

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Debug)]
enum Stage {
    Open,
    FilesClosed,
    Filtered,
}

/// The confinement of one process, applied step by step as its setup
/// allows; the steps must come in order.
pub struct Confinement {
    report: Report,
    stage: Stage,
}
impl Default for Confinement {
    fn default() -> Self {
        Self::new()
    }
}
impl Confinement {
    pub fn new() -> Self {
        Self {
            report: Report::default(),
            stage: Stage::Open,
        }
    }
    pub fn report(&self) -> &Report {
        &self.report
    }
    /// New user, network and IPC namespaces. Call while the process has a
    /// single thread and before it creates children that should share them.
    /// A refusal (user namespaces disabled or restricted) is a degradation.
    pub fn enter_namespaces(&mut self) {
        assert_eq!(self.stage, Stage::Open, "namespaces come first");
        // The new user namespace is what lets an unprivileged process create
        // the other two in the same call. Credentials, and so access to
        // /dev/kvm and already open descriptors, are unchanged.
        let flags = libc::CLONE_NEWUSER | libc::CLONE_NEWNET | libc::CLONE_NEWIPC;
        // SAFETY: unshare takes scalar flags and retains nothing.
        if unsafe { libc::unshare(flags) } == 0 {
            self.report.applied.push(Layer::Namespaces);
        } else {
            let why = io::Error::last_os_error().to_string();
            self.report.degraded.push((Layer::Namespaces, why));
        }
    }
    /// RLIMIT_CORE 0, no_new_privs and a Landlock domain without file system
    /// or TCP access. Call after the process's last open and exec, before it
    /// creates the threads that should inherit the domain.
    pub fn close_files(&mut self, signals: Signals) -> Result<(), Error> {
        assert_eq!(self.stage, Stage::Open, "files close once, before seccomp");
        let none = libc::rlimit {
            rlim_cur: 0,
            rlim_max: 0,
        };
        // SAFETY: a live rlimit read only during the call.
        if unsafe { libc::setrlimit(libc::RLIMIT_CORE, &none) } != 0 {
            return Err(os_error(Layer::CoreLimit));
        }
        self.report.applied.push(Layer::CoreLimit);
        // SAFETY: prctl(PR_SET_NO_NEW_PRIVS, 1) takes scalars only.
        if unsafe { libc::prctl(libc::PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) } != 0 {
            return Err(os_error(Layer::NoNewPrivs));
        }
        self.report.applied.push(Layer::NoNewPrivs);
        landlock(signals, &mut self.report)?;
        self.stage = Stage::FilesClosed;
        Ok(())
    }
    /// Install `rules` on every thread of the process: any other syscall
    /// kills it. Call once every thread exists, before guest code runs.
    pub fn filter_syscalls(&mut self, rules: &[bpf::Rule]) -> Result<(), Error> {
        assert_eq!(self.stage, Stage::FilesClosed, "seccomp needs no_new_privs");
        let program = bpf::compile(rules);
        let filter = SockFprog {
            len: program.len() as u16,
            filter: program.as_ptr(),
        };
        // SAFETY: filter has struct sock_fprog's layout and borrows the live
        // program for the call; the kernel copies it.
        let r = unsafe {
            libc::syscall(
                libc::SYS_seccomp,
                SECCOMP_SET_MODE_FILTER,
                SECCOMP_FILTER_FLAG_TSYNC,
                &filter,
            )
        };
        if r != 0 {
            let source = if r > 0 {
                io::Error::other(format!("thread {r} could not be synchronised"))
            } else {
                io::Error::last_os_error()
            };
            return Err(Error {
                layer: Layer::Seccomp,
                source,
            });
        }
        self.report.applied.push(Layer::Seccomp);
        self.stage = Stage::Filtered;
        Ok(())
    }
}

const SECCOMP_SET_MODE_FILTER: libc::c_ulong = 1;
const SECCOMP_FILTER_FLAG_TSYNC: libc::c_ulong = 1;
#[repr(C)]
struct SockFprog {
    len: u16,
    filter: *const bpf::Insn,
}

#[repr(C)]
struct RulesetAttr {
    handled_access_fs: u64,
    handled_access_net: u64,
    scoped: u64,
}
const LANDLOCK_CREATE_RULESET_VERSION: u32 = 1;
const SCOPE_ABSTRACT_UNIX_SOCKET: u64 = 1 << 0;
const SCOPE_SIGNAL: u64 = 1 << 1;
const NET_BIND_TCP: u64 = 1 << 0;
const NET_CONNECT_TCP: u64 = 1 << 1;
/// Every file system right of a Landlock ABI: 13 in ABI 1, then REFER (2),
/// TRUNCATE (3) and IOCTL_DEV (5).
fn fs_rights(abi: i64) -> u64 {
    let count = match abi {
        1 => 13,
        2 => 14,
        3 | 4 => 15,
        _ => 16,
    };
    (1 << count) - 1
}

/// A Landlock domain that handles every right of this kernel's ABI and
/// grants none: no file can be opened, created, executed or truncated, no
/// TCP port bound or connected; from ABI 6 no abstract Unix socket reached
/// and (with `Signals::OwnProcess`) no outside process signalled.
fn landlock(signals: Signals, report: &mut Report) -> Result<(), Error> {
    // SAFETY: the version query takes null attributes, size 0 and a flag.
    let abi = unsafe {
        libc::syscall(
            libc::SYS_landlock_create_ruleset,
            std::ptr::null::<RulesetAttr>(),
            0usize,
            LANDLOCK_CREATE_RULESET_VERSION,
        )
    };
    if abi < 1 {
        let why = format!("unavailable ({})", io::Error::last_os_error());
        report.degraded.push((Layer::Landlock, why));
        return Ok(());
    }
    let attr = RulesetAttr {
        handled_access_fs: fs_rights(abi),
        handled_access_net: if abi >= 4 {
            NET_BIND_TCP | NET_CONNECT_TCP
        } else {
            0
        },
        scoped: match (abi >= 6, signals) {
            (false, _) => 0,
            (true, Signals::OwnProcess) => SCOPE_ABSTRACT_UNIX_SOCKET | SCOPE_SIGNAL,
            (true, Signals::Unscoped) => SCOPE_ABSTRACT_UNIX_SOCKET,
        },
    };
    // The attribute grew with the ABI; pass only the fields this one knows.
    let size = match abi {
        1..=3 => 8,
        4 | 5 => 16,
        _ => size_of::<RulesetAttr>(),
    };
    // SAFETY: attr has landlock_ruleset_attr's layout and lives for the
    // call; size covers only fields this ABI defines.
    let fd = unsafe { libc::syscall(libc::SYS_landlock_create_ruleset, &attr, size, 0u32) };
    if fd < 0 {
        return Err(os_error(Layer::Landlock));
    }
    // SAFETY: a new ruleset descriptor, owned only here.
    let ruleset = unsafe { OwnedFd::from_raw_fd(fd as i32) };
    // SAFETY: a live ruleset descriptor and no flags.
    if unsafe { libc::syscall(libc::SYS_landlock_restrict_self, ruleset.as_raw_fd(), 0u32) } != 0 {
        return Err(os_error(Layer::Landlock));
    }
    report.applied.push(Layer::Landlock);
    if abi < 4 {
        let why = format!("ABI {abi}: TCP bind/connect not restricted");
        report.degraded.push((Layer::Landlock, why));
    }
    if abi < 6 {
        let why = format!("ABI {abi}: abstract sockets and signals not scoped");
        report.degraded.push((Layer::Landlock, why));
    }
    Ok(())
}
