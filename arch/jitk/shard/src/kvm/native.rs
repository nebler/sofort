//! Persistent Linux native worker; this child module is the only Slot adapter.
use super::{CTRL, Kvm, REQUEST, Region, Slot, Snapshot, monotonic_ns};
use crate::constants::kvm::{
    EXIT_REASON, KVM_EXIT_MMIO, KVM_RUN, KVM_SET_USER_MEMORY_REGION, MMIO_ADDR, MMIO_DATA,
    MMIO_LEN, MMIO_WRITE,
};
use crate::constants::ring;
use crate::{inputs, streams};
use inputs::{MAX_ARCHIVE, MAX_REQUEST, Run};
use libc::{ioctl, mmap, munmap};
use std::{
    fs::File,
    io::{self, Read, Write},
    os::{
        fd::{AsRawFd, FromRawFd},
        raw::c_void,
    },
    ptr,
    sync::Arc,
};
use streams::{Output, Receiver};

use std::collections::BTreeMap;

use libc::{fcntl, memfd_create};
struct Input {
    ptr: *mut c_void,
    len: usize,
}
impl Input {
    fn new(bytes: &[u8]) -> io::Result<Self> {
        if bytes.len() > MAX_ARCHIVE {
            return Err(io::Error::other("input extent budget"));
        }
        // SAFETY: the static NUL-terminated name lives through memfd_create;
        // its flags are scalar and its result is checked before adoption.
        let fd = unsafe {
            memfd_create(
                c"jitk-input".as_ptr().cast(),
                libc::MFD_CLOEXEC | libc::MFD_ALLOW_SEALING,
            )
        };
        if fd < 0 {
            return Err(io::Error::last_os_error());
        }
        // SAFETY: fd was just created, checked nonnegative, and has no other
        // Rust owner. File assumes sole ownership here.
        let mut file = unsafe { File::from_raw_fd(fd) };
        let len = (bytes.len() + 4095) & !4095;
        file.set_len(len as u64)?;
        file.write_all(bytes)?;
        // SAFETY: File keeps fd live; F_ADD_SEALS takes scalar seal bits and
        // does not retain a pointer into Rust memory.
        if unsafe {
            fcntl(
                fd,
                libc::F_ADD_SEALS,
                libc::F_SEAL_SEAL | libc::F_SEAL_SHRINK | libc::F_SEAL_GROW | libc::F_SEAL_WRITE,
            )
        } < 0
        {
            return Err(io::Error::last_os_error());
        }
        // SAFETY: fd owns len initialized, sealed bytes. mmap uses that exact
        // extent and checks its returned address before any dereference.
        let ptr = unsafe {
            mmap(
                ptr::null_mut(),
                len,
                libc::PROT_READ,
                libc::MAP_PRIVATE,
                fd,
                0,
            )
        };
        if ptr as isize == -1 {
            return Err(io::Error::last_os_error());
        }
        Ok(Self { ptr, len })
    }
    fn unbind(slot: &Slot) -> io::Result<()> {
        let r = Region {
            slot: ring::INPUT_SLOT,
            flags: 0,
            gpa: ring::INPUT_GPA,
            size: 0,
            addr: 0,
        };
        // SAFETY: The C-layout region descriptor is live through ioctl; size zero
        // removes the stopped VM input slot before its mapping is dropped.
        if unsafe { ioctl(slot._vm.as_raw_fd(), KVM_SET_USER_MEMORY_REGION as _, &r) } < 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(())
    }
    fn bind(&self, slot: &Slot) -> io::Result<()> {
        let r = Region {
            slot: ring::INPUT_SLOT,
            flags: crate::constants::kvm::KVM_MEM_READONLY as u32,
            gpa: ring::INPUT_GPA,
            size: self.len as u64,
            addr: self.ptr as u64,
        };
        // SAFETY: The stopped VM receives a C-layout region descriptor pointing to
        // this live sealed mapping, which NativeVm retains until after memslot
        // removal or VM teardown.
        if unsafe { ioctl(slot._vm.as_raw_fd(), KVM_SET_USER_MEMORY_REGION as _, &r) } < 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(())
    }
}
impl Drop for Input {
    fn drop(&mut self) {
        // SAFETY: Input uniquely owns this live mapping; its VM memslot has already
        // been removed or the VM has been destroyed.
        unsafe {
            munmap(self.ptr, self.len);
        }
    }
}
pub struct NativeVm {
    slot: Slot, // Drop KVM memslots before dropping the input mapping.
    input: Option<Input>,
}
impl NativeVm {
    pub fn new(kvm: &Kvm, snapshot: Arc<Snapshot>) -> Self {
        Self {
            slot: Slot::new(kvm, snapshot),
            input: None,
        }
    }
    pub fn shutdown(&mut self) -> io::Result<()> {
        self.slot.shutdown()
    }
    pub fn run(
        &mut self,
        run: &Run,
        generation: u64,
        entropy: &mut File,
    ) -> Result<Output, String> {
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
        s.store(0, ring::NATIVE_VERSION);
        s.store(ring::FEATURES, streams::FEATURES);
        let mut argv = Vec::new();
        for arg in &run.args {
            argv.extend_from_slice(arg.as_bytes());
            argv.push(0);
        }
        s.copy(CTRL + ring::SOURCE_OFFSET, &argv);
        s.store(ring::SOURCE_BYTES, argv.len() as u64);
        s.store(ring::ARGC, run.args.len() as u64);
        s.store(ring::ARCHIVE_BYTES, run.archive.len() as u64);
        s.store(ring::OUTPUT_BYTES, streams::OUTPUT_LIMIT as u64);
        let mut rx = Receiver::new(generation, streams::OUTPUT_LIMIT).map_err(str::to_string)?;
        loop {
            s.store(ring::MONOTONIC_NS, monotonic_ns());
            loop {
                // SAFETY: The owner holds live VM/vCPU mappings and has no
                // outstanding guest RAM borrows; KVM_RUN retains no
                // userspace argument pointer.
                let ret = unsafe { ioctl(s.cpu.as_raw_fd(), KVM_RUN as _, 0u64) };
                if ret >= 0 {
                    break;
                }
                if io::Error::last_os_error().raw_os_error() != Some(libc::EINTR) {
                    return Err(io::Error::last_os_error().to_string());
                }
            }
            s.pending_mmio = false;
            let reason = s.run.u32(EXIT_REASON);
            if reason as u64 != KVM_EXIT_MMIO {
                return Err(format!("unexpected native KVM exit {reason}"));
            }
            s.pending_mmio = true;
            let len = s.run.u32(MMIO_LEN);
            let write = s.run.byte(MMIO_WRITE);
            if s.run.word(MMIO_ADDR) != ring::DOORBELL_GPA || len != 4 || write != 1 {
                return Err("invalid native MMIO".into());
            }
            let op = s.run.u32(MMIO_DATA);
            rx.drain(s.load(ring::TX_PRODUCER), |cursor, dst| {
                for (i, b) in dst.iter_mut().enumerate() {
                    // SAFETY: the modulo index stays in the fixed TX ring within this
                    // live RAM mapping; the owner reads only after KVM_RUN returned.
                    *b = unsafe {
                        s.ram
                            .ptr
                            .add(REQUEST + ((cursor as usize + i) % streams::RING_BYTES))
                            .read_volatile()
                    };
                }
            })
            .map_err(str::to_string)?;
            s.store(ring::TX_CONSUMER, rx.consumed());
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
            0 => {
                for vm in vms.values_mut() {
                    vm.shutdown()?;
                }
                return Ok(());
            }
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
