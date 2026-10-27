# Linux same-host memory: jitk shard vs Hyperlight (2026-10-27)

**Verdict.** On the same nested-KVM Linux host, measured the same way, jitk's shard and Hyperlight's
in-process shared-snapshot sandboxes cost about the same per VM. Hyperlight is slightly lower
(return 2: 0.495 vs 0.515 MiB/VM; one tool call: 0.527 vs 0.535 MiB/VM). It also has about 1.5 MiB
less fixed cost. **The "~3x lower than Hyperlight" claim is not supported.** It compared jitk's Linux
shard against Hyperlight's macOS per-process footprint.

## Why the old numbers were not like-for-like
- *0.58 / 0.63–0.66 MiB* (R8): jitk shard on Linux, cgroup slopes including KVM charges.
- *1.8 MiB* (Hyperlight): macOS process physical footprint, one process per sandbox, HVF kernel
  allocations excluded.
- *10.7 MiB* (jitk on macOS): libkrun process footprint.
- These are three different layouts, platforms and accounting methods. An earlier nested ledger
  (`arch/research/perf/linux-ledger/RESULTS.md`, 2026-10-25) already found 0.371 MiB/VM for
  Hyperlight shared-snapshot on Linux. That used an older raw guest, a `return 2` handler without
  bootstrap.js, and was not compared with the shard.

## Environment
- Apple M4 Pro, macOS 26.6.1. HVF, then nested KVM in `kvm-dev`.
- Guest: Ubuntu 26.04.1, Linux 7.0.0-38-generic aarch64, glibc 2.43.
- 6 vCPUs, 8,908 MiB MemTotal, no swap, 4 KiB pages, THP `madvise` (defrag `madvise`).
- load1 during samples: 0.01–1.45. All idle-CPU windows were ≤3.3 ms/s for the whole cell.
- Zero memory.max/OOM events.
- Every measurement ran under `flock /home/dev/bench.lock` in `/home/dev/linux-mem-2026-10-27/`.
- The task cgroup `/sys/fs/cgroup/linux-mem-2026-10-27` was created by the run and removed by it.
  No persistent cgroup or sudo configuration remains.

**Artifacts.** All were built on kvm-dev from `git archive` of `0da89a67` (this branch, on main
`98f1e7c7`).

**jitk:**
- `real` shard binary: sha256 `735bbc59…`, Rust 1.99.1 stable.
- The current main kernel was built through `shard/harness/prepare-helpers.mjs` (glue-2m class,
  helper sha `5711b5e3…`).
- Image `helpers.bin` `5daef606…`, prepared `helpers.mem` `dcd21f67…`.
- Node 24.22.1 linux-arm64, tarball sha matching `tools/deps.json`.

**Hyperlight:**
- hyperlight-js `8d208af8` (the `tools/deps.json` pin), hyperlight-host 0.18.0 with the KVM backend.
- Built with the pinned `nightly-2026-10-20` (rustc 1.101.0-nightly 07e526db9), installed in an
  isolated `RUSTUP_HOME` and then deleted.
- `hl-density` sha `81e81c03…`.

## Workload and configurations
Each cell holds **N concurrent VMs in one fresh cgroup**, then samples them. Each family has the
same three states:

| state | jitk shard (`real hold`) | Hyperlight (`hl-density hold`) |
|---|---|---|
| ready / parked | slot restored from the shared snapshot, guest ran to READY and is waiting for RUN | `Sandbox::from_snapshot`, vCPU **never entered** (Hyperlight has no parked-guest state) |
| return2 | `return 2;` run to completion, stopped slot retained | `RunHandler` with `return 2;` via `bootstrap.js`, sandbox retained |
| one_tool | `return (await tools.echo(41))[0]+1;`, synthetic in-process echo → 42 | same source, same in-process echo → 42 |

**Families:**
- **jitk-shard**: one process, 4 owner threads, N KVM VMs. Each VM has a `MAP_PRIVATE` mapping of
  the one prepared snapshot file. No Node.
- **jitk-node**: the real `MicroVMExecutor` + `ShardBackend` + Node policy/IPC/watchdog
  (`executor/ipc/measure-helpers.mjs hold`, R8's method). The executor uses its own codemode
  `echo`. The cgroup includes Node.
- **hl-default**: one process. One `Snapshot::load` of a tenant-free saved snapshot of the
  hyperlight-js runtime + `bootstrap.js` handler. N `Sandbox::from_snapshot`, each its own KVM VM.
  Uses hyperlight-js's own default/minimum sizes: heap 4 MiB, scratch 1 MiB.
  - This is Hyperlight's own density design: snapshot memory is shared read-only (default
    `not(unshared_snapshot_mem)`), and each sandbox gets a lazily touched scratch region.
  - It is the strongest fair configuration: Hyperlight's defaults, the documented
    snapshot/`from_snapshot` reuse path, and no tenant state in the snapshot.
- **hl-16m**: the same, with `worker.rs`'s 16 MiB heap / 16 MiB scratch (the Mac bench sizes).
- **hl-proc**: one `hl-density` process per sandbox, the Linux analogue of the Mac "strict" layout
  behind the 1.8 MiB figure. N ≤ 128.
- **\*-thp**: same as above without `GLIBC_TUNABLES=glibc.malloc.hugetlb=0`. All other shard and
  Hyperlight families set this tunable, as the R7 ledger did. `ShardBackend` does not set it.

The Hyperlight code is the same guest, handler and sandbox construction as
`bench/hyperlight/worker.rs`, with the KVM backend
(`bench/hyperlight/linux/{Cargo.toml,density.rs}`). The only change is that the tool host is
answered in-process, as the shard fixtures do, so that one process can hold N sandboxes.

## Method
`bench/linux-memory` (scriptc, static aarch64 musl), `plan.json` / `plan-node.json`.

**Per cell:**
1. Warm the shared files outside the cell: the snapshot files and the holder binary. They stay
   charged once, to the controller's cgroup, not to the cell. Snapshot files: jitk `helpers.mem`
   32 MiB (+25 MiB image); Hyperlight `hl-default` 6.3 MB, `hl-16m` 19 MB.
2. Create a fresh child cgroup. Start the holder in it via `spawn-cg` (clone3
   `CLONE_INTO_CGROUP`) and wait for `held`.
3. Settle 3 s. Take 3 samples, 200 ms apart, of `memory.current`, `memory.stat` and `smaps_rollup`
   for every process, and keep the median. Record `memory.peak`, `memory.events` and 1 s of idle
   `cpu.stat`.
4. SIGTERM the holder and remove the cgroup.

**Sweep.** N = 1, 8, 32, 128, 256. jitk-node is limited to N ≤ 64 by `ShardBackend`'s 64-slot
capacity check, so it ran N = 1, 8, 32 in the main sweep and 1, 8, 32, 64 in a second sweep.
- 3 independent repetitions.
- Count order is reversed on odd repetitions, and family order rotates per count.

**Reduction.** One least-squares fit `metric = fixed + N × slope` per repetition. The table gives
the mean slope with a **95% Student-t interval across the 3 repetitions**. Minimum R² was 0.993
for jitk-node and ≥0.9995 elsewhere.

**What the columns include:**
- **cgroup current** is the all-in number: process anon and page tables, plus kernel charges (KVM
  vCPU/VM structures, stage-2 tables `sec_pagetables`, slab, kernel stacks). It also includes file
  cache only if first touched inside the cell. Shared snapshot pages are excluded because they are
  warmed outside the cell.
- **Kernel** is the `memory.stat kernel` slope, a subset of current.
- **PSS** and **private dirty** are `smaps_rollup` summed over the cell's processes. They are
  diagnostics; they exclude kernel charges and are not to be added to current.

## Results: per-VM slope (cgroup `memory.current`, MiB/VM, mean [95% CI], 3 reps)

| family | ready | return2 | one_tool | fixed MiB | kernel KiB/VM | private dirty KiB/VM (r2 / tool) |
|---|---|---|---|---|---|---|
| **jitk-shard** (no Node), N ≤ 256 | 0.242 [0.234, 0.249] | **0.515** [0.508, 0.521] | **0.535** [0.533, 0.536] | 1.6–1.9 | 231.6 | 300 / 321 |
| **hl-default** (in-process), N ≤ 256 | 0.116 [0.116, 0.117] ¹ | **0.495** [0.492, 0.498] | **0.527** [0.524, 0.531] | 0.39–0.46 | 220.2 | 291 / 323 |
| hl-16m (Mac bench sizes), N ≤ 256 | 0.173 [0.170, 0.176] ¹ | 0.554 [0.552, 0.555] | 0.584 [0.582, 0.587] | 0.42–0.45 | 223.0 | 347 / 379 |
| hl-proc (process per sandbox), N ≤ 128 | – | 0.816 [0.815, 0.818] | – | 0.28 | 305.8 | 532 / – |
| **jitk-node** (executor + Node), N ≤ 64 | – | 0.657 [0.585, 0.729] | 0.665 [0.645, 0.686] | 35.1–35.8 | 232.2 | 410 / 425 |
| jitk-shard, same sweep N ≤ 64 | – | 0.516 [0.507, 0.525] | 0.533 [0.526, 0.541] | 1.9–2.0 | 231.6 | 304 / 322 |
| hl-default, same sweep N ≤ 64 | – | 0.495 [0.488, 0.502] | 0.531 [0.522, 0.541] | 0.43–0.54 | 220.2 | 291 / 323 |
| jitk-shard-thp (no tunable) | – | – | 0.534 [0.526, 0.543] | 9.5 | 231.6 | 320 |
| hl-default-thp (no tunable) | – | – | 0.530 [0.525, 0.535] | 0.33 | 220.2 | 326 |

¹ The "ready" rows are not comparable. The Hyperlight sandbox has never been entered: kernel
charges are only about 60 KiB/VM because stage-2 tables are built on first run. The jitk slot has
executed to READY.

`memory.peak` slopes equal the current slopes to within 0.003 MiB/VM, except jitk-node (≤0.025).

**Total current per VM at N = 256, including amortized fixed cost:**
- one_tool: jitk-shard 0.543 MiB, hl-default 0.529 MiB.
- return2: 0.522 vs 0.497 MiB.

R8's numbers reproduce on current main:
- jitk-node full cgroup: 0.657–0.665 MiB/VM here, vs 0.632–0.655 in R8.
- jitk-node private dirty + kernel: about 0.63–0.64 MiB/VM.
- Without Node, the shard alone is 0.515–0.535 MiB/VM all-in. Node adds about 0.13 MiB/VM in
  this sweep plus about 35 MiB fixed.

## Reading
1. **Per VM, jitk and Hyperlight are equal to within about 4%, with Hyperlight lower.**
   - The return2 intervals do not overlap: Hyperlight is lower by 0.020 MiB, about 4%.
   - one_tool differs by 0.008 MiB (1.5%). The intervals touch in the N ≤ 64 sweep.
   - Both are dominated by the same two terms:
     - About 220–232 KiB/VM of KVM/host-kernel charge (vCPU, VM, stage-2). Hyperlight's is about
       11 KiB lower.
     - About 290–320 KiB/VM of guest pages dirtied by QuickJS (jitk: Bellard QuickJS;
       Hyperlight: quickjs-ng 0.15.1).
2. **Fixed cost favours Hyperlight.** About 0.4 MiB per process, vs about 1.9 MiB for the shard
   (4 owner threads + watchdog).
   - Without the glibc tunable the shard's fixed cost rises to 9.5 MiB: 8 MiB of AnonHugePages
     across its owner-thread malloc arenas.
   - Hyperlight stays at 0.3 MiB because it is single-threaded. Its per-VM slope is unchanged.
3. **Layout explains the old 3x.** Hyperlight in one process per sandbox costs 0.82 MiB/VM on
   Linux (+86 KiB kernel for the extra process). That is still far below the macOS 1.8 MiB
   footprint. The Mac footprint figure is not a Linux density number for either system.
4. **Sizing matters for Hyperlight.** At the Mac bench's 16/16 MiB sizes it costs 0.554/0.584
   MiB/VM, slightly above jitk. Its defaults (4/1 MiB) are the stronger configuration.
   - jitk's glue-2m class is a 1.25 MiB writable arena.
   - Hyperlight's default scratch (1 MiB) is the closest bound on writable memory.

## Indicative latency/CPU (nested KVM: CPU and latency are inflated; not a performance claim)
Sequential runs, one VM at a time, 200 runs per point (Node: 100 runs after 5 warmups). Medians of
3 repetitions, in ms.

| p50 ms (CPU ms/run) | return2 | one_tool |
|---|---|---|
| jitk shard, reset + bind + run | 16.2 (16.8) | 18.6 (19.1) |
| Hyperlight, `from_snapshot` + run | 12.0 (12.1) | 13.7 (13.7) |
| Hyperlight, `restore` + run (reuse) | 13.0 (13.2) | 14.8 (15.0) |
| jitk via Node executor, `execute()` | 19.0 | 20.3 |

How CPU is measured:
- jitk: owner-thread CPU including guest time, from the shard's summary.
- Hyperlight: process `getrusage`.
- Node: wall time only.

In this nested environment Hyperlight's per-run path is about 25% cheaper. On the quiet Mac bench
(HVF, not nested) jitk was faster on parked latency. These nested numbers do not decide that
question.

## Caveats
- **Nested.** Memory accounting is valid for this kernel and 4 KiB pages. Absolute KVM kernel
  charges on metal or on a 16 KiB-page host can differ, for both systems alike.
- **Engines differ.** QuickJS (jitk) and quickjs-ng 0.15.1 (Hyperlight) run the same JS source.
  This is a whole-stack comparison.
- **Hyperlight has no Node/executor row.** Its Node binding (`src/js-host-api`, napi) was not
  built. jitk-node is therefore compared against no Hyperlight equivalent. Compare jitk-node only
  with R8.
- **jitk-node capacity.** It is limited to N ≤ 64 by `ShardBackend`. 12 cells at N = 128/256 in
  the main sweep failed on that check and are excluded. Its interval is wider (Node heap noise).
- **Shared files and fixed cost.**
  - Shared snapshot files are excluded from the slopes. They are charged once per host: jitk
    32 MiB prepared RAM file, Hyperlight 6.3 MB.
  - Fixed intercepts carry memcg charge-batching noise at small N (about 256 KiB granularity).
- **Retained state.** "Retained after run" is a measurement state. The shard resets released slots
  in production; a Hyperlight service would `restore` or drop.

## Reproduce
On the Mac:
```sh
make -C arch/jitk/shard build-linux
make -C arch/jitk/bench/linux-memory build build-linux
```
Then on kvm-dev, in a `git archive` export under `$W/tree`:
1. Symlink `bench/hyperlight/linux/hyperlight-js` to the pinned checkout.
2. Build `hl-density`:
   ```sh
   CARGO=<nightly-2026-10-20>/bin/cargo cargo build --release --locked --manifest-path arch/jitk/bench/hyperlight/linux/Cargo.toml
   ```
3. Build the shard:
   ```sh
   cargo +stable build --release --locked --offline --bin real
   ```
4. Prepare the jitk snapshot:
   ```sh
   JITK_TOOLS_DIR=arch/jitk/kernel/.work/linux node arch/jitk/shard/harness/prepare-helpers.mjs $W/bin/real $W/snap/helpers
   ```
5. Save the Hyperlight snapshots:
   ```sh
   HL_HEAP_BYTES=0 HL_SCRATCH_BYTES=0 hl-density save $W/snap/hl-default
   hl-density save $W/snap/hl-16m
   ```
6. Build the executor: `JITK_BACKEND=shard sh arch/jitk/executor/run.sh build`. Then compile
   `shard/harness/spawn-cg.c` to `$W/bin/spawn-cg`.
7. Run the two sweeps:
   ```sh
   sudo flock /home/dev/bench.lock $W/bin/linux-memory ledger arch/jitk/bench/linux-memory/plan.json $W/raw/main $W
   sudo flock /home/dev/bench.lock $W/bin/linux-memory ledger arch/jitk/bench/linux-memory/plan-node.json $W/raw/node64 $W
   ```
8. Reduce: `linux-memory analyze cells.jsonl summary.json`.

The committed `plan.json` already restricts jitk-node to N ≤ 32. The measured main sweep also
attempted N = 128/256 for it, and those cells failed as described above.

## Evidence
- Reduced summaries: `bench/linux-memory/results/{main,node64}-summary.json`.
- Latency rows: `bench/linux-memory/results/latency.jsonl`.
- Host snapshot: `bench/linux-memory/results/main.env.txt`.
- Raw per-cell JSONL with all samples:
  - Mac: `~/sofort-local-evidence/linux-memory-2026-10-27/raw/`.
  - kvm-dev: `/home/dev/linux-mem-2026-10-27/raw/`, plus binaries and snapshots, 111 MB.
  - `main/cells.jsonl` sha256 `d377b676…`; `node64/cells.jsonl` `640070dd…`.
- Scratch peaked at 3.4 GB and was deleted.
