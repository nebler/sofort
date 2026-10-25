// Read-only resource archive packed by prepare.py after the executable. There is
// no write path: the bytes are never user-mapped, and their kernel alias is RO.
// Every index field is bounds-checked on use (EIO), so no boot-time parse exists.
use crate::syscalls::{copyin, copyout};
#[derive(Clone, Copy)]
pub struct Node { pub ino: usize, pub name: &'static [u8], pub parent: usize, pub dir: bool, pub a: usize, pub b: usize }
#[derive(Clone, Copy)]
pub struct Open { pub node: usize, pub pos: usize, pub cloexec: bool, pub read: bool }
pub const MAX_FDS: usize = 64;
static mut FDS: [Option<Open>; MAX_FDS] = [None; MAX_FDS];

fn archive() -> &'static [u8] {
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

pub fn get(fd: usize) -> Result<&'static mut Open, isize> {
    unsafe { FDS.get_mut(fd).and_then(|f| f.as_mut()).ok_or(-9) }
}
pub fn alloc(node: usize, cloexec: bool, read: bool) -> isize {
    unsafe {
        match (3..MAX_FDS).find(|&fd| FDS[fd].is_none()) {
            Some(fd) => { FDS[fd] = Some(Open { node, pos: 0, cloexec, read }); fd as isize }
            None => -24,
        }
    }
}
pub fn close(fd: usize) -> isize {
    unsafe { match FDS.get_mut(fd).and_then(|f| f.take()) { Some(_) => 0, None => -9 } }
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
    let f = match get(fd) { Ok(f) if f.read => f, Ok(_) => return -9, Err(e) => return e };
    let n = match node(f.node) { Ok(n) => n, Err(e) => return e };
    if n.dir { return -21; }
    let d = data(&n);
    let start = f.pos.min(d.len());
    let count = len.min(d.len() - start);
    if count == 0 { return 0; }
    if let Err(e) = copyout(buf, &d[start..start + count]) { return e; }
    f.pos += count;
    count as isize
}
