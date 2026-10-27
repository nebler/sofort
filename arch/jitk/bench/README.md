# Canonical performance harness (owner 06)

Build with `make -C arch/jitk/bench build`, then run
`make -C arch/jitk/bench bench BENCH_ARGS="--samples 30"` from the repository root.
The Makefile holds `/usr/bin/lockf -k /tmp/sofort-bench.lock` for collection.
Direct binary invocations must use the same lock.
Defaults: load1 < 6, budget 10 s **per sample**, poll 1 s, fresh single-use VM,
seeded randomized complete blocks (every case once per block). If the budget
expires the sample runs and is flagged. Never interpret flagged data as quiet.
Use `--gate-budget 60 --load-threshold 6` for a longer gate, or `--only REGEX`.
`--smoke` runs two rounds and does not overwrite canonical results.
`--report RAW_JSON` regenerates the one canonical `RESULTS.md` table.
`--test` verifies the statistical, gate, and watchdog behavior without a VM.

Outputs: `raw.json` (incrementally saved, includes every failure and machine
state), `RESULTS.md` (the sole canonical table; cite it for all external claims).
95% percentile bootstrap CIs for p50/p90/p99 use 2,000 resamples, fixed seed.
The p99 of n=30 is poorly resolved; CIs describe this run, not future SLOs.
CPU-ms is child user+system time including teardown, excludes supervisor and
its single external watchdog. RSS/physical footprint use macOS libproc, exclude
unattributed HVF kernel allocations. Refill includes READY, kill and reap.
First launch/signature admission is outside steady-state samples via one
untimed validation per artifact. Disk/code-signing caches are warm.

Build/test integration: `make -C arch/jitk/bench build test`.

## Adapter contract (09 owns `hyperlight/`)

Preferred: `hyperlight/adapter.json` with `strict_argv`, `clone_argv`, optional
`env`, `provenance`, and `files` (paths to hash). Both commands speak protocol v1
on stdin/stdout. Strict starts a fresh HW VM per process; clone accepts repeated
RUN frames and restores a fresh logical sandbox each time. The controller owns
all timing, load gates, 5 ms async tools, validation, watchdog, interleaving,
statistics and cleanup. Snippets are in `cases.json`; no adapter-local timing.
Example: `{"strict_argv":["/abs/worker","strict","/abs/snapshot"],
"clone_argv":["/abs/worker","clone","/abs/snapshot"],"provenance":"..."}`.
An adapter `.READY` alone is not enough: include the descriptor. Use
`--hyperlight-adapter PATH` or `HYPERLIGHT_ADAPTER`; `--no-hyperlight` selects
a jitk-only run. There is no cross-owner scratch fallback.

Kernel and VMM selection is independent of the checkout basename. Defaults are
`kernel/dist/kernel.bin` (also `kernel/build/kernel.bin`) and
`vmm/build/jitk-vmm` (also `vmm/target/release/jitk-vmm`), relative to this
harness's parent tree. Override with `--vmm PATH --image PATH`,
`JITK_VMM_BINARY`, or `JITK_IMAGE`. Missing inputs fail with an actionable error.
Use `--scratch-dir PATH` or `JITK_BENCH_TMP` for frozen run directories; the
default is the system temporary directory. No other area's artifacts are guessed.

Binaries, image, Hyperlight snapshot and an available READY executor runtime
are copied into a private run directory. Seatbelt is compiled once for that
image directory, and host sandbox acknowledgement is mandatory.
`--sandbox-profile PATH` uses an explicit profile; `auto` compiles one.
`sandbox-apply/on` and `/off` measure only the precompiled `sandbox_apply` call
against a no-call clock baseline, plus profile-read + apply as a separate metric.
Executor rows use the canonical READY runtime or `--executor-root PATH`; they
require an absolute `--node PATH` or `NODE`. No PATH shim or legacy executor is
selected. Pool preparation and cleanup remain outside response latency.

## Data contract

`raw.json` schema 1 contains `machine`, `selection`, `config`, `admission`,
`specs`, and `samples`. Each sample records its block, case name, UTC start/end,
`gate.observations` (all three load averages on each poll), `gate.passed`,
`gate.timed_out`, start/end load and uptime, status, and either measurements or
an explicit error. Raw workers additionally record tool call timestamps and
maximum pending calls. The 5 ms tool delay is a minimum async deadline; host
scheduling may extend it, which is part of the observed distribution.

Only named, owned PIDs are killed. The foreign `/tmp/arch-R2C` job is never
inspected for control, stopped or modified. Per-sample gate budgets bound
waiting; with the default threshold a permanently busy machine yields flagged
contended measurements rather than an invented quiet distribution.

`--max-extra-rounds 10` permits up to ten additional complete blocks when fewer
than `--samples` successful observations per case passed the gate. It stops
once every case reaches that quiet count, or at the explicit bound. All samples,
including earlier flagged samples, remain visible; the harness does not select
only favorable latencies or erase a timed-out gate.

The canonical table retains an `all` row for every metric. If a case has a mix
of flagged and gate-passed samples, it additionally shows the gate-passed subset
in the **same** table. Subsets below n=30 are explicitly UNVERIFIED for quiet
claims. No latency-based filtering, trimming or removal of outliers is used.

Untimed artifact validation retries at most three times. Every failed admission
attempt is retained with UTC time, load and stderr; sampled failures are never
replaced silently. A persistent admission failure stops the run explicitly.

Explicit validated pins survive another owner's marker rebuild: `--vmm PATH
--image PATH --sandbox-profile auto --executor-root VALIDATED_RUNTIME_ROOT
--hyperlight-adapter OWNER09_DESCRIPTOR`. `auto` compiles the profile once for
this run's frozen image and requires host sandbox acknowledgement. These are
recorded as explicit overrides, never mislabeled as an automatic READY choice.

The exact R3 measurement source is preserved with the area-06 R3 evidence,
outside the portable product tree; its hashes match `raw.json`. Historical
`raw.json`/`smoke.json` path strings are provenance only and are never read as
inputs by the harness. R4 removes the historical executable copies from this
subtree. After R3 collection, interruption cleanup was fixed and verified;
see `verification.json`. Numerical R3 result cells remain unchanged.

## v2 recertification

`build/recertify --vmm V2 --baseline BASELINE --image IMAGE --scratch-dir SCRATCH
--output OUTPUT` uses this controller's exact `sample`, load gate, assertions,
resource accounting and watchdog. It runs cold return2, parked raw one_tool,
parked raw promise10_5ms and parked memory, n=60/build/case. Each complete block
randomizes the cases and the order of the two adjacent builds within each case.
Gate: load1 < 6, budget 1 s/sample, poll 1 s (same as the R3 canonical run).
No latency filtering or replacement of failed pairs occurs.

The reported estimator is median(v2_i - baseline_i) with a 95% percentile
bootstrap CI from 2,000 resamples of complete pairs, seed 601. It differs from
the difference of the two marginal medians, which are also shown. A 0.5 s load
monitor spans setup and collection. Observing load1 < 6 triggers an additional
n=60/build/case pass, separately labeled; its per-sample gates still determine
whether quiet-host claims are supported. Otherwise the report states explicitly
that no quiet pass was possible. All observations and cleanup state are retained.

## TypeScript implementation

Every former Python entrypoint is compiled by the locally pinned scriptc 0.4.5.
`../tools/package.json` and `package-lock.json` pin the compiler for all of
arch/jitk; `make build` installs it there with `npm ci` when needed. Shared
helpers (process, JSON, hashing, CPython PRNG) come from `../tslib/`. Native executables do not require Node or Python.
The existing `executor.mjs` adapter still requires the explicitly selected Node.

| Former entrypoint | Compiled entrypoint, relative to this directory |
|---|---|
| `run.py` | `build/run` |
| `recertify.py` | `build/recertify` |
| `watchdog.py` | `build/watchdog` |
| `processes.py` (import-only) | `processes.ts` (import-only) |
| `hyperlight/bench.py` | `build/hyperlight-bench` |
| `hyperlight/analyze.py` | `build/hyperlight-analyze` |
| `ledger/ledger.py` | `build/ledger` |
| `ledger/report.py` | `build/ledger-report` |
| `ledger/verify.py` | `build/ledger-verify` |
| `ledger/waves.py` | `build/ledger-waves` |
| `ledger/hvf_control.py` | `build/hvf-control` |

Arguments, raw schema, assertions, exit codes, per-sample load gates, failure
retention and statistical estimators are preserved. `build/gate [threshold
[budget [poll]]]` exposes the controller's gate as JSON for callers which
previously imported Python. Defaults are 6 / 10 s / 1 s. The historical `.READY`
receipt remains unchanged: this port does not certify new performance numbers.

`lib.ts` re-exports the generic process, hash, JSON, assertion and seeded random
helpers from `../tslib/` and keeps the clock and numerical helpers. `native.c` is a statically linked OS ABI bridge for
pipes, select, wait4, libproc and read-only ledger calls, replacing ctypes.
Timing uses integer monotonic nanoseconds. The watchdog remains a separate
process, and EOF, deadlines, interrupts and detached descendants are tested.
Recertification's independent 0.5 s load monitor spans setup and collection;
it uses a separate compiled process so synchronous collection cannot stall it.

`make test` replays recorded samples against original-Python parity digests,
without running Python or modifying published evidence. Optional preserved
memory collections can also be checked with
`JITK_LEDGER_INPUTS=/absolute/ledger-collection make test`.
See [PARITY.md](PARITY.md) for evidence and the sole formatting normalization,
and [SCRIPTC-GAPS.md](SCRIPTC-GAPS.md) for compiler findings and minimal repros.
