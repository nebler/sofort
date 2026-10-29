# D6: Futamura — VALUE (does it matter?)

Research date: **2026-10-29**. Brief: [`BRIEF-deepdive.md`](../BRIEF-deepdive.md), applied to a third finalist. Source idea: [`tailwind/T02-languages-compilers.md`](../tailwind/T02-languages-compilers.md) §2. Sibling report: [`D4-lemma-value.md`](D4-lemma-value.md) covers the Wasm→AArch64 half, and this report does not repeat it. The original investigation wrote this report; the closure audit edited only D4 and D6, with no commits.

**Labels**

- **Q**: quoted. Transcript quotes are checked against the transcript line. Caption timestamps are minute buckets, and the captions are unedited.
- **F**: sourced, with a link. GitHub data was pulled through the GitHub API on 2026-10-29.
- **I**: inference.
- **E**: estimate.

**Method**

- **Transcripts:**
  - read: Theo/Nerd Snipe (`14`), Feldman (`p3-35`, `p3-36`), de Moura (`p3-45`), Ray Myers (`p3-20`), Omar (`p3-19`), Kernighan (`p3-61`), Mattis (`22`), Lattner (`24`);
  - grepped across the whole corpus for interpreter, DSL, new language, miscompile, smart contract and `native_decide`.
  - **No transcript mentions `native_decide` or verified compilers for smart contracts.** The Lean case rests on web and GitHub evidence.
- **Primary sources:**
  - the Lean 4 issue tracker, every issue that mentions `native_decide` or miscompilation;
  - the Lean source tree at commit `c3bb4fa` (2026-10-29), from which the extern primitives were counted;
  - Rocq's `critical-bugs.md`;
  - Lean RFC #12216 and the Lean FRO roadmaps (Year 3, and Year 4 part 1);
  - the CertiCoq-Wasm paper (CPP '25), read in full;
  - Dima's MPRI report on compiling Lean through Rocq's verified extraction;
  - Basis; Rinard (three papers); Paraskevopoulou; Paradigm's Solidus; EquiVM; Aqueduct; Trail of Bits;
  - Vyper's deep-verification docs and grant news; Csmith; Fiat Cryptography; Jitterbug; MTZK; OPA.
- **An interrupted one-shot experiment, audited 2026-10-29 with GPT-6.1.** Claude Fable 5.1 was given one initial prompt and a planned 75-minute cap to build a closure-converting compiler in core Lean. This probes the pass family Basis left unfinished, at much smaller scope. §5 records recovered code, tests and a failing proof draft. No model-generation run was resumed.

---

## The answer in one paragraph

**As pitched, the idea is Weak.** The pitch is: "write an interpreter, get a proven Wasm compiler, and language N costs less than language 1." **Re-scoped to "trusted execution of Lean's native computations", ideally composed with Lemma, it is Real but narrow.**

**The general pitch has no buyer.**
- **Proven compilers for small languages do get built, and some are widely deployed.** Fiat Cryptography's generated code is in BoringSSL. Vyper suffered a $40–70M miscompile in 2023; the cited $600K grant has a date problem noted in §1.1 and is not counted as awarded funding here. Paradigm grew a proven Yul→EVM backend in ten weeks. Linux merged a verified eBPF JIT. AWS proved its Cedar→SMT compiler in Lean.
- **Every one of them was built by the party holding the stakes, for a target fixed by its platform (C, EVM, native code, SMT), and almost none target Wasm.**
- **For everyone else, "generate a compiler, then differentially test it against the interpreter" is cheaper.** That includes Theo's one-project languages and ordinary DSLs. Models improve that route just as fast.

**Proof reuse across languages is real, but not in the form pitched.** It takes the CakeML/CompCert shape: many front ends compiled into one verified back end. Agents also adapt public proofs to new passes; Claude produced a 7,800-line ANF proof in about 96 hours using an existing CPS proof as its template. So the "pattern library" is helpful but not scarce.

**The one unowned, timely use is Lean's own `native_decide` and `bv_decide`.**
- **The mechanism is ready for a plug-in.** Since Lean 4.29, every native computation is a named axiom.
- **The demand side is moving the same way.** The Lean FRO wants external checking to be routine, and AI-written proofs are driving `bv_decide` usage.
- **The bug record is real.** At least 13 routes from native code to `False` have been reported since 2022, two of them in 2026.
- **But only 4 of the 13 are compiler-pass bugs, and none is in the back end.** All 4 occur before Lean's λRC IR (`Lean.IR`), so T02's "compile λRC" plan would have prevented none of them. The rest are in the C runtime primitives (682 extern symbols) or in unproven `implemented_by`/`@[csimp]` substitutions.
- **To matter, a Futamura for Lean must therefore start from kernel terms and come with proven primitives.** That is a MetaRocq-scale job, not a 6-week demo.

**The tailwind may resemble D4's: a better artifact with lower reproduction costs (I).** A small per-language unit could be easier to reproduce, but §5 does not measure a completed compiler proof or factory. Paradigm's “probably by the end of the year” is a forecast, not evidence of that outcome.

---

## 1. Who would care, and how much

### 1.1 Where proven compilers for small languages actually got built (F)

| Domain | Language → target | The pain | Who built the proof | Status in 2026 | Wasm? |
|---|---|---|---|---|---|
| Crypto arithmetic | Fiat Cryptography DSL → C | Hand-written field arithmetic is error-prone and must run at assembly speed | MIT ([S&P 2019](https://dspace.mit.edu/handle/1721.1/131080)) | Generated code is in BoringSSL ([2017 commit](https://boringssl.googlesource.com/boringssl/+/46304abf7d93f1b386199041440ac4fccf7cb3bb)) and, per MIT, in "several large deployments for Chrome, Android, and CloudFlare" | No |
| Smart contracts | Vyper → EVM | **July 2023:** Vyper 0.2.15, 0.2.16 and 0.3.0 compiled reentrancy locks wrongly, and Curve and other pools were drained of **$40–70M**. Estimates vary by source ([CertiK](https://www.certik.com/resources/blog/2qbPMcyJpR5UfoKrcjWxlQ-vyper-incident-anaylsis), [Hacken](https://hacken.io/discover/curve-finance-liquidity-pools-hack-explained/)). | Verifereum / Vyper team, in HOL4 | The semantics are done. Compiler verification is "in active development" ([Vyper docs](https://docs.vyperlang.org/en/latest/deep-verification.html)). The cited **$600K** grant report places its decision in mid-November 2026, after this report's date ([Crypto Briefing](https://cryptobriefing.com/ethsecurity-round-two-onchain-security/)). The audit could not fetch it (HTTP 403); treat the award/status as unverified, not as funding already awarded on October 29. | No (EVM) |
| Smart contracts | Solidity/Yul → EVM | The same Vyper bug, cited as the motivation | **Paradigm**, Lean; ~1,700 agent-hours, about $150k ([Solidus](https://www.paradigm.xyz/writing/solidus), 2026-07-24) | The backend is proven, but emits "almost 3x as much bytecode as solc". The front end is not built. | No (EVM) |
| Smart contracts | Gallina/ConCert → Wasm (Concordium) | A smaller TCB than ConCert's extraction through Rust | Aarhus ([CertiCoq-Wasm, CPP '25](https://www.cl.cam.ac.uk/~jp622/certicoq-wasm.pdf)) | Deployed one counter contract to testnet. Glue code is hand-adapted per contract. | **Yes** |
| Kernel DSL | eBPF → native JITs | JIT bugs inside the kernel | UW ([Jitterbug, OSDI '20](https://usenix.org/conference/osdi20/presentation/nelson)) | Found 16 bugs in 5 deployed JITs; a verified RV32 JIT was upstreamed into Linux | No |
| Authorization | Cedar policies → SMT | Analysis results that must be sound and complete | **AWS**, in Lean ([SymCert](https://www.amazon.science/publications/symcert-verifying-smt-based-policy-analyses)) | Shipped in `cedar-policy-symcc` | No (SMT) |
| Safety-critical | Lustre → C | DO-178C qualification | Ansys (SCADE KCG, qualified rather than proven); Inria ([Vélus](https://github.com/INRIA/velus), proven, academic) | Commercial / research | No |
| Zero-knowledge | ZoKrates, Noir, Cairo, Leo → circuits | Compiler bugs that change circuit semantics | Testing only: MTZK found 21 bugs, 15 fixed ([NDSS '25](https://www.ndss-symposium.org/ndss-paper/mtzk-testing-and-exploring-bugs-in-zero-knowledge-zk-compilers/)) | No proven compiler | No |
| Authorization | Rego (OPA) → Wasm | The Wasm and interpreter paths disagree: [#3298](https://github.com/open-policy-agent/opa/issues/3298) (2021) and [#6304](https://github.com/open-policy-agent/opa/issues/6304) (2023) are still open | Nobody | A production DSL→Wasm compiler with a reference interpreter: exactly Futamura's shape | **Yes** |
| Proof assistants | Lean → C (`native_decide`, `bv_decide`) | §2 | Nobody (CertiCoq-Wasm, 2025: "Lean, Minlog, and Nuprl's extraction mechanisms are to date unverified") | Unowned | Not required |

**What the table says (I)**

1. **Proofs get built only where three things coincide:**
   - adversarial or monetary stakes;
   - a target fixed by the platform;
   - an owner who can pay.

   Each owner proves *its own* compiler for *its own* target. None of them is shopping for a language-agnostic proven-compiler factory.
2. **Wasm is the target in only two rows.**
   - **Concordium-style contracts.** CertiCoq-Wasm already serves them.
   - **OPA.** Its divergence bugs have stayed open for three to five years, which is a low-pain signal.
   - **The most expensive small-language compilers target EVM, circuits, C or native code.** Futamura's Wasm-only theorem misses them unless it grows other back ends.
3. **The funding evidence is limited.** Solidus reports ~$150k of compute. The cited $600K Vyper grant has an unresolved future-date/status issue; adding it to compute as ~$0.75M of observed 2026 spending is not justified. Neither figure measures a market size (I).

### 1.2 One-project languages and agent-written DSLs want cheap compilers, not proven ones (Q/I)

- **Theo Browne** (`14` [1:35:00–1:36:00]):
  - "I'm going through a bunch of real world Rust apps that are too slow to compile and building bespoke compilers… I have a compiler that works perfectly for an app I built."
  - "Why wouldn't you build the perfect compiler for your app?"
  - His measure is speed: "it cut the build times for the type checks by like 3 to 5x. We've already saved over 300 hours of CI time."
- **Richard Feldman** (`p3-36` [1:23:00–1:24:00]):
  - The oracle is differential, not proof: with the interpreter, Wasm and native back ends at parity, "we can run the whole test suite against all three of them and see if they agree which is a great feedback loop for the models".
  - The failure mode is gaming: "it's been really really hard to convince either codeex 5.3 or Opus 4.6 to not do like workarounds and hacks and fallbacks."
- **Feldman** (`p3-35` [1:06:00]):
  - He does worry about "pathological paths through the compiler that can get it to miscompile something".
  - But the remedy he imagines is an audit by Kyle Kingsbury, not a proof.
- **Cyrus Omar** (`p3-19` [1:02:00]): "adoption costs for new languages… now I just you know I can build a library for whatever I want in Hazel by just like leaving cloud running overnight".
- **Brian Kernighan** (`p3-61` [0:45:00–0:46:00]): with "Yak, the compiler compiler", "you take this on one very bright good programmer over a long weekend or so and you've got a language."

**What these quotes mean (I)**

- **The demand that models are creating is for cheap languages and fast compilers,** policed by differential tests against a reference.
- **The strongest argument for proofs in this segment** is Feldman's: agent-written compilers game their tests. Rinard's July paper raised the same "reward hacked the compiler" possibility for Axon ([arXiv 2607.28928](https://arxiv.org/abs/2607.28928)).
- **Random differential fuzzing against the interpreter reduces overfitting to a fixed suite (I).** It uses the same reference, but finite tests do not establish equivalence for all programs. Better models may make this route cheaper too.
- **Proof is a tie-breaker here, not a reason to adopt.** Mattis (`22` [1:28:00]): "We trust the compiler to produce pretty good assembly."

### 1.3 How much does proof add over "generate, then test"? (F/I)

**Evidence that proofs pay**

- **Csmith (PLDI 2011)** spent about six CPU-years on CompCert and found no wrong-code bugs in its verified parts, against 325+ in GCC and LLVM. It did find bugs in CompCert's *unverified* front end ([preprint](https://www-old.cs.utah.edu/~regehr/papers/pldi11-preprint.pdf)).

**Evidence on the price**

- **Rinard** ([arXiv 2605.08927](https://arxiv.org/abs/2605.08927)) measured that "verification requires roughly an order of magnitude more development effort than credible compilation" (per-run certificates) on an agent-built compiler.
- **EquiVM** ([arXiv 2607.26306](https://arxiv.org/abs/2607.26306)) has agents prove the bytecode of 35 production contracts "independently of the compiler that produced it". When the compiler changes, proofs are repaired in "a fraction of the original time".

**Which method wins where (I)**

| Stakes | Example | Cheapest adequate method | Does Futamura's factory win? |
|---|---|---|---|
| Low | One-project languages, internal DSLs | Differential fuzzing against the interpreter | No |
| Medium | Policy engines, config languages | Fuzzing, plus proofs of a few critical rules | Rarely |
| High and adversarial | Contracts, crypto, kernel JITs, proof checkers | An owner-built proven compiler for its platform's target, or a proof per binary (EquiVM) | Only where the target is Wasm and no owner exists. In practice that means Lean (§2). |

---

## 2. The Lean instance: the one unowned, timely case

### 2.1 What is trusted today, and what changed in 2026 (F)

**The trusted base**

- **The [Lean FAQ](https://lean-lang.org/faq):** with `native_decide`, "the TCB is extended with the Lean compiler (written in Lean), the Lean runtime (written in C++), and the code generation backend (LLVM by default)".
- **`bv_decide` since 4.12:** its proofs use `Lean.ofReduceBool`, so the compiler joins the trusted base ([4.12 notes](https://lean-lang.org/blog/2024-10-3-lean-4120)).

**The 2026 change**

- **RFC [#12216](https://github.com/leanprover/lean4/issues/12216)** (nomeata, 2026-01-28) was shipped in 4.29 (2026-03-27):
  - each native computation becomes one named axiom, e.g. `thm._native_decide_proof_1 : decide (…) = true`;
  - in-kernel native reduction was then removed ([#14953](https://github.com/leanprover/lean4/pull/14953), 2026-08-28).
- **The RFC's motivation:** "Proofs using these features cannot be checked in external checkers at all."
- **Its suggested remedy:** a tool could enumerate the axioms, extract each computation and "re-run it (e.g. using a different bit blaster and sat solver)".

**The Lean FRO roadmap, Year 4 part 1 (Sep 2026–Feb 2027)** ([link](https://lean-lang.org/fro/roadmap/y4-1/))

- "External checking must become a routine part of every Lean user's workflow."
- "AI-generated proofs are becoming a major source of `grind` and `bv_decide` usage."
- The compiler work is about performance: "stack-allocated objects, recursive join points, uniqueness annotations", with implementation from early 2027.
- **Neither the Year 3 nor the Year 4 roadmap mentions a verified compiler.**

**Usage** (GitHub code search, 2026-10-29)

- `native_decide` appears in **5,616** Lean files, `bv_decide` in 458 and `ofReduceBool` in 441.
- **Top repositories in a 500-result sample:**
  - DeepMind's `formal-conjectures` (31 files);
  - `leanprover/human-eval-lean`;
  - `Verified-zkEVM/clean`;
  - `cvc5/logos`;
  - many agent-built proof pipelines.

**The norm is to avoid it (F)**

- **DeepMind's `formal-conjectures`:** in [PROOFS.md](https://github.com/google-deepmind/formal-conjectures/blob/main/PROOFS.md), `native_decide` "may be acceptable" for a large computation in a test declaration, but is banned from the directory meant for Mathlib.
- **Anthropic's FLT** (2026-09-04): 13M lines, which "uses just Lean's three standard axioms" ([post](https://www.anthropic.com/research/formalizing-fermats-last-theorem)). So, inferring from that, no native computation at all (I).
- **The empty-hexagon proof** ([ITP 2024](https://arxiv.org/abs/2403.17370)) routed its 17,300-CPU-hour SAT proof through **cake_lpr**, a CakeML-verified checker, rather than through Lean's compiler.

### 2.2 The bug record: where native computation goes wrong (F)

These are all the routes to `False` (or wrong code) that I found in the Lean 4 tracker.

| Issue | Date | What happened | Where the bug lives |
|---|---|---|---|
| [#1825](https://github.com/leanprover/lean4/issues/1825) | 2022-11 | `native_decide` proves `-2147483648 + 2147483648 = -18446744069414584320` on Intel Macs | Runtime (Int) |
| [#4306](https://github.com/leanprover/lean4/issues/4306) | 2024-05 | Constant folding of `UIntN.toNat`: a "miscompilation / `native_reduce` proof of false" (digama0) | Compiler pass, before IR |
| [#5818](https://github.com/leanprover/lean4/issues/5818) | 2024-10 | `UInt64.modn` miscompiled in `runtime/object.cpp` | Runtime |
| [#6087](https://github.com/leanprover/lean4/pull/6087) | 2024-11 | Constant folding of `Nat.ble`/`Nat.blt` in the old code generator | Compiler pass, before IR |
| [#9439](https://github.com/leanprover/lean4/issues/9439), [#9440](https://github.com/leanprover/lean4/issues/9440) | 2025-07 | The runtime `String.prev` and `String.next` differ from their models (the issue text says "allowing you to prove `False`") | Runtime (String) |
| [#10213](https://github.com/leanprover/lean4/issues/10213) | 2025-09 | `@[csimp]` ignores universe parameters, "allowing unsound constant replacements" | Compiler front end (`csimp`) |
| [#10429](https://github.com/leanprover/lean4/pull/10429) | 2025-09 | Over-eager reuse of specialisations in the new code generator ("incorrect code") | Compiler pass, before IR |
| [#10925](https://github.com/leanprover/lean4/issues/10925) | 2025-10 | Miscompilation in the new compiler, leading to a segfault | Compiler pass |
| [#11773](https://github.com/leanprover/lean4/issues/11773) | 2025-12 | `Array.foldlM` and its `implemented_by` twin diverge, so you "can prove False with `native_decide`" | `implemented_by` |
| [#7463](https://github.com/leanprover/lean4/issues/7463) | 2025-03, open | "`@[csimp]` can be used to smuggle axioms and `unsafe` into a proof" | Compiler front end (`csimp`) |
| [#14684](https://github.com/leanprover/lean4/issues/14684) | 2026-08 | `String.Pos.Raw.extract` model/runtime mismatch plus a use-after-free. This is [Trail of Bits' "proof" of FLT](https://blog.trailofbits.com/2026/09/09/a-proof-of-fermats-last-theorem-that-fits-the-margin/), found "while using GPT-5.6 to experiment with a code-review skill". | Runtime (String) |
| [#16001](https://github.com/leanprover/lean4/issues/16001) | 2026-10-27, open | `Nat.log2` truncates large results to zero on 32-bit runtimes | Runtime (Nat) |

**Tally (I):**
- 6 runtime primitive mismatches (counting #9439 and #9440 separately);
- 4 compiler-pass bugs, all before the IR (two of them in the 2025 rewrite);
- 3 unproven substitutions (`implemented_by` and `@[csimp]`);
- 0 in the C back end.

**The sister system tells the same story (F)**
- Rocq's [critical-bugs list](https://github.com/rocq-prover/rocq/blob/master/dev/doc/critical-bugs.md) has 93 entries since 8.0.
- Its largest section, "Conversion machines" (the VM and `native_compute` evaluators and their primitive-type layers), holds **23** of them.
- Verifying CertiCoq-Wasm's primitive integer operations turned up a fresh `vm_compute` unsoundness ([coq#19402](https://github.com/coq/coq/issues/19402)).

**What this implies for the scope (I)**
- **The problem is real and recurring, and models now find it.** But it is mostly *not* a compiler problem.
- **A λRC→Wasm verified compiler, as T02 proposes, would have prevented none of the 13 bugs.**
  - The 4 pass bugs and the 3 substitution bugs happen before λRC.
  - The 6 runtime bugs fall away only if the new pipeline also ships **proven implementations of the primitives**.
- **T02's line, that a λRC compiler would "let proofs that rely on heavy computation run compiled code that trusts only the semantics", is wrong as stated.**

### 2.3 What a Futamura for Lean must actually include (I/E)

1. **Start from kernel-checked terms, not from Lean's compiler output.**
   - This needs a verified erasure of types and proofs.
   - Recursion must be compiled from Lean's generated equation lemmas (`eq_def`), not from the `brecOn` or `WellFounded.fix` encodings.
   - It must ignore every `implemented_by`, `@[extern]` and `@[csimp]` unless it has a proof.
   - **Precedent:** MetaRocq's verified erasure and Forster–Sozeau–Tabareau's verified extraction (PLDI 2024), a multi-year team effort.
2. **Proven primitives.** Lean core has **682 distinct `lean_*` extern symbols** (counted from source, F). By family:

   | Family | Symbols | How hard to prove (E) |
   |---|---|---|
   | I/O, libuv and OS | ~190 | Out of scope for a proof checker |
   | Floats | 68 | Out of scope |
   | Fixed-width integers | 251 | Mechanical, via BitVec |
   | Strings | ~60 | Where 3 of the 6 runtime bugs above live |
   | `Nat`/`Int` bignums | 35 | The hard part |
   | Arrays and byte arrays | ~37 | Moderate |

3. **A memory story.**
   - Lean's speed comes from reference counting with in-place reuse.
   - **Without proven reuse, the verified-extraction route ran about 2.5× slower than Lean's compiler** ([Dima, MPRI 2025](https://www.normalesup.org/~sdima/2025_extraction_report.pdf), advised by Yannick Forster).
   - **CertiCoq-Wasm has no GC at all.** Its `coqprime` benchmark "would run out of memory for a 150-digit prime".
4. **An execution assurance story:** an unverified Wasm engine remains trusted. A completed Lemma theorem could remove compiler implementation code from that base only within its proven byte-level, loader and runtime contract (§6). The current local experiment does not supply that executor.
5. **Integration.** Since 4.29 this can live **out of tree**: a checker that discharges the `._native_decide_` and `._native.bv_decide.` axioms. No fork or upstream approval is needed to run it.

**Effort (E):**
- a useful fragment (`Nat`, `Int`, fixed-width integers, `Array`; no strings, floats or IO): about 6–12 months of solo, agent-supervised work;
- full coverage: 2–3 years.

T02's "6-week λRC" version is a different, much smaller product, and §2.2 shows it would not have caught the bugs that motivate it.

### 2.4 Who would care, and how much (I/F)

| Who | Their pain | Would they use it? | How much it is worth to them (E) |
|---|---|---|---|
| **The Lean FRO** | Owns the issue. Fixes each bug in hours to days: Trail of Bits reports a fix PR "about 90 minutes after the report". | Maybe, as an optional checker, if someone maintains it. Its roadmaps prioritise compiler speed and external kernels. RFC #12216 points at re-running computations, not at proving the compiler. | Reputational. No budget line. |
| **Users of `bv_decide` and AI-written proofs** | Every `bv_decide` proof carries a native axiom. Once external checking is routine, these axioms become the main thing still trusted. | **The best fit**, especially with a verified evaluator for `bv_decide`'s checker path. | Moderate: a clean audit story for AI proof factories |
| **Mathlib and FLT-scale AI mathematics** | Little: they ban or avoid native computation and still finish (FLT). | Rarely | Low |
| **Lean used as a programming language** | De Moura (`p3-45` [0:14:00]): "at AWS we have a compiler for AI acceler[ators]. It's half million lines of ling [Lean]… The proofs are like a bonus". Aqueduct (AWS/Berkeley, Oct 2026) ports C/C++/Go/Rust programs to Lean, and "as for any Lean program, the compiler and runtime are trusted to preserve it in the executable" ([arXiv 2610.30188](https://arxiv.org/abs/2610.30188)). | Not soon. Aqueduct's optimised ports still run at **0.148×** the originals' speed (geomean), so this group needs speed before it needs a slower trusted path. | Large in principle, small near term |

**Net (I).** The need is real, and it is narrow and mostly reputational. The people who could fund it, the FRO and AWS, are spending on speed and external kernels.

### 2.5 The cheaper alternatives (F/I)

1. **N-version re-execution**, as RFC #12216 itself suggests.
2. **Model-versus-runtime differential fuzzing over the 682 externs.** This is how the 2025–26 bugs were found, some of them with LLM help.
3. **`decide +kernel`:** slower, but it trusts only the kernel.
4. **Routing heavy computation to an already-verified checker**, such as cake_lpr.
5. **Hardening Lean itself:**
   - stricter meta checks for native computations ([#13004](https://github.com/leanprover/lean4/pull/13004));
   - an `@[allow_native_decide]` kernel check ([#11790](https://github.com/leanprover/lean4/pull/11790));
   - the `csimp` fixes.

These cost little and catch most mismatches (I). What a proof adds is the ratchet and the closing of whatever residue is left. Most users will not pay a 2–5× slowdown for that residue (E).

---

## 3. Does proof reuse across languages actually happen?

### 3.1 The evidence (F)

| How proofs get reused | Example | What was reused | What each language still had to build |
|---|---|---|---|
| **A shared verified back end or IR** | CakeML, used by [PureCake](https://cakeml.org/purecake/) (a lazy, Haskell-like language compiled to CakeML source, with an end-to-end theorem down to machine code), Pancake (built on CakeML's lower back end), and [Isabelle/HOL→CakeML](https://wwwbroy.cs.tum.edu/~nipkow/pubs/esop18.html) | Everything below the shared IR | Its own semantics, and laziness (PureCake's main contribution) |
| Shared back end | CompCert, used by Vélus (Lustre→Clight) and CertiCoq (Gallina→Clight) | CompCert's back end | The whole dataflow or functional front end |
| Shared IR | MetaRocq's λ□, used by CertiCoq, Malfunction/OCaml and CertiCoq-Wasm. Dima built an unverified bridge from Lean into λ□. | Erasure and middle end | Each back end |
| **Proof templates adapted by an agent** | [Paraskevopoulou](https://arxiv.org/abs/2602.20082): Claude Code (Opus 4.6) proved CertiCoq's ANF pass, about **7,800 lines in about 96 hours**, using the human CPS proof (5,300 lines, "several months") as its template. T02 cites ~6,000 lines, apparently from an earlier version of the abstract. | The proof technique | The ANF-specific invariants |
| **Parametric frameworks** | Pilsner (correctness proofs parametrised over source and target); Patterson and Ahmed's [compositional compiler correctness](https://www.ccs.neu.edu/home/amal/papers/next700ccc.pdf) (ICFP 2019) | The linking theory | Research-grade, with little adoption |

**Two numbers that bound the claim (F)**

- **Even with heavy reuse, one more back end is expensive.** CertiCoq-Wasm reused CertiCoq's whole front and middle end and WasmCert's semantics. Its one back end still took "about 21 person-months… about 4 kLoC of specification, and 13 kLoC of proof", and it has no GC.
- **Without structure, agents do not abstract.** Basis's agents produced "122 near-identical step lemmas instead of a generic abstraction" ([Basis](https://www.basis.ai/blog/verified-compiler/)).

### 3.2 What transfers and what does not (I)

| Part of the compiler | Does it transfer to a new language? |
|---|---|
| Wasm emission, data layout, calling convention, tail calls | **Yes**: this is the shared back end |
| Closure conversion, ANF/CPS | **Yes, if** the languages lower into the same λ-IR. The proof is about the IR, not the source. |
| Pattern-match compilation | **Partly.** Decision trees are generic, but guards, or-patterns, laziness and match failure differ by language. |
| Memory management (bump, RC, GC) | **Yes, if** the IR fixes the heap model. Mutation and aliasing in the source break that. |
| Effects (exceptions, async, continuations), laziness, numeric towers, Unicode strings, FFI | **Mostly no** |
| The front end into the shared IR, and the semantics | **Never**: that is the per-language work |

**Conclusion (I)**

- **Reuse happens, but in the CakeML shape:** compilers into a shared IR, not a compiler-compiler.
- **The per-language cost falls mostly because models make front-end proofs cheap** (ANF in 96 hours), **and because public proofs are templates.** A Futamura library does not cause that fall.
- **Every agent can read CompCert, CakeML and CertiCoq.** So the library is not scarce.

### 3.3 What T02's kill threshold would show (E)

**T02's test:** language B must cost ≤⅓ of language A's agent-hours, with ≥50% of proof lines reused.

**Predictions:**
- **Scheme core → ML core** (same λ-IR, same heap): probably passes (E 70%).
- **An imperative DSL, or a language with exceptions or laziness:** probably fails (E 70% fail).

**Passing proves "shared back end", which is CakeML's known result,** not a new capability. The threshold cannot tell a compiler-compiler apart from two compilers that share a back end.

---

## 4. The tailwind: steelman, then attack

### Steelman (F/Q)

1. **The cost of proofs is collapsing, release by release.**

   | When | What |
   |---|---|
   | Feb 2026 | ANF proven in ~96 hours by Opus 4.6 |
   | Mar–Apr 2026 | Basis fails at closure conversion and ANF from scratch |
   | May–Jul 2026 | Axon delivers a verified compiler for a toy language in 34 supervised days |
   | Jul 2026 | Solidus: a proven EVM back end in ~10 weeks, with no human-written code |
   | Sep 2026 | FLT: 13M lines of Lean in 11 days |

   CertiCoq-Wasm's 21 person-months of 2024 are probably weeks of agent time today (E).
2. **Demand grows with model capability.**
   - Languages get cheap (Omar, Theo, Kernighan), so there are more of them.
   - Nobody reads the compilers (Mattis), and agent-written compilers game their tests (Feldman, Rinard).
   - A proof against the interpreter is the only gate that does not depend on test coverage.
   - De Moura (`p3-45` [0:34:00]): "if I'm not the one that's writing most of the codes anyway it doesn't really matter … what matters are the specification level".
   - De Moura again ([1:02:00]): "when you have proofs it enables optimizations for free".
3. **Attackers have models too.** Trail of Bits found 2026's `native_decide` route to `False` with GPT-5.6. This matches D4's Wasmtime finding: 11 of April's 12 advisories were found with LLM tools.
4. **The Lean-specific pull is growing.** More AI-written proofs mean more `bv_decide`, which means more native axioms. Once external checking is routine, those axioms are what remains trusted.

### Attack (F/Q/I)

1. **"Just generate a compiler and test it" wins for almost every language.**
   - Differential fuzzing against the interpreter is the same oracle, with no proof.
   - Every model release improves it as much as it improves proving.
   - Verification costs about 10× more than certificates (Rinard).
   - The demand Theo voices is for speed.
2. **For high stakes, "prove each binary" or "the owner proves its own compiler" wins.** EquiVM proves deployed bytecode whatever compiler produced it; Solidus and Vyper prove compilers for the target that actually holds the money.
3. **The per-language compiler is becoming a prompt.**
   - Paradigm on single-loop agents: "we suspect they will be good enough soon—probably by the end of the year".
   - Nerd Snipe (`14` [1:13:00]): "anything with a verifier function is solvable right now."
   - Futamura is a verifier function by construction.
   - §5 recovers seven tests and an unchecked proof draft from a session-limit interruption; it does not measure completion capability.
4. **The library is not scarce.** CakeML, CompCert and CertiCoq are public templates, and an agent turned CPS into ANF in 96 hours.
5. **Wasm is the wrong target for the money.** EVM, circuits, C/assembly for crypto, and native code for kernels hold most of the stakes.

### Net (I)

- **Capability:** a strong tailwind.
- **Demand:** a real tailwind, but only in high-stakes niches that already have owners.
- **Defensibility:** a headwind.

**“Better artifact, lower reproduction cost” is a plausible forecast (I),** as in D4. Futamura's smaller per-language unit may make it easier to reproduce. The rate of that change, and whether the factory's finished value becomes one prompt, remain unmeasured.

---

## 5. The one-shot test, concretely

### 5.1 A hypothetical full-scope prompt for Futamura as pitched

> /goal Here is a Lean interpreter for language A (λ, let, ints, pairs, closures, letrec). Build a compiler to WebAssembly (linear memory, `call_indirect`, tail calls) with a Lean theorem that every compiled program returns exactly what the interpreter returns, traps and out-of-memory excepted. No `sorry`, no axioms. Then do the same for language B (A plus ADTs and pattern matching), reusing A's passes, and report the reuse. Then add RC memory management. Run parallel agents; don't stop.

### 5.2 Closed experiment: runnable examples, unverified proof draft, session-limit interruption (F, audited 2026-10-29)

**Setup**

- **Protocol:** one initial prompt to Claude Fable 5.1, autonomous tool use and no human repair, with a planned 75-minute cap including toolchain download. This is an agent session, not a single completion.
- **Toolchain:** core Lean only (no Mathlib), on the builder's Mac.
- **Requested scope:** the closure-conversion pass family where Basis left much of its proof work unfinished, but for a smaller synthetic language and target, not the same task.
  - A source language with integers, arithmetic, `if`, `let`, single-argument λ, application, `letrec` and pairs, with first-class closures over free variables.
  - A fuel-based reference interpreter.
  - A *first-order* target with a global function table, a heap of tuples with allocation and field loads, and Wasm-style indirect calls.
  - A compiler that must perform closure conversion.
  - The main theorem: if the source returns integer `n`, the compiled program returns `n`.
  - `#eval` tests, including a closure that captures two variables, a higher-order function, recursive factorial, and a function that returns a closure.
  - `#print axioms` may show only the three standard axioms.
- **Stretch goals:** proper tail calls, then one optimisation pass with its own proof.

**Recovered artifacts and checks (F).** The output is in `/private/tmp/d6-oneshot/`, not in D4's `lean-oneshot/exp/` tree:

- `Compiler.lean`: **293 lines**, containing source and target interpreters, free-variable analysis, closure conversion/lambda lifting, a function table, heap allocation/field loads and indirect calls. It contains **no correctness theorem**. Rechecked unchanged with the existing Lean **4.35.0** binary at scratch `lean-oneshot/elan/toolchains/leanprover--lean4---v4.35.0/bin/lean`: **exit 0**.
- Its seven `#eval` source/target pairs agree at fuel 1,000: **35, 63, 720, 197, 42, 55, 3**. They cover capture of two free variables, higher-order application, recursive factorial, returning a closure, a closure in a pair, Fibonacci and capture of a recursive closure. This is executable smoke-test evidence, not proof of arbitrary programs.
- `Proofs.lean.part`: **478 lines**, a separately saved simulation-proof draft ending in `compile_correct`, `compile_safe` and `compile_correct_iff`. Checked the existing draft by concatenating it after `Compiler.lean` into `/tmp/deepdive-d4d6-audit/Futamura.lean`, without edits: **exit 1**. The first failure is at combined line **298** (unresolved `GetElem?` instance in `HExt`), followed by type/tactic errors. All three printed theorem dependencies contain **`sorryAx`**. None is an accepted proof.
- Text scans found no literal `sorry`/`admit`, new axiom declaration, `native_decide`, `implemented_by`, `extern`, `unsafe`, `partial def` or `opaque` in those two files. As in D4, absence of those tokens does not override Lean errors or `sorryAx`.

**Scope limits (F/I).** The target is a custom first-order expression interpreter with unbounded `Int` values and a `List (List Int)` heap. It is not real Wasm bytes, bounded linear memory or Wasm's bit-exact numeric/trap semantics; it has no RC/GC or bounded allocation. The draft's `compile_correct` is conditional forward preservation for closed source terms that already return an integer, with existential target fuel. Even its theorem named `compile_correct_iff` states an implication, not an unconditional equivalence covering source divergence, traps or out-of-memory. No cross-language reuse, proper-tail-call implementation, optimisation proof or production performance result was recovered.

**Disposition: closed as inconclusive/interrupted.** The historical child thread records a start at **10:11:46 CET** and then terminates with a session-limit **HTTP 429** while the toolchain was being prepared and the proof was being drafted. No completed timed final report or clean theorem is recoverable. The runnable compiler is a partial artifact; seven matching examples do not establish one-shot proven compilation, and a rate-limited run is not evidence of model incapability. No Claude session or generation run was resumed.

**Reproduction record:** SHA-256 prefixes are `5343f3f89ee5` (`Compiler.lean`) and `ae1e578f8d2a` (`Proofs.lean.part`). Logs are `/tmp/d6-compiler-audit.log` and `/tmp/d6-proofs-audit.log` on this machine. This closes the experiment; there are no pending results.

### 5.3 Extrapolation (E/I; not measured probabilities)

| Scope | Forecast | Evidence and limit |
|---|---|---|
| (a) Proven closure conversion to a first-order target | Plausible under a larger uninterrupted budget; unmeasured here | Seven tests pass, but the saved proof draft fails; ANF and Basis are different tasks |
| (b) ADTs, pattern matching, proper tail calls and real Wasm emission | Uncertain | Related verified compilers exist; this run supplies none of that production coverage |
| (c) RC with proven in-place reuse and strings | Uncertain, with substantial semantic/heap work | No completed local result or calibrated model forecast |
| (d) Lean kernel-term erasure plus proven bignums, arrays and strings | Substantially larger than (a); schedule uncertain | MetaRocq is evidence of the work involved, not a one-shot completion rate |
| (e) FRO acceptance and a public validation record | Cannot be conferred by generating code | Requires external decisions and evidence over time |

**What survives the one-shot test (I).** The finished-value test remains unresolved for both the factory and the Lean instance. It is reasonable to investigate lower reproduction costs, but this interrupted experiment does not show that rows (a)–(c) can be regrown in days or weeks by the next model. Rows (d)–(e) add distinct scope and acceptance requirements; they are not proven to be the only durable contribution. The narrow value verdict rests on demand and assurance scope, not on a measured one-shot success or failure.

---

## 6. Combination with Lemma: proven language → native

**How the two compose (I)**

- **The two theorems chain through one shared Lean Wasm semantics:**
  - Futamura: the interpreter's result for `p` is refined by `wasm(compile p)`;
  - Lemma: `wasm m` is refined by `aarch64(lower m)`;
  - both up to resource exhaustion.
- **If both proofs and their interfaces are completed, the intended result is a CakeML-style refinement from source interpreter to machine code.** Neither local experiment supplies that complete chain.
- **The fine print is the observables.**
  - Both must agree on traps, out-of-memory, host calls and the direction of refinement. The executable compiler, numeric/heap primitives, encoder, emitted bytes, loader and runtime ABI must be linked to the theorem. Matching an intermediate interpreter alone does not exclude implementation bugs.
  - Wasm's stack depth and `memory.grow` failures are nondeterministic, so the composed theorem says "same result, or resource exhaustion". CakeML's theorem has the same caveat.

**The design constraint the combination imposes (F/I)**

- **Futamura must emit only what Lemma proves first:** integer Wasm with linear memory, `call_indirect` and tail calls.
  - Closures become records in linear memory.
  - ADTs become tagged blocks.
  - Memory management is RC in linear memory, which is exactly Lean's λRC model.
- **It must not emit WasmGC.**
  - CertiCoq-Wasm's WasmGC prototype is unverified "since WasmCert does not (yet) support the WasmGC proposal".
  - D4's 1-year scope for Lemma has no GC.
- **The fit is natural: the subset Lemma proves first is the subset an RC-based functional back end needs.**

**What the combination buys**

- **For Lean's native computation, the trusted base changes:**
  - **today:** the Lean compiler, the C compiler, 21.6k lines of C/C++ runtime (counted, F) and 682 externs;
  - **combined, conditionally:** the Lean kernel, validated source/primitive/Wasm/ISA specifications, and any CPU, loader or runtime contract not itself proved. Unproved erasure, primitive implementations or byte-emission steps remain trusted; they cannot be removed merely by writing model definitions.
- **This is CakeML's trust story, for Lean.** It is exactly what Lean users currently borrow from HOL4 through cake_lpr.
- **It is the strongest form of both ideas:**
  - Lemma gets its first concrete internal customer, answering D4's "who would run it";
  - Futamura could get an executor whose compiler correctness is checked within an explicit contract. Its speed and remaining trusted runtime components must be measured and stated.

**Costs (I/E)**

1. **The Wasm layer costs performance.** It adds bounds checks and structured control flow, and Wasm code cannot scan its own stack for GC roots (a point CertiCoq-Wasm makes). If the goal is native only, compiling λRC→AArch64 directly, as CakeML does, is simpler. The Wasm layer pays only if the same artifact must also run in browsers, at the edge or on Wasm chains, or if Lemma already exists.
2. **The two projects run in series.** Value arrives only once both cover the same subset: 12–24 months of solo work (E).

**Net (I).** The combination makes the Lean instance clearly more valuable. It does not fix the general pitch's missing buyer.

---

## 7. Realistic ceiling (E)

| | **1 year, solo, with frontier agents** | **3 years** |
|---|---|---|
| **The generic factory** | 2–3 small functional languages (a Scheme core, an ML core with ADTs, one DSL) compiling to Wasm 1.0 plus tail calls, with RC or bump allocation. Output 10–50× faster than the interpreters and 2–5× slower than tuned compilers for those languages. Proof reuse 50–70% between the functional languages. | 5–8 languages and a second target. Reuse plateaus at the shared back end, while effects, laziness and strings stay per-language. Reproduction costs may fall; no regrowth time was measured here. |
| **The Lean instance** | A verified evaluator for a fragment (`Nat` and `Int` bignums, fixed-width integers, `Array`, structural recursion through equation lemmas), run as an out-of-tree discharger of 4.29 native axioms. Covers perhaps 30–50% of public `native_decide` uses. Runs 2–5× slower than native and far faster than `decide +kernel` (to be measured). | Strings and RC reuse added, plus `bv_decide`'s checker path. With a completed Lemma pipeline, it emits native code; speed relative to Lean's native path remains to be measured. Either the FRO adopts it as an optional `lake check` backend, or it stays a respected side tool. |
| **Users** | 0–3 Lean projects trying it | Tens of projects if the FRO blesses it; otherwise a niche |
| **Main risk** | Primitives (bignums, strings) and kernel-term erasure take longer than everything else together. | Lean's semantics and libraries move faster than a solo maintainer can follow. Starting from kernel terms mitigates this, because the kernel is stable while LCNF is not. |

**The likely shape at three years (I):** "CakeML for Lean" as a research-grade artifact, with two or three papers. It might become part of how Lean checks native computations, if the FRO wants it. It will not be a compiler factory that many language authors use.

---

## 8. The most impressive 6-week demo, and the sceptic

### The demo: "Native computation at the kernel's level of trust"

This is more impressive than T02's "Monday interpreter, Friday compiler".

1. **Build:**
   - an out-of-tree tool that lists a project's `._native_decide_…` axioms;
   - for each axiom inside the fragment (`Nat`, `Int`, fixed-width integers, `Array`, structural recursion), a computation compiled from kernel terms with proven primitives;
   - execution under Wasmtime;
   - for actual axiom discharge, a **kernel-checkable proof of the asserted equation**, tied to the checked source and execution result. Merely re-running in Wasmtime and observing equality is an independent check, not a logical discharge; Wasmtime otherwise remains trusted.
2. **The repro wall.** Re-run the public routes to `False` that fall inside the fragment: #1825 (Int), #4306 (`UInt64` constant folding), #5818 (`UInt64.modn`), #6087 (`Nat.ble`), #11773 (`Array.foldlM`) and #16001 (`Nat.log2`, simulated as 32-bit).
   - Require the checked source-to-execution chain to yield the model's answer and refuse the bogus axiom. A correct model alone is insufficient if the executor or certificate bridge can miscompute.
   - The String routes, including Trail of Bits' FLT, are the week-7+ milestone.
3. **The positive run.** Discharge the in-fragment native axioms of public projects, such as `formal-conjectures`' OEIS tests and `human-eval-lean`. Show three timings: native, this tool, and `decide +kernel`.
4. **Secondary:** T02's timelapse from interpreter to proven compiler, for a 300-line DSL.

### What a sceptical expert would say

Imagine a Lean FRO compiler developer, or a CakeML veteran.

1. **"`decide +kernel` already refutes all six repros. You've built a faster kernel evaluator."**
   - *Fair.* The claim has to be speed at the kernel's level of trust, so the timings decide the demo.
2. **"You didn't verify Lean's compiler; you wrote a second one. Users will keep using `native_decide` because it's faster and covers everything."**
   - *True.* Adoption depends on coverage and speed, and in six weeks you have neither.
3. **"Your erasure and primitive models are the new trusted base."**
   - *Partly.* The primitive specs *are* Lean's own model definitions, which is the point. The erasure is new code you must trust or prove.
4. **"Every one of these bugs was found and fixed within days by differential testing. You're solving a solved problem."**
   - *Useful for detection.* A proof adds a guarantee only for the implementation, semantics and runtime premises it actually covers; it does not exclude all undiscovered bugs.
5. **"FLT used no native computation. Who needs this?"**
   - *True for mainstream mathematics.* The demand sits with `bv_decide`, SAT-heavy proofs and large finite checks.
6. **"CakeML has done this for HOL4 for a decade."**
   - *True.* That is the argument *for* it: Lean has no equivalent (CertiCoq-Wasm, 2025). It is also the argument against novelty.

---

## 9. Is the value real without users?

| Kind of value | Real without users? | Why (I) |
|---|---|---|
| **A proven compiler factory for new languages** | **No** | No identified language author is asking for it. The owners who need proofs build their own for non-Wasm targets. |
| **A Lean native-axiom discharger run on public repos** | **Partly** | The builder can run it on public projects and publish "N axioms re-verified, K refused". That is demonstrable value without users, but it is close to the audit shape the builder rejected ("agent-era Jepsen"). Its lasting value needs Lean users or the FRO to rely on it. |
| **A research artifact ("CakeML for Lean")** | **Yes** | Publishable. It fills a gap the CertiCoq-Wasm authors named. |
| **A benchmark or environment for model capability** | **Yes** | "Prove a compiler for language X" is a clean long-horizon task with a hard gate. Labs buy environments like this (D4 §1.2). |

---

## 10. What would raise the value (I; brief, for the builder)

1. **Change the product.**
   - From: "write an interpreter, get a proven compiler".
   - To: "CakeML for Lean: native computation you can check".
   - Start with `bv_decide`'s checker path and the `Nat`/`Int`/`Array` fragment, delivered as an out-of-tree discharger of 4.29's per-computation axioms.
2. **Start from kernel terms, not λRC.** §2.2 shows that is where the bugs are.
3. **Make Lemma the executor and skip WasmGC.** That lets both projects share one Wasm semantics and one customer.
4. **Before building anything, write one email to the RFC's author.**
   - If the FRO plans only N-version re-execution, this is the stronger version of their own idea.
   - If they would rather fund faster kernels, re-plan.
5. **Drop "one-project languages" and "smart contracts" from the pitch.** The first wants speed. The second is owned, and runs on EVM.

---

## 11. Verdict: **Weak** as pitched (Real but narrow if re-scoped to Lean)

**Main reason.** A proven compiler factory for small languages has no buyer.
- **Where proofs are worth paying for, the stakeholder builds them in-house** (Fiat → BoringSSL; Vyper's verification effort; Paradigm's Solidus; Linux's eBPF JITs; AWS's Cedar). Each targets something other than Wasm.
- **Everywhere else, generating a compiler and differentially testing it against the interpreter is cheaper,** and improves with every model release.
- **Proof reuse across languages is real only in the CakeML shape,** and public proofs plus models already supply it.

**The one unowned need is Lean's native computation.** It is timely: per-computation axioms since 4.29, the FRO's external-checking push, and two `False` routes in 2026. But it needs a much larger and different build than T02 sized: kernel-term erasure plus proven primitives, not λRC→Wasm. Composed with Lemma, it becomes "CakeML for Lean": real, narrow and mostly reputational.

---

## TL;DR

1. **Proven small-language compilers matter only where money or adversaries are,** and there the owners build them for EVM, C, native code or SMT: Vyper (verification effort after a $40–70M miscompile; grant status unverified), Solidus, Fiat (in BoringSSL), eBPF JITs, Cedar. None buys a Wasm-only factory.
2. **One-project languages and DSLs want speed.** "Generate, then fuzz against the interpreter" is the same oracle without the proof, and models improve it as fast as they improve proving.
3. **Cross-language proof reuse has a CakeML precedent.** The local run recovers seven passing examples but no clean closure-conversion theorem, and ends on a session limit. It measures neither factory reuse nor future one-shotability.
4. **Lean's native computation is the real, unowned need:** 13 public routes to `False`, two in 2026, and per-computation axioms since 4.29. But the bugs are pre-IR passes, runtime primitives and unproven substitutions, so the fix is kernel-term erasure plus proven primitives, not T02's λRC compiler. With Lemma as executor, it becomes "CakeML for Lean".
5. **Verdict: Weak as pitched; Real but narrow as "CakeML for Lean".** Kill the general version. Keep the Lean version only if the FRO confirms that it wants a verified discharger.

---

## Sources

**Transcripts** (checked against the line)

| File | Speaker | Timestamps |
|---|---|---|
| `14-nerd-snipe…` | Theo Browne / Ben Davis | [1:13:00], [1:35:00–1:36:00] |
| `p3-36-…shawn-wang` | Richard Feldman | [1:23:00–1:24:00] |
| `p3-35-…tigerbeetle…` | Richard Feldman | [1:06:00] |
| `p3-45-…creator-of-lean…` | Leonardo de Moura | [0:09:00], [0:14:00], [0:34:00], [1:02:00–1:03:00] |
| `p3-19-…type-theoreti…` | Cyrus Omar | [0:42:00], [1:02:00] |
| `p3-20-…ray-myers…` | Ray Myers | [30:00–31:00] |
| `p3-61-…kernighan…` | Brian Kernighan | [0:45:00–0:46:00] |
| `22-…peter-mattis` | Peter Mattis | [1:28:00] |

**Lean**

- [The Lean FAQ](https://lean-lang.org/faq); the [4.12 notes](https://lean-lang.org/blog/2024-10-3-lean-4120) and [4.29 notes](https://lean-lang.org/doc/reference/latest/releases/v4.29.0).
- [RFC #12216](https://github.com/leanprover/lean4/issues/12216) and [#14953](https://github.com/leanprover/lean4/pull/14953).
- Issues [#1825](https://github.com/leanprover/lean4/issues/1825), [#4306](https://github.com/leanprover/lean4/issues/4306), [#5818](https://github.com/leanprover/lean4/issues/5818), [#6087](https://github.com/leanprover/lean4/pull/6087), [#7463](https://github.com/leanprover/lean4/issues/7463), [#9439](https://github.com/leanprover/lean4/issues/9439), [#9440](https://github.com/leanprover/lean4/issues/9440), [#10213](https://github.com/leanprover/lean4/issues/10213), [#10429](https://github.com/leanprover/lean4/pull/10429), [#10925](https://github.com/leanprover/lean4/issues/10925), [#11773](https://github.com/leanprover/lean4/issues/11773), [#14684](https://github.com/leanprover/lean4/issues/14684) and [#16001](https://github.com/leanprover/lean4/issues/16001).
- Hardening PRs [#11790](https://github.com/leanprover/lean4/pull/11790) and [#13004](https://github.com/leanprover/lean4/pull/13004).
- Lean FRO roadmaps: [Year 3](https://lean-lang.org/fro/roadmap/y3) and [Year 4, part 1](https://lean-lang.org/fro/roadmap/y4-1/).
- [Trail of Bits, 2026-09-09](https://blog.trailofbits.com/2026/09/09/a-proof-of-fermats-last-theorem-that-fits-the-margin/).
- [formal-conjectures PROOFS.md](https://github.com/google-deepmind/formal-conjectures/blob/main/PROOFS.md); [Anthropic, FLT](https://www.anthropic.com/research/formalizing-fermats-last-theorem); [the empty-hexagon paper](https://arxiv.org/abs/2403.17370).
- [Dima, Compiling Lean programs with Rocq's extraction pipeline (2025)](https://www.normalesup.org/~sdima/2025_extraction_report.pdf); [Aqueduct, arXiv 2610.30188](https://arxiv.org/abs/2610.30188).
- Lean source tree at `c3bb4fa` (2026-10-29): extern and runtime counts.

**Verified compilers, and proof reuse**

- [CertiCoq-Wasm (CPP '25)](https://www.cl.cam.ac.uk/~jp622/certicoq-wasm.pdf) and [coq#19402](https://github.com/coq/coq/issues/19402); [Rocq's critical-bugs list](https://github.com/rocq-prover/rocq/blob/master/dev/doc/critical-bugs.md).
- [PureCake](https://cakeml.org/purecake/); [Isabelle/HOL→CakeML (ESOP 2018)](https://wwwbroy.cs.tum.edu/~nipkow/pubs/esop18.html); [Vélus](https://github.com/INRIA/velus); [Patterson and Ahmed (ICFP 2019)](https://www.ccs.neu.edu/home/amal/papers/next700ccc.pdf).
- [Paraskevopoulou, arXiv 2602.20082](https://arxiv.org/abs/2602.20082); [Basis](https://www.basis.ai/blog/verified-compiler/).
- Rinard: [arXiv 2605.01660](https://arxiv.org/abs/2605.01660), [2605.08927](https://arxiv.org/abs/2605.08927) and [2607.28928](https://arxiv.org/abs/2607.28928).
- [Csmith, PLDI 2011](https://www-old.cs.utah.edu/~regehr/papers/pldi11-preprint.pdf).

**The domains**

- **Smart contracts:**
  - the Vyper incident ([CertiK](https://www.certik.com/resources/blog/2qbPMcyJpR5UfoKrcjWxlQ-vyper-incident-anaylsis), [Hacken](https://hacken.io/discover/curve-finance-liquidity-pools-hack-explained/));
  - [Vyper deep verification](https://docs.vyperlang.org/en/latest/deep-verification.html) and [the $600K grant](https://cryptobriefing.com/ethsecurity-round-two-onchain-security/);
  - [Solidus](https://www.paradigm.xyz/writing/solidus) and [EquiVM, arXiv 2607.26306](https://arxiv.org/abs/2607.26306).
- **Crypto, kernel, policy and ZK:**
  - [Fiat Cryptography](https://dspace.mit.edu/handle/1721.1/131080) and the [BoringSSL commit](https://boringssl.googlesource.com/boringssl/+/46304abf7d93f1b386199041440ac4fccf7cb3bb);
  - [Jitterbug (OSDI '20)](https://usenix.org/conference/osdi20/presentation/nelson);
  - [SymCert](https://www.amazon.science/publications/symcert-verifying-smt-based-policy-analyses);
  - [MTZK (NDSS '25)](https://www.ndss-symposium.org/ndss-paper/mtzk-testing-and-exploring-bugs-in-zero-knowledge-zk-compilers/);
  - [OPA's Wasm docs](https://www.openpolicyagent.org/docs/wasm) and issues [#3298](https://github.com/open-policy-agent/opa/issues/3298) and [#6304](https://github.com/open-policy-agent/opa/issues/6304).

**Searched, nothing found (2026-10-29)**

- a verified compiler for Lean's LCNF or λRC. The closest are a draft "experimental Lean 4 compiler" PR in a lean4lean fork (2026-10-11) and Dima's unverified bridge from Lean into λ□;
- a verified compiler on any Lean FRO roadmap;
- a public repository for Theo's Lust.
