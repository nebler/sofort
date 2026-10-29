//! Linux UAPI shared by the VM lifecycle and native adapter.
use crate::constants::kvm::*;
pub(super) use crate::memory::Mapping;
use libc::{ioctl, setrlimit};
use std::{
    fs::File,
    io,
    os::{fd::AsRawFd, raw::c_int},
    sync::Arc,
};
pub(super) fn check(v: c_int, label: &str) -> c_int {
    assert!(v >= 0, "{label}: {}", io::Error::last_os_error());
    v
}
pub(super) fn call(fd: &File, op: u64, arg: u64) -> c_int {
    // SAFETY: All call sites in the VM adapter select a KVM UAPI operation and pass a
    // live, correctly sized scalar or C-layout argument; ioctl retains no argument
    // pointer.
    check(unsafe { ioctl(fd.as_raw_fd(), op as _, arg) }, "KVM ioctl")
}
/// As call(), but a failure is the caller's to handle (slot-scoped reset errors).
pub(super) fn try_call(fd: &File, op: u64, arg: u64) -> io::Result<c_int> {
    // SAFETY: as for call(): every caller passes a KVM UAPI operation with a
    // live, correctly sized scalar or C-layout argument that ioctl does not retain.
    let r = unsafe { ioctl(fd.as_raw_fd(), op as _, arg) };
    if r < 0 {
        return Err(io::Error::last_os_error());
    }
    Ok(r)
}
pub fn raise_fds() {
    check(
        // SAFETY: The rlimit value is initialized with the C layout; RLIMIT_NOFILE
        // reads it only during this call.
        unsafe {
            setrlimit(
                libc::RLIMIT_NOFILE,
                &libc::rlimit {
                    rlim_cur: 65536,
                    rlim_max: 65536,
                },
            )
        },
        "RLIMIT_NOFILE",
    );
}
impl Mapping {
    /// The kvm_run page's `immediate_exit` byte.
    pub(super) fn immediate_exit(&self) -> &std::sync::atomic::AtomicU8 {
        assert!(IMMEDIATE_EXIT < self.len);
        // SAFETY: AtomicU8 is byte-aligned and the UAPI byte lives as long as
        // this borrow. Only atomic accesses overlap the signal handler.
        unsafe { &*self.ptr.add(IMMEDIATE_EXIT).cast() }
    }
}
#[repr(C)]
pub(super) struct Region {
    pub(super) slot: u32,
    pub(super) flags: u32,
    pub(super) gpa: u64,
    pub(super) size: u64,
    pub(super) addr: u64,
}
#[repr(C)]
pub(super) struct OneReg {
    pub(super) id: u64,
    pub(super) addr: u64,
}
pub struct Kvm {
    pub(super) fd: File,
    pub(super) run_size: usize,
}
impl Kvm {
    pub fn new() -> Arc<Self> {
        let fd = File::options()
            .read(true)
            .write(true)
            .open("/dev/kvm")
            .unwrap();
        assert_eq!(call(&fd, KVM_GET_API_VERSION, 0), 12);
        let run_size = call(&fd, KVM_GET_VCPU_MMAP_SIZE, 0) as usize;
        // Every file the slots use is open once this returns: the reset's
        // pagemap too (a confined shard cannot open it later).
        super::reset::pagemap();
        Arc::new(Self { fd, run_size })
    }
}
