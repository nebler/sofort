# Round-3 decisions (lead) — binding for round 4, the final cleanup + recertification round

## Status
- **Gates:** H2 and H3 pass. H1 fails on portability (the build passes). H4 is a contended table only. H5 has an open deadline issue.
- **Benchmark headline** (`jitk/bench/RESULTS.md`, n=60, interleaved, load 14–146):
  - Parked jitk is the fastest on every workload. Promise.all(10) with 5 ms tools: **9.5 ms vs 102–108 ms** for Hyperlight.
  - Hyperlight wins cold trivial runs (~1.4×), CPU per VM (~9 vs ~14 ms) and memory (~6×).

## F1 — Portability (H1)
Nothing under `arch/jitk/` may reference `/tmp/jitk-NN/...`, another area's `arch/NN-*` dir, or the checkout's basename. Fixtures ship inside the subtree that uses them. External inputs (e.g. Hyperlight sources) come through documented env vars with clear errors. Owners fix their own subtree:
- **02 (kernel):** ship the grow-contract fixture (`ioctl.S` etc.) inside `kernel/`. 10 has a validated portable-fixture patch: see `10-minimalist-critic/R3.md` / `R3-INTEGRATION.md`.
- **04 (executor):** derive the root independently of the directory name, and honor a built-VMM override env var.
- **08 (grow):** the verifier must not depend on `/tmp/jitk-08/.../repository`.
- **09 (bench/hyperlight):** remove the `/tmp/jitk-09` and `/tmp/jitk-02/r2` hardcodes. Use env vars and the canonical `vmm/` + `kernel/` outputs.
- **06 (bench):** remove the historical `arch/02-...` evidence reference from `bench/executor.mjs`.

## F2 — Deadline independent of the host event loop (H5 exposure blocker)
An execution deadline must fire even if the trusted host's event loop is blocked by a slow tool callback.
- The executor (04) passes **each run's own deadline** to the per-VM external watchdog process, which enforces it with its own timer. That replaces the fixed 5 s. The watchdog is the single implementation shared with `bench/hyperlight` (dedupe).
- Tool callbacks receive an AbortSignal.
- Target: overshoot ≤ 50 ms in **30/30** for both 10's blocking-callback probe and the CPU-loop probe. Record load next to the result.

## F3 — Deduplication
Remove the identical-source copies listed in `10-minimalist-critic/r3/source-audit-final.json`, keeping one canonical home:
- `grow/fallback-kernel` and `grow/proposals` must not duplicate `kernel/` files. Use the kernel as the source of truth and keep only the diffs that grow produces.
- Fault-guest fixtures live in `vmm/tests/fixtures/`; `linux/` references them.
- There is one watchdog.
- `exit`/`exit_group` may stay as two files only if their semantics differ.

## F4 — One frozen artifact set
Everything is recertified on **VMM v2** (darwin `276463d0…`) and the current kernel image. Each owner records the hashes they tested in their `R4.md`.

## Gates for round 4
- **I1** — H1 passes from `cp -R arch/jitk /tmp/x/anyname && make build test`.
- **I2** — The F2 deadline probes pass 30/30.
- **I3** — The bench regression subset runs on v2: cold return2, parked one_tool, parked promise10_5ms, and memory. Same harness and gating; v2 is compared with the 73df1ad3 numbers.
- **I4** — `CLAIMS.md` is updated, and owned LOC is re-measured after dedup.
