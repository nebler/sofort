//! The persistent native worker on Hypervisor.framework (`hvf native-worker
//! TOOL=SNAPSHOT_BASE ...`): the Linux worker's JNR7 frames on stdin/stdout
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
use super::{HvfVm, State};
use crate::clock::monotonic_ns;
use crate::constants::ring;
use crate::hv::{Exit, Vcpu};
use crate::inputs::{self, MAX_ARCHIVE, Run};
use crate::slot::{CTRL, REQUEST, ResetPolicy, Slot};
use crate::snapshot::Snapshot;
use crate::streams::{self, Output, Receiver};
use std::{collections::BTreeMap, io, path::Path, ptr, sync::Arc};

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
    /// TX byte streams at every doorbell until the completion.
    fn run(&mut self, run: &Run, generation: u64) -> Result<Output, String> {
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
            s.store(ring::MONOTONIC_NS, monotonic_ns());
            s.wrote_ram(); // the guest may write RAM and registers
            let op = match s.vcpu.run().map_err(|e| e.to_string())? {
                Exit::Doorbell(op) => op,
                Exit::Interrupted => continue,
                Exit::Fault { gpa } => {
                    return Err(format!("memory_bound: native access at {gpa:#x}"));
                }
                e => return Err(format!("unexpected native HVF exit {e:?}")),
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

/// The worker's profiles, loaded before confinement.
pub struct Worker {
    profiles: BTreeMap<String, Arc<Snapshot<State>>>,
    current: Option<Current>,
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
        })
    }
    /// One request: the profile's slot (switching VMs if needed), then its run.
    pub fn run(&mut self, run: &Run, generation: u64) -> Result<Output, String> {
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
        self.current.as_mut().unwrap().run(run, generation)
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
    confine(image.parent().unwrap_or(Path::new("/")))?;
    inputs::serve(
        &mut io::stdin().lock(),
        &mut io::stdout().lock(),
        |run, generation| w.run(run, generation),
    )
}
