#[path = "native.rs"]
pub mod native;
use std::{
    fs::File,
    io::{self, Read, Write},
    os::{
        fd::{AsRawFd, FromRawFd},
        raw::{c_int, c_void},
    },
    ptr,
    sync::{
        Arc,
        atomic::{
            AtomicU64,
            Ordering::{Acquire, Release},
        },
    },
    time::{Instant, SystemTime, UNIX_EPOCH},
};
#[allow(dead_code)]
mod abi {
    include!(concat!(env!("OUT_DIR"), "/abi.rs"));
}
use crate::{arena, lease};
use abi::*;
pub const RAM: usize = 32 << 20;
pub const CTRL: usize = 0x1d00000;
pub const REQUEST: usize = CTRL + 0x4000;
pub const REPLY: usize = CTRL + 0xc000;

unsafe extern "C" {
    fn ioctl(fd: c_int, request: u64, ...) -> c_int;
    fn mmap(
        addr: *mut c_void,
        len: usize,
        prot: c_int,
        flags: c_int,
        fd: c_int,
        off: i64,
    ) -> *mut c_void;
    fn munmap(addr: *mut c_void, len: usize) -> c_int;
    fn mprotect(addr: *mut c_void, len: usize, prot: c_int) -> c_int;
    fn madvise(addr: *mut c_void, len: usize, advice: c_int) -> c_int;
    fn setrlimit(resource: c_int, value: *const [u64; 2]) -> c_int;
}
fn check(v: c_int, label: &str) -> c_int {
    assert!(v >= 0, "{label}: {}", io::Error::last_os_error());
    v
}
fn call(fd: &File, op: u64, arg: u64) -> c_int {
    check(unsafe { ioctl(fd.as_raw_fd(), op, arg) }, "KVM ioctl")
}
pub fn raise_fds() {
    check(unsafe { setrlimit(7, &[65536, 65536]) }, "RLIMIT_NOFILE");
}
struct Mapping {
    ptr: *mut u8,
    len: usize,
}
impl Mapping {
    fn new(fd: &File, len: usize, flags: c_int) -> Self {
        let p = unsafe { mmap(ptr::null_mut(), len, 3, flags, fd.as_raw_fd(), 0) };
        assert_ne!(p as isize, -1, "mmap: {}", io::Error::last_os_error());
        // Avoid transparent huge-page CoW obscuring the K-page experiment.
        check(unsafe { madvise(p, len, 15) }, "MADV_NOHUGEPAGE");
        Self { ptr: p.cast(), len }
    }
    fn word(&self, off: usize) -> u64 {
        assert!(off.is_multiple_of(8) && off.checked_add(8).is_some_and(|end| end <= self.len));
        // SAFETY: mmap is live, offset is aligned and in bounds. No Rust RAM
        // reference escapes; the owner reads only after KVM_RUN has returned.
        unsafe { ptr::read_volatile(self.ptr.add(off).cast()) }
    }
    fn put(&self, off: usize, value: u64) {
        assert!(off.is_multiple_of(8) && off.checked_add(8).is_some_and(|end| end <= self.len));
        // SAFETY: same owner-thread/alignment/range contract as word(); no
        // borrowed guest bytes alias this store.
        unsafe { ptr::write_volatile(self.ptr.add(off).cast(), value) }
    }
}
impl Drop for Mapping {
    fn drop(&mut self) {
        unsafe {
            munmap(self.ptr.cast(), self.len);
        }
    }
}
#[repr(C)]
struct Region {
    slot: u32,
    flags: u32,
    gpa: u64,
    size: u64,
    addr: u64,
}
#[repr(C)]
struct OneReg {
    id: u64,
    addr: u64,
}
pub struct Kvm {
    fd: File,
    pub run_size: usize,
}
impl Kvm {
    pub fn new() -> Arc<Self> {
        let fd = File::options()
            .read(true)
            .write(true)
            .open("/dev/kvm")
            .unwrap();
        assert_eq!(call(&fd, KVM_GET_API_VERSION, 0), 12);
        let run_size = call(&fd, KVM_GET_VCPU_MMAP_SIZE, 0) as usize;
        Arc::new(Self { fd, run_size })
    }
}

pub struct Register {
    id: u64,
    data: Vec<u8>,
}
pub struct Snapshot {
    pub memory: File,
    pub class: arena::Class,
    regs: Vec<Register>,
}
fn snapshot_error(message: &'static str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}
fn parse_registers(b: &[u8]) -> io::Result<Vec<Register>> {
    if b.get(..8) != Some(b"JTKREGS2") {
        return Err(snapshot_error("snapshot register magic/truncated header"));
    }
    let mut remaining = &b[8..];
    let mut regs = Vec::new();
    let mut ids = std::collections::HashSet::new();
    while !remaining.is_empty() {
        let h = remaining
            .get(..16)
            .ok_or_else(|| snapshot_error("truncated register header"))?;
        // Fixed-size checked header slices; these conversions cannot fail.
        let id = u64::from_le_bytes(h[..8].try_into().unwrap());
        let n = u64::from_le_bytes(h[8..].try_into().unwrap());
        let width = 1u64 << ((id >> 52) & 15);
        if width > 256 || n != width || id >> 56 != 0x60 || !ids.insert(id) || regs.len() >= 2048 {
            return Err(snapshot_error("snapshot register width/identity/count"));
        }
        let data = remaining
            .get(16..16 + n as usize)
            .ok_or_else(|| snapshot_error("truncated register data"))?;
        regs.push(Register {
            id,
            data: data.to_vec(),
        });
        remaining = &remaining[16 + n as usize..];
    }
    if regs.len() <= 68 {
        return Err(snapshot_error("snapshot register count too small"));
    }
    Ok(regs)
}
impl Snapshot {
    pub fn load(base: &str) -> io::Result<Arc<Self>> {
        let memory = File::open(format!("{base}.mem"))?;
        if memory.metadata()?.len() != RAM as u64 {
            return Err(snapshot_error("snapshot RAM length"));
        }
        let layout = std::fs::read(format!("{base}.layout"))?;
        let class = arena::Class::from_layout(&layout)
            .ok_or_else(|| snapshot_error("unsupported ring snapshot layout"))?;
        // The sidecar cannot select a different class than the linked image.
        use std::os::unix::fs::FileExt;
        let mut kernel = vec![0; 0x80000];
        memory.read_exact_at(&mut kernel, 0)?;
        if !kernel.windows(layout.len()).any(|b| b == layout) {
            return Err(snapshot_error("snapshot/layout mismatch"));
        }
        let b = std::fs::read(format!("{base}.regs"))?;
        let regs = parse_registers(&b)?;
        Ok(Arc::new(Self {
            memory,
            regs,
            class,
        }))
    }
}
pub struct Request {
    pub id: u64,
    pub bytes: Vec<u8>,
}
#[derive(Debug)]
pub enum RunError {
    MemoryBound { address: u64 },
    GuestFatal,
    GuestProtocol(&'static str),
    Deadline { deadline_ns: u64 },
}
impl std::fmt::Display for RunError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::MemoryBound { address } => {
                write!(f, "memory_bound: write outside class arena at {address:#x}")
            }
            Self::Deadline { .. } => write!(f, "deadline_exceeded"),
            Self::GuestProtocol(message) => write!(f, "guest_protocol: {message}"),
            Self::GuestFatal => write!(f, "guest_fatal: guest stopped without a completion"),
        }
    }
}
pub struct Exit {
    pub op: u32,
    pub requests: Vec<Request>,
    pub finish: Option<String>,
}
pub struct Slot {
    run: Mapping,
    ram: Mapping,
    cpu: File,
    _vm: File,
    snapshot: Option<Arc<Snapshot>>,
    pub generation: u64,
    tx: usize,
    rx: usize,
    rx_consumed: usize,
    seen: u32,
    replied: u32,
    pub exits: u64,
    pub drains: u64,
    pending_mmio: bool,
    pub lease: Option<lease::Lease>,
}
impl Slot {
    fn create(kvm: &Kvm, file: &File, class: Option<arena::Class>) -> Self {
        let vm = unsafe { File::from_raw_fd(call(&kvm.fd, KVM_CREATE_VM, 0)) };
        let ram = Mapping::new(file, RAM, 2);
        let regions = if let Some(class) = class {
            class.regions(RAM, CTRL).to_vec()
        } else {
            vec![(0, RAM, true)]
        };
        for (slot, (start, end, writable)) in regions.into_iter().enumerate() {
            let region = Region {
                slot: slot as u32,
                flags: if writable { 0 } else { KVM_MEM_READONLY as u32 },
                gpa: 0x80000000 + start as u64,
                size: (end - start) as u64,
                addr: ram.ptr as u64 + start as u64,
            };
            call(&vm, KVM_SET_USER_MEMORY_REGION, &region as *const _ as u64);
            if !writable {
                check(
                    unsafe { mprotect(ram.ptr.add(start).cast(), end - start, 1) },
                    "mprotect immutable RAM",
                );
            }
        }
        let cpu = unsafe { File::from_raw_fd(call(&vm, KVM_CREATE_VCPU, 0)) };
        let mut init = [0u32; 8];
        call(&vm, KVM_ARM_PREFERRED_TARGET, init.as_mut_ptr() as u64);
        init[1] |= 1 << KVM_ARM_VCPU_PSCI_0_2;
        call(&cpu, KVM_ARM_VCPU_INIT, init.as_ptr() as u64);
        let run = Mapping::new(&cpu, kvm.run_size, 1);
        Self {
            run,
            ram,
            cpu,
            _vm: vm,
            snapshot: None,
            generation: 0,
            tx: 0,
            rx: 0,
            rx_consumed: 0,
            seen: 0,
            replied: 0,
            exits: 0,
            drains: 0,
            pending_mmio: false,
            lease: None,
        }
    }
    pub fn new(kvm: &Kvm, snapshot: Arc<Snapshot>) -> Self {
        let mut s = Self::create(kvm, &snapshot.memory, Some(snapshot.class));
        s.restore_regs(&snapshot.regs);
        s.snapshot = Some(snapshot);
        s
    }
    fn set_bytes(&self, id: u64, b: &[u8]) {
        let r = OneReg {
            id,
            addr: b.as_ptr() as u64,
        };
        call(&self.cpu, KVM_SET_ONE_REG, &r as *const _ as u64);
    }
    fn set(&self, id: u64, v: u64) {
        self.set_bytes(id, &v.to_le_bytes());
    }
    fn capture(&self) -> Vec<Register> {
        let mut list = vec![0u64; 2049];
        list[0] = 2048;
        call(&self.cpu, KVM_GET_REG_LIST, list.as_mut_ptr() as u64);
        let mut regs = Vec::new();
        for &id in &list[1..=list[0] as usize] {
            let n = 1usize << ((id >> 52) & 15);
            assert!(n <= 256);
            let mut data = vec![0u8; n];
            let r = OneReg {
                id,
                addr: data.as_mut_ptr() as u64,
            };
            call(&self.cpu, KVM_GET_ONE_REG, &r as *const _ as u64);
            regs.push(Register { id, data });
        }
        regs
    }
    fn restore_regs(&self, regs: &[Register]) {
        for r in regs {
            self.set_bytes(r.id, &r.data);
        }
    }
    pub fn drain(&mut self) {
        if self.pending_mmio {
            unsafe {
                self.run.ptr.add(IMMEDIATE_EXIT).write_volatile(1);
            }
            let r = unsafe { ioctl(self.cpu.as_raw_fd(), KVM_RUN, 0u64) };
            assert!(r < 0 && io::Error::last_os_error().raw_os_error() == Some(4));
            unsafe {
                self.run.ptr.add(IMMEDIATE_EXIT).write_volatile(0);
            }
            self.pending_mmio = false;
            self.drains += 1;
        }
    }
    pub fn reset(&mut self) -> u64 {
        let t = Instant::now();
        self.drain();
        check(
            unsafe { madvise(self.ram.ptr.cast(), RAM, 4) },
            "MADV_DONTNEED",
        );
        unsafe {
            self.run
                .ptr
                .add(IMMEDIATE_EXIT)
                .cast::<std::sync::atomic::AtomicU8>()
                .as_ref()
                .unwrap()
                .store(0, Release);
        }
        self.restore_regs(&self.snapshot.as_ref().unwrap().regs);
        self.tx = 0;
        self.rx = 0;
        self.rx_consumed = 0;
        self.seen = 0;
        self.replied = 0;
        self.exits = 0;
        self.drains = 0;
        t.elapsed().as_nanos() as u64
    }
    pub fn pristine(&self) -> bool {
        use std::os::unix::fs::FileExt;
        let mut page = [0u8; 4096];
        for off in (0..RAM).step_by(4096) {
            self.snapshot
                .as_ref()
                .unwrap()
                .memory
                .read_exact_at(&mut page, off as u64)
                .unwrap();
            if self.bytes(off, 4096) != page {
                return false;
            }
        }
        true
    }
    pub fn corrupt_canary(&self, v: u64) {
        self.ram
            .put(self.snapshot.as_ref().unwrap().class.canary(), v);
    }
    pub fn canary(&self) -> u64 {
        self.ram
            .word(self.snapshot.as_ref().unwrap().class.canary())
    }
    fn atomic(&self, off: usize) -> &AtomicU64 {
        assert!(
            off.is_multiple_of(8)
                && off
                    .checked_add(8)
                    .is_some_and(|end| end <= arena::RING_BYTES)
        );
        // SAFETY: mmap is page aligned; the checked control word is aligned and
        // live. Only atomic host accesses are exposed, never a RAM slice.
        unsafe { &*self.ram.ptr.add(CTRL + off).cast() }
    }
    fn load(&self, off: usize) -> u64 {
        self.atomic(off).load(Acquire)
    }
    fn store(&self, off: usize, v: u64) {
        self.atomic(off).store(v, Release);
    }
    /// Copy stopped guest RAM; callers never borrow the underlying mapping.
    pub fn bytes(&self, off: usize, n: usize) -> Vec<u8> {
        assert!(off.checked_add(n).is_some_and(|end| end <= RAM));
        (off..off + n)
            .map(|at| {
                // SAFETY: range is checked above; Slot is owner-thread-only, KVM is
                // stopped, and the returned Vec owns each copied byte.
                unsafe { self.ram.ptr.add(at).read_volatile() }
            })
            .collect()
    }
    fn copy(&self, off: usize, b: &[u8]) {
        assert!(off.checked_add(b.len()).is_some_and(|end| end <= RAM));
        // SAFETY: b owns/borrows host memory, never this mapping. Bounds are
        // checked; only this stopped slot's owner writes its writable RAM.
        unsafe {
            ptr::copy_nonoverlapping(b.as_ptr(), self.ram.ptr.add(off), b.len());
        }
    }
    pub fn bind(&mut self, generation: u64, source: &str, entropy: &mut File) -> [u8; 16] {
        assert!(generation > self.generation && source.len() <= 8192);
        self.generation = generation;
        self.store(0, 0x324b544a | (2u64 << 32));
        self.store(8, generation);
        self.store(0x10, 32768 | (16384u64 << 32));
        self.store(0x18, 32 | (32768u64 << 32));
        let mut seed = [0u8; 16];
        entropy.read_exact(&mut seed).unwrap();
        self.copy(CTRL + 0x208, &seed);
        self.store(
            0x218,
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos() as u64,
        );
        self.store(0x220, monotonic_ns());
        self.store(0x228, source.len() as u64);
        self.copy(CTRL + 0x400, source.as_bytes());
        seed
    }
    fn ring_copy(&self, base: usize, cursor: usize, n: usize) -> Vec<u8> {
        (0..n)
            .map(|i| {
                // SAFETY: fixed ring geometry is within RAM; KVM is stopped.
                unsafe {
                    self.ram
                        .ptr
                        .add(base + (cursor + i) % 32768)
                        .read_volatile()
                }
            })
            .collect()
    }
    pub fn attack_arena(&mut self) {
        self.copy(
            self.snapshot.as_ref().unwrap().class.canary(),
            include_bytes!(concat!(env!("OUT_DIR"), "/arena-attack.bin")),
        );
        let class = self.snapshot.as_ref().unwrap().class;
        self.set(REG_X0 + 4 * 2, 0x80000000 + class.start() as u64);
        self.set(REG_X0 + 5 * 2, 0x80000000 + class.end() as u64);
        self.set(REG_SCTLR, 0);
        self.set(REG_PSTATE, 0x3c5);
        self.set(
            REG_PC,
            0x80000000 + self.snapshot.as_ref().unwrap().class.canary() as u64,
        );
    }
    pub fn exit(&mut self) -> Result<Exit, RunError> {
        loop {
            if let Some(e) = self.try_exit()? {
                return Ok(e);
            }
        }
    }
    pub fn try_exit(&mut self) -> Result<Option<Exit>, RunError> {
        self.store(0x220, monotonic_ns());
        // Clear before publishing the active pointer. Kicks received before
        // publication remain pending in TLS, including another slot's expiry.
        unsafe {
            &*self
                .run
                .ptr
                .add(IMMEDIATE_EXIT)
                .cast::<std::sync::atomic::AtomicU8>()
        }
        .store(0, Release);
        let (_running, kicked) =
            unsafe { lease::Running::enter(self.run.ptr.add(IMMEDIATE_EXIT).cast()) };
        if kicked {
            return Ok(None);
        }
        {
            if let Some(l) = &self.lease {
                if l.expired() {
                    return Err(RunError::Deadline {
                        deadline_ns: l.deadline(),
                    });
                }
            }
            let r = unsafe { ioctl(self.cpu.as_raw_fd(), KVM_RUN, 0u64) };
            if r < 0 && io::Error::last_os_error().raw_os_error() == Some(4) {
                return Ok(None); // yield to the owner to service another slot's expiry
            }
            check(r, "KVM_RUN");
        }
        self.pending_mmio = false;
        let reason = unsafe { self.run.ptr.add(EXIT_REASON).cast::<u32>().read_volatile() };
        if reason as u64 != KVM_EXIT_MMIO {
            return Err(RunError::GuestProtocol("unexpected KVM exit"));
        }
        self.pending_mmio = true;
        if self.run.word(MMIO_ADDR) != 0x10000000 {
            return Err(RunError::MemoryBound {
                address: self.run.word(MMIO_ADDR),
            });
        }
        // SAFETY: UAPI offsets identify aligned fields in the live kvm_run mapping;
        // KVM_RUN has returned and the owner is the sole thread accessing this slot.
        let len = unsafe { self.run.ptr.add(MMIO_LEN).cast::<u32>().read_volatile() };
        let write = unsafe { self.run.ptr.add(MMIO_WRITE).read_volatile() };
        if len != 4 || write != 1 {
            return Err(RunError::GuestProtocol("invalid doorbell access"));
        }
        let op = unsafe { self.run.ptr.add(MMIO_DATA).cast::<u32>().read_volatile() };
        self.pending_mmio = true;
        self.exits += 1;
        self.decode_exit(op)
    }
    fn decode_exit(&mut self, op: u32) -> Result<Option<Exit>, RunError> {
        if !(1..=5).contains(&op) {
            return Err(RunError::GuestProtocol("unknown doorbell"));
        }
        let prod = self.load(0x40) as usize;
        if prod < self.tx || prod - self.tx > 32768 || !prod.is_multiple_of(8) {
            return Err(RunError::GuestProtocol("TX cursor"));
        }
        let mut requests = Vec::new();
        let mut finish = None;
        while self.tx < prod {
            if prod - self.tx < 32 {
                return Err(RunError::GuestProtocol("truncated TX header"));
            }
            let h = self.ring_copy(REQUEST, self.tx, 32);
            let len = u32::from_le_bytes(h[..4].try_into().unwrap()) as usize;
            let kind = u16::from_le_bytes(h[4..6].try_into().unwrap());
            let flags = u16::from_le_bytes(h[6..8].try_into().unwrap());
            let generation = u64::from_le_bytes(h[8..16].try_into().unwrap());
            let id = u64::from_le_bytes(h[16..24].try_into().unwrap());
            let n = u32::from_le_bytes(h[24..28].try_into().unwrap()) as usize;
            let cap = u32::from_le_bytes(h[28..].try_into().unwrap());
            // Header slices above have fixed, host-selected lengths. Their conversions
            // cannot fail; guest values are validated before indexing the payload.
            if !(32..=16384).contains(&len)
                || !len.is_multiple_of(8)
                || len > prod - self.tx
                || n > 16352
                || len != (32 + n + 7) & !7
                || flags != 1
                || generation != self.generation
            {
                return Err(RunError::GuestProtocol("TX record header"));
            }
            // Copy once, then validate/use this owner-private copy.
            let mut payload = self.ring_copy(REQUEST, self.tx + 32, len - 32);
            if payload[n..].iter().any(|b| *b != 0) {
                return Err(RunError::GuestProtocol("nonzero TX padding"));
            }
            payload.truncate(n);
            match kind {
                1 => {
                    if !(1..=32).contains(&id)
                        || id != u64::from(self.seen.count_ones()) + 1
                        || cap != 1
                        || n > 1024
                        || !crate::ipc_json::arguments(&payload)
                    {
                        return Err(RunError::GuestProtocol("call identity/schema"));
                    }
                    self.seen |= 1u32 << (id - 1);
                    requests.push(Request { id, bytes: payload });
                }
                5 => {
                    if id != 0 || cap != 0 || finish.is_some() || op != 3 || self.tx + len != prod {
                        return Err(RunError::GuestProtocol("completion identity/order"));
                    }
                    finish = Some(
                        String::from_utf8(payload)
                            .map_err(|_| RunError::GuestProtocol("completion UTF-8"))?,
                    );
                }
                4 => {
                    if id != 0 || cap != 0 {
                        return Err(RunError::GuestProtocol("log identity"));
                    }
                    eprintln!("guest: {}", String::from_utf8_lossy(&payload));
                }
                _ => return Err(RunError::GuestProtocol("unknown TX kind")),
            }
            self.tx += len;
        }
        self.store(0x80, self.tx as u64);
        if op == 3 {
            if finish.is_none() {
                return Err(RunError::GuestFatal);
            }
            if self.seen != self.replied || !requests.is_empty() {
                return Err(RunError::GuestProtocol("completion with outstanding calls"));
            }
        }
        Ok(Some(Exit {
            op,
            requests,
            finish,
        }))
    }
    pub fn reply(&mut self, r: &Request) -> Result<(), RunError> {
        let cons = self.load(0x100) as usize;
        if cons < self.rx_consumed || cons > self.rx || !cons.is_multiple_of(8) {
            return Err(RunError::GuestProtocol("RX consumer cursor"));
        }
        self.rx_consumed = cons;
        let n = r.bytes.len();
        let len = (32 + n + 7) & !7;
        if self.rx - cons + len > 32768 {
            return Err(RunError::GuestProtocol("RX credit exhausted"));
        }
        // The trusted broker/fixture must answer a previously decoded request once.
        assert!((1..=32).contains(&r.id) && n <= 1024);
        let bit = 1u32 << (r.id - 1);
        assert_eq!(self.replied & bit, 0);
        assert_ne!(self.seen & bit, 0);
        let mut b = vec![0u8; len];
        b[..4].copy_from_slice(&(len as u32).to_le_bytes());
        b[4..6].copy_from_slice(&2u16.to_le_bytes());
        b[6..8].copy_from_slice(&1u16.to_le_bytes());
        b[8..16].copy_from_slice(&self.generation.to_le_bytes());
        b[16..24].copy_from_slice(&r.id.to_le_bytes());
        b[24..28].copy_from_slice(&(n as u32).to_le_bytes());
        b[28..32].copy_from_slice(&1u32.to_le_bytes());
        b[32..32 + n].copy_from_slice(&r.bytes);
        for (i, x) in b.iter().enumerate() {
            self.copy(REPLY + (self.rx + i) % 32768, &[*x]);
        }
        self.rx += len;
        self.replied |= bit;
        self.store(0xc0, self.rx as u64);
        self.store(0x180, u64::from(self.replied.count_ones()));
        self.store(0x188, 1);
        Ok(())
    }
    pub fn pause_after_repair(&self) {
        self.store(0x240, 1);
    }
    pub fn repaired(&self) -> bool {
        self.load(0x238) == self.generation
    }
}
impl Drop for Slot {
    fn drop(&mut self) {
        self.drain();
    }
}

#[repr(C)]
struct Timespec {
    sec: i64,
    nsec: i64,
}
unsafe extern "C" {
    fn clock_gettime(clock: i32, t: *mut Timespec) -> i32;
}
pub fn clock_ns(clock: i32) -> u64 {
    let mut t = Timespec { sec: 0, nsec: 0 };
    check(unsafe { clock_gettime(clock, &mut t) }, "clock_gettime");
    t.sec as u64 * 1_000_000_000 + t.nsec as u64
}
pub fn monotonic_ns() -> u64 {
    clock_ns(1)
}
pub fn prepare(kvm: &Kvm, image: &str, base: &str) {
    let raw = std::fs::read(image).unwrap();
    assert!(raw.len() < CTRL);
    let classes: Vec<_> = arena::Class::ALL
        .into_iter()
        .filter(|c| {
            let layout = c.layout_bytes();
            raw.windows(layout.len()).any(|b| b == layout)
        })
        .collect();
    assert_eq!(
        classes.len(),
        1,
        "kernel must identify exactly one supported ring layout"
    );
    let class = classes[0];
    let initial = format!("{base}.boot");
    let mut f = File::options()
        .write(true)
        .read(true)
        .create_new(true)
        .open(&initial)
        .unwrap();
    f.set_len(RAM as u64).unwrap();
    f.write_all(&raw).unwrap();
    f.sync_all().unwrap();
    let mut s = Slot::create(kvm, &f, None);
    s.set(REG_PC, 0x80000000);
    s.set(REG_PSTATE, 0x3c5);
    let mut entropy = File::open("/dev/urandom").unwrap();
    s.bind(1, "", &mut entropy);
    let t = Instant::now();
    let e = s.exit().expect("trusted checkpoint protocol");
    assert_eq!(e.op, 4, "real guest did not CHECKPOINT");
    assert!(e.requests.is_empty() && e.finish.is_none());
    s.drain();
    let regs = s.capture();
    // Save at completed checkpoint store, before repair or tenant data.
    let mut out = File::options()
        .write(true)
        .create_new(true)
        .open(format!("{base}.mem"))
        .unwrap();
    out.write_all(&s.bytes(0, RAM)).unwrap();
    out.sync_all().unwrap();
    let mut out = File::options()
        .write(true)
        .create_new(true)
        .open(format!("{base}.regs"))
        .unwrap();
    out.write_all(b"JTKREGS2").unwrap();
    for r in &regs {
        out.write_all(&r.id.to_le_bytes()).unwrap();
        out.write_all(&(r.data.len() as u64).to_le_bytes()).unwrap();
        out.write_all(&r.data).unwrap();
    }
    out.sync_all().unwrap();
    use std::os::unix::fs::PermissionsExt;
    let mut layout = File::options()
        .write(true)
        .create_new(true)
        .open(format!("{base}.layout"))
        .unwrap();
    layout.write_all(&class.layout_bytes()).unwrap();
    layout.sync_all().unwrap();
    for ext in ["mem", "regs", "layout"] {
        std::fs::set_permissions(
            format!("{base}.{ext}"),
            std::fs::Permissions::from_mode(0o444),
        )
        .unwrap();
    }
    println!(
        "{{\"event\":\"prepared\",\"class\":\"{}\",\"arena_bytes\":{},\"ram_bytes\":{RAM},\"registers\":{},\"boot_to_checkpoint_ns\":{}}}",
        class.name(),
        class.bytes(),
        regs.len(),
        t.elapsed().as_nanos()
    );
    drop(s);
    drop(f);
    std::fs::remove_file(initial).unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;
    fn slot() -> Slot {
        let f = File::open("/dev/zero").unwrap();
        Slot {
            run: Mapping::new(&f, 4096, 2),
            ram: Mapping::new(&f, RAM, 2),
            cpu: File::open("/dev/null").unwrap(),
            _vm: File::open("/dev/null").unwrap(),
            snapshot: None,
            generation: 2,
            tx: 0,
            rx: 0,
            rx_consumed: 0,
            seen: 0,
            replied: 0,
            exits: 0,
            drains: 0,
            pending_mmio: false,
            lease: None,
        }
    }
    fn record(s: &Slot, kind: u16, id: u64, payload: &[u8]) {
        let len = (32 + payload.len() + 7) & !7;
        let mut b = vec![0; len];
        b[..4].copy_from_slice(&(len as u32).to_le_bytes());
        b[4..6].copy_from_slice(&kind.to_le_bytes());
        b[6..8].copy_from_slice(&1u16.to_le_bytes());
        b[8..16].copy_from_slice(&2u64.to_le_bytes());
        b[16..24].copy_from_slice(&id.to_le_bytes());
        b[24..28].copy_from_slice(&(payload.len() as u32).to_le_bytes());
        b[28..32].copy_from_slice(&(if kind == 1 { 1u32 } else { 0 }).to_le_bytes());
        b[32..32 + payload.len()].copy_from_slice(payload);
        s.copy(REQUEST, &b);
        s.store(0x40, len as u64);
    }
    fn register_bytes() -> Vec<u8> {
        let mut bytes = b"JTKREGS2".to_vec();
        for i in 0..69u64 {
            bytes.extend_from_slice(&(0x6030_0000_0010_0000 + i).to_le_bytes());
            bytes.extend_from_slice(&8u64.to_le_bytes());
            bytes.extend_from_slice(&0u64.to_le_bytes());
        }
        bytes
    }
    #[test]
    fn snapshot_registers_reject_truncation_and_corrupt_widths() {
        let good = register_bytes();
        assert!(parse_registers(&good).is_ok());
        for n in 0..good.len() {
            assert!(parse_registers(&good[..n]).is_err(), "prefix {n}");
        }
        for width in [0, 1, 7, 9, 256, u64::MAX] {
            let mut bad = good.clone();
            bad[16..24].copy_from_slice(&width.to_le_bytes());
            assert!(parse_registers(&bad).is_err());
        }
        let mut bad = good.clone();
        bad[8..16].copy_from_slice(&0x6090_0000_0010_0000u64.to_le_bytes());
        assert!(parse_registers(&bad).is_err());
        let mut bad = good.clone();
        bad.extend_from_slice(&good[8..32]);
        assert!(parse_registers(&bad).is_err(), "duplicate id");
        let mut bad = good;
        bad[0] = 0;
        assert!(parse_registers(&bad).is_err());
    }
    #[test]
    fn guest_ram_reads_are_owned_copies() {
        let s = slot();
        s.copy(0, &[1, 2, 3, 4]);
        let saved = s.bytes(0, 4);
        s.copy(0, &[5, 6, 7, 8]);
        assert_eq!(&saved[..], &[1, 2, 3, 4]);
        assert_eq!(&s.bytes(0, 4)[..], &[5, 6, 7, 8]);
    }
    #[test]
    fn malformed_guest_records_are_run_errors() {
        for op in [0, 6, u32::MAX] {
            assert!(matches!(
                slot().decode_exit(op),
                Err(RunError::GuestProtocol(_))
            ));
        }
        let mut s = slot();
        record(&s, 5, 0, b"\xff");
        assert!(matches!(
            s.decode_exit(3),
            Err(RunError::GuestProtocol("completion UTF-8"))
        ));
        for cursor in [1, 8, 32776, u64::MAX] {
            let mut s = slot();
            s.store(0x40, cursor);
            assert!(s.decode_exit(1).is_err());
        }
        for (kind, id, payload) in [
            (1, 0, &b"[]"[..]),
            (1, 33, &b"[]"[..]),
            (1, 2, &b"[]"[..]),
            (1, 1, &b"[bad]"[..]),
            (1, 1, &b"[\xff]"[..]),
            (5, 0, &b"\xff"[..]),
            (99, 0, &b""[..]),
        ] {
            let mut s = slot();
            record(&s, kind, id, payload);
            assert!(s.decode_exit(1).is_err());
        }
        for (at, value) in [
            (0, 0),
            (0, 255),
            (6, 2),
            (8, 9),
            (24, 255),
            (28, 2),
            (39, 1),
        ] {
            let mut s = slot();
            record(&s, 1, 1, b"[]");
            s.copy(REQUEST + at, &[value]);
            assert!(s.decode_exit(1).is_err(), "header/padding byte {at}");
        }
    }
    #[test]
    fn reply_notifications_use_host_shadow_not_guest_counter() {
        let mut s = slot();
        s.seen = 1;
        s.store(0x180, u64::MAX);
        s.reply(&Request {
            id: 1,
            bytes: b"[]".to_vec(),
        })
        .unwrap();
        assert_eq!(s.load(0x180), 1);
    }
    #[test]
    fn guest_reply_credit_is_checked() {
        let mut s = slot();
        s.store(0x100, u64::MAX);
        assert!(
            s.reply(&Request {
                id: 1,
                bytes: b"[]".to_vec()
            })
            .is_err()
        );
    }
}
