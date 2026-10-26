//! Offline native cgroup ledger holder.
use jitk_shard::{
    inputs,
    inputs::MAX_REQUEST,
    kvm::{Kvm, Snapshot, native::NativeVm},
};
use std::{
    fs::File,
    io::{self, Read, Write},
};
fn read_request(path: &str) -> io::Result<Vec<u8>> {
    let mut bytes = Vec::new();
    File::open(path)?
        .take((MAX_REQUEST + 1) as u64)
        .read_to_end(&mut bytes)?;
    if bytes.len() > MAX_REQUEST {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "snapshot metadata size bound",
        ));
    }
    Ok(bytes)
}
/// Offline ledger hook: retain N completed native VMs for the R6 cgroup method.
pub(super) fn run(
    base: &str,
    request: &str,
    n: usize,
    seconds: u64,
) -> Result<(), Box<dyn std::error::Error>> {
    if n > 1024 {
        return Err("native holder count bound".into());
    }
    println!(
        "{{\"event\":\"environment\",\"pid\":{},\"threads\":1,\"nested\":true}}",
        std::process::id()
    );
    let run = inputs::decode(&read_request(request)?).map_err(io::Error::other)?;
    let kvm = Kvm::new();
    let snapshot = Snapshot::load(base)?;
    let mut entropy = File::open("/dev/urandom")?;
    let mut vms = Vec::new();
    for i in 0..n {
        let mut vm = NativeVm::new(&kvm, snapshot.clone());
        let out = vm.run(&run, i as u64 + 2, &mut entropy)?;
        if out.exit_code != 0 {
            return Err("ledger native run failed".into());
        }
        vms.push(vm);
    }
    println!("{{\"event\":\"held\",\"n\":{n},\"threads\":1,\"native\":true}}");
    io::stdout().flush()?;
    std::thread::sleep(std::time::Duration::from_secs(seconds));
    for vm in &mut vms {
        vm.shutdown()?;
    }
    Ok(())
}
