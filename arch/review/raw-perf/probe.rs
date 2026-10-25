// Review-only harness: copy to shard/src/bin/perf_review.rs; no product edits.
#[path = "../arena.rs"] mod arena;
#[path = "../real_kvm.rs"] mod kvm;
#[path = "../lease.rs"] mod lease;
use std::{fs::File, time::Instant};
fn main() {
    let a: Vec<String> = std::env::args().collect();
    let source = std::fs::read_to_string(&a[2]).unwrap();
    let n: usize = a[3].parse().unwrap();
    let k = kvm::Kvm::new();
    let snap = kvm::Snapshot::load(&a[1]);
    let mut slot = kvm::Slot::new(&k, snap);
    let mut entropy = File::open("/dev/urandom").unwrap();
    for i in 0..n + 5 {
        let cpu = kvm::clock_ns(3);
        let reset = slot.reset();
        let t = Instant::now();
        slot.bind(i as u64 + 2, &source, &mut entropy);
        let bind = t.elapsed().as_nanos();
        let t = Instant::now();
        let mut calls = 0;
        let finish;
        loop {
            let e = slot.exit();
            if e.op == 3 { finish = e.finish.unwrap(); break; }
            for r in e.requests {
                calls += 1;
                let bytes = if source.contains("__jitk_ring_") { b"{\"ok\":41}".to_vec() } else { r.bytes };
                slot.reply(&kvm::Request {id:r.id, bytes});
            }
        }
        let run = t.elapsed().as_nanos();
        let cpu = kvm::clock_ns(3) - cpu;
        if i >= 5 {
            println!("{{\"i\":{},\"source_bytes\":{},\"reset_ns\":{reset},\"bind_ns\":{bind},\"run_ns\":{run},\"cpu_ns\":{cpu},\"exits\":{},\"calls\":{calls},\"result\":{finish}}}", i-5, source.len(), slot.exits);
        }
    }
}
