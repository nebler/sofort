#[cfg(dynamic)] mod dynkrun;
#[cfg(dynamic)] use dynkrun as krun;
use krun::{ConsoleDevice, KernelFormat, MmioDeviceManager, Payload, VmmBuilder};
use std::{ffi::{CString, c_char, c_int}, io::{self, Read}, os::fd::AsFd, time::{SystemTime, UNIX_EPOCH}};
unsafe extern "C" {
    fn sandbox_init(profile: *const c_char, flags: u64, error: *mut *mut c_char) -> c_int;
    fn sandbox_free_error(error: *mut c_char);
    fn arc4random_buf(buf: *mut u8, len: usize);
    fn poll(fds: *mut PollFd, count: u32, timeout: c_int) -> c_int;
    #[cfg(bench)] fn mach_absolute_time() -> u64;
}
#[repr(C)] struct PollFd { fd: c_int, events: i16, revents: i16 }
fn sandbox(image: &str) -> Result<(), Box<dyn std::error::Error>> {
    let literal = image.replace('\\', "\\\\").replace('"', "\\\"");
    let profile = CString::new(format!(r#"(version 1)(deny default)
(allow file-read* (subpath "/System") (subpath "/usr/lib") (literal "{literal}"))
(allow file-read-metadata)(allow file-read-data (literal "/"))
(allow file-map-executable)(allow sysctl-read)
(allow iokit-open-user-client (iokit-user-client-class "AppleHVClient"))"#))?;
    let mut error = std::ptr::null_mut();
    if unsafe { sandbox_init(profile.as_ptr(), 0, &mut error) } != 0 {
        let message = if error.is_null() { "sandbox_init failed".into() } else {
            let s = unsafe { std::ffi::CStr::from_ptr(error) }.to_string_lossy().into_owned();
            unsafe { sandbox_free_error(error) }; s
        };
        return Err(message.into());
    }
    Ok(())
}
fn launch() -> Result<(), Box<dyn std::error::Error>> {
    let mut image = None;
    let mut mem = 32u32;
    let mut seed = None;
    let mut epoch = None;
    let mut wait = false;
    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--image" => image = Some(args.next().ok_or("missing image")?),
            "--mem-mib" => mem = args.next().ok_or("missing memory")?.parse()?,
            "--seed" => seed = Some(args.next().ok_or("missing seed")?),
            "--epoch-ns" => epoch = Some(args.next().ok_or("missing epoch")?.parse::<u64>()?),
            "--wait-go" => wait = true,
            _ => return Err(format!("unknown argument: {arg}").into()),
        }
    }
    if mem != 32 && mem != 64 { return Err("memory must be 32 or 64 MiB".into()); }
    let image = std::fs::canonicalize(image.ok_or("--image is required")?)?;
    let image = image.to_str().ok_or("image path must be UTF-8")?;
    let seed = match seed {
        Some(s) if s.len() == 32 && s.bytes().all(|b| b.is_ascii_hexdigit()) => s,
        Some(_) => return Err("seed must contain exactly 32 hex digits".into()),
        None => {
            let mut bytes = [0u8; 16];
            unsafe { arc4random_buf(bytes.as_mut_ptr(), bytes.len()) };
            bytes.iter().map(|b| format!("{b:02x}")).collect::<String>()
        }
    };
    let epoch = epoch.unwrap_or(SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos().try_into()?);
    let cmdline = format!("jitk.seed={seed} jitk.epoch_ns={epoch}");
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut console = ConsoleDevice::builder();
    if console.add_inout_port("jitk", Some(stdin.as_fd()), Some(stdout.as_fd()))? != 0 {
        return Err("console port must be zero".into());
    }
    let mut devices = MmioDeviceManager::new();
    devices.add(console.build()?);
    let payload = Payload::load_external(image, KernelFormat::Raw, None, &cmdline)?;
    let builder = VmmBuilder::new().vcpus(1)?.ram_mib(mem)?.payload(payload)
        .devices(devices).nested_virt(false).shutdown_support(false);
    sandbox(image)?;
    if wait {
        eprintln!("jitk-vmm: WAIT_GO");
        let mut go = [0];
        loop {
            let mut fd = PollFd { fd: 0, events: 1, revents: 0 };
            if unsafe { poll(&mut fd, 1, -1) } < 0 {
                let e = io::Error::last_os_error();
                if e.kind() == io::ErrorKind::Interrupted { continue; }
                return Err(e.into());
            }
            match stdin.lock().read(&mut go) {
                Ok(1) => break,
                Ok(_) => return Err("EOF before go byte".into()),
                Err(e) if matches!(e.kind(), io::ErrorKind::WouldBlock | io::ErrorKind::Interrupted) => continue,
                Err(e) => return Err(e.into()),
            }
        }
    }
    builder.build()?.run();
    Err("libkrun event loop returned".into())
}
fn main() {
    #[cfg(bench)] eprintln!("MAIN_TICKS {}", unsafe { mach_absolute_time() });
    if let Err(e) = launch() {
        eprintln!("jitk-vmm: {e}");
        std::process::exit(70);
    }
}
