# Native grow controller

TypeScript port of the main-branch Python controller in `../grow`. Same gates,
CLI flags and receipt filenames; results live under `grow-ts/results/<run-id>`.
The Python implementation and in-container oracle script are unchanged.

```sh
make -C arch/jitk/grow-ts spike
make -C arch/jitk/grow-ts build test
export JITK_VMM_BINARY=/absolute/path/to/jitk-vmm
arch/jitk/grow-ts/build/grow --run-id native-replay --validate-only
arch/jitk/grow-ts/build/grow --run-id native-sqlite --validate-only \
  --target fstat --target pread64 --samples 30 \
  --sqlite-elf /absolute/sqlite3-static --database /absolute/demo.db
arch/jitk/grow-ts/build/grow --run-id native-live --validate-only --live --target ppoll
```

The Makefile installs exactly **scriptc 0.4.5**, pinned by package-lock.json, and
builds a native executable for the host (tested macOS arm64). `make test` compiles
and executes the test suite natively; it starts no VM or Docker container and
uses a test CLI for the credential/sandbox tests. `--fast` preserves the Python
demo's no-op behavior. Default samples remain 30.

Prerequisites and pinned SQLite input hashes are in `../grow/README.md`.
Use the existing `jitk-oracle:08`; never rebuild it for these runs. Native builds
still invoke the existing kernel build tools and Docker Python oracle. The
binary finds assets relative to its compile-time source directory, so rebuild
if the checkout moves. `PORT-NOTES.md` maps modules for the separate E1 work;
`SCRIPTC-GAPS.md` documents compiler workarounds; `PARITY.md` records acceptance.

`parity.py` runs both controllers with `--validate-only`, verifies release marker
hashes, and compares receipts. Pass `--compare-only` to inspect existing runs.
No parity result relies on replaying saved receipts as controller input.
