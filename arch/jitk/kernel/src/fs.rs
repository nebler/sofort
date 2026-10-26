// Read-only resource archive packed by prepare.py after the executable. There is
// no write path: the bytes are never user-mapped, and their kernel alias is RO.
// Every index field is bounds-checked on use (EIO), so no boot-time parse exists.
use crate::syscalls::{copyin, copyout};
#[derive(Clone, Copy)]
pub struct Node { pub ino: usize, pub name: &'static [u8], pub parent: usize, pub dir: bool, pub a: usize, pub b: usize }
#[derive(Clone, Copy)]
pub struct Open { pub node: usize, pub pos: usize, pub read: bool }
pub const MAX_FDS: usize = 64;

// The atomic guard makes exclusive access real even for nested callbacks. No
// reference into this singleton may escape; copied metadata can outlive a call.
use core::{cell::UnsafeCell, sync::atomic::{AtomicBool, Ordering}};
#[derive(Clone, Copy)]
struct Fd { open: usize, cloexec: bool }
struct FdTable {
    descriptions: [Option<Open>; MAX_FDS],
    fds: [Option<Fd>; MAX_FDS],
}
struct GlobalTable { busy: AtomicBool, value: UnsafeCell<FdTable> }
// SAFETY: all access to value holds the atomic exclusive guard below. The
// higher-ranked callback cannot return references into the protected table.
unsafe impl Sync for GlobalTable {}
static TABLE: GlobalTable = GlobalTable {
    busy: AtomicBool::new(false),
    value: UnsafeCell::new(FdTable { descriptions: [None; MAX_FDS], fds: [None; MAX_FDS] }),
};
struct ReleaseTable;
impl Drop for ReleaseTable {
    fn drop(&mut self) { TABLE.busy.store(false, Ordering::Release); }
}
fn with_table<R>(f: impl FnOnce(&mut FdTable) -> R) -> Result<R, isize> {
    if TABLE.busy.compare_exchange(false, true, Ordering::Acquire, Ordering::Relaxed).is_err() {
        return Err(-16);
    }
    let _guard = ReleaseTable;
    // SAFETY: the guard excludes every other table access, including reentry;
    // callback borrows end before the guard releases and cannot escape as R.
    Ok(f(unsafe { &mut *TABLE.value.get() }))
}
impl FdTable {
    fn open(&mut self, fd: usize) -> Result<&mut Open, isize> {
        let f = self.fds.get(fd).and_then(|f| *f).ok_or(-9isize)?;
        self.descriptions[f.open].as_mut().ok_or(-9)
    }
    fn close(&mut self, fd: usize) -> isize {
        let Some(f) = self.fds.get_mut(fd).and_then(Option::take) else { return -9; };
        if !self.fds.iter().flatten().any(|other| other.open == f.open) {
            self.descriptions[f.open] = None;
        }
        0
    }
}
pub fn with_open<R>(fd: usize, f: impl FnOnce(&mut Open) -> R) -> Result<R, isize> {
    with_table(|t| t.open(fd).map(f))?
}
pub fn get(fd: usize) -> Result<Open, isize> { with_open(fd, |o| *o) }
pub fn alloc(node: usize, cloexec: bool, read: bool) -> isize {
    with_table(|t| {
        let Some(fd) = (3..MAX_FDS).find(|&fd| t.fds[fd].is_none()) else { return -24; };
        let Some(open) = t.descriptions.iter().position(Option::is_none) else { return -24; };
        t.descriptions[open] = Some(Open { node, pos: 0, read });
        t.fds[fd] = Some(Fd { open, cloexec });
        fd as isize
    }).unwrap_or_else(|e| e)
}
pub fn close(fd: usize) -> isize { with_table(|t| t.close(fd)).unwrap_or_else(|e| e) }
#[cfg(feature = "transport-ring")]
pub fn dup_stdin(old: usize, flags: usize) -> isize {
    if old == 0 || flags & !0x80000 != 0 { return -22; }
    with_table(|t| {
        let Some(f) = t.fds.get(old).and_then(|f| *f) else { return -9; };
        t.close(0);
        t.fds[0] = Some(Fd { open: f.open, cloexec: flags != 0 });
        0
    }).unwrap_or_else(|e| e)
}
pub fn fd_flags(fd: usize, set: Option<usize>) -> isize {
    with_table(|t| {
        let Some(f) = t.fds.get_mut(fd).and_then(Option::as_mut) else { return -9; };
        match set { Some(value) => { f.cloexec = value & 1 != 0; 0 }, None => f.cloexec as isize }
    }).unwrap_or_else(|e| e)
}

fn archive() -> &'static [u8] {
    #[cfg(feature = "transport-ring")]
    unsafe {
        if crate::console::native() {
            let len = crate::console::load(0x250) as usize;
            assert!((16..=4 * 1024 * 1024).contains(&len));
            return core::slice::from_raw_parts(0x82000000 as *const u8, len);
        }
    }
    unsafe { core::slice::from_raw_parts(crate::mmu::physical(crate::user::FS) as *const u8, crate::user::FS_LEN) }
}
fn word(at: usize) -> Option<usize> {
    Some(u32::from_le_bytes(archive().get(at..at.checked_add(4)?)?.try_into().ok()?) as usize)
}
pub fn node(i: usize) -> Result<Node, isize> {
    let fail = -5isize;
    let count = word(8).ok_or(fail)?;
    if i >= count { return Err(fail); }
    let w = |k: usize| word(16 + i * 24 + k * 4).ok_or(fail);
    let (off, len, parent, dir, a, b) = (w(0)?, w(1)?, w(2)?, w(3)? == 1, w(4)?, w(5)?);
    let name = archive().get(off..off + len).ok_or(fail)?;
    let limit = if dir { count } else { archive().len() };
    if len > 255 || parent >= count || a.checked_add(b).is_none_or(|end| end > limit) { return Err(fail); }
    Ok(Node { ino: i + 1, name, parent, dir, a, b })
}
pub fn data(n: &Node) -> &'static [u8] { &archive()[n.a..n.a + n.b] }

// AArch64 stat ABI, shared by pathname and descriptor metadata. Archive
// metadata is deterministic; console descriptors describe anonymous pipes.
pub fn stat(n: Option<Node>) -> [u8; 128] {
    let mut st = [0u8; 128];
    let (dev, ino, mode, size) = match n {
        Some(n) => (1u64, n.ino as u64, if n.dir { 0o40555u32 } else { 0o100444 }, if n.dir { 0 } else { n.b as u64 }),
        None => (0, 0, 0o10600, 0),
    };
    st[0..8].copy_from_slice(&dev.to_le_bytes());
    st[8..16].copy_from_slice(&ino.to_le_bytes());
    st[16..20].copy_from_slice(&mode.to_le_bytes());
    st[20..24].copy_from_slice(&1u32.to_le_bytes());
    st[48..56].copy_from_slice(&size.to_le_bytes());
    st[56..60].copy_from_slice(&4096u32.to_le_bytes());
    st[64..72].copy_from_slice(&((size + 511) / 512).to_le_bytes());
    st
}

// Copy a NUL-terminated user path one page at a time (PATH_MAX 4096 incl. NUL).
fn path(addr: usize, buf: &mut [u8; 4096]) -> Result<usize, isize> {
    let mut n = 0;
    while n < buf.len() {
        let va = addr.checked_add(n).ok_or(-14isize)?;
        let end = (n + 4096 - (va & 4095)).min(buf.len());
        copyin(va, &mut buf[n..end])?;
        if let Some(z) = buf[n..end].iter().position(|&b| b == 0) { return Ok(n + z); }
        n = end;
    }
    Err(-36)
}
fn child(dir: &Node, name: &[u8]) -> Result<usize, isize> {
    let (mut lo, mut hi) = (dir.a, dir.a + dir.b);
    while lo < hi {
        let mid = (lo + hi) / 2;
        match node(mid)?.name.cmp(name) {
            core::cmp::Ordering::Equal => return Ok(mid),
            core::cmp::Ordering::Less => lo = mid + 1,
            core::cmp::Ordering::Greater => hi = mid,
        }
    }
    Err(-2)
}
// Linux path walk restricted to the archive: cwd is /, ".." at / stays at /,
// every component (including "." , ".." and a trailing "/") needs a directory.
// `create` maps a missing final component in an existing directory to EROFS.
pub fn lookup(dirfd: usize, addr: usize, empty: bool, create: bool) -> Result<usize, isize> {
    let mut buf = [0u8; 4096];
    let len = path(addr, &mut buf)?;
    let p = &buf[..len];
    let mut cur = if p.first() == Some(&b'/') || dirfd as i32 == -100 { 0 } else { get(dirfd as u32 as usize)?.node };
    if p.is_empty() {
        return if empty { Ok(cur) } else { Err(-2) };
    }
    let mut parts = p.split(|&b| b == b'/').peekable();
    while let Some(c) = parts.next() {
        let n = node(cur)?;
        if !n.dir { return Err(-20); }
        if c.len() > 255 { return Err(-36); }
        cur = match c {
            b"" | b"." => cur,
            b".." => n.parent,
            _ => match child(&n, c) {
                Err(-2) if create && parts.peek().is_none() => return Err(-30),
                r => r?,
            },
        };
    }
    Ok(cur)
}
pub fn read(fd: usize, buf: usize, len: usize) -> isize {
    with_open(fd, |f| {
    if !f.read { return -9; }
    let n = match node(f.node) { Ok(n) => n, Err(e) => return e };
    if n.dir { return -21; }
    let d = data(&n);
    let start = f.pos.min(d.len());
    let count = len.min(d.len() - start);
    if count == 0 { return 0; }
    if let Err(e) = copyout(buf, &d[start..start + count]) { return e; }
    f.pos += count;
    count as isize
    }).unwrap_or_else(|e| e)
}
