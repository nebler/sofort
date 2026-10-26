//! jitk-vmm confinement (owner: 07). Included by vmm/src/confinement.rs via
//! `#[path = "../sandbox/mod.rs"]`. Single file on purpose (no nested `mod x;`).
//!
//! Order inside jitk-vmm (01's main.rs):
//!   prepare() -> before_build() -> [macOS ack] -> build() -> after_build() -> [Linux ack] -> run()
//! macOS: before_build applies the precompiled Seatbelt profile (deny-default; read image dir;
//!        one sysctl). after_build is a no-op.
//! Linux: before_build = rlimits + prctl + setns(empty netns) + Landlock(image, /dev/kvm) +
//!        register the libkrun per-thread hook (patches/thread-hook.diff), so the vCPU thread
//!        confines itself before its first KVM_RUN. after_build = seccomp on the main thread
//!        (MAIN+CONSOLE, inherited by console workers which then narrow further), or, if the
//!        hook did not run, one union filter on all threads (TSYNC).
//! Supervisor rule: send `run` only after `{"sandbox":"ok"}` on stderr AND guest READY.
//! Linux: stderr must be a pipe (RLIMIT_FSIZE=0 makes writes to regular files raise SIGXFSZ).
use std::io::Read;
use std::path::{Path, PathBuf};

type E = Box<dyn std::error::Error>;

/// Seatbelt source; compiled once by the supervisor (`jitk-vmm --compile-profile`).
pub const SEATBELT_PROFILE: &str = include_str!("jitk.sb");

#[derive(Clone, Copy, PartialEq, Eq)]
enum Stage {
    Prepared,
    BeforeBuild,
    Confined,
    Failed,
}

pub struct Sandbox {
    image: PathBuf,
    #[allow(dead_code)]
    profile: Option<Vec<u8>>,
    #[allow(dead_code)]
    netns_fd: Option<i32>,
    stage: Stage,
}

const MAX_PROFILE_BYTES: usize = 1 << 16;

fn read_profile(reader: impl Read) -> Result<Vec<u8>, E> {
    let mut blob = Vec::new();
    reader
        .take((MAX_PROFILE_BYTES + 1) as u64)
        .read_to_end(&mut blob)?;
    if blob.is_empty() || blob.len() > MAX_PROFILE_BYTES {
        return Err("sandbox: bad compiled profile".into());
    }
    Ok(blob)
}

impl Sandbox {
    /// `image`: canonical absolute path. `profile`: macOS compiled blob (None => compile
    /// in-process, ~5 ms, same policy). `netns_fd`: Linux, fd of a pre-created empty netns.
    pub fn prepare(image: &Path, profile: Option<&Path>, netns_fd: Option<i32>) -> Result<Self, E> {
        // The profile/Landlock rule names the resolved path; a symlinked path (e.g. macOS
        // /tmp -> /private/tmp) would be denied at build() with a confusing EPERM.
        if std::fs::canonicalize(image)? != image {
            return Err("sandbox: image path must be canonical".into());
        }
        if cfg!(target_os = "macos") && netns_fd.is_some() {
            return Err("sandbox: --netns-fd is Linux-only".into());
        }
        if cfg!(target_os = "linux") && profile.is_some() {
            return Err("sandbox: --sandbox-profile is macOS-only".into());
        }
        let profile = match profile {
            Some(p) => Some(read_profile(std::fs::File::open(p)?)?),
            None => None,
        };
        Ok(Sandbox {
            image: image.to_path_buf(),
            profile,
            netns_fd,
            stage: Stage::Prepared,
        })
    }

    pub fn before_build(&mut self) -> Result<(), E> {
        if self.stage != Stage::Prepared {
            return Err("sandbox: before_build called twice".into());
        }
        // A partial confinement failure is terminal; never authorize the next step.
        self.stage = Stage::Failed;
        #[cfg(target_os = "macos")]
        {
            match &self.profile {
                Some(blob) => macos::apply(blob)?,
                None => macos::apply(&macos::compile(images_dir(&self.image)?)?)?,
            }
        }
        #[cfg(target_os = "linux")]
        {
            linux::limits()?;
            if let Some(fd) = self.netns_fd.take() {
                linux::enter_netns(fd)?
            }
            linux::landlock(&self.image)?;
            let _ = utils::thread_hook::set(enter_thread); // false only if a test pre-registered
        }
        if cfg!(not(any(target_os = "macos", target_os = "linux"))) {
            return Err("sandbox: unsupported OS; refusing unconfined launch".into());
        }
        self.stage = Stage::BeforeBuild;
        Ok(())
    }

    pub fn after_build(&mut self) -> Result<(), E> {
        if self.stage != Stage::BeforeBuild {
            return Err("sandbox: after_build without before_build".into());
        }
        self.stage = Stage::Failed;
        #[cfg(target_os = "linux")]
        {
            use std::sync::atomic::Ordering;
            if VCPU_CONFINED.load(Ordering::Acquire) {
                linux::install(
                    &bpf::compile(&[bpf::COMMON, bpf::MAIN, bpf::CONSOLE]),
                    false,
                )?;
            } else {
                linux::install(
                    &bpf::compile(&[bpf::COMMON, bpf::MAIN, bpf::VCPU, bpf::CONSOLE]),
                    true,
                )?;
            }
        }
        self.stage = Stage::Confined;
        Ok(())
    }
}

/// macOS: compile the profile for `images` (canonical dir) and write the blob atomically.
#[cfg(target_os = "macos")]
pub fn compile_profile(images: &Path, out: &Path) -> Result<(), E> {
    let blob = macos::compile(images)?;
    let tmp = out.with_extension("tmp");
    std::fs::write(&tmp, &blob)?;
    std::fs::rename(&tmp, out)?;
    Ok(())
}
#[cfg(not(target_os = "macos"))]
pub fn compile_profile(_images: &Path, _out: &Path) -> Result<(), E> {
    Err("sandbox: --compile-profile is macOS-only".into())
}

#[allow(dead_code)]
fn images_dir(image: &Path) -> Result<&Path, E> {
    image
        .parent()
        .ok_or_else(|| "sandbox: image has no parent dir".into())
}

/// Set when the vCPU thread has confined itself (per-role mode).
#[allow(dead_code)]
pub static VCPU_CONFINED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// Per-thread entry (libkrun thread hook). Never returns unconfined: aborts on failure.
#[cfg(target_os = "linux")]
pub fn enter_thread(role: utils::thread_hook::Role) {
    use utils::thread_hook::Role;
    let set: &[&[bpf::Rule]] = match role {
        Role::Vcpu => &[bpf::COMMON, bpf::VCPU],
        Role::ConsoleRx | Role::ConsoleTx => &[bpf::COMMON, bpf::CONSOLE],
    };
    if linux::install(&bpf::compile(set), false).is_err() {
        std::process::abort()
    }
    if role == Role::Vcpu {
        VCPU_CONFINED.store(true, std::sync::atomic::Ordering::Release)
    }
}

#[cfg(target_os = "macos")]
mod macos {
    use super::E;
    use std::ffi::{CStr, CString, c_char, c_int};
    #[repr(C)]
    struct Profile {
        builtin: *const c_char,
        data: *const u8,
        size: usize,
    }
    #[link(name = "sandbox")]
    unsafe extern "C" {
        // Private but long-stable libsandbox exports. Blob format is OS-version specific:
        // the supervisor compiles at startup; apply failure => exit 70 (fail closed).
        fn sandbox_create_params() -> *mut u8;
        fn sandbox_set_param(p: *mut u8, k: *const c_char, v: *const c_char) -> c_int;
        fn sandbox_free_params(p: *mut u8);
        fn sandbox_compile_string(
            s: *const c_char,
            p: *mut u8,
            err: *mut *mut c_char,
        ) -> *mut Profile;
        fn sandbox_free_profile(p: *mut Profile);
        fn sandbox_apply(p: *const Profile) -> c_int;
        fn sandbox_free_error(e: *mut c_char);
    }
    pub fn compile(images: &std::path::Path) -> Result<Vec<u8>, E> {
        let dir = CString::new(
            images
                .to_str()
                .ok_or("sandbox: images path must be UTF-8")?,
        )?;
        let src = CString::new(super::SEATBELT_PROFILE)?;
        unsafe {
            let params = sandbox_create_params();
            if params.is_null() {
                return Err("sandbox: create_params failed".into());
            }
            sandbox_set_param(params, c"IMAGES".as_ptr(), dir.as_ptr());
            let mut err = std::ptr::null_mut();
            let prof = sandbox_compile_string(src.as_ptr(), params, &mut err);
            sandbox_free_params(params);
            if prof.is_null() {
                let m = if err.is_null() {
                    "unknown".into()
                } else {
                    CStr::from_ptr(err).to_string_lossy().into_owned()
                };
                if !err.is_null() {
                    sandbox_free_error(err)
                }
                return Err(format!("sandbox: compile failed: {m}").into());
            }
            let blob = std::slice::from_raw_parts((*prof).data, (*prof).size).to_vec();
            sandbox_free_profile(prof);
            Ok(blob)
        }
    }
    pub fn apply(blob: &[u8]) -> Result<(), E> {
        let p = Profile {
            builtin: std::ptr::null(),
            data: blob.as_ptr(),
            size: blob.len(),
        };
        if unsafe { sandbox_apply(&p) } != 0 {
            return Err(
                format!("sandbox: apply failed: {}", std::io::Error::last_os_error()).into(),
            );
        }
        Ok(())
    }
}

#[cfg(target_os = "linux")]
mod linux {
    use super::E;
    use std::io::Error;
    use std::os::unix::ffi::OsStrExt;

    pub fn limits() -> Result<(), E> {
        for (res, v) in [
            (libc::RLIMIT_CORE, 0),
            (libc::RLIMIT_FSIZE, 0),
            (libc::RLIMIT_NOFILE, 64),
        ] {
            let l = libc::rlimit {
                rlim_cur: v,
                rlim_max: v,
            };
            if unsafe { libc::setrlimit(res, &l) } != 0 {
                return Err(Error::last_os_error().into());
            }
        }
        for (opt, arg) in [
            (libc::PR_SET_NO_NEW_PRIVS, 1),
            (libc::PR_SET_DUMPABLE, 0),
            (libc::PR_SET_PDEATHSIG, libc::SIGKILL as libc::c_ulong),
        ] {
            if unsafe { libc::prctl(opt, arg, 0, 0, 0) } != 0 {
                return Err(Error::last_os_error().into());
            }
        }
        Ok(())
    }

    pub fn enter_netns(fd: i32) -> Result<(), E> {
        let rc = unsafe { libc::setns(fd, libc::CLONE_NEWNET) };
        unsafe { libc::close(fd) };
        if rc != 0 {
            return Err(format!("sandbox: setns: {}", Error::last_os_error()).into());
        }
        Ok(())
    }

    #[repr(C)]
    struct RulesetAttr {
        fs: u64,
        net: u64,
        scoped: u64,
    }
    #[repr(C, packed)]
    struct PathBeneath {
        allowed: u64,
        parent_fd: i32,
    }
    const CREATE: libc::c_long = 444;
    const ADD: libc::c_long = 445;
    const RESTRICT: libc::c_long = 446;
    const READ_FILE: u64 = 1 << 2;
    const WRITE_FILE: u64 = 1 << 1;
    const IOCTL_DEV: u64 = 1 << 15;

    /// Handle every FS right (ABI>=4 required), TCP bind/connect, and (ABI>=6) abstract-unix +
    /// signal scopes. Allow only: read the image; read/write/ioctl /dev/kvm.
    pub fn landlock(image: &std::path::Path) -> Result<(), E> {
        let abi = unsafe { libc::syscall(CREATE, 0usize, 0usize, 1u32) };
        if abi < 4 {
            return Err(format!("sandbox: Landlock ABI {abi} < 4; refusing to run").into());
        }
        let fs: u64 = if abi >= 5 {
            (1 << 16) - 1
        } else {
            (1 << 15) - 1
        };
        let attr = RulesetAttr {
            fs,
            net: 0b11,
            scoped: if abi >= 6 { 0b11 } else { 0 },
        };
        let size: usize = if abi >= 6 { 24 } else { 16 };
        let rs = unsafe { libc::syscall(CREATE, &attr, size, 0u32) } as i32;
        if rs < 0 {
            return Err(Error::last_os_error().into());
        }
        let add = |path: &[u8], allowed: u64| -> Result<(), E> {
            let c = std::ffi::CString::new(path)?;
            let fd = unsafe { libc::open(c.as_ptr(), libc::O_PATH | libc::O_CLOEXEC) };
            if fd < 0 {
                return Err(Error::last_os_error().into());
            }
            let pb = PathBeneath {
                allowed: allowed & fs,
                parent_fd: fd,
            };
            let rc = unsafe { libc::syscall(ADD, rs, 1u32, &pb, 0u32) };
            unsafe { libc::close(fd) };
            if rc != 0 {
                return Err(Error::last_os_error().into());
            }
            Ok(())
        };
        let r = add(image.as_os_str().as_bytes(), READ_FILE)
            .and_then(|_| add(b"/dev/kvm", READ_FILE | WRITE_FILE | IOCTL_DEV));
        let rc = if r.is_ok() {
            unsafe { libc::syscall(RESTRICT, rs, 0u32) }
        } else {
            -1
        };
        unsafe { libc::close(rs) };
        r?;
        if rc != 0 {
            return Err(Error::last_os_error().into());
        }
        Ok(())
    }

    #[repr(C)]
    struct Fprog {
        len: u16,
        filter: *const u64,
    }
    pub fn install(prog: &[u64], tsync: bool) -> Result<(), E> {
        let f = Fprog {
            len: prog.len() as u16,
            filter: prog.as_ptr(),
        };
        let flags: libc::c_ulong = if tsync { 1 } else { 0 };
        if unsafe { libc::syscall(libc::SYS_seccomp, 1 as libc::c_ulong, flags, &f) } != 0 {
            return Err(format!("sandbox: seccomp: {}", Error::last_os_error()).into());
        }
        Ok(())
    }
}

/// Dependency-free seccomp-BPF compiler + allowlists (aarch64 syscall numbers). Derived from
/// strace -ff of libkrun a1d8616 on KVM; steady state = after the first vCPU kick.
/// Compiled on every OS so the decision tests run on macOS too.
#[allow(dead_code)]
pub mod bpf {
    pub const AUDIT_ARCH_AARCH64: u32 = 0xC000_00B7;
    pub const ALLOW: u32 = 0x7fff_0000;
    pub const KILL: u32 = 0x8000_0000; // KILL_PROCESS: the whole VMM, never a single thread
    pub const fn errno(e: u32) -> u32 {
        0x0005_0000 | e
    }
    #[derive(Clone, Copy)]
    pub enum C {
        Eq(u8, u64),
        Mask(u8, u64, u64),
    }
    pub struct Rule {
        pub nr: u32,
        pub alts: &'static [&'static [C]],
        pub ret: u32,
    }
    const fn r(nr: u32) -> Rule {
        Rule {
            nr,
            alts: &[],
            ret: ALLOW,
        }
    }
    const fn a(nr: u32, alts: &'static [&'static [C]]) -> Rule {
        Rule {
            nr,
            alts,
            ret: ALLOW,
        }
    }
    pub mod nr {
        pub const EVENTFD2: u32 = 19;
        pub const EPOLL_CTL: u32 = 21;
        pub const EPOLL_PWAIT: u32 = 22;
        pub const FCNTL: u32 = 25;
        pub const IOCTL: u32 = 29;
        pub const OPENAT: u32 = 56;
        pub const CLOSE: u32 = 57;
        pub const READ: u32 = 63;
        pub const WRITE: u32 = 64;
        pub const PPOLL: u32 = 73;
        pub const EXIT: u32 = 93;
        pub const EXIT_GROUP: u32 = 94;
        pub const FUTEX: u32 = 98;
        pub const SET_ROBUST_LIST: u32 = 99;
        pub const KILL: u32 = 129;
        pub const SCHED_GETAFFINITY: u32 = 123;
        pub const SCHED_YIELD: u32 = 124;
        pub const TGKILL: u32 = 131;
        pub const SIGALTSTACK: u32 = 132;
        pub const RT_SIGPROCMASK: u32 = 135;
        pub const RT_SIGRETURN: u32 = 139;
        pub const PRCTL: u32 = 167;
        pub const GETTID: u32 = 178;
        pub const SOCKET: u32 = 198;
        pub const MUNMAP: u32 = 215;
        pub const CLONE: u32 = 220;
        pub const EXECVE: u32 = 221;
        pub const MMAP: u32 = 222;
        pub const MPROTECT: u32 = 226;
        pub const MADVISE: u32 = 233;
        pub const SECCOMP: u32 = 277;
        pub const RSEQ: u32 = 293;
        pub const CLONE3: u32 = 435;
    }
    pub const KVM_RUN: u64 = 0xae80;
    pub const THREAD_FLAGS: u64 = 0x3d0f00; // exact pthread_create clone flags (glibc, observed)
    const FUTEX_OPS: &[&[C]] = &[
        &[C::Mask(1, 0x7f, 0)],
        &[C::Mask(1, 0x7f, 1)],
        &[C::Mask(1, 0x7f, 9)],
        &[C::Mask(1, 0x7f, 10)],
    ];
    /// All threads: thread start/exit plumbing, futex, non-executable memory.
    pub const COMMON: &[Rule] = &[
        a(nr::FUTEX, FUTEX_OPS),
        r(nr::RT_SIGPROCMASK),
        r(nr::RT_SIGRETURN),
        r(nr::SIGALTSTACK),
        // glibc >= 2.42 (Ubuntu 26.04, observed): HUGEPAGE in malloc, GUARD_INSTALL/REMOVE for thread stacks.
        r(nr::MUNMAP),
        a(
            nr::MADVISE,
            &[
                &[C::Eq(2, 4 /*DONTNEED*/)],
                &[C::Eq(2, 14 /*HUGEPAGE*/)],
                &[C::Eq(2, 102 /*GUARD_INSTALL*/)],
                &[C::Eq(2, 103 /*GUARD_REMOVE*/)],
            ],
        ),
        r(nr::EXIT),
        r(nr::EXIT_GROUP),
        r(nr::GETTID),
        r(nr::SCHED_YIELD),
        r(nr::RSEQ),
        r(nr::SET_ROBUST_LIST),
        r(nr::SCHED_GETAFFINITY),
        a(nr::PRCTL, &[&[C::Eq(0, 15 /*PR_SET_NAME*/)]]),
        a(
            nr::MMAP,
            &[&[
                C::Mask(2, 4 /*PROT_EXEC*/, 0),
                C::Mask(3, 0x20, 0x20 /*MAP_ANONYMOUS*/),
            ]],
        ),
        a(nr::MPROTECT, &[&[C::Mask(2, 4, 0)]]),
    ];
    /// vCPU: KVM_RUN only; eventfd kicks are exactly 8-byte writes.
    pub const VCPU: &[Rule] = &[
        a(nr::IOCTL, &[&[C::Eq(1, KVM_RUN)]]),
        a(nr::WRITE, &[&[C::Eq(2, 8)]]),
    ];
    /// Console RX/TX workers.
    pub const CONSOLE: &[Rule] = &[r(nr::READ), r(nr::WRITE), r(nr::PPOLL), r(nr::CLOSE)];
    /// Event loop: epoll + eventfds + spawning console workers at guest PORT_OPEN.
    pub const MAIN: &[Rule] = &[
        r(nr::EPOLL_PWAIT),
        r(nr::EPOLL_CTL),
        r(nr::READ),
        r(nr::WRITE),
        r(nr::EVENTFD2),
        r(nr::CLOSE),
        a(nr::FCNTL, &[&[C::Eq(1, 1030 /*F_DUPFD_CLOEXEC*/)]]),
        a(nr::CLONE, &[&[C::Eq(0, THREAD_FLAGS)]]),
        Rule {
            nr: nr::CLONE3,
            alts: &[],
            ret: errno(38),
        }, // ENOSYS => glibc falls back to clone
        a(
            nr::SECCOMP,
            &[&[C::Eq(0, 1 /*SET_MODE_FILTER*/), C::Eq(1, 0 /*no flags*/)]],
        ),
    ];
    #[derive(Clone, Copy, Debug)]
    pub struct Insn {
        pub code: u16,
        pub jt: u8,
        pub jf: u8,
        pub k: u32,
    }
    const fn st(code: u16, k: u32) -> Insn {
        Insn {
            code,
            jt: 0,
            jf: 0,
            k,
        }
    }
    const fn jeq(k: u32, jt: u8, jf: u8) -> Insn {
        Insn {
            code: 0x15,
            jt,
            jf,
            k,
        }
    }
    pub const LD: u16 = 0x20;
    pub const RET: u16 = 0x06;
    pub const AND: u16 = 0x54;
    pub const JEQ: u16 = 0x15;
    pub fn compile_insns(sets: &[&[Rule]]) -> Vec<Insn> {
        let mut p = vec![
            st(LD, 4),
            jeq(AUDIT_ARCH_AARCH64, 1, 0),
            st(RET, KILL),
            st(LD, 0),
        ];
        for rule in sets.iter().flat_map(|s| s.iter()) {
            let mut body = Vec::new();
            if rule.alts.is_empty() {
                body.push(st(RET, rule.ret));
            }
            for alt in rule.alts {
                let mut blk: Vec<Insn> = Vec::new();
                for &c in alt.iter() {
                    let (i, mask, v) = match c {
                        C::Eq(i, v) => (i, u64::MAX, v),
                        C::Mask(i, m, v) => (i, m, v),
                    };
                    let off = 16 + 8 * i as u32; // seccomp_data.args[i], little-endian lo/hi words
                    for (word, m, val) in [
                        (off, mask as u32, v as u32),
                        (off + 4, (mask >> 32) as u32, (v >> 32) as u32),
                    ] {
                        blk.push(st(LD, word));
                        if m != u32::MAX {
                            blk.push(st(AND, m));
                        }
                        blk.push(jeq(val, 0, 0));
                    }
                }
                blk.push(st(RET, rule.ret));
                let n = blk.len();
                for j in 0..n {
                    if blk[j].code == JEQ {
                        blk[j].jf = (n - j - 1) as u8
                    }
                } // mismatch: next alt
                body.extend(blk);
            }
            if !rule.alts.is_empty() {
                body.push(st(RET, KILL));
            } // syscall matched, args did not
            assert!(body.len() < 255);
            p.push(jeq(rule.nr, 0, body.len() as u8));
            p.extend(body);
        }
        p.push(st(RET, KILL));
        p
    }
    pub fn compile(sets: &[&[Rule]]) -> Vec<u64> {
        compile_insns(sets)
            .iter()
            .map(|i| {
                (i.code as u64) | (i.jt as u64) << 16 | (i.jf as u64) << 24 | (i.k as u64) << 32
            })
            .collect()
    }
    /// Reference evaluator (tests only): seccomp_data = nr, arch, ip, args[6].
    pub fn eval(p: &[Insn], arch: u32, nr: u32, args: [u64; 6]) -> u32 {
        let word = |off: u32| -> u32 {
            match off {
                0 => nr,
                4 => arch,
                o if o >= 16 => {
                    let a = args[((o - 16) / 8) as usize];
                    if (o - 16) % 8 == 0 {
                        a as u32
                    } else {
                        (a >> 32) as u32
                    }
                }
                _ => 0,
            }
        };
        let (mut pc, mut acc) = (0usize, 0u32);
        loop {
            let i = p[pc];
            match i.code {
                LD => acc = word(i.k),
                AND => acc &= i.k,
                JEQ => {
                    pc += if acc == i.k { i.jt } else { i.jf } as usize;
                }
                RET => return i.k,
                _ => panic!("bad insn"),
            }
            pc += 1;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::bpf::{self, *};
    #[cfg(target_os = "macos")]
    #[test]
    fn failed_before_build_does_not_authorize_after_build() {
        let mut sandbox = super::Sandbox {
            image: std::path::PathBuf::from("/invalid/image"),
            profile: Some(vec![0]),
            netns_fd: None,
            stage: super::Stage::Prepared,
        };
        assert!(sandbox.before_build().is_err());
        assert!(sandbox.after_build().is_err());
    }
    #[test]
    fn compiled_profile_bounds() {
        use super::{MAX_PROFILE_BYTES, read_profile};
        assert!(read_profile(&b""[..]).is_err());
        let data = vec![1; MAX_PROFILE_BYTES + 100];
        assert_eq!(read_profile(&data[..1]).unwrap(), [1]);
        assert_eq!(
            read_profile(&data[..MAX_PROFILE_BYTES]).unwrap().len(),
            MAX_PROFILE_BYTES
        );
        let mut reader = std::io::Cursor::new(data);
        assert!(read_profile(&mut reader).is_err());
        assert_eq!(reader.position(), (MAX_PROFILE_BYTES + 1) as u64);
    }
    fn run(sets: &[&[Rule]], nr: u32, args: [u64; 6]) -> u32 {
        eval(&compile_insns(sets), AUDIT_ARCH_AARCH64, nr, args)
    }
    const UNION: &[&[Rule]] = &[COMMON, MAIN, VCPU, CONSOLE];
    const VCPU_SET: &[&[Rule]] = &[COMMON, VCPU];
    const CONSOLE_SET: &[&[Rule]] = &[COMMON, CONSOLE];
    const Z: [u64; 6] = [0; 6];
    #[test]
    fn wrong_arch_killed() {
        assert_eq!(eval(&compile_insns(UNION), 0xC000_003E, nr::READ, Z), KILL)
    }
    #[test]
    fn kvm_run_only_in_vcpu() {
        assert_eq!(run(VCPU_SET, nr::IOCTL, [9, KVM_RUN, 0, 0, 0, 0]), ALLOW);
        assert_eq!(run(VCPU_SET, nr::IOCTL, [9, 0xae01, 0, 0, 0, 0]), KILL); // KVM_CREATE_VM
        assert_eq!(
            run(VCPU_SET, nr::IOCTL, [9, KVM_RUN | 1 << 32, 0, 0, 0, 0]),
            KILL
        ); // high bits
        assert_eq!(run(CONSOLE_SET, nr::IOCTL, [9, KVM_RUN, 0, 0, 0, 0]), KILL);
        assert_eq!(
            run(
                &[COMMON, MAIN, CONSOLE],
                nr::IOCTL,
                [9, KVM_RUN, 0, 0, 0, 0]
            ),
            KILL
        );
    }
    #[test]
    fn vcpu_writes_only_8_bytes() {
        assert_eq!(run(VCPU_SET, nr::WRITE, [5, 0, 8, 0, 0, 0]), ALLOW);
        assert_eq!(run(VCPU_SET, nr::WRITE, [1, 0, 4096, 0, 0, 0]), KILL);
        assert_eq!(run(VCPU_SET, nr::EVENTFD2, Z), KILL);
    }
    #[test]
    fn never_allowed_anywhere() {
        for n in [nr::OPENAT, nr::SOCKET, nr::EXECVE, nr::KILL, nr::TGKILL] {
            assert_eq!(run(UNION, n, Z), KILL, "nr {n}")
        }
    }
    #[test]
    fn clone_threads_only_and_clone3_enosys() {
        assert_eq!(run(UNION, nr::CLONE, [THREAD_FLAGS, 0, 0, 0, 0, 0]), ALLOW);
        assert_eq!(
            run(UNION, nr::CLONE, [0x11 /*SIGCHLD fork*/, 0, 0, 0, 0, 0]),
            KILL
        );
        assert_eq!(run(UNION, nr::CLONE3, Z), bpf::errno(38));
    }
    #[test]
    fn no_exec_memory() {
        assert_eq!(run(UNION, nr::MMAP, [0, 4096, 3, 0x22, u64::MAX, 0]), ALLOW);
        assert_eq!(run(UNION, nr::MMAP, [0, 4096, 5, 0x22, u64::MAX, 0]), KILL);
        assert_eq!(
            run(UNION, nr::MMAP, [0, 4096, 1, 0x02 /*file map*/, 3, 0]),
            KILL
        );
        assert_eq!(run(UNION, nr::MPROTECT, [0, 4096, 7, 0, 0, 0]), KILL);
        for adv in [4, 14, 102, 103] {
            assert_eq!(run(UNION, nr::MADVISE, [0, 4096, adv, 0, 0, 0]), ALLOW)
        }
        for adv in [
            9,  /*REMOVE*/
            10, /*DONTFORK*/
            12, /*MERGEABLE*/
            23, /*POPULATE_READ*/
        ] {
            assert_eq!(run(UNION, nr::MADVISE, [0, 4096, adv, 0, 0, 0]), KILL)
        }
    }
    #[test]
    fn futex_ops_and_seccomp_narrowing() {
        assert_eq!(run(UNION, nr::FUTEX, [0, 0x80 | 9, 0, 0, 0, 0]), ALLOW);
        assert_eq!(
            run(
                UNION,
                nr::FUTEX,
                [0, 0x80 | 12 /*CMP_REQUEUE_PI*/, 0, 0, 0, 0]
            ),
            KILL
        );
        assert_eq!(run(UNION, nr::SECCOMP, [1, 0, 0, 0, 0, 0]), ALLOW);
        assert_eq!(
            run(UNION, nr::SECCOMP, [1, 8 /*NEW_LISTENER*/, 0, 0, 0, 0]),
            KILL
        );
    }
    #[test]
    fn fits_kernel_limit() {
        assert!(compile(UNION).len() < 4096)
    }
    #[test]
    fn profile_is_minimal() {
        let rules: Vec<_> = super::SEATBELT_PROFILE
            .lines()
            .map(str::trim)
            .filter(|l| l.starts_with("(allow"))
            .collect();
        assert_eq!(rules.len(), 2, "{rules:?}");
        assert!(super::SEATBELT_PROFILE.contains("(deny default)"));
    }
}
