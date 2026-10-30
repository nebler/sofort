use hyperlight_host::{Sandbox, HostFunctions, func::Registerable};
use hyperlight_host::sandbox::snapshot::{Snapshot, OciTag};
use hyperlight_js::{LoadedJSSandbox, SandboxBuilder, Script};
use hyperlight_js_common::{Bytes, encode_json_return};
use serde_json::{Value, json};
use std::{io::{self, BufRead, Read, Write}, sync::Arc, time::{Instant,SystemTime,UNIX_EPOCH}};
type E = Box<dyn std::error::Error>;
const MAX: usize = 1048576;
const SOURCE: &str = include_str!("bootstrap.js");
fn emit(m: &Value) -> Result<(),E> {
    let mut wire=String::new();
    for c in m.to_string().chars() {
        if c.is_ascii() { wire.push(c); } else {
            let mut pair=[0u16;2];
            for u in c.encode_utf16(&mut pair) {wire.push_str(&format!("\\u{u:04x}"));}
        }
    }
    if wire.len()>MAX {return Err("frame limit".into())}
    let mut out=io::stdout().lock(); writeln!(out,"{wire}")?;out.flush()?;Ok(())
}
fn recv() -> Result<Option<Value>,E> {
    let mut line=Vec::new();
    let n=io::stdin().lock().take((MAX+2) as u64).read_until(b'\n',&mut line)?;
    if n==0 {return Ok(None)}
    if line.len()>MAX+1 || line.last()!=Some(&b'\n') || !line.is_ascii() {return Err("invalid wire".into())}
    Ok(Some(serde_json::from_slice(&line)?))
}
fn exchange(v:Value) -> Result<Value,E> {
    emit(&v)?;
    if v["t"]=="log" {return Ok(Value::Null)}
    if v["t"]!="call" {return Err("invalid exchange".into())}
    let r=recv()?.ok_or("reply EOF")?;
    if r["t"]!="ret" || r["id"]!=v["id"] {return Err("reply mismatch".into())}
    Ok(r)
}
// Frames cross the bridge as one JSON string each way and bootstrap.js
// JSON.parses replies. Hyperlight-JS converts any other host-function value
// node by node through serde and rquickjs: a 318 KB reply of 7000 objects
// took 0.3-0.5 s that way and 30-40 ms as a string (bench/hyperlight/README.md).
fn bridge(args:&Value) -> Result<String,String> {
    let frame=args.as_array().and_then(|a| if a.len()==1 {a[0].as_str()} else {None}).ok_or("arity")?;
    let v:Value=serde_json::from_str(frame).map_err(|e|e.to_string())?;
    let r=exchange(v).map_err(|e|e.to_string())?;
    Ok(if r.is_null() {r.to_string()} else {Value::String(r.to_string()).to_string()})
}
// Transport sized for the v1 frame limit in both directions. Hyperlight-JS's
// default carries 16 KiB per message; a host-function reply gets whatever
// G2H pool is left beside its request, so that pool holds two messages.
const BUF: usize = 65536;
const MSG_BUFS: usize = (MAX+BUF).div_ceil(BUF); // one frame plus framing slack
// A frame as a JSON string literal: escaping at most doubles it.
const STR_BUFS: usize = (2*MAX+BUF).div_ceil(BUF);
const fn pool_pages(bufs: usize) -> usize {bufs*BUF/4096}
// H2G: the run frame plus Hyperlight-JS's control spare.
const H2G_PAGES: usize = pool_pages(MSG_BUFS+1);
// G2H: one small-buffer page, then request and reply side by side.
const G2H_PAGES: usize = 1+pool_pages(2*STR_BUFS);
const HEAP: usize = 16*1048576;
// A restored guest takes a scratch page for every heap page it writes
// (copy-on-write and zero-init faults), so scratch holds the whole heap,
// the pools above, and the earlier 16 MiB for stack, page tables and runtime.
// Whole MiB: the macOS host maps scratch in 16 KiB pages.
const SCRATCH: usize = (2*HEAP+(H2G_PAGES+G2H_PAGES)*4096).next_multiple_of(1048576);
fn fresh() -> Result<LoadedJSSandbox,E> {
    let mut p=SandboxBuilder::new().with_guest_heap_size(HEAP as u64)
        .with_guest_scratch_size(SCRATCH)
        .with_input_transport_buffer_size(BUF).with_output_transport_buffer_size(BUF)
        .with_input_transport_pool_pages(H2G_PAGES).with_output_transport_pool_pages(G2H_PAGES)
        .with_host_print_fn((|_:String| Ok::<i32,hyperlight_host::HyperlightError>(0)).into()).build()?;
    p.host_module("jitk").register_js("exchange",|a,b| {
        if !b.is_empty() {return Err(hyperlight_js::HyperlightError::Error("binary disabled".into()))}
        Ok(hyperlight_js::FnReturn::Json(bridge(&a).map_err(hyperlight_js::HyperlightError::Error)?))
    });
    let mut s=p.load_runtime()?;
    s.add_handler("handler",Script::from_content(SOURCE))?;
    Ok(s.get_loaded_sandbox()?)
}
fn funcs() -> Result<HostFunctions,E> {
    let mut f=HostFunctions::default();
    f.register_host_function("HostPrint",|_:String| -> hyperlight_host::Result<i32> {Ok(0)})?;
    f.register_host_function("CurrentTimeMicros",|| -> hyperlight_host::Result<u64> {
        Ok(SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_micros() as u64)
    })?;
    f.register_host_function("CallHostJsFunction",|ns:String,fun:String,a:Vec<u8>,b:Vec<Bytes>| -> hyperlight_host::Result<Vec<u8>> {
        // Raw snapshot callbacks see the encoded count=0 sidecar header,
        // whereas register_js above receives already-decoded blobs.
        let sidecar:Vec<u8>=b.iter().flat_map(|x|x.iter().copied()).collect();
        if ns!="jitk" || fun!="exchange" || !(sidecar.is_empty() || sidecar==[0,0,0,0]) {
            return Err(hyperlight_host::HyperlightError::Error("invalid host function".into()))
        }
        let a:Value=serde_json::from_slice(&a)?;
        Ok(encode_json_return(&bridge(&a).map_err(hyperlight_host::HyperlightError::Error)?))
    })?; Ok(f)
}
fn clone(s:Arc<Snapshot>) -> Result<Sandbox,E> {Ok(Sandbox::from_snapshot(s,funcs()?,None)?)}
fn call(s:&mut Sandbox,v:&Value) -> Result<Value,E> {
    match s.call::<Vec<u8>>("RunHandler",("handler".to_string(),v.to_string().into_bytes(),true)) {
        Ok(result)=>Ok(serde_json::from_slice(&result)?),
        // An abort poisons this single-use sandbox. Report it as the run's
        // error instead of exiting: Hyperlight-JS aborts on allocation
        // failure (MallocFailed = 13, or a Rust alloc panic) where QuickJS
        // would throw, so name that out of memory.
        Err(hyperlight_host::HyperlightError::GuestAborted(code,msg))=>{
            let oom=code==13 || msg.contains("memory allocation");
            let msg:String=msg.chars().take(1024).collect();
            Ok(json!({"t":"done","err":{"name":"Error",
                "message":format!("{}Hyperlight guest stopped (code {code}): {msg}",if oom {"out of memory: "} else {""})}}))
        }
        Err(e)=>Err(e.into()),
    }
}
fn main() -> Result<(),E> {
    let args:Vec<String>=std::env::args().collect();
    let mode=args.get(1).map(String::as_str).unwrap_or("strict");
    let path=args.get(2).map(String::as_str).ok_or("snapshot path required (worker MODE SNAPSHOT)")?;
    if mode=="save" {
        let mut s=fresh()?;let snap=s.snapshot()?;
        let digest=snap.save(path,&OciTag::new("base")?)?;
        eprintln!("snapshot digest {digest:?}");return Ok(())
    }
    let snap=if mode=="fresh" {None} else {Some(Arc::new(Snapshot::load(path,OciTag::new("base")?)?))};
    // Memory probe: retain N tenant-free logical clones in the shared HW VM.
    // One process for N=1/17/33 makes the shared versus marginal cost explicit.
    if mode=="hold" {
        let n:usize=args.get(3).ok_or("hold count")?.parse()?;
        if n==0 || n>64 {return Err("hold count must be 1..64".into())}
        let mut parked=Vec::new();
        for _ in 0..n {parked.push(clone(snap.clone().unwrap())?)}
        emit(&json!({"t":"ready","v":1}))?;
        let _=recv()?;drop(parked);return Ok(())
    }
    // Strict worker establishes its one new HW VM before advertising ready.
    let mut strict=if mode=="strict" {Some(clone(snap.clone().unwrap())?)} else {None};
    emit(&json!({"t":"ready","v":1}))?;
    while let Some(v)=recv()? {
        if v["t"]!="run" {return Err("expected run".into())}
        let t=Instant::now();
        let result=if let Some(s)=strict.as_mut() {call(s,&v)?} else if mode=="fresh" {
            let mut s=fresh()?;
            let result=s.handle_event("handler",v.to_string(),None)?;
            // Emit while this job's sandbox is resident; then drop it.
            let result:Value=serde_json::from_str(&result)?;emit(&result)?;
            eprintln!("{}",json!({"internal_ns":t.elapsed().as_nanos()}));
            continue;
        } else {
            let mut s=clone(snap.clone().unwrap())?;
            let result=call(&mut s,&v)?;emit(&result)?;
            eprintln!("{}",json!({"internal_ns":t.elapsed().as_nanos()}));
            continue;
        };
        emit(&result)?;
        eprintln!("{}",json!({"internal_ns":t.elapsed().as_nanos()}));
        if mode=="strict" {break}
    }
    Ok(())
}
