// Sandbox escape suite: simulates an attacker who already has native code execution inside
// a confined jitk-vmm (after a VMM bug). Same call order as vmm/src/main.rs, then one attack.
// usage: escape IMAGE ATTEMPT [PROFILE_BLOB]      (ATTEMPT=none boots normally)
// macOS: an attack must fail with an error (Seatbelt returns EPERM) -> prints "BLOCKED ...".
// Linux: an attack must kill the process with SIGSYS (seccomp KILL_PROCESS) or fail -> BLOCKED.
// "ESCAPED ..." on stdout means the confinement failed.
#[path = "../mod.rs"]
mod sandbox;
use krun::{ConsoleDevice, KernelFormat, MmioDeviceManager, Payload, VmmBuilder};
use std::{ffi::CString, io::Write, os::fd::AsFd, path::PathBuf};
#[allow(unused_imports)] use sandbox::compile_profile as _keep;

fn errno() -> i32 { std::io::Error::last_os_error().raw_os_error().unwrap_or(-1) }
fn verdict(name: &str, rc: i64) {
    let e = errno();
    let line = if rc < 0 { format!("BLOCKED {name} rc={rc} errno={e}\n") } else { format!("ESCAPED {name} rc={rc}\n") };
    let _ = std::io::stderr().write_all(line.as_bytes());
}
fn attack(name: &str) {
    let c = |s: &str| CString::new(s).unwrap();
    let rc: i64 = unsafe { match name {
        "read-etc-passwd" => libc::open(c("/etc/passwd").as_ptr(), libc::O_RDONLY) as i64,
        "read-home-ssh" => libc::open(c(&format!("{}/.ssh", std::env::var("HOME").unwrap_or("/root".into()))).as_ptr(), libc::O_RDONLY) as i64,
        "read-sibling" => libc::open(c("/tmp/jitk-07/r3/outside.txt").as_ptr(), libc::O_RDONLY) as i64,
        "write-tmp" => libc::open(c("/tmp/jitk-07-escape-write").as_ptr(), libc::O_CREAT | libc::O_WRONLY, 0o600) as i64,
        "socket-connect" => { let s = libc::socket(libc::AF_INET, libc::SOCK_STREAM, 0);
            if s < 0 { s as i64 } else {
                let mut a: libc::sockaddr_in = std::mem::zeroed();
                a.sin_family = libc::AF_INET as _; a.sin_port = 22u16.to_be(); a.sin_addr.s_addr = 0x0100007fu32;
                libc::connect(s, &a as *const _ as *const libc::sockaddr, std::mem::size_of_val(&a) as _) as i64 } }
        "socket-unix" => { let s = libc::socket(libc::AF_UNIX, libc::SOCK_STREAM, 0);
            if s < 0 { s as i64 } else {
                let mut a: libc::sockaddr_un = std::mem::zeroed(); a.sun_family = libc::AF_UNIX as _;
                for (i, b) in b"/var/run/docker.sock".iter().enumerate() { a.sun_path[i] = *b as _ }
                libc::connect(s, &a as *const _ as *const libc::sockaddr, std::mem::size_of_val(&a) as _) as i64 } }
        "exec-sh" => { let (sh, f, cmd) = (c("/bin/sh"), c("-c"), c("echo ESCAPED exec-sh >&2"));
            libc::execv(sh.as_ptr(), [sh.as_ptr(), f.as_ptr(), cmd.as_ptr(), std::ptr::null()].as_ptr()) as i64 }
        "fork" => { let p = libc::fork(); if p == 0 { libc::_exit(0) } p as i64 }
        "signal-parent" => libc::kill(libc::getppid(), libc::SIGCONT) as i64, // harmless signal, tests permission
        "mmap-exec" => { let p = libc::mmap(std::ptr::null_mut(), 4096, libc::PROT_READ | libc::PROT_WRITE | libc::PROT_EXEC,
            libc::MAP_PRIVATE | libc::MAP_ANON, -1, 0); if p == libc::MAP_FAILED { -1 } else { 0 } }
        #[cfg(target_os = "macos")]
        "sysctl-hostname" => { let mut b = [0u8; 64]; let mut l = b.len();
            libc::sysctlbyname(c("kern.hostname").as_ptr(), b.as_mut_ptr().cast(), &mut l, std::ptr::null_mut(), 0) as i64 }
        #[cfg(target_os = "macos")]
        "mach-lookup" => { unsafe extern "C" { static bootstrap_port: u32;
                fn bootstrap_look_up(bp: u32, name: *const libc::c_char, sp: *mut u32) -> i32; }
            let mut port = 0u32;
            let kr = bootstrap_look_up(bootstrap_port, c("com.apple.SecurityServer").as_ptr(), &mut port);
            if kr == 0 { 0 } else { -(kr as i64) } }
        #[cfg(target_os = "linux")]
        "open-dev-kvm" => libc::open(c("/dev/kvm").as_ptr(), libc::O_RDWR) as i64,
        #[cfg(target_os = "linux")]
        "ioctl-create-vm" => libc::ioctl(3, 0xae01, 0) as i64,
        #[cfg(target_os = "linux")]
        "ptrace-parent" => libc::ptrace(libc::PTRACE_ATTACH, libc::getppid(), 0, 0) as i64,
        #[cfg(target_os = "linux")]
        "unshare-user" => libc::unshare(libc::CLONE_NEWUSER) as i64,
        #[cfg(target_os = "linux")]
        "io-uring" => libc::syscall(425, 8u32, 0usize) as i64,
        #[cfg(target_os = "linux")]
        "bpf" => libc::syscall(libc::SYS_bpf, 0, 0usize, 0u32) as i64,
        #[cfg(target_os = "linux")]
        "seccomp-listener" => { // try to install a user-notif listener (would let a helper answer syscalls)
            libc::syscall(libc::SYS_seccomp, 1, 8 /*NEW_LISTENER*/, 0usize) as i64 }
        _ => { eprintln!("unknown attack {name}"); std::process::exit(2) }
    } };
    verdict(name, rc);
}
#[cfg(target_os = "linux")]
static VCPU_ATTACK: std::sync::OnceLock<String> = std::sync::OnceLock::new();
#[cfg(target_os = "linux")]
fn test_hook(role: utils::thread_hook::Role) {
    sandbox::enter_thread(role); // production confinement first, then the attack in that thread
    if role == utils::thread_hook::Role::Vcpu {
        if let Some(a) = VCPU_ATTACK.get() { attack(a) }
    }
}
fn main() {
    let a: Vec<String> = std::env::args().collect();
    let (image, what) = (std::fs::canonicalize(&a[1]).expect("image"), a[2].clone());
    let profile = a.get(3).map(PathBuf::from);
    #[cfg(target_os = "linux")]
    if let Some(v) = what.strip_prefix("vcpu:") { VCPU_ATTACK.set(v.into()).unwrap(); utils::thread_hook::set(test_hook); }
    let mut sb = sandbox::Sandbox::prepare(&image, profile.as_deref(), None).expect("prepare");
    let (stdin, stdout) = (std::io::stdin(), std::io::stdout());
    let mut console = ConsoleDevice::builder();
    console.add_inout_port("jitk", Some(stdin.as_fd()), Some(stdout.as_fd())).unwrap();
    let mut devices = MmioDeviceManager::new();
    devices.add(console.build().unwrap());
    let payload = Payload::load_external(image.to_str().unwrap(), KernelFormat::Raw, None, "").unwrap();
    let builder = VmmBuilder::new().vcpus(1).unwrap().ram_mib(32).unwrap().payload(payload)
        .devices(devices).nested_virt(false).shutdown_support(false);
    // Control run (proves each attack works when unconfined): JITK_ESCAPE_CONTROL=1.
    let control = std::env::var_os("JITK_ESCAPE_CONTROL").is_some();
    if !control { sb.before_build().expect("before_build"); }
    let _vm = builder.build().expect("build");
    if !control { sb.after_build().expect("after_build"); }
    let _ = std::io::stderr().write_all(b"{\"sandbox\":\"ok\"}\n");
    if what != "none" && !what.starts_with("vcpu:") { attack(&what) }
    let _ = std::io::stderr().write_all(b"ATTACKS-DONE\n");
    std::process::exit(0); // do not run the guest; the attack verdict is the result
}
