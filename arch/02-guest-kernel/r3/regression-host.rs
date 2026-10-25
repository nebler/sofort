// Native host uses 01's panic=abort libkrun build and exactly one inout port.
use krun::{ConsoleDevice, KernelFormat, MmioDeviceManager, Payload, VmmBuilder};
use std::{io::{self,Read},os::fd::AsFd,time::{SystemTime,UNIX_EPOCH}};
unsafe extern "C" { fn arc4random_buf(b:*mut u8,n:usize); fn mach_absolute_time()->u64; }
fn main() -> Result<(),Box<dyn std::error::Error>> {
    let image=std::env::args().nth(1).ok_or("kernel image required")?;
    if std::env::args().nth(2).as_deref()==Some("--wait-go") {
        eprintln!("JITK_WAIT_GO");
        io::stdin().read_exact(&mut [0u8;1])?;
    }
    let mut seed=[0u8;16];unsafe{arc4random_buf(seed.as_mut_ptr(),16)};
    let seed:String=seed.iter().map(|b|format!("{b:02x}")).collect();
    // Bracket wall time with counter reads; retain the least preempted sample.
    let mut best=(u64::MAX,0u128,0u64);
    for _ in 0..8 {
        let a=unsafe{mach_absolute_time()};
        let epoch=SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
        let b=unsafe{mach_absolute_time()};
        if b-a<best.0 {best=(b-a,epoch,a+(b-a)/2);}
    }
    let (_,epoch,counter)=best;
    let cmdline=format!("jitk.seed={seed} jitk.epoch_ns={epoch} jitk.counter={counter}");
    let stdin=io::stdin();let stdout=io::stdout();
    let mut console=ConsoleDevice::builder();
    assert_eq!(console.add_inout_port("jitk",Some(stdin.as_fd()),Some(stdout.as_fd()))?,0);
    let mut devices=MmioDeviceManager::new();devices.add(console.build()?);
    let payload=Payload::load_external(&image,KernelFormat::Raw,None,&cmdline)?;
    VmmBuilder::new().vcpus(1)?.ram_mib(32)?.payload(payload).devices(devices)
        .nested_virt(false).shutdown_support(false).build()?.run();
    Ok(())
}
