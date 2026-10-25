// Proxy syscall handler; no host syscall is invoked here.
pub fn ioctl(_fd: i64, _request: u64, _arg: u64) -> i64 { -38 }
