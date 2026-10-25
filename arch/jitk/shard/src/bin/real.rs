#[path = "../entropy.rs"]
mod entropy;
#[path = "../real_kvm.rs"]
mod kvm;
use kvm::*;
use std::{
    fs::{self, File},
    io::{self, Write},
    thread,
    time::{Duration, Instant},
};
fn fixture(name: &str) -> String {
    match name{
 "ready"=>"",
 "return2"=>"return 2;",
 "one_tool"=>"return (await tools.echo(41))[0]+1;",
 "promise10"=>"return (await Promise.all(Array.from({length:10},(_,i)=>tools.echo(i)))).reduce((s,x)=>s+x[0],0);",
 "json64k"=>"const rows=Array.from({length:400},(_,i)=>({id:i,name:'item-'+String(i).padStart(5,'0'),active:i%2===0,score:i*5,tags:['one','two','three'],nested:{x:i%17,y:'hello'}}));let s=JSON.stringify({items:rows,padding:''});s=s.slice(0,-2)+'x'.repeat(65536-s.length)+s.slice(-2);const o=JSON.parse(s);if(o.items.length!==400||s.length!==65536)throw Error('size');return JSON.stringify(o).length;",
 "canary"=>"if(globalThis.__tenantCanary!==undefined)throw Error('leak');globalThis.__tenantCanary=run.entropy;const a=Math.random(),b=preparedRandom();if(os.read(101,new ArrayBuffer(32),0,32)!==-9)throw Error('seed exposed');let denied=false;try{os.snapshotCheckpoint()}catch(e){denied=true}if(!denied)throw Error('second checkpoint');return [run.generation,run.entropy,a,run.libcEntropy,b];",
 "rng_negative"=>"return Math.random();",
 "wait"=>"return (await tools.echo(41))[0]+1;",
 "spin"=>"while(true){}",
 _=>panic!("unknown fixture")}.into()
}
fn expected(name: &str) -> &str {
    match name {
        "return2" => "{\"ok\":2}",
        "one_tool" | "wait" => "{\"ok\":42}",
        "promise10" => "{\"ok\":45}",
        "json64k" => "{\"ok\":65536}",
        _ => "",
    }
}
fn execute(s: &mut Slot) -> (String, u64, u64, u64) {
    let mut calls = 0;
    let mut tool_ns = 0;
    let mut wait = None;
    loop {
        let e = s.exit();
        calls += e.requests.len();
        if e.op == 3 {
            return (
                e.finish.unwrap(),
                calls as u64,
                tool_ns,
                wait.map(|t: Instant| t.elapsed().as_nanos() as u64)
                    .unwrap_or(0),
            );
        }
        assert!(e.op == 1 || e.op == 2);
        if e.op == 2 && wait.is_none() {
            wait = Some(Instant::now());
        }
        let t = Instant::now();
        for r in e.requests.iter().rev() {
            s.reply(r);
        }
        if !e.requests.is_empty() {
            tool_ns += t.elapsed().as_nanos() as u64;
        }
    }
}
fn stats(v: &[u64]) -> String {
    let mut s = v.to_vec();
    s.sort_unstable();
    format!(
        "{{\"n\":{},\"p50_ns\":{},\"p99_ns\":{}}}",
        s.len(),
        s[s.len() / 2],
        s[(s.len() * 99 / 100).min(s.len() - 1)]
    )
}
fn proc_read(path: &str) -> String {
    fs::read_to_string(path).unwrap_or_default()
}
fn main() {
    let a: Vec<_> = std::env::args().collect();
    assert!(
        a.len() >= 4,
        "prepare IMAGE BASE | bench BASE FIXTURE N | hold BASE FIXTURE N SECONDS"
    );
    raise_fds();
    let kvm = Kvm::new();
    let mode = &a[1];
    if mode == "prepare" {
        prepare(&kvm, &a[2], &a[3]);
        return;
    }
    let snapshot = Snapshot::load(&a[2]);
    let name = &a[3];
    let n: usize = a.get(4).map(|x| x.parse().unwrap()).unwrap_or(100);
    assert!(n > 0);
    let mut entropy = File::open("/dev/urandom").unwrap();
    let source = fixture(name);
    println!(
        "{{\"event\":\"environment\",\"pid\":{},\"threads\":1,\"nested\":true,\"loadavg\":{:?},\"uptime\":{:?},\"kernel\":{:?}}}",
        std::process::id(),
        proc_read("/proc/loadavg").trim(),
        proc_read("/proc/uptime").trim(),
        proc_read("/proc/version").trim()
    );
    if mode == "hold" {
        let mut slots = Vec::new();
        let mut held = Vec::new();
        for i in 0..n {
            let avail = proc_read("/proc/meminfo")
                .lines()
                .find(|l| l.starts_with("MemAvailable:"))
                .unwrap()
                .split_whitespace()
                .nth(1)
                .unwrap()
                .parse::<usize>()
                .unwrap();
            assert!(avail > 2 * 1024 * 1024, "memory guard");
            let mut s = Slot::new(&kvm, snapshot.clone());
            s.bind(
                (i + 2) as u64,
                if name == "ready" { "" } else { &source },
                &mut entropy,
            );
            if name == "ready" {
                s.pause_after_repair();
                let e = s.exit();
                assert_eq!(e.op, 5);
                assert!(s.repaired());
            } else if name == "wait" {
                let e = s.exit();
                assert_eq!(e.op, 2);
                assert_eq!(e.requests.len(), 1);
                held.push(e.requests);
            } else if name != "ready" {
                let (r, _, _, _) = execute(&mut s);
                assert_eq!(r, expected(name));
                assert!(s.repaired());
            }
            slots.push(s);
        }
        println!("{{\"event\":\"held\",\"n\":{n},\"fixture\":{name:?},\"threads\":1}}");
        io::stdout().flush().unwrap();
        let seconds: u64 = a.get(5).map(|x| x.parse().unwrap()).unwrap_or(30);
        thread::sleep(Duration::from_secs(seconds));
        if name == "wait" {
            for (s, requests) in slots.iter_mut().zip(&held) {
                for r in requests {
                    s.reply(r);
                }
                let (r, _, _, _) = execute(s);
                assert_eq!(r, expected(name));
            }
        }
        println!("{{\"event\":\"released\",\"n\":{n},\"threads\":1,\"lost\":0}}");
        return;
    }
    assert_eq!(mode, "bench");
    let mut s = Slot::new(&kvm, snapshot);
    let mut resets = Vec::new();
    let mut runs = Vec::new();
    let mut tools = Vec::new();
    let mut all = Vec::new();
    let mut rtts = Vec::new();
    let mut total_exits = 0;
    let mut total_calls = 0;
    let mut cpu_total = 0;
    let wall = Instant::now();
    let mut seeds = std::collections::HashSet::new();
    let mut randoms = std::collections::HashSet::new();
    let mut libc_randoms = std::collections::HashSet::new();
    for i in 0..n {
        if i == 0 {
            assert!(s.pristine());
        }
        let whole = Instant::now();
        let cpu_start = clock_ns(2);
        let reset = s.reset();
        resets.push(reset);
        assert_eq!(s.canary(), 0);
        let generation = (i + 2) as u64;
        let seed = s.bind(generation, &source, &mut entropy);
        assert!(seeds.insert(seed));
        let t = Instant::now();
        let (r, calls, tool, roundtrip) = execute(&mut s);
        let run = t.elapsed().as_nanos() as u64;
        assert!(s.repaired());
        if name == "canary" {
            let prefix = format!(
                "{{\"ok\":[\"{generation}\",\"{}\",",
                entropy::receipt(seed)
                    .iter()
                    .map(|b| format!("{b:02x}"))
                    .collect::<String>()
            );
            assert!(r.starts_with(&prefix));
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
        let cpu_ns = clock_ns(2) - cpu_start;
        cpu_total += cpu_ns;
        total_exits += s.exits;
        total_calls += calls;
        runs.push(run);
        tools.push(tool);
        rtts.push(roundtrip);
        all.push(whole.elapsed().as_nanos() as u64);
        s.corrupt_canary(generation);
        println!(
            "{{\"event\":\"sample\",\"i\":{i},\"reset_ns\":{reset},\"run_ns\":{run},\"exits\":{},\"calls\":{calls},\"owner_reply_ns\":{tool},\"cpu_ns\":{cpu_ns},\"wait_to_finish_ns\":{roundtrip},\"result\":{r}}}",
            s.exits
        );
    }
    println!(
        "{{\"event\":\"summary\",\"fixture\":{name:?},\"n\":{n},\"reset\":{},\"run_to_done\":{},\"reset_bind_run\":{},\"owner_reply\":{},\"wait_to_finish\":{},\"cpu_ns\":{},\"wall_ns\":{},\"vm_exits\":{total_exits},\"calls\":{total_calls},\"fresh_entropy_count\":{},\"math_random_distinct\":{},\"libc_random_distinct\":{}}}",
        stats(&resets),
        stats(&runs),
        stats(&all),
        stats(&tools),
        stats(&rtts),
        cpu_total,
        wall.elapsed().as_nanos(),
        seeds.len(),
        randoms.len(),
        libc_randoms.len()
    );
    s.reset();
    assert!(s.pristine());
}
