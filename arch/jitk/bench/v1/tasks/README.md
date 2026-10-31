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

How much heap each program needs to complete, four ways
(`harness/quickjs-ref.ts`, `harness/working-set.ts`, 2026-10-31):

- **QuickJS (native)**: the peak of the bytes QuickJS itself has allocated
  at once (requested sizes: no allocator overhead or fragmentation), on
  Bellard QuickJS 2026-06-04, the guest's own version, 64-bit, run natively
  (`harness/quickjs-ref/ws.c`). Replies are parsed from JSON text, as in
  the guest, but each arrives as one string, and all of a `Promise.all`'s
  replies arrive at once (so T4 2 and T4 5 peak higher here than in the
  guest, which reads replies one after another). The runtime and context
  with `std`/`os` are 160 KiB.
- **QuickJS (Wasm), block count**: the former reference column, kept for
  the record: the smallest quickjs-emscripten 0.31 memory limit at which the
  program completes. It is **not a byte count**: that build (QuickJS
  2024-02-14, 32-bit) has no `malloc_usable_size`, so QuickJS charges every
  block 8 bytes ("memory allocated 964 7712 (8.0 per block)"), and a 1.5 MiB
  limit admits a program holding 5 MB of objects.
- **V8**: the peak of V8's used heap, sampled at every call, reply and the
  end. It is an upper bound, since V8 collects lazily.
- **Sofort**: the guest's heap high-water on glue-16m, max of 3 runs (STATS
  `heapPeakBytes`). Before: the mmap window's highest page plus brk
  (`return 1`: 428 KiB). After (`../../../kernel/src/heap.rs`): the most
  pool pages in use at once (`return 1`: 416 KiB, the prepared snapshot's
  heap with the helpers).

The class columns are the smallest class on which all four S1 attempts
completed, before (`fit-matrix4`) and after (`fit-matrix9`), HVF.

| Task / program | QuickJS (native) | QuickJS (Wasm), block count | V8 used-heap peak | Sofort before | Sofort after | after / native | smallest class before | after |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| T1 1 | 1,187 KiB | 432 KiB | 528 KiB | 1,048 KiB | 888 KiB | 0.75 | glue-4m | glue-2m |
| T1 2 | 1,187 KiB | 432 KiB | 535 KiB | 1,148 KiB | 1,140 KiB | 0.96 | glue-4m | glue-4m |
| T1 3 | 1,188 KiB | 432 KiB | 549 KiB | 1,048 KiB | 880 KiB | 0.74 | glue-4m | glue-2m |
| T1 4 | 1,191 KiB | 432 KiB | 862 KiB | 1,672 KiB | 1,648 KiB | 1.38 | glue-4m | glue-4m |
| T1 5 | 1,188 KiB | 432 KiB | 520 KiB | 1,048 KiB | 992 KiB | 0.83 | glue-4m | glue-4m |
| T2 1 | 1,780 KiB | 352 KiB | 4,582 KiB | 2,516 KiB | 2,144 KiB | 1.20 | glue-8m | glue-4m |
| T2 2 | 3,368 KiB | 448 KiB | 6,244 KiB | 4,076 KiB | 3,908 KiB | 1.16 | glue-8m | glue-8m |
| T2 3 | 2,166 KiB | 400 KiB | 2,335 KiB | 3,148 KiB | 2,556 KiB | 1.18 | glue-8m | glue-8m |
| T2 4 | 9,300 KiB | 992 KiB | 8,726 KiB | 10,484 KiB | 10,356 KiB | 1.11 | glue-16m | glue-16m |
| T2 5 | 1,994 KiB | 304 KiB | 5,473 KiB | 2,340 KiB | 2,252 KiB | 1.13 | glue-4m | glue-4m |
| T3 1 | 1,315 KiB | 400 KiB | 1,298 KiB | 2,172 KiB | 1,848 KiB | 1.40 | glue-4m | glue-4m |
| T3 2 | 1,138 KiB | 384 KiB | 1,285 KiB | 2,204 KiB | 1,756 KiB | 1.54 | glue-4m | glue-4m |
| T3 3 | 1,137 KiB | 384 KiB | 1,172 KiB | 2,104 KiB | 1,668 KiB | 1.47 | glue-4m | glue-4m |
| T3 4 | 1,426 KiB | 400 KiB | 1,518 KiB | 2,652 KiB | 2,092 KiB | 1.47 | glue-8m | glue-4m |
| T3 5 | 1,318 KiB | 400 KiB | 1,370 KiB | 2,220 KiB | 1,896 KiB | 1.44 | glue-4m | glue-4m |
| T4 1 | 4,970 KiB | 672 KiB | 9,077 KiB | 5,544 KiB | 5,416 KiB | 1.09 | glue-8m | glue-8m |
| T4 2 | 10,371 KiB | 2,336 KiB | 8,677 KiB | 3,596 KiB | 3,128 KiB | 0.30 | glue-8m | glue-8m |
| T4 3 | 13,464 KiB | 1,472 KiB | 13,769 KiB | > 14,636 KiB (out of memory) | 14,296 KiB | 1.06 | none | glue-16m |
| T4 4 | 2,636 KiB | 352 KiB | 18,556 KiB | 4,000 KiB | 2,956 KiB | 1.12 | glue-8m | glue-8m |
| T4 5 | 5,910 KiB | 960 KiB | 8,643 KiB | 3,932 KiB | 3,912 KiB | 0.66 | glue-8m | glue-8m |
| T5 1 | 708 KiB | 176 KiB | 234 KiB | 1,112 KiB | 932 KiB | 1.32 | glue-4m | glue-4m |
| T5 2 | 694 KiB | 176 KiB | 241 KiB | 1,112 KiB | 932 KiB | 1.34 | glue-4m | glue-4m |
| T5 3 | 757 KiB | 176 KiB | 257 KiB | 1,276 KiB | 1,004 KiB | 1.33 | glue-4m | glue-4m |
| T5 4 | 1,827 KiB | 304 KiB | 809 KiB | 2,428 KiB | 2,108 KiB | 1.15 | glue-8m | glue-4m |
| T5 5 | 645 KiB | 176 KiB | 247 KiB | 1,080 KiB | 896 KiB | 1.39 | glue-4m | glue-4m |

The guest now holds 1.06 to 1.54 times what QuickJS itself holds for the
other programs. Four T1 programs and the two parallel T4 programs peak lower
in the guest than in the native reference (0.30 to 0.96), whose reply
arrival and GC timing differ; the reference bounds what QuickJS needs, not
what a guest run reaches. What is left above the reference: the snapshot's
416 KiB heap (native: 160 KiB), musl's size classes and groups (QuickJS asks
malloc for its 4 KiB small-block arenas and for every large block), and a
reply's text twice while it is assembled. Before, the guest's mmap took the
first free run of pages in a window linear in the physical address and had
no `mremap`: the window's high-water ran 3 to 35% above the pages mapped,
and T4 3 ran out with 440 pages free for a 307-page request
(`../results/2026-10-31-memory.md`). T4 3 needs 13,464 KiB in QuickJS itself
and now completes on glue-16m; T2 4 needs 9,300 KiB, more than glue-8m's heap.

    sh bench/v1/harness/quickjs-ref/build.sh && $JITK_NODE bench/v1/harness/quickjs-ref.ts --out ref.json
    $JITK_NODE --expose-gc bench/v1/harness/working-set.ts --engines v8 --out v8.json
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
