//! Owned host mappings: guest RAM, KVM's kvm_run page, snapshot views.
use std::{fs::File, io, os::fd::AsRawFd, ptr};

pub struct Mapping {
    pub(crate) ptr: *mut u8,
    pub(crate) len: usize,
}
impl Mapping {
    /// A read-write mapping of `fd`; panics if the kernel refuses it (KVM).
    #[cfg(target_os = "linux")]
    pub(crate) fn new(fd: &File, len: usize, flags: libc::c_int) -> Self {
        Self::map(fd, len, flags).unwrap_or_else(|e| panic!("mmap: {e}"))
    }
    pub(crate) fn map(fd: &File, len: usize, flags: libc::c_int) -> io::Result<Self> {
        // SAFETY: fd is live and len comes from the verified snapshot geometry
        // or KVM's run size. The returned mapping is checked before any access.
        let p = unsafe {
            libc::mmap(
                ptr::null_mut(),
                len,
                libc::PROT_READ | libc::PROT_WRITE,
                flags,
                fd.as_raw_fd(),
                0,
            )
        };
        if p == libc::MAP_FAILED {
            return Err(io::Error::last_os_error());
        }
        let m = Self { ptr: p.cast(), len };
        // Avoid transparent huge-page CoW obscuring the K-page experiment.
        #[cfg(target_os = "linux")]
        assert!(
            // SAFETY: The returned mapping is live and len bytes long.
            // MADV_NOHUGEPAGE accepts that exact owned extent and does not
            // expose references.
            unsafe { libc::madvise(p, len, libc::MADV_NOHUGEPAGE) } >= 0,
            "MADV_NOHUGEPAGE: {}",
            io::Error::last_os_error()
        );
        Ok(m)
    }
    /// Replace `off..off + len` of this mapping in place with a fresh private
    /// mapping of the same range of `fd`: the old pages are released and the
    /// range reads as the file again.
    #[cfg(target_os = "macos")]
    pub(crate) fn remap(&self, fd: &File, off: usize, len: usize) -> io::Result<()> {
        assert!(off.checked_add(len).is_some_and(|end| end <= self.len));
        // SAFETY: MAP_FIXED replaces only a sub-range of this live mapping,
        // which this owner holds and no Rust reference borrows; the stopped
        // vCPU has no stage-2 mapping of it (the caller unmapped it).
        let p = unsafe {
            libc::mmap(
                self.ptr.add(off).cast(),
                len,
                libc::PROT_READ | libc::PROT_WRITE,
                libc::MAP_PRIVATE | libc::MAP_FIXED,
                fd.as_raw_fd(),
                off as libc::off_t,
            )
        };
        if p == libc::MAP_FAILED {
            return Err(io::Error::last_os_error());
        }
        assert_eq!(p.cast(), self.ptr.wrapping_add(off), "MAP_FIXED moved");
        Ok(())
    }
    pub(crate) fn word(&self, off: usize) -> u64 {
        assert!(off.is_multiple_of(8) && off.checked_add(8).is_some_and(|end| end <= self.len));
        // SAFETY: mmap is live, offset is aligned and in bounds. No Rust RAM
        // reference escapes; the owner reads only after the vCPU has stopped.
        unsafe { ptr::read_volatile(self.ptr.add(off).cast()) }
    }
    pub(crate) fn put(&self, off: usize, value: u64) {
        assert!(off.is_multiple_of(8) && off.checked_add(8).is_some_and(|end| end <= self.len));
        // SAFETY: same owner-thread/alignment/range contract as word(); no
        // borrowed guest bytes alias this store.
        unsafe { ptr::write_volatile(self.ptr.add(off).cast(), value) }
    }
    #[cfg(target_os = "linux")]
    pub(crate) fn byte(&self, off: usize) -> u8 {
        assert!(off < self.len);
        // SAFETY: the checked byte lies in this live mapping; the owner has
        // returned from the run before reading the UAPI or guest bytes.
        unsafe { self.ptr.add(off).read_volatile() }
    }
    #[cfg(target_os = "linux")]
    pub(crate) fn u32(&self, off: usize) -> u32 {
        assert!(off.is_multiple_of(4) && off.checked_add(4).is_some_and(|end| end <= self.len));
        // SAFETY: the field is aligned and in bounds; the run has returned.
        unsafe { self.ptr.add(off).cast::<u32>().read_volatile() }
    }
}
impl Drop for Mapping {
    fn drop(&mut self) {
        // SAFETY: this owns the original mapping, with no escaping RAM borrows;
        // the owner has stopped the vCPU and will never reenter this slot.
        unsafe {
            libc::munmap(self.ptr.cast(), self.len);
        }
    }
}
