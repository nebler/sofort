# scriptc 0.4.5 → jitk census

The controller and Linux strace driver are TypeScript compiled by **scriptc 0.4.5**.
Node runs only the expected-output side, using the pinned corpus's own shim,
directives, decorator transform and JSX helper. No Python is used.

```sh
make -C arch/jitk/scriptc-corpus census
make -C arch/jitk/scriptc-corpus run
make -C arch/jitk/scriptc-corpus test
```

`census` and `run` both execute the complete build → Linux/Node → ENOSYS
experiments → canonical packer/VM pipeline. Completed receipts are resumed;
ELFs and raw traces are deleted after each receipt. A failure in one program
does not stop the corpus. Infrastructure or disk-guard failures stop the run.

Requirements: Node 24+, npm, Zig at `$ZIG` (default
`/Users/noah/.local/share/zig-0.16.0/zig`), Docker with the **existing**
`jitk-oracle:08` image and the existing `node:24-bookworm` image, and the local
scriptc checkout (`$SCRIPTC_REPO`, default `/Users/noah/scriptc`). The pinned
corpus is extracted with `git archive` from tag v0.4.5, commit
`4ee477d11eb9a71f0a018e5f5bed171a954fc2f7`; local uncommitted corpus additions
are excluded. The snapshot's node_modules points to the checkout's installed
dependencies. Both the archived and installed dependency lock hashes are recorded;
these installed packages are an environmental input, not vendored dependencies.

The payload image digest is
`sha256:88f8f82bb1850e61c04fd9e47813cd054f5e18eaf6143c4cebeb3d3667818d0a`.
Linux Node 24.22.0 runs from the separately pinned, already installed image
`sha256:14078204b6bb268c107ceff6d3c43f45a888105e5c2b18b14c32b3409d93a1b0`.
Neither image is built or retagged. The Alpine oracle contains no Node, hence
the second image. This removes macOS-vs-Linux expected-output differences;
Node uses glibc while payloads use musl, so libc-sensitive output still needs
triage. Both execute with an empty closed stdin, identical controlled environment
and a fresh writable working directory, with read-only links to corpus fixtures.
Networking is disabled. External network tests can therefore fail for environmental
reasons; they are not automatically compiler findings.

Two workers share one long-lived oracle container and one Node container. At most
two payload/Node runs are active in total, reserving an oracle slot for the other
grow agent. Each program is isolated by its fresh cwd; runtime temp files live
in container tmpfs. Process creation is bounded, timed-out host tools are sampled
on macOS before kill/reap, and containers are removed in `finally`.

The source kernel is copied into `.work/kernel/`; all image/Cargo/native-tool
outputs stay in `.work/`. A successful pack is built with the unchanged kernel
and `grow-trace`, and run using `$JITK_VMM_BINARY` (default
`/tmp/jitk-r8/vmm-mac/jitk-vmm`). Guest stdout, developer fd2 log bytes and terminal
exit are decoded with the canonical grow-trace observer and compared as byte
hashes to Linux. A packer refusal is a measured loader failure, never a syscall
failure. The production printable-output protocol itself is another compatibility
limit; arbitrary Unicode/control/unterminated output may require transport work.

## Selection and held-out use

```sh
make -C arch/jitk/scriptc-corpus census ARGS='--id pilot --limit 20 --workers 1'
make -C arch/jitk/scriptc-corpus census ARGS='--id timers --filter timer'
make -C arch/jitk/scriptc-corpus census ARGS='--id visible --selection visible'
make -C arch/jitk/scriptc-corpus run ARGS='--id hidden --selection heldout'
```

A random seed is created once in private `.work/split-seed` (mode 0600). The
selection is deterministic: SHA256(seed + NUL + relative program name), first
32 bits modulo 100, below `--heldout-percent` (default 20). `--seed VALUE` lets
the gate owner reproduce a split; keep it private. Summary JSON records only a
seed commitment and aggregate held-out counts. Public CSV excludes held-out
identities, hashes and results. Never mount `.work/`, the full corpus snapshot,
or the split seed into a proposer checkout or include them in grow prompts.
Part 2 should give proposers only visible-case evidence and keep held-out runs
in the trusted gate. This is selection/isolation support, not a claim that an
agent with unrestricted access to the full public corpus cannot infer membership.

Use a fresh `--id` after changing runner, driver, compiler, kernel, selection or
split pins. `.work/<id>-manifest.json` refuses incompatible resumes. `report`
regenerates aggregate results from a completed local journal. Only the default
`full` id writes public `summary.json` and `census.csv`.

## Interpretation

Tiers describe workload capabilities: compute/stdio (T1), files/timers/clocks (T2),
threads/Workers/subprocesses/async rename (T3), networking (T4). Classification uses
source features and observed high-level syscalls. Allocator CPU-info reads and
optional helper setup do not automatically turn every allocation into a T2/T3
workload; their syscalls are still recorded. Refused programs have source-only
provisional tiers. This is conservative static classification, not full dependency
analysis.

Each absent syscall is counted once per program. The launcher's initial execve
is excluded. For programs with missing syscalls, a second ordinary Linux run
checks output/exit stability for Node-matching baselines, then strace injects ENOSYS into **one missing
syscall at a time**. A stable output/exit change is an observed blocker; unchanged
output/exit is tolerated. These are causal counterfactuals on Linux, not proof
that implementing that syscall alone makes the program run on jitk. Single
blockers are ranked first. Runtime masks, mmap shapes and ppoll descriptor/clock
restrictions are reported separately from absent syscall numbers. Read-only
filesystem semantics and resource contents also matter.

Node comparison follows upstream: stdout and declared exit must match, with
stderr compared for exit-0 programs; nonzero exception formatting is an upstream
documented divergence. Linux-versus-jitk always compares stdout, stderr and exit.
Unstable Linux baselines and Linux-versus-Node mismatches are excluded from causal
blocker claims. The mounted driver batches the repeat and individual injection
legs in one Docker exec; it never executes more than one payload at a time per
worker. Every local
receipt records source/ELF/output/trace hashes; raw per-program artifacts are
pruned, with bounded mismatch snippets retained privately for triage.

All large artifacts, logs, receipts and private selections are ignored in
`.work/`. `df -h /System/Volumes/Data` is logged at startup, every 200 completed
programs and completion, with a 15 GiB stop threshold. Public CSV is rejected
above 1 MiB. Never commit raw outputs.

The aggregate Makefile was deliberately left untouched. To opt into this costly
census, add the following recipe under a dedicated target in `arch/jitk/Makefile`:

```make
scriptc-corpus: tools
	+@$(MAKE) -C "$(ROOT)/scriptc-corpus" census
```
