# V4 — Performance: the loop gap is real; parity is plausible but unproved

Review date: 2026-10-29. Assignment and constraints: [BRIEF.md](BRIEF.md). **Measured:** results from this review. **Inference:** diagnosis from code plus experiments. **Estimate:** prospective optimization/proof effort, not an achieved proof.

**The README's narrowly worded claim holds.** On the copied spike, the optimized `fill` loop is about **2.9–3.0× slower than V8 TurboFan and 3.6–3.8× slower than Wasmtime/Cranelift** at 1,024–16,384 iterations. Removing the host transition from every Wasm call preserves the approximately 3× V8 gap. Per-thread hardware counters put the large-loop cost at approximately **3.91 cycles per iteration for Lemma, 1.30 for V8, and 1.00 for Cranelift**. This is a code-generation deficit, not process startup masquerading as kernel time.

The useful positive result is also bounded: tested, **unproved** assembly changes reach approximately V8 speed while retaining an explicit bounds check on every store; a more specialized scalar loop reaches approximately Cranelift speed. Thus these kernels do not require speculative vectorization or a heroic allocator to become competitive. They do require additional preservation proofs, target instructions, and eventually an ABI theorem. This review does not establish competitive performance on useful programs or a completed proved optimization.

## 1. Isolation, provenance, and reproduction

I first read the brief, then ran:

```sh
cp -R /Users/noah/.t3/scratch/2026-10-28-here-are-the-absolute-paths-a63c3f1b/lemma-spike /tmp/lemma-verify-v4-performance
cd /tmp/lemma-verify-v4-performance
export LEMMA_LEAN=/Users/noah/.t3/scratch/2026-10-28-here-are-the-absolute-paths-a63c3f1b/lean-oneshot/elan/toolchains/leanprover--lean4---v4.35.0/bin/lean
npm run build > build/v4-rebuild.log 2>&1
npm test > build/v4-tests.log 2>&1
```

Both commands exited 0. Relevant output:

```text
fill: proof checked, 33 model instructions; 236 native bytes match LLVM assembler
fill_unopt: proof checked, 40 model instructions; 264 native bytes match LLVM assembler
fill: linked machine-code bytes pass Lean preservation certificate
[The other five linked bodies also pass.]
"nativeComparisons": 460
11 Wasmtime Pulley result/trap checks pass.
Bounds-check compiler mutant rejected by unchanged model proof.
"coverageProofChecked": true
```

The fresh `fill.native.proof.log` prints:

```text
'preservation_to_bytes' depends on axioms: [propext, Classical.choice, Quot.sound]
```

These are preparation checks, not a new audit of every assurance claim. No demo/HTTP benchmark was needed for this assignment. I did not modify the original spike, use Python, commit, or write any other repository file. All harnesses, binaries, variants and raw samples are in the private copy.

Environment: Apple M4 Pro, 12 physical/logical CPUs, 24 GiB RAM; macOS 26.6.1 / 25G76, arm64; Apple clang 21.0.0; Node **23.10.0**, V8 **12.9.202.28-node.13**; Wasmtime CLI and Homebrew C library **49.0.3**, Cranelift explicitly selected with optimization level `speed` (CLI `-O opt-level=2`). These are the installed versions, not a claim to benchmark the newest releases. Lean is 4.35.0.

Snapshot SHA-256 identifiers:

| Artifact | SHA-256 |
|---|---|
| Copied `README.md` | `66260652e365dde270168c784a7a0cab38389cc4ffb4e98424d5f00c05bae5f7` |
| `lean/CheckedModel.lean` | `a05391bd8c8b87eb9b9aead9b398adaf104e623c577edf8fb634cbb2eb01188b` |
| `lean/NativeBridge.lean` | `d8f63c719510a81ed0bf8d3cd863e45a6426c04cd06902bbe0800703625641c8` |
| `fixtures/fill.wasm` | `e2d3ef3183cb4b7dcdf38066f2b71802a9fa9800463b34b9c6d5fe2dceb4a2a9` |
| Fresh certified `build/runner` | `37ad68193ae69e5bd5758287c4966148ce666ea62f4c8fb6071ab912f4e6328e` |

The [full evidence manifest](/tmp/lemma-verify-v4-performance/v4/manifest.json) includes the other fixtures, harnesses and raw sample hashes. The benchmark addons reuse the freshly built object files. An independent extraction from both addons verified all four included original bodies (`fill`, `fill_unopt`, `load`, `shift`) against their Lean-certified body-byte files: **eight byte comparisons pass**. See [addon-byte-check.json](/tmp/lemma-verify-v4-performance/v4/addon-byte-check.json). The modified prototypes have no such preservation certificate.

## 2. Benchmark design and its limits

The original `src/demo.mjs` uses five samples of 500 calls and one V8 warmup batch. Its C timer starts **after** mapping and initializing memory and stops **before** hashing and printing. Node's timer similarly excludes instantiation, initialization and hashing. The native process launch affects HTTP/request latency, but is already outside that reported kernel timer. The saved report gives 2.72× at 1,024 and 2.95× at 16,384; it is limited evidence, not a fundamentally process-contaminated comparison.

I replaced that timing experiment, inside my copy, with two controls:

1. **Persistent host-call experiment.** A Node N-API addon links the original native bodies and embeds Wasmtime's C API. V8, native code, and two Cranelift configurations live in the same process. The native repetitions run in C; Cranelift uses `wasmtime_func_call_unchecked` with the known `(i32) -> i32` signature; V8 repetitions run in JS. Compilation, instantiation, memory initialization, validation, logging and memory comparisons occur outside the timed region. This experiment deliberately still includes each engine's per-call transition, exposing its size rather than pretending the transitions are identical. The C API documents this unchecked call as the faster embedding interface, with argument-layout obligations borne by the caller. [Wasmtime 49.0.3 API source](https://github.com/bytecodealliance/wasmtime/blob/v49.0.3/crates/c-api/include/wasmtime/func.h).
2. **Internal-call experiment.** I copied each Wasm module's original function body unchanged and appended a `batch(arg, count)` function that repeatedly calls it. V8/Cranelift now cross the host boundary only once per timed batch. Wasm inlining is disabled in V8; disassembly confirms a real `bl` in both engines' batch loops. The Cranelift inner `fill` body is the same as the standalone one. Native still uses its C repetition loop. Matched modules with an identity function measure the remaining loop/call scaffold. This removes the JS-export/C-API transition from each repetition without allowing the kernel to disappear through inlining.

For both experiments:

- Inputs are identical unsigned i32 values and a fixed 64 KiB memory initialized with byte `(i*37+11)&255`. Memory is reset before each input configuration. Repeated `fill(n)` calls perform the same idempotent writes in every engine; the kernel is not modified to make memory volatile or manufacture a dependency.
- The timed native addon uses an ordinary 64-KiB buffer; the original guarded runner remains covered by the separate test-suite run. Native bounds-check instructions are identical in both binaries. This experiment times successful accesses, not fault/trap-handler latency.
- Main `fill` inputs are `0, 1, 16, 64, 256, 1024, 4096, 16384`. Each batch makes `ceil(2,000,000/max(n,16))` calls: 1,954 calls at 1,024 and 123 at 16,384. `load` inputs are `0, 1, 65529`; `shift` inputs are `0, 1, 31, 32, 33`, with 500,000 calls per batch. Timed cases do not trap. Trap correctness is checked separately.
- There are **41 samples per engine/input configuration**, with a deterministic shuffled engine order in every round; five untimed warmup batches precede main/variant measurements, eight precede internal-call measurements. The main run has 2,952 timed batches; the variant run 2,296; the internal-call run 2,132. Samples are repeated batches on one machine, not 41 independently booted systems.
- Primary V8 runs use `--no-liftoff --no-turbo-inline-js-wasm-calls`, giving TurboFan from the outset and preserving exported calls. A separate run with normal Liftoff/tiering confirms that warmup reaches TurboFan and reproduces the result. The internal-call run additionally uses `--no-experimental-wasm-inlining`.
- `process.hrtime.bigint()` supplies wall time. The addon calls **`thread_selfcounts(THSC_CPI, ...)`**, obtaining the current thread's hardware instruction/cycle totals across scheduling/migration. These are real cycle counts, not nanoseconds multiplied by an assumed clock or the low-frequency architectural timer. The struct and flavor come from [Apple's XNU source](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/sys/resource_private.h). Counter intervals include a small amount of instrumentation/kernel work. The main empty-measurement median was 42 ns of timed overhead, about 1,237 counted cycles and 6,388 instructions across the wider counter interval. These are negligible against batches containing millions of kernel instructions and are further reduced by the empty-call subtraction below.
- The main thread requests `QOS_CLASS_USER_INTERACTIVE`. There is no hard core pinning, fixed-frequency setting or claim of an idle dedicated machine. Shuffled ordering and cycles help control that limitation. Reported p10–p90 ranges describe sample spread, **not confidence intervals**. No branch-miss/cache-miss counters were collected, so claims about a particular microarchitectural bottleneck remain inference.

The separate differential check covers **6,700 result/trap and byte-for-byte full-memory comparisons**: 415 `fill` inputs, including all `0..256`, boundary values, `0xffffffff`, and 150 seeded additional values, across 14 native variants plus two Cranelift modes; plus `load`/`shift` edge cases against all three native/Cranelift configurations. This is stronger comparison than the spike's memory hash for these cases, and still finite testing.

### Main measurements

Times below are median **microseconds per complete `fill` call**; brackets show p10–p90. All engine/input cells contain 41 samples.

| `n` | Lemma optimized | V8 TurboFan | Cranelift default | Cranelift explicit checks | Lemma / V8 | Lemma / default CL |
|---:|---:|---:|---:|---:|---:|---:|
| 1,024 | 0.989 [0.969–1.032] | 0.343 [0.331–0.367] | 0.272 [0.250–0.290] | 0.372 [0.358–0.400] | 2.88× | 3.63× |
| 4,096 | 3.978 [3.896–4.140] | 1.336 [1.306–1.424] | 1.044 [1.021–1.085] | 1.467 [1.419–1.567] | 2.98× | 3.81× |
| 16,384 | 15.918 [15.763–16.585] | 5.282 [5.221–5.530] | 4.189 [4.028–4.283] | 5.773 [5.657–6.000] | 3.01× | 3.80× |

The extra explicit-check baseline sets `signals_based_traps=false`, `memory_reservation=0`, and `memory_guard_size=0`; its disassembly confirms checks. Default V8/Cranelift rely on protected memory/guard regions for these accesses. That is a legitimate production baseline, but a different runtime assumption from Lemma's explicit checks. Wasmtime documents those tradeoffs in its [execution-tuning guide](https://docs.wasmtime.dev/examples-fast-execution.html). The explicit-check run changes more than one configuration setting, so its approximately 1.38× cost relative to default Cranelift is an implementation-level sensitivity test, not a perfectly isolated single-instruction experiment.

For the large loop, estimate incremental kernel cost as `(T(16384)-T(0))/16384`, using per-call measurements in each engine. Instruction counts independently agree with the disassembled loop paths:

| Engine | ns / iteration | cycles / iteration | instructions / iteration |
|---|---:|---:|---:|
| Lemma optimized | 0.971 | 3.908 | 32.01 |
| Lemma unoptimized | 1.029 | 4.125 | 39.01 |
| V8 TurboFan | 0.322 | 1.297 | 9.50 |
| Cranelift default | 0.255 | 1.005 | 8.00 |
| Cranelift explicit checks | 0.352 | 1.410 | 14.00 |

This subtraction estimates steady-state loop cost, not a hardware trace of the body alone. Crucially, its conclusion survives the independent internal-call control:

| Internal-call `fill` | Lemma µs | V8 µs | Default CL µs | Explicit CL µs |
|---|---:|---:|---:|---:|
| 1,024 | 1.014 | 0.345 | 0.265 | 0.371 |
| 16,384 | 16.222 | 5.416 | 4.188 | 5.848 |

The internal-call incremental costs are 3.917, 1.311, 1.007 and 1.414 cycles per iteration, respectively. A second process with **normal V8 tiering** gives 1.006 / 0.340 µs at 1,024 and 16.137 / 5.388 µs at 16,384: **2.96× and 3.00×**. Its log records all three functions reaching TurboFan. The initial claim is therefore reproducible under both tiering choices.

The existing peephole optimizer provides about **1.06–1.08×** improvement on the longer loops here. Its 40→33 static modeled instructions correspond to 39→32 instructions on the repeated path; that reduction does not turn into a 39/32 speedup on this CPU.

### Tiny functions expose the embedding trap

For `load(0)`, the host-call experiment reports approximately **1.93 ns native, 4.83 ns V8, 11.30 ns Cranelift**. Calling that a compiler win would be misleading: the host transitions differ.

With repeated calls inside Wasm, the same operation costs approximately **1.95 ns native, 1.39 ns V8, 0.87 ns Cranelift**. `shift(1)` similarly costs **1.90 / 1.33 / 1.26 ns**. Native is slower in this more appropriate comparison, but the blanket 3× ratio does not describe these functions. Their code has no substantial loop to amortize entry/exit work.

The identity-function controls cost approximately 0.75 ns native, 1.33 ns V8 and 1.26 ns Cranelift. **Do not subtract these to claim exact subnanosecond load/shift latency:** Cranelift's full load can be faster than its identity control because instruction overlap, loop layout and alignment differ. The reliable findings are the direct-call measurements, much smaller Wasm bodies, and the large native ABI scaffold. The exact isolated arithmetic/load latency remains unresolved by this harness.

## 3. What the AArch64 actually does

Sources examined: the fresh [linked native disassembly](/tmp/lemma-verify-v4-performance/build/native-disassembly.txt), [fill.reference.S](/tmp/lemma-verify-v4-performance/build/fill.reference.S), the load/shift `.S` files, [V8's emitted code](/tmp/lemma-verify-v4-performance/build/v4-v8-code.txt), [Cranelift fill](/tmp/lemma-verify-v4-performance/v4/fill.cranelift.txt), [explicit-check Cranelift](/tmp/lemma-verify-v4-performance/v4/fill-explicit.cranelift.txt), and both batch disassemblies. These are the same fixture functions, not C equivalents compiled with a different source language.

A diagnostic build also serializes modules compiled by the same C-API setup as the benchmark. Its default `fill`/`load`/`shift` disassemblies and explicit-check `fill` disassembly match the corresponding CLI dumps exactly (`diff -u`, all exit 0). See [C-API fill dump](/tmp/lemma-verify-v4-performance/v4/capi-0-0.txt) and [diagnostic source](/tmp/lemma-verify-v4-performance/v4/diagnostic.c). This checks that the CLI listings describe the embedding's code-generation configuration.

### 3.1 Fixed register slots, not locals spilled inside the loop

`Compiler.stk` maps operand slots to X0..X15 and `Compiler.loc` maps locals to X19..X26 (`CheckedModel.lean:283–291`). In `fill`, W19 holds the argument and W20 the induction variable. There are **no per-iteration stack loads/stores for locals**. The loop's `ldr`/`str` access linear memory. The stack traffic is the entry/exit preservation of callee-saved registers. V8 has spills in its cold stack-check handler; those are also not regular loop-local spills.

The real register-related defect is excessive **copying between these fixed register slots**, plus a preservation relation that fixes their location. General spilling is not the explanation and a general register allocator is not a prerequisite for improving this fixture.

### 3.2 Boolean materialization and unnecessary register-form arithmetic

The loop-exit test currently emits seven instructions:

```asm
mov  w0, w20
mov  w1, w19
cmp  w0, w1
cset w0, lo
cmp  w0, #0
cset w0, eq
cbnz w0, exit
```

Both baselines use a direct compare/branch. A fused `cmp w20,w19; b.hs exit` removes five instructions and two boolean-materialization stages. This is missing cross-instruction selection, not unpredictable data-dependent branching.

Likewise, Lemma repeatedly emits `mov constant; lslv` for a shift by 2 and `mov; mov constant; add; mov` for an increment. AArch64 immediate `lsl` and `add` avoid those register dependencies and copies. This ablation gives the largest single measured improvement: approximately **1.56×**.

The current target model has register-form W arithmetic, but no W immediate-add/immediate-shift constructors. It has conditional branches only for **traps**, plus ordinary unconditional branches and `cbnz`. Emitting these better instructions is therefore not just changing the JS printer: the model, PC stepping, decoder and preservation/relocation machinery need extending.

### 3.3 Two checks of the same address, and an unused reload

Each iteration performs a checked store, recomputes the identical address, performs another full bounds check, loads the just-stored value, and discards it. The optimized check still uses:

```asm
add x16, x0, #0
add x17, x16, #4
cmp x17, x27
b.hi trap
```

The store's success establishes that the subsequent identical-address load cannot trap; there is no intervening growth, host call, concurrency or address change. Removing the reload **alone** barely changes speed. Removing its check alone gives about **1.04×**. Eliminating the whole recomputation/check/reload group gives about **1.10×**. It is real redundancy, but claiming it alone explains 3× would be wrong.

V8 interestingly **retains** the unused loads in both halves of its unrolled loop, with protected-instruction metadata and no explicit bounds compare. Cranelift default eliminates the load and emits only the store. Cranelift's explicit-check configuration also eliminates the actual load, but retains **two** address-limit compares/branches per iteration; its dump makes that residual check visible. Neither baseline is an idealized oracle.

Deleting arbitrary unused Wasm loads is unsound because a load can trap. The proof must use a dominating successful access or retain its trap effect.

### 3.4 Constants, addressing and loop structure

Lemma rematerializes `0x01010101` with two MOVZ/MOVK instructions every iteration. Cranelift uses a single logical-immediate `mov` alias; V8 materializes it in one half of its two-iteration loop. Hoisting Lemma's two instructions gives only about **1.03×** alone. The value can also be maintained as an induction variable, using `v(i+1)=v(i)+0x01010101 (mod 2^32)`, removing the multiply.

Both baselines share the shifted address between accesses. Lemma recomputes it, copies it through X16 even for offset zero, and its model only exposes `[Xbase,Xindex]`. Cranelift uses zero-extending indexed addressing for `fill`/`load`; the specialized scalar prototype uses `[base,wIndex,uxtw #2]`. Coalescing two redundant copies on top of the combined changes yields a small, layout-sensitive extra improvement; a separate percentage for the scaled addressing mode was **not isolated**.

My estimate for scaled addressing alone is **0–10% additional speedup** after the larger changes, with low confidence: retaining explicit bounds checks can still require computing the shifted address, leaving no instruction to save. The approximately 1.34× gain from the combined loop to the specialized scalar loop bundles addressing, strength reduction, check removal and loop changes; it cannot be assigned to one of them. A one-instruction constant encoding likewise has little long-loop value once that constant is hoisted; for tiny functions the wrapper dominates its contribution.

An essential correctness wrinkle: replacing a Wasm **32-bit** left shift with a **64-bit** scaled address is not valid for arbitrary indices. At `i=0x40000000`, `(i << 2)` as i32 is zero, while a zero-extended scaled address is 4 GiB. This fixture traps at iteration 16,384, long before that case; a proof must establish that invariant. Likewise `load`'s static offset 3 must be added after zero-extension in sufficient width, not with a wrapping i32 add.

V8 partially unrolls by two and performs a stack-limit check on the loop path; Cranelift uses a simple top-tested scalar loop without that repeated check. Lemma's 32-instruction path is much larger than either. But fewer instructions do not guarantee faster execution: rotating the already improved loop removes an instruction and **slows it from about 1.34 to 1.65 cycles/iteration**. Without branch/cache counters I cannot distinguish alignment, scheduling or branch-front-end effects. Rotation should not be accepted on instruction count alone.

### 3.5 Fixed ABI overhead dominates `load`/`shift`

Every Lemma fixture has a 96-byte frame, saves/restores X19..X28 and FP/LR, moves memory/size/argument into fixed registers, and zeroes seven local registers. `fill` has only two locals in total; six of those zeroes are unused. Even `shift`, whose body is four instructions, gets the same wrapper. The wrapper is 17 entry instructions plus seven exit instructions and the success jump, before counting the body.

A version preserving only the registers `fill` actually uses reduces empty `fill` from **7.50 to 6.01 cycles/call**, approximately **1.25×**, with effectively **no gain on the long loop**. V8/Cranelift's tiny functions have much smaller entry/exit sequences and two core arithmetic instructions for `shift`. This is a substantial opportunity for tiny exports, but the current Lean theorem excludes the wrapper, trap handler and ABI. Calling wrapper trimming an already proved compiler optimization would be false.

## 4. Measured ablations and what is reasonable to prove

All rows below are hand-edited assembly prototypes, tested but **not Lean-proved**. They implement this fixture's observable return/trap/memory behavior under the actual fixed-64-KiB host contract. The main certified compiler was not replaced by them. Speeds are from the same randomized 41-sample variant run, using incremental cycles at `n=16384`; standalone rows compare with the original optimized loop. Rows marked “on combined” are incremental alternatives, not additional independent multipliers.

| Change | Instructions / iteration | Cycles / iteration | Measured speedup | Proof assessment |
|---|---:|---:|---:|---|
| Original optimized | 32 | 3.91 | 1.00× | Existing certificate, relative to custom model. |
| Delete only the unused load | 31 | 3.90 | ~1.00× | Easy only after proving it cannot trap; not generic dead-load elimination. |
| Reuse store bounds for load | 28 | 3.77 | 1.04× | Reasonable local dominance/address-equality lemma; preserve trap memory. |
| Delete reload plus redundant address/check | 24 | 3.54 | 1.10× | Reasonable fused source/target rewrite across several Wasm instructions. |
| Fuse boolean compare/branch | 27 | 3.57 | 1.10× | Reasonable; new ordinary conditional branch semantics/decoder and branch relocation proof. |
| Select immediate shifts/increment | 25 | 2.50 | 1.56× | High priority; local bit-vector identities plus new W instruction encodings. |
| Hoist multiply constant | 30 | 3.79 | 1.03× | Reasonable for this loop; general LICM needs liveness/non-clobber conditions. |
| Combine the preceding reload deletion, branch fusion, immediates and hoist | 12 | 1.34 | **2.93×** | Still checks each store; this is the strongest low-risk parity direction. |
| Coalesce two more copies, on combined | 10 | 1.31 | ~1.02× extra | Reasonable value-location/liveness proof; wall-time spread makes small gains uncertain. |
| Rotate loop, on combined | 11 | 1.65 | **0.81× extra** | Semantic proof is reasonable; this version should fail the performance gate. |
| Version bounds checks out of hot loop, on combined | 9 | 1.23 | 1.09× extra | Medium/hard: fast-path range invariant, fixed-memory assumption, unchanged slow path. |
| Specialized scalar loop with clamped trip count, induction value and scaled store | 5 | 1.00 | **3.90×** | Plausible proof, but combines several transformations and specialization. Not a general Wasm pass. |
| Trim wrapper, original body | 32 | 3.91 | ~1.00× long loop; 1.25× empty call | Needs entry/exit/ABI work outside the current theorem. |

The combined version's hot path is only:

```asm
loop:
  cmp w20, w19
  b.hs exit
  lsl w0, w20, #2
  mov w1, w20
  mul w1, w1, w2        // constant hoisted before loop
  add x16, x0, #0
  add x17, x16, #4
  cmp x17, x27
  b.hi trap
  str w1, [x28, x16]
  add w20, w20, #1
  b loop
```

It measures **5.50 µs at 16,384** in the variant run, close to V8's 5.28–5.42 µs across the baseline/control runs. The specialized scalar measures **4.12 µs**, close to Cranelift's 4.13–4.19 µs. These comparisons use separate benchmark runs, so “close” is warranted; claiming a statistically established win is not. The hardware feasibility result is clear without such a claim.

The versioned prototype checks `n <= 16384` and uses the original checked function for larger inputs. The scalar prototype executes `min(n,16384)` stores and then returns success or the trap status. This detail is necessary: **trapping immediately when `n > 16384` is wrong**, because the source performs all 16,384 successful stores before its first failing access. Both specialized versions require the fixed memory-size contract; they cannot replace a compiler theorem quantified over every allowed memory size without adding a checked specialization condition or generalizing the invariant.

### Proof-work estimate

The existing proof is useful infrastructure: `CheckedModel.lean` has 1,496 lines, the byte bridge 201. But `compileInstrOpt_run` currently establishes equality with the old snippet for a **single** instruction under `Match`; that is insufficient infrastructure for arbitrary cross-instruction DCE, LICM or register allocation. `Match` fixes every live source operand/local to a designated target register. `codeSize`/`compB` calculate absolute target PCs; deleting instructions requires a proved label mapping or corresponding changes to both size calculation and lowering. New opcode encodings also require decoder coverage and regeneration of all linked-body certificates. These costs must be counted.

The following are **engineering estimates for one experienced Lean/compiler engineer with agent assistance**, reusing the current custom semantics; none is measured proof throughput:

| Work package | Approximate implementation + proof effort | Acceptance obligation |
|---|---|---|
| Immediate selection, logical-immediate/MOVN constants, direct compare/branch patterns | 1–2 person-weeks | W zero-extension/shift identities, flag/branch equivalence, ordinary `b.cond` PC semantics, decoder/encoder checks and retargeting. |
| Scoped copy propagation and redundant load/check elimination | 1–3 person-weeks | Fused-snippet or live-value relation; identical effective addresses, no intervening clobber, same trap and successful-write behavior. |
| Hoisting, induction-variable strength reduction and fixed-size loop versioning | 2–4 person-weeks | Inductive range/value/memory invariant; zero trips, unsigned inputs, no premature trap, modular arithmetic and nonwrapping addresses. |
| ABI specialization/used-register preservation, beyond the current body theorem | 2–6 additional person-weeks | Model entry/exit, SP/stack pairs/return, callee-saved registers, memory framing and trap return convention; current model lacks several of these instructions/state components. |
| General allocator/SSA optimizer | Several further weeks or more; not priced into the fixture route | A reusable allocation/liveness/CFG theorem. The measurements do not establish the cost or benefit on larger functions. |

Allow roughly **4–8 person-weeks for proved body-level parity on these fixtures**, with overlapping work packages and narrow pattern recognition, and approximately **6–14 person-weeks including a scoped ABI proof**. Think several thousand additional lines of implementation/proof/decoder infrastructure, not a handful of peephole lemmas; that line estimate is low-confidence. Small local lemmas are easier than this aggregate, but their composition and branch/byte plumbing are real work. A broad reusable optimizer would likely exceed this range.

These estimates do **not** include closing real-Wasm parsing/semantics, authoritative Arm-model conformance, the loader or a production runtime. The existing clean axiom lists do not close those links. In particular, a faster custom-model proof is not yet a hardware-level end-to-end proof. No timeline for those separate assurance tasks is established here.

## 5. Conclusion and retained evidence

**Parity is plausible for these three kernels.** On `fill`, inexpensive semantic transformations already expose almost all of the performance gap; one checked store per iteration is compatible with V8-class speed. Cranelift-class speed is demonstrated by an unproved scalar specialization, with no SIMD and no need to remove traps unsafely. `load` and `shift` need much less wrapper work, not sophisticated loop optimization. The remaining uncertainty is the engineering cost and generality of proved transformations, not an observed hardware limit at 3× slowdown.

This does not support a prediction of parity on CoreMark, SQLite, floating point, SIMD, calls or arbitrary Wasm. The corpus is one idempotent store loop, one load and one shift, all operating on a hot 64-KiB memory. It does not test cold-memory behavior, compilation latency, end-to-end workerd throughput or host-call-heavy workloads. Default guard-page runtimes and explicitly checked runtimes also carry different assurance obligations. Those limits are material to the conclusion.

Evidence is retained under `/tmp/lemma-verify-v4-performance/` and is not committed. Key artifacts:

- [Main raw samples](/tmp/lemma-verify-v4-performance/v4/samples.json), [summary](/tmp/lemma-verify-v4-performance/v4/main-summary.txt), [C/N-API harness](/tmp/lemma-verify-v4-performance/v4/bench.c), [driver and correctness checks](/tmp/lemma-verify-v4-performance/v4/bench.mjs).
- [Internal-call raw samples](/tmp/lemma-verify-v4-performance/v4/batch-samples.json), [summary](/tmp/lemma-verify-v4-performance/v4/batch-summary.txt), [driver](/tmp/lemma-verify-v4-performance/v4/batch.mjs), [module builder](/tmp/lemma-verify-v4-performance/v4/make-batch.mjs).
- [Variant raw samples](/tmp/lemma-verify-v4-performance/v4/variant-samples.json), [summary](/tmp/lemma-verify-v4-performance/v4/variant-summary.txt), and named `.S` files in `v4/`.
- [Normal-tiering confirmation](/tmp/lemma-verify-v4-performance/v4/default-v8-samples.json), [tiering log](/tmp/lemma-verify-v4-performance/v4/default-v8.log), [rebuild log](/tmp/lemma-verify-v4-performance/build/v4-rebuild.log), [original test-suite log](/tmp/lemma-verify-v4-performance/build/v4-tests.log).

Rerun the retained benchmark binaries/scripts from the copy:

```sh
cd /tmp/lemma-verify-v4-performance
node --no-liftoff --no-turbo-inline-js-wasm-calls v4/bench.mjs
V4_VARIANTS=1 node --no-liftoff --no-turbo-inline-js-wasm-calls v4/bench.mjs
node --no-liftoff --no-experimental-wasm-inlining --no-turbo-inline-js-wasm-calls v4/batch.mjs
V4_OUT=v4/default-v8-samples.json node --no-turbo-inline-js-wasm-calls --trace-wasm-compilation-times v4/bench.mjs
node v4/check-addon-bytes.mjs
node v4/summarize.mjs
node v4/summarize.mjs v4/variant-samples.json
node v4/summarize.mjs v4/batch-samples.json
```

For disassembly, the executed commands include:

```sh
node --no-liftoff --print-wasm-code -e 'const fs=require("fs");for(const n of ["fill","load","shift"]){console.log(n);new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync("fixtures/"+n+".wasm"))).exports.run(8)}'
wasmtime compile -C compiler=cranelift -O opt-level=2 -o v4/fill.cwasm fixtures/fill.wasm
wasmtime objdump --addresses --bytes v4/fill.cwasm
wasmtime compile -C compiler=cranelift -O opt-level=2,signals-based-traps=false,memory-reservation=0,memory-guard-size=0 -o v4/fill-explicit.cwasm fixtures/fill.wasm
wasmtime objdump --addresses --bytes v4/fill-explicit.cwasm
```

## Verdict table

| Claim or explanation checked | Verdict | Evidence |
|---|---|---|
| Optimized native `fill` is “about 2–3× slower than V8.” | **Holds** | 2.88–3.01× for long loops; normal-tiering repeat 2.96–3.00×; internal-call control ~3×. Interpret this as approximate and fixture-specific. |
| The existing peephole optimization gives a modest native improvement. | **Holds** | Long-loop speedup 1.06–1.08×; 39→32 repeated-path instructions and 4.125→3.908 cycles/iteration. |
| Process startup/HTTP overhead explains the measured loop deficit. | **Wrong** | Original kernel timer already excludes startup; persistent and internal-call measurements preserve the deficit. |
| Per-iteration locals spilled to memory are the main cause. | **Wrong** | Locals stay in W19/W20; stack saves/restores are outside the loop. Disassembly and counters instead show 32 instructions/iteration versus CL's 8. |
| Cranelift is a materially faster second baseline on this loop. | **Holds** | ~1.00 cycles/iteration default, ~1.41 with explicit checks, versus Lemma's ~3.91. |
| Redundant checks alone explain the whole gap. | **Overstated** | Reusing the second check gives only ~1.04×; removing its whole reload/address group ~1.10×. Immediate selection alone gives ~1.56×. |
| The measured assembly prototypes are proved compiler improvements. | **Wrong** | 6,700 finite comparisons pass, but no new Lean preservation proofs/certificates were produced for the variants. |
| V8/Cranelift parity can be reached with proved versions of these changes. | **Unverified** | Strong feasibility evidence: 1.34/1.00-cycle prototypes approach the baselines. The proofs and scoped ABI composition remain to be built; 4–8 / 6–14 person-weeks are estimates. |
| These results establish general Wasm or workerd performance parity. | **Unverified** | Three tiny hot-memory fixtures; no representative application, compile-time or end-to-end throughput experiment. |

## TL;DR

1. The `fill` claim reproduces: approximately 3× behind V8 and 3.8× behind default Cranelift, after controlling host overhead.
2. The loop spends ~3.91 cycles/iteration on 32 instructions; baselines spend ~1.30/1.00 cycles on 9.5/8 instructions.
3. The main opportunities are immediate arithmetic, fused branches, cross-instruction reuse and loop invariants; locals are not spilled.
4. Tested unproved scalar changes reach near parity; expect roughly 4–8 person-weeks for proved fixture bodies, 6–14 including a scoped ABI proof.
5. Hardware-level end-to-end assurance and parity on real Wasm applications remain unverified.
