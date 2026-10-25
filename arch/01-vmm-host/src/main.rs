// One worker process owns one single-use VM. libkrun exits the process on shutdown.
use krun::{ConsoleDevice, KernelFormat, MmioDeviceManager, Payload, VmmBuilder};
use std::{os::fd::AsFd, process::ExitCode};

fn launch() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args().nth(1).ok_or("usage: jitk-vmm KERNEL [default]")?;
    let stdin = std::io::stdin();
    let stdout = std::io::stdout();
    let stderr = std::io::stderr();
    let mut console = ConsoleDevice::builder();
    if std::env::args().nth(2).as_deref() == Some("default") {
        // Only for an apples-to-apples comparison against the supplied C host.
        console.add_default_console(Some(stdin.as_fd()), Some(stdout.as_fd()), Some(stderr.as_fd()))?;
    } else {
        assert_eq!(console.add_inout_port("jitk", Some(stdin.as_fd()), Some(stdout.as_fd()))?, 0);
    }
    let mut devices = MmioDeviceManager::new();
    devices.add(console.build()?);
    let payload = Payload::load_external(&path, KernelFormat::Raw, None, "")?;
    let vm = VmmBuilder::new().vcpus(1)?.ram_mib(64)?.payload(payload)
        .devices(devices).nested_virt(false).shutdown_support(false).build()?;
    vm.run();
    Err("libkrun event loop returned unexpectedly".into())
}
fn main() -> ExitCode {
    match launch() {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => { eprintln!("jitk-vmm: {e}"); ExitCode::from(70) }
    }
}
