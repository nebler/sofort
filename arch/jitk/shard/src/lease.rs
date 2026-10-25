//! A separate process owns deadline enforcement. Shared entries are generation-fenced;
//! only a stopped/reset owner acknowledges expiry. No guest mapping includes this board.
use crate::kvm::monotonic_ns;
use std::{
    cell::Cell,
    ffi::c_void,
    fs::File,
    io,
    os::fd::{AsRawFd, FromRawFd, RawFd},
    process::{Child, Command, Stdio},
    ptr,
    sync::{
        Arc,
        atomic::{AtomicU8, AtomicU64, Ordering::*},
    },
};
const SIGNAL: i32 = 10; // Linux arm64 SIGUSR1
const ARMED: u64 = 1;
const EXPIRED: u64 = 2;
#[repr(C, align(64))]
struct Entry {
    state: AtomicU64,
    deadline: AtomicU64,
    tid: AtomicU64,
}
struct Board {
    ptr: *mut Entry,
    len: usize,
    _file: File,
    changes: Wake,
}
// This is shared host memory containing atomics only, never a guest RAM pointer.
unsafe impl Send for Board {}
unsafe impl Sync for Board {}
unsafe extern "C" {
    fn memfd_create(name: *const u8, flags: u32) -> i32;
    fn mmap(addr: *mut c_void, len: usize, prot: i32, flags: i32, fd: i32, off: i64)
    -> *mut c_void;
    fn munmap(addr: *mut c_void, len: usize) -> i32;
    fn fcntl(fd: i32, cmd: i32, ...) -> i32;
    fn syscall(nr: i64, ...) -> i64;
    fn signal(sig: i32, handler: extern "C" fn(i32)) -> usize;
    fn eventfd(init: u32, flags: i32) -> i32;
    fn poll(fds: *mut PollFd, n: usize, timeout: i32) -> i32;
    fn read(fd: i32, p: *mut c_void, len: usize) -> isize;
    fn write(fd: i32, p: *const c_void, len: usize) -> isize;
}
#[repr(C)]
struct PollFd {
    fd: i32,
    events: i16,
    revents: i16,
}
fn owned(fd: i32) -> File {
    assert!(fd >= 0, "{}", io::Error::last_os_error());
    unsafe { File::from_raw_fd(fd) }
}
fn inherit(fd: RawFd, yes: bool) {
    assert_eq!(unsafe { fcntl(fd, 2, if yes { 0 } else { 1 }) }, 0);
}
impl Board {
    fn map(file: File, len: usize, changes: Wake) -> Arc<Self> {
        let bytes = len * size_of::<Entry>();
        let p = unsafe { mmap(ptr::null_mut(), bytes, 3, 1, file.as_raw_fd(), 0) };
        assert_ne!(p as isize, -1, "lease board mmap");
        Arc::new(Self {
            ptr: p.cast(),
            len,
            _file: file,
            changes,
        })
    }
    fn entry(&self, slot: usize) -> &Entry {
        assert!(slot < self.len);
        unsafe { &*self.ptr.add(slot) }
    }
}
impl Drop for Board {
    fn drop(&mut self) {
        unsafe {
            munmap(self.ptr.cast(), self.len * size_of::<Entry>());
        }
    }
}
#[derive(Clone)]
pub struct Wake(Arc<File>);
impl Wake {
    pub fn new() -> Self {
        Self(Arc::new(owned(unsafe { eventfd(0, 0x80000 | 0x800) })))
    }
    pub fn notify(&self) {
        notify(self.0.as_raw_fd());
    }
    pub fn wait(&self) {
        let mut fd = PollFd {
            fd: self.0.as_raw_fd(),
            events: 1,
            revents: 0,
        };
        loop {
            let n = unsafe { poll(&mut fd, 1, -1) };
            if n < 0 && io::Error::last_os_error().raw_os_error() == Some(4) {
                continue;
            }
            assert_eq!(n, 1, "owner wake poll");
            if consume(fd.fd) {
                return;
            }
        }
    }
}
fn notify(fd: RawFd) {
    loop {
        let n = unsafe { write(fd, (&1u64 as *const u64).cast(), 8) };
        if n == 8 {
            return;
        }
        match io::Error::last_os_error().raw_os_error() {
            Some(4) => continue,
            Some(11) => return, // a saturated eventfd already has a wake queued
            e => panic!("eventfd write: {e:?}"),
        }
    }
}
fn consume(fd: RawFd) -> bool {
    loop {
        let mut count = 0u64;
        if unsafe { read(fd, (&mut count as *mut u64).cast(), 8) } == 8 {
            return true;
        }
        match io::Error::last_os_error().raw_os_error() {
            Some(4) => continue,
            Some(11) => return false,
            e => panic!("eventfd read: {e:?}"),
        }
    }
}
#[derive(Clone)]
pub struct Lease {
    board: Arc<Board>,
    slot: usize,
    generation: u64,
}
impl Lease {
    pub fn arm(&self, generation: u64, deadline: u64) -> Self {
        assert!(generation > self.generation && generation < u64::MAX >> 2);
        let e = self.board.entry(self.slot);
        assert_eq!(
            e.state.load(Acquire),
            self.generation << 2,
            "reuse before stop/reset acknowledgement"
        );
        e.tid.store(unsafe { syscall(178) } as u64, Relaxed); // gettid
        e.deadline.store(deadline, Relaxed);
        e.state.store(generation << 2 | ARMED, Release);
        self.board.changes.notify();
        Self {
            board: self.board.clone(),
            slot: self.slot,
            generation,
        }
    }
    pub fn expired(&self) -> bool {
        let key = self.board.entry(self.slot).state.load(Acquire);
        key >> 2 == self.generation && key & 3 >= EXPIRED
    }
    pub fn deadline(&self) -> u64 {
        self.board.entry(self.slot).deadline.load(Acquire)
    }
    /// Completion races expiry through one CAS; expiry wins require a reset and deadline result.
    pub fn complete(&self) -> bool {
        let changed = self
            .board
            .entry(self.slot)
            .state
            .compare_exchange(
                self.generation << 2 | ARMED,
                self.generation << 2,
                AcqRel,
                Acquire,
            )
            .is_ok();
        if changed {
            self.board.changes.notify();
        }
        changed
    }
    pub fn acknowledge_reset(&self) {
        let e = self.board.entry(self.slot);
        loop {
            let old = e.state.load(Acquire);
            assert_eq!(old >> 2, self.generation);
            if old & 3 == 3 {
                std::process::exit(70);
            } // escalation fenced reuse
            if e.state
                .compare_exchange(old, self.generation << 2, AcqRel, Acquire)
                .is_ok()
            {
                self.board.changes.notify();
                break;
            }
        }
    }
}
pub struct Watchdog {
    board: Arc<Board>,
    child: Child,
}
impl Watchdog {
    pub fn start(slots: usize, wakes: &[Wake], grace_ms: u64) -> Self {
        assert!(slots > 0 && !wakes.is_empty() && grace_ms > 0);
        unsafe {
            signal(SIGNAL, kick);
        }
        let file = owned(unsafe { memfd_create(c"jitk-leases".as_ptr().cast(), 1) });
        file.set_len((slots * size_of::<Entry>()) as u64).unwrap();
        let board = Board::map(file, slots, Wake::new());
        let change_fd = board.changes.0.as_raw_fd();
        inherit(change_fd, true);
        let fd = board._file.as_raw_fd();
        inherit(fd, true);
        for w in wakes {
            inherit(w.0.as_raw_fd(), true);
        }
        let child = Command::new(std::env::current_exe().unwrap())
            .args([
                "watchdog",
                &std::process::id().to_string(),
                &fd.to_string(),
                &slots.to_string(),
                &grace_ms.to_string(),
                &wakes
                    .iter()
                    .map(|w| w.0.as_raw_fd().to_string())
                    .collect::<Vec<_>>()
                    .join(","),
                &change_fd.to_string(),
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .spawn()
            .unwrap();
        inherit(fd, false);
        inherit(change_fd, false);
        for w in wakes {
            inherit(w.0.as_raw_fd(), false);
        }
        Self { board, child }
    }
    pub fn slot(&self, slot: usize) -> Lease {
        Lease {
            board: self.board.clone(),
            slot,
            generation: 0,
        }
    }
    pub fn check(&mut self) {
        if let Some(status) = self.child.try_wait().unwrap() {
            eprintln!("watchdog exited unexpectedly: {status}");
            std::process::exit(70);
        }
    }
}
impl Drop for Watchdog {
    fn drop(&mut self) {
        for slot in 0..self.board.len {
            assert_eq!(self.board.entry(slot).state.load(Acquire) & 3, 0);
        }
        self.child.kill().unwrap();
        self.child.wait().unwrap();
    }
}
thread_local! {
    static CURRENT: Cell<*const AtomicU8> = const { Cell::new(ptr::null()) };
    // A kick can concern another slot owned by this thread, or arrive between
    // KVM entries. Retain it until the owner has had a chance to sweep leases.
    static KICKED: Cell<bool> = const { Cell::new(false) };
}
extern "C" fn kick(_: i32) {
    KICKED.with(|p| p.set(true));
    CURRENT.with(|p| {
        let p = p.get();
        if !p.is_null() {
            unsafe { &*p }.store(1, Release);
        }
    });
}
/// The pointer lives for the whole KVM_RUN; only its owner can unmap it.
pub struct Running;
impl Running {
    pub unsafe fn enter(immediate_exit: *const AtomicU8) -> (Self, bool) {
        CURRENT.with(|p| p.set(immediate_exit));
        (Self, KICKED.with(|p| p.replace(false)))
    }
}
impl Drop for Running {
    fn drop(&mut self) {
        CURRENT.with(|p| p.set(ptr::null()));
    }
}

pub fn run(a: &[String]) {
    let pid: i32 = a[2].parse().unwrap();
    let fd: i32 = a[3].parse().unwrap();
    let len: usize = a[4].parse().unwrap();
    let grace_ns = a[5].parse::<u64>().unwrap() * 1_000_000;
    let wakes: Vec<i32> = a[6].split(',').map(|s| s.parse().unwrap()).collect();
    let changes = Wake(Arc::new(unsafe {
        File::from_raw_fd(a[7].parse().unwrap())
    }));
    let board = Board::map(unsafe { File::from_raw_fd(fd) }, len, changes);
    let pidfd = owned(unsafe { syscall(434, pid, 0) } as i32); // pidfd_open
    let mut fds = [
        PollFd {
            fd: pidfd.as_raw_fd(),
            events: 1,
            revents: 0,
        },
        PollFd {
            fd: board.changes.0.as_raw_fd(),
            events: 1,
            revents: 0,
        },
    ];
    let mut stopping = Vec::<(usize, u64, u64)>::new();
    let mut timeout = -1;
    loop {
        let n = unsafe { poll(fds.as_mut_ptr(), fds.len(), timeout) };
        if n < 0 {
            assert_eq!(io::Error::last_os_error().raw_os_error(), Some(4));
            continue;
        }
        if fds[0].revents != 0 {
            return;
        }
        if fds[1].revents != 0 {
            assert!(consume(fds[1].fd));
        }
        let now = monotonic_ns();
        let mut next = u64::MAX;
        for slot in 0..len {
            let e = board.entry(slot);
            let key = e.state.load(Acquire);
            if key & 3 != ARMED {
                continue;
            }
            let deadline = e.deadline.load(Relaxed);
            if deadline > now {
                next = next.min(deadline);
                continue;
            }
            if e.state
                .compare_exchange(key, key + 1, AcqRel, Acquire)
                .is_ok()
            {
                stopping.push((slot, key + 1, now));
                // A stale kick only yields the owner's currently running vCPU.
                unsafe {
                    syscall(131, pid, e.tid.load(Relaxed) as i32, SIGNAL);
                }
                notify(wakes[slot % wakes.len()]);
            }
        }
        stopping.retain(|&(slot, key, fired)| {
            let e=board.entry(slot);
            if e.state.load(Acquire) != key { return false; }
            if now.saturating_sub(fired) >= grace_ns {
                if e.state.compare_exchange(key, key+1, AcqRel, Acquire).is_ok() {
                    eprintln!("watchdog escalation: shard={pid} slot={slot} generation={} grace_ns={grace_ns}",key>>2);
                    assert_eq!(unsafe { syscall(424, pidfd.as_raw_fd(), 9, ptr::null::<u8>(), 0) },0,"pidfd_send_signal");
                }
                false
            } else { next=next.min(fired+grace_ns); true }
        });
        // Lease updates wake this poll; idle shards incur no periodic watchdog work.
        timeout = if next == u64::MAX {
            -1
        } else {
            next.saturating_sub(monotonic_ns())
                .div_ceil(1_000_000)
                .min(i32::MAX as u64) as i32
        };
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn lease() -> Lease {
        let f = owned(unsafe { memfd_create(c"jitk-lease-test".as_ptr().cast(), 1) });
        f.set_len(size_of::<Entry>() as u64).unwrap();
        Lease {
            board: Board::map(f, 1, Wake::new()),
            slot: 0,
            generation: 0,
        }
    }
    #[test]
    fn kick_between_entries_yields_before_running_another_slot() {
        let exit = AtomicU8::new(0);
        kick(SIGNAL); // no vCPU is registered when a parked slot expires
        let (running, pending) = unsafe { Running::enter(&exit) };
        assert!(pending);
        assert_eq!(exit.load(Acquire), 0);
        kick(SIGNAL); // also cover the registered-pointer / pre-ioctl window
        assert_eq!(exit.load(Acquire), 1);
        drop(running);
        exit.store(0, Release);
        let (running, pending) = unsafe { Running::enter(&exit) };
        assert!(pending);
        drop(running);
        let (_running, pending) = unsafe { Running::enter(&exit) };
        assert!(!pending);
    }
    #[test]
    fn stale_generation_cannot_expire_or_disarm_reused_slot() {
        let base = lease();
        let first = base.arm(1, 10);
        let stale_key = first.board.entry(0).state.load(Acquire);
        assert!(first.complete());
        let next = first.arm(2, 20);
        assert!(
            first
                .board
                .entry(0)
                .state
                .compare_exchange(stale_key, stale_key + 1, AcqRel, Acquire)
                .is_err()
        );
        assert!(!first.complete());
        assert!(!first.expired());
        assert!(!next.expired());
        assert_eq!(next.deadline(), 20);
        assert!(next.complete());
    }
    #[test]
    fn expiry_requires_reset_acknowledgement_before_reuse() {
        let first = lease().arm(7, 10);
        let e = first.board.entry(0);
        let armed = 7 << 2 | ARMED;
        assert!(
            e.state
                .compare_exchange(armed, armed + 1, AcqRel, Acquire)
                .is_ok()
        );
        assert!(first.expired());
        assert!(!first.complete());
        first.acknowledge_reset();
        let next = first.arm(8, 20);
        assert!(!next.expired());
        assert!(next.complete());
    }
    #[test]
    fn escalation_claim_loses_to_reset_and_new_generation() {
        let first = lease().arm(3, 10);
        let e = first.board.entry(0);
        let expired = 3 << 2 | EXPIRED;
        e.state.store(expired, Release);
        first.acknowledge_reset();
        let next = first.arm(4, 20);
        assert!(
            e.state
                .compare_exchange(expired, expired + 1, AcqRel, Acquire)
                .is_err()
        );
        assert!(next.complete());
    }
}
