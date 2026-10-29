# T04 — Science, mathematics and knowledge: engines that grow checked mathematics

Research date: **2026-10-29**. Read against `BRIEF-tailwind.md`. Sources read:
- **In full:** the transcripts p3-45 (de Moura), p3-46 (Tao), p3-19 (Omar) and p3-20 (Myers).
- **Around every cited line:** p3-32 (Campbell), p3-44 (Beck), p3-09 (Kim), p3-38 (Lattner), 09 (Spanos) and 10 (Wu).
- **Ledgers and background:** the E13/E17 ledger rows for these talks, `ambition/A05-science.md`, `ambition/A09-critic.md`,
  `SUMMARY.md` and the research summary's kill list.

**Labels:**
- **Q:** transcript quotation in caption wording. Timestamps are minute buckets. Brackets mark my corrections of caption errors.
- **F:** externally sourced fact, linked, as of the research date.
- **I:** inference or proposed design.
- **E:** estimate or proposed threshold.

Every plan, demo and number below is **I/E**: nothing has been built. No Python anywhere. The engines and proofs are in
Lean 4, the harnesses in Rust or TypeScript, and the numeric oracles use C libraries (Arb/FLINT, MPFR) through FFI.

**I — Recommendation:** build **GrowCAS**, a computer algebra system that answers every query with a Lean-checked
theorem stating exactly where the answer holds, and that grows a new proven rule each time a problem in its corpus stumps
it.
- **The funded lane is proof.** New theorems, formalized papers and open problems are the most heavily funded part of AI
  for mathematics.
- **The open lane is checked computation.** The integrals, sums and handbook formulas that scientists copy into their
  work have bridges and tactics, but no growing artifact.
- **Runners-up:** a proven handbook of special-function formulas, and an implication atlas for topology in the shape of
  Tao's Equational Theories Project (ETP).

---

## The seeds in this area

| Speaker | File, time | Q — the sentence | I — what it opens |
|---|---|---|---|
| Leonardo de Moura, Lean creator | [p3-45 [0:33:00–0:34:00]](../transcripts/p3-45-ryan-peterman-creator-of-lean-handwritten-math-will-change-dramaticall.txt) ([video](https://www.youtube.com/watch?v=KzdYKeAqWhY&t=1980)) | "the big labs, they only start training for formal verification lean very recently … The behavior we see today that is already amazing will get way better in the future. uh the costs will reduce" | The tailwind is predicted by the person who owns the checker. |
| de Moura | [p3-45 [1:02:00–1:03:00]](../transcripts/p3-45-ryan-peterman-creator-of-lean-handwritten-math-will-change-dramaticall.txt) ([video](https://www.youtube.com/watch?v=KzdYKeAqWhY&t=3720)) | "when you have proofs it enables optimizations for free … if the AI is telling you, look, I optimize it. It still computes the same thing. Here's the proof. Uh this is a game changer" | A proof makes a model's output something nobody has to review. |
| de Moura | [p3-45 [1:03:00–1:04:00]](../transcripts/p3-45-ryan-peterman-creator-of-lean-handwritten-math-will-change-dramaticall.txt) ([video](https://www.youtube.com/watch?v=KzdYKeAqWhY&t=3780)) | "for [software verification] is the opposite right these statements are big I mean but the proofs are shallow" | The side conditions of a computation are big statements with shallow proofs, the kind of proof models already find. |
| Cyrus Omar, Hazel (Michigan) | [p3-19 [1:02:00]](../transcripts/p3-19-jane-street-trustworthy-human-ai-collaboration-in-a-live-type-theoreti.txt) ([video](https://www.youtube.com/watch?v=fB_lklm7xgU&t=3720)) | "I can build a library for whatever I want in Hazel by just like leaving [Claude] running overnight … instead of just like having to confront network effects and the billion dollars of software engineering effort is needed to build a standard library" | A decades-old, very expensive library, such as a CAS, can now be rebuilt by one person. |
| Demetri Spanos, AI/ML consultant | [09 [0:12:00]](../transcripts/09-a-life-engineered-what-senior-engineers-are-actually-doing-about-ai.txt) ([video](https://www.youtube.com/watch?v=DF5M5CJi9sM&t=720)) | "mathematical computing … it really really matters if you get like a minus sign wrong … you can't easily verify the correctness just from the outputs" | Practitioners still read math code line by line, because a wrong sign doesn't show in the output. |
| Joseph Kim, OpenAI | [p3-09 [12:00–13:00]](../transcripts/p3-09-ai-engineer-how-openai-built-chatgpt-for-bankers-and-analysts-joseph-k.txt) ([video](https://www.youtube.com/watch?v=opHmX7qClzE&t=720)) | "719 mathematical research manuscripts across 372 families of results"; "That threshold depends on the work you're doing and how much checking or human review it requires." | Machine mathematics is abundant; checking is the bottleneck. |
| Terence Tao | [p3-46 [09:00]](../transcripts/p3-46-big-think-clips-the-paradox-at-the-heart-of-ai-and-science-terence-tao.txt) ([video](https://www.youtube.com/watch?v=svl_1upFpQo&t=540)) | "sometimes the proof is complete rubbish but if you loop it enough and you have enough checks um you can actually uh start having a positive success rate" | The check, not the generator, decides what is usable. |
| Tao | [p3-46 [12:00–13:00]](../transcripts/p3-46-big-think-clips-the-paradox-at-the-heart-of-ai-and-science-terence-tao.txt) ([video](https://www.youtube.com/watch?v=svl_1upFpQo&t=720)) | "we just didn't look at the negative case too much"; "point them at a thousand problems and they solve 5% those problems. That's still 50 problems solved." | Models already beat people on breadth over a fixed corpus. |
| Richard Campbell, NDC keynote | [p3-32 [48:00]](../transcripts/p3-32-ndc-conferences-keynote-after-the-ai-hype-what-s-real-and-what-s-next-.txt) ([video](https://www.youtube.com/watch?v=uWnUnMphmPM&t=2880)) | "He computed the 200 million most common protein fold sets possibly needed and published them for free." | The AlphaFold-DB shape: compute a whole space once, then publish it. |
| Ray Myers, ex-OpenHands | [p3-20 [32:00]](../transcripts/p3-20-software-should-work-code-worth-writing-ray-myers-ssw-2026.txt) ([video](https://www.youtube.com/watch?v=mZgglPK8Rg0&t=1920)) | "You do not have to trust my formalization strategy because the process produced a oneline reproduction." | A machine-checked counterexample needs no trust in whoever wrote the formalization. |
| Kent Beck | [p3-44 [38:00]](../transcripts/p3-44-rise8-kent-beck-software-engineering-in-the-age-of-ai-prodacity-2026.txt) ([video](https://www.youtube.com/watch?v=F8fBgDCf2Y4&t=2280)) | "What happens if I change one element? Oh, I got to wind back and even if it's faster because I have the genie helping, it's still a drag on my ability to change." | Proofs must be structured so that change stays cheap. This is a design constraint. |

---

## What is already taken (F, as of 2026-10-29)

The brief warns that this lane is heavily funded, and the search confirms it. Which ideas are left follows from who owns
what.

| Lane | Who has it | I — what remains |
|---|---|---|
| Community formal library and autoformalized textbooks | **Mathlib Initiative:** over 2M lines and 750 contributors. Its Formal Frontier targets 20 autoformalized textbooks by December 2026. **Lean FRO:** Amazon's largest donation (July 2026). **AI for Math Fund:** $31.5M. All per A05's checked sources. | Contribute to it; don't compete with it. |
| Agent-maintained formal archive | **Lean Pool** (V. Ilin, [arXiv 2609.25199](https://arxiv.org/abs/2609.25199), September 2026): 211 projects and 3,228,485 lines. Agents bump Mathlib versions, repair breakage and compress proofs, and an LLM reviews faithfulness. It calls itself "the formal analogue of the arXiv.org website". | Taken, including proof compression and optimization. |
| Open problems and OEIS conjectures | **DeepMind AlphaProof Nexus** ([arXiv 2605.22763](https://arxiv.org/abs/2605.22763)): 9 of 353 Erdős problems and 44 of 492 OEIS conjectures, selected from 2,649. Before attacking a conjecture, the agent had to prove "test lemmas" verifying the initial terms of each sequence against its formal definition. **[formal-conjectures](https://github.com/google-deepmind/formal-conjectures)** has an OEIS directory, and individuals already post AI-proved OEIS conjectures there ([issue #6893](https://github.com/google-deepmind/formal-conjectures/issues/6893), October 2026). | "Proven OEIS" is taken, including the data-based faithfulness check I had planned. |
| Proof search and autoformalization companies | **Harmonic:** Aristotle, a $120M Series C, about 500K CPUs running Lean, and C/Verilog verification since October 27, 2026 (A05). **Axiom Math:** [AxiomProver, AXLE and PrimeGapsLib](https://unite.ai/axiom-maths-ai-verifies-the-246-prime-gaps-theorem-in-lean/). **Math Inc:** Gauss formalized sphere packing in dimensions 8 and 24 (March 2026). **OpenAI:** its unit-distance result was formalized as a "one million line proof" in Lean (Q, de Moura p3-45 [0:22:00]). | Taken. |
| Records and constants | **AlphaEvolve** and its problem repository (Tao et al., [arXiv 2511.02864](https://arxiv.org/abs/2511.02864)). **[Optimization Constants](https://terrytao.wordpress.com/2026/01/22/a-crowdsourced-repository-for-optimization-constants/)** (Tao, Davis and Ivanisvili, January 2026): crowdsourced, and its entries "are not certified by this site for correctness". | A certification layer would be a contribution to their repository, not a project of its own. |
| Physics in Lean | **[PhysLean](https://github.com/HEPLean/PhysLean)** (Tooby-Smith, Bath). | Taken as a community library. |
| Research digestion and AI-research evaluation | **1stProof** and **FrontierMath** (A05). Judging a digest needs experts, and the next model can produce one on request (I). | Cut. |
| **Certified computation (CAS answers)** | **Only point bridges, all of which certify single steps inside Lean proofs:**<br>• Lean–Mathematica interfaces ([2017](https://arxiv.org/abs/1712.09288), [2021](https://arxiv.org/abs/2101.07758)).<br>• External-CAS Gröbner certificates ([arXiv 2604.13514](https://arxiv.org/abs/2604.13514); [ICMS 2026](https://icms-conference.org/2026/session1.html)).<br>• [IneqAgent](https://arxiv.org/html/2610.20681) and [LLM2Cert](https://arxiv.org/html/2610.30524), both October 2026.<br>• [LeanCert](https://reservoir.lean-lang.org/@alerad/LeanCert): bounds on definite integrals, not antiderivatives.<br>• Kaliszyk and Wiedijk's [HOL Light CAS prototype](https://link.springer.com/chapter/10.1007/978-3-540-73086-6_8) (2007).<br>• A [CADE 2021 Isabelle tool](https://lcs.ios.ac.cn/~bzhan/cade2021.pdf) for interactive definite integrals. | **Open:** no growing, proof-producing CAS, and no certified integrator in Lean. |
| **Handbook formulas** | **LaCASt** numerically and symbolically tested about 4,000 DLMF formulas through Maple and Mathematica. It found errors in the DLMF and in the CAS, but concluded that "a trustworthy verification … might be out of reach" ([arXiv 2201.09488](https://arxiv.org/pdf/2201.09488)). **Moll's 35+ part series** proves Gradshteyn–Ryzhik entries by hand ([Part 14](https://arxiv.org/pdf/1004.2440)). No Lean DLMF project was found. | **Open.** |
| **Bounded implication universes** | **ETP** did magmas: 4,694 laws and 22,028,942 implications ([arXiv 2512.07087](https://arxiv.org/abs/2512.07087)). **[π-Base](https://topology.pi-base.org/)** (topology, CC-BY-4.0) deduces "essentially just applying modus ponens / tollens", and its creator's [2014 hope](https://jdabbs.com/announcing-the-p-base/) to verify assertions with Coq was never carried out. No Lean bridge was found. | **Open for topology.** |

**I — The pattern:**
- **Funded lanes are about proof:** new theorems, formalized papers, open problems.
- **Open lanes are about computation and reference knowledge that scientists use daily:** integrals, sums,
  special-function identities and property tables.
- **Why these fit the GrowOS shape:** they have cheap automatic checks (differentiate, evaluate, substitute), and a fixed
  public corpus to grow against.

---

## 1. GrowCAS — a computer algebra system that grows, where every answer is a proof

**One sentence (I):** a symbolic math engine whose every answer is a Lean-checked theorem stating exactly where it holds.
It integrates, sums, solves ODEs and simplifies, and grows a new proven rule each time a problem in its corpus stumps it.

### The seed

- **Q — Omar, [p3-19 [1:02:00]](https://www.youtube.com/watch?v=fB_lklm7xgU&t=3720):** "the cost structure has changed
  and I think it's actually high time for us as a community of computer scientists to think about like what should the
  future look like … instead of just like having to confront network effects and the billion dollars of software
  engineering effort is needed to build a standard library".
- **Q — Spanos, [09 [0:12:00]](https://www.youtube.com/watch?v=DF5M5CJi9sM&t=720):** "it really really matters if you get
  like a minus sign wrong … you have to read the code to verify the correctness because you can't easily verify the
  correctness just from the outputs."
- **Q — de Moura, [p3-45 [1:02:00–1:04:00]](https://www.youtube.com/watch?v=KzdYKeAqWhY&t=3720):** "It still computes the
  same thing. Here's the proof." Also: in software verification "these statements are big … but the proofs are
  shallow".
- **Q — de Moura, [p3-45 [0:33:00–0:34:00]](https://www.youtube.com/watch?v=KzdYKeAqWhY&t=1980):** Lean-trained behavior
  "will get way better in the future … the costs will reduce".

**I — Reading:**
- **The gap Omar names:** a CAS is the textbook case of the "billion dollars of software engineering effort" library.
  Rubi's [6,600+ hand-written integration rules](https://rulebasedintegration.org/) are one person's lifetime of it.
- **The pain Spanos names:** CAS output is the kind whose correctness you can't see. Writing in 2001 about Mathematica's
  integrator, Alan Mason traced "most errors" to "problems with branch cuts and to adding back discontinuous jumps" (F,
  [MathGroup, 9 Sep 2001](https://forums.wolfram.com/mathgroup/archive/2001/Sep/msg00122.html)).
- **The fit de Moura names:** a CAS answer's side conditions (domains, nonzero denominators, signs of parameters) are
  big statements with shallow proofs. That is the regime where models already succeed.

### What grows, and what the builder designs

| GrowOS | GrowCAS (I) |
|---|---|
| A real program that needs to run | A problem from a public CAS test corpus |
| A missing syscall | A missing rule or algorithm |
| The kernel's ABI and checks | The answer contract, below |
| Observed Linux behavior as the oracle | The Lean kernel, plus other CAS's published answers as a differential oracle |
| A promoted syscall, kept | A promoted, Lean-proven rule schema, kept |

The builder designs six things (I):

1. **The answer contract (the check).**
   - **Antiderivatives:** an answer is `(F, D, proof)`. `D` is an explicit union of open intervals plus parameter
     conditions, and `proof : ∀ x ∈ D, HasDerivAt F (f x) x`.
   - **Definite integrals:** additionally need `F` continuous on `[a, b]`, so the fundamental theorem applies.
   - **Sums:** carry a Wilf–Zeilberger certificate, a rational function whose check is rational arithmetic.
   - **ODE solutions:** carry a substitution proof on `D`.
   - **Simplifications:** carry an equality proof on `D`.
   - **Closing Lean's totalization loopholes.** Lean's `deriv`, division, `log` and `sqrt` return junk values outside
     their domains, so a naively stated result can be "proved" while meaning nothing ([MIT lecture notes](https://mlcrypto.mit.edu/course/scribe-notes/lec14_scribe.pdf)).
     The contract must close these loopholes. It is GrowCAS's kernel boundary, and it is where the builder's judgment
     lives.
2. **The rule format.** A rule is a Lean theorem schema with explicit side conditions. For example: `∫ x^m (a + b x)^n`
   under stated conditions on `m, n, a, b`. Rules compose into proof terms mechanically, so each rule is both an
   executable rewrite step and a reusable lemma.
3. **A proof-producing engine in Lean 4.** It matches a pattern, applies a rule and assembles the proof term. It makes no
   model call at runtime and answers in milliseconds. The same engine can be exposed as an `integrate` tactic inside
   Lean proofs.
4. **The corpus and the growth loop.**
   - **Corpus:**
     - Rubi's 72,000+ test problems (MIT licence [per MathLive's attribution](https://mathlive.io/compute-engine/guides/integration-rules/));
     - Nasser Abbasi's independent [CAS integration tests](https://www.12000.org/my_notes/CAS_integration_tests/index.pdf)
       (85,865 problems in a 2022 build), which publish every system's answers;
     - the [Exhaustive Symbolic Integration](https://arxiv.org/abs/2605.04978) (ESI) enumeration of all integrands up
       to a complexity bound;
     - Kamke-style ODE lists, and known WZ identities.
   - **Growth:** a failing problem is the missing syscall. An agent finds the answer and proves it, then *generalizes*
     the instance into a schema.
   - **Promotion:** a schema is admitted only if Lean checks it, it covers held-out problems, and the whole corpus
     still passes.
5. **A differential oracle.**
   - **Comparison:** every published answer from Mathematica, Rubi, FriCAS, Maxima or Giac is compared with GrowCAS's
     answer on `D`, using interval arithmetic (Arb, through C FFI).
   - **Outcome:** each disagreement ends in one of two ways. Either Lean proves that the other answer is also right on
     `D`, or there is a machine-checked witness that it fails on part of its claimed domain.
   - **The classic failure:** an antiderivative that jumps inside an interval where the integrand is continuous, so
     definite integrals computed from it are wrong.
6. **Independent re-checking.** de Moura: "having multiple kernels is the best way to ensure that your results are
   correct … We have kernels implemented in rust" (Q, [p3-45 [0:18:00–0:19:00]](https://www.youtube.com/watch?v=KzdYKeAqWhY&t=1080)).
   The library is re-checked by a second kernel, such as Lean4Lean or nanoda.

**What the models grow:**
- answers, and the proofs of their side conditions;
- generalizations from instances to schemas;
- over time, whole verified algorithms written as Lean programs with correctness proofs. Examples: Hermite reduction,
  Gosper/Zeilberger summation, holonomic closure, and parts of the Risch algorithm.

de Moura already observes the agents extending Lean itself: "the [AI] keeps writing [Lean] meta extension" (Q,
[p3-45 [0:52:00]](https://www.youtube.com/watch?v=KzdYKeAqWhY&t=3120)).

### Tailwind

**I — Release day:** each model release triggers a rerun over the residual corpus, the problems still unsolved, and the
coverage jump becomes a published number. Better models:
1. close more of the residual;
2. find more general schemas, so fewer rules cover more problems;
3. prove wider domains, with fewer excluded points;
4. reach new territory: special-function antiderivatives, and eventually non-elementarity. Formalizing Liouville's
   theorem would turn "no elementary antiderivative" from a shrug into a proven answer.

**I — Why the next model can't make it obsolete:** the artifact runs *without* a model. It answers in milliseconds,
deterministically, offline, with a proof, and every model's work is banked in it.
- **A model asked on demand** pays seconds to minutes and real money per query, its answer is unchecked unless it also
  writes the proof, and it leaves nothing behind.
- **GrowCAS** is where that on-demand work turns into a permanent rule.

### The one-shot test

**I — What a model two generations ahead could do from one prompt:** given "build a certified CAS", it could probably
write the engine and a reasonable contract. That code is prompt-sized.

**I — What it cannot produce:**
- **The proven rule base:** thousands of rule schemas, each with side-condition proofs, covering 70,000+ problems.
  The output alone would be millions of lines of Lean.
- **The disagreement record against existing CAS.** It only arises from running against their published answers.
- **The regression history.**

**I — The human contribution:**
- the contract: what "correct" means for domains, branch cuts and constants, and how the totalization loopholes are
  closed;
- the rule format;
- the generalization and promotion policy;
- the choice of corpus.

The accumulated proven rule base is the asset.

### Value proposition

**"A Mathematica that can't give you a wrong answer: every result comes with a machine-checked proof of where it holds,
and it learns new math whenever it gets stuck."**

**I — Who gains, with no users needed:**
- **anyone putting an integral into a paper, a physics derivation or a simulation;**
- **AI agents doing mathematics,** which can call a trusted engine instead of trusting their own algebra;
- **Mathlib,** which has no table of integrals.

### Six-week version and the demo

**E — Budget:** 60–100 builder-hours, $1,500–4,000 of model spend (cap $5,000), and one workstation.

| Week | E — deliverable |
|---|---|
| 1 | The contract and engine for real indefinite integrals. Import Rubi's algebraic and logarithm sections. Push 50 problems through the strict contract with closely supervised agents, to find where it hurts. |
| 2–3 | The growth loop, with schema generalization and corpus-wide regression. Target: 5,000+ corpus problems answered with proofs, by schemas rather than by one rule per problem. |
| 4 | The differential oracle against the published Rubi, Mathematica and FriCAS answers in the Abbasi reports. |
| 5 | The release-day experiment: the same residual, run with three model generations. Coverage is plotted per model, and every rule is kept. |
| 6 | Publish the engine, the proven rule library and instance table, and the disagreement list. |

**E — The demo that makes someone say "wait, what?":**
1. Type an integral. Within a second, with no model call, get the antiderivative, the intervals where it is valid, and a
   Lean proof.
2. A list of published CAS antiderivatives that jump inside an interval where the integrand is continuous, so the
   definite integrals they produce are wrong there. Each comes with a machine-checked witness.
3. The curve: one corpus, three model generations, coverage rising, and nothing ever lost.

**The AlphaFold-DB step (E):**
- **The space:** ESI already lists every integrand up to a complexity bound, and reports "three integrals that resist
  SymPy, Mathematica, RUBI, FriCAS, Maxima and Giac under all tested strategies" (F).
- **The publication:** for every integrand up to complexity *k*, a proven antiderivative and its domain, or the flag
  "unresolved". This is Campbell's "computed … and published them for free" applied to calculus.
- **Growth:** the bound *k* rises with each model.

### Prior art and precisely what is left

**F:**
- **Kaliszyk & Wiedijk (2007),** [*Certified Computer Algebra on Top of an Interactive Theorem Prover*](https://link.springer.com/chapter/10.1007/978-3-540-73086-6_8):
  a HOL Light prototype that checks each simplification. A proof of concept; never grown, not maintained.
- **[CADE 2021, Bohua Zhan's group](https://lcs.ios.ac.cn/~bzhan/cade2021.pdf):** verified interactive computation of
  definite integrals in Isabelle, stepping through recorded rules. It is driven by the user, not a rule base that grows.
- **Point bridges and tactics:**
  - Lean–Mathematica interfaces ([2017](https://arxiv.org/abs/1712.09288), [2021](https://arxiv.org/abs/2101.07758));
  - external-CAS certificates for Gröbner bases ([arXiv 2604.13514](https://arxiv.org/abs/2604.13514)) and for
    Macaulay2 ([ICMS 2026](https://icms-conference.org/2026/session1.html));
  - [IneqAgent](https://arxiv.org/html/2610.20681), [LLM2Cert](https://arxiv.org/html/2610.30524) and
    [sum-of-squares agents](https://arxiv.org/pdf/2608.00326);
  - [LeanCert](https://reservoir.lean-lang.org/@alerad/LeanCert), whose `interval_integrate` bounds definite integrals
    but does not find antiderivatives.

  All of these certify steps *inside Lean proofs*. None is an engine that answers CAS queries or grows rules.
- **Unverified engines and search:**
  - Rubi (6,600+ rules, 72,000+ problems);
  - MathLive's [TypeScript port of Rubi's rules](https://mathlive.io/compute-engine/guides/integration-rules/);
  - [AlphaIntegrator](https://arxiv.org/pdf/2410.02666), a learned search over integration-rule applications;
  - [ESI](https://arxiv.org/abs/2605.04978) (May 2026).
- **The idea is in the air:** a [2023 Lean Zulip thread](https://leanprover-community.github.io/archive/stream/113488-general/topic/Computer.20Algebra.20Systems.20and.20Lean.html)
  discussed building a CAS in Lean and porting Rubi with Lean-checkable certificates. Nobody built it.

**I — What is left:** three things, none of which exists:
- the grown, proof-producing engine, whose rule base doubles as a theorem library;
- the growth policy driven by corpus failures;
- the published record of disagreements with existing CAS.

**I — Main competitive risk:** Wolfram, the Lean FRO or a funded math-AI company could decide to build it. No such
announcement was found as of 2026-10-29.

### The kill

**I — Strongest objection: "It's a cache, and the next model eats it."** If frontier models in 2027 integrate and prove
on demand for a cent in a second, a stored rule base adds little.
- **It survives only if grown rules generalize:** one model call must yield a schema that answers many future problems
  with zero calls.
- **Second objection:** keeping domains and branch cuts straight in Lean could make every rule expensive to prove and to
  keep compiling. That is Beck's "drag on my ability to change" (Q, p3-44 [38:00]), applied to a rule library.

**E — Cheapest test: 2 days, at most $300.** Take 300 problems from two Rubi sections and measure four things:

| | Measure | Kill if |
|---|---|---|
| (a) | Share proved end to end under the strict contract | (a) doesn't rise between two model versions |
| (b) | Share of those proofs that generalize into schemas | — |
| (c) | Held-out coverage the schemas reach with zero model calls | Below 10% |
| (d) | How (a)–(c) move between two model versions | — |

---

## 2. The Proven Handbook — every special-function formula, machine-checked

**One sentence (I):** turn the reference tables of applied mathematics into a Lean library where every formula is either
proven with its exact conditions or caught with a machine-checked counterexample. The tables are the special-function
identities of Abramowitz & Stegun and the DLMF, plus the integral tables. The missing analysis library grows on demand.

### The seed

- **Q — de Moura, [p3-45 [0:29:00]](https://www.youtube.com/watch?v=KzdYKeAqWhY&t=1740):** "It's super important to have
  the mathematical library because you want to be able to talk about the problems … You need a definition in [Lean] and
  we have it inside of math lib".
- **Q — de Moura, [p3-45 [0:20:00]](https://www.youtube.com/watch?v=KzdYKeAqWhY&t=1200):** "how do you know that when you
  exported it's really theorem it's not 2 plus 2 equals four".
- **Q — Myers, [p3-20 [32:00]](https://www.youtube.com/watch?v=mZgglPK8Rg0&t=1920):** "You do not have to trust my
  formalization strategy because the process produced a oneline reproduction."
- **Q — Tao, [p3-46 [28:00]](https://www.youtube.com/watch?v=svl_1upFpQo&t=1680):** "build the next base of knowledge for
  the next generation of humans and AIs to to build upon".
- **Q — Campbell, [p3-32 [48:00]](https://www.youtube.com/watch?v=uWnUnMphmPM&t=2880):** "It will take us decades to even
  know everything that we've gotten from this data set."
- **Q — Spanos, 09 [0:12:00]:** the minus sign.

**I — A handbook is the knowledge base scientists trust most and check least.**
- **Gradshteyn–Ryzhik:** Moll's series exists because it has errors. Per Moll, "Most of the errors … are of the type:
  some parameter has been mistyped, an exponent has been misplaced, parameters are mistaken to be identical", and some
  entries are divergent integrals (F).
- **DLMF:** LaCASt found a sign error in a DLMF equation and a flaw in Maple's `simplify` (F,
  [arXiv 2109.08899](https://arxiv.org/abs/2109.08899)).

### What grows, and what the builder designs

1. **The registry.**
   - **Entries:** one per formula, keyed to its DLMF or A&S number.
   - **Statements:** each Lean statement is generated from the DLMF's semantic LaTeX macros, which name every function
     unambiguously, with all constraints made explicit.
2. **The faithfulness oracle,** for de Moura's "2 plus 2" problem.
   - **Numeric check:** the source formula is evaluated independently with Arb ball arithmetic at random parameter
     points.
   - **Round trip:** the Lean statement is rendered back to semantic LaTeX and must match the source exactly.
   - **Gate:** both checks must pass before a proof attempt counts.
   - **No model involved,** so the check doesn't weaken as models get more persuasive.
3. **Library growth on demand.** When an entry needs a missing definition or lemma, an agent adds it to a library built
   to be upstreamable to Mathlib. Examples: Bessel functions by series, Mellin transforms, contour shifts. This is the
   GrowOS loop: entries are the programs, missing lemmas are the syscalls, and the Lean kernel is the check.
4. **A status board per chapter.**
   - **Four states:** proven; refuted, meaning an erratum with a certified counterexample; numerically confirmed only;
     blocked on library work.
   - **Dependency graph:** each entry shows what it depends on.

### Tailwind

**I — Analysis is where Lean and today's models are weakest.** The ζ(3) formalization says Lean's library "lagged behind
other theorem provers, such as Isabelle, in certain analytical domains" (F, [arXiv 2503.07625](https://arxiv.org/pdf/2503.07625)).
- **Each release:** entries move from "blocked" to "proven", and deeper chapters unlock (asymptotics, integral
  representations).
- **Compounding:** each proven chapter makes the next one cheaper, because the library it built is reused.

### The one-shot test

**I — Why one prompt can't produce it:** there are thousands of formulas, and most need infrastructure that doesn't yet
exist in Lean. The work is far beyond one prompt, and it depends on lemmas proved along the way.

**I — The human contribution:** the registry, the oracle, the status policy and the library architecture. The asset is
the proven library, together with the errata it finds.

### Value proposition

**"The formulas engineers and physicists copy from the handbook, each one proven or caught being wrong."**

### Six-week version and the demo

**E — Budget:** 60–90 hours and $500–2,500 of model spend.

**E — Scope:** DLMF chapters 4 (elementary functions) and 5 (Gamma function), plus 200 sampled integral-table entries.

**E — Targets:** every formula registered and numerically checked, and at least 50% of chapter 5 proven.

**E — Demo:** the Gamma-function chapter as a board of green, red and grey cells with its dependency graph. Any red cell
is an erratum with a one-line reproduction, which is Myers' standard.

**I — Honest expectation:** the DLMF is heavily vetted, so new errata are more likely to turn up in older or larger
tables than in the DLMF itself.

### Prior art and precisely what is left

**F:**
- **LaCASt** (gipplab/NIST collaborators, [arXiv 2201.09488](https://arxiv.org/pdf/2201.09488)): numeric and symbolic
  testing through commercial CAS. It found errors in the DLMF and in the CAS, and its authors judge trustworthy
  verification possibly out of reach.
- **Moll et al.:** human proofs of Gradshteyn–Ryzhik entries in 35+ parts.
- **Mathlib already has:** Gamma, Beta, zeta, Dirichlet L-functions (Loeffler–Stoll) and shifted Legendre polynomials.
- **Isabelle already has:** elliptic functions, Eisenstein series and theta functions ([ITP 2026](https://drops.dagstuhl.de/storage/00lipics/lipics-vol382-itp2026/LIPIcs.ITP.2026.23/LIPIcs.ITP.2026.23.pdf)).
- **Not found:** any Lean project formalizing the DLMF.

**I — What is left:** a proven handbook that is complete at the level of individual formulas and checked by the
oracle.

**I — Risks:**
- **Overlap:** Formal Frontier could pick a handbook as one of its autoformalized texts.
- **Copyright:**
  - NIST [asserts copyright over the DLMF](https://en.wikipedia.org/wiki/Digital_Library_of_Mathematical_Functions) (F);
    the 1964 A&S is public domain.
  - So the registry should cite DLMF numbers and state formulas as mathematical facts, or start from A&S, and ask NIST
    before mirroring its structure.

### The kill

**I — Strongest objection: "You'll spend the six weeks building complex analysis."**
- **Missing infrastructure:** most DLMF chapters rely on contour integration, analytic continuation and asymptotics
  that Mathlib lacks.
- **The result:** the project could stall at chapters 4–5, while a heavily vetted handbook yields almost no errors.

**E — Test: 1 week, at most $300.** Take 60 formulas from chapters 5 and 10 (Bessel functions), and measure oracle
agreement, proof rate and infrastructure gaps per formula. Kill if:
- under 30% of chapter 5 proves; or
- chapter 10 needs more than about two weeks of library work before any of its proofs lands.

---

## 3. The Implication Atlas — *Counterexamples in Topology*, finished and machine-checked

**One sentence (I):** settle every cell of π-Base's topology tables with a Lean proof or a formally verified
counterexample space.
- **Two kinds of cell:** "does property P imply Q?" and "does space S have property P?"
- **Universe:** π-Base's 247 properties and 225 named spaces.
- **Release days:** open cells are rerun at each model release, until the only blanks left are genuinely open or
  independent of ZFC.

### The seed

- **Q — de Moura, [p3-45 [0:25:00]](https://www.youtube.com/watch?v=KzdYKeAqWhY&t=1500):** "not about verifying but
  enabling people to work together in large numbers because you can trust you don't need to trust someone else's proof
  right they can fill holes for you".
- **Q — Tao, [p3-46 [12:00]](https://www.youtube.com/watch?v=svl_1upFpQo&t=720):** "we all think that that a problem has a
  positive answer but actually the has a negative answer and we just didn't look at the negative case too much".
- **Q — Tao, [p3-46 [13:00]](https://www.youtube.com/watch?v=svl_1upFpQo&t=780):** "find ways to um to incorporate this
  new capability to to solve some problems at broad scales".

**I — Reading:**
- **The hole-fillers can be agents.** de Moura's point is that checking lets many contributors fill holes; agents
  qualify.
- **ETP showed the shape works:** on a finite universe it produced new constructions.
- **Counterexamples are topology's tradition,** which is exactly Tao's "negative case".

### What grows, and what the builder designs

1. **The universe.**
   - **Size:** π-Base's 247 properties, 225 spaces and 935 theorems (F, counted through the
     [GitHub API](https://github.com/pi-base/data) on 2026-10-29; CC-BY-4.0).
   - **Cells:** that gives about 55,600 space–property cells and about 60,800 ordered property pairs (I, arithmetic).
2. **Lean definitions.**
   - **Properties:** a Lean definition for each, many already in Mathlib, such as the separation axioms, compactness
     variants and metrizability.
   - **Spaces:** a Lean construction for each named space, such as the Sorgenfrey line, the Tychonoff plank, the long
     line and βℕ.
3. **Faithfulness by data.** π-Base's informal theorems and asserted traits act as a consistency oracle. If the formal
   definitions contradict a well-established trait, the definition is flagged before any proof counts. AlphaProof Nexus
   did the same with sequence terms; here it is done against an existing database.
4. **The certificate format and closure engine.**
   - **Certificates:** a trait proof or its negation; an implication proof; or a counterexample, which is a space plus two
     trait proofs.
   - **Closure engine:** derives consequences inside Lean. It does what π-Base's modus ponens does, but kernel-checked.
5. **The frontier.**
   - **Attacked:** cells unknown to both π-Base and the atlas are attacked by agents at each release.
   - **Labelled, not attempted:** cells known to be independent of ZFC.

### Tailwind

**I — What each release adds:** it settles more of the hardest cells and constructs stranger spaces. The atlas converges
toward a state no human-maintained table reaches: every remaining blank is a real open problem, or independent of ZFC.

### The one-shot test

**I — Why one prompt can't produce it:** about 116,000 cells, plus constructions of exotic spaces and their trait proofs,
are far beyond one prompt.

**I — The human contribution:** the universe, the certificate format, the closure engine and the faithfulness check.

### Value proposition

**"For any two topological properties: a proof that one implies the other, or a verified space showing it doesn't."**

### Six-week version and the demo

**E — Scope:** about 40 separation and compactness properties across about 60 spaces.
- every π-Base trait for them formalized and proven;
- the closure computed;
- the unknown cells attacked.

**E — Demo:** the full 40×40 implication grid, every cell green (a proof) or red (a verified counterexample space), plus
the list of cells π-Base marks unknown that the atlas settled.

### Prior art and precisely what is left

**F:**
- **π-Base:** deduction is informal; its creator's 2014 hope of Coq verification was never carried out; it
  "officially expanded to serve disciplines beyond topology" in 2026.
- **ETP:** done, for magmas.
- **formal-conjectures:** includes graph conjectures from the WOWII database.
- **I — from memory, to verify:** Mathlib already contains some named spaces, such as the Sorgenfrey line.

**I — What is left:** the formal atlas itself.

### The kill

**I — Strongest objection: low value and little discovery.**
- **Unentered, not open:** most unknown π-Base cells may simply never have been entered.
- **Set theory:** the hard ones are often set-theoretic, needing forcing, which Mathlib lacks.
- **Trust exists already:** topologists already trust Steen–Seebach and π-Base.

**E — Test: 1 day, at most $50.**
1. Pull π-Base's unknown traits for the 40 properties.
2. Using a literature search, classify each as open or merely unentered.
3. Attempt 50 of them.

Kill as a standalone project if fewer than about 20 cells are both genuinely open and decidable in ZFC. In that case it
becomes a contribution to π-Base, not a project.

---

## Considered and cut

| Direction | Seed | Why it was cut (F/I) |
|---|---|---|
| Proven OEIS | Tao, p3-46 [12:00–13:00] | **Taken.** AlphaProof Nexus proved 44 of 492 using term-checking test lemmas, formal-conjectures has an OEIS directory, and individuals already post AI proofs. |
| Agent-maintained formal library and proof compression | de Moura, p3-45 [0:11:00–0:13:00] | **Taken** by Lean Pool. |
| Certified records for optimization constants | Tao, p3-46 [12:00–13:00]; Campbell, p3-32 [48:00] | Tao's repository plus AlphaEvolve. A certification layer is a contribution, and labs out-compute any solo effort on constructions. |
| Proof digestion ("proof indigestion") | Tao, p3-46 [20:00] | Quality needs expert judgment, and a digest is a prompt for the next model, so it fails the tailwind test. |
| Formalizing the flood of AI-written mathematics | Kim, p3-09 [12:00] | Math Inc, Axiom, Harmonic, OpenAI and Lean Pool. Judging whether a statement is faithful needs experts. Too close to the rejected executable scientific record. |
| Mechanized semantics for every small language | Myers, p3-20 [29:00–32:00] | Myers: "This is what I'm doing full-time now" (Q, [42:00]). Also near the rejected executable-spec shape. |
| Proven numerics or a correctly rounded libm | Lattner, [p3-38 [0:16:00]](https://www.youtube.com/watch?v=ah9Tfebk7JA&t=960) ("they're all different") | Covered by CORE-MATH, RLIBM, Arb and LeanCert, and adjacent to the rejected cross-GPU atlas. |
| Physics library in Lean | Tao, p3-46 [02:00–03:00] | **Taken** by PhysLean. |
| Live computational commons | Omar, p3-19 [0:48:00] | Depends on a community (and Fairground exists). This is the rejected shape. |

---

## Ranking, the pick, and TL;DR

| Rank | Idea | Tailwind | One-shot | Ambition | Value | Openness | I — why this rank |
|---|---|---|---|---|---|---|---|
| **1** | **GrowCAS** | Strong: coverage per model is a published number | Passes: the rule base can't be emitted | About 10× | High, and immediate for humans and agents | Open | Closest GrowOS analogy: a missing rule is a missing syscall, the answer contract is the kernel boundary, and it runs without a model. Clearest demo. Its weak point, the cache objection, has a two-day test. |
| 2 | Proven Handbook | Strongest: analysis is the frontier | Passes | About 10×, possibly more | High, but slow to show | Open, with copyright care | Cleanest faithfulness oracle, but the slowest route to a visible result. It becomes GrowCAS's special-function library if GrowCAS works. |
| 3 | Implication Atlas | Good | Passes | About 3–5× | Narrow | Open | The most likely to finish, with the ETP shape already proven, but the least valuable. |

**ONE pick: GrowCAS.** The two runners-up compose with it:
- **The Handbook** is GrowCAS's library of special-function rules.
- **Integral tables** are GrowCAS's corpus.
- **The Atlas** uses the same certificate-and-closure machinery.

**TL;DR**
1. **Build GrowCAS.** It is a proof-producing computer algebra system that grows a Lean-proven rule whenever its
   corpus stumps it. Answers come back in milliseconds with no model call, and each model release adds coverage that is
   kept for good.
2. **The proof lanes are taken; certified computation isn't.** OEIS and Erdős campaigns, the formal archive, records,
   textbooks and physics belong to DeepMind, Lean Pool, Tao's repositories, Formal Frontier and PhysLean. CAS answers
   and handbook formulas have only tactics and bridges.
3. **Kill test: 2 days, at most $300.** Run 300 Rubi problems under a strict `HasDerivAt`-on-a-domain contract. Kill if
   the proven instances don't generalize into rules that answer held-out problems with no model call.
