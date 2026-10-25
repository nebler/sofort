# R7 integration: native tools under bounded ring layouts

Agent `r7-integrate`, 2026-10-25–26. Worktree
`/Users/noah/.t3/worktrees/sofort/t3-90645174`, branch
`t3/fix-native-memory-layout`, base merge `d8ef82b`. Linux work is confined to
`/home/dev/r7-integrate` on the existing kvm-dev. No push.

## Root cause, isolated by instrumentation

The original merged tree reproduces **7/41 exact, 34 failures**. A bounded,
opt-in native diagnostic sink (`JITK_NATIVE_DIAGNOSTICS=1`) decodes the already
validated LOG records. It exposes two independent failures:

1. **31 cases abort in EL1 reading the late-bound archive's entry count.**
   Every such abort reports `ESR=0x96000006`, `FAR=0x82000008`,
   `PC=0x8000132c`. This is a current-EL data-read abort with a level-2
   translation fault, at `fs::word(8)` while traversing the archive. The new
   stage-1 `RAM` table initialized indices 0..15 only (32 MiB ending at
   `0x82000000`); the parallel native branch's read-only input memslot starts
   exactly there. The stage-2 input slot existed, but EL1 had no stage-1 mapping
   for it. Adding only two EL1-only/read-only 2-MiB blocks for the admitted input
   extent changes the corpus from **7/41 to 35/41**. No writable bound changes
   in this diagnostic step.
2. **The remaining six cases exhaust the narrow allocator partition.**
   Ring-only allocation diagnostics record MicroPython asking mmap for
   `0x201000` = **2,101,248 bytes**, against glue-2m's `0xce000` =
   **843,776-byte** mmap capacity. After ENOMEM it stores through address zero:
   `ESR=0x92000046`, `FAR=0`, guest `PC=0x4593c8`. All three MicroPython cases
   fail before their scripts complete. zstd's three cases also fail allocation;
   its compression failures return guest status 11 and an allocation-error
   stderr instead of the Linux result. With glue-4m, MicroPython passes all
   three, and zstd's text/corrupt cases pass, but binary compression still
   fails on a **1,462,272-byte (`0x165000`)** mmap request after earlier
   allocations, despite a **2,150,400-byte (`0x20d000`)** total mmap partition.
   The corpus at this step is **40/41**. An 8-MiB diagnostic trial passes,
   but a memory-syscall-only trace shows that larger admission class is
   unnecessary: zstd has **831,488 bytes** mapped before its final
   **1,462,272-byte** request, for a live mmap high-water mark of
   **2,293,760 bytes (`0x230000`)**. There are no intervening unmaps and the
   allocations are contiguous. Expanding only glue-4m's arena to **2.75 MiB**
   gives mmap **2,412,544 bytes (`0x24d000`)**, leaving 118,784 bytes at that
   peak. All **41/41** pass. The unused 8-MiB class is removed.

The `completion/doorbell mismatch` was a secondary symptom: fatal kernel/user
stops ring FINISH without the required NATIVE_EXIT record. No missing completion
is reinterpreted as success. Root-cause receipts are in
`raw-r7-integrate/linux/`, directories `baseline-raw`,
`diagnostic-raw`, `input-fix-raw`, `alloc-raw`, and `class4-raw`.

## Fix and class identity

All restored VMs keep five bounded RAM memslots. Only the selected arena and
81,920-byte transport are writable; all other RAM remains KVM_MEM_READONLY plus
host PROT_READ. Input memslot **63** at GPA **0x82000000** remains read-only.
The new stage-1 input mapping is also read-only, EL1-only and non-executable.
Only trusted offline preparation uses a whole-RAM boot mapping.

| Class | Arena GPA | Writable arena | Arena + transport | Selected native tools |
|---|---|---:|---:|---|
| glue-2m | `0x81800000` | 1,310,720 B | 1,392,640 B | jq-musl, sqlite3, busybox, lua |
| glue-4m | `0x81800000` | 2,883,584 B | 2,965,504 B | micropython, zstd |

These are the smallest passing admission classes for this pinned corpus;
glue-2m and the narrower proposed glue-4m partition were actually tried. The
2.75-MiB arena is the smallest passing quarter-MiB arena increment above the
2.5-MiB proposal, with 29 free mmap pages at zstd's measured peak. No universal
native input-size/peak guarantee follows. Stage 1 allocates one/two arena tables
and maps the unused tail read-only. Data and brk remain 64 KiB each,
user stack 128 KiB. QuickJS's default class remains glue-2m.

Each kernel embeds a version-2 nine-u64 layout identity, copied to its prepared
`.layout`: magic, version, class MiB, arena GPA/bytes, transport bytes, data/brk
reservations and stack bytes. Restore accepts only the finite host catalogue and
requires the embedded kernel marker to match the sidecar. Legacy, unknown,
modified and mismatched layouts fail closed. `profiles.json` records each tool's
class; `prepared.json` hashes the sidecars as well as bin/mem/regs. There is no
host-global larger-class fallback or guest-selected class.

The old single-physical-base syscall assumption is also removed on the ring
path. Full range/page/permission checks precede access through the user virtual
mapping; EL1 clears PAN only after recognizing a ring syscall. Hardware walks
each page, so adjacent virtual RO/data regions can use unrelated physical
backing. This covers copyin/copyout, stream buffers and iovec arrays without
adding a bounce allocation or changing default libkrun access. An owned
freestanding ELF compares a split byte buffer and split iovec against Linux,
then checks RO copyout and an unmapped tail return EFAULT. It matches exact
stdout/stderr and status 37. See `native-regions-r7.{c,ld}` and the regression
receipts. The fd differential also matches exact bytes/status 37.

## Native correctness and memory

The regression gate rebuilds six checksum-pinned profiles into a fresh temporary
directory. Two independent persistent workers each compare all **41/41** exact
`(stdout bytes, stderr bytes, exit status)` tuples with Linux: **82/82** total.
No normalization, fallback or timeout counts as a match. It also checks both
freestanding probes and rejection of a glue-4m sidecar paired with a glue-2m
image. The finite-layout Rust test rejects legacy/truncated and every single-byte
modified identity. `make -C arch/jitk/shard test` now runs these checks alongside
Rust tests (1 fixture-target + 15 real-target tests); missing KVM/census
prerequisites fail the gate. Offline child groups have bounded waits and cleanup.
The full `run-r7-shard.sh` harness invokes this gate under its existing outer
lock; standalone `make test` acquires its own batch locks. The explicit offline
`JITK_BENCH_LOCK_HELD=1` flag composes these modes without nested flock calls.
Both modes pass the complete 82-tuple corpus/probes; no measurement-lock wait
failure is counted as a successful regression run.

The earlier 8-MiB trial's host source is retained under
`raw-r7-integrate/linux/trial-8m-source.tgz` for the diagnostic receipts.
The memory-only trace overlay is `linux/trace-source.tgz`; its unchanged frame
and decoder are in the archived trial host source. Final source/artifact hashes
(`linux/raw/source-hashes.json`, `artifacts.json`) identify the two-class build
separately; all 88 measured source hashes match this worktree.
The default glue-2m guest rebuilt from the final source is byte-identical to the
full conformance guest (`e2166da8f5f654652e746efd4661d99bada7e8c7c983b9317706ff7319f246b3`).

Native memory uses the R6 method: clone3(CLONE_INTO_CGROUP) at birth, one fixed
thread and fresh process per cell, **N=1/16/64/256 twice**, 3-s settle, three
samples 200 ms apart, and a one-second idle CPU window. Retain each completed VM
before reset/free. Fit each curve's median memory.current against N, with its
own fixed intercept, then average slopes. Every point explicitly warms `.mem`,
`.regs` and `.layout` outside the measurement cgroup; shared images are charged
once separately. The two-slope ranges are repeatability, not confidence intervals. The total includes KVM kernel charges, host state and each
VM's separately sealed input archive; components are not added twice.

A preliminary final-layout run exposed reclaimed shared snapshot pages charged
to the first child cgroup: Lua N=1 file charge was 12,709,888 B and SQLite's
8,511,488 B, instead of the 180,224-B per-VM input. That violates the warm-shared
assumption of the linear fit. Those complete curves remain in
`linux/unwarmed-final-ledger`; no individual points were dropped. The explicit
per-point warming fix is offline only, and all 48 cells are repeated below.

Each representative request deliberately retains the corpus's complete six-file
fixture: 178,483 content bytes plus archive metadata, rounded to a **180,224-byte
(176-KiB)** read-only extent per VM. Thus the Lua row differs from R7-bytes'
23-byte-file experiment; no direct regression claim is made against that row.

| Native run | Class | Total MiB/VM | Two slopes B/VM |
|---|---|---:|---|
| jq aggregate | glue-2m | 1.277900 | 1,340,183.1 / 1,339,768.1 |
| SQLite aggregate | glue-2m | 0.667935 | 697,784.3 / 702,976.6 |
| BusyBox gzip, 160,000 binary bytes | glue-2m | 0.745366 | 781,231.4 / 781,913.5 |
| zstd, 160,000 binary bytes | glue-4m | 2.695839 | 2,826,834.8 / 2,826,748.7 |
| Lua sum | glue-2m | 0.520573 | 545,457.7 / 546,263.8 |
| MicroPython sum | glue-4m | 2.487999 | 2,607,289.9 / 2,610,423.0 |

All 48 native cells complete; every idle window is **0 CPU microseconds**;
no cgroup max/OOM/swap events and no leftover child cgroups. Current-fit minimum
R² is **0.999981**. Load1 spans **0.02–0.78**. Point-level accounting residual
reaches **19.023%** at low N; no low-N closure claim is made. Raw curves and
components are under `raw-r7-integrate/linux/raw-native-ledger`; reducer
`harness/analyze-native-r7.py`. These are completed-workload slopes, not a peak
or arbitrary-input admission bound. Writable classes, RO input reservations,
fixed process/shard costs and shared images must be budgeted separately.

## Full conformance replay

The small-class correctness/conformance replay has passed: 200 runs each of
return2, one_tool, promise10 and canary; 200 distinct Math.random and libc
receipts; 100 exact allocation-loop OOMs, 100 all-pages-read/dirty/RO faults,
and 100 exact json64k OOMs. Every hostile case resets, checks all 32 MiB against
the prepared image, then successfully reuses the slot. No timeout counts as an
OOM or memory-bound result. Mixed stress completes **10,000/10,000** runs across
64 slots/four owners, with zero leaks/cross-talk and 10,000 fresh host roots.
The 1,024-waiter experiment holds five shard threads plus one single-thread
watchdog, observes zero idle CPU ticks, and releases all 1,024 with no lost reply.

Five batches at each size give these nested deadline observations (nearest-rank
percentiles; expiry returns only after stopped reset, then clean generation-3
reuse and stale-generation rejection):

| Leases | Samples | Stop p50 / p99 / max ms | Reset/error p50 / p99 / max ms |
|---:|---:|---|---|
| 1 | 5 | 3.617 / 3.767 / 3.767 | 6.040 / 6.241 / 6.241 |
| 16 | 80 | 8.108 / 9.954 / 9.954 | 8.591 / 10.303 / 10.303 |
| 64 | 320 | 11.296 / 17.409 / 17.451 | 11.727 / 18.012 / 18.091 |

Five staggered batches cover 40 leases (reset/error p50/p99/max
**2.712 / 6.991 / 6.991 ms**); all later-deadline guests survive until
their own deadlines. One SIGSTOP owner-failure experiment ends in watchdog
pidfd SIGKILL, **128.288 ms deadline-to-reap**, with the unchanged 100-ms configured
post-fire grace. This is a measured observation, not a 100-ms wall-clock bound.

The glue-2m R6 ledger (57 cells including READY N=1,024) completes with zero
idle CPU in every window, zero cgroup max/OOM/swap events and no child cgroups.
Its marginal current / peak-fit MiB per VM are: READY **0.238953 / 0.238235**,
return2 **0.483288 / 0.485543**, one_tool **0.504374 / 0.503825**, promise10
**0.551407 / 0.552548**, json64k OOM **0.993510 / 0.993510**, allocation-loop
OOM **0.985214 / 0.985206**, and maximal-dirty **1.603601 / 1.607364**.
All small successful fixtures remain below 0.6 MiB/VM. Peak-fit is an independent
least-squares fit, so a slightly lower fitted peak slope can coexist with
pointwise peak >= current; raw cells are retained without correction.

The revised glue-4m class passes 3 runs each of return2, one_tool, promise10,
canary and json64k, plus 100 exact allocation-loop OOMs and 100 exact EL1
all-pages/immutable-write faults. Its two R6 maximal-dirty curves give
**3.105024 MiB/VM current and peak-fit**, slopes **3,256,216.1 / 3,255,490.5
B/VM**, minimum current-fit R² **0.99999950**. All 704 arena + 20 transport
pages are dirtied, and all 32 MiB is read, before the immutable write faults.
Every idle window is zero CPU; no max/OOM/swap event and no leftover child
cgroup. This supports the 4-MiB core writable-class reservation, with fixed
process/shared-image/input/capture budgets still separate. The offline ledger
observer allows 600 s for batch construction (the former 180-s wait was too
short for 256 larger-class guests); guest leases, hostile 2-s budgets and the
sampling/fitting method are unchanged.

Raw replay: `raw-r7-integrate/linux/raw-shard/` and `linux/raw-classes/`.
Reducers: `harness/analyze-r7-shard.py` and `harness/analyze-r7-integrate.py`.
The existing shard reducer's exact expected memory-bound message was updated to
the class-independent diagnostic; no conformance assertion was loosened.

## Environment, default image and limits

Existing kvm-dev: Ubuntu 26.04 arm64, Linux 7.0.0-38-generic, six vCPU/9 GiB,
4-KiB pages, nested HVF → KVM on Apple M4 Pro/macOS. Linux uses stable Rust
1.99.1; Mac uses pinned 1.95.0. All VM measurement batches hold
`/home/dev/bench.lock`; Mac suites hold `/tmp/sofort-bench.lock` and retain
uptime/load. Memory accounting is valid here; **all timings are nested and
indicative only**, not metal results. No VM restart, kernel change, new service,
third-party download/build, or cloud resource was needed.

All ten Mac subtree suites pass: kernel, VMM, VMM sandbox, protocol, executor,
executor policy, MCP, grow, bench and Hyperlight (13/13). The supplied test env
was used, plus `JITK_KERNEL_IMAGE=$PWD/arch/jitk/kernel/dist/kernel.bin` to select
the just-built image rather than inherited readiness paths. Full log and
archived generated receipts are `raw-r7-integrate/mac-suites.log` and
`mac-generated-receipts.tgz`. Temporary dependency links and unrelated generated
tracked files were restored/removed.

The default libkrun image remains byte-identical, **2,924,584 B**, SHA-256
`75b2abe26021d9d0624b0555a64ed589d251cb7d30aa2965754974f3716d1732`.
Receipt: `raw-r7-integrate/default-image.json`. No default-image change or
certification exception. All source changes are in the authorized shard and
ring-only kernel scope; no MCP or other subtree implementation changes.

Not done: production admission/policy IPC, Linux cutover, native lease scheduling,
new tool/large-input certification, metal timings or a universal all-host-state
peak bound. The pre-existing native-worker deadline/restart policy is unchanged.
Prepared legacy 32-byte layouts must be rebuilt; no compatibility fallback is offered.

Cleanup removes scratch targets, trial images and diagnostic snapshots. VM disk
use falls from **2,684,692 to 517,472 KiB**, below the 5-GiB
cap, with no task cgroups remaining. Final snapshots stay under `images/` and
`qjs-glue-{2,4}m.*`; measured executables are preserved in
`/home/dev/r7-integrate/bin/`. Mac worktree use remains below 0.5 GiB, below its
3-GiB cap. Receipt: `linux/raw/cleanup.json`.

## Commits

- `70e6d91` — Fix native ring input mapping and bind bounded per-profile layouts.
- `afca9c4` — Gate shard tests on the native corpus and relocation boundary probes.
- `c3ff016` — Bound regression process cleanup and keep measurement locks unnested.
- `d662531` — Fit measured native allocation peaks in the explicit glue-4m class.
- `2e84d79` — Certify native layouts with composed shard gates and warm cgroup ledgers.
- Final report/evidence commit: see this report's git history.

## Exact reproduction

Copy this branch's `arch/jitk/kernel`, `arch/jitk/shard` and
`arch/jitk/grow/probe.ld` into a new owned Linux tree, excluding build/output/raw
directories. Never replace a prepared snapshot in place. Use existing census
artifacts at `/home/dev/r6-census`.

```sh
cd /home/dev/r7-integrate
export PATH=$HOME/.cargo/bin:$PATH RUSTUP_TOOLCHAIN=stable JITK_NATIVE_ROOT=$PWD
python3 arch/jitk/shard/harness/prepare-native-r7.py
make -C arch/jitk/shard test             # builds fresh snapshots, corpus twice
flock /home/dev/bench.lock python3 arch/jitk/shard/harness/native-corpus-r7.py
cc -O2 arch/jitk/shard/harness/spawn-cg.c -o spawn-cg
sudo -n flock /home/dev/bench.lock env JITK_LEDGER_ROOT=$PWD \
  JITK_LEDGER_CGROUP=/sys/fs/cgroup/r7-integrate-native \
  JITK_LEDGER_NATIVE_TOOLS='jq-musl sqlite3 busybox zstd lua micropython' \
  JITK_LEDGER_OUTPUT=$PWD/raw-native-ledger \
  python3 arch/jitk/shard/harness/ledger-native-r7.py
sudo -n chown -R dev:dev raw-native-ledger
python3 arch/jitk/shard/harness/analyze-native-r7.py raw-native-ledger
for c in glue-2m glue-4m; do
  JITK_RING_CLASS=$c JITK_RING_OUT=$PWD/qjs-$c.bin \
    sh arch/jitk/kernel/build-ring.sh
  flock /home/dev/bench.lock arch/jitk/shard/target/release/real \
    prepare qjs-$c.bin qjs-$c
done
JITK_R7_ROOT=$PWD JITK_R7_SNAPSHOT=qjs-glue-2m \
  JITK_R7_OUTPUT=$PWD/raw-shard \
  JITK_LEDGER_CGROUP=/sys/fs/cgroup/r7-integrate-shard \
  flock /home/dev/bench.lock sh arch/jitk/shard/harness/run-r7-shard.sh
JITK_R7_ROOT=$PWD flock /home/dev/bench.lock \
  sh arch/jitk/shard/harness/run-r7-integrate-classes.sh
python3 arch/jitk/shard/harness/analyze-r7-integrate.py "$PWD"
```

Mac: under `lockf -k /tmp/sofort-bench.lock`, set the exact user-supplied
JITK_VMM_BINARY/JITK_NODE/HYPERLIGHT_JS_SRC/HYPERLIGHT_WORKER/HYPERLIGHT_SNAPSHOT/
JITK_NPM_CLI paths and the explicit JITK_KERNEL_IMAGE above, then:
`for t in kernel vmm vmm/sandbox protocol executor executor/policy mcp grow bench bench/hyperlight; do python3 arch/jitk/docs/delegate.py "$t" test || break; done`.

## Findings → recommended changes

1. **Keep the native corpus in the shard gate.** The original QuickJS-only tests
   could not detect the missing input mapping or native allocator pressure.
2. **Admit by the snapshot's explicit class and charge RO inputs separately.**
   MicroPython/zstd require larger layouts for this corpus; completed memory
   slopes cannot replace the hard writable limit or an input/host-state budget.
3. **Use virtual, fully validated syscall buffers across relocated regions.**
   Preserve the split-buffer/iovec and sidecar-mismatch regressions when changing
   the loader or stage-1 layout again.

4. **Warm shared prepared files outside each measurement cgroup.** Cache
   reclamation can otherwise assign a shared-image cost to the first point and
   bias the marginal slope; retain failed/preliminary receipts when fixing the
   method.
