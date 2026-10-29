//! A separate process owns deadline enforcement. Shared entries are generation-fenced;
//! only a stopped/reset owner acknowledges expiry. No guest mapping includes this board.
use crate::clock::monotonic_ns;
use crate::confine::{Confinement, Signals, policy};
use std::{
    cell::Cell,
    fs::File,
    io,
    os::fd::{AsFd, AsRawFd, BorrowedFd, FromRawFd, OwnedFd, RawFd},
    process::{Child, Command, Stdio},
    ptr,
    sync::{
        Arc,
        atomic::{AtomicU8, AtomicU64, Ordering::*},
    },
};
const SIGNAL: i32 = libc::SIGUSR1; // Linux arm64 SIGUSR1
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
// SAFETY: Board owns a shared mapping containing only aligned atomics; Arc keeps it mapped
// across every thread access.
unsafe impl Send for Board {}
// SAFETY: entry() lends only atomic fields, and the final Arc unmaps after all readers have
// dropped their leases.
unsafe impl Sync for Board {}
use libc::{
    eventfd, fcntl, memfd_create, mmap, munmap, poll, pollfd as PollFd, read, syscall, write,
};

fn owned(fd: i32) -> File {
    assert!(fd >= 0, "{}", io::Error::last_os_error());
    // SAFETY: Every caller supplies a newly returned or uniquely inherited descriptor;
    // the nonnegative check precedes transfer to its sole File owner.
    unsafe { File::from_raw_fd(fd) }
}
fn inherit(fd: RawFd, yes: bool) {
    assert_eq!(
        // SAFETY: fd is held live by the board or Wake; F_SETFD takes only the
        // scalar descriptor flags and does not retain a pointer.
        unsafe { fcntl(fd, libc::F_SETFD, if yes { 0 } else { libc::FD_CLOEXEC }) },
        0
    );
}
impl Board {
    fn map(file: File, len: usize, changes: Wake) -> Arc<Self> {
        let bytes = len * size_of::<Entry>();
        // SAFETY: The owned file has len initialized entries. mmap requests exactly
        // that shared extent and checks success before any access.
        let p = unsafe {
            mmap(
                ptr::null_mut(),
                bytes,
                libc::PROT_READ | libc::PROT_WRITE,
                libc::MAP_SHARED,
                file.as_raw_fd(),
                0,
            )
        };
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
        // SAFETY: slot is checked against len, and mmap provides sufficient
        // alignment for Entry. Only atomic fields are accessed across
        // threads/processes.
        unsafe { &*self.ptr.add(slot) }
    }
}
impl Drop for Board {
    fn drop(&mut self) {
        // SAFETY: The last Arc owns this mapping; all Lease borrows have ended, and
        // unmap uses exactly the original extent.
        unsafe {
            munmap(self.ptr.cast(), self.len * size_of::<Entry>());
        }
    }
}
#[derive(Clone)]
pub(crate) struct Wake(Arc<File>);
impl Default for Wake {
    fn default() -> Self {
        Self::new()
    }
}
impl Wake {
    pub fn new() -> Self {
        // SAFETY: eventfd takes scalar arguments and returns a fresh descriptor
        // adopted exactly once by owned().
        Self(Arc::new(owned(unsafe {
            eventfd(0, libc::EFD_CLOEXEC | libc::EFD_NONBLOCK)
        })))
    }
    pub fn notify(&self) {
        self.try_notify().expect("owner eventfd write");
    }
    pub fn try_notify(&self) -> io::Result<()> {
        try_notify(self.0.as_raw_fd())
    }
    /// Wait for a notification, or until `deadline` (owner idle trimming).
    pub fn wait_until(&self, deadline: Option<std::time::Instant>) {
        let mut fd = PollFd {
            fd: self.0.as_raw_fd(),
            events: libc::POLLIN,
            revents: 0,
        };
        loop {
            let timeout = deadline.map_or(-1, |d| {
                let left = d.saturating_duration_since(std::time::Instant::now());
                // Round up so a wakeup is never early; cap at poll's int range.
                left.as_nanos().div_ceil(1_000_000).min(i32::MAX as u128) as i32
            });
            // SAFETY: The single initialized pollfd is live and writable
            // throughout poll; its File remains owned by Wake.
            let n = unsafe { poll(&mut fd, 1, timeout) };
            if n < 0 && io::Error::last_os_error().raw_os_error() == Some(libc::EINTR) {
                continue;
            }
            if n == 0 && timeout >= 0 {
                return;
            }
            assert_eq!(n, 1, "owner wake poll");
            if consume(fd.fd) {
                return;
            }
        }
    }
}
fn notify(fd: RawFd) {
    try_notify(fd).expect("eventfd write");
}
fn try_notify(fd: RawFd) -> io::Result<()> {
    loop {
        let one = 1u64;
        // SAFETY: one is a live eight-byte eventfd value; fd is owned by Wake.
        let n = unsafe { write(fd, (&one as *const u64).cast(), 8) };
        if n == 8 {
            return Ok(());
        }
        let error = io::Error::last_os_error();
        match error.raw_os_error() {
            Some(libc::EINTR) => continue,
            Some(libc::EAGAIN) => return Ok(()),
            _ => return Err(error),
        }
    }
}
fn consume(fd: RawFd) -> bool {
    loop {
        let mut count = 0u64;
        // SAFETY: count is writable for the eight-byte eventfd read and fd is held live by a Wake.
        if unsafe { read(fd, (&mut count as *mut u64).cast(), 8) } == 8 {
            return true;
        }
        match io::Error::last_os_error().raw_os_error() {
            Some(libc::EINTR) => continue,
            Some(libc::EAGAIN) => return false,
            e => panic!("eventfd read: {e:?}"),
        }
    }
}
#[derive(Clone)]
pub(crate) struct Lease {
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
        e.tid
            // SAFETY: gettid takes no pointer arguments and returns the current owner thread ID.
            .store(unsafe { syscall(libc::SYS_gettid) } as u64, Relaxed); // gettid
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
pub(crate) struct Watchdog {
    board: Arc<Board>,
    child: Child,
    /// The child's pidfd: readable once it exits, so the reactor polls it
    /// with its own descriptors instead of probing with wait4.
    exit: OwnedFd,
}
impl Watchdog {
    pub fn start(slots: usize, wakes: &[Wake], grace_ms: u64) -> Self {
        assert!(slots > 0 && !wakes.is_empty() && grace_ms > 0);
        // SAFETY: kick has the signal-handler ABI and remains live for the
        // process. It only updates this thread's registered atomic/TLS state.
        unsafe {
            libc::signal(SIGNAL, kick as *const () as libc::sighandler_t);
        }
        let file =
            // SAFETY: kick has the signal-handler ABI and remains live for the
            // process. memfd_create receives a static NUL-terminated name and
            // returns a fresh descriptor adopted once.
            owned(unsafe { memfd_create(c"jitk-leases".as_ptr().cast(), libc::MFD_CLOEXEC) });
        file.set_len((slots * size_of::<Entry>()) as u64).unwrap();
        let board = Board::map(file, slots, Wake::new());
        let change_fd = board.changes.0.as_raw_fd();
        inherit(change_fd, true);
        let fd = board._file.as_raw_fd();
        inherit(fd, true);
        for w in wakes {
            inherit(w.0.as_raw_fd(), true);
        }
        #[cfg(not(test))]
        let executable = std::env::current_exe().unwrap();
        #[cfg(test)]
        let executable = std::path::PathBuf::from(
            std::env::var("JITK_SHARD_TEST_BINARY")
                .expect("KVM owner tests require a built real watchdog binary"),
        );
        let child = Command::new(executable)
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
        // An unreaped child's pid cannot be reused, so this names it.
        // SAFETY: pidfd_open takes scalar arguments and returns a fresh fd.
        let exit = owned(unsafe { syscall(libc::SYS_pidfd_open, child.id(), 0) } as i32).into();
        Self { board, child, exit }
    }
    /// Readable once the watchdog process has exited.
    pub fn exit_fd(&self) -> BorrowedFd<'_> {
        self.exit.as_fd()
    }
    /// The watchdog is gone, so no deadline would be enforced: fail closed.
    /// (Confined, the shard can neither reap nor wait; it only exits.)
    pub fn exited(&self) -> ! {
        eprintln!("watchdog exited unexpectedly");
        std::process::exit(70);
    }
    pub fn slot(&self, slot: usize) -> Lease {
        Lease {
            board: self.board.clone(),
            slot,
            generation: 0,
        }
    }
    /// Expedite active leases while retaining independent reset escalation.
    pub fn request_stop(&self) -> io::Result<()> {
        for slot in 0..self.board.len {
            let e = self.board.entry(slot);
            if e.state.load(Acquire) & 3 == ARMED {
                e.deadline.store(monotonic_ns(), Release);
            }
        }
        self.board.changes.try_notify()
    }
    pub fn shutdown(&mut self) -> io::Result<()> {
        if (0..self.board.len).any(|slot| self.board.entry(slot).state.load(Acquire) & 3 != 0) {
            return Err(io::Error::other(
                "watchdog shutdown before slot reset acknowledgement",
            ));
        }
        if self.child.try_wait()?.is_none() {
            self.child.kill()?;
        }
        self.child.wait()?;
        Ok(())
    }
    /// Fail closed if the watchdog has exited (unconfined callers: the
    /// offline harness's blocking `Pool::recv`).
    pub fn check(&mut self) {
        if let Some(status) = self.child.try_wait().unwrap() {
            eprintln!("watchdog exited unexpectedly: {status}");
            std::process::exit(70);
        }
    }
}
impl Drop for Watchdog {
    fn drop(&mut self) {
        // Unreset leases must keep independent escalation alive if owners are
        // still running. The child observes the shard pidfd and exits when it dies.
        let idle =
            (0..self.board.len).all(|slot| self.board.entry(slot).state.load(Acquire) & 3 == 0);
        if idle {
            let _ = self.child.kill();
            let _ = self.child.wait();
        }
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
            // SAFETY: CURRENT is non-null only while the same thread holds
            // Running, whose borrow keeps this AtomicU8 live; the handler
            // performs only an atomic store.
            unsafe { &*p }.store(1, Release);
        }
    });
}
/// The pointer lives for the whole KVM_RUN; only its owner can unmap it.
pub(crate) struct Running<'a> {
    _exit: std::marker::PhantomData<&'a AtomicU8>,
    // Registration and clearing use this thread's TLS.
    _owner: std::marker::PhantomData<*mut ()>,
}
impl<'a> Running<'a> {
    pub fn enter(immediate_exit: &'a AtomicU8) -> (Self, bool) {
        CURRENT.with(|p| p.set(immediate_exit));
        (
            Self {
                _exit: std::marker::PhantomData,
                _owner: std::marker::PhantomData,
            },
            KICKED.with(|p| p.replace(false)),
        )
    }
}
impl Drop for Running<'_> {
    fn drop(&mut self) {
        CURRENT.with(|p| p.set(ptr::null()));
    }
}

struct Stopping {
    slot: usize,
    key: u64,
    fired: u64,
}
fn escalate(
    board: &Board,
    pid: i32,
    pidfd: &File,
    stopping: &mut Vec<Stopping>,
    now: u64,
    grace_ns: u64,
) -> u64 {
    let mut next = u64::MAX;
    stopping.retain(|&Stopping { slot, key, fired }| {
        let entry = board.entry(slot);
        if entry.state.load(Acquire) != key {
            return false;
        }
        if now.saturating_sub(fired) >= grace_ns {
            if entry
                .state
                .compare_exchange(key, key + 1, AcqRel, Acquire)
                .is_ok()
            {
                let generation = key >> 2;
                eprintln!(
                    "watchdog escalation: shard={pid} slot={slot} generation={generation} grace_ns={grace_ns}"
                );
                // SAFETY: pidfd is live and identifies the tracked shard; null
                // siginfo requests the kernel default, with scalar signal/flags.
                let result = unsafe {
                    syscall(
                        libc::SYS_pidfd_send_signal,
                        pidfd.as_raw_fd(),
                        libc::SIGKILL,
                        ptr::null::<u8>(),
                        0,
                    )
                };
                assert_eq!(result, 0, "pidfd_send_signal");
            }
            false
        } else {
            next = next.min(fired + grace_ns);
            true
        }
    });
    next
}

pub fn run(a: &[String]) {
    let pid: i32 = a[2].parse().unwrap();
    let fd: i32 = a[3].parse().unwrap();
    let len: usize = a[4].parse().unwrap();
    let grace_ns = a[5].parse::<u64>().unwrap() * 1_000_000;
    let wakes: Vec<i32> = a[6].split(',').map(|s| s.parse().unwrap()).collect();
    // SAFETY: the private watchdog CLI transfers its live change-eventfd
    // exactly once; this process has no other File owner for it.
    let changes = Wake(Arc::new(unsafe {
        File::from_raw_fd(a[7].parse().unwrap())
    }));
    // SAFETY: the private watchdog CLI transfers its live board memfd
    // exactly once; this process has no other File owner for it.
    let board = Board::map(unsafe { File::from_raw_fd(fd) }, len, changes);
    // SAFETY: pidfd_open takes scalar arguments and returns a fresh owned fd.
    let pidfd = owned(unsafe { syscall(libc::SYS_pidfd_open, pid, 0) } as i32); // pidfd_open
    // Everything is open: from here the watchdog only polls, kicks and kills
    // (confine::policy::watchdog). It shares the shard's namespaces and
    // no_new_privs, and is outside the shard's Landlock domain.
    let mut confinement = Confinement::new();
    let confined = confinement.close_files(Signals::Unscoped).and_then(|()| {
        confinement.filter_syscalls(&policy::watchdog(pid as u32, pidfd.as_raw_fd()))
    });
    if let Err(e) = confined {
        eprintln!("watchdog: {e}");
        std::process::exit(70);
    }
    confinement.report().warn("watchdog");
    let mut fds = [
        PollFd {
            fd: pidfd.as_raw_fd(),
            events: libc::POLLIN,
            revents: 0,
        },
        PollFd {
            fd: board.changes.0.as_raw_fd(),
            events: libc::POLLIN,
            revents: 0,
        },
    ];
    let mut stopping = Vec::<Stopping>::new();
    let mut timeout = -1;
    loop {
        // SAFETY: fds contains two initialized writable pollfds; the board
        // and pidfd owners keep both descriptors live for this call.
        let n = unsafe { poll(fds.as_mut_ptr(), fds.len() as libc::nfds_t, timeout) };
        if n < 0 {
            assert_eq!(io::Error::last_os_error().raw_os_error(), Some(libc::EINTR));
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
                stopping.push(Stopping {
                    slot,
                    key: key + 1,
                    fired: now,
                });
                // SAFETY: tgkill takes scalar process/thread IDs and a signal number;
                // the generation-fenced lease supplies the owner thread ID.
                unsafe {
                    syscall(libc::SYS_tgkill, pid, e.tid.load(Relaxed) as i32, SIGNAL);
                }
                notify(wakes[slot % wakes.len()]);
            }
        }
        next = next.min(escalate(&board, pid, &pidfd, &mut stopping, now, grace_ns));
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
    use super::{
        ARMED, Board, EXPIRED, Entry, Lease, Running, SIGNAL, Wake, Watchdog, kick, owned,
    };
    use libc::memfd_create;
    use std::{
        process::Command,
        sync::atomic::{
            AtomicU8,
            Ordering::{AcqRel, Acquire, Release},
        },
    };
    fn lease() -> Lease {
        let f =
            // SAFETY: The static NUL-terminated name is valid through
            // memfd_create; owned() adopts its fresh checked descriptor once.
            owned(unsafe { memfd_create(c"jitk-lease-test".as_ptr().cast(), libc::MFD_CLOEXEC) });
        f.set_len(size_of::<Entry>() as u64).unwrap();
        Lease {
            board: Board::map(f, 1, Wake::new()),
            slot: 0,
            generation: 0,
        }
    }
    #[test]
    fn watchdog_drop_tolerates_unreset_leases_and_reaped_child() {
        let lease = lease();
        lease.board.entry(0).state.store(ARMED, Release);
        let mut child = Command::new("true").spawn().unwrap();
        child.wait().unwrap();
        drop(Watchdog {
            board: lease.board,
            child,
            exit: std::fs::File::open("/dev/null").unwrap().into(),
        });
    }
    #[test]
    fn kick_between_entries_yields_before_running_another_slot() {
        let exit = AtomicU8::new(0);
        kick(SIGNAL); // no vCPU is registered when a parked slot expires
        let (running, pending) = Running::enter(&exit);
        assert!(pending);
        assert_eq!(exit.load(Acquire), 0);
        kick(SIGNAL); // also cover the registered-pointer / pre-ioctl window
        assert_eq!(exit.load(Acquire), 1);
        drop(running);
        exit.store(0, Release);
        let (running, pending) = Running::enter(&exit);
        assert!(pending);
        drop(running);
        let (_running, pending) = Running::enter(&exit);
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
