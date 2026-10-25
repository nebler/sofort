// jitk-vmm (Linux/KVM): one process = one single-use VM, confined before guest code is trusted.
// Order: limits+NNP -> Landlock (image + /dev/kvm only) -> build() (vCPU runs TRUSTED image)
//        -> seccomp -> ack "S" on fd 2 -> run(). Supervisor sends untrusted JS only after
//        it has seen BOTH the ack and the guest READY frame.
// JITK_* env knobs exist only in this spike build (experiments), not in production.
mod confine;
use krun::{ConsoleDevice, KernelFormat, MmioDeviceManager, Payload, VmmBuilder};
use std::{io::Write, os::fd::AsFd, process::ExitCode, time::Instant};

fn env(k: &str) -> Option<String> { std::env::var(k).ok() }
fn evil(what: &str) { // simulate attacker code execution inside the VMM after confinement
    let c = std::ffi::CString::new("/etc/passwd").unwrap();
    let rc = unsafe { match what {
        "openat" => libc::open(c.as_ptr(), libc::O_RDONLY) as i64,
        "socket" => libc::socket(libc::AF_INET, libc::SOCK_STREAM, 0) as i64,
        "execve" => libc::execv(c"/bin/true".as_ptr(), [c"/bin/true".as_ptr(), std::ptr::null()].as_ptr()) as i64,
        "ioctl" => libc::ioctl(0, libc::TIOCGWINSZ, 0) as i64,
        "kvm-create-vm" => libc::ioctl(3, 0xae01, 0) as i64,
        "mmap-exec" => libc::mmap(std::ptr::null_mut(), 4096, libc::PROT_READ | libc::PROT_EXEC,
                                  libc::MAP_PRIVATE | libc::MAP_ANONYMOUS, -1, 0) as i64,
        "clone3" => libc::syscall(435, 0usize, 0usize),
        "kill" => libc::kill(1, libc::SIGTERM) as i64,
        "vcpu-role-eventfd" => { // per-role check: a thread holding only the vCPU filter
            let h = std::thread::spawn(|| {
                confine::install(&confine::compile(&[confine::COMMON, confine::VCPU]), false).unwrap();
                libc::eventfd(0, 0) as i64 });
            h.join().unwrap_or(-2) }
        "console-role-ioctl" => {
            let h = std::thread::spawn(|| {
                confine::install(&confine::compile(&[confine::COMMON, confine::CONSOLE]), false).unwrap();
                libc::ioctl(5, 0xae80, 0) as i64 });
            h.join().unwrap_or(-2) }
        _ => -999 } };
    eprintln!("EVIL {what} survived rc={rc} errno={}", std::io::Error::last_os_error());
}
#[cfg(feature_hook)]
fn role_hook(role: utils::thread_hook::Role) {
    use utils::thread_hook::Role;
    let set: &[&[confine::Rule]] = match role {
        Role::Vcpu => &[confine::COMMON, confine::VCPU],
        Role::ConsoleRx | Role::ConsoleTx => &[confine::COMMON, confine::CONSOLE] };
    if confine::install(&confine::compile(set), false).is_err() { std::process::abort() }
    if role == Role::Vcpu && env("JITK_EVIL_VCPU").is_some() { // attacker in the vCPU thread
        let rc = unsafe { libc::eventfd(0, 0) }; eprintln!("EVIL vcpu eventfd survived rc={rc}"); }
    if role == Role::ConsoleTx && env("JITK_EVIL_CONSOLE").is_some() { // attacker in a console worker
        let rc = unsafe { libc::ioctl(5, 0xae80, 0) }; eprintln!("EVIL console KVM_RUN survived rc={rc}"); }
}
fn launch() -> Result<(), Box<dyn std::error::Error>> {
    let image = std::env::args().nth(1).ok_or("usage: jitk-vmm IMAGE")?;
    let confined = env("JITK_CONFINE").as_deref() != Some("0");
    let timing = env("JITK_TIME").is_some();
    let mut t = Instant::now(); let mut lap = |name: &str| if timing {
        eprintln!("T {name} {}", t.elapsed().as_nanos()); t = Instant::now(); };
    if let Some(ns) = env("JITK_NETNS") { // experiment: per-VM cost of an empty netns
        let rc = if ns == "unshare" { unsafe { libc::unshare(libc::CLONE_NEWNET) } } else {
            let f = std::fs::File::open(&ns)?; use std::os::fd::AsRawFd;
            unsafe { libc::setns(f.as_raw_fd(), libc::CLONE_NEWNET) } };
        if rc != 0 { return Err(format!("netns: {}", std::io::Error::last_os_error()).into()) }
        lap("netns");
    }
    if let Some(cg) = env("JITK_CGROUP") { // experiment: join a pre-created cgroup leaf
        std::fs::write(format!("{cg}/cgroup.procs"), std::process::id().to_string())?; lap("cgroup");
    }
    if confined {
        confine::limits()?; lap("limits+prctl");
        let abi = confine::landlock(&[&image], "/dev/kvm")?; lap("landlock");
        if env("JITK_PROBE").is_some() {
            let r = |p: &str| std::fs::File::open(p).map(|_| 0).unwrap_or_else(|e| e.raw_os_error().unwrap());
            let w = std::fs::File::create("/tmp/x").map(|_| 0).unwrap_or_else(|e| e.raw_os_error().unwrap());
            let c = std::net::TcpStream::connect("127.0.0.1:9").map(|_| 0).unwrap_or_else(|e| e.raw_os_error().unwrap());
            eprintln!("P landlock_abi={abi} read_passwd={} read_image={} write_tmp={w} connect={c}", r("/etc/passwd"), r(&image));
        }
    }
    // v1 per-role filters (needs thread-hook.diff): each libkrun thread confines itself on entry.
    let roles = confined && env("JITK_ROLES").as_deref() == Some("1");
    #[cfg(feature_hook)]
    if roles { utils::thread_hook::set(role_hook); }
    let (stdin, stdout) = (std::io::stdin(), std::io::stdout());
    let mut console = ConsoleDevice::builder();
    assert_eq!(console.add_inout_port("jitk", Some(stdin.as_fd()), Some(stdout.as_fd()))?, 0);
    let mut devices = MmioDeviceManager::new();
    devices.add(console.build()?);
    let payload = Payload::load_external(&image, KernelFormat::Raw, None, "")?;
    let vm = VmmBuilder::new().vcpus(1)?.ram_mib(64)?.payload(payload)
        .devices(devices).nested_virt(false).shutdown_support(false).build()?;
    lap("build");
    if confined {
        // v0: one union filter on every thread (TSYNC). v1 (hook patch): main gets MAIN+CONSOLE
        // (console workers are its children and inherit it), vCPU already holds COMMON+VCPU.
        let prog = if roles { confine::compile(&[confine::COMMON, confine::MAIN, confine::CONSOLE]) }
            else { confine::compile(&[confine::COMMON, confine::MAIN, confine::VCPU, confine::CONSOLE]) };
        lap("seccomp-compile");
        confine::install(&prog, !roles && env("JITK_TSYNC").as_deref() != Some("0"))?; lap("seccomp-install");
        if timing { eprintln!("BPF insns={}", prog.len()) }
    }
    let _ = std::io::stderr().write_all(b"S\n"); // sandbox ack for the supervisor
    if let Some(e) = env("JITK_EVIL") { evil(&e) }
    vm.run();
    Err("libkrun event loop returned unexpectedly".into())
}
fn main() -> ExitCode {
    match launch() { Ok(()) => ExitCode::SUCCESS,
        Err(e) => { eprintln!("jitk-vmm: {e}"); ExitCode::from(70) } }
}
