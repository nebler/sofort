# Native TypeScript grow controller

TypeScript compiled with **scriptc 0.4.5** is the sole grow-loop implementation.
`../kernel/` remains the only kernel source. The controller requires its `.READY`,
copies it into a disposable Git repository, removes independent tests before
proposal generation, and removes that repository/Cargo cache on exit. No Python implementation
source is tracked in grow. Generic process, hashing, JSON and assertion helpers come
from the shared `../tslib/` through `lib.ts`.

```sh
make -C arch/jitk/grow build test
export JITK_VMM_BINARY=/absolute/path/to/jitk-vmm
arch/jitk/grow/build/grow --run-id unique-name --validate-only
arch/jitk/grow/build/grow --run-id sqlite-check --validate-only \
  --target fstat --target pread64 --samples 30 \
  --sqlite-elf /absolute/sqlite3-static --database /absolute/demo.db
make -C arch/jitk/grow demo ARGS='--live --spec none'
```

`--target` is repeatable; supported profiles are ppoll, rt_sigaction,
rt_sigprocmask, fstat and pread64. Omit it to exercise actual first-missing-name
QuickJS/Lua discovery. Only the current target is removed inside the copy.
Unsupported/duplicate targets fail closed. Registration never establishes
acceptance. `--samples` defaults to 30; repetition is not independent coverage.

REPLAY reads canonical handler source; LIVE invokes the real proposal-only CLI.
Both use identical source, build, visible semantic/error/state, held-out,
independent filesystem host, mutation, and unchanged-program integration gates.
Every mutant must compile, complete with the host sandbox acknowledgement and a
complete guest protocol, then fail visible and (where present) held-out probes
independently. Crashes, timeouts and build errors cannot count as rejections.
The held-out C source, resource bytes, ELF and Linux reference are hashed and
stay outside the proposal repository. `profiles.ts` defines the split; mutations
derive from canonical known bugs, independently of candidate formatting.

`--spec full|terse|none` controls the prose specification; all levels retain the
same public observations, visible probe and helper API. `--attempts 1|2|3`
defaults to three fresh live proposal calls (replay always makes one attempt).
Retries restore manifest/handler state and include previous public candidate
source plus sanitized gate feedback. Hidden observations, host assertions,
mutant sources and integration corpus details never enter retry feedback.
Rate/subscription errors persist `paused.json` and stop further attempts.
Every attempt retains stage decisions and raw controller-side diagnostics.

Live rails: exact one-file JSON schema, checked source/path, read-only source
hash check, bounded process sessions with kill/reap, usage receipts, tool-event
rejection, and partial stdout/stderr retained on CLI timeout. Codex uses
`exec --json --ephemeral --ignore-user-config`, read-only sandbox and never
approval. The Claude adapter uses its own print/plan/restricted flags, disabled
tools/MCP, no session persistence and structured-output envelope. Its flags and
auth isolation are tested with a native fake CLI; no live Claude result is claimed.
`JITK_GROW_CLI` and `JITK_GROW_MODEL` select transport/model. Auth is copied to a
0700 private directory with 0600 files, cleaned in `finally`, and excluded from
prompts, repositories, receipts and compiler/VM environments. Claude may use the
existing system keychain. Failures never substitute replay.

SQLite acceptance uses all ten unchanged cases in `sqlite-corpus.json`, comparing
stdout/stderr bytes and guest exit status against Linux pipes. Inputs are pinned:

- SQLite SHA256 `005073a6c1c0e71c22ad8b752f1ffb6c35c8d913fe91f5795038c7d52cf639ff`.
- 8192-byte census DB SHA256 `f3d4180cd07ad9eed5a674c7ff4e5f6d817eb517029c185f66af862a30eac059`.

The DB contains `n(v)` = 9,1,5,3,5. Pack `/demo.db` and empty regular `/dev/null`;
use `file:/demo.db?mode=ro&immutable=1`. `sqlite-build.sh` extracts the pinned
3.50.4 amalgamation with `unzip` (or BusyBox), verifies `sqlite3.c` with OpenSSL
SHA3-256, builds with `JITK_MUSL_CC`, strips the ELF, and creates that DB. It
checks both output SHA256s and fails on a mismatch; its private outputs never
replace the pinned inputs. Run only in a fresh directory:

```sh
JITK_MUSL_CC=/home/dev/r6-census/toolchain/musl-install/bin/musl-gcc \
  sh arch/jitk/grow/sqlite-build.sh /home/dev/r7-grow/NEW_REBUILD
```

Reproduction audit (2026-10-26, existing kvm-dev): the source SHA3-256 matches
`9145255e83da6529e70121ee4d7a4c88fe83ca4511da0c9ed13d10842df36782`;
the archive SHA256 is
`1d3049dd0f830a025a53105fc79fd2ab9431aea99e137809d064d8ee8356b032`.
The historical recipe does **not** reproduce the pinned ELF with the available
musl 1.2.5 / Ubuntu GCC 15.2.0 toolchain: it produces SHA256
`9738d764d61c212592212d0c3f493ba179b8caec6f08810f1d6520c38757f539`.
The pinned ELF's `.comment` records **Alpine GCC 14.2.0** and its GNU build ID is
`212b45f2be358ffe177af066dd0bed24bcde2c98`; the rebuilt ELF records Ubuntu
GCC 15.2.0 and has no build ID. `PRAGMA compile_options` likewise reports
`COMPILER=gcc-14.2.0` versus `gcc-15.2.0`. The script's compiler input does not
pin the original compiler/linker/libc, so byte-identical ELF output cannot be
claimed from that recipe.

The recreated DB has SHA256
`ec62b8d379697e99b5d94d2ced53be3bec6bfb1c4bd85bec6cfb764bb86cb2e3`.
All 8192 bytes match the census DB except offsets 98 and 99 (zero-based): the
four-byte big-endian writer-version header at offset 96 is `00 2e 8a 14`
(SQLite 3.50.4), versus `00 2e 7a 71` (3.46.1) in the census DB. Schema,
rows and all remaining bytes match. The recipe leaves that header intact and
reports the checksum failure. Neither pinned artifact in use was changed.

Local reproduction inputs used in `PARITY.md` are `/tmp/growos-inputs-20261026/sqlite3-static`
and `results/r7-grow/demo.db`. `build/sqlite-checks --run-id ID --validate-only
--sqlite-elf PATH --database PATH` runs causal before-state, ENOSYS, loader and
fatal-output diagnostics through the same native helpers.

The in-container driver is also scriptc TypeScript (`oracle-profile.ts`). `make
build` cross-compiles **static aarch64 Linux musl** using `SCRIPTC_TARGET` and the
pinned matching runtime pack, linked by the pinned zig from the deps cache
(`make -C .. deps`; `ZIG` or `JITK_ZIG` overrides it). The host mounts `build/oracle-profile`
into the **existing** `jitk-oracle:08` image and selects it via `--entrypoint`.
The image was neither rebuilt nor retagged. Its pinned identity is
`sha256:88f8f82bb1850e61c04fd9e47813cd054f5e18eaf6143c4cebeb3d3667818d0a`.
All three payload descriptors are pipes; stdin stays open for ppoll while both
output streams drain. Container execution is bounded, networkless, read-only,
capability-free, and runs as uid/gid 65534. The Dockerfile is a recipe only;
normal operation requires the already available pinned image.

Prerequisites: Node/npm for the pinned compiler, Zig for the Linux binary,
Rust 1.95.0 with aarch64-unknown-none, clang/ld.lld/LLVM objcopy, the existing
Docker image and a confined VMM explicitly selected via `JITK_VMM_BINARY`.
The kernel build uses its native scriptc tooling; grow executes no Python.
The independent Rust host assertions are preserved unchanged in trusted
`host-tests.rs`, checked against `host-tests-origin.json`, and compiled directly
with the real `syscalls` module layout. The retired Python wrapper is not needed. `JITK_GROW_TMPDIR` selects a scratch parent. Rebuild
native binaries after moving the checkout: scriptc embeds `import.meta.dirname`.

Experiment scripts are native subcommands:

```sh
arch/jitk/grow/build/experiments --help
arch/jitk/grow/build/experiments run-e1 --phase pilot --workers 3 --prefix fresh-e1 \
  --vmm /absolute/jitk-vmm --sqlite-elf /absolute/sqlite3-static --database /absolute/demo.db
arch/jitk/grow/build/experiments verify-receipts --meta /absolute/E1-pilot.json --require-complete
arch/jitk/grow/build/experiments seal-receipts --meta /absolute/E1-pilot.json --artifacts
arch/jitk/grow/build/experiments summarize --meta /absolute/E0-environment.json \
  --meta /absolute/E1-pilot.json --meta /absolute/E1.json
arch/jitk/grow/build/experiments failure-analysis --meta /absolute/E1.json
arch/jitk/grow/build/experiments render-summary --meta /absolute/summary.json
```

`run-e0` performs five one-attempt baseline batches through the current split.
`run-e1` preserves Python's exact MT19937 seed 20261026 order, independent
pilot/main denominators (2/10 per cell), bounded concurrency, every failed
attempt and explicit subscription pauses. Resume requires unchanged source,
controller, image, VMM, input and release pins. New output goes under ignored
`results/<prefix>-experiment/`; summarization defaults to
`results/experiment-tools/`. Existing `experiments/` tables are historical
Python-era evidence and are preserved. The native tools operate on new native
metadata; they do not rewrite those historical reports.

Receipts and logs under `results/<run-id>/` stay local and ignored. Keep only
small parity/audit summaries in Git, never raw run directories. Check free space
between batches; runners stop below 15 GiB. All commands above use validate-only;
`release.json` and `.READY` remain unchanged. Direct CLI promotion compatibility
exists only when explicitly omitting `--validate-only`; Makefile entrypoints
always add it. No push is part of this workflow.

`make test` runs the native suite without a model, VM or Docker: it covers the
original trace/normalization contracts, process failure/timeout cleanup,
proposal isolation, E1 retry/split behavior, host helper imports, experiment
shuffle/CSV accounting and receipt-audit rejection paths. Fresh Python/native
parity, oracle equality, and the live smoke are recorded in `PARITY.md`.
Signal profiles retain explicit ENOSYS. Printable developer grow-trace transport
is not production arbitrary-byte stdout/stderr. No general Linux ABI equivalence,
writable filesystem, SQLite journal/WAL, or VM performance claim is made.

E2/E3 use native experiment tools with mandatory validate-only execution:

```sh
make -C arch/jitk/grow build build/e2 build/e3 build/auto-grow test
grow=arch/jitk/grow/build
$grow/e2 --run-id TRIALS --validate-only --red-team simplest --n 5 \
  --vmm /absolute/jitk-vmm --sqlite-elf /absolute/sqlite3-static \
  --database /absolute/demo.db
JITK_VMM_BINARY=/absolute/jitk-vmm $grow/e2 grade --run-id GRADE --validate-only \
  --trials TRIALS[,TRIALS2] --sqlite-elf /absolute/sqlite3-static \
  --database /absolute/demo.db
JITK_VMM_BINARY=/absolute/jitk-vmm $grow/e3 --run-id MUTANT_ID --validate-only \
  --sqlite-elf /absolute/sqlite3-static --database /absolute/demo.db
$grow/auto-grow prepare --profiles /absolute/NEW_PROFILES \
  --fresh /absolute/MUTANT_ID/fresh --database /absolute/demo.db
$grow/auto-grow batch --run-id UNIQUE --validate-only --vmm /absolute/jitk-vmm \
  --profiles /absolute/NEW_PROFILES --sqlite-elf /absolute/sqlite3-static \
  --database /absolute/demo.db
```

Register the six E3 slot numbers before preparing profiles. `autoprofile.ts`
reads real census/oracle traces and emits C probes and semantic/error/state
case inventories, split deterministically outside the proposal repo. It uses
generic argument-shape rules and Linux ABI transport metadata, with no supplied
syscall prose or expected behavior. Pointer arguments get their own 64 KiB mapping followed by an unmapped hole, so
oversized kernel writes fault rather than corrupt the probe. Each generated split
is run twice on Linux;
`auto-observe.ts` learns exact observations and narrowly represented varying
positive scalar/byte fields; positive identities are renamed by first
appearance so equality between them stays exact. The raw outputs, learned rules and hashes remain
in local receipts. This is limited coverage: opaque structs are observed by
write/no-write and repeat relations, not by every field, and positive process
identity normalization is weaker than full PID semantics. Known-mutant grading
must pass before sampling; an unkillable mutant stops E3.

`auto-grow` freezes the profiles before the model matrix, runs N=5 per target
and model with spec `none` and three attempts, and checks two generic wrong-return
mutants. SQLite's unchanged ten-case integration is used for getpid/faccessat;
targets without a runnable unchanged integration use generated differential
plus held-out checks. It never installs or promotes a candidate. The batch uses
two workers, checks the 15 GiB disk floor before each transaction, and preserves
interrupted/quota receipts on resume with unchanged pins. E2 uses one worker.
Never run these batches together above the shared oracle concurrency budget.

`probe-lint.ts` rejects fixture literals in control flow, including simple
constant aliases and argument aliases. ABI/layout constants remain allowed.
This heuristic is tested against all 214 accepted E1 main/pilot proposals; it
cannot prove absence of arithmetic encodings or other overfitting. The sealed
differential remains necessary. A red-team acceptance is reported as such even
when the model returned a general implementation instead of an obvious cheat.

`e2` runs single-attempt overfitting trials (`--red-team 1` is the first
wording, `--red-team simplest` asks for the simplest handler that passes the
visible probe). `e2 grade` replays every recorded handler, the canonical
control and the agent-written controls in `e2-controls/` through each gate
independently (lint, build, 30 visible runs, held-out, host ABI, mutants,
unchanged integration), so a handler stopped early by the loop still gets a
verdict from every gate. It makes no CLI calls. Each run also re-audits the E1
receipts: lint false positives over accepted handlers and the held-out failure
rate over every visible-passing attempt. In this design the mutant gate grades
the tests, not the candidate (mutants derive from the canonical handler), so it
cannot reject a candidate by construction.

Phase 2 (corpus-driven growth) uses `phase2`, also validate-only:

```sh
make -C arch/jitk/grow build build/phase2
grow=arch/jitk/grow/build
$grow/phase2 traces  --out /abs/TRACES                 # visible corpus seed traces
$grow/phase2 prepare --profiles /abs/PROFILES --traces /abs/TRACES \
  --fresh /abs/E3_RUN/fresh --database /abs/demo.db   # autoprofile + calibrations
JITK_VMM_BINARY=/abs/jitk-vmm $grow/phase2 replay --target T --profiles /abs/PROFILES \
  --out /abs/OUT --handler FILE.rs                      # model-free grading
$grow/phase2 batch --run-id ID --validate-only --vmm /abs/jitk-vmm \
  --profiles /abs/PROFILES --sqlite-elf /abs/sqlite3-static --database /abs/demo.db
$grow/phase2 assemble --accepted DIR --out /abs/GROWN_KERNEL
```

Calibrations run in two separate containers, 6 s apart, with the guest's
32 MiB address space (`ulimit -v`). Corpus integration gates use
`scriptc-corpus` reruns on visible and held-out programs that use the
target; held-out names and results never leave the corpus `.work/`. The
eight handlers of the phase-2 grown kernel are in `phase2-grown/`; results
and failure classes are in `EXPERIMENTS-PHASE2-2026-10-27.md`.

Shared tree (`EXPERIMENTS-PATHFS-2026-10-27.md`): calibrations run on the
guest's own file tree. `oracle.ts` packs the fixture's `resources` exactly as
`prepare.ts` does, materialises that archive (`kernel/packer.ts unpack`, files
0444, directories 0555), checks it re-packs to the same bytes, bind-mounts it
read-only into the unchanged `jitk-oracle:08` image and runs the payload under
`oracle-root` (`oracle-root.rs`, no_std Rust on the pinned toolchain's static
aarch64 musl, `make build`): open the payload, `chroot` into the tree,
cwd `/`, drop to 65534:65534 without groups, `execveat`. That container runs as
root with `--cap-drop ALL` plus only `SYS_CHROOT`, `SETUID`, `SETGID` and
`no-new-privileges`; strace's launcher prelude is split off into
`linux-NN.launcher.strace`. Each split's archive SHA-256 is sealed in
`plan.json`; `one`/`replay` refuse to grade unless the built image's
`packed.resources.sha256` equals it (mutants included), and `batch` pins the
trees, the launcher hash and the mode across resumes. `prepare --heldout-tree
variant` builds an audit profile whose held-out split runs on a different tree
(`data.bin/` a directory, plus an empty directory); it is used only with
`replay`, never as a batch gate. Seed traces and the SQLite integration keep the
container filesystem.
