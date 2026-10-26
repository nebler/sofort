# Round 8 brief: fix wave after the R7 review (2026-10-26)

Project **Sofort** (kernel **jitk**). This round fixes what `arch/review/R7-REVIEW.md` found:
Tier 1 bugs, the two memory fixes (items 13 and 14), the dead-code list, and the Rust idiom and
hygiene findings (Tier 4). Tier 2 (sandboxing, lease authority, native lifecycle, ABI
generation) is **not** in this round unless your task says so.

All rules of `arch/work/R7-BRIEF.md` still apply (machines, kvm-dev limits, untrusted downloads,
benchmark locks, Mac test loop, deliverable shape). Differences:
- kvm-dev scratch directory: `/home/dev/r8-<your-id>/` (not `r7-`). Delete build output at the end.
- Deliverable: `arch/review/fixes/R8-<id>.md`, short: per finding ID → what changed, the commit,
  the regression test that proves it, and before/after numbers where relevant.
- **Every bug fix comes with a regression test** that fails before the fix and passes after.
  Say in the report that you checked it fails before.
- Behaviour-preserving refactors must keep all suites green; don't mix refactors and fixes in one
  commit.

## Read first
- `arch/review/R7-REVIEW.md` (consolidated, ranked) and the source report for your IDs:
  `R7-REVIEW-{perf,architecture,deadcode,rust}.md` (each has file:line evidence and suggested
  rewrites).
- `arch/jitk/shard/README.md`, `ABI-R7.md`, `RESULTS-R7-integrate.md` (how the shard is built and
  tested in kvm-dev: `make -C arch/jitk/shard test`, 82-case native corpus, 19 Rust tests, the
  IPC SSH test).

## Test commands that are known to work (from R7)
- Mac: `for t in kernel vmm vmm/sandbox protocol executor executor/policy mcp grow bench bench/hyperlight linux; do python3 arch/jitk/docs/delegate.py $t test || break; done`
  (`linux` runs inside kvm-dev over SSH, about 5 minutes). Kernel tests need
  `JITK_VMM_BINARY` pointing at a built `vmm` binary; executor tests need the Hyperlight env vars
  as in earlier rounds; check `arch/jitk/docs/delegate.py` and the subtree Makefiles.
- Test runs rewrite tracked files under `arch/jitk/kernel/test-work/` and leave read-only dirs;
  clean with `chmod -R u+w` then `git checkout`/`git clean` (agent `r8-hygiene` is removing this).
- kvm-dev: `export PATH=$HOME/.cargo/bin:$PATH` in each ssh session. Copy the tree with
  `git archive HEAD arch/jitk | ssh … tar -x` (archive all of `arch/jitk`, not single files).
- The default kernel image SHA-256 is `75b2abe2…` and tracked in `arch/jitk/kernel/.READY`
  (checked by `executor/build/select-backend.js`). If your change alters the default image, update
  `.READY`, give old/new SHA-256, and re-run executor certification and the MCP suite.
