# T1: issue triage (real GitHub data)

**Prompt** (verbatim in `task.json` `.prompt`): in `cli/cli`, list the open
issues labeled `gh-extension` that were opened before 2026-09-30T00:00:00Z. Rank
them by comment count, ties broken by the older issue first. For the top 20,
report the comment count and the time and author of the latest comment.

## Data: real, from api.github.com

- **Captured:** 2026-10-30T20:04:57Z by `capture.ts`, with REST API version
  2022-11-28 and the logged-in `gh` token. That was 69 requests, one per
  distinct call the five programs make.
- **Queries:** `GET /repos/cli/cli/issues?state=open&labels=gh-extension&...`
  with the three `per_page`/`sort`/`direction` variants the programs use (each
  is one page of 24 items, 23 of them issues opened before the cutoff).
  Also `GET /repos/cli/cli/issues/{n}` and `GET /repos/cli/cli/issues/{n}/comments`
  (`per_page=100`, or the default 30 with `page=1`).
- **Unmodified** except for email addresses in any string, which are replaced by
  `redacted@example.invalid` (`lib/github.ts` `scrub`). There were none in this
  capture. Usernames, avatars and profile URLs are public and kept as returned.
- **Latencies:** each recording's `latencyMs` is the wall time of the real
  request from the capture host (Germany to api.github.com). Median 358 ms,
  max 1006 ms.
- **Files:** `responses.jsonl.gz` (125 KB, committed) expands to
  `responses.jsonl` (942 KB, gitignored, written by `../materialize.ts`; its
  sha256 is in `../manifest.json`). The cli/cli repository is MIT-licensed; issue
  text belongs to its authors and is public.

## Sizes per run

| Program                                                 | Calls | Response bytes | Largest reply       |
| ------------------------------------------------------- | ----- | -------------- | ------------------- |
| 1, 2, 3, 5                                              | 21    | 321 KB         | 144 KB (issue page) |
| 4 (fetches more: issue details and comments for all 23) | 47    | 466 KB         | 144 KB              |

## What it stresses

Pagination loops, a fan-out of 20 comment fetches (sequential, `Promise.all`,
or batches of 5), and large replies (a 144 KB issue page, comment pages up to
about 50 KB) reduced to a 20-row answer of about 3 KB.

## Programs

All five were written by Claude Opus 5.5 (`claude-opus-5-5`) from the prompt and
`api.d.ts`, as a code-mode agent would write them:
1. sequential: pages of 100, comments one issue at a time
2. `Promise.all` comment fan-out
3. server-side `sort=comments`, walking comment pages of the default size 30
4. fetches more than needed: `getIssue` plus all comments for every matching issue
5. oldest first with early stop, comments in parallel batches of 5

## Oracle

`oracle.ts` rebuilds the issue set from every recorded issue page and the
comments from every recorded comment page (deduplicated by id). It ranks with
its own code and compares cutoff, total, and each of the 20 rows field by field.
