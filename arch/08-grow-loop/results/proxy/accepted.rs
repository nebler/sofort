// Proxy syscall handler; no host syscall is invoked here.
pub fn ioctl(fd: i64, request: u64, _arg: u64) -> i64 {
    if !(0..=2).contains(&fd) {
        return -9;
    }
    if request == 0x5413 {
        return -25;
    }
    -38
}
