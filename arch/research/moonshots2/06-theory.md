# Theory of computation: what remains scarce when intelligence is abundant

Research date: **2026-10-27**. Lens: **theory of computation**. Written against [BRIEF.md](BRIEF.md), after reading round 1's seven TL;DRs and leading bets and the [capsule landscape](../v8/02-landscape.md). This report proposes **eight** products, then ranks them. Only this report was written; no deployments, purchases, model runs, proving runs, or commits were made.

**Claim labels:** **F** = sourced fact, including explicitly attributed author/vendor results; **M** = a new empirical measurement; **I** = inference, design, or judgment; **E** = estimate, scenario, or proposed experimental threshold. There are **no new M performance results**. Arithmetic was checked locally, but hypothetical workload arithmetic remains **E**. All linked web evidence was searched or inspected on **2026-10-27**. Historical publication dates and important retrieval limitations are recorded below. Every 100×/2030 number is ambition or a scenario, not a forecast. Demo scripts and tweets are conditional drafts for use after the experiment works.

## The answer

**I — The blanket thesis “generation becomes free, therefore verification becomes scarce” is too broad.** Better models can eliminate much debugging, redundant review, and test generation. For a completely specified task performed by a universally trusted, infallible executor with all relevant information, another correctness check has no value by assumption. A product whose only purpose is catching today's model mistakes can disappear.

**I — The durable opportunity is making computation acceptable across boundaries of information, authority, incentives, and time.** A brilliant seller's answer is not evidence to its buyer; a correct program can implement the wrong agreement; a simulation cannot authenticate its initial conditions; a disconnected replica cannot learn a remote write by thinking harder. Useful products reduce the cost of obtaining and transporting the missing evidence, state, permission, or observation.

**I — My ONE bet is a counterparty receipt protocol, initially a cheap, independently replayable receipt for a deterministic data reconciliation.** Its 100× destination is an acceptance network: execution and its evidence become reusable across organizations, rather than every agent asking every other organization to trust its model or repeat its work. Add proof-carrying action mandates as the first enforcement extension. Do not start by proving every JavaScript instruction in a zkVM.

## 1. Does verification vanish with perfect models?

**I — Define the counterfactual carefully.** Here “perfect model” means flawless reasoning about the information and specification it receives, implemented with finite computational resources. It does not mean a halting oracle, access to undisclosed secrets, a universally trusted identity, or a power to change another party's preferences. A fixed finite model can memorize a bounded problem set; complexity statements concern growing inputs and must count training, advice/model storage, and inference resources. An omniscient, universally trusted oracle would remove many of the following problems by definition, but that is a different assumption from better intelligence.

| Situation | What a perfect model removes | What remains, and why |
| --- | --- | --- |
| Fully specified pure function, trusted executor, known input | **I:** the need to second-guess its answer | **I:** only execution, delivery, and whatever resource constraints the function has; a verification product may vanish |
| Adversarial seller, cloud, or agent | **I:** accidental reasoning mistakes by the buyer | **I:** the buyer still needs authenticated inputs and evidence of the agreed relation; the seller may have a different objective or lie about execution |
| Unspecified or conflicting intent | **I:** mistakes interpreting what was actually specified | **I:** missing preferences, rights, and tradeoffs are not supplied by a proof; parties must disclose, choose, or negotiate them |
| Expensive exact simulation | **I:** avoidable algorithmic inefficiency | **I:** some families provably require substantial resources; no theorem establishes an unavoidable step-by-step cost for every useful simulation |
| Third party needing proof | **I:** the original producer's uncertainty | **I:** evidence must reach the third party and bind the right program, input, output, policy, and identity; a producer's certainty does not transfer itself |
| Physical-world claim or changing remote state | **I:** bad deduction from available observations | **I:** an unobserved event can differ between worlds with the same model input; a fresh observation or message is necessary to distinguish them |
| Distributed commit during a partition | **I:** errors in local protocol reasoning | **F/I:** the applicable agreement/availability tradeoffs remain; intelligence does not add a missing message [FLP][FLP] [CAP][CAP] |

**I — Two different economic claims must stay separate.** Proof demand can grow while proof cost falls. Similarly, need for specified authority can rise while the labor of writing specifications falls. The defensible scarcity is the information, agreement, and resource boundary; scarcity of a particular vendor's service is a market hypothesis.

## 2. The theorem ledger: exact statements and forbidden extrapolations

### 2.1 P versus NP: a qualified generation/checking asymmetry

**F — NP is a class of decision problems with polynomial-length witnesses whose validity can be checked in polynomial time.** P consists of decision problems solvable in polynomial time. Whether P = NP remains open; “NP means hard” and “finding is exponentially harder than checking” are not established facts. If P = NP, polynomial-time witness search follows for NP relations. These are worst-case asymptotic statements, not guarantees about today's scheduling instances or practical constants. [Cook, official problem description, 2000][PNP]; [current Clay problem page][CLAY].

**I — Where checking is cheaper:** verifying a proposed SAT assignment or a feasible schedule can be much easier than the search that produced it. **I — Where it need not be:** producing a sorted list and fully checking sortedness/permutation both require substantial input access; checking a claimed output of an arbitrary long computation by replay can cost essentially the same as doing it. Feasibility is also different from optimality: “this route meets the budget” has a direct witness; “no better route exists” is a universal claim. NP membership does not supply short certificates for every NO answer or optimality claim.

### 2.2 Interactive proofs: a weak verifier can interrogate a stronger prover

**F — Shamir's IP = PSPACE theorem** characterizes languages admitting polynomial-time randomized interactive verification with completeness and soundness. It extends beyond ordinary NP witness checking; the honest prover in this characterization need not be efficient. It does not say all PSPACE problems become cheaply solvable, nor that an arbitrary conversation with a model is such a proof. [Shamir, FOCS 1990 / JACM October 1992][IP].

**F — GKR makes the useful next distinction:** efficient honest provers and much cheaper verifiers for suitably uniform, low-depth computations. Its stated verifier bound is `(n + d) polylog(n)`, with communication `d polylog(n)`, for input length `n` and circuit depth `d` under the paper's uniformity assumptions. Input reading and depth matter; this is not constant work for any program. [Goldwasser–Kalai–Rothblum, STOC May 2008][GKR].

**I — Product consequence:** stronger agents can supply structured witnesses and answer challenges; the small checker should implement a defined protocol. Replacing the checker with another persuasive model loses the original guarantee.

### 2.3 PCP: sampling works after the right encoding, not on arbitrary logs

**F — The PCP theorem gives `NP = PCP(O(log n), O(1))`:** a polynomial-time verifier uses logarithmically many random bits and reads a constant number of bits of an appropriately encoded polynomial-size proof, with bounded soundness error. The encoding is the achievement. This does not give a constant-time end-to-end verifier for arbitrary raw input, nor make proof construction free. [Arora–Lund–Motwani–Sudan–Szegedy, FOCS 1992 / JACM 1998][PCP].

**E — Sampling trap:** if a million-step raw execution trace contains exactly one invalid transition, uniformly checking 64 distinct transitions catches it with probability `64 / 1,000,000 = 0.0064%`. A Merkle commitment prevents changing committed bytes after challenges, under its hash assumptions; it does not make that one invalid transition easier to find. PCP/IOP encodings introduce global consistency structure. **I:** do not market “sample a few steps” as PCP security.

### 2.4 Succinct proofs and verifiable computation: shift work to the prover

**F — Verifiable computation formalizes outsourcing work while retaining a cheaper correctness check.** Gennaro–Gentry–Parno's noninteractive construction and later Pinocchio are primary ancestors; preprocessing/amortization and cryptographic assumptions are part of the bargain. Pinocchio's 2013 implementation reported 288-byte proofs and verification cheaper than native execution for some applications, not all. [GGP, CRYPTO August 2010][GGP]; [Parno et al., IEEE S&P May 2013][PIN].

**F — Groth16 supplies a preprocessing pairing-based argument for arithmetic circuit satisfiability with three group elements.** A compact argument does not prove an unrestricted program correct on all inputs; it proves its encoded statement under the scheme's assumptions and setup. “Argument” normally limits soundness against computationally bounded adversaries; it is not an unconditional proof against an infinitely powerful attacker. [Groth, EUROCRYPT 2016][GROTH].

**F — STARKs pursue scalable transparent computational integrity**, avoiding a secret setup trapdoor and relying on stated cryptographic assumptions. Hash-based constructions can support post-quantum security claims under suitable assumptions; a later elliptic-curve wrapper can change that profile. Zero knowledge concerns witness disclosure; succinctness concerns verification/proof cost; integrity concerns correctness of the relation. They are distinct properties. [Ben-Sasson et al., January–March 2018][STARK].

**I — All these systems prove a relation such as `P(x) = y`, not “y is useful,” “x came from reality,” “P captured the user's wishes,” or “the remote payment actually settled.”** Prove signature checks or endpoint acknowledgments inside P when those belong in the statement. Even then the identity, authority, and observation source remain explicit assumptions.

### 2.5 Proof-carrying code: make the producer do the hard argument

**F — PCC attaches a machine-checkable proof that code obeys a consumer-defined safety policy.** The consumer validates it before execution using a relatively small trusted checker. The original work included native packet filters; later work explicitly addressed safe mobile agents, access control, and resource bounds. It did not wait for LLMs. [Necula–Lee, OSDI October 1996][PCC96]; [Necula's primary paper index, POPL January 1997 and mobile-agent work][PCC].

**I — The revival is proof-carrying actions:** every proposed effect carries a narrow derivation that the authenticated principal authorized this target, amount, version, and time window. A range/budget witness checked by a trusted gate is feasible immediately. It is not a proof of the agent's inner motives or of the safety of arbitrary downstream services. Ordinary Wasm validation establishes useful structural/type properties, not the application's business policy.

### 2.6 Rice and undecidability: no universally complete semantic gate

**F — Rice's theorem:** every nontrivial extensional property of the partial computable function computed by an arbitrary program has an undecidable index set. The property must concern computed behavior rather than merely syntax; it must hold for some such functions and fail for others. No terminating algorithm, including a finite computable model, decides every case. [Rice, March 1953][RICE].

**I — The useful response is restriction:** bounded execution, finite-state models, total languages, trusted interfaces, proof certificates, sound but incomplete analyses, and explicit “unknown” outcomes. Rice does not imply that checking every particular proof is impossible, that no useful verification works, or that every bounded API policy is undecidable. Bounded checking is decidable in principle, though potentially expensive. A verified specific program or restricted system is compatible with undecidability of a universal analyzer.

### 2.7 Computational irreducibility: a direction, with carefully bounded support

**F — Wolfram calls behavior computationally irreducible when predicting it requires effectively tracing its evolution.** His 2002 presentation treats this as a broad phenomenon associated with the Principle of Computational Equivalence and illustrates behavior that appears irreducible. This is an author's thesis and evidence, not a proven universal lower bound for weather, Rule 30, all agent workflows, or all physical systems. [Wolfram, *A New Kind of Science*, 2002, p. 738][WOLF].

**F — There are rigorous resource separations:** classical time-hierarchy results establish problems that require more time than smaller time classes allow. They do not identify a profitable simulation that no better algorithm can speed up. [Hartmanis–Stearns, May 1965][TIME]. **F — VDFs explicitly seek sequential evaluation and efficient public verification**, but constructions' sequentiality rests on concrete hardness assumptions; it is not an unconditional lower bound for arbitrary hardware. [Boneh et al., CRYPTO 2018][VDF].

**I — Defensible conclusion:** universal elimination of computation is unavailable. **Not established:** every customer workload has a large irreducible residue, or total compute demand must rise. Better algorithms, statistical approximations, amortization, parallel execution, and cached results may remove enormous amounts of work. Sell measured expensive progress; do not sell an unproved lower bound.

### 2.8 Kolmogorov complexity: intelligence cannot compress everything

**F — Algorithmic information measures the shortest program describing a string relative to a chosen universal description system.** It differs from the time needed to run that description. Exact Kolmogorov complexity is uncomputable. A counting argument shows that most length-n strings cannot have descriptions much shorter than n: fewer than `2^(n-k)` programs are shorter than `n-k` bits, so only a small fraction of n-bit strings can have such descriptions, up to convention-dependent constants. [Kolmogorov, 1965; English translation 1968][KOL].

**I — Two product consequences:** repeated program/data families invite shared dictionaries, chunks, dependency graphs, and partial-result reuse; independent high-entropy data and well-encrypted bytes limit generic compression. Novelty alone does not imply incompressibility. A short simulation program may still require a trillion steps. A compression-based cache should measure actual encoded bytes and recomputation cost, not claim to compute K or equate shortest code with fastest code. Content identity is easy to check; general semantic equivalence is not.

### 2.9 Landauer and reversible computing: erasure has a floor; operations do not all share it

**F — Landauer relates logical irreversibility to thermodynamic cost.** For resetting an unbiased unknown bit in the standard idealized isothermal setting, the bound is `k_B T ln 2`; at 300 K this is approximately `2.87 × 10^-21 J`. It is not a universal energy bill per FLOP, per token, or per reversible gate. [Landauer, July 1961][LAND].

**F — Bennett showed how general computation can be performed logically reversibly**, including compute–copy–uncompute, with time/storage tradeoffs. Logical reversibility does not guarantee a practical fast low-energy implementation or remove I/O, error correction, and finite-speed engineering costs. [Bennett, November 1973][BENNETT].

**I — Product consequence:** retain and reuse useful state when doing so beats reconstructing it, and account for memory and movement as well as arithmetic. An ordinary snapshotting service is not reversible hardware and cannot claim Landauer savings. Near-term energy value must be measured on real machines; no reversible-chip moonshot is justified for this TypeScript team.

### 2.10 Communication complexity: even infinitely clever local parties lack remote bits

**F — Yao's communication model asks how many bits separated parties must exchange to compute a function of their private inputs.** Some tasks have strong lower bounds even when local computation is unbounded. Razborov proved an Ω(n) distributional communication bound for set disjointness under a particular input distribution, supporting the randomized bounded-error lower bound. [Yao, STOC April 1979][YAO]; [Razborov, December 1992][DISJ].

**I — Implication:** perfect local reasoning does not generally eliminate data movement. But do not overgeneralize: equality admits very small randomized fingerprints under suitable randomness/error assumptions, and highly structured workloads can communicate very little. Moving code to data can reduce real traffic by changing placement and the computation boundary; it does not violate a lower bound for the original distributed model. Privacy/security protocols and succinct proofs also change the model and assumptions rather than magically revealing hidden input.

### 2.11 FLP and CAP: stronger models do not repeal network failure

**F — FLP:** no deterministic consensus protocol in the stated fully asynchronous message-passing model guarantees termination in every admissible execution while retaining the required agreement/validity properties, even with at most one crash. It allows a nonterminating execution; it does not mean consensus never works. Randomization, synchrony/eventual synchrony, and failure-detector assumptions change the setting. [Fischer–Lynch–Paterson, April 1985][FLP].

**F — CAP:** under the paper's partition-capable asynchronous network model, a read/write object cannot guarantee both atomic/linearizable consistency and the defined availability in all executions. This is about those operations and failure conditions, not “choose any two features at all times.” [Gilbert–Lynch, June 2002][CAP].

**I — Product consequence:** a cloned capsule must not clone exclusive spending authority. Use a real authority service, fencing epochs, conditional writes, idempotency, and reconciliation of uncertain outcomes. Accept unavailability when that service cannot safely authorize a write. A proof of a valid prior state transition does not prove the current state has not changed elsewhere.

### 2.12 Mechanism design and intent: competence is not preference disclosure

**F — Myerson–Satterthwaite:** in the standard bilateral-trade setting with independent private valuations and overlapping supports, one cannot generally have Bayesian incentive compatibility, interim individual rationality, budget balance/no outside subsidy, and ex post efficiency together. This is a specific impossibility under stated assumptions, not a prohibition on useful markets, honest mechanisms, or every form of preference elicitation. [Myerson–Satterthwaite, April 1983][MS].

**F — Armstrong–Mindermann establish an identification problem:** observing a policy does not uniquely identify its reward function and planning process when rationality is unknown; simplicity priors alone do not resolve the problematic alternatives. Normative assumptions are needed. [2017 preprint / NeurIPS 2018, revised January 2019][INTENT].

**I — No general theorem here says “intent is always unverifiable.”** Explicit authorizations and outcomes can be checked. But two parties with different hidden goals can emit the same transcript; a transcript-only checker cannot distinguish those worlds without additional assumptions or evidence. A perfect model can infer probable intent, request clarification, and design incentives; it cannot guarantee recovery of information absent from its observations. A signature proves commitment to expressed terms, not sincere desire.

### 2.13 Goodhart: stronger optimization against an imperfect proxy can make things worse

**F — Goodhart's original monetary-policy lineage** concerns breakdown of previously useful statistical relationships under control pressure; the 1975 conference paper was reprinted in 1984. The publisher preview confirms the chapter, but does not expose its full text. [Goodhart, publication record][GOOD]; [RBA's primary conference bibliography][RBA].

**F — Modern primary treatments distinguish regressional, extremal, causal, and adversarial failures**, rather than making one universal mathematical law. [Manheim–Garrabrant, 2018/2019][GOODVAR]. **F — Gao–Schulman–Hilton measured reward-model overoptimization in a synthetic setup** using a stronger reward model as the reference; this is empirical support, not a theorem about all future models or actual human welfare. [2022 preprint / ICML 2023][RM].

**I — Why it can worsen:** stronger optimizers can find more ways to satisfy a bad metric while missing the customer's purpose. **I — Why it can disappear:** an exact objective on a genuinely closed, fully specified task need not suffer proxy failure. Hidden tests, human adjudication, and fresh data help but do not give a universal Goodhart shield. The product is maintaining the acceptance relationship, not promising an unbeatable score.

## 3. The 2026 cost reality: verifiability is usable, but not free

**F — Current evidence, not a 2024 cost story:**

| Primary evidence and date | What it actually establishes | Product implication — I |
| --- | --- | --- |
| [Ethproofs live dashboard][ETH], observed **2026-10-27** | Displayed eligible rows include ZisK 4×5090 at **$0.0034**, Axiom OpenVM 16×5090 at **$0.0063**, and AntChain zkDTVM 4×5090 at **$0.0031**; the site is in a security sprint, showing M2 **100-bit provable / 600 KiB** | Cent/subcent block proving is real dashboard evidence; these are displayed workload-specific costs, not quotations for arbitrary TS, an all-in service invoice, or a universal security guarantee |
| [Succinct Hypercube launch][HYPER], **2026-02-19** | Vendor reports **99.7%** of Ethereum blocks under **12 seconds**, using **16 RTX 5090s**, describing a November 2025 result; under **$100k** cluster capex claimed | “Real time” can use substantial parallel hardware; latency alone does not measure prover work |
| [Flock, author's announcement][FLOCK], **2026-06-25** | Research prototype reports **<250×** native wall time for batched standard hashes on one M4 Max core; native baseline excludes Apple's dedicated SHA instructions and hashes individually | A specialized research result, not a 250× overhead guarantee for arbitrary zkVM execution; optimized native and batching baselines matter |
| [SP1 network FAQ][FAQ], current docs | Small jobs below **2M PGUs** can be dominated by fixed overhead; docs give approximately **6 s Groth16 / 70 s PLONK** wrapping overhead; price = dynamic base fee + PGUs × auction price | A 2 ms policy check should not wait seconds for a cryptographic receipt unless its counterparty actually needs one |
| [SP1 proof types][TYPES], current docs | Docs list approximately **260 bytes / 270k gas** for Groth16 and **868 bytes / 300k gas** for PLONK, excluding application data/envelope; PLONK overhead here is **~90 s** over compressed | These docs disagree on an exact wrapping latency; benchmark the selected version and mode. Gas is a work unit, not a dollar price |
| [SP1 prover-gas documentation][PGU], current docs | Equal RISC-V cycle counts can have different proving costs; precompiles and trace shape matter | Quote measured PGUs plus final-mode latency/cost, not “cents per instruction” |

**F — Important source conflict:** the proof-types page says PLONK does not require a trusted setup while also mentioning ceremony material. The [security model][SEC] explicitly says both PLONK and Groth16 require setup, distinguishing universal and circuit-specific ceremonies. It also says individual SP1 STARK proofs do not currently provide zero knowledge and that the application must validate public values and external inputs. **I:** follow the explicit security statement; do not advertise every SP1 artifact as transparent, private, or post-quantum. Pin the verifier, recursion configuration, program key, and public-input encoding.

**F — Reproducibility beats headline extrapolation.** RISC Zero's version-3.0 docs provide commands for generating CPU/Metal/CUDA datasheets and separating execution from proving. The Ethproofs API defines submitted proving time as including witness generation but excluding data fetching and proof-submission latency; that definition must not be silently equated with every dashboard cohort's end-to-end criterion. [RISC Zero benchmarks][R0BENCH]; [Ethproofs API][ETHAPI].

**F — Markets already exist.** Succinct operates a prover marketplace; Boundless documents a reverse Dutch auction with a price ramp, deadlines, collateral, and recovery after missed fulfillment. Boundless's tutorial includes assumptions and October 2025 testing recommendations, which are not an October 2026 spot-price quote. [Succinct market structure][SPMARKET]; [Boundless auction contract][BOUND]. **I:** do not launch an undifferentiated “marketplace for verifiable compute” as though this is missing infrastructure.

**I — Honest break-even rule.** Let C be a trusted native run's cost, P the complete cost of producing a proof including execution, V each recipient's verification cost, and k independent recipients. One producer plus k replaying recipients costs `(k + 1)C`; producing one proof plus k verifications costs `P + kV`. Pure compute savings require `k > (P − C) / (C − V)` when `C > V`. If the producer's first run is already sunk and proving requires another execution, use the incremental proving cost and compare only subsequent costs. Add publication, data availability, privacy handling, and integration costs. A 250× specialized prover would need roughly hundreds of same-cost replayers to win on aggregate compute alone if V is tiny. Different hardware/pricing can change that; a single recipient may still pay for auditability, privacy, or remote execution assurance.

**I — Execution evidence also cannot normally prove historical effort.** A valid output can be cached, precomputed, or computed with a faster algorithm. A proof that an abstract trace contains a billion steps does not automatically prove a particular machine spent a billion physical cycles. Billing should reward useful accepted results or a precisely defined protocol, not unverifiable claims about how hard an agent worked.

## 4. Which resources grow relatively scarcer?

**I — The growth model is conditional:** total work is roughly `number of tasks × steps per task × residual work per step`. Models can reduce the last factor while increasing the first two. Neither Jevons effects nor rising verification spend follow as theorems. The following primary evidence motivates testing the direction:

- **F — Energy anchor A:** IEA estimated data-center electricity at **415 TWh in 2024**, growing about **12% annually** since 2017; its April 2025 base case projected **945 TWh in 2030**. That is an estimate and projection for all data centers, not measured 2030 demand or AI alone. [IEA, *Energy and AI*, 2025][IEA].
- **F — Delegation anchor B:** Anthropic's **2026-02-18** study found the long-session tail of autonomous Claude Code work rose from under **25 minutes** to over **45 minutes** in three months. The authors explicitly say this was smooth across releases; it is not a clean causal measurement of model quality. [Study][AUTON].
- **F — Traffic anchor C:** Cloudflare's **2025** review reported user-action crawler traffic growing **over 21×** from January to early December, closely tracking ChatGPT-User. Separately, its **19%** general traffic-growth calculation excludes bots. These are platform/category observations, not a universal traffic census or a causal estimate of model improvement. [Cloudflare, December 15, 2025][TRAFFIC]. **I:** the 21× figure motivates reducing repeated agent fetches; it is not the growth rate of every proposed market.

| Resource | Why improved models can increase pressure — I | What models can still improve — I | Boundary that persists |
| --- | --- | --- | --- |
| Useful executed progress, memory, energy | More candidate programs, longer runs, more simulations and physical/control tasks; anchor A motivates this | Algorithms, approximation, scheduling, specialization, reuse | **F/I:** nontrivial computational lower bounds exist; their applicability and the actual customer residue must be established |
| Agreement and specification | More delegated decisions expose more cases with unresolved tradeoffs; anchor B motivates this | Drafting specs, finding ambiguity, eliciting preferences | **I:** information and rights not expressed cannot be recovered with certainty from identical observations |
| Counterparty acceptance and authority | More autonomous suppliers and cross-company actions create more trust boundaries | Proof generation, policy synthesis, reduced clerical review | **I:** the receiving party still chooses its checker, trusted identities, and permissible effects |
| Fresh observations and experimental capacity | Better planning can propose more experiments than sensors, origins, and labs can supply | Better experiment design and more information per observation | **I:** the value of a genuinely new observation is not replicated by generating more descriptions of it |
| Data locality and communication | More queries and parallel branches touch distributed datasets; anchor C motivates this | Compression, query pushdown, batching, fingerprints | **F/I:** some distributed functions need substantial communication under fixed assumptions; physical placement changes the economics |
| Current ownership and availability | More concurrent branches contend for the same inventory, purse, or state version | Better protocols, conflict prediction, partition handling | **F/I:** FLP/CAP assumptions constrain the guarantees; an exclusive grant is not duplicated by copying memory |
| Credible evaluation data and attention | More optimization against a shared metric can exhaust its representativeness | Better judges, fresh tests, better objectives | **I:** Goodhart pressure is conditional on a remaining proxy gap; no universal failure claim |

**I — What is not intrinsically scarce:** arbitrary generated text, arbitrary proofs of irrelevant statements, artificial “compute credits,” or raw trust as a vague sentiment. Valuable units are an accepted computation, an authenticated fresh observation, a conserved authority grant, and an explicit agreed predicate. Distribution and adoption determine whether any becomes a business.

## 5. Eight products, with falsifiable first proofs

Each prototype below is an **E: separate 1–2 week scope**, not eight projects promised in two weeks. Scenario arithmetic is deliberately disclosed because no primary source measures the TAM or growth rate of these exact proposed products.

### Idea 1 — Counterparty receipts: computation that a stranger can accept

1. **Sentence + 100× — I/E:** return an output with everything a buyer needs to independently check its agreed relation. The 100× version is a network carrying **a billion accepted work receipts/day** between companies and agents, with receiver-selected replay or succinct proof verification; this is a scale ambition, not a forecast.
2. **Worsening problem + numbers — F/I/E:** longer delegated work (anchor B) creates more outputs whose recipients did not supervise the execution. No sourced receipt-market growth rate exists. At **1M deliveries/day × 10 recipients × 100 ms** of redundant checking, the scenario consumes **1M CPU-seconds/day**; this excludes useful work and shows why receipt reuse could matter. Buyers and vendors pay for repeat processing and disputes.
3. **Superhuman-model test — I:** matters even if each supplier is brilliant: the buyer may distrust the supplier, its machine, its inputs, or its economic incentives. Vanishes for internal work where a mutually trusted executor's signature suffices. Never require cryptographic proving where replay or attribution already meets the buyer's need.
4. **2030 at scale — I/E:** a procurement platform accepts a supplier's reconciliation result; finance, operations, and the supplier's customer verify the same receipt against their own policies. Workers route/version receipts, R2 serves artifacts, independent Node/browser/Wasm verifiers check them. Heavy proving uses external CPU/GPU services. The flow contains hashes, authorized input commitments, outputs, evidence, and final disposition—not a billion live VMs.
5. **Lineage / stall / changed condition — F/I:** GGP, GKR, Pinocchio, SNARKs and STARKs provide verification; durable replay and reproducible computation provide the low-cost path [GGP][GGP] [GKR][GKR] [PIN][PIN]. **I:** setup, prover cost, and integration limited applicability; 2026 cost improvements help, while agent suppliers increase demand. Round 1 already proposed notarised computation: the addition here is a receiver-selected evidence contract and explicit economics, not a renamed invention.
6. **Who pays / value — I:** data vendors, agent marketplaces, reconciliation outsourcers, and their buyers pay for fewer repeated runs and faster acceptance. Start with two real parties already disagreeing about acceptance; do not sell certificates nobody consumes.
7. **First proof — E:** in 10 working days, reconcile one committed invoice/ledger batch using deterministic TS in the existing QuickJS/Wasm tool-only ABI. Export source/module, engine digest, accepted genesis/input commitments, ordered host replies, result, and policy. Independently replay from a trusted start in Node and a browser; reject altered input, altered output, omitted call, wrong program, arbitrary seller checkpoint, and reused nonce. Compare with source + JSON + signed journal. On one small pure reducer, price an optional existing zkVM proof; do not port all QuickJS first.
8. **Demo + draft tweet — I:** buyer opens a receipt without the seller's account; replay succeeds, a forged result fails, then the buyer chooses whether an external-input signature is acceptable. “This reconciliation comes with code, committed inputs and a replayable receipt. Your checker can accept it without our model. The receipt proves the computation relative to those inputs; it does not prove the invoices were truthful.”
9. **Kill test — E:** kill the standalone product if three target buyers accept ordinary signed outputs just as readily, if total checking exceeds recomputation without compensating value, or if the capsule contributes nothing beyond a signed journal. Keep the useful receipt schema and drop the capsule requirement if that baseline wins.

### Idea 2 — Proof-carrying actions: a small gate for an enormous agent

1. **Sentence + 100× — I/E:** require each effectful tool call to carry a checkable authorization derivation. The 100× version is a cross-vendor mandate protocol allowing millions of agents to delegate, subdivide, and spend precisely bounded authority without asking a human to approve every step.
2. **Worsening problem + numbers — F/I/E:** anchor B documents expanding autonomous sessions; it does not measure unauthorized actions. In a **10,000-agent fleet × 100 writes/day**, a manual **1-second** review budget would require **278 person-hours/day**. The operator pays that attention cost or accepts poorly specified delegation.
3. **Superhuman-model test — I:** matters more as agents become useful enough to receive valuable authority. Correct reasoning does not mean the caller is authorized, nor that two perfect agents want the same outcome. It becomes unnecessary when the destination already enforces an equivalent policy at equal integration cost.
4. **2030 at scale — I/E:** participating services accept portable mandates naming principal, target, action, aggregate budget, expiry, and revocation/ownership epoch. A per-account DO or destination authority conserves reservations and checks state versions; browsers can inspect derivations. Unreachable authority means effects wait. This is a protocol over many authorities, not one global serial actor.
5. **Lineage / stall / changed condition — F/I:** PCC shifts proof production to the code supplier; macaroons provide efficient decentralized attenuation with contextual caveats [PCC96][PCC96] [MAC][MAC]. **I:** formal policy authoring and endpoint integration remain hard. Better agents can generate proposals and derivations, while a stable small checker enforces a deliberately restricted language. This is adjacent to IAM/OAuth/policy-as-code and must beat them on cross-agent delegation.
6. **Who pays / value — I:** platforms delegating purchases, configuration changes, or API updates pay for portable authority and enforceable limits. Charge for accepted operations/integrated destinations, not a second-model “safety score.”
7. **First proof — E:** implement one TS policy DSL and total checker: permitted target, integer amount, grant ancestry, expiry, aggregate reservation, expected state version, unique operation ID. Give a capsule read authority and a bounded write grant; fork it 100 ways; exhaust the common budget; transfer ownership; reject stale copies. Crash after dispatch/before acknowledgment and reconcile against a toy idempotent destination. Call these authorization certificates, not proofs of arbitrary program safety. No zkVM needed.
8. **Demo + draft tweet — I:** a perfect agent proposes a valid but unauthorized extra purchase; the gate rejects it without judging its explanation. “Fork the agent 100 times. Its spending authority still totals €10. Each accepted action carries a derivation our small checker validates; a copied heap cannot mint another budget.”
9. **Kill test — E:** kill if a destination-side OAuth scope plus conditional write and budget table achieves the same delegation with less work, if policy authors cannot explain rejected actions, or if any tested fork/retry spends outside the global bound. The claim must be narrower than “we verified intent.”

### Idea 3 — A common computation store: cache the progress, not the prose

1. **Sentence + 100× — I/E:** address deterministic subcomputations and parked states by their exact dependencies, retaining common bases and changes. The 100× version makes huge fleets of agents pay once for shared parsing, initialization, reference data, and repeated analysis, then buy only their differences.
2. **Worsening problem + numbers — F/I/E:** anchor A motivates conservation of useful compute, and anchor C motivates reducing bytes; neither measures reuse. A scenario with **1M branches × 10 MiB** full state is about **9.54 TiB**. A shared **9 MiB** base plus **1 MiB** per branch is about **0.954 TiB**, before indexes/replicas: roughly **10×**, not 100×. Actual entropy and dependency churn decide the gain.
3. **Superhuman-model test — I:** better models can discover more common work and create more branches. Exact reusable results still avoid execution and transfer. The product disappears where results are genuinely novel, inputs change globally, or existing build/data caches already capture the reuse. Better compression may also shrink its revenue base.
4. **2030 at scale — I/E:** tenant-scoped R2 stores share approved engine/code/data chunks; a Worker resolves dependency graphs and materializes state deltas near demand. A model release creates new program identities and invalidates affected results. Cross-tenant reuse requires explicit publication; confidential heaps never become a global dictionary by default.
5. **Lineage / stall / changed condition — F/I:** Kolmogorov gives the limits, not an implementable compressor [KOL][KOL]. Rsync sends differences between similar files; adaptive functional programming and Adapton retain dependency-tracked computation [RSYNC][RSYNC] [AFL][AFL] [ADAPTON][ADAPTON]. **I:** impure dependencies, invalidation, and instrumentation have always constrained reuse. A narrow tool-only ABI can expose those dependencies more cleanly; existing capsule competitors already implement deltas.
6. **Who pays / value — I:** agent platforms and repeated data-processing services pay for measured compute, read, and bandwidth savings. Charge against avoided work, with an honest all-in baseline; R2 storage alone is too cheap to justify a grand platform pitch.
7. **First proof — E:** use 100 actual permitted snapshots/workflows, a synthetic high-entropy control, and a whole-file compressed baseline. Compare chunk deduplication, page deltas, source+state replay, and memoized pure function calls. Key results by code, runtime/ABI, input roots, seed, and explicit freshness context; replay side effects rather than cache permission to perform them. Target **≥5×** fewer transferred bytes and **≥2×** lower p95 completion cost on held-out related runs, with <20% regression on unrelated runs.
8. **Demo + draft tweet — I:** fan out 100 analyses; show all dependencies and only changed chunks moving; change a data root and show invalidation. “We stopped sending the same interpreter, dataset and unchanged state for every agent branch. This demo reports total bytes and CPU versus compressed full snapshots, including misses. It does not promise semantic deduplication of arbitrary code.”
9. **Kill test — E:** kill if existing object compression and ordinary memoization are within 20% on customer workloads, if retaining the dependency graph costs more than recomputation, or if correct invalidation requires undisclosed global knowledge. Reject a cache hit that cannot explain its dependency identity.

### Idea 4 — Data-local proof capsules: send a question instead of a database

1. **Sentence + 100× — I/E:** ship a bounded, policy-checked computation to a data owner's runtime and return a small authenticated result, optionally with a succinct proof. The 100× version is a federated analysis fabric where agents operate across thousands of owners without centralizing every dataset.
2. **Worsening problem + numbers — F/I/E:** communication bounds make missing data a real constraint; anchor C documents broader traffic growth, not demand for this product. **10,000 queries × 100 MB** exported per query is **1 TB** moved; **10 KB** returned per query is **100 MB**, a **10,000×** traffic reduction if the query genuinely admits that result and data is already at the executing owner. Local scanning and ingestion remain costs.
3. **Superhuman-model test — I:** a brilliant agent still needs the owner's current private bits. Matters where data access/egress is expensive and repeated. Vanishes when a normal SQL endpoint already returns the answer efficiently. Does not solve arbitrary private joins with zero communication.
4. **2030 at scale — I/E:** SaaS vendors, scientific data owners, or industrial operators run a small Wasm execution gateway next to their stores. A portable query artifact names a restricted input schema and export policy; the owner runs it, caches permitted outputs, and returns evidence. Cloudflare handles control, identity, and serving near supported stores; no claim that R2 automatically moves to each query.
5. **Lineage / stall / changed condition — F/I:** Yao/Razborov define communication constraints, and PCC/mobile agents supply the code-shipping lineage [YAO][YAO] [DISJ][DISJ] [PCC][PCC]. **I:** sandboxing, data-owner participation, and export semantics stalled many mobile-code visions. Wasm and explicit imports simplify deployment; intelligent query authors improve usefulness. The prior landscape/round-1 visiting-agent idea already occupies the mechanism.
6. **Who pays / value — I:** data owners and analysis buyers pay for fewer exports and integrations, bounded execution, and acceptable answers. This requires willing hosts. “Runs on your data” is not itself a privacy proof.
7. **First proof — E:** two Node/Wasm data-owner gateways plus a Worker coordinator execute the same deterministic reconciliation query against versioned local tables. Return only allowed aggregates; compare with indexed SQL and a conventional API. Measure ingress/egress, CPU, total latency, and deployment effort. Deliberately attempt exfiltration through output values, timing, exceptions, and oversized artifacts; enforce a fixed small output schema/budget, acknowledging residual inference leakage. Never export a secret-bearing heap as the result.
8. **Demo + draft tweet — I:** a visitor answers an agreed aggregate question; attempts to return a table are denied; a receiver replays the public case. “The agent sent a bounded computation to the data owner. The owner returned the agreed aggregate and evidence bound to a data version. This cuts transferred bytes in our workload; it does not eliminate local work or prove all output is non-sensitive.”
9. **Kill test — E:** kill if no three owners will host it, if conventional query pushdown matches the gain, or if a useful answer cannot fit a defensible export policy. Communication complexity is a design constraint, not a differentiator against SQL.

### Idea 5 — Specification escrow: agree on acceptance before buying the answer

1. **Sentence + 100× — I/E:** turn an outsourced agent job into a signed acceptance relation, input commitments, examples, exclusions, and a dispute path before work starts. The 100× version is a marketplace of executable work contracts that counterparties can compose without sharing a model vendor or a vague natural-language score.
2. **Worsening problem + numbers — F/I/E:** anchor B motivates more autonomous delegation. No source quantifies the future specification backlog. At **10,000 jobs/day** with only **1%** unresolved acceptance and **20 minutes** per dispute, the scenario costs **33.3 person-hours/day**. Both buyer and supplier pay; improved coding accuracy alone does not settle what either purchased.
3. **Superhuman-model test — I:** remains when competent parties have different preferences, private information, or ambiguous terms. A perfect mediator can reduce drafting and misunderstanding but cannot make all mechanism-design tradeoffs disappear. Vanishes in fully standardized tasks with accepted contracts and cheap existing settlement.
4. **2030 at scale — I/E:** agent procurement systems reference reusable contract modules: canonical input set, feasible-output predicate, maximum price, deadline, evidence mode, adjudicator, and remedy. Workers expose the protocol; DOs manage reservations and status; R2 holds signed versions. Payments initially remain in existing rails, with test-credit escrow in the prototype.
5. **Lineage / stall / changed condition — F/I:** incentive-compatible mechanisms distinguish strategic behavior from incompetence; preference-identification limits show why more observation alone may not fix the objective [MS][MS] [INTENT][INTENT]. **I:** computable contracts cover only part of real commerce, while legal/customary interpretation persists. Better models make drafting/examples cheaper and create more machine-to-machine work worth specifying. This is closely related to round 1's executable work orders, not a new theorem of contracting.
6. **Who pays / value — I:** agent marketplaces, integration contractors, and data buyers pay for faster acceptance and fewer costly disputes. A specification is a shared commitment, not a model's guessed account of private intent.
7. **First proof — E:** pick one reconciliation service; implement a tiny contract schema, preview with positive/negative examples, signed immutable acceptance version, output checker, deadline, and manually resolved “unknown” state. Run 30 designed ambiguous cases against a plain-language brief baseline with actual consenting reviewers. Log which ambiguity required a normative decision. Use simulation/test balances; do not launch real escrow or claim legal enforceability.
8. **Demo + draft tweet — I:** two agents disagree about rounding; the contract exposes it before execution, and the buyer chooses one rule. “The models could both compute perfectly and still disagree about what was bought. We made the acceptance rule explicit before the run. The receipt checks that rule; disputes outside it remain explicit.”
9. **Kill test — E:** kill if writing the contract consumes the value of these jobs, reviewers routinely reject formally accepted outputs, or an ordinary schema/contract template resolves the same cases. Never claim truthful revelation or universally efficient settlement from the Myerson–Satterthwaite theorem.

### Idea 6 — Fresh-observation clearinghouse: buy the missing fact once

1. **Sentence + 100× — I/E:** let agents purchase a fresh, nonce-bound observation from an authenticated source and reuse it within an explicit validity window. The 100× version is a clearinghouse for scarce origin queries, instrument slots, inventory observations, and experiments, with provenance and disclosed measurement assumptions.
2. **Worsening problem + numbers — F/I/E:** anchor B supports increasing autonomy; it does not establish physical-observation demand. A scenario of **100,000 agents** polling the same fact every **10 seconds** creates **10,000 origin requests/s**. One permitted **1 Hz** observation stream could reduce origin reads dramatically if all buyers accept its one-second freshness and source identity. Independent observations, personalized data, and transactional availability cannot simply be shared.
3. **Superhuman-model test — I:** stronger planning can increase the value of missing fresh facts; a perfect model with the same prior observations still cannot distinguish two new external outcomes. Matters more at a real sensor/origin bottleneck. Vanishes when an ordinary cache, subscription feed, or direct query is already sufficient.
4. **2030 at scale — I/E:** publishers, labs, merchants, and device operators issue signed observations with subject, units, time basis, challenge nonce, calibration/source identity, and expiry. Buyers choose trusted sources; DOs coalesce permitted requests and reserve scarce measurement slots. R2 retains raw evidence where allowed. A subset of experimental actions still takes real time and equipment.
5. **Lineage / stall / changed condition — F/I:** Shannon distinguishes available information from possible messages [SHANNON][SHANNON]; signed provenance systems authenticate origin/history rather than truth. C2PA explicitly warns that provenance alone does not establish factual accuracy [C2PA][C2PA]. Succinct's **2026-04-23 ZCAM** already explores capture signatures/attestation [ZCAM][ZCAM]. **I:** hardware identity, calibration, source incentives, and adoption remain hard; better models do not fix a staged scene or lying sensor.
6. **Who pays / value — I:** agent platforms pay to avoid redundant origin hits; operators of scarce instruments or authoritative APIs sell timely access. This is not a business in minting “truth tokens.” The scarce asset is the participating source/measurement relationship.
7. **First proof — E:** use a participating test inventory endpoint with three deliberately changing versions. Implement authenticated responses, challenge/expiry handling, coalescing, and explicit “stale” outcomes; compare with HTTP caching/ETags and a websocket feed. Show that two divergent origin worlds with identical old data require a new response. Add no camera hardware: a phone/sensor integration is a later domain-specific test.
8. **Demo + draft tweet — I:** 1,000 simulated buyers share one authorized observation, then reject it when freshness expires; a validly signed false test reading is displayed as source-attributed rather than automatically true. “More reasoning cannot tell you whether inventory changed after your last read. We coalesced fresh authorized reads and carried the source, version and expiry with the answer. A signature authenticates the report, not reality.”
9. **Kill test — E:** kill if feeds/caches already solve the target workload, customers require incompatible freshness/privacy boundaries, sources will not sign/participate, or source reliability cannot be evaluated independently. No cryptographic proof compensates for an untrusted physical input.

### Idea 7 — A market for accepted computational progress, with irreducibility treated honestly

1. **Sentence + 100× — I/E:** buy resumable expensive computation as checked progress toward a customer objective, routing execution and evidence generation to suitable capacity. The 100× version coordinates large pools of independent simulation, search, and proving workers, while portable checkpoints prevent useful unfinished work being discarded.
2. **Worsening problem + numbers — F/I/E:** anchor A motivates pressure on capacity; existing prover markets show that this is already commercially contested. A scenario with **1,000,000 useful 60-second jobs/day** requires **16,667 CPU-hours/day** before replication/proving. Whether the jobs are unavoidable or benefit from a market must be measured. Customers pay for completions and latency, not a theorem label.
3. **Superhuman-model test — I:** survives only if the chosen task retains substantial execution cost after strong-model algorithm selection and caching. A model can eliminate bad search and many simulations. Do not label weather or cellular automata “irreducible” as a commercial warranty, and do not create useless VDF work to justify the market.
4. **2030 at scale — I/E:** domain customers submit deterministic simulation/search subjobs with checkpoint format, input commitments, acceptance predicate, evidence mode, deadline, and maximum cost. Cloudflare is the control plane; outside native/GPU workers do large jobs. Useful progress and final witnesses return through the same receipt protocol; current owner epochs prevent duplicate settlement.
5. **Lineage / stall / changed condition — F/I:** Wolfram motivates the search for residual execution; time hierarchy and VDFs clarify its limits [WOLF][WOLF] [TIME][TIME] [VDF][VDF]. GKR/modern proofs supply verification; Succinct and Boundless already supply competing markets [SPMARKET][SPMARKET] [BOUND][BOUND]. **I:** verification overhead, data shipping, heterogeneity, and unreliable supply remain the old barriers. The potential delta is useful portable progress in one domain, not generic compute brokerage.
6. **Who pays / value — I:** simulation-heavy engineering teams or optimization buyers pay for a checked feasible improvement, a completed deterministic batch, or a deadline guarantee. Avoid cycle-based rewards that encourage bloated traces, redundant work, or subsidy farming. A cycle counter is not proof of useful effort.
7. **First proof — E:** choose a deterministic integer scheduling/packing search with easy feasibility checks, explicitly making no optimality claim. Compare a domain solver plus stronger-model-generated algorithm against three native workers resuming explicit checkpoints and a simple queue. Include transport, resume, checking, preflight, failed jobs, and duplicate suppression. In a separate exact reducer, compare replay with an existing proof provider. Target **≥2×** useful accepted progress per dollar or **≥3×** recovery improvement; treat capsule versus JSON checkpoint as an independent test.
8. **Demo + draft tweet — I:** stop a worker during useful search, resume elsewhere, verify the feasible result, reject fabricated progress, and show the strong-algorithm baseline. “We bought accepted progress, not claimed CPU effort. This workload's measured execution survived our algorithm and cache baselines; checkpoints let another worker continue it. We have not proved it computationally irreducible.”
9. **Kill test — E:** kill if a better algorithm removes most work, managed batch/spot execution wins after verification, input transfer dominates, no easy acceptance relation exists, or customers need optimality proofs the prototype cannot supply. Rank below products with a clearer first buyer; generic marketplaces are already built.

### Idea 8 — Metric-pressure lab: find when a score stops buying the outcome

1. **Sentence + 100× — I/E:** continuously attack a customer's acceptance metric with increasingly strong optimizers and track divergence from independently observed outcomes. The 100× version is an evaluation-maintenance service for large agent ecosystems, with reproducible counterexamples and renewed outcome data rather than a fixed leaderboard.
2. **Worsening problem + numbers — F/I/E:** Goodhart variants and reward-model overoptimization support the mechanism [GOODVAR][GOODVAR] [RM][RM]; they do not quantify this market's growth. If each of **100,000** independent candidates has a **10^-4** probability of exploiting a particular gap, at least one succeeds with probability about **99.995%**. Independence and a stable per-candidate rate are artificial assumptions; correlated candidates invalidate that calculation.
3. **Superhuman-model test — I:** matters more if optimization improves faster than the proxy. Matters less if the receiver's model perfectly judges the actual objective from complete evidence. For closed exact tasks, use a formal checker and drop this service. Ground-truth collection and stakeholder choice must remain external to the optimizer under evaluation.
4. **2030 at scale — I/E:** marketplaces, support platforms, or infrastructure teams maintain acceptance modules plus versioned adversarial examples, hidden outcome cohorts, and bounded optimization budgets. Workers orchestrate tests; R2 preserves reproducible failure capsules and external outcome evidence. Users inspect concrete metric/outcome divergence, not an opaque “safety” grade.
5. **Lineage / stall / changed condition — F/I:** Goodhart/Campbell-style evaluation concerns and modern overoptimization research predate agents [GOOD][GOOD] [GOODVAR][GOODVAR] [RM][RM]. **I:** expensive reference labels and adaptive leakage limited coverage; stronger agents cheapen attack search while increasing pressure on weak measures. Round 1's Oracle Foundry/failure-search gate are direct predecessors. The distinct test is pressure-versus-outcome tracking, not another model judge.
6. **Who pays / value — I:** buyers whose reward/ranking mechanisms already induce gaming pay for newly discovered costly failure modes and maintained evaluation data. A static exploit corpus is a feature that a stronger model may absorb.
7. **First proof — E:** choose one service with an observable outcome, such as CSV reconciliation scored by superficial schema/total checks. Freeze a reference based on source records and an explicit acceptance contract; search at increasing budgets against the proxy, retaining every candidate. Hold out a final outcome cohort that is not reused during metric repair. Include an exact-spec control where the proxy has no gap. Compare with ordinary property-based testing and one strong model checking outputs directly.
8. **Demo + draft tweet — I:** show proxy score rising while the independently checked outcome degrades; replay the counterexample, then show a repaired metric on a fresh holdout. “Our agent improved the score by exploiting what the score omitted. Here's the exact replay and the independent outcome check. The repaired measure passed this new cohort; we are not claiming immunity to Goodhart's law.”
9. **Kill test — E:** kill if there is no independent affordable outcome signal, attack search only recovers known toy tricks, the maintained judge captures every relevant case at lower cost, or benchmark repair repeatedly overfits the same failures. This product has the greatest dependence on a persistent model/judge gap.

## 6. A shared implementation contract that does not overclaim

**I — Keep four evidence modes visibly distinct:**

| Mode | What a receiver gains | Work/trust boundary |
| --- | --- | --- |
| Authenticated statement | Attribution of specified bytes to a key | Trust the signer for the claim; a signature alone is not correct-execution evidence |
| Deterministic replay package | Receiver recomputes the relation from agreed starting material | Replay cost remains; input authenticity and the starting state must be accepted independently |
| Policy certificate / narrow witness | Cheap check of a specific predicate, such as bounded grant derivation or feasible schedule | Depends on a correct restricted checker and authenticated current state; no claim about arbitrary semantics |
| Succinct execution argument | Cheap verification of an encoded execution relation | Prover work, cryptographic/setup assumptions, verifier/program identity, availability of needed data, and external-input validation remain |

**I — Minimum receipt schema:** format/version; exact program/module and engine/ABI digests; accepted genesis or independently justified checkpoint; input roots and source identities; nondeterministic host-call journal; claimed output root; policy/checker identifier and version; evidence mode; nonce/job ID; public-input encoding; and, for effects, grant ancestry, target state version, owner epoch, expiry, and destination acknowledgment status. Signatures bind canonical encodings. A source hash identifies bytes, not compiler correctness; the receipt binds the executed binary too.

**I — Critical separation:** the code that generates a witness can be large and untrusted; the receiving checker and effect broker should be small. Never accept a prover-chosen arbitrary verifier or an unconstrained “hint” as an oracle. A verified action is not yet a committed remote effect. Store operation identity before dispatch; use destination idempotency/conditional writes where available; reconcile ambiguous outcomes rather than blindly retrying. No protocol promises exactly-once effects at arbitrary nonparticipating APIs.

**I — Existing assets fit unevenly.** QuickJS/Wasm's explicit tool channel makes clocks, randomness, network replies, and capability use journalable. A capsule is an acceleration/artifact option, not the root of truth. jitk's single tool channel offers a similarly narrow effect boundary but does not share a Wasm instruction semantics automatically. scriptc can compile a restricted pure checker, but its compilation must be included in the trust story. Proving the entire interpreter/native kernel is a different project from proving one reducer. Ordinary Wasm is not a zkVM; SP1 proves RISC-V guests, so TS integration requires a restricted compiler/interpreter inside a supported guest or an equivalent small reducer, with measured overhead. [SP1 execution target][SPINTRO].

**F — Cloudflare feasibility envelope:** current Workers docs give **128 MB per isolate including Wasm**, paid request CPU default **30 seconds**, configurable to **300 seconds**. [Limits][CFLIMIT]. **I:** control, streaming, small verifiers, and bounded replay belong there. Large proofs, trace generation, large-memory simulations, and GPU jobs go to outside workers. A Wasm verifier example exists upstream at Succinct, but its browser/Node support is not evidence that every current proof/version fits workerd's memory/CPU envelope; benchmark the exact release build. [Official verifier example][WASMVERIFY].

**F/E — A billion tiny receipts are an operations problem before a storage problem.** **1B × 2 KiB = 2.048 TB decimal (about 1,907 GiB)**. At R2 Standard's published **$0.015/GB-month**, retaining that fixed volume throughout a month is roughly **$31 using decimal GB**; **1B individual writes cost $4,500**, and **1B reads cost $360**, before allowances/rounding. Current Workers marginal rates imply about **$300** for 1B requests plus **$40** for 2 ms CPU each, excluding included quotas, subscription, DOs, and every other resource. Those are illustrative costs for a monthly volume, not an all-in daily-scale business quote. [R2, updated October 26, 2026][R2PRICE]; [Workers pricing][CFPRICE]. **I:** aggregate immutable receipt blocks and indexes where compatible with freshness and individual retrieval; measure amplification, privacy boundaries, and tail latency. Do not synchronize every receipt through one DO.

## 7. Evidence quality, gaps, and the next experiment

**I — What this report does not establish:** customer willingness to pay; a universal gap between generation and verification; an asymptotic lower bound for a commercially useful simulation; profitable demand for a new compute marketplace; production security of an untested verifier integration; or superior capsule economics versus plain source/state/journal replay. Those are killable hypotheses, not missing rhetorical confidence.

**F — Retrieval notes:** Rice's original AMS paper was available in indexed primary-source extracts, but direct AMS retrieval returned **403**, and a university PDF mirror returned **404**. The formal claim here is limited to the classical theorem, not a new reading of the inaccessible proof pages. Goodhart's original conference publication was established through RBA's bibliography and the publisher's 1984 chapter preview; full original text was not retrieved, so no purported verbatim original quotation is supplied. Flock's page was inspected through indexed web text and direct HTTP retrieval when a repeated browser fetch failed. Ethproofs' home dashboard and API documentation were accessible; its metrics/learn endpoints timed out or returned an error, so no historical cost series is inferred from them.

**I — First decision:** ask two real counterparties whether a downloadable replay receipt changes an actual acceptance decision. Build the two-week reconciliation experiment from idea 1 with a signed-journal baseline. Record generation, useful execution, encoding, publication, replay/verification, and recipient integration costs separately. Upgrade the model used to produce candidate implementations while holding the acceptance contract fixed. If stronger generation eliminates the receipt's value because the buyer accepts ordinary output just as readily, that is a successful falsification.

## Primary-source register

All accessed/searched **2026-10-27**. Dates below are publication dates, not a claim that a mutable documentation page was last revised then. University mirrors host original papers rather than independent summaries. Current vendor measurements are attributed claims, not reproduced measurements.

- **PNP / CLAY:** Stephen Cook, [*The P versus NP Problem*][PNP], official Millennium problem description, 2000; [Clay's current problem page][CLAY].
- **IP:** Adi Shamir, [*IP = PSPACE*][IP], JACM 39(4), October 1992; preliminary FOCS 1990.
- **PCP:** Arora, Lund, Motwani, Sudan, Szegedy, [*Proof Verification and the Hardness of Approximation Problems*][PCP], 1992/1998, author's hosted original.
- **GKR:** Goldwasser, Kalai, Rothblum, [*Delegating Computation: Interactive Proofs for Muggles*][GKR], May 2008.
- **GGP / PIN:** Gennaro, Gentry, Parno, [*Non-interactive Verifiable Computing*][GGP], August 2010; Parno et al., [*Pinocchio*][PIN], May 2013, primary project/paper page.
- **GROTH / STARK:** Jens Groth, [*On the Size of Pairing-based Non-interactive Arguments*][GROTH], March/May 2016; Ben-Sasson et al., [*Scalable, transparent, and post-quantum secure computational integrity*][STARK], January/March 2018.
- **PCC96 / PCC:** Necula and Lee, [OSDI PCC design][PCC96], October 1996; Necula, [author's paper index][PCC], containing POPL 1997 and safe-agent work.
- **RICE:** H. G. Rice, [*Classes of Recursively Enumerable Sets and Their Decision Problems*][RICE], March 1953; indexed original; direct retrieval limitation above.
- **WOLF / TIME / VDF:** Wolfram, [*A New Kind of Science*, p. 738][WOLF], 2002; Hartmanis and Stearns, [*On the Computational Complexity of Algorithms*][TIME], May 1965; Boneh et al., [*Verifiable Delay Functions*][VDF], 2018, revised 2019.
- **KOL / SHANNON:** Kolmogorov, [*Three Approaches to the Quantitative Definition of Information*][KOL], 1965 / English 1968; Shannon, [*A Mathematical Theory of Communication*][SHANNON], July/October 1948.
- **LAND / BENNETT:** Landauer, [*Irreversibility and Heat Generation in the Computing Process*][LAND], July 1961; Bennett, [*Logical Reversibility of Computation*][BENNETT], November 1973.
- **YAO / DISJ:** Yao, [*Some Complexity Questions Related to Distributive Computing*][YAO], April 1979; Razborov, [*On the Distributional Complexity of Disjointness*][DISJ], December 1992.
- **FLP / CAP:** Fischer, Lynch, Paterson, [consensus impossibility paper][FLP], April 1985; Gilbert, Lynch, [original CAP paper][CAP], June 2002.
- **MS / INTENT:** Myerson, Satterthwaite, [*Efficient Mechanisms for Bilateral Trading*][MS], April 1983; Armstrong, Mindermann, [preference-identification paper][INTENT], 2017/2018, revised January 2019.
- **GOOD / RBA / GOODVAR / RM:** Goodhart, [1984 chapter record][GOOD]; [RBA bibliography of the July 1975 conference][RBA], December 1990; Manheim, Garrabrant, [Goodhart variants][GOODVAR], 2018/2019; Gao, Schulman, Hilton, [reward-model overoptimization][RM], 2022/2023.
- **RSYNC / AFL / ADAPTON / MAC:** Tridgell, Mackerras, [rsync report][RSYNC], June 1996; Acar, Blelloch, Harper, [adaptive functional programming][AFL], January 2002; Hammer et al., [Adapton author's page][ADAPTON], June 2014; Birgisson et al., [macaroons][MAC], NDSS 2014.
- **ETH / ETHAPI:** Ethereum Foundation, [Ethproofs dashboard][ETH] and [API definitions][ETHAPI], current state observed October 27, 2026.
- **HYPER / FLOCK / ZCAM:** Succinct, [Hypercube launch][HYPER], February 19, 2026; Ron Rothblum/Succinct, [Flock][FLOCK], June 25, 2026; [ZCAM][ZCAM], April 23, 2026.
- **FAQ / TYPES / PGU / SEC / SPINTRO / WASMVERIFY:** current official [network cost/latency FAQ][FAQ], [proof modes][TYPES], [prover gas][PGU], [security model][SEC], [execution architecture][SPINTRO], and [Wasm verification example][WASMVERIFY]. The contradictory setup/latency wording is disclosed above.
- **R0BENCH / SPMARKET / BOUND:** current official [RISC Zero benchmarking instructions][R0BENCH], [Succinct market structure][SPMARKET], and [Boundless auction documentation][BOUND].
- **C2PA:** [version 2.4 explainer][C2PA], versioned specification companion; no claim that 2.4 is the latest release.
- **IEA / AUTON / TRAFFIC:** [IEA energy report][IEA], April 2025; [Anthropic agent-autonomy study][AUTON], February 18, 2026; [Cloudflare 2025 review][TRAFFIC], December 2025.
- **CFLIMIT / R2PRICE / CFPRICE:** current [Workers limits][CFLIMIT], [R2 pricing][R2PRICE], [Workers pricing][CFPRICE]; R2 page explicitly updated October 26, 2026.

[PNP]: https://www.claymath.org/wp-content/uploads/2022/06/pvsnp.pdf
[CLAY]: https://www.claymath.org/millennium/p-vs-np/
[IP]: https://crypto.cs.mcgill.ca/~crepeau/COMP647/2007/TOPIC01/Shamir-IP%3DPSPACE.pdf
[PCP]: https://people.csail.mit.edu/madhu/papers/1992/almss-journ.pdf
[GKR]: https://www.microsoft.com/en-us/research/publication/delegating-computation-interactive-proofs-muggles/
[GGP]: https://www.iacr.org/archive/crypto2010/62230459/62230459.pdf
[PIN]: https://www.microsoft.com/en-us/research/publication/pinocchio-nearly-practical-verifiable-computation/?lang=fr-ca
[GROTH]: https://eprint.iacr.org/2016/260
[STARK]: https://eprint.iacr.org/2018/046
[PCC96]: https://static.usenix.org/publications/library/proceedings/osdi96/full_papers/necula/html/node2.html
[PCC]: https://people.eecs.berkeley.edu/~necula/papers.html
[RICE]: https://www.ams.org/journals/tran/1953-074-02/S0002-9947-1953-0053041-6/S0002-9947-1953-0053041-6.pdf
[WOLF]: https://www.wolframscience.com/nks/p738--computational-irreducibility/
[TIME]: https://www3.risc.jku.at/people/schreine/courses/compcomp/HartmanisStearns1965.pdf
[VDF]: https://eprint.iacr.org/2018/601
[KOL]: https://www.karlin.mff.cuni.cz/~krajicek/kolmogorov65.pdf
[SHANNON]: https://www.cs.yale.edu/homes/yry/readings/general/shannon1948.pdf
[LAND]: https://www.cpt.univ-mrs.fr/~verga/pdfs/Landauer-1961uq.pdf
[BENNETT]: https://www.cs.princeton.edu/courses/archive/fall04/cos576/papers/bennett73.html
[YAO]: https://doi.org/10.1145/800135.804414
[DISJ]: https://doi.org/10.1016/0304-3975(92)90260-M
[FLP]: https://groups.csail.mit.edu/tds/papers/Lynch/jacm85.pdf
[CAP]: https://groups.csail.mit.edu/tds/papers/Gilbert/Brewer6.pdf
[MS]: https://www.cs.princeton.edu/courses/archive/spr06/cos444/reading/MS83/MS83.pdf
[INTENT]: https://arxiv.org/abs/1712.05812
[GOOD]: https://link.springer.com/chapter/10.1007/978-1-349-17295-5_4
[RBA]: https://www.rba.gov.au/publications/rdp/1990/9013/conference-volumes.html
[GOODVAR]: https://arxiv.org/abs/1803.04585
[RM]: https://proceedings.mlr.press/v202/gao23h/gao23h.pdf
[RSYNC]: https://download.samba.org/pub/unpacked/rsyncweb/tech_report/tech_report.html
[AFL]: https://www.cs.cmu.edu/~blelloch/papers/popl02.pdf
[ADAPTON]: https://matthewhammer.org/adapton/
[MAC]: https://research.google/pubs/macaroons-cookies-with-contextual-caveats-for-decentralized-authorization-in-the-cloud/
[ETH]: https://ethproofs.org/
[ETHAPI]: https://ethproofs.org/api.html
[HYPER]: https://blog.succinct.xyz/sp1-hypercube-is-now-live-on-mainnet/
[FLOCK]: https://blog.succinct.xyz/introducing-flock/
[ZCAM]: https://blog.succinct.xyz/introducing-zcam/
[FAQ]: https://docs.succinct.xyz/docs/sp1/prover-network/faq
[TYPES]: https://docs.succinct.xyz/docs/sp1/generating-proofs/proof-types
[PGU]: https://docs.succinct.xyz/docs/sp1/optimizing-programs/prover-gas
[SEC]: https://docs.succinct.xyz/docs/sp1/security/security-model
[SPINTRO]: https://docs.succinct.xyz/docs/sp1/introduction
[WASMVERIFY]: https://github.com/succinctlabs/example-sp1-wasm-verifier
[R0BENCH]: https://dev.risczero.com/api/zkvm/benchmarks
[SPMARKET]: https://docs.succinct.xyz/docs/protocol/spn/market-structure
[BOUND]: https://docs.boundless.network/developers/tutorials/auction
[C2PA]: https://spec.c2pa.org/specifications/specifications/2.4/explainer/Explainer.html
[IEA]: https://www.iea.org/reports/energy-and-ai/executive-summary
[AUTON]: https://www.anthropic.com/research/measuring-agent-autonomy
[TRAFFIC]: https://blog.cloudflare.com/radar-2025-year-in-review/
[CFLIMIT]: https://developers.cloudflare.com/workers/platform/limits/
[R2PRICE]: https://developers.cloudflare.com/r2/pricing/
[CFPRICE]: https://developers.cloudflare.com/workers/platform/pricing/

## Ranked top three, the ONE bet, and five-line TL;DR

**I — Full ranking:** **1. Counterparty receipts; 2. Proof-carrying actions; 3. Common computation store; 4. Fresh-observation clearinghouse; 5. Specification escrow; 6. Data-local proof capsules; 7. Accepted-progress market; 8. Metric-pressure lab.** This ranks model robustness, a plausible initial buyer, fit with existing assets, and a two-week falsification—not a speculative TAM score. The last idea is useful but most exposed to better judges; the market idea is ambitious but faces incumbents and an unproved workload premise.

**1 — Counterparty receipts. I:** strongest way to survive the perfect-model objection because the receiver's need is independent of the producer's intelligence. Cheap replay can be built now; succinct proofs become an optional evidence mode with explicit break-even economics. The decisive risk is whether a buyer actually needs independent execution evidence instead of a normal signature and journal. Do not build the network before that is answered.

**2 — Proof-carrying actions. I:** exclusive authority and current state remain real constraints as intelligence improves. It has a small implementable checker, a clear fork/retry demo, and an expansion path into multi-agent delegation. Its major competitor is good existing destination authorization. The win must be portable delegations accepted across vendors, not another approval screen or a claim to verify motives.

**3 — Common computation store. I:** the cleanest bet on growing compute/data pressure rather than persistent model error. It can compound with either of the first two, but deduplication and incremental computation are established techniques. Real dependency reuse and total transfer/CPU savings must beat ordinary compression, caching, and explicit checkpoints; if they do not, no amount of Kolmogorov language saves the product.

**I — The ONE bet:** build **a buyer-selected replay receipt for deterministic invoice reconciliation**, with one real buyer, one real supplier, an explicitly agreed input set, and an independent no-account verifier. Use TypeScript/Wasm and Cloudflare for distribution. Compare against signed JSON plus source replay before adding capsule acceleration; compare proof cost only on one small reducer before adding zkVM coverage. Expand from accepted results into proof-carrying write authority. The 100× ambition is that organizations can accept and reuse agent work without sharing its producer's model, execution service, or trust assumptions.

### Five-line TL;DR

1. **I:** Perfect models can eliminate redundant self-checking; they cannot automatically supply remote facts, shared intent, conserved authority, or evidence another party accepts.
2. **F/I:** P versus NP remains open; Rice/FLP/CAP are conditional, precise limits; Wolfram's broad irreducibility claim is not a universal simulation theorem.
3. **F/I:** 2026 proofs can be cheap for real workloads, but proving overhead, mode/setup choices, fixed latency, input truth, and specification remain separate costs.
4. **I:** Bet on counterparty receipts, then proof-carrying actions and shared computational progress; use the smallest sufficient checker and existing proof systems.
5. **E:** In two weeks, prove a real receiver values an independent replay receipt over signed output/source/journal—or kill the standalone verification business.
