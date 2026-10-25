# Wasm everywhere: QuickJS, one tool channel, and portable parked computers

Research date: 2026-10-25. Research agent/temp name: `wasm`.

Evidence labels: **M** = measured or directly exercised in this spike; **F** = source/documentation fact; **I** = architectural inference; **E** = engineering estimate. Measurements are local microbenchmarks, not production SLOs. All builds and evidence are in `/tmp/portability-wasm/`; this report is the only repository file written by this research task.

## Verdict

**I — “One programming model, Wasm everywhere + KVM where available” is sound, provided the product separates a portable execution format from an isolation tier.** Keep the current guest-code + trusted-tool-dispatcher API. Add a Wasm backend. Preserve jitk for native binaries, native QuickJS speed, and hardware isolation.

**M — The central portability claim is feasible today:** QuickJS 2026-06-04, parked on an unresolved JavaScript tool promise, was snapshotted in Wasmtime and resumed in **Node/V8, a Chromium browser tab, local workerd, and a local Dynamic Worker**. Two forks received different replies and returned the expected different answers. Closures, a cyclic object, a typed array, and a Map survived. No request was emitted a second time.

**I — Do not promise that a native jitk RAM snapshot can be resumed as Wasm.** Native aarch64 QuickJS and wasm32 QuickJS have different pointers, value layouts, compiled frames, and runtime state. Their shared migration format must use deterministic replay or an explicitly designed language-level checkpoint. Alternatively, execute the same Wasm capsule inside the hardware boundary too; that additional jitk integration is not implemented here.

**M/I — No Asyncify or JSPI is required for the preferred QuickJS checkpoint.** A JavaScript `await` stores its continuation inside QuickJS. Return from `JS_Eval`/`JS_ExecutePendingJob` to the host, drain jobs, and checkpoint only after all Wasm frames have returned. The Wasm operand/control stack is then empty. Arbitrary suspension in the middle of C execution is a different problem.

## 1. What was built and how it was measured

### Source and environment

**M** — `strings arch/jitk/kernel/payload/qjs` identifies **QuickJS version 2026-06-04**. The spike downloads that exact Bellard release, not quickjs-ng. Upstream publishes the source and identifies its supported language level as ES2025. [Bellard release/source](https://bellard.org/quickjs/), [engine documentation](https://bellard.org/quickjs/quickjs.html).

**M** — Measurement host: Apple M4 Pro, arm64, Darwin 25.6.0. Runtime/build versions:

| Item | Version / configuration |
| --- | --- |
| QuickJS | Bellard 2026-06-04 |
| WASI SDK | 34.0, clang 23.1.0-wasi-sdk, wasm32-wasip1 reactor |
| Native comparison | Apple clang 21, `-O2 -fwrapv -funsigned-char` |
| Wasmtime benchmark | Official **50.0.0** macOS arm64 C API; Cranelift speed optimization; `InstancePre`; memory initialization CoW enabled |
| Wasmtime migration/replay | Python package **50.0.1** |
| Wizer experiment only | Installed Wasmtime CLI **49.0.3**, trusted fixed input |
| Node | **24.22.1**, V8 **13.6.233.17-node.58** |
| Browser | T3/Electron 44.4.5 browser tab reporting Chromium **152.0.7977.130** |
| workerd | npm binary **2026-10-25**, local execution; Dynamic Worker loader needs local `--experimental` |
| Binaryen | **133** |

**M** — Linux VM reachability was checked, but no Linux performance numbers are used. All reported performance is on the Mac. Other research work and builds ran concurrently; scheduling contention was substantial. Repeat measurements and use medians, and prefer CPU time for the compute comparison. No x86 machine or phone was tested.

**M** — The reactor embeds `quickjs.c`, `dtoa.c`, `libregexp.c`, `libunicode.c`, and `cutils.c`, plus a small C bridge. It does **not** compile the entire command-line `qjs` shell, `quickjs-libc.c`, filesystem API, or the full existing Sofort bootstrap. It preserves the essential async JS + JSON tool-call mechanism. Exports include `init`, `eval_code`, `pump`, `reply`, memory, and `__stack_pointer`. Its only application I/O import is `sofort.emit(ptr,len)`.

**M** — Build adaptations:

- Use QuickJS's `__EMSCRIPTEN__` branches for switch-based bytecode dispatch, no OS Atomics, and no native C stack check. Also build a native switch-dispatch variant to expose part of this configuration cost.
- Remove the **unused** `#include <setjmp.h>` from the temporary `dtoa.c` copy. WASI SDK 34 otherwise rejects that include without Wasm exception/SJLJ support. No actual setjmp/longjmp implementation was needed.
- Use a 512 KiB C stack, 2 MiB initial linear memory, and 32 MiB maximum linear memory. The actual imported WASI functions are `clock_time_get`, `fd_close`, `fd_seek`, and `fd_write`.
- Call `JS_SetMemoryLimit(16 MiB)`, but **do not treat that as a qualified hard limit**: the selected Wasm allocator branch reports zero usable size. The 32 MiB Wasm memory maximum is the tested outer allocation cap. A production port needs accurate allocator accounting and stack/instruction limits.

**M** — Main benchmark protocol: three process rounds for Node and pooled Wasmtime; two updated rounds plus an initial compatible round for default Wasmtime. Within each round: 120 instance/init samples; seven batches of 1,000 trivial executions and 1,000 tool round trips; seven batches of four CPU workloads. Native uses three rounds of eight CPU workloads. CPU result is checked as `-220441792` on all engines. These are raw runtime calls; no full Executor, policy checks, MCP, network, or durable storage is included.

### Size and startup

All rows below are **M**. KiB means 1,024 bytes.

| Artifact | Raw bytes | Raw KiB | gzip-9 bytes |
| --- | ---: | ---: | ---: |
| WASI QuickJS reactor + spike bridge | 966,584 | 943.9 | 332,133 |
| Same reactor, Binaryen Asyncify + `-O2` | 1,517,095 | 1,481.5 | 497,745 |
| Wizer preinitialized reactor | 1,045,545 | 1,021.0 | 372,412 |
| Wasmtime serialized compiled module | 2,144,024 | 2,093.8 | Not measured |

**M** — Original reactor SHA-256: `d239715db73722fecd733e0fa111626f47eafcb8067cfe189f596c42f0159df5`. This hash identifies the exact build used for the cross-runtime memory snapshot.

| Operation | Wasmtime 50, default allocator | Wasmtime 50, pooling allocator | Node/V8 |
| --- | ---: | ---: | ---: |
| Compile original Wasm, module cache absent | ~427 ms, two updated rounds | ~545 ms, three rounds | ~5.30 ms synchronous module construction, three rounds |
| Deserialize trusted compiled module | ~0.442 ms | ~0.442 ms | No equivalent portable native-code cache tested |
| Instantiate already compiled module + bridge/export setup | ~0.025 ms | ~0.023 ms | ~0.092 ms |
| Initialize fresh QuickJS runtime/context/bootstrap | ~0.13 ms | ~0.159 ms | ~0.207 ms |
| Execute async `return 2` in an already initialized instance | ~0.010 ms | ~0.0105 ms | ~0.0113 ms |
| Complete one guest await/tool import/reply/job-drain round trip | ~0.137 ms | ~0.045 ms | ~0.077 ms |

**M/I — Read the cold figures carefully.** V8 can compile lazily/tier later; its ~5 ms module-construction figure is not time to execute arbitrary QuickJS code. In **11 fresh Node processes**, measured module construction + instantiate + initialize + first `return 2` had a **36.37 ms median**, excluding Node process startup, file reading, and network transfer. Instantiate/init/first-execute alone ranged **13.2–149.9 ms**. Wizer lowered the corresponding total median to **21.47 ms**. This is startup work, not a claim that every cold browser starts in 5 ms.

**F/I — Compile once, reuse many instances.** Wasmtime recommends pooling, CoW memory images, and `InstancePre` to remove import resolution/type checking from instantiation. These are distinct from a pool of **fully initialized QuickJS instances**. [Wasmtime fast instantiation](https://docs.wasmtime.dev/examples-fast-instantiation.html).

**M/I** — Pooling reduced this small module's allocation/setup median only slightly. QuickJS initialization dominates the precompiled fresh-instance path: approximately **0.15–0.18 ms before execution** on Wasmtime, versus roughly **0.30 ms** on Node from the component medians. These sums are indicative, not separately measured end-to-end medians. A pool of initialized single-use instances removes both terms from the request path; the table's warm `return 2` is its raw execution component. Safe host handoff/queue acquisition is additional.

**M** — The default-vs-pool tool-latency difference is dominated by noisy scheduling/batching; allocator choice should not be credited with accelerating an already-running tool call. Per-round pooled tool medians were **38, 150, and 45 µs**, and Node's were **77, 38, and 82 µs**. Do not turn these into a precise throughput advantage over jitk's quiet-host results.

**M** — A separate tiny Wasm export that calls a trivial integer host import and returns cost about **15 ns per pair** in a warmed Node loop. That excludes JSON, QuickJS, scheduling, and the executor. The actual tool round trip above includes guest JSON serialization, a host import, request extraction/JSON parsing in Node, a reply export, reply JS evaluation, QuickJS promise jobs, and result serialization. The C Wasmtime host extracts the ID with a bounded string scan rather than the full production JSON dispatcher. No standalone WASI syscall benchmark was conducted.

### Memory per computer

**M** — Three rounds at 0, 32, and 128 retained instances, with a warmed shared compiled module and a small executed guest. Incremental RSS is measured within each process; Node runs with explicit GC. On macOS it is residency, not a reservation or a guaranteed proportional set-size accounting.

| Runtime | Median incremental resident bytes / small initialized instance | Logical linear memory / instance |
| --- | ---: | ---: |
| Node/V8 | 400,640 (~0.382 MiB) | 2 MiB |
| Wasmtime, default allocator | 332,800 (~0.317 MiB) | 2 MiB |
| Wasmtime, pooling allocator | 355,072 (~0.339 MiB) | 2 MiB |

**M** — The engine's reported live JS memory is about **51–53 KiB** in this minimal harness; native reports about **69–71 KiB**. This is not total runtime memory. Zero/unwritten linear pages need not be resident. RSS samples are not a density guarantee: one Node 128-instance run had an anomalously small RSS delta consistent with residency changes. Runtime baselines after warming were roughly **69–85 MiB** for these Wasmtime processes and **96–99 MiB** for Node, amortized over their instances. Compilation, code, stacks, pool reservations, and arbitrary guest allocations must also be budgeted. Starting one runtime process per computer would lose much of the density benefit.

**I** — Hundreds of small computers in a shared runtime process are plausible; “32 MiB maximum memory” does not mean 32 MiB of immediate physical RAM. Conversely, the small RSS figure does not guarantee that a large workload fits in that amount. Pooling guard/address reservations are virtual memory and are another concern on constrained/mobile hosts.

### Compute versus native QuickJS

**M** — Guest benchmark, evaluated as ordinary JS each time:

```js
let s = 0;
for (let i = 0; i < 1_000_000; i++)
  s = (Math.imul(s, 1664525) + 1013904223) | 0;
// -220441792
```

| Engine | Median CPU ms / workload | Median wall ms under contention | CPU ratio to native |
| --- | ---: | ---: | ---: |
| Native QuickJS, ordinary computed-goto dispatch | 45.30 | 195.28 | 1.00× |
| Native QuickJS, switch-dispatch configuration | 59.40 | 317.94 | 1.31× |
| wasm32 QuickJS in Node/V8 | 63.62 | 303.36 | 1.40× |
| wasm32 QuickJS in Wasmtime, default | 100.51 | 483.33 | 2.22× |
| wasm32 QuickJS in Wasmtime, pooling | 106.01 | 511.90 | 2.34× |

**M/I** — Native CPU time comes from child-process user+system CPU divided by eight iterations, so it includes a small startup/init contribution. Wasmtime measures CPU around the repeated workload; Node uses process CPU around batches. Compiler versions, 32/64-bit JSValue layout, dispatch mode, and runtime code generation differ. This is one integer-heavy interpreter benchmark, not a general Wasm slowdown multiplier. It also illustrates why warmed Wasm QuickJS is not equivalent to executing guest JS directly in V8: V8 compiles the **QuickJS interpreter**, which still interprets the guest.

## 2. Tool channel and selecting this backend in the TS executor

**F — Existing seams inspected:** `arch/jitk/executor/backend.ts` defines `Backend.park()` and `Sandbox.read/send/kill/exited/armDeadline`; `pool.ts` manages single-use parked sandboxes; `executor.ts` implements Cloudflare codemode's `Executor` plus TanStack's driver. Policy, approvals, credentials, deadlines, provenance, and dispatch already live on the trusted host. `select-backend.ts` currently selects `jitk` or explicitly unsafe `local-qjs`; the backend kind union also contains `hyperlight-js`.

**I — Add a `wasm` Backend, preserving the public API.** A production bridge should accept and emit the **same canonical frames** as the existing protocol, rather than give guest JS a host object or function reference:

```text
guest JS tool proxy -> JSON call bytes
  -> sofort.emit(ptr, len)              // bounded, synchronous enqueue only
  -> host dispatcher/policy/tool execution
  -> receive_frame(ptr, len) export     // run or ret frame
  -> QuickJS receive()/promise resolve
  -> pump bounded guest jobs
  -> return to host at a quiescent boundary
```

**I** — The import must copy bytes immediately, validate `ptr <= size` and `len <= size - ptr`, enforce frame/aggregate/in-flight budgets, and run the canonical hostile-frame dispatcher. Reacquire views after `memory.grow`. Do not await or reenter Wasm from inside `emit`: enqueue first, leave Wasm, then dispatch asynchronously. A compromised QuickJS heap can manufacture frames, so guest-side checks are never the authority.

**I** — `WasmSandbox.send(frame)` serializes the trusted frame into a bounded input buffer, calls `receive_frame`, then pumps jobs. `read()` drains a bounded queue of validated emitted frames. `kill()` cancels trusted work and destroys/terminates its runtime owner; `exited` resolves once the instance owner can no longer run. `codemodeCodec` should be set only when the existing fixed binary codec is installed and qualified. Fresh instances must never inherit another user's initialized execution state.

**I** — Selection can be explicit (`JITK_BACKEND=wasm` in the Node adapter, or an application constructor option); capability selection should consider both deployment support **and the required isolation level**. Suggested host adapters:

| Host | Adapter / limits / isolation implications |
| --- | --- |
| Node, Bun, Deno | WebAssembly module + explicit minimal WASI shims; a terminable worker/process owner for hard cancellation. Node has been measured; Bun/Deno remain compatibility work. |
| Browser | The same module in a dedicated Web Worker, message-based trusted tool dispatcher, no filesystem/network imports. Terminating the Worker supplies the hard deadline. Main-thread execution would freeze the UI. |
| Cloudflare Workers | Deploy/import a precompiled Wasm module; instantiate with minimal shims inside a request. Persist parked capsules outside isolate RAM for durable sleep. |
| Dynamic Workers | Load a child with JS bridge and `{ wasm: ... }` module, `globalOutbound: null`, and a narrowly scoped tool RPC binding. Platform CPU/subrequest limits supplement guest limits. |
| Standalone server | Wasmtime with a shared compiled module, bounded stores, fuel/epochs, host dispatcher, and optional outer process/KVM boundary. |

**F/M** — Ordinary Workers support imported/precompiled Wasm and SIMD, have no Worker-thread API, and do not supply a complete portable WASI implementation. Dynamic Workers accept Wasm module objects; the source API also accepts a `WebAssembly.Module`. This was exercised locally by loading the existing snapshot into a Dynamic Worker with outbound access disabled. It is **not** an account-owned Cloudflare production deployment or a Cloudflare edge latency measurement. [Workers Wasm](https://developers.cloudflare.com/workers/runtime-apis/webassembly/), [Dynamic Workers loading](https://developers.cloudflare.com/dynamic-workers/getting-started/), [loader source](https://github.com/cloudflare/workerd/blob/main/src/workerd/api/worker-loader.h).

**F/I** — Hosted budgets are not per-Wasm-instance budgets. Current Workers documentation lists 128 MB memory per isolate. Dynamic Workers support per-invocation `cpuMs` and `subRequests` limits; the published concurrency limit is four distinct in-flight children per Worker request and ten per Durable Object I/O context. Design pooling/sharding around these limits rather than extrapolating Mac instance density directly. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [custom limits](https://developers.cloudflare.com/dynamic-workers/usage/limits/), [Dynamic Workers concurrency](https://developers.cloudflare.com/dynamic-workers/platform/limits/).

**I — Important implementation gap:** the current TS executor is Node-oriented: it imports `node:perf_hooks`, and its backend file imports child-process/filesystem facilities at module scope. Adding one class does not make that source browser/Workers-ready. Split protocol/policy/execution logic from Node launchers, clocks, artifact loading, scheduling, and termination adapters. Replace the bootstrap's `std.out`, `os.read`, `ppoll`-style event loop, and `std.exit` with bridge callbacks and an explicit pump, while preserving codec and protocol behavior.

**I** — There is no need to emulate jitk's 24 Linux syscall slots for this programming model. Port the QuickJS embedding and tool protocol. Running the unmodified native shell would require additional WASI/libc/event-loop work and still would not execute native ELF payloads. The prototype bypasses the shell deliberately; it has not passed the existing executor's hostile-frame, codec, policy, cancellation, and API conformance suites.

**I — Hard cancellation is required.** A synchronous Wasm loop blocks a JS timer on the same thread; `Promise.race` is not preemption. QuickJS interrupt hooks plus accurate allocation accounting provide portable guest budgets. Wasmtime adds fuel/epochs; browsers/Node add a terminable owner; Cloudflare provides runtime CPU enforcement. An epoch trap terminates execution rather than producing a portable checkpoint. Async yielding within Wasmtime retains its runtime-local continuation. [Wasmtime interruption](https://docs.wasmtime.dev/examples-interrupting-wasm.html).

**E — Effort after this spike:** about 3–5 engineer-days for a Node proof backend using the existing protocol; another 10–20 days for resource enforcement, hostile-frame/codec/conformance coverage, and browser/Workers host separation; roughly 10–20 more days for a specified checkpoint format, pending-tool ownership, replay/fork semantics, compatibility tests, and crash testing. These overlap and are estimates for an experienced implementer, not delivery commitments. A hardened Wasm-in-jitk guest is additional work.

## 3. PAUSE / FORK / MOVE

### 3.1 Preferred path: QuickJS heap continuation, empty Wasm stack

**F/I** — Linear memory is a byte array; Wasm locals, operand/control frames, mutable globals, tables, imported resources, and engine state are not all part of that byte array. Copying memory while a normal Wasm import is blocked does not copy its continuation.

**M** — This spike avoids that problem. `tool(...)` creates a QuickJS promise whose resolver is stored **inside QuickJS**. The host import emits the request synchronously and returns. The async guest reaches `await`, QuickJS evaluation and pending jobs return to the host, and no Wasm activation is left. C globals holding the runtime/context pointers, the QuickJS heap, allocator state, and suspended JS values are all in linear memory. The only mutable Wasm global in the original module is the exported C `__stack_pointer`; its table contains static functions and is recreated from the identical module.

**M — Migration workload:**

```js
(async () => {
  let state = { n: 7 }; state.self = state;
  const closure = x => x + state.n;
  const bytes = new Uint8Array([2, 3, 5]);
  const m = new Map([['x', 11]]);
  const x = await tool({ value: state.n });
  return {
    answer: closure(x) + bytes[2] + m.get('x'),
    cycle: state.self === state
  };
})().then(x => __done(JSON.stringify(x)));
```

**M** — Capture after this returns to the Wasmtime host and before supplying reply ID 1. Save 2,097,152 memory bytes, `__stack_pointer = 524288`, the module hash, and the pending request. Instantiate the same module elsewhere, grow memory if needed, restore bytes/global, and call the reply export. Do **not** call QuickJS initialization again after restoration.

| Destination of the Wasmtime-origin snapshot | Reply 19 | Reply 77 | New tool requests on restore |
| --- | --- | --- | ---: |
| Fresh Wasmtime instances | `{answer:42, cycle:true}` | `{answer:100, cycle:true}` | 0 |
| Node/V8 | Same | Same | 0 |
| Chromium 152 browser tab | Same | Same | 0 |
| Local workerd 2026-10-25 | Same | Same | 0 |
| Local Dynamic Worker, outbound disabled | Same | Same | 0 |

**M** — The full memory image gzip-compressed to **99,854 bytes**. The one Python capture copy took 21.1 ms; two Python restore copies took 0.36–0.46 ms and Node restore copies 0.27–0.44 ms. These are single/few-sample copying observations under contention, not a snapshot-latency benchmark; compression, transport, durable persistence, policy handoff, and module cold start are extra.

**I — Conditions for a product promise:** exact module/build and ABI match; no active Wasm frames; no unexported mutable globals; immutable or explicitly serialized tables; no externrefs/Wasm-GC heap objects outside the captured representation; imported capabilities reconstructed from logical IDs; pending jobs/timers and delivery order accounted for; host queues and protocol counters checkpointed consistently. Quiescence must mean job draining and import return have finished, not merely that an outbound frame was observed. A guest that never reaches a boundary can be terminated; arbitrary mid-instruction portable pause is not supplied by this design.

**M/I** — The tests prove cross-runtime transfer on this Mac, including an actual browser tab. They do not prove cross-CPU-ISA execution, arbitrary guest libraries, or the full Sofort bootstrap. **Same wasm32 module** migration across x86/ARM hosts is a strong inference because saved pointers are Wasm offsets and destination code/function tables are rebuilt, but it still needs a cross-architecture qualification matrix.

### 3.2 Asyncify: real stack transformation, tested separately

**F** — Binaryen Asyncify transforms reachable calls so locals/control state can be spilled to linear memory while unwinding, then replayed while rewinding. It handles synchronous C code awaiting an asynchronous host operation, with size/runtime overhead and reentrancy restrictions. JSPI uses VM support instead. [Emscripten Asyncify documentation](https://emscripten.org/docs/porting/asyncify.html).

**M** — Applied Binaryen 133 `--asyncify -O2` with `asyncify-imports@sofort.emit`. Instrumenting this QuickJS module produced:

- **+550,511 bytes / +57.0% raw size**; gzip grows about **49.9%**.
- **2,248 bytes of saved logical stack** for the tested tool-call path, using a reserved ~56 KiB data area.
- A successful clone while the QuickJS C stack was unwound at its tool import. Rewind into another Node instance returned 42.
- A successful **Node Asyncify snapshot -> Wasmtime rewind**, also returning 42 without emitting another tool request.

**M** — In one warmed five-batch Node experiment, transformed `return 2` used about **19.1 µs CPU**, a normal transformed tool round trip **35.0 µs CPU**, and tool + unwind/rewind + reply **38.6 µs CPU**. The latter's wall median was **169 µs**, with batch averages spanning 34–223 µs. Approximately **3.6 µs extra CPU** for unwind/rewind is specific to this 2,248-byte stack path, not a fixed cost for arbitrary programs. Compared with the original Node measurements, transformation adds execution cost even when no suspension happens; those runs were not controlled paired trials.

**I** — Asyncify makes portable C-stack state practical for an exact transformed module. Save the Asyncify data area, memory and relevant globals, the entry export and its original arguments, and pending-import identity; resume using its rewind protocol and stop rewind at the matching import. It is more than “copy memory.” Internal transform state, indirect-call reachability, mutable tables, stack depth, external handles, and module version must be controlled. Unwind/rewind work scales with live frames/values. Avoid it for the default QuickJS promise path; retain it as a compatibility option for synchronous libraries compiled to Wasm.

**M/I** — An instructive build trap: using Binaryen `--all-features` emitted the compact-import proposal and failed validation in this Node/V8 (`unknown import kind 0x7f`). Explicitly enable only the required supported features. The phrase “Wasm everywhere” still needs a declared feature baseline.

### 3.3 JSPI and stack switching, status as of 2026-10-25

**F** — The current WebAssembly proposal catalog lists **JS Promise Integration at phase 5**, and general **Stack Switching at phase 3**. They are distinct proposals. [Current proposal catalog](https://raw.githubusercontent.com/WebAssembly/proposals/main/proposals.json).

**F** — Current browser compatibility data lists JSPI in **Chrome 137**, **Firefox 153**, and **Safari 27**, including their corresponding mobile entries. Safari's September 2026 release follows its earlier JSPI beta implementation. Older articles contain obsolete Firefox/version-stage claims; use current data plus feature detection. [MDN compatibility source](https://raw.githubusercontent.com/mdn/browser-compat-data/main/webassembly/api/Suspending.json), [WebKit Safari 27](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/).

**M** — `WebAssembly.Suspending` and `WebAssembly.promising` both exist in the installed Node 24.22.1. A real asynchronous host-import/export test returns **42** in Node, Chromium 152, local workerd, and a local Dynamic Worker. Node's tiny resolved-promise JSPI pair measured a **3.67 µs wall median**, with very noisy batch averages of 1.34–24.1 µs. This is an immediate host promise, not an actual network/tool request. Browser/workerd tests are functionality only.

**F/I** — JSPI wraps async JS imports and Wasm exports; its suspended execution belongs to the current runtime and host promise machinery. It exposes **no standardized serialization API** for the saved native/engine continuation. It helps use async APIs, but does not enable pause-in-Wasmtime/resume-in-browser by copying memory. [JSPI API](https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Suspending).

**F/I** — General stack switching adds typed continuations and instructions for resume/suspend; it is not universally implemented and does not define a portable byte encoding of those continuations. Do not base a 2026 universal capsule on it. [Stack-switching explainer](https://github.com/WebAssembly/stack-switching/blob/main/proposals/stack-switching/Explainer.md).

### 3.4 Wasmtime snapshots, Wizer, and Golem

**F/I — Wasmtime compiled caches are not running-computer snapshots.** `Module::serialize` saves compiled code, not a Store, heap plus active stack, or pending host futures. Deserialization accepts trusted native artifacts and is unsafe for attacker-provided blobs. Such caches are engine/config/target specific and should stay outside the portable capsule. Core dumps are for post-mortem analysis, not a standard resumable machine image. [Module serialization API](https://docs.wasmtime.dev/api/wasmtime/struct.Module.html), [core dumps](https://docs.wasmtime.dev/examples-core-dumps.html).

**F/I — Wizer is useful preinitialization, not arbitrary stack capture.** It executes initialization, captures module state, and emits a new Wasm module. It has moved into Wasmtime. The current library also has instrument/snapshot APIs for initialized module/component state; these do not turn an active native stack or external host resources into portable bytes. [Wizer project](https://github.com/bytecodealliance/wizer), [current Wizer API](https://docs.wasmtime.dev/api/wasmtime_wizer/struct.Wizer.html).

**M** — The installed integrated CLI successfully preinitialized this reactor with:

```sh
wasmtime wizer -S cli=y \
  --preload sofort=/tmp/portability-wasm/emitstub.wasm \
  -f init --keep-init-func \
  -o /tmp/portability-wasm/qjs-wizer.wasm \
  /tmp/portability-wasm/qjs.wasm
```

The preload supplies the unused tool-import signature; initialization never calls it. The CLI explicitly enables WASI to satisfy the clock import. Its output runs in Node without calling QuickJS init again. Size rises about **8.2% raw / 12.1% gzip** and the measured fresh-Node cold median improves from **36.37 to 21.47 ms**. This uses trusted fixed input, not arbitrary customer Wasm. A production initializer should use deterministic clock/seed shims, exclude credentials, and explicitly decide whether clones share or reseed their PRNG stream. A preinitialized cold pool and post-tool execution checkpoints are separate artifacts.

**F — Golem's ordinary durability model is oplog replay.** It records external interaction results and ordering, creates a fresh instance after loss, and re-executes computation against that log. Its optional user-defined snapshots accelerate recovery using application-serializable state; an oplog remains authoritative. This is not evidence of universally serialized Wasm native stacks. [Golem durability](https://learn.golem.cloud/v1.6/concepts/durable-execution), [snapshot model](https://learn.golem.cloud/v1.6/develop/snapshotting).

**I** — Golem is a good architectural precedent for making the single host boundary durable. Completed calls can be replayed without repeating their effects, but an external request interrupted after effect/before recording still requires remote idempotency keys or a transactional protocol. Replay alone cannot grant exactly-once external side effects. Forking requires a new branch identity and a defined policy for any already in-flight effect.

## 4. Determinism and replay

**M** — The migration/replay harness supplies a deterministic `clock_time_get`. Inspecting this QuickJS release shows that `Math.random` initializes an internal xorshift64* state using `gettimeofday`; no `random_get` import is present in this build. Thus controlling **only WASI random_get would miss the actual source**. Time controls the initial seed; the evolving PRNG state is in the QuickJS heap. `Date.now()` also reaches the controlled clock. Production should patch seed initialization to a dedicated explicit seed rather than coupling it to wall time.

**M** — A separate two-tool replay test used `Date.now()` and `Math.random()` in each request and in the result. A fresh instance with the same clock/initial seed matched both recorded requests and reproduced `{sum:300, time:1700000000000, random:0.7318575301997312}`. The live run invoked external-tool stubs twice; replay invoked them **zero** times. This proves the small controlled example, not all JS/library determinism.

**I** — The portable deterministic profile should specify:

1. One-threaded event/job semantics, a versioned QuickJS/build/bootstrap/codec, and a fixed module feature set.
2. Virtual wall/monotonic clock values, PRNG algorithm/seed/state, timezone/environment, timers, and exact recorded reply/settlement ordering. Multiple pending calls and `Promise.race` make ordering observable.
3. Every externally visible input through the host boundary; no inherited files, sockets, environment, or credentials. If files are added, content-addressed file images and descriptor offsets become capsule state.
4. Bounded deterministic allocation behavior or recorded failure outcomes, and a defined instruction budget. Memory/table growth below a maximum can still fail because of host pressure.
5. Defined floating-point/NaN behavior. Strict Wasm arithmetic is mostly deterministic, but NaN payloads and relaxed SIMD can vary. Disable relaxed SIMD and qualify/canonicalize NaNs where observable. Browser embedders cannot simply apply Wasmtime's compiler settings, so a universal profile may need module/engine-level normalization.

**F** — Wasmtime's determinism guide explicitly calls out imports, NaN canonicalization, relaxed SIMD, allocation/growth, and deterministic interruption. Clock/random shims alone are insufficient. [Wasmtime determinism](https://docs.wasmtime.dev/examples-deterministic-wasm-execution.html).

**I** — A native QuickJS fast path also needs qualification against this semantic profile: libc math, pointer-size-dependent behavior in embedders, resource failures, and native stack limits can diverge from the Wasm path. Replay should verify each requested call's canonical digest and fail closed on divergence. Do not silently re-execute earlier effects when a replay mismatch occurs.

## 5. Isolation and TCB versus jitk/KVM

**I — Wasm is a meaningful isolation boundary, but it is a different one.** With the fixed QuickJS interpreter module, a guest JS memory-corruption bug normally corrupts Wasm memory and can bypass guest policy; Wasm bounds/table checks should still protect the host. The host TCB includes the validator/compiler/runtime, native trampolines and signal handling, import wrappers, allocator/resource accounting, and trusted dispatcher. The host can always inspect the guest; this is not confidentiality from the host.

| Backend deployment | Host-isolation boundary and principal TCB | Shared failure domain |
| --- | --- | --- |
| QuickJS/Wasm in Wasmtime | Software bounds/type isolation + Wasmtime/Cranelift + minimal imports + dispatcher + host OS | Runtime escape can compromise all stores in the process |
| QuickJS/Wasm in Node/Bun/Deno | Engine Wasm sandbox + host adapter; runtime-specific worker/process controls | A worker thread is not a separate OS security boundary; engine escape can reach process privileges |
| Browser Wasm Worker | Engine Wasm boundary, browser renderer/process/origin sandbox, host tool broker | A guest does not get origin capabilities unless imported; engine compromise remains relevant |
| Cloudflare hosted Workers | workerd/V8 plus Cloudflare's production containment and capability configuration | Tenant/isolate/platform limits apply; local workerd alone is not the production security boundary |
| jitk/HVF or KVM | EL0->jitk syscall boundary, stage-2/hardware virtualization, hypervisor/host kernel, confined VMM, dispatcher | Guest QuickJS/kernel compromise is still behind the VM boundary; VMM/hypervisor bugs remain relevant |

**F — Escape history is real, including current 2026 issues:**

- Wasmtime **CVE-2023-26489**: x86_64 address-calculation error allowed guest-controlled accesses beyond the intended linear-memory region, including potentially other pooled instances. [Maintainer advisory](https://github.com/bytecodealliance/wasmtime/security/advisories/GHSA-ff4p-7xrq-q5r8).
- In April 2026, maintainers patched a batch including Cranelift/aarch64 and Winch sandbox escapes and pooling data leakage. [Maintainer security report](https://bytecodealliance.org/articles/wasmtime-security-advisories).
- On October 19, 2026, maintainers disclosed an aarch64 `br_table` code-generation escape, patched in **49.0.4 / 48.0.7 / 36.0.19**, and a separate SSA-index miscompilation escape affecting older versions. [aarch64 advisory](https://github.com/bytecodealliance/wasmtime/security/advisories/GHSA-mghf-wjfp-p5xm), [SSA advisory](https://github.com/bytecodealliance/wasmtime/security/advisories/GHSA-897f-g5gm-fmxm).
- Chromium **CVE-2024-2887** was a WebAssembly type-confusion vulnerability. [Chrome release advisory](https://chromereleases.googleblog.com/2024/03/stable-channel-update-for-desktop_26.html).

**M/I** — The installed Wasmtime 49.0.3 is below that recent aarch64 fix. For this reason the substantive C benchmarks use a downloaded official 50.0.0 C API and migration uses Python 50.0.1. The old CLI was used only for Wizer with the fixed trusted QuickJS module. Version patching and artifact provenance must be part of the product, not “Wasm is safe” assumptions. These advisories do not constitute a controlled security ranking or a claim that every issue is reachable through this fixed interpreter module.

**F** — workerd itself explicitly says it is **not a hardened sandbox** on its own and recommends an appropriate secure outer sandbox for malicious code; Cloudflare's service adds other defenses. [workerd security warning](https://github.com/cloudflare/workerd).

**I** — Prefer a small import allowlist and a fixed trusted interpreter module for JS guests. Supporting arbitrary customer Wasm adds validator/compiler feature exposure. Do not give the module filesystem/network WASI merely for convenience. A Wasm import that calls a trusted tool has the same need for host authorization and data provenance as the current VM protocol. Hardware jitk remains the stronger independent boundary against interpreter/runtime compromise; use process confinement and KVM around Wasm where the threat model warrants it.

## 6. Reach and limitations

**F/I — Broad reach is credible, “any OS” is conditional.** Core Wasm plus a few host imports runs in mainstream browsers, Windows/macOS/Linux JS runtimes, and native Wasm engines. It avoids `/dev/kvm`, HVF entitlement, aarch64-only guest code, and native ELF dependencies. Phones can use their browser/WebView or an embedded interpreter/AOT runtime. OS execution/JIT policy, browser availability, address-space/memory budgets, and engine feature support still matter. No claim of tested mobile support is made here.

**I — Native binaries:** Wasm cannot directly execute the current aarch64 `qjs`/Lua ELF binaries or arbitrary static Linux executables. Recompile each program, embed an interpreter, or route native execution to jitk. A static binary is not automatically portable to WASI: syscalls, assembly, signals, mmap expectations, dynamic linking, and process APIs can block a port. jitk itself implements only its declared syscall subset, so it also is not a full Linux compatibility promise.

**F/I — Threads:** Wasm shared-memory/atomics support exists in several engines, but browsers require the appropriate shared-memory security setup and Workers has no threading/Web Worker API. This QuickJS build disables Atomics. The current jitk slot list also has no clone/futex support, so full pthreads are not an existing jitk feature to claim as lost. Keep the portable computer single-threaded and use independent computers for parallelism. Threaded capsules would need all-thread quiescence and a memory-order/scheduler replay model. [Workers threading restrictions](https://developers.cloudflare.com/workers/runtime-apis/webassembly/).

**F/I — SIMD:** Wasm supports portable SIMD and Workers supports it. This is not a blanket “Wasm has no SIMD” limitation. Native ISA-specific AVX/NEON code still needs recompilation or a Wasm SIMD implementation; relaxed SIMD weakens deterministic portability. QuickJS's scalar interpreter does not automatically become vectorized guest JavaScript.

**M/I — Performance:** QuickJS is interpreted in both the native and Wasm paths. This spike's Wasm CPU cost is 1.4–2.3× native on one workload, with cold compilation and initialization separately visible. Native system libraries and direct host-V8 execution can be much faster for particular workloads. Fuel, Asyncify, serialization, policy validation, large tool payload copies, and deployment-specific compilation add cost not established by the raw tool microbenchmark.

**I — Durability and trust on phones/browser tabs:** a browser can serialize the capsule to local storage or send it to a server, but suspension/eviction does not automatically save it. Keep a durable checkpoint/oplog before discarding the owner. A user-controlled browser cannot be trusted to attest that computation or replay happened faithfully; revalidate server-side tool policy, pending IDs, branch ownership, and effect authorization. Never embed server credentials into portable guest memory.

## 7. Shared capsule format and migration across backends

**I — Use one versioned envelope with distinct state representations.** A common source/tool protocol does not imply a common RAM layout. Suggested envelope contents:

| Field group | Required contents |
| --- | --- |
| Identity | Format version, computer ID, fork/branch ID, parent checkpoint, content hashes, integrity/authentication, monotonic checkpoint/oplog position |
| Program | Source or immutable modules; exact interpreter/Wasm image, bootstrap and codec hashes; ABI version; capability requirements; declared Wasm feature profile |
| Portable environment | Virtual clocks, PRNG state/profile, timezone/env, timer queue, deterministic resource/budget semantics, immutable files if supported |
| Tool boundary | Next request ID, pending request digests and logical effect IDs, completed replies, settlement order, host queue cursors, delivery/commit acknowledgements |
| Policy linkage | Logical grants and trusted-host ledger references; required isolation tier; renewed/revalidated capabilities at destination; no bearer secrets in guest RAM |
| `wasm-quiescent-v1` state | Memory sizes/page payloads, all mutable globals, static table/module identity or serializable table entries, no active Wasm frames, bridge lifecycle state |
| `wasm-asyncify-v1` state | Above plus transform/build identity, Asyncify save area/state, entry export/arguments and pending import rewind identity |
| `jitk-native-v1` state | Guest ISA/image hash, RAM pages, CPU/system registers, virtual device/IRQ/channel state and host effect metadata; restricted compatibility scope |
| `replay-v1` state | Initial program/environment, authoritative host-boundary oplog, source/checkpoint baseline, divergence hashes, replay cursor and side-effect deduplication identity |

**I — Portability matrix:**

| Move | Supported mechanism / caveat |
| --- | --- |
| Wasmtime -> browser/Node/workerd, same Wasm module, quiescent | **Measured here** using memory/global restoration; host metadata also needed in product |
| Same module, different physical CPU ISA | Recompile Wasm at destination; logical memory/global checkpoint should transfer; **not cross-ISA measured here** |
| Asyncify module across engines | **Measured Node -> Wasmtime** for one suspended QuickJS C stack; exact transformation/entry/rewind contract required |
| Live JSPI or runtime-native continuation across engines | No standardized serialization; return to a portable boundary, transform, or replay |
| Native aarch64 jitk QuickJS RAM -> wasm32 QuickJS | No direct restore; use qualified semantic replay or a new portable language-level serializer |
| Native aarch64 VM -> native x86 VM | No direct restore of RAM+registers as executable state; requires emulation/translation or replay/application checkpoint |
| Wasm inside a hardware VM -> browser | Capture the **inner Wasm capsule** at quiescence; discard/rebuild the outer VM. Requires a guest embedding not built in this spike |

**F/I** — QuickJS's source itself selects different JSValue representations for 32-bit and 64-bit pointers (`JS_NAN_BOXING` versus the native pointer-width path). Even the heap bytes differ before considering the native code stack. Its bytecode/object serialization is not a general live-heap serializer for promises, closures, C opaque state, and arbitrary resources. A future serializer could bridge language runtimes, but it is substantial engine work, not a memory-copy feature.

**I — Forks and in-flight tools are the hard product semantics.** Snapshot the guest and trusted pending-call ledger at an agreed handoff point. Give each fork a separate branch identity. A completed result may be shared as history; an uncommitted external effect must have a single owner or deliberate branch-specific invocation. Moving must revoke/lease the old owner's ability to dispatch effects. Otherwise two correct memory restores can charge the same card or send the same message twice. Replay and pending-call snapshots both require this host-side protocol.

**I — Hardware plus portable Wasm:** strongest long-term form is the same Wasm-format computer everywhere, optionally enclosed by KVM/HVF. The current jitk runs native static EL0 binaries; adding Wasmtime unchanged is not a demonstrated fit for its 24 syscalls. A small interpreter, a purpose-built AOT embedding, or a `wasm2c`-style generated guest could supply the same linear-memory ABI, but must be engineered and measured. Until then, treat native jitk as a separate fast/strong backend with replay-based cross-family migration.

## 8. Reproduction and evidence

**M** — Temporary evidence is intentionally outside the repository. Paths are ephemeral; retain/archive this directory if raw measurements must survive temp cleanup.

| Path under `/tmp/portability-wasm/` | Contents |
| --- | --- |
| `bridge.c`, `build.py`, `build.log` | Embedding, complete compiler arguments, build adaptations; native and Wasm binaries |
| `nodebench.mjs`, `wtbench.c`, `measure.py` | Warm/cold components, host-import tool round trips, native comparison |
| `measurement.log`, `summary.json` | Three-round raw process outputs and summarized results |
| `memory.py`, `memory-results.json`, `memory-summary.json` | Three-round retained-instance RSS observations |
| `cold-size-results.json` | All 11 raw/preinit Node cold observations and exact size/gzip numbers |
| `snapshot.py`, `snapshot.bin`, `snapshot.json`, `snapshot-results.json` | Wasmtime capture, rich async continuation and same-runtime forks |
| `restore.mjs`, `restore-results.json` | Wasmtime -> Node forks |
| `browser-test.html`, `browser-results.json` | Actual Chromium tab test, user agent, JSPI and restored results |
| `workerd-test.js`, `workerd-test.capnp`, `workerd-results.json` | Local static Worker restoration and JSPI |
| `dynamic-test.js`, `dynamic-test.capnp`, `dynamic-results.json` | Local Dynamic Worker loading, outbound disabled, restored results |
| `asyncbench.mjs`, `async-results-warm.json`, `async-snapshot.*`, `async-restore.py`, `async-restore-results.json` | Real Asyncify unwind, fork, cross-engine rewind, timings |
| `replay.py`, `replay-results.json` | Two-call clock/random deterministic replay, zero duplicate external invocations |
| `jspi-bench.mjs`, `jspi-bench-results.json`, `wizer.log` | JSPI microbench and integrated Wizer invocation |
| `SHA256SUMS.json` | Selected source, artifact, and evidence hashes |

A few rerun entry points:

```sh
python3 /tmp/portability-wasm/build.py
node /tmp/portability-wasm/nodebench.mjs
/tmp/portability-wasm/wtbench50 0
/tmp/portability-wasm/wtbench50 1
/tmp/portability-wasm/venv/bin/python /tmp/portability-wasm/snapshot.py
node /tmp/portability-wasm/restore.mjs
node /tmp/portability-wasm/asyncbench.mjs
/tmp/portability-wasm/venv/bin/python /tmp/portability-wasm/async-restore.py
/tmp/portability-wasm/venv/bin/python /tmp/portability-wasm/replay.py
```

**M** — This is a research spike with fixed workload assertions, not production backend code. Not tested: full Executor conformance, adversarial guest resource exhaustion, arbitrary Wasm modules, long-running state, large payloads, multi-pending-call snapshots, mobile devices, Bun/Deno, Cloudflare production, x86 destination, or Wasm inside jitk. No existing repository implementation was changed.

## 9. Ranked recommendation

1. **Ship a portable QuickJS/Wasm backend with cooperative tool-call checkpoints.** Keep the existing source + one tool-channel programming model and host policy. Use a fixed, minimal-import, single-thread module and return to the host before checkpointing. This is the smallest path with demonstrated cross-runtime PAUSE/FORK/MOVE.
2. **Keep jitk as the native/hardware isolation tier.** Allow explicit isolation requirements to control selection. Promise common source/tool semantics; use replay to move between native jitk and Wasm. If byte-exact portable pause is central, invest in running the same inner Wasm computer inside the VM too.
3. **Make a host-boundary oplog part of the shared capsule from the start.** It supplies durability, pending-effect ownership, migration fallback, version checks and replay-based cross-family portability. A RAM image alone is not a durable tool-execution transaction.
4. **Use compile caches, initialized single-use pools, and measured Wizer preinit for startup.** They solve different portions of startup. Keep native compiled caches trusted and target-local; distribute original Wasm and portable memory state.
5. **Keep Asyncify as an opt-in compatibility mechanism; use JSPI for local async integration when useful.** Asyncify can move a transformed C stack, as demonstrated, but adds size and runtime cost. JSPI and future stack switching should not be sold as universal serialized continuations.
6. **Do not promise arbitrary static binaries, arbitrary active stacks, identical performance, or automatic native/Wasm snapshot conversion.** Expose these backend capability limits explicitly. The portable product contract can be strong without making those claims.
