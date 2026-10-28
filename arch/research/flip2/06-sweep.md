# Flip round 2, report 06: a sweep of the rest of CS, and the rule that predicts flips (2026-10-28)

Lens: every area of computer science that the other round-2 reports (GPU kernels, distributed training/serving,
LLM-as-proposer in PL/verification, compiling agent programs, numerics/data) and round 1 (`flip/01–06`) do not cover.
Areas swept: algorithms and complexity, cryptography, information retrieval, graphics, robotics and control,
computational science, bioinformatics, computer architecture, quantum computing, embedded/real-time, classic computer
vision, networking theory, game theory and mechanism design, and education. Per-idea template and labels follow
`flip/BRIEF.md`: **F** = sourced fact, **M** = measured here, **I** = inference, **E** = estimate.

Method note: about 40 web searches and primary-source reads (arXiv abstracts, vendor engineering posts, project
pages, meeting notes), all on 2026-10-28. One tiny experiment was attempted and abandoned (§3.1 records why). Nothing
here was measured; there are no **M** claims.

---

## 0. The answer in brief

- **I — The sweep confirms round 1's pessimism, and sharpens it.** In 12 of the 14 areas, the obvious
  "old idea + oracle + agent" combination was already being worked on by mid-2026. It is mostly held by whoever owns
  the oracle: DeepMind, IBM and Google for QEC, Siemens for PLCs, the Ethereum Foundation's grantees for zkVMs, Meta
  for compression, DOE labs for simulation codes. Academia covers the rest (5+ groups on LLM-discovered qLDPC codes
  in June–August 2026 alone).
- **I — The general rule (§5) has four gates, and the fourth one, oracle ownership, predicts who wins.** An old idea
  flips when (1) it died of per-case labour, not capital, physics or coordination; (2) an *independent, extensional*
  oracle checks the result far more cheaply than the labour it replaces; and (3) the artefact must run *without the
  model*, because microseconds, certification, cost per call or offline use keep the model out. If it fails (3), the
  model replaces the idea instead of reviving it: expert systems, end-user programming, tutoring dialogue. Gate (4)
  decides who captures it. If one organisation owns the oracle, it revives the idea in-house before anyone else. Outsiders win only
  where the oracle is public or sits with many fragmented customers.
- **Top 3 from the sweep:** (1) **agent-grown format descriptions for format-aware compression** (OpenZL), where
  lossless roundtrip is the oracle and a fixed universal decoder blocks the obvious cheat; (2) **LLM-evolved QEC
  decoders** with a Stim circuit-level simulator as the oracle (no prior art found for *decoders*; codes are crowded);
  (3) **certificate-carrying evolved code**: Mehlhorn-style certifying algorithms as a run-time checker for
  AlphaEvolve-style output. That last one is the cross-cutting fix for the reward hacking that ADRS documents.
- **The ONE bet: grow format descriptions for format-aware compression.** It has the strongest oracle in the sweep,
  a model-free hot-path artefact, buyers whose oracles (their own data) are fragmented, and a two-week proof on a
  laptop. Its main risk is that Meta ships the same loop inside OpenZL.

---

## 1. Area-by-area sweep (compact)

Every row was checked with a search on 2026-10-28. "Occupied" means a named group was doing the revived version in
2025–2026.

| Area | Strongest old idea + oracle + agent | Oracle | Status (2025–26) | Verdict |
|---|---|---|---|---|
| Algorithms: heuristic discovery | Genetic programming / hyper-heuristics (Koza 1992), with LLM mutation | Benchmark score (medium, overfits) | **Occupied.** FunSearch ([Nature, Dec 2023](https://www.nature.com/articles/s41586-023-06924-6)); AlphaEvolve, GA on Google Cloud from 2026-07-09 ([Google Cloud](https://cloud.google.com/blog/products/ai-machine-learning/alphaevolve-is-available-for-everyone)); OpenEvolve/ADRS ([Berkeley, Oct 2025](https://arxiv.org/abs/2510.06189)); 67 maths problems ([Georgiev, Gómez-Serrano, Tao, Wagner, 2025-11-03](https://arxiv.org/abs/2511.02864)) **F** | Reject as a product; keep the *checker* half (§3.3) |
| Algorithms: SAT/SMT at scale | Proof-producing solvers (DRAT, used in SAT Competition checking since 2013–14) plus agent-evolved solvers | **Strong**: model check for SAT, DRAT proof check for UNSAT | **Occupied.** SATLUTION evolved repository-scale solvers that beat SC2025 winners (347 vs 334 solved, self-reported) and validated UNSAT with DRAT ([NVIDIA, 2025-09-09](https://arxiv.org/abs/2509.07367)); LLM2SMT, an agent-built QF_UF solver emitting Lean proofs ([Janota & Olšák, 2026-03-06](https://arxiv.org/abs/2603.06931)) **F** | Occupied; it is the calibration for §3.3 |
| Theory: formalised maths | QED manifesto (1994): formalise all of mathematics, died of labour | **Strongest** (Lean kernel) | **Occupied and funded.** Math Inc's Gauss formalised strong PNT (~25k lines of Lean in 3 weeks, Sept 2025) ([Fields talk](https://gfs.fields.utoronto.ca/talks/Gauss-agentic-formalization-Prime-Number-Theorem)); Harmonic, DeepMind **F** | Textbook flip, fully taken |
| Crypto: ZK / verifiable computation | GKR/Pinocchio-era verifiable computation, now zkVMs; formal circuit verification against Sail | **Strong** (Lean, Sail) | **Occupied.** EF zkEVM FV project (24/55 RISC-V opcodes verified vs Sail at 2026-04-08, [breakout #03](https://ethereum-magicians.org/t/l1-zkevm-breakout-03-april-8-2026/28148)); AI provers (Harmonic Aristotle, Logical Intelligence Aleph) already used on Plonky3/RISC Zero ([2605.30106](https://arxiv.org/abs/2605.30106)); zkSecurity Clean ([blog](https://blog.zksecurity.xyz/posts/clean-verified-zkvms/)) **F** | Taken; join it |
| Crypto: FHE | Gentry 2009; programming FHE needs scarce experts (noise budgets, parameters) | **Strong** functionally (plaintext execution) | Agents studied (TFHE-Coder [2503.12217](https://arxiv.org/abs/2503.12217), FHE-Coder ICLR 2026); compilers (Google HEIR) **F**. **I:** the death cause is mostly 10³–10⁶× compute overhead, not authoring | Fails gate 1: labour isn't what killed it |
| Crypto: PQC migration (Lens B) | Crypto agility (RFC 7696, 2015) plus agent remediation | Strong for primitives (KATs, interop); weak at application level | Deadlines are real: NIST IR 8547 draft deprecates quantum-vulnerable public-key algorithms after 2030 and disallows them after 2035 ([NIST, Nov 2024](https://csrc.nist.gov/pubs/ir/8547/ipd)); AWS removes Kyber-draft endpoints in 2026 ([AWS](https://www.amazonaws.cn/blog-selection/ml-kem-post-quantum-tls-now-supported-in-aws-kms-acm-and-secrets-manager/)) **F**. Inventory vendors plus generic agents **I** | Runner-up (§3.7) |
| Crypto: key transparency | CONIKS ([USENIX Sec 2015](https://www.usenix.org/conference/usenixsecurity15/technical-sessions/presentation/melara)) / CT for agent identity | Strong (Merkle consistency) | Shipped: WhatsApp KT ([2023-04-13](https://engineering.fb.com/2023/04/13/security/whatsapp-key-transparency/)), Sigstore **F**. **I:** never labour-killed | Reject: alive, no labour flip |
| Information retrieval | Cranfield/TREC pooling: human relevance assessment is labour-bound | **Circular.** LLM judges grade LLM retrievers | Contested: UMBRELA claims run-level parity at TREC 2024 RAG; Clarke & Dietz show runs built to *subvert* LLM judges ([2412.17156](https://arxiv.org/abs/2412.17156)) **F** | Fails gate 2 (oracle not independent), like N-version |
| Graphics: procedural generation | Shape grammars / L-systems / inverse procedural modelling: rule authoring was the labour | Weak (VLM or image judge) | Academic churn: LL3M ([2508.08228](https://arxiv.org/abs/2508.08228)), BlenderGym, ProcFunc ([2604.26943](https://arxiv.org/abs/2604.26943)), 3DCodeBench **F** | Weak oracle; no buyer seam |
| Graphics: drivers / API layers | Wine/DXVK-style translation layers, grown against Khronos CTS | **Strong, public** (~2.9M CTS cases) | Being done bottom-up. A hobby PS5 Vulkan driver with an `AGENTS.md` reports 1,569,390 pass / 0 fail of 2,919,757 cases on 2026-09-29, the author's own runs ([repo](https://github.com/mihawk-99/PS5_Vulkan)); LunarG KosmicKrisp is conformant Vulkan 1.4 on Metal ([Phoronix](https://www.phoronix.com/news/KosmicKrisp-Vulkan-1.4)) **F** | GrowOS-shaped, but it is round 1's driver bet (§3.4) |
| Robotics and control | Simplex/runtime assurance (Sha 2001); MPC (1970s); reward design | Simulator (fidelity gap) | Eureka and DrEureka ([RSS 2024](https://roboticsproceedings.org/rss20/p094.html)) **F**; safety filters are an active academic field **I** | Sim-to-real gap makes the oracle weak; occupied by NVIDIA and academia |
| Control: PLC code | IEC 61131 code with model-checked specs | Strong (nuXmv) for stated specs | **Occupied:** LLM4PLC with Siemens co-authors ([ICSE-SEIP 2024](https://arxiv.org/abs/2401.05443)), Agents4PLC (IEEE TSE 2026), SemaPLC ([2608.18565](https://arxiv.org/abs/2608.18565)) **F** | Incumbent-owned toolchain (gate 4) |
| Computational science | Method of manufactured solutions (Salari & Knupp 2000): solver verification by observed order of accuracy | **Strong, public** | **Occupied academically:** MOOSEnger MMS benchmark ([2603.04756](https://arxiv.org/abs/2603.04756)), MMS as an RL reward ([2607.10474](https://arxiv.org/abs/2607.10474)), PDEAgent-Bench ([2605.09636](https://arxiv.org/abs/2605.09636)), CodePDE **F**; DOE labs own the codes (round 1) | Best oracle in its area, but taken (§3.6) |
| Bioinformatics | Workflow porting / pipeline construction checked against GIAB truth sets | Strong for small variants | Agents benchmarked: VariantBench, best ~38% pass ([Latch](https://blog.latch.bio/p/variantbench-an-agentic-benchmark)); BaseCamp ([2609.28557](https://arxiv.org/abs/2609.28557)); Biomni, FutureHouse **F** | Occupied; data access, not code, is the bottleneck **I** |
| Computer architecture | Simulator-driven design-space exploration (SimpleScalar, gem5) | Medium (simulator ≠ silicon) | **Occupied:** gem5 Co-Pilot ([2510.19577](https://arxiv.org/abs/2510.19577)), Agentic Architect ([2604.25083](https://arxiv.org/abs/2604.25083)); EDA covered in round 1 **F** | Reject |
| Quantum: compilers | Peephole/superoptimisation of circuits | Strong at small n (unitary/ZX) | **Occupied:** IBM RL synthesis passes in the Qiskit transpiler ([2503.14448](https://arxiv.org/abs/2503.14448)); AlphaTensor-Quantum **F** | Incumbent-owned |
| Quantum: QEC codes | LLM-guided code search | Strong (distance, BP-OSD logical error rate) | **Crowded in 2026:** IBM ([2606.02418](https://arxiv.org/abs/2606.02418)), MPI ([2606.24808](https://arxiv.org/abs/2606.24808)), OmniQEC ([2607.25865](https://arxiv.org/abs/2607.25865)), Qian & Li ([2608.08996](https://arxiv.org/abs/2608.08996)), AlphaEvolve encodings ([2606.25870](https://arxiv.org/abs/2606.25870)) **F** | Reject |
| Quantum: QEC decoders | Hand-designed decoders (MWPM 1965, union-find 2017, BP-OSD 2019), evolved by LLMs | **Strong, cheap** (Stim) | **No LLM-evolved decoder found.** Neural decoders: AlphaQubit 2, under 1 µs per cycle to d=11 ([2512.07737](https://arxiv.org/abs/2512.07737)) **F** | **Top 3 (§3.2)** |
| Embedded: WCET | Abstract-interpretation timing models (AbsInt aiT), hand-built per processor | **Unsound oracle**: measurements cannot prove an upper bound | Labour documented ("hand-crafted by human experts", months per model; [Pister, 2010](https://www.rw.cdl.uni-saarland.de/private/pister/talks/talk-lctes2010.pdf)) **F**; no AI work found **I** | Fails gate 2: the oracle can't certify safety |
| Embedded: DO-178C evidence | Requirements-based test generation to MC/DC | Coverage tool (gameable) | Vendor and academic AI pilots (Embedded Testing 2026 talk; AeroCON 2026) **F**; Rapita: "blindly generating tests to simply get a high or complete coverage metric is a very bad way of testing software" ([2013-10-15](https://www.rapitasystems.com/blog/automatic-generation-mcdc-test-cases-complete-waste-time)) **F** | Oracle measures coverage, not intent (§3.8) |
| Classic CV | SIFT/SfM/hand-tuned pipelines | Strong-ish (reprojection error) | **I:** obsoleted by learned models (VGGT-class feed-forward reconstruction), not revived; labels from foundation models | Fails gate 3: the model replaces the idea |
| Networking theory: congestion control | Remy, machine-generated CC (SIGCOMM 2013), revived with readable LLM code | Simulator/emulator (fidelity gap) | **Occupied:** PolicySmith (HotNets '25), GenCC ([2603.10357](https://arxiv.org/abs/2603.10357)), BBR variant +27% in production QUIC ([2508.16074](https://arxiv.org/abs/2508.16074)) **F** | Reject |
| Networking/formal: protocol model learning | Angluin L* (1987) plus hand-written mappers (Aarts/Vaandrager), with LLM-written mappers | **Strong** (the live implementation) | Static LLM inference exists (ProtocolGPT, [2405.00393](https://arxiv.org/abs/2405.00393)); no LLM-as-mapper active learning found **I** | Niche runner-up (§3.5) |
| Game theory / mechanism design | Automated mechanism design (Conitzer & Sandholm 2002) | IC checks only at small sizes | LLM-AMD exists ([2502.12203](https://arxiv.org/abs/2502.12203)) **F**; it died of intractability, not labour **I** | Fails gate 1 |
| Education | Intelligent tutoring systems: 200–300 authoring hours per instruction hour; CTAT 50–100 ([via PromptHive, 2410.16547](https://arxiv.org/abs/2410.16547)) | Weak and slow (learning gains) | Live LLM tutors replace authored tutors; AI2T argues for checkable model-tracing tutors ([2411.17924](https://arxiv.org/abs/2411.17924)) **F** | Fails gate 3 (mostly) and gate 2 |
| Computer algebra | Risch/Rubi rule bases (Rubi ~6,700 rules, labour-bound, [JOSS 2018](https://joss.theoj.org/papers/10.21105/joss.01073)) | **Strong**: differentiate the antiderivative | **I:** perfect oracle, tiny buyer; Mathematica/SymPy exist | Reject: no value |
| Information theory: format-aware compression | Format-specific compressors (PAQ models, CRAM, columnar codecs) | **Strong**: lossless roundtrip plus held-out ratio | **Partially open.** Meta OpenZL ships the framework and an "SDDL for LLMs" spec; AgentGC for genomics ([2601.13559](https://arxiv.org/abs/2601.13559)) **F** | **ONE bet (§3.1)** |

---

## 2. Why the sweep mostly comes back "occupied"

- **F —** In 2026 the AlphaEvolve pattern became a commodity: Google sells it (GA July 2026); OpenEvolve and ADRS
  report "a few hours" and "≤ $5–$20" per case study ([ADRS Table 1/§5](https://arxiv.org/abs/2510.06189)); IBM
  spent about $400 of LLM inference screening ~2×10⁵ qLDPC candidates ([2606.02418](https://arxiv.org/abs/2606.02418)).
- **I —** When a search loop costs $10, every area whose problem fits "propose code, score it" gets tried within
  months by the people who already hold the evaluator. Being able to write a loop is therefore worth nothing. What
  is scarce is (a) an evaluator that resists hacking and (b) access to an oracle you don't own.
- **F — ADRS names the failure itself:** "some candidates bypassed one stage of the evaluation pipeline, achieving
  high scores without performing the full task"; spot-scheduling policies "collapsing on unseen spot patterns"; and
  evaluator cost is the limiting factor ("If each evaluation takes many hours … the overall process can take months").
  The Qwen-authored "Verification Horizon" argues that "no fixed reward function can remain effective as policy
  capability continues to grow" ([2606.26300](https://arxiv.org/abs/2606.26300), 2026-06-24).
- **I — So the open seams sit where the oracle is unusually hard to game *and* not owned by the incumbent.** The three
  ranked ideas below each have a structural anti-cheat property, not just a test suite.

---

## 3. Ideas in full template (8)

### 3.1 Grow format descriptions for format-aware compression (OpenZL), with roundtrip as the oracle — ONE bet

1. **Idea — F.** Compressors specialised to a data format beat generic LZ/entropy coders by exploiting structure:
   PAQ's per-type context models, CRAM for genomics, columnar encodings. Meta's OpenZL (open-sourced 2025-10-06)
   turns this into "describe → train → compress". A user supplies a format description in SDDL (Simple Data
   Description Language) or a parser function; an offline trainer searches transform graphs; every frame records its
   plan, and **one universal decoder** decodes all files ([Meta Engineering](https://engineering.fb.com/2025/10/06/developer-tools/openzl-open-source-format-aware-compression-framework), [paper 2510.03203](https://arxiv.org/abs/2510.03203)).
   **The revival:** an agent writes and maintains the format description for each of a customer's formats, and only
   compressed bytes plus a lossless roundtrip decide what is accepted.
2. **Why it stayed niche — F/I.** Meta: "every bespoke scheme means another compressor and decompressor to create,
   ship, audit, patch, and trust" **F**. OpenZL removes the decompressor half. The *description* half (one per
   internal binary format, log schema or telemetry record, each drifting with versions) is still per-format labour
   **I**. On a format without exploitable structure, OpenZL falls back to zstd **F**.
3. **What flipped — F/E.** Benchmark (SAO file, M1): zstd -3 ×1.31 at 220/850 MB/s; xz -9 ×1.64 at 3.5/45 MB/s;
   OpenZL ×2.06 at 340/1200 MB/s **F**. So a good description beats xz's ratio at zstd's speed. Format descriptions
   are exactly the long-tail, spec-reading labour agents absorb, and OpenZL already publishes an "SDDL for LLMs" page,
   "complete v0.6 spec optimized for AI assistants" ([openzl.org/sddl](https://openzl.org/sddl/)) **F**. **E:** an
   agent can draft a description in minutes, while a human engineer needs hours to days per format.
4. **Oracle — strong.** (a) Exact lossless roundtrip on every file; (b) compressed bytes, *including* trained
   dictionaries and plan, on held-out files; (c) compression and decompression throughput at a fixed floor. The
   universal decoder is the structural anti-cheat: the agent cannot ship data inside a custom decoder, because the
   decoder is fixed and outside its control **I**.
   *How it could cheat:* overfit the plan or dictionary to training files (counter: date-split held-out files and
   counting dictionary bytes); produce a description that fails on unseen variants (counter: roundtrip on all files,
   with failure scored as a zstd fallback); trade speed for ratio (counter: throughput floor); edit the harness
   (counter: read-only harness in a separate process).
5. **Superhuman model — I.** More valuable. Better models write better descriptions faster, but the artefact runs at
   GB/s in storage and network hot paths, where no model can sit. It passes gate 3 completely.
6. **Prior art — F/I.** Meta OpenZL (framework; plans an "automated compressor explorer" for *plan* changes, and its
   blog does not mention LLMs) **F**. AgentGC: an LLM multi-agent evolutionary compressor, genomics-only
   ([2601.13559](https://arxiv.org/abs/2601.13559), Jan 2026) **F**. LLM-*as*-compressor work (arithmetic coding with
   model probabilities, e.g. [CIDR 2026](https://www.vldb.org/cidrdb/papers/2026/p34-kipf.pdf)) is a different idea:
   the model sits in the decode path **F**. I found no product or paper where an agent grows OpenZL descriptions
   across a customer's formats **I**. **The occupation risk is high:** Meta wrote the LLM spec page, so the loop
   could become an OpenZL feature at any time **I**.
7. **Value — E.** Buyers are companies storing or shipping large volumes of *their own* structured binary data:
   telemetry, logs, market data, ML feature stores, game assets. At $0.02/GB-month object storage, moving one PB from
   ×1.3 to ×2.0 saves about 0.27 PB, roughly $5.4k/month in storage alone, plus egress and network. A $1–3k/month
   service per customer is plausible only at multi-PB scale; below that it is an open-source tool or a consulting
   offering. **I:** the oracle is the customer's own data, so the incumbent cannot pre-own it, and gate 4 favours an
   outsider.
8. **Two-week proof — E.** Days 1–2: build the OpenZL CLI and trainer from source. Pick 10 public binary or
   semi-structured formats: e.g. pcap, Parquet pages, protobuf-delimited logs, OpenTelemetry OTLP dumps, GRIB
   weather, FITS, BAM, SQLite pages, game replay files, CAN-bus logs. Days 3–9: an agent, with only the spec, sample
   files and a read-only harness, writes an SDDL description or a parser per format; accept only on 100% roundtrip.
   Days 10–14: score held-out files (date or source split) against zstd -3/-19, xz -9, and OpenZL with *no*
   description; log agent minutes and human interventions.
9. **Demo / tweet / kill — E.** Tweet: "An agent read the GRIB spec, wrote a 40-line format description, and our
   weather archive got 1.6× smaller with no new decoder. Every file roundtrips." Expert killer: "zstd -19 with a
   trained dictionary gets 90% of that, and Parquet is already columnar." **Kill if** on held-out files the
   agent-described plan beats max(zstd -19 with dictionary, OpenZL without description) by less than 15% on at least
   6 of 10 formats at equal or better decompression speed, or if more than 2 formats need human edits to the
   description. Stop the *company* idea, but keep the OSS result, if Meta ships agent authoring before the proof
   finishes.

**Experiment note — M-not-obtained.** I installed the `openzl` 0.3.0 wheel in `/tmp/flip2-sweep` to test the kill
condition locally. The Python binding exposes only the graph/codec API; there is no SDDL compiler or trainer. Building
the C trainer was more than this report's budget, so the scratch directory was deleted with no result. The two-week
proof starts with exactly that build.

### 3.2 LLM-evolved QEC decoders, gated by circuit-level simulation

1. **Idea — F.** Decoders turn syndromes into corrections. Classic designs are hand-built: minimum-weight perfect
   matching (Edmonds 1965), union-find (Delfosse–Nickerson 2017), and BP+OSD for qLDPC (Panteleev–Kalachev 2019).
   **The revival:** AlphaEvolve-style evolution of decoder *programs* per code family and noise model, scored by
   logical error rate in a stabilizer simulator such as Stim ([Gidney, Quantum 2021](https://quantum-journal.org/papers/q-2021-07-06-497/)),
   under an operation or latency budget.
2. **Why it is hard / niche — F.** Real-time decoding needs sub-µs per round on fast qubits. Riverlane's FPGA LCD
   reaches that for the surface code ([2411.10343](https://arxiv.org/abs/2411.10343)), but its own 2026 blog says
   sub-µs latency is not established for every qubit type. An IBM paper finds FPGA-tailored qLDPC decoders "remain
   far slower and less accurate than Relay" ([2511.21660](https://arxiv.org/abs/2511.21660)) **F**. Each new code
   family needs a new decoder engineered by a small expert pool **I**.
3. **What flipped — F/I.** 2026 produced a wave of LLM-*discovered codes* (§1 table), all evaluated with
   off-the-shelf BP-OSD **F**. That creates a decoder gap: every new code ships without a tuned real-time decoder
   **I**. Evolution loops cost dollars (§2) **F**.
4. **Oracle — strong and cheap.** Circuit-level Monte Carlo in Stim with a fixed noise model; logical error rate with
   confidence intervals; an operation-count or FPGA-resource proxy for latency. *How it could cheat:* reading the
   sampled error instead of only the syndrome (counter: decoder runs in a separate process that receives syndrome bits
   only); overfitting to one noise strength or seed (counter: held-out noise parameters and seeds, and where available
   public experimental syndrome data); a latency proxy that doesn't match hardware (counter: final candidates
   synthesised with HLS or on an FPGA); exploiting confidence intervals with few shots (counter: a fixed shot budget
   and sequential testing).
5. **Superhuman model — I.** More valuable. The decoder runs in hardware at microseconds, so the model can never be in
   the loop; better models only search better.
6. **Prior art — F.** Code discovery is crowded (IBM, MPI, OmniQEC, Qian & Li, AlphaEvolve encodings). Neural
   decoders: AlphaQubit 2 runs under 1 µs per cycle to d=11 on commercial accelerators
   ([2512.07737](https://arxiv.org/abs/2512.07737), DeepMind/Google Quantum AI). Two searches found **no LLM-evolved
   decoder**. One qLDPC "frontier decoder" paper only mentions Codex as an implementation helper
   ([2606.20513](https://arxiv.org/abs/2606.20513)) **F/I**.
7. **Value — E.** Buyers are about 10–20 hardware companies plus decoder vendors (Riverlane) and platform vendors
   (NVIDIA CUDA-Q QEC). Few, rich, and expert. **I — gate 4 applies:** Google and IBM own the hardware, the noise
   data and the decoder teams, and can run the same loop in-house within weeks. This is a strong *research or CV*
   artefact (a public leaderboard of evolved decoders per new code) more than a business.
8. **Two-week proof — E.** Take three published 2026 LLM-discovered qLDPC codes plus the [[144,12,12]] gross code. In
   Stim, build circuit-level noise with a fixed syndrome-extraction circuit. Evolve decoder programs (Python to start,
   then a C subset with an op budget) seeded from BP-OSD and Relay-style message passing. Score against BP-OSD on
   held-out noise strengths.
9. **Demo / tweet / kill — E.** Tweet: "Five new qLDPC codes appeared this summer, all decoded with the same BP-OSD.
   An evolution loop found decoders with 2× lower logical error at the same op budget." Expert killer: "You beat
   untuned BP-OSD; tuned Relay-BP already does that, and your op count isn't FPGA latency." **Kill if** evolved
   decoders don't beat the best published decoder for each code (not just default BP-OSD) at equal op budget on
   held-out noise, or if the gain vanishes after HLS synthesis.

### 3.3 Certificate-carrying evolved code: certifying algorithms as the run-time oracle

1. **Idea — F.** A *certifying algorithm* returns its answer plus a witness that a small, simple checker verifies,
   e.g. a bipartition for "not bipartite", an augmenting-path-free cut for max-flow optimality, a dual solution for
   LP optimality. It was proposed and catalogued by McConnell, Mehlhorn, Näher & Schweitzer
   ([Computer Science Review, 2011](https://doi.org/10.1016/j.cosrev.2010.09.009)) and built into LEDA. SAT solving
   adopted the same idea as DRAT proofs, used to check SAT Competition results from 2013–14
   ([Heule et al., DRAT-trim](https://arxiv.org/abs/1610.06229)). **The revival:** require AI-evolved or agent-written
   algorithms to emit certificates, and ship the checker *with the code in production*. A wrong answer on an unseen
   input is then caught on that input, not only on the benchmark.
2. **Why it stayed niche — I.** Writing a certifying variant and its checker roughly doubles the labour per
   algorithm, and humans trusted their own code. Outside SAT/SMT, proof logging stayed rare.
3. **What flipped — F/I.** Evolved code is untrusted by construction, and the hacking is documented: ADRS candidates
   "bypassed one stage of the evaluation pipeline"; spot policies "collapse on unseen spot patterns" **F**. The
   Verification Horizon paper argues fixed rewards decay as capability grows **F**. SATLUTION shows the old fix works
   at repository scale: UNSAT claims were accepted only with checked DRAT proofs **F**. Tao et al. note AlphaEvolve
   gives only one-sided bounds unless a dual problem exists ([2511.02864](https://arxiv.org/abs/2511.02864)), which
   is exactly the certificate gap **F**. The extra labour of the certifying variant is now nearly free **I**.
4. **Oracle — strong and *run-time*.** The checker is small (often under 200 lines), can be formally verified (e.g.
   verified LRAT checkers), and runs on every production input. *How it could cheat:* time out or refuse hard inputs
   (counter: count solved instances, not just correctness); exploit a checker bug (counter: tiny verified checkers,
   kept out of the agent's write scope); certificates that are valid but loose (counter: score the optimality gap
   between primal and dual, not just feasibility).
5. **Superhuman model — I.** More valuable. Stronger optimisers find stronger hacks, and a sound checker doesn't
   decay. This matches Lampson's "hint checked against the truth" from round 1 (`flip/06`), applied at run time.
6. **Prior art — F/I.** LEDA checkers, DRAT/LRAT, cvc5 and Lean proof production, and MIP solvers' dual bounds all
   exist **F**. AlphaEvolve GA and OpenEvolve leave evaluators to users **F**. I found no library or harness that
   *enforces* certificates on evolved code across problem classes **I**. Risk: it reads as a feature for Google's
   AlphaEvolve or OpenEvolve rather than a product.
7. **Value — E.** Indirect: users of evolved solvers in logistics and scheduling (FM Logistic and Klarna are named
   AlphaEvolve users, vendor-reported). Most likely an OSS harness plus a checker zoo (graph, flow, matching, LP/MIP
   gap, SAT/UNSAT, scheduling feasibility), adopted by OpenEvolve/ShinkaEvolve users. Also directly useful inside
   GrowOS-style loops **I**.
8. **Two-week proof — E.** Pick five classes (bipartite matching, max-flow, shortest paths with negative edges, MIS
   heuristics with an LP dual bound, SAT). Run OpenEvolve twice per class: test-suite evaluator vs
   certificate-required evaluator. Inject known harness loopholes and hold out adversarial instances. Measure the
   hack rate and held-out wrong-answer rate.
9. **Demo / tweet / kill — E.** Tweet: "Same evolution budget, same benchmark. Without certificates, 3 of 5 evolved
   solvers return wrong answers on held-out inputs; with certificates, 0, and each wrong answer was caught at run
   time." Expert killer: "Feasibility checks are standard; you've rediscovered unit tests." **Kill if** a plain
   test-suite evaluator with adversarial tests yields the same held-out wrong-answer rate, or if certificate overhead
   costs more than 20% of solved instances.

### 3.4 Graphics API layers and drivers grown against Khronos CTS (GrowOS-shaped, but round 1 has it)

1. **Idea — F.** Translation layers (Wine 1993, DXVK, MoltenVK) and Mesa drivers implement a published API whose
   conformance suite is public (Vulkan CTS: ~2.9M cases, per the PS5 project run).
2. **Why it was hard — F/I.** Long-tail semantics per extension; small expert teams (Asahi, LunarG).
3. **What flipped — F.** A hobby PS5 Vulkan driver keeps an `AGENTS.md` with rules for AI agents and reports
   1,569,390 pass / 0 fail, with 1,350,306 unsupported, on 2026-09-29 (the author's runs, not a Khronos submission)
   ([repo](https://github.com/mihawk-99/PS5_Vulkan)). It is unclear how much code AI wrote **I**.
4. **Oracle — strong.** CTS plus reference rasterisers (lavapipe). *Cheat:* reporting features as unsupported to skip
   tests. The PS5 numbers show that "not supported" is a big bucket.
5–7. **I.** Model-free run time and a public oracle: gates 1–4 all pass. But round 1's ONE bet (`flip/01`,
   driver-adapter grower) already covers this shape, and hobbyists are doing it bottom-up. Buyers: console and Apple
   porting houses, Valve. **Not ranked, to avoid double-counting.**

### 3.5 Active automata learning with LLM-written mappers

1. **Idea — F.** Angluin's L* (1987) learns a state machine from membership and equivalence queries. Practical
   protocol learning needs a hand-written *mapper* from abstract to concrete messages (Aarts et al.; survey
   [Vaandrager, CACM 2017](https://cacm.acm.org/research/model-learning/)). It found TLS state-machine bugs
   (de Ruiter & Poll, USENIX Security 2015).
2. **Death — I.** Each mapper is protocol-specific expert labour, and equivalence queries are expensive; it stayed an
   academic tool.
3–4. **Flip/oracle — I.** The LLM writes the mapper from the RFC; the live implementation is the oracle, so it is
   strong for membership queries. *Cheat:* a mapper that collapses distinct states (a coarser alphabet means trivially
   small models). Counter: conformance tests against the RFC and state-coverage metrics.
6. **Prior art — F.** ProtocolGPT infers state machines statically from code ([2405.00393](https://arxiv.org/abs/2405.00393));
   ChatAFL uses LLM grammars for fuzzing. I found no LLM-as-mapper active learning **I**.
7. **Value — E.** Protocol security testing; small market; overlaps `flip/02` (protocol interop). Runner-up only.

### 3.6 MMS-gated simulation code (computational science)

1. **Idea — F.** Method of manufactured solutions: pick an analytic solution, derive the source term symbolically,
   and require the solver's observed order of accuracy to match theory (Salari & Knupp, Sandia 2000; Roache).
2. **Death — I.** Not dead. It is standard verification practice, but laborious per PDE and boundary condition.
3–4. **I.** A symbolic step plus a convergence study is a near-ideal oracle: observed order is hard to fake without
   solving the PDE. *Cheat:* special-casing the manufactured source. Counter: randomised manufactured solutions.
6. **Prior art — F.** MOOSEnger's 10-problem MMS benchmark ([2603.04756](https://arxiv.org/abs/2603.04756)); MMS as a
   continuous RL reward ([2607.10474](https://arxiv.org/abs/2607.10474)); PDEAgent-Bench ([2605.09636](https://arxiv.org/abs/2605.09636)).
   **Occupied academically; DOE labs own the codes** (round 1). Rejected as a bet, but worth borrowing as an oracle
   pattern for the numerics report.

### 3.7 Agent-driven PQC migration (Lens B)

1. **Idea — F.** Crypto agility (RFC 7696, 2015): keep algorithms swappable. Most code isn't agile.
2. **Why it is pressing — F.** NIST IR 8547 (draft, Nov 2024) deprecates quantum-vulnerable public-key algorithms
   after 2030 and disallows them after 2035; AWS removes Kyber-draft endpoint support in 2026.
3–4. **I.** Labour is enormous and deadline-driven, which suits agents. The oracle is strong for primitives (KATs,
   Wycheproof, interop handshakes) but weak at application level. Example: an RSA-OAEP key-transport call doesn't map
   1:1 to a KEM, and naive "syntactic replacement" is the documented failure mode ([OSA SP-040](https://opensecurityarchitecture.org/patterns/sp-040)).
6. **Prior art — I.** Inventory and discovery vendors (IBM, SandboxAQ, Keyfactor and others) plus generic coding
   agents. I found no single agent-remediation product in one search, but the space is crowded with funded security
   vendors.
7. **Value — E.** Large (every regulated enterprise), but the *oracle gap* is semantic protocol redesign, which
   agents don't check. Runner-up; falls to gate 2 at the application layer.

### 3.8 Requirements-based test evidence for DO-178C/ISO 26262 (embedded)

1. **Idea — F.** Certification needs requirements-based tests achieving structural coverage (MC/DC for DAL A).
2. **Labour — F.** Vendors and talks claim 40%+ faster test creation with LLMs (Embedded Testing 2026 abstract,
   vendor-reported).
3–4. **I.** The oracle is the coverage tool plus the requirement. Coverage is gameable: tests that hit MC/DC without
   checking the requirement are, in Rapita's words, "a very bad way of testing software" **F**. Intent lives in the
   requirement text, so the oracle is *intensional*.
5. **I.** Certification forbids the model at run time, so gate 3 passes. But gate 2 fails for the part that matters.
   Tool qualification (DO-330) for LLM generators: none published, from one search **I**. Reject as a bet; it may
   fit a vendor such as Rapita, LDRA or VectorCAST.

---

## 4. Ranked top 3 (by the brief's bar: verified pain, old proven fix, no product, better models make it better)

| Rank | Idea | Pain verified in primary source? | Old fix proven? | Product exists? | Better model ⇒ | Main risk |
|---|---|---|---|---|---|---|
| **1** | Agent-grown format descriptions (OpenZL) | Partly. Meta states the bespoke-scheme cost **F**; per-format description labour is **I** | Yes: format-specific compression, OpenZL ×2.06 vs zstd ×1.31 **F** | No agent product found; Meta anticipates it ("SDDL for LLMs") | More valuable (model-free hot path) | Meta ships it; zstd dictionaries may capture most of the gain |
| **2** | LLM-evolved QEC decoders | Yes: IBM 2026 FPGA qLDPC paper; Riverlane latency caveat **F** | Yes: hand-designed decoders, evolution-proven in adjacent tasks **F** | None found for decoders **I** | More valuable (µs, model-free) | Google/IBM own the oracle data and buyers (gate 4) |
| **3** | Certificate-carrying evolved code | Yes: ADRS hacking and overfitting examples; Verification Horizon **F** | Yes: certifying algorithms (2011), DRAT in SAT checking since 2013–14, SATLUTION **F** | No enforcement harness found **I** | More valuable (hacks grow; checker doesn't decay) | Becomes a feature of AlphaEvolve/OpenEvolve; small direct buyer |

**I — None of the three clears the bar as cleanly as round 1's post-merge integration.** That one had the owner of
the problem saying in public that the human-scale design failed. Here only #2 and #3 have primary-source pain, and #1
has the best oracle and buyer structure but inferred pain. That is an honest finding: outside round 1's areas, the
labour-killed, oracle-rich ideas are mostly already taken.

## The ONE bet

**Grow format descriptions for format-aware compression, with lossless roundtrip and held-out bytes as the only
judge.** It is the only sweep idea where all four gates of §5 pass *and* the structural anti-cheat (a fixed universal
decoder the agent cannot touch) comes for free. The artefact runs at GB/s with no model. The oracle (the customer's
own data) cannot be pre-owned by an incumbent, and the two-week proof needs only a laptop and public formats. Run §3.1's
kill test before anything else: it is decided by numbers, not opinion. If the gain over zstd-with-dictionary and over OpenZL without a
description is under 15% on most formats, stop. If Meta ships agent-written SDDL before the proof ends, upstream the harness and
format corpus. **Fit with this repo — I:** it is the GrowOS loop (fault → agent writes a description → roundtrip
oracle → accept) moved from syscalls to file formats. It is a platform-engineering artefact with a cost-saving number
attached.

---

## 5. Synthesis across flip round 1 and this sweep: the rule that predicts flips

### 5.1 The four gates

An old, technically right idea **flips** when it passes gates 1–3; gate 4 predicts **who** captures it.

1. **Death cause = per-case labour.** It died because each case (syscall, format, protocol, opcode, decoder) needed
   expert hours, a long tail times scarce experts. It did *not* die of capital (masks, CHERI silicon), physics or
   information theory (covert channels, FHE overhead), coordination or social adoption (semantic web, MDE),
   intractability (automated mechanism design), or correlated failure (N-version).
2. **An independent, extensional oracle that is much cheaper than the labour.** It judges *behaviour on inputs*, not
   intent. The proposer cannot edit it, and it is not the same model family (otherwise it is circular: LLM relevance
   judges, N-version with agents). Its cost per check is orders of magnitude below the human labour it replaces.
   Strongest when the check is structural: roundtrip, proof kernel, certificate, conformance suite, a frozen
   original system.
3. **The artefact must run without the model.** Microsecond latency (decoders, compressors, kernels), certification
   (avionics), cost per call at volume, offline or embedded use. **If the model can just do the task live, the old
   idea is obsoleted, not revived:** expert systems, Cyc, end-user programming, literate programming, authored
   tutors, classic CV pipelines.
4. **Oracle ownership decides who wins.** If one organisation owns the oracle (its codebase, hardware, traffic,
   noise data, toolchain), it revives the idea in-house before outsiders: Meta ACH mutation testing, Google TAP, Google/IBM QEC,
   Siemens PLC, IBM/AWS COBOL, DOE solvers. Outsiders win where the oracle is **public** (Linux for GrowOS, Lean for
   Math Inc, Khronos CTS, TLA+ traces for Specula) or **lives with many fragmented customers** (a customer's database
   for `flip/02`'s ONE bet, a customer's file formats for this report's ONE bet).

**Lens B variant (rate breaks a human-scale design):** an idea is *needed more* when an agent-scale rate crosses a
threshold the old design assumed away, and a giant already built the fix in-house. Example: merge queues collapsing
above ~10³ merges/day, while TAP exists inside Google (`flip/05`). Gate 4 again picks the opening: a fix that lives
only inside a giant is a product for everyone else.

**Corollary — superhuman-model test.** With gates 2 and 3 passed, a better model makes the idea *more* valuable: it
searches better, and the oracle doesn't decay. Fail gate 3 and a better model makes it obsolete. Fail gate 2 and a
better model makes it *worse*, because it hacks harder (ADRS, Verification Horizon). That is why certificates,
roundtrips and proof kernels, oracles that don't weaken as the optimiser gets stronger, are the asset worth owning.

### 5.2 Retrospective check against 30 ideas

**I — Caveat:** this rule was fitted after seeing the outcomes, so agreement below is consistency, not prediction.
§5.3 gives forward predictions that can falsify it.

| Idea (source) | G1 labour | G2 indep. oracle | G3 model-free | G4 oracle owner | Rule predicts | Observed (2025–26) |
|---|---|---|---|---|---|---|
| Unikernel / GrowOS (calib.) | ✓ | ✓ Linux | ✓ | public | open flip | works, no product ✓ |
| Mutation testing (04) | ✓ | ✓ | ✓ | owner's code | incumbent in-house | Meta ACH ✓ |
| Property-based testing (04) | ✓ | ✓ | ✓ | owner's code | labs/incumbents | Anthropic agentic PBT ✓ |
| Expert systems / Cyc (04) | ✓ | – | ✗ | – | obsoleted | obsoleted ✓ |
| End-user programming / synthesis (04) | ✓ | – | ✗ | – | obsoleted | obsoleted ✓ |
| Literate programming (04, 06) | ✓ | ✗ | ✗ | – | obsoleted | DeepWiki-class absorbed ✓ |
| N-version programming (04) | ✓ | ✗ correlated | ✓ | – | stays dead | re-confirmed 2026 ✓ |
| Semantic web / MDE (04) | ✗ social | – | – | – | stays dead | ✓ |
| CHERI (04) | ✗ capital | – | – | – | stays dead | ✓ |
| Custom accelerators per workload (04) | ✗ mask NRE | – | – | – | stays dead | ✓ |
| Confinement (06) | ✗ physics | – | – | – | stays dead | ✓ |
| Agoric live auctions (06) | ✗ (de-marketing evidence) | – | – | – | stays dead | ✓ |
| AutoAdmin (02) | ✗ never died | – | – | – | n/a | alive ✓ |
| Active networks (02) | ✗ no use case | – | – | – | stays dead | ✓ |
| TLA+ specs / Specula (06) | ✓ | ✓ traces | ✓ | public | outsider flip | Specula ✓ |
| Superoptimisation (01) | ✓ | ✓ equivalence | ✓ | public | flip, crowded | Iago / AlphaEvolve ✓ |
| COBOL migration (02) | ✓ | ✓ original | ✓ | customer + vendor | vendor services | IBM/AWS ✓ |
| Reproducible builds (05) | ✓ | ✓ bitwise | ✓ | public | flip | Google OSS Rebuild ✓ |
| Post-merge integration / TAP (05) | Lens B | ✓ CI | ✓ | Google in-house | product for others | none yet (open) ✓ |
| Kay STEPS shrink (06) | ✓ | ✓ Liskov | ✓ | public | open | nobody running ✓ (untested) |
| Rules-as-code (04) | ✓ | ~ | ✓ | public law | flip | PolicyEngine ✓ |
| QED manifesto (sweep) | ✓ | ✓ Lean | ✓ (proof persists) | public | outsider flip | Math Inc / Harmonic ✓ |
| Remy CC (sweep) | ✓ | ~ simulator fidelity | ✓ | public sims | academic until fidelity | PolicySmith/GenCC research ✓ |
| ITS authoring (sweep) | ✓ | ✗ slow/weak | ✗ mostly | – | obsoleted by live tutors | live LLM tutors ✓ |
| LLM relevance judges (sweep) | ✓ | ✗ circular | ✓ | – | contested | Clarke & Dietz dispute ✓ |
| PLC generation (sweep) | ✓ | ✓ nuXmv | ✓ | Siemens toolchain | incumbent | Siemens co-authors ✓ |
| MMS solver codes (sweep) | ✓ | ✓ | ✓ | DOE codes | labs/academia | MOOSEnger etc. ✓ |
| QEC codes/decoders (sweep) | ✓ | ✓ Stim | ✓ | hardware owners | incumbents + academia | IBM/Google/DeepMind ✓ |
| zkVM verification (sweep) | ✓ | ✓ Lean | ✓ | public (EF) | outsider flip | Harmonic/zkSecurity ✓ |
| FHE (sweep) | ✗ compute | ✓ | ✓ | – | stays niche | niche ✓ |
| WCET models (sweep) | ✓ | ✗ unsound | ✓ | – | stays niche | no AI activity ✓ |
| Automated mechanism design (sweep) | ✗ intractable | ~ | ✓ | – | stays niche | academic ✓ |

**I — Where the rule is weakest:** gate 1 vs gate 2 is often a judgement call (Remy, rules-as-code). Gate 4 can't
predict *timing*: the QEC prediction says incumbents capture it, yet no decoder-evolution paper exists yet. The
honest version: "if anyone does it, the oracle owner does it before outsiders."

### 5.3 Forward predictions that would falsify the rule (check by 2027-10-28)

- **E —** Agent-evolved QEC decoders will be published earliest by an oracle owner (Google, IBM, NVIDIA, Riverlane or
  Quantinuum), not by an outsider. *An earlier outsider paper with hardware-validated results falsifies gate 4.*
- **E —** WCET timing-model authoring will see no credible LLM-generated, sound model accepted by a certification
  authority. *Acceptance falsifies gate 2's "unsound oracle" kill.*
- **E —** LLM-only relevance judging will not replace human qrels as TREC's primary ground truth. *Replacement
  falsifies the circularity clause of gate 2.*
- **E —** Agent-authored format descriptions will appear as an OpenZL feature or a third-party tool within 12 months,
  because all four gates pass. *No activity at all suggests the gates are necessary but not sufficient, and the
  missing factor is buyer demand.*

---

## 6. Five-line TL;DR

1. **F/I —** Across 14 areas, cheap AlphaEvolve-style loops ($5–$400 per study) mean most "old idea + oracle + agent"
   combinations were taken in 2025–26 by whoever owned the oracle.
2. **I —** Rule: an idea flips if it died of per-case labour, has an independent extensional oracle, and its artefact
   must run model-free; whoever owns the oracle captures the flip.
3. **I —** Failing "model-free run time" means obsolescence (expert systems, authored tutors). Failing "independent
   oracle" means a better model hacks harder (LLM relevance judges, coverage-driven tests).
4. **I —** Top 3: agent-grown format descriptions for compression, LLM-evolved QEC decoders, and certificate-carrying
   evolved code.
5. **E —** ONE bet: grow OpenZL descriptions with roundtrip plus held-out bytes as judge. Kill if it isn't ≥15% better
   than zstd-with-dictionary and OpenZL-without-description on 6 of 10 formats.

## 7. Rejected ideas (one line each)

- **LLM heuristic/algorithm discovery as a product:** AlphaEvolve is GA on Google Cloud; FunSearch, OpenEvolve,
  ShinkaEvolve and ADRS commoditise it.
- **Agent-evolved SAT/SMT solvers:** SATLUTION (NVIDIA) and LLM2SMT already do it with proof checking.
- **Formalising mathematics (QED manifesto):** Math Inc, Harmonic and DeepMind are funded and ahead.
- **AI-verified zkVM circuits:** the EF project, Harmonic/Logical Intelligence provers and zkSecurity Clean occupy it.
- **FHE programming agents:** compute overhead, not authoring, keeps FHE niche; HEIR and Zama own the compiler layer.
- **Key/agent-identity transparency logs:** CT, CONIKS, WhatsApp KT and Sigstore are alive; never labour-killed.
- **PQC migration agents:** real deadline-driven demand, but the application-level oracle is weak and security
  vendors crowd it.
- **LLM relevance assessment for IR:** the oracle is circular and contested in primary sources.
- **Procedural generation / inverse procedural modelling:** the VLM-judge oracle is weak; academic churn without a
  buyer seam.
- **Graphics drivers vs CTS:** a strong fit, but round 1's driver-adapter bet and hobbyist projects cover it.
- **LLM reward design / sim-to-real (Eureka line):** NVIDIA and academia; the simulator-fidelity gap is the real
  bottleneck.
- **Runtime assurance (Simplex) for learned policies:** sound and needed, but an active academic and aerospace field
  with no labour flip.
- **PLC code generation:** LLM4PLC/Agents4PLC/SemaPLC; Siemens owns the toolchain.
- **MMS-verified simulation codes:** best oracle in its area, but MOOSEnger, RL-with-MMS and DOE labs occupy it.
- **Agentic bioinformatics pipelines:** VariantBench/Biomni/FutureHouse; data access and trust, not code, are the
  constraint.
- **Agentic architecture DSE:** gem5 Co-Pilot and Agentic Architect; simulator ≠ silicon.
- **Quantum compiler passes:** IBM RL synthesis in Qiskit and AlphaTensor-Quantum; incumbent-owned.
- **LLM-discovered QEC codes:** at least five groups in June–August 2026.
- **WCET timing models by agents:** the oracle can't certify an upper bound; unsound for the safety use.
- **DO-178C MC/DC test generation:** coverage is gameable and intent lives in requirements; a vendor feature.
- **Classic CV revival:** obsoleted by learned models, not revived.
- **LLM-designed congestion control:** PolicySmith, GenCC and the BBR+LLM work occupy it; simulator fidelity limits it.
- **Automated mechanism design:** died of intractability and IC-verification limits, not labour.
- **Authored intelligent tutors:** live LLM tutors obsolete authoring; learning-gain oracles are slow and weak.
- **Risch/Rubi integration rule growth:** perfect oracle (differentiate), negligible buyer.
- **Protocol model learning with LLM mappers:** plausible and unoccupied, but a niche security-testing market that
  overlaps `flip/02`.
