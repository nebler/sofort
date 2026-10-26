// linux_dirent64 records: ".", "..", then the directory's byte-sorted children.
// The fd offset is the next entry index (also reported as d_off).
use crate::{fs, syscalls::copyout};
pub fn call(a: &[usize]) -> isize {
    fs::with_open(a[0] as u32 as usize, |f| {
        let dir = match fs::node(f.node) {
            Ok(n) => n,
            Err(e) => return e,
        };
        let children = match dir.children() {
            Some(children) => children,
            None => return -20,
        };
        let (count, mut off) = (a[2] as u32 as usize, 0);
        while f.pos < children.len() + 2 {
            let (ino, kind, name) = match f.pos {
                0 => (dir.ino, 4u8, &b"."[..]),
                1 => (dir.parent + 1, 4, &b".."[..]),
                i => match fs::node(children.start + i - 2) {
                    Ok(n) => (n.ino, if n.is_dir() { 4 } else { 8 }, n.name),
                    Err(e) => return e,
                },
            };
            let len = (19 + name.len() + 1 + 7) & !7;
            if off + len > count {
                return if off == 0 { -22 } else { off as isize };
            }
            let mut rec = [0u8; 280];
            rec[..8].copy_from_slice(&(ino as u64).to_le_bytes());
            rec[8..16].copy_from_slice(&(f.pos as u64 + 1).to_le_bytes());
            rec[16..18].copy_from_slice(&(len as u16).to_le_bytes());
            rec[18] = kind;
            rec[19..19 + name.len()].copy_from_slice(name);
            if let Err(e) = copyout(a[1] + off, &rec[..len]) {
                return e;
            }
            off += len;
            f.pos += 1;
        }
        off as isize
    })
    .unwrap_or_else(|e| e)
}
