# Minimal KVM shard — 2026-10-25

> Raw evidence linked here moved out of git (R10 W0.1): restore it with `arch/jitk/tools/.work/bin/evidence fetch <path>`; see [evidence/README.md](../../../evidence/README.md).

Owner `w2-shard`; scope `arch/jitk/shard/`. This is the assembly-fixture spike
for architecture gates 2, 4 (basic) and 5. **All timing is nested HVF → KVM,
indicative only.** No real jitk kernel or QuickJS density claim follows.

## Implementation and environment

One Rust process, four total owner threads (main also owns vCPUs and dispatches
synthetic completions), one vCPU and independent VM fd/stage-2 per slot. No
GIC, virtio, guest timer, WFI, HVC transport, per-VM thread, or per-call process.
One immutable 2 MiB snapshot file is mapped `MAP_PRIVATE` into each slot; its
16 KiB control and two 32 KiB rings are privately initialized in full. The
fixture uses aligned 32-bit MMIO stores with SUBMIT=1, WAIT=2, FINISH=3.
The [README](README.md) specifies the exact versioned fixture ABI and the
differences from the variable-record kernel transport under development.

Machine: Apple M4 Pro host, QEMU/HVF, Ubuntu 26.04.1 arm64 nested guest,
Linux `7.0.0-38-generic`, 6 vCPUs, 9,122,092 KiB MemTotal, 4 KiB pages, no swap.
Rust 1.99.1 (`58cf8f9c3`, 2026-10-13), clang/LLD 21.1.8, GCC 15.2.0,
Linux UAPI package `linux-libc-dev:arm64 7.0.0-38.38`. No Cargo dependencies;
all ioctls use installed UAPI constants extracted at build time. No network
download, global toolchain change, or new VM provisioning was needed.

Every benchmark command holds `flock /home/dev/bench.lock`. Each metrics/idle
record includes `/proc/uptime` and `/proc/loadavg`. The machine remains shared:
unlocked compilation and other jobs affect global counters. Density checkpoint
load averages ranged 3.40–8.31 (one-minute load). Exact source/binary hashes and
environment are in [environment.json](results/environment.json).

## A. Density / gate 2

One cumulative sweep, one sample at each N, with two-second idle windows.
Each new vCPU actually enters the guest and exits at WAIT, then has its pending
MMIO operation drained. These are live parked VMs, not just allocated VM fds.
The setup timer includes RAM mapping, 80 KiB initialization, 34 saved core
registers, first guest entry, and per-slot `/proc/meminfo` safety checks.

All deltas below use the same N=0 process baseline. KiB = 1,024 bytes.

| N | Process PSS Δ/N KiB | Global MemAvailable loss/N KiB | Fds | Threads | Cumulative create ms |
|---:|---:|---:|---:|---:|---:|
| 1 | 119.00 | 14,244.00 | 9 | 4 | 26.22 |
| 16 | 88.69 | 5,090.75 | 39 | 4 | 69.64 |
| 64 | 86.81 | 2,463.31 | 135 | 4 | 958.62 |
| 256 | 86.18 | 822.36 | 519 | 4 | 2,574.20 |
| 1,024 | 85.63 | 450.66 | 2,055 | 4 | 9,654.91 |
| 2,048 | 85.93 | 338.89 | 4,103 | 4 | 25,335.37 |
| 4,096 | 85.97 | 341.10 | 8,199 | 4 | 105,325.42 |

At every N, snapshot private-dirty is **exactly 80 KiB/VM**. Fds are 2N+7.
Six parked idle windows recorded **0 process CPU ticks / ~2 seconds**; N=64
recorded 1 tick (~0.5% of one core). This is 100 Hz process accounting, not an
exclusive machine-CPU ledger or evidence of literally zero CPU use.
Teardown of all 4,096 VMs took **64,923.14 ms** (15.85 ms/VM wall amortized;
four owners destroy their own slots). Timings are heavily nested and contended.

The 8,192 checkpoint was skipped: global used memory was 2,547,956 KiB and
the conservative forecast reserved another 1 MiB/new slot, exceeding the
6,500 MiB ceiling. This was a safety forecast, not actual memory exhaustion.
Measured checkpoints stayed far below the requested 7 GiB ceiling.

At N=4,096, the directly visible component ledger is:

| Counter | Increment per VM KiB |
|---|---:|
| Process PSS (includes control/rings, `kvm_run`, metadata) | 85.97 |
| Global PageTables | 3.94 |
| Global SecPageTables | 15.93 |
| Global SUnreclaim | 26.48 |
| Global SReclaimable | 20.96 |
| Global Percpu | 4.50 |
| Named `kvm_vcpu` slab backing | 7.94, **subset of slab above** |

The sum of process PSS + PageTables + SecPageTables + SUnreclaim + KernelStack
is **132.30 KiB/VM**; adding reclaimable slab and per-CPU counters gives about
**157.76 KiB/VM**. These are attribution estimates using global kernel counters,
not a closed exclusive ledger. Do not add either sum to MemAvailable loss:
that would double count the same memory. The two `kvm`-named slab rows are
preserved verbatim; `kvm_vcpu` backing grows by 7.94 KiB/VM (8 KiB/object slab geometry), and
`kvm_gmem_inode_cache` stays unchanged.

**Gate 2: scale result supports PASS.** At N≥1,024 even the contaminated
global MemAvailable increments are 0.33–0.44 MiB/VM, below 0.5–1 MiB. Exact
exclusive all-in attribution is not established: global anonymous memory and
reclaimable caches change during the run; low-N system deltas are unusable for
VM cost, and some page-table deltas are negative. Process PSS and the exact
80 KiB private transport allocation are much more stable. After teardown the
process retains 16,914 KiB PSS versus 8,879 KiB at baseline (consistent with
allocator/measurement high-water storage; attribution is an inference). Its fd
count returns to 7; these are not 4,096 surviving VM allocations.

Raw: [density.json](results/density.json); derived rows: [summary.json](results/summary.json).

## B. Snapshot/reset / gate 4 (basic)

One slot is reused across four K-max series (0, 1, 16, 256), first 1,000 runs
per series and then 10,000 per series. Every fourth run dirties zero arena pages;
the others dirty K-max pages in full. Timing arrays retain that mixed working
set rather than presenting K-max as the size on every sample. Before each run,
the host compares **every byte of the entire 2 MiB mapping** to the snapshot.
The guest independently checks boundary canaries and a zero counter, publishes
the generation/seed it observed, and fills all K pages with a per-run canary.
The host checks the published record, every dirty word and the untouched
boundary. Thus K=0 also verifies a fresh seed and prior-run isolation.

The timed reset interval includes pending-MMIO drain, full `MADV_DONTNEED`, and
34 saved core-register writes. Full host pristine verification and the subsequent
configure/guest run/dirty-word validation have separate arrays. Neither is
silently included in the reset-only timer. Seeds are distinct deterministic
fixture values, **not an entropy source**. System/FP/SIMD/device reset is not
exercised because this guest does not modify that state.

| Runs per K series | K-max | Reset p50 µs | Reset p99 µs | Whole-loop process CPU ms/run | Dirty mapping KiB → after discard |
|---:|---:|---:|---:|---:|---:|
| 1,000 | 0 | 144.54 | 4,779.49 | 2.04 | 80 → 0 |
| 1,000 | 1 | 140.63 | 4,307.40 | 2.88 | 84 → 0 |
| 1,000 | 16 | 315.13 | 10,104.31 | 7.14 | 144 → 0 |
| 1,000 | 256 | 3,295.88 | 43,952.10 | 70.03 | 1,104 → 0 |
| 10,000 | 0 | 134.59 | 2,402.20 | 1.233 | 80 → 0 |
| 10,000 | 1 | 146.34 | 4,342.86 | 2.291 | 84 → 0 |
| 10,000 | 16 | 305.34 | 5,817.40 | 4.681 | 144 → 0 |
| 10,000 | 256 | 2,827.58 | 47,391.41 | 57.849 | 1,104 → 0 |

There were **44,000 measured runs, zero canary/seed/snapshot failures**, plus
eight uncounted warm-up runs. CPU comes from process utime+stime (100 Hz) over the loop and includes exhaustive host
verification, refill and canary validation; it is not just VMM restore CPU.
One-minute load ranges were 6.04–16.21 for the 1,000-run experiment and 1.18–6.04
for the 10,000-run experiment; these are separate contended samples.

For the 10,000-run series, full host 2 MiB verification p50 was 79.46, 88.04,
93.34 and 118.75 µs for K-max 0/1/16/256. Configure + guest + dirty-word validation
p50 was 462.47, 683.64, 2,276.98 and 34,104.02 µs respectively. These cannot be
added as percentiles to derive an end-to-end p99; the raw paired arrays permit
that calculation. The paired reset + full host verification + guest/validation
p99 values are **8.68, 26.64, 41.26 and 373.34 ms** respectively
(`summary.json: reset_verify_guest_paired_sum`). The restore-only distribution
does not hide refill cost.

The stale-memory mutation selftest intentionally changes an arena word without
reset: the guest reports an error. After discard/register restore the same slot
passes and publishes the new seed. Sample arrays are written/prefaulted before
the baseline so sample recording does not create a false RAM leak. Snapshot
private-dirty returns **exactly to its zero-KiB baseline** in all eight series;
the full mapping also compares equal to the snapshot after churn. Whole-process
private-dirty retains **4–40 KiB per series** above its baseline (allocator/
metrics pages), rather than a K×iterations accumulation. It is not claimed to
return byte-exactly to the process baseline; the VM mapping does.

**Gate 4 basic correctness: PASS, zero observed leaks in 44,000 runs. The nested
latency gate does not pass:** even K=0 reset p99 exceeds 1 ms, and K=256 has a
multi-millisecond median. A metal measurement is needed to separate nested
stage-2/TLB and scheduler cost from the proposed production reset budget.
Do not convert functional correctness into a claimed ≤1 ms restore result.

Raw: [reset-1000.json](results/reset-1000.json),
[reset-10000.json](results/reset-10000.json), with all timing samples and
baseline/dirty/after-discard memory measurements; the stale-canary mutation is
in [selftest.json](results/selftest.json).

## C. WAIT / gate 5

**Gate 5: PASS for the fixture.** N=1,024 VMs, three rounds each with one and
ten calls per VM: **33,792 calls, 6,144 completed VM runs, zero lost completions,
zero duplicates, four threads throughout**. Each VM publishes all requests and
WAITs; all slots are held parked for two seconds, then the reactor dispatches
completions in deterministic random order at delays in [0,100) ms. Replies are
written/resume decisions made by the owning thread only. There are no extra
tool workers or threads. Fds remain 2,055 with all 1,024 VMs alive.

Each of the six all-waiting two-second windows recorded **0 process CPU ticks**.
Snapshot private-dirty remains exactly 81,920 KiB total = 80 KiB/VM. Process PSS
while waiting was 99,441–101,489 KiB total, including shared/fixed state and
measurement buffers. One-minute load averages at waiting checkpoints: 1.00–1.24.

Pooled completion timing below has n=3,072 resumed VMs per row (three rounds).
`entry` is the host timestamp immediately before the next KVM_RUN after the
**final required reply** is available to the reactor; it includes owner queueing
and reply publication. It is not a guest-side clock timestamp. `FINISH` is
observed after the guest checks its replies and exits, then host validation and
MMIO drain finish. Both distributions are nested and include burst contention.
They start at actual dispatch, not the nominal timer deadline; reactor lateness
is visible in total batch elapsed time rather than hidden inside these samples.

| Calls/VM | Completion → entry p50 / p99 ms | Completion → validated FINISH p50 / p99 ms | Round elapsed completion ms |
|---:|---:|---:|---:|
| 1 | 3.454 / 67.516 | 3.976 / 68.137 | 131.39, 127.82, 225.55 |
| 10 | 2.714 / 27.876 | 3.237 / 28.769 | 203.09, 229.07, 239.07 |

The single-VM Promise.all-like test has three independent ten-call runs. Each
submits ten records before **one WAIT** and uses an all-of reply predicate.
The two-second parked interval precedes the timed completion phase:

| Round | Largest scheduled delay ms | Sum of ten scheduled delays ms | Observed completion phase ms |
|---:|---:|---:|---:|
| 0 | 93.415 | 589.424 | 94.866 |
| 1 | 93.415 | 524.312 | 95.566 |
| 2 | 93.415 | 524.312 | 96.041 |

This demonstrates overlap rather than serial sum-of-delays execution. It does
not implement JavaScript promises. Any-ready kernel scheduling can legitimately
resume/WAIT more often than the fixture's deliberate all-of predicate; the
[ABI-v2 proposal](../../research/perf/transport/ABI-v2.md) documents that distinction.
Fixture v0 sends ten SUBMIT exits before its one WAIT, whereas v2 can submit the
batch through WAIT itself. No v2 production implementation is included here.

Raw: [wait-1024.json](results/wait-1024.json), [promise-1.json](results/promise-1.json).
They retain every completion order and latency sample, not only percentiles.

## Reproduce and validation

Build and run commands are in [README.md](README.md); `bash run.sh` in
`/home/dev/w2-shard` performs the locked sequence. `python3 summarize.py results`
converts JSONL to JSON arrays and computes nearest-rank percentiles. Raw JSON
is the evidence; summaries are derived. Keep nested timing labels on reuse.

The density sweep used an earlier retained binary; its parking path is unchanged.
Reset uses the stronger FINISH-result seed check. The final source moves the
request-consumer acquire fence after the cursor read; that function is never
executed in reset-only runs. WAIT uses the final source/binary. All three binary
hashes and the one-line reset source difference are recorded explicitly; binaries
are retained under `/home/dev/w2-shard/bin/` for exact artifact replay.
The full-arena guest-scan pilot is excluded from the reported reset samples.

All source/raw data together and remote build output used well below the
1.5 GiB allowance. Build output is removed after validation; the three measured
binaries are retained. No existing integration, toolchain or VM configuration
is modified.

`cargo build --release --offline`, `cargo check --offline`, local rustfmt check,
shell syntax check, and the functional mutation/reset tests are used here.
The existing aggregate `make -C arch/jitk test` is not changed or claimed:
this independent crate is not wired into its build graph, and other owners are
concurrently editing the integrated prototype. All writes stay in this scope
or `/home/dev/w2-shard`; no commits are made.

## Findings → recommended changes

1. **Memory:** keep independent VMs in a fixed-owner shard with file-backed CoW.
   The directly measured private transport is 80 KiB/VM and process PSS is about
   86 KiB/VM at scale; avoid reintroducing processes, stacks, device models, or
   private image copies per VM. Validate with the real initialized kernel next.
2. **Latency/CPU:** retain pre-created slots and complete pending MMIO before
   discard/register restore. The nested create/teardown sweep is expensive;
   reset p99 also misses the 1 ms target here and needs metal fault/TLB profiling.
   Warm reuse is the intended execution path. A complete kernel reset needs
   its modified system/FP/SIMD registers and trusted repair hook as well.
3. **Memory attribution:** repeat on a quiet Linux machine with an exclusive
   kernel/cgroup ledger before tightening the VM-overhead budget. Global
   MemAvailable and low-N kernel counters are visibly contaminated here.
4. **Transport:** carry the tested generation/call identity, owner-only state,
   and WAIT predicate into the real byte-cursor ABI and kernel reply demux.
   Fixture records do not validate wraparound, credits, large payloads, Node
   policy IPC, malicious guests, or watchdog integration.
