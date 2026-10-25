// jitk-vmm with in-process Seatbelt (macOS). One process = one single-use VM.
// Order: dyld maps libs -> read fixed config -> sandbox_apply -> build() (vCPU starts).
// Experiment knobs (JITK_SB, JITK_PROBE) exist only in this spike build.
use krun::{ConsoleDevice, KernelFormat, MmioDeviceManager, Payload, VmmBuilder};
use std::ffi::{c_char, c_int, CStr, CString};
use std::{os::fd::AsFd, process::ExitCode, time::Instant};

#[repr(C)]
struct SbProfile { builtin: *const c_char, data: *const u8, size: usize }
unsafe extern "C" {
    fn sandbox_init(profile: *const c_char, flags: u64, err: *mut *mut c_char) -> c_int;
    fn sandbox_init_with_parameters(profile: *const c_char, flags: u64,
        params: *const *const c_char, err: *mut *mut c_char) -> c_int;
    // Private but long-stable libsandbox API (Chromium uses it for precompiled profiles).
    fn sandbox_create_params() -> *mut u8;
    fn sandbox_set_param(p: *mut u8, k: *const c_char, v: *const c_char) -> c_int;
    fn sandbox_compile_string(s: *const c_char, p: *mut u8, err: *mut *mut c_char) -> *mut SbProfile;
    fn sandbox_apply(p: *const SbProfile) -> c_int;
}
const PROFILE: &str = include_str!("jitk.sb");
const IMAGES: &str = "/private/tmp/jitk-07/r2/images";

fn compile() -> Vec<u8> {
    let (src, k, v) = (CString::new(PROFILE).unwrap(), c"IMAGES", CString::new(IMAGES).unwrap());
    unsafe {
        let p = sandbox_create_params();
        sandbox_set_param(p, k.as_ptr(), v.as_ptr());
        let mut err = std::ptr::null_mut();
        let prof = sandbox_compile_string(src.as_ptr(), p, &mut err);
        assert!(!prof.is_null(), "compile: {:?}", CStr::from_ptr(err));
        std::slice::from_raw_parts((*prof).data, (*prof).size).to_vec()
    }
}
fn confine(mode: &str) -> Result<(), String> {
    let mut err: *mut c_char = std::ptr::null_mut();
    let rc = unsafe { match mode {
        "sbpl" => { // sandbox_init_with_parameters: compiles SBPL in this process.
            let src = CString::new(PROFILE).unwrap();
            let v = CString::new(IMAGES).unwrap();
            let params = [c"IMAGES".as_ptr(), v.as_ptr(), std::ptr::null()];
            sandbox_init_with_parameters(src.as_ptr(), 0, params.as_ptr(), &mut err)
        }
        "named" => sandbox_init(c"pure-computation".as_ptr(), 1 /*SANDBOX_NAMED*/, &mut err),
        "compiled" => { // blob produced once by trusted parent/build (`jitk-vmm --compile-profile`)
            let blob = std::fs::read("/private/tmp/jitk-07/r2/jitk.sbbin").map_err(|e| e.to_string())?;
            let p = SbProfile { builtin: std::ptr::null(), data: blob.as_ptr(), size: blob.len() };
            sandbox_apply(&p)
        }
        _ => return Err(format!("bad mode {mode}")),
    }};
    if rc != 0 { return Err(if err.is_null() { format!("rc={rc}") } else {
        unsafe { CStr::from_ptr(err) }.to_string_lossy().into_owned() }) }
    Ok(())
}
fn probe() {
    use std::io::Write;
    let r = |p: &str| std::fs::File::open(p).map(|_| 0).unwrap_or_else(|e| e.raw_os_error().unwrap_or(-1));
    println!("P read /etc/passwd errno={}", r("/etc/passwd"));
    println!("P read /Users/noah/.ssh errno={}", r("/Users/noah/.ssh"));
    println!("P read outside-images errno={}", r("/private/tmp/jitk-07/r2/outside.txt"));
    println!("P read image errno={}", r(&format!("{IMAGES}/kk.bin")));
    println!("P write errno={}", std::fs::File::create("/private/tmp/jitk-07/r2/images/w")
        .map(|_| 0).unwrap_or_else(|e| e.raw_os_error().unwrap()));
    println!("P connect errno={}", std::net::TcpStream::connect("127.0.0.1:9")
        .map(|_| 0).unwrap_or_else(|e| e.raw_os_error().unwrap()));
    println!("P exec errno={}", std::process::Command::new("/bin/echo").output()
        .map(|_| 0).unwrap_or_else(|e| e.raw_os_error().unwrap_or(-1)));
    let pid = unsafe { libc_fork() };
    if pid == 0 { unsafe { libc_exit(0) } }
    println!("P fork rc={} errno={}", pid, std::io::Error::last_os_error().raw_os_error().unwrap());
    let mut buf = [0u8; 64]; let mut len = buf.len();
    let rc = unsafe { sysctlbyname(c"kern.hostname".as_ptr(), buf.as_mut_ptr(), &mut len, std::ptr::null(), 0) };
    println!("P sysctl kern.hostname rc={rc} errno={}", std::io::Error::last_os_error().raw_os_error().unwrap());
    let _ = std::io::stdout().flush();
}
unsafe extern "C" {
    #[link_name = "fork"] fn libc_fork() -> c_int;
    #[link_name = "_exit"] fn libc_exit(c: c_int) -> !;
    fn sysctlbyname(n: *const c_char, o: *mut u8, ol: *mut usize, n2: *const u8, l: usize) -> c_int;
}
fn launch() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = std::env::args().skip(1);
    let first = args.next().ok_or("usage: jitk-vmm IMAGE | --compile-profile OUT")?;
    if first == "--compile-profile" {
        std::fs::write(args.next().ok_or("OUT")?, compile())?; return Ok(());
    }
    if first.contains('/') { return Err("image must be a name".into()) }
    let mut path = format!("{IMAGES}/{first}"); // name only; supervisor picks from allowlist
    let _keep; // JITK_FDPATH: open image pre-sandbox, hand libkrun "/dev/fd/N" (no file grant).
    if std::env::var_os("JITK_FDPATH").is_some() {
        use std::os::fd::AsRawFd;
        let f = std::fs::File::open(&path)?; path = format!("/dev/fd/{}", f.as_raw_fd()); _keep = f;
    }
    let mode = std::env::var("JITK_SB").unwrap_or_default();
    if !mode.is_empty() && mode != "none" {
        let t = Instant::now();
        confine(&mode)?;
        if std::env::var_os("JITK_TIME").is_some() { eprintln!("sandbox_ns={}", t.elapsed().as_nanos()) }
    }
    if std::env::var_os("JITK_PROBE").is_some() { probe() }
    let (stdin, stdout) = (std::io::stdin(), std::io::stdout());
    let mut console = ConsoleDevice::builder();
    assert_eq!(console.add_inout_port("jitk", Some(stdin.as_fd()), Some(stdout.as_fd()))?, 0);
    let mut devices = MmioDeviceManager::new();
    devices.add(console.build()?);
    let payload = Payload::load_external(&path, KernelFormat::Raw, None, "")?;
    let vm = VmmBuilder::new().vcpus(1)?.ram_mib(64)?.payload(payload)
        .devices(devices).nested_virt(false).shutdown_support(false).build()?;
    vm.run();
    Err("libkrun event loop returned unexpectedly".into())
}
fn main() -> ExitCode {
    match launch() { Ok(()) => ExitCode::SUCCESS,
        Err(e) => { eprintln!("jitk-vmm: {e}"); ExitCode::from(70) } }
}
