//! Offline fixture driver. Runtime scheduling lives in owner.rs; no Node policy is implemented here.
use jitk_shard::{
    entropy,
    kvm::{self, Kvm, RunError, Snapshot},
    owner::{Completion, Event, Job, Mode as RuntimeMode, Pool},
};
use std::{
    collections::HashSet,
    fs,
    io::{self, Write},
    sync::Arc,
    thread,
    time::{Duration, Instant},
};
#[derive(Clone, Copy)]
enum Mode {
    Run,
    Wait,
    Ready,
    Attack,
    RetainAttack,
}
fn stats(v: &[u64]) -> String {
    let mut s = v.to_vec();
    s.sort_unstable();
    format!(
        "{{\"n\":{},\"p50_ns\":{},\"p99_ns\":{}}}",
        s.len(),
        s[(s.len() - 1) / 2],
        s[(s.len() * 99).div_ceil(100) - 1]
    )
}
fn proc_read(path: &str) -> String {
    fs::read_to_string(path).unwrap_or_default()
}
fn job(generation: u64, source: &str, mode: Mode, deadline: u64, canary: bool) -> Job {
    Job {
        generation,
        source: source.into(),
        mode: match mode {
            Mode::Run | Mode::Attack => RuntimeMode::Run,
            Mode::Wait => RuntimeMode::Wait,
            Mode::Ready => RuntimeMode::Ready,
            Mode::RetainAttack => RuntimeMode::Retain,
        },
        deadline_ns: deadline,
        canary,
        entry: match mode {
            Mode::Attack | Mode::RetainAttack => Some(super::arena_attack()),
            _ => None,
        },
    }
}
fn done(pool: &mut Pool, slot: usize, generation: u64) -> Completion {
    match pool.recv() {
        Event::Done {
            slot: id,
            generation: gen_id,
            completion,
        } => {
            assert_eq!((id, gen_id), (slot, generation));
            completion
        }
        _ => panic!("expected completion"),
    }
}
fn verify_reset(pool: &mut Pool, slot: usize) {
    pool.reset(slot);
    assert!(matches!(pool.recv(), Event::Reset { slot: id } if id == slot));
}
pub fn run(
    kvm: Arc<Kvm>,
    snapshot: Arc<Snapshot>,
    a: &[String],
    fixture: fn(&str) -> String,
    expected: fn(&str) -> &'static str,
) {
    let mode = a[1].as_str();
    let name = &a[3];
    let n: usize = a.get(4).map(|x| x.parse().unwrap()).unwrap_or(100);
    let owners: usize = std::env::var("JITK_SHARD_THREADS")
        .unwrap_or("4".into())
        .parse()
        .unwrap();
    assert!(n > 0);
    println!(
        "{{\"event\":\"environment\",\"pid\":{},\"threads\":{},\"owners\":{owners},\"watchdog_processes\":1,\"nested\":true,\"loadavg\":{:?},\"uptime\":{:?},\"kernel\":{:?}}}",
        std::process::id(),
        owners + 1,
        proc_read("/proc/loadavg").trim(),
        proc_read("/proc/uptime").trim(),
        proc_read("/proc/version").trim()
    );
    let slots = if matches!(mode, "hold" | "deadlines") {
        n
    } else if mode == "stress" {
        64.min(n)
    } else {
        1
    };
    let mut pool = Pool::new(kvm, snapshot, slots, owners);
    (|| {
        if mode == "deadlines" {
            if name == "staggered" {
                staggered(&mut pool, n);
                return;
            }
            deadlines(&mut pool, n);
            return;
        }
        if mode == "stress" {
            stress(&mut pool, n, slots, fixture, expected);
            return;
        }
        let scenario = Scenario {
            name,
            n,
            owners,
            source: fixture(name),
            expected,
        };
        match mode {
            "hold" => scenario.hold(&mut pool, a.get(5).map(String::as_str)),
            "hostile" => scenario.hostile(&mut pool),
            _ => {
                assert_eq!(mode, "bench");
                scenario.bench(&mut pool);
            }
        }
    })();
    pool.shutdown().expect("owner pool shutdown");
}
struct Scenario<'a> {
    name: &'a str,
    n: usize,
    owners: usize,
    source: String,
    expected: fn(&str) -> &'static str,
}
impl Scenario<'_> {
    fn hold(&self, pool: &mut Pool, seconds: Option<&str>) {
        let name = self.name;
        let n = self.n;
        let source = self.source.as_str();
        let expected = self.expected;
        let owners = self.owners;
        let run_mode = match name {
            "ready" => Mode::Ready,
            "wait" => Mode::Wait,
            "attack_hold" => Mode::RetainAttack,
            _ => Mode::Run,
        };
        for slot in 0..n {
            pool.start(
                slot,
                job(
                    slot as u64 + 2,
                    source,
                    run_mode,
                    kvm::monotonic_ns() + 3_600_000_000_000,
                    false,
                ),
            );
        }
        let mut seen = HashSet::new();
        for _ in 0..n {
            match pool.recv() {
                Event::Parked { slot, generation } => {
                    assert_eq!(generation, slot as u64 + 2);
                    assert!(seen.insert(slot));
                }
                Event::Done {
                    slot,
                    generation,
                    completion,
                } => {
                    assert_eq!(generation, slot as u64 + 2);
                    assert!(seen.insert(slot));
                    if name == "attack_hold" {
                        assert!(matches!(
                            completion.result,
                            Err(RunError::MemoryBound { .. })
                        ));
                    } else if name == "json64k" || name == "bomb" {
                        assert!(completion.result.as_ref().unwrap().contains("\"err\""));
                    } else {
                        assert_eq!(completion.result.unwrap(), expected(name));
                    }
                }
                _ => panic!("unexpected reset"),
            }
        }
        println!(
            "{{\"event\":\"held\",\"n\":{n},\"fixture\":{name:?},\"threads\":{},\"owners\":{owners}}}",
            owners + 1
        );
        io::stdout().flush().unwrap();
        let seconds = seconds.map(|s| s.parse().unwrap()).unwrap_or(30);
        thread::sleep(Duration::from_secs(seconds));
        if name == "wait" {
            for slot in 0..n {
                pool.resume(slot, slot as u64 + 2);
            }
            let mut released = HashSet::new();
            for _ in 0..n {
                match pool.recv() {
                    Event::Done {
                        slot,
                        generation,
                        completion,
                    } => {
                        assert_eq!(generation, slot as u64 + 2);
                        assert!(released.insert(slot));
                        assert_eq!(completion.result.unwrap(), expected(name));
                    }
                    _ => panic!("expected WAIT completion"),
                }
            }
        }
        println!(
            "{{\"event\":\"released\",\"n\":{n},\"threads\":{},\"lost\":0}}",
            owners + 1
        );
    }
    fn hostile(&self, pool: &mut Pool) {
        let name = self.name;
        let n = self.n;
        let source = self.source.as_str();
        for i in 0..n {
            let run_mode = if name == "arena_attack" {
                Mode::Attack
            } else {
                Mode::Run
            };
            pool.start(
                0,
                job(
                    2 * i as u64 + 2,
                    source,
                    run_mode,
                    kvm::monotonic_ns() + 2_000_000_000,
                    true,
                ),
            );
            let c = done(pool, 0, 2 * i as u64 + 2);
            let run_ns = c.metrics.run_ns;
            match c.result {
                Err(e @ RunError::MemoryBound { .. }) if name == "arena_attack" => println!(
                    "{{\"event\":\"contained\",\"i\":{i},\"run_ns\":{run_ns},\"error\":{:?}}}",
                    e.to_string()
                ),
                Err(e) => panic!("unexpected hostile outcome: {e}"),
                Ok(r) => {
                    assert!(name == "bomb" || name == "json64k");
                    assert_eq!(
                        r,
                        "{\"err\":{\"name\":\"InternalError\",\"message\":\"out of memory\"}}"
                    );
                    println!(
                        "{{\"event\":\"contained\",\"i\":{i},\"run_ns\":{run_ns},\"result\":{r}}}"
                    );
                }
            }
            verify_reset(pool, 0);
            pool.start(
                0,
                job(
                    2 * i as u64 + 3,
                    include_str!("../../../fixtures/return2.js"),
                    Mode::Run,
                    kvm::monotonic_ns() + 2_000_000_000,
                    true,
                ),
            );
            assert_eq!(
                done(pool, 0, 2 * i as u64 + 3).result.unwrap(),
                "{\"ok\":2}"
            );
        }
        verify_reset(pool, 0);
    }
    fn bench(&self, pool: &mut Pool) {
        let name = self.name;
        let n = self.n;
        let source = self.source.as_str();
        let expected = self.expected;
        let mut resets = Vec::new();
        let mut runs = Vec::new();
        let mut tools = Vec::new();
        let mut all = Vec::new();
        let mut rtts = Vec::new();
        let (mut total_exits, mut total_calls, mut cpu_total) = (0, 0, 0);
        let wall = Instant::now();
        let mut seeds = HashSet::new();
        let mut randoms = HashSet::new();
        let mut libc_randoms = HashSet::new();
        verify_reset(pool, 0);
        for i in 0..n {
            let t = Instant::now();
            let generation = i as u64 + 2;
            pool.start(
                0,
                job(
                    generation,
                    source,
                    Mode::Run,
                    kvm::monotonic_ns() + 2_000_000_000,
                    true,
                ),
            );
            let c = done(pool, 0, generation);
            let r = c.result.unwrap();
            assert!(seeds.insert(c.seed));
            if name == "canary" {
                let receipt = entropy::receipt(c.seed)
                    .iter()
                    .map(|b| format!("{b:02x}"))
                    .collect::<String>();
                let prefix = format!("{{\"ok\":[\"{generation}\",\"{receipt}\",");
                assert!(r.starts_with(&prefix), "{r}");
                let fields: Vec<_> = r[prefix.len()..r.len() - 2].split(',').collect();
                assert_eq!(fields.len(), 3);
                randoms.insert(fields[0].to_string());
                assert_eq!(fields[1].len(), 34);
                libc_randoms.insert(fields[1].to_string());
            } else if name == "rng_negative" {
                randoms.insert(r.clone());
            } else {
                assert_eq!(r, expected(name));
            }
            let m = c.metrics;
            cpu_total += m.cpu_ns;
            total_exits += m.exits;
            total_calls += m.calls;
            resets.push(m.reset_ns);
            runs.push(m.run_ns);
            tools.push(m.tool_ns);
            rtts.push(m.wait_to_finish_ns);
            all.push(t.elapsed().as_nanos() as u64);
            println!(
                "{{\"event\":\"sample\",\"i\":{i},\"reset_ns\":{},\"run_ns\":{},\"exits\":{},\"calls\":{},\"owner_reply_ns\":{},\"cpu_ns\":{},\"wait_to_finish_ns\":{},\"result\":{r}}}",
                m.reset_ns, m.run_ns, m.exits, m.calls, m.tool_ns, m.cpu_ns, m.wait_to_finish_ns
            );
        }
        println!(
            "{{\"event\":\"summary\",\"fixture\":{name:?},\"n\":{n},\"reset\":{},\"run_to_done\":{},\"reset_bind_run\":{},\"owner_reply\":{},\"wait_to_finish\":{},\"cpu_ns\":{cpu_total},\"wall_ns\":{},\"vm_exits\":{total_exits},\"calls\":{total_calls},\"fresh_entropy_count\":{},\"math_random_distinct\":{},\"libc_random_distinct\":{}}}",
            stats(&resets),
            stats(&runs),
            stats(&all),
            stats(&tools),
            stats(&rtts),
            wall.elapsed().as_nanos(),
            seeds.len(),
            randoms.len(),
            libc_randoms.len()
        );
        verify_reset(pool, 0);
    }
}
fn stress(
    pool: &mut Pool,
    n: usize,
    slots: usize,
    fixture: fn(&str) -> String,
    expected: fn(&str) -> &'static str,
) {
    let names = ["return2", "one_tool", "promise10"];
    let mut completed = 0;
    let mut entropy = HashSet::new();
    for first in (0..n).step_by(slots) {
        let batch_start = Instant::now();
        let count = (n - first).min(slots);
        for slot in 0..count {
            let generation = (first + slot + 2) as u64;
            let marker = format!("slot{slot}gen{generation}");
            let source = format!(
                "{}{}",
                include_str!("../../../fixtures/stress.js")
                    .replace("$MARKER", &format!("{marker:?}")),
                fixture(names[(first + slot) % names.len()])
            );
            pool.start(
                slot,
                job(
                    generation,
                    &source,
                    Mode::Run,
                    // Queueing behind other real guests is part of this stress
                    // deadline. Tight stop-latency budgets are tested separately.
                    kvm::monotonic_ns() + 30_000_000_000,
                    true,
                ),
            );
        }
        let mut seen = HashSet::new();
        let mut max_run_ns = 0;
        for _ in 0..count {
            match pool.recv() {
                Event::Done {
                    slot,
                    generation,
                    completion,
                } => {
                    assert!(seen.insert(slot));
                    assert_eq!(generation, (first + slot + 2) as u64);
                    assert!(entropy.insert(completion.seed));
                    max_run_ns = max_run_ns.max(completion.metrics.run_ns);
                    assert_eq!(
                        completion.result.as_ref().unwrap_or_else(|error| panic!(
                            "stress completed={completed} slot={slot} generation={generation} batch_ns={} run_ns={} error={error}",
                            batch_start.elapsed().as_nanos(), completion.metrics.run_ns)),
                        expected(names[(first + slot) % names.len()])
                    );
                    completed += 1;
                }
                _ => panic!("expected stress completion"),
            }
        }
        println!(
            "{{\"event\":\"stress_batch\",\"completed\":{completed},\"batch_ns\":{},\"max_run_ns\":{max_run_ns}}}",
            batch_start.elapsed().as_nanos()
        );
    }
    for slot in 0..slots {
        verify_reset(pool, slot);
    }
    println!(
        "{{\"event\":\"stress\",\"runs\":{completed},\"slots\":{slots},\"canary_leaks\":0,\"cross_talk\":0,\"fresh_entropy\":{}}}",
        entropy.len()
    );
}
fn deadlines(pool: &mut Pool, n: usize) {
    let deadline = kvm::monotonic_ns() + 3_000_000_000;
    for slot in 0..n {
        pool.start(
            slot,
            job(
                2,
                include_str!("../../../fixtures/spin.js"),
                Mode::Ready,
                deadline,
                false,
            ),
        );
    }
    for _ in 0..n {
        assert!(matches!(pool.recv(), Event::Parked { generation: 2, .. }));
    }
    println!("{{\"event\":\"deadline_armed\",\"n\":{n},\"deadline_ns\":{deadline}}}");
    io::stdout().flush().unwrap();
    for slot in 0..n {
        pool.resume(slot, 2);
    }
    let mut seen = HashSet::new();
    let mut latencies = Vec::new();
    let mut stops = Vec::new();
    for _ in 0..n {
        match pool.recv() {
            Event::Done {
                slot,
                generation: 2,
                completion,
            } => {
                assert!(seen.insert(slot));
                assert!(
                    matches!(completion.result,Err(RunError::Deadline { deadline_ns }) if deadline_ns == deadline)
                );
                let stop = completion.stopped_ns.saturating_sub(deadline);
                let latency = completion.reset_done_ns.saturating_sub(deadline);
                stops.push(stop);
                latencies.push(latency);
                println!(
                    "{{\"event\":\"deadline\",\"slot\":{slot},\"generation\":2,\"deadline_ns\":{deadline},\"stop_latency_ns\":{stop},\"reset_error_latency_ns\":{latency}}}"
                );
            }
            _ => panic!("expected deadline"),
        }
    }
    // Every old lease must remain harmless after reuse, including late Resume commands.
    for slot in 0..n {
        pool.resume(slot, 2);
        pool.start(
            slot,
            job(
                3,
                include_str!("../../../fixtures/return2.js"),
                Mode::Run,
                kvm::monotonic_ns() + 5_000_000_000,
                true,
            ),
        );
    }
    for _ in 0..n {
        match pool.recv() {
            Event::Done {
                generation: 3,
                completion,
                ..
            } => assert_eq!(completion.result.unwrap(), "{\"ok\":2}"),
            _ => panic!("stale generation resumed or killed a new run"),
        }
    }
    println!(
        "{{\"event\":\"deadline_summary\",\"n\":{n},\"stop\":{},\"reset_error\":{},\"max_reset_error_ns\":{},\"reused_cleanly\":{n}}}",
        stats(&stops),
        stats(&latencies),
        latencies.iter().max().unwrap()
    );
}

fn staggered(pool: &mut Pool, n: usize) {
    assert!(n >= 2 && n.is_multiple_of(2));
    let early = kvm::monotonic_ns() + 1_000_000_000;
    let late = early + 600_000_000;
    for slot in 0..n {
        pool.start(
            slot,
            job(
                2,
                include_str!("../../../fixtures/spin.js"),
                Mode::Ready,
                if slot < n / 2 { early } else { late },
                false,
            ),
        );
    }
    for _ in 0..n {
        assert!(matches!(pool.recv(), Event::Parked { generation: 2, .. }));
    }
    // With W owners and 2W slots, each owner spins in its later-deadline slot
    // when the watchdog needs it to reset the earlier parked one.
    for slot in n / 2..n {
        pool.resume(slot, 2);
    }
    let mut seen = HashSet::new();
    for _ in 0..n {
        match pool.recv() {
            Event::Done {
                slot,
                generation: 2,
                completion,
            } => {
                assert!(seen.insert(slot));
                let deadline = if slot < n / 2 { early } else { late };
                assert!(
                    matches!(completion.result,Err(RunError::Deadline {deadline_ns}) if deadline_ns==deadline)
                );
                println!(
                    "{{\"event\":\"staggered_deadline\",\"slot\":{slot},\"reset_error_latency_ns\":{}}}",
                    completion.reset_done_ns.saturating_sub(deadline)
                );
            }
            _ => panic!("staggered deadline completion"),
        }
    }
    println!(
        "{{\"event\":\"staggered_summary\",\"runs\":{n},\"unrelated_spins_survived_early_expiry\":true}}"
    );
}
