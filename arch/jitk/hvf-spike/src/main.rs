//! HVF spike (R10 W3.0): the jitk ring kernel on Hypervisor.framework with the
//! KVM shard's slot/reset model. Measurement CLI; not a production engine.
//!
//!   hvf-spike prepare IMAGE BASE           boot to CHECKPOINT, write BASE.{mem,hvfregs,layout}
//!   hvf-spike bench BASE FIXTURE N [copy|compare] [verify]
//!                                          N runs in one VM, reset between runs
//!   hvf-spike mix BASE N                   alternate return2/one_tool/stress, verified resets
//!   hvf-spike once BASE FIXTURE            one cold run in this process (spawned by `cold`)
//!   hvf-spike cold BASE FIXTURE N          N × posix_spawn(`once`), child rusage via wait4
//!   hvf-spike fork BASE FIXTURE N          N × fork() from a parent holding the snapshot
mod hv;
mod hvf;
mod slot;

use hv::{ArchState, Exit, Vcpu};
use hvf::{HvfVcpu, HvfVm};
use jitk_shard::{arena::Class, constants::ring};
use slot::{RAM, ResetMode, Slot, Snapshot};
use std::{
    fs::File,
    io::{Read, Write},
    time::Instant,
};

unsafe extern "C" {
    fn clock_gettime_nsec_np(clock: u32) -> u64;
    fn proc_pid_rusage(pid: i32, flavor: i32, buf: *mut [u64; 40]) -> i32;
    fn getpid() -> i32;
    fn fork() -> i32;
    fn _exit(code: i32) -> !;
    fn wait4(pid: i32, status: *mut i32, options: i32, ru: *mut [i64; 18]) -> i32;
    fn getrusage(who: i32, ru: *mut [i64; 18]) -> i32;
}
fn thread_cpu_ns() -> u64 {
    // SAFETY: CLOCK_THREAD_CPUTIME_ID (16) is a valid clock id.
    unsafe { clock_gettime_nsec_np(16) }
}
fn process_cpu_ns() -> u64 {
    // SAFETY: CLOCK_PROCESS_CPUTIME_ID (12).
    unsafe { clock_gettime_nsec_np(12) }
}
/// (phys_footprint, resident) bytes of this process.
fn footprint() -> (u64, u64) {
    let mut b = [0u64; 40];
    // SAFETY: flavor 4 is rusage_info_v4 (< 320 bytes).
    unsafe { proc_pid_rusage(getpid(), 4, &mut b) };
    (b[9], b[8])
}
fn ru_cpu_ns(ru: &[i64; 18]) -> (u64, u64) {
    let t = |s: i64, us: i64| (s * 1_000_000_000 + us * 1000) as u64;
    (t(ru[0], ru[1]), t(ru[2], ru[3]))
}

fn fixture(name: &str) -> (&'static str, &'static str) {
    match name {
        "return2" => (include_str!("../../shard/fixtures/return2.js"), "{\"ok\":2}"),
        "one_tool" => (include_str!("../../shard/fixtures/one_tool.js"), "{\"ok\":42}"),
        "promise10" => (include_str!("../../shard/fixtures/promise10.js"), "{\"ok\":45}"),
        // Out of memory on glue-2m, as the KVM shard's driver also expects.
        "json64k" => (
            include_str!("../../shard/fixtures/json64k.js"),
            "{\"err\":{\"name\":\"InternalError\",\"message\":\"out of memory\"}}",
        ),
        // Dirties a lot of arena and leaves a tenant global behind.
        "stress" => (
            "globalThis.__tenantCanary=1;let a=[];for(let i=0;i<2000;i++)a.push({i,s:'x'+i});return a.length;",
            "{\"ok\":2000}",
        ),
        // Runs the arena out of memory (the shard's `bomb` outcome).
        "oom" => (
            "globalThis.__tenantCanary=1;let a=[];for(let i=0;i<1e6;i++)a.push({i,s:'x'+i});return a.length;",
            "{\"err\":{\"name\":\"InternalError\",\"message\":\"out of memory\"}}",
        ),
        // Reads what a previous tenant might have left.
        "canary" => ("return globalThis.__tenantCanary===undefined?0:1;", "{\"ok\":0}"),
        _ => panic!("unknown fixture {name}"),
    }
}
fn seed() -> [u8; 16] {
    let mut s = [0u8; 16];
    File::open("/dev/urandom").unwrap().read_exact(&mut s).unwrap();
    s
}
fn stats(v: &[u64]) -> String {
    let mut s = v.to_vec();
    s.sort_unstable();
    let q = |p: usize| s[((s.len() * p).div_ceil(100)).max(1) - 1];
    format!("{{\"n\":{},\"p50\":{},\"p90\":{},\"p99\":{},\"min\":{}}}", s.len(), q(50), q(90), q(99), s[0])
}

#[derive(Default)]
struct Run {
    wall_ns: u64,
    cpu_ns: u64,
    doorbells: u64,
    calls: u64,
}
/// bind + drive to FINISH, answering every CALL as an echo of its arguments
/// (the bootstrap's `tools.echo`), exactly what the shard fixture driver does.
fn run_one(slot: &mut Slot<HvfVcpu>, generation: u64, source: &str, expected: &str) -> Result<Run, String> {
    let (t, c) = (Instant::now(), thread_cpu_ns());
    let before = slot.doorbells;
    slot.bind(generation, source, seed());
    let mut calls = 0;
    loop {
        let step = slot.step()?;
        if step.op == ring::FINISH {
            if !slot.repaired() {
                return Err("missing repair acknowledgement".into());
            }
            let got = step.finish.unwrap();
            if got != expected {
                return Err(format!("result {got} != {expected}"));
            }
            break;
        }
        if !matches!(step.op, ring::SUBMIT | ring::WAIT | ring::REPAIRED_READY) {
            return Err(format!("unexpected doorbell {}", step.op));
        }
        for r in step.requests.iter().rev() {
            calls += 1;
            let bytes = r.bytes.clone();
            slot.reply(r, &bytes)?;
        }
    }
    Ok(Run {
        wall_ns: t.elapsed().as_nanos() as u64,
        cpu_ns: thread_cpu_ns() - c,
        doorbells: slot.doorbells - before,
        calls,
    })
}

fn prepare(image: &str, base: &str) {
    let t0 = Instant::now();
    let c0 = process_cpu_ns();
    let raw = std::fs::read(image).unwrap();
    assert!(raw.len() < ring::CONTROL);
    let classes: Vec<Class> = Class::ALL
        .into_iter()
        .filter(|c| raw.windows(c.layout_bytes().len()).any(|b| b == c.layout_bytes()))
        .collect();
    assert_eq!(classes.len(), 1, "kernel must identify exactly one ring layout");
    let class = classes[0];
    let boot = format!("{base}.boot");
    let _ = std::fs::remove_file(&boot);
    let mut f = File::options().read(true).write(true).create_new(true).open(&boot).unwrap();
    f.set_len(RAM as u64).unwrap();
    f.write_all(&raw).unwrap();
    let mut vm = HvfVm::create().unwrap();
    let t_vm = t0.elapsed();
    let mut s = Slot::boot(&mut vm, &f).unwrap();
    s.bind(1, "", seed());
    let (t, c) = (Instant::now(), thread_cpu_ns());
    let step = s.step().expect("boot to checkpoint");
    let (boot_wall, boot_cpu) = (t.elapsed().as_nanos(), thread_cpu_ns() - c);
    assert_eq!(step.op, ring::CHECKPOINT, "real guest did not CHECKPOINT");
    assert!(step.requests.is_empty() && step.finish.is_none());
    let regs = s.vcpu.save().unwrap();
    for (ext, bytes) in [
        ("mem", s.bytes(0, RAM)),
        ("hvfregs", regs.encode()),
        ("layout", class.layout_bytes()),
    ] {
        let path = format!("{base}.{ext}");
        let _ = std::fs::remove_file(&path);
        std::fs::write(&path, bytes).unwrap();
    }
    let sys = s.vcpu.sys.len();
    let exits = s.vcpu.exits;
    drop(s);
    drop(vm);
    std::fs::remove_file(boot).unwrap();
    println!(
        "{{\"event\":\"prepared\",\"class\":\"{}\",\"sys_regs\":{sys},\"exits\":{exits},\"vm_create_ns\":{},\"boot_to_checkpoint_wall_ns\":{boot_wall},\"boot_to_checkpoint_cpu_ns\":{boot_cpu},\"total_wall_ns\":{},\"process_cpu_ns\":{}}}",
        class.name(),
        t_vm.as_nanos(),
        t0.elapsed().as_nanos(),
        process_cpu_ns() - c0
    );
}

fn open(base: &str) -> (HvfVm, Snapshot<hvf::State>, u64) {
    let t = Instant::now();
    let snap = Snapshot::<hvf::State>::load(base).unwrap();
    let vm = HvfVm::create().unwrap();
    (vm, snap, t.elapsed().as_nanos() as u64)
}

fn bench(base: &str, name: &str, n: usize, mode: ResetMode, verify: bool) {
    let (source, expected) = fixture(name);
    let (fp0, _) = footprint();
    let (mut vm, snap, load_ns) = open(base);
    let t = Instant::now();
    let mut slot = Slot::new(&mut vm, &snap).unwrap();
    let slot_ns = t.elapsed().as_nanos() as u64;
    let (mut wall, mut cpu, mut reset, mut reset_mem, mut reset_regs, mut reset_cpu, mut dirty) =
        (vec![], vec![], vec![], vec![], vec![], vec![], vec![0]);
    let mut reset_clean = vec![];
    let mut first = None;
    let mut footprint_after_first = 0;
    let mut door = 0;
    let mut calls = 0;
    for i in 0..n {
        if i > 0 {
            // Counting cleans the caches; only in verify runs (not timed ones).
            if verify {
                dirty.push(slot.dirty_pages() as u64);
            }
            let c = thread_cpu_ns();
            let r = slot.reset(mode).unwrap();
            reset_cpu.push(thread_cpu_ns() - c);
            reset.push(r.ns);
            reset_mem.push(r.mem_ns);
            reset_regs.push(r.regs_ns);
            reset_clean.push(r.clean_ns);
            if verify {
                slot.verify().unwrap_or_else(|e| panic!("reset {i}: {e}"));
            }
        }
        let r = run_one(&mut slot, i as u64 + 2, source, expected).unwrap_or_else(|e| panic!("run {i}: {e}"));
        door = r.doorbells;
        calls = r.calls;
        if i == 0 {
            first = Some((r.wall_ns, r.cpu_ns));
            footprint_after_first = footprint().0;
        } else if i >= n.min(10) {
            wall.push(r.wall_ns);
            cpu.push(r.cpu_ns);
        }
    }
    let (fp, rss) = footprint();
    let first = first.unwrap();
    println!(
        "{{\"event\":\"bench\",\"fixture\":\"{name}\",\"n\":{n},\"mode\":\"{mode:?}\",\"verify\":{verify},\"doorbells_per_run\":{door},\"calls_per_run\":{calls},\
\"snapshot_load_and_vm_create_ns\":{load_ns},\"slot_new_ns\":{slot_ns},\"first_run_wall_ns\":{},\"first_run_cpu_ns\":{},\
\"run_wall_ns\":{},\"run_cpu_ns\":{},\"reset_ns\":{},\"reset_mem_ns\":{},\"reset_regs_ns\":{},\"reset_clean_ns\":{},\"reset_cpu_ns\":{},\"dirty_16k_pages\":{},\
\"footprint_before_vm\":{fp0},\"footprint_after_first_run\":{footprint_after_first},\"footprint_end\":{fp},\"resident_end\":{rss},\"hvf_exits\":{}}}",
        first.0,
        first.1,
        stats(&wall),
        stats(&cpu),
        stats(&reset),
        stats(&reset_mem),
        stats(&reset_regs),
        stats(&reset_clean),
        stats(&reset_cpu),
        stats(&dirty),
        slot.vcpu.exits
    );
}

/// Alternating tenants with a verified reset in between, plus a canary probe:
/// the reset-correctness check of the spike.
fn mix(base: &str, n: usize) {
    let (mut vm, snap, _) = open(base);
    let mut slot = Slot::new(&mut vm, &snap).unwrap();
    let order = [
        "return2", "stress", "canary", "one_tool", "oom", "canary", "promise10", "json64k", "canary",
    ];
    for i in 0..n {
        let name = order[i % order.len()];
        let (source, expected) = fixture(name);
        if i > 0 {
            slot.reset(ResetMode::Copy).unwrap();
            slot.verify().unwrap_or_else(|e| panic!("reset before {i} ({name}): {e}"));
        }
        run_one(&mut slot, i as u64 + 2, source, expected).unwrap_or_else(|e| panic!("run {i} {name}: {e}"));
    }
    println!("{{\"event\":\"mix\",\"runs\":{n},\"ok\":true,\"fixtures\":{order:?}}}");
}

/// Deadline path: a guest spinning at EL0 with no doorbell is stopped by a
/// kick from another thread; the slot then resets (verified) and serves again.
fn kick(base: &str, n: usize) {
    let (mut vm, snap, _) = open(base);
    let mut slot = Slot::new(&mut vm, &snap).unwrap();
    let mut latency = vec![];
    for i in 0..n {
        if i > 0 {
            slot.reset(ResetMode::Copy).unwrap();
            slot.verify().unwrap();
        }
        let kicker = slot.vcpu.kicker();
        let sent = std::sync::Arc::new(std::sync::Mutex::new(None));
        let s2 = sent.clone();
        let th = std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(20));
            *s2.lock().unwrap() = Some(Instant::now());
            kicker.kick().unwrap();
        });
        slot.bind(2 * i as u64 + 2, "for(;;){}", seed());
        let e = slot.step().err().expect("spin must not finish");
        let stopped = Instant::now();
        th.join().unwrap();
        assert!(e.contains("Interrupted"), "{e}");
        latency.push((stopped - sent.lock().unwrap().unwrap()).as_nanos() as u64);
        slot.reset(ResetMode::Copy).unwrap();
        slot.verify().unwrap();
        let (source, expected) = fixture("return2");
        run_one(&mut slot, 2 * i as u64 + 3, source, expected).unwrap();
    }
    println!("{{\"event\":\"kick\",\"runs\":{n},\"ok\":true,\"kick_to_exit_ns\":{}}}", stats(&latency));
}

// The KVM shard's own EL1 reset fixtures (build.rs: Mach-O directives only).
core::arch::global_asm!(include_str!(concat!(env!("OUT_DIR"), "/reset-attack.S")));
macro_rules! fixture_code {
    ($name:ident, $start:ident, $end:ident) => {
        fn $name() -> &'static [u8] {
            unsafe extern "C" {
                static $start: u8;
                static $end: u8;
            }
            let (s, e) = (std::ptr::addr_of!($start), std::ptr::addr_of!($end));
            // SAFETY: the assembly's label pair encloses one read-only fixture.
            unsafe { std::slice::from_raw_parts(s, e as usize - s as usize) }
        }
    };
}
fixture_code!(fill, jitk_reset_fill_start, jitk_reset_fill_end);
fixture_code!(probe, jitk_reset_probe_start, jitk_reset_probe_end);
fixture_code!(cpu_off, jitk_reset_cpu_off_start, jitk_reset_cpu_off_end);
fixture_code!(system_off, jitk_reset_system_off_start, jitk_reset_system_off_end);

/// shard reset tests on HVF: a hostile EL1 fill (every writable byte, every
/// EL1 register, MMU and caches off, then a store to immutable RAM) must be
/// contained as a stage-2 fault and undone by the reset, as seen both by the
/// host compare and by an uncached guest probe; PSCI CPU_OFF/SYSTEM_OFF over
/// HVC must exit; the slot must keep serving real runs.
fn hostile(base: &str, n: usize) {
    let (mut vm, snap, _) = open(base);
    let mut slot = Slot::new(&mut vm, &snap).unwrap();
    let ro = ring::RAM_GPA;
    let mut generation = 1;
    let mut next = || {
        generation += 1;
        generation
    };
    let fresh = |slot: &mut Slot<HvfVcpu>| {
        slot.reset(ResetMode::Copy).unwrap();
        slot.verify().unwrap_or_else(|e| panic!("reset: {e}"));
    };
    for i in 0..n {
        // Uncached probe of a correctly reset slot (first: of the fresh slot).
        if i > 0 {
            fresh(&mut slot);
        }
        let e = slot.attack(probe()).unwrap();
        assert!(matches!(e, Exit::Fault { gpa, .. } if gpa == ro), "probe exit {e:?}");
        assert_eq!(slot.vcpu.get_x(0), slot.expected_probe(), "uncached probe {i} saw stale bytes");
        fresh(&mut slot);
        let e = slot.attack(fill()).unwrap();
        assert!(matches!(e, Exit::Fault { gpa, .. } if gpa == ro), "fill exit {e:?}");
        assert!(slot.dirty_pages() > 80, "fill dirtied only {}", slot.dirty_pages());
        fresh(&mut slot);
        let e = slot.attack(probe()).unwrap();
        assert!(matches!(e, Exit::Fault { gpa, .. } if gpa == ro), "probe exit {e:?}");
        assert_eq!(slot.vcpu.get_x(0), slot.expected_probe(), "uncached probe after fill {i}");
        fresh(&mut slot);
        let (s, x) = fixture("one_tool");
        run_one(&mut slot, next(), s, x).unwrap();
        fresh(&mut slot);
        assert_eq!(slot.attack(cpu_off()).unwrap(), Exit::Shutdown(0x8400_0002));
        fresh(&mut slot);
        assert_eq!(slot.attack(system_off()).unwrap(), Exit::Shutdown(0x8400_0008));
        fresh(&mut slot);
        let (s, x) = fixture("return2");
        run_one(&mut slot, next(), s, x).unwrap();
    }
    println!("{{\"event\":\"hostile\",\"rounds\":{n},\"ok\":true}}");
}

/// One cold VM: what a spawned or forked engine child does.
fn once_in_process(snap: &Snapshot<hvf::State>, name: &str) -> String {
    let (source, expected) = fixture(name);
    let t = Instant::now();
    let mut vm = HvfVm::create().unwrap();
    let vm_ns = t.elapsed().as_nanos();
    let mut slot = Slot::new(&mut vm, snap).unwrap();
    let slot_ns = t.elapsed().as_nanos();
    let r = run_one(&mut slot, 2, source, expected).unwrap();
    let done = t.elapsed().as_nanos();
    drop(slot);
    drop(vm);
    format!(
        "\"vm_create_ns\":{vm_ns},\"slot_ready_ns\":{slot_ns},\"run_wall_ns\":{},\"run_cpu_ns\":{},\"done_ns\":{done},\"footprint\":{}",
        r.wall_ns,
        r.cpu_ns,
        footprint().0
    )
}

fn spawned(base: &str, name: &str, n: usize) {
    let exe = std::env::current_exe().unwrap();
    let (mut user, mut sys, mut wall, mut minflt) = (vec![], vec![], vec![], vec![]);
    for _ in 0..n {
        let t = Instant::now();
        let child = std::process::Command::new(&exe)
            .args(["once", base, name])
            .stdout(std::process::Stdio::null())
            .spawn()
            .unwrap();
        let mut status = 0;
        let mut ru = [0i64; 18];
        // SAFETY: reaping our own child; live out-pointers.
        unsafe { wait4(child.id() as i32, &mut status, 0, &mut ru) };
        assert_eq!(status, 0);
        wall.push(t.elapsed().as_nanos() as u64);
        let (u, s) = ru_cpu_ns(&ru);
        user.push(u);
        sys.push(s);
        minflt.push(ru[8] as u64);
    }
    let total: Vec<u64> = user.iter().zip(&sys).map(|(a, b)| a + b).collect();
    println!(
        "{{\"event\":\"cold\",\"model\":\"posix_spawn\",\"fixture\":\"{name}\",\"child_cpu_ns\":{},\"child_user_ns\":{},\"child_sys_ns\":{},\"wall_ns\":{},\"minflt\":{}}}",
        stats(&total),
        stats(&user),
        stats(&sys),
        stats(&wall),
        stats(&minflt)
    );
}

fn forked(base: &str, name: &str, n: usize) {
    // The parent maps the snapshot and has Hypervisor.framework loaded, but
    // never creates a VM (HVF then still works in the child; R9 hvfork).
    let snap = Snapshot::<hvf::State>::load(base).unwrap();
    let (mut total, mut wall, mut minflt, mut parent) = (vec![], vec![], vec![], vec![]);
    let mut last = String::new();
    for _ in 0..n {
        let (t, pc) = (Instant::now(), process_cpu_ns());
        let mut fds = [0i32; 2];
        // SAFETY: pipe for the child's one-line report.
        unsafe extern "C" {
            fn pipe(fds: *mut i32) -> i32;
            fn write(fd: i32, b: *const u8, n: usize) -> isize;
            fn close(fd: i32) -> i32;
        }
        // SAFETY: live array of two ints.
        unsafe { pipe(fds.as_mut_ptr()) };
        // SAFETY: the parent is single-threaded here; the child only runs the
        // VM, writes its report and _exits.
        let pid = unsafe { fork() };
        if pid == 0 {
            let line = once_in_process(&snap, name);
            // SAFETY: child-owned pipe end.
            unsafe {
                write(fds[1], line.as_ptr(), line.len());
                _exit(0)
            }
        }
        // SAFETY: parent closes its write end.
        unsafe { close(fds[1]) };
        let mut status = 0;
        let mut ru = [0i64; 18];
        // SAFETY: reaping our own child.
        unsafe { wait4(pid, &mut status, 0, &mut ru) };
        assert_eq!(status, 0);
        parent.push(process_cpu_ns() - pc);
        wall.push(t.elapsed().as_nanos() as u64);
        let (u, s) = ru_cpu_ns(&ru);
        total.push(u + s);
        minflt.push(ru[8] as u64);
        use std::os::fd::FromRawFd;
        // SAFETY: the read end is ours; File takes ownership once.
        let mut r = unsafe { File::from_raw_fd(fds[0]) };
        last.clear();
        r.read_to_string(&mut last).unwrap();
    }
    println!(
        "{{\"event\":\"cold\",\"model\":\"fork\",\"fixture\":\"{name}\",\"child_cpu_ns\":{},\"parent_cpu_ns\":{},\"wall_ns\":{},\"minflt\":{},\"last_child\":{{{last}}}}}",
        stats(&total),
        stats(&parent),
        stats(&wall),
        stats(&minflt)
    );
}

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let arg = |i: usize| a.get(i).map(String::as_str).unwrap_or("");
    match arg(1) {
        "prepare" => prepare(arg(2), arg(3)),
        "bench" => bench(
            arg(2),
            arg(3),
            arg(4).parse().unwrap_or(200),
            if arg(5) == "compare" { ResetMode::Compare } else { ResetMode::Copy },
            a.iter().any(|x| x == "verify"),
        ),
        "mix" => mix(arg(2), arg(3).parse().unwrap_or(64)),
        "kick" => kick(arg(2), arg(3).parse().unwrap_or(10)),
        "hostile" => hostile(arg(2), arg(3).parse().unwrap_or(10)),
        "once" => {
            let snap = Snapshot::<hvf::State>::load(arg(2)).unwrap();
            let line = once_in_process(&snap, arg(3));
            let mut ru = [0i64; 18];
            // SAFETY: RUSAGE_SELF into a live struct.
            unsafe { getrusage(0, &mut ru) };
            let (u, s) = ru_cpu_ns(&ru);
            println!("{{\"event\":\"once\",{line},\"self_cpu_ns\":{}}}", u + s);
        }
        "cold" => spawned(arg(2), arg(3), arg(4).parse().unwrap_or(50)),
        "fork" => forked(arg(2), arg(3), arg(4).parse().unwrap_or(50)),
        _ => {
            eprintln!("usage: hvf-spike prepare|bench|mix|once|cold|fork ...");
            std::process::exit(2);
        }
    }
}
