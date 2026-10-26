# Grow TypeScript cutover

The pre-E1 port (Python baseline `793d2c3`) is now the canonical `grow/` loop,
including the E1 delta from `f5f9f562`. The separate `grow-ts/` tree is removed.

| Retired Python | Native TypeScript |
| --- | --- |
| loop.py, demo.py, prepare.py | loop.ts, main.ts, Makefile |
| agent.py, retries.py | agent.ts, retries.ts |
| profiles.py, observations.py, adapters.py | profiles.ts, observations.ts, adapters.ts |
| runtime.py | runtime.ts, lib.ts |
| sqlite_profile.py, sqlite_checks.py | sqlite-profile.ts, sqlite-checks.ts |
| oracle/run_profile.py, normalize.py | oracle-profile.ts, normalize.ts |
| test.py, oracle/test_normalize.py | test.ts |
| experiments/run_e0.py, run_e1.py | experiment-run.ts, experiments-main.ts |
| experiments/summarize.py, render_summary.py | experiment-audit.ts subcommands |
| experiments/failure_analysis.py, seal_receipts.py, verify_receipts.py | experiment-audit.ts subcommands |
| grow-ts/parity.py | parity.ts, parity-main.ts |

Generic helpers are in `lib.ts`. No interpreter implements controller, oracle,
retry or experiment decisions. The external kernel build remains a dependency;
its Python removal belongs to the kernel agent. The independent filesystem Rust assertions are preserved unchanged in
`host-tests.rs`, checked against their pinned extraction hash, and compiled
directly. `host-tests-origin.json` records the retired Python wrapper provenance;
legacy host-tests-source receipts retain that origin identity. No Python source
file is needed for the host assertions. The adapter nests
handlers under syscalls, matching the real kernel and supporting super imports.

Native JSON preserves unsigned 64-bit register tokens and dynamic trace fields.
Full raw observation receipts are checked against captured stdout before the
first-missing discovery boundary is normalized. Timing-sensitive manifest and
held-out reference hashes are validated against each run's actual bytes before
canonical content is compared. Failed stage booleans remain strict.

The static Linux oracle is mounted into the existing pinned image; no image
rebuild/retag is needed. Rebuild binaries after moving a checkout (embedded asset
root). The native experiment runners reproduce the historical seeded design,
but retain new metadata separately under ignored results; they do not overwrite
Python-era evidence. See PARITY.md for actual verification and SCRIPTC-GAPS.md
for compiler restrictions and minimal repros. Nothing was filed upstream.
