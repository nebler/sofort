//! Persistent Linux native worker; this child module is the only Slot adapter.
//! The worker confines itself before any guest runs (`confined`), dies with
//! its parent (PR_SET_PDEATHSIG), and bounds every run by the request's
//! budget with the shard's lease watchdog (lease.rs): a separate process
//! that kicks the vCPU out of KVM_RUN at the deadline and SIGKILLs the worker
//! if it has not stopped within the grace.
use super::{CTRL, Kvm, REQUEST, Region, Slot, Snapshot, monotonic_ns};
use crate::confine::{self, Confinement, Signals, policy};
use crate::constants::kvm::{KVM_MEM_READONLY, KVM_SET_USER_MEMORY_REGION};
use crate::constants::ring;
use crate::hv::{Exit, Vcpu};
use crate::lease::{Lease, Wake, Watchdog};
use crate::{inputs, streams};
use inputs::{Failure, MAX_ARCHIVE, Run};
use libc::{ioctl, mmap, munmap};
use std::{
    fs::File,
    io::{self, Read, Write},
    mem::ManuallyDrop,
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
            gpa: ring::ARCHIVE_GPA,
            size: 0,
            addr: 0,
        };
        // SAFETY: The C-layout region descriptor is live through ioctl; size zero
        // removes the stopped VM input slot before its mapping is dropped.
        if unsafe { ioctl(slot.vm.fd.as_raw_fd(), KVM_SET_USER_MEMORY_REGION as _, &r) } < 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(())
    }
    fn bind(&self, slot: &Slot) -> io::Result<()> {
        let r = Region {
            slot: ring::INPUT_SLOT,
            flags: KVM_MEM_READONLY as u32,
            gpa: ring::ARCHIVE_GPA,
            size: self.len as u64,
            addr: self.ptr as u64,
        };
        // SAFETY: The stopped VM receives a C-layout region descriptor pointing to
        // this live sealed mapping, which NativeVm retains until after memslot
        // removal or VM teardown.
        if unsafe { ioctl(slot.vm.fd.as_raw_fd(), KVM_SET_USER_MEMORY_REGION as _, &r) } < 0 {
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
    /// One run to its completion; with a lease armed on the slot
    /// (`Worker::run`), `Failure::Deadline` once the lease expires.
    pub fn run(
        &mut self,
        run: &Run,
        generation: u64,
        entropy: &mut File,
    ) -> Result<Output, Failure> {
        let s = &mut self.slot;
        s.admit().map_err(|e| e.to_string())?;
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
            s.wrote_ram(); // the guest may write RAM and registers
            // KvmVcpu::run: the lease check before KVM_RUN, the kick
            // (immediate_exit) and EINTR as Interrupted, the doorbell check.
            let op = match s.vcpu.run().map_err(|e| e.to_string())? {
                Exit::Doorbell(op) => op,
                Exit::Interrupted => continue,
                Exit::Expired { .. } => return Err(Failure::Deadline),
                Exit::Fault { gpa } => {
                    return Err(format!("memory_bound: native access at {gpa:#x}").into());
                }
                e => return Err(format!("unexpected native KVM exit {e:?}").into()),
            };
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
/// Past a run's deadline, how long the lease watchdog waits for the worker to
/// stop the vCPU before it SIGKILLs the worker (as `real ipc`'s pool).
const GRACE_MS: u64 = 100;

/// The worker's VMs, one reusable slot per profile, its entropy and its
/// lease watchdog: every descriptor and process it uses (/dev/kvm, the
/// pagemap, the snapshots, /dev/urandom, the watchdog) exists once `load`
/// returns.
pub struct Worker {
    vms: BTreeMap<String, NativeVm>,
    entropy: File,
    /// Never dropped: dropping kills and reaps the watchdog, which a
    /// confined worker may not; the watchdog exits with the worker (pidfd).
    watchdog: ManuallyDrop<Watchdog>,
    /// The one lease (a run at a time), re-armed per generation.
    lease: Lease,
}
impl Worker {
    /// Load 1..16 `TOOL=SNAPSHOT_BASE` profiles, create their VMs and start
    /// the lease watchdog.
    pub fn load(profiles: &[String]) -> io::Result<Self> {
        if profiles.is_empty() || profiles.len() > 16 {
            return Err(io::Error::other("1..16 native profiles required"));
        }
        let kvm = Kvm::new();
        let mut vms = BTreeMap::new();
        for p in profiles {
            let (name, base) = p
                .split_once('=')
                .ok_or_else(|| io::Error::other("profile must be tool=SNAPSHOT_BASE"))?;
            if vms.contains_key(name) {
                return Err(io::Error::other("duplicate native profile"));
            }
            vms.insert(name.to_string(), NativeVm::new(&kvm, Snapshot::load(base)?));
        }
        let entropy = File::open("/dev/urandom")?;
        // Its expiry notice goes to an eventfd nobody waits on: the kick
        // reaches the vCPU, and the run loop polls nothing else.
        let watchdog = Watchdog::start(1, &[Wake::new()], GRACE_MS);
        let lease = watchdog.slot(0);
        Ok(Self {
            vms,
            entropy,
            watchdog: ManuallyDrop::new(watchdog),
            lease,
        })
    }
    /// One request on its profile's VM, within its budget: the lease is
    /// armed for the run and settled after it.
    pub fn run(&mut self, run: &Run, generation: u64) -> Result<Output, Failure> {
        let vm = self
            .vms
            .get_mut(&run.tool)
            .ok_or_else(|| "unknown native profile".to_string())?;
        if !watchdog_alive(&self.watchdog) {
            self.watchdog.exited(); // no deadline would be enforced: fail closed
        }
        self.lease = self.lease.arm(generation, run.deadline(monotonic_ns()));
        vm.slot.set_lease(self.lease.clone());
        let out = vm.run(run, generation, &mut self.entropy);
        // This thread is back from KVM_RUN, so the vCPU is stopped; the next
        // run's admit() resets it before any guest entry. An expiry that won
        // the race with a completion makes the run a deadline.
        if self.lease.complete() {
            out
        } else {
            self.lease.acknowledge_reset();
            Err(Failure::Deadline)
        }
    }
    /// Serve frames until `input` ends, then complete every pending exit.
    pub fn serve(&mut self, input: &mut impl Read, output: &mut impl Write) -> io::Result<()> {
        inputs::serve(input, output, |run, generation| self.run(run, generation))?;
        for vm in self.vms.values_mut() {
            vm.shutdown()?;
        }
        Ok(())
    }
}
/// The watchdog process has not exited (its pidfd is not readable).
fn watchdog_alive(watchdog: &Watchdog) -> bool {
    let mut p = libc::pollfd {
        fd: watchdog.exit_fd().as_raw_fd(),
        events: libc::POLLIN,
        revents: 0,
    };
    // SAFETY: one live pollfd for the call; a zero timeout only samples.
    unsafe { libc::poll(&mut p, 1, 0) == 0 }
}
/// The worker as `real native-worker` runs it, also used by `real confine
/// --native`: the confinement of `real ipc` (confine/mod.rs) around the
/// setup. Namespaces while this is the only thread, and death with the
/// parent; then every VM, file and the watchdog (`Worker::load`); then no
/// file system or TCP access and the native-worker syscall filter
/// (confine::policy::native_worker). No guest code has run when this returns.
pub fn confined(confinement: &mut Confinement, profiles: &[String]) -> io::Result<Worker> {
    confinement.enter_namespaces();
    confine::die_with_parent()?;
    let worker = Worker::load(profiles)?;
    confinement.close_files(Signals::OwnProcess)?;
    confinement.filter_syscalls(&policy::native_worker(std::process::id()))?;
    Ok(worker)
}
/// One fixed, confined worker, one reusable slot/profile, no per-run helper
/// process: serve stdin until it ends.
pub fn worker(profiles: &[String]) -> io::Result<()> {
    let mut confinement = Confinement::new();
    let mut worker = confined(&mut confinement, profiles)?;
    confinement.report().warn("native worker");
    worker.serve(&mut io::stdin().lock(), &mut io::stdout().lock())
}
