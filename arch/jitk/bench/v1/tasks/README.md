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

## What probably won't fit Sofort's heap

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
