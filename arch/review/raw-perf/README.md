# R7 performance-review receipts

Review-only measurements for `../R7-REVIEW-perf.md`, source commit
`bb95bf2c3960128a794a76355b6258daec4199e0`. No product files changed.
Remote scratch was `/home/dev/r7-review-perf/`, on the existing kvm-dev VM.
It was deleted after export. Peak observed scratch was below 250 MiB.

`environment.txt` records kernel/tool versions, page size, load, disk usage and
artifact hashes. `bundle-source-check.json` verifies the reused JS bundles'
source-map content against current source. Rust was rebuilt from current source.
`external-source-check.json` also confirms current C bridge and policy source.
The prepared JS snapshot was copied from `/home/dev/r7-ipc/prepared.{mem,regs,layout}`;
Node/runtime were copied from R7-IPC, without modifying that directory.
The copied policy module is the existing executor policy; no provider was moved
into Rust. Native observations outside these probes cite the merged reports.

## Files

- `probe.rs`: direct public Slot API harness, five excluded warmups and immediate
  synthetic replies; results are checked by the reducer. Copy into scratch as
  `shard/src/bin/perf_review.rs`.
- `make-variants.py`: creates scratch-only modules/binaries for writable-extent
  discard, reset components and explicit WAIT/FINISH drain timing. Original
  `real_kvm.rs` is not changed. Parts `touched` reads host mappings only; it
  neither dirties pages nor populates KVM stage 2.
- `source-cases.mjs`: copy beside executor `build/code.js` and `shard-backend.js`;
  generates raw/executionBody/wire source variants and records byte sizes.
- `probe-{raw,wire}_{return2,one_tool}.jsonl`: original reset, 50 retained runs.
- `writable-{raw,wire}_{return2,one_tool}.jsonl`: alternative reset, same cases.
- `parts-{clean,touched}.jsonl`: 200 retained reset-component observations.
- `drain-*.jsonl`: explicit WAIT/FINISH drains, 50 observations per body;
  `drain-run-*.jsonl` contains the corresponding whole runs. These probes differ
  from the ordinary service and are not used to claim an optimized total.
- `full-faults.csv`, `writable-faults.csv`: perf stat counts for 50 retained +
  five warmup return2 runs. Corresponding JSONL is retained.
- `exits.data.gz`, `writable-exits.data.gz`: perf trace captures, ten retained +
  five warmup return2 runs, each file <1 MiB. `exit-format.txt` and
  `guest-fault-format.txt` come from this host's tracefs.
- `exit-counts.py`: bounded parser for this capture's fixed sample layout;
  `exit-counts.json` and `writable-exit-counts.json` include decompressed SHA-256,
  zero lost events, syndrome counts and guest PC counts. `perf script` returned
  no rows for these captures, so RAW samples were decoded using tracefs offsets
  and verified against `perf report -D`. Do not assume this parser supports an
  arbitrary perf capture. No sampled CPU percentage is used in the report.
- `node-bench.jsonl`: unchanged ordinary `shard-bench.js`, n=100, five warmups;
  includes caller latencies, metrics, Node/shard/watchdog CPU and deadline data.
- `ping.mjs`, `ping.jsonl`: transport-only sequential 32-byte echo, 1,000 retained
  observations after five warmups. CPU denominator is all 1,005 iterations.
- `service-probes.mjs`, `hol.jsonl`, `counts.jsonl`, `batch.jsonl`: same-owner
  scheduling, JSON/clone counts and one-call/ten-call real policy fixtures.
  Counting wrappers are used only for counts, not timing conclusions.
- `batch-trace.txt`: owner thread's strace for those two jobs. Counts include
  initial slot construction and both stopped retirement resets.
- `strace-return2.txt`: aggregate strace cross-check; includes warmups and the
  flock parent wait. It is an operation diagnostic, not an uninstrumented CPU
  breakdown, and its wait4 percentage must not be charged as service CPU.
- `memory.rs`: direct-run completed-slot private-dirty diagnostic. Initial
  `memory.jsonl` retains N=16/64/128; repeated pairs N=64/128 are in
  `memory-repeat-{0,1}.jsonl`, with glibc malloc huge pages explicitly disabled.
  The reducer uses two-point slopes only; these are neither cgroup totals nor
  confidence intervals. Initial low-N fixed-intercept noise is not discarded
  from the receipts.
- `reduce.py`, `summary.json`: nearest-rank timing summaries (µs), memory slopes
  and ioctl counts. Run `python3 reduce.py` from this directory.

## Reproduction outline

Use an isolated scratch copy of `arch/jitk/shard/{src,guest,Cargo.*,build.rs,abi.c}`
and the retained matching R7-IPC prepared/runtime artifacts. Copy Node to scratch;
the bundles require their normal `build/codec.mjs`, `build/shard-ipc.node`, policy
directory and runtime dependencies. Source maps let replay verify source identity.
All timing invocations below held `/home/dev/bench.lock`. Builds run offline
against the existing Rust toolchain and the dependency-free shard crate.

```sh
# cwd=/home/dev/r7-review-perf; all paths below belong to that scratch tree
cp probe.rs shard/src/bin/perf_review.rs
cp memory.rs shard/src/bin/perf_memory.rs
python3 make-variants.py
(cd shard && /home/dev/.cargo/bin/cargo build --release \
  --bin real --bin perf_review --bin perf_writable --bin perf_parts \
  --bin perf_memory --bin perf_drain)
node/bin/node runtime/build/source-cases.mjs > source-sizes.jsonl
flock /home/dev/bench.lock shard/target/release/perf_review prepared raw_one_tool.js 50
flock /home/dev/bench.lock shard/target/release/perf_writable prepared wire_one_tool.js 50
flock /home/dev/bench.lock shard/target/release/perf_parts prepared clean
flock /home/dev/bench.lock shard/target/release/perf_drain prepared wire_one_tool.js 50
GLIBC_TUNABLES=glibc.malloc.hugetlb=0 flock /home/dev/bench.lock \
  shard/target/release/perf_memory prepared wire_one_tool.js 128
sudo perf stat -x, -e task-clock,minor-faults,major-faults,kvm:kvm_exit,kvm:kvm_guest_fault,kvm:kvm_mmio,kvm:kvm_access_fault \
  -o full-faults.csv -- flock /home/dev/bench.lock \
  shard/target/release/perf_review prepared raw_return2.js 50
sudo perf record -q -e kvm:kvm_exit -o exits.data -- flock /home/dev/bench.lock \
  shard/target/release/perf_review prepared raw_return2.js 10
export JITK_SHARD_BINARY=/home/dev/r7-review-perf/shard/target/release/real
export JITK_SHARD_SNAPSHOT=/home/dev/r7-review-perf/prepared
JITK_SHARD_BENCH_N=100 flock /home/dev/bench.lock node/bin/node runtime/build/shard-bench.js
flock /home/dev/bench.lock node/bin/node runtime/build/ping.mjs
flock /home/dev/bench.lock node/bin/node runtime/build/service-probes.mjs hol
flock /home/dev/bench.lock node/bin/node runtime/build/service-probes.mjs counts
strace -ff -e trace=ioctl,write,read,waitid -o batch-trace \
  flock /home/dev/bench.lock node/bin/node runtime/build/service-probes.mjs batch
```

Collect all raw output before deleting the scratch directory. No kernel rebuild,
VM restart, metal certification or production change is implied by these receipts.
