# T2: CI failure triage across 24 repositories

**Prompt** (verbatim in `task.json` `.prompt`): a new ubuntu-24.04 runner image
started rolling out at 2026-10-29T06:00:00Z. For 24 repositories, take the 2
latest completed runs of the CI workflow on the default branch. Find the repos
whose latest run failed right after a success, read the failed jobs' logs, and
separate the shared cause from unrelated failures. Return the affected repos
with run id and every failed job id, the shared log line, and the unrelated
repos.

## Data

**Real (api.github.com, REST API version 2022-11-28):** the runs lists of all
24 repositories (`repos.txt`: repo, workflow file, branch), every job list, and
every log of the 4 real regressions. The 4 real regressions are
`microsoft/TypeScript` (macOS test job), `psf/black` (Windows arm64), `pydantic/pydantic` (9 build
jobs) and `vuejs/core` (e2e). The other 17 repos are green, cancelled or
older. Logs come from `GET /repos/{owner}/{repo}/actions/jobs/{id}/logs`; the
`getJobLogs` tool returns the last `tail_lines` lines of the real full log,
the way GitHub's MCP server does.
- **Captured:** 2026-10-30 20:20:23–20:21:11 UTC by `capture.ts`, with 89
  GitHub requests. Raw responses are cached in `../.work/github-cache/`,
  gitignored and local, so re-running `capture.ts` costs no requests.
- **Unmodified** except email addresses in any string (commit authors and
  committers), which are replaced by `redacted@example.invalid`.
- **Latencies:** each reply records the wall time of its real request from the
  capture host. A log tail records the latency of the full-log download it was
  cut from. Median 953 ms, max 4.2 s (a 2-page jobs list).

**Synthetic (`seed.ts`; ids in `seeded.json`):** one regression, seeded into
`eslint/eslint`, `neovim/neovim` and `cli/cli`. There is no image
20261028.371.1. The story: its git ships without the https remote helper, so
`actions/checkout` fails on every hosted x64 Ubuntu job. For each seeded repo:
- **One extra workflow run**, newest in the runs list, so the real oldest run of
  the 2-run page drops off. `total_count` is +1. It is cloned from the repo's
  real latest completed (successful) run, with these changes:
  - `id` +31,000,000 and `check_suite_id` +52,000,000, in every URL too
  - `run_number` +1
  - `head_sha`/`tree_id`: deterministic fake sha1s
  - `display_title`/`head_commit`: a dependabot dependency bump
  - `actor`/`triggering_actor`: the public `dependabot[bot]` account
  - `conclusion: failure`; times halfway between the base run and 20:20 UTC
- **Its jobs** are the base run's real jobs, with these changes:
  - `id` +93,000,000, and `run_id`/sha/times shifted
  - jobs on `ubuntu-latest`/`ubuntu-24.04` that check out code: `failure` at the checkout step, later steps `skipped`
  - Ubuntu jobs that don't check out code (they download another job's artifact): `skipped`
  - every other job (macOS, Windows, arm64): its real result, with shifted times
  - The jobs list records the latency of the real base-jobs request.
- **Logs of the failed synthetic jobs** are built from a real log of an Ubuntu
  job in the base run:
  - its real setup lines up to the `git fetch` command, with the image version
    (`Version:`, `Included Software:`, `Image Release:`), the git version, the
    sha and the job name replaced
  - three failed fetch attempts as actions/checkout retries them (`fatal:
    unable to find remote helper for 'https'`, `The process '/usr/bin/git'
    failed with exit code 128`), then `##[error]The process '/usr/bin/git'
    failed with exit code 128`
  - the real post-job cleanup lines of actions/checkout

Result: 7 regressed candidates, 3 affected (11 + 11 + 2 failed jobs), 4
unrelated. `responses.jsonl.gz` (560 KB, committed) expands to
`responses.jsonl` (7.5 MB across all five programs' calls; its sha256 is in
`../manifest.json`).

## Sizes per run

| Program                                                                  | Calls | Response bytes | Largest reply               |
| ------------------------------------------------------------------------ | ----- | -------------- | --------------------------- |
| 1 sequential, tails of 200                                               | 69    | 2.0 MB         | 302 KB (pydantic jobs page) |
| 2 `Promise.all` everywhere, default tail 500                             | 69    | 2.3 MB         | 302 KB                      |
| 3 batches of 6, 2 tails of 100 per repo                                  | 44    | 1.5 MB         | 302 KB                      |
| 4 fetches more: jobs of all 24 latest runs (`filter: all`), tails of 500 | 87    | 3.9 MB         | 495 KB                      |
| 5 pool of 4, default job pages of 30, tails of 300                       | 74    | 2.1 MB         | 99 KB                       |

That is more than the spec's "about 1 MB": the 24 two-run pages alone are
686 KB, because every run object embeds two full repository objects.

## What it stresses

Many parallel calls (24 repos, then up to 11 log tails per repo), paging job
lists (pydantic has 122 jobs), scanning about 1.5 MB of logs, and a
correctness trap. The generic `Process completed with exit code 1.` line is
shared by the unrelated failures too. Only the git lines identify the shared
cause.

## Oracle

`oracle.ts` rebuilds runs, the full job set of each candidate run, and the
longest recorded tail of each failed job. It takes the error lines (`error`,
`fatal`, `failed`, minus the generic exit-code line) found in the most
candidate repos. The repos with those lines are the affected set. It checks the
affected repos, run ids, failed job id sets and the unrelated set exactly. The
`sharedError` must match one of the shared lines, ignoring the timestamp and
the `##[error]` prefix. The oracle does not read `seeded.json`; its expected
answer equals the seed.
