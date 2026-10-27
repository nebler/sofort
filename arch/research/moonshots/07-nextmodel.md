# What survives the next model

Research date: **2026-10-27**. Lens: strategy, contrarian and adjacent concepts. Scope: nine proposals built around capsules, with a TypeScript / Cloudflare / Wasm first experiment. This report is the only repository edit; no experiments, deployments, purchases, contacts or commits were made.

**Evidence labels:** **F** = sourced fact, including an explicitly attributed vendor claim; **M-prior** = measurement in the supplied local research, not rerun here; **I** = inference, proposal or judgment; **E** = estimate, proposed threshold or forecast. There are **no new measurements**. Web sources were inspected on 2026-10-27; dates below are publication/event dates unless described otherwise. All demo scripts and tweets describe proposed experiments, not completed results.

## Strategic conclusion

**I — Accept the builder's 2–5× excitement haircut as a design stress test, not an empirical law.** A product whose value is “the model cannot do this yet” has an expiry mechanism. A product whose value is “the model can now do much more, so somebody must measure, coordinate and take responsibility for it” has a better direction of travel. The strongest opportunity is an **independent acceptance boundary for machine work**, with capsules carrying experiments, failures and counterfactuals across it.

**I — Persistence itself does not pass this test.** Neither does “an OS for agents.” Model vendors and clouds can bundle runtimes, memories, approvals and execution histories. The scarce asset must be a trusted reference, fresh outcome data, a calibrated environment, permission to affect a real system, or a workflow people already depend on. Capsules are a useful transport and experimental unit; they are not the moat.

**I — My bet: an Oracle Foundry, initially for one narrowly specified class of generated software.** It turns a claimed improvement into an independently replayable acceptance experiment, maintains evaluator quality, and accumulates minimized counterexamples. Its 100× destination is an acceptance network for autonomous work. Start with compatibility against an existing reference, where correctness is less subjective than “is this a good answer?” GrowOS gives this builder relevant experience and unusually concrete failure cases.

## 1. What actually got eaten in 2024–2026

**I — “Eaten” needs a precise meaning.** The evidence below establishes absorption or cheapening of a capability. It does **not** establish that every company providing it failed, or that a model release alone caused a business outcome. Base-model improvement, API bundling and incumbent distribution are different mechanisms; all three can erase a solo builder's differentiation.

### Wrappers: a feature can disappear into the default interface

**F — 2024-10-31:** OpenAI launched ChatGPT search, with timely web answers and source links; the announcement records expansion to all logged-in users on December 16 and broader availability on February 5, 2025. **I:** “chat UI + search call + summary” lost much of its separateness. A source-specific research workflow, proprietary index or established audience could still matter; generic access to search no longer distinguished the wrapper. [OpenAI announcement](https://openai.com/index/introducing-chatgpt-search/).

**F — 2025-03-11:** OpenAI's Responses API incorporated web search, file search and computer use, alongside an Agents SDK and tracing. **I:** a product charging mainly to stitch those calls together now competed with its supplier's API. The relevant unit of erosion is the integration subfeature, not a claim that Perplexity, research products or automation businesses ceased to exist. [New tools for building agents](https://openai.com/index/new-tools-for-building-agents/).

### Prompt tooling: compensating for model weaknesses is especially exposed

**F — 2024-08-06:** Structured Outputs brought schema-constrained output to OpenAI's API. **I:** prompt recipes, parser retries and repair chains whose principal job was JSON-schema compliance became less valuable for supported schemas. This absorbed part of the job addressed by libraries such as Outlines and Guardrails; it did not replace their entire scope, cross-provider support or semantic validation. A valid purchase order can still specify the wrong quantity. [Structured Outputs launch](https://openai.com/index/introducing-structured-outputs-in-the-api/).

**F — 2024-11-14:** Anthropic launched a console prompt improver that used Claude to rewrite prompts and standardize examples. **I:** a standalone prompt-polishing service faced both a vendor feature and the ability to ask the model to perform much of the task directly. Domain evaluation data, release regression tracking and negotiated requirements survive better than a library of supposedly magic wording. This is a dated launch example, not a claim about that console feature's current availability. [Anthropic announcement](https://www.anthropic.com/news/prompt-improver).

### RAG plumbing: fewer reasons to own chunking, more reasons to own knowledge

**F — 2024-02:** Google's Gemini 1.5 Pro preview exposed an experimental million-token context window. **F — 2025-03-11:** the Responses release supplied hosted file search. **I:** small-corpus “upload PDF, embed chunks, retrieve, answer” assemblies faced both long-context substitution and hosted retrieval. Neither removes freshness, permission filtering, acquisition rights, evidence quality or retrieval at large scale. [Google's Gemini 1.5 preview](https://developers.googleblog.com/en/gemini-15-our-next-generation-model-now-available-for-private-preview-in-google-ai-studio/), [hosted tools announcement](https://openai.com/index/new-tools-for-building-agents/).

**F — 2024-09-19:** Anthropic published Contextual Retrieval, explicitly addressing retrieval failures rather than announcing retrieval's demise. **I:** “RAG is dead” is the wrong conclusion. Generic plumbing gets cheaper while authoritative, permission-aware context can become more useful as agents take consequential actions. A private corpus becomes a moat only if access is durable and its outcomes improve the product; merely storing embeddings does not create one. [Contextual Retrieval](https://www.anthropic.com/research/contextual-retrieval).

**F — 2026-03-13:** Anthropic moved the million-token context window for Claude Opus 4.6 and Sonnet 4.6 out of beta at standard pricing. **I:** a capability that was an exceptional preview in 2024 had become a more ordinary model interface by 2026. This further weakens small-context workarounds without establishing that every large-context query is economical or accurate. [Dated release notes](https://platform.claude.com/docs/en/release-notes/overview).

### Agent frameworks: the generic loop is cheap; operational semantics remain hard

**F — 2024-12-19:** Anthropic recommended simple, composable agent patterns and cautioned about framework abstraction. The article is now amended with newer tooling references, so its current framework list should not be read as a frozen 2024 inventory. **F — 2025-03-11:** OpenAI shipped its own Agents SDK. **I:** generic plan/act/observe loops, routing and handoff abstractions became easier to reproduce or source from vendors. [Building effective agents](https://www.anthropic.com/research/building-effective-agents), [Agents SDK launch](https://openai.com/index/new-tools-for-building-agents/).

**F — Counterexample, 2025-10-22:** LangChain and LangGraph reached 1.0, distinguishing a standard agent loop from a lower-level runtime for controlled, long-running agents. **I:** frameworks did not universally die; their durable execution, integrations, ecosystem and operational tooling must be assessed separately from loop syntax. [LangChain/LangGraph 1.0](https://www.langchain.com/blog/langchain-langgraph-1dot0).

**F — 2026-04-08:** Claude Managed Agents entered beta with a hosted harness, sandboxing, tools and sessions; on **2026-09-10**, its permission policies gained server-evaluated run/deny/pause-for-approval behavior. **I:** “a place for your agent to live” and generic approval middleware are already targets for bundling. Independence, portable records and customer-owned authority could distinguish a product; durability alone cannot. [Dated Claude Platform release notes](https://platform.claude.com/docs/en/release-notes/overview).

### Coding assistants: old interaction forms were eroded, but the category grew

**I:** stronger coding models weaken autocomplete-only differentiation and hand-maintained prompt choreography. They also make a well-integrated coding product more capable. Calling the whole category “eaten” confuses a displaced feature with an expanding market.

**F — 2025-02-24:** Anthropic released Claude 3.7 Sonnet alongside the limited research preview of Claude Code, a terminal tool for delegating engineering tasks. **I:** this is a concrete mechanism for erosion: the model supplier moved into the agent interface as its coding capability improved. It is not evidence that all independent coding assistants lost value. [Claude 3.7 Sonnet and Claude Code](https://www.anthropic.com/news/claude-3-7-sonnet).

**F — Vendor-reported counterexample:** Cursor reported recurring revenue above $100 million on **2025-01-16**, and ARR above $500 million on **2025-06-06**. OpenAI reported more than five million weekly Codex users on **2026-06-02**. These are dated company statements, not audited revenue, profit measurements or current October user counts. **I:** distribution, editor/workflow integration, product quality and accumulated usage can survive model improvements even when the underlying capability is available elsewhere. None is easily reproduced by an unknown solo builder. [Cursor Series B](https://cursor.com/blog/series-b), [Cursor Series C](https://www.cursor.com/blog/series-c), [OpenAI's June usage report](https://openai.com/index/codex-for-knowledge-work/).

## 2. What became more valuable—and what the evidence does not prove

1. **Compute and execution substrates.** **F — 2025-07-28:** E2B announced its Series A and reported hundreds of millions of sandbox starts. **F — 2026-03-24:** Cloudflare opened Dynamic Workers beta for on-demand sandboxed code. **I:** agents create demand for execution, but increased aggregate demand does not guarantee margins for a new sandbox vendor. These launches and usage claims support the complement thesis, not a causal estimate of demand per model improvement. [E2B announcement](https://e2b.dev/resources/series-a), [Cloudflare changelog](https://developers.cloudflare.com/changelog/post/2026-03-24-dynamic-workers-open-beta/).

2. **Verification and oracles.** **F — 2024-07-25:** AlphaProof combined generation/search with Lean verification. **F — 2025-05-14:** AlphaEvolve combined language models, automated evaluators and evolutionary search; DeepMind reported a deployed heuristic recovering an average 0.7% of its worldwide compute resources. **I:** capable generators increase the usefulness of a credible evaluator. These examples concern domains with checkable objectives; they do not prove that arbitrary business work has an inexpensive oracle. [AlphaProof](https://deepmind.google/blog/ai-solves-imo-problems-at-silver-medal-level/), [AlphaEvolve](https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/).

3. **Fresh evaluation and feedback loops.** **F — 2024-08-13:** OpenAI introduced human-validated SWE-bench Verified. **F — 2026-02-23:** it stopped reporting that benchmark, citing contamination and flawed tests, recommending SWE-bench Pro instead. Its 59.4% flawed-task finding applies to an audited, difficult **138-task subset**, not all 500 tasks. **I:** static public tests depreciate. Rights to fresh failures, independent references and a process that tests the evaluator itself are more durable than one leaderboard. [Verified introduction](https://openai.com/index/introducing-swe-bench-verified/), [2026 reassessment](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/).

4. **Trust, provenance and delegated authority.** **F — 2025-05-15:** W3C published Verifiable Credentials Data Model 2.0. **F — 2025-09-29:** Stripe and OpenAI launched the Agentic Commerce Protocol with ChatGPT checkout. **I:** stronger models can negotiate and transact more, but cannot grant themselves a customer's authority or make a historical observation true. Signatures establish attribution/integrity under a trust model; they do not establish truth or good judgment. [W3C Recommendation](https://www.w3.org/TR/2025/REC-vc-data-model-2.0-20250515/), [Stripe announcement](https://stripe.com/newsroom/news/stripe-openai-instant-checkout).

5. **Distribution and rights to source material.** **F — 2025-07-01:** Cloudflare launched Pay Per Crawl in private beta, giving publishers a mechanism to charge crawlers. **I:** access relationships and control of an existing distribution point become strategic when generating substitutes becomes cheap. This is evidence of a new control mechanism, not evidence that publishers received meaningful revenue or that a solo builder can recreate Cloudflare's reach. [Launch changelog](https://developers.cloudflare.com/changelog/post/2025-07-01-pay-per-crawl/).

6. **Physical-world hooks.** **F — 2025-03-12:** Gemini Robotics introduced models with physical actions as an output modality. **I:** improved reasoning can expand the set of useful experiments and actions; it cannot replace a particular sensor reading, calibration, inventory item or access to a machine. The scarce complement is the measurement/action interface and its outcome history, not merely another robot chatbot. [Gemini Robotics announcement](https://deepmind.google/blog/gemini-robotics-brings-ai-into-the-physical-world/).

**I — Important objection:** stronger models also improve verification, simulator construction and infrastructure implementation. Those categories are not magically protected. The defensible object is the **independent relationship to reality**—the test owner, actual system, data rights, calibrated apparatus or accountable principal—not the code implementing a checker.

## 3. Infinite cheap labour is a resource-allocation problem

**F — Lineage:** Jevons argued in *The Coal Question* (**1865**, linked text is the **1866** second edition, chapter VII) that greater fuel efficiency could expand consumption through cheaper uses. **I:** the AI analogy is conditional: cheaper useful attempts can unlock workloads whose aggregate execution and verification costs grow. It does not imply infinite compute demand, free inference or a profitable business for every infrastructure provider. [Jevons's original text](https://www.econlib.org/library/YPDBooks/Jevons/jvnCQ.html?chapter_num=9).

**I — The economic unit should be accepted work, not generated tokens or spawned agents.** A useful accounting model is:

`cost per accepted outcome = (generation + execution + verification + human adjudication + failure/recovery cost) / accepted outcomes`

**I:** as generation becomes cheaper, verification, environment access and adjudication can dominate. With a fixed positive false-accept probability, increasing the number of attempts increases opportunities to pass incorrectly; adaptive search against the same tests makes independence assumptions especially dangerous. Spend part of the abundance on fresh tests and adversarial experiments. Do not spend all of it on more candidates against a stale score.

**I — Three questions for every proposal:** Does another model release increase the quantity or quality of useful work passing through it? What accumulates that a competitor cannot regenerate from public information? Why does it need an execution capsule rather than a transcript, database row or ordinary durable workflow? Failure of the third question can invalidate the capsule investment even if the product idea remains good.

## 4. Shared implementation and evaluation constraints

**F/M-prior — Starting position:** the required [landscape](../v8/02-landscape.md), [roadblocks](../v8/03-roadblocks.md), [signal](../v8/06-signal.md), [Wasm spike](../portability/02-wasm.md), [demo sections 0/9/10](../../../demo.md) and [GrowOS controller](../../jitk/grow/README.md) were read. Whole-heap QuickJS/Wasm snapshots are prior art. The local spike demonstrates a quiescent pending-tool continuation across Node, Chromium and local workerd; it does not demonstrate production edge service or native-jitk-to-Wasm image conversion. More realistic local snapshots reached roughly 1.5–6.4 MB compressed, and guest glue ran 5–11× slower than direct V8 in the roadblock workloads. Memory accounting and termination need hardening.

**I — Common experimental architecture:** bounded QuickJS/Wasm orchestration; host-side model calls and secrets; a fixed interpreter artifact; R2 for content-addressed inputs/checkpoints; Durable Objects for one branch/effect authority ledger; Queues for bounded work; Workflows where ordinary durable orchestration is enough. Native tools or Python scientific work belong in a separately bounded Node/Container backend, with explicit input/output manifests. Do not force bulk computation through the interpreted guest.

**I — Forking computation is not forking the outside world.** Every speculative child starts without write authority. A selected branch presents intended effects, expected remote versions and fresh permission to a broker. It may commit only after revalidation. External APIs must support appropriate idempotency/reconciliation; uncertain completion remains uncertain. Discarding a fork cannot undo a sent message, charge or motor movement. Production databases, browser DOMs, native processes and model weights are not magically inside the capsule.

**E — Common two-week proof discipline:** reuse existing snapshot machinery; spend the first days establishing bounded execution and the narrow host ABI. Compare capsule restore with **event-log replay plus ordinary application checkpoints**, using equal inputs and resource budgets. Measure cold and warm end-to-end latency, CPU, model spend, total artifact bytes, false accepts, false rejects and recovery behavior. Keep selected test data outside the candidate's authority; seal it before attempts and rotate it after exposure. Public replay examples use retired fixtures; active held-out checks remain separate. A private test is not automatically correct, and repeated sanitized feedback can still leak it.

**I — Every first proof below is a proposed acceptance experiment, not a delivery promise.** A small sample can decide whether to continue; it cannot establish production reliability or market demand. Each proposal includes a buyer hypothesis that still requires validation.

## 5. Nine ideas

### 1. Oracle Foundry: acceptance infrastructure for machine work

**Idea / 100× version — I:** Package a task, an independently owned reference and its acceptance procedure as an executable experiment; let any model compete to satisfy it. The 100× version is a network where autonomous workers deliver **checkable outcomes**, and acceptance owners are accountable for the quality of their specifications and evidence.

**Lineage — F:** Necula's **January 1997** proof-carrying code separated an untrusted producer from a host that checks a safety proof against a specified policy. AlphaProof (**2024**) and AlphaEvolve (**2025**) demonstrate related generation/evaluation separation in different domains. [PCC paper](https://doi.org/10.1145/263699.263712), [AlphaProof](https://deepmind.google/blog/ai-solves-imo-problems-at-silver-medal-level/), [AlphaEvolve](https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/). **I — Lesson/stall:** cheap checking depends on an adequate specification and tractable proof/reference; those conditions are expensive to create. Most software tasks lack them. Strong models can help propose specifications and tests, while a narrow tool ABI and independent checker prevent the proposer from redefining success. Tests are evidence, not formal proofs.

**Why stronger models help — I:** better workers generate more plausible candidates and harder counterexamples. Better models can also help improve evaluators, but promotion requires independently checked evidence. If the entire oracle is an LLM judging another LLM's explanation, the premise collapses. The asset is a trusted reference and fresh counterexample history, not the model loop.

**Value / defensibility — I:** compatibility-library maintainers, tool vendors and teams accepting generated parsers/adapters could depend on it for release acceptance and reproducible disputes. Start with one small reference-backed contract, such as a bounded SQLite query/API subset or a pure data-format function. GrowOS's external Linux oracle, held-out probes and mutant grading are directly relevant. Build a customer-owned archive of semantic edge cases; do not claim general Linux conformance.

**First proof, 1–2 weeks — E:** a TS host runs 20 bounded implementation attempts over three small contracts, against reference outputs, a sealed test set and independently designed wrong implementations. Record every attempt and publish complete denominators. Pass the research gate if the oracle rejects all seeded semantic mutants, accepts the known-good reference, and finds at least one visible-test-passing wrong candidate through independent checks. Repeat grading from an exported capsule on a second host. Compare with a source-plus-event-log package; capsule restore must save meaningful reconstruction work to justify engine investment.

**Demo + hook — I:** 60 seconds: a candidate passes its visible tests; the independent oracle finds a counterexample; fork at that input; inspect the two results; replay the verdict from a downloaded artifact. Draft tweet: “AI made the patch. A separate oracle found the case its tests missed. This experiment exports the candidate, inputs, reference and failure as a replayable capsule. The checker has tests too.”

**Kill test — E:** at equal total evaluation and human-adjudication budget, the new procedure fails to reduce wrong acceptances on untouched candidates relative to the project's existing independent CI checks, while holding false rejections no higher. That kills the initial domain/product wedge; merely wrapping its existing tests is insufficient.

**Scores — E:** stronger models **5/5**; solo defensibility **4/5**; X/HN signal **4/5**; first proof ≤2 weeks **5/5**. Reference-backed scope and counterexamples offer a plausible solo advantage; a generic “AI evaluator marketplace” does not.

### 2. Future Browser: choose among executable futures before acting

**Idea / 100× version — I:** Present proposed actions as branches of a running workflow, each with its assumptions and observable consequences. The 100× version makes speculative, forked reality a primary UI: users compare executable futures and authorize a revalidated plan rather than reading a confident paragraph about what might happen.

**Lineage — F:** Jefferson's **July 1985** *Virtual Time* used optimistic execution, rollback and antimessages in distributed simulation. [Original paper](https://doi.org/10.1145/3916.3988). Existing interpreter branching and time-travel systems are documented in the [local landscape](../v8/02-landscape.md). **I — Lesson/stall:** speculation works when state and communication are modeled; rollback does not retract arbitrary real-world effects. Previous speculative interfaces also faced expensive world models and limited coverage. Agents can construct more adapters and proposals; edge/Wasm can make small branchable workflows interactive. Neither solves world-model fidelity.

**Why stronger models help — I:** stronger models propose more useful alternatives and explain assumptions better. The output becomes a branch with checks and a limited commit protocol. Branching ten copies of the same mistaken premise does not create independent evidence; show variation in assumptions, not just answers.

**Value / defensibility — I:** operators changing account settings, subscription policies or deployment configurations could pay to inspect consequences before approval. Start with one API workflow whose state can be copied and whose final change can be version-checked. The scarce asset is the tested adapter and effect contract. A generic branching chat UI is easy to copy, and platform vendors can add it.

**First proof, 1–2 weeks — E:** a TS/DO service maintains a clearly labeled synthetic subscription account with credits, invoices and cancellation rules. Pause a real orchestration program before a write; fork into three policy alternatives; run each against an isolated state copy; display ledger differences. Change the authoritative account after the forks and show the selected stale plan being rejected. Freshly revalidate and execute one change through the broker. Export one continuation to browser/Node. Compare with replay from the original request; reuse must save work without hiding stale reads.

**Demo + hook — I:** 45–75 seconds: “cancel / downgrade / credit” futures appear side by side; one incurs a fee, one violates a rule; a concurrent account update invalidates the chosen branch; revalidation produces one committed effect. Draft tweet: “Before this agent changes an account, I can try three futures. Each runs from the same checkpoint against a labeled simulation. Selecting a branch still checks the real account again. Copying a computer does not copy permission.”

**Kill test — E:** two branches that satisfy the modeled conditions produce materially different real outcomes because an essential API state cannot be observed or version-checked. Demote that workflow to advisory simulation; do not market it as a commit preview.

**Scores — E:** stronger models **5/5**; solo defensibility **3/5**; X/HN signal **5/5**; first proof ≤2 weeks **4/5**. Excellent visible capsule use; adapter maintenance and incumbent imitation constrain the business.

### 3. Capsule Lab: executable notebooks for AI scientists

**Idea / 100× version — I:** Make the unit of an AI experiment a resumable, inspectable capsule containing its procedure, pinned inputs, observations and acceptance contract. The 100× version is a scientific literature of living experiments: another scientist can resume, challenge or fork a result without reconstructing a hidden notebook session.

**Lineage — F:** Pimentel and colleagues' **MSR 2019** study examined 1.4 million Jupyter notebooks and investigated practices affecting reproducibility. AlphaEvolve (**2025**) supplies a modern example of iterative proposal and automated evaluation. [Original study](https://2019.msrconf.org/details/msr-2019-papers/36/A-Large-scale-Study-about-Quality-and-Reproducibility-of-Jupyter-Notebooks), [AlphaEvolve results and verification notebooks](https://github.com/google-deepmind/alphaevolve_results). **I — Lesson/stall:** a readable notebook does not ensure execution-order, dependency or data reproducibility. Capturing RAM alone also fails: it can preserve undocumented state and tie the experiment to an obsolete engine. What changes is cheap creation of experiments plus a deliberately small, exportable execution boundary.

**Why stronger models help — I:** stronger scientific agents produce more hypotheses, longer procedures and more artifacts to audit. A model upgrade can continue a parked experiment with a new proposer while retaining earlier observations. Deterministic replay uses recorded model/tool responses; new inference is a labeled new branch, not reproduction of the old inference.

**Value / defensibility — I:** small computational research teams and algorithm engineers could depend on portable experiment handoff, review and regression evidence. Begin with bounded computational research, not clinical claims or arbitrary GPU state. An eventual moat is an interoperable archive and review workflow, with data permissions; proprietary snapshot encoding would undermine the adoption thesis.

**First proof, 1–2 weeks — E:** run a TS agent optimizing a scheduling heuristic against a pinned simulator. The capsule contains orchestration state, code/input hashes, model request metadata, tool journal and metrics; larger artifacts stay in R2 by hash. Pause before evaluation, destroy the owner, resume on another host and reproduce deterministic metrics from recorded inputs. Fork with a different proposal/model and compare on a sealed workload. Include a rerun-from-source baseline and a standard notebook-style manifest; show whether preserving the intermediate procedure actually avoids reconstruction. No assertion of globally reproducible floating-point/GPU execution.

**Demo + hook — I:** 60 seconds: open a result; resume inside the experiment; swap a hypothesis; reveal that the apparent improvement fails held-out workloads; send the full experiment to a second machine. Draft tweet: “An AI scientist's lab notebook should be executable. This prototype resumes a pinned scheduling experiment, forks its hypothesis and reproduces the original metrics from recorded inputs. New model calls make new branches; they do not rewrite the old result.”

**Kill test — E:** in the handoff experiment, capsule recipients cannot reproduce and fork results more reliably or with less reconstruction effort than recipients of pinned source, data and an ordinary event log, after engine/dependency packaging is counted. That kills the capsule-specific research artifact thesis for this workload.

**Scores — E:** stronger models **5/5**; solo defensibility **3/5**; X/HN signal **5/5**; first proof ≤2 weeks **4/5**. Strong technical/cultural hook; willingness to change research workflows is uncertain, and existing notebook/workflow ecosystems are serious substitutes.

### 4. Failure Seed Bank: preserve mistakes until better models can repair them

**Idea / 100× version — I:** Freeze minimized agent failures as executable challenges, then revive them whenever a model, tool or policy changes. The 100× version is a distributed memory of operational mistakes: new capabilities are qualified against old failures and fresh adversarial variants before receiving authority.

**Lineage — F:** deterministic fault simulation is central to the **2021 FoundationDB paper**. Lennon and Jones's **2011** work describes microbial dormancy and seed banks; Mouret and Clune's **2015 MAP-Elites** preserves diverse high-quality solutions rather than only a single winner. [FoundationDB paper](https://www.foundationdb.org/files/fdb-paper.pdf), [dormancy paper](https://www.nature.com/articles/nrmicro2504), [MAP-Elites](https://arxiv.org/abs/1504.04909). **I — Lesson/stall:** regression tests preserve known failures, but production states are expensive to reconstruct; optimizing only an aggregate score also loses rare behaviors. The ecological analogy is a design inspiration, not a biological claim about agents. Capsules can preserve the difficult prefix, and stronger models can search for related failures.

**Why stronger models help — I:** every upgrade supplies both a possible repairer and a stronger challenger. The archive becomes more useful if it includes new private incidents and fresh mutations. A public frozen failure collection eventually becomes training material; replaying it forever is not a defensible benchmark.

**Value / defensibility — I:** maintainers of agent integrations could pay for release qualification on their own failure history. The accumulated asset is customer-authorized incident state, minimized witnesses and measured regression coverage. Keep confidential capsules tenant-scoped; derive shareable abstractions only where rights permit. This is a likely extension of Oracle Foundry, not a reason to launch a second platform immediately.

**First proof, 1–2 weeks — E:** create 12 small, explicitly synthetic failures covering stale reads, duplicate tool replies, timeout uncertainty and bad transformations. A TS reducer minimizes inputs while preserving an independent invariant violation. Store capsules in R2 and indexes in a DO. Run two model versions or two pinned harness versions against all cases with equal budgets; score fresh held-out variants separately. Restore a failure directly at the problematic decision, and compare with full-prefix replay. Record failures that cannot be reduced rather than silently excluding them.

**Demo + hook — I:** 45 seconds: a wall of dormant incidents; a model upgrade wakes them; several turn green; one old case regresses; click it and replay the exact boundary. Draft tweet: “The next model gets a better memory of our failures. These are executable incident capsules, not screenshots. An upgrade must fix the old cases and pass fresh variants before this harness promotes it.”

**Kill test — E:** improvement on the stored bank fails to predict improvement on untouched variants or newly collected failures. That result makes it a useful regression archive, but kills the stronger claim of transferable reliability learning.

**Scores — E:** stronger models **5/5**; solo defensibility **4/5**; X/HN signal **4/5**; first proof ≤2 weeks **4/5**. The valuable dataset requires real users and data rights; synthetic examples alone have little moat.

### 5. Internet Wind Tunnel: a branchable test world for agents

**Idea / 100× version — I:** Build a small executable web where agents encounter realistic APIs, changing state, conflicting actors and failures, with checkable outcomes. The 100× version is a federated, permissioned digital twin of consequential parts of the internet where plans can be rehearsed and robustness can be tested before deployment.

**Lineage — F:** **WebArena, July 25, 2023**, provided self-hosted websites and realistic agent tasks. **TheAgentCompany, December 18, 2024**, built a self-contained workplace with internal websites, data and coworkers. FoundationDB's **2021** paper demonstrates the value of systematically simulated faults. [WebArena paper](https://arxiv.org/abs/2307.13854), [TheAgentCompany](https://arxiv.org/abs/2412.14161), [FoundationDB](https://www.foundationdb.org/files/fdb-paper.pdf). **I — Lesson/stall:** these establish strong prior art for executable worlds. Static tasks become familiar, environments drift, and reproducing a website does not reproduce user incentives or external services. Agents can help produce more scenarios, while capsule/edge execution can lower the cost of distributing them; fidelity still requires calibration against real traces.

**Why stronger models help — I:** stronger agents need harder, stateful environments, not more trivia. Stronger adversaries can generate disturbances and interacting behaviors. An LLM-generated world scored by that same model is circular; outcomes should depend on explicit application state and independently maintained invariants.

**Value / defensibility — I:** browser-agent teams and API operators could depend on a repeatable qualification world. Start with one ecosystem, such as subscription commerce, and collect opt-in conformance traces from its real API. The asset is validated semantics and continuously refreshed scenarios. A generic internet simulator would compete with benchmark teams and well-funded simulation vendors.

**First proof, 1–2 weeks — E:** implement three linked TS services—catalog, account and checkout—with a lightweight browser UI and DO-backed authoritative state. Include out-of-stock races, expiring authorization and duplicate replies. Capsule the agent; separately version/export each service state, event queue and pending-call ledger. Demonstrate one complete-world checkpoint and fork with two event orderings. Reconcile each simulated response with a small reference trace set. Keep the initial deployment private/local; a production internet-scale simulator is far beyond this proof.

**Demo + hook — I:** 60 seconds: the agent succeeds in a clean world, fails when another shopper changes stock, then survives a newly generated schedule after a fix. Show state-level scoring. Draft tweet: “I built a tiny, explicitly simulated web to break agents before real users do. Same checkpoint, different event order, different outcome. The websites and pending events have snapshots too; the agent's heap is only one part of the world.”

**Kill test — E:** an agent's success ranking in the twin reverses on the small real/reference workflow because the simulated semantics omit an essential behavior. Do not scale the world before repairing predictive validity.

**Scores — E:** stronger models **5/5**; solo defensibility **3/5**; X/HN signal **4/5**; first proof ≤2 weeks **3/5**. Good moonshot, but whole-world consistency and validation make the two-week scope tight.

### 6. Cybersyn for one company: a calibrated organizational wind tunnel

**Idea / 100× version — I:** Maintain a live, uncertainty-aware model of one operational loop and rehearse interventions before recommending them. The 100× version is a digital twin of a whole company: interacting departments, queues, budgets and delegated agents, with explicit observation gaps and accountable human owners.

**Lineage — F:** Ashby's **1956** *Introduction to Cybernetics* develops requisite variety and regulation limits. Beer's **February 14, 1973** *Fanfare for Effective Freedom* describes Chile's Cybersyn, recursive autonomy and timed escalation of unresolved exceptions. The project was abandoned following the **1973 coup**; that is not evidence that a complete economic simulation was built or technically falsified. NASA's **April 16, 2012** digital-twin paper couples models with sensor/history data. [Ashby, chapter 11](https://ashby.info/Ashby-Introduction-to-Cybernetics.pdf), [Beer's original lecture](https://kybernetik.ch/dwn/Fanfare_for_Freedom.pdf), [Beer archive](https://archives.ljmu.ac.uk/Record.aspx?id=DS%2FUK%2F5&src=CalmView.Persons), [NASA paper](https://ntrs.nasa.gov/citations/20120008178).

**I — Lesson/stall:** preserve local autonomy and escalate exceptions instead of feeding every decision to a central brain. Historical telemetry, computation and organizational participation constrained scope; political destruction was decisive for Cybersyn. Today agents can map documents and propose interventions, while edge services collect events. They do not eliminate hidden incentives, causal ambiguity or resistance to being modeled.

**Why stronger models help — I:** they can connect more operational context and propose better interventions. The controller must remain bounded by observability, feedback delay and uncertainty. A model that writes a convincing narrative of a company is not a calibrated company twin. Calibration data and integration relationships, rather than simulated employee personalities, are the potential asset.

**Value / defensibility — I:** a small operator could pay for answers to “which backlog intervention reduces missed deadlines?” Start with one support/escalation queue, not “replace management.” A buyer needs improved decisions or lower coordination cost; a dashboard full of busy synthetic employees is insufficient.

**First proof, 1–2 weeks — E:** build a TS discrete-event model from a consented queue history or a clearly labeled synthetic fixture. Separate fitting and withheld periods. Fork one checkpoint into staffing, triage and escalation policies; compare predictions with an ordinary queueing baseline and expose uncertainty. On real data, first test no-intervention forecast accuracy; causal intervention claims require later prospective evidence. A DO stores live observations, capsules preserve controller decisions and R2 stores the event fixture. Without a data partner, two weeks proves mechanics only.

**Demo + hook — I:** 60–90 seconds: one missed handoff propagates through a deadline; branch three interventions; show an uncertainty interval; a department resolves its own exception before the central operator is interrupted. Draft tweet: “A small Cybersyn-inspired company wind tunnel: local agents handle routine exceptions, unresolved ones escalate, and proposed policy changes run in a labeled simulation. First target: one queue whose forecasts we can actually test.”

**Kill test — E:** on withheld observed periods, the twin cannot outperform a simple queueing/seasonal baseline on the decision-relevant metric. Stop adding departments; richer prose is not improved control.

**Scores — E:** stronger models **4/5**; solo defensibility **3/5**; X/HN signal **5/5**; first proof ≤2 weeks **3/5**. Compelling historical hook; customer data access and causal validation dominate feasibility.

### 7. Agent Residency: portable identity, obligations and accountable authority

**Idea / 100× version — I:** Give a long-lived agent a portable record of its owner, execution lineage, obligations and revocable grants, while keeping effect authority outside its copied memory. The 100× version is a residence system for agents moving among hosts and organizations, with an auditable answer to “who authorized this action and who owns the unresolved obligation?”

**Lineage — F:** Smith's **December 1980 Contract Net Protocol** assigns meaning to task announcements, bids and awards between distributed problem solvers; it is more than a transport for text. W3C's **2025** credentials model separates issuers, holders and verifiers. [Original Contract Net paper](https://www.reidgsmith.com/The_Contract_Net_Protocol_Dec-1980.pdf), [W3C specification](https://www.w3.org/TR/2025/REC-vc-data-model-2.0-20250515/). **I — Linguistic connection/lesson:** “I promise,” “I request” and “I authorize” perform different acts. Store typed commitment transitions with named principals rather than treating arbitrary agent prose as a binding instruction. Earlier multi-agent protocols did not themselves supply broad real-world counterparties, trust or legal enforceability; agents make more tasks addressable but do not solve those institutional problems.

**Why stronger models help — I:** capable agents make longer commitments across more systems; provenance and revocation become more consequential. A new model can inherit a task record without inheriting a former model's trust automatically. Model upgrades may improve policy reasoning, but an agent cannot self-issue its owner's authorization.

**Value / defensibility — I:** teams delegating work across machines/providers could depend on migration without orphaned jobs or duplicated writes. A solo builder should offer an adapter/reference protocol, not a new identity provider, legal personhood scheme or “agent bank.” Managed-agent platforms already bundle much of the residence experience; the independent opportunity is cross-provider customer-controlled evidence and grants.

**First proof, 1–2 weeks — E:** represent one job as `offered → accepted → working → delivered → verified`, with owner, deadline and artifact hashes. A DO issues short-lived broker authority bound to job, branch, action and owner epoch; the capsule holds logical references only. Move Node→browser→Node at a pending tool call; copy the old capsule; revoke the previous epoch and show its write rejected. Restore after a crash between dispatch and acknowledgment against a toy idempotent service. Compare with a plain durable-workflow implementation; identity correctness does not require a heap image.

**Demo + hook — I:** 45–60 seconds: an agent accepts a job, moves hosts, gets copied, and the copied branch cannot act with stale authority. Draft tweet: “I can copy this agent's computer. I cannot copy its permission. The host checks owner, job, branch and revocation epoch before each write. The portable record shows who accepted the task and which obligation remains.”

**Kill test — E:** the ordinary workflow-plus-IAM baseline supports the same cross-host handoff, revocation and obligation tracking with less integration work and no loss of portable evidence. Abandon the standalone residency product; retain its authority protocol only where another proposal needs it.

**Scores — E:** stronger models **4/5**; solo defensibility **2/5**; X/HN signal **4/5**; first proof ≤2 weeks **5/5**. A sharp systems demonstration; IAM, workflow engines, credentials standards and vendors make the standalone business hard.

### 8. Speculation Budgeter: spend cheap labour where it buys checked progress

**Idea / 100× version — I:** Allocate a fixed budget among candidate generation, execution, checking and new test discovery, suspending branches whose next step is not worth its cost. The 100× version is an operating layer for vast populations of speculative workers, optimizing accepted progress under compute, oracle and human-attention constraints.

**Lineage — F:** Land and Doig's **July 1960** discrete-programming method is a foundation of branch-and-bound; MAP-Elites (**2015**) preserves diversity; Jevons (**1865**) explains why cheaper work can expand uses. [Land–Doig paper](https://jmvidal.cse.sc.edu/library/land60a.pdf), [MAP-Elites](https://arxiv.org/abs/1504.04909), [Jevons](https://www.econlib.org/library/YPDBooks/Jevons/jvnCQ.html?chapter_num=9). **I — Lesson/stall:** branching only helps if selection signals distinguish useful paths and the overhead is controlled. Real branch-and-bound has valid bounds; an LLM's confidence is not such a bound. Here priority scores are heuristics and must be tested against simple scheduling.

**Why stronger models help — I:** they expand the feasible task population and may improve proposals. Conversely, if one strong attempt dominates many weaker ones, fan-out should shrink. The system must be willing to choose one worker. “A million agents” is not the objective, and correlated branches can squander all of the supposed abundance.

**Value / defensibility — I:** users repeatedly searching for verifiable algorithms, transformations or configurations could pay for lower cost per accepted outcome. The useful asset would be empirical scheduling policies learned from authorized workloads. A raw spot-compute broker or snapshot wrapper has little solo advantage over cloud schedulers.

**First proof, 1–2 weeks — E:** use 20 bounded optimization tasks with independently checked objectives. A TS scheduler compares a single best model, fixed fan-out and adaptive allocation under the same total model/execution budget. Freeze unpromising capsule branches in R2, resume a few, and allocate some budget to fresh checks. Keep heavy optimization in a host tool. Report outcome quality, accepted outcomes per unit cost, and scheduler/checkpoint overhead; do not count sleeping branch records as resident computers.

**Demo + hook — I:** 45 seconds: show a fixed budget being split among proposals, failed checks and fresh tests; most branches stop, one resumes from yesterday's checkpoint. Draft tweet: “Cheap AI labour still needs a budget. This scheduler pays for proposals, execution and independent checks, then parks branches that stop earning their next step. The metric is verified progress per budget—not agents spawned.”

**Kill test — E:** across the preregistered task set, the adaptive scheduler loses to the single-best-model baseline after all execution, checking and persistence costs are included. Do not rescue the thesis by publishing only tasks where fan-out wins.

**Scores — E:** stronger models **4/5**; solo defensibility **2/5**; X/HN signal **4/5**; first proof ≤2 weeks **4/5**. Sound economics, crowded implementation space, uncertain incremental value from capsules.

### 9. Reality Slot: simulation-first experiments with a scarce physical oracle

**Idea / 100× version — I:** Let agents rehearse experiments in simulation, then spend a limited real-apparatus slot to distinguish competing hypotheses. The 100× version is a network of reproducible, agent-accessible physical experiments with portable procedures, measured outcomes and explicit calibration histories.

**Lineage — F:** NASA's **2012** twin proposal joins simulations with actual vehicle observations; Gemini Robotics (**2025**) connects model reasoning to physical actions. [NASA](https://ntrs.nasa.gov/citations/20120008178), [Gemini Robotics](https://deepmind.google/blog/gemini-robotics-brings-ai-into-the-physical-world/). **I — Lesson/stall:** simulation is useful because real tests are scarce, but unknown parameters and unmodeled effects create a simulation-to-reality gap. Physical setup, calibration and turnaround—not just reasoning—constrain automation. Agents improve experimental design; edge connectivity and a tool-only ABI make procedures easier to expose and audit. They do not pause the apparatus when a capsule sleeps.

**Why stronger models help — I:** better hypothesis generation increases the value of measurements that discriminate between plausible explanations. The runtime should allocate real observations by expected discriminatory value rather than run every proposed trial. That allocation is a hypothesis to evaluate, not a proven active-learning result here.

**Value / defensibility — I:** educational labs, device teams and small experimental operators might depend on a consistent remote procedure and evidence trail. The scarce asset is apparatus access plus calibration/outcome data. Begin with one low-risk instrument; robotics fleets and pharmaceutical labs are unrealistic initial markets for a solo runtime builder.

**First proof, 1–2 weeks — E:** use a simple camera-observed pendulum with an existing phone/laptop, manual release and pinned geometry. TS/Wasm simulates candidate damping models; a Node/browser tool ingests timestamped observed frames. The agent chooses between two proposed measurements, parks awaiting a human collection step, then resumes from the returned artifact. Test predictions on a separate observed run. The capsule stores orchestration, model/input versions and observations; apparatus state and camera-clock calibration remain external. No autonomous actuator or hardware purchase is needed for this proof, but setup/calibration make the schedule uncertain.

**Demo + hook — I:** 60–90 seconds: simulated hypotheses disagree; a human performs the selected physical measurement; the observed trace rejects one; export the exact procedure and data for a second observer. Draft tweet: “Two simulations agree on the old data. One new physical measurement separates them. This agent parks while the experiment happens, then resumes with recorded observations. The capsule preserves the procedure; it cannot freeze the pendulum.”

**Kill test — E:** the selected experiment yields no more discrimination on held-out physical observations than a fixed, simple measurement schedule after calibration/setup costs. A working remote notebook alone does not establish smarter experimentation.

**Scores — E:** stronger models **5/5**; solo defensibility **2/5**; X/HN signal **5/5**; first proof ≤2 weeks **2/5**. Strong external-world complement and demonstration; physical operations and uncertain buyers make this a later adjacency.

## 6. Ranking and ruthless reductions

**E — Score interpretation:** each dimension runs 0–5, higher is better. “Stronger” means demand/value grows with capability; “solo” means plausible accumulation beyond copyable code; “signal” means legible, inspectable technical surprise, not a forecast of likes; “proof” means feasibility of the bounded experiment in two weeks. Scores are judgments, not measurements. Totals are unweighted and do not encode dependencies, buyer access or time to revenue.

1. **Oracle Foundry — 18/20:** stronger 5, solo 4, signal 4, proof 5. Best fit to existing GrowOS knowledge and an independently checkable wedge.
2. **Future Browser — 17/20:** stronger 5, solo 3, signal 5, proof 4. Best demonstration that a capsule changes interaction rather than merely storage.
3. **Capsule Lab — 17/20:** stronger 5, solo 3, signal 5, proof 4. Best expansion into reproducible AI research, with a bounded computational starting point.
4. **Failure Seed Bank — 17/20:** stronger 5, solo 4, signal 4, proof 4. Strong accumulation mechanism; rank below the first three because it is naturally Oracle Foundry's feedback loop, not an independent first product.
5. **Internet Wind Tunnel — 15/20:** stronger 5, solo 3, signal 4, proof 3. Ambitious, relevant and prior-art-rich; validating the world dominates building its UI.
6. **Cybersyn for one company — 15/20:** stronger 4, solo 3, signal 5, proof 3. Worth pursuing with a data partner; synthetic company theater is weak evidence.
7. **Agent Residency — 15/20:** stronger 4, solo 2, signal 4, proof 5. Useful protocol and public failure test; cloud/IAM bundling makes the independent company thesis weak.
8. **Speculation Budgeter — 14/20:** stronger 4, solo 2, signal 4, proof 4. Evaluate as an optimization inside the winning product, not a generic agent cloud.
9. **Reality Slot — 14/20:** stronger 5, solo 2, signal 5, proof 2. Keep the physical-oracle direction, defer a marketplace until one instrument has repeat demand.

**I — Drop or demote these seductive variants:**

- “A cheap durable home for every agent”: already exposed to platform bundling; no durable differentiation without customer-owned authority, data or workflow.
- “A universal oracle powered by a better judge model”: fails independence; the next model can recreate the judge and may share its mistakes.
- “A full company/internet twin generated from documents”: impressive animation is not calibrated causal prediction; scope down to observable state transitions.
- “Millions of agents for almost nothing”: ignores inference, host tools, checking, persistence operations and correlated search; evaluate accepted outcomes under a fixed budget.
- “Every output carries a proof”: valid only for a formalized claim under explicit assumptions. A signed journal or passed test suite is not a universal correctness proof.
- “The heap is the whole experiment”: false when tools, datasets, service state, credentials or apparatus are outside it. Export the dependency and authority contract too.

## Ranked shortlist: top three

**1. Oracle Foundry — I:** It owns the acceptance problem precisely where cheap generation produces an abundance of plausible wrong implementations. The builder already has a credible adjacent artifact: a bounded grow loop with an external reference, held-out checks and evaluator mutants. A first public result can expose a subtle wrong implementation and the counterexample that defeats it. The larger ambition is substantial: acceptance infrastructure through which autonomous work must pass. Its risk is domain economics—building and maintaining a trustworthy oracle may cost more than the work it accepts—so begin with a stable reference and one semantic contract.

**2. Future Browser — I:** It most clearly answers why capsules should exist: the user branches the same pending computation, observes distinct consequences and grants one branch fresh effect authority. That experience gets more useful as models propose richer plans. It also has the strongest short video. Its weakest point is prediction: the runtime cannot infer unobservable external state, so start with an instrumented workflow and display assumptions explicitly. Treat it as a focused application and reference adapter, with an honest replay baseline, rather than a claim to fork reality itself.

**3. Capsule Lab — I:** Stronger AI scientists create a larger audit and reproduction workload. A portable experiment with pinned inputs, continuation state, observation journal and a checkable result could become a useful scientific artifact. It combines the builder's mechanism with an ambitious interface to research rather than competing on another agent loop. Begin with deterministic computational experiments and an external evaluator; preserve the distinction between replayed observations and new inference. Adoption and long-term compatibility, more than heap serialization, are the hard parts.

## The one I would bet on

**I — Oracle Foundry, with Failure Seed Bank as its accumulation loop and one Future Browser view as its demonstration.** These are one coherent first project: a candidate claims success, an independent oracle challenges it, the user forks the failing boundary, and the resulting witness becomes a future acceptance test. Do not implement nine platforms. Start with a reference-backed compatibility task where the builder can personally explain the complete acceptance chain.

**E — Two separate go/no-go decisions at day 14:** continue the **product** only if the narrow independent gate distinguishes real semantic failures that visible tests miss and at least one intended user considers the exported evidence useful for an actual acceptance decision. Continue the **capsule-specific investment** only if it materially improves reconstruction, handoff or branching over source + inputs + event replay. A successful oracle with no capsule advantage is a reason to ship the simpler implementation. A spectacular snapshot with no credible acceptance procedure is a reason to stop the product pitch.

## 5-line TL;DR

1. **I:** Model releases absorb generic prompts, retrieval assembly and agent loops; they can also grow products with distribution, integration and outcome data.
2. **I:** Persistence is already bundled: own an independent acceptance relationship, fresh failure data, real authority or physical observations.
3. **I:** Verification becomes a promising bottleneck when proposals are cheap, but static tests and model-only judges are themselves vulnerable.
4. **I:** Top three: Oracle Foundry, Future Browser and Capsule Lab; retain company/internet twins as calibrated long-term expansions.
5. **I:** Bet on a narrow oracle plus executable failure capsules, and require evidence that capsules beat ordinary replay before expanding the runtime.
