//! Slot reset: return all guest-writable state to the snapshot between tenants.
//!
//! Pristine invariant, established by `Slot::reset` and by `Slot::create`, and
//! required by `Slot::bind`:
//! - every byte of both writable extents (class arena, transport) equals the
//!   snapshot file, as the host reads it and as a guest reads it with any
//!   memory attributes. The immutable extents cannot differ: they are
//!   `PROT_READ` on the host and read-only in the VM, so neither side can
//!   write them;
//! - every register in the snapshot's file was written with its snapshot
//!   value by this reset, except registers neither the guest nor the
//!   hypervisor can change after the first run (`Vcpu::reset`);
//! - the vCPU is runnable, no exit is half-done and no kick is pending;
//! - the host's ring cursors and call bitmaps are zero.
//!
//! Memory is the backend's (`Vm::restore_memory`): KVM copies the private
//! pages pagemap names and cleans them to the point of coherency, or discards
//! them (kvm/reset.rs); HVF replaces both writable mappings with fresh ones of
//! the file (hvf.rs). Both state what they rely on for a guest that runs with
//! its caches off.
use super::{RAM, Slot, writable};
use crate::hv::{Memory, Vcpu, Vm};
use std::{
    io,
    os::unix::fs::FileExt,
    sync::atomic::{AtomicU64, Ordering::Relaxed},
    time::{Duration, Instant},
};

const PAGE: usize = 4096;

/// Per-slot reset policy. The shard binary takes it as one option string.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ResetPolicy {
    /// Most private pages a reset restores by copying; above it the reset
    /// discards them, and the next run faults them in again. None: no cap
    /// below the class's writable window, so every reset copies and a hot
    /// slot holds at most that window between runs (glue-2m: 340 pages,
    /// 1.33 MiB) until idle trim. Some(0) always discards. KVM only.
    pub copy_limit: Option<usize>,
    /// Discard the private pages of a pristine, idle slot after this long.
    pub idle_trim: Option<Duration>,
    /// After every reset and trim, compare both writable extents with the
    /// snapshot file and every register with the snapshot; panic on mismatch.
    pub verify: bool,
    /// After every Nth reset of a slot, check its content (`Slot::reset`);
    /// 0 disables it.
    pub sample_every: u32,
}
impl Default for ResetPolicy {
    /// No copy cap: a run's private pages grow with its payload (glue-2m:
    /// 84 for `return 2`, 173 for a 30 KB source, 184 for a 50 KB result),
    /// and a discard makes the next run fault every one of them in again.
    /// On nested KVM that took a 50 KB result from 5.2 to 44 ms of guest
    /// CPU. Idle trim, not a cap, returns the memory.
    ///
    /// 2 s idle trim: a slot in rotation under any sustained load is reused far
    /// sooner (64 slots at 100 runs/s: every 0.64 s), while memory returns
    /// within ~2 s once load drops. One trimmed reuse costs one discard-path run
    /// (~230 stage-2 faults), at most once per slot per 2 s.
    ///
    /// Sampling every 1,024th reset: one check of the writable extents and
    /// registers took 0.8-1.7 ms on nested KVM (debug test build), about
    /// 1 µs per reset amortized, and it runs before the slot is released,
    /// not when a run is admitted.
    fn default() -> Self {
        Self {
            copy_limit: None,
            idle_trim: Some(Duration::from_secs(2)),
            verify: false,
            sample_every: 1024,
        }
    }
}
impl ResetPolicy {
    /// Parse `copy-limit=N,idle-trim-ms=M|off,sample-every=N,verify`; omitted
    /// keys keep defaults.
    pub fn parse(s: &str) -> Result<Self, String> {
        let mut p = Self::default();
        for item in s.split(',').filter(|i| !i.is_empty()) {
            match item.split_once('=') {
                Some(("copy-limit", n)) => {
                    let n: usize = n.parse().map_err(|_| format!("reset policy: {item}"))?;
                    if n > RAM / PAGE {
                        return Err("reset policy: copy-limit above RAM pages".into());
                    }
                    p.copy_limit = Some(n);
                }
                Some(("idle-trim-ms", "off")) => p.idle_trim = None,
                Some(("idle-trim-ms", n)) => {
                    let ms: u64 = n.parse().map_err(|_| format!("reset policy: {item}"))?;
                    p.idle_trim = Some(Duration::from_millis(ms));
                }
                Some(("sample-every", n)) => {
                    p.sample_every = n.parse().map_err(|_| format!("reset policy: {item}"))?;
                }
                None if item == "verify" => p.verify = true,
                _ => return Err(format!("reset policy: unknown option {item:?}")),
            }
        }
        Ok(p)
    }
}

/// Why a reset discarded instead of copying.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Discard {
    /// More private pages than the policy's `copy_limit` (or it is 0).
    Limit,
    /// A pagemap entry the copy path cannot prove clean or private.
    Ambiguous,
    /// pagemap could not be opened or read, or the page size is not 4 KiB.
    Unavailable,
}
/// A slot whose reset failed (or whose content failed a sampled check twice).
/// It is never bound again; its owner keeps serving its other slots.
#[derive(Debug)]
pub struct Quarantined(pub String);
impl std::fmt::Display for Quarantined {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "slot quarantined: {}", self.0)
    }
}
/// Process-wide counts for operators: sampled checks run, sampled checks that
/// found a pristine-flagged slot whose content differed, slots quarantined.
pub static SAMPLED: AtomicU64 = AtomicU64::new(0);
pub static SAMPLE_FAILURES: AtomicU64 = AtomicU64::new(0);
pub static QUARANTINED: AtomicU64 = AtomicU64::new(0);
#[derive(Clone, Copy, Debug, Default)]
pub struct ResetReport {
    pub ns: u64,
    /// Private pages found and restored (KVM copy path); with Limit, how many
    /// were counted before the limit was exceeded. HVF: pages replaced.
    pub private: u32,
    pub discard: Option<Discard>,
}

impl<V: Vm> Slot<V> {
    /// Return this stopped slot to the pristine invariant (module docs). Any
    /// failure (a call the hypervisor or kernel rejects) quarantines this slot
    /// only: it is never bound again, and its owner keeps serving other slots.
    ///
    /// Every `sample_every`th reset is then checked (`content_mismatch`). A
    /// mismatch is logged and counted, the slot is reset again on the discard
    /// path and checked again; a second mismatch quarantines it. Both engines
    /// reset when a run is released or fails, so the check delays the slot's
    /// return to service, never a run's admission.
    pub fn reset(&mut self) -> Result<ResetReport, Quarantined> {
        if let Some(why) = &self.quarantined {
            return Err(Quarantined(why.clone()));
        }
        self.pristine.set(false);
        let report = self
            .try_reset()
            .map_err(|e| self.quarantine(format!("reset failed: {e}")))?;
        self.resets += 1;
        let every = u64::from(self.policy.sample_every);
        if every != 0 && self.resets.is_multiple_of(every) {
            self.sampled_check()?;
        }
        self.reset_at = Instant::now();
        self.pristine.set(true);
        Ok(report)
    }
    fn sampled_check(&mut self) -> Result<(), Quarantined> {
        SAMPLED.fetch_add(1, Relaxed);
        let Some(why) = self.content_mismatch() else {
            return Ok(());
        };
        SAMPLE_FAILURES.fetch_add(1, Relaxed);
        eprintln!(
            "shard: SECURITY: a reset slot failed the sampled content check ({why}); discard-resetting it"
        );
        let limit = self.policy.copy_limit.replace(0);
        let again = self.try_reset();
        self.policy.copy_limit = limit;
        again.map_err(|e| self.quarantine(format!("reset failed: {e}")))?;
        match self.content_mismatch() {
            Some(why) => Err(self.quarantine(format!("content after a discard reset: {why}"))),
            None => Ok(()),
        }
    }
    fn quarantine(&mut self, why: String) -> Quarantined {
        eprintln!("shard: slot quarantined, never bound again: {why}");
        QUARANTINED.fetch_add(1, Relaxed);
        self.pristine.set(false);
        self.quarantined = Some(why.clone());
        Quarantined(why)
    }
    pub fn is_quarantined(&self) -> bool {
        self.quarantined.is_some()
    }
    /// Why this slot is out of service (the IPC QUARANTINED reason), if it is.
    pub fn quarantine_reason(&self) -> Option<&str> {
        self.quarantined.as_deref()
    }
    fn try_reset(&mut self) -> io::Result<ResetReport> {
        let t = Instant::now();
        self.shutdown()?; // completes a half-done exit (KVM: pending MMIO)
        let memory = Memory {
            ram: &self.ram,
            snapshot: self.snapshot.as_ref().expect("reset needs a snapshot slot"),
            policy: &self.policy,
            resident: &self.resident,
        };
        let mut report = self.vm.restore_memory(&memory)?;
        self.vcpu.reset(&memory.snapshot.regs)?;
        #[cfg(test)]
        self.vcpu.test_reject(self.generation)?;
        self.tx = 0;
        self.rx = 0;
        self.rx_consumed = 0;
        self.calls = Default::default();
        self.replies = 0;
        self.partial = None;
        self.backlog.clear();
        self.logs = 0;
        self.exits = 0;
        report.ns = t.elapsed().as_nanos() as u64;
        if self.policy.verify {
            self.verify("reset");
        }
        Ok(report)
    }
    /// The only way to a bind: a pristine slot as it is, any other reset
    /// first. A quarantined slot is never pristine, so it fails here.
    pub fn admit(&mut self) -> Result<Option<ResetReport>, Quarantined> {
        if self.pristine.get() {
            Ok(None)
        } else {
            self.reset().map(Some)
        }
    }
    /// The sampled check: what a reset restores, both writable extents byte
    /// for byte against the file, every register and the run state. The
    /// immutable extents are not compared: no reset touches them, and the
    /// pristine invariant holds them by construction (module docs).
    pub fn content_mismatch(&self) -> Option<String> {
        if !self.writable_pristine() {
            return Some("writable RAM".into());
        }
        let regs = self.register_mismatches();
        (!regs.is_empty()).then(|| format!("registers {regs:#x?}"))
    }
    /// A pristine slot idle for the policy's trim time drops its private pages.
    pub fn trim_due(&self) -> Option<Instant> {
        let due = self.reset_at + self.policy.idle_trim?;
        (self.pristine.get() && self.resident.get()).then_some(due)
    }
    /// Discard a pristine slot's private pages. Their bytes already equal the
    /// file, so the slot stays pristine; the next run faults them in again. A
    /// failure quarantines the slot.
    pub fn trim(&mut self) {
        assert!(self.pristine.get(), "trim of a slot that is not pristine");
        let memory = Memory {
            ram: &self.ram,
            snapshot: self.snapshot.as_ref().expect("trim needs a snapshot slot"),
            policy: &self.policy,
            resident: &self.resident,
        };
        if let Err(e) = self.vm.discard_memory(&memory) {
            self.quarantine(format!("trim failed: {e}"));
            return;
        }
        if self.policy.verify {
            self.verify("trim");
        }
    }
    pub fn is_pristine(&self) -> bool {
        self.pristine.get()
    }
    /// Whether the slot may hold private pages (false after a discard or trim).
    pub fn is_resident(&self) -> bool {
        self.resident.get()
    }
    fn verify(&self, after: &str) {
        assert!(
            self.writable_pristine(),
            "{after}: a writable page differs from the snapshot"
        );
        let regs = self.register_mismatches();
        assert!(
            regs.is_empty(),
            "{after}: registers differ from the snapshot: {regs:#x?}"
        );
    }
    /// Compare [start, end) of guest RAM with the snapshot file, read through
    /// the descriptor rather than the copy path's view.
    pub(crate) fn matches_file(&self, start: usize, end: usize) -> bool {
        assert!(start <= end && end <= RAM);
        let mut buf = vec![0u8; 1 << 16];
        let memory = &self.snapshot().memory;
        let mut off = start;
        while off < end {
            let n = (end - off).min(buf.len());
            memory.read_exact_at(&mut buf[..n], off as u64).unwrap();
            // SAFETY: [off, off+n) is inside this live RAM mapping, the vCPU is
            // stopped, and memcmp reads through raw pointers without a Rust borrow.
            if unsafe { libc::memcmp(self.ram.ptr.add(off).cast(), buf.as_ptr().cast(), n) } != 0 {
                return false;
            }
            off += n;
        }
        true
    }
    /// Every byte of guest RAM equals the snapshot file.
    pub fn pristine(&self) -> bool {
        self.matches_file(0, RAM)
    }
    /// Every byte of both writable extents equals the snapshot file.
    pub fn writable_pristine(&self) -> bool {
        writable(self.snapshot().class).all(|(start, end)| self.matches_file(start, end))
    }
    /// Registers whose live value differs from the snapshot, plus any present
    /// on only one side, and a run state other than the snapshot's (id 0).
    pub fn register_mismatches(&self) -> Vec<u64> {
        self.vcpu.mismatches(&self.snapshot().regs)
    }
}

#[cfg(test)]
mod tests {
    use super::ResetPolicy;
    use std::time::Duration;
    #[test]
    fn reset_policy_parses_and_rejects() {
        assert_eq!(ResetPolicy::parse("").unwrap(), ResetPolicy::default());
        let p = ResetPolicy::parse("copy-limit=0,idle-trim-ms=off,verify").unwrap();
        assert_eq!((p.copy_limit, p.idle_trim, p.verify), (Some(0), None, true));
        let p = ResetPolicy::parse("idle-trim-ms=50").unwrap();
        assert_eq!(p.idle_trim, Some(Duration::from_millis(50)));
        assert_eq!(ResetPolicy::default().sample_every, 1024);
        assert_eq!(
            ResetPolicy::parse("sample-every=0").unwrap().sample_every,
            0
        );
        assert!(ResetPolicy::parse("sample-every=-1").is_err());
        for bad in [
            "copy-limit=-1",
            "copy-limit=9000",
            "idle-trim-ms=x",
            "verify=1",
            "fast",
        ] {
            assert!(ResetPolicy::parse(bad).is_err(), "{bad}");
        }
    }
}
