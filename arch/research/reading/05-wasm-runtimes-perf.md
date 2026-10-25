# Wasm, language runtimes, and performance measurement

Curated for Sofort / Capsule on 2026-10-25, after reading `demo.md` §0–1 (including the newer measurement updates) and `arch/research/cloudflare-goose/SYNTHESIS.md`. **26 items; eight P1s.** P1 = must, P2 = should, P3 = deeper or optional. Read the snapshot material with the distinction between pre-initialized startup state and a suspended, movable computation in mind.

All destination URLs below were fetched successfully and their contents/titles checked on 2026-10-25. YouTube titles and channels were additionally confirmed through YouTube's oEmbed endpoint; durations come from the video pages' duration metadata. Article reading times marked **est.** are my estimates, not publisher metadata. “Blog” includes substantive technical articles on their authors' sites; the Goose entry is the project's own design overview. Historical performance numbers and feature descriptions are evidence about their stated versions, not current cross-engine guarantees.

## Understand the Wasm isolation boundary

- [P1] **Memory in WebAssembly (and why it’s safer than you think)** — Lin Clark (Mozilla), Blog, 2017, ≈8 min read (est.) — <https://hacks.mozilla.org/2017/07/memory-in-webassembly-and-why-its-safer-than-you-think/>
  Why for Sofort: Build the linear-memory model needed to distinguish corruption inside a guest from an escape across the Wasm sandbox boundary. Concepts: linear-memory, pointers-as-offsets, host-imports, isolation, guest-memory-corruption.

- [P2] **What makes WebAssembly fast?** — Lin Clark (Mozilla), Blog, 2017, ≈12 min read (est.) — <https://hacks.mozilla.org/2017/02/what-makes-webassembly-fast/>
  Why for Sofort: Separate decoding, compilation, execution, optimization, and GC costs before interpreting a tiny-runtime startup win as an execution-speed win. Concepts: compilation-pipeline, JIT, startup-versus-throughput, Wasm-internals; historical explanation.

- [P1] **Security and Correctness in Wasmtime** — Nick Fitzgerald (Bytecode Alliance / Wasmtime), Blog, 2022, ≈17 min read (est.) — <https://bytecodealliance.org/articles/security-and-correctness-in-wasmtime>
  Why for Sofort: Learn what makes software isolation credible—compiler correctness, fuzzing, guard-page bounds enforcement, and Spectre mitigations—and what remains in the trusted runtime. Concepts: Wasmtime, Cranelift, guard-pages, bounds-checks, software-isolation, compiler-TCB, defense-in-depth.

- [P2] **Wasmtime’s April 9, 2026 Security Advisories** — The Wasmtime Project Maintainers (Bytecode Alliance), Blog, 2026, ≈10 min read (est.) — <https://bytecodealliance.org/articles/wasmtime-security-advisories>
  Why for Sofort: Pair the security design with a candid account of real runtime/compiler vulnerabilities; sandbox guarantees depend on implementation, backend, configuration, and patching. Concepts: sandbox-escapes, security-advisories, Cranelift, Winch, verification-limits, vulnerability-response.

- [P3] **A New Backend for Cranelift, Part 1: Instruction Selection** — Chris Fallin (Mozilla), Blog, 2020, ≈30 min read (est.) — <https://hacks.mozilla.org/2020/10/a-new-backend-for-cranelift-part-1-instruction-selection/>
  Why for Sofort: Understand how Wasm becomes native instructions and why compilation latency, code quality, and code-generator correctness are separate engineering concerns. Concepts: Cranelift, SSA, instruction-selection, lowering, AArch64, compilation-cost.

- [P2] **USENIX ATC ’19 — Not So Fast: Analyzing the Performance of WebAssembly vs. Native Code** — Abhinav Jangda (UMass Amherst; work with Bobby Powers, Emery Berger, and Arjun Guha), YouTube, 2019, 19:41 — <https://www.youtube.com/watch?v=dK-8O-ajQQQ>
  Why for Sofort: An essential counterweight to “near native”: examine substantial workloads and generated-code costs, while keeping the 2019 browser measurements separate from today's Wasmtime/workerd results. Concepts: Wasm-versus-native, SPEC, benchmark-selection, code-generation, historical-results.

## Suspend, pre-initialize, and restore: different operations

- [P1] **Pause and Resume WebAssembly with Binaryen’s Asyncify** — Alon Zakai (Emscripten / Binaryen), Blog, 2019, ≈20 min read (est.) — <https://kripken.github.io/blog/wasm/2019/07/16/asyncify.html>
  Why for Sofort: This is the mechanism behind making hidden call frames and locals recoverable in stock Wasm engines; study unwinding, rewinding, and instrumentation overhead before defending Capsule's mid-function resume. Concepts: Asyncify, continuations, call-stack, locals, control-flow, code-size, suspension-overhead.

- [P2] **Introducing the WebAssembly JavaScript Promise Integration API** — Francis McCabe, Thibaud Michaud, Ilya Rezvov, and Brendan Dahl (V8 / JSPI contributors), Blog, 2024, ≈12 min read (est.) — <https://v8.dev/blog/jspi>
  Why for Sofort: Compare engine-managed Promise suspension with Asyncify, and recognize that the suspension API described here supplies no durable continuation export or cross-engine migration format. Concepts: JSPI, promises, synchronous-to-async, stack-switching, in-process-suspension, portability-limits.

- [P1] **Hit the Ground Running: Wasm Snapshots for Fast Startup** — Nick Fitzgerald (Bytecode Alliance / Wizer), YouTube, 2021, 24:45 — <https://www.youtube.com/watch?v=C6pcWRpHWG0>
  Why for Sofort: Wizer's creator explains pre-initialization and its limits: saving initialized memories/globals into a module is a different capability from parking and exporting a live call stack. Concepts: Wizer, pre-initialization, snapshots, data-segments, globals, initialization-cost, snapshot-size.

- [P2] **Making JavaScript run fast on WebAssembly** — Lin Clark (Bytecode Alliance), Blog, 2021, ≈15 min read (est.) — <https://bytecodealliance.org/articles/making-javascript-run-fast-on-webassembly>
  Why for Sofort: The closest conceptual explanation of packaging a JS engine and initialized application into Wasm; separate the demonstrated startup technique from proposed interpreter optimizations. Concepts: interpreter-in-Wasm, SpiderMonkey, Wizer, pre-initialization, startup-versus-throughput, AOT-optimization.

- [P2] **Custom startup snapshots** — Yang Guo (V8 / Google), Blog, 2015, ≈5 min read (est.) — <https://v8.dev/blog/custom-startup-snapshots>
  Why for Sofort: Understand V8's heap-startup precedent and why captured time/random-derived values and external resources need explicit restore policies; the APIs and limitations shown are historical. Concepts: V8, heap-serialization, startup-snapshots, external-state, clock, randomness, restore-hooks.

- [P2] **Bringing Python to Workers using Pyodide and WebAssembly** — Hood Chatham, Garrett Gu, and Dominik Picheta (Cloudflare), Blog, 2024, 20 min read (publisher) — <https://blog.cloudflare.com/python-workers/>
  Why for Sofort: See a production Wasm interpreter embedded in the Workers/workerd architecture, including Python↔JS bridging and the original deployment-time snapshot design. Concepts: workerd, V8-isolates, Pyodide, interpreter-in-Wasm, FFI, initialization-snapshots.

- [P1] **Python Workers redux: fast cold starts, packages, and a uv-first workflow** — Dominik Picheta, Hood Chatham, and Mike Nomitch (Cloudflare), Blog, 2025, 12 min read (publisher) — <https://blog.cloudflare.com/python-workers-advancements/>
  Why for Sofort: Read the concrete restore hazards—PRNG reseeding, function tables, dynamic libraries, and JS references—and inspect the cold-start comparison's package choices and exclusion of Lambda SnapStart. Concepts: workerd, linear-memory-is-incomplete, tables, host-references, entropy, snapshot-restore, fair-baselines.

- [P2] **The Road to Component Model 1.0** — Eric Gregory (Bytecode Alliance), Blog, 2026, ≈10 min read (est.; skim the refresher first) — <https://bytecodealliance.org/articles/the-road-to-component-model-1-0>
  Why for Sofort: Establish the vocabulary for typed component boundaries and capability-oriented WASI APIs without treating them as a standard for serializing running continuations. Concepts: component-model, WIT, canonical-ABI, WASI, capabilities, async; roadmap dated June 2026.

## QuickJS: engine internals and the embedder's responsibilities

- [P1] **QuickJS: An Overview and Guide to Adding a New Feature** — Asumu Takikawa (Igalia), Blog, 2023, ≈20 min read (est.) — <https://blogs.igalia.com/compilers/2023/06/12/quickjs-an-overview-and-guide-to-adding-a-new-feature/>
  Why for Sofort: Follow an actual engine modification to understand Fabrice Bellard's bytecode interpreter and why `qjsc` embedding bytecode in C does not turn JS into native machine code. Concepts: QuickJS, Fabrice-Bellard, parser, stack-bytecode, interpreter-loop, qjsc, embedding.

- [P2] **Building a Runtime with QuickJS** — Andrew Healey (healeycodes), Blog, 2026, ≈25 min read (est.) — <https://healeycodes.com/building-a-runtime-with-quickjs>
  Why for Sofort: A working embedder shows where the host adds APIs, ownership handling, Promise jobs, and an event loop—the state Sofort must deliberately constrain at its single tool boundary. Concepts: JSRuntime, JSContext, JSValue-ownership, C-API, Promise-jobs, event-loop, host-I/O.

- [P2] **QuickJS-NG 0.9.0 released!** — Saúl Ibarra Corretgé (QuickJS-NG), Blog, 2025, ≈3 min read (est.) — <https://code.saghul.net/2025/03/quickjs-ng-0-9-0-released/>
  Why for Sofort: A maintainer's concise example of fork-specific API, rejection-handling, and optimization changes; record Bellard QuickJS versus quickjs-ng and exact revisions in comparisons. Concepts: quickjs-ng, engine-lineage, embedding-API, inline-caches, unhandled-rejections, version-pinning; historical release.

## Goose and the flat-data lineage

- [P2] **The Goose Programming Language** — Wouter van Oortmerssen (Goose / VoxRay Games; project design overview), Blog, 2026, ≈15 min read (est.) — <https://aardappel.github.io/goose/>
  Why for Sofort: Read the designer's explanation of data stacks, flat values, relative references, and C output; relocatable data helps capsules, but does not by itself serialize call frames or grant an upstream Wasm target. Concepts: Goose, flat-data, data-stacks, relative-references, compile-to-C, TinyCC, lifetime-analysis, layout-versus-continuation.

- [P3] **Lobster, Programming Languages, and Game Engines with Wouter van Oortmerssen — Conversation #5** — Wouter van Oortmerssen with Mike Shah (VoxRay Games / Mike Shah), YouTube, 2024, 2:03:31; useful segment 1:05:40–1:29:14 — <https://www.youtube.com/watch?v=hDT79xdqf3k>
  Why for Sofort: Hear the language designer explain Lobster's design choices and development background; use that lineage to evaluate Goose's runtime and memory-model choices rather than relying on launch benchmarks. Concepts: Lobster, language-design, compile-time-memory-management, systems-minimalism, game-runtime; predates Goose's launch.

- [P2] **FlatBuffers: a memory efficient serialization library** — Wouter van Oortmerssen (Google, Fun Propulsion Labs), Blog, 2014, ≈3 min read (est.) — <https://opensource.googleblog.com/2014/06/flatbuffers-memory-efficient.html>
  Why for Sofort: The original release article explains Wouter's flat-data lineage: access serialized bytes in place, while keeping data-format portability distinct from whole-runtime checkpoint portability. Concepts: FlatBuffers, in-place-access, serialization, schema-evolution, flat-data, cross-platform-format.

## Measure something you can defend

- [P1] **How NOT to Measure Latency** — Gil Tene (Azul Systems), YouTube, 2015, 42:59 — <https://www.youtube.com/watch?v=lJ8ydIuPFeU>
  Why for Sofort: Ensure a stalled executor creates visible latency for arrivals during the stall instead of making the load generator stop issuing work and hide the tail. Concepts: coordinated-omission, response-time, open-versus-closed-loop, tail-latency, percentiles, HdrHistogram, overload.

- [P2] **Performance Matters** — Emery Berger (UMass Amherst), YouTube, 2019, 42:15 — <https://www.youtube.com/watch?v=r-TLSBdHe1A>
  Why for Sofort: A first-hand Stabilizer/Coz talk makes the “producing wrong data without doing anything obviously wrong” measurement-bias lesson concrete, including layout effects and causal explanations of speedups. Concepts: measurement-bias, layout-randomization, Stabilizer, statistical-significance, causal-profiling, Coz, misleading-speedups.

- [P1] **Evaluating the Evaluation: A Benchmarking Checklist** — Brendan Gregg (Netflix), Blog, 2018, ≈8 min read (est.) — <https://www.brendangregg.com/blog/2018-06-30/benchmarking-checklist.html>
  Why for Sofort: Apply an adversarial review to every launch number: identify the limiter, verify successful useful work, reproduce results, and explain why the workload represents agent tool programs. Concepts: active-benchmarking, bottlenecks, errors, reproducibility, workload-relevance, sanity-checks.

- [P2] **The USE Method** — Brendan Gregg (systems performance engineer), Blog, 2017 (page's last update), ≈15 min read (est.) — <https://www.brendangregg.com/usemethod.html>
  Why for Sofort: Diagnose utilization, saturation, and errors in host CPU, memory, and I/O before attributing noisy or nested-virtualization timings to the runtime itself. Concepts: utilization, saturation, errors, resource-bottlenecks, queues, host-contention, system-methodology.

- [P2] **Differential Flame Graphs** — Brendan Gregg (Netflix), Blog, 2014, ≈12 min read (est.) — <https://www.brendangregg.com/blog/2014-11-09/differential-flame-graphs.html>
  Why for Sofort: Explain where CPU moved after a snapshot/ABI change, including profile normalization and vanished paths; flame-graph width represents samples, so add separate measurements for waiting and end-to-end latency. Concepts: flame-graphs, perf, sampling, symbolization, before-after-profiles, normalization, CPU-versus-wall-time.

- [P2] **More Evidence for Problems in VM Warmup** — Laurence Tratt (language VM researcher), Blog, 2022, ≈12 min read (est.) — <https://tratt.net/laurie/blog/2022/more_evidence_for_problems_in_vm_warmup.html>
  Why for Sofort: Avoid choosing an arbitrary warmup count that favors V8 or an interpreter; preserve per-iteration traces and distinguish first-run costs, changing execution tiers, and any demonstrated steady state. Concepts: VM-warmup, JIT-tiers, change-points, repeated-processes, benchmark-distributions, startup-versus-steady-state.

## Applying the measurement material to Sofort

Use separately named measurements for fresh-process startup, Wasm compilation, instantiation, initialization, snapshot restore, parked resume, and end-to-end `execute()`; report which work and caches each includes. Match runtime versions, successful program results, input sizes, tool concurrency, and host serialization work across backends. Measure wall latency and total host-plus-guest CPU separately. For density, separate reserved virtual address space, shared base bytes, private dirty pages, and all-in marginal physical memory including host/kernel costs. Publish the arrival model, errors, timeouts, sample counts, tail distributions, and run-to-run variability. Keep nested and bare-metal results distinct. These are applications of the sources above, not new measurements.

Verification record: the five YouTube channels were **USENIX** (Not So Fast), **WebAssembly Summit** (Wizer), **Mike Shah** (Lobster), and **Strange Loop Conference** (Gil Tene and Emery Berger). No paper is assigned because suitable talks/articles cover the requested concepts. No benchmark speedup here is offered as a Sofort performance claim.

## If you only have 3 hours

1. **25 min — Isolation:** read Lin Clark's *Memory in WebAssembly*, then *Security and Correctness in Wasmtime*; explain guest memory corruption, guard pages, and the compiler trust boundary.
2. **30 min — Continuations:** read Zakai's *Asyncify*, then the JSPI API overview; explain which state leaves the call stack and why suspension alone supplies no durable migration format.
3. **40 min — Snapshots:** watch Wizer (24:45), read *Custom startup snapshots*, then focus on the entropy and Wasm-state sections of *Python Workers redux*.
4. **40 min — Engine and layout:** read Takikawa's QuickJS overview, Goose's design overview, and the short FlatBuffers release article; distinguish bytecode, flat data, and an execution checkpoint.
5. **45 min — Honest numbers:** watch Gil Tene (42:59), then skim Gregg's benchmarking checklist and name the exact cold-start boundary, arrival model, and useful work in Sofort's next benchmark.
