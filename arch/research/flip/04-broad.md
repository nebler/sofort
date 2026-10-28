# 04 — The graveyard outside OS/infra: which old ideas did agents actually un-kill? (2026-10-28)

Lens A only, across software engineering, programming languages, security, hardware/EDA, scientific computing, AI history,
knowledge bases, accessibility/localisation and migrations. Labels: **F** sourced, **M** measured, **I** inference, **E** estimate.

## The finding in one paragraph

Outside OS/infra, the graveyard splits cleanly. **(1) Ideas killed by labour *and* checkable by an oracle have already
been dug up.** Big players are harvesting them in 2025–2026: mutation testing (Meta ACH), property-based testing (Anthropic/Hypothesis),
API migrations (Google, Amazon), accessibility remediation (GitHub, Deque, accessiBe), proofs/contracts (vericoding,
AutoVerus, Dafny loops), HLS tuning (AMD plus academia), Fortran porting (LANL, Argonne) and rules-as-code (PolicyEngine's
Claude agents, the Axiom Foundation). "Someone already does this" is the dominant result. **(2) Many famous corpses died of
something agents do not fix.** N-version programming died of correlated failures, and a June 2026 replication with coding agents found the
same correlation. MDE, the semantic web, live environments and structure editors died of social and organisational causes. CHERI's
blocker is hardware, not porting labour (0.026% of lines changed). **(3) Some corpses are obsoleted, not revived, by a
superhuman model**: Cyc, the semantic web, expert-system rule bases, end-user programming and program synthesis. The model *is*
the knowledge base or the synthesiser. Only one labour-killed idea came up uncrowded and GrowOS-shaped: **agent-driven
library sandbox retrofits (RLBox-style), checked by a hostile-library oracle.** It is a bridge technology; Rust rewrites with
differential oracles are winning at Chrome. It is weaker than GrowOS.

---

## 0. The sorting table (25 ideas)

Columns: **Killer** = what actually killed it. **Agents fix?** = does near-free code + long loops + cheap checking remove
that killer? **Status 2026** = who already harvests it.

| # | Idea (origin) | Killer | Agents fix? | Oracle | Status 2026 |
|---|---|---|---|---|---|
| 1 | Library sandboxing / SFI (Wahbe 1993; RLBox 2020) | per-library retrofit labour + expert validator writing | **mostly** | strong functional, moderate security | **uncrowded** (no LLM work found) |
| 2 | Rules as code (Sergot et al. 1986; Catala 2021) | lawyer+programmer pair labour; yearly churn; institutional adoption | labour yes, institutions no | strong where an implementation exists | PolicyEngine agents, Axiom Foundation, Legalese L4, Catala benchmarks |
| 3 | N-version programming (Avizienis 1977/85) | **wrong assumption** (independence, Knight–Leveson 1986) + 3× cost | cost yes, correlation **no** | n/a (it *is* an oracle) | Ron/Baudry/Monperrus 2026; SpecLens 2026 |
| 4 | Mutation testing (DeMillo/Lipton/Sayward 1978) | compute + equivalent-mutant triage labour | **yes** | strong (test kills mutant) | Meta ACH (FSE 2025), Google |
| 5 | Property-based testing (QuickCheck 2000) | writing properties/generators is expert work | **yes** | strong (counterexample) | Anthropic agentic PBT (2025–26) |
| 6 | Design by contract / B / Z / dependent types (Meyer 1986–92; Abrial 1996) | annotation + proof labour; expert scarcity | proof labour yes; **spec intent no** | strong for proof, weak for spec adequacy | vericoding, AutoVerus, Dafny loops, Harmonic/Axiom-math etc. |
| 7 | Expert systems / knowledge engineering (Feigenbaum 1977) | knowledge-acquisition bottleneck; XCON maintenance | yes, but **obsoleted** | weak (historical decisions) | absorbed by LLMs; residue = #2 |
| 8 | Cyc (Lenat 1984) | ~2,000 person-years of manual curation | **obsoleted** | none | LLMs are the commonsense KB |
| 9 | Semantic web (Berners-Lee/Hendler/Lassila 2001) | publisher incentives + complexity | **no** (social) and obsoleted | none | schema.org survived via SEO; LLMs read prose |
| 10 | High-level synthesis (1990s → Catapult/Vivado HLS) | expert pragma tuning; QoR gap | **yes** | strong (C-sim, co-sim, synthesis reports) | LAAFD 99.9% of hand-tuned; AMD; many papers |
| 11 | Per-workload custom accelerators | silicon NRE and masks; demand concentration | **no** (capital, not labour) | strong | hyperscalers only |
| 12 | Formal hardware verification (assertions/FPV) | assertion-writing expertise | partly | strong (JasperGold proofs/CEX) | ProofLoop, ChatSVA, EDA vendors |
| 13 | Porting Fortran / legacy HPC | labour + numerics expertise | **yes** | moderate (tolerance-bounded outputs) | LANL 2025, Argonne CodeScribe, LLNL data |
| 14 | Computational reproducibility | labour + **no incentive** | labour yes, incentive no | moderate (paper's numbers) | CORE-Bench, I4R AI replication games |
| 15 | Verified numerics (Herbie 2015, FPTaylor) | niche demand, not labour | no | strong | stays niche |
| 16 | Memory-safe rewrites of C/C++ | labour + semantic risk | **yes** | strong (differential vs original) | DARPA TRACTOR, Chrome Fontations, MS |
| 17 | Capability hardware (CHERI 2010→) | hardware availability, ecosystem | **no** (porting is already 0.026%) | strong | CHERIoT, Morello (prototype) |
| 18 | Object capabilities / IFC (Dennis & Van Horn 1966; Denning 1976; Myers 1999) | annotation burden, label creep, retrofit | partly → **Lens B** | moderate | CaMeL (DeepMind 2025) for agents |
| 19 | Literate programming (Knuth 1984) | human-factors: writing twice, drift | no (and model explains on demand) | weak | obsoleted |
| 20 | Model-driven engineering / MDA (OMG 2001) | **social/organisational** (Hutchinson et al. 2011/14) | no | weak | reborn as "spec-driven dev" (Kiro, Spec Kit) |
| 21 | Structure editors (Cornell Program Synthesizer 1981) | humans hate tree editing | no; agents don't type | n/a | niche (Hazel, JetBrains MPS) |
| 22 | Smalltalk/Lisp live images | deployment, social | no | n/a | niche |
| 23 | End-user programming / PBD (Nardi 1993; Cypher 1993) | generalisation from examples | **obsoleted** (LLMs solved it) | n/a | vibe coding |
| 24 | Program synthesis (Manna & Waldinger 1980; FlashFill 2011) | search blow-up | **obsoleted** | strong | LLMs are the synthesiser |
| 25 | Accessibility / localisation / API+doc migrations | long-tail manual labour | **yes** | weak (a11y), strong (migrations: build+tests) | GitHub, Deque, accessiBe; Google, Amazon, Moderne |

**Sharp answer to "which died from a labour bottleneck that agents remove?"**: 1, 2 (labour half), 4, 5, 6 (proof half),
10, 12, 13, 14 (labour half), 16, 25. Of these, **only #1 is uncrowded**. **Which died for reasons agents do NOT fix?**
3 (correlated failure), 9, 14 (incentive), 17, 20, 21, 22 (social/human factors), 11 (capital), 15 (demand). **Which does a
superhuman model make obsolete rather than revive?** 7, 8, 9, 19, 23, 24.

---

## 1. Library sandbox retrofits by agent: RLBox with a hostile-library oracle *(rank 1)*

1. **Idea.** Wrap each untrusted C/C++ library in an in-process sandbox and make every value crossing back into the host a
   *tainted* type that the compiler refuses to use until a validator checks it. SFI comes from Wahbe, Lucco, Anderson & Graham,
   "Efficient Software-Based Fault Isolation", SOSP 1993 ([doi](https://doi.org/10.1145/168619.168635)) **F**. The
   tainted-type retrofit comes from Narayan et al., "Retrofitting Fine Grain Isolation in the Firefox Renderer", USENIX Security 2020
   ([arXiv 2003.00572](https://arxiv.org/abs/2003.00572)) **F**.
2. **Why it stayed niche.** The paper names the obstacle in its own words: "Retrofitting isolation can be labor-intensive,
   very prone to security bugs". At the boundary, "bugs ... are not only easy to overlook, but can nullify any sandboxing effort"
   **F** (paper §1). The measured cost was "a bit over two days to sandbox a library with RLBox and roughly 180 LOC (25% code increase)" plus
   hand-written validators (28 validator sites for JPEG, 51 for PNG) **F** (paper §7.3, extracted from the PDF). Result: after
   ~5 years Firefox ships **six** RLBox libraries: graphite, ogg, hunspell, expat, woff2, soundtouch
   ([searchfox docs](https://searchfox.org/firefox-main/source/security/rlbox/docs/index.md); first five in
   [Firefox 95/96, Dec 2021](https://hacks.mozilla.org/2021/12/webassembly-and-back-again-fine-grained-sandboxing-in-firefox-95/)) **F**.
   The 2023 RLBox v2 RFC still calls the C wrappers "tedious boilerplate code that developers have to write by hand"
   ([discussion #50](https://github.com/PLSysSec/rlbox/discussions/50)) **F**. Outside Mozilla, adoption is negligible **I**.
   Honest caveat: two days per library is not huge. The scarce resource was *security-review attention* for validators, plus wasm2c's
   throughput cost on hot codecs **I**.
3. **What flipped.** The two days of mechanical conversion are exactly what agents do well now. The compiler's tainted<T> errors are
   a built-in fault list, the same "fault → piece" signal as GrowOS's missing syscall **I**. What did *not* flip by itself
   is validator *sufficiency*. That needs a new oracle (item 4).
4. **Oracle.** Three layers. (a) **Compiler**: tainted<T> refuses unvalidated use, so it is strong for completeness of boundary marking. (b)
   **Differential**: the sandboxed build must be byte-identical to the native build on the library's test corpus plus fuzz
   corpus, so it is strong for functionality. (c) **Hostile library**: replace the sandboxed library with an adversary that returns
   arbitrary values and scribbles over all sandbox memory at every boundary crossing. Run the host under ASan/UBSan. Any host crash
   means a missing or weak validator. That is moderate for security: it checks memory safety of the host, not semantic policy. This repo
   already has the same pattern for shard (the "hostile shard peer" fixture, commit `be019353`) **F**. Overall: **strong/moderate**.
5. **Superhuman-model test.** **Mixed and honest.** A 100× model makes *rewriting* in Rust with a differential oracle
   cheap too. Chrome already went that way for fonts: Skrifa/Fontations replaced FreeType for web fonts in Chrome 133 (Feb
   2025), checked by a FreeType-vs-Skrifa diff tool, "fauntlet" ([Chrome blog, 2025-03-19](https://developer.chrome.com/blog/memory-safety-fonts)) **F**.
   Sandboxing still wins where a rewrite's *semantic* risk is unacceptable or the code is unowned (vendored, binary-adjacent,
   regulated). It also compounds with a rewrite: sandbox now, rewrite later. A better model makes the retrofit nearly free, but it
   also makes the competing remedy nearly free. So the window is maybe 2–4 years **E**.
6. **Prior art 2025–2026.** I found no LLM/agent-driven RLBox or library-compartmentalisation work. Targeted searches turned up
   only rule-based wrapper generation (RLBox v2 RFC), PrivTrans (2004, automatic privilege separation), the
   compartmentalisation SoK (IEEE S&P 2025), and C→Rust translators (TRACTOR performers, SafeTrans) **F/I**. The crowded
   neighbour is C→Rust translation: [DARPA TRACTOR](https://www.darpa.mil/research/programs/translating-all-c-to-rust),
   performers announced in 2025 (UW–Madison, Aarno Labs) **F**.
7. **Value.** Memory-safety bugs are ~70% of serious security bugs in Chromium and Microsoft products
   ([Chromium](https://www.chromium.org/Home/chromium-security/memory-safety/)) **F**. Buyers: browser and media-app vendors,
   embedded and automotive firms with vendored C parsers, and anyone who must ship libwebp-class code
   ([CVE-2023-4863](https://nvd.nist.gov/vuln/detail/CVE-2023-4863)). As a tool market it is small, tens of $M **E**. As an OSS/CV
   artefact, "agent sandboxed N libraries; hostile-library fuzz found M missing validators" is legible to every security
   team **I**.
8. **2-week proof (TypeScript driver, C/C++ targets).** Take a small C++ host CLI plus 5 libraries Firefox never sandboxed: libxml2,
   libyaml, cJSON, zstd, libwebp. The loop runs: build with the RLBox noop sandbox → the agent converts call sites until tainted<T> compiles → switch to
   the wasm2c sandbox → differential corpus run (must be byte-identical) → hostile-library fuzz (libFuzzer drives the adversary's return
   values and memory scribbles; host under ASan) → each crash goes back to the agent as a "validator fault" → accept when fuzz is clean
   for N CPU-hours. Measure agent wall-clock per library against the paper's ~2 person-days, validators added, hostile-fuzz crashes
   found before and after, and wasm2c overhead.
9. **Demo, tweet, killer.** Demo: a split screen where the hostile library hammers the host, crashes at first, and goes silent after the agent's validators land.
   *Tweet:* "An agent put 5 C libraries in RLBox sandboxes in an afternoon each. A hostile-library fuzzer found every
   validator it missed, then found none." **Expert reply that kills it:** "Two days was never the bottleneck. Review was, and
   wasm2c costs 10–40% on codecs, so we'd rather rewrite (Fontations)." **Kill test:** (i) if ≥30% of agent validators
   pass hostile fuzz but a human reviewer still finds a semantic hole (e.g. an unchecked length used for logic, not memory),
   the oracle is too weak; (ii) if wasm2c overhead >25% on 3 of 5 libraries, no one will deploy it.

---

## 2. Rules as code via independent re-encoding and differential audit *(rank 2)*

1. **Idea.** Write legislation as executable logic so that eligibility and tax decisions are computed, checked and explained
   mechanically. Primary sources: Sergot, Sadri, Kowalski, Kriwaczek, Hammond & Cory, "The British Nationality Act as a logic
   program", CACM 29(5), 1986 ([doi](https://doi.org/10.1145/5689.5920)) **F**, and Merigoux, Chataing & Protzenko, "Catala: a
   programming language for the law", ICFP 2021 ([arXiv 2103.03198](https://arxiv.org/abs/2103.03198)) **F**.
2. **Why it stayed niche.** Each provision needs a lawyer and a programmer together. Catala's authors formalised ~15% of IRC §121 in ~350
   lines **F**. Law changes yearly, and states and agencies diverge. The deeper killer is institutional: the Better Rules movement
   (NZ, 2018) showed that co-drafting exposes ambiguity ([discovery report](https://www.digital.govt.nz/dmsdocument/95-better-rules-for-government-discovery-report/html)),
   but legislatures never made code authoritative. Critics called that "a risk to the constitutional arrangements"
   ([Slaw 2019](https://www.slaw.ca/2019/06/14/the-fight-over-rules-as-code/)) **F**.
3. **What flipped.** (a) Encoding labour: LLM pipelines now write Catala from statute
   ([NLLP 2025 benchmark](https://aclanthology.org/2025.nllp-1.4/); German statutes, multi-agent,
   [ICML 2026](https://icml.cc/virtual/2026/80583)) **F**. (b) **Oracles now exist as open code.** The IRS open-sourced Direct File
   and its Scala **Fact Graph** in May 2025 ([IRS-Public/direct-file](https://github.com/IRS-Public/direct-file),
   [fact-graph](https://github.com/IRS-Public/fact-graph)) **F**. PolicyEngine-US/UK and OpenFisca are open microsimulation models
   **F**. Two independent implementations plus a third encoded from statute alone give an N-version audit **I**. Caveat:
   2024 Policy2Code teams found that "directly tasking LLMs with writing policy code results in subpar software code"
   ([Beeck Center, 2025-03-24](https://beeckcenter.georgetown.edu/?p=10660)) **F**. That was 2024 models, without a differential loop.
4. **Oracle.** **Strong for law that is already implemented** (differential against Direct File / PolicyEngine on synthetic
   households). **None for new law**, where only internal consistency and multi-encoding disagreement are available (see #3).
5. **Superhuman-model test.** **More valuable.** Administrative decisions must be deterministic, versioned and explainable.
   Public-benefit eligibility is a high-risk use under the EU AI Act (Annex III §5(a)) **F**, so you want the model to *write
   and audit* the rules, not to *be* the rules at runtime **I**.
6. **Prior art: crowded by the right people.** PolicyEngine ships an official Claude Code plugin with `encode-policy`
   multi-agent workflows for new benefit programs ([policyengine-claude](https://github.com/policyengine/policyengine-claude)) **F**.
   The **Axiom Foundation** (same circle as PolicyEngine's Max Ghenis) runs Rule Atlas and a `rulespec-us` monorepo with
   `.claude/`, an `axiom-encode` tool, test pairing and an `oracle-coverage-pending.yaml` ratchet; it has 2,827 commits as of today
   ([rulespec-us](https://github.com/TheAxiomFoundation/rulespec-us), [Rule Atlas](https://civictech.guide/projects/rule-atlas)) **F**.
   Legalese (Singapore) sells L4 plus an MCP server so agents *execute* rules instead of interpreting them
   ([2026-04-03](https://legalese.com/posts/2026-04-01-from-vibes-to-verification)) **F**. The revived idea is being
   done, agent-first, with oracles. **What remains open** is the *audit* product: an independent statute-only re-encoding
   diffed against a *deployed* government system, to find its bugs **I**.
7. **Value.** US improper payments were ~$162B in FY2024 ([GAO-25-107753](https://www.gao.gov/products/gao-25-107753)) **F**. Only a
   fraction comes from rules bugs **I**. The buyers are slow: inspectors general, state agencies, benefits nonprofits, tax and payroll vendors.
   Realistically it is a grant- or consulting-shaped business **E**.
8. **2-week proof.** Pick EITC + CTC + standard deduction for TY2024. The agent encodes them from IRC text alone (in Catala or TS),
   with no access to either implementation. Generate 1M synthetic households, run a 3-way diff (statute encoding vs Direct File Fact
   Graph vs PolicyEngine-US), cluster disagreements and trace each to a statute line. Count disagreements that are bugs in a
   *shipped* implementation and not already in PolicyEngine's issue tracker.
9. **Demo / tweet / killer.** *Tweet:* "Three independent encodings of the US EITC (IRS Direct File, PolicyEngine, and one an agent
   wrote from the statute alone) disagree on N households. Here's who's wrong and the line of law that decides it."
   **Killer reply:** "PolicyEngine already cross-validates against TAXSIM and Direct File; every diff you found is in our
   issue tracker." **Kill test:** fewer than 3 novel, maintainer-confirmed bugs in 2 weeks.

---

## 3. N-version programming, reborn as an oracle and ambiguity detector, not as fault tolerance *(rank 3)*

1. **Idea.** Have N teams independently implement one spec and majority-vote at runtime. Avizienis, "The N-Version Approach to
   Fault-Tolerant Software", IEEE TSE 1985 ([doi](https://doi.org/10.1109/TSE.1985.231893)) **F**.
2. **Why it died.** **The idea was wrong.** Knight & Leveson ran 27 versions on 1M inputs and rejected the independence
   hypothesis ([IEEE TSE 1986](https://doi.org/10.1109/TSE.1986.6312924)) **F**. On top of that, it cost N×.
3. **What flipped.** Cost only. Ron, Baudry & Monperrus re-ran Knight–Leveson with coding agents
   ([arXiv 2606.20158, 2026-06-18](https://arxiv.org/abs/2606.20158)) and found "substantial common-mode failure, along the
   findings of Knight-Leveson". Majority-vote triples still cut mean failures from 387.4 to 131.0, and the co-failures cluster on
   ambiguous parts of the spec **F**. So agents **do not fix the killer** (correlation), but they turn the correlation into
   a *signal*: where N agents disagree, the spec is ambiguous **I**.
4. **Oracle.** It *manufactures* one when none exists (weak per item, useful in aggregate).
5. **Superhuman test.** As runtime fault tolerance, more correlation with better models is likely → obsolete **I**. As an
   ambiguity detector, it is still useful: ambiguity lives in the spec, not the model **I**.
6. **Prior art.** SpecLens (arXiv 2609.38752) reports experts accepted 185 of 197 LLM-found protocol ambiguities in 3GPP/O-RAN/DNS,
   and 60 produced divergence between two 5G implementations **F**. Also Galápagos (automated N-version with LLMs,
   [arXiv 2408.09536](https://arxiv.org/abs/2408.09536)) and DiffSpec ([arXiv 2410.04249](https://arxiv.org/abs/2410.04249)) **F**. Protocols
   are covered; draft *legislation* is not (no hit found) **I**.
7. **Value.** Standards bodies and legislative drafting offices; small but prestigious **E**.
8. **2-week proof.** Take a draft bill or regulation section with numeric outcomes. Have 8 agents in 3 languages encode it independently, fuzz
   inputs, cluster disagreements, and have a lawyer rate precision. This merges naturally with #2.
9. **Kill test.** If precision is <50% after triage (VeriSpec's naive baseline was 1.4%, arXiv 2610.01847 **F**), drop it.

---

## 4. Mutation testing *(flipped, harvested)*

1. DeMillo, Lipton & Sayward, "Hints on Test Data Selection", IEEE Computer 1978
   ([doi](https://doi.org/10.1109/C-M.1978.218136)) **F**: seed small faults; a good suite kills them.
2. It died from compute cost plus the **equivalent-mutant problem**: humans had to classify unkillable mutants **F** (standard
   literature; Google ran it diff-scoped, [Petrović & Ivanković, ICSE-SEIP 2018](https://doi.org/10.1145/3183519.3183521)).
3. What flipped is that an LLM equivalence judge plus an LLM test writer remove the labour. Meta ACH: equivalence detector precision/recall 0.79/0.47,
   rising to **0.95/0.96** with simple preprocessing. Engineers accepted 73% of generated tests
   ([arXiv 2501.12862](https://arxiv.org/abs/2501.12862), FSE 2025 industry) **F**.
4. Oracle: strong (a test either kills the mutant or not). 5. Superhuman: **more valuable**. It is the natural quality gate for
   agent-written tests (Lens B overlap). 6. Prior art: Meta, Google, plus OSS (Stryker, cargo-mutants, mutmut) **F**.
7. Value: internal developer productivity; the gap is an OSS "ACH" **E**. 8. Proof: cargo-mutants + LLM equivalence filter +
   agent killing-test writer on 3 Rust crates; measure surviving-mutant reduction per $ **I**. 9. Killer: "Meta published it;
   you rebuilt a paper." **Verdict:** use it inside sofort's own agent loops; it is not a bet.

## 5. Property-based testing *(flipped, harvested)*

1. Claessen & Hughes, "QuickCheck", ICFP 2000 ([doi](https://doi.org/10.1145/351240.351266)) **F**.
2. It stayed niche because inventing properties and generators is expert work **I**.
3. What flipped: Maaz, DeVoe, Hatfield-Dodds & Carlini ran a Claude Code agent over 100 Python packages. 56% of reports were valid bugs,
   86% of the top-21 were valid, and patches were merged into NumPy and others ([arXiv 2510.09907](https://arxiv.org/abs/2510.09907), NeurIPS 2025 DL4C) **F**. An
   Anthropic follow-up (2026-01-14) reports hundreds of candidate bugs ([red.anthropic.com](https://red.anthropic.com/2026/property-based-testing)) **F**.
4. Oracle: strong (minimised counterexample). 5. Superhuman: more valuable. 6. Prior art: the above plus Hypothesis and Kiro
   specs. 7–9. **Verdict:** done by the people who made the tools; reject as a bet.

## 6. Design by contract, refinement (B/Z) and dependent types *(flipping, crowded; spec intent is the residue agents can't fix)*

1. Meyer, "Applying Design by Contract", IEEE Computer 1992 ([doi](https://doi.org/10.1109/2.161279)); Abrial, *The B-Book*,
   1996 **F**.
2. Why niche: proof/annotation labour. Paris Line 14 (B-method) needed 23,000 proof obligations, 17% proved interactively, for 86k
   lines of Ada. No bugs were found after proof, but uptake outside rail stayed small
   ([Lecomte et al., arXiv 2005.07190](https://arxiv.org/abs/2005.07190)) **F**.
3. What flipped: vericoding (12,504 tasks) gives Dafny 82.2%, Verus 44.2%, Lean 26.8%. The Dafny state of the art went from 68% (June 2024) to 89%
   ([arXiv 2509.22908](https://arxiv.org/abs/2509.22908)) **F**. Generate–check–repair contract loops for Dafny use tests as oracles
   ([arXiv 2601.12845](https://arxiv.org/abs/2601.12845)) **F**. LLMs bias toward weak postconditions
   ([NL2Contract, arXiv 2510.12702](https://arxiv.org/abs/2510.12702)) **F**.
4. Oracle: **strong for "the proof checks", weak for "the spec says what you meant"**. Agents remove the first bottleneck and
   expose the second. 5. Superhuman: more valuable. 6. Prior art: very crowded (academic plus Harmonic, Axiom, Math Inc, Galois,
   AWS). 7–9. Reject for this lens; formal verification is a calibration example other reports cover.

## 7. Expert systems, Cyc and the semantic web *(the AI graveyard; obsoleted, not revived)*

1. Feigenbaum named the **knowledge-acquisition bottleneck** (IJCAI 1977, "The art of artificial intelligence"). Cyc
   ([Lenat et al., AI Magazine 1985](https://ojs.aaai.org/index.php/aimagazine/article/view/510)). Semantic Web (Berners-Lee,
   Hendler & Lassila, Scientific American, May 2001) **F**.
2. Evidence of the killers: XCON grew to 6,200 rules by 1987, "approximately 50% change every year", and it was "increasingly becoming
   more difficult to change" (AAAI abstract, via [Wikipedia: Xcon](https://en.wikipedia.org/wiki/Xcon)) **F**. Cyc cost ~2,000
   person-years by 2017, against the 1983 estimate of 1,000–3,000 ([Wikipedia: Cyc](https://en.wikipedia.org/wiki/Cyc)) **F**. The semantic web:
   adoption failures were blamed on complexity and on not serving typical users ([Hitzler et al., "Two decades on", SWJ 2019](https://journals.sagepub.com/doi/10.3233/SW-190387)) **F**.
3. What flipped: knowledge acquisition is now free, but **the artefact is no longer needed**. The LLM *is* the commonsense KB
   and reads unstructured pages directly **I**.
4. Oracle: weak. 5. **Superhuman test fails**: a 100× model makes hand-curated KBs and rule bases strictly worse **I**. The
   only surviving residue is where law demands determinism and audit, and that is #2. The semantic web's real killer (publisher
   incentive) is social. Agent traffic may create a new incentive (llms.txt, MCP), but that is Lens B and social, not labour **I**.
6–9. Reject.

## 8. High-level synthesis, custom accelerators and formal hardware verification *(flipping, vendor-owned)*

1. HLS compiles C/C++ to RTL (Catapult, Vivado/Vitis HLS). Per-workload accelerators. Assertion-based FPV.
2. HLS's killer was expert pragma and dataflow tuning to close the QoR gap **I**. Accelerators' killer is NRE capital **I**. FPV's killer is
   assertion-writing expertise **I**.
3. What flipped: LAAFD reaches **99.9% geomean** of hand-tuned Vitis HLS performance across 15 kernels with co-sim feedback
   ([arXiv 2602.06085](https://arxiv.org/abs/2602.06085)) **F**. AMD publishes LLM-aided HLS case studies in 2026
   ([AMD](https://www.amd.com/en/developer/resources/technical-articles/2026/llm-aided-hls-dataflow-optimization-a-sha-256.html)) **F**.
   ProofLoop iterates SVA against JasperGold proofs ([arXiv 2604.23100](https://arxiv.org/abs/2604.23100)) **F**.
4. Oracle: **strong** (C-sim/co-sim, synthesis reports, formal proofs). This is the most oracle-rich area in my lens.
5. Superhuman: more valuable for HLS/FPV; **masks still cost what they cost**, so per-workload ASICs don't flip **I**.
6. Prior art: dense (HLS-Eval, Bench4HLS, LIFT, LAAFD, ChatSVA, STELLAR, EDA vendors' own AI suites) **F**.
7. Value is real (EDA ~$15B+ **E**), but the toolchains are proprietary and the buyers are captive to Cadence, Synopsys and AMD **I**.
   8. Proof: a Vitis HLS agent on 10 MachSuite kernels. 9. Killer: "AMD will ship this in Vitis." Reject for a solo engineer.

## 9. Scientific computing: Fortran porting and reproducibility *(labour flipped; demand split)*

1. Porting legacy Fortran; reproducing published computational results (the Claerbout/Donoho "reproducible research" lineage, 1990s).
2. Fortran porting: labour plus numerics expertise. Reproducibility: labour **and no incentive**: nobody is paid to reproduce **I**.
3. What flipped: LANL measured LLM Fortran→C++ compile rates and output similarity ([arXiv 2504.15424](https://arxiv.org/abs/2504.15424)) **F**.
   Argonne built CodeScribe ([arXiv 2410.24119](https://arxiv.org/abs/2410.24119)) **F**. CORE-Bench's best agent scored 22.2% on the hardest
   tasks ([Princeton](https://crab.cs.princeton.edu/core-website)) **F**. I4R ran Machine/Cyborg/Human replication games
   ([Open Philanthropy grant](https://www.openphilanthropy.org/grants/institute-for-replication-large-language-model-replication-games/)) **F**.
4. Oracle: moderate (tolerance-bounded numerics; the paper's own tables). 5. Superhuman: labour vanishes; **the incentive problem
   remains**: journals and funders must require it **I**. 6. Prior art: DOE labs, Princeton, I4R. 7. Value: DOE (porting);
   reproducibility has no paying buyer **I**. 8–9. Reject: labs own porting, and reproducibility is a policy problem.

## 10. Accessibility, localisation and API/doc migrations *(long-tail labour; flipped and crowded)*

1. WCAG-conformant UIs; i18n of legacy apps; library and API migrations.
2. Accessibility is pure long-tail labour. **94.8%** of the top 1M home pages have detectable WCAG failures, averaging 51 errors per page
   ([WebAIM Million 2025](https://webaim.org/projects/million/2025)) **F**. The shortcut failed: the FTC made accessiBe pay $1M over
   claims that its overlay makes sites compliant ([FTC, 2025-04-22](https://ftc.gov/news-events/news/press-releases/2025/04/ftc-approves-final-order-requiring-accessibe-pay-1-million)) **F**.
3. What flipped: **labour and demand at once**. The European Accessibility Act has applied since 28 June 2025 (Directive (EU) 2019/882) **F**.
   Migrations: Amazon claims 4,500 developer-years saved on Java 17 upgrades (Jassy, Aug 2024,
   [Simon Willison](https://simonwillison.net/2024/Aug/24/andy-jassy-amazon-ceo/)) **F**. Google reports >75% of AI-generated
   characters landing, and 5,359 files migrated in 3 months for JUnit ([arXiv 2501.06972](https://arxiv.org/abs/2501.06972)) **F**.
4. Oracle: migrations are **strong** (build + tests). Accessibility is **weak**: automated engines catch only part of WCAG, and screen-reader
   UX needs humans **I**.
5. Superhuman: more valuable, but it commoditises.
6. Prior art: GitHub piloted an accessibility agent over 3,535 PRs (May 2026; secondary source, unverified)
   ([startuphub](https://www.startuphub.ai/ai-news/technology/2026/github-pilots-ai-for-accessibility)). Deque's axe MCP server
   cut one customer from "257 hours to 4" (vendor story, [Deque](https://www.deque.com/customer-stories/mcpstory/)). accessiBe Code
   Agent launched 2026-09-17 ([PR Newswire](https://www.prnewswire.com/il/news-releases/accessibe-launches-code-agent-bringing-agentic-accessibility-into-developer-workflows-302882202.html)) **F**.
   Migrations: Moderne/OpenRewrite, Amazon Q, Google. 7–9. Reject: it is a market of incumbents with distribution.

## 11. Capability security, CHERI and information-flow control *(killer is not labour → Lens B)*

1. Dennis & Van Horn 1966 ([doi](https://doi.org/10.1145/365230.365252)); Miller, *Robust Composition* (PhD, 2006); Denning,
   "A lattice model of secure information flow", CACM 1976 ([doi](https://doi.org/10.1145/360051.360056)); Myers, JFlow, POPL 1999 **F**.
2. CHERI: porting labour is **already tiny**. A ~6 MLoC X11/Qt/KDE stack needed 0.026% of lines changed, with one engineer for ~3 months
   ([Capabilities Ltd report, 2021](https://www.cl.cam.ac.uk/research/security/ctsrd/pdfs/20210917-capltd-cheri-desktop-report-version1-FINAL.pdf);
   [The Register](https://www.theregister.com/2022/08/26/arm_cheri_morello/)) **F**. The killer is hardware availability and the
   ecosystem **I**. IFC's killer is label annotation plus declassification policy, which is partly labour and partly design **I**.
3. What flipped is **demand, not labour**: prompt-injected agents need IFC and capabilities. CaMeL solves 77% of AgentDojo tasks with
   provable security vs 84% undefended ([arXiv 2503.18813](https://arxiv.org/abs/2503.18813)) **F**. 4–9. That is Lens B, out of
   scope here. **Agents don't fix CHERI's blocker.**

## 12. The human-factors graveyard: agents don't fix these

- **Literate programming** (Knuth, Computer Journal 1984, [doi](https://doi.org/10.1093/comjnl/27.2.97)): it died because humans
  won't write everything twice. A model that explains code on demand **obsoletes** the woven document **I**.
- **MDE/MDA**: failure is "largely ... social and organizational factors" (Hutchinson, Whittle, Rouncefield et al., ICSE 2011;
  IEEE Software 2014, 450 practitioners) ([Lancaster eprints](https://eprints.lancs.ac.uk/id/eprint/69765)) **F**. It is reborn
  as "spec-driven development", where the model is prose and the generator is an LLM. That is a different idea **I**.
- **Structure editors** (Teitelbaum & Reps, CACM 1981, [doi](https://doi.org/10.1145/358746.358755)): humans hated them. Agents
  don't type, so the motivation disappears rather than flips **I**.
- **Live images (Smalltalk-80, Lisp machines)**: deployment and social factors; no labour story **I**.
- **End-user programming / programming by demonstration** (Nardi 1993; Cypher 1993) and **program synthesis**
  (Manna & Waldinger, TOPLAS 1980, [doi](https://doi.org/10.1145/357084.357090); FlashFill, POPL 2011): **solved by LLMs**,
  not revived **I**.

---

## Ranked top 3

| Rank | Idea | Uncrowded? | Oracle | Superhuman | Why this rank |
|---|---|---|---|---|---|
| 1 | Agent sandbox retrofit with hostile-library oracle (§1) | **yes** (no LLM work found) | strong functional / moderate security | mixed (rewrite competes) | Only labour-killed, uncrowded, GrowOS-shaped idea in this lens; reuses the repo's hostile-peer pattern |
| 2 | Statute re-encoding + 3-way differential audit (§2) | partly (authoring is taken by PolicyEngine/Axiom; *audit of deployed systems* is open) | strong for existing law | **more valuable** | Best superhuman robustness, but crowded by the right nonprofits and slow buyers |
| 3 | N-version as ambiguity detector for draft law (§3) | protocols taken (SpecLens); legislation open | manufactured | holds | Turns the killer (correlation) into the product; small market |

## The ONE bet (from this lens)

**Agent-driven RLBox retrofits checked by a hostile-library fuzzer.** Run the 2-week proof in §1.8 on 5 libraries. It is the only
idea here that is (a) killed by labour plus expert scarcity, (b) checkable by an automatic oracle you can build in days, and (c)
unclaimed. Commit to it only if both kill tests pass: validator holes found by human review after hostile fuzz is clean stay rare, and
wasm2c overhead is ≤25% on most libraries. Be clear-eyed: **it is weaker than GrowOS**. Its window is bounded by cheap Rust
rewrites (Chrome Fontations), and its market is small. Treat it as a strong CV artefact and possible OSS adoption, not a company.
If it fails, this lens's honest output is the **negative map** above. Outside OS/infra, the labour-killed, oracle-rich ideas
are already being harvested by Meta, Google, Amazon, Anthropic, GitHub, AMD and PolicyEngine.

## TL;DR

1. Outside OS/infra, almost every labour-killed idea with a strong oracle is **already revived** (mutation testing, PBT, migrations, a11y, proofs, HLS, rules-as-code).
2. Many famous corpses died of **non-labour causes** (N-version's correlated failure, re-confirmed with agents in 2026; MDE/semantic web social; CHERI hardware), and agents don't help.
3. The AI graveyard (expert systems, Cyc, semantic web, PBD, synthesis) is **obsoleted, not revived**: the model *is* the KB/synthesiser.
4. The one uncrowded, GrowOS-shaped survivor is **RLBox-style sandbox retrofits by agents**, with a hostile-library fuzzer as the security oracle.
5. It is a bridge bet (Rust rewrites compete); run the 2-week kill test before believing it.

## Rejected (one line each)

- **Mutation testing**: flipped; Meta ACH (0.95/0.96 equivalence, 73% acceptance) already ships it.
- **Property-based testing**: flipped; Anthropic's agentic PBT found and merged real bugs in NumPy et al.
- **DbC / B / dependent types**: proof labour flipped (vericoding 82–89% Dafny); spec intent remains; crowded.
- **Expert systems / Cyc / semantic web**: superhuman model obsoletes hand-built KBs; semantic web's killer is social.
- **HLS / FPV**: oracle-rich and flipping, but owned by AMD/Cadence/Synopsys and academia (LAAFD 99.9%).
- **Custom accelerators per workload**: killer is mask NRE capital, not labour.
- **Fortran porting**: DOE labs (LANL, Argonne, LLNL) are on it.
- **Reproducibility**: labour flips, incentive doesn't; no paying buyer.
- **Verified numerics (Herbie)**: never labour-bound; niche demand.
- **Memory-safe C/C++ rewrites**: crowded (TRACTOR, Chrome, Microsoft); covered by other reports.
- **CHERI / capabilities**: porting is already 0.026%; blocker is hardware. IFC → Lens B (CaMeL).
- **Literate programming, MDE, structure editors, live images**: human-factors deaths; agents don't fix or obsolete them.
- **End-user programming / program synthesis**: solved by LLMs, not revived.
- **Accessibility / localisation / API migrations**: flipped, with incentives (EAA June 2025) and incumbents (GitHub, Deque, accessiBe, Google, Amazon, Moderne) already there.
- **Rules-as-code authoring**: PolicyEngine's Claude plugin and the Axiom Foundation already do agent-encoding with oracle tracking; only the *audit* angle (§2) survives.

*Scratch: `/tmp/flip-broad/` held the RLBox PDF for figure extraction; deleted at end.*
