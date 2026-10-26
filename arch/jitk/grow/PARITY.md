# E1 native grow parity and cutover — 2026-10-26

Branch: `ts-port/grow`. Python baseline checkout:
`377e3fdc` (full identity in `evidence/parity-summary.json`); grow's E1 delta is
`f5f9f562`. Every grow transaction used **--validate-only**. Release markers
remain byte-identical. Run directories and logs are local and gitignored.

| Target | Python / TypeScript | Visible samples each | Held-out each | Mutants rejected each | Integration each |
| --- | --- | ---: | --- | ---: | --- |
| ppoll | PASS / PASS | 30 | PASS | 2 | QuickJS PASS |
| rt_sigaction | PASS / PASS | 30 | N/A | 2 | Lua PASS |
| rt_sigprocmask | PASS / PASS | 30 | N/A | 2 | Lua PASS |
| fstat | PASS / PASS | 30 | PASS | 3 | SQLite 10/10 |
| pread64 | PASS / PASS | 30 | PASS | 4 | SQLite 10/10 |

Signals retain the explicit injected ENOSYS contract, with no new held-out
signal profile. All 13 mutants compile and complete, then fail the visible
semantic comparison. All nine real-target mutants also independently fail the
held-out comparison. Source validation, source/binary hashes, stage-name sets,
passed/failed stage decisions, cases, raw observations, acceptance manifests
and integration results match.

The final native `build/parity` compares **670 JSON receipts** with zero
differences: 302 original + 368 SQLite. Every normalized per-file SHA pair is in
`evidence/e1-original-parity.json` and `evidence/e1-sqlite-parity.json`; the compact
table is in `evidence/parity-summary.json`. This was first checked before the
move and repeated with fresh native runs from canonical `grow/` after the move.
No Python comparison implementation remains.

Local raw evidence (not tracked):

- Python: `results/ts-e1-python-original-v2/`, `results/ts-e1-python-sqlite/`.
- Final native: `results/ts-handoff-native-original/`, `results/ts-handoff-native-sqlite/`.
- Live: `results/ts-final-live-none/`.
- Native causal diagnostics: `results/ts-final-diagnostics/`.

An initial Python invocation without the VMM environment stopped before any
transaction. Two stale-binary runs during the directory move failed at the
oracle mount and are retained with `-stale-binary` suffixes; they are excluded
from parity and smoke. Rebuilding after the move fixed the embedded asset root.
The driver now checks the mounted binary is a file before invoking Docker.

## Exact normalization boundary

The native comparer preserves the pre-E1 method. It compares complete JSON file
sets and removes only elapsed/uptime/load/benchmark annotations, temporary Git
commit IDs and implementation controller hashes. It replaces run/repository and
scratch paths. Candidate and mutant source hashes, ELF/kernel/VMM hashes, oracle
image identity, raw register values (including unsigned 64-bit tokens and PC),
future trace fields, sample counts and all gate decisions remain strict.

Every full saved observation is first re-parsed from its raw stdout and checked
against its receipt. Discovery then compares only through the same first
complete missing record, allowing expected SIGKILL or normal completion after
that record. No such boundary applies to verification, mutants or integration.

Every `verification_sha256` is checked against its own original serialized
verification bytes before comparing canonical normalized content. This permits
only Python/JavaScript integer-key serialization order. E1 adds a necessary
extension: each held-out `reference_sha256` is first checked against its actual
Linux summary bytes, then compared as canonical content after removing elapsed
seconds from that referenced summary. Raw reference checksums necessarily differ
because each process launch records a different elapsed time. Failed stage
booleans, stdout/stderr and exit/status are never normalized away.

## Static oracle equality

`oracle-profile.ts` was compiled with the npm-pinned **scriptc 0.4.5** and matching
`@scriptc/runtime-linux-arm64-musl@0.4.5`, `SCRIPTC_TARGET=aarch64-linux-musl`, and
Zig 0.16.0 at `/Users/noah/.local/share/zig-0.16.0/zig`.

`file` identifies an aarch64 static ELF. ELF program-header inspection confirms
there is **no PT_INTERP or PT_DYNAMIC**. The driver is mounted at
`/oracle-profile` and run with `--entrypoint /oracle-profile` in existing image
`jitk-oracle:08`, identity
`sha256:88f8f82bb1850e61c04fd9e47813cd054f5e18eaf6143c4cebeb3d3667818d0a`.
No rebuild, retag or prune was performed.

All **31 Linux profile executions** agree with the original Python driver:
five visible targets, three held-out targets, original QuickJS/Lua integrations,
and all ten SQLite cases under each filesystem target. Equality covers exact
saved stdout/stderr bytes, exit/return status, injection count and configuration;
only elapsed seconds are removed. strace PID/ASLR text differs across launches
and is not claimed byte-identical. The original trace adapters independently
check the original target Linux/guest semantics. Per-profile hashes and stream
hashes are in `evidence/oracle-equality.json`.

## Live smoke and native suite

Three transactions, **N=1 each**, real `codex-cli 0.164.0`, model `gpt-6.1-sol`,
spec `none`: **3/3 accepted**, all visible/held-out/mutation/integration gates.
ppoll and fstat passed at attempt one. pread64's first proposal failed Rust's
cast/comparison syntax rule; its second passed after public build feedback.
That is four real CLI calls, no replay substitution, 2/3 accepted @1 and 3/3 @3.
Whole-run wall time was 120.858 s; this is experiment cost, not VM performance.
Usage, prompt/proposal hashes and attempt outcomes are summarized in
`evidence/live-smoke.json`. All raw logs and proposals remain local.

`make -C arch/jitk/grow test`: **44/44 native tests pass** in place. Coverage
includes original grow/oracle tests, process cleanup and partial timeout output,
64-bit/future-field evidence preservation, split/spec/retry/sanitization,
Codex/Claude fake-CLI rails and private auth cleanup, real host Rust helper
imports, exact historical seeded E1 ordering, CSV denominators and decisions,
trusted Git input sealing, artifact inventories and incomplete-summary refusal.
Claude is unit tested only; no live Claude claim is made.

The live smoke preceded the final extraction of byte-identical Rust host
assertions into a grow-owned fixture; its actual binary hash is recorded in the
smoke summary. Fresh final native replays after the extraction again matched all
five targets and all 670 receipts. `evidence/host-fixture-equality.json` proves
exact Rust-assertion byte equality against the pinned original Git source.

The ported native SQLite diagnostic tool also passes causal missing-handler
states, Linux injected ENOSYS, combined tolerated ENOSYS, real ET_DYN loader
rejection and fatal output protocol detection. The external kernel build still
uses kernel-owned Python tools; no grow/oracle/experiment decision runs Python.
Independent host Rust assertions are preserved unchanged as trusted
`host-tests.rs` and compiled directly. Their extracted-body hash is checked
before every use; the legacy host-tests-source receipt retains the retired
Python wrapper origin hash, recorded in `host-tests-origin.json`. Native input
sealing includes the Rust fixture and origin metadata. No Python file is needed
for host assertions. Historical ignored Python-run evidence may retain
generated wrapper scripts; no `.py` implementation is tracked in grow.

| Local native binary | Bytes |
| --- | ---: |
| grow (macOS arm64, libSystem only) | 1,815,432 |
| oracle-profile (static aarch64 Linux musl) | 2,954,320 |
| experiments | 1,365,112 |
| parity | 1,014,280 |
| sqlite-checks | 1,129,456 |
| test | 2,015,208 |

Hashes and build facts are in `evidence/native-build.json`. Binaries are ignored,
not committed. No newly committed file exceeds 1 MiB. Disk checks remained above
the 15 GiB stop threshold; final check was about 52 GiB available. No push or
promotion was performed. Compiler restrictions and minimal repros are recorded
in `SCRIPTC-GAPS.md`; no blocking gap remains and nothing was filed upstream.

## Reproduce from retained local Python evidence

```sh
make -C arch/jitk/grow build test
export JITK_VMM_BINARY=/tmp/jitk-01/r3/darwin/jitk-vmm
arch/jitk/grow/build/parity \
  arch/jitk/grow/results/ts-e1-python-original-v2 \
  arch/jitk/grow/results/ts-handoff-native-original /tmp/original-parity.json
arch/jitk/grow/build/parity \
  arch/jitk/grow/results/ts-e1-python-sqlite \
  arch/jitk/grow/results/ts-handoff-native-sqlite /tmp/sqlite-parity.json
```

For a new baseline reproduction, restore the baseline revision into a separate
checkout; the canonical tree intentionally no longer contains Python. Run the
Python and native controllers with fresh run IDs, `--validate-only --samples 30`,
and the pinned SQLite inputs from README.md. Rebuild after moving a checkout.
Do not overwrite retained receipts or promote a release.

Aggregate Makefile handoff (not edited here): add
`+@$(DELEGATE) grow build` to `arch/jitk/Makefile`'s `build` recipe. Existing
`grow test`, `grow grow` and `grow demo` delegation remains valid; both native
run targets insert `--validate-only`.
