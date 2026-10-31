// Read-only archive open, as Linux answers an unprivileged process (the
// guest; the oracles run payloads as uid 65534) on a read-only bind mount
// whose files are 0444 and directories 0555: O_TRUNC fails at the mount
// (EROFS); any write access mode, including O_ACCMODE 3 (which Linux checks
// for read and write permission), fails the permission check (EACCES);
// directories refuse writes (EISDIR). As root, Linux skips the permission
// check, and Docker Desktop's file sharing let mode 3 open: both differ
// (docs/results/oracle-recordings.md). O_PATH is outside this contract
// (EINVAL).
use crate::fs;
pub fn call(a: &[usize]) -> isize {
    let flags = a[2] as u32;
    let (creat, excl, trunc, dirflag) = (
        flags & 0x40 != 0,
        flags & 0x80 != 0,
        flags & 0x200 != 0,
        flags & 0x4000 != 0,
    );
    let write = flags & 3 != 0 || trunc;
    if creat && dirflag || flags & 0x200000 != 0 {
        return -22;
    }
    if flags & 0x400000 != 0 {
        return if flags & 0x4000 == 0 || flags & 3 == 0 {
            -22
        } else {
            -30
        };
    }
    let i = match fs::lookup(a[0], a[1], false, creat) {
        Ok(i) => i,
        Err(e) => return e,
    };
    let n = match fs::node(i) {
        Ok(n) => n,
        Err(e) => return e,
    };
    if creat && excl {
        return -17;
    }
    if n.is_dir() && (creat || write) {
        return -21;
    }
    if dirflag && !n.is_dir() {
        return -20;
    }
    if trunc {
        return -30;
    }
    if flags & 3 != 0 {
        return -13;
    }
    fs::alloc(i, flags & 0x80000 != 0, true)
}
