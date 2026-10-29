# D4: Lemma — VALUE (does it matter?)

Research date: **2026-10-29**. Brief: [`BRIEF-deepdive.md`](../BRIEF-deepdive.md). Source idea: [`tailwind/T02-languages-compilers.md`](../tailwind/T02-languages-compilers.md) §1. The original investigation wrote this report; the closure audit edited only D4 and D6, with no commits.

**Labels**

- **Q**: quoted. Transcript quotes are checked against the transcript line; caption timestamps are minute buckets and the captions are unedited.
- **F**: sourced, with a link. GitHub data was pulled through the GitHub API on 2026-10-29.
- **I**: inference.
- **E**: estimate.

**Method**

- **Transcripts read:** de Moura (`p3-45`), Nerd Snipe (`14`), Theo (`88`), Feldman (`p3-36`), Omar (`p3-19`), Mattis (`22`), the Wasm-in-the-Windows-kernel talk (`p3-40`), and Cloudflare Code Mode (`48`). The whole corpus was grepped for Wasm, verification and miscompilation passages.
- **Primary sources:**
  - every Wasmtime security advisory (81 in total), with root causes read from the advisory text and the fix commits;
  - the Bytecode Alliance's April 2026 post;
  - the Axon, vWasm/rWasm, EquiVM and CLEVER papers;
  - Anthropic's Fermat's Last Theorem post.
- **An interrupted one-shot experiment, audited 2026-10-29 with GPT-6.1.** Claude Fable 5.1 and Opus 5.5 were each given one initial prompt and a planned 75-minute cap, with iterative tool use. Section 3 records the recovered artifacts and independent Lean checks. No model-generation run was resumed.

---

## The answer in one paragraph

**Real but narrow.**

**The pain is real.**
- Wasmtime shipped **four critical compiler-caused sandbox escapes** in 2026, against two in 2021–2025 combined. Two of the four affect only AArch64, Lemma's target.
- In April, **11 of its 12 advisories were found with LLM-based tools.** Better models make unverified compilers more dangerous, which is the strongest form of the tailwind.

**The value is narrow, for three reasons.**
1. **The people who feel the pain are fixing it in-house.** The Bytecode Alliance's response is LLM bug-hunting plus verification of Cranelift's lowering rules in CI. Its members will not adopt a slower Lean compiler.
2. **The same model progress that makes Lemma feasible may lower the cost of reproducing its grown artifact (I).**
   - A model "roughly comparable to Claude Fable 5.1" wrote about 13M lines of checked Lean mathematics in 11 days. A proven compiler is roughly 0.1M lines.
   - Paradigm grew a proven Yul→EVM backend in about 10 weeks with no human-written code, and runs a public contest for proof-preserving optimisations. That is Lemma's shape, already built for another target.
3. **The users who would actually run Lemma are a small set.** They are the embedders who already pay about 10× in speed by interpreting Wasm for safety.

**What survives is real.**
- A sufficiently scoped end-to-end theorem could exclude three bug classes beyond lowering-rule verification; the executable implementation, bytes and runtime assumptions must be covered (§1.1).
- Lemma is a credible research artifact and benchmark.
- It is a reusable, trusted Wasm and AArch64 semantics.

Better models could improve the artifact and lower reproduction costs at the same time (I). The local experiment does not establish how cheaply a complete, validated compiler can be regrown.

---

## 1. Who would care, and how much

### 1.1 The pain: 2026 was the year Wasm compilers bled (F)

**The Wasmtime advisory record**, all advisories through 2026-10-19, pulled from the [GitHub advisory database](https://github.com/bytecodealliance/wasmtime/security/advisories):

| Year | Advisories | Critical |
|---|---|---|
| 2021 | 4 | 1 |
| 2022 | 8 | 0 |
| 2023 | 4 | 1 |
| 2024 | 4 | 0 |
| 2025 | 4 | 0 |
| **2026 (to Oct 19)** | **57** | **5** |

**Every 2026 critical or high advisory, by root cause.** The two right-hand columns ask whether a defence would rule the bug out.

| CVE (date) | Component | Root cause (advisory text or fix commit) | Lemma's end-to-end theorem (I) | Cranelift's planned rule verification in CI (F/I) |
|---|---|---|---|---|
| [CVE-2026-34971](https://github.com/bytecodealliance/wasmtime/security/advisories/GHSA-jhxm-h53p-jm7w) (Apr 9), critical | Cranelift aarch64 lowering rule | A miscompiled `load(iadd(base, ishl(index, amt)))`: "The `amt` value is masked incorrectly", so the bounds check and the load use different addresses. Needs memory64 and Spectre mitigations off. | Conditional: memory64, bit-exact shifts and the actual address calculation must be in scope | **Yes:** "verification flags the same bug as was found with the LLM search" |
| [CVE-2026-34987](https://github.com/bytecodealliance/wasmtime/security/advisories/GHSA-xx5w-cvp6-jv83) (Apr 9), critical | Winch, the baseline compiler | It "assumes a 32-bit memory offset stored in a 64-bit register has its upper bits cleared when it may not". The proof of concept works on aarch64. | Yes, if the ISA model is bit-exact about W- versus X-register writes | No: Winch has no ISLE rules |
| [CVE-2026-115889](https://github.com/bytecodealliance/wasmtime/security/advisories/GHSA-897f-g5gm-fmxm) (Oct 19), critical | Cranelift IR, all architectures | SSA value indices are bit-packed, so they can "silent[ly] overflow in release builds", giving "arbitrary miscompilation". The page says the report was "submitted with AI assistance". | Conditional: the proof must cover the executable packed-index representation and release-build arithmetic, not an idealised unbounded index | No |
| [CVE-2026-115893](https://github.com/bytecodealliance/wasmtime/security/advisories/GHSA-mghf-wjfp-p5xm) (Oct 19), critical | Cranelift aarch64 machine-code emission | The default branch of `br_table` is a conditional branch with a "+/- 1MiB range". With more than about 256k targets, the branch can "silently wrap the offset, resulting in an incorrect branch target" ([fix e61df1b454](https://github.com/bytecodealliance/wasmtime/commit/e61df1b454)). The advisory says "All versions of Wasmtime/Cranelift that support aarch64, since the initial release of that support in 2020 … are affected". | Only if the theorem reaches the byte encoder, with immediate-range constraints in the ISA model. T02's pipeline does end at bytes. | No |
| Four more: CVE-2026-115384 (critical: component-model async callback, native stack overflow) and three high-severity WASI filesystem issues (two escapes, one permission bypass) | Runtime: component model and WASI | Host-side validation and path handling | **No** | No |

**Conditions on every “Yes” in the table (I).** These are coverage arguments about a proposed theorem, not four reproduced fixes or checked proofs. The theorem must cover the executable compiler implementation (including bounded data structures), the emitted bytes and encoder, bit-exact ISA semantics, and the loader/runtime contract actually used. A proof over an ideal IR or instruction AST can miss implementation bugs; an incorrect model or unmet ABI premise also defeats the inference. Functional equivalence of the in-bounds memory alone is not a sandbox-isolation theorem: accesses and writes outside the sandbox need an explicit safety/frame property. The recovered experiment in §3.2 does not establish this production-level coverage.

**What the incumbents say (Q/F)**

- **The Bytecode Alliance**, 2026-04-09 ([post](https://bytecodealliance.org/articles/wasmtime-security-advisories)):
  - "11 of these 12 advisories were discovered by the Wasmtime team using new LLM-based tools."
  - The April batch alone "doubles the number of Critical severity advisories published in the project's history".
  - "There is no continuous fuzzing of either Cranelift or Winch on aarch64 at this time, which is a significant shortcoming." The post says this is largely because oss-fuzz has no aarch64 runners.
- **Fastly**, 2021, by Hickey, Fallin and Escandor-O'Keefe ([post](https://www.fastly.com/blog/how-we-vetted-cranelift-for-secure-sandboxing-in-compute-edge)): "any miscompilation is a serious issue"; "it is important to verify that the machine code is a correct translation of the original WebAssembly with inserted sandboxing checks."
- **The attacker side**, from Simon Willison on Project Glasswing, 2026-04-07 ([post](https://simonwillison.net/2026/Apr/7/project-glasswing/)): Claude Mythos Preview "wrote a web browser exploit that chained together four vulnerabilities, writing a complex JIT heap spray that escaped both renderer and OS sandboxes."

**What this means (I)**

- **This is the best value evidence for Lemma.**
  - The bug class is real and critical: the two April compiler advisories are CVSS 9.0, while the two October compiler advisories are CVSS 9.9. Two of the four are AArch64-only, Lemma's target.
  - It is being mined by models.
  - **3 of the 4 compiler criticals sit where partial verification does not reach:**
    - a baseline compiler;
    - an IR data structure;
    - byte-level emission.

    An end-to-end theorem is the differentiator, not "verified" alone.
- **Two limits.**
  1. **Half of the severe 2026 issues are in the runtime**, which Lemma does not touch.
  2. **The project itself says x86-64 is "the backend most used in production systems".** AArch64 is the under-tested target, not the main one.

### 1.2 Who would use it if it worked

| Segment | Evidence of pain | Would they run Lemma? (I) | How much it is worth to them (E) |
|---|---|---|---|
| **Wasm runtime vendors** (Fastly, Akamai, F5, Mozilla, Shopify, Microsoft) | The table above. A 3-week LLM sprint in April with "diminishing returns after the end of the first week" (F, BA post). Plan: "all changes to Cranelift's lowering rules will be verified as part of CI checks" (Q/F). | **No, not as a product.** They need a Rust compiler that is wired into Wasmtime's runtime ABI (traps, libcalls, fuel and epochs, GC stack maps, the component model), compiles in JIT time, and is fast on x86-64. They might take the semantics, the encoder lesson and the proof patterns. | They care a lot about the problem: the April sprint drew named engineers from Akamai, Mozilla, UCSD and F5 for 3 weeks (F). But their care goes into Cranelift, so Lemma's value to them is indirect: citations and maybe one borrowed idea, not adoption. |
| **Embedders who interpret for safety today** (Stellar Soroban on wasmi; Mimik in the Windows kernel on Pulley; chains on singlepass) | **Stellar** ([blog](https://stellar.org/blog/developers/why-doesnt-soroban-use-a-jit)): "Every JIT that has ever shipped has had multiple critical vulnerabilities of this sort." It chose an "extremely simple 13k lines of code" interpreter. **Mimik** (`p3-40` [05:00]): "you cannot do just-in-time compilation. So, instead, we decided to interpret"; interpretation was "about a magnitude slower than WASM-time with JIT"; and at [12:00] "the main problem that we have to deal with is the performance" (Q). | **The best fit.** A proven ahead-of-time compiler at 1.5–2× Cranelift would still be about 4–5× faster than an interpreter (E; see the measurement below the table). But each user needs things outside Lemma's theorem: gas or fuel metering, bounded compile time ("JIT bombs", Stellar), NaN determinism, and code-signing policy (Mimik's kernel modules must be "vetted and signed by Microsoft"). | Real but small: a handful of organisations, each high-stakes. Stellar's own condition for revisiting its choice is "as that codebase matures". Winch, the codebase it means, had a critical escape in April 2026 (F). |
| **Chains that compile Wasm to native inside validators** (Arbitrum Stylus, CosmWasm, NEAR) | **Arbitrum:** at activation "the WASM compiles down to a node's native machine code (e.g., ARM or x86)", using a Wasmer fork ([docs](https://docs.arbitrum.io/stylus/concepts/how-it-works)). **The money case for verified compilers is crypto.** Paradigm's [Solidus](https://www.paradigm.xyz/writing/solidus) (2026-07-24) is a verified Yul→EVM backend. Its motivation was "a $50+ million hack in July 2023 linked to a Vyper compiler bug". | **Maybe,** if Lemma covers x86-64 and gas metering. But Paradigm's response shows how they would act: **grow their own** (~1,700 Codex hours, ~$150k, "no human wrote or read code directly"). | High per user. Only a few users, and they can afford to regrow the artifact themselves. |
| **Safety-critical buyers** (CompCert's market) | CompCert is sold commercially by AbsInt (since 2014) and used by Airbus and by MTU for nuclear emergency generators ([AbsInt](https://www.absint.com/success.htm), [MTU paper](https://www.absint.com/compcert/mtu_compcert_erts_2018.pdf)). | Not today. These users don't ship Wasm (I). Qualification kits and certification evidence would be a separate multi-year project. | Speculative |
| **AI-agent sandboxes** (T02's "Code Mode scripts") | Code Mode runs agent code in **V8 isolates** through the Dynamic Worker Loader, not in ahead-of-time-compiled Wasm ([Cloudflare](https://blog.cloudflare.com/dynamic-workers)). Other agent sandboxes in the corpus are containers or microVMs: Cloudflare's Sandbox SDK (`83`) and NVIDIA OpenShell (`84`). | Mostly no. **T02's link from Lemma to agent sandboxes is weak; drop it from the pitch.** The same goes for Wasm on Workers generally. Ramp's Ferrisway is "built in Rust, compiled in uh WebAssembly" and handles "about half a billion requests daily" (Q, `connect26/10` [14:00]), but it runs inside V8, a JIT world Lemma does not enter. | Low |
| **Formal-methods community and AI labs** | Verification benchmarks are saturating: Claude Code reaches "98.1%" end to end on CLEVER, counting entries with self-consistent premises ([arXiv 2605.23772](https://arxiv.org/abs/2605.23772)). Labs fund verifiable long-horizon environments: Anthropic "discussed spending over $1 billion on RL environments", at "$200-$2,000 per task" ([Epoch, Jan 2026](https://epoch.ai/gradient-updates/state-of-rl-envs)). | Yes, as a **benchmark or environment** with a hard gate (proof) and a graded score (speed). | Real money, but a different business from "a better compiler" |

**The interpreter penalty, measured locally (F).** One memory-bound load/xor/shift/store kernel (1 MiB, 1,000 rounds), best of 3, on the M4 Pro with Wasmtime 49.0.3:

| Engine | Time | Relative to Cranelift |
|---|---|---|
| Cranelift | 0.81 s | 1× |
| Winch (baseline compiler) | 2.51 s | 3.1× |
| Pulley (interpreter) | 6.36 s | 7.8× |

This is one kernel, so treat it as indicative (E). It is consistent with Mimik's "about a magnitude". A proven compiler at 1.5–2× Cranelift would sit between Cranelift and Winch.

### 1.3 How much does "proven" add over "fuzzed and partly verified"? (F/I)

**Historical evidence that proofs work**

- Csmith (PLDI 2011) spent about six CPU-years trying to find wrong-code bugs in CompCert and found none in its verified middle end. It found more than 325 bugs in GCC and LLVM. The authors wrote: "The striking thing about our CompCert results is that the middle-end bugs we found in all other compilers are absent." It did find bugs in CompCert's *unproved* parts ([preprint](https://www-old.cs.utah.edu/~regehr/papers/pldi11-preprint.pdf)).
- **The lesson matches 2026 (I):** the bugs live wherever the proof stops.

**The price of proof, historically**

| Compiler | Code speed | Assurance and effort |
|---|---|---|
| Cranelift | About 2% slower than V8 TurboFan and about 14% slower than LLVM (WAVM) ([README](https://github.com/bytecodealliance/wasmtime/blob/main/cranelift/README.md), citing [arXiv 2011.13127](https://arxiv.org/abs/2011.13127)) | Fuzzed and partly verified |
| CompCert, mature | About 10%, 15% and 20% slower than GCC at -O1, -O2 and -O3 ([compcert.org](https://compcert.org/compcert-C.html)) | Decades of human proof |
| vWasm (F*, proves sandbox safety, not correctness) | 3.5–7.5× slower than the other compilers; 2–3× faster than interpreters | About **two person-years** ([USENIX Sec '22](https://www.usenix.org/conference/usenixsecurity22/presentation/bosamiya)) |
| rWasm | Within 3–26% of Wasmtime | Provable *safety* in **one person-month**, by compiling Wasm to safe Rust and trusting rustc (same paper) |

**Implications (I)**

- **If the goal is isolation only,** cheap routes exist: rWasm-style compilation, guard pages and memory protection keys. Lemma's distinctive value is **functional correctness end to end**: the right answer, not merely staying inside the box.
- **Functional correctness matters most where a wrong answer costs money even inside the sandbox.** That means consensus and settlement (blockchains) and control software.
  - That is where 2026's money went: Solidus was motivated by a compiler bug linked to a $50M+ loss (F).
  - But the target there is EVM (and RISC-V for zkVMs), not Wasm on AArch64.
- **That is a smaller market than "every Wasm host".**

---

## 2. The tailwind: steelman, then attack

### Steelman (F/Q)

1. **Proof volume is no longer the constraint.**
   - **FLT (Sep 2026):** Anthropic reports that "a general-purpose internal research model roughly comparable to Claude Fable 5.1" produced "the first complete computer-checked proof of Fermat's Last Theorem":
     - about **13 million lines of Lean**;
     - **11 days** of wall-clock time;
     - "about six billion output tokens";
     - only "Lean's three standard axioms" ([Anthropic](https://www.anthropic.com/research/formalizing-fermats-last-theorem)).
   - **Axon (May–Jul 2026):** a verified compiler for a toy language, built by Claude Code (Opus 4.6/4.7) in 34 days with one supervisor ([arXiv 2605.01660](https://arxiv.org/abs/2605.01660)).
   - **EquiVM (Jul–Oct 2026):** agents proved that the bytecode of 35 production EVM contracts (Safe, Morpho, Compound, Uniswap) refines a high-level spec ([arXiv 2607.26306](https://arxiv.org/abs/2607.26306)).
2. **Demand rises with model capability, too.**
   - Unverified compilers are being mined by models: 11 of 12 Wasmtime advisories in April came from LLM tools, and Mythos writes JIT exploit chains.
   - Each release raises the expected cost of *not* having a proof. **This is a tailwind T02 did not claim, and it is the strongest one (I).**
3. **De Moura on cost** (Q, `p3-45` [0:11:00]): "At AWS, we have been using formal verification for a decade, but only for the super safety critical components because it's expensive until now, right? With AI, it changes the game."
   - At [0:33:00–0:34:00] he adds that labs "only start training for formal verification lean very recently… The behavior we see today that is already amazing will get way better in the future."
4. **The performance gate blocks the observed failure mode.**
   - Rinard measured this on Axon: "to enhance provability, the coding agent chose less efficient data structures and algorithms for the full verification implementations" (Q/F, [arXiv 2605.01660](https://arxiv.org/abs/2605.01660)).
   - Lemma's gate refuses a pass unless it moves the benchmark.
   - **The same paragraph also cuts against Lemma's design (F/I):**
     - fully verified optimisations "required substantially more engineering effort" than certificate-checked ones;
     - the certificate-checked versions "are often faster".

     "Every speedup is a theorem" is the expensive route. A hybrid design (prove the checker, validate each pass) would grow faster.

### Attack (Q/F/I)

1. **"The model just writes it on demand." This is the real threat.**
   - **A Nerd Snipe host** (Q, `14` [1:13:00]; Theo Browne or Ben Davis, since the speaker turns in the captions are unlabelled): "anything with a verifier function is solvable right now." **Lemma is, by construction, a verifier function** (Lean, plus the spec tests, plus a benchmark).
   - **The same hosts** (Q, `14` [1:39:00–1:40:00]): "what is the moat in a lot of software? Like if you can just grind down the Rust compiler like that, what the hell is next?"; "LLVM might be a target soon… It's viable and Obus could probably do it. Fable 55 [sic] almost certainly can do it."
   - **Scale (I):** FLT is about 13M lines in 11 days. A proven Wasm compiler is about 0.05–0.2M lines (E; Axon's is 38k).
   - **It has already happened for a production target (F).** Paradigm's [Solidus](https://www.paradigm.xyz/writing/solidus) is a Lean Yul→EVM backend, proven to preserve outputs for all inputs. It was built with GPT-5.6 and Codex, Harmonic's Aristotle and Claude Fable 5, over about 1,700 /goal hours (~10 weeks, ~$150k at API rates). "No human wrote or read code directly."
     - It emits "almost 3x as much bytecode as solc".
     - It runs a public "Compiler Optimization" challenge for faster code "while preserving the existing correctness proof". **That is Lemma's ratchet, for the EVM.**
     - It is a single organisation's one-quarter project. The design is not scarce.
   - **The consequence (I):**
     - Better models may lower replacement costs; neither a rate nor a year-1 reproduction time is measured here.
     - The ratchet can accumulate quality even if its scarcity declines.
     - T02 says a next model cannot produce "months of accumulated proven passes measured on a real corpus against a production compiler". That is the weakest claim in the pitch.
2. **The incumbent gets the same tailwind.**
   - Cranelift's team already turned models into a bug-hunting sprint and is moving rule verification into CI.
   - The models that make Lemma's proofs cheap will make proofs about Cranelift cheaper too. That means more rule verification, and possibly translation validation of its output (T02 cites ongoing work, [WAW 2025](https://popl25.sigplan.org/details/waw-2025-papers/9/Full-Stack-Correctness-in-Wasm-Eliminating-Bugs-Inside-and-Outside-the-Sandbox)).
   - The gap Lemma exploits closes from the other side (I).
3. **Proving each binary may beat proving the compiler.**
   - EquiVM proves deployed bytecode "independently of the compiler that produced it", and repaired proofs after compiler changes in "a fraction of the original time" (F).
   - If proofs keep getting cheaper, high-value users can keep LLVM or Cranelift **and** have a proof per binary.
   - Lemma's performance gap then buys nothing. The exception is high-volume hosting, where proving every module is too expensive (I).
4. **What does *not* improve with models is trust in the theorem statement.**
   - **De Moura** (Q, `p3-45` [0:20:00]): "how do you know that when you exported it's really theorem it's not 2 plus 2 equals four".
   - **De Moura again** (Q, [1:03:00–1:04:00]): in software verification "these statements are big … but the proofs are shallow".
   - **(I)** The durable human contribution is the Wasm and AArch64 models and their validation. But these are **borrowable**:
     - WasmCert exists (Rocq). SpecTec has no Lean backend on `main` (checked via the GitHub API).
     - AWS's [LNSym](https://reservoir.lean-lang.org/@leanprover/lnsym) is a Lean Armv8 model with randomized conformance tests against real hardware, last commit December 2024.

     So the trusted base is not a moat either.
5. **The market extends trust without proofs.**
   - **Mattis** (Q, `22` [1:28:00]): "we're materially going to stop looking at the code in the same way that we don't look at assembly anymore." The interviewer: "We trust the compiler to produce pretty good assembly."
   - **Theo** (Q, `88` [00:00]) shipped an AI-written TypeScript compiler: "I have not read a single line of code." He reports "over 50,000 downloads" (`14` [1:38:00]).
   - **(I)** Users adopt compilers that are tested and widely used, not proven. In the market, proof is a tie-breaker, not the reason to adopt.

### Net (I)

**Capability is a plausible strong tailwind (I).** Better models may prove more, faster; improvement is not automatic for every release.

**Demand is a moderate tailwind.** AI attackers make proofs worth more.

**Defensibility may face a headwind (I).** Incumbents and other builders get the same models. How much this lowers the cost of rebuilding the complete artifact remains unmeasured.

**Compared with GrowOS (I).** GrowOS's grown kernel *runs your program*: its value is the running system and the oracle-checked process. Lemma's grown artifact is a theorem plus code whose value depends on someone relying on it.

**To the brief's question,** "does the next model make this better or pointless?": **better as an artifact, less special as a project.**

---

## 3. The one-shot test, concretely

### 3.1 The one prompt

The brief's test is: "A model one or two generations ahead, given the idea in one prompt, cannot just produce the finished value." Below is a hypothetical full-scope prompt, not the smaller experimental prompt in §3.2, written in the form Theo used for TS-Rust (`88`: "the slash goal of complete the port, get as close as possible to 100% compatibility … and then also improve performance"):

> /goal Build a WebAssembly→AArch64 compiler in Lean 4 with an end-to-end semantic-preservation theorem (traps, results, memory) against an executable Wasm semantics that passes the official `.wast` suite and an AArch64 model admitted only after randomized differential testing on this Mac. No `sorry`, no axioms beyond the two models. Then make it fast: grow register allocation, CSE, LICM and bounds-check elimination, each promoted only with its proof and a measured speedup vs Wasmtime. Run parallel agents; don't stop.

### 3.2 Closed experiment: recoverable restricted proofs; session-limit interruption (F, audited 2026-10-29)

**Setup**

- **Protocol:** one initial prompt per model, autonomous editing and repeated Lean checks, no human repair, with a planned 75-minute cap. Lean 4.35.0, core/Std only (no Mathlib), on the builder's M4 Pro. This is an agent session, not a single generated completion.
- **Models:** Claude Fable 5.1 and Claude Opus 5.5.
- **Requested scope ("Tier A"):** a model of an early lowering step; actual coverage is audited below.
  - **Wasm side:** i32 arithmetic, logic and shifts (counts mod 32), comparisons, locals, `select`, and `i32.load`/`i32.store` with the spec's 33-bit effective-address rule and trap.
  - **AArch64 side:** 64-bit X registers in which W-form ops zero-extend (the exact invariant behind CVE-2026-34987), and explicit compare-and-branch bounds checks that *can* compute a wrong address.
  - **Requirements:** an end-to-end `compile_correct` theorem covering traps, and `#print axioms` showing at most the three standard axioms.
- **Stretch goals:** Tier B (structured control flow) and Tier C (an optimisation pass with its own proof).
- **Closure audit:** compiled the existing files below unchanged with `lean-oneshot/elan/toolchains/leanprover--lean4---v4.35.0/bin/lean <file>` from each file's directory. Lean reports version 4.35.0, commit `eb6cafb7290e8bd5f2937522d8d804f58f02bafc`. Inspected theorem premises, validators, memory relations and forbidden constructs. No proof repair or new generation was performed.

**Recovered results (F).** Paths below are relative to scratch `/Users/noah/.t3/scratch/2026-10-28-here-are-the-absolute-paths-a63c3f1b/`.

| Saved artifact | Lines | Independent check | What is established |
|---|---:|---|---|
| `lean-oneshot/exp/fable/Lemma_tierA.bak` | 888 | Exit 0; `WasmA64.compile_correct` has `[propext, Classical.choice, Quot.sound]` | Restricted straight-line Tier A model theorem; matching normal/trap smoke examples |
| `lean-oneshot/exp/fable/Lemma.lean` | 1,041 | Exit 1; rewrite errors at lines 924 and 928; `compileOpt_correct` includes `sorryAx` | The base theorem still prints clean axioms, but the constant-folding extension is **not verified** |
| `lean-oneshot/exp/opus/Lemma.lean` | 1,509 | Exit 0; `Compiler.compile_correct` has `[propext, Classical.choice, Quot.sound]` | Tier A plus restricted `block`/`loop`/`br`/`br_if` model theorem (Tier B) |
| `lean-oneshot/exp/opus/LemmaC.lean` | 1,657 | Exit 0; same three axioms for `Compiler.compile_correct` | Optimised and unoptimised variants covered by the `opt : Bool` theorem; instruction-selection peepholes (Tier C) |

No literal `sorry`/`admit`, new axiom declaration, `native_decide`, `implemented_by`, `extern`, `unsafe`, `partial def` or `opaque` was found in these four artifacts. **That text scan alone is insufficient:** Lean's error recovery introduced `sorryAx` in the failing Fable extension. Its printed theorem is not an accepted proof. The saved `verify/opus-tierA/LemmaA.lean` is byte-identical to `opus/LemmaA_backup.lean`; it and the other intermediate fragments were inventoried, not separately certified by this audit.

**Measured only in the Opus model (F):** `LemmaC.lean` prints static instruction counts **76→62** for the straight-line sample and **29→25** for the loop sample; the loop at `n=8` takes **233→201 model steps**. Its 12 straight-line and six loop comparisons print all `true` (the loop is also checked unoptimised). These are finite smoke checks and model counts, **not hardware timings or a speedup against Cranelift**.

**Theorem scope matters (F/I).** Opus's `compile_correct (opt : Bool) ... (fuel : Nat)` says that a validated source run ending normally reaches related target state, and a source trap reaches a target trap with related linear memory. Its timeout branch is `True`: it does not prove divergence equivalence or a runtime bound. It permits at most **16 stack slots and 8 locals**, memory size **≤2³²**, a nonwrapping placement of memory in the 64-bit address space, and a restricted control-flow validator (empty block/loop stack effects). Fable's base permits **16 stack slots and 10 locals**; on traps it returns `none`, so it does not retain or relate the memory state at the trap. Both use custom executable instruction models. Neither parses real Wasm, emits AArch64 bytes, proves an encoder/loader/runtime ABI, passes the official Wasm suite, validates its ISA against hardware, or states a full outside-memory frame property. Fable's register model is `Nat`-indexed; Opus uses `Fin 31`. Bit-vector arithmetic in these models is not itself evidence that their ISA definitions match silicon.

**Disposition: closed as interrupted, with recoverable partial success.** The historical experiment threads end with a session-limit message (Fable explicitly HTTP 429); neither supplied a completed timed final report. There is no certified 75-minute end-to-end score, elapsed-time comparison or model ranking. Existing artifacts do demonstrate prompt-launched agents producing restricted checked compilers and, for Opus, a checked peephole optimisation. They do **not** reproduce the six-week Lemma scope or settle the brief's finished-value one-shot test. The interruption is not a model capability failure.

**Artifact identity (SHA-256 prefixes):** Fable base `e1c8e41b8df7`, Fable extension `b55d71be9b8e`, Opus B `019700156465`, Opus C `9d8c8314107d`. Check logs are `/tmp/d4-fable-A-audit.log`, `/tmp/d4-fable-audit.log`, `/tmp/d4-opus-audit.log` and `/tmp/d4-opus-C-audit.log` on this machine.

### 3.3 Extrapolation (E/I; not measured probabilities)

The historical projects cited here are calibration examples, not matched one-shot trials. Line counts and multi-week supervised runs do not estimate the probability of producing a complete production compiler from one prompt.

| Scope | Forecast, conditional on stronger tools/models | Evidence and limit |
|---|---|---|
| Restricted integer model compiler | Reproduction looks plausible | §3.2 recovers checked toy-subset proofs; full Wasm semantics and bytes are absent |
| Register allocation, CSE, LICM and bounds-check elimination at ≤2× Cranelift | Plausible but unmeasured | Axon and Solidus show substantial agent-assisted work; the local run measures only small peepholes, with no Cranelift benchmark |
| Floats, SIMD and near-Cranelift speed | Uncertain | Proof volume alone says little about bit-exact models, coverage or performance engineering |
| Third-party trust and reference status | A prompt cannot confer adoption or an elapsed track record | Review and validation can be accelerated, but their outcome depends on evidence and other people |

**What the one-shot test establishes (I).** The restricted successes weaken a claim that even the early lowering/proof work is inherently scarce. They do not establish that accumulated production passes, validated semantics or benchmark quality can be regrown in weeks. Trust and track record may be durable assets, but this experiment does not show that they are the *only* durable assets. The finished-value one-shot claim remains unresolved.

**Scope/licence cross-check (F/I).** D3 places the opening at Wasm→IR plus the growth/performance loop; clifv already supplies a nearby backend, and LNSym supplies a hardware-tested Arm model. A bounded recheck of [clifv's root](https://github.com/eth-act/clifv) still found no root LICENSE and GitHub reported `license: null` (licence endpoint HTTP 404). That is not a full file-level licence audit and does not transfer LNSym's licence to clifv. Reuse availability must be established before relying on D3's shorter build estimate. No fresh prior-art sweep was performed.

---

## 4. Realistic ceiling (E)

**Calibration points (F)**

| Project | Effort | What it reached |
|---|---|---|
| Axon | 34 days, one supervisor | A toy language at 2.18× gfortran -O2. Float semantics were taken as axioms, and the ARM model covers only the instructions the compiler uses. |
| vWasm | About 2 person-years | Safety only, at 3.5–7.5× slower than other compilers |
| CompCert, first version | About 2 person-years and 38k lines (per Axon's related-work section) | Today, 10–20% behind GCC |
| Solidus (Paradigm, 2026) | About 10 weeks of agent /goal time (~1,700 hours, ~$150k), no human-written code | A proven Yul→EVM backend at about 3× solc's bytecode size. The front end is not built yet. |

**The two horizons**

| | **1 year, solo, with frontier agents** | **3 years** |
|---|---|---|
| **Wasm coverage** | Wasm 2.0 scalar core: i32, i64, f32 and f64; full control including `br_table` and `call_indirect`; tables; bulk memory. Optional: memory64. **No** SIMD, threads, GC or exceptions. | Adds SIMD (v128), memory64, tail calls and exceptions. GC is unlikely. A second backend (x86-64) is likely needed for relevance. |
| **Spec tests** | 100% of the in-scope `.wast` files | 100% of Wasm 2.0 and the chosen parts of 3.0 |
| **Speed versus Cranelift** (PolyBench, CoreMark, a Lua or SQLite build) | 1.3–2× slower (geomean) | 1.1–1.5× slower. Some loop kernels could beat it through proven bounds-check elimination and LICM, because an ahead-of-time compiler can afford optimisations Cranelift skips. |
| **Trusted computing base** | The Lean kernel, the Wasm model, the AArch64 model (with an IEEE-754 model shared by both) and a small loader. The runtime and WASI are *not* covered. | The same, plus a second ISA model. Possibly a partly verified minimal runtime. |
| **Users** | 0–2 experiments | 1–5 niche users (consensus, kernel or embedded), or the ideas absorbed into Cranelift |
| **Risk to the ceiling** | Floats: a bit-level IEEE-754 model and NaN non-determinism. Axon simply took float equivalence as an axiom. | Lower reproduction costs are a risk, with no measured time bound. Validated semantics, benchmark quality, gate history and reference status may remain distinctive. |

**The likely shape at three years (I):** an excellent research artifact, two or three papers, and a reusable semantics. It is not infrastructure that many people run.

---

## 5. The most impressive 6-week demo, and the sceptic

### The demo (better than T02's "overnight chart")

**Proposed demo: "Reject four historical compiler-bug patterns under a stated end-to-end contract."** This is a demo plan, not an outcome of §3.2; all four require coverage beyond the recovered artifacts.

1. **Show each escape is real.** On the Mac, run proof-of-concept modules for the AArch64-reachable advisories against Wasmtime 42.0.1, which is affected by all four.
   - Each escapes the sandbox or miscompiles.
   - The fixes ship regression tests to start from, e.g. `tests/all/br_table.rs` in commit e61df1b454 (F).
   - **Note (F):** the Homebrew Wasmtime on the builder's Mac is 49.0.3, built 2026-10-14. That predates the 49.0.4 fix for CVE-2026-115893, so the AArch64 `br_table` case should reproduce on the machine as installed (I, not attempted). Upgrading is advisable anyway.
2. **Show Lemma handles them.** Run the same modules through Lemma: correct result, or a trap exactly where the spec puts it.
3. **Plant each bug in the executable implementation and encoder covered by the theorem**, and require the unchanged, independently validated specification to reject it:
   - the shift-mask pattern (CVE-2026-34971; needs memory64 in scope);
   - the zero-extension assumption (CVE-2026-34987);
   - a 19-bit branch offset without a range check (CVE-2026-115893);
   - a truncated IR index (CVE-2026-115889).
4. **Add T02's two charts:**
   - CoreMark speed rising as proofs land;
   - the same work queue replayed with an older model, where fewer passes land.

**Why this beats the speed chart (I):** it ties the artifact to this year's CVSS 9.9 incidents, which a stranger understands. "Gets faster every model" alone invites the answer "still slower than Cranelift".

### What a sceptical expert would say

Imagine a Cranelift maintainer or a CompCert veteran.

1. **"That's hindsight. You wrote the ISA model after reading the advisories. Show me a bug you didn't know about."**
   - *Fair.* The answer is to run the gate against held-out mutants and differential fuzzing against Wasmtime, and to report anything Lemma finds in Cranelift.
2. **"Your TCB moved. You trust two models you wrote. Axon's machine model was agent-written and took floats as axioms."**
   - *Fair.* That is why the semantics must be validated against silicon and the spec suite. Even so, it is never zero.
3. **"Half of this year's severe advisories were in WASI and the component model, which you don't touch. Spectre is out of scope too."**
   - *True.* A completed theorem would cover only its stated compiler subset and runtime assumptions.
4. **"We already catch the lowering-rule class in CI. You're 1.5–2× slower. vWasm proved safety in 2022 and nobody runs it."**
   - *Largely true.* I found no production vWasm user (I).
   - *Partly answerable:* the other three classes are the point of end-to-end proof.
5. **"Your theorem says nothing about compile time. A quadratic pass is a JIT bomb."**
   - *True.* It needs either a proven complexity bound or a fuel-bounded compiler.
6. **"CoreMark isn't a workload."**
   - *Fair.* Add a Lua interpreter, SQLite or QuickJS compiled to Wasm.
7. **From the AI side: "Paradigm grew a proven EVM backend in a quarter without writing code, and runs a proof-preserving optimisation contest. What is special about yours?"**
   - *Fair.* The shape is not the asset. Only the Wasm/AArch64 instance, its trusted models and its track record are.

---

## 6. Is the value real without users?

| Kind of value | Real without users? | Why (I) |
|---|---|---|
| Security impact | **No** | A theorem protects only code that runs through the compiler |
| Research artifact (end-to-end proven, model-grown, real spec suite) | **Yes** | Publishable. It also demonstrates the gate shape that T04 and T07 reuse. |
| Public good: validated Lean Wasm and AArch64 semantics | **Yes** | Reusable by others' proofs, including EquiVM-style proofs per binary and Cranelift's verification |
| A benchmark or verifiable environment for model capability | **Yes** | A hard gate (proof) plus a graded score (speed) on a long-horizon systems task. Labs buy environments like this. |

**Net (I).** The value is real without users in the research and benchmark sense. Its headline value (safer Wasm hosting) needs users, and the users who feel that pain most will not switch. That is the difference from GrowOS, where the artifact *is* the running system.

---

## 7. What would raise the value (I; brief, for the builder)

1. **Change the pitch.**
   - From: "faster with every model".
   - To: "a Wasm compiler with a checked preservation and isolation contract down to emitted bytes, for an explicit subset and runtime ABI".
   - Speed is a constraint to meet, not the value proposition.
2. **Aim at the users who interpret for safety.** Prove the extras they need:
   - metering;
   - a bound on compile time;
   - NaN determinism.

   This is the only segment that would plausibly *run* Lemma.
3. **Consider a verified *validator* alongside the compiler.**
   - What it is: a Lean-checked validator for Cranelift's aarch64 output, function by function, with models writing the hints.
   - Why: incumbents can adopt a validator without replacing their compiler.
   - **Caveat (F):** the *isolation-only* version of this is the incumbent's own work in progress. Chris Fallin's WAW 2025 keynote describes "work-in progress results on translation validation via proof-carrying code" aimed at sandbox isolation in Wasmtime ([WAW 2025](https://popl25.sigplan.org/details/waw-2025-papers/9/Full-Stack-Correctness-in-Wasm-Eliminating-Bugs-Inside-and-Outside-the-Sandbox)).
   - What looks less covered is a *functional-correctness* validator (I). The GAPS report should confirm.
4. **Plan x86-64 by year 2.** The production weight is there.

---

## 8. Verdict: **Real but narrow**

**Main reason.** The pain is real and growing. Four critical compiler escapes hit Wasmtime in 2026, and models now find them. An end-to-end theorem could reach three bug classes beyond lowering-rule verification, conditional on implementation, byte-level and runtime coverage.

The value stays narrow because:
- the main sufferers are fixing it inside Cranelift, and they get the same model tailwind;
- only a small set of interpreter-bound embedders would run Lemma;
- model progress may lower reproduction costs. Paradigm is evidence of an agent-built backend in another domain, not a measurement of one-shot Lemma reproduction.

The tailwind claim is half true: **better artifact, weaker moat**.

---

## TL;DR

1. **The pain is real.** Wasmtime had 4 critical compiler escapes in 2026 (two AArch64-only), against 2 in 2021–25. LLM tools found 11 of April's 12 advisories, so models make unverified compilers more dangerous.
2. **The differentiator is end to end.** Rule verification addresses one cited compiler class; a theorem covering the executable implementation, emitted bytes, bit-exact semantics and runtime contract could exclude all four in-scope patterns. No such complete theorem was recovered here; runtime issues remain outside scope.
3. **Who would run it:** a small set of embedders who interpret Wasm for safety today (Soroban, kernel Wasm, chains). Not the vendors, and not agent sandboxes, which use V8 isolates.
4. **The one-shot run is closed with partial success and a session-limit interruption.** Opus's restricted model compiler and peepholes check; Fable's base checks but its optimisation does not. Full Lemma one-shotability and future regrowth time remain unmeasured.
5. **Verdict: Real but narrow.** Pitch explicit end-to-end assurance for interpreter-bound embedders. A complete one-prompt reproduction would weaken the accumulation thesis, but these interrupted toy-scope runs do not meet that threshold.

---

## Sources

**Transcripts** (checked against the line)

| File | Speaker | Timestamps |
|---|---|---|
| `p3-45` | de Moura | [0:11:00], [0:20:00], [0:33:00–0:34:00], [1:02:00–1:04:00] |
| `14` | Theo Browne and Ben Davis | [1:13:00], [1:39:00–1:40:00] |
| `88` | Theo | [00:00], [21:00] |
| `p3-36` | Feldman | [1:23:00–1:24:00] |
| `p3-19` | Omar | [0:42:00] |
| `22` | Mattis | [1:28:00] |
| `p3-40` | Katychev and Saghafi (Mimik) | [05:00], [12:00–13:00] |
| `48` | Cloudflare Code Mode | — |

**Wasmtime and Cranelift**

- [The full advisory list](https://github.com/bytecodealliance/wasmtime/security/advisories) (GitHub API, 81 advisories).
- [GHSA-jhxm-h53p-jm7w](https://github.com/bytecodealliance/wasmtime/security/advisories/GHSA-jhxm-h53p-jm7w), [GHSA-xx5w-cvp6-jv83](https://github.com/bytecodealliance/wasmtime/security/advisories/GHSA-xx5w-cvp6-jv83), [GHSA-897f-g5gm-fmxm](https://github.com/bytecodealliance/wasmtime/security/advisories/GHSA-897f-g5gm-fmxm) and [GHSA-mghf-wjfp-p5xm](https://github.com/bytecodealliance/wasmtime/security/advisories/GHSA-mghf-wjfp-p5xm).
- [Fix commit e61df1b454](https://github.com/bytecodealliance/wasmtime/commit/e61df1b454).
- [The Bytecode Alliance's April 9, 2026 post](https://bytecodealliance.org/articles/wasmtime-security-advisories).
- [Fastly, 2021](https://www.fastly.com/blog/how-we-vetted-cranelift-for-secure-sandboxing-in-compute-edge).
- [The Cranelift README](https://github.com/bytecodealliance/wasmtime/blob/main/cranelift/README.md).

**Demand and alternatives**

- [Stellar: why Soroban doesn't use a JIT](https://stellar.org/blog/developers/why-doesnt-soroban-use-a-jit).
- [vWasm and rWasm, USENIX Security 2022](https://www.usenix.org/conference/usenixsecurity22/presentation/bosamiya).
- [Cloudflare Dynamic Workers](https://blog.cloudflare.com/dynamic-workers).
- [AbsInt success stories](https://www.absint.com/success.htm) and [the MTU paper](https://www.absint.com/compcert/mtu_compcert_erts_2018.pdf).
- [CompCert performance](https://compcert.org/compcert-C.html).
- [Csmith, PLDI 2011](https://www-old.cs.utah.edu/~regehr/papers/pldi11-preprint.pdf).
- [Epoch AI on RL environments](https://epoch.ai/gradient-updates/state-of-rl-envs).

**Tailwind**

- [Paradigm, Solidus (2026-07-24)](https://www.paradigm.xyz/writing/solidus).
- [Arbitrum Stylus: how it works](https://docs.arbitrum.io/stylus/concepts/how-it-works).
- [Rinard, automated testing and repair for agent-generated verified compilers, arXiv 2607.28928](https://arxiv.org/abs/2607.28928).
- [Anthropic: formalising FLT](https://www.anthropic.com/research/formalizing-fermats-last-theorem).
- [Axon, arXiv 2605.01660](https://arxiv.org/abs/2605.01660).
- [EquiVM, arXiv 2607.26306](https://arxiv.org/abs/2607.26306).
- [Paraskevopoulou, arXiv 2602.20082](https://arxiv.org/abs/2602.20082).
- [Agentic proving on CLEVER, arXiv 2605.23772](https://arxiv.org/abs/2605.23772).
- [Simon Willison on Glasswing](https://simonwillison.net/2026/Apr/7/project-glasswing/).

**Lean and Wasm semantics**

- [LNSym](https://reservoir.lean-lang.org/@leanprover/lnsym).
- [SpecTec, PLDI 2024](https://pldi24.sigplan.org/details/pldi-2024-papers/64/Bringing-the-WebAssembly-Standard-up-to-Speed-with-SpecTec). Its `main` backends are ast, interpreter, latex, prose and splice (GitHub API, 2026-10-29).
