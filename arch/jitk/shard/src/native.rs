//! Persistent Linux native worker; this child module is the only Slot adapter.
use super::*;
#[path = "inputs.rs"]
mod inputs;
#[path = "streams.rs"]
mod streams;
use inputs::{MAX_ARCHIVE, MAX_REQUEST, Run};
use streams::{Output, Receiver};
const INPUT_SLOT: u32 = 63;
use std::collections::BTreeMap;

unsafe extern "C" {
    fn memfd_create(name: *const u8, flags: u32) -> c_int;
    fn fcntl(fd: c_int, cmd: c_int, ...) -> c_int;
}
struct Input {
    ptr: *mut c_void,
    len: usize,
}
impl Input {
    fn new(bytes: &[u8]) -> io::Result<Self> {
        if bytes.len() > MAX_ARCHIVE {
            return Err(io::Error::other("input extent budget"));
        }
        let fd = unsafe { memfd_create(c"jitk-input".as_ptr().cast(), 3) };
        if fd < 0 {
            return Err(io::Error::last_os_error());
        }
        let mut file = unsafe { File::from_raw_fd(fd) };
        let len = (bytes.len() + 4095) & !4095;
        file.set_len(len as u64)?;
        file.write_all(bytes)?;
        // Seal against writes, shrink, growth, and further seal changes.
        if unsafe { fcntl(fd, 1033, 15) } < 0 {
            return Err(io::Error::last_os_error());
        }
        let ptr = unsafe { mmap(ptr::null_mut(), len, 1, 2, fd, 0) };
        if ptr as isize == -1 {
            return Err(io::Error::last_os_error());
        }
        Ok(Self { ptr, len })
    }
    fn unbind(slot: &Slot) -> io::Result<()> {
        let r = Region {
            slot: INPUT_SLOT,
            flags: 0,
            gpa: 0x82000000,
            size: 0,
            addr: 0,
        };
        if unsafe { ioctl(slot._vm.as_raw_fd(), KVM_SET_USER_MEMORY_REGION, &r) } < 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(())
    }
    fn bind(&self, slot: &Slot) -> io::Result<()> {
        let r = Region {
            slot: INPUT_SLOT,
            flags: 2,
            gpa: 0x82000000,
            size: self.len as u64,
            addr: self.ptr as u64,
        };
        if unsafe { ioctl(slot._vm.as_raw_fd(), KVM_SET_USER_MEMORY_REGION, &r) } < 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(())
    }
}
impl Drop for Input {
    fn drop(&mut self) {
        unsafe {
            munmap(self.ptr, self.len);
        }
    }
}
struct NativeVm {
    slot: Slot, // Drop KVM memslots before dropping the input mapping.
    input: Option<Input>,
}
impl NativeVm {
    fn new(kvm: &Kvm, snapshot: Arc<Snapshot>) -> Self {
        Self {
            slot: Slot::new(kvm, snapshot),
            input: None,
        }
    }
    fn run(&mut self, run: &Run, generation: u64, entropy: &mut File) -> Result<Output, String> {
        let s = &mut self.slot;
        s.reset();
        if self.input.is_some() {
            Input::unbind(s).map_err(|e| e.to_string())?;
            self.input = None;
        }
        let input = Input::new(&run.archive).map_err(|e| e.to_string())?;
        input.bind(s).map_err(|e| e.to_string())?;
        self.input = Some(input);
        s.bind(generation, "", entropy);
        s.store(0, 0x324b544a | (2u64 << 32) | (1u64 << 48));
        s.store(0x20, streams::FEATURES);
        let mut argv = Vec::new();
        for arg in &run.args {
            argv.extend_from_slice(arg.as_bytes());
            argv.push(0);
        }
        s.copy(CTRL + 0x400, &argv);
        s.store(0x228, argv.len() as u64);
        s.store(0x248, run.args.len() as u64);
        s.store(0x250, run.archive.len() as u64);
        s.store(0x260, streams::OUTPUT_LIMIT as u64);
        let mut rx = Receiver::new(generation, streams::OUTPUT_LIMIT).map_err(str::to_string)?;
        loop {
            s.store(0x220, monotonic_ns());
            loop {
                let ret = unsafe { ioctl(s.cpu.as_raw_fd(), KVM_RUN, 0u64) };
                if ret >= 0 {
                    break;
                }
                if io::Error::last_os_error().raw_os_error() != Some(4) {
                    return Err(io::Error::last_os_error().to_string());
                }
            }
            s.pending_mmio = false;
            let reason = unsafe { s.run.ptr.add(EXIT_REASON).cast::<u32>().read_volatile() };
            if reason as u64 != KVM_EXIT_MMIO {
                return Err(format!("unexpected native KVM exit {reason}"));
            }
            s.pending_mmio = true;
            let len = unsafe { s.run.ptr.add(MMIO_LEN).cast::<u32>().read_volatile() };
            let write = unsafe { s.run.ptr.add(MMIO_WRITE).read_volatile() };
            if s.run.word(MMIO_ADDR) != 0x10000000 || len != 4 || write != 1 {
                return Err("invalid native MMIO".into());
            }
            let op = unsafe { s.run.ptr.add(MMIO_DATA).cast::<u32>().read_volatile() };
            rx.drain(s.load(0x40), |cursor, dst| {
                for (i, b) in dst.iter_mut().enumerate() {
                    *b = unsafe {
                        s.ram
                            .ptr
                            .add(REQUEST + ((cursor as usize + i) % streams::RING_BYTES))
                            .read_volatile()
                    };
                }
            })
            .map_err(str::to_string)?;
            s.store(0x80, rx.consumed());
            if let Some(out) = rx.finish(op).map_err(str::to_string)? {
                s.drain();
                return Ok(out);
            }
        }
    }
}
fn response(out: Result<Output, String>) -> Vec<u8> {
    let mut b = Vec::new();
    match out {
        Ok(out) => {
            for w in [
                0,
                out.exit_code,
                out.stdout.len() as u32,
                out.stderr.len() as u32,
                out.limited as u32,
            ] {
                b.extend_from_slice(&w.to_le_bytes());
            }
            b.extend_from_slice(&out.stdout);
            b.extend_from_slice(&out.stderr);
        }
        Err(e) => {
            for w in [1, 0, 0, 0, 0] {
                b.extend_from_slice(&u32::to_le_bytes(w));
            }
            b.extend_from_slice(e.as_bytes().get(..512).unwrap_or(e.as_bytes()));
        }
    }
    b
}
/// One fixed worker, one reusable slot/profile, no per-run helper process.
pub fn worker(profiles: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    let kvm = Kvm::new();
    let mut vms = BTreeMap::new();
    if profiles.is_empty() || profiles.len() > 16 {
        return Err("1..16 native profiles required".into());
    }
    for p in profiles {
        let (name, base) = p
            .split_once('=')
            .ok_or("profile must be tool=SNAPSHOT_BASE")?;
        if vms.contains_key(name) {
            return Err("duplicate native profile".into());
        }
        vms.insert(name.to_string(), NativeVm::new(&kvm, Snapshot::load(base)?));
    }
    let mut input = io::stdin().lock();
    let mut output = io::stdout().lock();
    let mut entropy = File::open("/dev/urandom")?;
    let mut generation = 1u64;
    loop {
        let mut head = [0; 4];
        match input.read(&mut head[..1])? {
            0 => return Ok(()),
            _ => input.read_exact(&mut head[1..])?,
        };
        let len = u32::from_le_bytes(head) as usize;
        if len > MAX_REQUEST {
            return Err("native IPC frame budget".into());
        }
        let mut bytes = vec![0; len];
        input.read_exact(&mut bytes)?;
        generation = generation
            .checked_add(1)
            .ok_or("native generation exhausted")?;
        let out = inputs::decode(&bytes)
            .map_err(str::to_string)
            .and_then(|run| {
                vms.get_mut(&run.tool)
                    .ok_or_else(|| "unknown native profile".to_string())?
                    .run(&run, generation, &mut entropy)
            });
        let b = response(out);
        output.write_all(&(b.len() as u32).to_le_bytes())?;
        output.write_all(&b)?;
        output.flush()?;
    }
}

/// Offline ledger hook: retain N completed native VMs for the R6 cgroup method.
pub fn hold(
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
    let run = inputs::decode(&read_metadata(File::open(request)?, MAX_REQUEST)?)
        .map_err(io::Error::other)?;
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
    Ok(())
}
