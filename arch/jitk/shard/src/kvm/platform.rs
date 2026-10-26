//! Linux UAPI and owned mappings shared by the VM lifecycle and native adapter.
use crate::constants::kvm::*;
use libc::{ioctl, madvise, mmap, munmap, setrlimit};
use std::{
    fs::File,
    io,
    os::{fd::AsRawFd, raw::c_int},
    ptr,
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
pub(super) struct Mapping {
    pub(super) ptr: *mut u8,
    pub(super) len: usize,
}
impl Mapping {
    pub(super) fn new(fd: &File, len: usize, flags: c_int) -> Self {
        // SAFETY: fd is live and len comes from the verified snapshot geometry
        // or KVM's run size. The returned mapping is checked before any access.
        let p = unsafe {
            mmap(
                ptr::null_mut(),
                len,
                libc::PROT_READ | libc::PROT_WRITE,
                flags,
                fd.as_raw_fd(),
                0,
            )
        };
        assert_ne!(p as isize, -1, "mmap: {}", io::Error::last_os_error());
        // Avoid transparent huge-page CoW obscuring the K-page experiment.
        check(
            // SAFETY: The returned mapping is live and len bytes long.
            // MADV_NOHUGEPAGE accepts that exact owned extent and does not
            // expose references.
            unsafe { madvise(p, len, libc::MADV_NOHUGEPAGE) },
            "MADV_NOHUGEPAGE",
        );
        Self { ptr: p.cast(), len }
    }
    pub(super) fn word(&self, off: usize) -> u64 {
        assert!(off.is_multiple_of(8) && off.checked_add(8).is_some_and(|end| end <= self.len));
        // SAFETY: mmap is live, offset is aligned and in bounds. No Rust RAM
        // reference escapes; the owner reads only after KVM_RUN has returned.
        unsafe { ptr::read_volatile(self.ptr.add(off).cast()) }
    }
    pub(super) fn put(&self, off: usize, value: u64) {
        assert!(off.is_multiple_of(8) && off.checked_add(8).is_some_and(|end| end <= self.len));
        // SAFETY: same owner-thread/alignment/range contract as word(); no
        // borrowed guest bytes alias this store.
        unsafe { ptr::write_volatile(self.ptr.add(off).cast(), value) }
    }
    pub(super) fn byte(&self, off: usize) -> u8 {
        assert!(off < self.len);
        // SAFETY: the checked byte lies in this live mapping; the owner has
        // returned from KVM_RUN before reading the UAPI or guest bytes.
        unsafe { self.ptr.add(off).read_volatile() }
    }
    pub(super) fn u32(&self, off: usize) -> u32 {
        assert!(off.is_multiple_of(4) && off.checked_add(4).is_some_and(|end| end <= self.len));
        // SAFETY: the UAPI field is aligned and in bounds; KVM_RUN has returned.
        unsafe { self.ptr.add(off).cast::<u32>().read_volatile() }
    }
    pub(super) fn immediate_exit(&self) -> &std::sync::atomic::AtomicU8 {
        assert!(IMMEDIATE_EXIT < self.len);
        // SAFETY: AtomicU8 is byte-aligned and the UAPI byte lives as long as
        // this borrow. Only atomic accesses overlap the signal handler.
        unsafe { &*self.ptr.add(IMMEDIATE_EXIT).cast() }
    }
}
impl Drop for Mapping {
    fn drop(&mut self) {
        // SAFETY: this owns the original mapping, with no escaping RAM borrows;
        // the owner has stopped KVM and will never reenter this slot.
        unsafe {
            munmap(self.ptr.cast(), self.len);
        }
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
        Arc::new(Self { fd, run_size })
    }
}
