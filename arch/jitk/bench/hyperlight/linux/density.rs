// Linux/KVM density and latency probe for the Hyperlight baseline.
//
// Same guest (hyperlight-js runtime at the pinned commit), same handler
// (../bootstrap.js) and same sandbox construction as ../worker.rs; the only
// differences are the KVM backend and that the tool host is answered in-process
// (a synthetic echo, as jitk's shard `hold`/`bench` fixtures do), so one process
// can retain N sandboxes created from one shared snapshot file.
//
//   density save SNAPSHOT                    build a tenant-free snapshot
//   density hold SNAPSHOT FIXTURE N          retain N sandboxes, then block on stdin
//   density bench SNAPSHOT FIXTURE N MODE    MODE: clone (from_snapshot per run) | restore
//
// FIXTURE: ready (no run), return2, one_tool. Heap/scratch for `save` come from
// HL_HEAP_BYTES / HL_SCRATCH_BYTES (default: worker.rs's 16 MiB / 16 MiB).
use hyperlight_host::sandbox::snapshot::{OciTag, Snapshot};
use hyperlight_host::{HostFunctions, Sandbox, func::Registerable};
use hyperlight_js::{SandboxBuilder, Script};
use hyperlight_js_common::{Bytes, encode_json_return};
use serde_json::{Value, json};
use std::io::{self, Read, Write};
use std::sync::Arc;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
type E = Box<dyn std::error::Error>;
const SOURCE: &str = include_str!("../bootstrap.js");

fn fail(message: &str) -> hyperlight_host::HyperlightError {
    hyperlight_host::HyperlightError::Error(message.into())
}
// In-process tool host: echo returns its argument list, like the shard fixtures.
fn exchange(v: &Value) -> Result<Value, String> {
    match v["t"].as_str() {
        Some("log") => Ok(Value::Null),
        Some("call") if v["ns"] == "tools" && v["fn"] == "echo" => {
            Ok(json!({"t":"ret","id":v["id"],"ok":v["args"]}))
        }
        _ => Err("invalid exchange".into()),
    }
}
fn env_bytes(name: &str, default: usize) -> Result<usize, E> {
    Ok(match std::env::var(name) {
        Ok(v) => v.parse()?,
        Err(_) => default,
    })
}
fn save(path: &str) -> Result<(), E> {
    let heap = env_bytes("HL_HEAP_BYTES", 16 * 1048576)?;
    let scratch = env_bytes("HL_SCRATCH_BYTES", 16 * 1048576)?;
    let mut p = SandboxBuilder::new()
        .with_guest_heap_size(heap as u64)
        .with_guest_scratch_size(scratch)
        .with_host_print_fn((|_: String| Ok::<i32, hyperlight_host::HyperlightError>(0)).into())
        .build()?;
    p.host_module("jitk").register_js("exchange", |a, b| {
        if !b.is_empty() {
            return Err(hyperlight_js::HyperlightError::Error("binary disabled".into()));
        }
        let v = a
            .as_array()
            .and_then(|a| if a.len() == 1 { a.first() } else { None })
            .ok_or_else(|| hyperlight_js::HyperlightError::Error("arity".into()))?;
        let r = exchange(v).map_err(hyperlight_js::HyperlightError::Error)?;
        Ok(hyperlight_js::FnReturn::Json(r.to_string()))
    });
    let mut s = p.load_runtime()?;
    s.add_handler("handler", Script::from_content(SOURCE))?;
    let mut loaded = s.get_loaded_sandbox()?;
    let snap = loaded.snapshot()?;
    let digest = snap.save(path, &OciTag::new("base")?)?;
    println!("{}", json!({"event":"saved","heap_bytes":heap,"scratch_bytes":scratch,"digest":format!("{digest:?}")}));
    Ok(())
}
fn funcs() -> Result<HostFunctions, E> {
    let mut f = HostFunctions::default();
    f.register_host_function("HostPrint", |_: String| -> hyperlight_host::Result<i32> { Ok(0) })?;
    f.register_host_function("CurrentTimeMicros", || -> hyperlight_host::Result<u64> {
        Ok(SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_micros() as u64)
    })?;
    f.register_host_function(
        "CallHostJsFunction",
        |ns: String, fun: String, a: Vec<u8>, b: Vec<Bytes>| -> hyperlight_host::Result<Vec<u8>> {
            let sidecar: Vec<u8> = b.iter().flat_map(|x| x.iter().copied()).collect();
            if ns != "jitk" || fun != "exchange" || !(sidecar.is_empty() || sidecar == [0, 0, 0, 0]) {
                return Err(fail("invalid host function"));
            }
            let a: Vec<Value> = serde_json::from_slice(&a)?;
            if a.len() != 1 {
                return Err(fail("arity"));
            }
            let r = exchange(&a[0]).map_err(|e| fail(&e))?;
            Ok(encode_json_return(&r.to_string()))
        },
    )?;
    Ok(f)
}
fn clone(s: &Arc<Snapshot>) -> Result<Sandbox, E> {
    Ok(Sandbox::from_snapshot(s.clone(), funcs()?, None)?)
}
// The same run event shape the Mac adapter sends (backend.ts).
fn event(fixture: &str) -> Option<(Value, Value)> {
    match fixture {
        "ready" => None,
        "return2" => Some((json!({"t":"run","code":"return 2;","ns":{}}), json!({"t":"done","ok":2}))),
        "one_tool" => Some((
            json!({"t":"run","code":"return (await tools.echo(41))[0]+1;","ns":{"tools":["echo"]}}),
            json!({"t":"done","ok":42}),
        )),
        _ => panic!("unknown fixture {fixture}"),
    }
}
fn call(s: &mut Sandbox, v: &Value, expected: &Value) -> Result<(), E> {
    let result: Vec<u8> = s.call("RunHandler", ("handler".to_string(), v.to_string().into_bytes(), true))?;
    let got: Value = serde_json::from_slice(&result)?;
    if &got != expected {
        return Err(format!("unexpected result {got}").into());
    }
    Ok(())
}
fn proc_read(path: &str) -> String {
    std::fs::read_to_string(path).unwrap_or_default().trim().to_string()
}
fn cpu_ns() -> u128 {
    // SAFETY: getrusage writes one rusage struct into the provided storage.
    let mut u: libc::rusage = unsafe { std::mem::zeroed() };
    // SAFETY: valid pointer to owned storage, RUSAGE_SELF.
    unsafe { libc::getrusage(libc::RUSAGE_SELF, &mut u) };
    let t = |v: libc::timeval| v.tv_sec as u128 * 1_000_000_000 + v.tv_usec as u128 * 1000;
    t(u.ru_utime) + t(u.ru_stime)
}
fn stats(v: &mut [u64]) -> Value {
    v.sort_unstable();
    let n = v.len();
    json!({"n":n,"p50_ns":v[(n - 1) / 2],"p99_ns":v[(n * 99).div_ceil(100) - 1],"mean_ns":v.iter().sum::<u64>() / n as u64})
}
fn main() -> Result<(), E> {
    let a: Vec<String> = std::env::args().collect();
    let mode = a.get(1).map(String::as_str).ok_or("density save|hold|bench SNAPSHOT ...")?;
    let path = a.get(2).ok_or("snapshot path required")?;
    if mode == "save" {
        return save(path);
    }
    let fixture = a.get(3).map(String::as_str).ok_or("fixture required")?;
    let n: usize = a.get(4).ok_or("count required")?.parse()?;
    if n == 0 || n > 16384 {
        return Err("count must be 1..16384".into());
    }
    println!(
        "{}",
        json!({"event":"environment","pid":std::process::id(),"threads":1,"mode":mode,"fixture":fixture,"n":n,
               "loadavg":proc_read("/proc/loadavg"),"uptime":proc_read("/proc/uptime"),"kernel":proc_read("/proc/version")})
    );
    let snap = Arc::new(Snapshot::load(path, OciTag::new("base")?)?);
    let run = event(fixture);
    if mode == "hold" {
        let mut held = Vec::with_capacity(n);
        let t = Instant::now();
        for _ in 0..n {
            let mut s = clone(&snap)?;
            if let Some((v, expected)) = &run {
                call(&mut s, v, expected)?;
            }
            held.push(s);
        }
        println!("{}", json!({"event":"held","n":n,"fixture":fixture,"threads":1,"build_ns":t.elapsed().as_nanos()}));
        io::stdout().flush()?;
        // Block until the controller closes stdin (or signals the process).
        let mut sink = Vec::new();
        io::stdin().read_to_end(&mut sink)?;
        drop(held);
        return Ok(());
    }
    if mode != "bench" {
        return Err("unknown mode".into());
    }
    let how = a.get(5).map(String::as_str).ok_or("bench MODE: clone|restore")?;
    let (v, expected) = run.ok_or("bench needs a running fixture")?;
    let mut create = Vec::with_capacity(n);
    let mut execute = Vec::with_capacity(n);
    let mut total = Vec::with_capacity(n);
    let mut reused = if how == "restore" { Some(clone(&snap)?) } else { None };
    for _ in 0..5 {
        let mut s = clone(&snap)?;
        call(&mut s, &v, &expected)?;
    }
    let cpu0 = cpu_ns();
    let wall0 = Instant::now();
    for _ in 0..n {
        let t = Instant::now();
        match reused.as_mut() {
            Some(s) => {
                s.restore(snap.clone())?;
                let r = Instant::now();
                create.push((r - t).as_nanos() as u64);
                call(s, &v, &expected)?;
                execute.push(r.elapsed().as_nanos() as u64);
            }
            None => {
                let mut s = clone(&snap)?;
                let r = Instant::now();
                create.push((r - t).as_nanos() as u64);
                call(&mut s, &v, &expected)?;
                execute.push(r.elapsed().as_nanos() as u64);
                drop(s);
            }
        }
        total.push(t.elapsed().as_nanos() as u64);
    }
    let cpu = cpu_ns() - cpu0;
    println!(
        "{}",
        json!({"event":"bench","mode":how,"fixture":fixture,"n":n,"create":stats(&mut create),"execute":stats(&mut execute),
               "total":stats(&mut total),"cpu_ns_per_run":cpu / n as u128,"wall_ns":wall0.elapsed().as_nanos(),
               "loadavg":proc_read("/proc/loadavg")})
    );
    Ok(())
}
