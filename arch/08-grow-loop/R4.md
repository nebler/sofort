# 08 grow — R4 final

FIXED **F1**: verifier inputs are small shipped trace/strace fixtures in
`../jitk/grow/tests/fixtures`. Tests never load a release report or saved
repository path. Every patch test and controller repository is created fresh
with TemporaryDirectory and cleaned. No temporary host, sibling-area input,
checkout basename, or historical result is selected implicitly.

FIXED **F3**: deleted all of `grow/fallback-kernel`, its provenance file,
`grow/proposals`, the duplicate ppoll assembly probe, and unused QuickJS spike
workloads/oracle scripts. Kernel handlers and the ppoll probe come exclusively
from `kernel/`; the disposable copy deletes handlers before regrowth. Retained
inputs are growth-only signal probes/linker script, strict normalizer/fixtures,
and the licensed static Lua binary/script. Full historical R3 receipts moved to
this owner's `r3/grow-results`; portable tooling never reads that archive.
Source audit: **970 physical source/build/test lines**, zero Rust/assembly
kernel duplicates, **17,444 fixture bytes**, at load1 **65.92**.

FIXED **honesty**: both demo/controller accept `--live`. Default output says
**REPLAY**; live says **LIVE**, invokes real headless Codex per observed miss,
and runs the same acceptance gates. CLI uses ephemeral sessions, ignored user
config, read-only sandbox, approval never, and an exact one-file JSON schema.
Controller validates path/source and checks source did not change. Auth is
copied privately (directory 0700/file 0600), removed in finally, and never enters
worktrees, prompts, build environments or receipts. CLI failures do not replay.
VMM is explicit `JITK_VMM_BINARY`, uses canonical --image/confinement and requires
its host-only sandbox ack on a pipe. All started processes were reaped.

## Verification (functional under contention)

- Exact `cp -R arch/jitk /tmp/jitk-08/r4/anyname`, then
  `make -C /tmp/jitk-08/r4/anyname/grow test`: **19/19 PASS**, load1
  **100.13→95.00**. Fresh fixtures/repositories; no original repository inputs.
- `make -C /tmp/jitk-08/r4/anyname/grow demo`: **PASS**, explicit replay plus
  fresh QuickJS/Lua boots; **45.854 s**, load1 **95.00→65.57**.
- Fresh replay growth: **90/90** handler differentials, Lua **30/30**;
  **324.098 s**, stage load1 **46.22–106.46**. Canonical profile remains 6 LOC.
- Real `demo.py --live --fast`: **3 actual CLI calls**, **90/90** handler
  differentials, Lua **30/30**, then two fresh demo boots, all PASS.
  Preparation **402.229 s**, stage load1 **55.81–138.09**; generated profile 8 LOC.
  Live candidates stay disposable; no canonical kernel source was edited.
- First copy attempt was incomplete: the supervisor's 180 s copy budget expired
  at load1 **104.18**, before any tests. Child killed/reaped; retry above passed.
  Logs, loads, failure receipt and copied-demo receipt are retained in `r4/`.

## Artifact hashes

Canonical baseline (distinct from repacked tested images):
`a7c39ab5679e75d3242f6f318cd5367ff866380e8f509085e974a49f1b6a6364`

Canonical VMM v2:
`276463d01ac6956a095814ed77053989d21bb52a7ef702f5c2698eb98daba20e`

Static Lua:
`6d825f225d7beff5a9707ec10db63cf3347524dc3ba183b16d0f6d809d2f0929`

`grow/.R4` and `r4/artifacts.json` additionally pin all four actually executed
replay/live QuickJS/Lua kernel images. The complete final controller source was
exercised by the live run and standalone-copy tests/demo.

OPEN: full Lua startup ABI equivalence, Linux signal delivery and quiet-host
performance remain UNVERIFIED. Lua already computes with missing-slot ENOSYS;
growth verifies the explicit fallback contract. No decision disagreement.
