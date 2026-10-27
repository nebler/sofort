# Early roadblocks: QuickJS/Wasm capsules in the first 2–6 weeks

Research date: **2026-10-27**. Angle: what prevents a useful, bounded, portable capsule backend from becoming a product. **F** = sourced fact, **M** = measured in this research, **I** = inference/recommendation, **E** = estimate. All web sources below were checked on 2026-10-27; publication/update dates are given where available. Severity is conditional on the proposed product: **blocker** prevents safe release or a central promise, **serious** can consume a substantial part of six weeks, **manageable** has a narrow implementation path.

**I — De-risk resource enforcement first.** The transportable continuation is already demonstrated. The immediate release blockers are an allocator limit that does not account for allocated bytes, execution that can monopolize its owner, and an undefined tenant failure boundary. A small Node/browser demonstration can proceed while these are fixed; a public multi-tenant service cannot inherit the spike's resource claims.

## Priority and severity

| Order | Roadblock | Severity | Early decision / mitigation |
| --- | --- | --- | --- |
| 1 | Hard memory budget, stack protection, and runaway execution | **Blocker** for untrusted service | Accurate allocator + fixed linear maximum + deterministic work budget + independently terminable owner |
| 2 | Tenant fault containment versus density | **Blocker** if sold as hardware-grade; **serious** for software tier | Pick process/VM trust groups before optimizing instance density |
| 3 | Real agent/library heaps and snapshot growth | **Serious** | Measure actual programs; cap snapshot bytes, fork fan-out, payload retention and history |
| 4 | Replay semantics and engine/build compatibility | **Serious**; **blocker** for unrestricted “exact replay” | Version a deterministic profile, journal delivery order, verify trace digests |
| 5 | Interpreter throughput versus V8 JIT | **Manageable** for small glue; **serious** for local compute | Bound work between tools; run bulk operations as trusted tools |
| 6 | npm / Node API expectations | **Manageable** for explicit JS subset; **blocker** for drop-in Node | Bundle a supported library set; keep SDKs, networking and process APIs in host |
| 7 | Cloudflare execution and deployment restrictions | **Serious** for day-one edge parity | Deploy fixed Wasm module, qualify hosted paid Worker path, shard concurrency |
| 8 | JSPI / Asyncify dependence | **Manageable** if avoided; **serious** if made foundational | Checkpoint QuickJS promises after all Wasm frames return |

**E — Suggested sequence:** days 1–3 resource/failure-envelope prototype; remainder of week 1 real program/library census; weeks 2–3 replay and checkpoint contract; weeks 3–6 hosted edge qualification, bounded concurrency and security hardening. These are research priorities, not a delivery commitment; a hardened service can take longer.

## What was inspected and measured

**F — Existing evidence read:** the [research brief](/Users/noah/code/sofort/arch/research/v8/BRIEF.md), [portability spike](/Users/noah/code/sofort/arch/research/portability/02-wasm.md), its read-only raw directory `/Users/noah/sofort-local-evidence/portability-wasm-2026-10-25/`, the portability brief/usermode/hardware reports, [current executor seam](/Users/noah/code/sofort/arch/jitk/executor/backend.ts), pool/executor/backend selection, [current status](/Users/noah/code/sofort/arch/FINAL.md), demo positioning, and [same-host Linux memory correction](/Users/noah/code/sofort/arch/jitk/bench/RESULTS-LINUX-MEMORY-2026-10-27.md). That correction does **not** establish a Wasm density advantage over jitk/Hyperlight.

**M — Environment:** Apple M4 Pro, arm64, macOS 26.6.1; Node **24.22.1**, V8 **13.6.233.17-node.58**; T3/Electron Chromium **152.0.7977.130**; local workerd **2026-10-25**. Original QuickJS reactor SHA-256 `d239715db73722fecd733e0fa111626f47eafcb8067cfe189f596c42f0159df5`, Bellard QuickJS **2026-06-04**, 2 MiB initial / 32 MiB maximum memory, 512 KiB C stack. No Linux, x86, mobile, Firefox, Safari or hosted Cloudflare performance testing was done. Local microbenchmarks are evidence of mechanisms, not tail-latency guarantees.

**M — Reproduction:** small scripts/results are retained under [/tmp/v8-research-roadblocks/](/tmp/v8-research-roadblocks/), about 1 MiB total, with no downloaded SDKs or saved large snapshots. Original spike files were not modified. Scripts: `helper.mjs`, `deadlines.mjs`, `memory.mjs`, `sizes.mjs`, `perf.mjs`, `density.mjs`, `npm.mjs`, `browser.html`, `meter.py`/`meter.mjs`, `build-hook.py`/`hook.mjs`, and `worker.js`/`workerd.capnp`. Run Node scripts with Node 24; `density.mjs` uses `--expose-gc`. The hook builder uses the read-only WASI SDK/source, and the tiny WAT assembler uses the spike's Python/Wasmtime environment. The JS source bridge is NUL-terminated on each evaluation. Measured tables below preserve the results even if `/tmp` is later cleared.

## 1. Deadlines and interrupting busy synchronous Wasm

**Severity: blocker for a service without an independent kill path.**

**M — A same-thread timer is ineffective during execution.** A 10 ms timer around a warmed million-iteration QuickJS loop fired at **49.86 ms** in Node after **49.79 ms** of synchronous work. Chromium recorded **53.3 ms** after **51.7 ms** of work. An infinite loop would give that timer no opportunity to run. `Promise.race`, AbortSignal and JSPI do not add preemption to this path.

**M — Worker termination works, but replacing its owner has a cost.** Twelve Node Workers initialized QuickJS, announced entry, then ran `while(true){}` in Wasm. After a separate parent timer waited 20 ms, `await worker.terminate()` completed in **0.67–1.63 ms**, median **0.74 ms**. Worker creation through initialized-ready took **19.63–42.30 ms**, median **20.08 ms**. These are local samples, not an upper bound; these Node Workers each loaded/compiled the reactor, whereas the browser test shared a compiled module. A pooled/shared-module owner may have different startup cost. Eight Chromium Workers similarly entered an infinite loop; `terminate()` returned `undefined` in the same coarse timer tick, with replacement startup **4.3–15.0 ms**, median **5.0 ms**. The browser result measures the termination **request**, not acknowledged thread teardown; there is no Node-style completion promise in this experiment. [Node termination contract, v24 branch](https://raw.githubusercontent.com/nodejs/node/v24.x/doc/api/worker_threads.md); [raw deadline results](/tmp/v8-research-roadblocks/deadlines.json), [browser results](/tmp/v8-research-roadblocks/browser.json).

**F — V8 has native embedder termination, not a portable per-instance fuel API exposed by the ordinary Wasm JS interface.** `v8::Isolate::TerminateExecution()` may be invoked from another thread; its scope is an isolate. Node Worker termination is an accessible ownership boundary. Wasmtime explicitly offers fuel and epochs; browser/Node Wasm does not expose those Wasmtime store controls. [V8 C++ API](https://v8.github.io/api/head/classv8_1_1Isolate.html), [Wasmtime interruption](https://docs.wasmtime.dev/examples-interrupting-wasm.html), checked 2026-10-27.

**M/F — The QuickJS interrupt hook is a useful inner budget.** In a scratch rebuild, `JS_SetInterruptHandler` stopped `try { while(true){} } catch (...) { ... }` after **11 callbacks / 1.69 ms**; guest catch did not run. This release resets its interrupt counter to **10,000** and marks interruption uncatchable. That is a poll/work quantum, **not an exact count of all JS instructions or CPU cycles**. The scratch rebuild otherwise retained the spike allocator. [QuickJS interrupt API](https://bellard.org/quickjs/quickjs.html#Execution-timeout-and-interrupts), [local poll implementation](/Users/noah/sofort-local-evidence/portability-wasm-2026-10-25/quickjs-2026-06-04/quickjs.c:7863), [hook results](/tmp/v8-research-roadblocks/hook.json).

**M — Instrumented fuel can trap in V8.** Two tiny WAT modules ran the same 10-million-step integer recurrence, one with a mutable i64 fuel counter checked/decremented on every loop iteration. Exhausting fuel trapped with `RuntimeError: unreachable`. Warm nine-sample medians were **15.78 ms plain / 15.90 ms metered**, 135/149 module bytes. This manually instrumented one-block loop establishes feasibility only; it does **not** establish the overhead or completeness of a general QuickJS-Wasm instrumentation pass. [Meter experiment](/tmp/v8-research-roadblocks/meter.json).

**I — Mitigation:** use deterministic QuickJS work/poll quotas per slice, bounded job pumping and bounded synchronous host imports, plus an outer worker/process deadline controlled by a different execution owner. Qualify parser/compile work, BigInt, regex, JSON, sorting/comparators, finalizers and recursive calls; interpreter polling alone does not prove that all C/runtime work has bounded interruption latency. Generic Wasm basic-block metering covers more C execution, but must cover every control-flow cycle, use overflow-safe costs, charge imports separately, and be benchmarked on the actual reactor. Treat a forced stop as capsule failure; restore the last durable checkpoint rather than saving a half-interrupted runtime.

**I — Deadline ownership matters:** one terminable Worker holding 100 parked capsules loses all 100 in-memory states if killed. Either run one active capsule per owner with parked capsules externalized, accept/checkpoint a bounded shard's collateral loss, or pay for stronger per-capsule owners. Parent event-loop stalls can delay a Node timer too; preserve the current executor's independent-watchdog principle. Persist remaining work quotas and trusted deadlines across restore/fork so restarting does not refill an attacker's budget.

**De-risk first:** **yes, together with memory**. Proposed gate (**E**): under a defined stress load, kill runaway guest execution within the chosen overshoot SLO and show unrelated tenant requests remain responsive; do not infer this from the 12 quiet samples.

## 2. Memory: the spike's 16 MiB limit is not a limit

**Severity: blocker until enforcement is repaired; serious density/high-water risk afterward.**

**F/M — Root cause confirmed.** The selected `__EMSCRIPTEN__` branch returns **zero** from `js_def_malloc_usable_size`. QuickJS's default accounting consequently adds allocation overhead rather than actual allocation size. `JS_ComputeMemoryUsage().memory_used_size` walks live structures and is a different statistic from the allocator's enforcement counter. With **20 separate 1 MiB typed arrays**, measured live usage was **21,026,153 bytes**, but the counter used for the limit reported only **536 bytes**. A separate original-reactor run retained **31 MiB** of typed arrays before linear-memory exhaustion, despite `JS_SetMemoryLimit(16 MiB)`. [Default allocator source](/Users/noah/sofort-local-evidence/portability-wasm-2026-10-25/quickjs-2026-06-04/quickjs.c:2137), [memory results](/tmp/v8-research-roadblocks/memory.json), [accounting probe](/tmp/v8-research-roadblocks/hook.json).

**M — The Wasm outer maximum did enforce its declared ceiling.** At **33,554,432 bytes**, another page via the host `memory.grow(1)` threw `RangeError: ... Maximum memory size exceeded`. The guest exhausted its allocator just below that ceiling. This bounds the one linear memory, **not** all host queues, emitted frames, decoded JSON, snapshot copies, stacks, compiled code or process RSS.

**F/M — Freeing JS objects does not shrink this linear memory.** After freeing the 31 MiB arrays, live usage fell to **51,532 bytes** while logical memory stayed **33,488,896 bytes**. Core memory has growth, not a shrink operation; libc can reuse freed blocks, but this snapshot strategy still copies the high-water byte array. [Wasm memory instruction specification](https://webassembly.github.io/spec/core/syntax/instructions.html#memory-instructions), [raw results](/tmp/v8-research-roadblocks/memory.json).

**F — Two supposed safeguards do not supply the missing cap.** Node `Worker.resourceLimits` excludes external data including ArrayBuffers and does not prevent a process-wide OOM. The spike also defines `__EMSCRIPTEN__`, which disables QuickJS's `CONFIG_STACK_CHECK`; merely calling `JS_SetMaxStackSize` will not restore a check compiled out of this build. The fixed 512 KiB C stack is not proof of safe recursion handling. [Node v24 limits](https://raw.githubusercontent.com/nodejs/node/v24.x/doc/api/worker_threads.md), [build switches](/Users/noah/sofort-local-evidence/portability-wasm-2026-10-25/quickjs-2026-06-04/quickjs.c:75).

**M — Small empty-instance RSS does not predict populated density.** A separate process retained 0/8/32 instances, each holding a touched **2 MiB** array. RSS was **53,477,376 / 76,955,648 / 146,604,032 bytes**; the 8→32 slope was **2.77 MiB/instance**, versus the previous minimal spike's ~0.38 MiB. Each had **2.875 MiB** logical memory. This one Mac residency run is neither a Linux PSS/cgroup measurement nor a worker-per-capsule measurement. [Density results](/tmp/v8-research-roadblocks/density.json).

**F/I — Many memories also consume virtual address space.** V8 documents that trap-based bounds checking can reserve much more address space than the requested memory capacity. Thus RSS, committed memory, reservation, host JS heap and instance count all need separate telemetry/admission controls; there is no useful universal “N capsules per process” constant. [V8 reservation API](https://v8.github.io/api/head/classv8_1_1V8.html).

**I — Mitigation:** supply audited `JS_NewRuntime2` malloc/realloc/free functions that count actual requested/rounded bytes, including overflow-safe realloc deltas and correct failure/free accounting. Enforce a lower JS quota inside a fixed Wasm maximum, with reserve for static data, stack, parser temporaries and OOM reporting. Repair/qualify stack guards. Bound frame sizes and queues **before copying**, reacquire views after growth, and cap decompressed restore bytes before allocation. Use process/cgroup limits and admission control for the aggregate. Discard an instance after stack corruption or unsafe traps; do not reuse it as a clean pool entry. To recover low-water size, rebuild through replay/application compaction; copying the same high-water snapshot to a fresh instance does not compact it.

**De-risk first:** **yes**. Proposed gates (**E**): thousands of small allocations, few giant buffers, realloc churn, cyclic objects, parse bombs, recursive calls, host-output flooding and concurrent max-sized instances must all fail within their assigned budgets without taking the supervisor down. The custom allocator fix itself was not implemented or security-qualified in this research.

## 3. Determinism for replay

**Severity: serious; blocker for an unrestricted, cross-version “exact replay” promise.**

**M — Encouraging narrow result:** two fresh Node instances and Chromium produced identical serialized results for one fixed-clock program covering `Date.now`, UTC date rendering, two random draws, four Math functions, arithmetic/custom-payload NaNs, object keys and Map insertion order. The observed time was `1700000000000`; both random draws matched. Every tested NaN read back as `7ff8000000000000`. This is a same-machine compatibility sample, not proof across engines/ISAs/version changes. [Node results](/tmp/v8-research-roadblocks/determinism-node.json), [Chromium results](/tmp/v8-research-roadblocks/browser.json).

| Concern | Evidence and practical risk | Mitigation / first qualification |
| --- | --- | --- |
| Clocks and randomness | **F:** this QuickJS seeds xorshift64* from `gettimeofday`; there is no `random_get` import in this reactor. `Date` uses clock/timezone paths. Fixing only a host random import misses `Math.random`. | **I:** explicit PRNG seed/state and virtual wall/monotonic clocks; record clock results or specify deterministic logical advancement. Define whether forks share or intentionally diverge PRNG streams. |
| NaN canonicalisation | **F:** Wasm permits NaN-result variation. This wasm32 QuickJS's `__JS_NewFloat64` normalizes JS numbers; **M:** tested JS NaN paths canonicalized. That does not prove every typed-array/native floating path. | **I:** audit all observable float/bitcast paths; disable relaxed SIMD, normalize at required boundaries or transform FP results. Do not assume browser V8 exposes Wasmtime's NaN compiler switch. |
| `Math` functions | **F:** ECMAScript permits implementation-approximated transcendental results. Here C math is linked into the fixed Wasm artifact, unlike invoking each host's V8 `Math`. | **I:** pin Wasm/libm/toolchain; differential tests on edge values across x86/ARM and actual browsers. Replaying on native QuickJS or host V8 requires a separate semantic qualification. |
| Hash and iteration order | **F:** Map/Set iteration is specified by insertion order; **M:** ordinary object integer/string key ordering matched in the probe. Internal hash layout is not itself observable iteration randomness. | **I:** journal input/delivery order, retain standard iteration semantics, canonicalize protocol digests. Do not sort guest collections in ways that change program meaning. Raw heap bytes need not be identical to prove semantic replay. |
| GC timing | **F/M:** this build exposes `WeakRef` and `FinalizationRegistry`; collection/finalization makes lifetime observable. QuickJS uses refcounting plus cycle GC, whose threshold uses the broken allocation counter. Fixing accounting can change collection behavior. | **I:** exclude WeakRef/FinalizationRegistry from the deterministic profile initially; specify explicit job/GC boundaries. Do not use finalizers for tools/effects. |
| `Date` / `Intl` | **F:** Bellard QuickJS does not implement ECMA402; **M:** `Intl` was absent, probe timezone UTC. Calling a host Intl service later introduces locale/ICU/tzdata/version inputs. | **I:** fixed timezone/locale data; ISO/UTC portable contract; recorded host formatting tool when needed. Enumerate permitted date parsing forms. |
| Concurrency / jobs | **I:** asynchronous tools can settle in a different order; `Promise.race`, callbacks and queued jobs expose it even in single-threaded JS. A pending host queue is not captured by Wasm memory. | **I:** log request identities and exact settlement order; define bounded pump/quiescence and include pending host state in the checkpoint transaction. |
| Engine drift / failures | **F:** Wasm memory growth can fail below its maximum under host pressure. **I:** QuickJS, bootstrap, codec and compiler changes can alter layouts and behavior; host V8 changes should preserve semantics but require regression testing. | **I:** hash exact module/build/ABI, retain old runnable artifacts, and fail closed on incompatible snapshots. Treat OOM and wall-clock kill as infrastructure failure, rather than a replayable application branch unless explicitly modeled. |

Sources for the table: [QuickJS seed and Math implementation](/Users/noah/sofort-local-evidence/portability-wasm-2026-10-25/quickjs-2026-06-04/quickjs.c:47146); [QuickJS NaN normalization](/Users/noah/sofort-local-evidence/portability-wasm-2026-10-25/quickjs-2026-06-04/quickjs.h:175); [GC threshold](/Users/noah/sofort-local-evidence/portability-wasm-2026-10-25/quickjs-2026-06-04/quickjs.c:1780); [Wasmtime determinism guidance](https://docs.wasmtime.dev/examples-deterministic-wasm-execution.html); [ECMAScript Math](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-math-object); [Map semantics](https://tc39.es/ecma262/multipage/keyed-collections.html#sec-map-objects); [weak memory/lifetime semantics](https://tc39.es/ecma262/multipage/managing-memory.html); [QuickJS language support](https://bellard.org/quickjs/quickjs.html#Language-support). QuickJS sources are the 2026-06-04 release; web standards/docs checked 2026-10-27.

**I — Separate three claims:** restoring the same heap is not re-executing from source; semantic replay is not byte-identical heap reproduction; replay within an exact Wasm build is not replay across native jitk and Wasm. Require each replayed tool request's canonical digest to match the journal before returning the saved result. Divergence must stop execution without redispatching old effects. External exactly-once effects still need idempotency/fencing and reconciliation; neither determinism nor a snapshot solves the crash-after-effect-before-record window.

**De-risk first:** after the resource envelope, before freezing the checkpoint format. **E:** a restricted same-build profile is a days-to-week experiment; unrestricted Node/library/cross-version semantics is a much larger project.

## 4. JSPI, Asyncify and Cloudflare deployment

### Suspension availability is not the critical dependency

**Severity: manageable with quiescent checkpoints; serious if arbitrary mid-C suspension becomes a requirement.**

| Runtime | Evidence as of 2026-10-27 | Implication |
| --- | --- | --- |
| Node 24 | **M:** this exact 24.22.1 binary exposes `Suspending`/`promising`; an async Wasm import resumed to 42 without an explicit JSPI CLI flag. | Probe the deployed binary; this is not a minimum-version guarantee for every Node 24 build. |
| Chrome / Chromium | **F:** compatibility data says Chrome 137+. **M:** Chromium 152 test resumed to 42. | Available on tested browser. |
| Firefox | **F:** current compatibility data lists **153+**. Not executed here. | Older installed Firefox remains relevant; do not copy outdated blanket support claims. |
| Safari | **F:** current compatibility data lists **27+**. Not executed here. | Qualify shipping Safari/iOS builds, not just a technology-preview result. |
| workerd | **M:** local 2026-10-25 binary resumed JSPI to 42. Existing Oct 25 spike also passed. | Local support does not prove hosted account/deployment behavior. |
| Asyncify on these hosts | **F/I:** Binaryen transforms the module to spill/unwind/rewind logical state; it does not require host JSPI. The transformed build and glue still need qualification on each host. | More portable serialized C-stack route, with added machinery and overhead. |

Sources: [MDN compatibility repository](https://raw.githubusercontent.com/mdn/browser-compat-data/main/webassembly/api/Suspending.json), checked 2026-10-27; [JSPI proposal](https://github.com/WebAssembly/js-promise-integration/blob/main/proposals/js-promise-integration/Overview.md); [Emscripten Asyncify documentation](https://emscripten.org/docs/porting/asyncify.html); [local workerd result](/tmp/v8-research-roadblocks/workerd.json). The [V8 JSPI explainer](https://v8.dev/blog/jspi)'s Firefox support statement conflicts with the current compatibility dataset; use actual feature/behavior probes for deployment qualification.

**F/I — JSPI suspends inside the host VM; it does not offer an API to export/import its native continuation.** Copying linear memory from a JSPI-suspended instance therefore does not capture the whole execution. Asyncify puts relevant logical stack data in memory, but requires the correct transformed module, stack area, globals, entry arguments and unwind/rewind protocol. It is not automatic portable serialization.

**F — Prior spike evidence, not newly measured:** Asyncify increased this reactor **57% raw / ~50% gzip** and transferred a suspended import path from Node to Wasmtime. The preferred QuickJS `await tool()` path already worked across hosts **without either JSPI or Asyncify**, by returning all Wasm frames to the host. [Prior measurements](/Users/noah/code/sofort/arch/research/portability/02-wasm.md).

**I — Mitigation / de-risk order:** make empty-Wasm-stack checkpoints the v1 contract. JSPI is an optional adapter feature; Asyncify is a separately versioned format only if a real synchronous C API demands it. Neither interrupts a CPU loop without a poll/suspension point. No early JSPI dependency is necessary.

### Cloudflare limits can change the architecture

**Severity: serious if browser/Node density and termination are assumed to carry over unchanged.**

**F — Current hosted limits:** Free HTTP CPU **10 ms**; Paid default **30 seconds**, configurable to **300,000 ms**. Memory is **128 MB per isolate including Wasm**, shared across requests. Current documentation lists **64 MiB uncompressed Worker bundle**, no compressed-size limit, and **1 second** global startup budget. This is the deployment bundle cap, not a per-capsule snapshot cap. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), checked 2026-10-27. Do not carry older 3/10 MB compressed bundle figures into the plan without rechecking.

**F/M — Ordinary Workers require precompiled/deployed modules.** Docs prohibit byte-based `compile`, streaming compile and buffer-based instantiate. Local workerd returned **`CompileError: WebAssembly.compile(): Wasm code generation disallowed by embedder`**; imported `jspi.wasm` instantiated successfully. Dynamic Workers provide a separate loader route accepting `{wasm: ArrayBuffer}` module entries, so “dynamic Wasm is impossible on Cloudflare” would also be wrong. [Web standards restrictions](https://developers.cloudflare.com/workers/runtime-apis/web-standards/), [Wasm API](https://developers.cloudflare.com/workers/runtime-apis/webassembly/) (both updated 2026-04-23), [Dynamic Worker loading](https://developers.cloudflare.com/dynamic-workers/getting-started/) (2026-10-12), [local probe](/tmp/v8-research-roadblocks/workerd.json).

**F — No Web Worker/thread API exists in Workers.** Local workerd also reported `typeof Worker === 'undefined'`. Cloudflare clocks do not advance during synchronous computation: `Date.now` and `performance.now` reflect last I/O. A QuickJS interrupt callback that only checks a host wall clock can therefore fail to notice elapsed CPU in this environment. [Workers Wasm threading](https://developers.cloudflare.com/workers/runtime-apis/webassembly/), [clock semantics](https://developers.cloudflare.com/workers/runtime-apis/web-standards/).

**F — Dynamic Worker custom CPU/subrequest limits apply per invocation.** Distinct in-flight children are limited to **4 per Worker request / 10 per Durable Object I/O context**, not four total capsules across an account. [Custom limits](https://developers.cloudflare.com/dynamic-workers/usage/limits/) (2026-10-12), [concurrency limits](https://developers.cloudflare.com/dynamic-workers/platform/limits/) (2026-08-27).

**I — Mitigation:** deploy a fixed interpreter module and move guest source/snapshot **data**, rather than compiling a new Wasm interpreter per capsule. Use deterministic work quotas plus the platform CPU limit; own-process Node termination cannot be copied into a Worker. Partition isolates/child Workers, externalize parked capsules and leave ample memory for compressed+decompressed image, response copies and concurrent requests. A 32 MiB linear maximum does not imply four full-size capsules safely fit a 128 MB isolate. Test paid hosted execution, load/startup validation, limits and restored-state handling before promising edge parity; local workerd tests are not hosted CPU enforcement tests.

**De-risk first:** perform one hosted qualification during week 1 if edge is in the initial launch scope. Otherwise ship Node/browser first behind the same ABI. The fixed ~0.97 MB reactor is not near the current bundle limit; CPU, aggregate memory and ownership are the earlier risks.

## 5. Real snapshot sizes, forks and storage/egress economics

**Severity: serious; the ~100 KB compressed demo is a low-state example.**

**M — Synthetic but agent-shaped parked programs:** each retained retrieval records with 512-character deterministic pseudo-random printable bodies, IDs/URLs/titles/scores/tags, a Map index, a 100-message transcript window referencing those bodies, and an async closure parked at `tool()`. Each snapshot restored nine times into the same compiled module and returned the correct record count, lookup check and reply. These are workloads with explicit structure, **not production-agent traces**. A binary case retained six MiB of pseudo-random bytes. Full memory snapshots used gzip level 6.

| Parked state (**M**) | Linear bytes | gzip bytes | Live QuickJS bytes | gzip time, ms, one sample | Warm instantiate + grow + restore median, ms (n=9) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Empty record set, same program scaffold | 2,097,152 | 102,980 | 55,396 | 11.0 | 0.31 |
| 100 records | 2,097,152 | 160,502 | 137,508 | 11.6 | 0.27 |
| 1,000 records | 2,097,152 | 661,595 | 819,623 | 29.3 | 0.31 |
| 5,000 records | 5,963,776 | 2,884,317 | 3,859,623 | 115.9 | 0.70 |
| 6 MiB binary buffer live | 7,208,960 | 6,392,662 | 6,344,723 | 135.9 | 0.71 |
| Same buffer freed before checkpoint | 7,208,960 | 6,392,590 | 52,979 | 133.9 | 0.79 |

**M — A real npm dependency also changes the picture.** Bundling installed **Zod 4.6.7**, validating 1,000 `{id,email,tags}` objects and retaining its schema/parsed rows across a pending tool call produced **5,505,024 linear bytes / 1,496,955 gzip bytes / 2,153,868 live JS bytes**. Bundle size was **454,244 raw / 93,581 gzip bytes**; evaluating the already-transferred bundle, validating and parking took **68.1 ms** once. It resumed to `{last:999, valid:true, reply:77}`. This demonstrates one useful package path, not general npm compatibility. The source was appended through the spike's 64 KiB input buffer before evaluation; the staging source string was then released. [Size results](/tmp/v8-research-roadblocks/sizes.json), [Zod experiment](/tmp/v8-research-roadblocks/npm.json).

**I — The freed-buffer result is especially important:** ordinary free/GC does not erase old bytes or reduce the high-water image. A tiny live heap can still yield a multi-megabyte capsule. This affects both retention cost and snapshot confidentiality: deleted tool payloads can remain in the shipped image. Zero-on-free/sanitization can help compression/privacy but requires allocator-level design; blindly zeroing guessed dead regions corrupts state.

**M/I — Warm fork memory-copy cost stayed sub-millisecond at these sizes, but that is only one stage.** The table excludes compression/decompression, module compilation, owner creation, durable write/read, integrity checks, policy/journal handoff and transport. Node/browser ordinary Wasm instances do not get a portable copy-on-write fork API; each resident child needs its own memory. Concurrent parent + image + K children can dominate peak RAM. Content-addressed immutable snapshots allow many branch records to reference one image until children execute, without claiming resident CoW.

**F — R2 Standard pricing on the page updated 2026-10-26:** **$0.015/GB-month**, Class A writes **$4.50/million**, Class B reads **$0.36/million**, Internet egress free. [R2 pricing](https://developers.cloudflare.com/r2/pricing/). This excludes worker CPU and any other delivery layer.

**E — Cost examples, decimal GB, before free allowances/tax, assuming one object per retained image:**

- One million **100 KB** images: 100 GB, about **$1.50/month** storage.
- One million **3 MB** images: 3,000 GB, about **$45/month**; **10 retained versions** each means about **$450/month**.
- One million **6.4 MB** images: 6,400 GB, about **$96/month**, or **$960/month** with ten versions.
- One million writes **per day**: about **$135/month** in Class A operations; one million reads/day about **$10.80/month** in Class B, ignoring included allowances. Repeated checkpoints/branches multiply operations even when storage is small.
- **E:** moving 3 MB over a 10 Mbit/s link needs at least **2.4 seconds** of payload transfer; 100 KB needs 80 ms, before RTT/decompression. At an illustrative non-R2 **$0.09/GB** egress tariff (assumption, not a quoted current provider price), one million 3 MB downloads would cost **$270**. R2's own egress term is zero.

**I — Mitigation:** set separate live-memory, raw-snapshot, compressed-snapshot, history and fork-fan-out budgets. Keep large tool outputs in content-addressed blobs and pass handles/windows into the guest. Cap transcript retention. Hash/deduplicate immutable module/base images and use retention policies. Page/chunk deltas may help, but V8 does not provide a portable dirty-page snapshot API: hashing every page still reads the entire memory, allocator churn changes pages, and delta chains create restore/GC work. Do not spend the first weeks building a delta store before measuring genuine customer programs.

**De-risk first:** after resource controls, run a corpus of real agent programs plus bundled dependencies; reject the 100 KB planning constant. Proposed gate (**E**): publish p50/p95 compressed/raw size, checkpoint CPU, peak fork RAM and full persistence-to-resume latency for that corpus.

## 6. Isolation tier and the extra server boundary

**Severity: blocker for a hardware-isolation claim; serious deployment work for a public software-isolated service.**

**F — What Wasm gives:** validated structured control flow, typed indirect calls and bounds-checked linear memory create a meaningful software fault boundary. A bug in QuickJS normally damages its own Wasm memory rather than directly addressing host memory. Imports remain the intentional capability boundary. [WebAssembly security model](https://webassembly.org/docs/security/), checked 2026-10-27.

**I — What it does not give:** confidentiality from the host, protection from a V8/compiler/runtime escape, an OS process boundary, CPU/memory fairness by itself, or guaranteed elimination of shared-cache/speculation/timing channels. A trapped guest can be contained while a process-wide OOM/fatal engine error kills every resident tenant. A compromised interpreter can manufacture protocol frames and arbitrary in-bounds import arguments; tenant capabilities must therefore be enforced by the trusted broker, independently of guest heap policy.

**F — Engine bugs are not hypothetical categories.** Chrome's 2024-03-26 release advisory included **CVE-2024-2887, WebAssembly type confusion**. This establishes a class of implementation risk, not exploitability of this particular fixed QuickJS build. V8 documents speculative-execution mitigations and their limits/context; do not turn Wasm bounds checks into a side-channel guarantee. [Chrome advisory](https://chromereleases.googleblog.com/2024/03/stable-channel-update-for-desktop_26.html), [V8 untrusted-code guidance](https://v8.dev/docs/untrusted-code-mitigations).

**F — Self-hosted workerd explicitly warns that it is not a hardened sandbox on its own** and calls for an appropriate outer secure sandbox for possibly malicious code. Cloudflare's hosted service adds defenses absent from a local binary. Node's Permission Model likewise says it does not protect against malicious code. [workerd warning](https://github.com/cloudflare/workerd#warning-workerd-is-not-a-hardened-sandbox), [Node permissions](https://nodejs.org/api/permissions.html), checked 2026-10-27.

**I — Minimum server design:** fixed signed/hashed interpreter artifacts; narrow bounded imports; credentials and network access in a separate broker; tenant/trust-group process shards with external memory/CPU/pid limits, restricted OS identity/filesystem/syscalls/network, independent watchdog and crash restart; per-owner worker scheduling inside each shard as needed. Workers are useful for cancellation/event-loop isolation **within a process**; they do not add an independent kernel security boundary. For hostile tenants requiring a boundary independent of V8, retain jitk/KVM or an equivalent confined outer VM. Snapshots arriving from a user-controlled browser must be treated as hostile state; restoring one is not proof that the user ran the intended program or is authorized to execute its pending tools.

**De-risk first:** choose the threat model and owner topology **before** advertising density. One process/worker/VM per capsule changes the empty-instance economics; bounded shards are a tradeoff, not equivalent isolation. A short fault/DoS campaign can qualify mechanisms; it cannot prove absence of engine escapes or side channels.

## 7. Interpreter-in-Wasm versus V8 JIT

**Severity: manageable for bounded glue, serious if the product expects bulk local computation.**

**M — Paired warmed Node experiment:** same source and checked outputs ran directly as a V8 function and as guest JS inside the original QuickJS/Wasm module. Seven batches per workload; 10 warmups; CPU is process user+system time divided by executions. The Wasm path includes a short evaluate/call/result bridge, while direct V8 is a lower-level direct function call. No network/tool latency, policy, persistence or cold owner startup is included.

| Workload (**M**) | Direct V8 CPU ms/op | QuickJS/Wasm CPU ms/op | Ratio |
| --- | ---: | ---: | ---: |
| Build 1,000 records, JSON roundtrip, filter/sort/group/top-10 | 0.772 | 3.993 | **5.2×** |
| Build/validate 1,000 objects, email regex, scalar/tag checks | 0.155 | 1.771 | **11.5×** |
| Million-step integer recurrence | 1.569 | 48.792 | **31.1×** |

[Raw performance results](/tmp/v8-research-roadblocks/perf.json). The schema workload is handwritten validation, **not a Zod benchmark**. These warmed ratios should not be substituted for first-run generated-code performance. They also answer a different question from the previous spike's ~1.4× **Wasm versus native QuickJS** ratio.

**I — Why:** V8 optimizes the interpreter's Wasm machine code, but guest JS still pays QuickJS bytecode dispatch, dynamic operations and engine/library costs. It is not guest JS JIT compilation. JSON builtins can narrow the gap; numeric loops and repeated object predicates can widen it.

**E/I — When it matters:** one ~4 ms transformation surrounding a 100–1,000 ms remote tool is usually acceptable; 100 such local passes consume about **400 ms** versus **77 ms** here. A 49 ms numeric loop alone already exceeds a free Worker's documented 10 ms CPU budget. Higher request volume makes CPU cost material even when one user sees little latency. Phones/slower cores and metering may worsen the absolute cost; they were not measured.

**I — Mitigation:** define the capsule as orchestration/glue, with input/work quotas and measured performance envelopes. Move large searches, tokenization, embedding, crypto, document/image processing and database operations behind trusted tools or specialized bounded Wasm/native functions. Do not add a guest JIT as a week-two optimization: portable code-cache/state capture, executable memory and engine security become a new project.

**De-risk first:** week 1 with real programs, after cancellation works. Compare cold generated snippets, warm continuations and whole-run tool-dominated latency separately. Set an application-specific CPU threshold instead of promising V8 throughput.

## 8. Ecosystem: JavaScript is not Node

**Severity: manageable for an explicit portable profile; blocker for unmodified Node/npm agent environments.**

**M — Probe of the actual embedded reactor:** Promises, Map, typed arrays, WeakRef and FinalizationRegistry exist; `Intl`, `fetch`, `URL`, `TextEncoder`, `Buffer`, `process`, `require`, `setTimeout`, `crypto` and `Atomics` were absent. `SharedArrayBuffer` existed even though the build disables OS Atomics and supplies no threaded host; feature exposure must be deliberate. The successful bundled Zod example shows useful pure-JS dependencies can work. It does not imply that an SDK expecting Web/Node APIs works.

**F — Bellard QuickJS's shell `std`/`os` modules are its own libc wrappers, not Node's standard library.** They are not linked into this reactor. ES module syntax support also does not provide npm resolution, package exports handling, CommonJS, TypeScript compilation or Node native addons. [QuickJS documentation](https://bellard.org/quickjs/quickjs.html#Modules), release 2026-06-04. The MCP TypeScript SDK's documented transports/middleware include stdio and Node HTTP integration, which belong in the host in this architecture. [Official MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk), checked 2026-10-27.

| Expected dependency/API | Early implication (**I**, grounded in probe/API contracts) | Mitigation (**I**) |
| --- | --- | --- |
| `fs`, `path`, `child_process`, `net`, native addons | No Node kernel/process/network runtime; native `.node` binaries cannot run as QuickJS JS | Explicit tools for files/processes/network; use hardware/native tier for workspace tasks |
| LLM/MCP/client SDKs | Typically require fetch/Headers/URL/AbortSignal/streams/crypto or Node transports | Keep SDKs/credentials in host; expose narrow JSON tool stubs |
| npm ES/CJS packages, TypeScript | Runtime lacks a package manager/resolver/bundler; transitive imports and conditional exports matter | Build on trusted host, pin lockfiles, bundle/test approved entrypoints |
| Buffer/encoding, URL, timers, Intl | Missing globals fail even in otherwise pure-JS packages | Small versioned polyfills where useful; journal timer/clock/formatting semantics |
| Schema/data utilities | More plausible, but compilation/source/heap cost can dominate a tiny script | Test concrete bundled versions; retain qualified bundles and measure checkpoint size |

**F — Repository integration is itself work:** `backend.ts` imports child-process/fs at module scope; `executor.ts` imports `node:perf_hooks`; `Backend.kind` has no `wasm` member. Adding one backend class does not make the executor/browser/Workers bundle portable. [Backend source](/Users/noah/code/sofort/arch/jitk/executor/backend.ts), [executor source](/Users/noah/code/sofort/arch/jitk/executor/executor.ts), [selection source](/Users/noah/code/sofort/arch/jitk/executor/select-backend.ts).

**I — Mitigation / de-risk order:** publish a concise guest API/types and supported-package matrix; run a dependency census on the first ten intended agent programs, then bundle and execute them. Separate the trusted Node launcher from portable protocol/policy logic. Do not spend six weeks implementing Node compatibility when the product's only intended I/O is a tool channel. Reject unsupported imports before execution with actionable errors. This is week-one scope control, not a late polish task.

## Five-line TL;DR

1. **M/I:** De-risk memory and deadlines first: the 16 MiB QuickJS cap accepted 31 MiB; independent termination is mandatory.
2. **M/I:** Snapshots grow with libraries, retained data and freed high-water bytes: measured examples reached 1.5–6.4 MB compressed.
3. **I:** Replay needs a pinned deterministic profile and ordered journal; matching clocks/random alone is insufficient.
4. **M/I:** JSPI works in tested Node/Chromium/workerd, but empty-stack QuickJS checkpoints avoid needing it or Asyncify.
5. **M/I:** Keep the scope to bounded JS glue: measured V8 gaps were 5–11× on glue, and public tenancy needs an outer containment design.

**Verdict: GO-WITH-CHANGES for this angle.** **I:** Build the portable software tier, with hard resource enforcement, explicit guest compatibility, checkpoint-size budgets and a documented tenant boundary. The present spike is not yet a safe multi-tenant service or a general Node runtime.

**The three things I would do next:**

1. **I:** Repair allocation/stack accounting and install deterministic interruption plus an independent owner watchdog; pass hostile resource tests before expanding integration.
2. **I:** Run ten real agent programs/dependency bundles through Node and Chromium, measuring peak memory, raw/compressed checkpoint bytes, CPU and full fork/resume latency.
3. **I:** Freeze a restricted same-build replay/checkpoint contract, then qualify x86↔ARM and hosted Cloudflare with ordered tools, crash recovery and process/tenant failure tests.
