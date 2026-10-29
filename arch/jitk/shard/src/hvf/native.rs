//! The persistent native worker on Hypervisor.framework (`hvf native-worker
//! TOOL=SNAPSHOT_BASE ...`): the Linux worker's JNR8 frames on stdin/stdout
//! (shard/ABI-R7.md "Persistent worker IPC", `inputs::serve`), the same
//! native bind, byte streams (`streams::Receiver`) and read-only input
//! archive at `ring::ARCHIVE_GPA`, over an HVF slot.
//!
//! HVF allows one VM per process, so the worker holds one slot at a time:
//! a run for another profile drops the current slot (and its VM) and creates
//! one over that profile's snapshot (~1 ms, `native_worker_switches_profiles`
//! in the tests); consecutive runs of one profile reuse the slot with a
//! reset, as on Linux.
//!
//! Before any VM exists the worker enters jitk.sb for the
//! profiles' directory and drops fork (RLIMIT_NPROC 0, as an engine process):
//! no file outside it, no write, network, exec or fork. Every snapshot is
//! loaded and its descriptors opened before that.
//!
//! Its supervisor thread (`Supervisor`) never touches the vCPU's state: it
//! exits the process when the parent (Node) exits, whatever the vCPU is
//! doing, and kicks the vCPU (`Kicker`) at the running request's deadline,
//! as an engine process's reader does at its START deadline (child.rs).
use super::{HvfVm, Kicker, State};
use crate::clock::monotonic_ns;
use crate::constants::ring;
use crate::hv::{Exit, Vcpu};
use crate::inputs::{self, Failure, MAX_ARCHIVE, Run};
use crate::slot::{CTRL, REQUEST, ResetPolicy, Slot};
use crate::snapshot::Snapshot;
use crate::streams::{self, Output, Receiver};
use std::{
    collections::BTreeMap,
    io,
    os::fd::{AsRawFd, FromRawFd, OwnedFd},
    path::Path,
    ptr,
    sync::{Arc, Mutex},
};

/// The HVF and host page granule: the archive's mapping is rounded to it.
const GRANULE: usize = 16384;

/// One run's archive: anonymous host memory, read-only once filled.
pub(crate) struct Input {
    pub(crate) ptr: *mut u8,
    pub(crate) len: usize,
}
impl Input {
    pub(crate) fn new(bytes: &[u8]) -> io::Result<Self> {
        if bytes.len() > MAX_ARCHIVE {
            return Err(io::Error::other("input extent budget"));
        }
        let len = bytes.len().next_multiple_of(GRANULE).max(GRANULE);
        // SAFETY: a fresh private anonymous mapping; the result is checked.
        let ptr = unsafe {
            libc::mmap(
                ptr::null_mut(),
                len,
                libc::PROT_READ | libc::PROT_WRITE,
                libc::MAP_PRIVATE | libc::MAP_ANON,
                -1,
                0,
            )
        };
        if ptr == libc::MAP_FAILED {
            return Err(io::Error::last_os_error());
        }
        let input = Self {
            ptr: ptr.cast(),
            len,
        };
        // SAFETY: the mapping has len >= bytes.len() writable bytes; then it
        // becomes read-only for the host too, before the guest sees it.
        unsafe {
            ptr::copy_nonoverlapping(bytes.as_ptr(), input.ptr, bytes.len());
            if libc::mprotect(ptr, len, libc::PROT_READ) != 0 {
                return Err(io::Error::last_os_error());
            }
        }
        Ok(input)
    }
}
impl Drop for Input {
    fn drop(&mut self) {
        // SAFETY: Input owns this mapping; its VM translation is gone first
        // (`Profile::run`, or the slot, which drops before it).
        unsafe { libc::munmap(self.ptr.cast(), self.len) };
    }
}

/// getentropy(2): no descriptor, so nothing to open after confinement.
struct Entropy;
impl io::Read for Entropy {
    fn read(&mut self, b: &mut [u8]) -> io::Result<usize> {
        let n = b.len().min(256);
        // SAFETY: b has at least n writable bytes.
        if unsafe { libc::getentropy(b.as_mut_ptr().cast(), n) } != 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(n)
    }
}

/// The current profile's slot and the archive mapped into its VM. Field
/// order: the slot (vCPU, VM) drops before the archive it maps.
struct Current {
    name: String,
    slot: Slot<HvfVm>,
    input: Option<Input>,
}
impl Current {
    fn open(name: &str, snapshot: Arc<Snapshot<State>>) -> io::Result<Self> {
        Ok(Self {
            name: name.to_string(),
            slot: Slot::create(HvfVm::create()?, snapshot, ResetPolicy::default())?,
            input: None,
        })
    }
    /// One native run, as `kvm::native::NativeVm::run`: reset unless
    /// pristine, replace the archive, bind, resume CHECKPOINT and drain the
    /// TX byte streams at every doorbell until the completion, or until
    /// `deadline` (the supervisor's kick stops a running vCPU).
    fn run(&mut self, run: &Run, generation: u64, deadline: u64) -> Result<Output, Failure> {
        let s = &mut self.slot;
        s.admit().map_err(|e| e.to_string())?;
        if let Some(old) = self.input.take() {
            s.vm.unmap_input(old.len).map_err(|e| e.to_string())?;
        }
        let input = Input::new(&run.archive).map_err(|e| e.to_string())?;
        // SAFETY: the mapping lives in self.input until unmap_input or until
        // the slot (and VM) is dropped first.
        unsafe { s.vm.map_input(input.ptr, input.len) }.map_err(|e| e.to_string())?;
        self.input = Some(input);
        s.bind(generation, "", &mut Entropy);
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
            let now = monotonic_ns();
            if now >= deadline {
                return Err(Failure::Deadline);
            }
            s.store(ring::MONOTONIC_NS, now);
            s.wrote_ram(); // the guest may write RAM and registers
            let op = match s.vcpu.run().map_err(|e| e.to_string())? {
                Exit::Doorbell(op) => op,
                Exit::Interrupted => continue, // a kick: the deadline check above
                Exit::Fault { gpa } => {
                    return Err(format!("memory_bound: native access at {gpa:#x}").into());
                }
                e => return Err(format!("unexpected native HVF exit {e:?}").into()),
            };
            let ram = s.ram.ptr;
            rx.drain(s.load(ring::TX_PRODUCER), |cursor, dst| {
                for (i, b) in dst.iter_mut().enumerate() {
                    // SAFETY: the modulo index stays in the fixed TX ring
                    // within the live RAM mapping; the vCPU is stopped.
                    *b = unsafe {
                        ram.add(REQUEST + ((cursor as usize + i) % streams::RING_BYTES))
                            .read_volatile()
                    };
                }
            })
            .map_err(str::to_string)?;
            s.store(ring::TX_CONSUMER, rx.consumed());
            if let Some(out) = rx.finish(op).map_err(str::to_string)? {
                return Ok(out);
            }
        }
    }
}

/// The supervisor thread's shared state: its kqueue (the parent's exit and a
/// user event that re-reads `armed`) and the running request's vCPU and
/// deadline.
struct Supervisor {
    kq: OwnedFd,
    armed: Mutex<Option<(Kicker, u64)>>,
}
/// The kqueue user event's ident.
const REARM: usize = 1;
fn kevent(
    kq: &OwnedFd,
    change: Option<libc::kevent>,
    timeout_ns: Option<u64>,
) -> io::Result<Option<libc::kevent>> {
    let ts = timeout_ns.map(|ns| libc::timespec {
        tv_sec: (ns / 1_000_000_000) as _,
        tv_nsec: (ns % 1_000_000_000) as _,
    });
    // SAFETY: a kevent is plain integers and a nullable opaque pointer.
    let mut out: libc::kevent = unsafe { std::mem::zeroed() };
    let (changes, n) = match &change {
        Some(c) => (c as *const libc::kevent, 1),
        None => (ptr::null(), 0),
    };
    let wanted = if change.is_some() { 0 } else { 1 };
    // SAFETY: kq is live; the change and the output are one live kevent
    // each; ts lives through the call.
    let r = unsafe {
        libc::kevent(
            kq.as_raw_fd(),
            changes,
            n,
            &mut out,
            wanted,
            ts.as_ref().map_or(ptr::null(), |t| t as *const _),
        )
    };
    match r {
        r if r < 0 => Err(io::Error::last_os_error()),
        0 => Ok(None),
        _ => Ok(Some(out)),
    }
}
fn event(ident: usize, filter: i16, flags: u16, fflags: u32) -> libc::kevent {
    libc::kevent {
        ident,
        filter,
        flags,
        fflags,
        data: 0,
        udata: ptr::null_mut(),
    }
}
impl Supervisor {
    /// Watch the parent and start the thread. Fails if the parent is gone
    /// already (reparented to launchd before or during the registration).
    fn start() -> io::Result<Arc<Self>> {
        let gone = || io::Error::other("parent unavailable");
        // SAFETY: no arguments; the result is checked.
        let parent = unsafe { libc::getppid() };
        // SAFETY: no arguments; a new descriptor or -1.
        let kq = unsafe { libc::kqueue() };
        if parent == 1 || kq < 0 {
            return Err(gone());
        }
        // SAFETY: a fresh kqueue descriptor with no other owner.
        let kq = unsafe { OwnedFd::from_raw_fd(kq) };
        let exit = event(
            parent as usize,
            libc::EVFILT_PROC,
            libc::EV_ADD,
            libc::NOTE_EXIT,
        );
        kevent(&kq, Some(exit), Some(0)).map_err(|_| gone())?;
        // SAFETY: no arguments.
        if unsafe { libc::getppid() } != parent {
            return Err(gone());
        }
        let rearm = event(REARM, libc::EVFILT_USER, libc::EV_ADD | libc::EV_CLEAR, 0);
        kevent(&kq, Some(rearm), Some(0))?;
        let s = Arc::new(Self {
            kq,
            armed: Mutex::new(None),
        });
        let thread = s.clone();
        std::thread::Builder::new()
            .name("jitk-native-supervisor".into())
            .spawn(move || thread.watch())?;
        Ok(s)
    }
    fn watch(&self) {
        loop {
            let deadline = self.armed.lock().unwrap().map(|(_, d)| d);
            let left = deadline.map(|d| d.saturating_sub(monotonic_ns()));
            match kevent(&self.kq, None, left) {
                Ok(Some(e)) if e.filter == libc::EVFILT_PROC => {
                    // Node is gone: stop at once, even inside hv_vcpu_run.
                    // SAFETY: ends the process without unwinding.
                    unsafe { libc::_exit(70) }
                }
                Ok(_) => {}
                Err(e) if e.kind() == io::ErrorKind::Interrupted => {}
                // Without the watch nothing would bound the run: fail closed.
                // SAFETY: as above.
                Err(_) => unsafe { libc::_exit(70) },
            }
            let mut armed = self.armed.lock().unwrap();
            if let Some((kicker, deadline)) = *armed
                && monotonic_ns() >= deadline
            {
                // Under the lock, so the run has not been disarmed and its
                // vCPU still exists; a kick landing after the run returned
                // makes the next entry return at once, which is retried.
                let _ = kicker.kick();
                *armed = None;
            }
        }
    }
    fn set(&self, armed: Option<(Kicker, u64)>) {
        *self.armed.lock().unwrap() = armed;
        let rearm = event(REARM, libc::EVFILT_USER, 0, libc::NOTE_TRIGGER);
        let _ = kevent(&self.kq, Some(rearm), Some(0));
    }
}

/// The worker's profiles, loaded before confinement.
pub struct Worker {
    profiles: BTreeMap<String, Arc<Snapshot<State>>>,
    current: Option<Current>,
    /// `hvf native-worker`'s supervisor; tests run without one (a run past
    /// its deadline then stops only at its next doorbell).
    supervisor: Option<Arc<Supervisor>>,
}
impl Worker {
    /// Load 1..16 `TOOL=SNAPSHOT_BASE` profiles (the snapshot's layout and
    /// class are checked by `Snapshot::load`).
    pub fn load(profiles: &[String]) -> io::Result<Self> {
        if profiles.is_empty() || profiles.len() > 16 {
            return Err(io::Error::other("1..16 native profiles required"));
        }
        let mut map = BTreeMap::new();
        for p in profiles {
            let (name, base) = p
                .split_once('=')
                .ok_or_else(|| io::Error::other("profile must be tool=SNAPSHOT_BASE"))?;
            if map
                .insert(name.to_string(), Snapshot::<State>::load(base)?)
                .is_some()
            {
                return Err(io::Error::other("duplicate native profile"));
            }
        }
        Ok(Self {
            profiles: map,
            current: None,
            supervisor: None,
        })
    }
    /// One request: the profile's slot (switching VMs if needed), then its
    /// run within its budget.
    pub fn run(&mut self, run: &Run, generation: u64) -> Result<Output, Failure> {
        let snapshot = self
            .profiles
            .get(&run.tool)
            .ok_or_else(|| "unknown native profile".to_string())?
            .clone();
        if self.current.as_ref().map(|c| c.name.as_str()) != Some(run.tool.as_str()) {
            // One VM per process: the current one goes first.
            self.current = None;
            self.current = Some(Current::open(&run.tool, snapshot).map_err(|e| e.to_string())?);
        }
        let current = self.current.as_mut().unwrap();
        let deadline = run.deadline(monotonic_ns());
        let kicker = current.slot.vcpu().kicker();
        if let Some(s) = &self.supervisor {
            s.set(Some((kicker, deadline)));
        }
        let out = current.run(run, generation, deadline);
        if let Some(s) = &self.supervisor {
            s.set(None);
        }
        out
    }
}

/// jitk.sb for `images` (the profiles' directory), then no fork.
fn confine(images: &Path) -> io::Result<()> {
    let blob = super::seatbelt::compile(super::seatbelt::PROFILE, images)?;
    super::seatbelt::apply(&blob)?;
    super::child::confine()
}

/// `hvf native-worker TOOL=BASE...`: serve frames until stdin ends.
pub fn worker(profiles: &[String]) -> io::Result<()> {
    let mut w = Worker::load(profiles)?;
    let first = profiles[0].split_once('=').map(|p| p.1).unwrap_or("");
    let image = std::fs::canonicalize(format!("{first}.mem"))?;
    super::warm();
    w.supervisor = Some(Supervisor::start()?);
    confine(image.parent().unwrap_or(Path::new("/")))?;
    inputs::serve(
        &mut io::stdin().lock(),
        &mut io::stdout().lock(),
        |run, generation| w.run(run, generation),
    )
}
