mod vm;
use std::{
    collections::BTreeMap,
    fs::{self, File},
    io::Write,
    sync::{Arc, mpsc},
    thread,
    time::{Duration, Instant},
};
use vm::{ARENA, CTRL, Kvm, RAM, STUB, Slot, raise_fds};

fn quote(s: &str) -> String {
    let mut o = String::from("\"");
    for c in s.chars() {
        match c {
            '"' => o.push_str("\\\""),
            '\\' => o.push_str("\\\\"),
            '\n' => o.push_str("\\n"),
            '\r' => o.push_str("\\r"),
            '\t' => o.push_str("\\t"),
            c if c < ' ' => o.push_str(&format!("\\u{:04x}", c as u32)),
            c => o.push(c),
        }
    }
    o.push('"');
    o
}
fn read(p: &str) -> String {
    fs::read_to_string(p).unwrap_or_else(|e| format!("unavailable: {e}"))
}
fn numbers(s: &str) -> BTreeMap<String, u64> {
    s.lines()
        .filter_map(|l| {
            let (k, v) = l.split_once(':')?;
            Some((k.into(), v.split_whitespace().next()?.parse().ok()?))
        })
        .collect()
}
fn jsonmap(m: &BTreeMap<String, u64>) -> String {
    format!(
        "{{{}}}",
        m.iter()
            .map(|(k, v)| format!("{}:{v}", quote(k)))
            .collect::<Vec<_>>()
            .join(",")
    )
}
fn used_kib() -> u64 {
    let m = numbers(&read("/proc/meminfo"));
    m["MemTotal"] - m["MemAvailable"]
}
fn cpu_ticks() -> u64 {
    let s = read("/proc/self/stat");
    let fields: Vec<_> = s[s.rfind(')').unwrap() + 2..].split_whitespace().collect();
    fields[11].parse::<u64>().unwrap() + fields[12].parse::<u64>().unwrap()
}
fn threads() -> u64 {
    numbers(&read("/proc/self/status"))["Threads"]
}
fn metrics() -> String {
    let mem = read("/proc/meminfo");
    let slabs: String = read("/proc/slabinfo")
        .lines()
        .filter(|l| l.to_lowercase().contains("kvm"))
        .map(|l| format!("{l}\n"))
        .collect();
    let mut snap = BTreeMap::<String, u64>::new();
    let mut inside = false;
    for line in read("/proc/self/smaps").lines() {
        if line
            .split_whitespace()
            .next()
            .is_some_and(|s| s.contains('-'))
        {
            inside = line.contains("snapshot.bin");
        }
        if inside {
            for (k, v) in numbers(line) {
                *snap.entry(k).or_default() += v;
            }
        }
    }
    format!(
        "{{\"meminfo_kib\":{},\"smaps_rollup_kib\":{},\"snapshot_smaps_kib\":{},\"kvm_slabs\":{},\"fds\":{},\"threads\":{},\"cpu_ticks\":{},\"uptime\":{},\"loadavg\":{}}}",
        jsonmap(&numbers(&mem)),
        jsonmap(&numbers(&read("/proc/self/smaps_rollup"))),
        jsonmap(&snap),
        quote(&slabs),
        fs::read_dir("/proc/self/fd").unwrap().count(),
        threads(),
        cpu_ticks(),
        quote(&read("/proc/uptime")),
        quote(&read("/proc/loadavg"))
    )
}
fn idle(label: &str, millis: u64) {
    let before = cpu_ticks();
    let start = Instant::now();
    thread::sleep(Duration::from_millis(millis));
    println!(
        "{{\"event\":\"idle\",\"label\":{},\"elapsed_ns\":{},\"cpu_ticks\":{},\"clock_ticks_per_s\":100,\"threads\":{},\"loadavg\":{}}}",
        quote(label),
        start.elapsed().as_nanos(),
        cpu_ticks() - before,
        threads(),
        quote(&read("/proc/loadavg"))
    );
}
fn mix(mut x: u64) -> u64 {
    x = x.wrapping_add(0x9e3779b97f4a7c15);
    x = (x ^ (x >> 30)).wrapping_mul(0xbf58476d1ce4e5b9);
    x = (x ^ (x >> 27)).wrapping_mul(0x94d049bb133111eb);
    x ^ (x >> 31)
}

enum Cmd {
    Create(Vec<usize>, bool),
    Clear,
    Start(usize, u64),
    Complete(usize, usize, u64, Instant),
    Stop,
}
enum Event {
    Ack,
    Done {
        id: usize,
        latency_ns: u64,
        entry_ns: u64,
        calls: usize,
    },
    CompletionAck,
}
struct Owner {
    slots: BTreeMap<usize, Slot>,
    kvm: Arc<Kvm>,
    snapshot: Arc<File>,
}
impl Owner {
    fn shutdown(&mut self) -> std::io::Result<()> {
        for slot in self.slots.values_mut() {
            slot.shutdown()?;
        }
        Ok(())
    }
    fn handle(&mut self, cmd: Cmd, tx: &mpsc::Sender<Event>) {
        match cmd {
            Cmd::Create(ids, park) => {
                for id in ids {
                    // Stop well before 7 GiB global physical use; four owners can
                    // cross this conservative 6.5 GiB threshold by only a few VMs.
                    assert!(used_kib() < 6_500 * 1024, "memory safety stop");
                    let mut slot = Slot::new(&self.kvm, &self.snapshot, id);
                    if park {
                        slot.park_clean();
                    }
                    self.slots.insert(id, slot);
                }
                tx.send(Event::Ack).unwrap();
            }
            Cmd::Clear => {
                self.slots.clear();
                tx.send(Event::Ack).unwrap();
            }
            Cmd::Start(calls, generation) => {
                for (&id, slot) in &mut self.slots {
                    slot.reset();
                    slot.configure(generation, mix(id as u64 ^ generation), 0, calls);
                    slot.run_to_wait();
                }
                tx.send(Event::Ack).unwrap();
            }
            Cmd::Complete(id, call, generation, done) => {
                let slot = self.slots.get_mut(&id).unwrap();
                if slot.complete(call, generation) {
                    let entry_ns = done.elapsed().as_nanos() as u64;
                    slot.finish();
                    tx.send(Event::Done {
                        id,
                        latency_ns: done.elapsed().as_nanos() as u64,
                        entry_ns,
                        calls: slot.calls,
                    })
                    .unwrap();
                }
                tx.send(Event::CompletionAck).unwrap();
            }
            Cmd::Stop => unreachable!(),
        }
    }
}
struct Shard {
    local: Owner,
    senders: Vec<mpsc::Sender<Cmd>>,
    joins: Vec<thread::JoinHandle<std::io::Result<()>>>,
    tx: mpsc::Sender<Event>,
    rx: mpsc::Receiver<Event>,
    w: usize,
}
impl Shard {
    fn new(w: usize, kvm: Arc<Kvm>, snapshot: Arc<File>) -> Self {
        let (tx, rx) = mpsc::channel();
        let mut senders = Vec::new();
        let mut joins = Vec::new();
        for i in 1..w {
            let (cx, cr) = mpsc::channel();
            let et = tx.clone();
            let kvm = kvm.clone();
            let snapshot = snapshot.clone();
            joins.push(
                thread::Builder::new()
                    .name(format!("owner-{i}"))
                    .stack_size(256 * 1024)
                    .spawn(move || {
                        let mut owner = Owner {
                            slots: BTreeMap::new(),
                            kvm,
                            snapshot,
                        };
                        while let Ok(cmd) = cr.recv() {
                            if matches!(cmd, Cmd::Stop) {
                                break;
                            }
                            owner.handle(cmd, &et);
                        }
                        owner.shutdown()
                    })
                    .unwrap(),
            );
            senders.push(cx);
        }
        Self {
            local: Owner {
                slots: BTreeMap::new(),
                kvm,
                snapshot,
            },
            senders,
            joins,
            tx,
            rx,
            w,
        }
    }
    fn dispatch(&mut self, owner: usize, cmd: Cmd) {
        if owner == 0 {
            self.local.handle(cmd, &self.tx);
        } else {
            self.senders[owner - 1].send(cmd).unwrap();
        }
    }
    fn acks(&self) {
        for _ in 0..self.w {
            assert!(matches!(
                self.rx.recv_timeout(Duration::from_secs(120)).unwrap(),
                Event::Ack
            ));
        }
    }
    fn create(&mut self, from: usize, to: usize, park: bool) -> u64 {
        let t = Instant::now();
        for owner in (0..self.w).rev() {
            self.dispatch(
                owner,
                Cmd::Create((from..to).filter(|id| id % self.w == owner).collect(), park),
            );
        }
        self.acks();
        assert_eq!(threads(), self.w as u64);
        t.elapsed().as_nanos() as u64
    }
    fn clear(&mut self) -> u64 {
        let t = Instant::now();
        for owner in (0..self.w).rev() {
            self.dispatch(owner, Cmd::Clear);
        }
        self.acks();
        t.elapsed().as_nanos() as u64
    }
    fn start(&mut self, calls: usize, generation: u64) {
        for owner in (0..self.w).rev() {
            self.dispatch(owner, Cmd::Start(calls, generation));
        }
        self.acks();
    }
}
impl Shard {
    fn shutdown(&mut self) -> std::io::Result<()> {
        let mut error = None;
        for tx in self.senders.drain(..) {
            if tx.send(Cmd::Stop).is_err() {
                error.get_or_insert_with(|| std::io::Error::other("fixture owner exited"));
            }
        }
        for h in self.joins.drain(..) {
            match h.join() {
                Ok(Ok(())) => {}
                Ok(Err(e)) => {
                    error.get_or_insert(e);
                }
                Err(_) => {
                    error.get_or_insert_with(|| std::io::Error::other("fixture owner panicked"));
                }
            }
        }
        self.local.shutdown()?;
        match error {
            Some(e) => Err(e),
            None => Ok(()),
        }
    }
}
impl Drop for Shard {
    fn drop(&mut self) {
        let _ = self.shutdown();
    }
}

fn density(shard: &mut Shard, max: usize) {
    println!(
        "{{\"event\":\"density_baseline\",\"metrics\":{}}}",
        metrics()
    );
    let mut n = 0;
    let mut cumulative = 0u64;
    for target in [1, 16, 64, 256, 1024, 2048, 4096, 8192, 16384, 24576] {
        if target > max {
            break;
        }
        let use_kib = used_kib();
        // Forecast from the conservative 1 MiB/slot kill threshold, not just
        // observed means. Leave 512 MiB below the requested 7 GiB stop.
        if use_kib + (target - n) as u64 * 1024 > 6500 * 1024 {
            println!(
                "{{\"event\":\"density_stop\",\"next_n\":{target},\"used_kib\":{use_kib},\"reason\":\"conservative memory forecast\"}}"
            );
            break;
        }
        let create_ns = shard.create(n, target, true);
        cumulative += create_ns;
        n = target;
        thread::sleep(Duration::from_millis(100));
        println!(
            "{{\"event\":\"density\",\"n\":{n},\"create_batch_ns\":{create_ns},\"create_cumulative_ns\":{cumulative},\"metrics\":{}}}",
            metrics()
        );
        idle(&format!("parked-{n}"), 2000);
    }
    let teardown_ns = shard.clear();
    thread::sleep(Duration::from_millis(300));
    println!(
        "{{\"event\":\"density_teardown\",\"n\":{n},\"teardown_ns\":{teardown_ns},\"metrics\":{}}}",
        metrics()
    );
}

fn reset(shard: &mut Shard, bytes: &[u8], iterations: usize) {
    shard.create(0, 1, false);
    for kmax in [0, 1, 16, 256] {
        // Prefault sample storage before the memory baseline, so recording
        // measurements cannot look like a private-memory leak after churn.
        let mut reset_ns = vec![u64::MAX; iterations];
        let mut run_ns = vec![u64::MAX; iterations];
        let mut verify_ns = vec![u64::MAX; iterations];
        let slot = shard.local.slots.get_mut(&0).unwrap();
        slot.reset();
        assert!(slot.pristine(bytes));
        // Warm the control allocation, KVM stage-2 and allocator before baseline.
        slot.configure(1, mix(1), kmax, 0);
        assert_eq!(slot.run_exit(), 3);
        slot.validate(kmax);
        slot.reset();
        assert!(slot.pristine(bytes));
        let baseline = metrics();
        for i in 0..iterations {
            let slot = shard.local.slots.get_mut(&0).unwrap();
            reset_ns[i] = slot.reset();
            let v = Instant::now();
            assert!(slot.pristine(bytes), "full 2 MiB snapshot mismatch run {i}");
            verify_ns[i] = v.elapsed().as_nanos() as u64;
            let generation = (i + 2) as u64;
            // Vary dirty count within a series, testing shrinking/expanding sets.
            let k = if i % 4 == 0 { 0 } else { kmax };
            let t = Instant::now();
            slot.configure(generation, mix(generation ^ ((kmax as u64) << 32)), k, 0);
            assert_eq!(slot.run_exit(), 3);
            slot.validate(k);
            run_ns[i] = t.elapsed().as_nanos() as u64;
        }
        let dirty = metrics();
        let slot = shard.local.slots.get_mut(&0).unwrap();
        slot.reset();
        assert!(slot.pristine(bytes));
        println!(
            "{{\"event\":\"reset\",\"iterations\":{iterations},\"k_max\":{kmax},\"zero_k_every\":4,\"reset_ns\":{reset_ns:?},\"guest_run_validate_ns\":{run_ns:?},\"host_pristine_verify_ns\":{verify_ns:?},\"baseline\":{baseline},\"dirty\":{dirty},\"after_discard\":{},\"leaks\":0}}",
            metrics()
        );
    }
    shard.clear();
}

fn waits(shard: &mut Shard, n: usize, rounds: usize) {
    shard.create(0, n, false);
    for calls in [1, 10] {
        for round in 0..rounds {
            let generation = (calls * 100 + round + 1) as u64;
            let start = Instant::now();
            shard.start(calls, generation);
            let submit_wait_ns = start.elapsed().as_nanos();
            println!(
                "{{\"event\":\"all_waiting\",\"n\":{n},\"calls_per_vm\":{calls},\"round\":{round},\"submit_wait_ns\":{submit_wait_ns},\"metrics\":{}}}",
                metrics()
            );
            idle(&format!("wait-{n}-calls-{calls}-round-{round}"), 2000);
            // One reactor schedules all outstanding tool completions, no helper
            // processes or per-call/per-VM threads. Deadline order is random.
            let mut schedule = Vec::with_capacity(n * calls);
            for id in 0..n {
                for call in 0..calls {
                    schedule.push((
                        mix((id * calls + call) as u64 ^ generation) % 100_000_000,
                        id,
                        call,
                    ));
                }
            }
            schedule.sort_unstable();
            let start = Instant::now();
            let mut complete_ack = 0;
            let mut done = Vec::with_capacity(n);
            let mut entry = Vec::with_capacity(n);
            let mut seen = vec![false; n];
            let mut order = Vec::with_capacity(n * calls);
            for (delay, id, call) in schedule {
                let due = start + Duration::from_nanos(delay);
                if let Some(left) = due.checked_duration_since(Instant::now()) {
                    thread::sleep(left);
                }
                let completed = Instant::now();
                order.push([id, call]);
                shard.dispatch(id % shard.w, Cmd::Complete(id, call, generation, completed));
                while let Ok(e) = shard.rx.try_recv() {
                    consume_event(
                        e,
                        &mut complete_ack,
                        &mut done,
                        &mut entry,
                        &mut seen,
                        calls,
                    );
                }
            }
            while complete_ack < n * calls {
                let e = shard.rx.recv_timeout(Duration::from_secs(120)).unwrap();
                consume_event(
                    e,
                    &mut complete_ack,
                    &mut done,
                    &mut entry,
                    &mut seen,
                    calls,
                );
            }
            assert_eq!(done.len(), n);
            assert!(seen.iter().all(|&v| v));
            assert_eq!(threads(), shard.w as u64);
            println!(
                "{{\"event\":\"wait_done\",\"n\":{n},\"calls_per_vm\":{calls},\"round\":{round},\"completion_to_entry_ns\":{entry:?},\"completion_to_finish_ns\":{done:?},\"completion_order\":{order:?},\"elapsed_completion_ns\":{},\"completions\":{complete_ack},\"lost\":0,\"duplicates\":0,\"threads\":{}}}",
                start.elapsed().as_nanos(),
                threads()
            );
        }
    }
    let teardown_ns = shard.clear();
    println!("{{\"event\":\"wait_teardown\",\"teardown_ns\":{teardown_ns}}}");
}
fn consume_event(
    e: Event,
    ack: &mut usize,
    done: &mut Vec<u64>,
    entry: &mut Vec<u64>,
    seen: &mut [bool],
    calls: usize,
) {
    match e {
        Event::Done {
            id,
            latency_ns,
            entry_ns,
            calls: got,
        } => {
            assert!(!seen[id]);
            assert_eq!(got, calls);
            seen[id] = true;
            done.push(latency_ns);
            entry.push(entry_ns);
        }
        Event::CompletionAck => *ack += 1,
        Event::Ack => panic!("unexpected ACK"),
    }
}

fn selftest(shard: &mut Shard, bytes: &[u8]) {
    shard.create(0, 1, false);
    let s = shard.local.slots.get_mut(&0).unwrap();
    s.corrupt_for_test();
    s.configure(1, 123, 1, 0);
    assert_eq!(s.run_exit(), 3);
    assert_eq!(s.word(CTRL + 64), 1);
    s.reset();
    assert!(s.pristine(bytes));
    s.configure(2, 456, 1, 0);
    assert_eq!(s.run_exit(), 3);
    s.validate(1);
    s.reset();
    assert!(s.pristine(bytes));
    println!(
        "{{\"event\":\"selftest\",\"injected_stale_canary_detected\":true,\"reset_cleared_it\":true}}"
    );
    shard.clear();
    waits(shard, 16, 1);
}
pub fn run() {
    let args: Vec<_> = std::env::args().collect();
    let mode = args.get(1).map(String::as_str).unwrap_or("selftest");
    let amount = args.get(2).map(|s| s.parse::<usize>().unwrap());
    let w = std::env::var("JITK_SHARD_THREADS")
        .map(|s| s.parse().unwrap())
        .unwrap_or(4);
    assert!((1..=6).contains(&w));
    raise_fds();
    let mut bytes = vec![0xa5; RAM];
    bytes[..STUB.len()].copy_from_slice(STUB);
    bytes[CTRL..CTRL + 81920].fill(0);
    let mut f = File::create("snapshot.bin").unwrap();
    f.write_all(&bytes).unwrap();
    f.sync_all().unwrap();
    drop(f);
    let snapshot = Arc::new(File::open("snapshot.bin").unwrap());
    let kvm = Kvm::new();
    println!(
        "{{\"event\":\"environment\",\"mode\":{},\"threads_total\":{w},\"owners\":{w},\"nested\":true,\"page_size\":4096,\"ram_bytes\":{RAM},\"transport_bytes\":81920,\"guest_bytes\":{},\"kvm_run_bytes\":{},\"kernel\":{},\"loadavg\":{},\"cpuinfo\":{},\"dependencies\":\"none; raw Linux UAPI ioctls\"}}",
        quote(mode),
        STUB.len(),
        kvm.run_size,
        quote(&read("/proc/version")),
        quote(&read("/proc/loadavg")),
        quote(&read("/proc/cpuinfo"))
    );
    let mut shard = Shard::new(w, kvm, snapshot);
    // Barrier: every owner exists before the baseline/thread invariant.
    shard.create(0, 0, false);
    match mode {
        "density" => density(&mut shard, amount.unwrap_or(24576)),
        "reset" => reset(&mut shard, &bytes, amount.unwrap_or(1000)),
        "wait" => waits(&mut shard, amount.unwrap_or(1024), 3),
        "selftest" => selftest(&mut shard, &bytes),
        _ => panic!("use selftest | density [max] | reset [iterations] | wait [VMs]"),
    }
    shard.shutdown().expect("fixture shutdown");
}
