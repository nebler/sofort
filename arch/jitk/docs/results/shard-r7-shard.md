# R7 — bounded writable arenas, fixed real-kernel owners, watchdog leases

Agent `r7-shard`; 2026-10-25. Worktree
`/Users/noah/.t3/worktrees/sofort/t3-4b56eaaf`, branch `t3/r7-shard-reliability`.
Base: `3b9230d`. All VM timings below are **nested HVF → KVM and indicative**;
memory accounting is valid. No metal timing claim follows from this report.

**Measured:** normal small runs use **0.4849 / 0.5040 / 0.5518 MiB per VM**; the all-pages-dirtied hostile slope is **1.6042 MiB per VM**. **1,024 waiting runs on four owners** and **10,000 mixed restores** pass. Across **405 deadline expiries**, worst reset/error latency is **26.563 ms**, below the 50-ms target here. `json64k` returns OOM in `glue-2m`; a larger class is proposed, not implemented.

## Memory ledger and class conformance

The R6 ledger method is unchanged: clone3(CLONE_INTO_CGROUP) at birth, fresh shard/watchdog per point, two curves at **N=1/16/64/256**, 3-s settling, three samples 200 ms apart, one second of idle CPU, fit `memory.current = fixed + N × marginal` and average the two slopes. Each cgroup includes both the shard and its one watchdog. The shared 32-MiB snapshot is warmed outside each measured batch and charged once, separately from per-slot admission; it is not added per VM. The primary all-in measure is cgroup current, including KVM kernel charges. Process private-dirty and kernel columns are diagnostics, not components to add to current.

| Stopped state | Mean current MiB/VM | Two slopes, B/VM | Peak-fit MiB/VM | Private dirty KiB/VM | Kernel KiB/VM | Fixed MiB |
|---|---:|---:|---:|---:|---:|---:|
| repaired READY | **0.238665** | 248,724–251,792 | 0.238967 | 16.49 | 231.60 | 1.061 |
| return2 | **0.484882** | 508,210–508,661 | 0.484882 | 268.51 | 231.64 | 1.296 |
| one_tool | **0.503982** | 527,840–529,087 | 0.503982 | 288.53 | 231.59 | 1.357 |
| Promise.all(10) | **0.551762** | 576,516–580,613 | 0.553053 | 336.72 | 231.62 | 1.014 |
| json64k **OOM** | **0.989868** | 1,037,719–1,038,185 | 0.989864 | 784.82 | 231.58 | 1.234 |
| 64-MiB allocation loop **OOM** | **0.980629** | 1,027,078–1,029,451 | 0.982165 | 776.62 | 231.60 | 1.112 |
| read all RAM, dirty all 340 writable pages, RO fault | **1.604173** | 1,680,701–1,683,494 | 1.606040 | 1364.49 | 283.58 | 1.369 |

Peak is a fit of cgroup `memory.peak` at the same points, not an exhaustive adversarial host-state bound. The all-dirty case retains stopped private pages **for measurement only**; ordinary fault handling resets first. This fixture disables stage 1, reads every page of all 32 MiB (including RO extents), writes every one of the 320 arena and 20 ring pages, then writes GPA `0x80000000`. It therefore includes the cost of faulting immutable mappings, not just a dirty-arena projection. Reserve the **2-MiB class per slot plus fixed shard/watchdog and shared-image costs**; do not interpret this slope as a 2-MiB cap on a one-slot process.

| Normal fixture | R6 MiB/VM | R7 MiB/VM | Delta KiB/VM |
|---|---:|---:|---:|
| return2 | 0.484038 | 0.484882 | +0.864 |
| one_tool | 0.503431 | 0.503982 | +0.564 |
| promise10 | 0.548644 | 0.551762 | +3.193 |

All small runs remain below the 0.6-MiB target. The largest mean delta, Promise.all(10), is 3.19 KiB/VM, comparable to its 4.00-KiB between-curve range; the two R6 slopes also differ. These observations do not resolve a material increase beyond page/charge repeatability, but **strict byte-level non-regression is not established**. The table exposes the positive deltas rather than rounding them away.

Minimum current-fit R² is **0.99991464**; slope ranges are repeatability, not confidence intervals. Sample load1 spans **1.40–3.85**. Every one-second idle cgroup CPU delta is **0 usec**. N=256 decomposition residual is at most **1.534%**; N=1 reaches **42.604%** from rstat/charge-stock and sampling differences, so low-N closure is not claimed. No global Slab/MemAvailable delta is added. All 57 cells completed, with zero cgroup max/OOM/swap events and no remaining child cgroups. Extra READY N=1,024 current is **244.9375 MiB**, or **0.23920 MiB/VM** amortized. Raw: `review/ledger-{0,1}-*.json`, `ledger-2-ready-1024.json.gz`, `ledger-cleanup.json`, `summary-r7-shard.json`.

**Hostile conformance:** 100/100 allocation loops return the exact guest `InternalError: out of memory`; 100/100 EL1 arena attacks return `memory_bound ... 0x80000000`; 100/100 `json64k` runs return the same OOM. Every case performs a stopped reset, full 32-MiB equality comparison against the prepared file, then a fresh return2 with host canary checking. No deadline is accepted as OOM/fault by the offline reducer or final harness. Each initial case has a two-second run budget; final stricter-harness smoke, n=3 each, measures allocation-loop RUN→error at **46.781–63.026 ms**, all-pages-read/write/fault at **612.339–624.197 ms**, and json64k OOM at **47.892–51.963 ms** (nested; excludes subsequent full-file comparison). Raw: `review/hostile-*.jsonl`, `review/final-hostile-*.jsonl`.

| Class | Writable arena + rings | Admission reservation | Validated / proposed use |
|---|---:|---:|---|
| glue-2m, implemented | 1,310,720 + 81,920 B | 2 MiB | Small JS fixtures, ≤8-KiB source; json64k rejected |
| glue-4m, proposal [E] | 2,621,440 + 81,920 B | 4 MiB | Candidate for structured 64-KiB JSON; requires a new linked layout, extra stage-1 table coverage, snapshot identity and full hostile ledger |

R6 json64k completed at 1.421649 MiB/VM with unbounded writable RAM. Its live allocator requirements do not fit this narrow layout; the R7 0.989868-MiB stopped OOM row is **not** a cheaper successful JSON result. No larger/native-profile compatibility or larger-class peak has been measured.

## Owners, state carry-over and deadlines

**WAIT:** 1,024 real QuickJS guests concurrently wait on one echo each, hold for 3 s, then all return 42 with zero lost replies. `/proc` observes exactly **five shard tasks** and **one single-thread watchdog child**; one measured second has **0 process CPU ticks**. VM fds and slot mappings remain with their owners. The shard PSS at hold is 298,123 KiB; RSS is 2,775,304 KiB because it repeats shared file mappings, and is not used as marginal memory. Raw: `review/wait-1024.json`.

**Mixed stress:** 10,000/10,000 runs across 64 slots and four owners, rotating return2 / one_tool / Promise.all(10), each also sends a slot+generation-specific echo and sets an absent tenant global. Host generation/record checks, RAM canaries and full pristine comparisons pass; zero canary leaks/cross-talk and 10,000 distinct host roots. Final full-file comparisons cover all 64 slots. Batches of 64 have p50/p99/max **1.780/3.314/3.324 s**; largest single RUN interval is **416.389 ms**. This is state-reset evidence, not the tiny-run latency benchmark. The separate 200-run canary benchmark returns 200 distinct native Math.random samples and 200 libc receipts, with seed-read and second-checkpoint denial checks; the earlier R7-RNG report owns the 10,000-run RNG distribution certification.

The initial five-second queue-inclusive stress budget aborted on a deadline. That run had no per-batch diagnostics, so its underlying scheduling stall was not isolated. The instrumented retry uses a 30-second stress budget and completes; its largest batch is 3.324 s. The failed receipt remains as `review/stress-initial-five-second-budget.*`. Tight watchdog deadlines are measured separately below; the failed attempt is not counted as a completed stress run.

Five independent batches per size share a deadline 3 s after setup starts. All slots first reach repaired READY; the owner then spins in one busy-loop vCPU while the remaining slots are ready/queued. Thus W=4 means at most four simultaneously executing spins, even when 64 leases expire together. Stop is an owner-observed upper bound (includes dispatch delay); reset/error additionally includes MMIO drain, RAM discard, register restore and acknowledgement. Percentiles are nearest-rank across the samples, not subtracted percentiles.

| Simultaneous leases | Samples | Stop p50 / p99 / max ms | Reset/error p50 / p99 / max ms |
|---:|---:|---:|---:|
| 1 | 5 | 3.853 / 4.148 / 4.148 | 6.741 / 7.397 / 7.397 |
| 16 | 80 | 8.703 / 26.178 / 26.178 | 9.579 / 26.563 / 26.563 |
| 64 | 320 | 11.337 / 21.597 / 22.158 | 11.789 / 22.108 / 22.595 |

All 405 expiries return deadline errors after reset and then reuse cleanly as generation 3. Old-generation Resume commands are deliberately sent before reuse; stale lease/escalation CAS behavior has deterministic unit tests. Five staggered batches (40 leases, 2W slots) expire parked early slots while their owners spin in different, later-deadline guests: all later guests survive until their own deadline; reset/error p50/p99/max is **3.123/16.895/16.895 ms**. Raw: `review/deadlines-{1,16,64}-{0..4}.jsonl`, `review/staggered-{0..4}.jsonl`.

**Owner failure:** an offline observer SIGSTOPs the whole shard after eight leases arm. The independent watchdog generation-fences escalation and uses pidfd SIGKILL; observed deadline→reap is **168.134 ms**, n=1, with **100-ms configured post-fire grace**. This includes watchdog scheduling, grace, signal delivery and reap; it does not establish a 100-ms wall-clock guarantee or the ≤50-ms responsive-owner result. Raw: `review/escalation.json` and `.stderr`.

## Normal timing cross-check (nested only)

Each row is 200 sequential restore/run samples in one pre-created slot, serviced by its fixed owner. Reset includes pending MMIO completion, full mapping discard and 257 register restores. CPU is CLOCK_THREAD_CPUTIME_ID around reset+bind+drive, avoiding double-counting parallel owners; it excludes startup, printing and full pristine comparisons. The watchdog/reactor/policy CPU is not included in this owner-CPU column.

| Fixture | Reset p50 / p99 ms | RUN→DONE p50 / p99 ms | Mean owner CPU ms/run |
|---|---:|---:|---:|
| return2 | 2.645 / 4.560 | 34.760 / 63.833 | 39.027 |
| one_tool | 2.720 / 5.792 | 39.268 / 78.905 | 44.667 |
| promise10 | 2.841 / 3.528 | 42.729 / 66.650 | 46.814 |
| canary | 2.703 / 3.251 | 37.260 / 51.459 | 41.192 |

Reset p99 and tiny-run CPU/latency still exceed the v1 metal targets. R6 return2 RUN p50 was 31.438 ms and mean CPU 34.241 ms; this batch measures 34.760/39.027 ms. These timings are worse, not a demonstrated speedup. Shared-host nested runs and changed owner/arena/kernel layouts do not isolate a cause. Batch start load1 is 0.36–0.58; per-run raw samples and environment are in `review/bench-*.jsonl`. Re-evaluate on reference metal before performance claims.

## Implementation and reviewed commits

The interrupted branch was merged first (fast-forward failed, ordinary merge
succeeded). Its `69495a2`, `65689a9`, and WIP `fc729e6` were reviewed and replaced
on this branch with verified topic commits:

- `85e7265` — Constrain ring guest mutable backing to the glue-2m arena.
- `4c1aa6e` — Run bounded real-kernel slots on fixed owners with fenced watchdog leases.
- `7499554` — Add hostile conformance and multi-owner resource measurement harnesses.

No WIP/merge commit remains in this branch's history above the base. No push.

**Arena.** The ring build moves kernel `.data`/BSS, page tables and the kernel
stack to GPA `0x81800000`; relocates ELF writable data, brk, anonymous mmap and
the 128-KiB user stack into the same **1,310,720 B** arena; and retains separate
**81,920 B** rings/control. Five stable KVM memslots alternate immutable and
writable extents. Immutable slots use `KVM_MEM_READONLY` and host `mprotect(PROT_READ)`.
Restore never registers whole-RAM writable backing. The trusted offline preparer
alone has an unbounded boot mapping, verifies a linked layout marker, and writes
a required `.layout` sidecar. Older prepared images require preparation again.
Snapshots remain file-backed `MAP_PRIVATE`, `MADV_NOHUGEPAGE`, read-only files.

For this exact linked image, the arena layout is:

| Backing | GPA range / capacity |
|---|---|
| Kernel data, tables, guard and kernel stack | `0x81800000..0x81831000` (196 KiB, including a 4-KiB guard) |
| ELF writable data reservation | `0x81831000..0x81841000` (64 KiB) |
| brk reservation | `0x81841000..0x81851000` (64 KiB) |
| anonymous mmap | `0x81851000..0x8191f000` (824 KiB) |
| user stack | `0x8191f000..0x8193f000` (128 KiB) |
| host reset canary | `0x8193f000..0x81940000` (4 KiB) |
| control and rings, separate from the arena | `0x81d00000..0x81d14000` (80 KiB) |

The layout is a narrow QuickJS profile, not a general native ELF allocator.
Build/init asserts retain at least 512 KiB mmap capacity. brk/mmap/munmap limits
are feature-gated; mremap retains its existing ENOSYS behavior. Default libkrun
MMU, kernel placement, payload and execution behavior are unchanged.

**Owners.** `owner.rs` owns scheduling and each thread's slots, VM/vCPU fds and
RAM mappings. Default W=4, configurable through `JITK_SHARD_THREADS`; one reactor
thread and one independent watchdog process make **five shard threads + one
single-thread watchdog**, regardless of waiting-slot count. Commands/events are
bounded channels. WAIT retains pending records, not a thread stack. Stress uses
64 slots, matching the architecture's initial shard size; the 1,024-slot hold is
an explicit scaling experiment, not a new production shard-size decision.
`real.rs` remains a small fixture/CLI entrypoint; offline measurement logic lives
in `real_harness.rs`. There is no helper process per VM or tool call.

**Leases.** `lease.rs` runs a separate process, with a pidfd for the shard and
shared host-only atomic entries `(slot, generation, monotonic deadline, owner TID)`.
An armed generation changes atomically to expired. The watchdog signals its
owner and wakes its eventfd. A signal handler touches only thread-local kick
state and the current `kvm_run.immediate_exit` byte. Pending kicks survive vCPU
entry gaps: review found and fixed the interrupted version's lost-kick window
when a parked slot expires as its owner enters a different busy guest.

Owners yield on EINTR, sweep all their leases, drain pending MMIO, discard RAM,
restore all 257 captured registers, and acknowledge reset before publishing a
deadline error/reusing the generation. Completion races expiry through one CAS;
old-generation expiry/escalation CAS operations cannot claim a reused slot.
If reset is not acknowledged within **100 ms after watchdog firing**, escalation
claims that generation and sends SIGKILL through the shard pidfd. A claimed
escalation prevents reuse. Eventfd I/O retries EINTR. The watchdog sleeps on
lease-change eventfd, nearest deadline and shard pidfd, without periodic idle work.

## Environment, identity and evidence

Existing `kvm-dev`: Ubuntu 26.04 arm64, Linux `7.0.0-38-generic`, six vCPUs,
9 GiB assigned, 4-KiB pages, no swap; Apple M4 Pro/macOS outer host. Rust stable
1.99.1 builds the Linux crate/ring kernel; Mac uses the repository's pinned
kernel toolchain. Every timing/ledger batch holds `flock /home/dev/bench.lock`;
Mac tests hold `/tmp/sofort-bench.lock`. These locks do not isolate physical-host
load. Per-run environment/load/uptime is retained in JSONL, per-cell ledger
samples retain load, and Mac logs retain uptime/load.

All final remote receipts are under `/home/dev/r7-shard/raw-review/`, copied to
`raw-r7-shard/review/`. The interrupted run's pilot/Mac receipts remain at the
raw directory's top level; they are not included in final fits. No other agent's
scratch directory, VM kernel or machine lifecycle was changed.

| Artifact | SHA-256 |
|---|---|
| ring kernel | `4528c76ed95e4f968dc9d82dc8c1b7c20f490fa6744a788bb68c775cadff12de` |
| first measured host (200-sample benches / hostile 100s) | `87f96be5c4d2be1267e3112022e2ac807f0554b40fb6c63b7e0412c9176ddefe` |
| final host (instrumented stress, WAIT, deadlines, ledger) | `e25f7e8aba4cec69e772d7680e3cb9cd4a09872c80869fa1f9870adaa4b8c832` |
| default kernel, before and after | `75b2abe26021d9d0624b0555a64ed589d251cb7d30aa2965754974f3716d1732` |

The two host versions have identical arena/owner/lease/KVM runtime source. The
later version adds stress batch diagnostics, changes only that offline workload's
queue-inclusive budget from 5 s to 30 s, and rejects unexpected hostile outcomes
more strictly. Exact source subsets are in `review-measured-source.tgz` and
`review-final-source.tgz`; both host executables remain on kvm-dev. The reducer
also independently checks all 300 original hostile receipts against the exact
expected OOM/fault, so a generic timeout cannot count as conformance.

## What is not done / integration boundaries

- No Node shared-memory policy IPC, admission service, credential handling,
  production supervision or libkrun cutover. `2 MiB` remains the glue-2m admission
  reservation contract; this branch proves its guest writable extent and measures
  the tested all-in slope, rather than wiring a Node admission allocator.
- No larger class is silently selected. `json64k` fails the current class. Native
  payload/layouts and the parallel byte-stream changes require integration and
  new class/ledger certification; this branch is based on `3b9230d`.
- Wider ELF layouts need pagewise handling of syscall buffers crossing physical
  relocation boundaries: existing `user::access` returns a single physical base.
  Current fixtures use buffers within contiguous regions; this work does not
  certify every cross-segment native buffer. `user.rs` was outside this write scope.
- No metal measurements, real-time scheduler guarantee, hostile guest proof for
  every KVM failure mode, or exhaustive maximum host transport-state census.
  Deadline grace bounds are a fail-closed protocol, not a real-time Linux guarantee.
- Watchdog death is checked by the receiving reactor. A production supervisor
  still needs to cover a stalled reactor/watchdog, rather than relying on this
  offline harness's receive loop. The independent watchdog's owner-stall
  escalation is measured separately below.
- No changes outside the assigned source scope. Temporary dependency symlinks
  and generated Mac test outputs were removed/restored after retaining receipts.
  `kernel/src/ring.rs`, `ring-bootstrap.js`, `ABI-R6.md`, `src/streams.rs`,
  `arch/jitk/linux/`, `arch/jitk/mcp/`, and shipping VMM watchdog source were not edited.

## Mac regression and focused checks

All ten required subtree suites pass: kernel, VMM, VMM sandbox, protocol,
executor, executor policy, MCP, grow, bench, and Hyperlight adapter (13/13).
Kernel real-VM/packer/handler/filesystem tests pass; the default image remains
byte-identical at 2,924,584 B. The separately owned Linux suite was not rerun.

The first full Mac sequence stopped after the first four passing suites at
`kernel READY hash mismatch`: inherited `.READY` still names old `6c00a278…`,
whereas the inherited grow source builds `75b2abe2…`. The remaining six suites
pass with the documented explicit `JITK_KERNEL_IMAGE=$PWD/arch/jitk/kernel/dist/kernel.bin`
override. No readiness/source file was changed to pass. Existing root-checkout
executor/MCP dependencies were temporarily linked and then unlinked. Logs:
`review-mac-suites.log`, `review-mac-suites-tail.log`; generated receipts and
before/after identity: `review-mac-generated-receipts.tgz`, `review-default-image.json`.

Linux offline builds and six focused Rust tests pass (arena partition, entropy
known answer, stale generation, expiry/reset, escalation/reuse race, retained
kick across vCPU entries). `cargo fmt --check` and Python/shell harness syntax
checks pass. Clippy is absent from the installed Linux stable toolchain; its
explicit unavailable-component error is retained, and no Clippy pass is claimed.

## Reproduction

Copy source into the agent-owned VM directory without targets/dist/generated
results. Use a fresh snapshot prefix and fresh output directory; do not replace
prepared input files in place. For example:

```sh
# Mac, from this worktree
COPYFILE_DISABLE=1 tar --no-xattrs -czf /tmp/r7-shard-replay.tgz \
  --exclude target --exclude target-ring --exclude dist --exclude test-work \
  --exclude test-results --exclude raw-r6 --exclude raw-r7-rng \
  --exclude raw-r7-shard arch/jitk/kernel arch/jitk/shard
/Users/noah/code/sofort/kvm-dev/ssh.sh \
  'cd /home/dev/r7-shard && tar xzf -' </tmp/r7-shard-replay.tgz

# kvm-dev, inside /home/dev/r7-shard only
cd /home/dev/r7-shard
export PATH=/home/dev/.cargo/bin:$PATH
RUSTUP_TOOLCHAIN=stable sh arch/jitk/kernel/build-ring.sh
cargo +stable test --offline --manifest-path arch/jitk/shard/Cargo.toml
cargo +stable build --release --offline --manifest-path arch/jitk/shard/Cargo.toml
cc -O2 arch/jitk/shard/harness/spawn-cg.c -o spawn-cg
flock /home/dev/bench.lock arch/jitk/shard/target/release/real \
  prepare arch/jitk/kernel/dist/kernel-ring.bin replay-prepared
JITK_R7_SNAPSHOT=replay-prepared JITK_R7_OUTPUT=$PWD/replay-raw \
  flock /home/dev/bench.lock sh arch/jitk/shard/harness/run-r7-shard.sh
# Remove the empty task-owned cgroup parent after inspecting its cleanup receipt.
sudo rmdir /sys/fs/cgroup/r7-shard-replay
```

The measured commands used snapshot `arena-review`, cgroup
`/sys/fs/cgroup/r7-shard-review`, output `/home/dev/r7-shard/raw-review`.
Exact first/resumed command scripts are retained as `review-measure-{first,rest}.sh`.
Mac: use `review-mac-command.sh` (with all ten suite names for a fresh run), under
`/usr/bin/lockf -k /tmp/sofort-bench.lock`; supply the explicit existing Node,
VMM, Hyperlight source/worker/snapshot paths recorded there.

## Findings → recommended changes

1. **Keep the hard stage-2 arena for every restored backend.** The maximal dirty fixture measures 1.6042 MiB/VM current / 1.6060 MiB/VM peak-fit, below the 2-MiB reservation. Carry the five immutable/writable memslots, stopped-reset ordering and layout marker into the parallel native/byte-stream merge. Charge shared images and fixed shard/watchdog overhead separately; certify maximum transport state before treating this fixture as a universal process bound.
2. **Introduce an explicit larger class before advertising json64k support.** Its R6 success is not preserved in glue-2m. The proposed glue-4m table is a candidate to measure, with no fallback that silently makes all RAM writable. Revisit native ELF data limits and cross-region syscall-buffer translation during that integration.
3. **Retain generation-fenced independent enforcement and pending kicks.** Responsive-owner stop/reset stays below 26.6 ms in 405 nested samples; owner failure pidfd escalation is demonstrated separately. Connect the lease authority and independent liveness supervision to the future Node IPC rather than calling this offline driver a production policy boundary.
4. **Keep the density deltas and performance gaps visible.** Small runs remain below 0.6 MiB/VM, but byte-level non-regression is unresolved and timings still miss v1 targets here. Measure reset/first-fault and owner scheduling on metal; preserve the failed five-second stress receipt instead of claiming an uninterrupted pass.

The optional allocator-partition pilot used 128/256-KiB brk reservations,
two N=1/64 curves per fixture (24 cells), and n=3 return2/one_tool/promise10/canary
smokes per layout. Private-dirty slopes stayed at approximately
268.48 / 288.70–288.76 / 337.21–337.24 KiB/VM, offering no useful reduction versus
the final layout's 268.51 / 288.53 / 336.72. Two-point current fits had substantial
low-N noise; they are not substituted for the four-point ledger. The 64-KiB brk
partition remains unchanged. Raw and exact pilot recipe: `raw-r7-shard/pilots/`,
`review/pilot-summary.json`. Pilot images/build trees were scratch and removed.

Final VM cleanup reduced this task directory from **338,364 to
164,140 KiB**, including inherited interrupted-run artifacts. Final
executables remain at `/home/dev/r7-shard/bin/measured-final-{real,jitk-shard}`,
first host at `/home/dev/r7-shard/measured-real-first`; ring image and prepared
`arena-review.{mem,regs,layout}` remain with the source. Target directories,
pilot image/build output and intermediate archives were removed. Mac worktree
use remained below 0.5 GiB, below the 3-GiB cap; VM use remained below 0.4 GiB,
below the 5-GiB cap. See `review/cleanup.json` and final hash receipts.
