use hyperlight_js::{SandboxBuilder,Script};
use hyperlight_host::{Sandbox,HostFunctions,func::Registerable};
use hyperlight_js_common::{Bytes,encode_json_return};
use serde_json::json;
use std::time::{Instant,SystemTime,UNIX_EPOCH};
use std::sync::Arc;
use hyperlight_host::sandbox::snapshot::{Snapshot,OciTag};
type E=Box<dyn std::error::Error>;
fn funcs()->Result<HostFunctions,E>{
    let mut f=HostFunctions::default();
    f.register_host_function("CurrentTimeMicros",||->hyperlight_host::Result<u64>{
        Ok(SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_micros() as u64)
    })?;
    f.register_host_function("CallHostJsFunction",|ns:String,fun:String,a:Vec<u8>,_b:Vec<Bytes>|->hyperlight_host::Result<Vec<u8>>{
        if ns!="math"||fun!="add"{return Err(hyperlight_host::HyperlightError::Error("tool".into()));}
        let a:Vec<i64>=serde_json::from_slice(&a)?;
        if a.len()!=2{return Err(hyperlight_host::HyperlightError::Error("arity".into()));}
        Ok(encode_json_return(&(a[0]+a[1]).to_string()))
    })?;
    Ok(f)
}
fn call(s:&mut Sandbox)->Result<(),E>{
    let result:Vec<u8>=s.call("RunHandler",("handler".to_string(),b"{}".to_vec(),true))?;
    assert_eq!(result,b"42");Ok(())
}
fn mem(n:usize){unsafe{
    let mut r:libc::rusage_info_v0=std::mem::zeroed();
    assert_eq!(libc::proc_pid_rusage(libc::getpid(),0,&mut r as *mut _ as *mut libc::rusage_info_t),0);
    println!("{}",json!({"metric":"memory","n":n,"rss":r.ri_resident_size,"footprint":r.ri_phys_footprint,"wired":r.ri_wired_size}));
}}
fn main()->Result<(),E>{
    let mode=std::env::args().nth(1).unwrap_or_default();
    let path="/tmp/jitk-09/snapshot-oci";
    if mode=="load"{
        mem(0);let t=Instant::now();
        let snap=Arc::new(Snapshot::load(path,OciTag::new("base")?)?);
        println!("{}",json!({"metric":"disk_load","i":0,"ns":t.elapsed().as_nanos()}));
        let mut s=Sandbox::from_snapshot(snap,funcs()?,None)?;
        println!("{}",json!({"metric":"disk_load_create","i":0,"ns":t.elapsed().as_nanos()}));
        call(&mut s)?;
        println!("{}",json!({"metric":"disk_load_to_result","i":0,"ns":t.elapsed().as_nanos()}));
        mem(1);return Ok(())
    }

    let mut p=SandboxBuilder::new().build()?;
    p.host_module("math").register("add",|a:i64,b:i64|a+b);
    let mut s=p.load_runtime()?;
    s.add_handler("handler",Script::from_content("import * as math from 'math'; let n=0; function handler(e){return e.count?++n:math.add(20,22)}"))?;
    let mut s=s.get_loaded_sandbox()?;
    let snap=s.snapshot()?;drop(s);
    if mode=="save"{
        let t=Instant::now();let digest=snap.save(path,&OciTag::new("base")?)?;
        println!("{}",json!({"metric":"disk_save","ns":t.elapsed().as_nanos(),"digest":format!("{digest:?}")}));
        return Ok(())
    }
    for i in 0..40{
        let t=Instant::now();let mut s=Sandbox::from_snapshot(snap.clone(),funcs()?,None)?;
        println!("{}",json!({"metric":"clone_create","i":i,"ns":t.elapsed().as_nanos()}));
        call(&mut s)?;
        println!("{}",json!({"metric":"clone_to_result","i":i,"ns":t.elapsed().as_nanos()}));
    }
    mem(0);let mut pool=Vec::new();
    for n in 1..=32{
        let mut s=Sandbox::from_snapshot(snap.clone(),funcs()?,None)?;call(&mut s)?;let value:Vec<u8>=s.call("RunHandler",("handler".to_string(),br#"{"count":true}"#.to_vec(),true))?;assert_eq!(value,b"1");pool.push(s);mem(n);
    }
    for s in &mut pool{let value:Vec<u8>=s.call("RunHandler",("handler".to_string(),br#"{"count":true}"#.to_vec(),true))?;assert_eq!(value,b"2");}
    Ok(())
}
