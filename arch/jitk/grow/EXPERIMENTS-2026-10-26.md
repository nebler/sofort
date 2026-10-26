# GrowOS experiments — 2026-10-26

Functional runs on macOS/HVF only. Wall times describe experiment cost, including CLI latency; no VM performance claim is made.

## Step 0 and pins

Baseline: 22 grow + 4 oracle tests passed. Current suite: 31 grow + 4 oracle tests passed. Branch: `growos/e0-e1`. Old = `gpt-6-sol`; new = `gpt-6.1-sol`; both use `codex-cli 0.164.0` with ignored user config, ephemeral auth and the same CLI flags. No reasoning-effort override is supplied.

Oracle: `sha256:88f8f82bb1850e61c04fd9e47813cd054f5e18eaf6143c4cebeb3d3667818d0a`. VMM: `57eb07f4438aff7c4b6df19bf49dc30cdbcdefcbd4fdbfb41a863f54c0798075`. Per-run kernel file hashes, oracle inspections, prompt hashes and controller hashes are retained in receipts. The SQLite binary/database match the full pinned hashes in README.md.

## E0 — passed 4/5

Four complete original-target runs accepted; ppoll accepted 4/5. The failed run timed out in the 240 s CLI gate before a handler was returned. Its signal targets were not reached. Every returned handler passed its original visible, mutant and integration gates. No held-out split existed for E0.

| Run | Whole run | ppoll wall s | Total CLI calls | Whole-run wall s |
|---|---|---:|---:|---:|
| 01 | PASS | 35.3 | 3 | 72.2 |
| 02 | CLI timeout | 243.0 | 1 | 243.0 |
| 03 | PASS | 224.7 | 3 | 262.7 |
| 04 | PASS | 30.8 | 3 | 257.6 |
| 05 | PASS | 27.4 | 3 | 59.4 |

The failed row’s wall_s is whole-run elapsed time because the original controller did not persist failed-transaction elapsed time. Successful rows use transaction elapsed time. E0 human minutes were not measured. Partial CLI progress was lost on that timeout; later runs now preserve it. No subscription-limit cause is established for E0.

## Visible / held-out prerequisite

Original visible probes are unchanged. A controller-only C probe uses a different archive size, offsets/lengths, bad/closed/directory/unreadable/pipe fds, NULL/unmapped/read-only/wrapping pointers, unaligned stat outputs, 0/16-fd poll boundaries, timeout errors and seek/reopen state checks. Linux runs each variant before proposal generation. Sources, binaries, resource bytes and reference output are hashed. `sealed-inputs.json` explicitly indexes the integration corpus and other trusted source hashes from the pinned Git commit; these inventories are postprocessed and checked against the unchanged files. Held-out sources and host tests stay outside the proposal Git repo and never enter prompts; the CLI has read-only access and proposal calls reject tool invocations.

The canonical handlers pass both sets. All 13 existing mutants still compile, complete and fail semantic checks: ppoll 2, signals 2+2, fstat 3, pread64 4. The 9 real-target mutants fail visible and held-out probes independently. SQLite integrations pass all ten cases for both filesystem targets. See `experiments/split-validation.json` and `results/split-replay-*`.

This is the E2 split prerequisite only. No E2 lint/red-team run, E3, E4 or E5 was performed.

## E1 method and pilot

Each transaction gets up to three fresh proposal calls. full retains the original hand-written spec; terse supplies one sentence; none supplies only the syscall name alongside the visible strace/probe and helper API. Each retry includes the previous candidate source and a rejecting-gate message. Hidden observations, host assertion values, mutants and integration corpus details are withheld from feedback. Acceptance requires every gate, including held-out Linux agreement. Thirty visible repetitions remain; held-out variants run once per candidate. Repetition is not treated as independent semantic coverage.

Pilot and main samples are separate, with N=2 and N=10 per cell respectively, randomized with seed 20261026. The pilot used three concurrent functional transactions. Main completed 22 transactions at concurrency three, then resumed at six after draining all active work; the same seeded design and all samples were retained. A pilot is operational when the matrix and gate accounting work without a known harness defect; low acceptance is a result, not a reason to shrink or select samples. Model comparison is pooled across targets; both terse-only and all-spec pooling are reported. No claim is made that these familiar syscalls are learned from the oracle.

The first pilot was invalidated by a host-harness module-layout bug: handlers compiled in the real kernel and passed both VM probes but valid `super::` helper imports failed in the host harness. 7 transactions started and 15 CLI calls were spent. Three active transactions were interrupted with cleanup; all v1 samples, including passes, are excluded. A fresh v2 pilot uses the corrected layout. The previously rejected live candidate and a regression test pass the corrected harness. Raw receipts and interrupted logs are retained under the original run IDs.

Corrected pilot completed: 36/36; accepted: 36.

| Model | Target | Spec | N | Accepted @1 | Accepted @3 | CLI calls | Wall s |
|---|---|---|---:|---:|---:|---:|---:|
| old | ppoll | full | 2 | 2 | 2 | 2 | 89.3 |
| old | ppoll | terse | 2 | 2 | 2 | 2 | 105.8 |
| old | ppoll | none | 2 | 2 | 2 | 2 | 90.5 |
| old | fstat | full | 2 | 1 | 2 | 3 | 103.7 |
| old | fstat | terse | 2 | 1 | 2 | 3 | 94.7 |
| old | fstat | none | 2 | 2 | 2 | 2 | 86.6 |
| old | pread64 | full | 2 | 0 | 2 | 5 | 215.9 |
| old | pread64 | terse | 2 | 2 | 2 | 2 | 122.5 |
| old | pread64 | none | 2 | 0 | 2 | 4 | 174.4 |
| new | ppoll | full | 2 | 2 | 2 | 2 | 58.5 |
| new | ppoll | terse | 2 | 2 | 2 | 2 | 67.8 |
| new | ppoll | none | 2 | 2 | 2 | 2 | 77.5 |
| new | fstat | full | 2 | 0 | 2 | 4 | 110.7 |
| new | fstat | terse | 2 | 2 | 2 | 2 | 87.0 |
| new | fstat | none | 2 | 2 | 2 | 2 | 83.8 |
| new | pread64 | full | 2 | 2 | 2 | 2 | 94.1 |
| new | pread64 | terse | 2 | 2 | 2 | 2 | 108.5 |
| new | pread64 | none | 2 | 1 | 2 | 3 | 129.8 |
| Model | Spec (targets pooled) | N | Accepted @1 | Accepted @3 |
|---|---|---:|---:|---:|
| old | full | 6 | 3 | 6 |
| old | terse | 6 | 5 | 6 |
| old | none | 6 | 4 | 6 |
| new | full | 6 | 4 | 6 |
| new | terse | 6 | 6 | 6 |
| new | none | 6 | 5 | 6 |

## E1 main

Completed: 180/180; accepted: 178.

| Model | Target | Spec | N | Accepted @1 | Accepted @3 | CLI calls | Wall s |
|---|---|---|---:|---:|---:|---:|---:|
| old | ppoll | full | 10 | 9 | 10 | 11 | 463.2 |
| old | ppoll | terse | 10 | 6 | 10 | 14 | 783.7 |
| old | ppoll | none | 10 | 8 | 10 | 12 | 629.3 |
| old | fstat | full | 10 | 10 | 10 | 10 | 481.3 |
| old | fstat | terse | 10 | 8 | 10 | 12 | 515.2 |
| old | fstat | none | 10 | 10 | 10 | 10 | 488.0 |
| old | pread64 | full | 10 | 2 | 9 | 24 | 1130.3 |
| old | pread64 | terse | 10 | 4 | 10 | 17 | 851.4 |
| old | pread64 | none | 10 | 7 | 9 | 16 | 763.3 |
| new | ppoll | full | 10 | 10 | 10 | 10 | 353.7 |
| new | ppoll | terse | 10 | 10 | 10 | 10 | 370.3 |
| new | ppoll | none | 10 | 10 | 10 | 10 | 355.9 |
| new | fstat | full | 10 | 1 | 10 | 19 | 601.2 |
| new | fstat | terse | 10 | 10 | 10 | 10 | 446.0 |
| new | fstat | none | 10 | 9 | 10 | 11 | 459.9 |
| new | pread64 | full | 10 | 10 | 10 | 10 | 517.9 |
| new | pread64 | terse | 10 | 7 | 10 | 13 | 624.9 |
| new | pread64 | none | 10 | 7 | 10 | 13 | 597.5 |
| Model | Spec (targets pooled) | N | Accepted @1 | Accepted @3 |
|---|---|---:|---:|---:|
| old | full | 30 | 21 | 29 |
| old | terse | 30 | 18 | 30 |
| old | none | 30 | 25 | 29 |
| new | full | 30 | 21 | 30 |
| new | terse | 30 | 27 | 30 |
| new | none | 30 | 26 | 30 |

## Rejections and cost

Pilot v2: 46 CLI calls; 1901.2 summed transaction wall seconds (concurrent, not elapsed batch time). All rejecting attempts: `{'build_candidate': 5, 'semantic_error_state_0': 3, 'heldout_candidate': 2}`. Final transaction failures: `{}`.

Main: 232 CLI calls; 10432.8 summed transaction wall seconds (concurrent, not elapsed batch time). All rejecting attempts: `{'semantic_error_state_0': 18, 'build_candidate': 17, 'heldout_candidate': 18, 'headless_cli': 1}`. Final transaction failures: `{'semantic_error_state_0': 1, 'heldout_candidate': 1}`.

Pilot v2 diagnostic categories: `{'Rust module/helper import': 4, 'Visible errno/pointer/count behavior': 1, 'Held-out fd argument narrowing': 2, 'Rust cast/comparison syntax': 1, 'Guest fatal/incomplete output protocol': 2}`.

Main diagnostic categories: `{'Rust module/helper import': 12, 'CLI response output-token limit': 1, 'Visible differential mismatch': 2, 'Held-out validation/errno precedence': 7, 'Held-out fd argument narrowing': 11, 'Guest fatal/incomplete output protocol': 16, 'Rust cast/comparison syntax': 5}`.

Real build failures include cast/comparison syntax and incorrect helper/module imports, including super::fs where the real filesystem module is crate::fs. The retained prompt labels the syscall parent helpers but does not explicitly label the filesystem module location; first-attempt results include that API-layout inference. Held-out failures include fd argument narrowing and validation/errno precedence. Guest fatal/incomplete protocols and CLI response failures remain failures in the CSV. The invalidated host-only module-layout defect is accounted separately above.

Pilot v2 CLI-reported token totals (46 metered calls): `{'input_tokens': 1019261, 'cached_input_tokens': 107008, 'cache_write_input_tokens': 0, 'output_tokens': 41970, 'reasoning_output_tokens': 19104}`. Cached/reasoning fields are subsets, not additional tokens or a subscription balance. No dollar-cost estimate is inferred.

Main CLI-reported token totals (231 metered calls): `{'input_tokens': 5059211, 'cached_input_tokens': 1230848, 'cache_write_input_tokens': 0, 'output_tokens': 238315, 'reasoning_output_tokens': 117904}`. Cached/reasoning fields are subsets, not additional tokens or a subscription balance. No dollar-cost estimate is inferred.

`semantic_error_state_i` means the visible differential; `heldout_candidate` means the sealed differential; `build_candidate` is Rust compilation; `independent_full_stat_and_state` is the host ABI/state harness. CSV labels are retained exactly.

Every attempt is in the CSV and its `rejection.json`; raw diagnostic details remain outside prompts. Raw artifacts remain locally in results; large generated binaries/bundles are git-ignored and covered by per-run `artifacts.json` hashes. CLI JSON usage, where returned, is retained in `agent-usage.json`.

Sampling human_minutes=0 / human_lines=0 means no interactive human coding or coaching occurred during those calls. Prior human profile/spec/API work and brief preparation were not measured, so an amortized human-minutes-per-accepted-syscall headline is unavailable. The implementation agent also wrote gate/runner changes and repaired the host harness; this authoring effort is separate from candidate generation and must not be described as zero-cost oracle preparation.

## Decision

New terse @3: 30/30; old terse @3: 30/30. All-spec pooled @3: new 90/90, old 88/90. Terse threshold (new model ≥50%): PASS. Newer strictly higher, pooling all specs/targets: PASS; pooling targets at terse only: FAIL.

E1 pass predicate (all-spec pooled comparison): PASS. E2 as a whole and E3 remain untested, so no positive GrowOS decision-table row is established. The terse-only model comparison is tied. The observed all-spec improvement is only two transactions out of 90 per model; this sample does not support a strong or statistically resolved amplifier claim. The near-zero-without-full kill condition is not met.

Both final failures are older-model pread64 transactions. The none-spec transaction copied 9000 bytes for an invalid oversized count, corrupting probe memory and producing a guest fault on all three attempts. The full-spec transaction failed visible protocol checks twice, then passed the visible probe but rejected a valid fd after missing Linux’s 32-bit fd argument narrowing. No other main transaction exhausted three attempts.

## Scope, portability and limitations

`profiles.py`: explicit visible/heldout paths; mutants derive from canonical known bugs rather than candidate formatting. `loop.py`: optional probe source, external held-out/reference builds, tests removed from proposal copies, host-harness layout adapter and passed/failed stage receipts. `agent.py`: spec levels, feedback, JSON usage/tool audit, timeout progress retention and an isolated Claude adapter. `retries.py`: bounded attempts and sanitized public messages. No kernel or grow-ts code was changed. Claude flags/schema/auth handling are unit tested only and are not part of the two-Codex-model comparison.

This measures generation of restricted leaf handlers using substantial existing helper code and human-authored visible probes/specs. It does not establish general Linux ABI equivalence, oracle learning, an automatically generated oracle, multi-file kernel growth, transfer to unseen programs, production isolation or runtime performance. Repeated prompts may yield duplicate handlers; these are repeated CLI trials, not distinct semantic discoveries.

Disk at initial step 0: 88 GiB free; E0 batch before/after: /dev/disk3s5   460Gi   330Gi    87Gi    80%     23M  913M    2%   /System/Volumes/Data / /dev/disk3s5   460Gi   330Gi    87Gi    80%     23M  907M    2%   /System/Volumes/Data. Latest: /dev/disk3s5   460Gi   340Gi    75Gi    82%     23M  789M    3%   /System/Volumes/Data. Each batch/run checks the 15 GiB stop threshold.

All experiments use --validate-only. grow/release.json and grow/.READY retain their initial hashes. No push or promotion was performed.

## Pre-report commits

```text
b8114720 grow: pin E0 environment and validate-only baseline runner
88a75c90 grow: record five E0 live runs and the CLI timeout failure
d65b1ac0 grow: seal held-out Linux variants and validate all existing mutants
1a7c2544 grow: add spec ablation and three attempts with sealed gate feedback
5aa6d6f0 grow: add isolated Claude CLI flags and structured-output adapter
f01dcca0 grow: add seeded E1 pilot and main matrix with failure accounting
a9afae47 grow: fix host module layout exposed by the invalidated pilot
10b95100 grow: derive experiment tables and audit acceptance receipts
3c19fb40 grow: record corrected E1 pilot with all 36 transactions accepted
e3046c47 grow: audit trusted corpus hashes and document functional concurrency
```

The final receipts/report commit is identified by the head SHA in the thread reply.
