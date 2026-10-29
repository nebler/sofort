# R7 native byte streams, late-bound files and MCP run

Agent `r7-bytes`, 2026-10-25. Worktree
`/Users/noah/.t3/worktrees/sofort/t3-9f21ceb8`, branch
`t3/ring-native-byte-streams`. Based on `d4b31a0` (R7 RNG and grow included).

## Delivered

- Negotiated ABI 2.1 native feature bundle, separate binary stdout/stderr records,
  checked stream offsets and completion status/totals, bounded capture and JSON
  diagnostics. [ABI-R7.md](ABI-R7.md) specifies every field and bound.
- A shared prepared snapshot per static tool, stopped in EL1 before argv,
  AT_RANDOM, libc startup and ELF entry. Code-cache maintenance runs offline.
  Native libc starts with fresh AT_RANDOM rather than inherited libc state.
- Late-bound argv and files. A sealed, host-read-only memfd archive maps at
  GPA `0x82000000`, reserved KVM memslot **63**, with KVM_MEM_READONLY; no tenant
  bytes enter snapshots. Existing read/pread/fstat/lseek/openat archive handlers
  serve it. The ring-only fd table adds shared-description `dup3(file, stdin)`
  for gzip, with descriptor flags and lifetime tested against Linux.
- Persistent `real native-worker` and MCP `run(tool,args,files)`. Both streams
  use base64 objects, preserving NUL and invalid UTF-8. The worker has one fixed
  thread and one reusable slot/profile, with no per-call helper processes.

Implementation commits:

| Commit | Change |
|---|---|
| `b86c319` | Negotiated streams, native snapshots, RO extents and native worker |
| `3ce4f47` | MCP run with persistent Linux backend and bounded base64 streams |
| `19829cb` | Offline cache maintenance, fd differential, capture cap and hostile decoder tests |

The report and retained evidence are added by the final evidence commit.

## Platform contract

| Host | execute | run |
|---|---|---|
| macOS v1 | unchanged libkrun/HVF shipping backend | clear UNSUPPORTED |
| Linux arm64 | existing libkrun adapter until separately owned policy cutover | KVM ring `real native-worker` |
| Linux native-only config (`execute:false`) | UNSUPPORTED | KVM ring |

This implements the v1 Linux-only native decision. It does not claim that
execute has moved to the shard. Native input is an object of relative paths to
canonical base64; 64 files, 4 MiB total archive including metadata, 31 supplied
args/8192 bytes including argv[0] and NULs, 1 MiB combined output capture.
A completed nonzero guest exit is `isError:false`; operational failure is an
MCP error object. Capture exhaustion returns explicit outputLimited and a
prefix of the stream; completion still reports the actual program status.

The current Node timeout/cancellation kills the entire persistent native worker;
after that, restart the MCP server to admit another native call. Concurrent
native calls return LIMIT. This is not the r7-shard generation-lease scheduler.
(Superseded 2026-10-29: the worker enforces each request's budget itself and
survives it; Node restarts a stopped worker within a restart budget; see
ABI-R7.md "Persistent worker IPC".)

## Environment and method

Apple M4 Pro/macOS; existing kvm-dev Ubuntu 26.04 arm64, Linux
7.0.0-38-generic, 6 vCPU/9 GiB, 4 KiB pages, nested HVF → KVM. Rust stable
1.99.1 and clang are recorded in `raw-r7-bytes/linux/compiler-versions.txt`.
Mac tests use pinned Rust 1.95.0 and `/tmp/jitk-09/node-real` (v24.22.1).
The real Linux MCP test uses Node v24.13.0, downloaded into a new agent-owned
VM directory and verified against its published SHASUMS256.txt (retained).
No third-party binary was executed on the Mac. No VM restart/kernel change,
cloud resource, or purchase occurred.

All VM corpus/ledger/regression batches hold `/home/dev/bench.lock`. Load and
uptime are retained in the corpus environment/per-case rows and every ledger
sample. Final corpus environment load1 was 1.38; final ledger cleanup load1 was
0.63. Timings in raw JSON are **nested and indicative only**, never metal
numbers. Memory accounting is valid in this environment. No latency claim is
made. The benchmark lock caused several minutes of queueing behind r7-shard.

## Exact correctness corpus

Each case ran **twice**, in two independent persistent workers, with a fresh
snapshot reset/generation for every request. Linux ran the same pinned ELF and
argv against the same bytes in read-only-mode files. Comparisons are exact
`(stdout bytes, stderr bytes, exit status)` with no Unicode, whitespace, error or
status normalization. Guest status comes from NATIVE_EXIT, separately from the
host worker's process status. **82/82 tuples match** across 41 cases.

Six executable artifacts were checksum-verified against both retained census
metadata and explicit pins in `harness/prepare-native-r7.py`:

| Profile | SHA-256 |
|---|---|
| jq-musl | `8d689ba1c53a9aed4311a2f4406a33e8c7bbb4d7a54f50a7c8e1d393807e3ff7` |
| sqlite3 | `005073a6c1c0e71c22ad8b752f1ffb6c35c8d913fe91f5795038c7d52cf639ff` |
| lua | `6d825f225d7beff5a9707ec10db63cf3347524dc3ba183b16d0f6d809d2f0929` |
| micropython | `4626bf11458cb18785515ddc8a26246a12aafa602fa197346327602489c4ca62` |
| busybox | `e6e0d9874eef980f1bf6ce107494bbaed97f37449815acb991f4dd0ed4eb5ec8` |
| zstd | `5a52c331442b8939469c1337d2526167f4f17bf16fe976b37d8b8c1246b3002c` |

The exact paths, sizes and prepared image/snapshot hashes are retained in
`linux/profiles.json` and `linux/prepared.json`. No new third-party tool build
was necessary. SQLite is the census static binary using the accepted R7
fstat/pread64 handlers. BusyBox is the census's selected-applet build: gzip
supports compression, not gunzip; its error case tests an unsupported option.

| Profile | Case | stdout bytes | stderr bytes | Exit | Exact matches |
|---|---|---:|---:|---:|---:|
| jq-musl | aggregate | 2 | 0 | 0 | 2/2 |
| jq-musl | binary | 3 | 0 | 0 | 2/2 |
| jq-musl | bad-json | 0 | 61 | 5 | 2/2 |
| jq-musl | partial-error | 2 | 61 | 5 | 2/2 |
| jq-musl | missing | 0 | 71 | 2 | 2/2 |
| sqlite3 | aggregate | 3 | 0 | 0 | 2/2 |
| sqlite3 | ordered | 10 | 0 | 0 | 2/2 |
| sqlite3 | integrity | 3 | 0 | 0 | 2/2 |
| sqlite3 | bad-query | 0 | 82 | 1 | 2/2 |
| sqlite3 | missing-table | 0 | 48 | 1 | 2/2 |
| sqlite3 | readonly | 0 | 58 | 8 | 2/2 |
| busybox | sed | 23 | 0 | 0 | 2/2 |
| busybox | awk | 3 | 0 | 0 | 2/2 |
| busybox | grep | 16 | 0 | 0 | 2/2 |
| busybox | sort | 23 | 0 | 0 | 2/2 |
| busybox | wc | 17 | 0 | 0 | 2/2 |
| busybox | tar | 10 | 0 | 0 | 2/2 |
| busybox | sed-error | 0 | 27 | 1 | 2/2 |
| busybox | awk-error | 0 | 35 | 1 | 2/2 |
| busybox | grep-error | 0 | 33 | 2 | 2/2 |
| busybox | sort-error | 0 | 46 | 2 | 2/2 |
| busybox | wc-error | 0 | 44 | 1 | 2/2 |
| busybox | tar-error | 0 | 16 | 1 | 2/2 |
| busybox | grep-nomatch | 0 | 0 | 1 | 2/2 |
| busybox | gzip-text | 39 | 0 | 0 | 2/2 |
| busybox | gzip-binary | 160,118 | 0 | 0 | 2/2 |
| busybox | gzip-invalid-option | 0 | 29 | 1 | 2/2 |
| zstd | compress-text | 36 | 0 | 0 | 2/2 |
| zstd | compress-binary | 160,019 | 0 | 0 | 2/2 |
| zstd | corrupt | 0 | 42 | 1 | 2/2 |
| lua | sum | 3 | 0 | 0 | 2/2 |
| lua | file-binary | 160,000 | 0 | 0 | 2/2 |
| lua | binary-status | 3 | 4 | 42 | 2/2 |
| lua | error | 0 | 114 | 1 | 2/2 |
| lua | exit255 | 0 | 0 | 255 | 2/2 |
| lua | stdin-eof | 1 | 0 | 0 | 2/2 |
| lua | late-bind-a | 7 | 0 | 0 | 2/2 |
| lua | late-bind-b | 7 | 0 | 0 | 2/2 |
| micropython | sum | 3 | 0 | 0 | 2/2 |
| micropython | binary-status | 3 | 4 | 7 | 2/2 |
| micropython | error | 89 | 0 | 1 | 2/2 |

Raw evidence: `linux/corpus-{1,2}.json`, corresponding logs, and
`linux/NN-{stdout,stderr,linux_stdout,linux_stderr}.bin`. Large byte sequences
are separate files below 1 MiB with lengths/SHA-256 in JSON. Gzip/zstd each
compress deterministic 160,000-byte binary input containing NUL and invalid
UTF-8, forcing repeated record wraps and TX-credit returns. Lua emits those
same uncompressed bytes. jq partial-error preserves `1\n` before parse failure.
The two Lua late-bind cases reuse the same prepared snapshot and guest path
with different bytes, confirming the new input and reset rather than baked data.

Additional checks:

| Check | Measured result | Evidence |
|---|---|---|
| Shared fd semantic probe, same freestanding ELF on Linux/ring | exact 5 stdout + 5 stderr bytes, status 37; n=1 | `linux/native-fd.json`, `harness/native-fd-r7.c` |
| Rust tests | 9/9 PASS; includes 10,000 bounded header mutations | `linux/rust-tests-final.log` |
| Stream defense | generation, cursor/record bounds, flags, direction/kind, padding, offset/replay, totals, completion ordering, aggregate cap | streams.rs tests |
| Read-only input defense | truncated frames, bounds, traversal, duplicate/file-directory collision, binary data | inputs.rs tests |
| Fresh-directory reproduction | 6 pinned profiles prepared, 41/41 exact tuples, fd probe PASS; n=1 | `linux/reproduce-*.{log,json}` |
| Real SDK → MCP → persistent KVM ring worker | 10 calls PASS, n=1 integration batch | `linux/mcp-linux-final.log` |
| MCP capture cap | exactly 1,048,576 stdout bytes, outputLimited=true | same integration batch |
| MCP deadline | TIMEOUT, subsequent native call SANDBOX, requiring restart | same integration batch |
| QuickJS ring restore regression | 100/100, 100 distinct host roots/Math.random/libc receipts, pristine reset | `linux/qjs-canary.jsonl` |
| QuickJS Promise.all(10) | 5/5 exact result 45 | `linux/qjs-promise10.jsonl` |
| Mac required subtree suites | all ten PASS, including enabled Hyperlight 13/13 | `mac-suites-final.log` |

Host decoding rejects malformed native records with a bounded run error rather
than an assertion. It copies each bounded header/body once and never validates
then rereads guest payload. The old QuickJS/R6 research decoder is unchanged
except that kernel diagnostics now contain JSON; it still has its historical
assertion-based failure behavior. No native binary output is sent through LOG.

## Memory: one completed native Lua run

Same R6 method: clone3(CLONE_INTO_CGROUP), no post-spawn migration; one thread;
N=1/16/64/256, two repetitions; 3 s settling, three samples 200 ms apart,
then a 1 s idle CPU observation. Hold stopped completed VMs before reset/free.
Each VM runs the Lua sum over one 23-byte late-bound file and produces `10\n`.
Each has its own sealed 4 KiB input extent. Snapshots/file cache are shared and
prepared outside the measurement cgroup. Least-squares slope uses the median
memory.current at each N, with a separate fixed intercept per repetition.

| N | Rep 0 memory.current bytes | Rep 1 memory.current bytes |
|---:|---:|---:|
| 1 | 1,044,480 | 598,016 |
| 16 | 6,262,784 | 6,287,360 |
| 64 | 24,371,200 | 24,416,256 |
| 256 | 96,153,600 | 96,210,944 |

**Marginal total: 0.356879 MiB/VM** (374,214.6 B/VM).
The two slopes are 373,679.3 and
374,749.9 B/VM, R²
0.999987 / 0.999996.
Fixed intercepts are 475,535.9 /
305,464.1 bytes. All eight 1 s idle windows
record 0 CPU microseconds. OOM/max events=0; no child cgroups remain.

| Marginal component | Bytes/VM |
|---|---:|
| anonymous (guest CoW + host state) | 127,107.6 |
| file/shmem input extent | 4,096.0 |
| kernel (includes page tables/slab; do not add subsets again) | 240,874.0 |
| unattributed difference between fitted total and the three components | 2,136.9 |

The fitted marginal unattributed share is
0.571%.
The first N=1 point has **41.57% point-level unattributed charge**; later N=1
is fully attributed, and all N>=16 samples are within 3.76%. The fixed/first
point anomaly is retained, not silently discarded. This does not establish
closed point-level accounting for that first observation.

The initial implementation measured 2.660292 MiB/VM with the same
method. Post-restore `dc cvau` over the existing 0x400000..0x650000 loader range
caused stage-2 write faults/CoW even though program bytes did not change. Moving
that maintenance before the native checkpoint reduced the anonymous slope by
2,416,648.5 bytes/VM.
Before/after datasets and fitted components are retained. This is one small
Lua workload's marginal memory, **not a native-tool peak/admission bound**.
It excludes no measured per-VM input or host overhead, but does not establish
large-input/output memory classes, every tool's density, or hostile dirty bounds.

Raw: `linux/ledger-*-native_lua-*.json`, `linux/ledger-before/`,
`linux/ledger-final.log`, `linux/memory-summary.json`, and `linux/ledger-cleanup.json`.
Reducers: `harness/ledger-native-r7.py`, `harness/analyze-native-r7.py`.

## Default image and scope exceptions

The default libkrun image is byte-identical before/after:
`75b2abe26021d9d0624b0555a64ed589d251cb7d30aa2965754974f3716d1732`,
2,924,584 bytes. No default ELF/payload/image change or recertification is
required. Default macros/branches remain the same; all divergent fd/transport
logic is gated by transport-ring. The final default manifest is archived in
`mac-default-manifest.json`; full filesystem Linux differential still passes
probe/Lua/QuickJS 30/30 each and bootstrap 3/3.

Minimal changes outside the literal write list:

1. **kernel/src/user.rs:** select late-bound argv at a pre-ELF native checkpoint
   and avoid repeating code-cache maintenance after restore (all divergent behavior ring-gated). No native entry hook existed elsewhere.
2. **kernel/syscalls.manifest.json:** refresh seven source hashes and add a
   scoped ring amendment, version 6. Artifact generation correctly rejected
   stale source hashes after ring-only fd branches; historical semantic gates
   are explicitly still the default-image gates. Native evidence is separate.
3. **shard/src/real_kvm.rs (owned by r7-shard):** exactly two lines declaring
   child module native.rs, which accesses Slot internals. No scheduler, arena,
   register or memory-syscall change. **Reserve memslot 63** on integration.
4. New shard harness scripts/C fixture provide offline reproduction/evidence;
   no helper process is introduced into runtime paths. real.rs edits are
   additive native-worker/native-hold command branches plus CLI arity adjustment.

Tests regenerated kernel/executor/protocol/VMM receipts and fixture output;
relevant evidence was archived here and all unrelated generated tracked changes
were restored. No arch/jitk/linux/ edits. No kernel/src/arch/, mmu.rs or memory
syscall edits. The lead should regenerate final merged artifact receipts rather
than copying archived source paths into canonical READY files.

## Exact reproduction

Use a **new agent-owned VM directory** with this branch's kernel/shard/MCP
sources plus `grow/probe.ld` for the fd fixture. Existing census artifacts stay in /home/dev/r6-census. Never replace
an active prepared snapshot; the prepare harness rejects existing snapshot files.
All commands below run inside kvm-dev except the Mac suite block:

```sh
# Copy this branch’s kernel/shard/MCP sources into a fresh owned subdirectory.
export JITK_NATIVE_ROOT=/home/dev/r7-bytes/repro
python3 "$JITK_NATIVE_ROOT/arch/jitk/shard/harness/prepare-native-r7.py"
cd "$JITK_NATIVE_ROOT"
flock /home/dev/bench.lock python3 arch/jitk/shard/harness/native-corpus-r7.py
cp raw/corpus.json raw/corpus-1.json
flock /home/dev/bench.lock python3 arch/jitk/shard/harness/native-corpus-r7.py
cp raw/corpus.json raw/corpus-2.json
cc arch/jitk/shard/harness/spawn-cg.c -o spawn-cg
sudo flock /home/dev/bench.lock env JITK_LEDGER_ROOT="$JITK_NATIVE_ROOT" \
  JITK_LEDGER_CGROUP=/sys/fs/cgroup/r7-bytes-repro \
  python3 arch/jitk/shard/harness/ledger-native-r7.py
# Retained ledger-before/ is optional and adds the historical comparison.
python3 arch/jitk/shard/harness/analyze-native-r7.py raw
python3 arch/jitk/shard/harness/check-native-fd-r7.py

# With Node >=24 + locked MCP SDK dependencies present inside the VM:
JITK_NATIVE_BINARY="$JITK_NATIVE_ROOT/arch/jitk/shard/target/release/real" \
JITK_NATIVE_PROFILES='{"lua":"/home/dev/r7-bytes/repro/images/lua-r7"}' \
flock /home/dev/bench.lock node arch/jitk/mcp/native-linux-test.mjs

# Host defensive unit tests, without KVM:
rustc --edition=2024 --test arch/jitk/shard/src/streams.rs -o /tmp/r7-streams
/tmp/r7-streams
rustc --edition=2024 --test arch/jitk/shard/src/inputs.rs -o /tmp/r7-inputs
/tmp/r7-inputs
```

Actual final corpus/ledger ROOT was `/home/dev/r7-bytes`; the corresponding
commands, output and per-case argv/input hashes are retained. The fd probe builds
with `clang --target=aarch64-unknown-none -ffreestanding -nostdlib
-fno-stack-protector -O1`, links with grow/probe.ld, builds via the native ring
recipe, and compares with normal Linux; `linux/native-fd.json` records the tuple.
QuickJS builds use the same build-ring.sh with JITK_RING_NATIVE unset, then
`real prepare ...`, `real bench ... canary 100`, and `... promise10 5`.

Mac exact suite environment:

```sh
export JITK_NODE=/tmp/jitk-09/node-real
export JITK_NPM_CLI=/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js
export JITK_VMM_BINARY=/tmp/jitk-01/r3/darwin/jitk-vmm
export JITK_VMM_BUILD=/tmp/jitk-01/r3/darwin
export JITK_KERNEL_IMAGE="$PWD/arch/jitk/kernel/dist/kernel.bin"
export JITK_TEST_IMAGES="$PWD/arch/jitk/shard/raw-r7-bytes/mac-fixtures"
export HYPERLIGHT_JS_SRC=/tmp/jitk-09/hyperlight-js
export HYPERLIGHT_WORKER=/tmp/jitk-09/adapter-target/release/r2-worker
export HYPERLIGHT_SNAPSHOT=/tmp/jitk-09/r3-snapshot
uptime
for t in kernel vmm vmm/sandbox protocol executor executor/policy mcp grow bench bench/hyperlight; do
  python3 arch/jitk/docs/delegate.py "$t" test || break
done
```

## Cleanup and retained runtime artifacts

Observed agent VM disk use before cleanup: 870,188 KiB;
after removing compilation caches, transfer tarballs and the fresh reproduction
sandbox: 575,996 KiB. Both are below the 5 GiB budget.
The final prepared profiles and `bin/real` remain under `/home/dev/r7-bytes/`
for lead verification; Linux Node/SDK runtime prerequisites, source and raw data
remain too. They are final runnable artifacts, not cargo build caches.
`linux/cleanup.json` records the retained worker digest. The measurement cgroup
was removed after confirming no children/OOM events. Mac worktree disk use at
final audit is recorded in `disk-use.txt` (below 3 GiB). No raw file over 1 MiB
is committed. Generated unrelated test receipts/scratch were restored/removed.

## Not done / limits

- No Mac native byte streams, gate-8 cutover, production Node-policy IPC,
  multi-owner native scheduling or generation-lease integration.
- No dynamic ELF, native threads, network, writable files, stdin payload binding,
  console fd duplication, full dup3 domain, full Linux ABI or large/adversarial
  SQLite/temp/journal/WAL behavior. This is the explicit census static subset.
- Native slots still use R6's full writable 32 MiB mapping in this branch. The
  separate arena work must select an appropriate native memory profile before
  claiming a hostile upper bound. The separate RO input memslot is enforced.
- The 1 MiB output cap and fixed worker admission are implemented and tested;
  general streaming-to-client delivery, blobs and larger captures are not.
- No snapshot signing/cache-key verification, new shard confinement proof,
  metal performance, broad fuzz assurance or all-tools memory ledger.

## Findings → recommended changes

1. **Keep cache maintenance offline.** It cost 2.3 MiB CoW/run when placed after
   the checkpoint. The final shared native profile is cheap for this Lua case;
   retain the before/after ledger as a regression reference.
2. **Integrate native runs with r7-shard ownership/leases and reserve memslot 63.**
   The current persistent serial adapter is functional; production scheduling
   must use the same run/generation barrier, preserve host shadow validation,
   and replace whole-worker timeout/restart behavior deliberately.
3. **Keep byte streams and JSON diagnostics separate.** Validate native identity,
   offsets, padding, capture budgets and terminal totals before accepting bytes;
   do not infer guest success from a VMM process exit or UTF-8 text.
4. **Make native writable memory classes explicit before admission claims.**
   0.357 MiB is one measured marginal workload, not the peak or hostile bound;
   account for input extents and large capture allocations too.
5. **Expand corpus breadth after integration.** More SQLite size/query cases,
   gzip/zstd decompression profiles, Unicode filenames and cancellation/recovery
   deserve explicit gates; keep current 82 exact tuples and fd probe as baselines.
