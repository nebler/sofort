# 09 — R4 portability and watchdog deduplication

FIXED F1: active Hyperlight build/test/runtime code and the shipped descriptor
have no machine-specific paths. Documented `HYPERLIGHT_JS_SRC` supplies the
external checkout; relative Cargo dependencies resolve in a staged crate.
`JITK_NODE`, `HYPERLIGHT_BUILD_DIR`, `HYPERLIGHT_WORKER`, and
`HYPERLIGHT_SNAPSHOT` select tools/outputs. Signing uses the canonical VMM
entitlement; rebuilding never recursively deletes a snapshot override.

FIXED F1: jitk uses canonical `vmm/build/jitk-vmm` + `kernel/dist/kernel.bin`,
or `JITK_VMM_BINARY` with `JITK_KERNEL_IMAGE` (04) / `JITK_IMAGE` (06).
The production CLI, compiled profile and host sandbox acknowledgement replace
the R2 fallback. Executor helpers receive the selected artifacts explicitly.

FIXED F3: deleted the private watchdog and process/lifecycle implementation.
`HyperlightBackend` delegates to canonical `executor/build/backend.js`
(`ProcessBackend`), including its independent per-run deadline watchdog.
Waited for executor `.R4`, polling at 03:02 and 03:12 UTC (load1 63.59/81.79).
Its status is FUNCTIONAL_PASS; F2_TIMING_GATE_FAIL, not a timing-gate pass.

Verification from `cp -R arch/jitk /tmp/jitk-09/r4/anyname`:
- `make -C .../bench/hyperlight test`, source unset: all 13 SKIP cleanly,
  exit 0; load1 129.28→129.28. Direct TS entrypoint also skips cleanly.
- Same target with explicit source/worker/snapshot inputs: 13/13 PASS,
  exit 0; load1 103.02→100.33. Used the final marked executor artifacts.
- Copied-tree default paths, both image overrides and precedence, source-copy
  identity, path audit and Python/Node/shell syntax PASS; load1 125.24.
- Offline/locked staged Cargo metadata PASS; load1 102.61.
- Invalid explicit source fails with the missing manifest path before VM
  launch (expected make exit 2); load1 46.25→47.43.
- Active top-level owned code/build/config: 614 physical LOC; load1 125.24.
  Excludes evidence/data/Markdown/lockfile and generated output.

Tested canonical watchdog SHA256: `206b9d37ef9a0dea0a9c45829101f3fa50b47df3fbaa84d1324e4cb44a93e014`.
Tested backend bundle SHA256: `058dd0164f3633bc1cbbefc52ac65d17cf89b7e30d1e26b3e7c5d6a0aae34db3`.
Tested worker SHA256: `60e83328a0ac6dd13aa21c60b76148a60adf94733e46331d54adaedeb9ed229c`.
Full source/artifact/snapshot hashes: `bench/hyperlight/.R4`; raw receipts:
[r4/verification.json](r4/verification.json). All started children were reaped.

OPEN: no area-09 cleanup item. The executor's strict F2 timing target remains
failed under contention; this report makes no deadline timing or performance
claim. The supplied worker/snapshot retain their R3 build; no rebuild or jitk
VMM recertification is claimed. Historical R3 receipts keep original paths.
