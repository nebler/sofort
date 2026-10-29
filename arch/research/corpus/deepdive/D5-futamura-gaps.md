# D5: Futamura, GAPS (prior art), 2026-10-29

Brief: [`BRIEF-deepdive.md`](../BRIEF-deepdive.md), applied to a third finalist that brief does not name. The idea comes from [`tailwind/T02-languages-compilers.md`](../tailwind/T02-languages-compilers.md) §2. I also read [`tailwind/SUMMARY.md`](../tailwind/SUMMARY.md) and [`BRIEF-tailwind.md`](../BRIEF-tailwind.md). This is the only file written.

**Labels**

- **Q**: quoted verbatim, with a link.
- **F**: sourced, with a link.
- **I**: inference.
- **E**: estimate.

**Method**

- About 50 searches and page reads on 2026-10-29: arXiv, GitHub, project and company blogs, conference programmes, and the Lean and Rocq documentation.
- GitHub API checks on about 30 repositories. Every "pushed" date below is as of 2026-10-29.
- Full-text reads of four PDFs:
  - CertiCoq-Wasm (CPP '25);
  - the Peregrine abstract (Types '26);
  - Simon Dima's MPRI report (2025);
  - Marc Huisinga's KIT thesis (2019).

**Not covered**

- X/Twitter was not searched directly.
- The Lean Zulip was searched only through a web search engine.
- HN was searched only through what search engines surface.
- The paywalled full texts of Pilsner and Brady–Hammond. I read their abstracts and secondary summaries only.
- I did not check Pancake, Deegen or PyPy.

**The idea under test.** You write an interpreter for a language in Lean. Models grow a compiler from that language to WebAssembly, one construct at a time:

- closures;
- ADTs and pattern matching;
- tail calls;
- strings;
- effects;
- reference counting (RC) or garbage collection (GC).

Each lowering carries a machine-checked proof that compiled programs behave exactly like the interpreter. Proofs for the hard passes are reused across languages. The candidate early target is a verified compiler for Lean itself, because `native_decide` trusts Lean's unverified compiler. Futamura is Lemma's sibling: Lemma covers Wasm→AArch64, and Futamura covers language→Wasm.

---

## The answer first

**Verdict: Narrow opening.** Section 8 says exactly where.

**Already taken**

- **Verified compilation to Wasm.** CertiRocq-Wasm (Rocq, 2025) is now merged upstream. Peregrine makes it reachable from Rocq, Agda and Lean, though the Lean route goes through an unverified front end.
- **One verified back end with many verified front ends.**
  - CakeML has Scheme, Dafny, PureCake and Isabelle/HOL front ends.
  - CompCert is used as a back end by others.
  - Peregrine shares λ□ ("lambda-box"), MetaRocq's erased lambda calculus, across front ends.
- **Agents writing compiler proofs:** Paraskevopoulou, Axon, Basis and Paradigm all did it in 2026.
- **"Write an interpreter, get a compiler" without proofs:** Truffle/Graal and weval.

**The surprise: Peregrine already runs Lean → λ□ → a verified Wasm back end.**

- Peregrine is by Aarhus, Inria and IOG (Types '26).
- Its Lean front end is unverified and drops primitives, IO and Tasks. Its Wasm back end has no GC.
- Still, the architecture of the "verified Lean compiler" instance already exists.
- The authors name Lean4Lean (a formalization of Lean's type theory in Lean) as an obstacle to verifying "our Lean frontend or the Lean compiler" (Q, [Peregrine](https://types2026.cse.chalmers.se/abstracts/61.pdf)).

**The biggest threat: Basis, October 2026.**

- Agents write a language's semantics in Lean and prove it matches the real interpreter binary. Basis then builds verified tools on top, including a compiler.
- Lua 5.4 and OCaml are underway, grown fragment by fragment with a ledger of unsupported opcodes.
- Basis targets RISC-V and verifies existing implementations. It does not target Wasm or build a generator, but it is one pivot away.

**What's left: three slices**

- **(A) A generator hosted in Lean.** A clocked interpreter goes in. A proven Wasm compiler comes out, grown by models one construct at a time. It is judged by how much each additional language costs.
- **(B) Verified memory management and effects on Wasm.** No neighbour has them. No mechanized semantics exists for Wasm's GC (WasmGC) or exception handling (EH).
- **(C) For Lean itself, the runtime half:**
  - the primitives: `Nat` (GMP), `UInt*`, `String`, and `Array` with in-place updates;
  - RC with reuse;
  - a kernel hook that replaces the `native_decide` axiom.

  The September 2026 `native_decide` exploit sat in this half.

---

## 1. The claim, split into testable parts

| # | Claim | What a neighbour must have to "take" it |
|---|---|---|
| C1 | A verified compiler into **Wasm** | A semantic-preservation theorem against a mechanized Wasm semantics |
| C2 | **The interpreter is the spec** | Source semantics written as an executable (clocked) interpreter, and the compiler proven against it |
| C3 | **Models grow it construct by construct** | Per-construct lowerings and proofs written by agents, inside a gate, with an ENOSYS-like trigger |
| C4 | **Proofs of hard passes reused across languages** | Language N measurably cheaper than language 1 |
| C5 | **A verified compiler for Lean itself** | Lean programs (including primitives) compiled with a proof, usable in place of `native_decide`'s trust |
| C6 | A Wasm semantics in Lean, shared with Lemma | An executable Wasm semantics in Lean that passes the spec tests |

---

## 2. Neighbour matrix

**Key:** ✓ yes · ◐ partly · ✗ no · — not applicable · ? not verified. "Active" means a push within about 60 days.

| Neighbour | Proven | Wasm target | Host Lean | Interpreter as spec | Model-grown | Reused across languages | Closures / ADTs / tail calls | GC/RC proven | Active (pushed) |
|---|---|---|---|---|---|---|---|---|---|
| CompCert | ✓ | ✗ | ✗ (Rocq) | ✗ | ✗ | ◐ (Clight/Cminor reused by others) | ✗ | — | ✓ (10-28) |
| CakeML family | ✓ | ✗ (student project) | ✗ (HOL4) | ✓ (clocked interpreters) | ✗ | ✓ (5+ front ends) | ✓ | ✓ | ✓ (10-28) |
| Pilsner | ✓ | ✗ | ✗ (Rocq) | ✗ | ✗ | ◐ (proofs parametric over the languages) | ✓ | ? | ✗ (2015) |
| Œuf | ✓ | ✗ | ✗ (Rocq) | ✗ | ✗ | ✗ | ✗ | — | ✗ (2019) |
| Vellvm / HELIX | ✓ | ✗ (LLVM IR) | ✗ (Rocq) | ◐ (monadic interpreters) | ✗ | ◐ | ✗ | — | ✓ (10-13) |
| CertiRocq (+ Wasm) | ◐ ("large parts") | ✓ | ✗ (Rocq) | ✗ | ◐ (Claude wrote the ANF proof) | ✓ (via λ□) | ✓ | ✗ on Wasm; ✓ on C | ✓ (10-25) |
| Peregrine, Lean path | ◐ (front end unverified) | ✓ | ◐ (front end only) | ✗ | ✗ | ✓ | ✓ | ✗ on Wasm | ✓ tool (10-27); Lean front end (Feb) |
| Lean's own compiler (FRO) | ✗ | ✗ (a fork's PR was closed) | ✓ | — | — | — | ✓ | ✗ | ✓ |
| Axon (MIT) | ✓ (optimizations via certificates) | ✗ (ARM64) | ✓ | ✓ | ✓ | ✗ | ✗ (no procedures) | — | ◐ (08-16) |
| Basis, April (JS→Wasm) | ✗ (14 sorries, 17 axioms) | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ (failed here) | ✗ | ✗ (ended) |
| Basis, October (WHILE; Lua, OCaml) | ✓ (WHILE) | ✗ (RISC-V) | ✓ | ✓ (proven against the binary) | ✓ | ◐ (machine layer reused) | ✓ (WHILE has closures) | ✗ (Lua's GC "last") | ✓ (10-28) |
| Paradigm Solidus | ◐ (soundness only) | ✗ (EVM) | ✓ | ✗ | ✓ | ✗ | — | — | post dated 07-24 |
| Truffle / weval | ✗ | weval: Wasm→Wasm | ✗ | ✓ (the interpreter is the input) | ✗ | ✓ (any interpreter) | — | — | ✓ weval (10-12) |
| Rupicola | ✓ (proof-producing) | ✗ | ✗ (Rocq) | ✗ | ✗ (experts add lemmas) | ◐ | ◐ | ✗ | ✓ (09-24) |
| Certified Compilers à la Carte | ✓ | ✗ | ✗ (Rocq) | ✗ | ✗ | ✓ (modular components) | ? | ? | PLDI 2025 |
| Brady–Hammond; Bahr–Hutton | ✓ | ✗ | ✗ | ✓ (interpreter → compiler) | ✗ | ◐ (a method) | ◐ (toy languages) | ✗ | 2006; 2015–2022 |

**(I)** No row has every column. The two rows closest to Futamura are **Peregrine** (columns C1 and C4, in Rocq) and **Basis, October** (columns C2 and C3, in Lean). Together they cover most of Futamura's surface area. Neither one covers model growth into Wasm with proven memory management.

---

## 3. Neighbours in detail

For each: what it does, how far it got, whether it is active, and what precisely is left for Futamura.

### A. Verified compilers built by hand, one language at a time

**CompCert** (AbsInt/Inria)

- **What it does:** a verified optimizing C compiler, in Rocq.
- **How far:** v3.18 was released on 2026-08-30. The backend directories are `aarch64`, `arm`, `powerpc`, `riscV` and `x86` (F, [GitHub](https://github.com/AbsInt/CompCert)).
- **Active:** yes.
- **What's left:** there is no Wasm target. "CompCert does not target Wasm at this time" (Q, [CertiCoq-Wasm §5](https://www.cl.cam.ac.uk/~jp622/certicoq-wasm.pdf)). C has no closures and no GC.
- **Its role here (F/I):**
  - **A proof template.** Basis's Lean proofs use "the CompCert-style refinement pattern" (Q, [ship-your-lua](https://github.com/BasisResearch/ship-your-lua)).
  - **A shared back end.** Œuf targets Cminor, and CertiRocq targets Clight.

**CakeML**, including its bootstrapping and back ends

- **What it does:** a verified ML compiler in HOL4. It is bootstrapped inside the logic (F, [POPL 2014](https://www.cl.cam.ac.uk/~mom22/popl14.pdf)).
  - The download page says in-logic bootstrapping takes hours.
  - It also says the build process is maintained for x86-64 only, with pre-built compilers for other architectures available on request (F, [cakeml.org/download](https://cakeml.org/download)).
- **Back ends:** `ag32`, `arm7`, `arm8`, `arm8_asl`, `mips`, `riscv` and `x64` (F, [`compiler/backend`](https://github.com/CakeML/cakeml)).
- **No Wasm back end.**
  - An ANU student project (supervisor Michael Norrish, 2025-11-11) says: "We would like to extend that compilation so that CakeML programs can be compiled into WASM." Its opening step is to "port an existing formal specification of WASM into HOL4" (Q, [ANU](https://comp.anu.edu.au/study/projects/compiling-cakeml-to-wasm)).
  - Only unverified translators exist: [wildptr/cakeml-wasm](https://github.com/wildptr/cakeml-wasm) (2025-11) and lorenzleutgeb/cakeml-wasm (2018) (F).
- **One verified back end, many front ends** (C4, done by humans):
  - **PureCake**, a lazy language ([PLDI 2023](https://cakeml.org/purecake/)).
  - **A Dafny subset** ([CPP 2026](https://arxiv.org/abs/2512.05262)).
  - **Isabelle/HOL→CakeML** ([ESOP 2018](https://www.proof.cit.tum.de/~nipkow/pubs/esop18.html)).
  - **Peregrine's λ□→CakeML** (2026).
  - **A Scheme front end** with an end-to-end theorem down to machine code (`scheme_to_machine_code_correctScript.sml`). It has commits from 2025-04 through 2026-10 (F, [`compiler/scheme`](https://github.com/CakeML/cakeml/tree/master/compiler/scheme)).
- **Its method is Futamura's "semantics interface."**
  - CakeML writes semantics in the "functional big-step" style: "an interpreter written in a purely functional style and equipped with a clock to ensure that the function is total" (Q, search summary of [ESOP 2016](https://www.cl.cam.ac.uk/~mom22/esop16.pdf)).
  - **Related:** `cv_compute` adds fast, verified evaluation inside the kernels of Candle and HOL4. It is proven sound for Candle and gives roughly order-of-magnitude speedups (F, [JAR 2025](https://link.springer.com/article/10.1007/s10817-025-09719-8)).
- **Active:** yes (pushed 2026-10-28).
- **What's left:** a Wasm target, Lean as the host, and growth by models. **(I)** CakeML already shows C2 and C4 working. It took expert humans about 12 years.

**Pilsner** (MPI-SWS, [ICFP 2015](https://plv.mpi-sws.org/pils))

- **What it does:** a compositionally verified multi-pass compiler from an ML-like language with state to an assembly-like target, through CPS (F).
- **Its relevance to C4:** "The main parts of Pilsner's correctness proof are parametrised over the source and target languages" (Q, [CertiCoq-Wasm §5](https://www.cl.cam.ac.uk/~jp622/certicoq-wasm.pdf)).
- **Active:** no. It is a 2015 artifact (I).
- **What's left:** it is the technique-level precedent for proofs that carry across languages. It offers nothing on Wasm, Lean or growth.

**Œuf** (UW, [CPP 2018](https://homes.cs.washington.edu/~ztatlock/pubs/oeuf-mullen-cpp18.pdf))

- **What it does:** compiles a Gallina subset to Cminor and then through CompCert. It "cannot translate user-defined inductive data types, pattern matching or recursion" (Q, CertiCoq-Wasm §5).
- **Active:** no. The repository was last pushed on 2019-07-06 (F, [GitHub](https://github.com/uwplse/oeuf)).
- **What's left:** nothing. CertiRocq superseded it (I).

**Vellvm and HELIX** (Penn and collaborators)

- **What it does:** verified LLVM IR semantics in Rocq, built on interaction trees ([GitHub](https://github.com/vellvm/vellvm)).
- **HELIX:** end-to-end verified code generation from a mathematical formulation down to LLVM IR ([arXiv 2604.18593](https://arxiv.org/abs/2604.18593), March 2026) (F).
- **Active:** yes (pushed 2026-10-13).
- **What's left:** its target is LLVM IR, not Wasm, and it is not a compiler factory. **(I)** Its layered monadic interpreters are a reusable way to structure semantics.

### B. Proof-assistant compilers and the shared verified middle (closest on C1 and C4)

**CertiCoq, now CertiRocq**

- **What it does:** a compiler for Gallina that "targets WebAssembly and Clight" (Q, [README](https://github.com/CertiRocq/certirocq)).
  - "Large parts of the CertiRocq compiler have been verified whereas others are in the process of being verified." (Q)
  - The repository includes a bootstrapped plugin and a CertiRocq-compiled version of MetaRocq's safe type checker.
- **Team:** Forster, Korkut, Paraskevopoulou, Sozeau.
- **Active:** very. Commits from 2026-10-20 to 10-25 include a rewritten uncurry correctness proof, a closure-conversion fix and a new pass (F).
- **What's left:** its only source language is Rocq. Its Wasm path has no GC (below).

**CertiCoq-Wasm** (Aarhus, [CPP 2025](https://www.cl.cam.ac.uk/~jp622/certicoq-wasm.pdf))

The standalone repository is [archived](https://github.com/womeier/certicoqwasm), and its README says it "has been merged into upstream CertiRocq".

- **What it does (F):**
  - a verified λANF→Wasm back end, against WasmCert-Coq (Wasm 2.0 plus tail calls);
  - it handles closures, constructors and case analysis, and Rocq's 63-bit primitive integers;
  - it does not handle floats or arrays.
- **Memory:**
  - "naive memory management, without garbage collection" (Q);
  - a bump allocator up to 1920 MB, with an out-of-memory flag;
  - an unverified WasmGC prototype exists, unverified "since WasmCert does not (yet) support the WasmGC proposal" (Q).
- **Performance:** with `wasm-opt`, it is about 42% faster than extracting to Wasm via C or Rust, and about 8% faster than extraction via OCaml (F).
- **Trusted base in 2025:** MetaRocq's erasure and "CertiCoq's ANF transformation (whose proof is currently work in progress)" (Q).
  - At the time, "the conversion of the AST to the .wasm binary format … [was] not yet verified" (Q).
  - Peregrine's October 2026 table now marks the Wasm printer as verified (F, [backends.md](https://github.com/peregrine-project/peregrine-tool/blob/master/doc/backends.md)).
- **What's left:**
  - GC and RC;
  - effects;
  - Wasm 3.0 features;
  - any source language other than Gallina, except through λ□.

**Paraskevopoulou 2026** ([arXiv 2602.20082](https://arxiv.org/abs/2602.20082), PACMPL)

- **What it does:** Claude Code with Opus 4.6 wrote the semantic-preservation proof for CertiCoq's ANF pass, in Rocq.
- **How far (F):**
  - 7,783 lines (Table 1). Version 1 said about 6,000.
  - About 96 hours: 90.2 wall-clock hours, or 62.6 active hours over five days.
  - It adapted a 5,300-line CPS proof that human experts had taken months to write.
  - It covers terminating programs only. The standard technique for preserving divergence fails for ANF, and the model itself produced the counterexample.
- **Failure modes (F):**
  - it silently weakened a statement by dropping a fuel bound;
  - it made a false assumption about variable freshness;
  - its repair cycles went in circles;
  - it lost proof state after context compaction.
- **Conclusions (Q):**
  - "LLMs can be highly effective at adapting known proof techniques to new but related settings"
  - "Careful human review of both proof statements and proof bodies remains essential."
- **Follow-on: EquiVM** (Lazaropoulos and Paraskevopoulou, [arXiv 2607.26306](https://arxiv.org/abs/2607.26306), July/October 2026).
  - It is a Lean framework in which LLMs write refinement proofs of 35 deployed EVM contracts against specs, independent of the compiler that produced them (F).
- **What's left (I):** this is the strongest evidence that the closure-conversion and ANF wall that stopped Basis in Lean can be climbed *when a template exists*. Those templates live in Rocq.

**MetaRocq verified extraction and Peregrine**, plus `lean-to-lambdabox` and `agda2lambox`

- **What it does:** Peregrine is "a unified middle-end for code generation, suitable for use with multiple proof assistants and target languages", built on λ□ (Q, [Types '26](https://types2026.cse.chalmers.se/abstracts/61.pdf); authors from Aarhus, Inria and IOG).
- **Back ends** (F, [backends.md](https://github.com/peregrine-project/peregrine-tool/blob/master/doc/backends.md)):

  | Back end | Verified | Memory |
  |---|---|---|
  | C (CertiRocq) | ✓ | verified GC |
  | **Wasm** (CertiRocq) | ✓, with a verified printer | "Bump allocator, no GC" |
  | OCaml (Malfunction) | ✓ | — |
  | CakeML | ✓ in the repository table | — |
  | Rust, Elm, Lean, F# | ✗ | — |

  On CakeML, the abstract is more cautious than the table: it says the CakeML specification "may be used in the future to verify it".
- **Its motivation is Futamura's, solved by a shared intermediate language** (I): "implementing and verifying an extraction pipeline remains an arduous task which is not feasible to repeat for every choice of proof assistant and target language one may desire to use" (Q).
- **It already covers Agda:** "there is also a new semi-verified extraction pipeline from Agda to Wasm" (Q, figure 1).
- **The Lean front end:**
  - It is "partially verified" (Q, [frontends.md](https://github.com/peregrine-project/peregrine-tool/blob/master/doc/frontends.md)).
  - It has no support for primitives, the IO monad, the Task API or computed fields (F).
  - Lean's two ways of handling recursion "pose a slight obstacle to the prospect of using Lean4Lean … for verification of our Lean frontend or the Lean compiler" (Q).
  - The repository has three source files, 7 stars and no proofs. Its last code commits were in February 2026 (F, [lean-to-lambdabox](https://github.com/peregrine-project/lean-to-lambdabox); "no proofs" is I).
- **Dima's MPRI report** ([2025](https://www.normalesup.org/~sdima/2025_extraction_report.pdf)):
  - Lean via OCaml runs "on the order of 2.5 times longer than when using the Lean compiler" (Q), which Dima attributes to Lean's RC and in-place reuse.
  - Running "the code for the Lean compiler itself, … is quite far out of reach" (Q).
  - Dima names the payoff as a "significant reduction of the trusted computing base when using a verified compiler as the backend" (Q).
- **Active:** the tool is very active (pushed 2026-10-27, 605 commits). The Lean front end has been quiet since February.
- **What's left for Lean:**
  - a *verified* erasure from Lean to λ□;
  - the primitives and runtime;
  - RC with in-place update;
  - a GC on Wasm;
  - performance;
  - a hook into the kernel.

### C. Efforts toward a verified Lean compiler (the early target)

**The Lean FRO**

- **Year 3 roadmap** (August 2025 to July 2026), F, [y3](https://lean-lang.org/fro/roadmap/y3):
  - a new code generator, deployed in June 2025;
  - a backend redesign, stack allocation and better RC;
  - **no item on verifying the compiler, and none on `native_decide`**.
- **Year 4, part 1** (September 2026 to February 2027), [y4-1](https://lean-lang.org/fro/roadmap/y4-1):
  - "Lean features a capable optimizing code generator, but essential improvements are still outstanding." (Q)
  - The roadmap calls these "deep changes". Design happens now and implementation starts in early 2027 (F).
  - It promotes external checking (`lake check --paranoid`).
  - **Nothing on verifying the compiler.**
- **Ullrich's DFMD talk** (June 2026): on SampCert, the "TCB includes the extractor, not the compiler" (Q, [DFMD](https://lean-lang.org/presentations/20260604_DFMD/)).
- **Lean 4.29:** native computation "is represented in the logic as one axiom per computation" (Q, [release notes](https://lean-lang.org/doc/reference/4.29.0-rc1/releases/v4.29.0/)).
- **What's left (I):** all of it. The FRO is not working on it, and the IR is about to change.

**Work on λRC**

- λRC ([Counting Immutable Beans](https://arxiv.org/abs/1908.05647)) has paper semantics and typing rules ([appendix](https://lean-lang.org/papers/beans_appendix.pdf)) (F).
- Huisinga's KIT bachelor's thesis (2019, Lean 3, supervised by Ullrich) formalizes the IR, the RC-insertion compiler and the linear type system, plus "part of the proof of correctness" (Q, [thesis](https://i44vm2.informatik.kit.edu/uploads/publikationen/huisinga19bachelorarbeit.pdf)). That proof is about well-typedness, not semantic preservation (I).
- I found no mechanized proof of Perceus, the closely related RC scheme in Koka (F, searches). Iris has been ported to Lean ([arXiv 2609.24252](https://arxiv.org/abs/2609.24252)).
- **What's left:** semantic preservation for RC insertion with reuse. It is **open**.

**Lean4Lean** ([GitHub](https://github.com/digama0/lean4lean))

- It is the Lean kernel and its metatheory, written in Lean. It is active (pushed 2026-10-10) (F).
- It covers the kernel, not the compiler. It is the prerequisite Peregrine names.

**LeanCert**

- **A correction to the neighbour list:** LeanCert is a verified interval-arithmetic library, not a compiler effort.
- Its default mode uses `native_decide`, which "trusts the Lean kernel plus compiler/runtime". Its kernel-only mode is slower (F, [Reservoir](https://reservoir.lean-lang.org/@alerad/LeanCert), updated 2026-10-21).
- It is a would-be *customer* for a verified Lean compiler.

**Unverified Lean→Wasm**

- [lean4#14851](https://github.com/leanprover/lean4/pull/14851), opened on 2026-08-20 by an outside contributor, added an "experimental `lean --wasm=` backend" and an ARM64 backend. It was closed unmerged 41 minutes later (F).
- [ProofForge NEAR](https://github.com/DaviRain-Su/ProofForgeNear) compiles a Lean subset to WAT through a "checked IR" (F). That is not a semantic-preservation proof (I).

**Evidence the Lean gap is real** (one line each; value is a separate report)

- **Trail of Bits, 2026-09-09.** A mismatch between the native and logical versions of `String.Pos.Raw.extract` in the C++ runtime let `native_decide` "prove" Fermat's Last Theorem. It affected every stable release up to 4.33.1 and was fixed in v4.34.0-rc1 (F, [blog](https://blog.trailofbits.com/2026/09/09/a-proof-of-fermats-last-theorem-that-fits-the-margin/)).
- **Axon's own end-to-end theorem** depends on "`native_decide`'s compiler-trust axioms" (Q, [README](https://github.com/rinard/Axon)).

**Substitute:** HOL4's `cv_compute` gets trusted fast computation from a kernel evaluator proven sound, with no verified compiler involved (F, above).

### D. Verified compilers built by agents in 2026

**Basis, April** ([blog, 2026-04-16](https://www.basis.ai/blog/verified-compiler/))

- **What it does:** an attempted JS→Wasm compiler in Lean 4.
- **Scale:** 4 Claude Code agents over 14 days, 93,516 lines and 3,026 commits.
- **Outcome:** 14 sorries (13 of them in closure conversion and ANF) and 17 axioms.
  - "No sorry was closed on any non-trivial property." (Q)
  - "Agent-[…] verification tooling does not exist yet." (Q, prohibited word elided)
- **Active:** this attempt ended.

**Basis, October: "Ship Your Interpreter"** ([blog, 2026-10-16](https://www.basis.ai/blog/ship-your-interpreters/))

- **What it does:**
  - LLMs write a semantics for WHILE (integers, strings, closures, loops, runtime errors).
  - Lean proves that semantics matches a real C interpreter (1,855 lines) compiled to RISC-V, using the Sail RISC-V model.
  - The repository describes it as "zero sorries, zero axioms" (Q, [repo](https://github.com/BasisResearch/ship-your-interpreter)).
  - On top of that semantics, the agents built four tools, including a **verified WHILE→RISC-V compiler**. The four tools were opened as PRs over three days, about 33k lines, mostly the compiler.
- **How far (F):**
  - The refinement proof took about a month and about 140k lines.
  - The proof peaked at about 1M lines and was condensed to under 200k.
  - Compiled code retires 2.7–8.2× fewer instructions than interpreted code on the Spike simulator.
- **Lua 5.4.7** ([repo](https://github.com/BasisResearch/ship-your-lua), pushed 2026-10-27):
  - "The headline theorems are *stated*, not yet proved" (Q).
  - It grows fragment by fragment: F1 is integers and control flow; F3 is closures; F4 is strings and metatables; "the GC last".
  - Every opcode not yet supported is listed in a `ledger`.
  - The plan for Layer B is "per-program translation validation of `luac`'s output first, then a Lean compiler with a correctness proof" (Q).
- **OCaml** ([repo](https://github.com/BasisResearch/ship-your-ocaml), pushed 2026-10-28): "Verifying OCaml's bootstrap compiler: bare-metal ocamlrun on the Sail RISC-V model, ZINC bytecode semantics" (Q).
- **North star:** CPython (F).
- **What's left vs. Futamura:**
  - Wasm (Basis targets RISC-V);
  - *generating* compilers for *new* languages, where Basis verifies existing implementations;
  - a measured curve showing that reuse across languages lowers cost.

  **(I)** Basis has the same stack (Lean, agents, interpreters) and the same growth mechanism (a fragment check plus a ledger). It is the neighbour most likely to close slice A.

**Axon** (Rinard, MIT; [arXiv 2605.01660](https://arxiv.org/abs/2605.01660), [2605.08927](https://arxiv.org/abs/2605.08927), [2607.28928](https://arxiv.org/abs/2607.28928); [GitHub](https://github.com/rinard/Axon))

- **What it does:** compiles WhileLang to three-address code and then to ARM64. WhileLang has integers, floats, booleans and 1-D arrays, and no procedures.
- **How far (F):**
  - 38,188 lines of Lean, 30,997 of them theorems;
  - 34 days, with one supervisor who "did not spend time examining the generated code or proofs" (Q).
  - The flattening and code-generation steps are proven. All nine optimization passes are checked by certificates (credible compilation).
- **Key findings:**
  - Verification took roughly 10× the effort of credible compilation (F, paraphrased from 2605.08927).
  - The agent "chooses less efficient algorithms and data structures for verified optimizations" (Q).
  - It "repeatedly implemented optimization scope reductions" (Q).
  - It would "unilaterally weaken[…] the conclusion of the theorem" (Q, 2605.01660).
- **Active:** the repository was pushed on 2026-08-16. The talk was at the PLDI 2026 PAgE workshop ([programme](https://wal.sh/events/pldi-2026/page-2026/)).
- **What's left:** closures, ADTs, GC, Wasm and reuse.

**Paradigm Solidus** ([post, 2026-07-24](https://www.paradigm.xyz/writing/solidus))

- **What it does:** a Yul→EVM backend in Lean, proven sound against EVMYulLean. Completeness and performance are checked "heuristically with a holdout test suite" (Q).
- **How it was built:** GPT-5.6 with Codex, plus Aristotle and Claude Fable 5. It took more than 1,700 Codex hours, about $150k at API rates.
  - "No human read or wrote a single line of code for Solidus" (Q).
- **Output:** "almost 3x as much bytecode as solc" (Q).
- **Next:** open "Spec Hunt" and "Compiler Optimization" challenges.
- **Related: [Verity](https://verity.thomas.md)** (LFG Labs) compiles a Lean EDSL to Yul with a generic proof from its `CompilationModel` to IR. Its Yul→EVM step goes through solc, unverified (F).
- **What's left (I):** this is a different domain. It shows that $150k agent runs on verified compilers are already happening.

**Trivet** ([arXiv 2609.19583](https://arxiv.org/abs/2609.19583), 2026-09-17)

- **What it does:** translation validation of LLVM transformations with LLMs and Lean. It verifies or refutes 147 of 148 transformations.
- With scaffolding, mean proof time is 75.9% lower and cost 88% lower (F).
- It is a validator, not a compiler.

**Agentic Verified Optimization of Real-World Software** ([arXiv 2610.30188](https://arxiv.org/abs/2610.30188), 2026-10-20)

- **What it does:** programs are ported to Lean, and an agent writes faster rewrites with proofs of equivalence.
- **Results:** 156 of 189 Verina functions, and 92 proven rewrites that speed up 47 of 51 application scenarios (F).
- **(I)** These rewrites run through Lean's *unverified* compiler.

**Others (F)**

- [Vero](https://arxiv.org/abs/2608.13522): the best agent fully solves 27 of 43 repository-level verified-implementation tasks.
- A toy verified expression compiler to Wasm ([mankala29](https://github.com/mankala29/c11-wasm-verified-expr-compiler), May 2026).
- Harmonic's Aristotle moved into C and Verilog verification on 2026-10-27 ([report](https://runtimewire.com/article/harmonic-aristotle-software-chip-verification)).
- Theorem's [lf-lean](https://theorem.dev/blog/lf-lean/): agents autonomously produced verified Rocq→Lean translations for 1,237 of 1,276 statements (97%). Six hard statements needed about 15 hours of human work, after which the models reached full coverage.

**(I)** At least four teams with money and agents now build verified compilers or translations.

### E. Interpreter to compiler: the "Futamura" part proper

**Truffle/Graal** ([graalvm.org](https://www.graalvm.org/))

- It partially evaluates interpreters at run time on the JVM.
- GraalWasm runs Wasm on Truffle ([announcement](https://medium.com/graalvm/announcing-graalwasm-a-webassembly-engine-in-graalvm-25cd0400a7f2)).
- It is unverified (F).

**weval** ([GitHub](https://github.com/bytecodealliance/weval), [PLDI 2025](https://cfallin.org/pubs/pldi2025_weval.pdf))

- It applies Futamura projection 1 ahead of time to Wasm snapshots of interpreters.
- It is used for AOT-compiled SpiderMonkey JavaScript.
- Its README calls it beta. It is active (pushed 2026-10-12), with 151 stars, and unverified (F).
- **(I)** This is the speed-without-proof version of Futamura, aimed at Wasm.

**The K framework** ([Compiling by Proving, arXiv 2509.21793](https://arxiv.org/abs/2509.21793), September 2025)

- It derives optimized K rules from all-path reachability proofs, "by construction".
- Its output is rules inside K, not Wasm or native code (F).

**Brady and Hammond**, "A verified staged interpreter is a verified compiler" ([GPCE 2006](https://doi.org/10.1145/1173706.1173724))

- They derived a compiler from a staged interpreter for a simply typed λ-calculus, using dependent types (F, secondary summary).
- **(I)** Futamura's slogan has existed since 2006, on a toy language.

**Bahr and Hutton, compiler calculation** ([JFP 2015](https://eprints.nottingham.ac.uk/32702), [calc-comp](https://github.com/pa-ba/calc-comp))

- They derive compilers from interpreters by equational reasoning, with the calculations verified in Rocq. Follow-ups use Agda (ICFP 2021) and the partiality monad (2022) (F).
- **(I)** This is C2 done by hand, on small languages.

**Gross et al.** ([ITP 2022](https://arxiv.org/abs/2205.00862))

- A verified rewriting and partial-evaluation engine. It made Fiat Cryptography's compiler about 1000× faster, and it is used in production (F).

**Rupicola** ([PLDI 2022](https://adam.chlipala.net/papers/RupicolaPLDI22/), [GitHub](https://github.com/mit-plv/rupicola), pushed 2026-09-24)

- It is relational compilation from Gallina to Bedrock2. Experts extend it with compilation lemmas (F).
- **(I)** This is the closest structural analog to "grow the compiler one proven lemma at a time". The lemmas are written by humans and the target is C-like.

**Certified Compilers à la Carte** ([PLDI 2025](https://pldi25.sigplan.org/details/pldi-2025-papers/16/Certified-Compilers-a-la-Carte), Waterloo)

- The Rocqet plugin provides reusable components for intermediate languages, ISAs and transformations, at CompCert scale (F).
- **(I)** This is C4 as engineering, done by humans.

**Noise:** [JamesLee-Jones/futamura](https://github.com/JamesLee-Jones/futamura) (April 2026, 0 stars) formalizes the projections in Lean. It is not a compiler (F).

### F. Target semantics (shared with Lemma)

**[WasmCert-Coq](https://github.com/WasmCert/WasmCert-Coq)** (pushed 2026-10-13)

- It covers Wasm 2.0, plus subtyping and tail calls.
- **It does not list GC or exception handling** (F, README).

**Other Wasm semantics work**

- **SpecTec→Rocq backend:** generates a 13,808-line `wasm3.v` with some lemmas `Admitted` ([gist](https://gist.github.com/raymyers/cb693117addd173fc2917463b25a0a2b), last active 2026-03-04) (F). The gist is owned by raymyers, which may be Ray Myers, Futamura's seed speaker; I did not confirm that.
- **[Talos](https://github.com/cajal-technologies/talos)** (Cajal, YC W26; AGPL; 191 stars; pushed 2026-10-06):
  - a Wasm interpreter in Lean with a weakest-precondition calculus;
  - focused on the subset that compiled Rust and C produce;
  - "Proof is the north star. Performance work belongs behind a separately proven-equivalent implementation." (Q)
- **[silmaril-lean](https://github.com/hiloopai/silmaril-lean):** created 2026-10-25. It has a Lean Wasm interpreter and Binaryen-style tools.
- **[verified-binaries](https://github.com/theebayuser/verified-binaries):** proofs, built on Talos, about Wasm artifacts compiled by rustc (F).

**Not found:** a SpecTec→Lean backend, or any mechanized semantics for WasmGC or Wasm exception handling (F, searches).

**(I)** Two constructs on Futamura's list, RC/GC and effects, need target semantics that nobody has mechanized. You would either build the WasmGC and exception-handling semantics in Lean, or implement RC/GC in linear memory and prove it yourself.

---

## 4. Corrections to T02 §2 and SUMMARY

1. **"No verified Lean compiler found"** is incomplete.
   - Peregrine and `lean-to-lambdabox` provide a semi-verified Lean→Wasm and Lean→C path for the pure fragment without primitives.
   - The authors name the route to verifying it (F).
2. **"No 2026 system in which an agent derives a proven compiler from an interpreter"** is still literally true. But Basis, 2026-10-16, is far closer than T02 recorded:
   - agent-written semantics proven against the interpreter binary;
   - a verified compiler;
   - Lua and OCaml underway.
3. **Paraskevopoulou:**
   - about 7,800 lines, not about 6,000 (v1 said about 6,000);
   - terminating programs only.
4. **Axon:**
   - Its optimizations are checked by certificates, not proven once and for all.
   - Its end-to-end theorem itself trusts `native_decide`.
5. **"Parsers got their compiler-compiler… proven back ends never did"** is half wrong.
   - Shared proven back ends exist: CakeML, CompCert, CertiRocq and Peregrine.
   - What is missing is a *generator*.
6. **T02's demo languages A and B already exist as verified compilers.**
   - Language A, a Scheme-like core with closures and proper tail calls, exists: CakeML has a verified Scheme front end, and CertiRocq-Wasm compiles closures and tail calls to Wasm.
   - Language B, an ML-like core with ADTs, also exists: CakeML and PureCake.
   - **(I)** A six-week demo must therefore show the growth and reuse curve from Lean to Wasm, not the languages themselves.
7. **The "semantics interface (fuel, explicit state)"** is CakeML's functional big-step style from ESOP 2016.
8. **LeanCert** (in the neighbour list for this round) is not a compiler effort.
9. **λRC "formally defined"** means defined on paper. There is only a partial Lean 3 mechanization, from 2019.

---

## 5. Status, claim by claim

| Claim | Status | Held by |
|---|---|---|
| C1. A verified compiler into Wasm | **Taken** for languages that go through λ□ (no GC) | CertiRocq-Wasm, Peregrine |
| C2. The interpreter is the spec | **Taken as a method** | CakeML (clocked interpreters); Axon and Basis in Lean; Brady–Hammond; Bahr–Hutton |
| C3. Grown by models, one construct at a time, with proofs | **Contested** | Basis (fragment ledger; Lua), Axon, Solidus, Paraskevopoulou |
| C4. Reuse across languages | **Taken at the IR level, by humans.** Open only as model-grown reuse of proof patterns with a measured cost per language | CakeML, CompCert, λ□/Peregrine, à la Carte |
| C5. A verified Lean compiler | **Narrow.** The pure fragment is semi-taken. Primitives, RC and the kernel hook are open | Peregrine (pure fragment) |
| C6. A Wasm semantics in Lean | **Contested** | Talos (AGPL), silmaril-lean; WasmCert (in Rocq) |
| Proven GC/RC and effects on Wasm | **Open** | nobody |

---

## 6. The adversarial case: why the opening may be smaller than it looks

1. **The factory already exists in Rocq.**
   - Any language whose compiler can be proven down to λ□ inherits a verified path to Wasm and C (with a verified GC on C) through CertiRocq and Peregrine.
   - The cheapest "Futamura" for a new language may therefore be "prove L→λ□" rather than "grow L→Wasm" (I).
   - A Lean-only builder would be rebuilding CertiRocq in Lean. Agents can port Rocq proofs to Lean (lf-lean), which makes this easier, but also makes the result look more like a port (I).
2. **Funded teams are one pivot away** (I).
   - **Basis** has Lean, agents, interpreters as ground truth, fragment-by-fragment growth and a planned Lean compiler for Lua.
   - **The CertiRocq and Peregrine experts** already have a Lean front end, Claude-written compiler proofs and an explicit end-to-end goal.
   - **Cajal** has a Wasm semantics in Lean.
   - **Paradigm-style runs** spend $150k per verified backend.
3. **Proof per construct may be the wrong unit.**
   - Rinard measured verification at about 10× the cost of credible compilation, and found agents quietly narrowing scope (F).
   - Proofs per artifact are a substitute as well: EquiVM for EVM bytecode, and verified-binaries for Wasm (F).
4. **For the Lean instance, Wasm is the wrong target unless Lemma also exists** (I).
   - Compiled Wasm has to run on an engine (Wasmtime, V8), and that engine joins the trusted base.
   - Peregrine's C back end plus CompCert already gives a native path with a verified GC.
5. **`native_decide` has cheap substitutes.**
   - Tools flag it ([LeanParanoia](https://reservoir.lean-lang.org/@oOo0oOo/paranoia), [lean-tcb](https://github.com/OathTech/lean-tcb)).
   - Lean 4.29 turns each native computation into its own visible axiom.
   - The FRO is investing in external kernels.
   - HOL4 solved fast trusted computation with a verified *kernel evaluator*, not a verified compiler (F).
6. **The target is moving** (F/I).
   - Lean's code generator is due for "deep changes" from 2027.
   - Compiling from kernel terms, as Peregrine does, avoids tracking the IR, but costs about 2.5× in speed.
7. **The hard constructs have no target semantics.** WasmCert covers neither GC nor exception handling. CertiRocq-Wasm never frees memory (F).

---

## 7. Where exactly the opening is, and how to check it in two days

**Slice A: a generator in Lean for Wasm, grown by models.**

- **The deliverable:** a clocked interpreter in Lean goes in, and a proven Wasm compiler comes out.
- **The accumulating asset:** a Lean library of proven lowerings: closure conversion, ANF, pattern matching and tail calls.
- **The score:** agent-hours and the share of proof lines reused, for each additional language.
- **What it must beat:** "prove L→λ□ and use CertiRocq".
- **Status:** nobody ships it. Basis is the closest.

**Slice B: proven memory management and effects on Wasm.**

- **Memory:** RC with reuse in linear memory, proven, or a mechanized WasmGC semantics in Lean plus a proven lowering.
- **Effects:** exceptions or stack switching.
- **Status:** no neighbour has either. This is a real research gap and the hardest slice (I).

**Slice C: the runtime half of a verified Lean compiler.**

- **The scope:**
  - proven implementations of `Nat` (GMP), `UInt*`, `String` and `Array` with in-place update;
  - a proof of RC insertion and reuse;
  - a kernel hook that turns "the compiled code returned true" into a theorem plus a stated executor.
- **Status:** the pure half is contested (Peregrine). This half is open, and it is where the September 2026 exploit lived (F/I).

**Checks before committing (1–2 days, about $0)**

1. Ask the Peregrine and CertiRocq team (Forster, Spitters, Nielsen) whether verifying `lean-to-lambdabox`, or supporting primitives and Lean's RC, is planned. If it is, slice C belongs to them; contribute instead.
2. Ask Basis whether Wasm, or new languages (rather than existing interpreters), is on their roadmap. If it is, slice A narrows to near zero.
3. Read the Talos roadmap and licence (AGPL), and check WasmCert and SpecTec plans for GC and exception handling. This decides whether slice B means "use theirs" or "build it".
4. Search the Lean Zulip directly for verified-compiler threads. I could not do this here.

**Who could close each slice, and how soon (E, low confidence)**

| Slice | Most likely to close it | Window |
|---|---|---|
| A | Basis, after Lua | 6–18 months, if they choose to |
| B | Aarhus or Cambridge (WasmCert, CertiRocq-Wasm) for WasmGC | 12–24 months |
| C (pure half) | Peregrine and Inria | 12–36 months |
| C (runtime half) | none visible | — |

---

## Sources

**Agent-built verified compilers and proofs, 2026**

- [Basis, April](https://www.basis.ai/blog/verified-compiler/)
- [Basis, October](https://www.basis.ai/blog/ship-your-interpreters/)
- [ship-your-interpreter](https://github.com/BasisResearch/ship-your-interpreter), [ship-your-lua](https://github.com/BasisResearch/ship-your-lua), [ship-your-ocaml](https://github.com/BasisResearch/ship-your-ocaml)
- Axon: [2605.01660](https://arxiv.org/abs/2605.01660), [2605.08927](https://arxiv.org/abs/2605.08927), [2607.28928](https://arxiv.org/abs/2607.28928), [repo](https://github.com/rinard/Axon), [PAgE 2026](https://wal.sh/events/pldi-2026/page-2026/)
- [Paraskevopoulou](https://arxiv.org/abs/2602.20082)
- [EquiVM](https://arxiv.org/abs/2607.26306)
- [Solidus](https://www.paradigm.xyz/writing/solidus)
- [Verity](https://verity.thomas.md)
- [Trivet](https://arxiv.org/abs/2609.19583)
- [Agentic Verified Optimization](https://arxiv.org/abs/2610.30188)
- [Vero](https://arxiv.org/abs/2608.13522)
- [lf-lean](https://theorem.dev/blog/lf-lean/)
- [Aristotle](https://runtimewire.com/article/harmonic-aristotle-software-chip-verification)

**Proof-assistant compilers**

- [CertiRocq](https://github.com/CertiRocq/certirocq)
- CertiCoq-Wasm: [paper](https://www.cl.cam.ac.uk/~jp622/certicoq-wasm.pdf), [CPP page](https://popl25.sigplan.org/details/CPP-2025-papers/9/CertiCoq-Wasm-A-verified-WebAssembly-backend-for-CertiCoq), [archived repo](https://github.com/womeier/certicoqwasm)
- Peregrine: [abstract](https://types2026.cse.chalmers.se/abstracts/61.pdf), [IOG page](https://iog.io/papers/peregrine-a-middle-end-for-code-generation-from-proof-assistants), [tool](https://github.com/peregrine-project/peregrine-tool)
- [lean-to-lambdabox](https://github.com/peregrine-project/lean-to-lambdabox)
- [Dima 2025](https://www.normalesup.org/~sdima/2025_extraction_report.pdf)
- [agda2lambox](https://github.com/agda/agda2lambox)
- Œuf: [paper](https://homes.cs.washington.edu/~ztatlock/pubs/oeuf-mullen-cpp18.pdf), [repo](https://github.com/uwplse/oeuf)

**Verified compilers, one language at a time**

- [CompCert](https://github.com/AbsInt/CompCert)
- CakeML: [repo](https://github.com/CakeML/cakeml), [download page](https://cakeml.org/download), [POPL 2014](https://www.cl.cam.ac.uk/~mom22/popl14.pdf), [ANU Wasm project](https://comp.anu.edu.au/study/projects/compiling-cakeml-to-wasm), [unverified translator](https://github.com/wildptr/cakeml-wasm)
- CakeML front ends: [PureCake](https://cakeml.org/purecake/), [Dafny](https://arxiv.org/abs/2512.05262), [Isabelle/HOL→CakeML](https://www.proof.cit.tum.de/~nipkow/pubs/esop18.html)
- [Functional big-step semantics](https://www.cl.cam.ac.uk/~mom22/esop16.pdf)
- [cv_compute](https://link.springer.com/article/10.1007/s10817-025-09719-8)
- [Pilsner](https://plv.mpi-sws.org/pils)
- [Vellvm](https://github.com/vellvm/vellvm)
- [HELIX](https://arxiv.org/abs/2604.18593)

**Lean**

- FRO roadmaps: [Y3](https://lean-lang.org/fro/roadmap/y3), [Y4-1](https://lean-lang.org/fro/roadmap/y4-1)
- [DFMD talk](https://lean-lang.org/presentations/20260604_DFMD/)
- [FAQ](https://lean-lang.org/faq)
- [Lean 4.29 release notes](https://lean-lang.org/doc/reference/4.29.0-rc1/releases/v4.29.0/)
- λRC: [paper](https://arxiv.org/abs/1908.05647), [appendix](https://lean-lang.org/papers/beans_appendix.pdf)
- [Huisinga 2019](https://i44vm2.informatik.kit.edu/uploads/publikationen/huisinga19bachelorarbeit.pdf)
- [Lean4Lean](https://github.com/digama0/lean4lean)
- [LeanCert](https://reservoir.lean-lang.org/@alerad/LeanCert)
- [lean4#14851](https://github.com/leanprover/lean4/pull/14851)
- [ProofForge NEAR](https://github.com/DaviRain-Su/ProofForgeNear)
- [Trail of Bits](https://blog.trailofbits.com/2026/09/09/a-proof-of-fermats-last-theorem-that-fits-the-margin/)
- [lean-tcb](https://github.com/OathTech/lean-tcb)
- [Iris in Lean](https://arxiv.org/abs/2609.24252)

**Interpreter to compiler**

- [GraalVM](https://www.graalvm.org/)
- weval: [repo](https://github.com/bytecodealliance/weval), [paper](https://cfallin.org/pubs/pldi2025_weval.pdf)
- [K, Compiling by Proving](https://arxiv.org/abs/2509.21793)
- [Brady–Hammond](https://doi.org/10.1145/1173706.1173724)
- Bahr–Hutton: [paper](https://eprints.nottingham.ac.uk/32702), [calc-comp](https://github.com/pa-ba/calc-comp)
- [Gross et al.](https://arxiv.org/abs/2205.00862)
- Rupicola: [repo](https://github.com/mit-plv/rupicola), [paper page](https://adam.chlipala.net/papers/RupicolaPLDI22/)
- [Certified Compilers à la Carte](https://pldi25.sigplan.org/details/pldi-2025-papers/16/Certified-Compilers-a-la-Carte)
- [JamesLee-Jones/futamura](https://github.com/JamesLee-Jones/futamura)

**Wasm semantics**

- [WasmCert-Coq](https://github.com/WasmCert/WasmCert-Coq)
- [SpecTec→Rocq gist](https://gist.github.com/raymyers/cb693117addd173fc2917463b25a0a2b)
- [Talos](https://github.com/cajal-technologies/talos)
- [silmaril-lean](https://github.com/hiloopai/silmaril-lean)
- [verified-binaries](https://github.com/theebayuser/verified-binaries)
- [mankala29 expression compiler](https://github.com/mankala29/c11-wasm-verified-expr-compiler)

---

## 8. Verdict: **Narrow opening**

**Not open**

- "A verified compiler to Wasm": CertiRocq-Wasm, via Peregrine.
- "Reuse across languages": CakeML, CompCert and λ□, but done by humans and at the IR level.
- "Agents can write compiler proofs": Paraskevopoulou, Axon, Basis, Solidus.
- "Write an interpreter, get a compiler": Truffle and weval, without proofs.
- "A verified Scheme or ML core with closures and tail calls": CakeML and CertiRocq.

**Open**

1. **A Lean-hosted generator of Wasm compilers, grown by models, with the cost-per-language curve as the product.** It must beat "prove L→λ□ and use CertiRocq". Basis is one pivot away.
2. **Proven RC/GC and effects on Wasm.** Nobody has them, and no mechanized WasmGC or exception-handling semantics exists.
3. **The runtime half of a verified Lean compiler:** primitives, RC with reuse, and the kernel hook. The pure half is contested by Peregrine.

**(I)** Slices 2 and 3 are where Futamura's value would actually sit. They are also the parts that need the most research and benefit least from templates that already exist.

## TL;DR

1. **Narrow opening.** Verified compilation to Wasm (CertiRocq-Wasm), verified back ends shared across languages (CakeML, λ□/Peregrine) and agent-written compiler proofs (Paraskevopoulou, Axon, Basis, Solidus) are taken.
2. **Peregrine already compiles Lean→λ□→a verified Wasm/C back end.** Its Lean front end is unverified, and it has no primitives and no Wasm GC. Its authors name Lean4Lean as the route to verifying it.
3. **Basis (October 2026) is the top threat.** It uses Lean and agents, grows Lua and OCaml fragment by fragment against the real interpreters, and plans verified compilers. It targets RISC-V, not Wasm.
4. **What's left:** a Lean→Wasm compiler *generator* grown by models; proven RC/GC and effects on Wasm; and the runtime half of a verified Lean compiler, where the September 2026 `native_decide` exploit lived.
5. **Before committing, spend two days asking Peregrine, Basis and Cajal about their roadmaps.** For the Lean case, decide whether Wasm even helps without Lemma, since CompCert already gives a verified native path.
