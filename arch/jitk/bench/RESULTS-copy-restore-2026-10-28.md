# Shard copy-restore reset: before/after (2026-10-28, Linux KVM, nested)

R9 wins #1 and #4 (`arch/review/R9-PERF-MEMORY.md` §1a, §1b, §2a, §4), productionized.
Before = main `6d2c0a22`. After = this branch: copy-restore reset by default, one reset
per slot lifecycle, ID registers skipped in the register restore, idle trimming.
All CPU and latency numbers are **nested (HVF → KVM) and indicative only**. Counts (faults,
exits, syscalls, pages) and memory are valid.

**Headline.** A sequential `return 2` costs **0.28 owner-CPU ms instead of 18.2** (65×). It
takes **1 stage-2 fault instead of 229**, 1 KVM exit instead of 240, and no MMU-notifier
invalidations instead of 72. Through the Node executor, a one-tool `execute()` takes **1.10 ms
p50 instead of 39.0**, and total CPU drops from **39.4 to 1.72 ms per run**. Owner ioctls fall
from 518 to 201 per run: one reset instead of two, 197 registers instead of 257. One slot
serves 691 runs/s instead of 23.

## What changed
- **Copy-restore.** At reset, `/proc/self/pagemap` lists the writable-extent pages the run
  privately CoW'd. Each is overwritten from a read-only `MAP_SHARED` view of the snapshot
  file and cleaned to PoC (`DC CIVAC`). Host PTEs and stage-2 mappings stay valid. Any
  ambiguous pagemap state, an unreadable pagemap, a non-4 KiB page size, or more private
  pages than `copy-limit` falls back to `MADV_DONTNEED` for the whole reset (the old path).
- **Policy.** `copy-limit=128,idle-trim-ms=2000[,verify]`: `real ipc BASE SLOTS OWNERS [POLICY]`,
  or `JITK_SHARD_RESET` for the offline scenarios. `verify` compares both writable extents
  with the file and every register with the snapshot after each reset and trim, and aborts
  on any difference.
- **One reset per lifecycle.** `Slot` tracks a pristine flag; `bind()` requires it. `begin()`
  and RELEASE reset only a slot that is not pristine. The IPC path (DONE → CANCEL/RELEASE →
  START) used to reset twice; it now resets once, at RELEASE.
- **Register restore skips the AArch64 ID registers:** 257 → 197 `KVM_SET_ONE_REG` per reset.
  `Slot::new` still restores all 257 before the first run.
- **MP state.** Reset sets the vCPU RUNNABLE. Before, a hostile EL1 PSCI `CPU_OFF` or
  `SYSTEM_OFF` left the vCPU STOPPED: every later run in that slot slept until its deadline.

## 1. Shard, sequential (`real bench`, one slot)
Median of 3 repetitions × 201 runs, with variants interleaved inside each repetition.
Per-run counts are (n=201 − n=1)/200 from `perf stat`. `after-discard` is the new code with
`copy-limit=0`, i.e. the discard path. Raw: `raw-copy-restore-2026-10-28/ab-reset.csv`.

| per run | before | **after** | after-discard |
|---|---:|---:|---:|
| owner CPU, `return 2` (incl. guest) | 18.18 ms | **0.275 ms** | 18.11 ms |
| owner CPU, one tool / `Promise.all(10)` | 21.05 / 26.13 ms | **0.356 / 0.430 ms** | 20.97 / 25.38 ms |
| reset p50 (`return 2` / one tool / `Promise.all(10)`) | 0.83 / 0.86 / 1.00 ms | **0.074 / 0.074 / 0.077 ms** | 0.82 / 0.85 / 0.98 ms |
| RUN→DONE p50, `return 2` | 18.59 ms | **0.086 ms** | 18.55 ms |
| reset+bind+run p50 / p99, `return 2` | 19.53 / 24.9 ms | **0.232 / 0.378 ms** | 19.47 / 27.0 ms |
| stage-2 faults (`kvm_guest_fault`), `return 2` / one tool / `Promise.all(10)` | 229 / 241 / 272 | **1 / 2 / 2** | 229 / 241 / 272 |
| KVM exits, `return 2` | 240.5 | **1.04** | 240.8 |
| `kvm_unmap_hva_range` (MMU-notifier invalidations), `return 2` | 72 | **0** | 72 |
| syscalls, `return 2` | 282 | **220** | 222 |
| private pages restored per reset (`return 2` / one tool / `Promise.all(10)`) | – | 75 / 80 / 98 | – |

- The remaining fault per run is the doorbell MMIO; one-tool runs add the reply's.
- The discard path costs what the old reset cost. Its 60 fewer syscalls are the skipped ID
  registers.
- The reset p50 of 74 µs includes copying and cleaning all 75 private pages. The R9
  prototype skipped pages that compared equal and took 100–123 µs.

## 2. Through the Node executor (`MicroVMExecutor` + `ShardBackend`, nested)
Medians of 3 repetitions, with before and after interleaved. Both use the executor `build/`
of their own tree and the same snapshot. Raw data is in `raw-copy-restore-2026-10-28/ex/`.

| per run | before | **after** |
|---|---:|---:|
| `execute()` p50 / p99, one tool (`shard-bench.js`, 300 runs) | 39.0 / 57.3 ms | **1.10 / 1.86 ms** |
| shard process CPU (owners + reactor) / of which owner | 37.6 / 35.6 ms | **0.83 / 0.33 ms** |
| Node CPU (`shard-bench.js`) | 1.70 ms | 0.85 ms |
| **total CPU** (Node + shard + watchdog) | **39.4 ms** | **1.72 ms** |
| Node CPU, R9 `exloop.mjs`, one tool / `return 2` (500 runs) | 1.60 / 1.18 ms | 0.91 / 0.55 ms |
| wall per sequential run, `exloop`, one tool / `return 2` | 42.4 / 39.2 ms | 1.66 / 0.99 ms |
| stage-2 faults, one tool (`perf stat -a`, (N=500 − N=0)/500) | 257 | **2** |
| KVM exits / `kvm_unmap_hva_range` | 282 / 80 | 2.1 / 0 |
| owner `ioctl`s | 518 (2 × 257 + run) | **201** |
| `madvise` / `pread64` (pagemap) | 4.1 / 0 | 0.14 / 2 |

**Throughput with the admission queue** (R9 `exconc.mjs`, unchanged; one Node + one shard, 4
owners, one tool, 3,000 runs per cell after, 600 before):

| slots / in flight | before runs/s | after runs/s (median; range) | after shard CPU/run | after Node CPU/run |
|---|---:|---:|---:|---:|
| 1 / 1 | 23.3 | **691** (687–706) | 0.79 ms | 0.64 ms |
| 16 / 8 | 38.7 | 238 (227–245) | 15.3 ms | 0.63 ms |
| 64 / 32 | 38.9 | 225 (219–1,996) | 16.6 ms (1.7 in the fast rep) | 0.60 ms |
| 64 / 64 | 37.3 | 233 (230–4,703) | 16.0 ms (0.61 in the fast rep) | 0.57 ms |

- No cell shed or failed (0 retries), at any concurrency.
- **The multi-slot cells are bimodal.** This is the nested-host artifact R9 §1b described: 220–245
  runs/s at ~16 shard-ms/run, or 1,700–4,700 runs/s at 0.6–2 ms. Two `perf stat -a` runs of
  the 64/32 cell were one fast (1,681 runs/s) and one slow (187 runs/s). Both did 2 pagemap
  reads per run, so every reset was a copy-restore, with ~5 steady-state stage-2 faults per
  run, the same as R9's 5.4. They differed only in non-fault KVM exits: 39.7k against 88.4k
  per 3,000 runs.
- **Not investigated:** at 64 slots, `kvm_unmap_hva_range` fires ~55 times per run in both
  modes. This is consistent with R9's note that each process-wide MMU-notifier event fans
  out to every VM of the shard. It is not a reset: the resets issue no `madvise`.

## 3. Memory: idle trimming
`real idle BASE one_tool 64`: one run in each of 64 slots, each RELEASEd (one reset), then
sampled again after `idle-trim + 0.5 s`. Process `RssAnon` and the memcg `memory.current`:

| policy | RssAnon start → hot → after wait | memcg start → hot → after wait | released per slot |
|---|---|---|---:|
| copy, `idle-trim-ms=500` | 0.2 → 28.0 → **8.3 MiB** | 6.7 → 48.6 → **28.0 MiB** | **315 KiB** |
| copy, trim off | 4.7 → 28.5 → 28.5 MiB | 11.5 → 48.9 → 48.9 MiB | 0 |
| discard (`copy-limit=0`), trim off | 4.7 → 8.7 → 8.7 MiB | 13.9 → 29.0 → 29.0 MiB | – |

- A hot pristine slot keeps about 315 KiB, the 80 restored private pages of one tool. That
  matches R9's 320 KiB.
- Trimming returns the pool to the discard path's footprint. The first run after a trim pays
  the discard path's ~230 faults once.
- The lib test `trim_releases_private_pages_and_stays_pristine` checks the slot's own VMAs
  through `/proc/self/smaps` `Anonymous:`: 1,360 KiB held after a full-window copy reset, and 0
  after the trim.

## 4. Correctness evidence (all on kvm-dev)
- `make -C shard test`: 33 unit tests, including fail-closed pagemap classification, the
  ID-register predicate and policy parsing. `check-native-r7` was skipped: the pinned census
  binaries are not in this cache.
- `make -C shard test-kvm` (bench lock held): 10/10. The new tests:
  - `hostile_guest_writes_and_registers_never_reach_the_next_run`. On both classes and both
    paths, an EL1 guest overwrites every byte of the arena and transport. It also writes
    FP/SIMD, FPCR/FPSR, TPIDR_EL0/RO/EL1, SP_EL0/EL1, ELR/SPSR, FAR/ESR/AFSR/PAR, MAIR/AMAIR/TCR/
    TTBR0/1, VBAR, CONTEXTIDR, CNTKCTL, CSSELR, the CNTV/CNTP CVAL/CTL registers, NZCV, SCTLR
    and x1–x30. After each of 3 rounds: all 32 MiB compare equal to the file, and every
    register matches the snapshot, ID registers included. A second EL1 probe then hashes every
    word it reads back, MMU and caches off, and the hash must equal the snapshot's. This
    checks the guest's view after copy-restore, not only the host's. Finally, PSCI `SYSTEM_OFF`
    followed by a reset leaves the slot runnable.
  - `copy_limit_boundary_is_exact`: with N private pages, limit N−1 discards, and limits N and
    N+1 copy. Each is checked for pristine memory and the guest view.
  - `reset_cleans_every_writable_page_…`: host writes to every writable page, then the guest
    view, on both paths.
  - `one_reset_per_lifecycle` and `psci_power_off_does_not_stop_the_next_run` (CPU_OFF and
    SYSTEM_OFF via the owner pool).
- `real stress … 10240` with `verify`: 64 slots; `return2`, `one_tool`, `promise10` and `bomb`
  rotated across slots, so `bomb`'s whole-arena dirtying drives its slot onto the discard
  path. Result: 7,632 copy resets and 2,544 discard resets; 0 canary leaks, 0 cross-talk, 10,240 distinct seeds. Every reset was
  followed by the full writable-memory and register comparison. With `copy-limit=0,verify`:
  2,048 runs, clean.
- `real hostile` with `verify` and with `copy-limit=0,verify`, 50 runs each: `arena_attack`,
  `bomb` and `json64k` were contained, and the following `return 2` in the same slot was
  clean.
- Executor: `build/shard-check.js` PASS, 140 assertions, on both trees, through
  `executor/ipc/shard-host.sh`.
- Mac: `make deps build`; the `delegate` suites `executor`, `protocol`, `mcp` and `shard` pass.

## 5. Post-review hardening (security review M1, M2, L2)
- **Sampled content check on the live path (M1).** `Slot::admit()` is now the only way to
  a bind. Every `sample-every`th admission of a slot (default 1,024; 0 = off) runs a content
  check:
  - both writable extents are compared byte for byte with the file;
  - pagemap must show no private page in the immutable extents (a byte compare there would
    fault 30 MiB of host PTEs into every sampled slot);
  - every register and the MP state must match.

  On a mismatch it logs `SECURITY`, counts (`SAMPLE_FAILURES`), resets the slot on the
  discard path and checks again. A second mismatch quarantines the slot. One check costs
  **0.30–0.32 ms** (release, nested, glue-2m, 3 runs of 20), which is **~0.3 µs per admission
  amortized**: about 0.1% of the 0.28 ms owner CPU of a `return 2`.
- **Coverage asserted (M2).** Snapshot loading rejects register ids outside the reset's
  coverage: SVE, unknown classes, PAC keys, PMU/SPE, MTE, and SVE/SME controls.
  `Slot::new` asserts that the vCPU init features are exactly PSCI 0.2, and that KVM's live
  register list equals the snapshot's.
- **Slot-scoped reset failures (L2).** A rejected ioctl or madvise during a reset or trim
  quarantines that slot only. Its lease is still acknowledged, so the watchdog does not
  escalate, and the owner keeps serving its other slots. Every later START on the slot
  completes with `slot_unavailable` without binding.
- Tests: `sampled_admission_check_catches_a_lying_pristine_flag` corrupts RAM, then a
  register, behind the flag, and checks the sampling cadence. It also checks that a private
  immutable page quarantines the slot. `reset_failure_quarantines_only_its_slot` injects a
  real `KVM_SET_ONE_REG` rejection (test builds only) on the RELEASE path and on the
  `finish()` path, with a co-located slot on the same owner. A unit test covers the
  register-coverage predicate.
- Re-run in a fresh scratch tree: `make -C shard test` 34/34, `test-kvm` 12/12 (both
  classes), `shard-host.sh` (`build/shard-check.js`) PASS with 140 assertions; clippy and
  rustfmt clean. Mac `delegate shard test`: 16/16.

## Risks and limits
- **No metal.** The clean-to-PoC step matters only without FEAT_S2FWB. On this nested host,
  the uncached-guest probe also passed without it, so the hazard it closes was reasoned
  about, not reproduced. Its cost is included in the 74 µs reset.
- **The discard path depends on KVM's clean-on-map, which was reasoned, not reproduced.**
  Without S2FWB, the discard path counts on KVM cleaning each freshly CoW'd page to PoC
  before installing its stage-2 entry. That comes from KVM's source; under nesting no
  uncached-read difference showed up on either path. On metal without FEAT_S2FWB (e.g.
  Neoverse N1), both paths should be checked with
  `hostile_guest_writes_and_registers_never_reach_the_next_run`, whose probe reads with the
  MMU and caches off.
- **Trust in the snapshot file is unchanged.** Copy-restore reads the same file that clean
  guest pages map. Modifying or truncating it on disk affects both paths alike.
- **The guest's own pages, not KVM state, are covered.** Reset covers RAM, the register
  list and MP state. Pending SError and vCPU events (`KVM_SET_VCPU_EVENTS`) are not
  restored; no host path injects them today.
- **The native worker is not covered by idle trimming.** `NativeVm` resets at the start of
  each run, so idle trimming does not apply. `check-native-r7` did not run here.
- **Clean-clone gap on main.** `executor/ipc/shard-host.sh` failed on kvm-dev until the
  pinned Node was on `PATH`: an npm install script calls bare `node`.

## Method
- kvm-dev: Ubuntu 26.04, Linux 7.0.0-38, 6 vCPUs, nested; no swap, KSM off, THP `madvise`.
  The scratch dir was `/home/dev/r10-reset/`, holding `git archive`-style trees of before and
  after with `JITK_CACHE` inside it. The scratch dir was deleted afterwards.
- One shared prepared helper snapshot (glue-2m `helpers.mem` `e437f822…`) was used by both
  sides. Rust 1.95.0. The `real` binaries were before `0c9f213c…` and after `26b5d3cd…`.
- Every timing run held `/home/dev/bench.lock`. load1 was 0.0–2.2.
- Scripts are in `raw-copy-restore-2026-10-28/`. `bench.sh` is the shard A/B. `ex.sh` runs
  `shard-host.sh` and R9's `exloop.mjs`/`exconc.mjs`, unchanged. `experf.sh` is the
  executor-path perf stat. `hv.sh` runs the hostile, stress and idle scenarios.
