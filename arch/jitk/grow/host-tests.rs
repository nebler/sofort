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
#[path = "SYS/fstat.rs"] mod fstat;
#[path = "SYS/pread64.rs"] mod pread64;
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
    // Independent full stat layout, including padding, block accounting,
    // immutable identity and console type. No expected bytes from fs::stat.
    assert_eq!(open("/a.txt", 0), 3);
    let mut want = [0u8; 128];
    for (at, bytes) in [(0, 1u64.to_le_bytes()), (8, 2u64.to_le_bytes()),
                       (48, 2u64.to_le_bytes()), (64, 1u64.to_le_bytes())] {
        want[at..at+8].copy_from_slice(&bytes);
    }
    want[16..20].copy_from_slice(&0o100444u32.to_le_bytes());
    want[20..24].copy_from_slice(&1u32.to_le_bytes());
    want[56..60].copy_from_slice(&4096u32.to_le_bytes());
    assert_eq!(fstat::call(&[3, buf()]), 0);
    assert_eq!(&syscalls::MEM[4096..4224], &want);
    assert_eq!(fstat::call(&[999, 0]), -9);
    assert_eq!(fstat::call(&[3, buf()+4090]), -14);
    assert_eq!(fstat::call(&[3, usize::MAX-63]), -14);
    assert_eq!(lseek::call(&[3, 1, 0]), 1);
    assert_eq!(fstat::call(&[3, buf()]), 0);
    assert_eq!(fs::get(3).unwrap().pos, 1);
    assert_eq!(pread64::call(&[3, buf(), 1, 0]), 1);
    assert_eq!(syscalls::MEM[4096], b'h');
    assert_eq!(fs::get(3).unwrap().pos, 1);
    assert_eq!(pread64::call(&[3, buf(), 8, 1]), 1);
    assert_eq!(syscalls::MEM[4096], b'i');
    assert_eq!(pread64::call(&[3, 0, 0, 0]), 0);
    assert_eq!(pread64::call(&[3, 0, 8, 2]), 0);
    assert_eq!(pread64::call(&[3, 0, 1, 0]), -14);
    assert_eq!(pread64::call(&[3, buf(), 1, usize::MAX]), -22);
    assert_eq!(pread64::call(&[999, 0, 0, usize::MAX]), -22);
    assert_eq!(pread64::call(&[3, buf(), usize::MAX, 0]), -14);
    assert_eq!(pread64::call(&[3, buf(), 8, i64::MAX as usize-1]), -22);
    assert_eq!(fs::get(3).unwrap().pos, 1);
    assert_eq!(fs::read(3, buf(), 1), 1); assert_eq!(syscalls::MEM[4096], b'i');
    assert_eq!(close::call(&[3]), 0);
    assert_eq!(fstat::call(&[3, buf()]), -9);
    assert_eq!(pread64::call(&[3, buf(), 1, 0]), -9);
    for fd in 0..3 {
        assert_eq!(fstat::call(&[fd, buf()]), 0);
        assert_eq!(u32::from_le_bytes(syscalls::MEM[4112..4116].try_into().unwrap()) & 0xf000, 0x1000);
        assert_eq!(pread64::call(&[fd, buf(), 1, 0]), -29);
    }
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
