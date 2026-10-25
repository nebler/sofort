// Copy to shard/src/bin/perf_memory.rs. Private-dirty diagnostic, not all-in memory.
#[path="../arena.rs"] mod arena;
#[path="../real_kvm.rs"] mod kvm;
#[path="../lease.rs"] mod lease;
use std::fs::File;
fn main() {
 let a:Vec<String>=std::env::args().collect();
 let source=std::fs::read_to_string(&a[2]).unwrap();let n:usize=a[3].parse().unwrap();
 let k=kvm::Kvm::new();let snap=kvm::Snapshot::load(&a[1]);
 let mut entropy=File::open("/dev/urandom").unwrap();let mut slots=Vec::new();
 for i in 0..n {
  let mut s=kvm::Slot::new(&k,snap.clone());s.reset();s.bind(i as u64+2,&source,&mut entropy);
  loop {let e=s.exit();if e.op==3 {assert_eq!(e.finish.unwrap(),"{\"ok\":42}");s.drain();break;}
   for r in e.requests {let bytes=if source.contains("__jitk_ring_"){b"{\"ok\":41}".to_vec()}else{r.bytes};s.reply(&kvm::Request{id:r.id,bytes});}
  }slots.push(s);
 }
 let smaps=std::fs::read_to_string("/proc/self/smaps_rollup").unwrap();
 let value=|name:&str| -> u64 {smaps.lines().find_map(|l|l.strip_prefix(name)).unwrap().split_whitespace().next().unwrap().parse().unwrap()};
 println!("{{\"n\":{n},\"source_bytes\":{},\"private_dirty_kib\":{},\"pss_kib\":{},\"rss_kib\":{}}}",source.len(),value("Private_Dirty:"),value("Pss:"),value("Rss:"));
}
