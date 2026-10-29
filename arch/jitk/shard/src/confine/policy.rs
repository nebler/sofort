//! The syscall allowlists of the confined shard (`real ipc`) and its lease
//! watchdog, once setup is done: every file, socket, exec and thread is
//! created before the filter is installed, so neither process may open,
//! connect, exec, fork, trace or signal outside itself afterwards. Built
//! from the code paths in owner.rs, ipc.rs, clock.rs, lease.rs and the
//! allocator, and checked under strace on kvm-dev (`real confine` runs a
//! guest under the filter).
use super::bpf::{Arg, Rule};
use crate::constants::kvm;

/// aarch64 Linux syscall numbers (include/uapi/asm-generic/unistd.h; the
/// Linux test checks them against libc).
pub mod nr {
    pub const IOCTL: u32 = 29;
    pub const UNSHARE: u32 = 97;
    pub const OPENAT: u32 = 56;
    pub const CLOSE: u32 = 57;
    pub const READ: u32 = 63;
    pub const WRITE: u32 = 64;
    pub const PREAD64: u32 = 67;
    pub const PPOLL: u32 = 73;
    pub const EXIT: u32 = 93;
    pub const EXIT_GROUP: u32 = 94;
    pub const FUTEX: u32 = 98;
    pub const NANOSLEEP: u32 = 101;
    pub const CLOCK_GETTIME: u32 = 113;
    pub const CLOCK_NANOSLEEP: u32 = 115;
    pub const PTRACE: u32 = 117;
    pub const SCHED_YIELD: u32 = 124;
    pub const KILL: u32 = 129;
    pub const TGKILL: u32 = 131;
    pub const SIGALTSTACK: u32 = 132;
    pub const RT_SIGPROCMASK: u32 = 135;
    pub const RT_SIGRETURN: u32 = 139;
    pub const PRCTL: u32 = 167;
    pub const GETPID: u32 = 172;
    pub const GETTID: u32 = 178;
    pub const SOCKET: u32 = 198;
    pub const CONNECT: u32 = 203;
    pub const BRK: u32 = 214;
    pub const MUNMAP: u32 = 215;
    pub const MREMAP: u32 = 216;
    pub const CLONE: u32 = 220;
    pub const EXECVE: u32 = 221;
    pub const MMAP: u32 = 222;
    pub const MPROTECT: u32 = 226;
    pub const MADVISE: u32 = 233;
    pub const WAIT4: u32 = 260;
    pub const SETNS: u32 = 268;
    pub const PROCESS_VM_READV: u32 = 270;
    pub const SECCOMP: u32 = 277;
    pub const GETRANDOM: u32 = 278;
    pub const PIDFD_SEND_SIGNAL: u32 = 424;
    pub const PIDFD_OPEN: u32 = 434;
    pub const CLONE3: u32 = 435;
    pub const OPENAT2: u32 = 437;
}

const PROT_EXEC: u64 = 4;
const FUTEX_CMD: u64 = 0x7f; // without FUTEX_PRIVATE_FLAG and FUTEX_CLOCK_REALTIME
const SIGKILL: u64 = 9;
/// The watchdog's kick (lease.rs SIGNAL).
const SIGUSR1: u64 = 10;

/// The KVM ioctls an owner thread issues on its VM and vCPU descriptors
/// after setup: creating a slot (lazily, on its first START), running,
/// resetting and verifying it. /dev/kvm's own setup queries are done.
pub const KVM_IOCTLS: [u64; 11] = [
    kvm::KVM_CREATE_VM,
    kvm::KVM_CREATE_VCPU,
    kvm::KVM_ARM_PREFERRED_TARGET,
    kvm::KVM_ARM_VCPU_INIT,
    kvm::KVM_SET_USER_MEMORY_REGION,
    kvm::KVM_RUN,
    kvm::KVM_GET_ONE_REG,
    kvm::KVM_SET_ONE_REG,
    kvm::KVM_GET_REG_LIST,
    kvm::KVM_SET_MP_STATE,
    kvm::KVM_GET_MP_STATE,
];

/// What every thread of both processes needs: the allocator (never an
/// executable mapping), futex waits and wakes (no PI or requeue operations),
/// eventfd and pipe reads and writes, ppoll, clocks and sleeps, signal
/// return, and exit.
fn runtime() -> Vec<Rule> {
    let no_exec = [Arg::Masked(2, PROT_EXEC, 0)];
    let futex = |op| [Arg::Masked(1, FUTEX_CMD, op)];
    vec![
        Rule::allow(nr::READ),
        Rule::allow(nr::WRITE),
        Rule::allow(nr::PPOLL),
        Rule::allow_any(
            nr::FUTEX,
            // WAIT, WAKE, WAIT_BITSET, WAKE_BITSET
            &[&futex(0), &futex(1), &futex(9), &futex(10)],
        ),
        Rule::allow(nr::CLOCK_GETTIME),
        Rule::allow(nr::CLOCK_NANOSLEEP),
        Rule::allow(nr::NANOSLEEP),
        Rule::allow(nr::SCHED_YIELD),
        Rule::allow(nr::GETTID),
        Rule::allow(nr::GETPID),
        Rule::allow(nr::GETRANDOM),
        Rule::allow(nr::RT_SIGRETURN),
        Rule::allow(nr::RT_SIGPROCMASK),
        Rule::allow(nr::SIGALTSTACK),
        Rule::allow(nr::BRK),
        Rule::allow_if(nr::MMAP, &no_exec),
        Rule::allow_if(nr::MPROTECT, &no_exec),
        Rule::allow(nr::MUNMAP),
        Rule::allow(nr::MREMAP),
        // Advice changes only this process's own pages; the advice values
        // that reach further (HWPOISON, SOFT_OFFLINE) need CAP_SYS_ADMIN.
        Rule::allow(nr::MADVISE),
        Rule::allow(nr::CLOSE),
        Rule::allow(nr::EXIT),
        Rule::allow(nr::EXIT_GROUP),
    ]
}

/// The shard: the runtime, KVM ioctls, positional pagemap reads (reset),
/// and signals to its own threads only (abort raises SIGABRT that way).
pub fn shard(pid: u32) -> Vec<Rule> {
    let mut rules = runtime();
    let ioctls: Vec<[Arg; 1]> = KVM_IOCTLS.iter().map(|&op| [Arg::Eq(1, op)]).collect();
    let ioctls: Vec<&[Arg]> = ioctls.iter().map(|a| &a[..]).collect();
    rules.extend([
        Rule::allow_any(nr::IOCTL, &ioctls),
        Rule::allow(nr::PREAD64),
        Rule::allow_if(nr::TGKILL, &[Arg::Eq(0, pid as u64)]),
    ]);
    rules
}

/// The lease watchdog: the runtime, the kick (SIGUSR1 to a thread of the
/// shard) and the escalation (SIGKILL through the shard's pidfd).
pub fn watchdog(shard: u32, pidfd: i32) -> Vec<Rule> {
    let mut rules = runtime();
    rules.extend([
        Rule::allow_if(nr::TGKILL, &[Arg::Eq(0, shard as u64), Arg::Eq(2, SIGUSR1)]),
        Rule::allow_if(
            nr::PIDFD_SEND_SIGNAL,
            &[
                Arg::Eq(0, pidfd as u64),
                Arg::Eq(1, SIGKILL),
                Arg::Eq(2, 0),
                Arg::Eq(3, 0),
            ],
        ),
    ]);
    rules
}

#[cfg(test)]
mod tests {
    use super::super::bpf::{AUDIT_ARCH_AARCH64, Action, compile, eval};
    use super::{KVM_IOCTLS, nr, shard, watchdog};
    use crate::constants::kvm;
    const PID: u32 = 4242;
    fn on(rules: &[super::Rule], nr: u32, args: [u64; 6]) -> Action {
        eval(&compile(rules), AUDIT_ARCH_AARCH64, nr, args)
    }
    fn args(a: &[u64]) -> [u64; 6] {
        let mut all = [0; 6];
        all[..a.len()].copy_from_slice(a);
        all
    }
    #[test]
    fn shard_runs_kvm_and_nothing_else_through_ioctl() {
        let rules = shard(PID);
        for op in KVM_IOCTLS {
            assert_eq!(on(&rules, nr::IOCTL, args(&[7, op])), Action::Allow);
        }
        for op in [
            kvm::KVM_GET_API_VERSION,
            0x5413,                 // TIOCGWINSZ
            0x541c,                 // TIOCLINUX
            kvm::KVM_RUN | 1 << 32, // a KVM number in the upper half
        ] {
            assert_eq!(on(&rules, nr::IOCTL, args(&[7, op])), Action::KillProcess);
        }
    }
    #[test]
    fn shard_cannot_open_connect_exec_fork_trace_or_signal_others() {
        let rules = shard(PID);
        for n in [
            nr::OPENAT,
            nr::OPENAT2,
            nr::SOCKET,
            nr::CONNECT,
            nr::EXECVE,
            nr::CLONE,
            nr::CLONE3,
            nr::PTRACE,
            nr::PROCESS_VM_READV,
            nr::KILL,
            nr::PIDFD_OPEN,
            nr::PIDFD_SEND_SIGNAL,
            nr::WAIT4,
            nr::PRCTL,
            nr::SECCOMP,
            nr::UNSHARE,
            nr::SETNS,
        ] {
            assert_eq!(on(&rules, n, args(&[])), Action::KillProcess, "syscall {n}");
        }
        assert_eq!(
            on(&rules, nr::TGKILL, args(&[PID as u64, 9, 6])),
            Action::Allow
        );
        assert_eq!(
            on(&rules, nr::TGKILL, args(&[1, 1, 9])),
            Action::KillProcess
        );
    }
    #[test]
    fn memory_is_never_executable() {
        let rules = shard(PID);
        let rw = 3;
        assert_eq!(
            on(&rules, nr::MMAP, args(&[0, 4096, rw, 0x22])),
            Action::Allow
        );
        assert_eq!(
            on(&rules, nr::MMAP, args(&[0, 4096, rw | 4, 0x22])),
            Action::KillProcess
        );
        assert_eq!(on(&rules, nr::MPROTECT, args(&[0, 4096, 1])), Action::Allow);
        assert_eq!(
            on(&rules, nr::MPROTECT, args(&[0, 4096, 5])),
            Action::KillProcess
        );
    }
    #[test]
    fn futex_has_no_pi_or_requeue() {
        let rules = shard(PID);
        let private = 128;
        for op in [0, 1, 9, 10] {
            assert_eq!(
                on(&rules, nr::FUTEX, args(&[0, op | private])),
                Action::Allow
            );
        }
        for op in [3, 4, 6, 7, 11, 12] {
            assert_eq!(
                on(&rules, nr::FUTEX, args(&[0, op])),
                Action::KillProcess,
                "op {op}"
            );
        }
    }
    #[test]
    fn watchdog_signals_only_the_shard() {
        let rules = watchdog(PID, 5);
        assert_eq!(
            on(&rules, nr::TGKILL, args(&[PID as u64, 7, 10])),
            Action::Allow
        );
        assert_eq!(
            on(&rules, nr::TGKILL, args(&[PID as u64, 7, 9])),
            Action::KillProcess
        );
        assert_eq!(
            on(&rules, nr::TGKILL, args(&[1, 1, 10])),
            Action::KillProcess
        );
        assert_eq!(
            on(&rules, nr::PIDFD_SEND_SIGNAL, args(&[5, 9])),
            Action::Allow
        );
        assert_eq!(
            on(&rules, nr::PIDFD_SEND_SIGNAL, args(&[6, 9])),
            Action::KillProcess
        );
        assert_eq!(
            on(&rules, nr::IOCTL, args(&[3, kvm::KVM_RUN])),
            Action::KillProcess
        );
        assert_eq!(
            on(&rules, nr::KILL, args(&[PID as u64, 9])),
            Action::KillProcess
        );
    }
    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    #[test]
    fn syscall_numbers_match_libc() {
        for (ours, libc) in [
            (nr::IOCTL, libc::SYS_ioctl),
            (nr::UNSHARE, libc::SYS_unshare),
            (nr::OPENAT, libc::SYS_openat),
            (nr::CLOSE, libc::SYS_close),
            (nr::READ, libc::SYS_read),
            (nr::WRITE, libc::SYS_write),
            (nr::PREAD64, libc::SYS_pread64),
            (nr::PPOLL, libc::SYS_ppoll),
            (nr::EXIT, libc::SYS_exit),
            (nr::EXIT_GROUP, libc::SYS_exit_group),
            (nr::FUTEX, libc::SYS_futex),
            (nr::NANOSLEEP, libc::SYS_nanosleep),
            (nr::CLOCK_GETTIME, libc::SYS_clock_gettime),
            (nr::CLOCK_NANOSLEEP, libc::SYS_clock_nanosleep),
            (nr::PTRACE, libc::SYS_ptrace),
            (nr::SCHED_YIELD, libc::SYS_sched_yield),
            (nr::KILL, libc::SYS_kill),
            (nr::TGKILL, libc::SYS_tgkill),
            (nr::SIGALTSTACK, libc::SYS_sigaltstack),
            (nr::RT_SIGPROCMASK, libc::SYS_rt_sigprocmask),
            (nr::RT_SIGRETURN, libc::SYS_rt_sigreturn),
            (nr::PRCTL, libc::SYS_prctl),
            (nr::GETPID, libc::SYS_getpid),
            (nr::GETTID, libc::SYS_gettid),
            (nr::SOCKET, libc::SYS_socket),
            (nr::CONNECT, libc::SYS_connect),
            (nr::BRK, libc::SYS_brk),
            (nr::MUNMAP, libc::SYS_munmap),
            (nr::MREMAP, libc::SYS_mremap),
            (nr::CLONE, libc::SYS_clone),
            (nr::EXECVE, libc::SYS_execve),
            (nr::MMAP, libc::SYS_mmap),
            (nr::MPROTECT, libc::SYS_mprotect),
            (nr::MADVISE, libc::SYS_madvise),
            (nr::WAIT4, libc::SYS_wait4),
            (nr::SETNS, libc::SYS_setns),
            (nr::PROCESS_VM_READV, libc::SYS_process_vm_readv),
            (nr::SECCOMP, libc::SYS_seccomp),
            (nr::GETRANDOM, libc::SYS_getrandom),
            (nr::PIDFD_SEND_SIGNAL, libc::SYS_pidfd_send_signal),
            (nr::PIDFD_OPEN, libc::SYS_pidfd_open),
            (nr::CLONE3, libc::SYS_clone3),
            (nr::OPENAT2, libc::SYS_openat2),
        ] {
            assert_eq!(ours as libc::c_long, libc, "syscall {ours}");
        }
    }
}
