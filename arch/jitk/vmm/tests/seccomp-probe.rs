//! Test-only forbidden host syscall after real KVM build and confinement.
#[path = "../src/confinement.rs"]
mod confinement;
use krun::{ConsoleDevice, KernelFormat, MmioDeviceManager, Payload, VmmBuilder};
use std::{io, os::fd::AsFd};
fn launch() -> Result<(), confinement::Error> {
    let image = std::fs::canonicalize(std::env::args().nth(1).ok_or("image")?)?;
    let mut sandbox = confinement::Sandbox::prepare(&image, None, None)?;
    let (stdin, stdout) = (io::stdin(), io::stdout());
    let mut console = ConsoleDevice::builder();
    console.add_inout_port("jitk", Some(stdin.as_fd()), Some(stdout.as_fd()))?;
    let mut devices = MmioDeviceManager::new();
    devices.add(console.build()?);
    let payload = Payload::load_external(image.to_str().ok_or("path")?, KernelFormat::Raw, None, "")?;
    let builder = VmmBuilder::new().vcpus(1)?.ram_mib(32)?.payload(payload).devices(devices)
        .nested_virt(false).shutdown_support(false);
    sandbox.before_build()?;
    let _vm = builder.build()?;
    sandbox.after_build()?;
    eprintln!("SECCOMP-PROBE-CONFINED");
    unsafe { libc::socket(libc::AF_INET, libc::SOCK_STREAM, 0) };
    Err("forbidden socket survived".into())
}
fn main() {
    if let Err(e) = launch() { eprintln!("probe: {e}"); std::process::exit(70); }
}
