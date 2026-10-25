# Copy-only grow controller

`../kernel/` is the only kernel source. Every run requires its `.READY`, copies
it into a fresh temporary Git repository, and cleans that repository and Cargo
cache on exit. Only the controller installs a proposal. Source and VMM hashes
must remain unchanged during verification. Receipts go to `results/<run-id>/`.

```sh
make -C arch/jitk/grow test
export JITK_VMM_BINARY=/absolute/path/to/built/jitk-vmm
# Existing missing-name demonstration, now using the stronger gate:
python3 -B arch/jitk/grow/loop.py --run-id unique-name --validate-only
# Request named handlers, even if already registered (no first-miss heuristic):
python3 -B arch/jitk/grow/loop.py --run-id sqlite-check --validate-only \
  --target fstat --target pread64 --samples 30 \
  --sqlite-elf /absolute/sqlite3-static --database /absolute/demo.db
make -C arch/jitk/grow demo ARGS='--live --fast'
```

`--target` is repeatable. Trusted profiles currently cover ppoll, rt_sigaction,
rt_sigprocmask, fstat and pread64; new names need an independent acceptance
profile in `profiles.py` as well as a kernel slot. Unsupported targets fail
closed. Omit `--target` to exercise actual missing-name discovery for the
original QuickJS/Lua demonstration. Only each transaction's target is removed,
inside the disposable copy; all other canonical handlers remain available.

REPLAY copies the canonical handler source; LIVE (`--live`) invokes the real
headless CLI. R7's fstat/pread64 implementations were written directly and
submitted through this same gate in REPLAY mode: no claim of sampled generation.
Both modes use the same transaction, tests, mutation rejection and integration.
The demonstration invokes that controller too; there is no second grow loop.

Acceptance requires all of:

- Independent semantic, error and state cases fixed in trusted probe sources.
  ppoll/signals retain complete Linux/guest trace comparison. The filesystem
  probe prints normalized ABI observations and exact returned bytes as hex;
  seek-position/reopen checks observe state independently. Kernel host tests
  additionally check all 128 stat bytes, padding and exact block accounting.
- At least two deliberately broken handlers that **compile and complete** but
  fail those checks. Build errors, crashes, incomplete output and timeouts do
  not count as semantic mutation rejection. Filesystem mutants include wrong
  size/page, changed seek offset, wrong errno and false success.
- An unchanged-program integration run against native Linux. QuickJS/Lua use
  their shipped binaries/scripts. SQLite uses the census's pinned binary and
  DB and all ten cases in `sqlite-corpus.json`, including SQL errors and a
  rejected write. Compare stdout, stderr and guest exit status exactly.

`--samples` controls repetition (default 30); repetition alone never accepts a
handler. `observations.py` retains raw registers and returns for registered
ENOSYS, argument-sensitive errors, tolerated missing calls, fatal control-byte
output and malformed/incomplete traces. Build/loader exceptions retain
`failure.json` and `build.log`. Host status/EOF never establishes guest success.

SQLite inputs are the unchanged census artifact SHA256
`005073a6c1c0e71c22ad8b752f1ffb6c35c8d913fe91f5795038c7d52cf639ff`
and 8192-byte census DB SHA256
`f3d4180cd07ad9eed5a674c7ff4e5f6d817eb517029c185f66af862a30eac059`.
The database contains `n(v)` with 9,1,5,3,5. Pack it as `/demo.db` and an empty
regular `/dev/null`; use `file:/demo.db?mode=ro&immutable=1`. This DB differs in
creation bytes from the pitch fixture, which has the same rows. Reuse the census
file for exact reproduction. `sqlite-build.sh` separately verifies the original
3.50.4 source recipe in a new empty directory **inside kvm-dev**; its modern
musl/GCC output is not substituted for the pinned integration executable.

Current byte comparison uses developer `grow-trace` fd2 hex records on the
libkrun path. The corpus uses printable stdout ending in LF. This does not
implement production native byte streams, arbitrary Unicode/binary stdout or
production stderr (owned by the ring/native-stream work). Signal profiles
still explicitly return ENOSYS; faccessat/getpid remain tolerated missing probes.
No writable filesystem, SQLite journal/WAL, locks, extension support or general
Linux ABI equivalence is claimed.

Prerequisites: Rust 1.95.0 + aarch64-unknown-none, clang/ld.lld/LLVM objcopy,
Docker native arm64 oracle (`docker build -t jitk-oracle:08 arch/jitk/grow/oracle`)
and a confined canonical VMM selected explicitly. All VM/oracle/model processes
have bounded deadlines and are killed/reaped. The oracle keeps all three stdio
fds as pipes, holds stdin open for ppoll and drains both output streams.

Live rails are unchanged: ephemeral CLI, ignored user config, read-only sandbox,
never-approval policy, exact one-file JSON schema, checked handler path/source,
and unchanged-source hash check. `CODEX_HOME/auth.json` is copied into a private
0700 scratch directory with mode 0600 and removed in `finally`; credentials never
enter prompts, receipts, repositories, VMs or compiler environments.
`JITK_GROW_CLI` and `JITK_GROW_MODEL` select the CLI/model. Failure never silently
substitutes replay. `JITK_GROW_TMPDIR` selects a scratch parent, not a saved repo.

`make test` uses small shipped traces, temporary repositories and actual kernel
sources. It checks failure classification, byte/status comparison, proposal
rails and the profile/mutant requirements without starting a VM. Full measured
R7 evidence and reproduction commands are in `RESULTS-R7-grow.md`.
