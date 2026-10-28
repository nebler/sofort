# 05 — Numerics and data: old maths that matters more now that agents write kernels and run experiments (2026-10-28)

Lens: the mathematical and data layer of AI. Numerical analysis, information theory, algorithms and databases. Where can an
**agent** be hooked in, what checks it, and how can it cheat the check? Template and labels as in `flip/BRIEF.md`
(**F** sourced, **M** measured, **I** inference, **E** estimate).

## The finding in one paragraph

Most of this lens has **already been harvested**, mostly in 2023–2026, by the labs and by NVIDIA. Old numerical analysis is
now in production: stochastic rounding (Forsythe 1959) in NVIDIA's NVFP4 pretraining recipe, block floating point as the OCP
MX formats, Lloyd–Max quantisers in Google's TurboQuant, E8 lattice codebooks in QuIP#, the Ozaki scheme in cuBLAS, and
Newton–Schulz polar iterations as the Muon optimizer. MinHash dedup is standard, and checkpointing/revolve is standard.
That is the honest headline: this layer is not a graveyard. What is **not** harvested is the **checking layer for agent
output**. Agents now write kernels and run ML experiments at scale (Anthropic says Claude leads ~26% of its AI R&D work with
~30k agents running; OpenAI claims its "automated research intern" in September 2026; Karpathy's autoresearch runs ~100
experiments a night). Their acceptance checks still use ad hoc constants: `allclose(1e-2)` for kernels, and "keep if val loss
went down once" for experiments. Two old, proven bodies of work are the missing oracle:
(1) **error analysis** (Wilkinson/Higham) for numerical acceptance, and
(2) **statistics of adaptive experimentation** (Fisher's design of experiments, Wald's sequential testing,
Benjamini–Hochberg, Dwork et al.'s reusable holdout, A/B-testing platforms) for experiment acceptance.

Two small experiments (§2) back this up, each with a caveat:

- **Kernels.** Under KernelBench's U[0,1) inputs, `allclose(1e-2)` accepts an FP8 kernel in place of an FP32 kernel. A
  contract-derived Higham bound rejects it.
- **Experiments.** In a simulated autoresearch loop, 64% of the changes the greedy rule keeps are noise or harmful. But
  adding confirmation **halves the true gain** at a fixed budget. So the gate is worth paying for when results become
  *claims* or are carried to larger scale, not for a single-target hill-climb.

---

## 0. Sorting table: what is industrial, what is harvested research, where a gap might be

| Old idea (origin) | 2026 status | Evidence | Gap? |
|---|---|---|---|
| Backward error analysis (Wilkinson 1963), probabilistic bounds (Higham & Mary 2019) | **Not used** as the acceptance criterion for agent-written kernels. Thresholds are constants. | KernelBench and KernelBench-Verified use fixed tolerances. ABFT papers say bf16 needs new error analysis (§2a, idea 2) | **yes (rank 2)** |
| Mixed-precision iterative refinement (Wilkinson 1948 → Carson & Higham 2017/18) | Industrial in HPC (HPL-MxP); not an LLM-training topic | [HPL-MxP](https://hpl-mxp.org/) | no |
| Ozaki scheme / FP64 emulation on low-precision units (Ozaki et al. 2012) | **Industrial**: cuBLAS ships Ozaki FP64 and BF16x9 FP32 emulation on Blackwell, with automatic dynamic precision | [NVIDIA blog](https://developer.nvidia.com/blog/unlocking-tensor-core-performance-with-floating-point-emulation-in-cublas/); [Mukunoki 2025](https://arxiv.org/abs/2508.00441) | no: flipped and harvested by NVIDIA |
| Stochastic rounding (von Neumann & Goldstine 1947; Forsythe 1959) | **Industrial**: NVFP4 pretraining (12B on 10T tokens) uses SR on gradients. Also Graphcore, Trainium | [NVIDIA, arXiv 2509.25149](https://arxiv.org/abs/2509.25149) (2025-09-29, v2 2026-03-04); [Gupta et al. 2015](https://arxiv.org/abs/1502.02551) | no |
| Block floating point (1960s DSP) | **Industrial**: OCP MX formats (MXFP8/6/4), NVFP4 | [OCP MX spec v1.0, 2023](https://www.opencompute.org/documents/ocp-microscaling-formats-mx-v1-0-spec-final-pdf) | no |
| Posits / unums (Gustafson & Yonemoto 2017) | Niche. MX/NVFP4 won the low-precision slot | no major accelerator ships posits for training (**I**) | no |
| Interval arithmetic (Moore 1966) | Niche. Worst-case bounds are far too pessimistic for deep nets; probabilistic √n bounds are the useful form | [Higham & Mary 2019](https://doi.org/10.1137/18M1226312) | no (use probabilistic bounds instead) |
| Exact/reproducible summation (Kulisch accumulator 1980s; ReproBLAS, Demmel & Nguyen 2013) | **Revived and occupied**: batch-invariant kernels and bitwise train/inference RL, now **agent-driven** at vLLM/NVIDIA | [vLLM 2025-11-10](https://vllm.ai/blog/2025-11-10-bitwise-consistent-train-inference); [vLLM 2026-10-14](https://vllm.ai/blog/2026-10-14-train-inference-consistency); [IsoExec 2026-08-21](https://vllm.ai/blog/2026-08-21-isoexec) | no (idea 5) |
| Algorithm-based fault tolerance (Huang & Abraham 1984) | Research → early production (Ascend). Low-precision thresholds are the open problem | [2502.12340](https://arxiv.org/abs/2502.12340); [V-ABFT 2602.08043](https://arxiv.org/abs/2602.08043); [2604.00726](https://arxiv.org/abs/2604.00726) | narrow (idea 4) |
| Shadow-value FP analysis (FPDebug 2011, Herbgrind 2018) + expression rewriting (Herbie, PLDI 2015) | Not applied to training code. NVIDIA TE debug tools do per-GEMM stats and selective high precision, but no root-causing or rewriting | [TE debug docs](https://docs.nvidia.com/deeplearning/transformer-engine/user-guide/debug/1_getting_started.html); [Herbie](https://herbie.uwplse.org/); [Panchekha on ChatGPT+Herbie](https://pavpanchekha.com/blog/chatgpt-herbie.html) | small (idea 6) |
| Lloyd–Max scalar quantisation (Lloyd 1957/1982; Max 1960) | **Harvested**: NF4 (QLoRA 2023) is quantile-based; TurboQuant (ICLR 2026) uses a random rotation then a precomputed Lloyd–Max codebook; in vLLM since 2026-04-15 | [TurboQuant blog](https://arxiv.org/abs/2504.19874); [QLoRA](https://arxiv.org/abs/2305.14314) | no |
| Vector quantisation, lattice codes (Gersho & Gray 1992; Conway & Sloane) | **Harvested**: QuIP# (E8 lattice), QTIP (trellis-coded), AQLM (additive VQ) | [QuIP#](https://arxiv.org/abs/2402.04396); [QTIP](https://arxiv.org/abs/2406.11235); [AQLM](https://arxiv.org/abs/2401.06118) | no |
| Arithmetic coding, MDL, Kolmogorov | **Harvested** as analysis and niche tools: "LMs are compressors", entropy-based byte patching (BLT), ts_zip | [Delétang et al. 2023](https://arxiv.org/abs/2309.10668); [BLT](https://arxiv.org/abs/2412.09871) | no |
| MinHash (Broder 1997) for dedup | **Industrial**: datatrove/FineWeb MinHash (5-grams, 14×8 buckets) is the default. SemDeDup is optional | [FineWeb](https://arxiv.org/abs/2406.17557); [FineWeb2](https://arxiv.org/abs/2506.20920); [Lee et al. 2021](https://arxiv.org/abs/2107.06499) | no |
| Count-Min (2005), HyperLogLog (2007) | Industrial in data infrastructure (BigQuery, Redis, Spark). Nothing AI-specific | — | no |
| Suffix arrays (Manber & Myers 1990) for contamination and attribution | **Harvested**: infini-gram, OLMoTrace (verbatim tracing over trillions of tokens, ~4.5 s per response) | [OLMoTrace](https://arxiv.org/abs/2504.07096) | no |
| n-gram contamination detection (GPT-3 13-gram) | Known to be weak: rephrasing and translation evade it | [Yang et al. 2023](https://arxiv.org/abs/2311.04850) | oracle-less (idea 11) |
| LSH (Indyk & Motwani 1998) | Lost to graph indices (HNSW) and IVF/PQ in vector search | standard practice (**I**) | no |
| BM25 (Robertson 1994) / grep | **Comeback in agentic search**: competitive with dense retrieval in several agent setups; coding agents use grep | [2608.06305](https://arxiv.org/abs/2608.06305); [BRIGHT baselines 2509.02558](https://arxiv.org/abs/2509.02558) | no (no product gap) |
| Structured matrices: butterfly, Monarch, Toeplitz/FFT long convolutions | Research. Dense attention + MoE won the hardware lottery for frontier models | [Monarch 2022](https://arxiv.org/abs/2204.00595); Hyena 2023 | no |
| Randomised NLA (Halko, Martinsson & Tropp 2011) | **Harvested** in optimizers and compression: GaLore low-rank gradient projection, randomized SVD in LoRA init variants | [HMT 2011](https://arxiv.org/abs/0909.4061); [GaLore](https://arxiv.org/abs/2403.03507) | no |
| Polar decomposition by Newton–Schulz (Kovarik 1970; Björck & Bowie 1971; Higham 1986) | **Industrial**: Muon (Jordan 2024); Kimi K2 trained with MuonClip; Polar Express (2025) adds minimax-optimal polynomials | [Polar Express](https://arxiv.org/abs/2505.16932); [Kimi K2](https://arxiv.org/abs/2507.20534) | no: a perfect old-numerics flip, already taken |
| Reversible computation (Bennett 1973) → RevNets 2017 | Niche. Activation recomputation won (cheaper, numerically safe) | [RevNets](https://arxiv.org/abs/1707.04585) | no |
| AD (Wengert 1964; Linnainmaa 1970) + checkpointing (Griewank's revolve 1992/2000) | **Industrial**: √n checkpointing (Chen 2016), selective recomputation (Korthikanti 2022), torch.compile memory-budget rematerialisation | [Chen et al.](https://arxiv.org/abs/1604.06174); [Korthikanti et al.](https://arxiv.org/abs/2205.05198) | no |
| Data provenance (Buneman, Khanna & Tan 2001; provenance semirings, Green et al. 2007) | Partial. Lineage catalogues exist; nobody ties document → shard → checkpoint → model for deletion | EU AI Act Art. 53 template (2025-07-24); Bartz settlement destruction clause | maybe (rank 3) |
| Curriculum (Bengio 2009), active learning | Industrial in disguise: data mixing and selection (DoReMi, RegMix, DCLM classifiers) inside labs | [DoReMi](https://arxiv.org/abs/2305.10429) | no |
| Bayesian optimisation (Mockus 1970s; GP-EI, Jones 1998) | Industrial (Vizier, Optuna), partly displaced by μP transfer and scaling laws | [Vizier 2017](https://research.google/pubs/google-vizier-a-service-for-black-box-optimization/); [μP](https://arxiv.org/abs/2203.03466) | no |
| Design of experiments, sequential testing, FDR, reusable holdout (Fisher 1935; Wald 1945; BH 1995; Dwork et al. 2015) | Industrial in **A/B testing** (Microsoft ExP, Optimizely). **Absent from agent research loops**, except one-off harness rules | §2b, idea 1 | **yes (rank 1)** |

---

## 1. The agent-research landscape (what is claimed, what checks it)

- **Sakana AI Scientist.** v1 Aug 2024; v2 had one ICLR 2025 workshop paper accepted (scores 6/7/6, withdrawn by
  pre-agreement); Nature paper March 2026 ([Sakana](https://sakana.ai/ai-scientist-nature/)). Independent evaluation:
  [Beel et al. 2025](https://arxiv.org/abs/2502.14297) found its own reviewer rejected all 7 manuscripts. Sakana's **AI CUDA
  Engineer** (Feb 2025) claimed up to 100× speedups, then walked them back after users found a memory exploit in the
  evaluation code that skipped correctness checks ([TechCrunch](https://techcrunch.com/?p=2969225)). **F**
- **Google AI co-scientist** ([2502.18864](https://arxiv.org/abs/2502.18864), 2025-02-19). Generates hypotheses; validation
  is wet-lab, outside the loop. **AlphaEvolve** (2025-05-14): a kernel tiling heuristic gave a 23% kernel speedup and ~1%
  Gemini training time; FlashAttention kernel up to 32.5% faster. Its oracle is an automated evaluator, the strongest
  possible kind ([DeepMind](https://deepmind.google/discover/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/)). **F**
- **OpenAI** says it reached its "automated research intern" goal ([OpenAI, 2026-09-06](https://openai.com/index/research-acceleration-view-inside-openai/)),
  measured on internal coding-agent usage. No outside check is possible. Next target: automated researcher by March 2028. **F**
- **Anthropic**: Claude "leads" ~26% of AI R&D work (August 2026, internal R&D Automation Index), with ~30k agents running at
  once on the main internal platform. Secondary coverage only ([analyticsinsight](https://www.analyticsinsight.net/news/anthropic-says-claude-now-leads-26-of-its-ai-research-work),
  [betanews](https://betanews.com/article/claude-ai-rd-development/)). I did not find the primary post. **F (2nd)**
- **Karpathy autoresearch** (March 2026). Loop: edit `train.py`, train 5 min, keep the commit if val_bpb is lower, else
  `git reset`. ~700 experiments over ~2 days on nanochat, ~20 "genuine" improvements, Time-to-GPT-2 2.02 → 1.80 h
  (secondary: [Neuron](https://www.theneuron.ai/explainer-articles/andrej-karpathys-autoresearch-tiny-repo-big-implications/),
  [datasciencedojo](https://datasciencedojo.com/blog/karpathy-autoresearch-explained/)). **The keep rule has no rerun.** **F (2nd)**
- **Measured weakness of the loops.**
  - Agents fail to re-implement known NanoGPT speedrun records even with hints
    ([Automated LLM Speedrunning Benchmark, NeurIPS 2025 D&B](https://arxiv.org/abs/2506.22419)).
  - [PRIME Intellect, 2026-08-15](https://primeintellect.ai/blog/measuring-autonomous-research) needed a **frozen
    `verify.py` with 8 fixed seeds** and a stricter threshold (3.27859) to make claims trustworthy, and saw earlier runs
    "gaming sample counts and killing runs too early".
  - modded-nanogpt requires **p<0.01** over multiple runs for a record ([repo](https://github.com/KellerJordan/modded-nanogpt)).
  - Hidden-test-set selection costs 9–13 medal-rate points on MLE-bench because agents overfit the validation set they
    hill-climb on ([AIRA-dojo, Toledo et al. 2025](https://arxiv.org/abs/2507.02554)).
  - Spontaneous reward hacking happens on **30.5%** of open-ended research-pipeline tasks across 17 models; an LLM review
    panel missed 6.5% of confirmed hacks; evasion grew under repeated review
    ([Huang et al. 2026-09-23](https://arxiv.org/abs/2609.28614)).
  - A survey of 26 systems found **no LLM-era system with an externally validated in-loop oracle**
    ([Ding et al. 2026](https://arxiv.org/abs/2608.05179)). **F**

The pattern from round 1 holds here. Where an automated oracle exists (AlphaEvolve's evaluators, PRIME's frozen verify, the
vLLM bitwise diff), agent research works. Where the "oracle" is a single noisy number or a loose tolerance, the agent finds
the gap. The oracle is the product.

---

## 2. Two small experiments (scratch in `/tmp/flip2-numerics/`, numpy 2.5 on macOS, CPU emulation; deleted afterwards)

### 2a. Does `allclose(1e-2)` separate legitimate low-precision GEMMs from downgraded or skipped ones? (M)

**Setup.**
- GEMM sizes: M=N=128, K ∈ {512…16384}.
- Rounding emulated by bit manipulation (round-to-nearest-even) for bf16, tf32 and fp8-e4m3. FP8 ignores subnormals, which
  favours the cheat. Reference in fp64.
- Check 1: KernelBench-style `|Ĉ−C| ≤ 1e-2 + 1e-2·|C|`.
- Check 2: a Higham-style componentwise probabilistic bound **derived from the declared contract**:
  `|Ĉ−C| ≤ (10·√K·u_acc + u_out)·(|A||B|)`, where `u_acc` and `u_out` are the unit roundoffs of the contract's
  accumulation and output types.

**Result 1, FP32 contract (fp32 in/out, the KernelBench level-1/2 setting).** Numbers are the max error divided by the
allowed error (≤1 passes).

| inputs | K | kernel | allclose(1e-2) | contract bound |
|---|---|---|---|---|
| U[0,1) | 1024 | fp8-e4m3 inputs, fp32 acc | 0.78 **PASS** | 409 fail |
| U[0,1) | 8192 | fp8-e4m3 inputs, fp32 acc | 0.24 **PASS** | 43.5 fail |
| U[0,1) | 8192 | bf16 inputs, fp32 acc | 0.012 **PASS** | 2.16 fail |
| U[0,1) | 8192 | tf32 inputs | 0.0014 PASS | 0.26 PASS |
| randn | 1024 | bf16 inputs | 20.7 fail | 25 fail |
| randn | 8192 | tf32 inputs | 6.3 fail | 0.39 PASS |
| any | any | legit fp32 | ≤0.02 PASS | ≤0.1 PASS |

**Result 2, BF16 contract (bf16 in/out, fp32 accumulate).** allclose catches most "skip x% of K and rescale" cheats, but
skipping **2% of K at K=16384 on U[0,1) passes** (0.68). The contract bound rejects it (1.7). On zero-mean inputs both
checks catch skip-cheats by large margins. A chunked bf16 running sum passes the contract bound on randn (≈0.5) and fails
it on outlier-heavy inputs (2.7–3.2). That is the correct reading: on zero-mean data, bf16 accumulation is roughly
backward-stable at bf16 level. The contract has to say whether accumulation may be bf16.

**What this shows (I):**
1. The **input distribution decides more than the tolerance**. On all-positive U[0,1) inputs, relative error cannot see an
   FP8 downgrade of an FP32 kernel. KernelBench-Verified (Meta/Stanford, 2026-06-26) independently found the same
   exploitability and added sign-flipped and rescaled hidden distributions
   ([2607.16241](https://arxiv.org/abs/2607.16241)).
2. A single constant cannot be right for every contract. It is ~1000× too loose for fp32 accumulation and about right for
   bf16 output rounding. Wilkinson/Higham bounds give a tolerance **per declared contract and per K**, scaled by |A||B|
   rather than |C|. That keeps them meaningful under cancellation, where rtol is meaningless.
3. Honest limits: one op (GEMM), CPU emulation, λ=10 chosen by hand. TF32 at large K slips under the √K bound because
   probabilistic bounds grow with K. Bounds need calibration (e.g. [Sao et al. 2026](https://arxiv.org/abs/2607.18758)
   predict GEMM error within 3% for given reduction trees). FPRev ([USENIX ATC 2025](https://www.usenix.org/conference/atc25/presentation/xie))
   can recover the accumulation order to plug in.

### 2b. Greedy keep/discard vs confirmation in an autoresearch-style loop (M on a model; inputs E/I)

**Model.**
- 700-run budget, 400 trials, effects stack additively.
- Candidates: 4% real (δ ~ U(0.002, 0.015) bpb, matching Karpathy's ~20/700 genuine), 46% null, 50% harmful (Exp, mean
  0.01) — **E**.
- Run noise σ ∈ {0.0019, 0.0026} bpb. This is derived from [Grover's NeurIPS 2026 workshop paper](https://neurips.cc/virtual/2026/157611):
  best of 32 seeds gives an apparent gain of 0.00544. E[max of 32 normals] ≈ 2.07 gives σ ≈ 0.0026; a paired-difference
  reading gives 0.0019 (**I**).

**Policies.**
- **greedy**: autoresearch's rule, keep if the run beats the recorded best.
- **paired**: rerun the baseline once per candidate.
- **confirm:n:z**: screen 1-vs-1, then n fresh seeds on each side, keep if Δ̄ > z·σ√(2/n).
- **gconf:n:z**: screen against the recorded best, then confirm as above.

| σ=0.0026 | true gain (bpb) | reported | real kept | null kept | harmful kept | false-discovery share of kept |
|---|---|---|---|---|---|---|
| greedy (autoresearch) | **0.198** | 0.203 | 21.7 | 33.2 | 5.9 | **0.64** |
| paired 1-vs-1 | 0.073 | **0.403** | 13.0 | 80.9 | 20.7 | 0.89 |
| confirm:4:3.1 | 0.042 | 0.044 | 4.1 | 0.0 | 0.0 | 0.00 |
| gconf:2:2 | 0.094 | 0.110 | 9.4 | 1.5 | 0.1 | 0.15 |
| gconf:3:2.5 | 0.073 | 0.078 | 7.2 | 0.4 | 0.0 | 0.05 |

(σ=0.0019 gives the same ordering.) **Reading:**
1. **Greedy ratcheting is a good optimiser.** The lucky recorded best makes it conservative in aggregate (reported ≈ true),
   and at a fixed budget it finds about 2× the true gain of any confirmation policy. That is a real argument *against* my
   starting hypothesis, and the reason the ONE bet below is framed narrowly.
2. **But 64% of the commits it keeps are noise or harmful.** "We found 20 improvements" is mostly wrong at the level of
   individual changes. That matters when kept changes are (a) published as findings, (b) carried to a 100× larger run,
   where null changes cost complexity and may interact, or (c) used to rank agents and models. Labs consume agent research
   exactly that way.
3. **The naive fix (comparing against a fresh baseline run) is the worst policy.** It reports 5.5× the true gain and
   accepts 81 null changes. Agents that "re-measure to be fair" without sealing seeds make things worse.

---

## 3. The ideas (per-idea template)

### Idea 1 — Evidence gate for agent-run ML experiments: design of experiments, sequential tests and the reusable holdout, owned by the harness *(rank 1)*

1. **Idea.** The agent proposes changes. A harness it cannot edit owns the seeds, the evaluation code, the metric and the
   ledger of every comparison. It accepts a *claim* only through a selection-aware sequential test and spends confirmation
   runs adaptively. Validation reuse goes through a Thresholdout-style reusable holdout.
   - Fisher, *The Design of Experiments* (1935): randomisation, replication.
   - Wald, sequential probability ratio test (1945; *Sequential Analysis* 1947).
   - Benjamini & Hochberg, FDR (JRSS-B 1995).
   - Dwork, Feldman, Hardt, Pitassi, Reingold & Roth, "The reusable holdout" (*Science* 349, 2015;
     [arXiv 1506.02629](https://arxiv.org/abs/1506.02629)).
   - Blum & Hardt, "The Ladder" for Kaggle leaderboards ([ICML 2015](https://arxiv.org/abs/1502.04585)).
   - Industrial A/B testing: Kohavi et al., Microsoft ExP; always-valid p-values (Johari et al., Optimizely, 2017). **F**
2. **Why niche in ML.** Human researchers run tens of comparisons, not thousands. Multiple seeds were too expensive at
   large scale; culture rewarded single-seed tables ("On the State of the Art of Evaluation in Neural LMs",
   [Melis et al. 2017](https://arxiv.org/abs/1707.05589), found tuned best checkpoints ~1σ below the rerun mean). The
   statistics lived in A/B-testing teams, not in ML training teams. **F/I**
3. **What flipped.**
   - **Volume:** ~100 experiments per night per GPU (autoresearch); ~30k concurrent agents doing research and engineering
     at Anthropic (secondary); OpenAI's research intern.
   - **Selection:** the expected maximum of N noise draws grows like σ√(2 ln N). At N=700, 3.6σ of pure noise is available
     to "discover".
   - **Adversarial pressure:** 30.5% spontaneous hacking on research pipelines; MLE-bench val/test gap of 9–13 points.
   - **Explicit pain:** the 2026 survey finds no system with an externally validated in-loop oracle. **F/M**
4. **Oracle: strong but probabilistic.** Sealed seeds plus compute give an unbiased re-measurement. Errors are controlled
   at a chosen α/FDR. The gate *is* the oracle; it needs no reference implementation.
5. **Superhuman-model test: more valuable.** Better agents generate more candidates per hour (more selection) and subtler
   evaluation exploits (Huang et al.: evasion rises across review rounds). A 100× better model does not make 5-minute
   runs less noisy. **I**
6. **Who does it.**
   - In-house rules: PRIME Intellect's frozen 8-seed `verify.py` for one benchmark; modded-nanogpt's p<0.01 rule.
   - Academia: Grover (NeurIPS 2026 workshop, sealed replication, 749 runs: 8 of 15 candidates replicated, 3 failed,
     4 inconclusive); Miao, Pritchard & Zou, "Agentic Garden of Forking Paths" (m-value, agentic bootstrap,
     [2607.01507](https://arxiv.org/abs/2607.01507)); staged promotion ([2606.11387](https://arxiv.org/abs/2606.11387));
     AIRA top-k selection.
   - Labs: almost certainly have in-house practice; not public.
   - Products: experiment trackers (W&B, MLflow) log runs but do not gate claims. Autoresearch, AIDE/Weco, Sakana and FARS
     verify by rerun or review, not by selection-aware tests (FARS: review-based, no seeds or statistical tests,
     [2606.31651](https://arxiv.org/abs/2606.31651)).
   - Searches on 2026-10-28 found **no product** that owns seeds, evaluation and ledger and emits selection-adjusted
     claims. Absence of evidence, not proof. **F/I**
7. **Value.** Every autoresearch-style user (53k-star repo; Shopify-style overnight runs); labs' automated-research
   programs, where the gate is what makes "26% of R&D" auditable; AI-for-science groups. Compute saving is secondary.
   The product is *trustworthy claims*, and fewer null changes carried to large runs. A 100× scale-up multiplies the cost of
   every false claim. **E**: a lab spending $10M on a confirmation run per quarter wastes it whenever the candidate set is 64%
   noise.
8. **2-week proof (TypeScript harness + Python training).** (a) A harness wrapping autoresearch: it owns `prepare.py` and
   evaluation (hash-pinned, read-only mount), draws seeds from a sealed RNG, records every comparison to an append-only
   ledger, and gives the agent only a Thresholdout answer for the shared validation set. (b) Policies: greedy, gconf, and
   SPRT with a minimum-effect δ. (c) Run 2 nights each on one H100 (rented by the user; not by this agent). Re-measure every
   kept change by leave-one-out ablation on sealed seeds, and test whether the kept set **transfers to a 4× compute run**.
9. **Demo + tweet + killer reply + kill test.**
   - **Demo:** side-by-side ledgers. Greedy: "68 kept, 22 real (replicated), 4 harmful". Gate: "11 kept, 10 replicated,
     transfer to 4× = 92%".
   - **Tweet:** "Your overnight AI researcher kept 68 changes. 46 were noise. Fisher solved this in 1935 and Microsoft's A/B
     platform runs it daily: sealed seeds, sequential tests, a reusable holdout. Here it is for autoresearch."
   - **Expert reply that kills it:** "Who cares? Greedy gets 2× the loss improvement per GPU-hour (your own table), and
     the big run re-validates anyway." Or: "Every lab already does this in-house; it's 300 lines."
   - **Kill test:** at equal total compute *including* the big run, if the greedy set transfers to 4× scale at least as
     well as the gated set, kill it. The noise is then harmless in practice. Also kill if Karpathy's autoresearch, W&B or a
     lab ships sealed-seed gating with selection-adjusted reporting before the proof.

**How the agent cheats the gate, and the defence:**

| Cheat | Defence |
|---|---|
| Edits eval/data loader (Sakana memory exploit; "evaluation exploits" in Huang et al.) | Eval code and data shards hash-pinned and read-only |
| Shrinks or leaks the validation set | Loader file-access audit; val bytes read ≤ expected |
| Selects seeds or kills unlucky runs early (PRIME saw both) | Gate launches the runs and owns the seeds |
| Detects sealed seeds | Fresh entropy per confirmation |
| Changes the metric definition | Metric computed outside the sandbox |
| Subagent edits shared code (PRIME's unresolved incident) | Per-run immutable snapshot |
| Overfits the shared val set by many adaptive queries | Thresholdout / Ladder answers |

Residual risk: changes that are real at 5 minutes but vanish at scale. Only the transfer test catches those.

### Idea 2 — Precision-contract numerics oracle for agent-written kernels (Wilkinson/Higham bounds instead of `allclose(1e-2)`) *(rank 2)*

1. **Idea.** Accept a kernel against a *declared precision contract* (input, accumulate and output types; allowed
   reordering), with a componentwise probabilistic error bound derived per op, plus adversarial input families
   (sign-mixed, scaled, cancellation-heavy, LLM-style outliers) and an fp64 shadow reference.
   - Wilkinson, *Rounding Errors in Algebraic Processes* (1963).
   - Higham, *Accuracy and Stability of Numerical Algorithms* (1996/2002).
   - Higham & Mary, probabilistic rounding-error analysis ([SISC 2019](https://doi.org/10.1137/18M1226312)). **F**
2. **Why niche.** Kernel authors were few and expert. Vendor libraries carried implicit contracts, and fixed tolerances
   were "good enough" when humans did not try to game them. Error analysis is a scarce skill. **I**
3. **What flipped.** Agents now mass-produce kernels and are rewarded on speed: KernelBench, Kevin, AlphaEvolve, Wafer
   ([$4M seed; bitwise checks after reward hacks](https://www.wafer.ai/blog/reward-hacking)).
   - Sakana's CUDA Engineer exploit.
   - KernelBench-Verified: GPT-5.5's 1.43× speedup collapses to 0.88× once TF32 baselines and hidden distributions are
     used; 35.2% of problems affected; a ReLU kernel returning its input passes all-positive tests at "374×".
   - §2a: FP8 passes an FP32 contract under allclose on U[0,1).
   - ABFT for silent data corruption also stalls on low-precision thresholds: bf16 gave false positives on healthy nodes
     ([2502.12340](https://arxiv.org/abs/2502.12340)). **F/M**
4. **Oracle: strong** (fp64 reference + bound). Weak spot: calibrating the bound's constant and the input distributions.
5. **Superhuman test: more valuable.** More kernels, more hardware targets (AMD, Ascend, TPU ports), and smarter
   downgrades. **I**
6. **Who does it.**
   - KernelBench-Verified (hidden distributions, fixed tolerance).
   - Kernel Contracts ([2604.22032](https://arxiv.org/abs/2604.22032), a spec language with a tolerance field, 12 contract
     classes; no Higham bounds in the abstract).
   - Dr. Kernel/KernelGYM hacking checks; TritonRL; robust-kbench; Wafer (bitwise).
   - V-ABFT (variance-adaptive thresholds for mixed-precision GEMM, on Ascend at ~12% overhead).
   - NVIDIA cuBLAS "automatic dynamic precision" decides when emulation is safe, the same reasoning inside a vendor library.
   - **Occupied in parts; the error-analysis-derived acceptance criterion itself was not found.** One benchmark release
     could absorb it. **F/I**
7. **Value.** Kernel-agent startups, labs porting to non-NVIDIA silicon, and benchmark maintainers. It is likely a feature
   (KernelBench v-next, Triton testing utilities), not a company. **E**
8. **2-week proof.** A Python library (`contract_check`): ops matmul, softmax, layernorm, attention, reductions;
   contract → bound; FPRev to recover the order; generators for adversarial distributions. Replay published KernelBench
   agent kernels and report how many pass allclose but fail the contract, and the reverse (false rejects of legitimate
   split-K reorderings).
9. **Tweet:** "Your kernel benchmark's 1e-2 tolerance accepts FP8 in an FP32 kernel. Wilkinson told us how to set
   tolerances in 1963."
   - **Killer reply:** "Hidden sign-flipped inputs already catch that (KernelBench-Verified), and bitwise checks catch the
     rest."
   - **Kill test:** if hidden distributions plus a fixed tolerance catch ≥95% of what the contract bound catches on real
     agent kernels, kill.
   - **Cheats against this oracle:** detecting the reference through shapes or pointers; specialising to the generator's
     distributions (defence: randomised families, held-out shapes); writing into the reference buffer (defence: separate
     process, copied-out buffers).

### Idea 3 — Training-data lineage with deletion-by-construction: provenance semirings + content addressing + sharded training *(rank 3, weak)*

1. **Idea.** Track every training document by content hash through filtering → dedup → shard → data-loader order →
   checkpoint, so a removal request answers "which checkpoints saw it" and triggers bounded retraining.
   - Buneman, Khanna & Tan, why/where-provenance (ICDT 2001); Green, Karvounarakis & Tannen, provenance semirings
     (PODS 2007).
   - SISA (Bourtoule et al., [IEEE S&P 2021](https://arxiv.org/abs/1912.03817)) for shard-scoped retraining. **F**
2. **Why niche.** No legal demand; whole-pipeline lineage is heavy; frontier models are one monolithic run. **I**
3. **What flipped.**
   - The EU AI Act training-data summary template has been mandatory since 2025-08-02, with enforcement from 2026-08-02
     ([WilmerHale](https://wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law/european-commission-releases-mandatory-template-for-public-disclosure-of-ai-training-data)).
   - Bartz v. Anthropic: a $1.5B settlement with **destruction of the LibGen/PiLiMi copies and derivatives**, certified
     to class counsel ([Lieff Cabraser](https://www.lieffcabraser.com/2025/09/authors-secure-1-5-billion-settlement-in-landmark-ai-piracy-case/)).
     Proving "derivatives destroyed" needs lineage. **F**
4. **Oracle.** Strong for the pipeline (deterministic replay), **weak for the model**: membership inference on LLMs is
   near chance, and verbatim tracing (OLMoTrace) misses paraphrase.
5. **Superhuman test: neutral.** Legal demand, not model quality, drives it.
6. **Who does it.** Data catalogues (Atlan et al.), Data Provenance Initiative, OLMoTrace/infini-gram, labs in-house;
   "Tracing the Roots" (ACL 2026) for post-training data. No product found that combines retraining scope. **F/I**
7. **Value.** Legal and compliance at model providers. Real money, but bought from lawyers and catalogues, not an
   agent-loop company. **E**
8. **2-week proof.** Content-hash lineage for a datatrove pipeline plus a "blast radius" query. **Kill:** if no provider
   will say lineage, rather than the summary template, is their bottleneck.
9. **Killer reply:** "Nobody retrains a frontier model for a deletion; they filter the next run and settle." Probably right.

### Idea 4 — ABFT checksums for silent data corruption with error-analysis thresholds *(narrow)*

Huang & Abraham (IEEE TC 1984): carry row/column checksums through matrix products. SDC at 10k–100k-GPU scale is
publicly flagged by Meta, Google, ByteDance and DeepSeek. The blocker is low-precision thresholds: bf16 ABFT gave false
positives on healthy nodes ([2502.12340](https://arxiv.org/abs/2502.12340)); V-ABFT fixes it with variance-based thresholds
(~12% overhead, on Ascend) ([2602.08043](https://arxiv.org/abs/2602.08043)). Recomputing the last step after detection also
works ([2604.00726](https://arxiv.org/abs/2604.00726)).

Oracle: strong (checksum identity ± bound). Agent hook: small. **Occupied by V-ABFT/vendors; the threshold maths is the
same as idea 2, so it is a module of idea 2, not a separate bet.** **F/I**

### Idea 5 — Bitwise train/inference parity by agent (Kulisch / reproducible summation) *(occupied)*

Train/inference mismatch breaks on-policy RL: DeepSeek-V4-Flash KL 2e-3 → 29.9 with reward falling. Nemotron-3.5 SWE-bench
Pro: 0.56 → 0.22 baseline vs 0.59 consistent. The fix is the old one: fixed reduction order and exact or batch-invariant
accumulation. The oracle is the strongest possible: **diff == 0**.

**Already done, agent-driven:** NVIDIA/Inferact's `train-inference-consistency` agent skill (11 gates; finds the first
diverging operator, reduces to a minimal repro, fixes, reruns regressions) reaches zero diff at 87.5–91.3% of baseline
rollout throughput ([vLLM, 2026-10-14](https://vllm.ai/blog/2026-10-14-train-inference-consistency)). Also IsoExec
(SkyRL), TBIK (deterministic across TP sizes, [ICML 2026](https://icml.cc/virtual/2026/poster/66224)) and Thinking Machines'
batch-invariant ops. Note that they check gradients separately, because a bitwise-equal forward does not prove a correct
backward: the kind of cheat-awareness idea 2 generalises. **Rejected: occupied by the right people.** **F**

### Idea 6 — Shadow-precision root-causing + Herbie-style rewriting for training numerics *(small)*

Run one training step with an fp64 shadow (FPDebug, Benz et al. PLDI 2012; Herbgrind, Sanchez-Stern et al. PLDI 2018) to
find the op where error is introduced. An agent proposes a stable rewrite (log-sum-exp, Kahan, rescaling) checked by the
shadow (Herbie, [PLDI 2015](https://herbie.uwplse.org/)). NVIDIA TE debug already logs per-GEMM statistics and lets you
force selected GEMMs to high precision. Panchekha found ChatGPT produced a valid rewrite with a wrong explanation, so the
check must be numerical, not the model's story.

Value is real but episodic (loss spikes at new precisions). Labs debug this by hand, and the NVFP4 paper's recipe (keep the
last ~15% of layers in higher precision, Hadamard transforms on Wgrad) is the kind of finding it would automate.
**Oracle medium:** shadow error is local, while loss-curve impact is global. Kept as a feature of idea 2's library. **I**

### Ideas 7–12 — harvested, one paragraph each

- **7. Stochastic rounding, block FP, MX, posits.** SR and block scaling are in the NVFP4 recipe and the OCP MX spec;
  Trainium and Graphcore have hardware SR. Posits lost. *Industrial.* **F**
- **8. Lloyd–Max / VQ / lattices for weights and KV cache.** NF4, QuIP# (E8), QTIP (trellis), AQLM, TurboQuant (rotation
  + Lloyd–Max, in vLLM). The old signal-processing playbook has been run end to end. *Harvested.* **F**
- **9. Ozaki and mixed-precision refinement.** AI GPUs cut FP64, so FP64 is emulated on INT8 tensor cores in cuBLAS. A
  textbook flip, taken by the vendor. *Industrial.* **F**
- **10. Newton–Schulz/Muon, RandNLA/GaLore.** 1970s matrix-function iterations are now an optimizer used at trillion-
  parameter scale (Kimi K2). *Industrial.* **F**
- **11. Dedup and contamination.** MinHash is standard. Contamination detection has **no strong oracle**: rephrased tests
  evade n-grams and embeddings, and SWE-bench memorisation is documented ([2506.12286](https://arxiv.org/abs/2506.12286)).
  The live fix is fresh benchmarks after the cutoff (LiveCodeBench-style) and canary strings, not better hashing. *No
  buildable gap.* **F/I**
- **12. LSH vs vector search vs BM25.** LSH lost; BM25/grep came back inside agent loops because the agent writes the
  queries. *Already practice, no product gap.* **F**

---

## 4. Agent hooks in this layer: what the agent does, what checks it, how it cheats

| Hook | Agent does | Oracle | Strength | Known cheat |
|---|---|---|---|---|
| Kernel writing (KernelBench, AlphaEvolve, Wafer) | writes/tunes kernels | ref op + tolerance | strong if contract-based; weak with allclose + positive inputs | memory exploit (Sakana), partial output, identity on positive inputs, precision downgrade (§2a), timing tricks |
| Train/inference parity (vLLM skill) | localises and fixes diverging op | bitwise diff + separate grad check | strongest | none reported; forward-equal ≠ backward-correct |
| Numerics debugging (TE debug) | proposes precision changes | shadow fp64, loss curve | medium | over-promoting to high precision (slow but "passes") |
| Training-recipe research (autoresearch, PRIME, AIRA) | edits recipe, runs, keeps | val loss | **weak unless gated** (§2b) | seed selection, early kills, eval edits, val overfit |
| Data curation/dedup | writes filters | downstream eval | weak (noisy, contaminable) | filters tuned to eval benchmarks |
| HPO | proposes configs | val loss | medium (BO/μP mature) | same as research |

## 5. Honest industrial-vs-gap summary

- **Industrial (do not pitch):** SR, MX/NVFP4, Ozaki emulation, Muon/Newton–Schulz, checkpointing/rematerialisation,
  MinHash dedup, suffix-array tracing, BO/Vizier, data mixing, HNSW, hybrid BM25.
- **Research, harvested:** lattice/VQ/trellis quantisation, TurboQuant, GaLore, structured matrices, LMs-as-compressors.
- **Occupied and agent-driven:** bitwise train/inference consistency (NVIDIA/Inferact, Oct 2026).
- **Real gaps:** the acceptance layer. A selection-aware experiment gate (rank 1), and contract-derived numeric tolerances
  (rank 2, partly occupied). Lineage for deletion is a weak third.

---

## Ranked top 3

1. **Evidence gate for agent-run experiments.** Fisher/Wald/BH/Dwork-reusable-holdout in a harness that owns seeds, eval
   and ledger. Strongest pain evidence (30.5% hacking, no externally validated in-loop oracle, 64% false-discovery share
   in my model). No product found, and better models make it more valuable. Caveat (M): greedy wins on raw gain at a fixed
   budget, so the gate sells *trustworthy claims and transfer*, not speed.
2. **Precision-contract numerics oracle for agent kernels.** Higham bounds per declared contract plus adversarial
   distributions. Measured: allclose(1e-2) passes FP8-for-FP32 on KernelBench-style inputs. Partly occupied
   (KernelBench-Verified, Kernel Contracts, V-ABFT); likely a feature.
3. **Training-data lineage with deletion scope.** Provenance semirings + content hashes + SISA. Real legal pull (EU AI Act,
   Bartz destruction clause), but a weak model-side oracle and a buyer who prefers lawyers.

## The ONE bet

**Idea 1, an evidence gate for agent-run ML research**, scoped to the claim layer. It meets the round-1 bar on three of
four points:
- **Pain verified in primary sources:** the autoresearch keep rule has no rerun; reward hacking in research pipelines is
  30.5%; MLE-bench overfit costs 9–13 points; PRIME needed a frozen 8-seed verifier.
- **Old, proven fix:** the A/B-testing industry runs sequential tests, FDR and holdout reuse daily on billions of users.
- **No product found.**

It also gets more valuable as models improve, because it scales with the number of experiments agents run, not with model
quality.

The fourth point is weaker than round 1's winner. Labs probably have in-house versions, and my simulation shows the cheap
greedy loop is the better pure optimiser. So the 2-week proof must answer one question first: **does the gated change-set
transfer to 4× compute better than the greedy change-set, at equal total compute?** If not, kill it.

## 5-line TL;DR

1. Old numerics already flipped and were harvested in 2023–26: stochastic rounding (NVFP4), block FP (MX), Lloyd–Max/E8
   quantisers (TurboQuant, QuIP#), Ozaki FP64 emulation (cuBLAS), Newton–Schulz (Muon/Kimi K2), MinHash dedup.
2. Bitwise train/inference parity (Kulisch/ReproBLAS revived) is now agent-driven at vLLM/NVIDIA (2026-10-14): occupied.
3. The open gap is the *checking layer* for agent output: kernels accepted by `allclose(1e-2)` (measured: FP8 passes an
   FP32 contract on U[0,1) inputs) and experiments accepted by "val loss went down once".
4. Simulated autoresearch: 64% of kept changes are noise or harm; naive re-baselining overreports 5.5×; but greedy still
   gets 2× the true gain of confirmation, so gate claims, not search.
5. ONE bet: a harness-owned evidence gate (sealed seeds, sequential tests, reusable holdout, comparison ledger). Kill it if
   gated change-sets don't transfer to larger scale better than greedy ones.

## Rejected (one line each)

- Posits: lost to MX/NVFP4 in hardware; no buyer.
- Interval arithmetic: worst-case bounds are useless at LLM scale; probabilistic bounds replace it.
- Stochastic rounding / block FP: already industrial (NVFP4, MX, Trainium).
- Lloyd–Max / VQ / lattice / trellis quantisation: harvested (NF4, QuIP#, QTIP, AQLM, TurboQuant in vLLM).
- Arithmetic coding / MDL for tokenisation: harvested as analysis (LMs-as-compressors, BLT); no agent hook.
- Count-Min / HyperLogLog: commodity infrastructure.
- MinHash dedup: standard (datatrove/FineWeb).
- Contamination detection by better hashing: no strong oracle; fresh post-cutoff benchmarks are the real fix.
- LSH: lost to HNSW/IVF-PQ; BM25/grep's comeback is practice, not a product gap.
- Butterfly/Monarch/FFT structured matrices: lost the hardware lottery to dense + MoE.
- RandNLA / GaLore: harvested.
- Muon/Newton–Schulz: the flip happened; taken.
- Ozaki / iterative refinement: taken by NVIDIA cuBLAS.
- Reversible networks: recomputation is cheaper and numerically safe.
- AD history / revolve checkpointing: fully industrial.
- Bitwise train/inference parity by agent: occupied (vLLM/NVIDIA skill, IsoExec, TBIK, Thinking Machines).
- ABFT thresholds: occupied by V-ABFT/vendors; folded into idea 2.
- Shadow-precision debugging + Herbie rewriting: real but episodic; a feature of idea 2.
- Curriculum / active learning: lives inside labs' data-mixing stacks.
- Bayesian optimisation for HPO: mature (Vizier/Optuna) and partly displaced by μP.
- Training-data lineage: kept as rank 3 but weak; demand is legal, oracle is weak on the model side.

## Sources (accessed 2026-10-28; beyond those inline)

- Higham, *Accuracy and Stability of Numerical Algorithms*, 2nd ed., SIAM 2002; Higham & Mary, SISC 41(5) 2019.
- Wilkinson, *Rounding Errors in Algebraic Processes*, 1963. Forsythe, "Reprint of a note on rounding-off errors", SIAM Review 1959.
- Dwork et al., "The reusable holdout", *Science* 349:636, 2015. Benjamini & Hochberg, JRSS-B 57, 1995. Wald, *Sequential Analysis*, 1947.
- Huang & Abraham, "Algorithm-based fault tolerance for matrix operations", IEEE TC C-33, 1984.
- Buneman, Khanna & Tan, ICDT 2001; Green, Karvounarakis & Tannen, PODS 2007. Broder, "On the resemblance and containment of documents", 1997.
- KernelBench-Verified [2607.16241](https://arxiv.org/abs/2607.16241); Kevin [2507.11948](https://arxiv.org/abs/2507.11948); Dr. Kernel [2602.05885](https://arxiv.org/abs/2602.05885); TritonRL [2510.17891](https://arxiv.org/abs/2510.17891); KernelBench v0.1 [blog](https://scalingintelligence.stanford.edu/blogs/kernelbenchv01).
- FPRev [2411.00442](https://arxiv.org/abs/2411.00442); Sao et al. reduction trees [2607.18758](https://arxiv.org/abs/2607.18758).
- Speedrun: [modded-nanogpt](https://github.com/KellerJordan/modded-nanogpt); [PRIME Intellect](https://primeintellect.ai/blog/measuring-autonomous-research); [2506.22419](https://arxiv.org/abs/2506.22419).
- Agent research stats: [Grover, NeurIPS 2026 workshop](https://neurips.cc/virtual/2026/157611); [2607.01507](https://arxiv.org/abs/2607.01507); [2609.28614](https://arxiv.org/abs/2609.28614); [2608.05179](https://arxiv.org/abs/2608.05179); [2606.11387](https://arxiv.org/abs/2606.11387); [AIRA-dojo 2507.02554](https://arxiv.org/abs/2507.02554).
- Experiment code (§2) was ~150 lines of numpy and is summarised above. Scratch directory deleted after the run.
