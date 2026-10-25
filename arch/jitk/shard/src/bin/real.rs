#[path = "../arena.rs"]
mod arena;
#[path = "../entropy.rs"]
mod entropy;
#[path = "../real_kvm.rs"]
mod kvm;
#[path = "../lease.rs"]
mod lease;
use kvm::*;
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
 "bomb"=>"const a=[];for(let i=0;i<1024;i++){const b=new Uint8Array(65536);b.fill(85);a.push(b)}return a.length;",
 "attack_hold"=>"",
 "arena_attack"=>"",
 "spin"=>"while(true){}",
 _=>panic!("unknown fixture")}.into()
}
fn expected(name: &str) -> &'static str {
    match name {
        "return2" => "{\"ok\":2}",
        "one_tool" | "wait" => "{\"ok\":42}",
        "promise10" => "{\"ok\":45}",
        "json64k" => "{\"ok\":65536}",
        _ => "",
    }
}
#[path = "../real_harness.rs"]
mod harness;
#[path = "../owner.rs"]
mod owner;
fn main() {
    let a: Vec<_> = std::env::args().collect();
    if a.get(1).map(String::as_str) == Some("watchdog") {
        lease::run(&a);
        return;
    }
    assert!(
        a.len() >= 4,
        "prepare IMAGE BASE | bench/hold/hostile BASE FIXTURE N [SECONDS] | stress/deadlines BASE FIXTURE N"
    );
    raise_fds();
    let kvm = Kvm::new();
    if a[1] == "prepare" {
        prepare(&kvm, &a[2], &a[3]);
        return;
    }
    harness::run(kvm, Snapshot::load(&a[2]), &a, fixture, expected);
}
