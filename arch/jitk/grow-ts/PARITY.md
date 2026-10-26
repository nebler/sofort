# Native grow parity — 2026-10-26

Baseline Python: `793d2c3c29beabb369a53dbf103fb8c30a397b7c`. TypeScript sources
in the successful native build have the hashes recorded in each run's report.
All runs used **--validate-only**. Neither release pointer nor `.READY` changed.
Python source files remain byte-for-byte unchanged.

| Target | Python / native | Samples per implementation | Mutants rejected per implementation | Unchanged integration |
| --- | --- | ---: | ---: | --- |
| ppoll | PASS / PASS | 30 / 30 | 2 / 2 | QuickJS PASS / PASS |
| rt_sigaction | PASS / PASS | 30 / 30 | 2 / 2 | Lua PASS / PASS |
| rt_sigprocmask | PASS / PASS | 30 / 30 | 2 / 2 | Lua PASS / PASS |
| fstat | PASS / PASS | 30 / 30 | 3 / 3 | SQLite 10/10 / 10/10 |
| pread64 | PASS / PASS | 30 / 30 | 4 / 4 | SQLite 10/10 / 10/10 |

Every candidate passed source validation, build, semantic/error/state cases,
mutations and integration. All **13/13 mutants** compiled and completed before
being rejected for semantic differences in each implementation. Stage-name sets,
case descriptions, source hashes, output bytes, statuses, raw observations and
acceptance/manifest content agree. Signals retain the explicit injected ENOSYS
contract; this is not signal implementation or general Linux ABI equivalence.

`evidence/original-parity.json` compares **283 JSON receipts**;
`evidence/sqlite-parity.json` compares **320 JSON receipts**. All **603** normalized
receipts match. Each file's normalized SHA-256 pair is recorded in these files.
The complete raw local receipts (including builds and bundles) remain at:

- `../grow/results/grow-ts-parity-final-python-original/`
- `results/grow-ts-parity-final-native-original/`
- `../grow/results/grow-ts-parity-final-python-sqlite/`
- `results/grow-ts-parity-final-native-sqlite/`

The original pair uses real first-missing-name discovery (no `--target`). The
SQLite pair uses explicit fstat/pread64 targeting and the unchanged census ELF
and DB hashes from `../grow/README.md`. `evidence/receipts/` includes their small
source, request, acceptance, mutation and report receipts for review in Git;
large binaries and complete streams remain local rather than in the commit.

## Exact normalization boundary

`parity.py` compares the full JSON file sets and recursively removes elapsed
seconds, uptime/load annotations, benchmark timing samples, temporary Git commit
IDs and controller identity hashes (different implementations). Run and scratch
paths become placeholders. Candidate/mutant source hashes, binary hashes, VMM
hash, oracle image identity, sample counts, decisions, mutation rejection reasons
and integration outputs remain strict.

Two necessary representation normalizations are explicit:

1. JavaScript orders integer-looking object keys numerically. This changes the
   byte checksum of a JSON manifest even when its parsed content is identical.
   The harness first validates each `verification_sha256` against that run's own
   serialized manifest content, then compares the hash of canonicalized content.
2. Discovery stops at the first complete missing entry. Pipe chunk scheduling
   changes how much later output arrives before SIGKILL, and a short program may
   exit normally before the kill. The harness first checks **every full saved
   observation against its raw stdout using the Python observer**, including all
   raw registers and PC. It then compares discovery through the same first-miss
   boundary and accepts only normal exit or expected SIGKILL. It never applies
   this normalization to verification, mutant or integration runs.

Initial receipt comparison caught omitted PC fields caused by fixed-layout
native record projection. The port now retains dynamic fields explicitly, with
native PC and future-field regression tests. An initial comparison also exposed
Python-style vs JSON-style mutation error text; the final controller emits the
same outcome rejection text. These were fixed before the final native runs.

## Live path

`results/grow-ts-live-ppoll/`: **PASS**, real `/opt/homebrew/bin/codex exec`,
`codex-cli 0.164.0`, `gpt-6.1-sol`, 30/30 samples, 2/2 semantic mutant rejections,
QuickJS integration PASS. One call, no retry and no replay substitution; full-spec
pre-E1 prompt. Transaction wall time: 30.51 seconds. The source differed from
canonical replay and passed the same gate. Prompt, proposal, source, VMM and image
hashes are recorded in `evidence/live-ppoll.json`; the proposal and gate receipts
are in `evidence/live-ppoll/`. Original auth remained outside the repository and
private auth scratch was removed. No live signal or SQLite generation is claimed.

## Native build and tests

- npm **scriptc 0.4.5**, package-lock pinned; Mach-O arm64, linked only to libSystem.
- Binary: **1,594,584 bytes** (1.52 MiB), local `build/grow`.
- SHA-256: `5bcfe044bdc0d3888bda561a899d10a22f00a69d7ba9bb388fd9bbd90809de07`.
- Startup: **4.00 ms median**, 100 warm-filesystem `--help` process launches,
  measured spawn-to-reap under `/usr/bin/lockf -k /tmp/sofort-bench.lock` with
  load1 < 6. Includes module initialization and fixed asset reads; excludes
  VM/model/oracle. This is macOS process startup, not a jitk execution benchmark.
- `make -C ../grow test`: **22 + 4 Python tests PASS**.
- `make -C . test`: **31/31 native tests PASS**, including all original test
  cases and added process, raw-register, source-mutation and CLI coverage.
- Native spike: PASS (process cwd/env/timeout/capture/reap, fs/mkdtemp, crypto,
  JSON, argv). See `spike/` and `SCRIPTC-GAPS.md`.
- Existing oracle image:
  `sha256:88f8f82bb1850e61c04fd9e47813cd054f5e18eaf6143c4cebeb3d3667818d0a`.
- VMM SHA-256:
  `6b4b9d6a80cb972a7c8e2f4ebda27950435d3dbc2c55ac2252ffe76d3e7038f8`.
- Disk checks remained at 86–87 GiB available; no rebuild/prune/promotion/push.

## Reproduce

```sh
make -C arch/jitk/grow-ts build test spike
export JITK_VMM_BINARY=/absolute/path/to/jitk-vmm
python3 -B arch/jitk/grow-ts/parity.py --prefix new-unique-prefix --samples 30 \
  --sqlite-elf /absolute/sqlite3-static --database /absolute/census-demo.db
python3 -B arch/jitk/grow-ts/parity.py --prefix grow-ts-parity-final --compare-only
/usr/bin/lockf -k /tmp/sofort-bench.lock python3 -B arch/jitk/grow-ts/measure.py
```

The first final harness process still had the old discovery return-code
comparison loaded and reported that one representational difference. After
making the boundary explicit, `--compare-only` passed on those same untouched
fresh receipts; no acceptance result was rewritten.

## Remaining boundaries

scriptc required the process API and dynamic-record workarounds documented in
`SCRIPTC-GAPS.md`; no blocking compiler gap remains and nothing was filed
upstream. The binary's asset root is fixed at compile time, so rebuild after
moving the checkout. Existing kernel build/test and in-container Python tools
remain dependencies. Linux cross-compilation and execution on jitk are untested.
E1 spec levels, retries and held-out probes belong to the other branch and still
need to be ported via `PORT-NOTES.md`. Diagnostic-only `sqlite_checks.py` remains
Python and is not used by the native acceptance controller.
