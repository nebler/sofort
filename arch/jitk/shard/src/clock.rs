//! Host clock reads shared by VM owners and the independent watchdog, and the
//! shard clock that keeps a running guest's time current.
//!
//! The ring kernel reads the control page's MONOTONIC_NS word for every
//! clock_gettime (kernel/src/wait_ring.rs; realtime is that plus the epoch
//! offset taken at bind). The owner stores it before each KVM_RUN, so without
//! more the guest clock stands still while a job computes. One clock thread
//! per Pool (not per VM) refreshes the word of every slot whose vCPU is inside
//! KVM_RUN once per TICK, and parks while none is. It writes guest RAM only
//! inside that window, which already counts as dirtying the slot, and never
//! during decode or reset: leaving the window waits out a store in progress.
use std::{
    sync::{
        Arc, OnceLock,
        atomic::{AtomicBool, AtomicPtr, AtomicU8, AtomicU64, AtomicUsize, Ordering::*},
    },
    thread::{self, JoinHandle, Thread},
    time::Duration,
};
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
/// The clock of IPC deadlines and STATS times on macOS: CLOCK_MONOTONIC_RAW,
/// which is mach_continuous_time, the base of Node's process.hrtime (libuv),
/// so the executor and the HVF engine compare deadlines on one clock. (macOS's
/// CLOCK_MONOTONIC is another base, at µs resolution; on Linux the IPC clock
/// is CLOCK_MONOTONIC, through the executor's native binding.)
#[cfg(target_os = "macos")]
pub fn ipc_ns() -> u64 {
    clock_ns(libc::CLOCK_MONOTONIC_RAW)
}

/// Guest clock resolution while a vCPU runs (Date.now() is in ms).
pub const TICK: Duration = Duration::from_millis(1);
/// Idle ticks before the clock thread parks.
const IDLE_TICKS: u32 = 10;
const IDLE: u8 = 0;
const RUNNING: u8 = 1;
const STORING: u8 = 2;
struct Entry {
    state: AtomicU8,
    /// The slot's MONOTONIC_NS control word; meaningful only while RUNNING.
    word: AtomicPtr<AtomicU64>,
}
struct Shared {
    entries: Box<[Entry]>,
    running: AtomicUsize,
    parked: AtomicBool,
    stop: AtomicBool,
    thread: OnceLock<Thread>,
}
impl Shared {
    fn wake(&self) {
        if let Some(t) = self.thread.get() {
            t.unpark();
        }
    }
    fn tick(&self) {
        for e in &self.entries {
            if e.state
                .compare_exchange(RUNNING, STORING, Acquire, Relaxed)
                .is_ok()
            {
                // SAFETY: RUNNING was published (Release) after `word` by a
                // live Ticking guard, which borrows the word's mapping and
                // cannot leave the window until STORING is RUNNING again.
                // Read after the CAS, the time is at least the owner's store.
                unsafe { &*e.word.load(Relaxed) }.store(monotonic_ns(), Release);
                e.state.store(RUNNING, Release);
            }
        }
    }
    fn run(&self) {
        let mut idle = 0;
        while !self.stop.load(Acquire) {
            if self.running.load(SeqCst) == 0 {
                idle += 1;
                if idle >= IDLE_TICKS {
                    // Pairs with enter(): either it sees `parked` and unparks,
                    // or this load sees its vCPU and does not park.
                    self.parked.store(true, SeqCst);
                    if self.running.load(SeqCst) == 0 && !self.stop.load(Acquire) {
                        thread::park();
                    }
                    self.parked.store(false, SeqCst);
                    idle = 0;
                    continue;
                }
            } else {
                idle = 0;
            }
            thread::sleep(TICK);
            self.tick();
        }
    }
}
/// The clock thread; dropping it stops and joins the thread.
pub struct Clock {
    shared: Arc<Shared>,
    join: Option<JoinHandle<()>>,
}
impl Clock {
    pub fn start(slots: usize) -> Self {
        let shared = Arc::new(Shared {
            entries: (0..slots)
                .map(|_| Entry {
                    state: AtomicU8::new(IDLE),
                    word: AtomicPtr::new(std::ptr::null_mut()),
                })
                .collect(),
            running: AtomicUsize::new(0),
            parked: AtomicBool::new(false),
            stop: AtomicBool::new(false),
            thread: OnceLock::new(),
        });
        let s = shared.clone();
        let join = thread::Builder::new()
            .name("jitk-clock".into())
            .spawn(move || s.run())
            .unwrap();
        shared.thread.set(join.thread().clone()).unwrap();
        Self {
            shared,
            join: Some(join),
        }
    }
    pub fn cell(&self, slot: usize) -> Cell {
        assert!(slot < self.shared.entries.len());
        Cell {
            shared: self.shared.clone(),
            slot,
        }
    }
}
impl Drop for Clock {
    fn drop(&mut self) {
        self.shared.stop.store(true, Release);
        self.shared.wake();
        if let Some(j) = self.join.take() {
            let _ = j.join();
        }
    }
}
/// One slot's registration with the clock; only its owner thread enters it.
#[derive(Clone)]
pub struct Cell {
    shared: Arc<Shared>,
    slot: usize,
}
impl Cell {
    /// Open the refresh window around one KVM_RUN of this slot. `word` is the
    /// slot's MONOTONIC_NS control word, already stored for this entry.
    pub fn enter<'a>(&'a self, word: &'a AtomicU64) -> Ticking<'a> {
        let e = &self.shared.entries[self.slot];
        e.word
            .store(word as *const AtomicU64 as *mut AtomicU64, Relaxed);
        e.state.store(RUNNING, Release);
        self.shared.running.fetch_add(1, SeqCst);
        if self.shared.parked.load(SeqCst) {
            self.shared.wake();
        }
        Ticking {
            entry: e,
            running: &self.shared.running,
            _word: std::marker::PhantomData,
        }
    }
}
pub struct Ticking<'a> {
    entry: &'a Entry,
    running: &'a AtomicUsize,
    _word: std::marker::PhantomData<&'a AtomicU64>,
}
impl Drop for Ticking<'_> {
    fn drop(&mut self) {
        // A store in progress takes nanoseconds; after this CAS none can start.
        while self
            .entry
            .state
            .compare_exchange_weak(RUNNING, IDLE, AcqRel, Relaxed)
            .is_err()
        {
            std::hint::spin_loop();
        }
        self.running.fetch_sub(1, SeqCst);
    }
}

#[cfg(test)]
mod tests {
    use super::{Clock, TICK, monotonic_ns};
    use std::{sync::atomic::AtomicU64, sync::atomic::Ordering::Acquire, thread, time::Duration};
    #[test]
    fn refreshes_only_inside_the_window() {
        let clock = Clock::start(2);
        let (cell, other) = (clock.cell(0), clock.cell(1));
        let (word, idle) = (AtomicU64::new(1), AtomicU64::new(1));
        // The clock parks while no slot runs, then wakes for the first entry.
        thread::sleep(TICK * 20);
        let before = monotonic_ns();
        {
            let _ticking = cell.enter(&word);
            let _other = other.enter(&idle);
            drop(_other);
            thread::sleep(TICK * 10);
        }
        let seen = word.load(Acquire);
        assert!(
            seen >= before && seen <= monotonic_ns(),
            "{seen} vs {before}"
        );
        // Outside the window nothing is written, however long it lasts.
        thread::sleep(TICK * 5);
        assert_eq!(word.load(Acquire), seen);
        // Successive windows never move the clock backwards.
        let mut last = seen;
        for _ in 0..50 {
            let _ticking = cell.enter(&word);
            thread::sleep(Duration::from_micros(300));
            drop(_ticking);
            let now = word.load(Acquire);
            assert!(now >= last);
            last = now;
        }
        assert!(last > seen, "a 15 ms run of windows advanced the clock");
        drop(clock);
    }
}
