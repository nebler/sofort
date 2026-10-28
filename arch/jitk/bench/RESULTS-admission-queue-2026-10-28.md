# Executor admission queue: before/after (2026-10-28, Linux KVM, nested)

R9 win #3 / N13. Before = `836e5745` (`pool saturated` shedding). After = the
bounded FIFO admission queue (`SandboxPool.acquire`, `ShardBackend.park`).
Probe: the unchanged R9 `arch/review/raw-r9-perf/prototypes/exconc.mjs`. It
retries `Error: pool saturated` with `setImmediate` and counts those retries.
Setup: `return (await codemode.echo(41))+1`, 3,000 runs per cell, 4 owners, and
`refillConcurrency=slots` on both sides. Each cell is the median of 3 reps, with
before and after interleaved. Both sides share one shard binary and one
helper snapshot, freshly prepared (`helperSha256 5711b5e3…`). The dev VM has 6
vCPUs. `/home/dev/bench.lock` was held for the whole run. Load was 0.4 at start
and ~4 at the end, from other tenants. The numbers are nested and indicative.

| slots/in flight | side | runs/s (median; range) | errors | shed retries / 3,000 runs (median) | Node CPU ms/run (median; range) | shard CPU ms/run (median) |
|---|---|---:|---:|---:|---:|---:|
| 1/1 | before | 40.8 (38.0–41.6) | 0 | 274,826 | 1.75 (1.7–1.9) | 22.1 |
| 1/1 | after | 38.2 (36.6–41.5) | 0 | 0 | 0.91 (0.6–0.9) | 23.3 |
| 64/8 | before | 59.5 (59.0–60.0) | 0 | 0 | 0.60 (0.6–0.6) | 61.5 |
| 64/8 | after | 59.7 (58.4–60.4) | 0 | 0 | 0.55 (0.5–0.6) | 61.3 |
| 64/32 | before | 60.2 (56.7–61.5) | 0 | 0 | 0.54 (0.5–0.6) | 61.2 |
| 64/32 | after | 60.5 (60.3–61.5) | 0 | 0 | 0.51 (0.5–0.5) | 60.4 |
| 64/48 | before | 60.0 (59.7–62.0) | 0 | 3,094,339 | 11.16 (9.8–11.2) | 61.6 |
| 64/48 | after | 60.9 (60.6–61.7) | 0 | 0 | 0.56 (0.5–0.6) | 60.8 |
| 64/64 | before | 58.8 (57.6–60.0) | 0 | 1,640,947 | 6.24 (3.0–6.3) | 62.9 |
| 64/64 | after | 60.3 (59.5–61.7) | 0 | 0 | 0.52 (0.5–0.6) | 61.2 |
| 64/128 | before | 58.3 (55.5–59.6) | 0 | 4,598,619 | 15.73 (15.4–16.5) | 63.5 |
| 64/128 | after | 62.4 (51.0–62.4) | 0 | 0 | 0.49 (0.4–0.9) | 59.3 |

- **Shedding is gone.** After the change no cell retried, and no run failed.
  Before, a sequential caller on one slot retried ~92 times per run, and 48 in
  flight on 64 slots retried ~1,000 times per run.
- **The Node CPU spent on retries is gone.** At 48/64 Node CPU drops from 11.2
  to 0.56 ms/run (−95%), and at 128/64 from 15.7 to 0.49 ms/run. At 1/1 it
  halves, 1.75 → 0.91 ms/run.
- **Runs/s did not move: the shard is the bottleneck on main.** It spends ~60
  CPU-ms per run, ~22 at one slot, because main still does a full reset per run.
  R9's 2.5–3k runs/s regime, and its "collapse to ~200 runs/s", were measured
  with the unmerged copy-restore reset prototype (win #1, ~1.55 CPU-ms/run).
  With that prototype the 10–16 ms/run of Node retry CPU, now removed, would be
  the dominant cost. That combination was not measured here.
- Also verified on this VM: `build/shard-check.js` PASS, 126 assertions, including the
  new rows: park() FIFO handoff on reset, bound, abort, death with waiters, and
  50 sequential executes on one slot without `drain()`.
