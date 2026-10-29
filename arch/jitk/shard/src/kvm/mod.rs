//! `hv` on Linux arm64 KVM: one VM fd and one vCPU per slot, many slots per
//! process from one `MAP_PRIVATE` snapshot. KVM-only: the kvm_run mapping and
//! MMIO completion, the lease signal (`immediate_exit`), the pagemap-driven
//! memory reset with DC CIVAC (reset.rs), MP state, and the native worker.
pub mod native;
pub use crate::clock::{clock_ns, monotonic_ns};
pub use crate::slot::{CTRL, RAM, REPLY, REQUEST, Request, RunError, Step as Exit};
use crate::snapshot::{Register, Registers};
use crate::{
    constants::{kvm::*, ring},
    hv::{self, Memory},
    lease,
};
use std::{
    fs::File,
    io,
    os::fd::{AsRawFd, FromRawFd},
    sync::{Arc, atomic::Ordering::Release},
};

mod platform;
mod reset;
pub use crate::slot::reset::{
    Discard, QUARANTINED, Quarantined, ResetPolicy, ResetReport, SAMPLE_FAILURES, SAMPLED,
};
#[cfg(test)]
pub(crate) use crate::slot::test_guest;
use libc::ioctl;
pub use platform::{Kvm, raise_fds};
use platform::{Mapping, OneReg, Region, call, check, try_call};

/// A prepared snapshot with a KVM register file.
pub type Snapshot = crate::snapshot::Snapshot<Registers>;
pub type Slot = crate::slot::Slot<KvmVm>;

pub struct KvmVm {
    pub(crate) fd: File,
    run_size: usize,
    /// Memslots handed out so far (native's archive uses ring::INPUT_SLOT).
    memslots: u32,
    /// Reused reset buffers: private page offsets and raw pagemap entries.
    dirty: Vec<usize>,
    entries: Vec<u8>,
}
impl KvmVm {
    pub fn new(kvm: &Kvm) -> Self {
        // SAFETY: successful KVM_CREATE_VM returns a new descriptor, checked
        // by call(), and transferred exactly once to this File.
        let fd = unsafe { File::from_raw_fd(call(&kvm.fd, KVM_CREATE_VM, 0)) };
        Self {
            fd,
            run_size: kvm.run_size,
            memslots: 0,
            dirty: Vec::new(),
            entries: Vec::new(),
        }
    }
}
impl hv::Vm for KvmVm {
    type Vcpu = KvmVcpu;
    unsafe fn map(
        &mut self,
        gpa: u64,
        host: *mut u8,
        len: usize,
        kind: hv::Region,
    ) -> io::Result<()> {
        let region = Region {
            slot: self.memslots,
            flags: if kind == hv::Region::Immutable {
                KVM_MEM_READONLY as u32
            } else {
                0
            },
            gpa,
            size: len as u64,
            addr: host as u64,
        };
        call(
            &self.fd,
            KVM_SET_USER_MEMORY_REGION as _,
            &region as *const _ as u64,
        );
        self.memslots += 1;
        Ok(())
    }
    fn vcpu(&mut self) -> io::Result<KvmVcpu> {
        // SAFETY: successful KVM_CREATE_VCPU returns a new descriptor, checked
        // by call(), and transferred exactly once to this File.
        let cpu = unsafe { File::from_raw_fd(call(&self.fd, KVM_CREATE_VCPU, 0)) };
        let mut init = [0u32; 8];
        call(&self.fd, KVM_ARM_PREFERRED_TARGET, init.as_mut_ptr() as u64);
        init[1] |= 1 << KVM_ARM_VCPU_PSCI_0_2;
        // The reset covers exactly this vCPU: PSCI 0.2 and nothing else (no SVE,
        // SME, PMU, PAC or MTE feature, and no in-kernel irqchip is created).
        // Any other feature would add guest-writable state outside its restore.
        assert_eq!(
            init[1..],
            [1 << KVM_ARM_VCPU_PSCI_0_2, 0, 0, 0, 0, 0, 0],
            "unsupported vCPU init features"
        );
        call(&cpu, KVM_ARM_VCPU_INIT, init.as_ptr() as u64);
        let run = Mapping::new(&cpu, self.run_size, libc::MAP_SHARED);
        Ok(KvmVcpu {
            run,
            cpu,
            pending_mmio: false,
            lease: None,
            drains: 0,
        })
    }
    fn restore_memory(&mut self, m: &Memory<'_, Registers>) -> io::Result<ResetReport> {
        self.restore(m)
    }
    fn discard_memory(&mut self, m: &Memory<'_, Registers>) -> io::Result<()> {
        self.discard(m)
    }
}

pub struct KvmVcpu {
    pub(crate) run: Mapping,
    pub(crate) cpu: File,
    pub(crate) pending_mmio: bool,
    pub(crate) lease: Option<lease::Lease>,
    pub drains: u64,
}
impl KvmVcpu {
    fn set_bytes(&self, id: u64, b: &[u8]) {
        self.try_set_bytes(id, b).expect("KVM_SET_ONE_REG");
    }
    fn try_set_bytes(&self, id: u64, b: &[u8]) -> io::Result<()> {
        let r = OneReg {
            id,
            addr: b.as_ptr() as u64,
        };
        try_call(&self.cpu, KVM_SET_ONE_REG, &r as *const _ as u64).map(|_| ())
    }
    fn reg_ids(&self) -> Vec<u64> {
        let mut list = vec![0u64; 2049];
        list[0] = 2048;
        call(&self.cpu, KVM_GET_REG_LIST, list.as_mut_ptr() as u64);
        list[1..=list[0] as usize].to_vec()
    }
    fn set(&self, id: u64, v: u64) {
        self.set_bytes(id, &v.to_le_bytes());
    }
}
impl hv::Vcpu for KvmVcpu {
    type State = Registers;
    fn save(&self) -> io::Result<Registers> {
        Ok(Registers(self.capture()))
    }
    fn load(&mut self, s: &Registers) -> io::Result<()> {
        // The reset restores the snapshot's register list. That must be all the
        // state this vCPU exposes: KVM's live list equals the snapshot's, and
        // snapshot loading already rejected any id class the reset does not cover.
        let mut live = self.reg_ids();
        let mut saved: Vec<u64> = s.iter().map(|r| r.id).collect();
        live.sort_unstable();
        saved.sort_unstable();
        if live != saved {
            return Err(io::Error::other(
                "vCPU register list differs from the snapshot's",
            ));
        }
        // Full restore, ID registers included: KVM accepts their values only
        // before the first KVM_RUN. Resets restore all but reset::invariant().
        for r in s.iter() {
            self.set_bytes(r.id, &r.data);
        }
        Ok(())
    }
    fn reset(&mut self, s: &Registers) -> io::Result<()> {
        self.restore_registers(s)
    }
    fn mismatches(&self, s: &Registers) -> Vec<u64> {
        self.register_mismatches(s)
    }
    fn run(&mut self) -> io::Result<hv::Exit> {
        // Clear before publishing the active pointer. Kicks received before
        // publication remain pending in TLS, including another slot's expiry.
        self.run.immediate_exit().store(0, Release);
        let (running, kicked) = lease::Running::enter(self.run.immediate_exit());
        if kicked {
            return Ok(hv::Exit::Interrupted);
        }
        {
            if let Some(l) = &self.lease
                && l.expired()
            {
                return Ok(hv::Exit::Expired {
                    deadline_ns: l.deadline(),
                });
            }
            // SAFETY: this owner has the live vCPU/run mappings; no guest RAM
            // reference spans KVM_RUN, which takes a zero scalar argument.
            let r = unsafe { ioctl(self.cpu.as_raw_fd(), KVM_RUN as _, 0u64) };
            if r < 0 && io::Error::last_os_error().raw_os_error() == Some(libc::EINTR) {
                return Ok(hv::Exit::Interrupted); // yield to the owner to service another slot's expiry
            }
            check(r, "KVM_RUN");
        }
        self.pending_mmio = false;
        let reason = self.run.u32(EXIT_REASON);
        if reason as u64 != KVM_EXIT_MMIO {
            return Ok(hv::Exit::Other("unexpected KVM exit"));
        }
        self.pending_mmio = true;
        if self.run.word(MMIO_ADDR) != ring::DOORBELL_GPA {
            return Ok(hv::Exit::Fault {
                gpa: self.run.word(MMIO_ADDR),
            });
        }
        // SAFETY: UAPI offsets identify aligned fields in the live kvm_run mapping;
        // KVM_RUN has returned and the owner is the sole thread accessing this slot.
        let len = self.run.u32(MMIO_LEN);
        let write = self.run.byte(MMIO_WRITE);
        if len != 4 || write != 1 {
            return Ok(hv::Exit::BadDoorbell);
        }
        let op = self.run.u32(MMIO_DATA);
        drop(running); // No KVM_RUN remains active while decoding guest records.
        Ok(hv::Exit::Doorbell(op))
    }
    fn unsettled(&self) -> bool {
        self.pending_mmio
    }
    /// Complete the pending MMIO with an immediate-exit KVM_RUN.
    fn settle(&mut self) -> io::Result<()> {
        // SAFETY: the live kvm_run mapping is owned here and no KVM_RUN is
        // active. immediate_exit is the UAPI byte; the pointer cannot escape.
        self.run.immediate_exit().store(1, Release);
        // SAFETY: this owner has the live vCPU/run mappings; no guest RAM
        // reference spans KVM_RUN, which takes a zero scalar argument.
        let r = unsafe { ioctl(self.cpu.as_raw_fd(), KVM_RUN as _, 0u64) };
        let error = io::Error::last_os_error();
        self.run.immediate_exit().store(0, Release);
        if r >= 0 {
            return Err(io::Error::other("MMIO drain did not return EINTR"));
        }
        if error.raw_os_error() != Some(libc::EINTR) {
            return Err(error);
        }
        self.pending_mmio = false;
        self.drains += 1;
        Ok(())
    }
    fn set_entry(&mut self, pc: u64) -> io::Result<()> {
        self.set(REG_PC, pc);
        self.set(REG_PSTATE, 0x3c5);
        Ok(())
    }
    fn redirect(&mut self, pc: u64, x4: u64, x5: u64) -> io::Result<()> {
        self.set(REG_X0 + 4 * 2, x4);
        self.set(REG_X0 + 5 * 2, x5);
        self.set(REG_SCTLR, 0);
        self.set(REG_PSTATE, 0x3c5);
        self.set(REG_PC, pc);
        Ok(())
    }
    #[cfg(test)]
    fn test_reject(&mut self, generation: u64) -> io::Result<()> {
        if generation == test_guest::FAIL_RESET_GENERATION {
            return self.reject();
        }
        Ok(())
    }
}
impl Drop for KvmVcpu {
    fn drop(&mut self) {
        if self.pending_mmio {
            let _ = hv::Vcpu::settle(self);
        }
    }
}

/// The KVM constructors and accessors the owner and harness use.
impl Slot {
    /// Create an unpartitioned boot VM for trusted offline snapshot preparation.
    pub fn boot(kvm: &Kvm, memory: &File) -> Self {
        Self::boot_on(KvmVm::new(kvm), memory).unwrap_or_else(|e| panic!("{e}"))
    }
    pub fn new(kvm: &Kvm, snapshot: Arc<Snapshot>) -> Self {
        Self::with_policy(kvm, snapshot, ResetPolicy::default())
    }
    pub fn with_policy(kvm: &Kvm, snapshot: Arc<Snapshot>, policy: ResetPolicy) -> Self {
        Self::create(KvmVm::new(kvm), snapshot, policy).unwrap_or_else(|e| panic!("{e}"))
    }
    /// Capture this stopped vCPU's complete KVM register set.
    pub fn capture(&self) -> Vec<Register> {
        self.vcpu.capture()
    }
    /// Arm this slot's in-process deadline (checked before every KVM_RUN).
    pub(crate) fn set_lease(&mut self, lease: lease::Lease) {
        self.vcpu.lease = Some(lease);
    }
}

#[cfg(test)]
mod tests {
    use super::{
        Kvm, KvmVcpu, Mapping, RAM, ResetPolicy, RunError, Slot, Snapshot, check, test_guest,
    };
    use crate::slot::CTRL;
    use crate::{arena, constants::ring};
    use std::{fs::File, sync::Arc};
    fn test_snapshots() -> Vec<Arc<Snapshot>> {
        let bases = std::env::var("JITK_SHARD_TEST_SNAPSHOTS").unwrap();
        let snapshots: Vec<_> = bases
            .split(':')
            .map(|b| Snapshot::load(b).unwrap())
            .collect();
        for class in arena::Class::ALL {
            assert!(snapshots.iter().any(|s| s.class == class));
        }
        snapshots
    }
    fn present(address: usize) -> bool {
        use std::os::unix::fs::FileExt;
        let mut entry = [0; 8];
        File::open("/proc/self/pagemap")
            .unwrap()
            .read_exact_at(&mut entry, (address / 4096 * 8) as u64)
            .unwrap();
        u64::from_le_bytes(entry) & (1 << 63) != 0
    }
    /// Both reset paths, with the full pristine and register comparison after
    /// every reset and trim.
    fn policies() -> [(&'static str, ResetPolicy); 2] {
        let verify = |copy_limit| ResetPolicy {
            copy_limit,
            idle_trim: None,
            verify: true,
            sample_every: 0,
        };
        [("copy", verify(None)), ("discard", verify(Some(0)))]
    }
    fn writable_pages(snapshot: &Snapshot) -> u32 {
        ((snapshot.class.bytes() + arena::RING_BYTES) / 4096) as u32
    }
    /// The probe's hash of the snapshot file itself (read by descriptor, not
    /// through the copy path's view): arena without the code page, transport.
    /// try_exit stores the clock word before each KVM_RUN; it is taken from
    /// `monotonic`, every other word from the file.
    fn snapshot_hash(snapshot: &Snapshot, monotonic: u64) -> u64 {
        use std::os::unix::fs::FileExt;
        let class = snapshot.class;
        let mut h: u64 = 0xcbf2_9ce4_8422_2325;
        for (start, end) in [
            (class.start(), class.canary()),
            (CTRL, CTRL + arena::RING_BYTES),
        ] {
            let mut b = vec![0; end - start];
            snapshot.memory.read_exact_at(&mut b, start as u64).unwrap();
            for (i, w) in b.as_chunks::<8>().0.iter().enumerate() {
                let w = if start + i * 8 == CTRL + ring::MONOTONIC_NS {
                    monotonic
                } else {
                    u64::from_le_bytes(*w)
                };
                h = (h ^ w).wrapping_mul(0x100_0000_01b3);
            }
        }
        h
    }
    fn reg(s: &Slot, id: u64) -> u64 {
        let mut v = 0u64;
        let r = super::OneReg {
            id,
            addr: &mut v as *mut u64 as u64,
        };
        super::call(
            &s.vcpu.cpu,
            crate::constants::kvm::KVM_GET_ONE_REG,
            &r as *const _ as u64,
        );
        v
    }
    /// Run an EL1 fixture that ends in a read-only store.
    fn attack(s: &mut Slot, code: &[u8]) {
        s.redirect_entry(code);
        assert!(
            matches!(s.exit(), Err(RunError::MemoryBound { address }) if address == ring::RAM_GPA)
        );
    }
    /// Whether what the guest reads back, hashed by the guest itself, is the
    /// snapshot (plus the clock word try_exit stored for this run).
    fn probe(s: &mut Slot) -> bool {
        attack(s, test_guest::probe());
        let seen = reg(s, crate::constants::kvm::REG_X0);
        seen == snapshot_hash(s.snapshot.as_ref().unwrap(), s.load(ring::MONOTONIC_NS))
    }
    /// The slot's private (anonymous) KiB per the kernel's own VMA accounting.
    fn anonymous_kib(s: &Slot) -> u64 {
        let (lo, hi) = (s.ram.ptr as u64, s.ram.ptr as u64 + RAM as u64);
        let smaps = std::fs::read_to_string("/proc/self/smaps").unwrap();
        let mut inside = false;
        let mut kib = 0;
        for line in smaps.lines() {
            if let Some((range, _)) = line.split_once(' ')
                && let Some((a, b)) = range.split_once('-')
                && let (Ok(a), Ok(b)) = (u64::from_str_radix(a, 16), u64::from_str_radix(b, 16))
            {
                inside = a >= lo && b <= hi;
            } else if inside && let Some(v) = line.strip_prefix("Anonymous:") {
                kib += v
                    .trim()
                    .trim_end_matches(" kB")
                    .trim()
                    .parse::<u64>()
                    .unwrap();
            }
        }
        kib
    }
    #[test]
    #[ignore = "requires KVM and both classes in JITK_SHARD_TEST_SNAPSHOTS; run under bench.lock"]
    fn reset_cleans_every_writable_page_and_preserves_immutable_translations() {
        let kvm = Kvm::new();
        for snapshot in test_snapshots() {
            for (name, policy) in policies() {
                let mut s = Slot::with_policy(&kvm, snapshot.clone(), policy);
                let mut pages = 0u32;
                for (start, end, writable) in snapshot.class.regions(RAM, CTRL) {
                    if writable {
                        for off in (start..end).step_by(4096) {
                            s.copy(off, &[0xcc; 4096]);
                            pages += 1;
                        }
                    }
                }
                assert_eq!(
                    pages as usize * 4096,
                    snapshot.class.bytes() + arena::RING_BYTES
                );
                let saved = s.bytes(0, 4096);
                assert!(present(s.ram.ptr as usize));
                let r = s.reset().unwrap();
                if name == "copy" {
                    assert_eq!((r.discard, r.private), (None, pages), "{name}");
                } else {
                    assert_eq!(r.discard, Some(super::Discard::Limit), "{name}");
                }
                assert!(
                    present(s.ram.ptr as usize),
                    "immutable translation was discarded"
                );
                assert_eq!(s.bytes(0, 4096), saved);
                assert!(
                    s.pristine(),
                    "{name}: every arena/ring page must be pristine"
                );
                // Host writes reach the guest through fresh CoW copies; the guest
                // must read the snapshot back, not a stale stage-2 page.
                assert!(probe(&mut s), "{name}: guest view");
                s.shutdown().unwrap();
            }
        }
    }
    #[test]
    #[ignore = "requires KVM and both classes in JITK_SHARD_TEST_SNAPSHOTS; run under bench.lock"]
    fn hostile_guest_writes_and_registers_never_reach_the_next_run() {
        let kvm = Kvm::new();
        for snapshot in test_snapshots() {
            for (name, policy) in policies() {
                let mut s = Slot::with_policy(&kvm, snapshot.clone(), policy);
                assert!(probe(&mut s), "{name}: fresh slot");
                s.reset().unwrap();
                for round in 0..3 {
                    // Every writable byte and every reachable register class.
                    attack(&mut s, test_guest::fill());
                    assert!(!s.is_pristine());
                    let r = s.reset().unwrap(); // verify: RAM + every register + MP state
                    if name == "copy" {
                        // The fill dirties every writable page but its code page;
                        // redirect_entry dirtied that one.
                        assert_eq!((r.discard, r.private), (None, writable_pages(&snapshot)));
                    } else {
                        assert_eq!(r.discard, Some(super::Discard::Limit));
                    }
                    assert!(s.pristine(), "{name} round {round}: RAM");
                    let regs = s.register_mismatches();
                    assert!(regs.is_empty(), "{name} round {round}: {regs:#x?}");
                    assert!(probe(&mut s), "{name} round {round}: guest view");
                    s.reset().unwrap();
                }
                // PSCI SYSTEM_OFF leaves the vCPU STOPPED; the reset makes it
                // RUNNABLE, or the probe's KVM_RUN would sleep.
                s.redirect_entry(test_guest::system_off());
                assert!(matches!(s.exit(), Err(RunError::GuestProtocol(_))));
                s.reset().unwrap();
                assert!(probe(&mut s), "{name}: after SYSTEM_OFF");
                s.shutdown().unwrap();
            }
        }
    }
    #[test]
    #[ignore = "requires KVM and JITK_SHARD_TEST_SNAPSHOT; run under bench.lock"]
    fn copy_limit_boundary_is_exact() {
        let kvm = Kvm::new();
        let snapshot = Snapshot::load(&std::env::var("JITK_SHARD_TEST_SNAPSHOT").unwrap()).unwrap();
        let n = writable_pages(&snapshot) as usize; // the fill's private pages
        for (limit, copies) in [(Some(n - 1), false), (Some(n), true), (None, true)] {
            let policy = ResetPolicy {
                copy_limit: limit,
                idle_trim: None,
                verify: true,
                sample_every: 0,
            };
            let mut s = Slot::with_policy(&kvm, snapshot.clone(), policy);
            attack(&mut s, test_guest::fill());
            let r = s.reset().unwrap();
            if copies {
                assert_eq!(
                    (r.discard, r.private as usize),
                    (None, n),
                    "limit {limit:?}"
                );
                assert!(s.is_resident());
            } else {
                assert_eq!(r.discard, Some(super::Discard::Limit), "limit {limit:?}");
                assert_eq!(Some(r.private as usize), limit, "counted up to the limit");
                assert!(!s.is_resident());
            }
            assert!(s.pristine(), "limit {limit:?}");
            assert!(probe(&mut s), "limit {limit:?}");
            s.shutdown().unwrap();
        }
    }
    #[test]
    #[ignore = "requires KVM and JITK_SHARD_TEST_SNAPSHOT; run under bench.lock"]
    fn sampled_reset_checks_pass_after_hostile_runs() {
        use crate::slot::{SAMPLE_FAILURES, SAMPLED};
        use std::sync::atomic::Ordering::Relaxed;
        let kvm = Kvm::new();
        let snapshot = Snapshot::load(&std::env::var("JITK_SHARD_TEST_SNAPSHOT").unwrap()).unwrap();
        let policy = ResetPolicy {
            copy_limit: None,
            idle_trim: None,
            verify: false,
            sample_every: 1,
        };
        let mut s = Slot::with_policy(&kvm, snapshot.clone(), policy);
        let (sampled, failures) = (SAMPLED.load(Relaxed), SAMPLE_FAILURES.load(Relaxed));
        for _ in 0..3 {
            attack(&mut s, test_guest::fill());
            s.reset().unwrap(); // the copy path, then the sampled check
            assert!(probe(&mut s));
            s.reset().unwrap();
        }
        // Other tests in this process may sample too, but none fails.
        assert!(SAMPLED.load(Relaxed) >= sampled + 6);
        assert_eq!(SAMPLE_FAILURES.load(Relaxed), failures);
        // Cost of one sampled check on a clean slot.
        let t = std::time::Instant::now();
        for _ in 0..20 {
            assert_eq!(s.content_mismatch(), None);
        }
        println!("SAMPLED_CHECK_NS {}", t.elapsed().as_nanos() / 20);
        s.shutdown().unwrap();
    }
    #[test]
    #[ignore = "requires KVM and JITK_SHARD_TEST_SNAPSHOT; run under bench.lock"]
    fn trim_releases_private_pages_and_stays_pristine() {
        let kvm = Kvm::new();
        let snapshot = Snapshot::load(&std::env::var("JITK_SHARD_TEST_SNAPSHOT").unwrap()).unwrap();
        let policy = ResetPolicy {
            copy_limit: None,
            idle_trim: Some(std::time::Duration::ZERO),
            verify: true,
            sample_every: 0,
        };
        let mut s = Slot::with_policy(&kvm, snapshot.clone(), policy);
        assert_eq!(anonymous_kib(&s), 0, "fresh slot");
        assert_eq!(s.trim_due(), None, "nothing to trim");
        attack(&mut s, test_guest::fill());
        s.reset().unwrap();
        let held = anonymous_kib(&s);
        assert_eq!(
            held,
            u64::from(writable_pages(&snapshot)) * 4,
            "copy path keeps its pages"
        );
        assert!(s.trim_due().is_some());
        s.trim(); // verify: RAM + registers
        assert_eq!(anonymous_kib(&s), 0, "trim released {held} KiB");
        assert!(s.is_pristine() && !s.is_resident() && s.trim_due().is_none());
        assert!(probe(&mut s));
        s.shutdown().unwrap();
    }
    #[test]
    #[ignore = "subprocess target for immutable_host_writes_fault"]
    fn immutable_host_write_child() {
        if std::env::var_os("JITK_IMMUTABLE_WRITE_CHILD").is_none() {
            return;
        }
        // SAFETY: Linux RLIMIT_CORE accepts two u64 limits; zero prevents crash artifacts.
        check(
            unsafe {
                libc::setrlimit(
                    libc::RLIMIT_CORE,
                    &libc::rlimit {
                        rlim_cur: 0,
                        rlim_max: 0,
                    },
                )
            },
            "RLIMIT_CORE",
        );
        let snapshot = Snapshot::load(&std::env::var("JITK_SHARD_TEST_SNAPSHOT").unwrap()).unwrap();
        let s = Slot::new(&Kvm::new(), snapshot);
        s.copy(0, &[0xff]); // The host's immutable extent must fault, independent of KVM.
        panic!("immutable RAM accepted a write");
    }
    #[test]
    #[ignore = "requires KVM and both classes in JITK_SHARD_TEST_SNAPSHOTS; run under bench.lock"]
    fn immutable_host_writes_fault() {
        use std::os::unix::process::ExitStatusExt;
        test_snapshots();
        for base in std::env::var("JITK_SHARD_TEST_SNAPSHOTS")
            .unwrap()
            .split(':')
        {
            let status = std::process::Command::new(std::env::current_exe().unwrap())
                .args([
                    "--exact",
                    "kvm::tests::immutable_host_write_child",
                    "--ignored",
                ])
                .env("JITK_IMMUTABLE_WRITE_CHILD", "1")
                .env("JITK_SHARD_TEST_SNAPSHOT", base)
                .output()
                .unwrap()
                .status;
            assert_eq!(status.signal(), Some(11), "immutable write must SIGSEGV");
        }
    }
    #[test]
    fn drop_does_not_panic_when_mmio_drain_fails() {
        let f = File::open("/dev/zero").unwrap();
        let mut v = KvmVcpu {
            run: Mapping::new(&f, 4096, libc::MAP_PRIVATE),
            cpu: File::open("/dev/null").unwrap(),
            pending_mmio: true,
            lease: None,
            drains: 0,
        };
        assert!(crate::hv::Vcpu::settle(&mut v).is_err());
        drop(v); // /dev/null rejects KVM_RUN: cleanup must not assert.
    }
}
