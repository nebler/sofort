# Gate 8 on Linux: moving the shipping path to the shard (plan, 2026-10-25)

Status: **plan**, written by the lead after R7 waves 1–2. Nothing here is built yet.
Inputs: `arch/architecture/ARCHITECTURE.md` §6 (gates), `arch/V1.md` (scope, exit criteria),
`arch/jitk/shard/RESULTS-R7-{rng,bytes,shard}.md`, `arch/jitk/linux/RESULTS-R7-suite.md`.

## 1. What changes

| | Today (shipping) | After cutover (Linux arm64) |
|---|---|---|
| `execute(code)` | executor → TS physical pool (`executor/pool.ts`) → one `jitk-vmm` (libkrun) process per VM, default kernel image | executor → policy IPC → shard process (owner threads, prepared QuickJS snapshot, ring ABI) |
| `run(tool, args, files)` | `real native-worker` (one serial worker, one slot) | same shard, prepared snapshot per tool profile, multi-owner, leases |
| Deadlines | external SIGKILL of the VMM process | watchdog leases (shard, slot, generation, deadline); shard terminated only if an owner fails to stop |
| Kernel image | default (virtio/FDT/GIC) image | `transport-ring` image only |
| macOS | libkrun/HVF | **unchanged** (gate 7, the HVF worker, is deferred in v1) |

The Mac keeps the libkrun backend in v1, so libkrun leaves only the **Linux** shipping path.
Gate 8's "delete libkrun + TS physical pool" applies in full only after gate 7.

## 2. Preconditions (all must hold first)

1. **Gate 4 on metal:** restore p99 ≤1 ms with zero leaks over 10,000 restores, measured on the
   M1 Air with Asahi. If it misses, re-evaluate with the user before cutover (V1 §4).
2. **Gate 6:** Node policy IPC and watchdog leases integrated; tiny run ≤2 CPU-ms; deadline
   stop ≤50 ms (criteria 3, 4, 8) on metal.
3. **§2.3 memory bound** enforced (R7 `r7-shard`), with its conformance tests in the suite.
4. **Feature parity of the ring profile with the shipping JS path** (closing ABI-R6/R7
   restrictions): the full codemode codec (typed arrays, UTF-8), `/cap` minimum, real clocks
   inside a job, structured tool errors, the same `execute` result/limits contract as
   `executor/`. List each one in a parity table, with its test.
5. **One test suite covers both paths** while they coexist: `make test` runs the executor and MCP
   suites against both backends and compares results on a shared corpus.

## 3. Steps

1. **Backend selection, not replacement.** Add a `shard` backend in `executor/select-backend`
   next to `jitk` (libkrun); default stays `jitk`. CI/`make test` runs both.
2. **Shadow period.** On Linux, run every executor/MCP test case on both backends and diff
   `(result, stdout, stderr, exit, error class)`. Zero diffs required, except documented ones.
3. **Flip the Linux default** to `shard` once the preconditions in §2 hold. Keep `jitk` selectable
   for one release as a rollback (`JITK_BACKEND=jitk`).
4. **Delete on Linux:** the per-VM `jitk-vmm` launch path, the TS physical pool's Linux branch,
   the virtio/FDT/GIC paths if no remaining consumer, and their tests. The default kernel image
   stays only while the Mac uses it.
5. **Clean-copy build/test** (gate 8's pass criterion): a fresh clone builds and passes
   `make test` on Linux without any `/tmp` artifacts or hand-set environment variables.

## 4. Risks and how we detect them

| Risk | Detection |
|---|---|
| Parity gaps in the ring JS profile (codec, clocks, errors) | shadow diffs in step 2 |
| Restore/first-fault latency misses on metal | gate 4 measurement; changes the pitch, not the plan |
| One shard process is a larger failure domain than one process per VM | watchdog terminate-shard path tested under load; per-shard slot cap (64, §2.4) |
| Two backends double the test matrix | time-box the shadow period; delete promptly after the flip |
| Test environment depends on `/tmp` builds and hand-set env vars (seen in R7) | clean-copy build is a hard gate (step 5) |

## 5. Out of scope here
Gate 7 (HVF worker on the Mac), removing libkrun from the Mac, the Rust broker (architecture
option A), x86-64.
