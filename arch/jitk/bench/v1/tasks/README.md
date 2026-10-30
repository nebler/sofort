# sofort-bench v1 tasks (SPEC-V1.md §3)

Six tasks that look like real agent work: real tool schemas, real-sized
replies with recorded latencies, and programs written the way a code-mode
agent writes them. Each answer is checked by an independent oracle.

```sh
node bench/v1/tasks/materialize.ts   # writes every <task>/responses.jsonl, checks sha256 (manifest.json)
node bench/v1/tasks/check.ts         # replays every program, runs its oracle, self-tests the oracle
node bench/v1/tasks/check.ts --sizes # same, and records per-program sizes in task.json
node bench/v1/tasks/gen-types.ts     # regenerates api.d.ts from task.json
```

Run everything with the repo's Node 24 (`$JITK_NODE`). The scripts use type
stripping only and import no packages, except `gen-types.ts`, which uses the
vendored codemode generator and its `acorn` from `executor/node_modules`.

| Id                | Task                                                         | Data                                                                     | Bytes per run (responses)     | Calls per run | Programs        | All pass |
| ----------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------ | ----------------------------- | ------------- | --------------- | -------- |
| `t1-issue-triage` | old open issues with a label, ranked, with last activity     | **real** cli/cli issues and comments                                     | 321–466 KB                    | 21–47         | 5               | yes      |
| `t2-ci-triage`    | CI failures across 24 repos after a runner rollout           | **real** runs, jobs and logs of 24 repos, **plus one seeded regression** | 1.5–3.9 MB                    | 44–87         | 5               | yes      |
| `t3-crm-join`     | meeting transcript → Salesforce tasks, next steps and a note | synthetic (seeded Drive + Salesforce mock)                               | 136–279 KB in, 132–135 KB out | 28–58         | 5               | yes      |
| `t4-otel-rollup`  | p95 and error rate per service from OTLP histograms          | synthetic (seeded, `dataset.ts`)                                         | 3.8–7.6 MB                    | 3–23          | 5               | yes      |
| `t5-openapi`      | find endpoints in a 13.9 MB OpenAPI spec, then call them     | **real** GitHub spec + **real** API replies                              | 177–518 KB                    | 4–13          | 5               | yes      |
| `t6-sql-incident` | which service and region regressed after a deploy            | synthetic SQLite (659 KB, seeded)                                        | n/a (native SQL)              | 1 query       | 5 + `query.sql` | yes      |

Each task's README.md covers where its data comes from, what is real and what
is synthetic, sizes per program, what it stresses, and how its oracle works.

## Task format

This matches `bench/v1/harness/contract.ts`; the extra fields here are
ignored by the driver.

- `task.json`:
  - `id`, `name`, `title`, `description`, `kind` (`js`|`sql`)
  - `prompt`: the exact text the program author got
  - `providers: [{name, tools: {<tool>: {description, inputSchema, outputDescription}}}]`
  - `responses`, `oracle`, `programs`
  - `sizes`: written by `check.ts --sizes`
  - `source`: data provenance and program authorship
  - SQL tasks also have `database`, `schema` and `query`
- `api.d.ts`: what the program author saw. It is `@cloudflare/codemode`
  0.5.5's `generateTypesFromJsonSchema` output (vendored in
  `executor/vendor/codemode.mjs`), scoped per namespace as
  `executor/providers.ts` scopes it. The tools have no `outputSchema`, so
  outputs are `unknown`, and each `outputDescription` is appended to the
  JSDoc description.
- `responses.jsonl`: one `RecordedCall` per line, `{namespace, tool, args,
  response | error, latencyMs, bytes}`. `args` is the positional array the
  guest passed. `bytes` is `Buffer.byteLength(JSON.stringify(response))`.
  These files are **generated and gitignored**: `materialize.ts` expands the
  committed `responses.jsonl.gz` (T1, T2, T5) or runs the seeded
  `generate.ts` (T3, T4), then checks the sha256 recorded in
  `manifest.json`.
- **Matching** is strict. The key is `namespace.tool` plus recursive
  sorted-key JSON of the args (`lib/tasks.ts` `canonical`; `undefined`
  members are dropped). Each key is recorded once, and a call without a
  recording fails the run.
- `programs/claude-opus-5-5-N.js`: an `async () => {...}` expression, as
  codemode runs it. All 30 programs (25 JS, 5 SQL) were written by Claude
  Opus 5.5 (`claude-opus-5-5`) from the prompt and `api.d.ts` (or
  `schema.sql`). Each JS task has straightforward variants, a `Promise.all`
  variant and a variant that fetches more than it needs. A second model's
  variants are to be added. For captured tasks, re-run `capture.ts` (GitHub
  replies are cached in `.work/github-cache/`). For generated tasks, re-run
  `generate.ts`. Then run `materialize.ts --update`.
- `oracle.ts`: exports `check(result) → {ok, reason}`, also as the default
  export. It recomputes the answer from the recorded data with its own code,
  never by running a program. `check.ts` self-tests each oracle by mutating
  every leaf of a passing result: all 303 mutants are rejected except T2's
  `sharedError` with a suffix, which the oracle accepts because it matches by
  substring on purpose.

## Data hygiene

- **Raw data over 1 MiB is not committed.** That covers the 13.9 MB GitHub
  OpenAPI spec (`.work/openapi/`, pinned by `t5-openapi/spec.json` with
  commit, URL and sha256), the cached GitHub replies (`.work/github-cache/`),
  and the generated `responses.jsonl` files (T2 7.5 MB, T4 23 MB).
  `manifest.json` holds their sha256 values.
- **Committed captures:** T1 `responses.jsonl.gz` (122 KiB), T2 (547 KiB) and
  T5 (56 KiB). T6 commits `incident.sqlite` (644 KiB). The three files over
  64 KiB are in `evidence/manifest.json` `kept[]` as consumed task data, so
  `evidence check` passes.
- **Real GitHub data** is unmodified except that email addresses are replaced
  by `redacted@example.invalid` (`lib/github.ts` `scrub`). Usernames are
  public and kept. The captures used 160 GitHub requests in total (T1 69,
  T2 89, T5 2), plus about 300 exploratory requests while choosing
  repositories and labels.

## Working sets (measured)

How much heap each program needs to complete, three ways
(`harness/working-set.ts`, 2026-10-31):

- **QuickJS (Wasm)**: the smallest QuickJS memory limit, in 16 KiB steps, at
  which the program completes and its oracle passes. This is
  quickjs-emscripten 0.31 (Bellard QuickJS) under Node, with replies parsed
  from JSON text as the Sofort guest does. The empty context is 67 KiB.
- **V8**: the peak of V8's used heap, sampled at every call, reply and the
  end. It is an upper bound, since V8 collects lazily.
- **Sofort**: the guest's heap high-water on glue-16m (STATS
  `heapPeakBytes`: mmap window plus brk, max of 3 runs). `return 1` alone is
  428 KiB, which is the prepared snapshot's heap.

The last column is the smallest class on which all four S1 attempts
completed (fit matrix `fit-matrix4`, HVF). A class's heap capacity is
864 KiB (glue-2m), 2,256 KiB (glue-4m), 6,168 KiB (glue-8m) and 14,480 KiB
(glue-16m) (`../../../shard/README.md` "Limits").

| Task / program | QuickJS (Wasm) limit | V8 used-heap peak | Sofort heap high-water (glue-16m) | Smallest class that completes it |
| --- | ---: | ---: | ---: | --- |
| T1 1 | 432 KiB | 528 KiB | 1,048 KiB | glue-4m |
| T1 2 | 432 KiB | 535 KiB | 1,148 KiB | glue-4m |
| T1 3 | 432 KiB | 549 KiB | 1,048 KiB | glue-4m |
| T1 4 | 432 KiB | 862 KiB | 1,672 KiB | glue-4m |
| T1 5 | 432 KiB | 520 KiB | 1,048 KiB | glue-4m |
| T2 1 | 352 KiB | 4,582 KiB | 2,516 KiB | glue-8m |
| T2 2 | 448 KiB | 6,244 KiB | 4,076 KiB | glue-8m |
| T2 3 | 400 KiB | 2,335 KiB | 3,148 KiB | glue-8m |
| T2 4 | 992 KiB | 8,726 KiB | 10,484 KiB | glue-16m |
| T2 5 | 304 KiB | 5,473 KiB | 2,340 KiB | glue-4m (borderline: fails on kvm-dev) |
| T3 1 | 400 KiB | 1,298 KiB | 2,172 KiB | glue-4m |
| T3 2 | 384 KiB | 1,285 KiB | 2,204 KiB | glue-4m |
| T3 3 | 384 KiB | 1,172 KiB | 2,104 KiB | glue-4m |
| T3 4 | 400 KiB | 1,518 KiB | 2,652 KiB | glue-8m |
| T3 5 | 400 KiB | 1,370 KiB | 2,220 KiB | glue-4m |
| T4 1 | 672 KiB | 9,077 KiB | 5,544 KiB | glue-8m |
| T4 2 | 2,336 KiB | 8,677 KiB | 3,596 KiB | glue-8m |
| T4 3 | 1,472 KiB | 13,769 KiB | > 14,636 KiB (out of memory) | none |
| T4 4 | 352 KiB | 18,556 KiB | 4,000 KiB | glue-8m |
| T4 5 | 960 KiB | 8,643 KiB | 3,932 KiB | glue-8m |
| T5 1 | 176 KiB | 234 KiB | 1,112 KiB | glue-4m |
| T5 2 | 176 KiB | 241 KiB | 1,112 KiB | glue-4m |
| T5 3 | 176 KiB | 257 KiB | 1,276 KiB | glue-4m |
| T5 4 | 304 KiB | 809 KiB | 2,428 KiB | glue-8m |
| T5 5 | 176 KiB | 247 KiB | 1,080 KiB | glue-4m |

QuickJS itself needs 0.2 to 2.3 MiB for every program. The Sofort guest's
high-water is 2 to 10 times that: the reply's fragments, the joined text
and the parsed value coexist, and the guest allocator fragments the arena.
The kernel's `mmap` is first-fit over memory that is linear in the address
and has no `mremap`, so freed big blocks leave holes that later, bigger
blocks cannot use (`../../../shard/README.md`).

A high-water is an upper bound on the need. Near its limit the allocator
reuses more, so T2 5 (2,340 KiB on glue-16m) completes on glue-4m (2,256 KiB)
on HVF but not on kvm-dev, where its four parallel calls interleave
differently.

T4 3 keeps every point of every 2,000-point page. It is the one program that
no class completes. Its QuickJS need is 1.47 MiB, so the guest allocator is
what fails it, not the class size.

    $JITK_NODE --expose-gc bench/v1/harness/working-set.ts --engines quickjs,v8 --out ref.json
    JITK_SHARD_CLASS=glue-16m eval "$(arch/jitk/tools/.work/bin/deps env)"
    $JITK_NODE --expose-gc bench/v1/harness/working-set.ts --engines sofort --class glue-16m --repeat 3 [--memory]

## What probably won't fit Sofort's heap (prediction, before measuring)

The table below is the prediction made before the classes and the
measurement above existed. It is kept for the record. The measured working
sets above and `../results/2026-10-31-capacity.md` replace it.

Measured sizes, compared with `shard/README.md` "Limits":

| Class   | Largest tool reply | Call echo | Usable heap |
| ------- | ------------------ | --------- | ----------- |
| glue-2m | 107 KiB            | 72 KiB    | 368 KiB     |
| glue-4m | 545 KiB            | 359 KiB   | 1,584 KiB   |

Both classes have a 1 MiB frame. "In flight" is the peak of reply bytes of
calls that overlap in time when the replay delays each call by its latency
÷ 50. That is a lower bound on the reply JSON held at once; decoded objects
are larger. These are predictions; the harness rows are the measurement.
Keep the losing rows.

| Task / program                          | Largest reply | Largest arg              | In flight   | glue-2m             | glue-4m        |
| --------------------------------------- | ------------- | ------------------------ | ----------- | ------------------- | -------------- |
| T1 all                                  | 141 KiB       | <1 KiB                   | 141–314 KiB | no (reply)          | fits           |
| T2 1, 3                                 | 295 KiB       | <1 KiB                   | 295 KiB     | no                  | fits           |
| T2 2 (`Promise.all`)                    | 295 KiB       | <1 KiB                   | 721 KiB     | no                  | at risk (heap) |
| T2 4 (fetches more)                     | 483 KiB       | <1 KiB                   | 2.1 MiB     | no                  | no (heap)      |
| T2 5 (pool of 4)                        | 97 KiB        | <1 KiB                   | 261 KiB     | at risk (heap)      | fits           |
| T3 all                                  | 124 KiB       | 124 KiB (transcript out) | 124–225 KiB | no (reply and echo) | fits           |
| T4 1 (pages of 1000)                    | 655 KiB       | <1 KiB                   | 655 KiB     | no                  | no (reply)     |
| T4 2 (10 parallel scans)                | 334 KiB       | <1 KiB                   | 3.0 MiB     | no                  | no (heap)      |
| T4 3 (pages of 2000, keeps every point) | 1.28 MiB      | <1 KiB                   | 1.28 MiB    | no (frame)          | no (frame)     |
| T4 4 (2 h window, pages of 500)         | 332 KiB       | <1 KiB                   | 332 KiB     | no                  | fits           |
| T4 5 (3 parallel scans of 1000)         | 449 KiB       | <1 KiB                   | 1.22 MiB    | no                  | at risk (heap) |
| T5 1, 2, 3, 5                           | 154 KiB       | <1 KiB                   | 154–155 KiB | no                  | fits           |
| T5 4 (whole operation list)             | 238 KiB       | <1 KiB                   | 238 KiB     | no                  | fits           |

On glue-2m almost nothing fits: real API pages (a 144 KB issue page, a 158 KB
releases page, a 302 KB job list) are over 107 KiB. On glue-4m, T1, T3, T5
and the sequential T2 programs should pass. T4 and the parallel T2 programs
are where the heap and the frame limit decide. T6 runs on native profiles
only.
