use hyperlight_host::{SandboxBuilder, Sandbox};
use std::{io::{self,Read,Write},time::{SystemTime,UNIX_EPOCH}};
fn main() -> Result<(),Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    let n:usize=args.get(2).map(|s|s.parse().unwrap()).unwrap_or(1);
    let mode=args.get(3).map(|s|s.as_str()).unwrap_or("boot");
    let mut all:Vec<Sandbox>=Vec::new();
    let make=|| SandboxBuilder::from_file(&args[1])
        .heap_size(4*1024*1024).scratch_size(1024*1024)
        .host_function("CurrentTimeMicros",||SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_micros() as u64)
        .build();
    let mut first=make()?;
    first.call::<()>("RegisterHostModules","{}".to_owned())?;
    first.call::<()>("register_handler",("ledger".to_owned(),b"export function handler(event) { return 2; }".to_vec(),".".to_owned()))?;
    let out:Vec<u8>=first.call("RunHandler",("ledger".to_owned(),b"{}".to_vec(),false))?;
    assert_eq!(out,b"2");
    if mode=="snapshot" {
        let snap=first.snapshot()?;
        drop(first);
        for _ in 0..n {
            let mut s=SandboxBuilder::from_snapshot(snap.clone())
                .host_function("CurrentTimeMicros",||SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_micros() as u64).build()?;
            let out:Vec<u8>=s.call("RunHandler",("ledger".to_owned(),b"{}".to_vec(),false))?;
            assert_eq!(out,b"2"); all.push(s);
        }
    } else {
        all.push(first);
        for _ in 1..n { all.push(make()?); }
    }
    println!("{{\"ready\":true,\"n\":{n},\"mode\":\"{mode}\"}}");io::stdout().flush()?;
    let mut b=[0u8;1];while io::stdin().read(&mut b)?>0 {if b[0]==b'q' {break;}}
    std::hint::black_box(&all);
    Ok(())
}
