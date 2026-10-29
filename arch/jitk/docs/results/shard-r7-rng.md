# R7 — fresh QuickJS and libc randomness after restore

Agent `r7-rng`, 2026-10-25. Worktree `/Users/noah/.t3/worktrees/sofort/t3-d3572620`,
branch `t3/quickjs-rng-reseed`. Scope: v1 work item 1 / exit criterion 6.

## Implementation and ordering

The ring payload now calls native `os.snapshotCheckpoint()` instead of invoking
fd100 directly from JS. The native call enters CHECKPOINT after bootstrap/helper
preparation, before any source read, tenant AsyncFunction, job or callback. On
restore its blocked write resumes through **EL1 `boot_info()` first**: that installs
the fresh host seed at control+0x208 and clock baseline. Only then does native EL0
read the 32 repair bytes and overwrite the **existing** JSContext.random_state.
No Math.random replacement or JS polyfill is involved: a function reference saved
before CHECKPOINT reads the same repaired native state.

The 16-byte host root is expanded using the RFC 8439 ChaCha20 block operation,
with the root repeated as a 256-bit key, zero nonce, and separate counters. Block
0 supplies private repair keys; block 1 supplies the public 128-bit run.entropy
receipt. Its disclosure does not disclose the private keys. AT_RANDOM receives a
separate 16-byte slice of block 0. A block keyed by the **actual repaired
AT_RANDOM**, counter 2, produces the public libc receipt. The hook checks the
actual global/thread stack guards and every allocator metadata tag before it
returns. Counter separation is for this one-shot repair, not a new tenant crypto
API. The C implementation passes published zero-key/nonce block-0 and block-1
known-answer vectors; the independent Rust receipt implementation passes block 1.

EL1 permits one successful fd101 read, then erases its kernel/control copies of
the host root. Later reads return EBADF. Native temporary buffers are explicitly
cleared before copying the **receipt**, generation and epoch into a 48-byte JS
ArrayBuffer. The bootstrap cannot expose the original root through its global
lexicals or `run.entropy`. A second native checkpoint call throws. Source and
canaries remain late-bound: the immutable prepared snapshot contains no tenant
source, data, credentials, or previous-run state. The R6 full-32-MiB pristine
comparison and RAM/EL1/JS leak checks remain in the harness.

## Libc inventory and repair boundary

Pinned source audit: `raw-r7-rng/inventory-{quickjs,musl,symbols}.txt`; upstream
source remains inside `/home/dev/r7-rng/` on kvm-dev.

| State | Observable / reason it matters | Treatment |
|---|---|---|
| QuickJS xorshift64* state in the existing context | Built-in Math.random, including saved references | Replace from a private fresh 64-bit slice; map zero to 1 |
| musl AT_RANDOM, retained in startup stack and libc.auxv | getauxval(AT_RANDOM); source for startup guards and mallocng | Overwrite its 16 bytes before tenant entry; return only a derived fingerprint |
| __stack_chk_guard and main-thread TLS canary | Native libc state; a memory bug could expose it | Re-run pinned musl __init_ssp and check both values, including musl's byte-1 zeroing |
| mallocng ctx.secret and meta_area.check | Heap metadata authentication, initialized from AT_RANDOM+8 | Rotate secret and **all existing metadata-area checks together**; assert every old check, preserve live allocations |
| rand/srand and random/srandom | No QuickJS std/os wrapper or source call; their linked native state is seeded by this hook | Seed the global generators independently; no inherited default state |
| Global rand48 family (__seed48) and seed48 saved-state buffer | No QuickJS std/os wrapper/source call; seed48 linked by repair | Install fresh 48-bit state and overwrite seed48's previous-state scratch buffer with a second call |
| rand_r, erand48/nrand48/jrand48 with caller-provided state | Caller-owned state, not startup entropy; these consumers are not linked by this profile | No snapshot-global state to repair; tenant-selected seeds retain their normal semantics |
| getrandom / /dev/urandom | No supported tenant entropy API in this kernel/profile: syscall is unregistered; no device file | No syscall added; no success/cryptographic-API claim |
| Temporary-file names | musl __randname uses the clock, not a startup-seeded generator; std.tmpfile writes cannot succeed in this read-only filesystem | Not a successful observable randomness path here; require fresh entropy if writable temp files are introduced |
| ASLR, deterministic hashes, ELF addresses, clocks and generation | Not random-state promises; static ET_EXEC layout and existing clock restrictions remain | Unchanged |

Mallocng 1.2.5 uses the secret only to initialize/check meta_area.check; group and
slot pointers are not encrypted with it. Walking the prepared linked list and
changing every check with the secret therefore preserves the live heap. This is
specific to the audited mallocng version, one thread and a pre-tenant checkpoint;
it is not a generic allocator reseed API. Guard rotation would invalidate any
active stack-protected frame, so **QuickJS and musl are explicitly compiled with
-fno-stack-protector**. Do not enable stack protection without moving/reworking
the checkpoint boundary. No pointer-mangling guard or additional startup PRNG was
found in this static musl profile. New contexts/threads are outside this profile;
the existing worker/thread syscall requirements are not added.

Math.random and the libc PRNGs retain their upstream **noncryptographic**
semantics. Their new state is independent of the snapshot and previous runs;
outputs from the current run may predict later outputs of that same PRNG. This
work does not turn Math.random, rand or random into a cryptographic source.

## Provenance and default-path preservation

At task entry the original checkout's default image matched R6. This worktree's
Mac-built default image still matches it at final audit:
`6c00a278cff95058241967655810dcf0cc9cfa1158a38630d818f26c3b07cbc6`.
The shipping payload stays
`ea2367e9dfc7484b6ad6d551b0bbc25d0247e2781f49ad822fa04c2753f80341`.
This agent made no default-payload/image change; its default-path tests use that
unchanged image. At final audit, the shared root checkout had advanced to
`d4dafd1` (R7 grow acceptance), with fstat/pread64 registered and default image
`75b2abe26021d9d0624b0555a64ed589d251cb7d30aa2965754974f3716d1732`.
Its packed payload still has the original ea2367… digest. That is parallel grow
work already landed in the root checkout, not an image produced by this branch;
these measurements do not certify the subsequently merged grow image. See
`root-checkout-final-audit.json` and the before/after digest receipts.

The manifest's packed.source_sha256 is the **input ELF digest**, not an upstream
source-archive digest. That ELF embeds QuickJS 2026-06-04, but its original musl
version/compiler/flags are not authenticated by the manifest, README, stripped
ELF or syscall contract. **An exact original build was not reproduced.** The new
ring-only provenance is explicit in `kernel/payload/ring-rng/PROVENANCE.json` and
the VM build logs. Source inputs were downloaded/extracted only into new empty
agent-owned VM directories, verified before extraction, and built there:

- QuickJS 2026-06-04 from https://bellard.org/quickjs/quickjs-2026-06-04.tar.xz;
  SHA-256 `b376e839b322978313d929fd20663b11ba58b75df5a46c126dd19ea2fa70ad2a`,
  matching the earlier retained perf/qjs receipt. No independently authenticated
  upstream checksum/signature was found for it.
- Vanilla musl 1.2.5 from https://musl.libc.org/releases/musl-1.2.5.tar.gz;
  SHA-256 `a9a118bbe84d8764da0ea0d28b3ab3fae8477fc7e4085d90102b8596fc7c75e4`.
  Its SHA-512 also matches Alpine 3.21's published APKBUILD checksum (retained).
  This uses the pinned source, not Alpine's additional patch set.
- GCC Ubuntu 15.2.0-16ubuntu1, O2, static non-PIE, 4-KiB max-page-size,
  -fwrapv -fno-strict-aliasing -fno-stack-protector; full flags in the recipe.
- New stripped ELF: **1,046,624 B** (below the brief's 1-MiB raw-file limit),
  SHA-256 `207ee7bb146012c481bc6c6c8f1b6709734f406d37204f66380df7c128e06ac8`.
- Ring kernel: SHA-256
  `a2b0d9824ded0a1f3ea946f8046a28921cb91d5ff2e3d700f6fb643e51f0c6ba`.
  Rust stable 1.99.1 was used on Linux, as in R6; Mac keeps pinned Rust 1.95.0.

The first build attempt exposed an escaped CONFIG_VERSION quoting error; its
failed build log is retained, the recipe was corrected, and a new empty final
build directory was used. Final binary provenance refers to that successful
build. The recipe subsequently gained an additional musl checksum verification
step, without changing compilation inputs or flags.

## Environment, methods and measured acceptance

Apple M4 Pro/macOS host; existing kvm-dev Ubuntu 26.04 arm64, Linux
7.0.0-38-generic, 6 vCPU / 9 GiB, 4-KiB pages, nested HVF → KVM. Every measured
VM batch holds `flock /home/dev/bench.lock`; raw environment/load/uptime are
retained. Other agents shared the physical Mac and both locks caused queueing.
Memory accounting is valid here; **all timings are nested and indicative**, not
metal results. No VM restart, host-kernel change, cloud resources or purchases.

**10,000/10,000 restores complete, with zero observed RAM/EL1/JS canary
leaks**, 10,000 fresh host roots, 10,000 distinct first Math.random samples,
10,000 distinct saved-function samples and 10,000 distinct libc receipts. The
host verifies the returned generation and public entropy receipt against the
fresh /dev/urandom root. All native guard/allocator assertions and seed-read /
repeat-checkpoint denial checks pass. The benchmark process exits 0, including
its final discard/full-memory pristine comparison. Snapshot creation is offline
and before tenant input; both beginning/end pristine assertions are retained.
Raw: `canary-10000.part-*.jsonl.gz`, `canary-parts.json`, `canary-check.json`.

Distribution sanity checks on the **first sample of each restore**, n=10,000:

| Statistic | Observed | Predeclared gate |
|---|---:|---:|
| Range / distinct | [0,1), 10,000 | [0,1), 10,000 |
| Mean | 0.489485269 | abs(mean−0.5) < 5/sqrt(12n) = 0.014434 |
| Population variance | 0.083183371 | abs(variance−1/12) < 0.01 |
| Kolmogorov–Smirnov D | 0.017925289 | < 1.95/sqrt(n) = 0.0195 |
| Chi-square, 20 equal bins / 19 df | 19.264 | < 60 |
| Lag-1 correlation across restores | 0.022595960 | absolute value < 5/sqrt(n) = 0.05 |

All gates pass. The first-sample mean is −3.642 standard errors from 0.5;
the KS statistic is below the chosen conservative threshold. These are finite
sanity checks, not proof of perfect uniformity or cryptographic quality. As an
additional diagnostic, the saved-function second samples have mean 0.501359778,
variance 0.084179721 and KS D=0.008086041 (`saved-random-distribution.json`).
They do not replace the first-sample tests.

**Negative control:** identical `rng_negative` source / new host harness against
the retained old payload+bootstrap snapshot gives **1 distinct value / 32**;
`check-rng.py` exits **1**. The new snapshot gives **32 / 32** and checker exit
**0**. Each old run still gets fresh host entropy, directly reproducing the
seed-injection-is-insufficient failure. Raw: `negative-{old,new}.jsonl` and
`negative-{old,new}-check.json`.

**Libc mutation:** a separate copied/relinked payload omits only
__jitk_reseed_libc, retaining the validation hook. It faults at the guard/metadata
assertion before any tenant result; the host rejects FINISH without completion,
exit **134**, n=1. The normal payload passes the same guard/metadata checks in
all 10,000 canaries. Raw: `mutation-libc-result.json`, `mutation-libc.stderr`,
`mutation-build.log`, `mutation-kernel-build.log`. Mutated images never replace
the measured/default payload.

Memory uses the R6 method unchanged: fresh process per point, at-birth
clone3(CLONE_INTO_CGROUP), one thread, N=1/16/64/256, two independent curves per
fixture (24 cells), 3-s settling, median of three samples 200 ms apart, linear
fit memory.current=fixed+N×marginal, average the two slopes. Stopped state is
validated FINISH before teardown. Shared snapshot/file cache is warmed outside
the measured cgroups and charged once, not added per VM. All-in includes KVM
kernel/page-table charges; this is retained CoW memory, not a hostile peak bound.

| Fixture | R6 MiB/VM | R7 MiB/VM | Delta MiB/VM | Two R7 slopes, B/VM |
|---|---:|---:|---:|---:|
| return2 | 0.484038 | **0.483572** | -0.000466 | 505,703–508,420 |
| one_tool | 0.503431 | **0.502618** | -0.000813 | 526,574–527,493 |
| promise10 | 0.548644 | **0.548957** | +0.000313 | 574,335–576,912 |

Deltas use R6's unrounded values (the brief rounds them to 0.484 / 0.503 / 0.549).
Minimum fit R²=0.99998865; ranges are repeatability, not confidence intervals.
Per-sample load1 ranges: return2 0.52–1.02, one_tool 0.46–0.91, promise10
0.39–0.84. All 24 children are removed, no OOM/max/swap events; all measured
one-second parked CPU deltas are 0 usec. The task parent cgroup was removed too.
Raw: `ledger-{0,1}-{return2,one_tool,promise10}-{1,16,64,256}.json`,
`ledger.log`, `ledger-cleanup.json`, `summary-r7-rng.json`.

Canary reset uses n=10,000 paired samples, nearest-rank percentiles as in R6's
offline reducer. It includes pending MMIO drain, whole-32-MiB MADV_DONTNEED and
257 register restores, and excludes the subsequent native repair/run:

| Metric, nested indicative only | R6 ms | R7 ms | Delta ms |
|---|---:|---:|---:|
| Reset p50 | 2.603 | **2.696404** | +0.093404 |
| Reset p99 | 3.440 | **5.895147** | +2.455147 |

Canary batch start loadavg 1.54 / 1.30 / 0.71, uptime 39162.36 s; wall time
435.576 s. R7 p99 is worse in this batch and still exceeds the metal target;
this nested/shared-host comparison does not isolate the reseed cost. The raw
host summary indexes floor(n×p), while the offline R6/R7 comparison uses
ceil(n×p)−1; this accounts for its slightly different 5.923022-ms summary p99.
No sub-ms reset, metal performance or full production gate-4 pass is claimed.

## Mac regression suites

All ten requested subtree commands pass on the Mac: kernel, vmm,
vmm/sandbox, protocol, executor, executor/policy, mcp, grow, bench, and
bench/hyperlight. Kernel real-VM/packer/handler/filesystem regressions pass;
protocol includes 71 corpus cases and 25,000 mutations; MCP passes 26 checks;
the executor passes six Hyperlight integrations. The separately enabled adapter
passes **13/13**, using its existing pinned source commit
8d208af8ac3ca53f2069c9ef0ca6a45d89e032d7 and existing worker/snapshot.

The initial sequence stopped at missing worktree TypeScript dependencies; after
locked executor installation it stopped at missing MCP SDK dependencies. Installing
MCP's locked dependencies and continuing passed. The default adapter invocation
reports its documented SKIP; explicitly enabling its pinned source and supplying
the existing watchdog/VMM binary produces the 13/13 PASS. These setup retries
are retained, alongside final logs, without editing unrelated source to pass.
Mac timing/test runs held `/tmp/sofort-bench.lock`; uptime/load are in the logs.
The separate nested Linux suite was not run by this agent (owned by r7-suite).

Exact commands and final logs: `raw-r7-rng/mac-suites.log` (kernel through
protocol), `mac-suites-rest.log` (executor and policy), `mac-suites-tail.log`
(MCP/grow/bench), `mac-hyperlight-final.log` (all 13 adapter checks).
The generated JSON receipts are retained in `mac-generated-receipts.tgz`;
tracked test-generated changes were restored.

## Reproduction and retained artifacts

All VM artifacts and original uncompressed raw data are under
`/home/dev/r7-rng/`. The checked-in raw directory retains the canary as four
concatenable gzip chunks, plus the 24 ledger JSON cells, summaries, negative and
mutation evidence, environment, inventories, ELF metadata and Mac receipts. The
prepared 32-MiB snapshots, debug executables, source archives and build logs stay
in the VM. Final cleanup removes task-owned intermediate build output: VM use fell from
299,888 to **122,180 KiB**; this includes retained snapshots and executables.
The full Mac worktree was 491,012 KiB before final evidence packaging, below
3 GiB even counting inherited files; final exact VM sizes are in cleanup.txt.
The minimal 3.9-MiB musl compiler installation remains for reproducibility.

Retained-artifact rerun on kvm-dev (use fresh output/snapshot names):

```sh
cd /home/dev/r7-rng
. /home/dev/.cargo/env
# The tracked ring payload is sufficient; no network is needed for this step.
(cd arch/jitk/kernel && RUSTUP_TOOLCHAIN=stable sh build-ring.sh)
cargo +stable build --offline --release --manifest-path arch/jitk/shard/Cargo.toml
mkdir replay
flock /home/dev/bench.lock sh -c '
  arch/jitk/shard/target/release/real prepare arch/jitk/kernel/dist/kernel-ring.bin replay/prepared >replay/prepare.jsonl
  arch/jitk/shard/target/release/real bench replay/prepared canary 10000 >replay/canary-10000.jsonl
'
flock /home/dev/bench.lock sudo -n env \
  JITK_LEDGER_ROOT=/home/dev/r7-rng \
  JITK_LEDGER_CGROUP=/sys/fs/cgroup/r7-rng-replay \
  JITK_LEDGER_SNAPSHOT=replay/prepared \
  JITK_LEDGER_OUTPUT=/home/dev/r7-rng/replay \
  JITK_LEDGER_FIXTURES='return2 one_tool promise10' \
  python3 arch/jitk/shard/harness/ledger-r6.py
python3 arch/jitk/shard/harness/check-rng.py replay/canary-10000.jsonl
python3 arch/jitk/shard/harness/analyze-r7-rng.py replay
```

The measured memory command used these exact environment values, except
snapshot=`final-r7`, output=`/home/dev/r7-rng/raw`, cgroup=`/sys/fs/cgroup/r7-rng`.
Compile its at-birth cgroup launcher with
`cc -O2 arch/jitk/shard/harness/spawn-cg.c -o spawn-cg`.
To reproduce source builds, run
`sh arch/jitk/kernel/payload/ring-rng/build.sh /home/dev/r7-rng/NEW_EMPTY_BUILD`
inside the VM, then copy its `qjs-ring` into the kernel payload directory. Do not
run downloaded sources/binaries on the Mac. The source builder rejects an
existing output directory and validates both archives before extraction.

The old/new negative test uses the same host executable and literal
`rng_negative` fixture:

```sh
flock /home/dev/bench.lock sh -c '
  arch/jitk/shard/target/release/real bench old-r6 rng_negative 32 >replay/negative-old.jsonl
  arch/jitk/shard/target/release/real bench replay/prepared rng_negative 32 >replay/negative-new.jsonl
'
# Expected exit 1 for old, 0 for new:
python3 arch/jitk/shard/harness/check-rng.py replay/negative-old.jsonl
python3 arch/jitk/shard/harness/check-rng.py replay/negative-new.jsonl
# Libc mutation rerun into a new directory (original run used default mutations/):
flock /home/dev/bench.lock sh arch/jitk/shard/harness/mutate-libc-r7-rng.sh /home/dev/r7-rng/replay/mutation
```

`old-r6` is an agent-owned byte-identical copy of the retained
`/home/dev/r6-shard/final-r6.{mem,regs}`; no other agent's files were modified.
The mutation rebuild uses the retained minimal musl compiler and source tree;
its copied object cache may be absent after scratch cleanup and is rebuilt.
The optional output-directory argument and rm -f permit this replay after cleanup;
the measured original mutation used the default directory and cached objects.

For offline replay from the repository:

```sh
gzip -cd arch/jitk/shard/raw-r7-rng/canary-10000.part-*.jsonl.gz > /tmp/r7-rng-canary.jsonl
python3 arch/jitk/shard/harness/check-rng.py /tmp/r7-rng-canary.jsonl
```

Mac prerequisite setup: `JITK_NODE=/tmp/jitk-09/node-real`,
`JITK_NPM_CLI=/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js`; run
`python3 arch/jitk/docs/delegate.py executor dependencies` and
`python3 arch/jitk/docs/delegate.py mcp build` when their locked dependencies are
absent. Exact combined equivalent of the successful subtree runs:

```sh
/usr/bin/lockf -k /tmp/sofort-bench.lock env \
  JITK_NODE=/tmp/jitk-09/node-real \
  JITK_NPM_CLI=/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js \
  JITK_VMM_BINARY=/tmp/jitk-01/r3/darwin/jitk-vmm \
  HYPERLIGHT_JS_SRC=/tmp/jitk-09/hyperlight-js \
  HYPERLIGHT_WORKER=/tmp/jitk-09/adapter-target/release/r2-worker \
  HYPERLIGHT_SNAPSHOT=/tmp/jitk-09/r3-snapshot /bin/sh -c '
    uptime
    for t in kernel vmm vmm/sandbox protocol executor executor/policy mcp grow bench bench/hyperlight; do
      python3 arch/jitk/docs/delegate.py "$t" test || exit "$?"
    done
    uptime
  '
```


## Commits, unfinished work and scope

- `1aa62be` — Reseed ring QuickJS context and musl state after trusted restore repair.
- `f7bfaf5` — Add restore RNG regression gates, libc mutation and R6 ledger replay.
- The final report/evidence commit follows these implementation commits (see branch log).

Only assigned source paths changed. No source edits to kernel/src/syscalls,
kernel/slots.json, kernel/syscalls.manifest.json, or arch/jitk/linux. Generated Mac
suite receipts outside scope are retained under this report and restored before
handoff. The measurement-only cgroup /sys/fs/cgroup/r7-rng was created and removed
outside the VM workspace as required by the R6 accounting method. No syscall, helper
process, thread-per-run or extra runtime process was added. Offline Python observers/reducers remain measurement-only.

Not done: metal latency certification, watchdog/Node IPC/arena-bound work,
cryptographic tenant random API, current-run cryptographic unpredictability for
noncryptographic PRNGs, multi-thread/context repair, a generic musl-version hook,
or default libkrun RNG changes. The shipping path continues using single-use VMs.
Performance comparisons include a newly built payload/toolchain and cannot
attribute all differences to reseeding alone.

## Findings → recommended changes

1. Adopt the ring-only native repair and one-shot secret delivery together; seed
   injection alone, or publicly returning the root, does not meet restore safety.
2. Bind prepared-image identity to payload, bootstrap and pinned libc repair
   provenance; preserve the pre-tenant boundary and allocator-tag assertions.
3. Keep the exact memory measurements as bounded fixture evidence, and measure
   latency on Asahi metal before making the v1 restore-latency claim.
4. If cryptographic tenant randomness or writable temporary files are required,
   design an entropy syscall/API with its owner; do not use Math.random or
   startup-seeded libc PRNGs as a cryptographic source.
