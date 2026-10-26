mod confinement;
mod watchdog;
use confinement::{Error, Sandbox};
use krun::{ConsoleDevice, KernelFormat, MmioDeviceManager, Payload, VmmBuilder};
use std::{
    io::{self, Read, Write},
    os::fd::{AsFd, FromRawFd, OwnedFd},
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

fn counter() -> u64 {
    #[cfg(target_os = "macos")]
    {
        unsafe extern "C" {
            fn mach_absolute_time() -> u64;
        }
        // SAFETY: this macOS monotonic counter has no arguments or memory preconditions.
        unsafe { mach_absolute_time() }
    }
    #[cfg(target_os = "linux")]
    {
        let ticks: u64;
        // SAFETY: aarch64 userspace can read the virtual counter; no memory or stack is touched.
        unsafe { std::arch::asm!("mrs {}, cntvct_el0", out(reg) ticks) };
        ticks
    }
}
fn wait_go() -> Result<(), Error> {
    eprintln!("jitk-vmm: WAIT_GO");
    let mut go = [0];
    loop {
        let mut fd = libc::pollfd {
            fd: 0,
            events: libc::POLLIN,
            revents: 0,
        };
        // SAFETY: fd is one writable pollfd; -1 requests an unbounded wait.
        if unsafe { libc::poll(&mut fd, 1, -1) } < 0 {
            let e = io::Error::last_os_error();
            if e.kind() == io::ErrorKind::Interrupted {
                continue;
            }
            return Err(e.into());
        }
        // SAFETY: go is writable for the single requested byte; no pointer escapes.
        match unsafe { libc::read(0, go.as_mut_ptr().cast(), 1) } {
            1 => return Ok(()),
            0 => return Err("EOF before go byte".into()),
            _ => {
                let e = io::Error::last_os_error();
                if matches!(
                    e.kind(),
                    io::ErrorKind::WouldBlock | io::ErrorKind::Interrupted
                ) {
                    continue;
                }
                return Err(e.into());
            }
        }
    }
}
fn launch() -> Result<(), Error> {
    let (mut image, mut profile, mut images, mut compile) = (None, None, None, None);
    let (mut mem, mut seed, mut epoch, mut wait, mut netns) = (32u32, None, None, false, None);
    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--image" => image = Some(PathBuf::from(args.next().ok_or("missing image")?)),
            "--mem-mib" => mem = args.next().ok_or("missing memory")?.parse()?,
            "--seed" => seed = Some(args.next().ok_or("missing seed")?),
            "--epoch-ns" => epoch = Some(args.next().ok_or("missing epoch")?.parse::<u64>()?),
            "--sandbox-profile" => {
                profile = Some(PathBuf::from(args.next().ok_or("missing profile")?))
            }
            "--compile-profile" => {
                compile = Some(PathBuf::from(args.next().ok_or("missing output")?))
            }
            "--images" => {
                images = Some(PathBuf::from(args.next().ok_or("missing image directory")?))
            }
            "--netns-fd" => netns = Some(args.next().ok_or("missing netns fd")?.parse::<i32>()?),
            "--wait-go" => wait = true,
            _ => return Err(format!("unknown argument: {arg}").into()),
        }
    }
    if let Some(out) = compile {
        if image.is_some()
            || profile.is_some()
            || wait
            || seed.is_some()
            || epoch.is_some()
            || netns.is_some()
            || mem != 32
        {
            return Err("--compile-profile only accepts --images".into());
        }
        return confinement::compile_profile(
            &std::fs::canonicalize(images.ok_or("--images is required")?)?,
            &out,
        );
    }
    if images.is_some() {
        return Err("--images requires --compile-profile".into());
    }
    if mem != 32 && mem != 64 {
        return Err("memory must be 32 or 64 MiB".into());
    }
    let image = std::fs::canonicalize(image.ok_or("--image is required")?)?;
    let seed = match seed {
        Some(s) if s.len() == 32 && s.bytes().all(|b| b.is_ascii_hexdigit()) => {
            s.to_ascii_lowercase()
        }
        Some(_) => return Err("seed must contain exactly 32 hex digits".into()),
        None => {
            let mut bytes = [0u8; 16];
            std::fs::File::open("/dev/urandom")?.read_exact(&mut bytes)?;
            bytes.iter().map(|b| format!("{b:02x}")).collect::<String>()
        }
    };
    let (epoch, ticks) = match epoch {
        Some(epoch) => (epoch, counter()),
        None => {
            let mut best = (u64::MAX, 0, 0);
            for _ in 0..5 {
                let before = counter();
                let epoch = SystemTime::now()
                    .duration_since(UNIX_EPOCH)?
                    .as_nanos()
                    .try_into()?;
                let after = counter();
                if after - before < best.0 {
                    best = (after - before, epoch, before + (after - before) / 2);
                }
            }
            (best.1, best.2)
        }
    };
    let cmdline = format!("jitk.seed={seed} jitk.epoch_ns={epoch} jitk.counter={ticks}");
    let (stdin, stdout) = (io::stdin(), io::stdout());
    let mut console = ConsoleDevice::builder();
    if console.add_inout_port("jitk", Some(stdin.as_fd()), Some(stdout.as_fd()))? != 0 {
        return Err("console port must be zero".into());
    }
    let mut devices = MmioDeviceManager::new();
    devices.add(console.build()?);
    let payload = Payload::load_external(
        image.to_str().ok_or("image path must be UTF-8")?,
        KernelFormat::Raw,
        None,
        &cmdline,
    )?;
    let builder = VmmBuilder::new()
        .vcpus(1)?
        .ram_mib(mem)?
        .payload(payload)
        .devices(devices)
        .nested_virt(false)
        .shutdown_support(false);
    let timing = std::env::var_os("JITK_VMM_TIMING").is_some();
    let started = std::time::Instant::now();
    let netns = if let Some(fd) = netns {
        if !cfg!(target_os = "linux") {
            return Err("sandbox: --netns-fd is Linux-only".into());
        }
        // SAFETY: F_GETFD inspects a scalar fd without borrowing any userspace memory.
        if unsafe { libc::fcntl(fd, libc::F_GETFD) } < 0 {
            return Err(io::Error::last_os_error().into());
        }
        // SAFETY: the CLI transfers ownership of this inherited live fd to the launcher.
        // Parsing is single-threaded; no other Rust owner exists for inherited fds.
        Some(unsafe { OwnedFd::from_raw_fd(fd) })
    } else {
        None
    };
    let mut sandbox = Sandbox::prepare(&image, profile.as_deref(), netns)?;
    let prepared = std::time::Instant::now();
    sandbox.before_build()?;
    #[cfg(target_os = "macos")]
    if timing {
        eprintln!(
            "SANDBOX_NS {} PREPARE_AND_APPLY_NS {}",
            prepared.elapsed().as_nanos(),
            started.elapsed().as_nanos()
        );
    }
    #[cfg(target_os = "linux")]
    let _ = (timing, started, prepared);
    #[cfg(target_os = "macos")]
    io::stderr().write_all(b"{\"sandbox\":\"ok\"}\n")?;
    if wait {
        wait_go()?;
    }
    let vm = builder.build()?;
    sandbox.after_build()?;
    #[cfg(target_os = "linux")]
    io::stderr().write_all(b"{\"sandbox\":\"ok\"}\n")?;
    vm.run();
    Err("libkrun event loop returned".into())
}
fn main() {
    if std::env::args().nth(1).as_deref() == Some("--watchdog") {
        watchdog::run()
    }
    if let Err(e) = launch() {
        eprintln!("jitk-vmm: {e}");
        std::process::exit(70);
    }
}
