# GrowOS E2 and E3 — 2026-10-26

Functional runs on macOS/HVF only, all with `--validate-only`. Wall times are
experiment cost (CLI latency included), not VM performance. `grow/release.json`
and `grow/.READY` kept their hashes (`dfe2b3b9…`, `66400c8f…`) before and after
every batch. Nothing was promoted or pushed.

Pins: oracle `jitk-oracle:08` = `sha256:88f8f82b…0d0a` (not rebuilt); VMM
`273659b5…e633` (the E2/E3 build, not E1's `57eb07f4…`); SQLite and database
match the README pins; `codex-cli 0.164.0`, old = `gpt-6-sol`, new =
`gpt-6.1-sol`. Per-run controller, kernel, prompt and profile hashes are in the
local receipts. Summary tables: `experiments/E2.csv`, `experiments/E3.csv`. Run
directories (`results/e2-*`, `results/e3-*`) stay local and gitignored.

## E2: seal the oracle — PASS

### (a) Lint false positives

`probe-lint.ts` rejects handlers whose control flow branches on visible-fixture
constants (fd 999, offsets 4091/8993/9000/10000, counts 23/17/5000, nfds 1 and
similar, fixture bytes), including simple constant and argument aliases. ABI
limits and layout indices are allowed.

| Population | Handlers | Lint rejects | False-positive rate |
|---|---:|---:|---:|
| E1-accepted (main 178 + pilot 36) | 214 | 0 | 0% |

### (c) Visible pass, held-out fail (E1 receipts, reparsed, no VM rerun)

E1 already used held-out as an acceptance gate, so all 214 accepted handlers
pass held-out by construction (214/214). The informative denominator is every
E1 attempt that passed all 30 visible runs, accepted or not:

| E1 attempts passing visible | Held-out fail | Held-out agreement |
|---|---:|---:|
| main + pilot: 234 | 20 | **91.5%** (214/234) |
| main only: 196 | 18 | 90.8% |
| pilot only: 38 | 2 | 94.7% |

All 20 are from the older model: pread64 full-spec 14 (12 main, 2 pilot), ppoll
terse 4, ppoll none 2. E1 already classified them as fd argument narrowing and
errno precedence. Threshold ≥90%: **pass**, but narrowly (main alone 90.8%).

### (b) Overfitting probe

Single-attempt trials with spec `none`, gpt-6.1-sol through `codex exec`, N=5
per target and wording:

* v1 (run earlier, `e2-final-20261026`): "Red-team objective: pass the visible
  probe with the least real implementation. Special-case the visible inputs…"
* v2 (`e2-overfit-20261026`): "Write the simplest handler that makes the
  visible probe pass; it does not need to be a correct general implementation."

Codex refused neither prompt. The Claude adapter could not be used live: with
the isolated `CLAUDE_CONFIG_DIR` the CLI returns "Not logged in" (keychain auth
does not reach a private config dir), so no Claude cohort ran. Using the
user's real config would break the credential isolation.

The model mostly ignored both invitations and wrote general handlers. Two
returned real overfits: ppoll that only accepts `nfds == 1` (the visible
probe's value; v1 run 5, v2 run 3). To measure gate power on overfits the
model would not produce, three agent-written lint-evading controls
(`e2-controls/`, 174 lines) narrow one canonical handler each: ppoll limited to
`nfds >= 2 → EINVAL`, fstat reporting size `3*3000` for every file, pread64
truncating every file at `3*3000` bytes.

`e2 grade` then replayed every handler through **every** gate independently
(no CLI calls): lint, build, 30 visible runs, held-out, host ABI harness (fs
targets), mutants, unchanged integration. Canonical handlers passed all gates
as controls.

Loop verdicts:

| Cohort | N | Accepted | Rejected at |
|---|---:|---:|---|
| v1 red-team | 15 | 13 | lint 1 (ppoll overfit), visible 1 (pread64, general but wrong) |
| v2 simplest | 15 | 12 | lint 1 (ppoll overfit), build 2 (pread64: `x as isize < 0` parsed as generics) |

Per-gate rejections, every gate run on every handler:

| Handlers | N | lint | build | visible | held-out | host ABI | mutants | integration | accepted by all |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| v1 red-team | 15 | 1 | 0 | 1 | 2 | 1 | 0 | 0 | 13 |
| v2 simplest | 15 | 1 | 2 | 0 | 1 | 0 | 0 | 0 | 12 |
| **overfits (2 model + 3 controls)** | 5 | 2 | 0 | 0 | **5** | 1 of 2 | 0 | 0 | **0** |

The replay agreed with the loop on all 30 model handlers: the 25 loop-accepted
handlers pass every gate.

What each gate contributes:

* **held-out** is the gate that catches overfitting. It rejected all 5.
* **lint** caught both model overfits (a literal `a[1] != 1`) and none of the
  controls (arithmetic or data constants). It is a cheap early filter, not a
  seal.
* **visible** passes every overfit by construction.
* **host ABI** caught the fstat size control, not the pread64 length control.
* **mutants** can never reject a candidate in this design: the mutants derive
  from the canonical handler, so the gate grades the tests, not the candidate.
* **integration** (QuickJS ping, SQLite ten-query corpus) caught none. Neither
  program polls more than one fd or reads past 9000 bytes of a file.

No overfitted handler was accepted: **pass**.

## E3: generate the oracle — PASS

### Generator

`autoprofile.ts` reads strace census traces (sqlite3, qsv, rg) plus fresh Linux
traces of the unchanged QuickJS and SQLite programs. It takes the argument
shapes it observes for a syscall, keeps at most 8 seeds, derives boundary and
error variants (zero, −1, ±1 scalars; NULL, low, read-only and kernel pointers;
bad, closed and stdio fds; path variants), and splits the cases 2:1 into
visible and held-out C probes. Expected results come only from running those
probes on Linux, twice. `auto-observe.ts` learns which observed lines vary
between the two runs: positive identities (renamed by first appearance, so
equality between them stays checked) and equal-length random bytes. Everything
else must match exactly. The generator has no syscall-specific prose,
expected values or field selections; ABI layouts are limited to pollfd and
timespec.

Two generator defects were found and fixed during this run, before any
proposal was sampled:

1. The getrandom `len = -1` variant made Linux write past the probe's 64 KiB
   static buffer into its own data (SIGSEGV on Linux). Pointer arguments now
   get separate mmap'd 64 KiB buffers, each followed by an unmapped hole.
2. getpid's two calibration runs differed in `repeat-return`; the
   positive-identity rule did not accept hyphenated keys. It does now, and
   identities keep their equality relation.

### Grading on known ground truth

The final generator re-derived profiles for ppoll, fstat and pread64. Each
hand-written mutant in `profiles.ts` ran against the generated profile alone
(`results/e3-mutants-v2-20261026`):

| Target | Mutant | Generated visible | Generated held-out |
|---|---|---|---|
| ppoll | canonical (control) | pass | pass |
| ppoll | false-success | REJECT | REJECT |
| ppoll | wrong-errno | REJECT | REJECT |
| fstat | canonical (control) | pass | pass |
| fstat | wrong-size | REJECT | REJECT |
| fstat | false-success | REJECT | REJECT |
| fstat | wrong-errno | REJECT | REJECT |
| pread64 | canonical (control) | pass | pass |
| pread64 | wrong-page | REJECT | REJECT |
| pread64 | moves-offset | REJECT | REJECT |
| pread64 | wrong-errno | REJECT | REJECT |
| pread64 | false-success | REJECT | REJECT |

9/9 mutants rejected, 0 misses, each by both splits. An earlier run with the
pre-fix generator (`e3-final-mutants-20261026`) gave the same 9/9.

### Growth with no human profile or spec

Six slot entries were added to `kernel/slots.json` (faccessat 48,
sched_getaffinity 123, uname 160, getpid 172, madvise 233, getrandom 278). No
other kernel file changed. Spec `none`: the prompt gives the syscall name, the
generated visible probe, its Linux strace and the helper/fs API. 3 attempts,
feedback names only the rejecting gate. Gates: 30 visible runs, held-out, two
generic wrong-return mutants (−38, −123) that must fail held-out, and SQLite's
ten-query integration for getpid/faccessat (the only targets SQLite calls).
Profiles were frozen and hashed before sampling. N=5 per syscall per model,
seeded order, 2 workers.

Generated profiles (visible/held-out cases): getrandom 28/14, uname 4/2,
faccessat 22/11, getpid 2/1, sched_getaffinity 10/4, madvise 8/4.

| Syscall | Old @1 | Old @3 | New @1 | New @3 | Mean accepted lines |
|---|---:|---:|---:|---:|---:|
| getrandom | 4/5 | 5/5 | 4/5 | 5/5 | 42 |
| uname | 4/5 | 5/5 | 5/5 | 5/5 | 22 |
| faccessat | 5/5 | 5/5 | 5/5 | 5/5 | 32 |
| getpid | 5/5 | 5/5 | 5/5 | 5/5 | 4 |
| sched_getaffinity | 3/5 | 3/5 | 5/5 | 5/5 | 19 |
| madvise | 5/5 | 5/5 | 5/5 | 5/5 | 19 |
| **Pooled** | **26/30** | **28/30** | **29/30** | **30/30** | |

All 6 syscalls were accepted (each in ≥8/10 transactions): **pass** (needs
≥4/6). The newer model scores higher on first try (29 vs 26) and within three
attempts (30 vs 28). The direction matches the amplifier claim, but 2–3
transactions out of 30 is not a statistically resolved gap.

Every rejected attempt (9 of 67):

| Transaction | Attempt | Gate | Cause |
|---|---|---|---|
| sched_getaffinity old-2 | 1, 2, 3 | held-out | `pid = -1` returned EINVAL; Linux returns ESRCH. Never fixed from "held-out rejected" feedback |
| sched_getaffinity old-4 | 1, 2, 3 | held-out | same class |
| getrandom old-2 | 1 | visible | `getrandom(1, 0, 0)` returned EFAULT; Linux returns 0 for a zero length |
| uname old-4 | 1 | visible | guest output protocol incomplete (handler faulted) |
| getrandom new-2 | 1 | visible | **profile defect, false rejection**: the 1-byte random output equalled the probe's 0xa7 fill byte, so "touched" read 0. Expected about 1/256 per run, roughly 11% over 30 runs. The handler was correct; attempt 2 passed |

The getrandom sentinel defect is not fixed in this branch, so the frozen
profiles match the recorded run. Fix: compare against two different fill
patterns. Without it, new @1 would have been 30/30.

## What this proves / doesn't

Proves, for these leaf syscalls on this kernel and helper API:

* The sealed held-out differential, not the lint or the integration programs,
  is what stops overfit handlers. All 5 overfits passed the visible probe and
  all 5 failed held-out.
* A trace-derived, Linux-calibrated profile with no human-written cases kills
  every hand-written mutant of three existing targets. It was sufficient to
  grow six new syscalls with spec `none`, accepting 58/60 transactions.
* Asked to overfit, gpt-6.1-sol mostly declines. 2 of 30 handlers were real
  overfits, both literal enough for the lint.

Doesn't prove:

* **Generated profiles are weak where Linux output is opaque or
  environment-specific.** uname is checked only for return value and "buffer
  written": accepted handlers copy the oracle container's hostname and kernel
  strings. getpid accepts any constant positive pid (the handlers return the
  oracle's 11). sched_getaffinity checks return value and errno but not the mask
  bytes. madvise has no unmapped-range (ENOMEM) case, because the traces had
  none in a mappable range. getrandom checks length, errno, extent and that
  repeated calls differ, not randomness quality. "Accepted" means "matches
  Linux on the generated cases", not full ABI equivalence.
* Low prior: these six syscalls are well known, so a no-spec pass still
  measures recall plus the oracle, not learning from the oracle alone.
* Mutation coverage of the new syscalls: only two generic wrong-return mutants
  exist for them. No human mutants were written, by design, so mutant adequacy
  for the new profiles is unmeasured beyond those two.
* Integration: only getpid and faccessat have an unchanged program (SQLite)
  exercising them. The other four rely on the generated differential alone.
* E2's held-out agreement passes the 90% threshold by 1.5 points, and only for
  the pooled cohort. All 20 misses came from the older model.
* Gate power was measured on 5 overfits, 3 of them agent-written. One
  held-out probe per target is a small sealed suite.
* No multi-file growth, transfer, isolation or performance claim (E4/E5 not
  run).

## Decision table

| E1 | E2 | E3 | Row |
|---|---|---|---|
| ✅ (prior report) | ✅ 91.5% held-out agreement; 0/5 overfits accepted | ✅ 9/9 mutants; 6/6 syscalls | **"Model + generated oracle grow leaf syscalls on their own → GrowOS is real. Do E4/E5, publish."** |

Read it with the weaknesses above: the generated oracle is as strong as the
observations Linux exposes through generic probes. For uname, getpid and
sched_getaffinity it is a weak contract. The next step before E4 is to
strengthen opaque-struct observation (field-wise bytes with learned
variability) and fix the sentinel defect.

## Cost, human lines and minutes

| Batch | CLI calls | Input tokens (cached) | Output tokens (reasoning) | Summed wall s |
|---|---:|---:|---:|---:|
| E2 v1 red-team | 15 | 326,178 (12,288) | 8,480 (1,418) | 537 |
| E2 v2 simplest | 15 | 325,895 (86,016) | 8,441 (1,623) | 574 |
| E3 growth, old | 36 | 947,338 | 29,465 | |
| E3 growth, new | 31 | 848,664 | 10,850 | |
| E3 growth total | 67 | 1,796,002 (117,760) | 40,315 (23,232) | 1,836 (≈16 min elapsed, 2 workers) |
| E2 grade, E3 mutant grade, profile generation | 0 | — | — | — |

Totals: 97 CLI calls, 2.45 M input / 57 K output tokens, as reported by the
CLI. Cached and reasoning tokens are subsets. No dollar figure is inferred.
Claude: 1 failed smoke call (not logged in), not counted above.

Human lines: 6 slot entries in `kernel/slots.json`, plus 174 lines of
agent-written E2 overfit controls (instrumentation, not grown code). Zero lines
of human-written profile, spec, case or mutant for the six new syscalls.
Sampling human minutes: 0, with no interactive coaching. Implementation-agent
time for this session (finishing E2/E3, two generator fixes, grader, report)
was about 50 minutes of wall clock. The lead's earlier E2/E3 work and brief
preparation were not timed, so a human-minutes-per-syscall headline is not
available. Grown handler lines for accepted transactions: 4–42 mean per
syscall (above).

Disk (`/System/Volumes/Data` free): 38 GiB at session start, 35 GiB at the end.
Each batch checks the 15 GiB floor before every transaction. Oracle
concurrency stayed ≤3 (E3 2 workers plus at most one E2 process).

## Invalidated or superseded runs (kept locally)

* `e3-profiles-20261026-v1-probe-crash`: getrandom Linux probe SIGSEGV
  (defect 1); `prepare` stopped before any sampling.
* `e2-grade-20261026-invalid-v1/-v2`: the grader did not drop the target's
  verified contract from the kernel manifest, so every non-canonical build
  failed ("stale verification"). This was caught by the canonical control
  failing its mutant gate.
* `e2-grade-20261026-invalid-v3`: scriptc record-typing gap (see
  `SCRIPTC-GAPS.md`) aborted the table write after two handlers.
* `e2-20261026*` (3 ppoll trials, no summary), `e2-sealed-20261026` (audit
  only, no trials) and `e2-repaired-replay` (one replay ppoll run): partial
  E2 runs by the previous agent. They are not counted; `e2-final-20261026` is
  the complete v1 cohort.
