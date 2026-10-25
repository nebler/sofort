"""Compile actual safe candidate modules with deterministic checked helper fixtures."""
from pathlib import Path
import subprocess,tempfile
root=Path(__file__).resolve().parents[1]
source=r'''
#[path="IOCTL"] mod ioctl;
#[path="PPOLL"] mod ppoll;
static mut MEMORY: [u8;256] = [0;256];
static mut NOW: u64 = 0;
static mut PARKS: usize = 0;
fn copyin(a:usize,b:&mut[u8])->Result<(),isize>{ unsafe {
 if a<8 || a.checked_add(b.len()).is_none_or(|e|e>256) {return Err(-14)}
 b.copy_from_slice(&MEMORY[a..a+b.len()]); Ok(()) }}
fn copyout(a:usize,b:&[u8])->Result<(),isize>{ unsafe {
 if !writable(a,b.len()) {return Err(-14)} MEMORY[a..a+b.len()].copy_from_slice(b);Ok(()) }}
fn writable(a:usize,n:usize)->bool{a>=8&&a.checked_add(n).is_some_and(|e|e<=256)}
fn now_ns()->u64{unsafe{NOW}}
fn poll_fd(fd:i32,ev:i16)->i16{match fd{0=>0,1|2=>ev&4,_=>32}}
fn park_poll(d:Option<u64>,_:bool){unsafe{PARKS+=1; NOW=d.unwrap_or(10);}}
#[test] fn semantics(){ unsafe {
 assert_eq!(ioctl::call(&[999,0x5413,0]),-9);
 assert_eq!(ioctl::call(&[1,0x5413,0]),-25);
 assert_eq!(ioctl::call(&[1,0xdead,0]),-38);
 let fd=32; let ts=64;
 MEMORY[ts+8..ts+16].copy_from_slice(&5i64.to_le_bytes());
 assert_eq!(ppoll::call(&[0,0,ts,0,8]),0);assert_eq!(PARKS,1);assert_eq!(NOW,5);
 assert_eq!(ppoll::call(&[0,1,ts,0,8]),-14);
 assert_eq!(ppoll::call(&[fd,17,ts,0,8]),-22);
 assert_eq!(ppoll::call(&[fd,0,ts,1,8]),-38);
 MEMORY[ts..ts+8].copy_from_slice(&(-1i64).to_le_bytes());
 assert_eq!(ppoll::call(&[0,0,ts,0,8]),-22); MEMORY[ts..ts+16].fill(0);
 for (n,ev,out) in [(1i32,4i16,4i16),(2,4,4),(-1,1,0),(999,1,32)] {
 MEMORY[fd..fd+4].copy_from_slice(&n.to_le_bytes());MEMORY[fd+4..fd+6].copy_from_slice(&ev.to_le_bytes());
 assert_eq!(ppoll::call(&[fd,1,ts,0,8]),if out==0{0}else{1});
 assert_eq!(i16::from_le_bytes(MEMORY[fd+6..fd+8].try_into().unwrap()),out);
 }
 MEMORY[ts..ts+8].copy_from_slice(&i64::MAX.to_le_bytes());
 assert_eq!(ppoll::call(&[0,0,ts,0,8]),-22);
 }}
'''.replace('IOCTL',str(root/'src/syscalls/ioctl.rs')).replace('PPOLL',str(root/'src/syscalls/ppoll.rs'))
with tempfile.TemporaryDirectory(prefix='jitk-handlers-') as d:
    p=Path(d);(p/'test.rs').write_text(source)
    subprocess.run(['rustc','+1.95.0','--edition=2021','--test','-A','static_mut_refs',str(p/'test.rs'),'-o',str(p/'test')],check=True)
    subprocess.run([str(p/'test')],check=True)
