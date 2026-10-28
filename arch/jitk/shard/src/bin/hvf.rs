#![deny(clippy::undocumented_unsafe_blocks)]
//! macOS Hypervisor.framework tool (signed with the hypervisor entitlement by
//! hvf-run.sh or snapshot.ts). Emits JSONL.
//!
//!   hvf prepare KERNEL_IMAGE SNAPSHOT_BASE   boot to CHECKPOINT, write BASE.{mem,regs,layout}
//!   hvf bench SNAPSHOT_BASE FIXTURE N [copy|remap|unclean]
//!                                            N runs in one slot, reset between runs
#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
fn main() {
    mac::run();
}
#[cfg(not(all(target_os = "macos", target_arch = "aarch64")))]
fn main() {
    panic!("the hvf tool requires macOS arm64");
}

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
mod mac {
    use jitk_shard::{
        arena,
        constants::ring::{self, CONTROL as CTRL, RAM_BYTES as RAM},
        hv::ArchState,
        hvf::{HvfVm, MemoryReset, State},
        slot::{ResetPolicy, Slot},
        snapshot::Snapshot,
    };
    use std::{fs::File, io::Write, time::Instant};

    pub(super) fn run() {
        let a: Vec<String> = std::env::args().collect();
        let arg = |i: usize| a.get(i).map(String::as_str).unwrap_or("");
        match arg(1) {
            "prepare" => prepare(arg(2), arg(3)),
            "bench" => bench(
                arg(2),
                arg(3),
                arg(4).parse().unwrap_or(200),
                match arg(5) {
                    "remap" => MemoryReset::Remap,
                    "" | "copy" => MemoryReset::Copy,
                    "unclean" => MemoryReset::Unclean,
                    m => panic!("unknown reset mode {m}"),
                },
            ),
            _ => {
                eprintln!(
                    "usage: hvf prepare KERNEL_IMAGE BASE | hvf bench BASE FIXTURE N [copy|remap|unclean]"
                );
                std::process::exit(2);
            }
        }
    }

    /// As the KVM harness's `prepare`: the image must carry exactly one ring
    /// layout; the snapshot is taken at the completed CHECKPOINT store.
    fn prepare(image: &str, base: &str) {
        let raw = std::fs::read(image).unwrap();
        assert!(raw.len() < CTRL);
        let classes: Vec<_> = arena::Class::ALL
            .into_iter()
            .filter(|c| {
                raw.windows(c.layout_bytes().len())
                    .any(|b| b == c.layout_bytes())
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
        let mut s = Slot::boot_on(HvfVm::create().unwrap(), &f).unwrap();
        let mut entropy = File::open("/dev/urandom").unwrap();
        s.bind(1, "", &mut entropy);
        let t = Instant::now();
        let e = s.exit().expect("trusted checkpoint protocol");
        assert_eq!(e.op, ring::CHECKPOINT, "real guest did not CHECKPOINT");
        assert!(e.requests.is_empty() && e.finish.is_none());
        let boot_ns = t.elapsed().as_nanos();
        let regs = jitk_shard::hv::Vcpu::save(s.vcpu()).unwrap();
        for (ext, bytes) in [
            ("mem", s.bytes(0, RAM)),
            ("regs", regs.encode()),
            ("layout", class.layout_bytes().to_vec()),
        ] {
            let mut out = File::options()
                .write(true)
                .create_new(true)
                .open(format!("{base}.{ext}"))
                .unwrap();
            out.write_all(&bytes).unwrap();
            out.sync_all().unwrap();
        }
        use std::os::unix::fs::PermissionsExt;
        for ext in ["mem", "regs", "layout"] {
            std::fs::set_permissions(
                format!("{base}.{ext}"),
                std::fs::Permissions::from_mode(0o444),
            )
            .unwrap();
        }
        println!(
            "{{\"event\":\"prepared\",\"hypervisor\":\"hvf\",\"class\":\"{}\",\"arena_bytes\":{},\"ram_bytes\":{RAM},\"boot_to_checkpoint_ns\":{boot_ns}}}",
            class.name(),
            class.bytes(),
        );
        drop(s);
        drop(f);
        std::fs::remove_file(initial).unwrap();
    }

    fn fixture(name: &str) -> (&'static str, &'static str) {
        match name {
            "return2" => (include_str!("../../fixtures/return2.js"), "{\"ok\":2}"),
            "one_tool" => (include_str!("../../fixtures/one_tool.js"), "{\"ok\":42}"),
            _ => panic!("unknown fixture {name}"),
        }
    }
    fn stats(v: &mut [u64]) -> String {
        v.sort_unstable();
        let q = |p: usize| v[(v.len() * p).div_ceil(100).max(1) - 1];
        format!(
            "{{\"n\":{},\"p50\":{},\"p90\":{},\"p99\":{}}}",
            v.len(),
            q(50),
            q(90),
            q(99)
        )
    }
    fn thread_cpu_ns() -> u64 {
        jitk_shard::clock::clock_ns(libc::CLOCK_THREAD_CPUTIME_ID)
    }

    /// N runs of FIXTURE in one slot (echo tool replies), reset between runs;
    /// run = bind to FINISH, wall and thread CPU.
    fn bench(base: &str, name: &str, n: usize, mode: MemoryReset) {
        let (source, expected) = fixture(name);
        let snapshot = Snapshot::<State>::load(base).unwrap();
        let mut vm = HvfVm::create().unwrap();
        vm.reset = mode;
        let mut s = Slot::create(vm, snapshot, ResetPolicy::default()).unwrap();
        let mut entropy = File::open("/dev/urandom").unwrap();
        let (mut run, mut cpu, mut reset, mut total) = (vec![], vec![], vec![], vec![]);
        for i in 0..n {
            let t0 = Instant::now();
            if i > 0 {
                reset.push(s.reset().unwrap().ns);
            }
            let (t, c) = (Instant::now(), thread_cpu_ns());
            s.bind(i as u64 + 2, source, &mut entropy);
            loop {
                let step = s.exit().unwrap_or_else(|e| panic!("run {i}: {e}"));
                if step.op == ring::FINISH {
                    assert_eq!(step.finish.as_deref(), Some(expected));
                    break;
                }
                for r in step.requests.iter().rev() {
                    s.reply(r).unwrap();
                }
            }
            if i >= n.min(10) {
                run.push(t.elapsed().as_nanos() as u64);
                cpu.push(thread_cpu_ns() - c);
                total.push(t0.elapsed().as_nanos() as u64);
            }
        }
        println!(
            "{{\"event\":\"bench\",\"hypervisor\":\"hvf\",\"fixture\":\"{name}\",\"reset\":\"{mode:?}\",\"n\":{n},\"run_wall_ns\":{},\"run_cpu_ns\":{},\"reset_ns\":{},\"reset_plus_run_wall_ns\":{}}}",
            stats(&mut run),
            stats(&mut cpu),
            stats(&mut reset),
            stats(&mut total),
        );
    }
}
