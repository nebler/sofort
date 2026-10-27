# R9 performance and memory review (2026-10-27)

**Headline.** On the shard, almost all per-run CPU is spent rebuilding host and stage-2 mappings that the reset has just thrown away. A prototype reset that copies the run's privately CoW'd pages back from the snapshot keeps those mappings. It cut the integrated executor path from **37.5 to 1.55 CPU-ms per one-tool run**, nested. Stage-2 faults fell from 229 to about 1 per run. Owner CPU fell about 65× (28.4 → 0.43 ms for `return 2`). `execute()` p50 fell from 34 to 1.0 ms. The guest itself needs only about 0.05 ms of CPU for `return 2`.

On macOS, about half of the 6.5 CPU-ms per fresh VM is spent creating the process and loading Hypervisor.framework, before any VM code runs. Forking from a pre-initialised parent instead costs 0.55 ms.

On memory, a run dirties 75–98 guest pages, but changes only 3–7% of their bytes. Of the KVM charge, only debugfs (~22 KiB/VM) is clearly removable by configuration.

All Linux CPU and latency numbers below are **nested (HVF → KVM) and indicative only**. Counts (faults, exits, syscalls, pages, bytes) and memory are valid. All Mac numbers are **contended**: load1 was 3.5–8 throughout, shared with other agents' runs.

Evidence is in `raw-r9-perf/` (small files). Bulk evidence is in `~/sofort-local-evidence/perf-r9-2026-10-27/`. The prototype code is in `raw-r9-perf/prototypes/`. No product code path was changed.

## 1. CPU per fresh VM, by path

### 1a. Shard: restore → bind → run → reset (Linux KVM, nested)
`real bench` sequential, one slot. Each cell is the median of 3 repetitions × 201 runs, from interleaved variants (`kvm/ab-reset.csv`). Per-run counts are (n=201 − n=1)/200, from `perf stat`.

| per run | main (MADV_DONTNEED reset) | **copy-restore prototype** | copy + skip ID regs |
|---|---:|---:|---:|
| owner CPU, `return 2` (incl. guest) | 28.4 ms | **0.43 ms** | 0.41 ms |
| owner CPU, one tool / Promise.all(10) | 32.8 / 38.7 ms | 0.55 / 0.67 ms | 0.53 / 0.65 ms |
| reset p50 | 1.15–1.20 ms | 0.123 ms | 0.100–0.108 ms |
| RUN→DONE p50, `return 2` | 26.9–27.0 ms | 0.117 ms | 0.115–0.117 ms |
| reset+bind+run p50 / p99 | 28.2–28.4 / 31–46 ms | 0.34 / 0.51–0.64 ms | 0.30–0.32 / 0.45–0.49 ms |
| stage-2 faults (`kvm_guest_fault`) | **229** | **~1** | ~1 |
| KVM exits | 246 | ~1 | ~1 |
| `kvm_unmap_hva_range` (MMU-notifier invalidations) | 72 | ~0 | ~0 |
| syscalls (≈257 SET_ONE_REG + KVM_RUN + madvise) | 371 | 367 | 307 |
| host CPU split (`/proc/stat`, `return 2`) | guest 17.2 + kernel 11.3 + user ~0 ms | guest 0.05 + kernel 0.29 + user 0.01 ms | |

- **Where the time goes on main.** The two writable extents (1.31 MiB arena + 80 KiB transport) are discarded at every reset. That removes the host PTEs and, through the MMU notifier, the stage-2 mappings. The next run then takes about 229 stage-2 faults, mostly read then CoW-write on the same pages. It also takes 72 invalidations.
- **Nesting multiplies each fault.** In nested KVM, each fault costs tens of µs, which produces the 28 ms. The guest's own work for `return 2` is about 50 µs.
- **Hyperlight has the same shape.** Measured the same way, Hyperlight's `restore` and `from_snapshot` take **344 stage-2 faults per run** and 21–23 CPU-ms nested (`kvm/hl-perfstat-and-copy-split.txt`).
- **What is left after the fix.** About 200 `KVM_SET_ONE_REG` ioctls, 2 KVM_RUN, one `pagemap` read and about 300 KiB of memcpy, all in kernel time.

### 1b. Shard behind the Node executor (`MicroVMExecutor` + `ShardBackend`, one tool, nested)
`shard-bench.js`, 3 reps × 300 runs (`kvm/exbench.jsonl`). Node-only loop: `prototypes/exloop.mjs`, 3 reps × 500 runs (`kvm/exloop.jsonl`).

| per run | main | copy-restore |
|---|---:|---:|
| `execute()` p50 / p99 | 33.6–34.7 / 44–51 ms | **0.96–1.07 / 1.42–1.49 ms** |
| shard process CPU (owners + reactor) | 35.1–36.1 ms | 0.80–0.83 ms (owner 0.38–0.40) |
| Node CPU | 1.24–1.34 ms | **0.64–0.74 ms** (user 0.08–0.17, **sys 0.56–0.62**) |
| watchdog | 0.067 ms | 0.033 ms (tick-limited) |
| **total** | **~37.5 ms** | **~1.55 ms** |

- **Node CPU for `return 2`.** It is 0.48–0.58 ms. Each extra tool call adds about 45 µs nested: Promise.all(10) costs 1.15–1.27 ms. The architecture target is 30 µs per extra call.
- **Syscalls per one-tool run** (bpftrace, `kvm/bpf-syscalls.txt`):
  - owner: **398 ioctl**, which is two resets (P09) × ~197 SET_ONE_REG plus KVM_RUN;
  - reactor: **18 wait4** (P12 `try_wait` on every probe), 11 ppoll, 11 read, 10 write;
  - Node main thread: **12 epoll_pwait** wakeups, 7 read, 6 write.
- **Context switches per run.** Node 5.8, reactor 11.
- **Where Node's CPU goes.** Node's CPU is mostly kernel time from wakeups. The JavaScript profile (`kvm/node-cpuprof-top.txt`) is flat:
  - native IPC poll/flush: ~18% of samples;
  - frame `parseFrame`/`encode`/`feed`/`walk` (P04): ~12%;
  - `AbortSignal`/`DOMException`/timers: ~6%;
  - acorn parse of tenant code: ~5%;
  - GC: 3%;
  - policy sha256: 3%.
- **Promise.all(10) through the executor.** It takes 12.4 KVM exits and 11 doorbell MMIOs per run (the `[42]`/`[10]` rows at the end of `kvm/exconc-run1.jsonl`). Each reply resumes the guest separately, which confirms P05.

**Throughput, one Node + one shard** (copy-restore, nested, 1,500–3,000 runs per cell; `kvm/exconc*.jsonl`). These are noisy because nested vCPU contention is high when other Mac load is present.
- Stable best: **16 slots, 8 in flight: 2,500–3,000 runs/s**, at Node 0.28–0.36 + shard 1.1–1.2 CPU-ms/run.
- Some repetitions dropped to 200–450 runs/s, with shard CPU 4–20 ms/run, while the outer Mac was at load 6–7.
- Main (full discard), 64 slots, 32 in flight: **37 runs/s**, shard CPU 106 ms/run.
- See §3 for the admission limits found here.

### 1c. macOS, libkrun, one process per VM (HVF, metal, contended)
Probe: `prototypes/vmprobe`, wait4 rusage plus per-thread libproc. 3 reps × 40 per mode (`mac/probe-summary.jsonl`).

| phase (median) | CPU ms | how measured |
|---|---:|---|
| `posix_spawn`+exec+exit of `/usr/bin/true` | 1.03 | baseline |
| minimal Rust binary | 1.45 | +0.42 Rust/dyld |
| minimal Rust + **Hypervisor.framework linked** (never called) | **2.96** | **+1.51 framework load/init** |
| `jitk-vmm` exits on an unknown flag | 3.10–3.55 | the whole pre-main/early-main cost |
| main thread at WAIT_GO (args, seed, Seatbelt prepare+apply) | 3.84 | `--wait-go` snapshot |
| VM build after GO (hv_vm_create, 32 MiB map, image copy, vCPU + 5 threads) | ~1.0 | main thread, READY − WAIT_GO |
| guest boot to READY (vCPU thread) | 1.49 (1.18 user / 0.32 sys) | per-thread |
| other threads | 0.07 | |
| RUN `return 2` / one tool | ~0.05 | full − ready |
| exit/teardown | ~0.1 | rusage at reap − thread sum |
| **total cold `return 2`** | **6.52–6.57** | probe; the canonical harness gives **7.19** at load 4.4–8 (`mac/RESULTS-r9-subset.md`) |

- **Same harness, today, Hyperlight strict:** 5.64 CPU-ms (Oct 24, quiet-ish: jitk 4.86, Hyperlight 3.54). The machine is about 1.5× slower today for both, so the ratio of about 1.3 holds.
- **The kernel image does not explain the difference.** Today's kernel `e3d774eb` and the Oct-24 kernel `a7c39ab5` measure 6.55 and 6.52 ms, paired.
- **Fork-server prototype** (`prototypes/hvfork`). One VM per process: create + 32 MiB map + 1 vCPU + one guest instruction + destroy. 3 reps × 100 (`mac/hvfork.jsonl`):

  | process model | child CPU ms p50 | parent CPU ms/VM | minflt |
  |---|---:|---:|---:|
  | posix_spawn + exec | 3.16–3.62 | ~0.2 | 507 |
  | **fork from a single-threaded parent that already loaded Hypervisor.framework** | **0.55–0.57** | ~0.28 | 132 |
  | in-process create/destroy (no isolation; floor) | 0.12–0.13 | – | – |

  HVF works in a forked child as long as the parent never created a VM. Saving: **about 2.6–2.9 CPU-ms per VM**.
- **Executor, Mac** (canonical harness, wall only): cold `execute()` **13.0 ms** p50 (56 ms before the native watchdog; 9.2 ms on Oct 24), against 8.5 ms raw cold. Parked `execute()` is 3.9–4.7 ms against 0.43 ms raw. Node CPU is not measured by that harness.

### 1d. Linux, libkrun, one process per VM (nested)
Same probe, Linux build of the Oct-24 VMM `d066a3a9`, current kernel image. 3 reps × 20 (`kvm/linux-libkrun-probe-summary.jsonl`, `kvm/lin-perfstat.csv`).

| per VM | value |
|---|---:|
| exec of `jitk-vmm` (static-ish, no frameworks) | 0.41 ms |
| + seccomp/namespace sandbox to WAIT_GO | +0.08 ms |
| VM build + boot to READY | 99 ms (vCPU ~80 ms) |
| RUN `return 2` (first run in a fresh guest) | +11 ms |
| **total** | **110.6 ms** |
| stage-2 faults / KVM exits / MMIO (virtio console) / userspace exits | **1,038** / 1,126 / 99 / 56 |
| syscalls / host minor faults | 552 / 1,026 |

Process creation on Linux is cheap. Every per-VM cost here is a cold boot plus about 1,040 first-touch stage-2 faults, which the shard design avoids.

## 2. Memory per VM

### 2a. Shard on Linux (`return 2`, retained after run, N ≤ 256)
Sources: kernel slopes from the 2026-10-27 ledger's raw `memory.stat` (`kvm/linux-mem-main-cells` analysis). Allocation sites come from bpftrace over `hold` with 1 and 65 slots (`kvm/kalloc-1-and-65.txt`). Guest pages come from the prototype's pagemap diagnostic (`kvm/pages-*.steady`, `kvm/diffs-return2.steady`).

| component | KiB/VM | notes |
|---|---:|---|
| **KVM/host kernel** (`memory.stat kernel`) | **231.6** | Hyperlight: 220.2 |
| ├ stage-2 tables (`sec_pagetables`) | 24 | Hyperlight: 32 |
| ├ host PTEs (`pagetables`) | 12.1 | Hyperlight: 2.1. Three 2-MiB PTE pages: kernel, arena, control |
| ├ slab (unreclaimable 24.2 + reclaimable 19.3) | 43.5 | **~22 of it is per-VM debugfs**: `debugfs_alloc_inode` 14.5, dentries ~5–7, `security_inode` ~2. Also `kvm_vcpu` 7.2, VMAs ~1.4, files ~0.5 |
| ├ large kmalloc / direct pages | | `kvm_arch_alloc_vm` 8, `kvm_init_irq_routing` 4, memslots 1.3, srcu 1, direct page allocations ~33 |
| └ not attributed by this trace | ~70–110 | |
| **guest pages CoW'd by the run** | **300** (`return 2`), 320 (one tool), 392 (Promise.all 10) | |
| ├ prepared QuickJS heap | 60 pages | changed bytes 6.9 KiB in total |
| ├ user stack / kernel .data / low arena | 3 / 5 / 4 pages | stack pages are densely written |
| ├ transport (control + TX + RX) | 2–3 pages | required |
| └ canary page | 1 | only because the bench sets `canary=true` |
| **of which bytes actually changed** | **10.2 KiB (3.3%)** | 53 of 75 pages have ≤64 changed bytes; 4 net-identical; 2 re-zeroed by mmap |
| word-level diffs (`return 2`) | 3,157 words | 412 counter-like (refcount ±1..4), 561 pointer-like (list links, free lists), 2,184 other (stack, new objects). **Only 8 pages are counter-only** |

What is avoidable:
- **Refcount churn is not the main source.** Making prepared objects immortal would save at most about 8–12 pages (32–48 KiB).
- **The main source is new allocations and their list/free-list links, scattered over about 60 heap pages.** A single-use VM does not need to reuse holes. A run-phase bump allocator (with `free` as a no-op and a new region after CHECKPOINT) would pack the ~10 KiB of real change plus the new objects into contiguous fresh pages.
  - **Estimate, not measured:** −100 to −150 KiB/VM. Correct OOM accounting must be kept.
- **Not avoidable:** stack, transport and the kernel's .data pages.
- **Zero-page sharing does not apply.** Unchanged arena pages are already shared snapshot page-cache pages.

What is configurable in the KVM charge:
- **debugfs:** about 22 KiB/VM. Boot the host with `debugfs=off`, or use a kernel without per-VM KVM debugfs. No code change; about 4% of 0.52 MiB.
- **Host PTEs:** placing the control/transport page in the arena's 2-MiB region would save one PTE page, 4 KiB.
- **Stage-2 granularity:** 2-MiB blocks need THP/hugetlb-backed immutable memory. That would change the CoW behaviour and is a later item; its gain is ≤16 KiB of tables.
- **vCPU/VM structures (~20 KiB):** fixed by the kernel.

**The fixed cost of 1.6–1.9 MiB, against Hyperlight's 0.4 MiB, is mostly not real memory:**
- **~1.0 MiB is a memcg per-CPU charge stock (accounting artifact).** At N=1, `memory.current` exceeds the sum of anon + file + kernel + sock by 0.84–1.08 MiB for the 5-thread shard, against 0–0.19 MiB for single-threaded Hyperlight. The gap does not grow with N; it is 0–1.0 MiB at N=256.
- **Up to 0.55 MiB is a scratch buffer glibc keeps.** `Snapshot::load` allocates a 512-KiB scratch buffer (`shard/src/snapshot.rs:84`). In some runs glibc keeps it on the main heap (`[heap]` was 564 KiB in one run and 52 KiB in another). Reading only the layout window, or calling `malloc_trim`, removes it.
- **The watchdog process is 0.12 MiB.**
- **Thread count and arenas barely matter.** 4 → 1 owner threads saves about 45 KiB; `MALLOC_ARENA_MAX=1` saves about 16 KiB (`kvm/fixed-cost.txt`).
- **The thread kernel stacks are 80 KiB.**

The copy-restore prototype has a memory cost: an idle slot keeps its ~300 KiB of restored private pages, where a discarded slot keeps none. The design therefore needs a hybrid:
- copy-restore while a slot is hot;
- `MADV_DONTNEED` above a page threshold, which the prototype has as `JITK_R9_LIMIT` and is tested;
- `MADV_DONTNEED` after an idle timeout.

### 2b. macOS (one process per VM)
Measurement: `footprint` / `vmmap` on a parked VM (`mac/footprint-ready.txt`, `mac/vmmap-ready.txt`). Today the footprint is **7.97 MiB at READY** (8.0 after one tool call; canonical harness 7.86). The 10.7 MiB of Oct 24 was an earlier VMM/kernel build.

| part | MiB |
|---|---:|
| guest RAM region ("shared memory", 16-KiB host pages) | 2.9 (1.7 resident + 1.2 compressed). It is essentially the **2.86-MB kernel image copied into anonymous guest RAM** |
| process base: dyld/framework dirty data (`__DATA*`, `__OBJC_RW`, `__AUTH`), malloc, 6 stacks, page tables | ~1.8 (0.6 + 0.65 + 0.14 + 0.35) |
| HVF VM + 1 vCPU (`hvfork`: 1.47 → 1.79 MiB) | ~0.3 |
| phys_footprint not attributed to user regions by `footprint` | ~3.1 |

What a fix would cost:
- **Map the image file `MAP_PRIVATE` into guest RAM instead of copying it** (libkrun loader patch, M):
  - The prototype shows `hv_vm_map` accepts a file-backed `MAP_PRIVATE` mapping and the guest executes from it.
  - Clean file pages are not counted in `phys_footprint`, so the expected saving is **about 2.9 MiB/VM** (inferred). An earlier R3 measurement on 32 VMs went from 256 to 39 MiB PSS.
- **Fork-server:** a forked child's base footprint is 0.87 MiB instead of 1.47–1.51, about **−0.6 MiB/VM**.
- **Snapshot-restore on macOS** ("shard-lite"), L:
  - Design: a zygote maps the prepared snapshot file; each forked child does `hv_vm_map` and restores registers.
  - It removes both the boot (1.5 ms) and the image copy.
  - Estimated ~1.3 MiB plus the dirtied pages, rounded to 16 KiB.
  - HVF allows only one VM per process, so there is no true in-process shard on macOS.

## 3. 64-slot cap and executor-side bottlenecks
- **The cap is structural.**
  - `shard/src/ipc_service.rs:10` sets `MAX_SLOTS = 64` and sizes the outbound queue as 64×35+1. `executor/shard-backend.ts:38` and `executor/shard-ipc.ts:3` repeat it.
  - Each direction of the memfd channel is a 64-record ring of 16,416-byte records (`constants.rs` `ipc::CAPACITY`): 2.1 MiB per channel.
  - **Option S:** run k shard processes per executor and stripe slots. No ABI change; +~0.6–0.7 MiB real fixed cost per extra shard.
  - **Option M:** a variable-length byte ring, so that capacity is decoupled from the 16-KiB maximum record size. With P07's bounded-copy fix, that would also remove the 114 KiB/run of fixed-slot copies.
- **Admission sheds instead of queueing.**
  - `SandboxPool` has `refillConcurrency` default 2 (`executor/pool.ts:25`) and throws `pool saturated` at `:32` when a third concurrent acquire arrives with an empty pool.
  - A slot's capacity token is held until RELEASED, after the asynchronous reset. Even a sequential caller on a 1-slot pool hits `pool saturated` about 12 times per run while the reset finishes.
  - At 48 in flight on 64 slots, the probe retried **250k times per 3,000 runs** and fell to ~200 runs/s, with Node at 3.4 ms/run spent on retries.
  - **Fix (S–M):** a bounded FIFO wait queue in `acquire` plus `refillConcurrency = slots` for the shard backend.
  - **For the "1,000,000 computers" demo, keep in-flight work below slots minus resetting slots.**
- **Head-of-line blocking (P03)** is unchanged. It is not re-measured; R7's 319 ms behind a 300-ms lease still applies. It matters more now that a tiny run costs about 1 ms.
- **Frame round trips (P04) and IPC copies (P07)** now account for a visible share of the 0.64–0.74 ms of Node CPU (see 1b). Most of that is kernel time per wakeup: 12 epoll wakeups per run.
  - **Change:** coalesce STATS+DONE (+RELEASED) into one notification and return credits per batch.
  - **Expected:** −30–50% Node CPU per run (estimate).

## 4. Ranked wins
Metal gains are estimates unless stated otherwise.

| # | change | measured now | prototype result | expected gain on metal | effort | risk |
|---|---|---|---|---|---|---|
| 1 | **Shard copy-restore reset**: restore privately CoW'd pages from the snapshot and keep host/stage-2 mappings; `MADV_DONTNEED` above a page limit and after idle (`prototypes/r9-reset-proto.patch`) | 229 stage-2 faults + 72 invalidations/run; 28.4 owner-ms nested | **~1 fault/run; 0.43 ms; executor total 37.5 → 1.55 CPU-ms/run; execute p50 34 → 1.0 ms**. `test-kvm` 5/5 (all-dirty pristine check) with and without fallback; 10,000 mixed restores, 0 canary leaks/cross-talk; hostile `arena_attack`/`bomb` contained | removes ~230 faults/run, ≈0.5–1 ms/run at 2–4 µs/fault | S–M | med: security-critical reset; idle slots keep ~300 KiB unless trimmed |
| 2 | **macOS fork-server** (zygote with Hypervisor.framework loaded; children fork, apply Seatbelt, build the VM) | 3.3 of 6.5 CPU-ms/VM before any VM code | spawn 3.2–3.6 → **fork 0.55** child CPU; footprint −0.6 MiB | **−2.6 to −2.9 CPU-ms/VM** (measured on HVF) | M | med: fork-safety of CF/ObjC; watchdog/pid tracking; Seatbelt per child |
| 3 | **Executor admission queue + `refillConcurrency=slots`** | `pool saturated` storms (250k retries/3k runs at 48/64) | analysis + probe | throughput demo stays at the 2.5–3k runs/s regime instead of collapsing | S–M | low |
| 4 | **One reset per lifecycle (P09) + skip invariant ID registers** | 398 ioctl/run (2 × ~197 + RUN) | skip-ID: 257 → 197 regs, −20 µs/reset nested; tests pass | ~−0.05–0.1 ms/run | S | low (KVM rejects changed ID regs after first run) |
| 5 | **Fewer Node wakeups per run** (coalesce STATS/DONE/RELEASED, batch credits, fold P04 internal re-parses) | Node 0.64–0.74 ms/run, 80% kernel; 12 epoll wakeups/run | profile only | −30–50% Node CPU | M | low–med (keep hostile-wire validation) |
| 6 | **Reply batching (P05)** | 11 MMIO exits for Promise.all(10); +45 µs Node/call | – | ≤30 µs/extra call | M | low |
| 7 | **macOS image file-backed `MAP_PRIVATE`** | 2.9 MiB/VM private image copy | `hv_vm_map` on file-backed private memory works | **−2.9 MiB/VM footprint**, −~0.2 ms copy | M | low–med (libkrun loader patch) |
| 8 | **Run-phase bump allocator in the guest** (single-use VM: `free` is a no-op, new region after CHECKPOINT) | 300 KiB dirtied for 10 KiB changed; 60 heap pages | page/word census only | −100–150 KiB/VM (≈20–30% of 0.52 MiB) | M | med (memory limit/OOM semantics; engine-adjacent) |
| 9 | **Reactor: watchdog pidfd in poll (P12), no per-probe `wait4`** | 18 wait4 + 11 ppoll per run | – | small CPU, fewer reactor wakeups | S | low |
| 10 | **Fixed-cost hygiene + `debugfs=off`**: trim `Snapshot::load`'s 512-KiB scratch; read memcg as stat sum rather than `current` at small N | up to 0.55 MiB/process retained; 22 KiB/VM debugfs slab | measured both | −0.5 MiB/process; −22 KiB/VM (4%) | S | low |
| – | 64-slot cap: k shards per executor | 64 slots/shard | – | linear capacity | S | low |
| – | macOS snapshot-restore ("shard-lite") | boot 1.5 + build 1.0 ms/VM | – | ~1 CPU-ms/VM on macOS | L | med |

## 5. What blocks ≤5 CPU-ms per VM on metal
- **Shard (target ≤2 ms).** With copy-restore, the measured nested total is 1.55 CPU-ms/run including Node, and nesting inflates every exit. Nothing measured blocks the target.
  - **Without copy-restore,** each run pays ~230 stage-2 faults and 72 invalidations plus ~400 register ioctls. On metal that is probably 1–2 ms. This is unmeasured and depends on the per-fault cost.
  - **The remaining costs** are Node wakeups (~12/run) and the IPC reactor. They are now the largest share.
  - **The throughput demo is limited by executor admission (§3) before CPU.**
- **macOS libkrun.** It costs 6.5–7.2 CPU-ms/VM today (contended) and 4.86 at the quiet Oct-24 point.
  - About 3.3 ms of that is process creation plus framework load. The fork-server alone takes the measured path to about 3.6–4.0 ms. Image mapping and snapshot restore would go lower.
  - The Node executor adds about 4.5 ms wall to a cold `execute()`. Its CPU is unmeasured on macOS.
- **Linux libkrun process-per-VM.** Each fresh VM pays about 1,040 first-touch stage-2 faults, 99 virtio-console MMIO exits and a full QuickJS boot (~1.5 ms of guest work on HVF).
  - At 2–4 µs per fault, that is about 2–4 ms of faults alone, so plausibly 4–6 ms in total: borderline.
  - It cannot be judged without metal. The shard is the path for the demo.

## 6. Not measured, or not measurable here
- **No metal runs.** In particular, there is no per-event cost (stage-2 fault, `KVM_SET_ONE_REG`, MMIO exit) on metal. Every metal figure above is an estimate.
- **No quiet Mac.** Load1 was 3.5–8 throughout. The canonical harness flagged 5–6 of 30 samples per row as over the gate.
- **macOS:**
  - syscall/fault tracing inside HVF (SIP is on, so no dtrace);
  - Node CPU per `execute()` (the harness reports wall time only);
  - attribution of the ~3.1 MiB of `phys_footprint` outside user regions;
  - an end-to-end fork-server or file-mapped libkrun (only HVF primitives were prototyped).
- **KVM kernel memory:** about 70–110 KiB/VM is not attributed by the allocation trace (allocations with no captured stack).
- **Not measured at all:**
  - copy-restore's idle-slot memory under a real ledger;
  - GC's share of dirtied pages;
  - the bump-allocator saving;
  - head-of-line blocking after the fix;
  - Hyperlight behind Node.
- **Executor throughput under nested contention** is bimodal: 2.5–3k runs/s in quiet repetitions, 200–450 in others. Treat it as indicative only.

## Method
- **Environment.**
  - Mac: M4 Pro, macOS 26.6.1. Artifacts from `make -C arch/jitk deps`: VMM `b15a7db1`, kernel `e3d774eb`.
  - kvm-dev: Ubuntu 26.04, Linux 7.0.0-38, 6 vCPU, nested.
  - Scratch: `/home/dev/perf-r9-2026-10-27/`. The tree is a `git archive` of `f3f14f0f` arch/jitk, the snapshot is a copy of the 2026-10-27 `helpers.*`, and Node is the R7 copy, 24.13.0.
  - All kvm-dev timing and memory runs held `flock /home/dev/bench.lock`. The Mac canonical subset held `/tmp/sofort-bench.lock`.
- **Shard A/B.** `real` and `real-proto` were built from the same tree. The prototype touches only `shard/src/kvm/mod.rs` and is env-gated (`JITK_R9_RESET=copy`, `JITK_R9_SKIP_ID`, `JITK_R9_LIMIT`, diagnostic `JITK_R9_PAGES`/`JITK_R9_DIFFS`). Variants were interleaved within each repetition.
- **Probes.**
  - `prototypes/vmprobe`: Rust; per-phase rusage plus per-thread CPU.
  - `prototypes/hvfork`: Rust; HVF spawn/fork/in-process, footprint, file-backed map.
  - `prototypes/exloop.mjs` and `exconc.mjs`: executor loops.
  - `classify-pages.sh` and `classify-diffs.sh`: page and word census.
  - `reduce-probe.sh`: medians.
