# Docs tooling parity

macOS arm64, scriptc 0.4.5, 2026-10-26.

| Check | Python | Native TS |
|---|---:|---:|
| Delegate guard | 6 tests pass | 6 tests pass |
| Receipt preservation/explicit recording | 3 tests pass | 3 tests pass |
| LOC stdout on same current tree | baseline | byte-identical |

Guard coverage includes in-place cwd, preexisting dirty receipts, tracked and
already-dirty mutations, unignored output, failed-suite exit-code preservation,
and failed-suite mutations. It snapshots status plus staged/unstaged binary
diffs, and never restores mutations. Every `test*` action is guarded.

Receipt checks cover protocol JS/vectors compare-without-write (including mtime),
refusal of stale evidence, explicit `JITK_RECORD=1` refresh, kernel artifact output
redirection, and failed Linux setup preserving recorded readiness/reports.

LOC receipts normalize only measured_utc (runtime timestamp); their inventory,
hashes, classifications, patch deltas and physical line counts agree. No evidence
is updated by normal suites. Run `JITK_NODE=/absolute/node make test`.

Aggregate Makefile (owned elsewhere) must build docs native tools, change
`DELEGATE` to `$(ROOT)/docs/.work/bin/delegate`, and change count-loc to
`$(ROOT)/docs/.work/bin/count-loc`. No aggregate edits in this branch.
