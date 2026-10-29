# R6 — real jitk + static QuickJS on the device-free shard

Measured 2026-10-25, agent `r6-shard`. **Real-guest all-in memory is now measured:**
**0.232 MiB/VM at repaired READY; 0.484 / 0.503 / 0.549 MiB after return2 /
one echo / Promise.all(10); 1.422 MiB after structured 64 KiB JSON.** These are
cgroup `memory.current` slopes, including KVM kernel charges. This replaces the
parts-based estimate for these explicitly bounded fixtures.

**No production reuse/cutover claim:** nested restore p99 exceeds 1 ms, the
existing QuickJS RNG repeats after restore, watchdog leases are absent, and the
stage-2 writable arena is not bounded. Node policy IPC is **out of scope (gate 6)**.
The aggregate Mac test result and its independent nested-test problem are below.
No commits were made.

## Implementation and scope

- New Cargo feature `transport-ring`, `kernel/build-ring.sh`, `make -C kernel ring`,
  separate `dist/kernel-ring.bin` and `target-ring/`. Same shipped static qjs ELF,
  same validated packer and Linux syscall handlers; separate prepared bootstrap.
  Default virtio/FDT/GIC/clock/syscall behavior remains unchanged. **The default
  image is byte-identical to the starting image**, SHA-256
  `6c00a278cff95058241967655810dcf0cc9cfa1158a38630d818f26c3b07cbc6`.
- The ring image has no virtio, GIC, guest timer programming, WFI parking or HVC
  transport. Its touched AArch64 boot, stage-1 tables, trap-frame interface, EL0
  entry, boot/repair data, doorbell and host-clock access are under `src/arch/aarch64/`.
- Real 16 KiB control + two 32 KiB byte rings, ABI-v2 header/cursors/order/bounds,
  MMIO SUBMIT / WAIT / FINISH, and bounded **kernel-side reply demultiplexing**.
  [ABI-R6.md](ABI-R6.md) documents every profile restriction/deviation, including
  the experimental fd bridge, 1 KiB JSON replies, no `/cap` files or bulk replies,
  no typed-array codec, frozen-in-job clocks and unrepaired RNG state.
- `shard/src/bin/real.rs` loads the real kernel, not the assembly fixture. Offline
  boot initializes QuickJS and evaluates the prepared bootstrap, then exits at a
  dedicated CHECKPOINT **before tenant input**. The checkpoint is inside the bootstrap's top-level
  evaluation, after helper/read-handler preparation; the run-entry suffix has
  not executed. It is not a native after-JS_Eval embedder callback. Completing
  that MMIO precedes
  capture of **all RAM + 257 KVM_GET_REG_LIST registers**, including system and
  SIMD/FP state. Snapshot files are create-new, mode 0444, opened read-only.
- One stable 32 MiB KVM memslot per VM, file-backed MAP_PRIVATE / MADV_NOHUGEPAGE.
  Stopped reset completes pending FINISH MMIO, MADV_DONTNEEDs the whole mapping,
  then restores registers. No memslot changes, remapping, reboot or per-call
  process. Trusted EL1 repair installs generation, fresh host entropy and clock
  baseline before EL0 resumes. The same prepared file backs every slot.
- One fixed owner thread also synthesizes echo completions. Actual QuickJS
  promises enqueue ten records before one WAIT; replies are published together
  in reverse ID order. The demux routes them to their bounded per-ID buffers.
  The original four-owner assembly-fixture executable remains available and its
  selftest still passes. The real-guest experiment uses **one** owner, not four.

## Environment and exact fixtures

Apple M4 Pro/macOS host; existing `kvm-dev`, Ubuntu 26.04 arm64, Linux
`7.0.0-38-generic`, 6 vCPUs, 9 GiB assigned, 4 KiB pages, no swap. Nested
**HVF → KVM: memory is valid here; all timing/CPU numbers are indicative only**.
Nothing changed or restarted kvm-dev, its kernel or global toolchains. No cloud
resources, third-party downloads or new dependencies were needed by the shard.
Rust stable 1.99.1 for the Linux ring/shard build; the default Mac build retains
its pinned Rust 1.95.0. Exact receipts: [environment.txt](raw-r6/environment.txt).

All measured VM runs hold `flock /home/dev/bench.lock`. Raw timing batches retain
load/uptime; main fixture batch start load1 was 0.62–0.75, and memory observations
0.31–1.06; individual source records carry exact values. The Mac aggregate suite
and another agent shared the physical host; the benchmark lock does not isolate
its physical CPU or disk. Do not compare these timings to metal or the previous
round as a causal performance change.

Fixtures are literals in `src/bin/real.rs`, frozen in
[measured-source.tgz](raw-r6/measured-source.tgz):

| Fixture | Actual guest work / validated result |
|---|---|
| repaired READY | Restore checkpoint, run trusted EL1 repair, stop at offline REPAIRED_READY before returning to JS or consuming source |
| return2 | Compile a fresh AsyncFunction and return `2` |
| one_tool | `await tools.echo(41)`; echo returns argument array `[41]`; result `42` |
| Promise.all(10) | Ten real echo promises before replies; validate sum `45` |
| json64k | Build 400 structured rows (ids, names, booleans, numbers, tags, nested fields), pad encoded JSON to **exactly 65,536 bytes**, parse and stringify, return length `65536` |
| canary | Require absent prior global, set tenant global, return generation, entropy and first built-in Math.random sample |

JSON generation occurs **inside the post-restore guest**, so it also dirties the
source object graph; its rows/source/parsed graph coexist during work. This is
not bit-for-bit the previous native census ingress fixture, a 64 KiB string-only
benchmark, or a materialized 64 KiB tool reply. Tiny tool fixtures omit the
codemode binary codec and real policy/provider path. The measured subset is
JSON-only; these results do not establish the full product semantics' footprint.

## All-in memory ledger

Two independent curves, each **N=1/16/64/256**, fresh shard process per point.
After validated guest completion/READY stop: settle 3 s; take three samples
200 ms apart; measure one second of parked CPU. Fit `bytes=fixed+N×marginal`
to each curve's per-point median, then average the slopes, as in
[linux-ledger](../../research/perf/linux-ledger/RESULTS.md). An extra READY point
at N=1,024 validates scale; both WAIT experiments also reach N=1,024.

| Stopped state | All-in marginal MiB/VM | Two-slope range B/VM | Process private-dirty KiB/VM | Cgroup kernel KiB/VM | Fitted fixed MiB |
|---|---:|---:|---:|---:|---:|
| repaired READY | **0.232380** | 243,413–243,923 | 12.12 | 225.61 | 0.268 |
| after return2 | **0.484038** | 507,329–507,773 | 260.12 | 233.65 | 0.257 |
| after one_tool | **0.503431** | 527,786–527,986 | 280.12 | 233.63 | 0.333 |
| after Promise.all(10) | **0.548644** | 574,539–576,051 | 328.11 | 233.62 | 0.417 |
| after structured 64 KiB JSON | **1.421649** | 1,489,648–1,491,765 | 1,220.12 | 233.63 | 0.277 |

The repeatability range is **not a confidence interval**. Minimum current-fit
R² is 0.999982. The process-private-dirty column includes host state; it is not
an isolated guest dirty-page census. For example return2's process PSS slope is
264.11 KiB/VM. Adding cgroup kernel to PSS is only a cross-check and can double
count `kvm_run`; it is not added to the all-in number.

Observed total `memory.current`, MiB, median of three settled samples:

| State | Curve | N=1 | N=16 | N=64 | N=256 |
|---|---:|---:|---:|---:|---:|
| ready | 0 | 0.492 | 3.918 | 15.242 | 59.797 |
| ready | 1 | 0.441 | 3.961 | 15.242 | 59.672 |
| return2 | 0 | 0.742 | 7.984 | 31.234 | 124.113 |
| return2 | 1 | 0.754 | 8.008 | 31.234 | 124.230 |
| one_tool | 0 | 0.754 | 8.742 | 32.320 | 129.262 |
| one_tool | 1 | 0.711 | 8.492 | 32.484 | 129.207 |
| promise10 | 0 | 0.984 | 8.988 | 35.512 | 140.969 |
| promise10 | 1 | 0.992 | 9.242 | 35.691 | 140.746 |
| json64k | 0 | 1.781 | 22.988 | 91.223 | 364.484 |
| json64k | 1 | 1.742 | 22.984 | 91.227 | 363.977 |

N=1,024 repaired READY: **238.480 MiB total**, 0.23289 MiB/VM amortized, one
thread, zero measured idle CPU usec. No memory limit, OOM or swap events. Largest
N=256 JSON point is about 364 MiB, far below the task-owned 3.5 GiB cgroup cap.

Accounting details and qualifications:

- Every shard child enters its batch cgroup **at birth**, using the same
  clone3(CLONE_INTO_CGROUP) launcher as linux-ledger. The observer/wait wrapper
  is outside that batch. Birth costs outside it are fixed per process/curve
  point, not per VM, because there is only one shard process and one thread.
- Primary charge is `memory.current`; decomposition is anon+file+kernel+sock.
  Kernel already contains host and secondary page tables/slab. At N=256 the
  maximum absolute residual is **0.472%**; READY and Promise.all N=1 can retain
  **10.32% / 22.83%** rstat/charge-stock residual, so low-N closure is not claimed.
  Fitted decomposition differs from current by at most about 2 KiB/VM. No
  global Slab/SUnreclaim or MemAvailable delta is added a second time.
- The common **32 MiB snapshot file** is warmed outside each measured batch.
  It is shared once, not 32 MiB/VM, and not hidden in the fitted ~0.3 MiB process
  intercept. Snapshot creation and shared image/file-cache costs are separate
  once-per-prepared-image costs. Shared file charge slopes are zero here.
- Rings reserve exactly **80 KiB of guest address space per slot**, but only
  pages used by these small records are private/resident. The previous assembly
  fixture eagerly dirtied all 80 KiB. **Do not treat the difference from its
  projection as a free universal 80 KiB saving**, or compare an eager allocation
  and this demand-paged allocation without that qualification.
- These are post-run retained CoW/all-in charges, before QuickJS teardown. Guest
  munmap does not reclaim dirty stage-2 backing. They are not exhaustive transient
  peak measurements, a hostile writable bound or admission reservations. All
  32 MiB remains writable at stage 2; architecture §2.3 is **not implemented**.

Raw: `raw-r6/ledger-{0,1}-{ready,return2,one_tool,promise10,json64k}-{1,16,64,256}.json`,
[summary-r6.json](raw-r6/summary-r6.json), [ledger-cleanup.json](raw-r6/ledger-cleanup.json).
All 41 memory cells completed and their cgroups were removed.

## Restore, execution, CPU and tool latency

Each main fixture has **n=200** sequential stopped restore/run cycles in one
pre-created slot. Paired raw samples, not subtracted percentile estimates;
percentiles below are nearest-rank, recomputed by `harness/analyze-r6.py`.
Reset includes pending MMIO completion, full MADV_DONTNEED and 257 register
restores. RUN→DONE starts before KVM entry after bind, includes first faults,
QuickJS repair-data handling, source compilation, synthetic tool handling and
FINISH validation; it excludes the following reset.

| Fixture | Reset p50 / p99 ms | RUN→DONE p50 / p99 ms | Mean measured CPU ms/run |
|---|---:|---:|---:|
| return2 | **2.456 / 2.844** | **31.438 / 35.585** | **34.241** |
| one_tool | **2.634 / 3.978** | **36.140 / 42.118** | **39.234** |
| Promise.all(10) | **2.796 / 5.723** | **40.354 / 57.159** | **44.348** |
| structured 64 KiB JSON | **5.005 / 6.043** | **55.488 / 68.447** | **61.194** |

CPU uses CLOCK_PROCESS_CPUTIME_ID around reset+bind+execution+validation, including
KVM guest/system CPU and the entropy/uniqueness checks. It excludes stdout sample
printing, final statistics, process startup/slot creation, and the full-memory
pristine comparisons at the beginning/end. This is the harness's measured service
path, **not production Node+shard+watchdog CPU**. Initial one-time real boot to
CHECKPOINT: **177.643 ms, n=1**, from [prepare-final.jsonl](raw-r6/prepare-final.jsonl).

For **one echo** (n=200), WAIT observed by owner → validated FINISH is
**1.904 / 2.691 ms p50/p99**. This includes reply publication, re-entry, guest
receipt/parsing, promise continuation and FINISH serialization: a measured
**completion-side upper envelope**, not an isolated CALL-enqueue→RET-consumed
round-trip measurement. Owner-private echo/reply publication alone is
**5.041 / 18.125 µs p50/p99**. Do not call that 5 µs the tool round-trip.
An exact isolated guest call-boundary RTT remains uninstrumented. Promise.all's
same WAIT→FINISH interval is 2.117 / 2.816 ms for the whole ready-together batch.

Raw: [bench-return2.jsonl](raw-r6/bench-return2.jsonl),
[bench-one_tool.jsonl](raw-r6/bench-one_tool.jsonl),
[bench-promise10.jsonl](raw-r6/bench-promise10.jsonl),
[bench-json64k.jsonl](raw-r6/bench-json64k.jsonl).
Clock-correction pilots are retained under `raw-r6/pilot-clock/` and excluded.

### VM exits: userspace transport versus all hardware exits

| Workload | Logical calls/run | Userspace MMIO exits/run | Tool WAIT exits/call | All `kvm:kvm_exit` tracepoints/run |
|---|---:|---:|---:|---:|
| return2 | 0 | 1 FINISH | — | 385.32 |
| one_tool | 1 | 1 WAIT + 1 FINISH | **1** | 414.62 |
| Promise.all(10) | 10 | 1 WAIT + 1 FINISH | **0.1**, ready together | 442.20 |

The MMIO counts are observed in all main runs and cross-checked with perf:
separate **n=50** runs each counted `kvm:kvm_mmio` **50 / 100 / 100**, and
`kvm:kvm_exit` **19,266 / 20,731 / 22,110**. Full hardware exits include internal
fault/trap/IRQ handling; **one transport exit is not one total hardware exit**.
Including the fixed restore/runtime work, full-trace exits are 414.62 per call in
the one-tool fixture and 44.22 per call in the ten-tool fixture. Those are
workload-amortized counts, not isolated provider costs. FINISH's completion-only
KVM_RUN/EINTR is an extra host ioctl in reset, not another guest-generated MMIO
exit. Perf timings are instrumented and excluded from the latency table.
Raw: `raw-r6/perf-{return2,one_tool,promise10}.{csv,jsonl}`.

## Correctness, entropy, WAIT and deadline gaps

**10,000/10,000 restore/run cycles complete with zero observed canary leaks.**
Each resets a stopped slot; the host requires an unused-RAM canary to return to
zero, then dirties it with the generation. EL1 requires its snapshot canary and
call/input state to be pristine. JS requires the tenant global to be absent,
then sets it. The host checks the generation and the actual entropy returned
through EL1 against freshly read `/dev/urandom` bytes; all **10,000 generations
and 10,000 128-bit entropy values differ**. Full 32 MiB equality against the
immutable snapshot is checked before the series and after its final discard.
The small tool fixtures additionally exercise repeated pending-table reuse.
This is bounded fixture evidence, not a general adversarial isolation proof.

**The built-in QuickJS RNG is not repaired.** The first Math.random value has
**one distinct value across all 10,000 runs**. Fresh seed bytes in a control page
and kernel SEED do not mutate the existing QuickJS context's RNG. Startup libc
state/AT_RANDOM are likewise snapshotted. A small Bellard embedder reseed hook
is required. This explicit measured failure prevents claiming full gate 4,
even though generation/transport/private-memory reset works. Canary reset p50 /
p99 is 2.603 / 3.440 ms, n=10,000; the sub-ms nested gate also fails.
Raw: `raw-r6/canary-10000.jsonl` (never tracked; too large).

**WAIT: two independent N=1,024 real-guest runs pass**, with one pending echo
per guest, all 1,024 held concurrently, one fixed owner thread, then every
result validated as 42. One holds 2 seconds; a second holds 3 seconds and reads
`/proc/PID/status`, `stat` and `smaps_rollup` while held: **Threads=1**, and
**0 process CPU ticks over one measured second** (100 Hz accounting).
No lost/duplicate replies; duplicate IDs are checked by the host bitmap and
kernel pending states. Promise.all(10) separately validates actual promises and
reverse reply demux. This does not test cross-thread/cross-process notification
races, independent provider timing or multi-owner real-guest scheduling.
Raw: [wait-1024.jsonl](raw-r6/wait-1024.jsonl),
[wait-observed.json](raw-r6/wait-observed.json).

**Deadline/watchdog leases: missing.** A CPU-infinite guest is externally
SIGKILLed and reaped successfully; n=1, observed kill→reap **3.697 ms**, after
an explicit 0.2-second observer delay. This proves external whole-process
containment only. There is no registered per-slot deadline lease, independent
watchdog process, owner kick/escalation protocol or ≤50 ms production guarantee.
The existing shipping watchdog is untouched and its Mac tests pass; it is not
connected to this shard. Raw: [external-kill.json](raw-r6/external-kill.json).

## Mac regression result and final validation

**`make -C arch/jitk build` passes. The aggregate `make -C arch/jitk test`
DOES NOT PASS: final make exit status 2.** Kernel unit/packer/filesystem tests,
real Mac VM regressions (clock, faults, grow contract and filesystem differential),
VMM tests, protocol, executor (including watchdog and six Hyperlight checks), MCP,
grow and benchmark tests passed before the aggregate reached `linux/test`.

The separate nested Linux test guest passed its 1,000-exchange parking check,
smoke and tool_smoke, then produced **no further gate progress for over 13 minutes**
while its QEMU consumed a core. I stopped only that test-created QEMU (SIGTERM
was ineffective, then SIGKILL); the aggregate then failed with
`AssertionError: no report from nested guest`. Its command references
`arch/jitk/linux/.work/vmlinuz`, not kvm-dev. The cause of that nested harness stall
was **not isolated or fixed**, and a full aggregate PASS is not claimed. The
kernel bytes in that harness also match the initial default image exactly.

Evidence: [mac-build-test.log](raw-r6/mac-build-test.log),
[mac-aggregate-nested.log](raw-r6/mac-aggregate-nested.log),
[mac-aggregate-stall.json](raw-r6/mac-aggregate-stall.json), and paired default
SHA-256 receipts. This leaves the task's full aggregate Mac-test requirement
unmet even though the default image and its direct Mac regression suite pass.

The default image digest is identical before and after all kernel work. No
Linux syscall-handler or verified-contract manifest was changed. The complete
Mac command uses only documented explicit prerequisite overrides:

```sh
/usr/bin/lockf -k /tmp/sofort-bench.lock env \
  JITK_NODE=/tmp/jitk-09/node-real \
  JITK_NPM_CLI=/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js \
  JITK_VMM_BINARY=/tmp/jitk-01/r3/darwin/jitk-vmm \
  HYPERLIGHT_WORKER=/tmp/jitk-09/adapter-target/release/r2-worker \
  HYPERLIGHT_SNAPSHOT=/tmp/jitk-09/r3-snapshot \
  make -C arch/jitk build test
```

The separate Hyperlight adapter test prints its documented 13-check SKIP when
HYPERLIGHT_JS_SRC is unset; the executor's six Hyperlight integration checks
use the explicit existing worker/snapshot and pass. Earlier VMM-default-path and Hyperlight-default-path failures were environment
selection issues, retained separately; the initial missing npm-CLI selection was
also corrected. No source outside the assigned scopes was edited
to make a test pass. Generated test receipts are restored after their logs are
copied into this scope.

The aggregate Linux prerequisite step temporarily staged ~1.1 GiB in its
`.work` directory, exceeding the brief's Mac scratch budget; its newly cloned
libkrun source/build cache was removed immediately after compilation. No other
agent cache or directory was deleted. Final task-owned raw evidence is ~5 MiB;
large ring builds and immutable snapshots stay on kvm-dev. The existing kvm-dev
machine was never stopped/restarted. The aggregate test's separate temporary
QEMU is identified in its log and must not be confused with kvm-dev.

Final Linux validation: both shard binaries compile offline; original fixture
selftest passes; the formatted final real host boots the **same byte-identical
ring image** and completes return2, one_tool, Promise.all(10), json64k and canary
(n=3 each). The measured executable/source archive is retained separately because
formatting changed the host executable digest. Kernel image digest remains
`fa7e26587f7c98ef5d79a3bcfee17d92721ed695500e9850fd74def3a8bc42d0`.
Raw: `raw-r6/fixture-selftest.jsonl`, `qa-*.jsonl`, `final-build-*.log`,
[final-artifact-hashes.txt](raw-r6/final-artifact-hashes.txt).

## Artifact identity and reproduce

All remote artifacts are under **`/home/dev/r6-shard/`**. Runtime/prepared inputs:

| Artifact | SHA-256 |
|---|---|
| measured `bin/measured-kernel-ring.bin` | `fa7e26587f7c98ef5d79a3bcfee17d92721ed695500e9850fd74def3a8bc42d0` |
| shipped `arch/jitk/kernel/payload/qjs` | `ea2367e9dfc7484b6ad6d551b0bbc25d0247e2781f49ad822fa04c2753f80341` |
| measured `bin/measured-real` | `b730037ae6e53700decf4f283bbb42c2c4288d3434a2c96d3fd63b9366d4f209` |
| `final-r6.mem`, 33,554,432 bytes | `17c612fd5e62edbef2872298448404d3cf516c6827a4322ee2bd6a42c42555f6` |
| `final-r6.regs` | `657ec78f1029b131d3dec20700630a891ee71466c2f01abc695bc00e5b78e804` |

Snapshot hashes remain unchanged after correctness, curves, WAIT and perf.
See [artifact-hashes-before.txt](raw-r6/artifact-hashes-before.txt) and
[snapshot-hashes-after.txt](raw-r6/snapshot-hashes-after.txt). The prepared format
is local-machine-specific and has no production signature/cache identity layer.

```sh
# Copy only kernel/shard sources, excluding targets, dist and generated tests.
# ssh.sh streams tar because this VM does not expose an scp/SFTP subsystem.
kvm-dev/ssh.sh 'mkdir -p /home/dev/r6-shard'
COPYFILE_DISABLE=1 tar --no-xattrs -czf /tmp/sofort-r6-src.tgz \
  --exclude target --exclude target-ring --exclude dist \
  --exclude test-work --exclude test-results --exclude raw-r6 \
  arch/jitk/kernel arch/jitk/shard
kvm-dev/ssh.sh 'cd /home/dev/r6-shard; tar xzf -' </tmp/sofort-r6-src.tgz

# On kvm-dev; for a new preparation, select a NEW snapshot prefix.
cd /home/dev/r6-shard
export PATH=/home/dev/.cargo/bin:$PATH
sh arch/jitk/kernel/build-ring.sh
cargo build --release --offline --manifest-path arch/jitk/shard/Cargo.toml
cc -O2 arch/jitk/shard/harness/spawn-cg.c -o spawn-cg
flock /home/dev/bench.lock arch/jitk/shard/target/release/real \
  prepare arch/jitk/kernel/dist/kernel-ring.bin NEW-PREFIX
# Substitute NEW-PREFIX for final-r6 in these harnesses when creating fresh data.
flock /home/dev/bench.lock sh arch/jitk/shard/harness/run-r6.sh
sudo flock /home/dev/bench.lock python3 arch/jitk/shard/harness/ledger-r6.py
flock /home/dev/bench.lock python3 arch/jitk/shard/harness/wait-deadline-r6.py
python3 arch/jitk/shard/harness/analyze-r6.py
```

`raw-r6/measured-source.tgz` plus the measured binary on kvm-dev reproduces the
exact original executable; current source has formatting-only changes and a
Makefile ring target/documentation. Perf counter command (n=50; timings excluded):

```sh
sudo flock /home/dev/bench.lock perf stat --no-big-num -x , \
  -e kvm:kvm_exit,kvm:kvm_access_fault,kvm:kvm_mmio \
  -o raw/perf-one_tool.csv -- bin/measured-real bench final-r6 one_tool 50
```

## Findings → recommended changes

1. **Add a Bellard native embedder repair hook before tenant reuse.** The measured
   10,000-way RNG replay is a concrete gate-4 blocker. Reseed the existing context
   from fresh entropy and define libc/startup randomness repair; neither a new
   generation nor host seed injection alone fixes it.
2. **Keep shared prepared snapshots and fixed owner lanes.** Real small runs
   measure 0.484–0.549 MiB/VM all-in; return2's 0.484 is an actual combined ledger,
   not a sum of proxies. Preserve explicit JSON-only/profile/80-KiB residency
   qualifications. Measure the full codec and policy path before parity claims.
3. **Enforce architecture §2.3 before using a 2 MiB admission class.** The observed
   structured-JSON total is 1.422 MiB, but an EL1 guest can still dirty 32 MiB.
   Measured normal-run density does not supply the hostile physical bound.
4. **Investigate nested reset/first-fault costs on real KVM hardware.** Restore
   p99 2.844–6.043 ms and CPU 34–61 ms/run fail the targets here. Hundreds of full
   hardware exits coexist with one tool MMIO exit; reducing transport stores
   alone does not establish sub-ms restore or the production CPU budget.
5. **Wire independent watchdog leases, then Node policy IPC (gate 6).** External
   SIGKILL works, but this shard has neither per-slot leases nor a policy boundary.
   Add real asynchronous completion/notification races and multi-owner tests.
6. **Replace the stock std/os fd bridge with the bounded native API.** Keep the
   working byte rings/demux and Promise.all batching; add UTF-8/typed-array codec,
   posted destinations, finite-clock semantics, fragment/blob profiles and exact
   guest call-boundary RTT instrumentation deliberately, with a new ledger.
