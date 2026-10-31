// One process (pid 1) in one process group and session, owned by uid 0, at
// nice 0. Linux returns 20 - nice.
pub fn call(a: &[usize]) -> isize {
    // Grown for the console profile; ring builds keep their surface (ENOSYS).
    if cfg!(feature = "transport-ring") {
        return -38;
    }
    if a.len() < 2 {
        return -22;
    }
    let (which, who) = (a[0] as u32, a[1] as u32);
    match which {
        // PRIO_PROCESS, PRIO_PGRP
        0 | 1 if who == 0 || who == 1 => 20,
        // PRIO_USER
        2 if who == 0 => 20,
        0..=2 => -3,
        _ => -22,
    }
}
