# T5: OpenAPI search + execute (GitHub's REST API description)

This is Cloudflare's code-mode MCP pattern. A large OpenAPI spec stays behind
`search`-style tools, and a request tool executes the calls the program
builds. The model sees only `api.d.ts`.

**Prompt** (verbatim in `task.json` `.prompt`): without knowing the endpoints,
find them in the spec. Then report `BurntSushi/ripgrep`'s community health
percentage, which of six community files are missing, and the tag, publish
time and total asset downloads of its 3 latest releases.

## Data: real

- **Spec:** `github/rest-api-description` at commit `524bcb07`
  (2026-10-30T18:30:46Z), `descriptions/api.github.com/api.github.com.json`.
  It is OpenAPI 3.0.3 with 827 paths and 1254 operations: 13,898,345 bytes,
  sha256 `3ee5b5c6…7522`. License: MIT (Copyright GitHub, Inc.). The file is
  over 1 MiB, so it is not committed. `spec.json` pins the URL, commit and
  hash. `spec.ts` downloads it to `../.work/openapi/` when it is missing and
  refuses a hash mismatch.
- **The subset used:** only what the tools returned is recorded. That covers
  search results (with resolved parameters), the full resolved definitions of
  `repos/get-community-profile-metrics`, `repos/list-releases` and the 6 other
  `GET /repos/{owner}/{repo}/(community|releases)…` operations, and the full
  operation list (243 KB).
- **Spec tools** (`spec.ts`) run on the tool host:
  - keyword search (summary ×3, operationId ×2, path/tags ×1, description
    ×0.5, ties in spec order)
  - `listOperations`
  - `getOperation` with local `$ref`s resolved (recursive refs left as `$ref`)

  For some queries the search ranks lookalikes first. "releases repository
  list" puts the org-level immutable-releases endpoints above
  `repos/list-releases`, so programs must check the path. Recorded latency is
  a 40 ms median round trip (log-normal, seeded by call key) plus the measured
  search time.
- **API replies:** `GET /repos/BurntSushi/ripgrep/community/profile` and
  `GET /repos/BurntSushi/ripgrep/releases?per_page=3`, from api.github.com on
  2026-10-30 at 20:39:51 UTC (2 requests, real latencies). Email addresses are
  replaced by `redacted@example.invalid`; nothing else is changed.
- **Files:** `responses.jsonl.gz` (58 KB, committed) expands to
  `responses.jsonl` (609 KB, 21 recordings; sha256 in `../manifest.json`).

## Sizes per run

| Program                                                                             | Calls | Response bytes | Largest reply           |
| ----------------------------------------------------------------------------------- | ----- | -------------- | ----------------------- |
| 1 two searches, two requests, sequential                                            | 4     | 183 KB         | 158 KB (releases page)  |
| 2 searches and requests in parallel pairs                                           | 4     | 177 KB         | 158 KB                  |
| 3 search, then `getOperation` to confirm `per_page` before calling                  | 6     | 192 KB         | 158 KB                  |
| 4 fetches more: the full operation list, 8 full definitions, two 50-result searches | 13    | 518 KB         | 243 KB (operation list) |
| 5 a helper that filters search hits by path, `replaceAll` templates                 | 4     | 190 KB         | 158 KB                  |

## What it stresses

Two-step programs (find, then call), path-template filling, picking the right
hit over lookalikes, and large spec reads (the 243 KB operation list) reduced
to a 0.4 KB answer.

## Oracle

`oracle.ts` reads the two recorded API replies and recomputes the health
percentage, the missing files (`null` in `files`: code_of_conduct,
issue_template, pull_request_template) and each release's download sum. It
compares them exactly; missing files are compared as a set.
