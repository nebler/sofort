//! The HVF backend. The ignored tests need macOS arm64, a binary signed with
//! the hypervisor entitlement (hvf-run.sh) and prepared HVF snapshots in
//! JITK_SHARD_TEST_SNAPSHOT(S) (`make -C arch/jitk/shard test-hvf` does all
//! three). HVF allows one VM per process, so they take `VM` in turn.
use super::*;
use crate::arena;
use crate::constants::ring::CONTROL as CTRL;
use crate::slot::{ResetPolicy, RunError, Slot, test_guest};
use crate::snapshot::Snapshot;
use std::sync::{Arc, Mutex, MutexGuard};

static VM: Mutex<()> = Mutex::new(());
fn vm_lock() -> MutexGuard<'static, ()> {
    VM.lock().unwrap_or_else(|e| e.into_inner())
}
fn snapshots() -> Vec<Arc<Snapshot<State>>> {
    let bases = std::env::var("JITK_SHARD_TEST_SNAPSHOTS")
        .expect("JITK_SHARD_TEST_SNAPSHOTS (make test-hvf)");
    let s: Vec<_> = bases
        .split(':')
        .map(|b| Snapshot::load(b).unwrap())
        .collect();
    for class in arena::Class::ALL {
        assert!(
            s.iter().any(|s| s.class == class),
            "no {} snapshot",
            class.name()
        );
    }
    s
}
fn snapshot() -> Arc<Snapshot<State>> {
    Snapshot::load(
        &std::env::var("JITK_SHARD_TEST_SNAPSHOT")
            .expect("JITK_SHARD_TEST_SNAPSHOT (make test-hvf)"),
    )
    .unwrap()
}
/// Every reset is verified: both writable extents byte for byte against the
/// file and every register against the snapshot.
fn verified() -> ResetPolicy {
    ResetPolicy {
        verify: true,
        idle_trim: None,
        sample_every: 0,
        ..ResetPolicy::default()
    }
}
fn slot(snapshot: Arc<Snapshot<State>>, mode: MemoryReset) -> Slot<HvfVm> {
    let mut vm = HvfVm::create().unwrap();
    vm.reset = mode;
    Slot::create(vm, snapshot, verified()).unwrap()
}

/// Corpus programs (shard/fixtures and the spike's leak checks) and their
/// DONE payloads; every CALL is answered with its own arguments (echo).
fn fixture(name: &str) -> (&'static str, &'static str) {
    const OOM: &str = "{\"err\":{\"name\":\"InternalError\",\"message\":\"out of memory\"}}";
    match name {
        "return2" => (include_str!("../../fixtures/return2.js"), "{\"ok\":2}"),
        "one_tool" => (include_str!("../../fixtures/one_tool.js"), "{\"ok\":42}"),
        "promise10" => (include_str!("../../fixtures/promise10.js"), "{\"ok\":45}"),
        // Out of memory on glue-2m, as the KVM shard's driver also expects.
        "json64k" => (include_str!("../../fixtures/json64k.js"), OOM),
        // Dirties much of the arena and leaves a tenant global behind.
        "stress" => (
            "globalThis.__tenantCanary=1;let a=[];for(let i=0;i<2000;i++)a.push({i,s:'x'+i});return a.length;",
            "{\"ok\":2000}",
        ),
        // Runs the arena out of memory with the global set.
        // The KVM harness's arena exhaustion (typed arrays).
        "bomb" => (include_str!("../../fixtures/bomb.js"), OOM),
        "oom" => (
            "globalThis.__tenantCanary=1;let a=[];for(let i=0;i<1e6;i++)a.push({i,s:'x'+i});return a.length;",
            OOM,
        ),
        // Reads what a previous tenant might have left.
        "canary" => (
            "return globalThis.__tenantCanary===undefined?0:1;",
            "{\"ok\":0}",
        ),
        _ => panic!("unknown fixture {name}"),
    }
}
/// bind and drive to FINISH, as the KVM driver does; the run's wall ns.
fn run(s: &mut Slot<HvfVm>, generation: u64, name: &str) -> u64 {
    let (source, expected) = fixture(name);
    let t = std::time::Instant::now();
    s.admit().unwrap();
    s.bind(
        generation,
        source,
        &mut std::fs::File::open("/dev/urandom").unwrap(),
    );
    loop {
        let step = s.exit().unwrap_or_else(|e| panic!("{name}: {e}"));
        if step.op == ring::FINISH {
            assert!(s.repaired(), "{name}: missing repair acknowledgement");
            assert_eq!(step.finish.as_deref(), Some(expected), "{name}");
            break;
        }
        assert!(
            matches!(step.op, ring::SUBMIT | ring::WAIT | ring::REPAIRED_READY),
            "{name}: doorbell {}",
            step.op
        );
        for r in step.requests.iter().rev() {
            s.reply(r).unwrap();
        }
    }
    t.elapsed().as_nanos() as u64
}
fn median(mut v: Vec<u64>) -> u64 {
    v.sort_unstable();
    v[v.len() / 2]
}

#[test]
fn probe_check_fails_closed() {
    let good = || Probe {
        core: (0..CORE as u32).collect(),
        simd: (0..SIMD as u32).collect(),
        sys: SYS_REGISTERS
            .iter()
            .map(|&(r, a)| (r, a != Fixed))
            .collect(),
        sme: true,
    };
    assert_eq!(good().check(), Ok(()));
    let mut p = good();
    p.sys.push((0xc7ff, true)); // a register this macOS newly exposes
    assert!(
        p.check()
            .unwrap_err()
            .contains("not in the recorded list: [(c7ff, true)]")
    );
    let mut p = good();
    p.sys.retain(|r| r.0 != 0xc080); // SCTLR_EL1 gone
    assert!(p.check().unwrap_err().contains("does not expose so"));
    let mut p = good();
    p.sys[0].1 = false; // no longer writable: the reset could not restore it
    assert!(p.check().is_err());
    let mut p = good();
    p.core.push(35);
    assert!(p.check().unwrap_err().contains("core registers"));
    let mut p = good();
    p.simd.pop();
    assert!(p.check().unwrap_err().contains("SIMD registers"));
    assert!(good().check().is_ok());
}
#[test]
fn register_files_are_hypervisor_specific() {
    let s = State {
        core: [7; CORE],
        simd: [[9; 16]; SIMD],
        sys: restored().map(|r| (r, u64::from(r))).collect(),
        sme: (false, false),
    };
    let b = s.encode();
    assert_eq!(State::decode(&b).unwrap(), s);
    for n in 0..b.len() {
        assert!(State::decode(&b[..n]).is_err(), "prefix {n}");
    }
    let mut streaming = b.clone();
    *streaming.last_mut().unwrap() = 1;
    assert!(
        State::decode(&streaming)
            .unwrap_err()
            .to_string()
            .contains("ZA")
    );
    let mut kvm = b.clone();
    kvm[..8].copy_from_slice(b"JTKREGS2");
    assert!(State::decode(&kvm).is_err());
    assert!(<crate::snapshot::Registers as ArchState>::decode(&b).is_err());
}

#[test]
#[ignore = "requires Hypervisor.framework (make test-hvf)"]
fn live_register_set_is_the_recorded_one() {
    let _vm = vm_lock();
    let mut vm = HvfVm::create().unwrap();
    let t = std::time::Instant::now();
    let v = hv::Vm::vcpu(&mut vm).expect("this macOS exposes the recorded register set");
    println!("HVF_PROBE_NS {}", t.elapsed().as_nanos());
    drop(v);
    // A snapshot whose register file lacks one restored register is refused.
    let snapshot = snapshot();
    let mut regs = snapshot.regs.clone();
    regs.sys.pop();
    let mut v = hv::Vm::vcpu(&mut vm).unwrap();
    let e = hv::Vcpu::load(&mut v, &regs).unwrap_err();
    assert!(e.to_string().contains("prepare the snapshot again"), "{e}");
}
#[test]
#[ignore = "requires Hypervisor.framework and HVF snapshots (make test-hvf)"]
fn corpus_runs_and_resets_verified() {
    let _vm = vm_lock();
    for snapshot in snapshots() {
        for mode in [MemoryReset::Remap, MemoryReset::Copy] {
            let mut s = slot(snapshot.clone(), mode);
            let (mut runs, mut resets) = (vec![], vec![]);
            for i in 0..40u64 {
                if i > 0 {
                    resets.push(s.reset().unwrap().ns); // verify: RAM + registers
                }
                runs.push(run(
                    &mut s,
                    i + 2,
                    if i % 2 == 0 { "return2" } else { "one_tool" },
                ));
            }
            println!(
                "HVF_CORPUS {} {mode:?} run_wall_ns_p50={} reset_ns_p50={}",
                snapshot.class.name(),
                median(runs),
                median(resets)
            );
        }
    }
}
/// The spike's leak check: tenants that leave globals, dirty the arena or run
/// out of memory, each followed by a verified reset and a canary that must
/// see nothing.
#[test]
#[ignore = "requires Hypervisor.framework and HVF snapshots (make test-hvf)"]
fn mix_leaks_nothing_across_resets() {
    let _vm = vm_lock();
    let order = [
        "return2",
        "stress",
        "canary",
        "one_tool",
        "bomb",
        "canary",
        "promise10",
        "json64k",
        "canary",
    ];
    let mut s = slot(snapshot(), MemoryReset::Remap);
    for i in 0..order.len() as u64 * 4 {
        if i > 0 {
            s.reset().unwrap();
        }
        run(&mut s, i + 2, order[i as usize % order.len()]);
    }
    // Idle trim on HVF replaces the mappings too; the slot stays pristine.
    s.reset().unwrap();
    s.trim();
    assert!(s.is_pristine() && !s.is_resident() && s.content_mismatch().is_none());
    run(&mut s, 1000, "canary");
}
/// The deadline path: a spinning guest is stopped by a kick from another
/// thread; the slot then resets (verified) and serves again.
#[test]
#[ignore = "requires Hypervisor.framework and HVF snapshots (make test-hvf)"]
fn kick_stops_a_spinning_guest() {
    let _vm = vm_lock();
    let mut s = slot(snapshot(), MemoryReset::Remap);
    let mut latency = vec![];
    for i in 0..10u64 {
        let kicker = s.vcpu().kicker();
        let sent = Arc::new(Mutex::new(None));
        let at = sent.clone();
        let t = std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(10));
            *at.lock().unwrap() = Some(std::time::Instant::now());
            kicker.kick().unwrap();
        });
        s.admit().unwrap();
        s.bind(
            2 * i + 2,
            "for(;;){}",
            &mut std::fs::File::open("/dev/urandom").unwrap(),
        );
        let interrupted = loop {
            match s.try_exit() {
                Ok(None) => break true,
                Ok(Some(step)) if step.op != ring::FINISH && step.requests.is_empty() => continue,
                _ => break false,
            }
        };
        let stopped = std::time::Instant::now();
        t.join().unwrap();
        assert!(interrupted, "kick {i}");
        latency.push((stopped - sent.lock().unwrap().unwrap()).as_nanos() as u64);
        s.reset().unwrap();
        run(&mut s, 2 * i + 3, "return2");
        s.reset().unwrap();
    }
    println!("HVF_KICK_TO_EXIT_NS_P50 {}", median(latency));
}

/// The probe fixture's hash of the snapshot file (read by descriptor), with
/// the clock word try_exit stores before the run (cf. the KVM test).
fn snapshot_hash(snapshot: &Snapshot<State>, monotonic: u64) -> u64 {
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
/// Run an EL1 fixture (MMU and caches off) that ends in a read-only store.
fn attack(s: &mut Slot<HvfVm>, code: &[u8]) {
    s.redirect_entry(code);
    let e = s.exit();
    assert!(
        matches!(e, Err(RunError::MemoryBound { address }) if address == ring::RAM_GPA),
        "{:?}",
        e.err()
    );
}
/// Whether the guest, reading with its caches off and hashing what it reads,
/// sees the snapshot.
fn probe(s: &mut Slot<HvfVm>) -> bool {
    attack(s, test_guest::probe());
    s.vcpu.reg(0) == snapshot_hash(s.snapshot(), s.load(ring::MONOTONIC_NS))
}
/// R10 risk 1: a guest that turns its MMU and caches off and stores to every
/// writable byte (and every EL1 register it can reach) must leave nothing a
/// cache-off reader of the next tenant can see. Rounds of fill, verified
/// reset, uncached probe; then PSCI CPU_OFF / SYSTEM_OFF and a real run.
fn hostile(snapshot: Arc<Snapshot<State>>, mode: MemoryReset, rounds: usize) -> usize {
    let mut s = slot(snapshot, mode);
    let mut stale = 0;
    assert!(probe(&mut s), "{mode:?}: fresh slot");
    s.reset().unwrap();
    for _ in 0..rounds {
        attack(&mut s, test_guest::fill());
        assert!(!s.is_pristine());
        s.reset().unwrap(); // verify: RAM + every register
        assert!(s.register_mismatches().is_empty());
        stale += usize::from(!probe(&mut s));
        s.reset().unwrap();
    }
    for code in [test_guest::cpu_off(), test_guest::system_off()] {
        s.redirect_entry(code);
        assert!(matches!(
            s.exit(),
            Err(RunError::GuestProtocol("vCPU powered off"))
        ));
        s.reset().unwrap();
    }
    stale += usize::from(!probe(&mut s));
    s.reset().unwrap();
    run(&mut s, 0x100, "one_tool");
    stale
}
#[test]
#[ignore = "requires Hypervisor.framework and HVF snapshots (make test-hvf)"]
fn hostile_cache_off_guest_never_reaches_the_next_run() {
    let _vm = vm_lock();
    for snapshot in snapshots() {
        for mode in [MemoryReset::Remap, MemoryReset::Copy] {
            assert_eq!(
                hostile(snapshot.clone(), mode, 5),
                0,
                "{} {mode:?}: an uncached probe saw the last tenant",
                snapshot.class.name()
            );
        }
    }
}
/// No instruction is ever fetched from tenant-writable memory (so no stale
/// instruction cache line can carry a tenant's code to the next one): a jump
/// from the fixture page into the arena or the transport is an instruction
/// abort, and after a reset the fixture page itself is not executable either.
#[test]
#[ignore = "requires Hypervisor.framework and HVF snapshots (make test-hvf)"]
fn writable_extents_never_execute() {
    let _vm = vm_lock();
    for (snapshot, mode) in snapshots()
        .into_iter()
        .flat_map(|s| [(s.clone(), MemoryReset::Copy), (s, MemoryReset::Remap)])
    {
        let mut s = slot(snapshot, mode);
        let canary = ring::RAM_GPA + s.snapshot().class.canary() as u64;
        let control = ring::RAM_GPA + CTRL as u64;
        assert_eq!(control & 0xffff, 0, "control page GPA fits one movz");
        // br x4 (arena start); movz x5, #control, lsl #16; br x5 (control page);
        // movz x6, canary; br x6 (the fixture page, after a reset).
        let (lo, hi) = (canary & 0xffff, canary >> 16);
        for code in [
            vec![0xd61f_0080u32],
            vec![0xd2a0_0005 | ((control >> 16) as u32) << 5, 0xd61f_00a0],
            vec![
                0xd2a0_0006 | (hi as u32) << 5,
                0xf280_0006 | (lo as u32) << 5,
                0xd61f_00c0,
            ],
        ] {
            s.reset().unwrap();
            let bytes: Vec<u8> = code.iter().flat_map(|w| w.to_le_bytes()).collect();
            s.redirect_entry(&bytes);
            if code.len() == 3 {
                // The fixture page's own permission ends with the reset.
                s.reset().unwrap();
                s.copy(s.snapshot().class.canary(), &bytes);
                hv::Vcpu::redirect(&mut s.vcpu, canary, 0, 0).unwrap();
            }
            let e = s.exit().err().map(|e| e.to_string());
            let class = s.snapshot().class.name();
            assert_eq!(
                e.as_deref(),
                Some("guest_protocol: unexpected guest exception"),
                "{class} {mode:?} {code:x?}"
            );
            assert_eq!(
                s.vcpu.syndrome >> 26,
                0x20,
                "{class} {mode:?}: instruction abort from EL1"
            );
        }
    }
}

#[test]
#[ignore = "subprocess target for immutable_host_writes_fault"]
fn immutable_host_write_child() {
    if std::env::var_os("JITK_IMMUTABLE_WRITE_CHILD").is_none() {
        return;
    }
    let s = slot(snapshot(), MemoryReset::Remap);
    s.copy(0, &[0xff]); // the host's immutable extent must fault
    panic!("immutable RAM accepted a write");
}
#[test]
#[ignore = "requires Hypervisor.framework and HVF snapshots (make test-hvf)"]
fn immutable_host_writes_fault() {
    use std::os::unix::process::ExitStatusExt;
    snapshots(); // both classes are present
    for base in std::env::var("JITK_SHARD_TEST_SNAPSHOTS")
        .unwrap()
        .split(':')
    {
        let status = std::process::Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "hvf::tests::immutable_host_write_child",
                "--ignored",
            ])
            .env("JITK_IMMUTABLE_WRITE_CHILD", "1")
            .env("JITK_SHARD_TEST_SNAPSHOT", base)
            .output()
            .unwrap()
            .status;
        assert!(
            matches!(status.signal(), Some(10 | 11)),
            "{base}: immutable write must fault: {status:?}"
        );
    }
}

/// An EL1 fixture (MMU off) that installs its own vector table, then MSRs or
/// MRSs system register `id`, then stores to read-only RAM at RAM_GPA. Every
/// vector stores to RAM_GPA + 8 instead, so the exit says what happened.
fn access_fixture(id: u16, write: bool) -> Vec<u8> {
    let op = |base: u32| base | (u32::from(id >> 14) - 2) << 19 | u32::from(id & 0x3fff) << 5 | 9;
    let mut code = vec![
        0x1000_0000 | (0x800 >> 2) << 5 | 1, // adr x1, vectors (code + 0x800)
        0xd518_c001,                         // msr vbar_el1, x1
        0xd503_3fdf,                         // isb
        0xd2bf_ffe9,                         // movz x9, #0xffff, lsl #16
        op(if write { 0xd510_0000 } else { 0xd530_0000 }), // msr id, x9 | mrs x9, id
        0xd503_3fdf,                         // isb
        0xd2b0_0000,                         // movz x0, #0x8000, lsl #16 (RAM_GPA)
        0xf900_0009,                         // str x9, [x0]
        0x1400_0000,                         // b .
    ];
    code.resize(0x800 / 4, 0xd503_201f); // nop
    for _ in 0..16 {
        let at = code.len();
        // movz x1, #0x8000, lsl #16; str x1, [x1, #8]; b .
        code.extend([0xd2b0_0001, 0xf900_0421, 0x1400_0000]);
        code.resize(at + 0x80 / 4, 0xd503_201f);
    }
    code.iter().flat_map(|w| w.to_le_bytes()).collect()
}
/// The `Checked` registers cannot be restored, so no guest may reach them:
/// every MSR and MRS to one must trap (to the VMM, or as an EL1 exception),
/// never execute. A register of the restored class (TPIDR_EL1) must execute,
/// or the fixture proves nothing.
#[test]
#[ignore = "requires Hypervisor.framework and HVF snapshots (make test-hvf)"]
fn impdef_registers_are_out_of_guest_reach() {
    let _vm = vm_lock();
    let mut s = slot(snapshot(), MemoryReset::Remap);
    let outcome = |s: &mut Slot<HvfVm>, id: u16, write: bool| {
        s.reset().unwrap();
        s.redirect_entry(&access_fixture(id, write));
        let e = s.exit();
        let esr = s.vcpu.syndrome;
        match e {
            Err(RunError::MemoryBound { address }) if address == ring::RAM_GPA => {
                "executed".to_string()
            }
            Err(RunError::MemoryBound { address }) if address == ring::RAM_GPA + 8 => {
                "el1 exception".to_string()
            }
            Err(RunError::GuestProtocol(m)) => format!("{m} (EC {:#x})", esr >> 26),
            e => format!("{:?}", e.err()),
        }
    };
    assert_eq!(
        outcome(&mut s, 0xc684, true),
        "executed",
        "control: MSR TPIDR_EL1"
    );
    assert_eq!(
        outcome(&mut s, 0xc684, false),
        "executed",
        "control: MRS TPIDR_EL1"
    );
    let mut reachable = vec![];
    for id in registers(Checked) {
        for write in [true, false] {
            let o = outcome(&mut s, id, write);
            println!(
                "HVF_IMPDEF {id:#06x} {} {o}",
                if write { "msr" } else { "mrs" }
            );
            if o == "executed" {
                reachable.push((id, write));
            }
        }
    }
    s.reset().unwrap(); // verify: the Checked registers kept their creation values
    assert!(
        reachable.is_empty(),
        "guest-reachable registers the reset cannot restore: {reachable:04x?}"
    );
}

/// The native profile's input archive (native.rs, `HvfVm::map_input`): an
/// EL1 fixture reads the bytes at ARCHIVE_GPA; a store there and a branch
/// there fault; once unmapped, a read faults too. Both classes.
#[test]
#[ignore = "requires Hypervisor.framework and HVF snapshots (make test-hvf)"]
fn input_archive_is_read_only_and_never_executes() {
    let _vm = vm_lock();
    let archive = ring::ARCHIVE_GPA;
    assert_eq!(archive & 0xffff, 0, "archive GPA fits one movz");
    let movz = |rd: u32, gpa: u64| 0xd2a0_0000 | ((gpa >> 16) as u32) << 5 | rd;
    let code = |words: &[u32]| -> Vec<u8> { words.iter().flat_map(|w| w.to_le_bytes()).collect() };
    // x1 = archive; x0 = [x1]; x2 = RAM_GPA; [x2] = x0 (read-only RAM: ends the run).
    let read = code(&[
        movz(1, archive),
        0xf940_0020,
        movz(2, ring::RAM_GPA),
        0xf900_0040,
    ]);
    let write = code(&[movz(1, archive), 0xf900_0021]); // [x1] = x1
    let branch = code(&[movz(1, archive), 0xd61f_0020]); // br x1
    for snapshot in snapshots() {
        let class = snapshot.class.name();
        let mut s = slot(snapshot, MemoryReset::Copy);
        let bytes: Vec<u8> = (0..20_000u32).map(|i| (i * 7 + 3) as u8).collect();
        let input = super::native::Input::new(&bytes).unwrap();
        assert_eq!(input.len, 32768, "rounded to the 16 KiB granule");
        // SAFETY: input outlives the translation (unmapped below).
        unsafe { s.vm.map_input(input.ptr, input.len) }.unwrap();
        s.redirect_entry(&read);
        assert!(
            matches!(s.exit(), Err(RunError::MemoryBound { address }) if address == ring::RAM_GPA),
            "{class}: read fixture"
        );
        assert_eq!(
            s.vcpu.reg(0),
            u64::from_le_bytes(bytes[..8].try_into().unwrap()),
            "{class}: the guest reads the archive"
        );
        s.reset().unwrap();
        s.redirect_entry(&write);
        assert!(
            matches!(s.exit(), Err(RunError::MemoryBound { address }) if address == archive),
            "{class}: a store to the archive faults"
        );
        s.reset().unwrap();
        s.redirect_entry(&branch);
        assert_eq!(
            s.exit().err().map(|e| e.to_string()).as_deref(),
            Some("guest_protocol: unexpected guest exception"),
            "{class}: a branch into the archive"
        );
        assert_eq!(s.vcpu.syndrome >> 26, 0x20, "{class}: instruction abort");
        s.reset().unwrap();
        s.vm.unmap_input(input.len).unwrap();
        s.redirect_entry(&read);
        assert!(
            matches!(s.exit(), Err(RunError::MemoryBound { address }) if address == archive),
            "{class}: an unmapped archive faults"
        );
        s.reset().unwrap();
        drop(s);
        drop(input);
    }
}

/// The shard clock (clock.rs) keeps guest time moving inside one HVF run: a
/// job that waits 20 ms on Date.now() finishes, which it cannot when the time
/// word is stored only before each entry (a kick ends that case after 2 s).
#[test]
#[ignore = "requires Hypervisor.framework and HVF snapshots (make test-hvf)"]
fn clock_advances_inside_a_run() {
    let _vm = vm_lock();
    let clock = crate::clock::Clock::start(1);
    let mut s = slot(snapshot(), MemoryReset::Copy);
    s.set_clock(clock.cell(0));
    let kicker = s.vcpu().kicker();
    let done = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let d = done.clone();
    let guard = std::thread::spawn(move || {
        for _ in 0..200 {
            if d.load(std::sync::atomic::Ordering::Acquire) {
                return;
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        let _ = kicker.kick();
    });
    let source = "const t=Date.now();let n=0;while(Date.now()-t<20)n++;return n>0?1:0;";
    s.bind(2, source, &mut std::fs::File::open("/dev/urandom").unwrap());
    let t = std::time::Instant::now();
    let finish = loop {
        match s.try_exit() {
            Ok(Some(step)) if step.op == ring::FINISH => break step.finish,
            Ok(Some(step)) => {
                for r in step.requests.iter().rev() {
                    s.reply(r).unwrap();
                }
            }
            Ok(None) => break None, // kicked: the clock did not advance
            Err(e) => panic!("{e}"),
        }
    };
    done.store(true, std::sync::atomic::Ordering::Release);
    guard.join().unwrap();
    assert_eq!(
        finish.as_deref(),
        Some("{\"ok\":1}"),
        "guest time stood still"
    );
    let ms = t.elapsed().as_millis();
    assert!((20..1000).contains(&ms), "{ms} ms");
}
/// A reset HVF rejects quarantines the slot with its reason (what the IPC
/// QUARANTINED message carries on Linux) and it never admits again.
#[test]
#[ignore = "requires Hypervisor.framework and HVF snapshots (make test-hvf)"]
fn failed_reset_quarantines_with_reason() {
    let _vm = vm_lock();
    let mut s = slot(snapshot(), MemoryReset::Copy);
    let (source, expected) = fixture("return2");
    s.bind(
        test_guest::FAIL_RESET_GENERATION,
        source,
        &mut std::fs::File::open("/dev/urandom").unwrap(),
    );
    let finish = loop {
        let step = s.exit().unwrap();
        if step.op == ring::FINISH {
            break step.finish;
        }
    };
    assert_eq!(finish.as_deref(), Some(expected));
    assert!(s.reset().is_err() && s.is_quarantined());
    let why = s.quarantine_reason().unwrap();
    assert!(
        why.starts_with("reset failed") && why.contains("hv_vcpu_set_sys_reg"),
        "{why}"
    );
    assert!(s.admit().is_err());
}

use crate::service::{
    CALL, CANCEL, DONE, ERROR, Message, QUARANTINED, READY, RELEASED, REPLY, START, STATS,
};
/// The zygote's side of one engine child (child.rs) over a socket pair.
struct Peer(super::conn::Conn);
impl Peer {
    fn send(&mut self, m: Message) {
        super::conn::send(self.0.fd(), &m).unwrap();
    }
    fn recv(&mut self) -> Message {
        loop {
            if let Some(m) = self.0.next().unwrap() {
                return m;
            }
            assert!(self.0.fill().unwrap(), "engine child closed its socket");
        }
    }
    fn start(&mut self, generation: u64, source: &str, deadline_ms: u64) {
        let mut b = vec![0; crate::constants::ipc::START_HEADER_BYTES];
        let deadline = crate::clock::ipc_ns() + deadline_ms * 1_000_000;
        b[0..8].copy_from_slice(&deadline.to_le_bytes());
        b[8..12].copy_from_slice(&(ring::MAX_CALLS as u32).to_le_bytes());
        b[12..16].copy_from_slice(&(ring::CALL_BYTES as u32).to_le_bytes());
        b[16..20].copy_from_slice(&(source.len() as u32).to_le_bytes());
        b[20..24].copy_from_slice(&(2u32 << 20).to_le_bytes());
        b.extend_from_slice(source.as_bytes());
        self.send(Message::new(START, 0, generation, 0, b));
    }
    /// STATS, then the completion's kind and text.
    fn completion(&mut self, generation: u64) -> (u32, String) {
        let stats = self.recv();
        assert_eq!((stats.kind, stats.generation), (STATS, generation));
        let m = self.recv();
        assert_eq!(m.generation, generation);
        (m.kind, String::from_utf8(m.bytes).unwrap())
    }
    fn cancel(&mut self, generation: u64) -> Message {
        self.send(Message::new(CANCEL, 0, generation, 0, vec![]));
        let m = self.recv();
        assert_eq!(m.generation, generation);
        m
    }
}

#[test]
#[ignore = "requires Hypervisor.framework and HVF snapshots (make test-hvf)"]
fn engine_child_runs_kicks_and_quarantines() {
    let _vm = vm_lock();
    let (ours, theirs) = super::conn::pair().unwrap();
    let zygote = std::thread::spawn(move || {
        let mut p = Peer(super::conn::Conn::new(ours, 64));
        assert_eq!(p.recv().kind, READY);
        p.start(1, fixture("return2").0, 5000);
        assert_eq!(p.completion(1), (DONE, "{\"ok\":2}".into()));
        assert_eq!(p.cancel(1).kind, RELEASED);
        // A tool call goes to the zygote and its reply (an echo, as the
        // fixture drivers answer) resumes the guest.
        p.start(2, fixture("one_tool").0, 5000);
        let call = p.recv();
        assert_eq!((call.kind, call.id), (CALL, 1));
        p.send(Message::new(REPLY, 0, 2, 1, call.bytes));
        assert_eq!(p.completion(2), (DONE, "{\"ok\":42}".into()));
        assert_eq!(p.cancel(2).kind, RELEASED);
        // The reader's deadline kicks a spinning guest.
        let t = std::time::Instant::now();
        p.start(3, "while(true){}", 30);
        assert_eq!(p.completion(3), (ERROR, "deadline_exceeded".into()));
        let late = t.elapsed();
        assert!(
            late < std::time::Duration::from_millis(200),
            "deadline after {late:?}"
        );
        assert_eq!(p.cancel(3).kind, RELEASED);
        // A CANCEL kicks a spinning guest at once.
        p.start(4, "while(true){}", 5000);
        std::thread::sleep(std::time::Duration::from_millis(20));
        assert_eq!(p.cancel(4).kind, RELEASED);
        // The slot is clean after both kicks.
        p.start(5, fixture("canary").0, 5000);
        assert_eq!(p.completion(5), (DONE, "{\"ok\":0}".into()));
        assert_eq!(p.cancel(5).kind, RELEASED);
        // A failed reset is reported QUARANTINED with its reason; the slot
        // never runs again.
        let g = test_guest::FAIL_RESET_GENERATION;
        p.start(g, fixture("return2").0, 5000);
        assert_eq!(p.completion(g), (DONE, "{\"ok\":2}".into()));
        let q = p.cancel(g);
        let why = String::from_utf8_lossy(&q.bytes).into_owned();
        assert!(
            q.kind == QUARANTINED && why.starts_with("reset failed"),
            "{why}"
        );
        p.start(g + 1, fixture("return2").0, 5000);
        let (kind, text) = p.completion(g + 1);
        assert!(
            kind == ERROR && text.starts_with("slot_unavailable"),
            "{text}"
        );
        // Dropping the socket ends serve().
    });
    let result = super::child::serve(theirs, 0, snapshot(), verified(), false);
    zygote.join().unwrap();
    result.unwrap();
}
