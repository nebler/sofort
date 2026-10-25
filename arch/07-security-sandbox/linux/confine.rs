// jitk-vmm Linux confinement: rlimits, no_new_privs, Landlock, seccomp-BPF.
// Allowlists derived from strace -ff of libkrun a1d8616 on real KVM (nested, HVF L0),
// steady state = everything after the first vCPU kick (tgkill SIGRT_2).
#![allow(dead_code)]
use std::ffi::CString;
use std::io::Error;

// ---------- seccomp-BPF (dependency-free; aarch64 only) ----------
const AUDIT_ARCH_AARCH64: u32 = 0xC000_00B7;
const ALLOW: u32 = 0x7fff_0000;
const KILL: u32 = 0x8000_0000; // SECCOMP_RET_KILL_PROCESS: whole VMM dies, never just a thread
const fn errno(e: u32) -> u32 { 0x0005_0000 | e }
#[derive(Clone, Copy)]
pub enum C { Eq(u8, u64), Mask(u8, u64, u64) } // arg index, (mask,) value
pub struct Rule { pub nr: u32, pub alts: &'static [&'static [C]], pub ret: u32 }
const fn r(nr: u32) -> Rule { Rule { nr, alts: &[], ret: ALLOW } }
const fn a(nr: u32, alts: &'static [&'static [C]]) -> Rule { Rule { nr, alts, ret: ALLOW } }

mod nr { // asm-generic (aarch64) syscall numbers
    pub const IOCTL: u32 = 29; pub const FCNTL: u32 = 25; pub const EVENTFD2: u32 = 19;
    pub const EPOLL_CTL: u32 = 21; pub const EPOLL_PWAIT: u32 = 22; pub const CLOSE: u32 = 57;
    pub const READ: u32 = 63; pub const WRITE: u32 = 64; pub const PPOLL: u32 = 73;
    pub const EXIT: u32 = 93; pub const EXIT_GROUP: u32 = 94; pub const SET_TID_ADDRESS: u32 = 96;
    pub const FUTEX: u32 = 98; pub const SET_ROBUST_LIST: u32 = 99; pub const SCHED_GETAFFINITY: u32 = 123;
    pub const SCHED_YIELD: u32 = 124; pub const SIGALTSTACK: u32 = 132; pub const RT_SIGPROCMASK: u32 = 135;
    pub const RT_SIGRETURN: u32 = 139; pub const PRCTL: u32 = 167; pub const GETTID: u32 = 178;
    pub const MUNMAP: u32 = 215; pub const CLONE: u32 = 220; pub const MMAP: u32 = 222;
    pub const MPROTECT: u32 = 226; pub const MADVISE: u32 = 233; pub const RSEQ: u32 = 293;
    pub const CLONE3: u32 = 435; pub const SECCOMP: u32 = 277;
}
const KVM_RUN: u64 = 0xae80;
const F_DUPFD_CLOEXEC: u64 = 1030;
const PR_SET_NAME: u64 = 15;
const MADV_DONTNEED: u64 = 4;
const PROT_EXEC: u64 = 4;
const MAP_ANONYMOUS: u64 = 0x20;
// pthread_create's exact flag set (observed in clone3 trace); clone3 itself returns ENOSYS so
// glibc falls back to clone(2), whose flags register *can* be checked by BPF.
const THREAD_FLAGS: u64 = 0x3d0f00;
const FUTEX_OPS: &[&[C]] = &[&[C::Mask(1, 0x7f, 0)], &[C::Mask(1, 0x7f, 1)],
    &[C::Mask(1, 0x7f, 9)], &[C::Mask(1, 0x7f, 10)]]; // WAIT, WAKE, WAIT_BITSET, WAKE_BITSET

/// Any thread: thread start/exit plumbing, futex, memory without PROT_EXEC.
pub const COMMON: &[Rule] = &[
    a(nr::FUTEX, FUTEX_OPS), r(nr::RT_SIGPROCMASK), r(nr::RT_SIGRETURN), r(nr::SIGALTSTACK),
    r(nr::MUNMAP), a(nr::MADVISE, &[&[C::Eq(2, MADV_DONTNEED)]]), r(nr::EXIT), r(nr::EXIT_GROUP),
    r(nr::GETTID), r(nr::SCHED_YIELD), r(nr::RSEQ), r(nr::SET_ROBUST_LIST), r(nr::SCHED_GETAFFINITY),
    a(nr::PRCTL, &[&[C::Eq(0, PR_SET_NAME)]]),
    a(nr::MMAP, &[&[C::Mask(2, PROT_EXEC, 0), C::Mask(3, MAP_ANONYMOUS, MAP_ANONYMOUS)]]),
    a(nr::MPROTECT, &[&[C::Mask(2, PROT_EXEC, 0)]]),
];
/// vCPU thread: KVM_RUN only; eventfd kicks are 8-byte writes.
pub const VCPU: &[Rule] = &[a(nr::IOCTL, &[&[C::Eq(1, KVM_RUN)]]), a(nr::WRITE, &[&[C::Eq(2, 8)]])];
/// Console RX/TX workers: pipe I/O + eventfds + ppoll. (Write length is guest-sized.)
pub const CONSOLE: &[Rule] = &[r(nr::READ), r(nr::WRITE), r(nr::PPOLL), r(nr::CLOSE)];
/// Event-loop (main) thread: epoll + eventfd + spawning the console workers at PORT_OPEN.
pub const MAIN: &[Rule] = &[
    r(nr::EPOLL_PWAIT), r(nr::EPOLL_CTL), r(nr::READ), r(nr::WRITE), r(nr::EVENTFD2), r(nr::CLOSE),
    a(nr::FCNTL, &[&[C::Eq(1, F_DUPFD_CLOEXEC)]]), a(nr::CLONE, &[&[C::Eq(0, THREAD_FLAGS)]]),
    Rule { nr: nr::CLONE3, alts: &[], ret: errno(38) },
    // v1 only: console workers inherit this filter and must add their own (can only narrow).
    a(nr::SECCOMP, &[&[C::Eq(0, 1 /*SET_MODE_FILTER*/), C::Eq(1, 0 /*no TSYNC/listener*/)]]),
];

#[repr(C)] #[derive(Clone, Copy)]
struct Insn { code: u16, jt: u8, jf: u8, k: u32 }
const fn st(code: u16, k: u32) -> Insn { Insn { code, jt: 0, jf: 0, k } }
const fn jeq(k: u32, jt: u8, jf: u8) -> Insn { Insn { code: 0x15, jt, jf, k } }
const LD: u16 = 0x20; const RET: u16 = 0x06; const AND: u16 = 0x54;
fn cond(c: C, fail: usize, out: &mut Vec<Insn>) { // fail = insns to skip from *end* of this cond
    let (i, mask, v) = match c { C::Eq(i, v) => (i, u64::MAX, v), C::Mask(i, m, v) => (i, m, v) };
    let off = 16 + 8 * i as u32;
    for (word, m, val) in [(off, mask as u32, v as u32), (off + 4, (mask >> 32) as u32, (v >> 32) as u32)] {
        out.push(st(LD, word));
        if m != u32::MAX { out.push(st(AND, m)); }
        let rest = out.len(); out.push(jeq(val, 0, 0));
        out[rest].jf = (fail + 0) as u8; // patched by caller via relative distance
    }
}
/// Compile rule sets into a BPF program; default action kills the whole process.
pub fn compile(sets: &[&[Rule]]) -> Vec<u64> {
    let mut p = vec![st(LD, 4), jeq(AUDIT_ARCH_AARCH64, 1, 0), st(RET, KILL), st(LD, 0)];
    for rule in sets.iter().flat_map(|s| s.iter()) {
        let mut body: Vec<Insn> = Vec::new();
        if rule.alts.is_empty() { body.push(st(RET, rule.ret)); }
        for alt in rule.alts {
            let mut blk = Vec::new(); let mut jumps = Vec::new();
            for &c in alt.iter() { let s = blk.len(); cond(c, 0, &mut blk);
                for (j, ins) in blk.iter().enumerate().skip(s) { if ins.code == 0x15 { jumps.push(j) } } }
            blk.push(st(RET, rule.ret));
            let n = blk.len();
            for j in jumps { blk[j].jf = (n - j - 1) as u8; } // on mismatch: jump past this alt
            body.extend(blk);
        }
        if !rule.alts.is_empty() { body.push(st(RET, KILL)); } // syscall matched, args didn't
        assert!(body.len() < 255);
        p.push(jeq(rule.nr, 0, body.len() as u8));
        p.extend(body);
    }
    p.push(st(RET, KILL));
    p.iter().map(|i| unsafe { std::mem::transmute::<Insn, u64>(*i) }).collect()
}
#[repr(C)] struct Fprog { len: u16, filter: *const u64 }
/// Install on the calling thread (tsync=false) or all threads (tsync=true).
pub fn install(prog: &[u64], tsync: bool) -> Result<(), Error> {
    let f = Fprog { len: prog.len() as u16, filter: prog.as_ptr() };
    let rc = unsafe { libc::syscall(libc::SYS_seccomp, 1 /*SET_MODE_FILTER*/, if tsync { 1 } else { 0 }, &f) };
    if rc != 0 { return Err(Error::last_os_error()) } Ok(())
}

// ---------- rlimits + prctl ----------
pub fn limits() -> Result<(), Error> {
    for (res, v) in [(libc::RLIMIT_CORE, 0), (libc::RLIMIT_FSIZE, 0), (libc::RLIMIT_NOFILE, 64)] {
        let l = libc::rlimit { rlim_cur: v, rlim_max: v };
        if unsafe { libc::setrlimit(res, &l) } != 0 { return Err(Error::last_os_error()) }
    }
    unsafe {
        if libc::prctl(libc::PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0 { return Err(Error::last_os_error()) }
        if libc::prctl(libc::PR_SET_DUMPABLE, 0, 0, 0, 0) != 0 { return Err(Error::last_os_error()) }
        // Die with the supervisor (Linux only); the supervisor also SIGKILLs via pidfd.
        if libc::prctl(libc::PR_SET_PDEATHSIG, libc::SIGKILL, 0, 0, 0) != 0 { return Err(Error::last_os_error()) }
    }
    Ok(())
}

// ---------- Landlock (ABI >= 4 required; scopes used if ABI >= 6) ----------
#[repr(C)] struct RulesetAttr { fs: u64, net: u64, scoped: u64 }
#[repr(C, packed)] struct PathBeneath { allowed: u64, parent_fd: i32 }
const SYS_LL_CREATE: i64 = 444; const SYS_LL_ADD: i64 = 445; const SYS_LL_RESTRICT: i64 = 446;
const READ_FILE: u64 = 1 << 2; const WRITE_FILE: u64 = 1 << 1; const IOCTL_DEV: u64 = 1 << 15;
pub fn landlock(read_only: &[&str], kvm: &str) -> Result<i64, Error> {
    let abi = unsafe { libc::syscall(SYS_LL_CREATE, 0usize, 0usize, 1u32 /*VERSION*/) };
    if abi < 4 { return Err(Error::other(format!("Landlock ABI {abi} < 4: refusing to run"))) }
    let fs = match abi { 4 => (1 << 15) - 1, _ => (1 << 16) - 1 }; // all FS rights incl. IOCTL_DEV (ABI5)
    let attr = RulesetAttr { fs, net: 0b11 /*BIND_TCP|CONNECT_TCP*/, scoped: if abi >= 6 { 0b11 } else { 0 } };
    let size = if abi >= 6 { 24 } else { 16 };
    let rs = unsafe { libc::syscall(SYS_LL_CREATE, &attr, size as usize, 0u32) };
    if rs < 0 { return Err(Error::last_os_error()) }
    let add = |path: &str, allowed: u64| -> Result<(), Error> {
        let c = CString::new(path).unwrap();
        let fd = unsafe { libc::open(c.as_ptr(), libc::O_PATH | libc::O_CLOEXEC) };
        if fd < 0 { return Err(Error::last_os_error()) }
        let pb = PathBeneath { allowed: allowed & fs, parent_fd: fd };
        let rc = unsafe { libc::syscall(SYS_LL_ADD, rs, 1u32 /*PATH_BENEATH*/, &pb, 0u32) };
        unsafe { libc::close(fd) };
        if rc != 0 { return Err(Error::last_os_error()) } Ok(())
    };
    for p in read_only { add(p, READ_FILE)? }
    add(kvm, READ_FILE | WRITE_FILE | IOCTL_DEV)?;
    if unsafe { libc::syscall(SYS_LL_RESTRICT, rs, 0u32) } != 0 { return Err(Error::last_os_error()) }
    unsafe { libc::close(rs as i32) };
    Ok(abi)
}
