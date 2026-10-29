# T02: languages, compilers and type systems. What models can grow here

Research date: **2026-10-29**. Brief: [`BRIEF-tailwind.md`](../BRIEF-tailwind.md). This is the only file written.

**Labels**

- **Q**: a quotation, checked against the transcript line. Caption timestamps are minute buckets. The captions are unedited, so "ling"/"lin" means Lean and "Obus" means Opus.
- **F**: an external source, found in searches on 2026-10-28/29.
- **I**: an inference.
- **E**: an estimate.

**Coverage (F)**

- **Background read:** the brief, `SUMMARY.md`, `../RESEARCH-SUMMARY.md` §§0, 8 and 11–16, and `ambition/A09-critic.md`.
- **Ledgers:** about 150 compiler, language, proof and rewrite rows in `extract/E01–E19`.
- **Transcript passages read in full:**
  - de Moura (p3-45), Omar (p3-19), Ray Myers (p3-20), Pizlo (p3-23);
  - Feldman (p3-33, p3-35, p3-36), Blow (p3-37), Kernighan (p3-61), Lattner (24), Mattis (22);
  - Theo (01, 14, 87, 88), Jane Street (08), Sodic (p3-27), King (p3-22);
  - Mulroy (`connect26/13`) and Next Token Ep 07.
- **Prior-art searches:** about 25, across arXiv, GitHub READMEs, project pages and vendor pages. They are listed under Sources.

---

## The answer in one paragraph

**(I)** In this area, the model tailwind is strongest when the grown artifact carries a machine-checked proof.

- **Proofs only accumulate.** A proof that closes stays valid, so each model release can only add to the artifact.
- **The frontier moved release by release in 2026** (table below).
- **The human part is the structure** that models work inside: the semantics, the theorem statement, the promotion gate and the work queue. This is exactly what was missing when agents tried and failed to build a verified compiler in March–April 2026.

Three ideas pass the filter. **The pick is Lemma:** a WebAssembly compiler in which models grow every optimization, and nothing is promoted without a proof and a measured speedup.

## Why proofs carry the tailwind in this area (F)

| When (2026) | Who | What happened |
|---|---|---|
| Feb | Anthropic (Carlini) | 16 agents, 2 weeks, about $20k: a C compiler that builds Linux. Unverified, and slower than GCC at -O0 (secondary report). |
| Feb | Paraskevopoulou | Claude wrote about 6,000 lines of Rocq proving CertiCoq's ANF pass, in about 96 hours of commits. |
| Mar–Apr | Basis | 4 agents spent 14 days on a JS→Wasm compiler in Lean. "The compiler ran; the proofs didn't close." It ended with 14 sorries (13 in closure conversion and ANF) and 17 axioms. |
| May–Jul | Rinard (MIT), Axon | A verified compiler for a small Fortran-like language to AArch64, built by Claude Code in 34 days with one human supervisor. |
| May–Jul | Axon, continued | To keep proofs tractable, the agent "chooses less efficient algorithms" and "repeatedly implemented optimization scope reductions". |
| By Jun | Kim Morrison, `lean-zip` | An AI-written, proven DEFLATE in Lean. The README says it "dominates the zlib C reference implementation" and calls the proof "the ratchet". |
| Sep | Trivet | LLM plus Lean verify or refute 147 of 148 LLVM transformations. |
| 2026 | Theo, TS→Rust | "$400,000 of Codex tokens and got nowhere" (84%). Then "$20,000 of Opus 5.5 and I got there in 2 weeks" (Q, `88` [00:00–01:00]). |

**(I)** The last row is the tailwind in its purest form: the same task, the same tests and a newer model take the artifact from 84% to a drop-in replacement.

Theo also names the demand side: "I'm running out of things to throw the LLMs at… I am out of engineering ideas that are like too much for the model" (Q, `88` [20:00–21:00]). A structure that keeps an open queue of unfinished, checkable work turns each model release into more artifact.

---

## 1. Lemma: a WebAssembly compiler where every speedup is a theorem

### Name and one sentence

**Lemma** is a WebAssembly-to-AArch64 compiler written in Lean 4.

- Models grow every instruction lowering and every optimization pass.
- A change is promoted only if it comes with two things:
  - a machine-checked proof that it preserves Wasm semantics;
  - a measured speedup on real programs.

### The seed (Q)

- **Leonardo de Moura (creator of Lean)**, `p3-45-ryan-peterman-creator-of-lean…`, [1:02:00–1:03:00] ([video](https://www.youtube.com/watch?v=KzdYKeAqWhY&t=3720)):
  - "when you have proofs it enables optimizations for free… if the AI is telling you, look, I optimize it. It still computes the same thing. Here's the proof. Uh this is a game changer in my points of view."
  - At [0:32:00–0:33:00], proofs let you "be much more bold on on your optimizations because… people fear implementing optimization because they don't really understand why the the piece of software works."
  - At [0:06:00–0:07:00], on the agent-translated zlib: "now it's just asking to optimize the codes but you cannot break the proofs".
- **Cyrus Omar (Hazel)**, `p3-19-jane-street-trustworthy-human-ai…`, [0:42:00] ([video](https://www.youtube.com/watch?v=fB_lklm7xgU&t=2520)):
  - "they tried to build a verified compiler from JavaScript to to web assembly and without a ton of coordination between the AI agents. They all just picked the lowest hanging fruit all the time… you ended up spending a lot of tokens with not a lot of output."
  - **F:** this matches Basis's March–April 2026 run.
- **Richard Feldman (Roc)**, `p3-36-software-unscripted…shawn-wang`, [1:23:00–1:24:00] ([video](https://www.youtube.com/watch?v=W5SIRbp0AnU&t=4980)):
  - With interpreter, Wasm and native backends at parity, "we can run the whole test suite against all three of them and see if they agree which is a great feedback loop for the models".
  - But "it's been really really hard to convince either codeex [Codex] 5.3 or Opus 4.6 to not do like workarounds and hacks and fallbacks."
- **Nerd Snipe hosts (Theo Browne, Ben Davis; turns not labelled)**, `14-nerd-snipe-we-can-t-trust-gemini-4`, [1:39:00–1:40:00] ([video](https://www.youtube.com/watch?v=H0H_zhKnu3U&t=5940)):
  - "if you can just grind down the Rust compiler like that, what the hell is next?"
  - "LLVM might be a target soon."
  - "It's viable and Obus could probably do it."
- **Peter Mattis**, `22-the-pragmatic-engineer…peter-mattis`, [1:28:00] ([video](https://www.youtube.com/watch?v=0GzwuYGvKA4&t=5280)):
  - "I don't know if it's going to be this year or next that we're materially going to stop looking at the code in the same way that we don't look at assembly anymore."
  - **I:** compilers earned that trust over decades. Lemma earns it by proof.

### What grows

**The loop, mapped onto GrowOS (I)**

| GrowOS | Lemma |
|---|---|
| A program hits a missing syscall (ENOSYS) | A Wasm module hits an opcode with no lowering, or runs more than X% slower than Cranelift |
| An agent writes the handler | An agent writes the lowering rule or optimization pass, plus its Lean proof |
| Checked against Linux running the same program | Checked by the Lean kernel (the proof), the Wasm reference interpreter (differential runs) and real silicon (the ISA model) |
| Held-out probes and mutants | The official Wasm spec tests, held-out corpus modules, and deliberately wrong optimizations |
| Score: % of programs passing | Score: % of the corpus compiled, geomean speed versus Cranelift and V8, and zero `sorry` or axioms |

**What models grow**

- Lowerings for each Wasm opcode: a few hundred across core and SIMD **(E)**. This is the coverage phase, the equivalent of growing syscalls.
- Optimization passes: register allocation, constant folding, copy propagation, CSE, bounds-check elimination, LICM, inlining, peepholes and SIMD lowering.
- New entries in the ISA model when the backend wants another instruction.

**What the builder designs (the structure)**

1. **The Wasm semantics in Lean.**
   - It must be executable, so that it can run the official `.wast` spec tests.
   - It can be written fresh or ported from WasmCert-Coq. Cajal's Talos interpreter is AGPL.
2. **An AArch64 subset model.**
   - Each modeled instruction is admitted only after a randomized differential harness agrees with the Mac's CPU.
   - This is the counterpart of GrowOS's Linux oracle, applied to the target.
3. **An IR and a simulation-relation framework,** with one proof obligation per pass.
4. **The promotion gate:**
   - zero `sorry`;
   - no new axioms, checked by an axiom audit in the style of LeanParanoia;
   - spec tests and corpus runs that agree with the reference interpreter;
   - a performance gate that rejects regressions and requires the targeted gain.
5. **A work queue** that fills itself from the corpus.
6. **A negative-memory file** that every agent reads. Basis's agents kept re-using a tactic that was already recorded as looping.
7. **The public ratchet dashboard.**

The two semantic models together are the theorem statement. They are the one part not delegated without human review.

### Tailwind (I/F)

- **Model progress shows up as more proven passes.** Within 2026, agents went from failing a verified compiler to delivering one for a toy language (table above).
- **The two limits Rinard measured are exactly what newer models relax:**
  - proof depth: Basis was stuck on closure conversion;
  - scope reduction: Axon's agent reached for "less efficient algorithms".
- **Lemma's performance gate refuses scope reduction.** A proven pass is promoted only if it actually moves the benchmark.
- **When Fable 6 or GPT-7 drops:** re-run the open performance-gap queue.
  - Passes the last model abandoned land, for example graph-coloring register allocation with spilling, or bounds-check elimination over loop induction variables.
  - The gap to Cranelift shrinks.
  - Nothing promoted earlier becomes obsolete, because a checked proof doesn't rot.
- **It does not become a prompt.** The trusted semantics, the gate and the accumulated proven passes are the asset. The new model is the worker inside them.
- **De Moura on why this keeps improving** (Q, `p3-45` [0:33:00–0:34:00]): "the big labs, they only start training for formal verification lean very recently… The behavior we see today that is already amazing will get way better in the future."

### The one-shot test (I)

**What a model one or two generations ahead can plausibly produce from the idea in one prompt:**

- *a* compiler (Anthropic did this in two weeks; F);
- perhaps a verified compiler for a toy subset (Axon: 34 supervised days; F).

**What it cannot produce:**

1. **Semantic models a stranger can trust,** checked against the official spec suite and against silicon.
   - That is where human responsibility sits.
   - De Moura names the risk (Q, `p3-45` [0:20:00]): "how do you know that when you exported it's really theorem it's not 2 plus 2 equals four".
2. **Months of accumulated proven passes** measured on a real corpus against a production compiler.
3. **A gate that refuses weakened theorems and scope cuts.**

Even a model that could do item 2 in one long run would be doing it inside Lemma's structure, against Lemma's theorem statement.

### The value proposition

"Run any WebAssembly program at near-production-compiler speed, with a machine-checked proof that the machine code does exactly what the Wasm says. It gets faster every time a better model ships."

**Why it matters (I/F)**

- **Wasm is where untrusted code runs:** plugins, edge functions and, now, agent-written Code Mode scripts.
- **Compiler correctness is part of the isolation boundary.**
  - An out-of-bounds access must trap exactly where the Wasm semantics says it traps.
  - Lemma's theorem covers that.
- **The incumbents are working on the same concern.**
  - Wasmtime and Cranelift run a verification effort with academic collaborators for this reason.
  - Its instruction-selection verifier "finds new bugs in Cranelift's instruction selection" (F, Arrival, OOPSLA 2025).

### The 6-week version (E/I)

1. **Weeks 1–2: the two semantics (builder-led).**
   - **Wasm integer subset:** i32/i64 numerics, locals, structured control including `br_table`, `call` and `call_indirect`, linear memory with trapping bounds, and `memory.grow`.
   - It is executable and run against the matching official `.wast` files.
   - **AArch64 model:** about 70 instructions **(E)**.
   - An instruction is admitted only after ≥10⁶ randomized checks against the Mac's CPU agree **(E)**.
2. **Weeks 2–4: a baseline proven compiler.**
   - **Pipeline:** Wasm → SSA IR → naive AArch64 → bytes.
   - **The theorem:** an end-to-end refinement theorem covering traps, results, memory and host calls. No `sorry`, and no axioms beyond the two models.
   - **Corpus:** CoreMark, CRC32, SHA-256, integer PolyBench kernels and a Lua interpreter, compiled to Wasm with clang or rustc. No floats in v0.
3. **Weeks 4–6: the ratchet runs unattended.**
   - Agents pull from the queue (missing opcodes, and per-benchmark gaps against Wasmtime/Cranelift), propose a pass and its proof, and the gate decides.
   - **Targets:**
     - proven linear-scan register allocation (the largest single gain);
     - constant folding and copy propagation;
     - local CSE and peepholes;
     - bounds-check elimination for counted loops.

**What exists at the end**

- A Lean repository containing the compiler and its end-to-end theorem.
- A CLI that compiles a `.wasm` file to an AArch64 object and runs it under a small, trusted loader.
- The ratchet dashboard. For each pass it shows the model used, the tokens, the proof lines and the speedup.

**The "wait, what?" demo**

1. **The overnight chart.** CoreMark goes from roughly 5–8× slower than Cranelift to roughly 1.5–2.5× slower **(E, to be measured)**. Every step is a promoted proof.
2. **A planted "too clever" optimization.** For example: drop a bounds check where a 32-bit index can wrap. The agent cannot prove it, and the differential harness prints the tiny Wasm counterexample.
3. **The same queue re-run with an older model.** Fewer passes land. That is the tailwind on one screen.

**Cost (E)**

- 2–3 parallel agents on subscriptions: about $1–3k. The API-price equivalent is about $10–30k.
- The builder's Apple Silicon Mac serves as the silicon oracle.
- An optional AWS Graviton instance (under $150) gives a second AArch64 implementation to check against.

### Prior art (F) and what's left (I)

- **Axon** (Rinard, MIT; [arXiv 2605.01660](https://arxiv.org/abs/2605.01660), [2605.08927](https://arxiv.org/abs/2605.08927), github.com/rinard/Axon)
  - An agent-built, verified compiler for a toy Fortran-like language to AArch64: 38,188 lines of Lean.
  - Its optimizations are mostly checked by certificates (translation validation), not proven once and for all.
  - **What's left:** a real input language with a real corpus; proven passes; a ratchet against production compilers; growth across model releases.
- **Basis** ([blog, April 2026](https://www.basis.ai/blog/verified-compiler/))
  - The JS→Wasm verified-compiler attempt failed its proofs.
  - Its own conclusion is "Agent-[…] verification tooling does not exist yet." (The prohibited word is elided, as in S05.) Its lessons are Lemma's design spec:
    - flag proof-unfriendly definitions;
    - test whether simulation relations are strong enough;
    - treat axioms as worse than sorries.
- **Cranelift/Wasmtime verification**
  - Crocus (ASPLOS 2024) and [Arrival](https://2025.splashcon.org/details/OOPSLA/69/Scaling-Instruction-Selection-Verification-against-Authoritative-ISA-Semantics) (OOPSLA 2025) verify "nearly all AArch64 instruction-selection rules reachable from Wasm core".
  - The register allocator has a symbolic checker.
  - Translation-validation work is described as ongoing ([WAW 2025](https://popl25.sigplan.org/details/waw-2025-papers/9/Full-Stack-Correctness-in-Wasm-Eliminating-Bugs-Inside-and-Outside-the-Sandbox)).
  - This is a funded industrial–academic effort on a human-maintained compiler.
  - **What's left:** no end-to-end proof was found, and no model-grown optimizations.
- **[vWasm](https://www.usenix.org/publications/loginonline/provably-safe-multilingual-software-sandboxing-using-webassembly)** (CMU, 2022)
  - Written in F*. It proves isolation, not functional correctness.
  - It has "only a simple register allocator and a basic peep-hole optimizer".
- **[Talos](https://github.com/ashm1tr/talos)** (fork of `cajal-technologies/talos`; Cajal is reportedly YC W26)
  - A Lean 4 Wasm interpreter used as executable semantics, under AGPL.
  - Its README puts performance "behind a separately proven-equivalent implementation".
  - This is the most likely future competitor, or a semantics to reuse.
- **[CertiCoq-Wasm](https://popl25.sigplan.org/details/CPP-2025-papers/9/CertiCoq-Wasm-A-verified-WebAssembly-backend-for-CertiCoq)** compiles *to* Wasm, with proofs. No proven Wasm→Clight or Wasm-ahead-of-time path through CompCert was found.
- **Related checks of LLM-written proofs:** [Trivet](https://arxiv.org/abs/2609.19583) (LLVM translation validation with LLMs and Lean) and [Paraskevopoulou](https://arxiv.org/abs/2602.20082) (LLM-written CertiCoq proof).
- **The technique is not new.** The kill list already holds "LLM proposer + verifier"; Lemma's claim is the artifact, not the technique, in the same way that the kernel, not the loop, was GrowOS's asset.
- **[lean-zip](https://github.com/kim-em/lean-zip)** shows the "proof plus performance ratchet" pattern working at library scale. Lemma applies it where every program benefits.
- **What's left:** no end-to-end-proven Wasm→native compiler was found whose optimizations are grown by models and ratcheted against production compilers on real programs (searches on 2026-10-29).

### The kill (I/E)

**Strongest objection:** *"Cranelift plus Arrival plus 24/7 fuzzing is good enough. A proven compiler that is 2× slower is a curiosity. And the proof only moves trust into two models you wrote."*

**Cheapest tests**

1. **Two days, ≤$300 (E).**
   - Take a tiny Wasm subset and a naive compiler skeleton.
   - Give today's best model 48 hours to prove linear-scan register allocation end-to-end, with no new axioms.
   - **If it fails,** the ratchet stalls near the baseline. Either wait one model release, or fall back to certificate-checked passes as Axon did. If you wait, the project is defined by the tailwind; say so openly.
2. **One day.**
   - Ask the Arrival authors, the Bytecode Alliance and Cajal whether an end-to-end, agent-grown proof is on their roadmap.
   - **If yes,** contribute the semantics and the proven passes there.
3. **After six weeks.**
   - If the gap to Cranelift does not shrink when the model changes, the tailwind claim is false for this artifact. Stop.

### Ambition, solo, stack (E/I)

- **Ambition:**
  - CompCert took about six person-years for roughly GCC -O1 quality ([AbsInt](https://absint.com/compcert/structure.htm)).
  - Axon took 34 agent-supervised days for a toy language.
  - A real Wasm subset at Cranelift-class speed is "very ambitious for one person", not impossible.
- **Solo:** it needs compute, a Mac and Lean, and no partners.
- **Stack:** Lean for the compiler and proofs; Rust or TypeScript for the harness and dashboard. No Python.
- **Builder fit:** compilers, the kernel/VMM, and the earlier V8/Wasm capsule work.

---

## 2. Futamura: write an interpreter, get a proven compiler

### Name and one sentence

**Futamura** turns an interpreter into a proven compiler.

- **Input:** an interpreter for your language, written in Lean.
- **What models grow:** a compiler from that language to WebAssembly.
- **What is proven:** a machine-checked theorem that compiled programs do exactly what the interpreter does.

It is a proven compiler-compiler for an era of one-project languages.

### The seed (Q)

- **Theo Browne**, `14-nerd-snipe…`, [1:35:00–1:36:00] ([video](https://www.youtube.com/watch?v=H0H_zhKnu3U&t=5700)):
  - "I'm going through a bunch of real world Rust apps that are too slow to compile and building bespoke compilers…"
  - "something as insane and tedious as building a bespoke language or extensions for an existing language as well as a compiler for one project is somewhat viable. Why wouldn't you build the perfect compiler for your app?"
- **Ray Myers**, `p3-20-software-should-work-code-worth-writing…`, [29:00–30:00] ([video](https://www.youtube.com/watch?v=mZgglPK8Rg0&t=1740)):
  - To prove a language sound: "port the interpreter from gleam to gleam to lean port the type checker define the operational semantics and type rules and then prove as theorems your preservation and progress… we do have these things called agents now that that that helps a lot".
  - At [33:00]: "if you want to start to unlock this world of power, I would suggest define your semantics."
- **de Moura**, `p3-45`, [0:09:00]:
  - "You can write a very this is what I want in a very naive way and you Ask the AI look generate efficient version and optimize and prove that it's equivalent to my inefficient one."
  - **I:** an interpreter is the canonical naive program.
- **Cyrus Omar**, `p3-19`, [1:01:00–1:02:00]: "the costs of adopting and building new things has changed dramatically. um in particular adoption costs for new languages".
- **Brian Kernighan**, `p3-61-ryan-peterman-brian-kernighan…`, [0:45:00–0:46:00] ([video](https://www.youtube.com/watch?v=sMllOlxVgD0&t=2700)):
  - AWK was cheap because of "Yak, the compiler compiler": "you take this on one very bright good programmer over a long weekend or so and you've got a language."
  - **I:** parsers got their compiler-compiler 50 years ago; proven back ends never did.
- **Richard Feldman**, `p3-35-…tigerbeetle…`, [1:06:00] ([video](https://www.youtube.com/watch?v=8br5QcmYq84&t=3960)): wants to find "pathological paths through the compiler that can get it to miscompile something".

### What grows (I)

**The loop, mapped onto GrowOS**

- A test program uses a construct the compiler cannot yet compile → that is the ENOSYS.
- The agent writes the lowering and its proof.
- The check is the Lean kernel, plus differential runs: the interpreter against the compiled Wasm in Wasmtime and V8.

**What models grow, per language**

- The compiler, construct by construct: closures, algebraic data types and pattern matching, tail calls, strings, exceptions and effects, and RC or GC.
- The simulation proofs for each construct.

**What models grow, across languages**

- A library of proven lowering patterns that every new language reuses: closure conversion, ANF/CPS, pattern-match compilation, RC insertion and tail calls.
- **This library is the accumulating asset.** Language N should cost less than language 1.

**What the builder designs**

1. **The semantics interface:** how to write an interpreter so that it is provable. That means fuel, explicit state and effects, and no `partial def`, one of Basis's blockers.
2. **The Wasm target semantics,** shared with Lemma.
3. **The correctness-theorem template.**
4. **The conformance gate:** the language's own test suite, differential fuzzing, and the Lean kernel.
5. **The work queue.**

### Tailwind (I/F)

- **The core of the pattern library is where Basis got stuck.** 13 of its 14 remaining sorries were in closure conversion and ANF (F).
- **Each release pushes the frontier** of which language features compile with proofs (closures → effects → GC → laziness), and of how fast the output runs.
- **Demand rises with model capability too.** Theo predicts more one-project languages *because* models make them cheap. Each one needs a compiler that people can trust without reading it.
- **This is an old idea whose economics flipped.**
  - Semantics-directed compiler generation (Mosses's SIS, 1979; later generators such as [Venter 1996](https://ir.unisa.ac.za/handle/10500/24650)) produced compilers too slow to use.
  - Proof work per language needed rare experts.
  - Models remove that manual work per case. The proof keeps the models honest. This matches the flip-rule shape.

### The one-shot test (I)

**What a next model can probably do:**

- write a compiler for one small language from its interpreter;
- perhaps prove it, for a tiny language.

**What it cannot one-shot:**

- the reusable library of proven patterns;
- the semantics-interface method that makes arbitrary interpreters provable;
- the accumulated conformance history for each language.

One prompt yields one compiler, not a factory whose marginal cost per language falls.

### The value proposition

"Write an interpreter for your language; get a WebAssembly compiler with a machine-checked proof that it never disagrees with your interpreter."

**A concrete high-value instance (Q/F/I)**

- **The problem today:**
  - Lean's FAQ says that `native_decide` extends the trusted base "with the Lean compiler (written in Lean), the Lean runtime (written in C++)… and the code generation backend (LLVM by default)" ([FAQ](https://lean-lang.org/faq)).
  - Tools exist to flag `native_decide` or strip it: [LeanParanoia](https://reservoir.lean-lang.org/@oOo0oOo/paranoia), gonzalgo, and AXLE's `decide +kernel` repair.
- **Why it fits:** Lean's λRC intermediate language is formally defined ("Counting Immutable Beans", [arXiv 1908.05647](https://arxiv.org/abs/1908.05647)).
- **What it would enable:** a Futamura compiler for λRC would let proofs that rely on heavy computation run compiled code that trusts only the semantics.
- **Prior art:** none found. The searches turned up no verified Lean compiler. Lean4Lean targets the kernel, not the compiler.

### The 6-week version (E/I)

1. **Weeks 1–2.**
   - Build the semantics interface and the Wasm semantics (reuse Lemma's, or port WasmCert).
   - Language A is a Scheme-like core: λ, let, if, integers, pairs, closures and proper tail calls.
   - Prove exactly the passes Basis left as `sorry`: closure conversion, ANF and Wasm emission.
2. **Weeks 3–4.**
   - Language B is an ML-like core with algebraic data types and pattern matching (or Gleam's core, or EY, Ray Myers's target).
   - It reuses language A's patterns.
   - Log agent-hours and the share of proof lines reused.
3. **Weeks 5–6: "language day".**
   - On Monday, write a fresh interpreter of about 300 lines for a small DSL.
   - By Friday, the loop has grown a proven compiler for it.

**What exists at the end**

- A Lean repository with the semantics interface, the pattern library, and three proven compilers (A, B and the DSL).
- A CLI that takes an interpreter and a program and emits `.wasm`.
- A reuse report: agent-hours and proof lines per language.

**The demo**

1. **A timelapse from Monday's interpreter to Friday's proven compiler.** The compiled programs run 10–50× faster than the interpreter **(E)**.
2. **A one-line change to the interpreter's semantics,** for example integer overflow changed from wrapping to trapping.
   - The proof breaks at exactly the lowering that depended on it.
   - The proof doubles as a map of what a language change affects.

### Prior art (F) and what's left (I)

- **[Truffle/GraalVM](https://www.graalvm.org/) and PyPy:** write an interpreter, get a fast JIT (by partial evaluation or meta-tracing). Fast, but unverified.
- **[K framework](https://kframework.org/):** derives interpreters, symbolic execution and verifiers from semantics. No proven optimizing compiler.
- **Classical compiler generation from semantics:** died on output speed and manual effort.
- **Verified compilers, one language at a time:** CompCert, CakeML, CertiCoq-Wasm, Basis (failed) and Axon (a toy language).
- **The search result:** "no 2026 system where an agent derives a proven compiler from an interpreter or formal semantics" (searches on 2026-10-29).
- **What's left:** the reusable, model-grown, proof-carrying compiler-compiler.

### The kill (I/E)

**Strongest objection:** *"Every language's hard parts differ (GC, effects, FFI, numeric towers). The pattern library won't transfer, so this is N separate Basis-sized projects."*

**Cheapest test** (already in weeks 1–4):

- Compile two small languages back to back.
- **If language B does not cost ≤⅓ of language A's agent-hours while reusing ≥50% of proof lines (E thresholds),** you have compilers, not a compiler-compiler.
- **Fallback:** Lemma, or the single Lean λRC instance.

**Ambition (E):** research-program size, solo-feasible at the scale of small languages. No Python.

---

## 3. Soundcheck: TypeScript whose "no errors" is a theorem

### Name and one sentence

**Soundcheck** is a TypeScript checker for a growing, mechanically proven sound subset of the language.

- **Demand comes from real codebases.** Every construct it cannot yet check soundly is an ENOSYS.
- **Models grow the subset** one feature at a time: they extend the core calculus, the checker and the Lean soundness proof.
- **The ratchet** is the share of real code accepted with no escape hatches.

### The seed (Q)

- **Ray Myers**, `p3-20`:
  - At [31:00–32:00]: a language "sound in theory … not sound in practice yet. You do not have to trust my formalization strategy because the process produced a oneline reproduction".
  - At [27:00]: soundness "is a mathematical claim… we're not arguing about is this type safe like no it is or it isn't sound."
- **Filip Sodic**, `p3-27-ndc-conferences-types-are-worth-the-typing…`, [0:28:00] ([video](https://www.youtube.com/watch?v=Vhjo1myKaCk&t=1680)):
  - "We want to try to get everything we know into the type system… types should be a lossless storage of information".
  - This is in the section on designing types "to keep your agents in check."
- **Jane Street interviewer**, `08-jane-street-how-ai-is-changing-programming`, [0:14:00] ([video](https://www.youtube.com/watch?v=b9Ssp1B_Pf4&t=840)): types let the compiler carry rules between people, "And now when we have all these AIs running around a whole bunch like virtual people… it feels like it provides useful structures there as well."
- **Richard Feldman**, `p3-36` [1:24:00]: models' "workarounds and hacks and fallbacks".
  - **I:** `as any` and TypeScript's unsound corners are the type-level form of the same workaround.
- **Theo Browne**, `88-theo-t3-gg-you-can-rewrite-typescript-in-rust…`, [08:00]: "the TypeScript type system is incredibly complex and flexible. It's a Turing complete system."
- **Richard Feldman**, `p3-33-…casey-muratori…`, [0:40:00]: "static typing is back. It's here to stay."
- **Alexis King**, `p3-22-…constructive-da…`, [41:00–42:00]: "I would really love to see more languages that are designed to be statically typed from the ground up that still utilize a lot of structural typing".

### What grows (I)

**What models grow**

- **The core calculus,** feature by feature: narrowing, generics, variance, `keyof` and indexed access, mapped and conditional types, classes and getters.
- **The checker.**
- **The Lean soundness proof:** progress and preservation over the semantics of a JS subset.
- **Checks at untyped boundaries:** runtime checks inserted where code meets `unknown`, JSON or untyped JS (gradual typing).

**What the builder designs**

1. **The operational semantics of a JS subset.** The starting point is a λJS-style core ("The Essence of JavaScript", ECOOP 2010).
2. **The mapping from real TypeScript into the core,** built on an existing parser (oxc or tsc-rs).
3. **The "unsupported construct" protocol.**
4. **The corpus.** For example T3 Code, tRPC, Effect and Excalidraw: the repositories Theo used to check TS Rust's fidelity.
5. **Two gates:**
   - the proof closes;
   - a **soundness canary** passes. The corpus's own test suites run with runtime type monitors on every function that was checked soundly. Any violation is a bug in the model or the proof, and blocks promotion.

**The ratchet:** the % of corpus functions, by lines, accepted soundly with no `any`, `as` or `!`.

### Tailwind (I)

- **The proofs are research-grade.** Soundness for structural subtyping with generics, variance, narrowing and mutation is research work. Ray Myers's small proof shows where agents are today.
- **Coverage climbs with each release, with no change to the structure.** Each release moves which TypeScript features can be proven.
- **Demand rises with model capability.**
  - As more code is agent-written, unsound corners become a way to pass the checker without being right.
  - De Moura (Q, `p3-45` [0:34:00]): "if I'm not the one that's writing most of the codes anyway it doesn't really matter… what matters are the specification level".

### The one-shot test (I)

**What a next model does easily:**

- writes a TypeScript checker (TS 7 in Go, Theo's tsc-rs and Bun check already exist);
- writes a sound toy calculus.

**What it cannot one-shot:**

- a mechanized soundness proof for the subset that real code uses;
- the corpus-measured boundary between the proven subset and the escape hatches;
- the canary history on real repositories.

### The value proposition

"TypeScript where 'it typechecks' is a proof that it can't throw a type error at runtime, and the provable part of the language grows with every model release."

**A bonus (I):** sound types let an ahead-of-time TypeScript compiler drop runtime guards and unbox values. That was Static Hermes's rationale, and it applies to the builder's scriptc.

### The 6-week version (E/I)

1. **Weeks 1–3: the core and its proof.**
   - The core covers:
     - structural objects with readonly and optional properties;
     - functions;
     - unions with discriminant narrowing;
     - literal types;
     - generics, without variance;
     - arrays, treated as invariant;
     - `unknown`, with checked boundaries.
   - The Lean soundness proof has zero `sorry`.
2. **Weeks 3–5: the checker on real code.**
   - The checker runs on oxc or tsc-rs ASTs, on 3 real repositories.
   - It produces a coverage report, and the canary is wired to their test suites.
3. **Weeks 5–6: unattended growth.** The queue of the most frequent unsupported constructs becomes features and proofs, and coverage rises.

**What exists at the end**

- A Lean core calculus with a complete soundness proof.
- A CLI checker that runs on real repositories and reports coverage and canary results.
- A growth log: each feature with its model, proof lines and coverage gain.

**The demo**

1. **On a real repository:** "N% of functions proven sound".
2. **Three real runtime type errors that `tsc --strict` accepts and Soundcheck rejects,** each with a 10-line repro:
   - array covariance;
   - method-parameter bivariance;
   - an optional property holding `undefined`.
3. **An overnight run** that lands one new feature with its proof, and the coverage number moves.

### Prior art (F) and what's left (I)

- **"Understanding TypeScript"** (Bierman, Abadi, Torgersen, ECOOP 2014): a formal core that documents the unsoundness.
- **[Safe TypeScript](https://www.microsoft.com/en-us/research/publication/safe-efficient-gradual-typing-for-typescript-3/)** (POPL 2015): sound through runtime checks, with about 15% overhead when bootstrapping its compiler.
- **[Arteca's 2018 thesis](https://uwspace.uwaterloo.ca/handle/10012/13697):** a mechanized (Coq) soundness proof for a gradually typed JS subset.
- **Static Hermes (Meta)**
  - Described as "optional ahead-of-time compilation of soundly typed JavaScript, using TypeScript or Flow annotations".
  - Still in development in October 2026 ([Callstack](https://www.callstack.com/events/hermes-v1-what-it-is-what-it-isnt-and-whats-next)).
  - Funded, with a hand-designed subset. Not mechanized.
- **[ezno](https://lib.rs/crates/ezno):** claims "guaranteed type safety… as long as definitions are sound".
- **Not alternatives:**
  - ReScript is sound, but a separate language.
  - TS 7, tsc-rs and Bun check are fast and unsound by design.
- **What's left:** a mechanized, model-grown sound subset of real TypeScript, ratcheted on a corpus.
- **Funded overlap:** Meta's sound-typing work. The differentiator has to be the proof and the growth.

### The kill (I/E)

**Strongest objection:** *"Real TypeScript is mostly the unsound parts: `any`, `.d.ts` claims about JavaScript, aliasing and mutation. A sound subset covers too little, and the boundary checks cost too much. It also sits next to the killed 'TS tooling' family."*

**Cheapest tests (2–3 days)**

1. **Coverage estimate.**
   - Classify every function in 3 repositories by the TypeScript features it uses.
   - Estimate the coverage that six months of features could reach.
   - **If it is below 40% (E),** stop.
2. **Real-world bite.**
   - Mine issue trackers for runtime type errors in strictly typed code.
   - **If they are rare,** the value is low.

---

## Considered and cut

| Idea | Why it's cut |
|---|---|
| **Proven drop-in C libraries** (de Moura's zlib story, generalized) | Being done. `lean-zip` is AI-written and proven, beats the zlib C reference, and calls its proof "the ratchet". The Lean FRO is the natural owner. The FRO's DFMD talk also lists Google's Anneal and the Signal Shot moonshot. |
| **Bespoke compilers for each app** (Theo, `14` [1:35:00]) | Theo is building Lust (not public). Its oracle is the reference compiler's tests. Folded into Futamura, where the compiler is proven. |
| **Proof-carrying rewrites and ports** (TS→Rust, Mulroy's Zig→JS: "language doesn't matter. Rewriting does", `connect26/13` [11:00]) | The port family is on the rejected list. DARPA TRACTOR funds C→Rust. Translation validation of rewrites was already a round-7 bet. |
| **Agent audits of soundness and miscompilation** (Myers's EY bug, Feldman's wish) | This is the rejected "agent-era Jepsen" shape. Soundcheck keeps the proof and drops the audit. |
| **LLM superoptimizer; peepholes checked by Alive2 or Trivet** | On the kill list (LLM proposer + verifier). It survives only as Lemma's pass queue, where the asset is the compiler. |
| **Proven LLVM-IR backend** (Nerd Snipe: "LLVM might be a target soon") | Same shape as Lemma, with far harder semantics (undef, poison, provenance). It is Lemma's path to scale, not a place to start. |
| **Grown executable language specs** | Rejected (the executable-spec family). |
| **Port an ecosystem into a better new language** (Omar, `p3-19` [1:02:00]) | Needs a target language people want. Close to the rejected Fil-everything shape. Folded into Futamura. |
| **LLM decompilation with a recompilation oracle** (`14` [0:46:00]) | On the kill list (decompilation), and bound by copyright. |

## Ranking

| # | Idea | Tailwind | Resists one prompt | Not taken | Value clarity | Builder fit | Main risk |
|---|---|---|---|---|---|---|---|
| 1 | **Lemma** | High | High | Medium-high (Cranelift, Talos nearby) | High | High | Today's model can't prove the passes that matter |
| 2 | **Futamura** | High | High | High | Medium-high | Medium-high | Proof patterns don't transfer between languages |
| 3 | **Soundcheck** | High | Medium-high | Medium (Static Hermes) | High | Medium | Real TypeScript is mostly the unsound part |

**ONE pick: Lemma.** It is the closest analog to GrowOS.

- It is a systems artifact, grown one opcode and one pass at a time.
- It is checked by an oracle the generator doesn't control.
- It has one number (speed versus Cranelift, at zero sorries) that should move with every model release.
- The other two build on it. Futamura targets Lemma's Wasm semantics. A sound TypeScript subset is something scriptc could compile through Lemma.

**Cross-reference (I).** T04's GrowCAS and T07's DeltaForge use the same proof-gated growth shape, in mathematics and in data engines. Lemma is the compiler instance. All three could share one gate: axiom audit, negative memory and a performance or coverage ratchet.

**TL;DR**
1. Build **Lemma**: a Wasm→AArch64 compiler in Lean where models grow every lowering and optimization, and nothing is promoted without a machine-checked proof plus a measured speedup on real programs.
2. It improves for free with each model. In 2026, agents went from failing at a verified compiler (Basis, March) to building a toy one (Axon, May). Proven passes never rot, and the open performance queue waits for the next model.
3. The cheap kill: give today's model two days to prove a register allocator end-to-end. The nearest neighbors are Cranelift's partial verification (Arrival) and Cajal's Talos interpreter. Neither grows an end-to-end proven compiler.

---

## Sources

**Transcripts** (local file, then video)

| File | Speaker(s) | Video |
|---|---|---|
| `p3-45-…creator-of-lean…` | de Moura | [video](https://www.youtube.com/watch?v=KzdYKeAqWhY) |
| `p3-19-…live-type-theoreti…` | Omar | [video](https://www.youtube.com/watch?v=fB_lklm7xgU) |
| `p3-20-…code-worth-writing…` | Ray Myers | [video](https://www.youtube.com/watch?v=mZgglPK8Rg0) |
| `p3-36-…shawn-wang…` | Feldman | [video](https://www.youtube.com/watch?v=W5SIRbp0AnU) |
| `p3-35-…tigerbeetle…` | Feldman | [video](https://www.youtube.com/watch?v=8br5QcmYq84) |
| `14-nerd-snipe…` | Theo Browne, Ben Davis | [video](https://www.youtube.com/watch?v=H0H_zhKnu3U) |
| `88-…typescript-in-rust…` | Theo | [video](https://www.youtube.com/watch?v=ND_kRgU_WlY) |
| `22-…peter-mattis` | Mattis | [video](https://www.youtube.com/watch?v=0GzwuYGvKA4) |
| `p3-61-…kernighan…` | Kernighan | [video](https://www.youtube.com/watch?v=sMllOlxVgD0) |
| `p3-27-…types-are-worth-the-typing…` | Sodic | [video](https://www.youtube.com/watch?v=Vhjo1myKaCk) |
| `p3-22-…constructive-da…` | King | [video](https://www.youtube.com/watch?v=0BXuYlNrUmE) |
| `p3-33-…casey-muratori…` | Feldman | [video](https://www.youtube.com/watch?v=LgvH67G4iL8) |
| `08-jane-street…` | Jane Street interviewer | [video](https://www.youtube.com/watch?v=b9Ssp1B_Pf4) |
| `connect26/transcripts/13-artifacts…` | Mulroy | [video](https://www.youtube.com/watch?v=D_tnYlZe5t8) |

Also read, with no quote used: Pizlo (`p3-23`), Blow (`p3-37`), Lattner (`24`), Theo (`01`, `87`), and Next Token Ep 07.

**External sources (F)**

- **Agent-built verified compilers**
  - Basis, [Building an unverified compiler with agents](https://www.basis.ai/blog/verified-compiler/) (April 2026).
  - Rinard, [Axon](https://arxiv.org/abs/2605.01660) and [credible compilation vs verification](https://arxiv.org/abs/2605.08927).
  - [Agentic Harness for Real-World Compilers](https://arxiv.org/abs/2603.20075).
  - Anthropic's C compiler, a [secondary report](https://www.founderland.ai/articles/ai-agents-built-a-c-compilerbut-gcc-keeps-its-performance-cr-mlf9rglk).
- **LLM-written proofs about compilers**
  - [Trivet](https://arxiv.org/abs/2609.19583).
  - [Paraskevopoulou, CertiCoq ANF](https://arxiv.org/abs/2602.20082).
- **The Lean ecosystem**
  - [lean-zip](https://github.com/kim-em/lean-zip).
  - [Lean FRO DFMD talk, June 2026](https://lean-lang.org/presentations/20260604_DFMD/).
  - [Lean FAQ](https://lean-lang.org/faq).
  - [Lean FRO Year 3 roadmap](https://lean-lang.org/fro/roadmap/y3).
  - [LeanParanoia](https://reservoir.lean-lang.org/@oOo0oOo/paranoia).
  - [Counting Immutable Beans](https://arxiv.org/abs/1908.05647).
- **Wasm verification and compilation**
  - [Arrival (OOPSLA 2025)](https://2025.splashcon.org/details/OOPSLA/69/Scaling-Instruction-Selection-Verification-against-Authoritative-ISA-Semantics) and [its PDF](https://www.contrib.andrew.cmu.edu/~bparno/papers/arrival.pdf).
  - [Full Stack Correctness in Wasm (WAW 2025)](https://popl25.sigplan.org/details/waw-2025-papers/9/Full-Stack-Correctness-in-Wasm-Eliminating-Bugs-Inside-and-Outside-the-Sandbox).
  - [vWasm](https://www.usenix.org/publications/loginonline/provably-safe-multilingual-software-sandboxing-using-webassembly).
  - [Talos](https://github.com/ashm1tr/talos).
  - [CertiCoq-Wasm](https://popl25.sigplan.org/details/CPP-2025-papers/9/CertiCoq-Wasm-A-verified-WebAssembly-backend-for-CertiCoq).
  - [SpecTec](https://pldi24.sigplan.org/details/pldi-2024-papers/64/Bringing-the-WebAssembly-Standard-up-to-Speed-with-SpecTec).
  - [CompCert structure](https://absint.com/compcert/structure.htm).
- **Sound typing for TypeScript and JavaScript**
  - [Safe TypeScript](https://www.microsoft.com/en-us/research/publication/safe-efficient-gradual-typing-for-typescript-3/).
  - [Arteca 2018](https://uwspace.uwaterloo.ca/handle/10012/13697).
  - [Static Hermes / Hermes V1](https://www.callstack.com/events/hermes-v1-what-it-is-what-it-isnt-and-whats-next).
  - [ezno](https://lib.rs/crates/ezno).
- **Generating compilers and tools from semantics**
  - [Venter 1996](https://ir.unisa.ac.za/handle/10500/24650).
  - [GraalVM](https://www.graalvm.org/).
  - [K framework](https://kframework.org/).

**Searched, nothing found (F, 2026-10-29)**

- a Sail→Lean backend or a Lean AArch64 model;
- a verified Lean compiler;
- a verified Wasm→Clight or Wasm-ahead-of-time compiler through CompCert;
- a mechanized TypeScript soundness proof;
- a 2026 system in which an agent derives a proven compiler from an interpreter;
- a public repository for Theo's Lust.
