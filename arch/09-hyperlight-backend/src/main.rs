use hyperlight_js::{SandboxBuilder, Script, LoadedJSSandbox};
use serde_json::json;
use std::{time::Instant, sync::{Arc, Barrier}, io::{self, Write}};

type E = Box<dyn std::error::Error + Send + Sync>;
const SOURCE: &str = r#"
import * as math from 'math';
let count = 0;
export function handler(e) {
  if(e.kind === 'host') return math.add(e.a, e.b);
  if(e.kind === 'batch') { let x = 0; for(let i=0;i<100;i++) x=math.add(i,1); return x; }
  if(e.kind === 'count') return ++count;
  if(e.kind === 'spin') { let x=0; for(let i=0;i<1000000;i++) x=(x+i)|0; return x; }
  if(e.kind === 'await') return Promise.resolve(e.a+e.b);
  if(e.kind === 'caps') return [typeof setTimeout, typeof Promise, typeof Proxy, typeof console];
  return e.a+e.b;
}
"#;
fn create() -> Result<LoadedJSSandbox,E> {
    let mut p = SandboxBuilder::new().build()?;
    p.host_module("math").register("add", |a:i64,b:i64| a+b);
    let mut s=p.load_runtime()?;
    s.add_handler("handler",Script::from_content(SOURCE))?;
    Ok(s.get_loaded_sandbox()?)
}
fn event(s:&mut LoadedJSSandbox, kind:&str) -> Result<String,E> {
    Ok(s.handle_event("handler",json!({"kind":kind,"a":20,"b":22}).to_string(),None)?)
}
fn record(k:&str, i:usize, ns:u128) {println!("{}",json!({"metric":k,"i":i,"ns":ns}));}
fn memory(n:usize) {
    unsafe {
        let mut r:libc::rusage_info_v0=std::mem::zeroed();
        let rc=libc::proc_pid_rusage(libc::getpid(),libc::RUSAGE_INFO_V0,
            &mut r as *mut _ as *mut libc::rusage_info_t);
        assert_eq!(rc,0);
        println!("{}",json!({"metric":"memory","n":n,"rss":r.ri_resident_size,
            "footprint":r.ri_phys_footprint,"wired":r.ri_wired_size}));
    }
}
fn main()->Result<(),E> {
    let mode=std::env::args().nth(1).unwrap_or("bench".into());
    match mode.as_str() {
      "bench"=>{
        for i in 0..40 {
            let all=Instant::now(); let t=Instant::now();
            let mut p=SandboxBuilder::new().build()?;
            record("proto",i,t.elapsed().as_nanos());
            p.host_module("math").register("add",|a:i64,b:i64|a+b);
            let t=Instant::now(); let mut s=p.load_runtime()?;
            record("runtime",i,t.elapsed().as_nanos());
            let t=Instant::now(); s.add_handler("handler",Script::from_content(SOURCE))?;
            let mut s=s.get_loaded_sandbox()?;
            record("load_handler",i,t.elapsed().as_nanos());
            record("create_total",i,all.elapsed().as_nanos());
            let t=Instant::now(); assert_eq!(event(&mut s,"add")?,"42");
            record("first_call",i,t.elapsed().as_nanos());
            record("create_to_result",i,all.elapsed().as_nanos());
            let t=Instant::now();drop(s);record("drop",i,t.elapsed().as_nanos());
        }
        let mut s=create()?;
        for kind in ["add","host","batch","await"] {
            for i in 0..210 {
                let t=Instant::now(); let result=event(&mut s,kind)?;
                record(kind,i,t.elapsed().as_nanos());
                assert_eq!(result,if kind=="batch" {"100"} else {"42"});
            }
        }
        println!("{}",json!({"metric":"caps","result":event(&mut s,"caps")?}));
        let clean=s.snapshot()?;
        for i in 0..40 {
            s.restore(clean.clone())?;
            assert_eq!(event(&mut s,"count")?,"1");
            let t=Instant::now();let snap=s.snapshot()?;
            record("snapshot",i,t.elapsed().as_nanos());
            assert_eq!(event(&mut s,"count")?,"2");
            let t=Instant::now();s.restore(snap)?;
            record("restore",i,t.elapsed().as_nanos());
            assert_eq!(event(&mut s,"count")?,"2");
        }
      }
      "one"=>{
        memory(0);let all=Instant::now();let mut s=create()?;
        record("fresh_create",0,all.elapsed().as_nanos());
        assert_eq!(event(&mut s,"add")?,"42");
        record("fresh_create_to_result",0,all.elapsed().as_nanos());memory(1);
      }
      "memory"=>{
        let mut pool=Vec::new();memory(0);
        for n in 1..=32 {let mut s=create()?;assert_eq!(event(&mut s,"add")?,"42");pool.push(s);memory(n);}
        for _ in 0..4 {for s in &mut pool {assert_eq!(event(s,"host")?,"42");}}
        println!("{}",json!({"metric":"resident_sandboxes","success":pool.len()}));
      }
      "parallel"=>{
        let n:usize=std::env::args().nth(2).unwrap_or("1".into()).parse()?;
        let barrier=Arc::new(Barrier::new(n+1));
        let mut threads=Vec::new();
        for _ in 0..n {let barrier=barrier.clone();threads.push(std::thread::spawn(move||->Result<(),E>{
            let mut s=create()?;barrier.wait();
            for _ in 0..30 {let _=event(&mut s,"spin")?;}
            Ok(())
        }));}
        barrier.wait();let t=Instant::now();for th in threads {th.join().unwrap()?;}
        println!("{}",json!({"metric":"parallel","workers":n,"calls":n*30,"ns":t.elapsed().as_nanos()}));
      }
      "sidecar"=>{
        // Minimal sketch: one job/process; the supervisor owns deadlines and policy.
        // stdin job is {code,event}; following lines are responses {id,ok|err}.
        let mut line=String::new();io::stdin().read_line(&mut line)?;
        let job:serde_json::Value=serde_json::from_str(&line)?;
        let mut proto=SandboxBuilder::new()
          .with_host_print_fn((|_:String| Ok::<i32,hyperlight_host::HyperlightError>(0)).into())
          .build()?;
        let id=Arc::new(std::sync::atomic::AtomicU64::new(0));
        proto.host_module("jitk").register_js("call",move|args,binary| {
            if !binary.is_empty(){return Err(hyperlight_js::HyperlightError::Error("binary disabled".into()));}
            let a=args.as_array().ok_or_else(||hyperlight_js::HyperlightError::Error("args".into()))?;
            if a.len()!=3 {return Err(hyperlight_js::HyperlightError::Error("arity".into()));}
            let id=id.fetch_add(1,std::sync::atomic::Ordering::Relaxed);
            let req=json!({"t":"call","id":id,"ns":a[0],"fn":a[1],"args":a[2]});
            let mut out=io::stdout().lock();writeln!(out,"{req}")?;out.flush()?;drop(out);
            let mut response=String::new();io::stdin().read_line(&mut response)?;
            let r:serde_json::Value=serde_json::from_str(&response)?;
            if r["id"]!=id {return Err(hyperlight_js::HyperlightError::Error("response id mismatch".into()));}
            if let Some(err)=r.get("err") {return Err(hyperlight_js::HyperlightError::Error(err.to_string()));}
            let ok=r.get("ok").ok_or_else(||hyperlight_js::HyperlightError::Error("missing ok".into()))?;
            Ok(hyperlight_js::FnReturn::Json(ok.to_string()))
        });
        let mut sandbox=proto.load_runtime()?;
        sandbox.add_handler("handler",Script::from_content(job["code"].as_str().ok_or("code")?))?;
        let mut sandbox=sandbox.get_loaded_sandbox()?;
        let result=sandbox.handle_event("handler",job["event"].to_string(),None)?;
        println!("{}",json!({"t":"done","result":serde_json::from_str::<serde_json::Value>(&result)?}));
      }
      _=>return Err("unknown mode".into())
    };
    Ok(())
}
