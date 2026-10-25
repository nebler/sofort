# Copy-only grow controller (owner 08)

`../kernel/` is the only kernel source. Its `.READY` marker is required. Every
controller run copies it to a newly allocated temporary Git repository, deletes
ppoll and the two signal handlers there, and grows them back. The repository and
private Cargo target are cleaned on exit. No saved repository path is an input.
`JITK_GROW_TMPDIR` optionally chooses a scratch parent; every run still allocates
a fresh child directory. Outputs remain in `results/<unique-run>/`.

```sh
make -C arch/jitk/grow test
make -C arch/jitk/grow build
export JITK_VMM_BINARY=/absolute/path/to/built/jitk-vmm
make -C arch/jitk/grow grow
make -C arch/jitk/grow demo
make -C arch/jitk/grow demo ARGS='--live --fast'
# Controller alone, real generation:
python3 -B arch/jitk/grow/loop.py --run-id unique-name --live --validate-only
```

Default **REPLAY** restores recorded accepted proposals from canonical kernel
handlers, after actual missing-handler discovery. There is no duplicate proposal
source tree. **LIVE** invokes `codex exec` for each observed miss and runs the
same build, native-Linux differential and 30-fresh-VM acceptance gates. The demo
labels both modes explicitly. `--live` prepares a new complete run before its
presentation; its preparation is not a 45-second claim. It never substitutes
replay after a failed model call. `--fast` only removes presentation pauses.

Live rails: ephemeral CLI, ignored user config, read-only sandbox, approval
policy never, exact one-file JSON schema, controller-validated path and source,
and unchanged-source hash check. The controller alone installs the handler.
`CODEX_HOME/auth.json` (default user's Codex home) is copied to a private 0700
temporary directory as 0600, removed in `finally`, then the directory is cleaned.
Auth is never placed in prompts, receipts, worktrees, VMs or compiler environments.
`JITK_GROW_CLI` optionally selects the CLI executable; `JITK_GROW_MODEL` selects
its model. Absence/failure of CLI auth is reported honestly as unavailable.
These are developer-loop rails, not confinement of a malicious compiler.

Prerequisites for growth/demo: Rust 1.95.0 with aarch64-unknown-none, LLVM/ld.lld,
Docker with local native-arm64 oracle image (`docker build -t jitk-oracle:08
arch/jitk/grow/oracle`), and the built canonical v2 VMM selected explicitly by
`JITK_VMM_BINARY`. VMM uses `--image`, canonical confinement and host-only sandbox
ack on a pipe. Every VM is deadline-bounded by the external Python supervisor,
killed on discovery/timeout, and reaped. At most one VM is active in this loop.
No other area's temporary host or receipt is selected implicitly.

Tests need Python and Git, plus the copied canonical tree for the copy/regrowth
check. Small recorded trace fixtures ship under `tests/fixtures`; tests do not
read release receipts or saved absolute paths. Patch tests create fresh temp
repositories. R3 full historical evidence was moved to the owner's archive;
this package never reads it. Fallback kernel, duplicated proposals and obsolete
QuickJS spike workloads/oracle scripts were deleted. Retained growth-only inputs
are signal ABI probes/linker script, strict normalizer, Lua script, and the
licensed static Lua payload. Canonical kernel supplies QuickJS, the ppoll probe, and all handlers.

Lua is packed using `JITK_ELF` + `JITK_ARGV_JSON`, without a filesystem. Its
count/sum/max output matches normal native Linux. The signal profile always
returns ENOSYS and is compared with explicitly injected Linux, not normal signal
semantics. Lua already computes with missing-slot ENOSYS; growth makes that
contract explicit and verified. Full Lua startup ABI equivalence is UNVERIFIED.
The profile must stay <=350 source lines. All timing receipts retain load; they
are contended functional diagnostics, not quiet-host performance claims.
