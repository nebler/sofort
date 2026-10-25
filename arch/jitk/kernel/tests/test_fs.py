"""Host-compile the real fs.rs + archive handlers against mock user memory.
Checks path walking, fd bounds, and that every corrupted index word yields an
errno (never a panic/out-of-bounds access)."""
from pathlib import Path
import os, sys, subprocess, tempfile
root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root)); from prepare import archive
source = r'''
#![allow(static_mut_refs, dead_code, unused_imports)]
mod user { pub static mut FS: usize = 0; pub static mut FS_LEN: usize = 0; }
mod mmu { pub fn physical(va: usize) -> usize { va } }
mod syscalls {
    pub static mut MEM: [u8; 8192] = [0; 8192];
    fn range(a: usize, n: usize) -> Result<usize, isize> {
        let base = unsafe { MEM.as_ptr() as usize };
        if a < base || a.checked_add(n).is_none_or(|e| e > base + 8192) { Err(-14) } else { Ok(a - base) }
    }
    pub fn copyin(a: usize, b: &mut [u8]) -> Result<(), isize> { let o = range(a, b.len())?; unsafe { b.copy_from_slice(&MEM[o..o + b.len()]) }; Ok(()) }
    pub fn copyout(a: usize, b: &[u8]) -> Result<(), isize> { let o = range(a, b.len())?; unsafe { MEM[o..o + b.len()].copy_from_slice(b) }; Ok(()) }
}
#[path = "FS"] mod fs;
#[path = "SYS/openat.rs"] mod openat;
#[path = "SYS/close.rs"] mod close;
#[path = "SYS/getdents64.rs"] mod getdents64;
#[path = "SYS/newfstatat.rs"] mod newfstatat;
#[path = "SYS/lseek.rs"] mod lseek;
const CWD: usize = -100isize as usize;
fn s(p: &str) -> usize { unsafe { let b = p.as_bytes(); syscalls::MEM[..b.len()].copy_from_slice(b); syscalls::MEM[b.len()] = 0; syscalls::MEM.as_ptr() as usize } }
fn buf() -> usize { unsafe { syscalls::MEM.as_ptr() as usize + 4096 } }
fn open(p: &str, f: usize) -> isize { openat::call(&[CWD, s(p), f, 0]) }
fn exercise() {
    for p in ["/", "/a.txt", "/b/c/z", "/b/../a.txt", "/nope", "/a.txt/x", "b/c", "/b/c/"] {
        let fd = open(p, 0);
        let _ = newfstatat::call(&[CWD, s(p), buf(), 0]);
        if fd >= 0 {
            let _ = fs::read(fd as usize, buf(), 4096);
            let _ = lseek::call(&[fd as usize, 0, 2]);
            while getdents64::call(&[fd as usize, buf(), 4096]) > 0 {}
            assert_eq!(close::call(&[fd as usize]), 0);
        }
    }
}
#[test] fn walk_and_corrupt() { unsafe {
    let mut fsb = std::fs::read(std::env::var("ARCHIVE").unwrap()).unwrap();
    user::FS = fsb.as_ptr() as usize; user::FS_LEN = fsb.len();
    assert_eq!(open("/a.txt", 0), 3); assert_eq!(fs::read(3, buf(), 100), 2); assert_eq!(close::call(&[3]), 0);
    assert_eq!(open("/b/../b/c/./z", 0), 3); assert_eq!(close::call(&[3]), 0);
    assert_eq!(open("/a.txt/", 0), -20); assert_eq!(open("/nope/x", 0x40), -2); assert_eq!(open("/new", 0x41), -30);
    assert_eq!(open("/../../a.txt", 1), -30); assert_eq!(open("/b", 1), -21); assert_eq!(open("", 0), -2);
    assert_eq!(openat::call(&[CWD, 12, 0, 0]), -14);
    let long = "/".repeat(4096); assert_eq!(open(&long[..4095], 0), 3); assert_eq!(close::call(&[3]), 0);
    syscalls::MEM[..4096].fill(b'/'); assert_eq!(openat::call(&[CWD, syscalls::MEM.as_ptr() as usize, 0, 0]), -36);
    for fd in 3..64 { assert_eq!(open("/a.txt", 0), fd); }
    assert_eq!(open("/a.txt", 0), -24); assert_eq!(close::call(&[64]), -9); assert_eq!(close::call(&[usize::MAX]), -9);
    for fd in 3..64 { close::call(&[fd]); }
    exercise();
    let words = 4 + 6 * u32::from_le_bytes(fsb[8..12].try_into().unwrap()) as usize;
    for w in 0..words {
        for v in [0u32, 1, 2, 5, 255, 256, 0x7fff_ffff, u32::MAX] {
            let old: [u8; 4] = fsb[w * 4..w * 4 + 4].try_into().unwrap();
            fsb[w * 4..w * 4 + 4].copy_from_slice(&v.to_le_bytes());
            exercise();
            for fd in 3..64 { close::call(&[fd]); }
            fsb[w * 4..w * 4 + 4].copy_from_slice(&old);
        }
    }
}}
'''.replace('FS"', str(root / 'src/fs.rs') + '"').replace('SYS/', str(root / 'src/syscalls') + '/')
with tempfile.TemporaryDirectory(prefix='jitk-fs-') as d:
    p = Path(d); tree = p / 'tree'; (tree / 'b/c').mkdir(parents=True)
    (tree / 'a.txt').write_bytes(b'hi'); (tree / 'b/c/z').write_bytes(b'zz'); (tree / 'b/y').write_bytes(b'')
    (p / 'fs.bin').write_bytes(archive(str(tree))[0]); (p / 'test.rs').write_text(source)
    subprocess.run(['rustc', '+1.95.0', '--edition=2024', '--test', '-A', 'static_mut_refs', str(p / 'test.rs'), '-o', str(p / 'test')], check=True)
    subprocess.run([str(p / 'test')], check=True, env={**os.environ, 'ARCHIVE': str(p / 'fs.bin')})
