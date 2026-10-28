# Evidence outside git

Bulk evidence (raw run output, ledgers, logs, copied kernels and bundles) is not
tracked any more. It lives in a local content-addressed store, and
`evidence/manifest.json` records every moved file. This is R10 change #3 / W0.1
(`arch/review/R10-ARCHITECTURE.md`). History was not rewritten: tag
`evidence-in-tree-2026-10-28` is the last commit with every file in the tree.

- **Store:** `${SOFORT_EVIDENCE:-$HOME/sofort-local-evidence}/cas/sha256/<aa>/<sha256>`,
  read-only objects named by their sha256. There is no external service.
- **Manifest:** `files[]` has one entry per moved file: `path`, `sha256`,
  `bytes`, `commit` (a commit that still has the file; `git cat-file blob
  <commit>:<path>` restores it) and `mode` for executables. `kept[]` lists the
  evidence above 64 KiB that stays in the tree, with the reason.

## Commands

Build the tool with `make -C arch/jitk tools`, then run
`arch/jitk/tools/.work/bin/evidence <command>` from anywhere in the repo:

| Command | Does |
|---|---|
| `fetch PATH\|DIR\|GLOB...` | Restores files in place from the store, or from git at the recorded commit if the store lacks them; that also fills the store. The sha256 is checked either way. Restored files are untracked. `--ignore` also adds them to `info/exclude`, which all worktrees share. `--to DIR` restores below DIR instead. |
| `verify` | Checks every manifest entry is in the store with the right hash. `make -C arch/jitk doctor` runs it and only warns when the store is missing. |
| `plan [--list]` | Shows what the rule below would move or keep in the current tree. |
| `export [--commit REV]` | Copies every file the rule moves into the store, re-hashes it, and merges it into the manifest. Each file must be identical at REV (default HEAD). |
| `remove` | `git rm`s the manifest entries that are still tracked. It deletes nothing unless every store copy and working file matches its sha256. |
| `check` | Runs the guard (below). |

The reducers and verifiers for moved evidence don't run in any test. Fetch their
inputs first. Examples:
- `fetch arch/jitk/bench/ledger` before `bench/ledger/verify.ts`
- `fetch arch/jitk/linux/out/r7` before `linux/historical.ts`
- `fetch arch/jitk/shard/raw-r7-shard` before `shard/evidence.ts analyze-*`
- `fetch arch/jitk/scriptc-corpus/census.csv` before `make -C arch/jitk/scriptc-corpus audit`

## The rule (`arch/jitk/tslib/evidence.ts` `classify`)

**Scope:** tracked files under `arch/`, except:
- `arch/research/`, which other sessions are still writing
- the trees W0.2 deletes: `arch/jitk/native/`, `arch/jitk/native-spike/` and `arch/jitk/shard/src/synthetic/`

**A file is evidence** when any of these holds:
1. A directory on its path is an output directory: `results`, `result`, `raw`,
   `raw-*`, `*-raw`, `results-*`, `*-results`, `out`, `*-out`, `*-ledger`,
   `logs`, `experiments`, `evidence`, `artifacts`, `frozen`, `pre-ready` or
   `test-results`.
2. It is a `.jsonl`, `.csv`, `.tsv` or `.log` dump.
3. It is larger than 64 KiB and is not source, config or a lock file. This
   catches raw JSON and binaries outside output directories.

**Evidence stays in the tree** when any of these holds:
- It is `*.md`, such as RESULTS, REPORT and claims tables.
- It is a `.READY`, `release.json` or `.gitignore`.
- A build, test or runtime path reads it. These files are listed in
  `CONSUMED` with the reader: the bench parity inputs, `protocol/vectors.json`,
  `grow/experiments/{E1,E1-pilot,summary}.json`, `kernel/payload/{qjs,qjs-ring}`,
  `grow/payload/lua-static` and `kernel/results-fs/linux-kvm-check.ts`.
- A tracked `.READY` or `release.json` names its sha256.
- It is at most 64 KiB and a tracked file that stays cites it. Citing means
  naming its repo path, its path relative to the citing file, or a path suffix
  of two or more components.

Every other evidence file moves.

**Guard:** `evidence check`, which the delegate also runs before every `test*`
action (`arch/jitk/docs/dispatch.ts`). It refuses tracked in-scope evidence above
64 KiB unless the file is markdown, a marker, or listed in the manifest's
`kept[]`. Either move the file with `export` then `remove`, or, if a build or
test reads it, add it to `kept[]` with the reason. Test output belongs in
`.work/`, as the delegate's git-state guard already requires.
