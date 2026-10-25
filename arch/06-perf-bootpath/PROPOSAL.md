# 06 — Request → result: spend the budget on useful work

## 1. Concrete design

Use a bounded pool of **pre-booted, single-use VM processes**, parked in the trusted
bootstrap's blocking read before receiving user code. Start with **32 MiB guest RAM,
8 MiB JS allocation limit**, one vCPU, stripped Bellard qjs, one tagged JSON-lines
console. These RAM settings are a proposed starting point, **UNVERIFIED in jitk**.
Keep source bootstrap initially; precompilation is a small, optional improvement.

Lifecycle: `SPAWNING → READY → CLAIMED → SPENT → REAPED`. A VM handles exactly one
execute request, including failures/timeouts. READY contains no user code or secrets;
provider schemas arrive after CLAIMED. Authenticate READY against the expected image
and bootstrap version. Never put SPENT back in the pool. Validate/bound every frame,
apply policy on every call, issue worker kill before returning a result, and reap
asynchronously. Hold the worker's capacity token until reaped. Refill has a separate
concurrency limit so a burst cannot create a process/memory stampede.

Use interrupt-driven blocking guest reads/WFI, not polling. Refill covers arrival rate
λ with a reserve of at least `ceil(λ × refill_p99_seconds) + burst_allowance`, subject
to a hard total-worker and memory cap; otherwise bounded queue/admission failure.
This is a sizing formula, not measured sustainable throughput. Pooling hides boot
latency; it does **not** remove boot CPU, memory demand, or single-use replenishment.

Emit host monotonic spans for admission, claim, code write, tool request, policy,
external tool wait, response write, result validation, kill, and reap. Keep queue time
and real tool latency separate. Guest counters identify parse/eval/GC time but need
clock calibration before comparing absolute host/guest timestamps. Record pool-hit
rate and per-stage p50/p90/p99 under concurrency, not just an aggregate median.

### Final latency budget: one tool call

Contract: <=1 KiB snippet, small JSON arguments/result, READY available, no logs,
local policy+echo tool. For a real tool add **T**, its measured wall time, once.
Numbers below are **targets/projections (UNVERIFIED end to end)**, in milliseconds.
The 3.3 ms bare-boot reference is the brief's earlier n=30 result, not reproduced here.

| Stage | Cold target | Parked target | Evidence/status |
|---|---:|---:|---|
| Admission / claim | 0.05 | 0.05 | Projected; no TS executor built here |
| Process exec + dyld + constructors | 1.80 | 0 | Projected idle-host allowance; current loaded measurement 9.388 |
| VMM, RAM, devices, vCPU setup excluding payload | 1.30 | 0 | Projected; bare build-to-first-run measured 1.528 incl. tiny payload |
| Load stripped payload | 0.65 | 0 | Measured RAW read+write 0.665 median |
| Guest kernel / ELF / EL0 entry | 0.20 | 0 | UNVERIFIED; immediate-off guest is not an ELF loader |
| qjs + source bootstrap to READY | 0.36 | 0 | Linux-native measured 0.362; guest syscall implementation unverified |
| Submit code + compile + one local tool call + result | 0.18 | 0.18 | Linux pipe lower bound measured 0.177, not virtio-console |
| Additional VM transport + host integration allowance | 0.35 | 0.35 | Projected; includes wakeups/virtio, serialization/validation slack |
| Issue termination | 0.02 | 0.02 | Projected; wait/reap excluded from response latency |
| **Total + external tool T** | **4.91 + T** | **0.60 + T** | Engineering budgets, not measured jitk latency |

Target warm **p90 <=1.5 ms, p99 <=3 ms**, excluding T and admission wait: UNVERIFIED.
Do not add stage p99s to claim an end-to-end p99. On this loaded machine stripped
RAW immediate-off alone measured **13.405/26.615/35.654 ms** median/p90/p99;
therefore the 4.91 ms cold target is explicitly **not achieved by this experiment**.
A current-host cold qjs result should be planned around >=14 ms median before real
virtio/EL0 integration; that estimate is projected, not an integrated measurement.

## 2. Real code / benchmark harnesses

All source and data live beside this proposal. Build products/sources are private in
`/tmp/jitk-06/`; `/tmp/jitk-spike` was read/copied only.

- `host.c`: instrumented copy of the minimal host; constructor/main, payload API,
  builder and run timestamps using libkrun's added buffered recorder.
- `instrument_libkrun.py`, `add_payload_trace.py`: patch a **copy** of libkrun;
  `clock_gettime_nsec_np(CLOCK_MONOTONIC_RAW)` around actual HVF calls, anonymous
  guest mmap, file reads/copies, and `_exit`. No per-event I/O.
- `bench_boot.py`: fresh process+VM each sample, 5 warmups/case, shuffled n=100/case;
  parent uses the same Darwin raw clock. `boot-{raw,summary}.json` retain all results.
- `bench_control.py`, `control-raw.json`: interleaved stock versus buffered build,
  n=100 each, to quantify instrumentation distortion.
- `bench_qjs.h`, `prepare_qjs.py`, `bootstrap.js`, `prepare_bytecode.py`,
  `prepare_samecontext.py`: native main/first-statement/READY/DONE timing and
  per-address-space memory high-water measurement. Same-context bytecode variant
  changes evaluation input while retaining qjs's normal runtime/context setup.
- `bench_qjs.py`, `qjs-{raw,summary}.json`: n=100/case, shuffled cold/parked tests,
  actual one-tool-request/response, plus touched 8/16 MiB allocations.
- `bench_churn.py`, `churn-raw.json`, `churn-example.trace`: n=30 allocation churn
  oracle; `commands.txt`, `metadata.json`: reproduction commands and environment.
- `trace.c`, `interpose-{raw,summary}.json`: **discarded preliminary** dyld-interpose
  experiment. Final results use source instrumentation, not interposition.

Method: M4 Pro / macOS 26.6.1, HVF, Rust 1.95.0; native Linux arm64 musl in Docker.
Warm filesystem cache, fresh process/VM every cold sample. No page-cache purge or
production Linux/KVM claim. Quantiles use nearest-rank p90/p99; medians interpolate
middle pair. n=100 p99 is only the second-largest observation, not a fleet SLO.
The temporary benchmark container was removed afterward; private host artifacts remain.
Machine was concurrently used by other designers/builds: load averages observed
24.79–35.09. Controls confirm this is materially slower than the brief's idle run.

Linux executables/scripts are copied from the shared mount to container-local
`/tmp/jitk-06` before timing; container launch/package installation is excluded.
Use `/proc/self/status` VmHWM, **not getrusage alone**: fork/exec preserved a Python
parent high-water of ~10–14 MiB although actual qjs VmHWM was ~1.1–1.6 MiB.
Timing stamps precede memory inspection; READY and result timings include preceding
stamp/reporting overhead. These instrumented timings are conservative, not bare
engine-only parse timings. A parked sample starts after reading READY, before
writing the snippet; each process still runs only one snippet and exits.

## 3. BLOCKERS — experiments and results

### (a) Where does bare boot go? ELIMINATED for immediate-off HVF

Command: `python3 arch/06-perf-bootpath/bench_boot.py 100`
(after the private-copy build/sign commands in `commands.txt`). One vCPU, 64 MiB,
24-byte kernel doing only PSCI SYSTEM_OFF. All units **µs**, n=100.

| Phase | Median | p90 | p99 |
|---|---:|---:|---:|
| Parent spawn boundary → main (exec, dyld, all constructors, scheduling) | 9388.12 | 13948.33 | 19616.62 |
| main → builder entry | 45.17 | 63.58 | 141.75 |
| Builder entry → first hv_vcpu_run | 1528.46 | 6379.29 | 12515.12 |
| ↳ hv_vm_create | 39.56 | 63.25 | 335.75 |
| ↳ anonymous guest mmap | 4.85 | 6.46 | 10.29 |
| ↳ hv_vm_map | 3.54 | 4.79 | 6.50 |
| ↳ hv_vcpu_create | 196.85 | 555.00 | 3105.21 |
| ↳ RAW file read + guest copy | 47.27 | 109.17 | 247.04 |
| ↳ residual devices/FDT/register/thread/builder work | 1202.81 | 4821.38 | 12310.54 |
| First hv_vcpu_run → SYSTEM_OFF exit | 10.52 | 18.00 | 646.83 |
| Shutdown dispatch → `_exit` entry | 41.75 | 276.83 | 7197.62 |
| `_exit` entry → parent wait completion | 847.62 | 1904.58 | 3379.67 |
| **Whole process** | **11849.19** | **23820.04** | **30236.21** |

Indented rows are subsets, not additive extra phases. Per-phase medians need not
sum to median total. VM execution can begin **before builder return**: builder API
median 1577.73 µs overlaps guest work, hence the first-run boundary above.

`_exit`→wait includes one buffered trace write, OS teardown and parent scheduling;
it is not an isolated `hv_vm_destroy` call. libkrun exits the whole process without
explicit HVF VM/vCPU destroy calls: [vmm/mod.rs:415–429](https://github.com/libkrun/libkrun/blob/a1d8616765da03980f3be1bb8714bfdd3842f33c/src/libkrun/src/vmm/mod.rs#L415).
No shutdown API return or object-drop teardown should be budgeted on top.

Control command: `python3 arch/06-perf-bootpath/bench_control.py`.
Stock process **9.004/12.267/19.851 ms**, buffered **9.075/11.598/16.914 ms**,
n=100 each. Median difference **0.071 ms**, below environmental noise. This rules
out instrumentation as the explanation for the gap from the earlier 3.3 ms.
It does not retroactively decompose an earlier run we did not instrument.

A ready pool removes process startup, all builder/payload work, guest initialization
and qjs/bootstrap startup from request latency. Asynchronous reap removes exit/wait
from result latency but not from capacity accounting. Optimizing hv_vm_map alone
cannot materially fix these cold tails.

### (b) Payload size/copy: ELIMINATED; embedding is not zero-copy

Command: `llvm-strip --strip-all /tmp/jitk-06/qjs-stripped` after copying original.
**9,688,056 → 2,394,360 bytes**, saving **75.29%**. RAW payload construction is literally
`kk.bin bytes + qjs bytes` in `bench_boot.py`; entry stays at 0x80000000 and powers
off without touching qjs. This measures loading, **not qjs execution**.

| Payload, 64 MiB VM | Bytes of qjs | Whole process ms median/p90/p99 | Payload read+copy µs median/p90/p99 |
|---|---:|---|---|
| Tiny RAW, no qjs | 0 | 11.849 / 23.820 / 30.236 | 47 / 109 / 247 |
| Original initrd | 9,688,056 | 16.412 / 28.728 / 69.985 | 3069 / 5310 / 26443 |
| Stripped initrd | 2,394,360 | 13.499 / 25.309 / 44.440 | 686 / 1139 / 3401 |
| Original concatenated RAW | 9,688,056 | 17.481 / 34.675 / 50.289 | 3068 / 5104 / 14960 |
| Stripped concatenated RAW | 2,394,360 | 13.405 / 26.615 / 35.654 | 665 / 1160 / 3249 |

Stripping eliminates ~**2.38 ms median payload read/copy** here. Concatenating
stripped qjs changes that median by only **20 µs** versus stripped initrd; no
meaningful speed win is demonstrated. Keep one RAW image to simplify packaging.

Source proof at libkrun `a1d8616`: [builder.rs:1521–1524](https://github.com/libkrun/libkrun/blob/a1d8616765da03980f3be1bb8714bfdd3842f33c/src/libkrun/src/vmm/builder.rs#L1521)
uses `std::fs::read` into Vec then `guest_mem.write`; [1644–1648](https://github.com/libkrun/libkrun/blob/a1d8616765da03980f3be1bb8714bfdd3842f33c/src/libkrun/src/vmm/builder.rs#L1644)
does the same for initrd. `load_external` only records path/metadata beforehand
([api/payload.rs:102](https://github.com/libkrun/libkrun/blob/a1d8616765da03980f3be1bb8714bfdd3842f33c/src/libkrun/src/api/payload.rs#L102)).
Even the bundled aarch64 `KernelCopy` path copies ([builder.rs:1687–1715](https://github.com/libkrun/libkrun/blob/a1d8616765da03980f3be1bb8714bfdd3842f33c/src/libkrun/src/vmm/builder.rs#L1687));
the `KernelMmap` implementation there is x86_64-gated. `include_bytes!` alone is
not an aarch64 zero-copy payload design.

### (c) QuickJS startup and RAM: ELIMINATED natively, guest sizing remains conditional

Command: `docker exec jitk-06-bench sh -c 'BENCH_ROOT=/tmp/jitk-06 python3 /work/bench_qjs.py'`.
Bellard commit `7d1c13c5d8f8c6b32893786ed35cdcebd88194d2` (2026-06-04);
NG `e68078618935dbd28c41c98931f99d9091daba50`. Bellard GCC -O2 static musl,
NG CMake Release static musl; not a compiler-flag-normalized engine comparison.
Each row n=100. **µs, median/p90/p99**; cold starts before native process spawn.

| Variant | main → first JS statement | main → READY | Cold call → result | Parked call → result |
|---|---|---|---|---|
| Bellard source CLI | 323 / 402 / 527 | 362 / 451 / 582 | 765 / 1032 / 1603 | 177 / 249 / 400 |
| Bellard bytecode, same qjs context | 242 / 298 / 428 | 279 / 339 / 480 | 686 / 896 / 1392 | 172 / 263 / 2632 |
| Bellard qjsc-generated executable | 226 / 263 / 340 | 268 / 323 / 395 | 665 / 857 / 1338 | 193 / 276 / 1061 |
| NG source CLI | 538 / 651 / 875 | 589 / 715 / 992 | 998 / 1221 / 2568 | 172 / 252 / 424 |
| NG qjsc-generated executable | 273 / 321 / 428 | 320 / 368 / 506 | 742 / 896 / 1649 | 187 / 244 / 423 |

Same-context bytecode saves **81 µs to first statement** and **83 µs to READY**
(median differences). qjsc-generated executables also change context/module setup;
their total gain cannot all be attributed to skipping parsing. Stock qjs CLI has
no bytecode-file input switch: using compiled bootstrap needs a small launcher/hook
or a qjsc-generated executable, and thus changes the brief's literal unmodified CLI.
Pin bootstrap bytecode to the exact engine build; never accept agent-supplied
bytecode. [QuickJS evaluation/bytecode documentation](https://bellard.org/quickjs/quickjs.html#Script-evaluation).

Stripped executable sizes: Bellard qjs **2,394,360 B**, NG qjs **1,378,128 B**;
qjsc-generated bootstrap+engine Bellard **1,115,992 B**, NG **1,312,592 B**.
The generated program still evaluates the submitted source snippet at runtime.
NG is smaller than Bellard CLI, but is not faster in these startup tests; defer switching.
See [Bellard source](https://github.com/bellard/quickjs/tree/7d1c13c5d8f8c6b32893786ed35cdcebd88194d2)
and [NG source](https://github.com/quickjs-ng/quickjs/tree/e68078618935dbd28c41c98931f99d9091daba50).

| Bellard source memory experiment, n=100 | VmHWM KiB median/p90/p99 |
|---|---|
| Bootstrap + one echo call | 1568 / 1568 / 1568 |
| Hold and touch 8 MiB Uint8Array | 9764 / 9768 / 9768 |
| Hold and touch 16 MiB Uint8Array | 17956 / 17960 / 17960 |

These are native process peaks, not total guest RAM or VMM RSS. Guest must also
budget the embedded image, loaded ELF segments, kernel, EL0 stack, page tables and
virtqueues. Stripped ELF LOAD memsz totals ~2.23 MiB; retaining both blob and copied
ELF doubles that component. Thus **16 MiB is plausible only for a tightly capped
small workload**, not proven general capacity. **32 MiB + 8 MiB JS cap** is the v0
starting point; use 64 MiB only for an explicitly larger heap/product tier. The
immediate-off payload boot succeeded n=100 at each 16/32/64 MiB; this proves loader
fit only. Full guest execution and real reclamation must validate the recommendation.

Extra blocker discovered and experimentally exposed: no-op munmap/bump-only RAM.
Command: `docker exec jitk-06-bench python3 /work/bench_churn.py`.
With `--memory-limit 8388608`, 128 sequential touched 1 MiB arrays all succeed;
n=30 **134,446,592 B mmap requests** median/p90/p99 (128.22 MiB), **156 mappings**;
actual VmHWM **2292/2296/2300 KiB**. Counting only successful anonymous NULL mmaps
is already sufficient to exceed 64 MiB cumulatively. A monotonic address allocator
ignoring munmap would exhaust RAM despite a tiny live heap. Implement free-page
reclamation and a reusable mapping range allocator before trusting a RAM cap.
This is a remaining implementation requirement, not eliminated by choosing 32 MiB.

### (d) Integrated execute-to-result proof: REMAINING

Native single-use parking, real echo request/reply, source/bytecode and payload costs
are measured above. Full guest EL0 qjs, virtio-console wakeup and the TS executor
are not implemented in this area, so the final table is a **budget**, not a fabricated
microVM measurement. The immediate-off image cannot execute a tool snippet.
Production KVM experiment was attempted: `docker exec jitk-06-bench ls -l /dev/kvm`
returned **No such file or directory**; container architecture is aarch64. Linux-native
qjs measurements are available, but production KVM boot/transport tails remain UNVERIFIED.

## 4. What I'd cut

- Cut snapshot/restore, shared-memory rings, zero-copy libkrun surgery, guest SMP,
  batching heuristics and CPU overcommit tuning from v0. Measure console first.
- Cut bootstrap precompilation from the launch blocker list: ~83 µs saved per cold
  refill, essentially no warm benefit. Strip now; precompile if refill CPU warrants it.
- Cut VM reuse. Capacity accounting, bounded queues and asynchronous reaping stay.
- Cut 16 MiB as the default and cut no-op munmap for arbitrary bounded JS workloads.

## 5. Open disagreements with consensus, with evidence

1. **“Embed instead of initrd copy” is insufficient.** Both aarch64 paths copy;
   measured stripped RAW/initrd payload costs are 665/686 µs. Strip is the real win.
2. **3.3 ms is not a portable cold-path promise.** Stock here is 9.004 ms and final
   traced bare is 11.849 ms under changing contention. Scale evaluation needs loaded
   distributions, pool-miss behavior and sustained refill capacity, not idle medians.
3. **A small live JS heap does not justify a bump-only kernel.** Churn consumes
   >128 MiB cumulative mappings with ~2.24 MiB peak RSS. Recycling addresses/pages
   is needed even when all individual JS allocations stay under an 8 MiB cap.
4. **Precompiled bootstrap is not the first performance lever.** Same-context saving
   is 81–83 µs; a ready pool already hides it, and stock qjs needs an evaluation hook.
5. **NG is not a demonstrated startup improvement.** Smaller CLI, slower native
   first-statement time in this specific configuration; feature/flag parity unverified.

## 6. Estimated LOC

Production incremental host pool/admission/reap logic **180–260 LOC**, trace/metrics
**60–100**, optional bytecode evaluation hook **15–30**. Reusable guest mmap/free-page
allocator **100–180 LOC** (owned with memory/kernel area, not counted twice).
No additional guest transport LOC estimated here; use the console area's budget.
Benchmark artifacts are ~400 LOC of C/Python/JS plus commands/data, not production
kernel code. Pool target latency, sustained throughput, host RSS/VM and 32 MiB guest
fit remain validation gates; no security concession is included in the latency budget.
