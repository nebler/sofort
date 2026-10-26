//! Host clock reads shared by VM owners and the independent watchdog.
pub fn clock_ns(clock: libc::clockid_t) -> u64 {
    let mut t = libc::timespec {
        tv_sec: 0,
        tv_nsec: 0,
    };
    // SAFETY: t is a live writable timespec; clock is a named host clock ID.
    let result = unsafe { libc::clock_gettime(clock, &mut t) };
    assert!(
        result >= 0,
        "clock_gettime: {}",
        std::io::Error::last_os_error()
    );
    t.tv_sec as u64 * 1_000_000_000 + t.tv_nsec as u64
}
pub fn monotonic_ns() -> u64 {
    clock_ns(libc::CLOCK_MONOTONIC)
}
