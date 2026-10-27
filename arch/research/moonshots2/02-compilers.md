# Compile away repeated thinking: compiler theory applied to agents

Research date: **2026-10-27**. Lens: compiler theory applied to agents and models. Sources were checked on this date; dates attached to links identify the work or announcement, rather than an invented current measurement.

**Labels:** **F** = sourced fact, including explicitly identified repository evidence; **M** = measured in this investigation; **I** = inference, proposal or judgment; **E** = estimate, scenario or proposed acceptance threshold. Paper/vendor performance claims are **F**, not our measurements.

## The conclusion that survives better models

**I — The strongest direction is to turn recurring agent work into incrementally maintained programs.** Learn or synthesize the program once; execute ordinary TypeScript on changing inputs; propagate only relevant changes; invoke a model at an explicit unresolved decision or failed assumption. The 100–1000× destination is a continuously operating agent service whose marginal work is a small deterministic update, rather than a fresh reasoning session. A tracing JIT is a useful entrance to that product, and a model-free capsule is one possible output.

**I — “A JIT for agents” is already occupied.** This investigation found working predecessors from 2025 and several directly overlapping 2026 papers, including guarded replay and fallback. Compiling to TypeScript/native is an implementation choice, not sufficient differentiation. The potentially valuable work is the combination of reusable programs, explicit external-state dependencies, correct resumption across effects, measured amortization and deployment close to data. No cited source establishes that this combination is an unoccupied market.

**F — Required local context:** round one's [archaeology](../moonshots/01-archaeology.md), [biology](../moonshots/02-biology.md), [physics](../moonshots/03-physics.md), [economics](../moonshots/04-economics.md), [planet](../moonshots/05-planet.md), [self-growing systems](../moonshots/06-selfgrowing.md) and [next-model](../moonshots/07-nextmodel.md) reports favor occupied-software upgrades, repair, failure search, computation receipts, swarms, fault-grown Node and Oracle Foundry. Their top bets and TL;DRs were read. This report changes the demand thesis: even a perfect model need not repeatedly execute a program through inference.

**F — Existing assets, not new findings:** the [capsule landscape](../v8/02-landscape.md), dated 2026-10-27, identifies Vercel QuickJS-Wasm snapshots, LangChain checkpoints, XS, Golem and other close implementations. It distinguishes image restoration from history replay and external effect handling. [jitk](../../jitk/README.md) supplies a restricted tool-channel executor; [native](../../jitk/native/README.md) already uses scriptc 0.4.5 for TypeScript executables. **I:** reuse those components; a smaller capsule or native binary alone does not establish a compiler product.

## Why the problem can get worse

**F — Demand is growing faster than a static “tokens will get cheaper” argument captures.** Google's May 2026 keynote reports **over 3.2 quadrillion tokens/month**, compared with roughly 480 trillion at I/O 2025 and 9.7 trillion two years earlier. These are company-reported totals across its surfaces, not agent-only traffic, and token counts do not determine energy per task. [Google I/O 2026 keynote, May 2026](https://blog.google/innovation-and-ai/sundar-pichai-io-2026/).

**F — Physical supply matters independently of model accuracy.** The IEA's 2025 base case projects data-centre electricity consumption rising from **415 TWh in 2024 to about 945 TWh in 2030**; it reports roughly 12% annual growth since 2017. This is all data centres, not an inference-only forecast, and the 2030 figure is a projection. [IEA, Energy and AI, April 2025](https://www.iea.org/reports/energy-and-ai/executive-summary).

**F — Avoidable orchestration is real, but code execution already captures much of it.** Anthropic's example reduces tool-context use from **150,000 to 2,000 tokens**, a reported 98.7% reduction, by discovering tools and processing data in code. Cloudflare describes the same essential move: expose tools as a TypeScript API and let code carry intermediate values. These are examples, not population-wide savings or evidence for a new compiler. [Anthropic, November 2025](https://www.anthropic.com/engineering/code-execution-with-mcp), [Cloudflare Code Mode, 2025-09-26](https://blog.cloudflare.com/code-mode/).

**I — The growing bottlenecks are five different quantities:** repeated inference, serial dependency depth, bytes through the model/WAN, origin/API operations, and maintenance of an expanding population of generated programs. Removing inference does not necessarily reduce tool calls; parallelizing tools can increase origin load. Customers would pay from automation/cloud budgets, API quotas and operational latency budgets. Aggregate growth supports investigating these quantities; it does not establish what fraction is compilable or a market size.

**E — A deliberately ambitious workload model:** 1 million recurring jobs/day × 20 model turns/job = 20 million turns/day. At an assumed 0.5 seconds/turn, that is 10 million seconds/day of summed inference wait, before tool time. Removing 99% of turns gives a **100× reduction in that component**. If 10 million such services emerge, the aggregate opportunity grows even when each call becomes 100× cheaper. These are scenario inputs, not a forecast or energy calculation.

**I — The superhuman-model test has two independent axes.** A model 100× better at reasoning can synthesize more reusable software, increasing the compiled workload. A model 100× faster/cheaper lowers the savings and can erase the business for small jobs. If inference becomes effectively local, free and faster than dispatching a stored program, the inference-saving pitch loses. Incremental recomputation and data locality can still matter because they remove work and movement outside the model.

## What the Futamura analogy actually permits

**F — First projection:** specialize an interpreter with respect to a fixed source program and obtain a residual program for the remaining input. The second projection specializes the specializer with respect to the interpreter to obtain a compiler; the third yields a compiler generator through self-application. Those are statements about programs with semantics, not promises that observations determine a specification. [Futamura, 1971; revised paper December 1999, author's archive](https://fi.ftmr.info/), [Jones, Gomard and Sestoft, June 1993](https://raspi.itu.dk/people/sestoft/pebook/pebook.html).

~~~text
ordinary first projection:
    residual = specialize(interpreter, source_program)
    residual(input) ≡ interpreter(source_program, input)

agent harness:
    outcome = run(model, prompt, tools, input, external_observations)

honest staging:
    workflow = synthesize(prompt, typed_tools, examples, explicit_contract)
    residual = specialize(workflow_interpreter, workflow)
    residual(input, observations) contains zero OR MORE model_call nodes
~~~

**I — Fixing the tool set is not enough.** It fixes something like an instruction set, not the policy choosing instructions. Fixing model weights and a prompt also leaves inference dependent on new inputs and observations. A conventional partial evaluator can leave those calls in the residual program. It cannot generally replace a transformer over arbitrary future inputs with a short rule without additional structure. Token/KV/prefix caching and speculative decoding accelerate inference; they do not make the agent's decision procedure model-free.

**I — There are two honest routes.** First, make the task a staged DSL program with explicit dynamic/model nodes; interpreter specialization is then a genuine first-projection construction. Second, synthesize a new policy from instructions/traces, and establish a restricted validity domain. That route is inductive synthesis or distillation followed by compilation. Calling the entire process “the first Futamura projection of an LLM” hides the difficult semantic step.

**I — The useful contract is domain-specific behavior and effects.** For inputs in supported domain D and observations satisfying assumptions G, the residual program must satisfy task contract K, including allowed effects, errors and relevant ordering. Outside D or when G fails, it exits before the unsupported action. Matching one sampled LLM's exact wording is usually the wrong goal. Replacing an old model with a better one does not automatically revoke accepted business rules, and a changed business rule must invalidate the artifact even if every JSON shape stays the same.

## Compiler history: what to transfer and where it breaks

**F/I — The mechanisms below are sourced; the proposed transfers and historical-limit judgments are inferences.** Several did not stall: JITs, staged DSLs and incremental builds became infrastructure. The relevant question is why their generality or adoption was bounded.

| Lineage and dated primary source | Mechanism to transfer | Limit then; difference for agents now (**I**) |
| --- | --- | --- |
| **Partial evaluation**, Futamura 1971; [Jones/Gomard/Sestoft 1993](https://raspi.itu.dk/people/sestoft/pebook/preface.html) | Binding-time analysis: static task/tool definitions versus dynamic observations; residualize what cannot be evaluated now. | Useful specialization requires exposed structure; unrestricted specialization can diverge or explode code. Agents make each eliminated interpretation step unusually expensive, but opaque inference remains opaque. |
| **Supercompilation**, [Turchin, TOPLAS July 1986](https://doi.org/10.1145/5956.5957); [Keldysh research group's account](https://sites.google.com/site/keldyshscp/Home/supercompilerconcept) | Explore generalized computation histories, remove intermediates, fold recurring configurations into residual structure. | Generalization/termination and program growth are difficult. Agent traces expose tool boundaries, but observed histories omit unchosen branches. Use symbolic tool semantics, not wishful extrapolation from logs. |
| **Typed staging**, [MetaOCaml, maintainer tutorial](https://okmij.org/ftp/meta-programming/tutorial/index.html); [Rompf/Odersky, LMS, GPCE 2010](https://infoscience.epfl.ch/bitstreams/2849334f-3fc8-4d13-82d8-30e15ba67d8d/download) | Typed code generation, explicit stages, reusable staged libraries. | Generator construction takes effort; good types do not establish a task's meaning. Models can supply generators, while types/effects constrain their output. Keep expensive interpretation at generation time. |
| **Native trace optimization**, [Bala/Duesterwald/Banerjia, Dynamo, PLDI 2000](https://www.cse.iitm.ac.in/~krishna/courses/2022/odd-cs6013/BalaDusterwaldBanerjiaPLDI2000.pdf) | Select hot traces, link fragments, amortize runtime optimization. | Profiling/compilation must repay their own cost. A million one-off agent tasks are not a hot loop. Profile task families and reuse count before compiling. |
| **Tracing JITs**, [Gal et al., TraceMonkey, PLDI June 2009](https://www.cs.williams.edu/~freund/cs434-exemplar/gal-trace.pdf) | Specialize observed paths/types; guards and exits handle alternatives. | Branchy code creates trace proliferation. Mozilla documented complexity/fragility and the value of retaining interpretation in [March 2011](https://blog.mozilla.org/nnethercote/2011/03/24/the-javascript-interpreter-isnt-dead-yet/). Agents have semantic branch instability as well as type instability. |
| **Meta-tracing**, [Bolz et al., 2009 author explanation](https://pypy.org/posts/2009/03/applying-tracing-jit-to-interpreter-3287844903778799266.html) and [author thesis/artifacts](https://cfbolz.de/phdthesis/) | Trace through an interpreter with the right execution-position keys and hints, so dispatch disappears. | Tracing an interpreter's dispatch loop naively is ineffective. Similarly, tracing HTTP calls inside an inference client does not compile reasoning; record a typed agent/workflow machine and preserve unresolved inference. |
| **Feedback and deoptimization**, [SELF, PLDI June 1992](https://bibliography.selflanguage.org/_static/dynamic-deoptimization.pdf), [Hölzle thesis, August 1994](https://bibliography.selflanguage.org/_static/urs-thesis.pdf), [HotSpot architecture, historical whitepaper](https://www.oracle.com/java/technologies/whitepaper.html) | Profile hot code, speculate, reconstruct interpreter state at defined safepoints when assumptions fail. | Deoptimization needs state maps, not just an exception handler. For agents the state map includes observations and completed effects; external writes cannot be undone by reconstructing a stack. |
| **Superoptimization**, [Massalin, ASPLOS October 1987](https://web.stanford.edu/class/cs343/resources/superoptimizer.pdf), [STOKE, ASPLOS 2013 and artifact](https://github.com/StanfordPL/stoke), [Souper, 2017 preprint](https://arxiv.org/abs/1711.04422) | Search implementation space under a fixed specification and cost objective; use counterexamples/solvers where applicable. | Search scales poorly and needs semantics. Tool workflows are short enough to search but their effects are richer than arithmetic; optimize a bounded algebra before arbitrary APIs. |
| **Equality saturation**, [Willsey et al., egg, POPL January 2021](https://homes.cs.washington.edu/~cnandi/docs/popl21-cr.pdf) | Retain many equivalent forms in an e-graph; extract one under measured cost and domain analyses. | Rewrites must already be valid. Two prompts scoring similarly are not an equality. Side effects and freshness belong in the IR and rewrite preconditions. |
| **Synthesis from examples/demonstrations**, [Gulwani, POPL January 2011](https://www.microsoft.com/en-us/research/publication/automating-string-processing-spreadsheets-using-input-output-examples/) | Restricted DSL, multiple candidate programs, distinguish ambiguous examples. | Examples underdetermine intent; full execution traces add bindings and branches, not universal semantics. Ask for discriminating observations or retain residual model decisions. |
| **Abstract interpretation**, [Cousot/Cousot, POPL 1977](https://cs.nyu.edu/~pcousot/COUSOTpapers/POPL77.shtml) | Compute conservative facts about ranges, effects and reachable states by approximation. | Soundness depends on a sound semantics and abstraction. An LLM's claimed precondition is not one; model unknown tool behavior as unknown and sacrifice optimization. |
| **Algorithm/schedule separation**, [Ragan-Kelley et al., Halide, SIGGRAPH July 2012](https://people.csail.mit.edu/jrk/halide12/) | Separate required computation from parallelization, placement, fusion and materialization. | Halide's structured domain enabled legal schedules. Agents need explicit dependencies and effect order; a learned latency model cannot declare those away. |
| **Multi-level IR**, [Lattner et al., MLIR, 2020 preprint / CGO 2021](https://research.google/pubs/mlir-scaling-compiler-infrastructure-for-domain-specific-computation/) | Preserve high-level semantics until the lowering that needs them; extensible operations and progressive lowering. | Interoperability requires compatible semantics, not just common syntax. Preserve task/effect meaning before lowering to TS, Wasm or native; implementing MLIR itself is unnecessary for a first proof. |
| **Incremental computation/compilation**, [Acar/Blelloch/Harper, POPL January 2002](https://www.cs.cmu.edu/~rwh/papers/afp/popl02.pdf), [Mokhov/Mitchell/Peyton Jones, ICFP September 2018](https://www.microsoft.com/en-us/research/publication/build-systems-la-carte/) | Dependency tracking, change propagation and rebuild only what is dirty. | Hidden dependencies and mutable external state defeat reuse. Typed tool wrappers can expose versions, snapshots and invalidation feeds; unsupported connectors must fall back to polling/recomputation. |

**F — Access limitation:** Turchin's original publisher endpoint did not load through the research tool. Its bibliographic identity and mechanism are corroborated by the linked Keldysh research group, rather than a claimed fresh reading of the inaccessible full text. MetaOCaml's tutorial and HotSpot's historical whitepaper are living/undated pages; no fabricated publication day is assigned to them.

## Prior art that removes the easy novelty claims

| Work and date (**F**) | What is already there | Consequence for this proposal (**I**) |
| --- | --- | --- |
| [WebRobot, PLDI June 2022](https://web.eecs.umich.edu/~xwangsd/pubs/pldi22.pdf) | Synthesizes web RPA programs, including nested loops, from action demonstrations using speculative rewriting and validation; evaluated on 76 benchmarks. | Turning short action traces into reusable loops predates LLM agents. Trace induction should beat this lineage as well as current skill systems. |
| [Code as Policies, 2022-09-16](https://arxiv.org/abs/2209.07753) | LLM-written Python policies compose perception/control APIs and ordinary control flow, including feedback loops. | “Prompt to executable policy” predates the proposed product. Domain support and reuse must be the contribution. |
| [DSPy, 2023-10-05](https://arxiv.org/abs/2310.03714) | Optimizes declarative LM pipelines through demonstrations/prompting and related module parameters. | Its “compile” does not imply model-free residual code. Distinguish optimization of inference from elimination of inference. |
| [LLMCompiler, 2023-12-07](https://arxiv.org/abs/2312.04511) | Planner, task fetching and parallel executor for dependency-aware function calling. | DAG generation and parallel function scheduling are occupied. |
| [Agent Workflow Memory, 2024-09-11](https://arxiv.org/abs/2409.07429) | Induces recurring workflows and supplies them to guide agent generations. | Procedural memory is prior art; executable reuse should be compared with textual memory, not conflated with it. |
| [Muscle-Mem, open-sourced 2025-05-08; current source](https://github.com/pig-dot-dev/muscle-mem) | Records and replays agent tool patterns with fallback, pre/post Checks, and top-level argument parameterization. | Even guarded behavior reuse is not new. Its source actually has Checks; do not repeat another paper's characterization of it as wholly blind replay. |
| [Cloudflare Code Mode, 2025-09-26](https://blog.cloudflare.com/code-mode/) and [current docs, updated 2026-06-24](https://developers.cloudflare.com/agents/tools/codemode/) | Typed tool methods, code-based loops/branches/transforms, progressive tool discovery. | The strongest practical baseline is one code-mode plan, then saved source, not a gratuitous model turn per API. |
| [Agentic Compilation, submitted 2026-04-08, revised 2026-04-25](https://arxiv.org/abs/2604.09718) | One-shot translation of sanitized web structure into a deterministic JSON workflow blueprint. | One-shot web compilation is an existing research direction. |
| [Agent JIT Compilation, submitted 2026-05-20, revised 2026-05-29](https://arxiv.org/abs/2605.21470); [author project](https://agent-jit-compilation.github.io/) | Generates/validates/ranks programs, retains optional LLM calls, separates planning/scheduling, uses pre/postconditions. Authors report 10.4× planner and 2.4× scheduler speedups on selected comparisons. The project describes 37 selected tasks, not full benchmark coverage, and offline synthesis/profiling costs. | Direct overlap with prompt-to-program, guarded tools and Halide-like scheduling. Browser-to-tool lifting and measured deployment are not open conceptual territory. |
| [PreAct, 2026-06-16](https://arxiv.org/abs/2606.17929); [source](https://github.com/19PINE-AI/PreAct) | Compiles successful runs into executable state machines, checks state before actions, falls back to the agent, verifies before storing. Reported repeat-run acceleration is 8.5–13× on its setup. | The central tracing-JIT demo has already been shown. Compare against this, including its record/replay baseline, rather than claim first guarded agent compilation. |
| [SKILL-DISCO, 2026-06-25](https://arxiv.org/abs/2606.26669) | Distills parameterized control-flow subgraphs from successful traces into executable skills in FSM-defined scenarios; evaluates ALFWorld/WebArena. | Trace-to-reusable-control-flow induction is occupied. |
| [TraceCompiler, 2026-08-03](https://arxiv.org/html/2608.02680v1) | Mines bindings/provenance from noisy traces; can refuse underdetermined effects. Reports 34→11 tool calls for one intent and 15/21 state tests across three held-out folds. Crucially, execution used a hand-transcribed skeleton and hand-written residual parsing; the authors explicitly lack a general IR runtime and do not measure offline compilation cost. | Closest trace-analysis competitor, with narrow evidence rather than a deployed universal compiler. The opportunity is a stronger executable system/evaluation, not a new slogan. |
| [A-JIT, 2026-09-09](https://arxiv.org/abs/2609.10248) | Technical report proposes runtime observation and agent-driven construction/evolution of application logic and tool interfaces. | Continuous trace-driven software evolution is also an explicit prior proposal. |
| [FlyMy.AI research, inspected 2026-10-27](https://flymy.ai/Research/) | Vendor reports 346 compiled programs, 1,729 compiled runs, median 5→3 model calls in a paired sample, and 18 tier-2 programs executing code directly. It says tier 2 currently lacks guards. These are self-reports, not independently reproduced results. | There are commercial actors explicitly using the agent-interpreter/Futamura framing. Their presence is demand evidence to investigate, not validation of savings or a patentable gap. |

**I — Honest novelty claim:** a runtime that performs *effect-aware incremental maintenance of reusable agent programs* across TS/Wasm/native targets may be worth building. “Compile prompts,” “compile traces,” “use guards,” “save skills,” “separate schedules” and “run without an LLM” individually are established. The table is a bounded primary-source search, not proof that nobody has already assembled the whole system.

## A concrete machine, rather than a compiler metaphor

**I — First intermediate representation:** a small typed graph with operations for pure computation, versioned reads, residual model decisions, guarded branches, bounded loops, writes and suspension. Every value records its producer; every read records its version/freshness contract; every write consumes an effect-order token. Initially JSON plus a TypeScript interpreter is sufficient. Preserve these fields when lowering to TS; scriptc can then compile supported TS to native. Browser/Workers deployment uses JS or an appropriate Wasm interpreter; a macOS native executable is not a Worker artifact.

**I — Trace recording is not sufficient dependence discovery.** Instrument binding construction where possible: a tool argument is derived from a particular result field, request input or literal. Equal strings in a log can come from different sources. An unused read can still establish permission, freshness or ordering. Remove it only when its semantic role is accounted for. New free-form requests need either an inference-based front end, explicit structured intent, or an already supported parser; routing itself can consume the savings.

**I — Deoptimization record:** artifact/tool-schema/contract versions; logical program counter; live values and their provenance; observations with freshness; completed and unresolved effect IDs; remaining budgets; and an explicit unsupported-condition reason. In a model-backed fallback, supply the recorded context and forbid replaying completed effects. In a model-free artifact, stop with a typed unsupported result. A schema mismatch is a mechanical guard; “this is semantically the same request” often is not.

**I — Commit semantics:** guard read assumptions again at the remote write using conditional versions or transactions where the API supports them. Use a stable logical idempotency key and a receipt/status lookup when available. A timeout after dispatch is an unknown outcome, requiring reconciliation; it is not an ordinary JIT exit that can safely rerun from entry. A Durable Object can serialize its own ledger, but cannot make an arbitrary remote API exactly-once. Forked capsules get no duplicated credentials or spending grants.

**I — Capsules are optional implementation machinery.** State maps plus source/event replay are simpler for a small graph. A compatible QuickJS/Wasm image can help when a continuation carries expensive heap state. Keep the external effect ledger outside the cloned image and bind runtime identity in an envelope. Compare image restore with explicit graph state; the existing capsule landscape prevents presenting snapshotting as the novelty.

**E — Compilation economics, in one consistent cost unit:**

~~~text
K = interpreter model turns/job
D = expected residual/fallback model turns/job
c = cost/turn
g = added routing + guards + tracing + artifact maintenance cost/job
C = one-time synthesis + qualification + compilation cost
T = unchanged tool/data work/job

baseline/job = T + K*c
compiled/job = T + D*c + g + C/N

break-even requires (K-D)*c > g
and N > C / ((K-D)*c - g).
~~~

**I — Consequences:** count compilation failures and qualification, not only winners. Report cold/warm cost, matched task completion, p50/p95/p99, requests/bytes and external effects. A 100× drop in inference can be a 1.05× end-to-end improvement when tools dominate. Deoptimization on 1% of jobs can put full-model latency into the p99. If the model writes the whole correct TS workflow once and saved-source execution already wins, our compiler must add automatic maintenance, change propagation or distribution to earn its existence.

## Local experiment: the guarded path removes decisions, not the need for a specification

**M — Environment and scope:** Darwin arm64, Node **24.22.1**, existing repository scriptc **0.4.5**. Scratch only: /tmp/moonshot2-compilers/. The TypeScript probe below ran as source and as a native executable with byte-identical result JSON. The native executable is **300,016 bytes**, including this entire harness; this is not a capsule-size or runtime-speed comparison.

**M — Workload:** 1,000 unique invoice jobs, with varied invoice IDs/amounts/versions. The baseline has four decision sites: select invoice read, account read, charge/review, final output. **The interpreter policy is a deterministic model stand-in; zero real model requests were made.** The fast path was hand-written from the known policy and the successful trace, not learned by a compiler. Schema/currency/amount-cap guards are supplied manually. There is no training/held-out-learning claim.

**M — Constructed mix:** 800 supported payments; 100 inactive-account cases that exit after both reads; 50 review-mode cases that exit at entry; 50 conditional-write conflicts that exit after the failed charge attempt. Late exits resume at their current logical PC. All four cohorts are deliberately specified, not sampled from production.

| Measurement (**M**) | Four-decision interpreter | Guarded path + fallback | Same path without policy guards |
| --- | ---: | ---: | ---: |
| Simulated model-decision invocations | 4,000 | **450** | 50 |
| Tool reads | 2,000 | 2,000 | 2,000 |
| Charge attempts | 850 | 850 | 1,000 |
| Committed charges | 800 | 800 | 950 |
| Exit events | 0 | 200 | 50 |
| Jobs differing from baseline in result or complete tool trace | 0 | **0** | **150** |

**M — Accounting:** entry exits cost 50×4 = 200 decisions; account exits cost 100×2 = 200; write-conflict exits cost 50×1 = 50. Thus **3,550/4,000 = 88.75%** of simulated decision invocations disappear, an **8.89× ratio in decision counts**. Tool traces include IDs, cents, versions and operation keys. They match the baseline exactly for every guarded run, so this probe does not obtain savings by skipping required external work. The unguarded path commits 150 forbidden payments.

**I — What it decides:** guarded, mid-run resumption is mechanically straightforward in a typed state machine, including an exit after a rejected write without rereading the prefix. Parameterized code can handle fresh IDs and amounts; it need not cache answers. scriptc can execute this particular TS subset without Node. **It does not establish** automatically inferred guards, useful coverage on real agents, measured inference savings, model-quality preservation, crash recovery, receipt loss after a successful remote effect, or a speed advantage from native compilation.

**E — Latency illustration only:** assuming each decision would wait 250 ms, 3,550 avoided calls remove 887.5 seconds of summed wait across the corpus. At 100× faster inference, that becomes 8.875 seconds. Compilation and guards must be subtracted, and all tool wait remains. The experiment deliberately records no wall-clock “LLM speedup.”

**I — Strong baselines change the conclusion.** A one-plan-per-job model uses 1,000 calls before retries, versus this probe's 450 counted decision sites; a saved, manually written workflow uses zero. The probe's fourth call merely formats a simple answer and is gratuitous. This is a mechanism test and an argument for measuring against code-mode/saved-program baselines, not evidence that a new tracing compiler beats them.

## Eight bets

### 1. A tracing JIT that calls the model only on a side exit

**I — One sentence / 100× version:** record recurring typed agent paths, specialize data handling and control flow to TS, and call the model only when an explicit assumption fails; at scale, remove **99–99.9% of inference turns** on stable supported task families while leaving novel work interpreted.

**F/E — Worsening problem and payer:** token volume is growing rapidly, while published agent-JIT results already demonstrate meaningful orchestration overhead in selected tasks; see Google and Agent JIT sources above. In the million-job, 20-turn scenario, 99% elimination removes 19.8 million turns/day. A SaaS automation vendor pays for lower inference bills and latency. This estimate requires hot repeat families, not unique research requests.

**I — Mechanism, lineage and limit:** Dynamo/TraceMonkey/SELF supply profiling, specialization, guards and state maps; PyPy supplies the warning to trace the relevant interpreter. A TS tool wrapper emits dataflow, not just log strings. Compile frequently reused graph segments; keep novel recipient resolution or judgment as explicit residual calls. Historically, branch explosion and compilation overhead restricted tracing. Expensive model turns improve amortization now, but semantic guards are harder than type guards. Muscle-Mem and PreAct already implement much of the loop.

**I — 100× better-model test:** matters more if improved agents perform vastly more recurring work; disappears as a standalone advantage if better agents reliably write reusable code themselves and their ordinary runtime already handles changes. Operational reuse and effect handling must earn the product.

**E — ~2030 shape:** automation providers execute 100 million daily task instances from perhaps 100,000 qualified families; Workers dispatch/version them, DOs own effect state, R2 holds artifacts/profiles, and Node/scriptc serve local deployments. Only the uncovered tail reaches inference. These quantities are a target design point.

**E — First proof, 1–2 weeks:** three structured API workflows, at least 100 untouched variants each, real pinned model, deterministic evaluator and 20 injected drift/failure cases. Compare ReAct, Code Mode, saved TS, Muscle-Mem/PreAct where applicable. Count synthesis/qualification and require ≥10× fewer inference tokens **and ≥2× lower total cost** at matched completion. Reconcile one injected unknown write outcome.

**I — Demo + draft tweet:** run a familiar job, change a schema, resume at the failed assumption, then run the repaired branch. “This agent's second run is ordinary TypeScript. A changed tool response exits to the model with the completed work intact. Here are cost, completion and exit rates against saved-code and replay baselines.”

**E — Kill:** <80% useful repeat traffic can avoid per-step inference, savings vanish against saved TS after maintenance, or a side exit duplicates a write. A same-family microbenchmark is insufficient.

### 2. A forge for model-free agent capsules

**I — One sentence / 100× version:** compile an explicitly bounded task into a deployable program plus its state/contracts, with no model endpoint or key; one expensive reasoning session manufactures a capability usable a billion times, including offline.

**F/E — Worsening problem and payer:** Google/IEA quantify growing compute demand, while the local probe confirms native execution is possible for one restricted TS policy. A software/industrial/browser vendor pays to ship a function with stable latency, offline availability and no marginal inference dependency. One compilation amortized across 1 million invocations moves generation cost off the execution path; it does not remove API/data costs.

**I — Mechanism, lineage and limit:** MetaOCaml/LMS staging and the genuine first projection apply after the task becomes a typed DSL program. “Prompt → program” is synthesis at the front. Require no residual model nodes, bounded loops, an input domain and explicit unsupported outputs. Package generated TS, tool bindings, contract versions and optionally a compatible interpreter image. A model-free program may still need network tools. Do not confuse scriptc native compilation with browser/Wasm portability. Code as Policies and ordinary generated applications already occupy the broad idea.

**I — 100× better-model test:** stronger models make more tasks compilable, enlarging this distribution channel. But a better coding agent that directly emits a correct deployable package is the strongest competitor; the forge needs valuable packaging, updates or deployment support.

**E — ~2030 shape:** device/browser vendors distribute millions of specialized capabilities; most execute without inference, while a connected build service produces new versions. Model-free artifacts reject unsupported work rather than silently regain cloud inference.

**E — First proof, 1–2 weeks:** compile one structured reconciliation rule into JS for a browser/Worker, Node TS and scriptc native. Disconnect inference entirely; run 1,000 fresh valid inputs and 100 out-of-domain inputs. Compare explicit JSON state against a QuickJS/Wasm capsule after suspension. Require identical task/effect behavior, useful offline operation and no hidden inference requests.

**I — Demo + draft tweet:** turn off the model connection and run the downloaded capability. “The model built this capability once. This file now runs the supported task without a model, and returns ‘unsupported’ outside its contract. Browser and native results match; network tools remain explicit.”

**E — Kill:** model-free coverage requires so much domain-specific hand coding that a conventional SDK is cheaper, or a plain JS bundle + JSON state matches the capsule's value. Keep the program, drop the capsule product.

### 3. A superoptimizer for agent workflows

**I — One sentence / 100× version:** search equivalent tool/dataflow programs for the lowest measured inference, API, byte and latency cost; at scale, continuously reduce a fleet's execution bill after every model/tool release.

**F/E — Worsening problem and payer:** Anthropic's 150k→2k example demonstrates that moving dataflow out of inference can change token use by almost two orders of magnitude in a specific case. In a separate scenario, 10 million workflows × 100 per-record reads = 1 billion reads; replacing them with a lawful server-side aggregate could approach a 100× request reduction. Enterprises/API providers pay from demonstrated saved operations and infrastructure cost, not a generic “smarter plan” score.

**I — Mechanism, lineage and limit:** Massalin/STOKE/Souper motivate bounded program search; egg represents equivalent forms. Start with an algebra of pure transforms and snapshot reads: map/filter fusion, projection pushdown, shared reads at one version, batch APIs and permitted aggregation. Search also over materialization and approved local code. Keep effectful operations ordered; rate-limit counters, authorization checks, errors and freshness are observable semantics. Two LLM outputs with similar scores are not equal. Historical search-space/specification limits remain.

**I — 100× better-model test:** a perfect optimizer would commoditize candidate generation; the product survives only if cost measurements, tool semantics and repeated deployment remain valuable. A finite workload can reach its optimum, so do not promise perpetual improvement.

**E — ~2030 shape:** a provider runs offline optimization over 10,000 high-volume workflows, deploys versioned winners and re-evaluates when contracts/cost distributions change. Customers buy lower bills under their existing task contract.

**E — First proof, 1–2 weeks:** ten pure/read-only workflows over a versioned fixture API; enumerate a small rewrite grammar and verify outputs/errors across hidden cases. Measure requests, bytes and cost including search. Compare hand-optimized Code Mode. Seek ≥10× external-operation reduction on at least two naturally batchable tasks; publish the tasks where no rewrite helps.

**I — Demo + draft tweet:** replace 100 live reads with one snapshot aggregate, showing the contract and unchanged result. “We superoptimized this workflow's tool traffic, not its prompt. Same snapshot/result contract, fewer calls and bytes. Unsupported rewrites are excluded; search cost is included.”

**E — Kill:** savings disappear against an engineer asking the current model for an optimized TS implementation, or accepted rewrites alter freshness/errors/effects. Retain a useful optimizer pass rather than an optimization platform.

### 4. Halide for agents: separate the task from its execution schedule

**I — One sentence / 100× version:** express the task once and compile where/when it runs—browser, Worker near data, Node or native—so thousands of dependent operations happen locally instead of across the WAN.

**F/E — Worsening problem and payer:** Halide established the separation; Agent JIT Compilation already separates planning and scheduling. The remaining target here is physical data placement. **E:** 1,000 dependent 50-ms WAN interactions cost a 50-second serial floor; one transfer to an authorized owner-side computation plus 1,000 assumed 0.1-ms local operations is roughly 150 ms, about 333× for that constructed component. This requires owner-side access; arbitrary SaaS APIs do not become local memory. Data/platform owners pay to reduce origin load, data export and completion time.

**I — Mechanism, lineage and limit:** preserve algorithm/effect dependencies, then choose placement, fusion, batching, parallelism and checkpoint frequency from measured profiles. Halide succeeded in a structured domain; distributed agent tools have more complex consistency. Deploy code to explicit cooperating hosts, with brokered grants and bounded return values. Cloudflare's placement tools and conventional query pushdown are mandatory baselines; this is not arbitrary Durable Object migration.

**I — 100× better-model test:** still matters when models plan perfectly because latency and bytes obey physical constraints. If the improved model simply chooses the same owner-side API itself, value shifts to supplying that API/runtime.

**E — ~2030 shape:** an analytics/integration platform runs compiled fragments across hundreds of data-owning Worker/Node endpoints. The central model sees small typed summaries; raw customer datasets remain at participating owners.

**E — First proof, 1–2 weeks:** two controlled regional endpoints and three dataflow tasks; compare remote per-record calls, ordinary batch/query APIs, a fixed placement and compiler-selected placement. Require ≥10× measured WAN bytes or boundary crossings and a real latency win after cold-start/transfer cost. Do not claim global placement from localhost timings.

**I — Demo + draft tweet:** keep the answer constant while switching the schedule from 1,000 remote interactions to one owner-side computation. “Same task, different schedule: computation moves to the data. These are measured boundary crossings and end-to-end times, including deployment. It works only at participating hosts.”

**E — Kill:** batching/SQL pushdown plus existing placement matches the benefit, or customers will not host the fragment. This becomes an adapter for existing runtimes, not a new planetary computer.

### 5. Incremental agents: maintain the answer instead of rethinking the world

**I — One sentence / 100× version:** compile a recurring agent task into a dependency graph that reacts to changed facts and recomputes only the affected slice; millions of “always on agents” become sparse, ordinary dataflow updates.

**F/E — Worsening problem and payer:** incremental computation and build systems already formalize this reuse; growing token demand creates incentive to apply it beyond compilers. **E:** a continuously refreshed report over 10,000 independently versioned records, with 10 changed per update, has an ideal 1,000× reduction in per-record processing. That bound vanishes if one change invalidates a global judgment. Operations/analytics/integration teams pay for fresh answers at lower inference/API load, especially when naive agents poll entire sources.

**I — Mechanism, lineage and limit:** stage the task, record complete dynamic dependencies, use webhook/change feeds or versioned snapshots, memoize pure subgraphs, and invalidate transitive consumers. Content digests alone do not establish freshness; record the version read, collection membership, deletions, permission changes and negative queries. Nondeterministic model nodes remain explicit and versioned; reuse is valid only under the chosen task semantics. Old data must not retain revoked authority. Historical hidden-dependency/cache-invalidation problems are the main engineering work, not solved by smarter models.

**I — 100× better-model test:** matters more as agents monitor more changing environments. Even perfect reasoning need not rescan a million unchanged records. A superhuman model can generate this infrastructure, so differentiation is connector semantics, reliable change capture and operational ownership, not secret prompting.

**E — ~2030 shape:** business platforms run 1 million continuous task graphs over 10 billion tracked facts; a change stream wakes a small affected subgraph, often without inference. Workers execute pure slices, DOs track graph/effect epochs, R2 stores versions and cold artifacts. Most tasks are dormant between relevant changes.

**E — First proof, 1–2 weeks:** one continuous inventory/reconciliation report, three versioned fixture tools, 10,000 records and 100 change batches. Generate the initial graph from a real agent/Code Mode task; inject inserts/deletes, membership and authorization changes. Compare full agent reruns, saved TS full reruns and an ordinary hand-incremental implementation. Require ≥100× fewer processed records and ≥10× lower total cost on sparse updates, exact answers, and no stale result over the adversarial corpus. Include graph setup and subscription cost.

**I — Demo + draft tweet:** update one input and illuminate only the recomputed nodes; delete a previously absent/present item to expose a false cache hit. “An always-on agent shouldn't reread 10,000 unchanged records. This task became a dependency graph: changes update the affected slice. Here are costs against full reruns and a hand-written incremental service.”

**E — Kill:** connectors cannot provide reliable invalidation without comparable full scans; global semantic changes dirty nearly everything; or the generated graph loses to ordinary incremental code after maintenance. Correctly falling back to a full rerun is preferable to pretending incremental coverage.

### 6. Compile agents into a bounded execution budget

**I — One sentence / 100× version:** compile supported tasks into programs with enforceable upper bounds on inference calls, tool attempts, output bytes and local work, allowing a large agent fleet to be admitted and scheduled like an ordinary service.

**F/E — Worsening problem and payer:** abstract interpretation supplies conservative static bounds when semantics permit them; demand growth increases the cost of multiplying an unbounded per-task budget. **E:** 1 million event jobs with an accidental 1,000-iteration tool loop can generate 1 billion attempts. Statically refusing such a loop or enforcing a 10-call contract bounds this scenario to 10 million, a 100× exposure reduction. This is a constructed capacity argument, not a failure-rate estimate. API/platform operators pay for predictable service admission and quotas.

**I — Mechanism, lineage and limit:** a restricted TS/IR subset with ranked loops and conservative effect/count analysis, plus runtime meters at the broker. Unknown loops/tool behavior yield unknown static cost; finite resource caps terminate them. Separate limits on local CPU/instruction work, model tokens and remote attempts. No static analysis proves the latency of a remote service; deadlines bound our wait/dispatch policy, not the remote effect's completion. Abstract interpretation did not fail historically; applicability depends on restrictions acceptable to users.

**I — 100× better-model test:** semantic mistakes could disappear and resource allocation would remain. But if all generated programs are already bounded cheaply, this is a runtime feature. Do not sell it chiefly as protection from bad model judgment.

**E — ~2030 shape:** an event platform admits 100 million compiled invocations/day under typed resource contracts, rejecting or parking over-budget work before it overloads an origin. Local metering keeps aggregate demand governable.

**E — First proof, 1–2 weeks:** analyze ten bounded TS workflows and three deliberately unbounded variants; compare predicted and actual tool/loop counts over 1,000 inputs. Run a Worker broker enforcing the same limits. Require conservative bounds for the supported subset, explicit unknowns elsewhere and no bypass through retries/fallback.

**I — Demo + draft tweet:** submit a workflow with a data-dependent runaway loop and show the compiler request a bound; run a bounded version at fixed capacity. “This compiled task comes with enforceable call/byte budgets. Unknown static bounds are reported as unknown. Remote latency and external exactly-once are separate contracts.”

**E — Kill:** restrictions exclude paying workloads, metering alone supplies equivalent operational value, or analyses add no advantage over a simple workflow DSL. Keep the meter; abandon the compiler product.

### 7. A supercompiler that turns experience into algorithms

**I — One sentence / 100× version:** infer parameterized loops and branches from multiple execution traces, then synthesize a compact algorithm that handles new sizes and combinations without replaying the model's original exploration.

**F/E — Worsening problem and payer:** AWM, SKILL-DISCO and TraceCompiler establish reuse research, and also underdetermination/limited support. **E:** a 1,000-record task originally requiring one model decision per record can become one generated loop and zero per-record inference, a 1,000× reduction in that component. Automation vendors pay for fewer bespoke integrations when task families differ in list length, pagination and schema variants.

**I — Mechanism, lineage and limit:** Turchin-style unfold/generalize/fold plus synthesis over a bounded trace language. Recover explicit data bindings; use multiple traces and counterexample-producing simulator probes to distinguish “repeat until empty” from “exactly three iterations.” Do not deduce the loop condition from one length-three run. Unknown predicates remain model nodes or cause refusal. This is more ambitious than #1's guarded hot path and directly overlaps SKILL-DISCO; the proposed difference must be demonstrated generalization over new cardinalities/tool compositions.

**I — 100× better-model test:** stronger models may infer the algorithm from the task prompt without any traces, eliminating the value of this stage. Domain traces retain value only when they contain proprietary environmental behavior absent from the prompt.

**E — ~2030 shape:** integration providers accumulate libraries of tens of thousands of parameterized procedures generated from consenting tenants' traces, with per-tenant data/authority bindings and separate supported domains. Not a global cache of private IDs or credentials.

**E — First proof, 1–2 weeks:** three simulator task families, training traces of sizes 1–5 and hidden sizes 0, 17 and 100, plus an unseen branch. Compare trace synthesis, a strong prompt-only coding model and SKILL-DISCO-like parameterized skill reuse. Require correct unseen-size behavior and lower total inference after synthesis.

**I — Demo + draft tweet:** train on short lists and run an untouched 100-item list with zero model decisions inside the loop. “These traces became a loop, not a replay of five clicks. New sizes pass; an unobserved policy branch stays unresolved. We compare with asking the model to write the loop directly.”

**E — Kill:** direct prompt-to-code performs as well with less work, or guard failures dominate new inputs. Keep trace-guided debugging; do not claim traces are a specification.

### 8. A multi-level intermediate representation for agent programs

**I — One sentence / 100× version:** preserve task, dependency, effect and cost semantics in a portable IR that progressively lowers into different runtimes, so one reusable agent procedure can be optimized and deployed across frameworks without rebuilding its meaning.

**F/E — Worsening problem and payer:** MLIR addresses fragmentation across compiler levels; agent frameworks/tool interfaces are likewise heterogeneous, but this research found no reliable primary measure of their churn rate. **E:** 1,000 workflows × 10 connectors × 10 deployment/model configurations yields 100,000 qualification relationships. Shared semantic interfaces could remove repeated work, though this arithmetic is not evidence that the real matrix factorizes. Infrastructure vendors pay for maintained adapters and operational compatibility, not for an abstract JSON format.

**I — Mechanism, lineage and limit:** begin with an “intent/model” level, an “effectful workflow” level and an “executable code” level. Preserve residual inference, guards, versioned reads, authority scopes and resumable state through lowering. Use dialect-like extensions for tools and explicit refusal for unsupported semantics. MLIR itself is a large C++ dependency; imitate its architecture in a small TS IR first. The historical adoption barrier is agreement and integration, not a shortage of syntax.

**I — 100× better-model test:** more generated software magnifies interoperability demand, but better models also translate adapters cheaply. The durable value must be executable conformance and a deployed ecosystem. Standardization can commoditize the compiler vendor.

**E — ~2030 shape:** several workflow/agent vendors exchange typed artifacts and profiles; browser/edge/native backends consume the same qualified operations. Such adoption is a conditional institutional goal, not a technical inevitability.

**E — First proof, 1–2 weeks:** represent five workflows from two existing harnesses, lower into a TS interpreter and scriptc-supported source, and force a schema/contract mismatch. Require identical effects and useful diagnostic/refusal without vendor-specific hidden state. No broad “agent MLIR” implementation.

**I — Demo + draft tweet:** export one procedure, run it under two hosts, then show an unsupported effect rejected rather than silently weakened. “One typed workflow, two executors, preserved effect and resumption semantics. This is a five-workflow compatibility experiment, not a universal agent standard.”

**E — Kill:** no second independent consumer needs the format, translation by ordinary source code suffices, or extension escape hatches erase guarantees. Keep it internal until a real interoperability requirement appears.

## What to build, and what not to count as a win

**I — One coherent prototype can test the leaders:** instrument three typed tools; obtain one recurrent task; construct a minimal graph with residual model nodes; lower supported slices to TS; persist explicit graph state; propagate versioned changes; and add native compilation as an optional target. Start with source + JSON state. Add a QuickJS/Wasm capsule only when preserving a heap beats reconstructing it.

**E — A two-week schedule:** days 1–2 freeze task/output/effect contracts and hidden cases; days 3–5 implement binding/dependency capture and a graph executor; days 6–8 generate/specialize one graph and compare Code Mode/saved TS; days 9–10 add sparse-change invalidation and an unknown-effect fault; days 11–14 evaluate cold/warm, with all synthesis and failed candidates charged. Do not simultaneously build an e-graph optimizer, new language, distributed scheduler and standards consortium.

**I — Measure six quantities separately:** completed tasks; inference calls/tokens; external reads/writes/bytes; critical-path latency including exits; total cost including builds/qualification/maintenance; and stale/wrong/duplicated effects. A lower token count with more API traffic may be a cost transfer. A model-free artifact whose task support shrank is a product tradeoff, not an automatic speedup.

**E — Use stronger-model controls:** rerun with the strongest available model and also an idealized correct policy for the chosen fixture domain. Give both the ability to write/save ordinary TS. Separately price inference at 1/100 of its measured cost. If the advantage survives only against a weak per-step loop, the compiler thesis failed. If sparse updates and local execution still win against correct saved programs, there is a systems product beyond model correction.

## Reproducible local probe

**M — Source SHA-256:** ef96563306f383f7bf7eb4ac64b466d15de6fc01d2d1fc4d7191752a0a825f44. The complete source follows so the evidence does not depend on retention of /tmp. Save it as /tmp/moonshot2-compilers/probe.ts, then run from the repository root:

~~~sh
node /tmp/moonshot2-compilers/probe.ts
arch/jitk/tools/node_modules/.bin/scriptc build /tmp/moonshot2-compilers/probe.ts -o /tmp/moonshot2-compilers/probe-native
/tmp/moonshot2-compilers/probe-native
~~~

**F — Prerequisite:** the native command uses the already installed, pinned compiler under arch/jitk/tools; this investigation installed no dependencies. A clean environment must provision that compiler separately.

~~~ts
// Mechanical decision-count probe: the interpreter policy is a deterministic model stand-in.
type Request = { id: number; mode: string; op: string };
type Invoice = { schema: number; currency: string; cents: number; version: number };
type Account = { active: boolean; cap: number };
type Reply = { ok: boolean };
type State = { pc: number; invoice: Invoice; account: Account; reply: Reply; answer: string };
type Meter = { decisions: number; reads: number; writes: number; commits: number; exits: number };
function meter(): Meter { return {decisions:0, reads:0, writes:0, commits:0, exits:0}; }
function state(): State { return {pc:0, invoice:{schema:0,currency:'',cents:0,version:0}, account:{active:false,cap:0}, reply:{ok:false}, answer:''}; }
function check(ok: boolean): void { if (!ok) throw new Error('assertion failed'); }
function request(i: number): Request { return {id:i, mode:i>=900 && i<950?'review':'auto', op:'op-'+i}; }
function eligible(r: Request,s: State): boolean {
  return r.mode==='auto' && s.invoice.schema===1 && s.invoice.currency==='USD'
    && s.invoice.cents>0 && s.account.active && s.invoice.cents<=s.account.cap;
}
class World {
  m: Meter; keys: string[] = []; trace: string[] = [];
  constructor(m: Meter) { this.m=m; }
  invoice(r: Request): Invoice {
    this.m.reads++; this.trace.push('invoice:'+r.id);
    return {schema:1,currency:'USD',cents:100+r.id,version:r.id+1};
  }
  account(r: Request): Account {
    this.m.reads++; this.trace.push('account:'+r.id);
    return {active:!(r.id>=800 && r.id<900), cap:2000};
  }
  charge(r: Request,s: State): Reply {
    this.m.writes++; this.trace.push('charge:'+r.id+':'+s.invoice.cents+':'+s.invoice.version+':'+r.op);
    // The endpoint models version conflicts; it does not enforce the autopay policy.
    if (r.id>=950) return {ok:false};
    if (!this.keys.includes(r.op)) { this.keys.push(r.op); this.m.commits++; }
    return {ok:true};
  }
}
function interpret(r: Request,s: State,w: World): string {
  while(s.pc<4) {
    w.m.decisions++; // A real ReAct harness would call its model here.
    if(s.pc===0) s.invoice=w.invoice(r);
    else if(s.pc===1) s.account=w.account(r);
    else if(s.pc===2) { if(eligible(r,s)) s.reply=w.charge(r,s); }
    else s.answer=s.reply.ok?'paid':'review';
    s.pc++;
  }
  return s.answer;
}
function exit(r: Request,s: State,w: World): string { w.m.exits++; return interpret(r,s,w); }
function compiled(r: Request,w: World,guards: boolean): string {
  let s=state();
  if(guards && r.mode!=='auto') return exit(r,s,w);
  s.invoice=w.invoice(r); s.pc=1;
  s.account=w.account(r); s.pc=2;
  if(guards && !eligible(r,s)) return exit(r,s,w);
  s.reply=w.charge(r,s); s.pc=3;
  if(!s.reply.ok) return exit(r,s,w);
  return 'paid';
}
const base=meter(), fast=meter(), blind=meter();
let wrongFast=0,wrongBlind=0; let trainingTrace: string[]=[];
for(let i=0;i<1000;i++) {
  const r=request(i), wb=new World(base), wf=new World(fast), wu=new World(blind);
  const b=interpret(r,state(),wb), f=compiled(r,wf,true), u=compiled(r,wu,false);
  if(i===0) trainingTrace=wb.trace;
  if(f!==b || JSON.stringify(wf.trace)!==JSON.stringify(wb.trace)) wrongFast++;
  if(u!==b || JSON.stringify(wu.trace)!==JSON.stringify(wb.trace)) wrongBlind++;
  check(wf.keys.length<=1);
}
check(wrongFast===0); check(wrongBlind===150);
check(base.decisions===4000 && fast.decisions===450);
check(base.reads===fast.reads && base.writes===fast.writes && base.commits===fast.commits);
console.log(JSON.stringify({trainingTrace,base,guarded:fast,unguarded:blind,wrongFast,wrongBlind,
  eliminated:base.decisions-fast.decisions,removedPercent:100*(base.decisions-fast.decisions)/base.decisions,
  callRatio:base.decisions/fast.decisions}));
~~~

## Ranking all eight

**I — Ranking prioritizes a worsening physical/operational problem, survival against a much better model, differentiation from the primary prior art, a credible buyer and a decisive two-week experiment.** It is an ordinal judgment, not a market forecast.

| Rank | Bet | Why it ranks here | Biggest objection |
| --- | --- | --- | --- |
| **1** | **#5 Incremental agents** | Removes repeated world-reading/recomputation even when the plan is perfect; useful recurring service and clear sparse-update test. | Change feeds and complete dependencies may be unavailable; conventional incremental software is formidable. |
| **2** | **#1 Guarded tracing JIT** | Direct entry from today's agent traces into useful executable artifacts; local mechanism works. | Very occupied by Muscle-Mem, PreAct and related work; saved TS already captures much of the value. |
| **3** | **#2 Model-free capsules** | Compile-once distribution and offline operation survive inference-provider churn; combines the existing substrate with an inspectable artifact. | Often just a generated application; heap capsules may add nothing over JS + state. |
| 4 | #4 Algorithm/schedule separation | Data movement and serial WAN latency survive superhuman planning. | Existing batch/query/placement APIs and Agent JIT Compilation overlap heavily. |
| 5 | #3 Workflow superoptimizer | Real external-operation savings are valuable; costs can be measured. | Needs trusted semantics; optimization opportunities saturate and strong code generation competes. |
| 6 | #7 Trace-to-algorithm supercompiler | Largest leap from repeated experience to reusable software. | Underidentified branches; direct prompt-to-code and SKILL-DISCO are strong alternatives. |
| 7 | #6 Bounded execution budgets | Capacity and quotas remain necessary with perfect models. | More naturally a runtime feature than a company. |
| 8 | #8 Multi-level agent IR | Enables the other bets and can reduce adapter repetition. | Standardization without consumers is infrastructure looking for demand. |

## Ranked top three

**1 — #5, incremental agents. I:** the core ambition is a different economic unit: continuously maintained useful work rather than repeated conversations. A 10,000-record task updated after 10 relevant changes has room for a 1,000× reduction in per-record work without making any claim about a model's mistakes. New models help manufacture more such services; physical change propagation still has to run. The crucial buyer question is whether a customer has a real recurring task with trustworthy change feeds. The crucial technical comparison is a conventional incremental implementation, not a weak agent loop.

**2 — #1, guarded tracing JIT. I:** the best acquisition path for #5 is to observe existing work and make useful parts executable. It yields a visible artifact quickly and the local experiment establishes the small state-machine mechanism, including late exits. However, the research invalidates “first agent JIT” as a story: guards, replay, state machines and code generation already exist. Pursue only if automatic bindings, effect-aware resumption, incremental invalidation and measured end-to-end savings beat those alternatives.

**3 — #2, model-free capsules. I:** use this as the strongest deployment test of the compiler: disconnect inference and execute the supported task. It gives a durable capability rather than a new prompt dependency and can run where inference cannot. The capsule is justified only for valuable occupied state, not because a downloadable image is impressive. A plain bundle with explicit state is the benchmark it must defeat.

## The ONE bet

**I — Build an agent runtime that turns one recurring task into an incrementally maintained program.** Use tracing/staging to manufacture the first graph, ordinary TypeScript for its execution, explicit versions and dependencies for updates, and model calls only at unresolved decisions or unsupported changes. A model-free artifact is a successful end state for a supported task; scriptc is an optional native backend. Sell “the answer stays fresh while execution work collapses,” backed by a real trace and bill, rather than “our model needs less supervision.”

**E — Day-14 decision:** continue only if the same task/output/effect contract is preserved on the untouched drift/change corpus, sparse updates process ≥100× fewer records, and total execution plus amortized compilation/maintenance cost falls ≥10× against full saved-TS reruns. Also disclose the gap to hand-incremental code. If generated incremental execution cannot approach that conventional baseline with substantially less setup, keep the useful adapter and stop the platform claim. Any undisclosed stale answer or duplicated effect invalidates the demonstration.

**I — Why this is not eaten merely by a better model:** the improved model is welcome to write the program correctly on the first try. The product's remaining work is to execute it, feed it the right changes, place it near data, preserve its dependencies and evolve it over time. That is a systems obligation created by more deployed computation. If models and existing platforms already deliver it cheaply, the independent product disappears; no compiler analogy supplies a moat.

## Five-line TL;DR

1. **I:** Treat expensive recurring reasoning as candidate source for reusable programs; fixed prompts/tools alone do not make a genuine model-eliminating Futamura projection.
2. **F/I:** Muscle-Mem, PreAct, Agent JIT Compilation, SKILL-DISCO and TraceCompiler already occupy the easy “agent JIT” claim; demand differentiation in executable maintenance.
3. **M:** A hand-written guarded TS path removed 88.75% of simulated decision invocations with identical tool traces; Node and scriptc native matched, while removing policy guards caused 150 wrong payments.
4. **I:** Ranked top three: incremental agents, guarded tracing, model-free capsules; compare every one with strong Code Mode, saved-source and conventional-system baselines.
5. **I/E:** Bet on one continuously maintained task whose sparse updates remove 100–1000× repeated work; kill it if reliable invalidation or net savings do not survive better models and ordinary incremental code.
