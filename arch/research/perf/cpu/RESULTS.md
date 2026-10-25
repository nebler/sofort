# macOS CPU and latency ledger — a2-cpu

Pinned input: `58ab4435ebd450db9754b2b1ece39789805b94b5`. All implementation changes were made in `/tmp/sofort-a2/`; the shared executor working tree was never used as a profiling input. This report concerns macOS/HVF only.

The important accounting distinction is **latency until the caller receives a result versus CPU to supply a fresh, single-use VM for every result**. Parking moves boot and refill off the result path; it does not avoid that work. Snapshotting a persistent slot can avoid it. Cached preparation and replacing the transport address a different set of costs.

## Inputs, environment, and measurement boundaries

- Apple M4 Pro, Mac16,8, 12 logical CPUs, 24 GiB; macOS 26.6.1 (25G76). Node `/tmp/jitk-09/node-real`, v24.22.1; Rust 1.95.0; release/LTO, panic abort, one vCPU, 32 MiB guest RAM, precompiled Seatbelt profile.
- The committed kernel rebuilt byte-for-byte to `6c00a278cff95058241967655810dcf0cc9cfa1158a38630d818f26c3b07cbc6`, 2,924,584 bytes. The symbol-bearing `/tmp/jitk-01/qjs-static` strips byte-for-byte to the committed payload (`ea2367e9dfc7484b6ad6d551b0bbc25d0247e2781f49ad822fa04c2753f80341`). This permits probes in the actual payload rather than a different QuickJS build.
- The reused `/tmp/jitk-01/r3/darwin/libkrun` build lacked HEAD's `raw-direct-load.diff`. The baseline copy applies that exact patch before building. Thus image loading below is **file → guest RAM**, without the former intermediate `Vec`. The reusable original directories were read-only throughout.
- Every VM/Node/profile run was wrapped in `/usr/bin/lockf -k /tmp/sofort-bench.lock`. Each raw VM observation records `uptime` and load; Node observations record load per request and the environment record contains machine details. The machine remained busy. These are **contended measurements**, not replacements for the earlier low-load numbers. Serialization prevents our timing runs from overlapping other cooperating agents' timing runs, not unrelated host load.
- Raw VMM: spawn → sandbox acknowledgement + READY; then 5 ms parked, RUN → validated DONE(2), followed by process exit/reap. `one_tool` immediately echoes 2; no provider delay. Python is the offline controller, not an added production-path helper. Three warmups are excluded. Uninstrumented VMM: n=30 per fixture/mode; final VMM phase ledger: n=30 per fixture.
- Executor: process startup and pool preparation excluded; `execute()` → validated result; n=50 per case/mode after five warmups. An additional boundary drains retirement and refills the pool, recording steady-state service CPU. MCP: official SDK client → stdio server → real declared `math.add(1,1)` policy → result; n=50 after five warmups, with 30 ms refill gaps. Profiling arms use n=100 and are shown separately.
- `getrusage(RUSAGE_SELF)` records process-wide user/system CPU at VMM boundaries; `wait4` records complete child CPU. Node uses `process.cpuUsage()`, `resourceUsage()`, `uvMetricsInfo`, and `eventLoopUtilization()`. A measurement-only N-API addon reads `RUSAGE_CHILDREN` and live child/watchdog CPU. It introduces no per-call subprocess. Child CPU for parked service is charged on reap, including that VM's earlier boot; this is amortized single-use service accounting. Watchdog remains live and is reported separately where available.
- `proc_pid_rusage` user/system fields are Mach ticks on this host. Multiply by `125/3` to obtain nanoseconds; treating the raw fields as nanoseconds undercounts CPU by 41.67×. `getrusage` and Node CPU values are already microseconds. Guest CNTVCT frequency is 24 MHz. Guest counter intervals are elapsed time, **not** a user/system CPU split and not a guarantee of uninterrupted guest execution.

## Historical waterfalls: the four requested baselines

These numbers retain their original meanings and raw sources. Their old runs did not contain the new phase probes; assigning invented subphase values to them would be misleading.

| Path | Historical p50, µs | What the waterfall actually includes |
|---|---:|---|
| Cold return2 | 5,904 wall; 4,859 CPU through reap | Process launch + confinement + libkrun build/map/load + guest boot + RUN/DONE + exit CPU. The often quoted “~6 ms boot” was spawn → DONE, not a timestamp of READY. |
| Parked raw return2 | 183 wall; 4,801 CPU through reap | Only RUN → DONE is on the latency path. The CPU figure still includes boot and disposal of its single-use VM. |
| Parked raw one_tool | 285 wall; 4,841 CPU through reap | Same raw RUN/DONE path plus one immediate echo round. 285−183=102 µs is a difference of medians, not an individually measured transport phase. |
| MCP execute, one_tool | 2,106 wall | Same-run MCP benchmark: executor arm 1,588; core arm 1,749; MCP arm 2,106. Waterfall of arm medians: 1,588 + 161 + 357 = 2,106. The 161/357 values are differences of medians, not isolated causal costs. |

Sources: [`RESULTS-quiet-2026-10-24.md`](../../../jitk/bench/RESULTS-quiet-2026-10-24.md), [`raw-quiet-2026-10-24.json`](../../../jitk/bench/raw-quiet-2026-10-24.json), and [`mcp/RESULTS.md`](../../../jitk/mcp/RESULTS.md) / [`bench-results.json`](../../../jitk/mcp/bench-results.json). Quiet raw bench: n=30 per row, load1 3.28–4.13. MCP bench: n=30, load1 4.66–4.85. These historical sources precede the current direct-load rebuild. The approximately 1.8 ms gap between raw one_tool and MCP is not all “MCP”; the executor injects and the guest reparses substantial trusted adapter code.

## Current control measurements

| Path / case | n | p50 wall µs | p50 CPU µs / boundary | load1 |
|---|---|---|---|---|
| Raw cold/return2 | 30 | 16,364.9 | 12,116.0 full child | 39.7–40.9 |
| Raw parked/return2 | 30 | 1,395.9 | 13,674.5 full child | 39.7–40.9 |
| Raw cold/one_tool | 30 | 21,458.3 | 13,063.5 full child | 39.7–40.9 |
| Raw parked/one_tool | 30 | 1,987.7 | 13,117.5 full child | 39.7–40.9 |
| Executor control/parked/return2 | 50 | 2,881.9 | 774.5 Node to resolve | 39.7–39.9 |
| Executor control/parked/one_tool | 50 | 3,365.6 | 1,067.5 Node to resolve | 39.7–39.9 |
| Executor control/cold/return2 | 50 | 17,607.1 | 1,799.5 Node to resolve | 39.9–39.9 |
| Executor control/cold/one_tool | 50 | 19,138.7 | 2,168.5 Node to resolve | 39.9–39.9 |
| MCP pristine control/return2 | 50 | 3,092.2 | 369.0 client; server unprobed | 17.1 |
| MCP pristine control/one_tool | 50 | 3,360.4 | 370.0 client; server unprobed | 17.1 |

A later instrumented executor pass at load1 17.44 measured parked return2 **1,255.5 µs wall / 416.5 CPU-µs Node**, and one_tool **1,517.0 / 585.5** (n=50 each). Different load and probes prevent treating this as a causal improvement over the earlier control. It shows why a fixed “current latency” without load is inadequate. The initial twelve-arm VMM collection passed 360/360 after the 36 excluded warmups (the pristine control comprises 120/120 measured observations); final phase observations passed 90/90 after nine warmups. The final instrumented executable had one earlier 5-second startup timeout with no output, retained as a failed admission; bounded retry with a 30-second controller limit then completed without further failure.

Latency and CPU medians are computed independently; neither medians of subphases nor separately measured CPU categories should be added to claim a total median. The additive phase tables below use **means from the same observations** where a closed waterfall is required. p90/p99, every observation, and load ranges are in the raw summaries.

## VMM waterfall and CPU split

Unmodified guest on instrumented VMM, return2, n=30, load1 **13.885**. All entries below are **means in µs**, from a single closed, nonoverlapping process-wide timeline. User+system CPU can exceed wall in an interval because VMM threads run concurrently.

| Phase | wall mean | user CPU mean | system CPU mean |
|---|---|---|---|
| pre-main | 5,734.9 | 2,610.5 | 1,822.3 |
| argv seed clock | 76.1 | 12.8 | 63.1 |
| console configure | 6.5 | 2.9 | 3.8 |
| payload config | 4.3 | 1.6 | 2.5 |
| sandbox prepare | 39.8 | 4.3 | 35.3 |
| sandbox apply | 33.3 | 12.9 | 20.4 |
| ack | 5.8 | 1.0 | 5.0 |
| libkrun context | 12.4 | 5.0 | 7.2 |
| choose payload | 1.3 | 0.9 | 0.4 |
| anonymous RAM mmap | 4.5 | 1.9 | 2.6 |
| image read to RAM | 460.0 | 2.5 | 450.5 |
| payload finish | 4.6 | 1.5 | 2.8 |
| commandline | 5.0 | 1.7 | 3.4 |
| HV VM create | 89.9 | 15.8 | 65.7 |
| map prelude | 1.0 | 0.4 | 0.9 |
| HV map memory | 4.7 | 3.0 | 5.2 |
| devices GIC FDT | 606.4 | 167.4 | 261.0 |
| thread startup | 39.6 | 14.5 | 31.5 |
| HV vCPU create | 127.5 | 36.9 | 86.5 |
| vCPU register setup | 15.2 | 6.4 | 11.6 |
| guest boot to READY | 1,569.9 | 1,301.7 | 433.5 |
| parked idle | 6,324.2 | 50.0 | 35.7 |
| RUN to DONE | 316.2 | 222.3 | 91.9 |
| DONE to shutdown | 134.9 | 124.7 | 80.8 |
| console teardown | 95.7 | 34.9 | 94.3 |
| Sum: spawn → pre-trace-dump | 15,713.6 | 4,637.5 | 3,617.8 |

The READY→RUN row contains the intentionally requested 5 ms idle interval, controller overhead, scheduling and the tail of READY delivery. It is **not** pure steady-state idle CPU. Five trailing MMIO returns occur in this boundary, so charging that entire CPU to idle polling would be wrong. Excluding this deliberately parked interval gives a mean **9,389.4 µs** of creation/run/cleanup wall segments and **8,169.6 CPU-µs**; this is an accounting subtraction, not a new cold-latency benchmark.

In the separate one_tool final phase row (n=30, same load), RUN→DONE averages **470.3 µs wall / 490.0 CPU-µs**. Exact phase summaries are in `raw/summary-vmm3.json`. Spawn→READY medians are 8,194.9 µs return2 and 8,387.0 µs one_tool in this later phase pass. These include instrumentation and a different load from the first control pass.

The first Rust-main CPU reading includes work before `main` (process execution, loader/runtime initialization and their system calls). The host absolute monotonic spawn timestamp and the VMM's Mach origin measure that wall interval; it is not silently charged to VM creation. Rust/libkrun API configuration precedes confinement, while HVF VM creation and memory registration happen inside `build()`.

`first_hv_run` is immediately before the first `hv_vcpu_run`, not an exact hardware timestamp of the first retired instruction. The first guest instruction reads CNTVCT; its counter and the host origin share the measured Mach/CNTVCT domain. No single-step mode was enabled. vCPU startup overlaps the main thread finishing `build()`, so intermediate build-return marks are retained in raw data but not double-counted in the sequential waterfall.

Instrumentation is buffered until shutdown. The ledger ends before dumping the host trace; comparing instrumented `wait4` totals to baseline totals would charge trace formatting/writes to production. `DONE → shutdown/teardown` is measured before the trace dump. Remaining process-destruction CPU and the controller's CPU are not fabricated as guest work. The uninstrumented complete-process row includes actual exit/reap cost. `getrusage` probe cost is included in instrumented phase values; small intervals near its resolution should not be treated as exact instruction costs.

## Guest boot waterfall

Exact-payload guest probes, n=30, load1 13.885. Elapsed CNTVCT intervals; p50 and mean are µs.

| Guest phase | p50 | mean |
|---|---|---|
| boot BSS clear | 49.2 | 49.5 |
| kernel MMU | 12.1 | 12.5 |
| FDT config | 5.5 | 5.4 |
| virtio console init | 166.0 | 183.1 |
| GIC init | 35.4 | 39.4 |
| EL0 pages argv | 17.2 | 21.3 |
| aliases cache clean | 362.5 | 374.2 |
| libc to qjs main | 1.8 | 2.9 |
| qjs main to runtime | 1.8 | 2.1 |
| JS runtime | 44.5 | 45.1 |
| runtime to context | 0.7 | 0.7 |
| JS context modules | 188.4 | 196.5 |
| helpers to bootstrap eval | 91.6 | 99.3 |
| bootstrap eval to READY | 501.4 | 525.9 |

Probe sensitivity check: with the same instrumented VMM, first-entry→READY p50 was 1,508.1 µs for the pristine guest and 1,558.0 µs for the probed guest; mean process CPU in that span was 1,735.2 versus 1,836.4 CPU-µs (n=30 each, interleaved). The differences include probe/code-layout/cache and scheduling effects and are not a calibrated per-SVC cost. The coarse boot ledger should be trusted more than instruction-level precision for small guest phases.

The first-instruction CNTVCT timestamp follows the host first-HVF-entry marker by **13.9 µs p50 / 21.3 µs mean** (n=30, range 9.9–113.5), which includes entry/dispatch and scheduling rather than a single-instruction cost. Guest phase means are additive within their covered intervals; the host first-entry→READY span also includes console TX delivery and host scheduling. Six SVC probes, timestamp stores, and cache effects remain in these numbers.

The probes store CNTVCT values in a fixed array and output one bounded console record **after DONE**, avoiding boot-time console logging perturbations. Six private SVC probes replace verified instructions in the exact payload; the kernel records a timestamp and emulates the displaced register operation. They do not introduce HVF exits or rebuild QuickJS. The probe list and expected instruction words are in `reproduce/owned-profile.patch`.

The cache-maintenance interval includes read-only alias protection, TLB flush, the `dc cvau` loop over `0x400000..0x650000` in 64-byte steps, and `ic iallu`. It is not merely page-table construction. The range covers 37,888 cache lines; optimizing page-table loops alone leaves this larger boot step. The console initialization interval includes host/guest startup handshakes and may include scheduling. Bootstrap's eval interval includes parsing and evaluating the canonical bootstrap and the path to its READY write; it is not a microbenchmark of JSON serialization.

## Parked RUN/DONE and HVF exits

| Case | Counter interval | p50 exits [min–max], n=30 |
|---|---|---|
| return2 | boot | EC 0x24: 66 [64–72] |
| return2 | idle | EC 0x24: 5 [5–5] |
| return2 | run | EC 0x24: 5 [5–5] |
| one_tool | boot | EC 0x24: 65 [64–68] |
| one_tool | idle | EC 0x24: 5 [3–5] |
| one_tool | run | EC 0x24: 13 [12–13] |

Whole lifecycle to pre-dump: return2 p50 **79 data-abort/MMIO + 1 HVC**; one_tool **86 + 1**. Other exposed EC/reason bins were zero in these fixtures. In the narrower RUN-received→DONE-produced interval, return2 is exactly five data-abort/MMIO returns and one_tool usually thirteen; WFx/sysreg/cancel/vtimer returns are zero. The extra tool cost is therefore eight more exposed MMIO returns in this request shape, not a measured constant µs/exit. Boot MMIO counts vary slightly because READY observation races the tail of console handling.

These counters describe **host-visible HVF returns**. They are not counts of all guest syscalls, IRQ instructions, guest WFI instructions, stage-2 faults handled inside the hypervisor, or hardware VM exits invisible to this API. EC 0x24 is a lower-EL data-abort/MMIO path, EC 0x18 a trapped system register, EC 0x16 HVC, and EC 0x01 WFx where exposed. Cancellation/vtimer returns are separate. No meaningful per-exit CPU distribution can be inferred by dividing total run CPU by exit count: guest work, console workers, and event-loop processing run between returns.

The transport agent's independent n=31 small-call census starts before the guest codec and ends after consuming the reply, excluding RUN/prelude/DONE. Its initial observed one-call window has 3 encoder/3 decoder operations in the guest; a real guest read + writev + ppoll; host MMIO reads/writes and eventfd/pipe activity; one guest WFI instruction but zero WFI traps in that smoke. See [`../transport/RESULTS.md`](../transport/RESULTS.md) for the finalized counts and ABI proposal. Hardware GIC signal requests must not be counted as exits. On macOS, libkrun's eventfd implementation itself uses pipes. Our CPU windows are broader than that transport-only census.

## Executor and MCP request waterfall

Executor control (no stream hooks; only per-event CPU/timing callback), n=50, load1 39.73–39.91. **Means in µs.** `execute()` caller boundaries add a small wrapper/snapshot remainder retained in raw data.

| Path | Phase | wall mean | Node user mean | Node system mean |
|---|---|---|---|---|
| parked/return2 | start→acquired | 521.9 | 200.2 | 35.6 |
| parked/return2 | acquired→runSent | 510.7 | 275.8 | 32.6 |
| parked/return2 | runSent→done | 2,694.9 | 183.4 | 43.5 |
| parked/return2 | done→resolve | 79.1 | 42.3 | 5.5 |
| parked/one_tool | start→acquired | 557.6 | 207.8 | 35.8 |
| parked/one_tool | acquired→runSent | 415.7 | 257.5 | 31.0 |
| parked/one_tool | runSent→firstCall | 2,284.1 | 140.2 | 31.0 |
| parked/one_tool | firstCall→firstRet | 270.6 | 169.1 | 18.0 |
| parked/one_tool | firstRet→done | 737.9 | 101.4 | 23.9 |
| parked/one_tool | done→resolve | 71.6 | 29.6 | 4.1 |

Steady-state service accounting, n=50 per row, same control pass:

| Case | Node CPU to resolve p50 | Node CPU through drain/refill p50 | reaped VM CPU p50 |
|---|---|---|---|
| parked/return2 | 774.5 | 2,305.0 | 12,948.0 |
| parked/one_tool | 1,067.5 | 2,776.5 | 13,038.5 |

A later live-child census (load1 17.44, n=50 each) measured watchdog CPU **17.8 µs return2 / 17.1 µs one_tool** between request boundaries, separate from Node and reaped VM CPU. Node through refill was 1,419.0 / 1,620.5 CPU-µs, VM child CPU 8,026.0 / 8,135.0. Because the watchdog stays alive, `RUSAGE_CHILDREN` alone would omit it. These distributions were not summed to manufacture a p50 total.

Instrumented MCP server (n=50 per fixture; user+system CPU combined in last column), load1 39.90–40.22. This pass has stream/phase probes; its result latency is not the pristine control above. **Means in µs.**

| Case | Server phase | wall mean | Node CPU mean |
|---|---|---|---|
| return2 | stdinChunk→handlerBegin | 468.0 | 242.0 |
| return2 | handlerBegin→start | 14.7 | 9.8 |
| return2 | start→acquired | 3,166.3 | 480.2 |
| return2 | acquired→bodyBegin | 36.7 | 23.0 |
| return2 | bodyBegin→bodyEnd | 195.9 | 128.1 |
| return2 | bodyEnd→runSent | 344.6 | 215.2 |
| return2 | runSent→done | 11,690.0 | 271.2 |
| return2 | done→resolve | 103.9 | 59.1 |
| return2 | resolve→handlerEnd | 20.9 | 10.1 |
| return2 | handlerEnd→stdoutWrite | 190.2 | 105.4 |
| one_tool | stdinChunk→handlerBegin | 489.9 | 251.6 |
| one_tool | handlerBegin→start | 13.2 | 9.1 |
| one_tool | start→acquired | 1,401.2 | 370.9 |
| one_tool | acquired→bodyBegin | 37.1 | 20.5 |
| one_tool | bodyBegin→bodyEnd | 179.2 | 133.1 |
| one_tool | bodyEnd→runSent | 508.2 | 218.7 |
| one_tool | runSent→firstCall | 6,410.3 | 301.9 |
| one_tool | firstCall→firstRet | 433.4 | 267.0 |
| one_tool | firstRet→done | 3,639.4 | 255.2 |
| one_tool | done→resolve | 65.8 | 46.0 |
| one_tool | resolve→handlerEnd | 9.3 | 7.1 |
| one_tool | handlerEnd→stdoutWrite | 153.8 | 104.3 |

MCP server request-boundary p50s: return2 6,419.3 µs wall, 1,018.0 user / 237.5 system; one_tool 6,699.7 wall, 1,474.5 user / 296.0 system. These exclude the client and work after the response write. The server/core may refill concurrently: 6/100 measured request windows contained VMM stderr data, so the 30 ms gap did not prove every MCP observation had an untouched parked pool. This limitation is retained rather than filtering slow observations away.

The committed executor turns an 8-byte `return 2;` body into a 2,303-character execution body (2,320 for `return await test.echo(2);`), including codec and proxy source. The body string and outer JSON frame are built on the host, then parsed in the guest on every single-use run. `bodyBegin → bodyEnd` measures host code preparation only; the larger `runSent → firstCall/DONE` interval includes guest parsing/evaluation, console delivery, host stream handling, and scheduling. It must not be labeled pure QuickJS CPU.

`start → acquired` on a parked VM is not free pool lookup: `SandboxPool.acquire` awaits deadline arming in the separate native watchdog. One arm write and one acknowledgement chunk precede RUN. `armDeadline` is then called again by execute but returns immediately because the same deadline is already armed. Keep the independent watchdog; move its lease plumbing with the persistent-slot design rather than removing the security boundary.

| Parked fixture, n=50 | VM stdin writes | VM stdout chunks | watchdog writes/ack chunks | libuv turns/events p50 |
|---|---|---|---|---|
| return2 | 1 | 1 | 1 / 1 | 2 / 1 |
| one_tool | 2 | 2 | 1 / 1 | 3 / 2 |

Cold executor medians: return2 four libuv turns / three events and one_tool five / four, with one sandbox stderr chunk and an extra READY stdout chunk. Cold watchdog writes are two per request (registration plus arm). Median Node involuntary context switches in the control request window are 9.5 return2 / 12.5 one_tool while voluntary switches report zero on this host; neither counter equals pipe wakeups.

Stream chunks and write calls are source-level operations, not syscall counts. `uvMetricsInfo.events` counts libuv events; `loopCount` counts loop turns, not OS wakeups. Involuntary/voluntary context-switch counters and selected interposed syscall counts answer different questions. The policy/provider timings here use an immediate pure tool; external service wait is absent.

## Profiles and measurement limits

Node `--cpu-prof --cpu-prof-interval=100`, n=100 per fixture/mode for the executor and n=100 per fixture for MCP, excluding five application warmups for latency tables (the whole-process sample arrays include warmup/startup/refill).

| PID / profile | whole-process samples | ex idle/program | largest self-sample locations / counts |
|---|---|---|---|
| 68347 | 34530 | 6011 | (idle) 28057; spawn 576; (program) 462; (anonymous) 277; parseFrame 240; nextTick 235; (garbage collector) 170; runMicrotasks 153 |
| 69511 | 19492 | 3619 | (idle) 15693; spawn 264; (program) 180; nextTick 128; inst._zod.parse 107; parseFrame 105; (garbage collector) 98; onStreamRead 87 |

The executor profile shows `spawn`, protocol `parseFrame`/`feed`, microtask/nextTick processing, and execute work. MCP adds SDK/Zod parsing and stream reads. These support the source/probe ledger; idle samples are not CPU charged to Node. No microsecond attribution is derived from sample count ×100 because delayed sampling and scheduling break that assumption.

`sample` and `xctrace` were attempted twice with bounded waits. First attachment attempts failed to produce usable output before the short target exited (one sample process terminated after a 15-second controller wait; xctrace reported “Cannot find process for provided pid”). The second attempts exited successfully and recorded the target, but the exported Time Profiler/time-sample tables contain **zero rows**, and `sample` has an empty call graph. Thus there are **no usable native sampled stacks**, and this report makes no stack-based split of the pre-main/opaque system CPU. The successful `.trace` remains at `/tmp/sofort-a2/raw/vmm2.trace`; sanitized TOC/export metadata and sample output accompany the report. No permission denial was reported; zero samples are not evidence that a phase costs zero. The profiler workload was a larger finite JS loop, not a timing fixture.

A later 100-pair clock calibration found `hrtime`−Mach offset approximately 3,399,615,648.7 µs. This later calibration does not retroactively establish the offset throughout earlier CPU profiles, so per-request sample-window attribution was deliberately omitted.

A 100 µs Node sampling interval materially perturbs these short requests; the profiled runs are not the latency baseline. Whole-process profiles include module startup and refill. CPU probes provide per-request user/system accounting; sample counts provide code-location evidence rather than exact microseconds for each function. V8 profile and `process.hrtime` origins differ on this Mac; any aligned sample analysis must use the recorded clock calibration, not assume the origins match.

The high-load run cannot establish an uncontended latency floor, a macOS restore cost, or Linux/KVM performance. No restore, shared-memory ring, native runner/broker, or cached-preparation implementation was benchmarked by a2. Estimates below are allocations to test. VM-kernel CPU within HVF/ioctl/syscall phases remains opaque at finer resolution without usable kernel stacks; user-vs-system phase accounting is measured, but instruction-level attribution is not available.

## New architecture: remove, shrink, keep

All remaining costs in this table are **estimates/targets**, in µs per small run on a slot already available, not measurements. One-time preparation and worker construction still cost CPU, amortized across successful restores.

| Current phase | New mechanism | Effect | Estimated remaining cost |
|---|---|---|---:|
| Process spawn, loader, libkrun context/config | Persistent native HVF worker per slot | Removes per-run launch/build; keeps one-time worker setup | 0 on ordinary run; amortized creation not zero |
| Seatbelt profile read/apply | Confine persistent worker once | Removes per-run application; keeps confinement | 0 on ordinary run |
| Anonymous RAM allocation, image read/copy, HVF VM/vCPU creation | Precreated slot + immutable snapshot | Removes repeated creation and image loading | Replacement restore/reset 100–375 wall, ~100–400 CPU allocation |
| MMU/user page-table setup, cache sweep, QuickJS runtime/context/modules, bootstrap eval | Snapshot after prepared checkpoint | Removes replay of boot; keeps restore coherency work | Boot replay 0; coherency belongs inside restore budget |
| Existing entropy/clock setup | Trusted repair + late binding | Keeps essential uniqueness, changes implementation | 15–35 |
| Per-run codec/prelude source, normalization, JSON source frame | Cached prepared profile + compact run bindings | Removes trusted source reparse; keeps user source validation/parse | 40–200 for tiny JS (host+guest budget; verify) |
| Pool acquire + watchdog arm/ack | Native lease/slot generation + independent watchdog | Shrinks callback/IPC plumbing; keeps deadline enforcement | 20–50 |
| Virtio console, GIC/IRQ/WFI, pipe/eventfd delivery | Rings + SUBMIT/WAIT/FINISH | Removes device/pipe chain; keeps VM boundary and notification | One tool round 28–120 allocation; ≤30 p50 incremental-call stretch remains unproved |
| Policy, schemas, effects, credential dispatch | Node policy initially; native broker only after gate | Keeps semantics; shrinks representation/copy work | Included in tool-round allocation; current measured Node share exceeds the 100 µs gate before proposed changes |
| MCP client/server SDK, stdio ingress + response | Node first; gated native ingress later | Shrinks source work; native ingress can remove Node framing/schema overhead | 60–250 ingress; native ≤70 target; FINISH/response 70–160 |
| Kill/reap and cold refill after every result | Restore stopped slot, discard private delta | Removes process teardown and replacement boot from each result | Reset/refill CPU belongs in restore allocation, never excluded from service CPU |
| Host scheduling and real tool I/O | WAIT releases runnable ownership; bounded queues | Shrinks contention; external service latency remains | No defensible fixed µs prediction on this busy Mac |

The architecture's seven allocations sum to **333–1,190 µs** (60–250 ingress + 20–50 lease + 100–375 restore + 15–35 repair + 40–200 JS + 28–120 tool + 70–160 finish). That arithmetic does not prove the ≤1,000 µs gate; simultaneous upper-end costs exceed it. The ≤250 µs stretch needs measured reductions below these initial allocations. A parked raw result alone says nothing about the total restore/refill CPU budget.

## Raw data and reproduction

Numeric summaries: [`raw/summary-vmm3.json`](raw/summary-vmm3.json), [`raw/summary-host.json`](raw/summary-host.json), [`raw/profile-summary.json`](raw/profile-summary.json), and [`raw/environment.json`](raw/environment.json). Full observations are gzip-compressed without changing their contents: `raw/vmm3.json.gz`, `raw/vmm.json.gz`, `raw/host-*.json.gz`, `raw/mcp-*.json.gz`, and `raw/CPU.*.cpuprofile.gz`. The uncompressed originals remain in `/tmp/sofort-a2/raw/`. `raw/SHA256SUMS` identifies the exported evidence.

Exact copy/build/run instructions and instrumentation deltas: [`reproduce/README.md`](reproduce/README.md), [`libkrun-profile.patch`](reproduce/libkrun-profile.patch), [`owned-profile.patch`](reproduce/owned-profile.patch), and the measurement/analysis scripts in the same directory. Environment records bind binaries, images, source bundle, timebase and tool versions. The VMM/executor timing runs enforce controller or watchdog deadlines and validate DONE/result semantics. The report scope changed no shipping code, so the aggregate `make -C arch/jitk test` gate was not re-run by a2; isolated baseline and instrumented images were functionally exercised by the measurements.

Private peak disk use stayed below 0.6 GiB (limit 1.5 GiB). Build outputs are deleted after collection; reported binaries, final images, source/probe patches, and raw data remain. No commit was made.

## Findings → recommended changes

1. **Implement snapshot restore in a persistent HVF slot, with the checkpoint after QuickJS/modules/bootstrap.** This is the largest measured service-CPU opportunity: the current parked run still pays whole-process boot/disposal CPU. It also enables sharing immutable pages, the main memory opportunity; a2 did not measure a new per-VM memory figure. Preserve uniqueness repair, stopped-slot reset, and a killable watchdog boundary.
2. **Land cached preparation and remove repeated trusted source injection.** This attacks both Node preparation/frame encoding and the much larger guest RUN parsing/evaluation window without waiting for a new VMM. The 2.3 KiB trusted body for a trivial result is direct evidence. Use w1's paired implementation measurements for the saving; do not subtract raw and MCP medians from separate experiments as a promised win.
3. **Replace virtio-console/GIC/WFI with the bounded ring and WAIT ABI.** The guest's low syscall count hides a longer chain of host threads, MMIO, eventfd pipes, and scheduling. WAIT must release ownership while a tool is pending; otherwise low active latency does not imply idle density. Do not retain console infrastructure just to carry ring doorbells.
4. **Move physical pool/watchdog lease plumbing into the native persistent runner and remeasure Node policy/MCP CPU.** Current Node request CPU is well above the architecture's 100 µs / 20% trigger, but cached prep and ring integration change that denominator. Keep one policy authority; if the gate still fires, replace the broker/ingress rather than adding another authority.
5. **Defer fine MMU/kernel tailoring and broad engine changes.** Page-table work is small relative to process startup, cache maintenance, console handshakes, prepared JS, and adapter reparsing. Optimize a measured restore dirty/fault census first. A smaller kernel alone does not erase the current per-process service cost.
