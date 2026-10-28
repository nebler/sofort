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
/// A fixture outcome: the guest stops without a completion.
const FATAL: &str = "guest_fatal";
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
        // Out of memory on glue-2m. On the helper snapshots the guest then
        // stops without a completion (guest_fatal), on KVM as here (checked
        // with `real hostile BASE json64k` on kvm-dev, 2026-10-28).
        "json64k" => (include_str!("../../fixtures/json64k.js"), FATAL),
        // Dirties much of the arena and leaves a tenant global behind.
        "stress" => (
            "globalThis.__tenantCanary=1;let a=[];for(let i=0;i<2000;i++)a.push({i,s:'x'+i});return a.length;",
            "{\"ok\":2000}",
        ),
        // Runs the arena out of memory with the global set.
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
        let step = match s.exit() {
            Err(RunError::GuestFatal) if expected == FATAL => break,
            r => r.unwrap_or_else(|e| panic!("{name}: {e}")),
        };
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
        "oom",
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
    for mode in [MemoryReset::Copy, MemoryReset::Remap] {
        let mut s = slot(snapshot(), mode);
        let canary = ring::RAM_GPA + s.snapshot().class.canary() as u64;
        // br x4 (arena start); movz x5, #0x81d0, lsl #16; br x5 (control page);
        // movz x6, canary; br x6 (the fixture page, after a reset).
        let (lo, hi) = (canary & 0xffff, canary >> 16);
        for code in [
            vec![0xd61f_0080u32],
            vec![0xd2b0_3a05, 0xd61f_00a0],
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
            assert_eq!(
                e.as_deref(),
                Some("guest_protocol: unexpected guest exception"),
                "{mode:?} {code:x?}"
            );
            assert_eq!(
                s.vcpu.syndrome >> 26,
                0x20,
                "{mode:?}: instruction abort from EL1"
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
    let status = std::process::Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "hvf::tests::immutable_host_write_child",
            "--ignored",
        ])
        .env("JITK_IMMUTABLE_WRITE_CHILD", "1")
        .output()
        .unwrap()
        .status;
    assert!(
        matches!(status.signal(), Some(10 | 11)),
        "immutable write must fault: {status:?}"
    );
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
