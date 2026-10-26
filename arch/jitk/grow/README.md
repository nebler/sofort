# Native TypeScript grow controller

TypeScript compiled with **scriptc 0.4.5** is the sole grow-loop implementation.
`../kernel/` remains the only kernel source. The controller requires its `.READY`,
copies it into a disposable Git repository, removes independent tests before
proposal generation, and removes that repository/Cargo cache on exit. No Python implementation
source is tracked in grow. Generic process, hashing, JSON and assertion helpers live
in `lib.ts` for later consolidation with the other TypeScript ports.

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
use `file:/demo.db?mode=ro&immutable=1`. `sqlite-build.sh` verifies the original
3.50.4 source recipe inside kvm-dev; its output does not replace the pinned ELF.
Local reproduction inputs used in `PARITY.md` are `/tmp/growos-inputs-20261026/sqlite3-static`
and `results/r7-grow/demo.db`. `build/sqlite-checks --run-id ID --validate-only
--sqlite-elf PATH --database PATH` runs causal before-state, ENOSYS, loader and
fatal-output diagnostics through the same native helpers.

The in-container driver is also scriptc TypeScript (`oracle-profile.ts`). `make
build` cross-compiles **static aarch64 Linux musl** using `SCRIPTC_TARGET` and the
pinned matching runtime pack. Set `ZIG` to override
`/Users/noah/.local/share/zig-0.16.0/zig`. The host mounts `build/oracle-profile`
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
The current kernel build still uses its own Python tooling, owned by the kernel
port; grow executes no Python. The independent Rust host assertions are preserved unchanged in trusted
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
