//! Hypervisor-neutral slot: guest memory layout, bind, ring decode/reply and
//! reset. The ring logic is a port of `shard/src/kvm/mod.rs` (decode_exit,
//! reply, bind) with KVM's kvm_run replaced by `hv::Exit`; nothing here names
//! Hypervisor.framework.
use crate::hv::{ArchState, Exit, Vcpu, Vm};
use jitk_shard::{arena::Class, constants::ring, payload};
use std::{
    fs::File,
    io::{self, Write},
    os::fd::AsRawFd,
    ptr,
    sync::atomic::{AtomicU64, Ordering::{Acquire, Release}},
    time::Instant,
};

pub const RAM: usize = ring::RAM_BYTES;
pub const CTRL: usize = ring::CONTROL;
const REQUEST: usize = ring::TX;
const REPLY: usize = ring::RX;
/// HVF maps at the host page size.
pub const PAGE: usize = 16384;

/// One mmap; unmapped on drop.
pub struct Mapping {
    pub ptr: *mut u8,
    len: usize,
}
impl Mapping {
    pub fn file(f: &File, len: usize, prot: i32, flags: i32) -> io::Result<Self> {
        // SAFETY: fresh mapping of a live descriptor; the result is checked.
        let p = unsafe { libc_mmap(ptr::null_mut(), len, prot, flags, f.as_raw_fd(), 0) };
        if p as isize == -1 {
            return Err(io::Error::last_os_error());
        }
        Ok(Self {
            ptr: p.cast(),
            len,
        })
    }
}
impl Drop for Mapping {
    fn drop(&mut self) {
        // SAFETY: this owns the mapping; HVF mappings of it are gone with the VM.
        unsafe { munmap(self.ptr.cast(), self.len) };
    }
}
pub const PROT_READ: i32 = 1;
pub const PROT_WRITE: i32 = 2;
pub const MAP_SHARED: i32 = 1;
pub const MAP_PRIVATE: i32 = 2;
unsafe extern "C" {
    #[link_name = "mmap"]
    fn libc_mmap(a: *mut u8, len: usize, prot: i32, flags: i32, fd: i32, off: i64) -> *mut u8;
    fn munmap(a: *mut u8, len: usize) -> i32;
    fn mprotect(a: *mut u8, len: usize, prot: i32) -> i32;
    fn sys_dcache_flush(start: *mut u8, len: usize);
}

/// A prepared snapshot: RAM file (same layout and format as the KVM shard's
/// `.mem`), arena class, and this hypervisor's register file.
pub struct Snapshot<S> {
    pub memory: File,
    pub class: Class,
    pub regs: S,
    /// PROT_READ MAP_SHARED view of `memory`: the reset's copy source.
    pub reference: Mapping,
}
impl<S: ArchState> Snapshot<S> {
    pub fn load(base: &str) -> io::Result<Self> {
        let memory = File::open(format!("{base}.mem"))?;
        if memory.metadata()?.len() != RAM as u64 {
            return Err(io::Error::other("snapshot RAM length"));
        }
        let layout = std::fs::read(format!("{base}.layout"))?;
        let class = Class::from_layout(&layout).ok_or(io::Error::other("layout"))?;
        let regs = S::decode(&std::fs::read(format!("{base}.hvfregs"))?)?;
        let reference = Mapping::file(&memory, RAM, PROT_READ, MAP_SHARED)?;
        Ok(Self {
            memory,
            class,
            regs,
            reference,
        })
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ResetMode {
    /// memcpy both writable extents (arena + transport) from the reference.
    Copy,
    /// Compare each 16 KiB page with the reference; copy only differing ones.
    Compare,
}
#[derive(Default, Clone, Copy, Debug)]
pub struct ResetReport {
    pub ns: u64,
    pub mem_ns: u64,
    pub clean_ns: u64,
    pub regs_ns: u64,
    pub pages_copied: usize,
}

pub struct Request {
    pub id: u64,
    pub bytes: Vec<u8>,
}
pub struct Step {
    pub op: u32,
    pub requests: Vec<Request>,
    pub finish: Option<String>,
}

pub struct Slot<V: Vcpu> {
    pub vcpu: V,
    ram: Mapping,
    reference: *const u8,
    class: Option<Class>,
    regs: Option<V::State>,
    pub generation: u64,
    tx: usize,
    rx: usize,
    rx_consumed: usize,
    seen: u32,
    replied: u32,
    pub doorbells: u64,
    pristine: bool,
}

pub fn monotonic_ns() -> u64 {
    use std::sync::OnceLock;
    static T0: OnceLock<Instant> = OnceLock::new();
    T0.get_or_init(Instant::now).elapsed().as_nanos() as u64 + 1
}

impl<V: Vcpu> Slot<V> {
    /// Unpartitioned, all-writable boot VM over a fresh image file (prepare).
    pub fn boot<M: Vm<Vcpu = V>>(vm: &mut M, image: &File) -> io::Result<Self> {
        let ram = Mapping::file(image, RAM, PROT_READ | PROT_WRITE, MAP_PRIVATE)?;
        vm.map(ram.ptr, ring::RAM_GPA, RAM, true)?;
        let mut vcpu = vm.vcpu()?;
        vcpu.set_entry(ring::RAM_GPA, 0)?;
        Ok(Self::with(vcpu, ram, ptr::null(), None, None))
    }
    /// A slot over a prepared snapshot: MAP_PRIVATE RAM, immutable extents
    /// read-only on both the host and in stage 2, registers restored.
    pub fn new<M: Vm<Vcpu = V>>(vm: &mut M, snap: &Snapshot<V::State>) -> io::Result<Self> {
        let ram = Mapping::file(&snap.memory, RAM, PROT_READ | PROT_WRITE, MAP_PRIVATE)?;
        for (start, end, writable) in snap.class.regions(RAM, CTRL) {
            assert!(start % PAGE == 0 && end % PAGE == 0, "extent not 16 KiB aligned");
            // SAFETY: page-aligned extent within the live RAM mapping.
            if !writable && unsafe { mprotect(ram.ptr.add(start), end - start, PROT_READ) } != 0 {
                return Err(io::Error::last_os_error());
            }
            // SAFETY: as above.
            vm.map(unsafe { ram.ptr.add(start) }, ring::RAM_GPA + start as u64, end - start, writable)?;
        }
        let mut vcpu = vm.vcpu()?;
        vcpu.restore(&snap.regs)?;
        let mut s = Self::with(vcpu, ram, snap.reference.ptr, Some(snap.class), Some(snap.regs.clone()));
        s.pristine = true; // fresh MAP_PRIVATE reads as the file
        Ok(s)
    }
    fn with(vcpu: V, ram: Mapping, reference: *const u8, class: Option<Class>, regs: Option<V::State>) -> Self {
        Self {
            vcpu,
            ram,
            reference,
            class,
            regs,
            generation: 0,
            tx: 0,
            rx: 0,
            rx_consumed: 0,
            seen: 0,
            replied: 0,
            doorbells: 0,
            pristine: false,
        }
    }
    fn atomic(&self, off: usize) -> &AtomicU64 {
        assert!(off % 8 == 0 && off + 8 <= ring::TRANSPORT_BYTES);
        // SAFETY: aligned control word inside the live mapping; atomics only.
        unsafe { &*self.ram.ptr.add(CTRL + off).cast() }
    }
    fn load(&self, off: usize) -> u64 {
        self.atomic(off).load(Acquire)
    }
    fn store(&mut self, off: usize, v: u64) {
        self.pristine = false;
        self.atomic(off).store(v, Release);
    }
    fn copy(&mut self, off: usize, b: &[u8]) {
        assert!(off + b.len() <= RAM);
        self.pristine = false;
        // SAFETY: bounds checked; the vCPU is stopped (same thread).
        unsafe { ptr::copy_nonoverlapping(b.as_ptr(), self.ram.ptr.add(off), b.len()) };
    }
    pub fn bytes(&self, off: usize, n: usize) -> Vec<u8> {
        assert!(off + n <= RAM);
        // SAFETY: bounds checked; stopped vCPU.
        unsafe { std::slice::from_raw_parts(self.ram.ptr.add(off), n).to_vec() }
    }
    fn ring_copy(&self, base: usize, cursor: usize, n: usize) -> Vec<u8> {
        (0..n)
            // SAFETY: fixed ring geometry within RAM; stopped vCPU.
            .map(|i| unsafe { self.ram.ptr.add(base + (cursor + i) % ring::RING_BYTES).read_volatile() })
            .collect()
    }
    /// shard `Slot::bind`: publish the run header, seed, clocks and source.
    pub fn bind(&mut self, generation: u64, source: &str, seed: [u8; 16]) {
        assert!(generation > self.generation && source.len() <= ring::SOURCE_LIMIT);
        assert!(self.pristine || self.class.is_none(), "bind requires a pristine slot");
        self.generation = generation;
        self.store(0, ring::JS_VERSION);
        self.store(ring::GENERATION, generation);
        self.store(ring::RING_LIMITS, ring::RING_BYTES as u64 | ((ring::MAX_RECORD as u64) << 32));
        self.store(ring::CALL_LIMITS, ring::MAX_CALLS | ((ring::RING_BYTES as u64) << 32));
        self.copy(CTRL + ring::SEED, &seed);
        let epoch = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos() as u64;
        self.store(ring::EPOCH_NS, epoch);
        self.store(ring::MONOTONIC_NS, monotonic_ns());
        self.store(ring::SOURCE_BYTES, source.len() as u64);
        self.copy(CTRL + ring::SOURCE_OFFSET, source.as_bytes());
    }
    /// Run to the next doorbell and decode its TX records (shard `try_exit` +
    /// `decode_exit`). Errors are strings: the spike has no RunError taxonomy.
    pub fn step(&mut self) -> Result<Step, String> {
        let now = monotonic_ns();
        self.store(ring::MONOTONIC_NS, now);
        let op = match self.vcpu.run().map_err(|e| e.to_string())? {
            Exit::Doorbell(op) => op,
            e => return Err(format!("unexpected exit {e:?}")),
        };
        self.doorbells += 1;
        self.decode(op)
    }
    fn decode(&mut self, op: u32) -> Result<Step, String> {
        let proto = |m: &str| Err(format!("guest_protocol: {m}"));
        if !(ring::SUBMIT..=ring::REPAIRED_READY).contains(&op) {
            return proto("unknown doorbell");
        }
        let prod = self.load(ring::TX_PRODUCER) as usize;
        if prod < self.tx || prod - self.tx > ring::RING_BYTES || prod % 8 != 0 {
            return proto("TX cursor");
        }
        let mut requests = Vec::new();
        let mut finish = None;
        while self.tx < prod {
            if prod - self.tx < ring::HEADER_BYTES {
                return proto("truncated TX header");
            }
            let h = self.ring_copy(REQUEST, self.tx, ring::HEADER_BYTES);
            let len = u32::from_le_bytes(h[..4].try_into().unwrap()) as usize;
            let kind = u16::from_le_bytes(h[4..6].try_into().unwrap());
            let flags = u16::from_le_bytes(h[6..8].try_into().unwrap());
            let generation = u64::from_le_bytes(h[8..16].try_into().unwrap());
            let id = u64::from_le_bytes(h[16..24].try_into().unwrap());
            let n = u32::from_le_bytes(h[24..28].try_into().unwrap()) as usize;
            let cap = u32::from_le_bytes(h[28..].try_into().unwrap());
            if !(ring::HEADER_BYTES..=ring::MAX_RECORD).contains(&len)
                || len % 8 != 0
                || len > prod - self.tx
                || n > ring::MAX_PAYLOAD
                || len != (ring::HEADER_BYTES + n + 7) & !7
                || flags != ring::JSON_UTF8
                || generation != self.generation
            {
                return proto("TX record header");
            }
            let mut payload = self.ring_copy(REQUEST, self.tx + ring::HEADER_BYTES, len - ring::HEADER_BYTES);
            if payload[n..].iter().any(|b| *b != 0) {
                return proto("nonzero TX padding");
            }
            payload.truncate(n);
            match kind {
                ring::CALL => {
                    if !(1..=ring::MAX_CALLS).contains(&id)
                        || id != u64::from(self.seen.count_ones()) + 1
                        || cap != 1
                        || !payload::forwarded(ring::CALL, &payload)
                    {
                        return proto("call identity/schema");
                    }
                    self.seen |= 1u32 << (id - 1);
                    requests.push(Request { id, bytes: payload });
                }
                ring::DONE => {
                    if id != 0 || cap != 0 || finish.is_some() || op != ring::FINISH || self.tx + len != prod {
                        return proto("completion identity/order");
                    }
                    if !payload::forwarded(ring::DONE, &payload) {
                        return proto("completion bytes");
                    }
                    finish = Some(payload.into_iter().map(char::from).collect());
                }
                ring::LOG => {
                    if id != 0 || cap != 0 {
                        return proto("log identity");
                    }
                    let _ = writeln!(io::stderr(), "guest: {}", String::from_utf8_lossy(&payload));
                }
                _ => return proto("unknown TX kind"),
            }
            self.tx += len;
        }
        self.store(ring::TX_CONSUMER, self.tx as u64);
        if op == ring::FINISH {
            if finish.is_none() {
                return Err("guest_fatal".into());
            }
            if self.seen != self.replied || !requests.is_empty() {
                return proto("completion with outstanding calls");
            }
        }
        Ok(Step { op, requests, finish })
    }
    /// shard `Slot::reply`: one RET record into RX.
    pub fn reply(&mut self, r: &Request, bytes: &[u8]) -> Result<(), String> {
        let cons = self.load(ring::RX_CONSUMER) as usize;
        if cons < self.rx_consumed || cons > self.rx || cons % 8 != 0 {
            return Err("RX consumer cursor".into());
        }
        self.rx_consumed = cons;
        let n = bytes.len();
        let len = (ring::HEADER_BYTES + n + 7) & !7;
        if self.rx - cons + len > ring::RING_BYTES {
            return Err("RX credit exhausted".into());
        }
        assert!((1..=ring::MAX_CALLS).contains(&r.id) && n <= ring::CALL_BYTES);
        let bit = 1u32 << (r.id - 1);
        assert!(self.replied & bit == 0 && self.seen & bit != 0);
        let mut b = vec![0u8; len];
        b[..4].copy_from_slice(&(len as u32).to_le_bytes());
        b[4..6].copy_from_slice(&ring::RET.to_le_bytes());
        b[6..8].copy_from_slice(&ring::JSON_UTF8.to_le_bytes());
        b[8..16].copy_from_slice(&self.generation.to_le_bytes());
        b[16..24].copy_from_slice(&r.id.to_le_bytes());
        b[24..28].copy_from_slice(&(n as u32).to_le_bytes());
        b[28..32].copy_from_slice(&1u32.to_le_bytes());
        b[32..32 + n].copy_from_slice(bytes);
        for (i, x) in b.iter().enumerate() {
            self.copy(REPLY + (self.rx + i) % ring::RING_BYTES, &[*x]);
        }
        self.rx += len;
        self.replied |= bit;
        let rx = self.rx as u64;
        self.store(ring::RX_PRODUCER, rx);
        let epoch = u64::from(self.replied.count_ones());
        self.store(ring::HOST_EPOCH, epoch);
        self.store(ring::REPLY_READY, 1);
        Ok(())
    }
    pub fn repaired(&self) -> bool {
        self.load(ring::REPAIRED_GENERATION) == self.generation
    }
    /// Writable extents (arena, transport) as RAM offsets.
    fn writable(&self) -> [(usize, usize); 2] {
        let c = self.class.expect("reset needs a snapshot slot");
        [(c.start(), c.end()), (CTRL, CTRL + ring::TRANSPORT_BYTES)]
    }
    /// Return every guest-writable byte and register to the snapshot. No
    /// pagemap on macOS: Copy rewrites all 1.39 MiB, Compare reads both views
    /// and rewrites only differing 16 KiB pages.
    ///
    /// Coherency: an EL1 guest with its MMU or caches off reads and writes DRAM
    /// directly, and HVF on this M4 Pro does not make that coherent with the
    /// host's cached view (measured: `hostile`). So, as the KVM copy path does
    /// with DC CIVAC, every reset cleans and invalidates both extents to the
    /// point of coherency: before reading (Compare), so the host sees the
    /// guest's uncached stores, and after writing, so DRAM holds the snapshot
    /// bytes whatever attributes the next guest uses.
    pub fn reset(&mut self, mode: ResetMode) -> io::Result<ResetReport> {
        let t = Instant::now();
        let mut report = ResetReport::default();
        if mode == ResetMode::Compare {
            self.clean();
        }
        for (start, end) in self.writable() {
            // SAFETY: both views cover RAM; extents are within it; the vCPU is
            // stopped on this thread and the reference is read-only.
            unsafe {
                let dst = self.ram.ptr.add(start);
                let src = self.reference.add(start);
                match mode {
                    ResetMode::Copy => {
                        ptr::copy_nonoverlapping(src, dst, end - start);
                        report.pages_copied += (end - start) / PAGE;
                    }
                    ResetMode::Compare => {
                        for off in (0..end - start).step_by(PAGE) {
                            let a = std::slice::from_raw_parts(dst.add(off), PAGE);
                            let b = std::slice::from_raw_parts(src.add(off), PAGE);
                            if a != b {
                                ptr::copy_nonoverlapping(src.add(off), dst.add(off), PAGE);
                                report.pages_copied += 1;
                            }
                        }
                    }
                }
            }
        }
        let c = Instant::now();
        self.clean();
        report.clean_ns = c.elapsed().as_nanos() as u64;
        report.mem_ns = t.elapsed().as_nanos() as u64;
        let r = Instant::now();
        let regs = self.regs.clone().expect("reset needs snapshot registers");
        self.vcpu.restore(&regs)?;
        report.regs_ns = r.elapsed().as_nanos() as u64;
        self.tx = 0;
        self.rx = 0;
        self.rx_consumed = 0;
        self.seen = 0;
        self.replied = 0;
        self.pristine = true;
        report.ns = t.elapsed().as_nanos() as u64;
        Ok(report)
    }
    /// DC CIVAC over both writable extents (libkern `sys_dcache_flush`).
    /// HVF_SPIKE_NO_CLEAN=1 skips it, to reproduce the hazard.
    pub fn clean(&self) {
        use std::sync::OnceLock;
        static SKIP: OnceLock<bool> = OnceLock::new();
        if *SKIP.get_or_init(|| std::env::var_os("HVF_SPIKE_NO_CLEAN").is_some()) {
            return;
        }
        for (start, end) in self.writable() {
            // SAFETY: a range of the live RAM mapping; cache maintenance only.
            unsafe { sys_dcache_flush(self.ram.ptr.add(start), end - start) };
        }
    }
    /// The verifying reset's check: both writable extents equal the snapshot
    /// file and the vCPU's registers equal the snapshot's.
    pub fn verify(&self) -> Result<(), String> {
        for (start, end) in self.writable() {
            // SAFETY: as in reset.
            let (a, b) = unsafe {
                (
                    std::slice::from_raw_parts(self.ram.ptr.add(start), end - start),
                    std::slice::from_raw_parts(self.reference.add(start), end - start),
                )
            };
            if let Some(i) = a.iter().zip(b).position(|(x, y)| x != y) {
                return Err(format!("RAM differs at {:#x}", start + i));
            }
        }
        let live = self.vcpu.save().map_err(|e| e.to_string())?;
        match live.diff(self.regs.as_ref().unwrap()) {
            Some(d) => Err(d),
            None => Ok(()),
        }
    }
    /// shard `Slot::redirect_entry`: EL1 fixture code on the arena's canary
    /// page, MMU off, x4/x5 = arena GPA bounds. Runs it to its first exit.
    pub fn attack(&mut self, code: &[u8]) -> io::Result<Exit> {
        let c = self.class.unwrap();
        let canary = c.canary();
        self.copy(canary, code);
        let gpa = |off: usize| ring::RAM_GPA + off as u64;
        self.vcpu.set_x(4, gpa(c.start()))?;
        self.vcpu.set_x(5, gpa(c.end()))?;
        self.vcpu.set_sys(0xc080, 0)?; // SCTLR_EL1: MMU and caches off
        self.vcpu.set_entry(gpa(canary), 0)?;
        self.vcpu.run()
    }
    /// The probe fixture's FNV hash over the snapshot's writable bytes (minus
    /// the code page), as an uncached guest read of a correct reset sees them.
    pub fn expected_probe(&self) -> u64 {
        let c = self.class.unwrap();
        let mut h: u64 = 0xcbf2_9ce4_8422_2325;
        for (start, end) in [(c.start(), c.end() - 4096), (CTRL, CTRL + ring::TRANSPORT_BYTES)] {
            for off in (start..end).step_by(8) {
                // SAFETY: within the read-only reference view.
                let w = unsafe { self.reference.add(off).cast::<u64>().read_unaligned() };
                h = (h ^ w).wrapping_mul(0x0100_0000_01b3);
            }
        }
        h
    }
    /// Count writable 16 KiB pages that differ from the snapshot (dirty set).
    pub fn dirty_pages(&self) -> usize {
        self.clean(); // see uncached guest stores
        let mut n = 0;
        for (start, end) in self.writable() {
            for off in (start..end).step_by(PAGE) {
                // SAFETY: as in reset.
                let (a, b) = unsafe {
                    (
                        std::slice::from_raw_parts(self.ram.ptr.add(off), PAGE),
                        std::slice::from_raw_parts(self.reference.add(off), PAGE),
                    )
                };
                n += usize::from(a != b);
            }
        }
        n
    }
}
