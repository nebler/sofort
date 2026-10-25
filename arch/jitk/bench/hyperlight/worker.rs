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
fn fresh() -> Result<LoadedJSSandbox,E> {
    let mut p=SandboxBuilder::new().with_guest_heap_size(16*1048576)
        .with_guest_scratch_size(16*1048576)
        .with_host_print_fn((|_:String| Ok::<i32,hyperlight_host::HyperlightError>(0)).into()).build()?;
    p.host_module("jitk").register_js("exchange",|a,b| {
        if !b.is_empty() {return Err(hyperlight_js::HyperlightError::Error("binary disabled".into()))}
        let v=a.as_array().and_then(|a| if a.len()==1 {a.first()} else {None})
            .ok_or_else(||hyperlight_js::HyperlightError::Error("arity".into()))?;
        let r=exchange(v.clone()).map_err(|e|hyperlight_js::HyperlightError::Error(e.to_string()))?;
        Ok(hyperlight_js::FnReturn::Json(r.to_string()))
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
        let a:Vec<Value>=serde_json::from_slice(&a)?;
        if a.len()!=1 {return Err(hyperlight_host::HyperlightError::Error("arity".into()))}
        let r=exchange(a[0].clone()).map_err(|e|hyperlight_host::HyperlightError::Error(e.to_string()))?;
        Ok(encode_json_return(&r.to_string()))
    })?; Ok(f)
}
fn clone(s:Arc<Snapshot>) -> Result<Sandbox,E> {Ok(Sandbox::from_snapshot(s,funcs()?,None)?)}
fn call(s:&mut Sandbox,v:&Value) -> Result<Value,E> {
    let result:Vec<u8>=s.call("RunHandler",("handler".to_string(),v.to_string().into_bytes(),true))?;
    Ok(serde_json::from_slice(&result)?)
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
