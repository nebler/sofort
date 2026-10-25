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
        assert!(off + 8 <= self.len);
        unsafe { ptr::read_volatile(self.ptr.add(off).cast()) }
    }
    fn put(&self, off: usize, value: u64) {
        assert!(off + 8 <= self.len);
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
    regs: Vec<Register>,
}
impl Snapshot {
    pub fn load(base: &str) -> Arc<Self> {
        let memory = File::open(format!("{base}.mem")).unwrap();
        assert_eq!(memory.metadata().unwrap().len(), RAM as u64);
        assert_eq!(
            std::fs::read(format!("{base}.layout")).expect("prepare a glue-2m snapshot"),
            arena::layout_bytes()
        );
        let b = std::fs::read(format!("{base}.regs")).unwrap();
        assert_eq!(&b[..8], b"JTKREGS2");
        let mut at = 8;
        let mut regs = Vec::new();
        while at < b.len() {
            let id = u64::from_le_bytes(b[at..at + 8].try_into().unwrap());
            let n = u64::from_le_bytes(b[at + 8..at + 16].try_into().unwrap()) as usize;
            at += 16;
            assert!(n <= 256 && at + n <= b.len());
            regs.push(Register {
                id,
                data: b[at..at + n].to_vec(),
            });
            at += n;
        }
        assert!(regs.len() > 68);
        Arc::new(Self { memory, regs })
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
    Deadline { deadline_ns: u64 },
}
impl std::fmt::Display for RunError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::MemoryBound { address } => write!(
                f,
                "memory_bound: write outside glue-2m arena at {address:#x}"
            ),
            Self::Deadline { .. } => write!(f, "deadline_exceeded"),
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
    fn create(kvm: &Kvm, file: &File, bounded: bool) -> Self {
        let vm = unsafe { File::from_raw_fd(call(&kvm.fd, KVM_CREATE_VM, 0)) };
        let ram = Mapping::new(file, RAM, 2);
        let regions = if bounded {
            arena::regions(RAM, CTRL).to_vec()
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
        let mut s = Self::create(kvm, &snapshot.memory, true);
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
        self.ram.put(arena::CANARY, v);
    }
    pub fn canary(&self) -> u64 {
        self.ram.word(arena::CANARY)
    }
    fn atomic(&self, off: usize) -> &AtomicU64 {
        unsafe { &*self.ram.ptr.add(CTRL + off).cast() }
    }
    fn load(&self, off: usize) -> u64 {
        self.atomic(off).load(Acquire)
    }
    fn store(&self, off: usize, v: u64) {
        self.atomic(off).store(v, Release);
    }
    pub fn bytes(&self, off: usize, n: usize) -> &[u8] {
        assert!(off + n <= RAM);
        unsafe { std::slice::from_raw_parts(self.ram.ptr.add(off), n) }
    }
    fn copy(&self, off: usize, b: &[u8]) {
        assert!(off + b.len() <= RAM);
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
            .map(|i| self.bytes(base + (cursor + i) % 32768, 1)[0])
            .collect()
    }
    pub fn attack_arena(&mut self) {
        self.copy(
            arena::CANARY,
            include_bytes!(concat!(env!("OUT_DIR"), "/arena-attack.bin")),
        );
        self.set(REG_SCTLR, 0);
        self.set(REG_PSTATE, 0x3c5);
        self.set(REG_PC, 0x80000000 + arena::CANARY as u64);
    }
    pub fn exit(&mut self) -> Exit {
        loop {
            if let Some(e) = self.try_exit().unwrap_or_else(|e| panic!("{e}")) {
                return e;
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
        assert_eq!(reason as u64, KVM_EXIT_MMIO, "unexpected KVM exit {reason}");
        self.pending_mmio = true;
        if self.run.word(MMIO_ADDR) != 0x10000000 {
            return Err(RunError::MemoryBound {
                address: self.run.word(MMIO_ADDR),
            });
        }
        assert_eq!(
            unsafe { self.run.ptr.add(MMIO_LEN).cast::<u32>().read_volatile() },
            4
        );
        assert_eq!(unsafe { self.run.ptr.add(MMIO_WRITE).read_volatile() }, 1);
        let op = unsafe { self.run.ptr.add(MMIO_DATA).cast::<u32>().read_volatile() };
        assert!((1..=5).contains(&op));
        self.pending_mmio = true;
        self.exits += 1;
        let prod = self.load(0x40) as usize;
        assert!(prod >= self.tx && prod - self.tx <= 32768 && prod % 8 == 0);
        let mut requests = Vec::new();
        let mut finish = None;
        while self.tx < prod {
            assert!(prod - self.tx >= 32);
            let h = self.ring_copy(REQUEST, self.tx, 32);
            let len = u32::from_le_bytes(h[..4].try_into().unwrap()) as usize;
            let kind = u16::from_le_bytes(h[4..6].try_into().unwrap());
            let flags = u16::from_le_bytes(h[6..8].try_into().unwrap());
            let generation = u64::from_le_bytes(h[8..16].try_into().unwrap());
            let id = u64::from_le_bytes(h[16..24].try_into().unwrap());
            let n = u32::from_le_bytes(h[24..28].try_into().unwrap()) as usize;
            let cap = u32::from_le_bytes(h[28..].try_into().unwrap());
            assert!((32..=16384).contains(&len) && len % 8 == 0 && len <= prod - self.tx);
            assert!(
                n <= 16352
                    && len == (32 + n + 7) & !7
                    && flags == 1
                    && generation == self.generation
            );
            // Copy once, then validate/use this owner-private copy.
            let mut payload = self.ring_copy(REQUEST, self.tx + 32, len - 32);
            assert!(payload[n..].iter().all(|b| *b == 0));
            payload.truncate(n);
            match kind {
                1 => {
                    assert!(id >= 1 && id <= 32 && cap == 1 && n <= 1024);
                    let bit = 1u32 << (id - 1);
                    assert_eq!(self.seen & bit, 0);
                    self.seen |= bit;
                    let text = std::str::from_utf8(&payload).unwrap();
                    assert!(text.starts_with('[') && text.ends_with(']'));
                    requests.push(Request { id, bytes: payload });
                }
                5 => {
                    assert!(id == 0 && cap == 0 && finish.is_none());
                    finish = Some(String::from_utf8(payload).unwrap());
                }
                4 => {
                    eprintln!("guest: {}", String::from_utf8_lossy(&payload));
                }
                _ => panic!("unexpected TX kind {kind}"),
            }
            self.tx += len;
        }
        self.store(0x80, self.tx as u64);
        if op == 3 {
            if finish.is_none() {
                return Err(RunError::GuestFatal);
            }
            assert_eq!(self.seen, self.replied);
        }
        Ok(Some(Exit {
            op,
            requests,
            finish,
        }))
    }
    pub fn reply(&mut self, r: &Request) {
        let cons = self.load(0x100) as usize;
        assert!(cons >= self.rx_consumed && cons <= self.rx && cons % 8 == 0);
        self.rx_consumed = cons;
        let n = r.bytes.len();
        let len = (32 + n + 7) & !7;
        assert!(self.rx - cons + len <= 32768 && r.id >= 1 && r.id <= 32);
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
        self.store(0x180, self.load(0x180) + 1);
        self.store(0x188, 1);
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
    assert!(
        raw.windows(32).any(|b| b == arena::layout_bytes()),
        "kernel lacks glue-2m layout"
    );
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
    let mut s = Slot::create(kvm, &f, false);
    s.set(REG_PC, 0x80000000);
    s.set(REG_PSTATE, 0x3c5);
    let mut entropy = File::open("/dev/urandom").unwrap();
    s.bind(1, "", &mut entropy);
    let t = Instant::now();
    let e = s.exit();
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
    out.write_all(s.bytes(0, RAM)).unwrap();
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
    layout.write_all(&arena::layout_bytes()).unwrap();
    layout.sync_all().unwrap();
    for ext in ["mem", "regs", "layout"] {
        std::fs::set_permissions(
            format!("{base}.{ext}"),
            std::fs::Permissions::from_mode(0o444),
        )
        .unwrap();
    }
    println!(
        "{{\"event\":\"prepared\",\"ram_bytes\":{RAM},\"registers\":{},\"boot_to_checkpoint_ns\":{}}}",
        regs.len(),
        t.elapsed().as_nanos()
    );
    drop(s);
    drop(f);
    std::fs::remove_file(initial).unwrap();
}
