use std::{
    fs::File,
    io,
    os::{
        fd::{AsRawFd, FromRawFd},
        raw::{c_int, c_void},
    },
    ptr,
    sync::Arc,
    time::Instant,
};
#[allow(dead_code)]
mod abi {
    include!(concat!(env!("OUT_DIR"), "/abi.rs"));
}
use abi::*;
pub const RAM: usize = 2 << 20;
pub const CTRL: usize = 0x4000;
pub const REQUEST: usize = 0x8000;
pub const REPLY: usize = 0x10000;
pub const ARENA: usize = 0x20000;
pub const STUB: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/stub.bin"));
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
        // SAFETY: fd is live and len comes from the verified snapshot geometry
        // or KVM's run size. The returned mapping is checked before any access.
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
        // SAFETY: this owns the original mapping, with no escaping RAM borrows;
        // the owner has stopped KVM and will never reenter this slot.
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
pub struct Slot {
    // All objects are constructed, used and dropped on their owner thread.
    pub id: usize,
    run: Mapping,
    ram: Mapping,
    cpu: File,
    _vm: File,
    regs: Vec<(u64, u64)>,
    pub generation: u64,
    pub seed: u64,
    pub calls: usize,
    requests: usize,
    replies: usize,
    seen: u16,
    waiting: bool,
    pending_mmio: bool,
}
impl Slot {
    pub fn new(kvm: &Kvm, snapshot: &File, id: usize) -> Self {
        let vm = unsafe { File::from_raw_fd(call(&kvm.fd, KVM_CREATE_VM, 0)) };
        let ram = Mapping::new(snapshot, RAM, 2); // MAP_PRIVATE
        let region = Region {
            slot: 0,
            flags: 0,
            gpa: 0x80000000,
            size: RAM as u64,
            addr: ram.ptr as u64,
        };
        call(&vm, KVM_SET_USER_MEMORY_REGION, &region as *const _ as u64);
        let cpu = unsafe { File::from_raw_fd(call(&vm, KVM_CREATE_VCPU, 0)) };
        let mut init = [0u32; 8];
        call(&vm, KVM_ARM_PREFERRED_TARGET, init.as_mut_ptr() as u64);
        init[1] |= 1 << KVM_ARM_VCPU_PSCI_0_2;
        call(&cpu, KVM_ARM_VCPU_INIT, init.as_ptr() as u64);
        let run = Mapping::new(&cpu, kvm.run_size, 1); // MAP_SHARED
        let mut s = Self {
            id,
            run,
            ram,
            cpu,
            _vm: vm,
            regs: Vec::new(),
            generation: 0,
            seed: 0,
            calls: 0,
            requests: 0,
            replies: 0,
            seen: 0,
            waiting: false,
            pending_mmio: false,
        };
        s.set_reg(REG_PC, 0x80000000);
        s.set_reg(REG_PSTATE, 0x3c5); // EL1h, DAIF masked
        // All GPRs + SP_EL0, PC, PSTATE. Stub never modifies system/FP regs.
        for i in 0..34 {
            let id = REG_X0 + i * 2;
            s.regs.push((id, s.get_reg(id)));
        }
        s
    }
    fn set_reg(&self, id: u64, value: u64) {
        let r = OneReg {
            id,
            addr: &value as *const _ as u64,
        };
        call(&self.cpu, KVM_SET_ONE_REG, &r as *const _ as u64);
    }
    fn get_reg(&self, id: u64) -> u64 {
        let mut v = 0u64;
        let r = OneReg {
            id,
            addr: &mut v as *mut _ as u64,
        };
        call(&self.cpu, KVM_GET_ONE_REG, &r as *const _ as u64);
        v
    }
    pub fn word(&self, off: usize) -> u64 {
        self.ram.word(off)
    }
    fn put(&self, off: usize, v: u64) {
        self.ram.put(off, v);
    }
    // KVM's internal MMIO completion is not represented in the register image.
    // Re-enter with immediate_exit before resetting PC or discarding memory.
    pub fn drain(&mut self) {
        self.shutdown().expect("stopped vCPU MMIO drain");
    }
    /// Complete pending MMIO before teardown. The caller owns a stopped vCPU.
    pub fn shutdown(&mut self) -> io::Result<()> {
        if self.pending_mmio {
            // SAFETY: the live kvm_run mapping is owned here and no KVM_RUN is
            // active. immediate_exit is the UAPI byte; the pointer cannot escape.
            unsafe {
                self.run.ptr.add(IMMEDIATE_EXIT).write_volatile(1);
            }
            let r = unsafe { ioctl(self.cpu.as_raw_fd(), KVM_RUN, 0u64) };
            let error = io::Error::last_os_error();
            unsafe {
                self.run.ptr.add(IMMEDIATE_EXIT).write_volatile(0);
            }
            if r >= 0 {
                return Err(io::Error::other("MMIO drain did not return EINTR"));
            }
            if error.raw_os_error() != Some(4) {
                return Err(error);
            }
            self.pending_mmio = false;
        }
        Ok(())
    }
    pub fn reset(&mut self) -> u64 {
        let t = Instant::now();
        self.drain();
        check(
            unsafe { madvise(self.ram.ptr.cast(), RAM, 4) },
            "MADV_DONTNEED",
        );
        for &(id, value) in &self.regs {
            self.set_reg(id, value);
        }
        self.requests = 0;
        self.replies = 0;
        self.seen = 0;
        self.waiting = false;
        t.elapsed().as_nanos() as u64
    }
    pub fn pristine(&self, snapshot: &[u8]) -> bool {
        snapshot.len() == RAM
            && snapshot.iter().enumerate().all(|(off, byte)| {
                // SAFETY: owner-thread-only stopped mapping; no Rust RAM slice is
                // formed, and each read is within the live RAM allocation.
                unsafe { self.ram.ptr.add(off).read_volatile() == *byte }
            })
    }
    pub fn configure(&mut self, generation: u64, seed: u64, k: usize, calls: usize) {
        assert!(k <= 256 && calls <= 10);
        self.generation = generation;
        self.seed = seed;
        self.calls = calls;
        // The control+ring area is a real 80 KiB private allocation per active slot.
        unsafe {
            ptr::write_bytes(self.ram.ptr.add(CTRL), 0, 81920);
        }
        self.put(CTRL, generation);
        self.put(CTRL + 8, seed);
        self.put(CTRL + 16, k as u64);
        self.put(CTRL + 24, calls as u64);
    }
    pub fn park_clean(&mut self) {
        self.configure(0, 0, 0, 0);
        self.put(CTRL + 88, 1);
        assert_eq!(self.run_exit(), 2);
        self.drain();
        self.waiting = true;
    }
    pub fn run_exit(&mut self) -> u32 {
        loop {
            let r = unsafe { ioctl(self.cpu.as_raw_fd(), KVM_RUN, 0u64) };
            if r < 0 && io::Error::last_os_error().raw_os_error() == Some(4) {
                continue;
            }
            check(r, "KVM_RUN");
            self.pending_mmio = false;
            let reason = unsafe { ptr::read_volatile(self.run.ptr.add(EXIT_REASON).cast::<u32>()) };
            assert_eq!(
                reason as u64, KVM_EXIT_MMIO,
                "slot {} unexpected exit {reason}",
                self.id
            );
            assert_eq!(self.run.word(MMIO_ADDR), 0x10000000);
            assert_eq!(
                unsafe { ptr::read_volatile(self.run.ptr.add(MMIO_LEN).cast::<u32>()) },
                4
            );
            assert_eq!(
                unsafe { ptr::read_volatile(self.run.ptr.add(MMIO_WRITE)) },
                1
            );
            let op = unsafe { ptr::read_volatile(self.run.ptr.add(MMIO_DATA).cast::<u32>()) };
            assert!((1..=3).contains(&op));
            self.pending_mmio = true;
            return op;
        }
    }
    fn consume(&mut self) {
        let prod = self.word(CTRL + 32) as usize;
        std::sync::atomic::fence(std::sync::atomic::Ordering::Acquire);
        assert!(prod > self.requests && prod <= self.calls && prod - self.requests <= 512);
        while self.requests < prod {
            let off = REQUEST + self.requests * 64;
            assert_eq!(self.word(off), self.generation);
            assert_eq!(self.word(off + 8), self.requests as u64);
            assert_eq!(self.word(off + 16), self.seed);
            assert_eq!(self.word(off + 24), 1);
            self.requests += 1;
        }
        self.put(CTRL + 40, self.requests as u64);
    }
    pub fn run_to_wait(&mut self) {
        loop {
            match self.run_exit() {
                1 => self.consume(),
                2 => {
                    assert_eq!(self.requests, self.calls);
                    assert_eq!(self.word(CTRL + 80), self.calls as u64);
                    self.drain();
                    self.waiting = true;
                    return;
                }
                _ => panic!("FINISH before WAIT, error={}", self.word(CTRL + 64)),
            }
        }
    }
    pub fn complete(&mut self, call_id: usize, generation: u64) -> bool {
        assert_eq!(generation, self.generation);
        assert!(self.waiting && call_id < self.calls && self.seen & (1 << call_id) == 0);
        self.seen |= 1 << call_id;
        let off = REPLY + self.replies * 64;
        self.put(off, generation);
        self.put(off + 8, call_id as u64);
        self.put(off + 16, self.seed ^ call_id as u64);
        self.replies += 1;
        std::sync::atomic::fence(std::sync::atomic::Ordering::Release);
        self.put(CTRL + 48, self.replies as u64);
        if self.replies == self.calls {
            self.waiting = false;
            true
        } else {
            false
        }
    }
    pub fn finish(&mut self) {
        assert_eq!(self.run_exit(), 3);
        self.validate(0);
        self.drain();
    }
    pub fn validate(&self, k: usize) {
        assert_eq!(self.word(CTRL + 64), 0, "guest found stale bytes");
        assert_eq!(self.word(CTRL + 72), 1);
        assert_eq!(self.word(CTRL), self.generation);
        assert_eq!(self.word(CTRL + 8), self.seed);
        assert_eq!(self.word(REQUEST), self.generation);
        assert_eq!(self.word(REQUEST + 8), 0);
        assert_eq!(self.word(REQUEST + 16), self.seed);
        assert_eq!(self.word(REQUEST + 24), 1);
        for off in (ARENA..ARENA + k * 4096).step_by(8) {
            assert_eq!(self.word(off), self.seed ^ self.generation);
        }
        assert_eq!(self.word(ARENA + k * 4096), 0xa5a5a5a5a5a5a5a5);
    }
    pub fn corrupt_for_test(&self) {
        self.put(ARENA, 0xdeadbeef);
    }
}
impl Drop for Slot {
    fn drop(&mut self) {
        let _ = self.shutdown();
    }
}
