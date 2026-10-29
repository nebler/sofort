# S04 — Infrastructure and platforms: the work left after generation

Research date: **2026-10-28**. Scope: Cloudflare, Vercel, databases, resilience, operational data, developer infrastructure, native runtimes, in-housing, and fork ownership.

**I — Verdict:** the strongest individual-builder opportunities are small checks of infrastructure transitions. The platforms already supply execution, persistence, code generation, storage, deployment, and much of observability. The remaining questions are more specific: did this object actually become eligible to sleep; can these versions coexist over old state; does this sampled stream still contain the information the metric promises; can the recovering system withstand its own retries?

**I — Leading choices:** passive Durable Object hibernation assertions, mixed-version DO migration rehearsals, and a sampling-exactness fixture pack. These are conditional OSS contributions/tools, not three verified markets. Recovery-load rehearsals and cache-aware tenant cutovers have stronger cross-organization convergence but require more customer-specific integration.

## Evidence, coverage, and counting

- **Q** = supplied transcript quotation or attributed claim. **F** = a linked external source establishes the stated, limited fact. **I** = inference, proposed scope, classification, or bounded negative result. **E** = estimate, illustrative demo, acceptance target, or score.
- Read the per-video digests, recurring themes/disagreements, prior-art triage, and selected-candidate sections of **E01–E11**, and the corresponding analysis/candidate sections of **all five Connect ledgers**. Searched the full ledgers and transcripts, then returned to substantive caption paragraphs for consequential claims. The broad search found **1,234 table hits**, including repeated analysis/prior-art rows; **1,042 original signal rows** remain in the screening register below, including **175 labelled prediction/roadmap rows**. This is a search audit, not a count of independent needs or recommended projects.
- Search families included the named platforms/products/people plus `semantic`, `resilien`, `recover`, `migrat`, `fork`, `in-house`, `backpressure`, `hibernat`, `database`, `analytics`, `cold start`, `cutover`, `rollback`, `sandbox`, `infrastructure`, and `infra`. Follow-up searches covered retries, idempotency, memory, shared resources, query lineage, alarms, emitted code, and deployment identity. Role-name hits and incidental uses of words such as recovery remain visible in the inclusive register; they do not automatically become infrastructure recommendations.
- Background constraints: [research summary](/Users/noah/code/sofort/arch/research/RESEARCH-SUMMARY.md), especially §§11–12; [stack summary](/Users/noah/code/sofort/arch/research/stack/SUMMARY.md); [Connect summary](/Users/noah/code/sofort/arch/research/connect26/SUMMARY.md). No killed broad category is revived here. New testimony can strengthen demand for an existing category without making it vacant.
- **I — Independence rule:** repeated appearances by Theo, Amp, Pi/Earendil, or Cloudflare are collapsed when judging convergence. Theo reading Anthropic's article is one Anthropic account, not another independent experience of Scion. Sponsor repetitions are excluded. Counts below are conservative counts of the explicitly named anchor set, followed by distinct publication channels; unidentified audience members are additional qualitative evidence, not invented independent customers. Channels are collapsed where the publisher is the same. Counts overlap across clusters and must not be added.
- Timestamps are caption minute buckets. Corpus references use **Vxx**; Connect uses **Txx**. A working demo or self-reported number remains Q. No benchmarks, production migrations, customer interviews, or demand tests were performed for this report.

## 1. Clusters and cross-corpus signals

### C1 — Durable execution is available; survival of the right work still needs evidence

**I — Conservative convergence:** **6 named anchor speakers / 5 channels**: Mario, Scott Tolinski, Justin Schroeder, Ashley Peacock, Katelyn Lesse, Jack Wotherspoon; Fragmented, Syntax, Cloudflare, Latent Space, AI Engineer. Several describe supplied mechanisms, rather than an unfilled demand.

| Source | Speaker | Q — signal | I — consequence |
|---|---|---|---|
| V05 15:00–22:00 | Mario, Pi | “I don't know if it was actually sent or not”; “inspect your environment” | Persisting intent and a result leaves a remote-commit/local-acknowledgement ambiguity. |
| V05 23:00–24:00; 52:00–53:00 | Pi maintainers | “the sub agents to also resume”; “We are not experts on these infrastructure pieces” | Parent/child ownership and host integration matter; Pi Durable already implements the broad recovery core. |
| V56 03:00–07:00 | Scott Tolinski | “delete about 8,000 lines of custom code”; “safe to run again” | Concrete library substitution validates durability demand while killing another general durable-agent host. Duplicate-work guards remain application work. |
| T11 27:00–31:00 | Justin Schroeder, Standard Agents | “eternally booting itself up”; “die mid-execution”; “watchdog” | A liveness workaround can cause loops, and deployment interruption needs application-level testing. |
| T09 15:00–19:00 | Ashley Peacock, Cloudflare | “memory starts fresh”; “shutdown hook”; “double execute” | Hibernation reconstruction and repeated effects have distinct contracts. Runtime remedies have a platform owner. |
| V50 1:04:00–1:06:00 | Katelyn Lesse, Anthropic | “you lose your whole agent” | Durable harness state should survive disposable execution. This architecture is already implemented. |
| V46 09:00–10:00 | Jack Wotherspoon, Google DeepMind | “a very fresh … context window” | Files/environment and conversation lifetime are already separate managed primitives. |
| V80 35:00–39:00; 50:00–53:00 | Armin Ronacher | “break quite a few extensions”; nonserializable effects | A durable core upgrade is also an extension-compatibility migration; ordinary hot reload is not equivalent recovery. |
| T11 40:00–42:00 | Schroeder | “2 megabyte chunks”; “I don't have a good solution” | Chunked SQLite files are already supplied; fleet aggregation is a separate concern from per-thread logging. |

**F — Current prior art:** [Workers test APIs](https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/) offer forced abort/eviction and alarm helpers; they are not passive eligibility observations. [Agents #1956](https://github.com/cloudflare/agents/issues/1956), opened July 16, 2026, remains open and includes a real reconstruction-counter test. [workerd #5835](https://github.com/cloudflare/workerd/issues/5835), opened January 6, 2026, separately requests lifecycle events without waking objects. These are concrete requests, not proof that no private branch implements them. [The supplied reproduction](https://github.com/bohdanbirdie/cf-do-hibernation-repro) already demonstrates the timer-pinning case; do not rebrand it as a discovery.

**F — Platform movement:** [Vercel persistence GA, May 26](https://vercel.com/changelog/sandbox-persistence-is-now-ga) supplies named filesystem persistence. [Vercel's October 8 readiness change](https://vercel.com/changelog/sandbox-create-waits-until-ready) moves snapshot restoration and startup errors into `Sandbox.create()`; total creation-through-operation latency is unchanged. [Its September 3 Cursor reference architecture](https://vercel.com/changelog/run-cursor-cloud-agents-vercel-sandbox) already combines a durable control plane, scale-to-zero execution, retries, scoped credentials, and cleanup. Resume, persistence, and a split agent are **Shipped**, not openings.

**I — Classification:** general durable agents, alarm queues, streamed history, filesystems, watchdogs, and idle hosting are **Shipped / Being built**. Announced shutdown/deploy/retry controls are **Roadmap — Cloudflare** unless a release verifies availability. A supported passive hibernation assertion is **Open, bounded**. Application-effect interruption fixtures are **Open only as reusable test packaging**. Projects: P01, P23, P32; lifecycle inputs also feed P02/P13/P35.

### C2 — The end state is easier than the migration through live, old state

**I — Conservative convergence:** **6 named anchor speakers / 5 channels**: Titus Winters, Will Larson, Quinn Slack, Dillon Mulroy, Katelyn Lesse, Theo Browne; Pragmatic Engineer, Amp, Cloudflare, Latent Space, t3.gg. Historical failures corroborate a mechanism, not the present incidence rate.

| Source | Speaker | Q — signal | I — consequence |
|---|---|---|---|
| V17 24:00–30:00 | Titus Winters | “not allowed to close the building”; “old API and the new one can coexist” | Concurrent caller changes and migration completion are the hard part of a foundational replacement. |
| V18 21:00–23:00 | Will Larson, Digg account | “can't read from Cassandra”; “we couldn't roll back” | A valid implementation can fail the mixed workload and eliminate the old fallback through capacity constraints. |
| V35 49:00 | Quinn Slack | “some new versions and some old versions”; “No one ever goes back and cleans it up” | Expand/contract migrations need evidence for intermediate compatibility and eventual cleanup. |
| V51 15:00–16:00 | Slack | “over so many different steps”; “babysitting that the whole time” | Single-to-multiple-workspace migration consumes supervision despite agent-written checks. |
| T13 14:00–16:00 | Dillon Mulroy, Artifacts | “forgot to lowercase the repo names”; “version skew” | Identity normalization is persisted state, not merely a string helper. |
| T13 15:00 | Mulroy | newer model “one shot it”; compatibility reads remain | The coding blockage was solved. The remaining opportunity is evidence through rollout, not another migration-writing agent. |
| V50 57:00–1:00:00 | Lesse | “shadow traffic”; “whole rest of our team … building features” | A Python-to-Rust port must keep behavior and new-feature parity while the source moves. Internal parity lint already exists. |
| V87 32:00–35:00 | Theo / Anthropic account | “mirror and backfill”; “violate core system constraints” | Data parity, authoritative query paths, and cutover readiness need separate checks. |

**Q/I — Counterevidence:** Slack explicitly says agents are already very good at breaking a migration into compatible steps (V35 49:00), and Dillon reports that a newer model solved his implementation. These accounts establish the importance of the transition, not a continuing inability to write migrations or a request from either team for this proposed adapter. Reusable independent fixtures must earn their place against inexpensive agent-written application tests.

**F — Prior art:** Cloudflare's [integration harness](https://developers.cloudflare.com/workers/testing/test-harness/) runs multiple built Workers; [state preparation](https://developers.cloudflare.com/workers/testing/test-harness/prepare-test-state/) seeds and inspects SQLite DO state. [Gradual deployments](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/) already handle version assignment and expose version identity. An object has one assigned version at a time; the useful test spans caller/callee pairs, distinct objects, and sequential upgrades of the same persisted state. Two copies of one singleton running simultaneously would model the wrong contract.

**F — More occupied ground:** [durable-utils](https://github.com/lambrospetrou/durable-utils) supplies SQL migrations, sharding, and retries; [Drizzle](https://orm.drizzle.team/docs/get-started/do-new) supplies DO migration support. [Datafold's Evri case study](https://www.datafold.com/case-study/evri-sap-hana-and-talend-to-databricks-migration/) describes translation, reconciliation, lineage, staging, and dashboard-by-dashboard retirement. Generic migration validation is **Shipped**. [Diffy](https://github.com/twitter-archive/diffy) is foundational shadow-comparison prior art, not a 2026 invention.

**I — Classification:** migration generation and general parity tools are **Shipped**; cloud deployment sequencing is **Shipped / Roadmap by the owner**. An application-level mixed-version fixture adapter remains **Open, conditional**. App/schema lifecycle checks, streaming equivalence cases, and retirement evidence are smaller contributions. Projects: P02, P07, P17–P22, P25, P37. No broad post-merge integration novelty claim is restored.

### C3 — Resource limits and recovery load become more important as agents multiply work

**I — Conservative convergence:** **6 named anchor speakers / 5 channels**: Sam Newman, Lu Zhang, Ben of PlanetScale, John of Jane Street, Fabian of Lovable, Theo; Pragmatic Engineer, AI Engineer, Jane Street, Cloudflare, t3.gg. Their mechanisms differ; convergence supports finite-resource checks, not one universal scheduler.

| Source | Speaker | Q — signal | I — consequence |
|---|---|---|---|
| V20 55:00; 1:16:00–1:18:00 | Sam Newman | “resource pools are not infinite”; “500 retries” | Recovery can consume the resource needed to recover; healthy steady-state load is an inadequate test. |
| V64 06:00–08:00; 16:00–17:00 | Lu Zhang, inference engineering | “bad oscillations”; “more failure and cause more retries” | Feedback, cache locality, and retries can amplify one another. |
| V78 08:00–10:00; 15:00 | Ben, PlanetScale | “rest of your stack has to be built to support that”; “warnings back to the client” | Database admission control fails if callers ignore it or multiply retries. |
| V08 35:00–36:00 | John / Jane Street interviewer | agents preempting “a bunch of human work” | Agents can misprice work in an existing compute auction. This is a concrete allocation externality. |
| V01 23:00–33:00; V88 42:00–44:00 | Theo | queues, OOM, parallel builds, extra SSH hosts | The operator changes admission, RAM, and machines, not only prompts. |
| T06 16:00–18:00 | Fabian, Lovable | “128 megabytes”; compiler/highlighter “out of memory errors” | Valid server code can retain the wrong dependency inside a constrained isolate. |
| T10 26:00–27:00 | Raphaël Beamonte, Ramp | “multiple requests”; “out of memory exceptions” | A per-request cap does not imply a whole-isolate bound under concurrency. |
| V50 18:00; 54:00–59:00 | Lesse | “CPU is really constrained”; “cannot get enough VMs” | Ordinary execution capacity is already scarce in an extreme customer, independently of the inference-price forecast. |
| V85 25:00; V88 23:00–27:00 | Theo | “VM … more expensive than the inference” | A prediction to measure, not proof of the present cost split for every model or task. |
| V12 27:00 | Michelle Chen, Cloudflare | old models “eating up GPU space” | User attachment makes retirement a behavioral/capacity trade-off, not just a bin-packing problem. |

**F — Prior art changes the pitch:** [MongoDB's client-backpressure specification](https://github.com/mongodb/specifications/blob/master/source/client-backpressure/client-backpressure.md) includes retry-policy interactions and warns users about custom retry loops; its changelog includes January–July 2026 changes. [PlanetScale warning thresholds, March 30](https://planetscale.com/changelog/traffic-control-warning-thresholds) already implement warning-before-enforcement budgets. [Google SRE overload guidance](https://sre.google/sre-book/handling-overload/) and [Amazon's caching guidance](https://aws.amazon.com/builders-library/caching-challenges-and-strategies/) cover mature mechanisms. Kueue, existing cloud admission systems, and profilers rule out inventing a new generic scheduler or memory profiler.

**I — Classification:** admission, fair sharing, backpressure, retries, cache/load optimization, and basic profiling are **Shipped / Being built**. Application-specific recovery envelopes, retained-heap scenarios, and bid-vs-owner-priority evidence remain **Open only in narrow form**. Legacy-model retirement is **Ambiguous/Open with low confidence**, because operators may already solve it privately. Projects: P04, P14, P28–P30, P35, P40.

### C4 — Data exists, but its meaning, coverage, and authority do not automatically survive reuse

**I — Conservative convergence:** **6 anchor voices / 5 channels**: unnamed dbt presenter, Andrew Qu, Micah Wylde, Kevin at TELUS, Uday at Uber, Karpathy; dbt Labs, AI Engineer, Cloudflare, Pragmatic Engineer, the supplied Karpathy recording/repost. The latter is older workflow evidence, not a new 2026 model evaluation.

| Source | Speaker | Q — signal | I — consequence |
|---|---|---|---|
| V03 01:00–13:00 | dbt presenter | “calculating revenue in different ways”; “individual parts of the DAG” | Governed definitions, upstream composition, and actual access lineage are distinct requirements. SQL compilation already exists. |
| V03 16:00–17:00 | audience / presenter | “non-technical users … knowledge”; “want to be making PRs” | Domain ownership and source-code authoring are different workflows. |
| V03 17:00–20:00 | audience / presenter | “Hex doesn't parse”; “lossiness between conversions”; “enforcement” | Consumer compatibility, metric equivalence, and permission preservation are separate contracts. “V2” is not identified precisely. |
| V03 24:00–27:00 | presenter / audience | “skills”; “telemetry pretty difficult”; “human curated” | A textual skill can bypass governed execution and weaken metric-level attribution. |
| V68 08:00–16:00 | Andrew Qu, Vercel | “whole semantic layer”; “roughly 100 skills”; “company knowledge” | Query mining is already implemented. The inferred question is when learned company assumptions become stale. |
| V19 41:00–44:00 | Uday, Uber | “blessed queries”; “existing user permissions” | Trusted examples and joined context already exist; their freshness and access changes need actual evidence. |
| T05 06:00; 16:00–17:00 | Micah / audience | “fundamentally missing the data”; “three different answers” | New instrumentation cannot explain an unobserved historical interval, and a query engine cannot appoint a metric owner. |
| T12 11:00–12:00 | Kevin, TELUS | “weren't counting people properly”; “jumped like seven times” | Moving events to a sampled store silently changed a user metric. Exact SQL and index design are not supplied. |
| V62 59:00–1:01:00 | Karpathy | missing value becomes `0.1`; prose and plot disagree | Source → transformation → chart → prose needs provenance and numeric/unit checks. |

**F — Deep prior-art update:** [Apache Ossie's converter responsibilities](https://github.com/apache/ossie/blob/main/converters/README.md) already include preserving vendor extensions and documenting unsupported constructs. Its [roadmap](https://github.com/apache/ossie/blob/main/ROADMAP.md) explicitly includes a reference semantic engine, cross-implementation conformance, curated queries, and governance/identity work. Therefore a generic semantic-conformance system is **Roadmap — Apache Ossie**, not an ownerless category. A concrete executed result/access counterexample is a plausible contribution, not a new universal layer.

**F — Other close owners:** [OpenLineage 1.46.0, April 7, 2026](https://openlineage.io/docs/releases/1_46_0/) adds dbt source-location and test-result facets. [MetricFlow](https://docs.getdbt.com/docs/build/about-metricflow), [Snowplow Micro](https://docs.snowplow.io/docs/testing/snowplow-micro/automated-testing/), and [Icelight](https://github.com/cliftonc/icelight) cover definitions, expected-event tests, and a Basin semantic/MCP stack. [Analytics Engine's SQL contract](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/) exposes `_sample_interval`; weighting an event aggregate does not reconstruct discarded user identities. [sqlsure](https://github.com/sqlsure/sqlsure) already checks declared semantic SQL facts. Its inspected README did not establish sampling-contract checks; that is a limited observation, not a full implementation audit.

**I — Classification:** semantic layers, SQL agents, skill mining, data lineage, event tests, and data-diff are **Shipped**; semantic conformance is also explicitly **Roadmap**. Residual exactness, learned-skill invalidation, observation-interval evidence, and business-example review are **Open, conditional integrations**. Projects: P03, P05–P10. Do not infer that every observed numerical problem requires an LLM evaluator.

### C5 — Code Mode and sandboxes move complexity into composition and control boundaries

**I — Conservative convergence:** **5 named anchor speakers / 5 channels**: Mikyo King, Matt Carey, Josh of Better Stack, John of Jane Street, Armin Ronacher; AI Engineer, Cloudflare, Better Stack, Jane Street, Fragmented. These are different boundaries, not five requests for one sandbox product.

| Source | Speaker | Q — signal | I — consequence |
|---|---|---|---|
| V47 08:00–11:00 | Mikyo King, Arize/Phoenix | “sixth operation”; “double sandboxing”; “signed image handoff” | Authority can change within a generated program; nested runtimes need artifact identity/lifetime, not repeated binary materialization. |
| V48 00:00–08:00; 25:00 | Matt Carey | “lose … edge cases”; “granularity” | Compressed catalogs can discard the long tail. Full-API search/execute already ships. |
| V48 22:00–23:00; 41:00 | Carey | “anything else we made in this session”; “delete all your emails” | Session ownership/cleanup and bounded external effects are separate from code isolation. |
| V05 05:00–08:00 | Armin / Mario | “complexity”; “strictly typed returned values” | Harness-local code composition has a different contract from a Linux execution environment. |
| V08 34:00–49:00 | John | “turn the sandbox off”; agent-specific RPC authority | Control coverage and workflow usability both matter. Enterprise integration is not supplied by a generic container. |
| V83 01:00; 04:00 | Better Stack presenter | Docker runtime; paid-plan/binding prerequisites | Local success and deployability are different capabilities. |
| V84 03:00–06:00 | Josh | endpoint-specific denial; doctor “everything's green” | A version string and working Docker daemon do not prove that the advertised VM controls work. |
| V80 1:00:00–1:10:00 | Armin | models synthesize edit programs | Named-tool UIs increasingly miss work performed inside those programs. |

**F — Deep checks:** [Docker Agent Code Mode](https://docker.github.io/docker-agent/features/code-mode/) already displays inner calls and documents script-level approval rather than another approval for each wrapped call. [MCP tool results](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) already carry resource links and structured results. [Armin's October 6 account](https://lucumr.pocoo.org/2026/10/6/codemode/) independently discusses result-shape inconsistency, binary handoff, and tool-search composition. References themselves are not new; an adapter must preserve scope, expiry, display, and access across two actual implementations.

**F — OpenShell status:** [#4133](https://github.com/NVIDIA/OpenShell/issues/4133), opened October 2, remains open; the issue records missing Docker-VM Landlock/networking checks. It also marks the Landlock startup-message improvement in [#4413](https://github.com/NVIDIA/OpenShell/pull/4413) as done. Do not pitch the whole diagnostic fix as untouched. The inspected discussion reports contributor work on capability probes; remaining networking/error-propagation fixtures belong upstream.

**I — Classification:** code execution, secret mediation, policy sandboxes, typed results, and wrapped-call tracing are **Shipped**. Durable Code Mode is already **Shipped / Being built** in the background. Artifact-lifetime composition and equivalent policy behavior are **Open only as narrow adapters/corpora**. OpenShell capability diagnostics are **Being built**. Projects: P11–P13, P23, P37; no broad labelled-Code-Mode repitch.

### C6 — Git and agent workspaces: optimize the actual operation, preserve its semantics

**I — Conservative convergence:** **4 named anchor speakers plus 1 organizational account / 3 channels plus the primary article**: Dillon, Jackie of Relevance AI, Theo, Quinn Slack, and Anthropic's Scion account; Cloudflare, t3.gg, Latent Space. Theo's reading of that account is not an additional Scion deployment.

| Source | Speaker | Q — signal | I — consequence |
|---|---|---|---|
| V87 11:00–17:00 | Anthropic account read by Theo | stale seeds; partial-clone history failures; optional working copy | Metadata-only automation should not require a checkout, but optimizations must preserve required history operations. |
| V87 26:00–27:00; 34:00–35:00 | Anthropic account | cache failure overwhelming upstream; log scan bypassing the review API | Failure-domain and authoritative-path checks remain necessary after a faster replacement. |
| V87 30:00–33:00 | Theo's own account | “almost 1,000 hours … waiting for Git checkouts” | A small team's total parallel wait can be material; wall time, CPU time, and billed time must stay separate. |
| T13 03:00–13:00 | Dillon | streaming, quarantine, registry shards, Wasm/JS copies | Many small repositories create different pressure from Anthropic's large monorepo. Artifacts already supplies this storage category. |
| T03 11:00 | Jackie, Relevance AI | “latency issues … standard S3FS”; “custom mounting” | Metadata latency justified a real custom implementation. Generic mounting is already occupied. |
| V51 27:00–28:00 | Slack / host | “lack the ability to resume”; “RL sandbox is totally different” | A cold-start leaderboard cannot establish whether a development workspace supports the required lifecycle. |

**F — Prior art:** [Anthropic's October 13 source-control account](https://www.anthropic.com/research/redesigning-source-control) documents Scion, its extreme workload, and a five-month migration. This is shipped internal infrastructure, not a generally available Git replacement. [ArtifactFS](https://github.com/cloudflare/artifact-fs) already lazily hydrates Git trees, documents EOL/filter limitations, and runs Git/FUSE end-to-end tests. [Tigris fs-correctness](https://github.com/tigrisdata/fs-correctness) already compares against a native baseline and includes Git/SQLite workloads. Its published harness is macOS-oriented; do not assume it is already a Linux runner.

**I — Classification:** agent Git hosting, sparse/virtual checkouts, warm snapshots, caching, and Git metadata APIs are **Shipped / Being built**. Small lazy-tree transition fixtures and checkout-wait attribution are plausible **Open contributions**, with low novelty scores. Current-tip revert rehearsal is the already-known narrow survivor, not a new post-merge integration category. Projects: P19–P21, P37.

### C7 — Build/buy/fork changes the acquisition cost, not the need for ownership

**I — Conservative convergence:** **6 named anchor speakers / at least 4 independent channels**: Ryan Skidmore, Sunil Pai, Quinn Slack, Ree, Peter Mattis, Max Kanat-Alexander. Cloudflare programming is collapsed; the other publications are Latent Space, Pragmatic Engineer, and AI Engineer.

| Source | Speaker | Q — signal | I — consequence |
|---|---|---|---|
| T02 05:00–06:00; 15:00–18:00 | Ryan Skidmore | “running it, fixing it, and replacing it”; “keep a way out” | Replaceability requires a working export/import/operation drill, not optimism about another cheap rewrite. |
| T02 08:00–13:00 | Skidmore | 500 changes to an internal reviewer; missing design/system context | In-housing can create continuing adaptation and on-call work. The internal reviewer already exists. |
| V49 10:00–12:00 | Sunil / host | “own the dependency”; “fork it, and adapt it” | Fork-and-own is a distinct option between buying and rebuilding; maintenance obligations still transfer. |
| V51 12:00; 32:00–35:00 | Slack / host | stable frontend/backend contracts; “jellyware” | Personalized distribution has a named builder; maintaining custom behavior across upstream change is the narrower question. |
| V11 1:08:00–1:14:00 | Ree | private/public source mirror; “in-house both of them” | Private development context and publishable source need a checked projection; auth/email replacement motivation does not imply a missing auth service. |
| V22 47:00 | Mattis | “We shouldn't build … database” | The decision can be to buy, narrow scope, or pivot. Building infrastructure was a strategic company choice, not a universal prescription. |
| V79 09:00–12:00 | Max | “disposable”; “now it needs to be durable” | Adoption can invalidate an app's original data/dependency/fallback assumptions. |
| V08 1:08:00–1:15:00 | John, Jane Street | undoing bespoke standards; “unique advantage” | Internal tooling must earn its divergence and migration costs. |
| V82 56:00–1:03:00 | Armin / Ben | Nix resurgence; source disappearing | Reproducibility and an exercised continuity export are more concrete than another source host. |

**F — Prior art:** [GitBlixt instance updates](https://www.gitblixt.com/docs/instance-updates) already merge upstream changes into local forks, handle conflicts, build, deploy, and roll back. [Marin's fork policy](https://marin.readthedocs.io/en/latest/dev-guide/forking-policy/) is additional maintained-fork prior art. [D1 export](https://developers.cloudflare.com/workers/wrangler/commands/d1/), [pgcopydb comparison](https://pgcopydb.readthedocs.io/en/v0.18/ref/pgcopydb_compare.html), and [AirBridge](https://github.com/he8um/AirBridge/blob/main/docs/overview.md) supply movement/restore ingredients. A search also found an August 2026 directory listing called `upstream-sync-rehearsal`; both its linked GitHub source and raw file returned 404. It is an unresolved discovery lead, not verified shipping competition.

**I — Classification:** fork synchronization, application generation, backup/export, SaaS inventory, and generic cost calculators are **Shipped**. Jellyware and replacement-oriented internal platforms are **Being built / Roadmap by their owners**. Custom-behavior update rehearsals, executable exits, and disposable-to-durable promotion are **Open but weakly validated**. Projects: P24–P26, P34; private/public projection and OSS disappearance are retained as tiny variants of P25, not new Git services.

### C8 — Observability must preserve meaning, workload identity, and evidence coverage

**I — Conservative convergence:** **6 named anchor speakers / 3 channels**: Newman and Uday; Sagar Utekar, Oshi Gupta, Reza Jelveh; Kevin at TELUS. Channels: Pragmatic Engineer, CNCF, Cloudflare. The same symptom word does not establish the same missing product.

| Source | Speaker | Q — signal | I — consequence |
|---|---|---|---|
| V20 57:00–59:00 | Newman / Orosz | “can't correlate”; healthy logs, unhappy users | Per-process health and end-to-end outcome are different observations. |
| V19 1:04:00–1:10:00 | Uday | baggage propagation; “cash trips only in Brazil” | A replay corpus only covers observed combinations; branch context must survive every relevant hop. |
| V19 1:23:00–1:26:00 | Uday | feature velocity; missing task/change links | PR counts do not establish feature lead time or business value. Uber already repairs lineage internally. |
| V76 09:00–16:00 | Utekar / Gupta | “per request traces can't see the batch dynamics”; “97% … mostly idle” | Successful requests can conceal preemption and shared-engine interference. |
| V77 10:00–16:00 | Jelveh, HAMi | “confidence … metrics”; operator upgrades break things; “unknown” | A metric retaining its name does not establish the same unit, denominator, scope, or identity. |
| T12 14:00–15:00 | Kevin | observability took Gizmos down; regional false alarms | Instrumentation and probes have their own dependencies and failure modes. |
| T10 33:00–37:00 | Beamonte, Ramp | shared trace; “return the version ID” | A successful probe needs the identity of the deployed version that answered. |
| T11 41:00–42:00 | Schroeder | fleet “aggregate sum”; million-user uncertainty | Thread-local tracing is not automatically fleet completeness. |
| T04 07:00–20:00 | Greg Pstrucha, Sentry | prefilter bypasses; “cases we don't know”; backfilled evals | A screened subset cannot establish coverage/cost for all incoming telemetry. |

**F — Prior art:** [HAMi's utilization design](https://project-hami.io/docs/developers/gpu-utilization-metrics), updated June 18, 2026, includes per-Pod testing and explicitly excludes non-NVIDIA utilization from that design. [HAMi's FAQ](https://project-hami.io/docs/faq) names GPU Operator/device-plugin interactions and version-dependent vLLM behavior. These are owned integration problems. [vLLM per-request metrics](https://github.com/vllm-project/vllm/blob/main/docs/features/per_request_metrics.md), [Cloudflare OTel export](https://developers.cloudflare.com/workers/observability/opentelemetry-export/), and [agent tracing](https://developers.cloudflare.com/agents/runtime/operations/observability/tracing/) already supply substantial telemetry.

**I — Classification:** generic tracing, dashboards, vendor metric normalization, context graphs, and production replay are **Shipped / Being built**. Metric-upgrade semantics and labelled shared-batch disturbances are **Open as upstream fixtures/diagnostics**, not a new full observability stack. Sentry cascade accounting is a small variant of P28's excluded-work accounting; it requires private representative labels and is especially vulnerable to cheaper inference erasing its value. Projects: P27–P29; small supported-combination/routing-propagation fixtures attach to P02/P18/P37.

### C9 — Host portability is a whole-workflow claim; custom native UI inherits extra contracts

**I — Conservative convergence:** **4 named anchor speakers / 3 channels**: Theo, Fabian, Beamonte, Scott Tolinski; t3.gg, Cloudflare, Syntax. Their concrete applications differ, so this is convergence on a testing boundary, not four customers asking for one package.

| Source | Speaker | Q — signal | I — consequence |
|---|---|---|---|
| V88 13:00–22:00 | Theo | port retained Go's library/runtime; inherited bugs; lost JS APIs | Faithful CLI diagnostics, API compatibility, performance, and architectural simplification are distinct goals. |
| V88 32:00–46:00 | Theo | read-only Node demo; “see if this will actually run on Cloudflare” | A Node/V8 demonstration is not proof of the whole loop under Workers limits. |
| T10 36:00–40:00 | Beamonte | local tests passed; Go/Rust shared fixtures | Source-level parity and deployed-runtime parity both need evidence. |
| T06 16:00–18:00 | Fabian | server/client placement and shared heap | A build can pass while the runtime retains the wrong component. |
| V57 19:00–31:00 | Scott / Wes | fork incompatibility; missing font scaling; “no browser DOM”; GPUI patch | Custom controls need focus, editing, accessibility, scaling, and native-dialog evidence. |
| V22 1:28:00–1:29:00 | Mattis | “decompiled code” | A useful obligation can concern the actual emitted artifact rather than source aesthetics. |

**F — Prior art:** workerd already maintains [Node compatibility policy/tests](https://github.com/cloudflare/workerd/blob/main/src/node/README.md) and Web Platform Tests. [GPUI Kit's accessibility testing instructions](https://github.com/longbridge/gpui-kit/blob/main/docs/ACCESSIBILITY-UI-TESTING.md) already require a signed macOS bundle, refreshed element locators, real keyboard/focus actions, and observable values. A new tree driver is substantially occupied. The meaningful contribution must find a reproducible behavior gap beyond those instructions. [MemLab](https://github.com/meta/memlab) already compares heaps and offers assertions; a workerd child-isolate adapter must prove it targets the right isolate. [LLVM FileCheck](https://www.llvm.org/docs/CommandGuide/FileCheck.html) already checks emitted-code properties.

**I — Classification:** TS compiler rewrites, Wasm ports, developer runtimes, compatibility suites, native component libraries, and assembly checks are **Shipped / Being built**. Specific whole-workflow, retained-heap, native-action, or emitted-artifact fixtures are **Open contributions at most**. Projects: P14–P16, P35, P39.

### C10 — Database operations need a recovery contract, not only an agent-friendly interface

**I — Conservative convergence:** **4 anchor speakers / 3 channels**: Mattis, Ben of PlanetScale, Uday, Ashley Peacock; Pragmatic Engineer, AI Engineer, Cloudflare.

| Source | Speaker | Q — signal | I — consequence |
|---|---|---|---|
| V22 51:00–59:00 | Mattis | size ceiling, re-sharding, replica lag, isolation burden | Database scale and consistency choices leak into application behavior. Distributed SQL already addresses the broad category. |
| V22 22:00–23:00 | Mattis | “foundation Bigtable … didn't use Colossus” | Recovery/bootstrap needs an independent foundation, not just a normal service dependency graph. |
| V78 03:00–04:00 | Ben | bad control-plane deployment should not stop data access | Control and data-plane failure boundaries deserve direct tests. |
| V78 11:00–18:00 | Ben | “not as simple as clicking a button”; schema deploy/revert | A supported schema revert is not a promise that arbitrary sharding/configuration changes can be undone. |
| V19 1:13:00–1:14:00 | Uday | “required dependency … optional dependency” | Failure decisions depend on business semantics, not an unlabelled graph. |
| T09 12:00–14:00 | Ashley | “hot singleton”; “chatty interface” | Smaller partitions trade contention for coordination; no universal shard size follows. |
| T03 21:00–22:00 | Jackie | “wish for Cloudflare Postgres” | An exact vendor preference remains unsatisfied in the talk; useful Postgres access is already available elsewhere. |

**F — Prior art:** [PlanetScale revert](https://planetscale.com/changelog/revert) predates agents; its warnings and CLI/API primitives already serve them. [AWS's August 26, 2026 EKS recovery article](https://aws.amazon.com/blogs/containers/break-glass-access-for-amazon-eks-when-federated-identity-fails/) describes a tested identity-independent recovery route. [Cloudflare's April 16 PlanetScale integration](https://blog.cloudflare.com/tag/postgres/) and Hyperdrive already address managed Postgres connectivity; no checked source established a Cloudflare-operated Postgres roadmap. Broad database engines, automatic sharding, and break-glass access are occupied.

**I — Classification:** database branches, schema reverts, sharding, control-plane separation, and emergency access are **Shipped**. Application-specific rollback preconditions, recovery dependency graphs, and a hot-object workload comparison are **Open as bounded exercises/adapters**. The same primitives support P04/P17/P22/P31; exact vendor-operated Postgres remains P38, a low-ranked ambiguous request.

## 2. Prior-art audit and status discipline

**I — Status vocabulary:** **Open** means the narrow deliverable was not established as available in this bounded investigation; it is not absence proof. **Being built** names an implementation/contributor in progress. **Shipped** includes public code, documented commercial capabilities, and clearly identified internal deployments, with availability distinguished. **Roadmap** records a named owner's stated direction. An issue without an implementation is an Open request, not automatically Being built.

| Cluster | Closest thing / present owner | Status of broad category | Narrow missing evidence, if any |
|---|---|---|---|
| C1 | Cloudflare Agents/test APIs; Pi Durable; Vercel named sandboxes | Shipped; Cloudflare lifecycle changes partly Roadmap | Passive natural-transition assertion; domain receipt across a crash. |
| C2 | Workers harness/gradual deployment; durable-utils/Drizzle; Datafold/Diffy | Shipped | Reusable old/new application-state scenarios; not generating migrations. |
| C3 | MongoDB backpressure spec, PlanetScale Traffic Control, SRE patterns, Kueue | Shipped / Being built | Actual multi-layer caller behavior during recovery; no new scheduler. |
| C4 | MetricFlow, Ossie, OpenLineage, Snowplow, Icelight, sqlsure | Shipped; Ossie conformance explicitly Roadmap | Concrete sampling/invalidation/access counterexamples outside existing suites. |
| C5 | Cloudflare/Pi/Docker Code Mode, MCP resources, OpenShell | Shipped; diagnostic work Being built | Cross-runtime artifact lifetime or uncovered host-enforcement fixture. |
| C6 | Scion internally, Artifacts, ArtifactFS, Tigris differential tests | Shipped / Being built | A missing lazy-tree transition or operation-complexity measurement. |
| C7 | GitBlixt/Marin update flows, export/restore tools, generated-app platforms | Shipped; jellyware Roadmap | Owner behavior survives a real update/exit; demand and reuse unproved. |
| C8 | OTel/vLLM/Cloudflare tracing; HAMi utilization design | Shipped / Being built | Unit/identity/unknown semantics across releases; evidence outside the screened subset. |
| C9 | workerd compatibility tests, GPUI Kit actions, MemLab, FileCheck | Shipped | A whole workflow or target-host behavior omitted by existing suites. |
| C10 | CockroachDB/Vitess/PlanetScale; AWS recovery patterns | Shipped | Customer-owned recovery/retirement conditions. |

**F — npm metadata checked directly, without installation:**

| Package | Latest observed version | Publication date | What this establishes |
|---|---|---|---|
| [@cloudflare/codemode](https://registry.npmjs.org/@cloudflare%2fcodemode) | 0.5.5 | 2026-10-20 | Existing Cloudflare code-generation/execution package. |
| [durability](https://registry.npmjs.org/durability) | 5.1.0 | 2026-10-26 | Existing alarm-backed operations/WebSocket sync package. |
| [durable-utils](https://registry.npmjs.org/durable-utils) | 0.3.7 | 2026-08-22 | Existing migrations/sharding/retry utilities. |
| [@durability/storage](https://registry.npmjs.org/@durability%2fstorage) | 0.1.1 | 2026-07-21 | Published shared migration types. |
| [@cloudflare/worker-bundler](https://registry.npmjs.org/@cloudflare%2fworker-bundler) | 0.2.6 | 2026-10-07 | Runtime Worker bundling already supplied. |
| [@streamparser/json-whatwg](https://registry.npmjs.org/@streamparser%2fjson-whatwg) | 0.0.26 | 2026-08-21 | A maintained streaming-parser ingredient, not routing parity. |
| [memlab](https://registry.npmjs.org/memlab) | 2.0.5 | 2026-08-29 | Existing memory analysis; no proof of workerd child-isolate support. |
| [@d1testflare/analytics-engine](https://registry.npmjs.org/@d1testflare%2fanalytics-engine) | 2.9.0 | **2022-10-04** | A published older simulator; registry presence does not establish current-runtime fidelity. |

**I — Search coverage and limits:** performed 2026-oriented searches across GitHub, npm registry metadata, vendor documentation/changelogs/blogs, HN, and indexed X. Focused families covered hibernation assertions, old/new DO migration tests, semantic converter/governance checks, learned-query invalidation, overload/retry contracts, nested binary artifacts, OpenShell doctor probes, GPUI action testing, fork update rehearsals, data reconciliation, tenant cutover, heap profiling, and model retirement. Followed exact sources rather than treating snippets as implementations. HN's current Scion/Mononoke discussion is a discovery/counterclaim source, not proof of novelty or ownership; the primary Anthropic article itself acknowledges predecessors. X-targeted searches for Cloudflare migration/hibernation did not yield a usable primary implementation. This is incomplete social coverage, not a negative finding about what exists privately.

**I — Retrieval failures retained:** some canonical Cloudflare subpages returned fetch errors while search exposed preview deployments; conclusions use canonical pages/adjacent official documentation rather than treating a docs preview as a release. The Ghostfolio rehearsal skill could not be verified at its linked origin. No package or sandbox was installed. No source silence is treated as a market result.

## 3. Projects of every size

All proposals, beneficiary claims, owner arguments, demos, and kill tests are **I/E**. Each demo is a **30-second presentation of a prepared fixture**; setup, real idle intervals, and load windows may take longer. Prior-art capabilities are **F** only to the scope of the linked source. Scores are **E**, 1–5 in order **C/A/G/V/M/N** = cool / Cloudflare–Vercel–TypeScript adjacent / real gap / value / survives better models / not GrowOS. All are outside a generated OS/kernel project. A high problem-resilience score is not a moat for a thin implementation.

### P01 — Passive hibernation assertions — Tiny / Open request; upstream destination

**Q:** Ashley, T09 15:00–16:00: “memory starts fresh”; Justin, T11 28:00: “eternally booting itself up.” The precise missing test API is external evidence in [Agents #1956](https://github.com/cloudflare/agents/issues/1956) and [workerd #5835](https://github.com/cloudflare/workerd/issues/5835).

**I — Sentence / beneficiary / owner:** expose eligibility and natural lifecycle transitions without a call that wakes the DO, for framework/application maintainers. Cloudflare is the natural owner; the opportunity is an upstream contribution, not something it cannot build. **E — Demo:** a plain room sleeps, a dependency timer blocks it, and the observer reports the difference while the socket remains usable after reconstruction. **F — Closest:** [existing counter-based reproduction](https://github.com/bohdanbirdie/cf-do-hibernation-repro) and forced-eviction helpers. **E — Start / kill:** inspect the real hibernation decision hook; prove observation leaves liveness unchanged. Stop if a supported hook already exists, an accepted implementation covers it, or the observer itself retains the object. **Scores: 4/5/3/4/5/5 = 26.**

### P02 — Mixed-version DO migration rehearsals — Big / Open, conditional

**Q:** Dillon, T13 15:00: “version skew”; Slack, V35 49:00: “some new versions and some old versions.”

**I:** run owner-defined identity/data invariants over old/new callers, objects, and seeded legacy state, for teams maintaining many tenant DOs. Cloudflare supplies the runner but cannot infer customer identity laws; it can still absorb the adapter. **E — Demo:** all-new lowercase-name tests pass; an old registry/new caller scenario creates a duplicate or loses a lookup; compatible normalization fixes it. **F — Closest:** [Workers harness/state preparation](https://developers.cloudflare.com/workers/testing/test-harness/prepare-test-state/), Drizzle/durable-utils, Jepsen methods. **E — Start / kill:** reproduce one normalization case and one old/new RPC case with stable persisted identity. Stop if ordinary harness configuration covers both trivially, if the fixture changes singleton semantics, or no second maintainer supplies a real case. **Scores: 4/5/3/4/5/5 = 26.**

### P03 — Sampling exactness fixtures — Tiny / Open, conditional

**Q:** Kevin, T12 12:00: “weren't counting people properly”; “jumped like seven times.”

**I:** produce an explicit counterexample when an exact metric cannot survive the declared ingestion/index/sampling path, for Workers analytics maintainers. Cloudflare can add this, but the metric identity contract crosses customer code and storage choices. **E — Demo:** two full histories have different distinct-user counts yet yield the same retained weighted sample; weighted event totals work, exact people counting is rejected. Then verify a full-input D1 dedup lane. **F — Closest:** [WAE sampling](https://developers.cloudflare.com/analytics/analytics-engine/sampling/), [sqlsure](https://github.com/sqlsure/sqlsure), existing analytics packages/simulator. **E — Start / kill:** implement the two-history fixture and inspect existing simulator/checker tests. Stop if existing tooling expresses the same witness cheaply or users only require approximate trends. Do not claim to reproduce TELUS's unspecified query. **Scores: 3/5/3/4/5/5 = 25.**

### P04 — Recovery-load envelope — Big / Open packaging over mature mechanisms

**Q:** Newman, V20 55:00: “resource pools are not infinite”; Ben, V78 09:00: “rest of your stack has to be built to support that.”

**I:** rehearse the actual proxy/SDK/app/database retry chain under cold-cache recovery, checking goodput and queue/connection ceilings, for API/platform teams. Providers cannot see all customer retry layers, although load-test vendors can add this. **E — Demo:** a recovered DB immediately collapses under compounded retries; cap/coalesce/back off and the same workload drains. **F — Closest:** [MongoDB's 2026 backpressure contract](https://github.com/mongodb/specifications/blob/master/source/client-backpressure/client-backpressure.md), PlanetScale Traffic Control, k6, SRE practice. **E — Start / kill:** one real TypeScript caller plus seeded overload/lost acknowledgements. Stop if existing load scripts expose the complete recovery envelope with comparable effort or the adapter cannot observe attempts at each layer. **Scores: 4/5/3/4/5/5 = 26.**

### P05 — Executed semantic conversion counterexamples — Tiny / Roadmap overlap; contribute

**Q:** dbt presenter, V03 19:00: “lossiness between conversions”; “enforcement.”

**I:** contribute one source/destination metric-and-caller fixture showing a changed value, grain, or allowed view. Beneficiaries are semantic converter maintainers; the neutral corpus crosses vendors, but Ossie already owns the general direction. **E — Demo:** structurally valid conversion passes schema validation, then one join/fan-out or caller fixture differs. **F — Closest:** [Ossie converters](https://github.com/apache/ossie/blob/main/converters/README.md) and [conformance roadmap](https://github.com/apache/ossie/blob/main/ROADMAP.md). **E — Start / kill:** choose two implemented converters and a tiny dataset; inspect their tests before adding anything. Stop the standalone-project idea if the planned suite already covers the property; submit only a missing example. **Scores: 3/4/2/5/5/5 = 24.**

### P06 — Invalidate learned data-query skills when meaning changes — Big / Open, low novelty confidence

**Q:** Andrew Qu, V68 10:00–11:00: “distill them into a skill”; V68 15:00: “company knowledge.”

**I:** bind learned queries to semantic definitions, joins, owner-approved examples, and source revisions so changed meaning triggers rehearsal before reuse. Data teams benefit; a model/harness vendor cannot supply company definitions, but catalogs may already provide most of the feature. **E — Demo:** an “active customer” skill still runs after a definition change yet fails its old/new owner cases. **F — Closest:** [OpenLineage's 2026 dbt facets](https://openlineage.io/docs/releases/1_46_0/), MetricFlow, Vercel's existing skill mining. **E — Start / kill:** take ten real skills, retain their assumptions, change one metric and one join. Stop if existing lineage already reaches the skill artifact and invokes semantic fixtures, or if owners will not maintain examples. **Scores: 4/5/2/4/5/5 = 25.**

### P07 — Semantic-consumer upgrade rehearsal — Small / Open integration, compatibility tooling shipped

**Q:** audience, V03 17:00–18:00: “Hex doesn't parse the new specification.”

**I:** run a user's actual notebooks/cells against a semantic project/version pair before cutover. Analytics teams benefit; the useful evidence crosses vendor releases, though either vendor could add it. **E — Demo:** a project validates and SQL compiles, but one retained cell fails parsing or changes a metric. **F — Closest:** [Hex/dbt integration guidance](https://learn.hex.tech/docs/connect-to-data/data-connections/dbt-integration), Ossie converters. **E — Start / kill:** establish exactly what the reported “V2” means and reproduce one real artifact. Stop if migration guidance plus ordinary cell replay is sufficient, or no current incompatibility can be demonstrated. **Scores: 3/4/2/4/5/5 = 23.**

### P08 — Business examples as a semantic-definition review surface — Small / Open, weak demand test

**Q:** V03 audience 16:00: “non-technical users are the ones with the knowledge.”

**I:** let a metric owner approve/dispute concrete examples and see the resulting executable definition read back into a PR. Business/data teams benefit; the platform cannot choose their definition, but glossary/catalog vendors are close owners. **E — Demo:** finance disputes a refund example, approves the corrected total, and sees the linked metric fixture change. **F — Closest:** MetricFlow authoring, Ossie governance, existing catalog review workflows. **E — Start / kill:** run one disputed metric review with two people. Stop if an ordinary document plus PR comment works as well, if no repeat disagreement exists, or if the tool silently appoints an authority. **Scores: 2/3/2/4/5/5 = 21.**

### P09 — Event-to-answer observation coverage — Small / Open integration

**Q:** Micah, T05 06:00: “fundamentally missing the data”; 17:00: “code that's collecting the data.”

**I:** join producer revision, transform, observed arrival, metric definition, and observation interval in a small evidence bundle. Teams adding instrumentation through agents benefit; no cloud knows the intended business event or unrecorded past. **E — Demo:** last week's explanation is marked unsupported because tracking began today; a synthetic checkout proves the current path. **F — Closest:** [Snowplow Micro](https://docs.snowplow.io/docs/testing/snowplow-micro/automated-testing/), [OpenLineage](https://openlineage.io/docs/releases/1_46_0/), [Icelight](https://github.com/cliftonc/icelight). **E — Start / kill:** add one producer-to-query fixture using existing lineage facets. Stop if existing event tests already produce the same coverage answer or historical coverage cannot be evidenced. **Scores: 3/5/2/4/5/5 = 24.**

### P10 — Numeric transformation integrity fixture — Tiny / Open narrow wrapper

**Q:** Karpathy, V62 59:00–1:01:00: a supplied `NA` becomes `0.1`, and prose disagrees with the plotted value.

**I:** preserve source cells and approved transforms, then bind reported numbers/units to runtime outputs. Analysts and generated-report reviewers benefit; this crosses model, code, chart, and prose, though analysis tools can implement it. **E — Demo:** flag an unauthorized imputation and a trillion/billion mismatch while accepting an explicit imputation rule. **F — Closest:** [DataTriage](https://github.com/arysbey/DataTriage), data-quality/cleaning histories and ordinary assertions. **E — Start / kill:** reproduce the two captioned error classes with a tiny table. Stop if a notebook's existing provenance/value binding already catches both or the checker mostly becomes another model's opinion. **Scores: 3/4/2/4/5/5 = 23.**

### P11 — Scoped artifact handoff through nested Code Mode — Small / Open, integration-dependent

**Q:** King, V47 10:00–11:00: “double sandboxing”; “signed image handoff.”

**I:** preserve one artifact's identity, permission, expiry, and display through a server-side and harness-side Code Mode composition. MCP/harness maintainers benefit; neither side alone owns the cross-runtime contract, but both can standardize it. **E — Demo:** a large generated image appears in the user UI without model-visible base64; an expired or wrong-session handle fails. **F — Closest:** [MCP resource links](https://modelcontextprotocol.io/specification/2025-06-18/server/tools), [Pi's October account](https://lucumr.pocoo.org/2026/10/6/codemode/), existing result envelopes. **E — Start / kill:** implement one actual server/harness pair and measure materializations. Stop if ordinary resource links already preserve every needed property or a second adapter shares no useful code. **Scores: 4/5/3/4/4/5 = 25.**

### P12 — Direct versus composed permission fixtures — Tiny / Open contribution

**Q:** King, V47 09:00: “in the sixth operation it is not.”

**I:** run the same owner-declared sequence directly, in Code Mode, and through a nested wrapper, then compare actual effect logs. Runtime maintainers benefit; cross-provider semantic comparison is external, but policy owners can absorb it. **E — Demo:** a denied operation remains denied directly yet executes under whole-script approval; the report explains the documented policy difference. **F — Closest:** [Docker's explicit approval semantics](https://docker.github.io/docker-agent/features/code-mode/), existing per-call policy systems. **E — Start / kill:** three synthetic tools and one state-changing authorization condition. Stop if the runtime's existing conformance tests already cover the paths. This is not a new authorization engine or a general information-flow runtime. **Scores: 3/5/2/4/5/5 = 24.**

### P13 — Workload capability probes for the real sandbox host — Tiny / Being built; upstream

**Q:** Josh, V84 06:00: doctor “everything's green”; V83 01:00: local container prerequisites.

**I:** contribute an uncovered allowed/denied operation probe and actionable host/VM diagnosis. OpenShell and sandbox users benefit. The owner should implement it; external value is a real host fixture it lacks. **E — Demo:** Docker responds but the disposable workload reveals missing VM enforcement support; the corrected setup passes both positive and negative tests. **F — Closest:** [OpenShell #4133](https://github.com/NVIDIA/OpenShell/issues/4133), ongoing contributor probes, partial startup-message fix #4413. **E — Start / kill:** inspect current tests and reproduce the still-uncovered networking/error-propagation path. Stop if that path is already covered; do not create a standalone sandbox platform. **Scores: 3/5/2/4/5/5 = 24.**

### P14 — Retained-heap regression fixture for Dynamic Worker SSR — Tiny / Open adapter hypothesis

**Q:** Fabian, T06 17:00: compiler/highlighter in the server bundle caused “out of memory errors.”

**I:** attach a repeatable render scenario and import-to-retention explanation to a Worker bundle change. Hosting/framework maintainers benefit; customer scenarios are distributed, but Cloudflare/TanStack own the instrumentation. **E — Demo:** build checks pass, the cold-render fixture retains a compiler, and moving the dependency removes the measured regression. **F — Closest:** [MemLab](https://github.com/meta/memlab), Workers heap snapshots/profiling, TanStack import protection. **E — Start / kill:** prove the inspector targets the actual dynamically loaded child isolate. Stop if it cannot, if allocation is mistaken for retention, or existing tools produce the explanation with trivial configuration. **Scores: 4/5/2/4/5/5 = 25.**

### P15 — Whole in-memory dev-loop host conformance — Tiny / Open fixture; runtime category shipped

**Q:** Theo, V88 46:00: “see if this will actually run on Cloudflare.”

**I:** run the same read-only check/bundle/serve/edit/recheck workflow on Node, browser, and workerd, retaining failures and host limits. Toolchain maintainers benefit; no runtime owner can certify every other host's whole workflow. **E — Demo:** a Node pass becomes a workerd capability or memory failure at an exact step. **F — Closest:** [workerd compatibility tests](https://github.com/cloudflare/workerd/blob/main/src/node/README.md), WPT, existing browser development platforms. **E — Start / kill:** pin the actual TS Rust/just-bash/bundler artifacts and one app. Stop if current project tests already run this workflow or the result is only unsupported native APIs already declared. **Scores: 4/5/2/4/4/5 = 24.**

### P16 — GPUI native-action and scaling fixtures — Tiny / Shipped test guidance; missing cases conditional

**Q:** Scott, V57 27:00–30:00: “I don't have the font size”; “requires a small patch.”

**I:** add reproducible focus, edit/undo, dialog-return, and scaling/clipping cases comparing semantic assertions with actual platform behavior. GPUI component users benefit; this is framework-owner territory and should be contributed. **E — Demo:** a tree reports an editable control while real keyboard focus or large text breaks it; the native fixture catches it. **F — Closest:** [GPUI Kit's detailed action tests](https://github.com/longbridge/gpui-kit/blob/main/docs/ACCESSIBILITY-UI-TESTING.md). **E — Start / kill:** reproduce one missing native case on a pinned signed app. Stop if the current guide/tests cover it or if only another generic tree-driving wrapper remains. Cross-platform accessibility claims require platform-specific evidence. **Scores: 3/3/2/4/5/5 = 22.**

### P17 — Cache-aware tenant cutover witness — Big / Open, operator-dependent

**Q:** Beamonte, T10 31:00: “freshness … expiration”; 42:00: per-key lifetime controls; 43:00: “interaction between businesses.”

**I:** produce a counterexample to declared tenant-move/old-cell-retirement conditions across aliases and cache tiers. Cellular SaaS operators benefit; the cloud cannot infer their placement authority, aliases, or cross-tenant operations. **E — Demo:** a moved tenant's stale webhook alias still reaches the retired cell after a successful probe elsewhere. **F — Closest:** [AWS cell guidance](https://docs.aws.amazon.com/solutions/cell-based-architecture-on-aws/), [KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/), Conftest/Batfish. **E — Start / kill:** model fresh/stale/expired states and one real router adapter. Stop if ordinary existing fixtures suffice or two operators cannot share a useful contract. Ramp reports an unused migration mode, not a failed cutover; do not invent an outage. **Scores: 4/5/3/4/5/5 = 26.**

### P18 — Bounded body-routing parity corpus — Tiny / Open contribution

**Q:** Beamonte, T10 26:00: “no routing key”; “end of the payload”; 40:00: “same fixture test … both routers.”

**I:** check destination/fallback and forwarded bytes across two implementations under late/missing keys and adversarial chunk boundaries. Proxy migration teams benefit; third-party request contracts cross vendors, although gateway maintainers can own the corpus. **E — Demo:** fallback after partial parsing drops a prefix and invalidates a signed webhook; the runner returns the minimal case. **F — Closest:** [APISIX body routes](https://docs.api7.ai/apisix/reference/router-options), [Envoy ext_proc](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/ext_proc_filter), streamparser. **E — Start / kill:** twenty synthetic fixtures over a Worker and origin router. Stop if current gateway/parser tests already cover the transitions or nobody maintains two paths. Inspected bytes are not a hard whole-isolate memory bound. **Scores: 3/5/2/4/5/5 = 24.**

### P19 — Lazy Git working-tree transition fixtures — Tiny / Shipped suites; narrow gaps conditional

**Q:** Jackie, T03 11:00: “custom mounting”; Anthropic account, V87 12:00: partial clones break history operations.

**I:** add a missing native-versus-lazy edit/reset/commit fixture with explicit adapter capabilities. Workspace providers benefit; the corpus spans implementations but belongs naturally in existing tests. **E — Demo:** executable/symlink/EOL behavior diverges after hydration/reset, with exact bytes and Git objects shown. **F — Closest:** [ArtifactFS E2E tests](https://github.com/cloudflare/artifact-fs), [Tigris fs-correctness](https://github.com/tigrisdata/fs-correctness), pjdfstest. **E — Start / kill:** port five transitions to an existing suite. Stop if differences are solely documented limitations or all transitions already run. Do not build another filesystem, mount, or Git host. **Scores: 3/4/2/3/5/5 = 22.**

### P20 — Checkout wait and operation-complexity report — Tiny / Open report wrapper

**Q:** Theo, V87 33:00: “almost 1,000 hours … waiting for Git checkouts.”

**I:** attribute real CI time and network/history operations before choosing a new checkout strategy. Small engineering teams benefit; cross-forge job context is external, but CI vendors can add it. **E — Demo:** one project's checkout wall wait, billed runner time, transferred bytes, and history-dependent failures separate into distinct columns. **F — Closest:** existing CI step timings, ArtifactFS, forge APIs, Scion's internal measurements. **E — Start / kill:** analyze a bounded CI export and compare ordinary step reports. Stop if the extra attribution changes no decision or existing reports expose the same information. No savings estimate should treat parallel waiting as serial human time. **Scores: 2/4/2/3/5/5 = 21.**

### P21 — Current-tip revert rehearsal — Small / Known narrowed survivor

**Q:** Sumner, V71 17:00: “easier to … roll back”; V87's account describes automated bisection/revert.

**I:** show that a proposed revert repairs the current tip without breaking dependent accepted changes. Release maintainers benefit; repository-owned tests and dependencies cross a generic queue's view, but queue vendors can add this. **E — Demo:** reverting the original culprit alone breaks a later dependent patch; a minimal safe revert set passes the current acceptance cases. **F — Closest:** [LUCI culprit machinery](https://chromium.googlesource.com/infra/luci/luci-go/), Graft/Mogplex and merge-queue bisection identified in the stack background. **E — Start / kill:** reproduce one dependent-revert history. Stop if existing queue/revert tooling already rehearses against the current tip. Broad post-merge integration remains occupied. **Scores: 4/4/2/4/5/5 = 24.**

### P22 — App/schema branch and revert-window fixtures — Small / Open application adapter

**Q:** Ben, V78 16:00–17:00: “oneclick revert”; “keep it in sync with your codebase.”

**I:** check old/new application behavior across a supported schema deployment/revert with intervening writes. SaaS teams benefit; the database cannot know each app's old readers and feature flags. **E — Demo:** schema revert succeeds but an old app cannot interpret new rows; the fixture exposes the actual compatibility condition. **F — Closest:** [PlanetScale deploy/revert primitives](https://planetscale.com/changelog/revert), existing branch/online migration tools. **E — Start / kill:** one additive and one destructive transition with explicit supported windows. Stop if the provider's existing examples plus normal app tests already prove the intended cases. Do not generalize schema reversibility to arbitrary sharding operations. **Scores: 3/5/2/4/5/5 = 24.**

### P23 — Session-created resource ownership and cleanup cases — Small / Open external-resource slice

**Q:** Carey, V48 23:00: “anything else we made in this session.”

**I:** join observed resource creation to a run owner and reconcile cleanup after interruption, for teams whose agents call arbitrary cloud APIs. The platform lacks other vendors' state and a user's keep/adopt decisions; IaC vendors may nevertheless cover the use case. **E — Demo:** a run creates a Worker and external queue, crashes, then reports what remains, what was adopted, and what a retry would recreate. **F — Closest:** IaC stack destruction, [Vercel's managed worker cleanup](https://vercel.com/changelog/run-cursor-cloud-agents-vercel-sandbox), existing run-resource leases in the background. **E — Start / kill:** one cross-vendor fixture with owner epochs/readback. Stop if plain tags, TTLs, and startup reconciliation suffice. This does not revive a general agent resource platform. **Scores: 3/5/2/4/5/5 = 24.**

### P24 — Personalized-fork update contract — Small / Open, weak demand

**Q:** V51 host 12:00: frontend/backend contracts “stable”; V49 host 11:00: “own the dependency.”

**I:** stage one upstream update against owner-customized behavior and service assumptions before applying it. Fork owners benefit; personal expectations are outside the upstream platform, though maintainers can ship fixtures. **E — Demo:** a conflict-free merge silently removes a customized action or breaks its backend call; the owner's fixture flags it. **F — Closest:** [GitBlixt update merging/deployment](https://www.gitblixt.com/docs/instance-updates), Marin fork maintenance. **E — Start / kill:** one maintained fork, one real update, three owner scenarios. Stop if ordinary CI covers them or every owner needs a bespoke application test suite with no reusable adapter. A fork installer or merge bot is already taken. **Scores: 3/5/2/3/5/5 = 23.**

### P25 — Executable exit and continuity drill — Small / Open narrow workflow

**Q:** Skidmore, T02 16:00: “exit from the vendor”; 18:00: “keep a way out.”

**I:** export, restore into a replacement, and perform owner-approved operations including relationships, attachments, and access. Internal-tool owners benefit; application semantics and destination hosts cross provider boundaries. **E — Demo:** row counts match yet an approval attachment or permission is missing; the restored operation fails until the mapper is fixed. **F — Closest:** [AirBridge](https://github.com/he8um/AirBridge/blob/main/docs/overview.md), D1 export, pgcopydb/Datafold. **E — Start / kill:** one actual replaceable app and a timed manual baseline. Stop if backup already provides continuity or mappings become consulting. Tiny variants: verify a private-to-public source projection's outgoing metadata; rehearse recovery of an OSS project's source, assets, and discussions. Neither warrants another Git host. **Scores: 3/4/2/4/5/5 = 23.**

### P26 — Disposable-to-durable promotion contract — Ambiguous / Open specification problem

**Q:** Max, V79 12:00: “thought this was going to be disposable and now it needs to be durable.”

**I:** detect a concrete change that invalidates an app's promised data scope, lack of production callers, fallback, or retirement path. Personal-app teams benefit; only owners can define those promises, but generated-app platforms can implement the check. **E — Demo:** a new shared caller invalidates “only for me”; the report requires a retention/export decision. **F — Closest:** software catalogs, sandbox scopes, exit drills, platform publication controls. **E — Start / kill:** instrument one app's real dependency transition. The ambiguity resolves when an owner supplies an observable promotion rule and a repeat incident; stop if this reduces to a lifecycle field/checklist. **Scores: 4/4/2/3/5/5 = 23.**

### P27 — GPU telemetry upgrade semantic fixtures — Tiny / Being built adjacent; upstream

**Q:** Jelveh, V77 10:00–16:00: operator updates break metrics; “reports unknown.”

**I:** check unit, denominator, identity, scope, and unknown-vs-zero across a supported operator/HAMi upgrade. Platform SREs benefit; cross-vendor fixtures are useful externally, but HAMi explicitly owns this direction. **E — Demo:** a metric keeps its name while a known workload loses Pod identity or becomes an unsupported zero; the semantic test fails. **F — Closest:** [HAMi utilization design/test plan](https://project-hami.io/docs/developers/gpu-utilization-metrics), FAQ and dynamic-MIG compatibility work. **E — Start / kill:** one available device/mode before/after pair. Stop if current E2E tests assert the same semantics or hardware is unavailable. Publish unknowns rather than claiming normalized percentages are equivalent. **Scores: 3/3/3/4/5/5 = 23.**

### P28 — Shared-batch interference and excluded-work evidence — Small / Open diagnostic slice

**Q:** Utekar, V76 09:00: “per request traces can't see the batch dynamics.”

**I:** link request delays to batch/preemption/host events and controlled disturbances, for inference SREs. Engine vendors can build it; external value is a portable labelled workload and honest causal limits. **E — Demo:** requests remain HTTP 200 while a long prefill delays another tenant; the report shows overlap and measured controlled-run differences. **F — Closest:** [vLLM request metrics](https://github.com/vllm-project/vllm/blob/main/docs/features/per_request_metrics.md), existing profilers/load harnesses. **E — Start / kill:** one engine with traceable schedule steps and a matched no-disturbance control. Stop if current profilers already expose the attribution. A Sentry variant accounts for discarded-stage samples and reviewer spend; it needs independent labels and sampling probabilities, not a new classifier. **Scores: 4/2/3/4/5/5 = 23.**

### P29 — Small-RPC coordination tax case study — Tiny / Open workload report

**Q:** Ousterhout, V67 03:00–05:00; 17:00: small-message tails can waste GPU time; he asks whether this limits users.

**I:** measure barrier-critical small RPCs and GPU idle intervals before proposing a transport migration. Inference platform engineers benefit; the application-level evidence sits outside the transport owner, but profilers may already produce it. **E — Demo:** one recorded phase shows observed wait, then an assumption-labelled ceiling on recoverable time. **F — Closest:** [HomaModule performance tooling](https://github.com/PlatformLab/HomaModule), Nsight and engine profilers. **E — Start / kill:** inspect one real synchronization trace. Stop if existing profiling gives the same attribution or the workload is bandwidth/compute limited. A large RPC microbenchmark speedup is not an application speedup. **Scores: 4/2/2/3/5/5 = 21.**

### P30 — Legacy-model retirement rehearsal — Ambiguous / Open, low confidence

**Q:** Michelle, V12 27:00: models sit “eating up GPU space.”

**I:** compare retained user demand, minimum serving footprint, migration acceptance cases, and newly admitted work before retiring an old model. Serving operators benefit; user preferences are not in a generic capacity calculator, but operators are the obvious owners. **E — Demo:** a proposed retirement frees capacity yet fails one owner's behavior case; the planner presents an explicit keep/migrate trade-off. **F — Closest:** vLLM/serving capacity planning and [Microsoft's 2026 datacenter lifecycle research](https://www.microsoft.com/en-us/research/wp-content/uploads/2026/03/AI-DC-Lifecycle-Compass.pdf), identified in E02. **E — Start / kill:** obtain one operator's anonymized catalog/demand snapshot. Resolve ambiguity by finding a repeat retirement decision; stop if existing internal tooling already joins these inputs or the operator will not expose them. **Scores: 3/4/2/3/5/5 = 22.**

### P31 — Recovery-path dependency drill — Small / Open cross-system checker

**Q:** Mattis, V22 23:00: independent “foundation Bigtable”; Orosz, V20 1:30:00: recovery depended on the failed domain.

**I:** remove a declared dependency and show the prerequisite chain preventing a specific recovery action. On-call/platform teams benefit; DNS, identity, vault, console, communications, and manual access span vendors. **E — Demo:** production is down and the operator cannot retrieve the runbook/credential because the recovery path shares the failed IdP; an independent route survives. **F — Closest:** [AWS's 2026 tested EKS recovery pattern](https://aws.amazon.com/blogs/containers/break-glass-access-for-amazon-eks-when-federated-identity-fails/), emergency access guidance, ordinary graph checks. **E — Start / kill:** model one actual recovery procedure, not the normal traffic graph. Stop if the existing runbook/drill already exposes the same chain or the tool has no trustworthy dependency inventory. The Meta anecdote is not independently validated here. **Scores: 4/4/3/4/5/5 = 25.**

### P32 — Retry versus repeated-intent corpus — Tiny / Open corpus, mechanism shipped

**Q:** Newman, V20 1:13:00–1:15:00: a legitimate second equal-value purchase; twenty identical EC2 creations.

**I:** publish owner-labelled histories for true retries, distinct identical intents, changed payloads under one key, expiry, and concurrency. Adapter developers benefit; domain operation identity is external to the provider, but providers can adopt the cases. **E — Demo:** a fingerprint incorrectly suppresses a second intended operation while a stable retry key correctly suppresses a lost-ack retry. **F — Closest:** [Stripe idempotency contracts](https://docs.stripe.com/api/idempotent_requests), existing durable-effect test helpers. **E — Start / kill:** five cases against one real adapter. Stop if its current tests already cover them. The introductory caption suggesting avoiding keys is contradicted by Newman's substantive recommendation: keys are preferred; fingerprints are a retrofit. **Scores: 3/4/2/4/5/5 = 23.**

### P33 — Dated business-failure behavior fixtures — Tiny / Open workflow

**Q:** Orosz, V20 1:23:00: Uber moved from fail-open during growth to fail-closed for profitability.

**I:** keep outage expectations with their business owner, rationale, and explicit reconsideration trigger. Product/platform teams benefit; no cloud can choose the correct commercial trade-off. **E — Demo:** the service's fallback still works technically but violates the new high-value-payment expectation; the fixture identifies the expired rationale. **F — Closest:** [OPA policy tests](https://www.openpolicyagent.org/docs/policy-testing), feature flags, ADRs. **E — Start / kill:** three real failure decisions and one strategy-change trigger. Stop if ordinary policy tests plus an owner review already provide the value or the trigger cannot be stated concretely. **Scores: 3/4/2/4/5/5 = 23.**

### P34 — Read-only generated-app retention plan — Small / Open integration, low urgency

**Q:** TELUS, T12 12:00: “every app version anyone's ever shipped”; Lovable, T06 08:00: latest publication lookup.

**I:** traverse publication, rollback, preview, shared-asset, and declared capability roots before proposing retirement of R2 bundles. Dynamic-app operators benefit; application-specific roots are outside storage lifecycle rules. **E — Demo:** keep an old pinned rollback and a shared asset; reject a plan made stale by a new publication. **F — Closest:** [R2 lifecycle rules](https://developers.cloudflare.com/r2/buckets/object-lifecycles/), [Distribution GC](https://distribution.github.io/distribution/about/garbage-collection/), Backstage orphan cleanup. **E — Start / kill:** two anonymized inventories compared with last-N retention. Stop if no material debt exists or roots cannot be enumerated consistently. Unknown references mean keep/unknown; the initial deliverable performs no deletion. **Scores: 3/5/2/3/5/5 = 23.**

### P35 — Creation-to-ready semantic benchmark — Tiny / Shipped platform change; contribution only

**Q:** Slack, V51 09:00: startup is the “number one complaint”; Josh, V84 06:00: green diagnostics can precede creation failure.

**I:** measure create acceptance, restore completion, usable command, file persistence, and resume independently under pinned SDK/runtime versions. Sandbox consumers benefit; neutral comparisons cross vendors, but every provider can improve its own tests. **E — Demo:** apparent creation latency worsens while create-through-command is unchanged because restoration moved between API stages. **F — Closest:** [Vercel's October 8 change](https://vercel.com/changelog/sandbox-create-waits-until-ready), ComputeSDK provider benchmarks. **E — Start / kill:** add readiness/error-phase assertions to an existing benchmark. Stop if its current definitions already cover the transition. This is not another cold-start leaderboard. **Scores: 3/5/2/3/4/5 = 22.**

### P36 — A portable agent architecture abstraction — Ambiguous / Open question, crowded supply

**Q:** Sunil, V49 04:00–05:00: “no one has built the React yet”; “across languages … infrastructure.”

**I:** investigate whether one small compositional contract expresses a real application across two runtimes without hiding effect/ownership differences. Framework authors might benefit; neither vendor owns a neutral contract, but standards and existing frameworks are active competitors. **E — Demo:** the same bounded app runs on two hosts and visibly reports an unsupported lifecycle behavior. **F — Closest:** Pi Durable adapters, Cloudflare framework integrations, Vercel Eve as described in V68, [Standard Agents' unreleased specification](https://docs.standardagentbuilder.com/introduction/overview). **E — Start / kill:** pick an application before inventing an API. Resolve ambiguity by identifying a behavior current adapters cannot express cleanly. Stop if the result is a wrapper or requires writing another general harness. **Scores: 5/5/1/2/2/5 = 20.**

### P37 — Runtime architectural-obligation witness — Small / Open narrow semantics

**Q:** Anthropic account, V87 34:00–35:00: log scan instead of the authoritative review API; Armin, V82 1:26:00–1:28:00: a shim destroys the intended design.

**I:** record a small owner-declared runtime obligation—required query path, state owner, or bounded operation—and return an actual counterexample. Maintainers benefit; semantic obligations belong to them, though testing vendors can implement the observer. **E — Demo:** examples pass while a generated fallback scans the commit log or accesses shared ambient state; the trace violates the owner rule. **F — Closest:** [dependency-cruiser](https://github.com/sverweij/dependency-cruiser), architecture fitness functions, contract tests. **E — Start / kill:** prove one violation beyond static import rules. Stop if an existing lint rule or ordinary spy assertion provides all the value. Small variants check Uber branch-routing baggage and supported-but-unseen business combinations. **Scores: 4/4/2/4/5/5 = 24.**

### P38 — Cloudflare-operated Postgres wish — Ambiguous / Exact wish open; useful capability shipped

**Q:** Jackie, T03 21:00–22:00: “I do wish for Cloudflare Postgres.”

**I:** test what actual operational requirement is missing from existing managed Postgres plus Hyperdrive, rather than proposing another database. Workers developers benefit; the exact branded service would be Cloudflare's decision and is unsuitable for an individual side project. **E — Demo:** one workflow is compared against PlanetScale/Neon integrations and the unmet requirement is shown, or the wish disappears. **F — Closest:** Cloudflare's [PlanetScale/Workers integration listing](https://blog.cloudflare.com/tag/postgres/), Neon/Hyperdrive and managed Postgres vendors. **E — Start / kill:** name one requirement beyond vendor consolidation. Resolve ambiguity through a reproducible missing capability; stop immediately if existing integration satisfies it. No examined source established a Cloudflare managed-Postgres commitment. **Scores: 3/5/1/3/2/5 = 19.**

### P39 — Emitted-code obligation example — Tiny / Shipped mechanism; packaging contribution

**Q:** Mattis, V22 1:28:00–1:29:00: inspect “decompiled code” for a test-time abstraction.

**I:** publish a library-level example binding one elimination obligation to compiler/target-specific emitted-code evidence. Systems library authors benefit; workload obligations are external, but compiler tools already own the mechanism. **E — Demo:** a test-only branch compiles away in release; a deliberate change leaves a call/symbol and fails. **F — Closest:** [FileCheck](https://www.llvm.org/docs/CommandGuide/FileCheck.html), [Rust codegen tests](https://rustc-dev-guide.rust-lang.org/tests/compiletest.html), cargo-show-asm. **E — Start / kill:** wrap one actual obligation using those tools. Stop if the wrapper is trivial; publish only a checked example/blog with data. Avoid a generic compiler-verification product. **Scores: 4/3/2/3/5/5 = 22.**

### P40 — Agent bid versus owner-priority fixture — Tiny / Open adapter, scheduler shipped

**Q:** Jane Street, V08 35:00–36:00: agents overvalue jobs and preempt human work.

**I:** check proposed bids against owner-set urgency/value ceilings and explain displaced work beside the existing scheduler. Compute-platform teams benefit; only owners know business priority, but a fixed quota may already solve the issue. **E — Demo:** a routine agent job proposes a bid that displaces an urgent human task; the adapter returns the violated ceiling and a permitted bid. **F — Closest:** fair-share/priority systems, [Run:ai scheduling](https://docs.nvidia.com/run-ai/self-hosted/documentation/platform-management/runai-scheduler/scheduling/concepts-and-principles), Kueue admission. **E — Start / kill:** replay ten observed proposals with owner labels. Stop if a constant cap gives the same outcomes or no repeated mispricing survives current models. No new auction/scheduler is proposed. **Scores: 4/4/2/4/5/5 = 24.**

## 4. Predictions board: consequences rather than promises

**I — Reading rule:** a prediction identifies a conditional obligation, not an empty market. The complete prediction/roadmap screening board follows the signal register. These high-consequence claims connect it to project choices; repeated appearances by one speaker remain one forecast.

| Q — claim and source | By whom / timing | I — what must exist if true | Present ownership / project consequence |
|---|---|---|---|
| Agent traffic and software volume keep rising — T01 01:00–06:00; T09 01:00–04:00; T12 23:00 | Cloudflare speakers; TELUS Andrew | Admission, skew isolation, storage lifecycle, and recoverable operations | Runtime/hosting supplied; P04/P17/P34 check the boundary. |
| Agent development pressure spreads beyond labs — V87 11:00; 46:00–47:00 | Anthropic account; next 6–12 months | Incremental metadata APIs, sparse operations, builds/CI that avoid global serialization | Scion/Artifacts/forges already own the broad infrastructure; P19/P20/P21 are narrow. |
| Execution machines can cost more than inference — V85 25:00; V88 23:00–27:00 | Theo; unspecified horizon | Actual task-scoped resource accounting and compatible lower-overhead execution | Forecast is not current fleet economics; measure P14/P15/P35 before proposing a runtime. |
| CPU capacity is constrained now — V50 18:00; 54:00 | Lesse | Efficient complete workflows and capacity/admission policies | Existing pools/profilers; P04/P40. |
| More agent work moves off laptops — V66 17:00; V51 03:00 | Katz: 90% within six months; Slack: local development fades | Durable remote execution with target-device escape hatches | Shipped vendor category; P13/P15/P35 test actual capabilities. |
| Stateful actors/dynamic code spread across platforms — V49 01:00 | Sunil | Explicit cross-host effect/storage/lifetime contracts | Frameworks and adapters already exist; P36 stays underspecified. |
| Software becomes forkable/personalized — V49 11:00; V51 12:00; 32:00–35:00 | Sunil/hosts; Slack's jellyware direction | Maintained owner behavior and service contracts across updates | Fork synchronization shipped; P24/P25 test retention of meaning. |
| Tools can be replaced again after six months — T02 15:00 | Skidmore | State export/import, usable replacements, and a supported exit | P25; ordinary database export alone is insufficient evidence. |
| Disposable software becomes much more numerous — V79 09:00–12:00 | Max | Restricted scope, fallback, retirement, and promotion when adoption changes | P26/P34, with no proven standalone demand. |
| Almost all implementation becomes AI-written — V22 1:17:00–1:18:00 | Mattis, asymptotic | Human-owned objectives, data semantics, operational acceptance | Generation itself is occupied; checks may become cheaper disposable artifacts too. |
| Code reading declines — V21 24:00; V22 1:28:00; T13 17:00 | Orosz, Mattis, Dillon; differing certainty/horizons | Trustworthy artifacts, behavior evidence, and selective review | P02/P37/P39. Newman remains module-specific and conditional; do not manufacture consensus. |
| More frequent rewrites/migrations — V21 25:00; V87 31:00–32:00; T13 11:00 | Orosz; Theo/Anthropic account; Dillon | Compatibility through intermediate states and a preserved recovery route | P02/P22/P25. Better models already solved Dillon's implementation blockage. |
| Governed analytics needs more than better models — V03 06:00 | dbt presenter | Definitions, authority, query/access lineage, representative examples | MetricFlow/Ossie/OpenLineage are owners; P03/P05/P06/P09 are residual checks. |
| Data teams own repeatable production AI workflows — V03 22:00–23:00 | dbt presenter | Bounded context, task-specific access, source provenance and acceptance | P06/P08/P09; chat exploration and fixed workflows need different inputs. |
| Every desk/function gets an agent — V68 01:00–02:00; 17:00 | Andrew Qu | Company-specific knowledge, task access and maintainable learned skills | Vercel already supplies a framework and internal agents; P06. |
| Tiny tasks use tiny models — T11 05:00–06:00; V10 11:00 | Schroeder; Scott Wu's 2% frontier / 98% commodity forecast | Task-level adequacy, operational cost and coverage evidence | Routing/classifiers supplied; P28/P30 are evidence questions. |
| Inference subsidies/subscriptions tighten — V12 40:00–43:00; V05 59:00 | Michelle; Pi maintainers; six-to-twelve-month speculation | Exercised provider fallback and explicit unsubsidized scenarios | Generic calculators/gateways occupied; price direction conflicts with Theo's fixed-capability cost forecast. |
| Controlled code can replace product DSLs — V48 33:00–34:00 | Carey | Bounded effects, resource limits, meaningful composition and artifacts | Code Mode supplied; P11/P12/P23. |
| Harness coding shims disappear into models — V66 03:00–06:00 | Katz | Exposure-aware retirement evidence and reversible removal | He already has a telemetry/deletion bot. Retain as a tiny P37-style obligation/ablation variant, not a new orchestrator. |
| Separate CI shrinks — V51 23:00–26:00; T13 18:00 | Slack; Dillon asks about duplicate work | Independent required-check selection, trusted execution identity, invalidation | Dagger/Bastion/receipts already provide adjacent mechanisms; do not restore a generic CI-receipt pitch. |
| GPU hardware gets more diverse; small models need granular sharing — V25 05:00; V77 19:00 | Lattner; Jelveh | Supported device/mode contracts and comparable workload telemetry | Vendors/HAMi already build the stack; P27/P28/P29 contributions. |
| Runtime lifecycle features improve — T09 16:00–19:00 | Ashley: shutdown, graceful deployment, safe retries | Tests preserving application state/effects through the new transition | Platform Roadmap; P01/P02/P32 test it rather than competing with it. |
| Backend/API reach becomes broader — V48 35:00–39:00; T05 18:00–20:00 | Cloudflare speakers | More compatible code and bindings, Basin location/auth controls | Named Cloudflare Roadmap. P38 is only a vendor preference until an actual missing requirement is shown. |

**I — No clear GrowOS-like unoccupied primitive emerged.** The strongest provocative seeds—VM/inference crossover, fork ownership, portable actor architecture, and optional Git working copies—already have active owners or remain too vague to turn into a specific individual-builder project. The reproducible transition checks are the honest residue.


## 5. Complete broad-keyword signal screening register
**F — Register construction:** the following 1,042 entries are the original signal-table hits, excluding recurring-theme and prior-art repetitions. Each link opens the full row, including its interpretation and candidate. The register is deliberately inclusive: a match in a role or a tangential use of a keyword is screening context, not a finding of an unfilled infrastructure need. Cluster interpretations and independence counts above take precedence over raw frequency.
**Q/I — Attribution keys:** in E04, TW = Titus Winters, WL = Will Larson, GB = Gergely Orosz. In E05, SN = Sam Newman, GO = Orosz, PM = Peter Mattis, MP = Matt Pocock. Connect agentweb: CF = Matthew Conroy in A rows and Ryan Skidmore in B rows; VSCO = Andreas Salme. Connect storage: J = Jackie / Relevance AI, M = Micah Wylde, D = Dillon Mulroy, A = audience. Connect durable: AP = Ashley Peacock, JS = Justin Schroeder, AQ = audience. Connect customer: Ramp PE = Raphaël Beamonte, Sentry eng = Greg Pstrucha. Connect platforms: K = Kevin, A = Andrew, J = Justin Watts, L = Fabian / Lovable. Ambiguous caption turns remain ambiguous. Ellipses mark caption omissions; exact wording remains at the linked row.

### E01

| Ledger anchor | Video / caption time | Speaker / role | Signal type | Q — caption excerpt |
|---|---|---|---|---|
| [E01:53](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:53) | V01 · 23:00–24:00 | Theo / t3.gg; Blacksmith sponsor | Limit | “not for your agent to just SSH into” |
| [E01:64](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:64) | V01 · 29:00 | Theo / Boat user | Practice | “build it once ... snapshot it” |
| [E01:68](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:68) | V01 · 32:00 | Theo / t3.gg | Hand-rolled | “two threads running for TS Rust” |
| [E01:73](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:73) | V01 · 34:00 | Theo / compiler builder | Limit | “It barely even works for TS Rust” |
| [E01:77](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:77) | V01 · 36:00 | Theo / t3.gg | Prediction | “everything we rely on every day is flexible” |
| [E01:96](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:96) | V03 · 01:00 | Presenter / dbt Labs | Pain | “calculating revenue in different ways” |
| [E01:97](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:97) | V03 · 01:00–02:00 | Presenter / dbt Labs | Limit | “really just the status quo” |
| [E01:98](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:98) | V03 · 02:00 | Presenter / dbt Labs | Pain | “Integrations were also extremely difficult” |
| [E01:99](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:99) | V03 · 02:00–03:00 | Presenter / dbt Labs | Pain | “semantic modeling is a different discipline” |
| [E01:100](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:100) | V03 · 03:00 | Presenter / dbt Labs | Prediction | “a tireless analyst at the fingertips of anyone” |
| [E01:101](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:101) | V03 · 03:00 | Presenter / dbt Labs | Practice | “doubling of usage quarter over quarter” |
| [E01:102](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:102) | V03 · 05:00–06:00 | Presenter / dbt Labs | Limit | “trust ... degrades with every additional step” |
| [E01:103](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:103) | V03 · 06:00 | Presenter / dbt Labs | Prediction | “betting on just better models ... is not going to be enough” |
| [E01:104](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:104) | V03 · 07:00–08:00 | Presenter / dbt Labs | Wish / gap | “valuable if everyone ... can use it wherever they want” |
| [E01:105](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:105) | V03 · 08:00 | Presenter / dbt Labs | Roadmap | “semantic SQL or a more native SQL interface” |
| [E01:106](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:106) | V03 · 08:00–09:00 | Presenter / dbt Labs | Wish / gap | “the ability to accept arbitrary SQL” |
| [E01:107](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:107) | V03 · 09:00–10:00 | Presenter / dbt Labs | Pain | “manage thousands of models” |
| [E01:108](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:108) | V03 · 10:00 | Presenter / dbt Labs | Pain | “30, 40% of their warehouse bill” |
| [E01:109](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:109) | V03 · 10:00 | Presenter / dbt Labs | Roadmap | “something that the team is working on at DBT” |
| [E01:110](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:110) | V03 · 10:00–11:00 | Presenter / dbt Labs | Wish / gap | “use an aggregate as a dimension” |
| [E01:111](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:111) | V03 · 11:00–12:00 | Presenter / dbt Labs | Prediction | “a map of your business” |
| [E01:112](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:112) | V03 · 12:00 | Presenter / dbt Labs | Wish / gap | “connect a Slack channel ... with the customer record in Salesforce” |
| [E01:113](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:113) | V03 · 12:00–13:00 | Presenter / dbt Labs | Wish / gap | “configure what context an agent can access” |
| [E01:114](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:114) | V03 · 13:00 | Presenter / dbt Labs | Wish / gap | “what individual parts of the DAG an agent accessed” |
| [E01:115](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:115) | V03 · 13:00–14:00 | Presenter / dbt Labs | Open question | “how should a semantic layer be authored?” |
| [E01:116](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:116) | V03 · 14:00 | Presenter / dbt Labs | Open question | “how should it be served?” |
| [E01:117](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:117) | V03 · 14:00 | Presenter / dbt Labs | Roadmap | “looking for design partners” |
| [E01:118](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:118) | V03 · 15:00 | Audience / analytics user | Open question | “ensure it doesn't hallucinate” |
| [E01:119](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:119) | V03 · 15:00–16:00 | Presenter / dbt Labs | Pain | “we've lost those skills” |
| [E01:120](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:120) | V03 · 16:00 | Audience / data practitioner | Pain | “non-technical users are the ones with the knowledge” |
| [E01:121](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:121) | V03 · 16:00–17:00 | Audience, then presenter / dbt | Open question | “may not ... want to be making PRs” |
| [E01:122](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:122) | V03 · 17:00 | Presenter / dbt Labs | Wish / gap | “isn't established or have any established solutions” |
| [E01:123](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:123) | V03 · 17:00–18:00 | Audience / Hex integration user | Pain | “cannot upgrade to V2 because Hex doesn't parse the new specification” |
| [E01:124](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:124) | V03 · 18:00–19:00 | Audience / data practitioner | Open question | “vendors are adding their own semantic layers” |
| [E01:125](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:125) | V03 · 19:00 | Presenter / dbt Labs | Open question | “lossiness between conversions” |
| [E01:126](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:126) | V03 · 19:00 | Presenter / dbt Labs | Limit | “It's not going to be one-to-one” |
| [E01:127](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:127) | V03 · 19:00–20:00 | Presenter / dbt Labs | Open question | “provide enforcement through these conversions” |
| [E01:128](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:128) | V03 · 19:00–20:00 | Presenter / dbt Labs | Roadmap | “output a OSI document” |
| [E01:129](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:129) | V03 · 20:00 | Presenter / dbt Labs | Limit / Roadmap | “it's not available right now” |
| [E01:130](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:130) | V03 · 20:00–21:00 | Presenter / dbt Labs | Roadmap | “reference metrics and semantics within your DBT project” |
| [E01:132](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:132) | V03 · 22:00 | Audience / data practitioner | Disagreement | “we're trying to actually feed more information” |
| [E01:133](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:133) | V03 · 22:00–23:00 | Presenter / dbt Labs | Prediction | “repeatable production AI workflows” |
| [E01:134](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:134) | V03 · 23:00 | Presenter / dbt Labs | Practice | “all of those call transcripts into more structured data” |
| [E01:135](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:135) | V03 · 23:00 | Presenter / dbt Labs | Practice | “all the data that this individual has access to” |
| [E01:137](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:137) | V03 · 24:00–25:00 | Audience, then presenter / dbt | Disagreement | “skill files” / “still inherently ... tokens through an AI model” |
| [E01:138](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:138) | V03 · 25:00 | Presenter / dbt Labs | Limit | “markdown file and skills ... telemetry pretty difficult” |
| [E01:139](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:139) | V03 · 25:00–26:00 | Audience, then presenter / dbt | Wish / gap | “there's a need for a feedback loop” |
| [E01:140](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:140) | V03 · 26:00 | Presenter / dbt Labs, citing Anthropic | Practice | “It should be human curated” |
| [E01:141](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:141) | V03 · 26:00–27:00 | Presenter / dbt Labs | Practice | “compile SQL to get that same metric each time” |
| [E01:142](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:142) | V03 · 27:00 | Audience; presenter / dbt | Pain / Open question | “when is OAuth coming?” / “I don't know” |
| [E01:166](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:166) | V04 · 06:00–07:00 | Michael / engineer | Limit | “work trees do not isolate shared resources” |
| [E01:176](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:176) | V04 · 13:00 | Michael / engineer | Practice | “a skill I stole from [Vercel]” |
| [E01:181](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:181) | V04 · 16:00 | Michael / engineer | Pain | “You didn't run a GP loop” |
| [E01:184](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:184) | V04 · 18:00 | Michael / engineer | Pain | “manual review is probably the worst part” |
| [E01:186](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:186) | V04 · 18:00–19:00 | Peter / host | Pain | “not very reliable in following my skills” |
| [E01:200](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:200) | V04 · 30:00 | Michael / app builder | Hand-rolled | “use Cloudflare email ... build the same thing” |
| [E01:220](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:220) | V04 · 41:00–42:00 | Michael / home-lab builder | Hand-rolled | “my own sort of agents workspace” |
| [E01:227](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:227) | V04 · 44:00–45:00 | Peter and Michael / users | Prediction | “personalized for your own taste and preferences” |
| [E01:249](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:249) | V05 · 00:05:00 | Armin / maintainer | Pain | “code mode comes with a lot of complexity” |
| [E01:251](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:251) | V05 · 00:05:00–00:06:00 | Armin / maintainer | Practice | “progressive disclosure” |
| [E01:262](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:262) | V05 · 00:11:00 | Mario / Pi creator | Pain | “non-technical user ... not be able to fix if an agent dies” |
| [E01:264](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:264) | V05 · 00:11:00–00:12:00 | Mario / Pi creator | Roadmap / existing implementation | “continues from where it left off automatically” |
| [E01:268](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:268) | V05 · 00:15:00 | Mario / Pi creator | Limit | “I don't know if it was actually sent or not” |
| [E01:269](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:269) | V05 · 00:15:00–00:17:00 | Mario / Pi creator | Practice | “store the intent, do the thing, store the result” |
| [E01:272](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:272) | V05 · 00:18:00–00:19:00 | Armin / maintainer | Pain | “or you just lose everything along the way” |
| [E01:274](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:274) | V05 · 00:19:00 | Armin / maintainer | Limit | “can't make Pi dependent on Postgres” |
| [E01:275](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:275) | V05 · 00:20:00 | Host / Fragmented | Open question | “what are things that you can or cannot recover from?” |
| [E01:276](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:276) | V05 · 00:20:00–00:21:00 | Mario / Pi creator | Limit | “a new version of that file compared to 3 hours ago” |
| [E01:279](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:279) | V05 · 00:21:00–00:22:00 | Mario / Pi creator | Practice | “inspect your environment and figure out what to do next” |
| [E01:282](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:282) | V05 · 00:23:00–00:24:00 | Mario / Pi creator | Wish / gap | “the sub agents to also resume” |
| [E01:312](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:312) | V05 · 00:40:00 | Mario / Pi creator | Wish / gap | “code isolation and ... sandboxing” |
| [E01:317](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:317) | V05 · 00:42:00–00:43:00 | Armin / maintainer | Open question | “where do you set the limit” |
| [E01:324](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:324) | V05 · 00:47:00 | Host / Fragmented | Pain | “10 other things that were linked to it” |
| [E01:331](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:331) | V05 · 00:52:00 | Mario / Pi creator | Wish / gap | “We are not experts on these infrastructure pieces” |
| [E01:336](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:336) | V05 · 00:54:00–00:55:00 | Maintainers / Pi | Practice | “for everything else I stay vanilla” |
| [E01:343](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:343) | V05 · 00:58:00–00:59:00 | Maintainers / Earendil | Prediction | “shows up for real everywhere” |
| [E01:366](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:366) | V08 · 00:07:00–00:08:00 | John / Jane Street | Practice | “we can really go deep” |
| [E01:367](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:367) | V08 · 00:08:00–00:09:00 | Interviewer / Jane Street | Open question | “premature concretization of the workflows” |
| [E01:370](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:370) | V08 · 00:09:00–00:10:00 | John / Jane Street | Hand-rolled | “a team that kind of works to take us out of that” |
| [E01:372](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:372) | V08 · 00:10:00 | John / Jane Street | Pain | “not all ... works well with the build system” |
| [E01:378](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:378) | V08 · 00:15:00–00:16:00 | John / ex-GitHub engineer | Pain | “centered around ... MySQL databases” |
| [E01:379](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:379) | V08 · 00:16:00 | John / ex-GitHub engineer | Pain / Hand-rolled | “running migrations at that scale is ... kind of impossible” |
| [E01:381](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:381) | V08 · 00:17:00–00:18:00 | Both / developers | Pain | “downtime and issues staying up” |
| [E01:411](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:411) | V08 · 00:36:00–00:37:00 | Interviewer / tools leader | Limit | “try to work around the permissions” |
| [E01:415](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:415) | V08 · 00:39:00–00:40:00 | John and interviewer / engineers | Disagreement | “aligned to wanting to be successful” / “cheating isn't a terrible way” |
| [E01:416](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:416) | V08 · 00:41:00 | John / Jane Street | Hand-rolled | “a deny list sandbox” |
| [E01:420](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:420) | V08 · 00:43:00 | John / Jane Street | Pain | “deciding to turn the sandbox off” |
| [E01:424](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:424) | V08 · 00:47:00–00:48:00 | John / Jane Street | Hand-rolled | “changes to the RPC infrastructure” |
| [E01:450](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:450) | V08 · 01:08:00–01:09:00 | John / Jane Street | Hand-rolled | “context bundles” |
| [E01:451](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:451) | V08 · 01:08:00–01:09:00 | John / Jane Street | Pain | “go undo work that we did” |
| [E01:457](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:457) | V08 · 01:12:00 | John / Jane Street | Hand-rolled | “shim our sandboxing in ... the right places” |
| [E01:458](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:458) | V08 · 01:12:00–01:14:00 | Interviewer / Jane Street | Practice | “run the same workload in the cloud ... way faster” |
| [E01:459](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:459) | V08 · 01:14:00–01:15:00 | John and interviewer / Jane Street | Limit | “unique advantage from building your own thing” |
| [E01:493](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:493) | V08 · 01:35:00–01:36:00 | Both / engineers | Wish / gap | “a many-to-many” |
| [E01:509](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:509) | V08 · 01:44:00 | Interviewer / tools leader | Prediction | “that refactor ... now you can do it” |

### E02

| Ledger anchor | Video / caption time | Speaker / role | Signal type | Q — caption excerpt |
|---|---|---|---|---|
| [E02:86](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:86) | V09 · 01:14:00–01:15:00 | Steve / Demetri | Limit / Open question | “marketing and go-to-market and and sales” |
| [E02:116](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:116) | V10 · 00:11:00 | Scott | Wish / Roadmap | “having persistent memory, the ability to run swarms” |
| [E02:146](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:146) | V11 · 00:07:00 | Sunil | Roadmap | “already made it the default” |
| [E02:148](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:148) | V11 · 00:08:00 | Ree / Sunil | Practice | “classify inside” |
| [E02:161](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:161) | V11 · 00:18:00–00:19:00 | Ree | Open question | “Why the hell did that take 3 years?” |
| [E02:169](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:169) | V11 · 00:24:00–00:25:00 | Sunil | Pain | “generate like a big 10,000word document” |
| [E02:172](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:172) | V11 · 00:27:00–00:30:00 | Sunil | Practice | “drop down a level” |
| [E02:193](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:193) | V11 · 00:53:00–00:55:00 | Ree | Hand-rolled / Roadmap | “everything is a custom tool” |
| [E02:197](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:197) | V11 · 00:57:00–00:58:00 | Ree | Roadmap | “tools, skills, UI, storage, triggers, workflows” |
| [E02:199](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:199) | V11 · 00:58:00–00:59:00 | Ree | Practice / Roadmap | “Accounts standalone” |
| [E02:208](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:208) | V11 · 01:05:00 | Ree | Hand-rolled / Practice | “the app at will on its own” |
| [E02:216](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:216) | V11 · 01:13:00–01:14:00 | Ree | Hand-rolled / Prediction | “I just want to in-house both of them” |
| [E02:231](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:231) | V12 · 00:01:00–00:02:00 | Sunil / Michelle, Cloudflare | Pain | “can you fix my computer and my printer?” |
| [E02:240](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:240) | V12 · 00:09:00–00:10:00 | Michelle | Roadmap | “one AI binding one like rest API” |
| [E02:247](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:247) | V12 · 00:14:00 | Michelle | Hand-rolled / Pain | “we were not going to make money on these prices” |
| [E02:249](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:249) | V12 · 00:15:00 | Michelle | Open question / Joke | “spin it off from Cloudflare” |
| [E02:250](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:250) | V12 · 00:16:00–00:17:00 | Dylan, Cloudflare engineer | Open question | “optimized with something like auto research” |
| [E02:251](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:251) | V12 · 00:17:00–00:18:00 | Michelle | Prediction / Disagreement | “the industry has taken the opposite” |
| [E02:253](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:253) | V12 · 00:18:00–00:19:00 | Michelle | Hand-rolled / Roadmap | “a throughput tier” |
| [E02:254](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:254) | V12 · 00:19:00 | Michelle | Pain / Limit | “our original infrastructure is not exactly designed for” |
| [E02:260](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:260) | V12 · 00:27:00 | Michelle | Pain | “it just sits there eating up GPU space” |
| [E02:262](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:262) | V12 · 00:30:00–00:31:00 | Sunil / Michelle | Pain / Open question | “It can't be just one company” |
| [E02:278](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:278) | V12 · 00:41:00 | Michelle | Pain / Practice | “privatized versions of forks” |
| [E02:285](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:285) | V12 · 00:45:00–00:46:00 | Michelle | Prediction / Roadmap | “compute is the new currency” |
| [E02:287](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:287) | V12 · 00:47:00–00:48:00 | Michelle / hosts | Practice / Prediction | “perfect for agents” |
| [E02:293](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:293) | V12 · 00:52:00–00:53:00 | Sunil | Pain / Disagreement | “What does the factory make?” |
| [E02:296](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:296) | V12 · 00:54:00–00:55:00 | Sunil | Wish / Disagreement | “I'm tired of seeing new agent frameworks” |
| [E02:321](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:321) | V13 · 00:18:00–00:21:00 | Dax | Prediction | “remain close source long term” |
| [E02:351](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:351) | V13 · 00:46:00–00:47:00 | Dax | Pain / Practice | “switch my whole tooling stack” |

### E03

| Ledger anchor | Video / caption time | Speaker / role | Signal type | Q — caption excerpt |
|---|---|---|---|---|
| [E03:19](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:19) | V14 · 00:08:00 | Host / Fish Slop builder | Pain | “all of the food is stuck on the ground and the fish can't eat it” |
| [E03:21](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:21) | V14 · 00:09:00 | Theo / T3 Code | Pain | “hallucinated tables and columns in our SQLite database” |
| [E03:23](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:23) | V14 · 00:10:00–00:11:00 | Theo / T3 Code, TS Rust | Hand-rolled; Practice | “give architectural like observations” |
| [E03:42](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:42) | V14 · 00:30:00 | Hosts / Android users | Pain | “sat in loading for about 5 minutes and then it hit an error” |
| [E03:45](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:45) | V14 · 00:31:00–00:35:00 | Hosts / developers | Wish / gap; Prediction | “is it time to slot [slop] fork Android?” |
| [E03:52](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:52) | V14 · 00:36:00–00:37:00 | Hosts / builders | Prediction | “Google search ... longterm doesn't exist or matter” |
| [E03:55](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:55) | V14 · 00:38:00–00:39:00 | Theo / T3 Code | Pain; Hand-rolled | “computer use is crashing constantly” |
| [E03:56](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:56) | V14 · 00:38:00–00:39:00 | Theo / T3 Code | Pain | “six things on an API I have no access to” |
| [E03:67](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:67) | V14 · 00:48:00–00:49:00 | Hosts / developers | Pain; Prediction | “bringing this stuff in house” |
| [E03:110](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:110) | V14 · 01:36:00 | Theo / TS Rust | Hand-rolled; Practice | “saved over 300 hours of CI time” |
| [E03:112](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:112) | V14 · 01:38:00 | Theo / TS Rust | Hand-rolled; Pain | “left the SLG goal running ... started addressing ... issues” |
| [E03:113](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:113) | V14 · 01:38:00 | Theo / TS Rust | Limit | “effect diagnostic stuff that I did” |
| [E03:120](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:120) | V14 · 01:43:00 | Theo / T3 Code | Roadmap | “further isolate sub aents [subagents]” |
| [E03:138](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:138) | V14 · 01:59:00–02:00:00 | Theo / social platform user | Limit | “replies to a private post are public on Twitter” |
| [E03:158](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:158) | V15 · 00:07:00–00:08:00 | Ben / T3 contributor | Hand-rolled; Practice | “take a screenshot, make sure it looks good and iterate” |
| [E03:160](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:160) | V15 · 00:09:00 | Theo / T3 Code, TS Rust | Practice | “if I have an idea that tokens can solve, I just spin it up” |
| [E03:164](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:164) | V15 · 00:11:00 | Ben / subscriber | Pain | “20% left ... 20% used” |
| [E03:171](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:171) | V15 · 00:15:00–00:16:00 | Theo / T3 Code | Hand-rolled; Pain | “turn off ... beta features ... to fix it” |
| [E03:173](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:173) | V15 · 00:17:00–00:18:00 | Theo / T3 Code | Wish / gap; Open question | “let the agent make every decision and see what happens” |
| [E03:174](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:174) | V15 · 00:18:00–00:20:00 | Ben / developer | Limit; Disagreement | “not a binary right or wrong on what a sidebar should look like” |
| [E03:198](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:198) | V15 · 00:40:00–00:41:00 | Theo / T3 Code | Practice | “putting it in my to-do list” |
| [E03:248](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:248) | V15 · 01:46:00–01:48:00 | Theo / TS Rust | Open question; Hand-rolled | “plateau happened right when ... back to 250 or 270K” |
| [E03:249](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:249) | V15 · 01:48:00–01:49:00 | Hosts / developers | Disagreement | “better at making decisions” |
| [E03:261](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:261) | V15 · 02:00:00 | Theo / calendar user | Pain; Hand-rolled | “removed the autolinking Google Meet” |
| [E03:262](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:262) | V15 · 02:00:00 | Ben / calendar user | Pain | “missing three ... important calendars ... for like a week” |
| [E03:298](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:298) | V16 · 00:07:00–00:08:00 | Hosts / creators | Pain; Open question | “only paying you out through X money now” |
| [E03:320](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:320) | V16 · 00:35:00–00:36:00 | Hosts / developers | Prediction; Roadmap | “Gro 4.8 ... how they handle this ... fascinating” |
| [E03:333](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:333) | V16 · 00:46:00–00:47:00 | Ben / developer | Wish / gap | “command K bar ... usually awful” |
| [E03:351](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:351) | V16 · 00:59:00 | Theo / developer | Pain | “2 to 5% error rate ... format wrong” |
| [E03:375](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:375) | V16 · 01:28:00 | Theo / T3 analytics | Hand-rolled; Practice | “tokens ... up ... cost ... down by 20%” |
| [E03:381](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:381) | V16 · 01:35:00 | Hosts / game developers | Limit | “beat it into the exact shape you want” |
| [E03:382](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:382) | V16 · 01:36:00–01:37:00 | Ben / Majora's Mask modder | Hand-rolled; Practice | “brand new area ... using existing assets” |
| [E03:387](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:387) | V16 · 01:39:00–01:40:00 | Theo / returning Persona player | Pain; Wish / gap | “didn't remember ... where I was ... strategy” |
| [E03:388](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:388) | V16 · 01:40:00 | Theo / Moonlight-fork user | Pain; Hand-rolled | “clicked ... wasn't passing through clicks properly” |
| [E03:391](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:391) | V16 · 01:41:00–01:42:00 | Theo / TS Rust builder | Pain; Limit | “83.7% to 83.7% with twice as much code” |
| [E03:392](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:392) | V16 · 01:42:00–01:43:00 | Theo / TS Rust builder | Hand-rolled; Practice | “all the tests that have been defined” |
| [E03:393](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:393) | V16 · 01:43:00 | Theo / TS Rust builder | Pain; Practice | “find more incompatibilities ... effect is a brutal abuse” |
| [E03:394](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:394) | V16 · 01:43:00–01:44:00 | Theo / compiler builder | Limit | “making sure the types are valid ... much more complex” |
| [E03:402](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:402) | V16 · 01:51:00–01:52:00 | Theo / T3 Code | Practice | “letting the model create videos” |
| [E03:403](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:403) | V16 · 01:52:00 | Theo / maintainer | Practice | “derisk both sides of the merge button” |
| [E03:421](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:421) | V16 · 02:04:00–02:05:00 | Theo / TS Rust builder | Prediction; Practice | “stuff ... never ... worth writing ... autonomous loop” |

### E04

| Ledger anchor | Video / caption time | Speaker / role | Signal type | Q — caption excerpt |
|---|---|---|---|---|
| [E04:20](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:20) | V17 · 11:00 | TW · ex-Google C++ infrastructure | Pain | “They have more important things to do than to handle like patch requests” |
| [E04:22](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:22) | V17 · 14:00 | GB · former engineer | Pain | “if you do it and you do a great job they'll probably not even think about it” |
| [E04:36](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:36) | V17 · 23:00–24:00 | TW · Abseil lead | Hand-rolled | “10 or 12 people working full-time with world-class tools” |
| [E04:37](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:37) | V17 · 24:00 | TW · Abseil lead | Limit | “We're not allowed to close the building or block traffic” |
| [E04:38](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:38) | V17 · 26:00 | TW · C++ infrastructure lead | Pain | “50,000 call sites or 100,000 edits” |
| [E04:39](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:39) | V17 · 27:00 | TW · C++ infrastructure lead | Hand-rolled | “map reduce over the code base” |
| [E04:40](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:40) | V17 · 27:00–28:00 | TW · C++ infrastructure lead | Pain | “we couldn't get the white space in the right places” |
| [E04:41](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:41) | V17 · 27:00–28:00 | TW · C++ infrastructure lead | Hand-rolled | “clang-format exists because I wished for it” |
| [E04:42](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:42) | V17 · 28:00 | TW · C++ infrastructure lead | Limit | “never be able to test and resync before something has gone out of sync” |
| [E04:43](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:43) | V17 · 29:00 | TW · C++ infrastructure lead | Practice | “the old API and the new one can coexist in spelling” |
| [E04:44](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:44) | V17 · 29:00 | TW · C++ infrastructure lead | Practice | “cut by like directory structure” |
| [E04:45](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:45) | V17 · 29:00 | TW · C++ infrastructure lead | Pain | “a race to make sure no one copy and pastes the old thing” |
| [E04:46](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:46) | V17 · 29:00–30:00 | TW · C++ infrastructure lead | Practice | “if it was the wrong way to do a thing, you would have gotten rid of it already” |
| [E04:47](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:47) | V17 · 30:00–31:00 | GB · host | Open question | “rewriting with AI feels still feels so much more janky” |
| [E04:53](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:53) | V17 · 34:00 | GB · former Uber engineer | Pain | “I could barely commit my code the … the … week” |
| [E04:54](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:54) | V17 · 34:00–35:00 | GB · former Uber engineer | Hand-rolled | “Architectural rules were all in lint rules” |
| [E04:61](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:61) | V17 · 38:00 | GB · turbobuffer sponsor segment | Roadmap | “all indexes will share the same columnar storage system” |
| [E04:62](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:62) | V17 · 39:00–40:00 | TW · book author | Pain | “everything that any engineer thought was a clever solution” |
| [E04:77](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:77) | V17 · 59:00–1:00:00 | TW · leadership experience | Pain | “weeks or months of every one-on-one starts with ... How are you coping?” |
| [E04:138](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:138) | V18 · 10:00–11:00 | WL · Yahoo engineer | Hand-rolled | “every single thing there they made from from scratch” |
| [E04:140](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:140) | V18 · 12:00 | WL · Yahoo engineer | Pain | “people would never give servers back” |
| [E04:145](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:145) | V18 · 19:00 | WL · former Digg engineer | Pain | “you change what you are. Community doesn't like that” |
| [E04:146](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:146) | V18 · 19:00–20:00 | WL · Digg V4 launch participant | Pain | “the launch technically wasn't really ready” |
| [E04:147](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:147) | V18 · 20:00 | WL · Digg V4 launch participant | Disagreement | “Cassandra was a Trojan horse” |
| [E04:150](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:150) | V18 · 21:00 | WL · Digg V4 launch participant | Limit | “If I'm writing to Cassandra, I can't read from Cassandra” |
| [E04:152](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:152) | V18 · 22:00 | WL · Digg V4 launch participant | Limit | “we didn't have enough hardware to run the new system and the old system concurrently” |
| [E04:153](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:153) | V18 · 22:00–23:00 | WL · Digg V4 launch participant | Pain | “we couldn't roll back” |
| [E04:157](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:157) | V18 · 24:00–25:00 | WL · Digg incident responder | Pain | “All the users that were ever passed into it would still be there” |
| [E04:160](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:160) | V18 · 28:00 | WL · Digg / Uber infrastructure history | Hand-rolled | “a key-value store to manage ... state for infrastructure” |
| [E04:161](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:161) | V18 · 29:00 | WL · new Uber manager | Pain | “didn't really evaluate ... my ... DevOps acumen very well” |
| [E04:162](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:162) | V18 · 30:00 | WL · early Uber infrastructure leader | Pain | “this team of about six was managing ... basically everything” |
| [E04:163](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:163) | V18 · 31:00–32:00 | WL · Uber hiring leader | Pain | “interviewed him like four times” |
| [E04:164](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:164) | V18 · 32:00 | WL · early Uber infrastructure leader | Hand-rolled | “every Friday we were literally manually reallocating software between servers” |
| [E04:176](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:176) | V18 · 45:00 | GB · former Uber manager | Hand-rolled | “some internal DIY training” |
| [E04:177](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:177) | V18 · 46:00–47:00 | WL · early Uber leader | Open question | “there was no one to approve it” |
| [E04:178](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:178) | V18 · 47:00 | GB and WL · former Uber staff | Pain | “people left and burned out for a reason” |
| [E04:199](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:199) | V18 · 1:06:00–1:07:00 | GB · host | Prediction | “code reviews are slowly going away” |
| [E04:217](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:217) | V18 · 1:19:00–1:20:00 | GB · former engineering manager | Practice | “we remove them from all of the BS” |
| [E04:220](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:220) | V18 · 1:22:00 | GB · former Uber engineer | Limit | “a lot of decisions that have never been documented” |
| [E04:223](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:223) | V18 · 1:24:00–1:25:00 | WL · Imprint CTO | Pain | “a really hard time managing workloads of tasks” |
| [E04:226](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:226) | V18 · 1:27:00 | WL · former Uber hiring leader | Hand-rolled | “you had to make it all up yourself for your function” |
| [E04:261](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:261) | V19 · 01:00–02:00 | GB · host / WorkOS sponsor transition | Limit | “production ready code is far more complicated than just using an AI coding harness” |
| [E04:263](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:263) | V19 · 04:00–05:00 | Uday · Uber engineer | Hand-rolled | “changing the protocol from simple ... 4-second protocol” |
| [E04:264](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:264) | V19 · 05:00–06:00 | Uday · Uber engineer | Pain | “not much off-the-shelf software ... at the scale and rate of change” |
| [E04:265](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:265) | V19 · 06:00–07:00 | Uday · Uber platform engineer | Practice | “we picked Go and Java as our primary languages” |
| [E04:266](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:266) | V19 · 07:00 | Uday · Uber platform engineer | Practice | “we actually reduced some of the services to few services” |
| [E04:267](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:267) | V19 · 07:00–08:00 | Uday · Uber platform engineer | Practice | “one single ... global tech stack” |
| [E04:268](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:268) | V19 · 10:00 | Uday · Uber platform engineer | Hand-rolled | “U Own ... identify who owns a specific asset” |
| [E04:269](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:269) | V19 · 10:00 | Uday · Uber platform engineer | Hand-rolled | “design docs ... into one single place” |
| [E04:270](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:270) | V19 · 10:00–11:00 | Uday · Uber platform engineer | Limit | “500 million metrics ... per second with ... cardinality” |
| [E04:271](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:271) | V19 · 11:00 | Uday · Uber platform engineer | Hand-rolled | “our own end-to-end ... machine learning platform” |
| [E04:272](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:272) | V19 · 11:00 | Uday · Uber platform engineer | Roadmap | “we open sourced our deep learning ... part of the Michelangelo infrastructure” |
| [E04:273](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:273) | V19 · 11:00–12:00 | Uday · Uber platform engineer | Hand-rolled | “engineers doing their own resiliency stuff ... state management” |
| [E04:274](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:274) | V19 · 12:00–13:00 | Uday · Uber platform engineer | Practice | “try to open source wherever possible” |
| [E04:275](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:275) | V19 · 13:00–14:00 | Uday · Uber platform engineer | Hand-rolled | “not just simple AB, we also have switchbacks” |
| [E04:276](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:276) | V19 · 14:00 | Uday · Uber platform engineer | Practice | “automatically generate analysis ... P values ... metrics to use” |
| [E04:277](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:277) | V19 · 14:00 | GB · former Uber engineer | Wish / gap | “a feature flagging solution ... that supports cities” |
| [E04:278](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:278) | V19 · 15:00 | Uday · Uber platform engineer | Hand-rolled | “sharding by city, roll out by city” |
| [E04:279](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:279) | V19 · 15:00 | Uday · Uber platform engineer | Practice | “a group of cities are routed to a group of containers” |
| [E04:280](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:280) | V19 · 16:00 | Uday · Uber developer platform | Pain | “two three build systems, two three testing systems” |
| [E04:281](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:281) | V19 · 16:00–17:00 | Uday · Uber developer platform | Pain | “hard to run the build ... on your local laptop” |
| [E04:282](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:282) | V19 · 17:00 | Uday · Uber developer platform | Hand-rolled | “one dev pod per mono repo” |
| [E04:283](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:283) | V19 · 17:00–18:00 | Uday · Uber developer platform | Hand-rolled | “a mega dev pod with all of the repositories” |
| [E04:284](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:284) | V19 · 18:00 | Uday · Uber developer platform | Practice | “standardized builds, standardized testing” |
| [E04:285](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:285) | V19 · 18:00 | Uday · Uber developer platform | Practice | “even for non-engineers ... start playing” |
| [E04:286](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:286) | V19 · 19:00 | Uday · Uber GenAI foundations | Wish / gap | “hardness [harness] and model agnostic” |
| [E04:287](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:287) | V19 · 20:00–23:00 | Uday · Uber GenAI foundations | Hand-rolled | “one OpenAI compatible API or Anthropic compatible API” |
| [E04:288](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:288) | V19 · 22:00 | Uday · Uber GenAI foundations | Roadmap | “those are not in the open source version yet” |
| [E04:289](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:289) | V19 · 23:00–24:00 | Uday · Uber GenAI foundations | Hand-rolled | “five different set of fine-tuned models” |
| [E04:290](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:290) | V19 · 24:00 | Uday · Uber GenAI foundations | Limit | “every request and every response with strict latency guardrails” |
| [E04:291](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:291) | V19 · 24:00 | Uday · Uber GenAI foundations | Practice | “per user, per caller attribution” |
| [E04:292](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:292) | V19 · 24:00 | Uday · Uber GenAI foundations | Roadmap | “model routing ... a good entry point” |
| [E04:293](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:293) | V19 · 25:00 | Uday · Uber GenAI foundations | Pain | “carry forward all of my settings, all the skills, all the tools” |
| [E04:294](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:294) | V19 · 25:00–26:00 | Uday · Uber GenAI foundations | Hand-rolled | “we have a concept of personas” |
| [E04:295](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:295) | V19 · 26:00 | Uday · Uber GenAI foundations | Practice | “status line where we can give tips” |
| [E04:296](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:296) | V19 · 26:00–27:00 | Uday · Uber GenAI foundations | Practice | “a simple manager approval” |
| [E04:297](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:297) | V19 · 27:00–28:00 | Uday · Uber GenAI foundations | Practice | “a separate independent tier” |
| [E04:298](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:298) | V19 · 28:00 | Uday · Uber GenAI foundations | Hand-rolled | “a plugin called cost check” |
| [E04:299](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:299) | V19 · 29:00 | Uday · Uber GenAI foundations | Practice | “context health, model sizing” |
| [E04:300](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:300) | V19 · 29:00–30:00 | Uday · Uber GenAI foundations | Hand-rolled | “one gateway for all of the tools” |
| [E04:301](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:301) | V19 · 30:00–31:00 | Uday · Uber GenAI foundations | Practice | “auto-generate the MCP specs” |
| [E04:302](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:302) | V19 · 31:00 | Uday · Uber GenAI foundations | Pain | “some tools with like 3,000, 4,000 tokens” |
| [E04:303](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:303) | V19 · 31:00–32:00 | Uday · Uber GenAI foundations | Hand-rolled | “generate LLM-optimized descriptions” |
| [E04:304](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:304) | V19 · 32:00 | Uday · Uber GenAI foundations | Practice | “one single config and ... security policy change” |
| [E04:305](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:305) | V19 · 32:00 | Uday · Uber GenAI foundations | Hand-rolled | “projected all of these MCPs as CLIs” |
| [E04:306](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:306) | V19 · 32:00–34:00 | Uday · Uber GenAI foundations | Practice | “whether it's internal ... or external MCP tools” |
| [E04:307](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:307) | V19 · 34:00–35:00 | Uday · Uber GenAI foundations | Hand-rolled | “a skill mono repo” |
| [E04:308](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:308) | V19 · 35:00 | Uday · Uber GenAI foundations | Practice | “update the configurations across all of the hardnesses [harnesses]” |
| [E04:309](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:309) | V19 · 35:00–36:00 | Uday · Uber GenAI foundations | Roadmap | “tell them all kinds of tips to improve their skills” |
| [E04:310](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:310) | V19 · 36:00 | Uday · Uber GenAI foundations | Roadmap | “collect the traces ... generate improvement patches for the skills” |
| [E04:311](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:311) | V19 · 36:00–37:00 | Uday · Uber GenAI foundations | Pain | “very hard to make it really good across all kinds of use cases” |
| [E04:312](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:312) | V19 · 37:00–38:00 | Uday · Uber GenAI foundations | Hand-rolled | “updated all of the skills ... to use the CLI pattern” |
| [E04:313](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:313) | V19 · 37:00–38:00 | Uday · Uber GenAI foundations | Pain | “six MCPs ... always in my context” |
| [E04:314](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:314) | V19 · 38:00 | Uday · Uber GenAI foundations | Practice | “auto install this skill marketplace for everyone” |
| [E04:315](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:315) | V19 · 38:00–39:00 | Uday · Uber assistant platform | Hand-rolled | “we call it Cortana” |
| [E04:316](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:316) | V19 · 39:00 | Uday · Uber assistant platform | Pain | “historically all of these are ... siloed systems” |
| [E04:317](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:317) | V19 · 39:00–40:00 | Uday · Uber assistant platform | Hand-rolled | “100 plus node types ... 130 plus edge types” |
| [E04:318](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:318) | V19 · 40:00–41:00 | Uday · Uber assistant platform | Practice | “… use this to ... navigate” |
| [E04:319](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:319) | V19 · 41:00–42:00 | Uday · Uber assistant platform | Pain | “what tables exist, what columns exist” |
| [E04:320](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:320) | V19 · 42:00 | Uday · Uber assistant platform | Practice | “the blessed queries that we have” |
| [E04:321](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:321) | V19 · 42:00 | Uday · Uber assistant platform | Limit | “much harder for us to manually write all of this Cypher queries” |
| [E04:322](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:322) | V19 · 42:00–43:00 | Uday · Uber assistant platform | Practice | “graph platform team ... helped build this graph” |
| [E04:323](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:323) | V19 · 43:00–44:00 | Uday · Uber assistant platform | Practice | “omnipresent in Slack, web, CLI” |
| [E04:324](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:324) | V19 · 44:00 | Uday · Uber assistant platform | Practice | “carry forward all of the existing user permissions” |
| [E04:325](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:325) | V19 · 44:00 | GB · former Uber engineer | Hand-rolled | “break glass ... approval flow” |
| [E04:326](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:326) | V19 · 44:00–45:00 | Uday · Uber GenAI foundations | Roadmap | “few more even more futuristic use cases” |
| [E04:331](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:331) | V19 · 48:00 | Uday · Uber feature lifecycle tooling | Open question | “a combined plan that agents and engineers can iteratively work ... together” |
| [E04:332](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:332) | V19 · 48:00–49:00 | Uday · Uber feature lifecycle tooling | Hand-rolled | “all of those things are in one place” |
| [E04:333](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:333) | V19 · 49:00 | Uday · Uber feature lifecycle tooling | Practice | “Jira link or the linear link” |
| [E04:334](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:334) | V19 · 49:00–50:00 | Uday · Uber engineering leader | Pain | “all kinds of corner cases more than ... the happy path” |
| [E04:335](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:335) | V19 · 50:00–51:00 | Uday · Uber coding-agent platform | Hand-rolled | “15% of all of the production PRs ... through Minion” |
| [E04:336](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:336) | V19 · 51:00 | Uday · Uber coding-agent platform | Practice | “really good spec ... minimal steering” |
| [E04:337](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:337) | V19 · 51:00 | Uday · Uber coding-agent platform | Practice | “one PR or multiple PRs across repositories” |
| [E04:338](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:338) | V19 · 51:00–52:00 | Uday · Uber coding-agent platform | Roadmap | “increase the kind of task ... with Minion over time” |
| [E04:339](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:339) | V19 · 52:00–53:00 | Uday · Uber coding-agent platform | Practice | “follow this thread ... create a PR” |
| [E04:340](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:340) | V19 · 53:00 | Uday · Uber coding-agent platform | Practice | “no ... loop of ... adding it to backlog” |
| [E04:341](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:341) | V19 · 53:00–55:00 | Uday · Uber developer platform | Hand-rolled | “clone from the pre-built image ... build caches ... repositories” |
| [E04:342](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:342) | V19 · 55:00–56:00 | Uday · Uber developer platform | Pain | “review has become a big bottleneck” |
| [E04:343](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:343) | V19 · 56:00 | Uday · Uber developer platform | Hand-rolled | “one single command like AI effects [AIFX] validate” |
| [E04:344](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:344) | V19 · 56:00–57:00 | Uday · Uber developer platform | Practice | “spin up emulator ... web ... staging environment” |
| [E04:345](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:345) | V19 · 57:00 | Uday · Uber developer platform | Hand-rolled | “a self-healing CI” |
| [E04:346](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:346) | V19 · 57:00–58:00 | Uday · Uber review tooling | Hand-rolled | “this thing called code inbox” |
| [E04:347](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:347) | V19 · 58:00 | Uday · Uber review tooling | Roadmap | “adding risk score, blast radius of this PR” |
| [E04:348](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:348) | V19 · 58:00 | Uday · Uber developer platform | Pain | “internal code red for our CI system” |
| [E04:350](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:350) | V19 · 59:00 | Uday · Uber engineering leader | Practice | “still require an engineer to review every PR” |
| [E04:351](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:351) | V19 · 59:00–1:00:00 | Uday · Uber engineering leader | Roadmap | “back test it with years of data” |
| [E04:352](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:352) | V19 · 1:00:00 | Uday · Uber engineering leader | Roadmap | “green lane ... auto landing” |
| [E04:353](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:353) | V19 · 1:00:00–1:01:00 | Uday · Uber testing infrastructure | Pain | “touches two ... or three services ... working end-to-end?” |
| [E04:354](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:354) | V19 · 1:01:00 | Uday · Uber testing infrastructure | Hand-rolled | “route your test account UUID ... to the instance” |
| [E04:355](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:355) | V19 · 1:01:00–1:02:00 | Uday · Uber testing infrastructure | Practice | “carry forward across the service graph” |
| [E04:356](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:356) | V19 · 1:01:00–1:03:00 | Uday · Uber testing infrastructure | Practice | “teach agents how to deploy slate” |
| [E04:357](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:357) | V19 · 1:03:00–1:04:00 | Uday · Uber testing infrastructure | Practice | “what is on main and what is on my branch” |
| [E04:358](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:358) | V19 · 1:04:00 | GB · former Uber engineer | Pain | “that's just difficult ... took years to build” |
| [E04:359](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:359) | V19 · 1:04:00–1:05:00 | Uday · Uber testing infrastructure | Hand-rolled | “adding ... baggage ... propagated across the call stack” |
| [E04:360](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:360) | V19 · 1:05:00–1:06:00 | GB and Uday · testing infrastructure discussion | Limit | “all existing services were retrofitted” |
| [E04:361](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:361) | V19 · 1:06:00–1:07:00 | Uday · Uber testing infrastructure | Pain | “even many versions ... in the past” |
| [E04:362](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:362) | V19 · 1:07:00 | Uday · Uber testing infrastructure | Pain | “thousands and thousands of tests across the stack” |
| [E04:363](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:363) | V19 · 1:07:00–1:08:00 | Uday · Uber testing infrastructure | Hand-rolled | “capture real production traffic with just one middleware” |
| [E04:364](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:364) | V19 · 1:07:00–1:08:00 | Uday · Uber testing infrastructure | Practice | “downstream APIs ... requests and ... responses are also captured” |
| [E04:365](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:365) | V19 · 1:08:00 | Uday · Uber testing infrastructure | Hand-rolled | “simple rules ... value for that dimension” |
| [E04:366](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:366) | V19 · 1:08:00–1:09:00 | Uday · Uber testing infrastructure | Hand-rolled | “the full set of live dimensions and live combinations” |
| [E04:367](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:367) | V19 · 1:09:00 | Uday · Uber testing infrastructure | Pain | “cash trips only in Brazil with this configuration” |
| [E04:368](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:368) | V19 · 1:09:00–1:10:00 | Uday · Uber testing infrastructure | Practice | “Replay just this request on my slate environment” |
| [E04:369](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:369) | V19 · 1:10:00–1:11:00 | Uday · Uber testing infrastructure | Practice | “one specific combination ... focused on” |
| [E04:370](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:370) | V19 · 1:11:00 | Uday · Uber testing infrastructure | Practice | “don't necessarily have to use Deputy and Cerberus” |
| [E04:371](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:371) | V19 · 1:11:00–1:12:00 | Uday · Uber testing infrastructure | Roadmap | “expose all of the Capri functionality to agents” |
| [E04:372](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:372) | V19 · 1:12:00–1:13:00 | Uday · Uber API platform | Hand-rolled | “all APIs go through one single entry point” |
| [E04:373](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:373) | V19 · 1:13:00 | Uday · Uber API platform | Practice | “required dependency ... optional dependency” |
| [E04:374](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:374) | V19 · 1:13:00–1:14:00 | Uday · Uber API platform | Practice | “potential unhealthy node” |
| [E04:375](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:375) | V19 · 1:14:00 | Uday · Uber large-scale change tooling | Pain | “upgrade this library usage across all of the modules” |
| [E04:376](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:376) | V19 · 1:14:00–1:15:00 | Uday · Uber large-scale change tooling | Hand-rolled | “using open rewrite policies” |
| [E04:377](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:377) | V19 · 1:14:00–1:15:00 | Uday · Uber large-scale change tooling | Practice | “fixed context propagation across all the services” |
| [E04:378](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:378) | V19 · 1:15:00 | Uday · Uber large-scale change tooling | Practice | “a YAML file with the policy ... track ... status” |
| [E04:379](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:379) | V19 · 1:15:00–1:16:00 | Uday · Uber maintenance automation | Hand-rolled | “we call it Fox” |
| [E04:380](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:380) | V19 · 1:16:00 | Uday · Uber maintenance automation | Practice | “when we don't have that much CI load” |
| [E04:381](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:381) | V19 · 1:17:00 | Uday · Uber maintenance automation | Roadmap | “opt-in phase ... move some of them to opt-out phase” |
| [E04:382](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:382) | V19 · 1:17:00 | Uday · Uber maintenance automation | Practice | “look at all kinds of PRs with maintenance category” |
| [E04:383](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:383) | V19 · 1:17:00–1:18:00 | Uday · Uber dogfooding tools | Hand-rolled | “use wisdom ... employees dogfood our products” |
| [E04:384](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:384) | V19 · 1:18:00–1:19:00 | Uday · Uber dogfooding tools | Pain | “a huge problem to reproduce” |
| [E04:385](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:385) | V19 · 1:18:00 | Uday · Uber dogfooding tools | Practice | “mock the location on the device” |
| [E04:386](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:386) | V19 · 1:19:00 | Uday · Uber dogfooding tools | Hand-rolled | “Debugger Assist ... pinpoint ... the root cause” |
| [E04:387](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:387) | V19 · 1:19:00–1:20:00 | Uday · Uber dogfooding tools | Practice | “root cause looks good ... create a PR” |
| [E04:388](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:388) | V19 · 1:20:00 | Uday · Uber dogfooding tools | Practice | “someone updated the root cause on the comments” |
| [E04:389](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:389) | V19 · 1:20:00–1:21:00 | Uday · Uber dogfooding tools | Hand-rolled | “serve the same network responses ... to ... my test device” |
| [E04:390](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:390) | V19 · 1:21:00 | GB · former Uber engineer | Pain | “need to build ... custom tools ... even on the web” |
| [E04:391](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:391) | V19 · 1:21:00–1:22:00 | Uday · Uber engineering leader | Practice | “find the next bottleneck ... remove that” |
| [E04:392](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:392) | V19 · 1:22:00 | Uday · Uber engineering leader | Limit | “don't have the sufficient orchestrating capabilities ... tools around that” |
| [E04:393](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:393) | V19 · 1:23:00 | Uday · Uber engineering leader | Practice | “surveys ... code quality dimensions ... incidents ... coverage” |
| [E04:394](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:394) | V19 · 1:24:00 | Uday · Uber engineering leader | Wish / gap | “not necessarily just dev velocity, but feature velocity” |
| [E04:395](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:395) | V19 · 1:24:00–1:25:00 | Uday · Uber engineering leader | Hand-rolled | “tagging all of our PRs to different categories” |
| [E04:396](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:396) | V19 · 1:25:00 | Uday · Uber engineering leader | Pain | “harder to measure ... cycle time end to end reliably” |
| [E04:397](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:397) | V19 · 1:25:00–1:26:00 | Uday · Uber engineering leader | Hand-rolled | “automatically cluster these things ... tag any missing things” |
| [E04:398](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:398) | V19 · 1:26:00–1:27:00 | Uday · Uber engineering leader | Practice | “what kind of context it would need” |
| [E04:399](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:399) | V19 · 1:27:00–1:28:00 | Uday · Uber engineering leader | Pain | “constantly switching between so many things” |
| [E04:400](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:400) | V19 · 1:27:00–1:28:00 | Uday · Uber engineering leader | Limit | “if you're not able to verify the work” |
| [E04:402](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:402) | V19 · 1:28:00–1:29:00 | Uday · Uber customer-support collaboration | Pain | “a run book ... whole bunch of steps to create a policy” |
| [E04:403](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:403) | V19 · 1:29:00 | Uday · Uber customer-support collaboration | Hand-rolled | “weeks, now it's like order of days” |
| [E04:404](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:404) | V19 · 1:29:00–1:30:00 | Uday · Uber customer-support collaboration | Roadmap | “past context to create synthetic evals” |
| [E04:405](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:405) | V19 · 1:30:00 | Uday · Uber customer-support collaboration | Practice | “human verification steps in between” |

### E05

| Ledger anchor | Video / caption time | Speaker / role | Signal type | Q — caption excerpt |
|---|---|---|---|---|
| [E05:21](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:21) | V20 · 0:02 | GO, host; advert | Roadmap | “the platform mirrors your repo” |
| [E05:24](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:24) | V20 · 0:06–0:07 | SN, consultant | Hand-rolled | “a refactoring using regular expressions accounting for line lengths” |
| [E05:30](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:30) | V20 · 0:13 | SN, former ThoughtWorks | Hand-rolled | “I created something called DBDeploy” |
| [E05:34](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:34) | V20 · 0:20 | SN, independent consultant | Pain | “current Sam frequently is cursing past Sam for the commitments he's made” |
| [E05:39](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:39) | V20 · 0:28 | GO, former Uber engineer | Pain | “this like lone service was on the path” |
| [E05:40](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:40) | V20 · 0:29 | GO, recounting Uber's CTO | Hand-rolled | “everything new needs to be your own service” |
| [E05:41](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:41) | V20 · 0:29 | GO, former Uber engineer | Pain | “maybe some to be merging based on business domain” |
| [E05:49](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:49) | V20 · 0:37 | SN, consultant | Limit | “before the whole world is ready to say the spec is the source of truth” |
| [E05:57](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:57) | V20 · 0:42 | SN, recounting a small software factory | Hand-rolled | “actively pulling in their observability data, their [OTel] stuff” |
| [E05:58](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:58) | V20 · 0:42 | SN, consultant | Pain | “acceptance criteria ... were always very narrow around functional requirement stuff” |
| [E05:63](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:63) | V20 · 0:46 | SN, author | Pain | “very difficult to take some of those ideas ... palatable for normal people” |
| [E05:64](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:64) | V20 · 0:47–0:49 | SN and GO | Wish / gap | “the kind of equivalent of a rubber ring” |
| [E05:65](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:65) | V20 · 0:50 | SN, consultant | Practice | “being honest about mistakes ... talking about them and sharing them” |
| [E05:69](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:69) | V20 · 0:54 | SN, consultant | Pain | “rabbits ... ate through a networking cable” |
| [E05:70](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:70) | V20 · 0:55 | SN, consultant | Pain | “Some resource has been totally saturated somewhere” |
| [E05:71](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:71) | V20 · 0:57 | SN, consultant | Pain | “You can't correlate them unless you do extra work” |
| [E05:74](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:74) | V20 · 0:59 | GO, former Uber engineer | Pain | “Even your [logs] can be as healthy as can be, but people are upset” |
| [E05:78](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:78) | V20 · 1:03–1:04 | SN, consultant | Open question | “How resilient do we need to be?” |
| [E05:79](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:79) | V20 · 1:04–1:05 | GO and SN | Pain | “you need to know what the trade-offs are” |
| [E05:86](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:86) | V20 · 1:14 | SN, consultant | Limit | “they're actually different and they can be done close to each other” |
| [E05:89](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:89) | V20 · 1:16 | GO, host, recounting GitHub | Pain | “recovery took a lot longer ... there were retries” |
| [E05:93](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:93) | V20 · 1:18 | SN, consultant | Practice | “externalizing those values” |
| [E05:94](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:94) | V20 · 1:18–1:19 | SN, consultant | Practice | “a more constrained sign-up ... fewer invite codes” |
| [E05:99](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:99) | V20 · 1:23 | GO, former Uber engineer | Practice | “early ... failed open ... profitability, we fail closed” |
| [E05:102](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:102) | V20 · 1:27–1:28 | GO, former Uber engineer | Pain | “you did it once, that's not enough” |
| [E05:104](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:104) | V20 · 1:29 | SN, consultant | Pain | “quite hierarchical ... deal with surprise badly” |
| [E05:106](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:106) | V20 · 1:30 | GO, recounting Meta outage | Pain | “which was running on their own domain, which was down” |
| [E05:111](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:111) | V20 · 1:33–1:34 | SN, consultant | Prediction | “none of it stacks up financially” |
| [E05:117](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:117) | V20 · 1:37 | SN, consultant | Prediction | “guardrails ... not long-term going to be the right solution” |
| [E05:135](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:135) | V20 · 1:53–1:54 | SN and GO | Practice | “If you've got a decent test suite” |
| [E05:158](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:158) | V21 · 02:00 | GO, reporting Peter Mattis / Cockroach Labs | Pain | “cognitive overhead of five to 10 agent sessions” |
| [E05:159](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:159) | V21 · 02:00–04:00 | GO, industry reporter | Prediction | “IDEs are just fading away” |
| [E05:167](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:167) | V21 · 06:00–07:00 | GO, reporting Anthropic / OpenAI | Prediction | “Migration[s] ... no longer take years” |
| [E05:168](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:168) | V21 · 07:00 | GO, reporting OpenAI API migration | Roadmap | “Python to Rust ... about 90% done” |
| [E05:169](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:169) | V21 · 07:00 | GO, reporting Asana | Limit | “they spent a few years before doing it” |
| [E05:170](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:170) | V21 · 07:00–08:00 | GO, reporting Airbnb / Asana / Uber | Practice | “practically full rewrites of test suites” |
| [E05:174](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:174) | V21 · 09:00 | GO, industry reporter | Pain | “Uber ... annual budget for AI” |
| [E05:180](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:180) | V21 · 12:00 | GO, industry reporter | Prediction | “agentic infra is finally its own discipline” |
| [E05:203](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:203) | V21 · 24:00 | GO, referencing Charity Majors | Prediction | “We ... will stop reading the code” |
| [E05:204](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:204) | V21 · 24:00–25:00 | GO, industry reporter | Prediction | “eval[s] will be part of CICD” |
| [E05:205](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:205) | V21 · 25:00 | GO, industry reporter | Prediction | “a refactoring wave of migrations, rewriting” |
| [E05:213](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:213) | V21 · 28:00–29:00 | GO, reporting Peter Mattis | Practice | “learned more in the past year than ... previous 5 years combined” |
| [E05:214](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:214) | V21 · 29:00 | GO, quoting Peter Mattis | Pain | “a little bit exhausting ... very very exciting” |
| [E05:237](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:237) | V22 · 0:11–0:12 | PM, former Gmail storage engineer | Hand-rolled | “there's already a prototype and then it was completely rewritten” |
| [E05:238](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:238) | V22 · 0:12 | PM, former Gmail engineer | Hand-rolled | “message threading right from the get-go” |
| [E05:239](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:239) | V22 · 0:12 | PM, systems engineer | Practice | “implemented them like a dozen times now” |
| [E05:246](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:246) | V22 · 0:18–0:19 | PM, former Colossus engineer | Hand-rolled | “pioneer internally ... make this work in distributed file system” |
| [E05:247](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:247) | V22 · 0:19 | PM, former Colossus engineer | Pain | “triplication, three times as much storage” |
| [E05:250](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:250) | V22 · 0:22–0:23 | PM, former Colossus engineer | Hand-rolled | “a foundation Bigtable ... didn't use Colossus” |
| [E05:260](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:260) | V22 · 0:31 | PM, C++ B-tree implementer | Limit | “you don't get pointer stability” |
| [E05:262](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:262) | V22 · 0:32 | PM, systems engineer | Prediction | “nobody should even implement this anymore” |
| [E05:276](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:276) | V22 · 0:44–0:46 | PM, storage/database engineer | Limit | “large append-only files ... You can't update” |
| [E05:277](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:277) | V22 · 0:46 | PM, Cockroach Labs | Hand-rolled | “reimplemented ... called Pebble” |
| [E05:278](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:278) | V22 · 0:46–0:47 | PM, Viewfinder / Cockroach co-founder | Wish / gap | “We didn't really like the things that were out there” |
| [E05:279](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:279) | V22 · 0:47 | PM, Viewfinder co-founder | Practice | “we're doing a mobile photo sharing site. We shouldn't build ... database” |
| [E05:280](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:280) | V22 · 0:47 | PM, Cockroach co-founder | Hand-rolled | “work on this part-time ... see if it had life” |
| [E05:283](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:283) | V22 · 0:50–0:51 | PM, Cockroach Labs CTO | Pain | “calling us up after they've had a disaster” |
| [E05:284](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:284) | V22 · 0:51 | PM, recounting an unnamed bank | Pain | “region-wide power outage” |
| [E05:285](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:285) | V22 · 0:51 | PM, Cockroach Labs CTO | Pain | “maximum size ... Aurora instances” |
| [E05:286](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:286) | V22 · 0:51–0:52 | PM, database engineer | Pain | “application developer is becoming a database developer” |
| [E05:287](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:287) | V22 · 0:52–0:53 | PM, database engineer | Pain | “one of your shards will get full ... re-shard” |
| [E05:288](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:288) | V22 · 0:53–0:54 | PM, database engineer | Practice | “partition contiguous spans” |
| [E05:289](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:289) | V22 · 0:55–0:57 | PM, database engineer | Pain | “very egregious bugs” |
| [E05:290](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:290) | V22 · 0:58–0:59 | PM, database engineer | Pain | “puts bigger burden on the application developer” |
| [E05:292](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:292) | V22 · 1:00–1:01 | PM, database engineer | Limit | “how do I know ... written to the primary?” |
| [E05:293](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:293) | V22 · 1:01–1:02 | PM, database engineer | Limit | “there's a slowdown ... more storage space” |
| [E05:294](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:294) | V22 · 1:02 | PM, database engineer | Practice | “do all your reads in one ... parallel read set” |
| [E05:297](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:297) | V22 · 1:05–1:06 | PM, database founder | Limit | “quite a while to build a distributed database” |
| [E05:298](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:298) | V22 · 1:06–1:07 | PM, Cockroach Labs | Pain | “ran into limitations with [RocksDB]” |
| [E05:309](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:309) | V22 · 1:15–1:16 | PM and GO | Disagreement | “not like management ... so much of the human stuff” |
| [E05:310](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:310) | V22 · 1:17–1:18 | PM, database founder | Prediction | “asymptotically approaching 100% ... written by AI” |
| [E05:319](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:319) | V22 · 1:23–1:25 | GO versus PM | Disagreement | “quality declines” / “quality has to be higher” |
| [E05:320](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:320) | V22 · 1:24 | PM, database engineer | Pain | “The agents are lazy” |
| [E05:321](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:321) | V22 · 1:25 | PM, database engineer | Practice | “property-based ... metamorphic ... Deterministic simulation testing” |
| [E05:323](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:323) | V22 · 1:26 | PM, Cockroach Labs CTO | Practice | “designer just deals with HTML and CSS and JavaScript directly” |
| [E05:332](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:332) | V22 · 1:35 | PM, database engineer | Limit | “ultimately hollow inside” |
| [E05:388](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:388) | V23 · 0:34–0:35 | MP, grill-me author | Hand-rolled | “interview you relentlessly about the topic” |
| [E05:417](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:417) | V23 · 0:54 | MP, agent user | Pain | “Only at the end ... plugging things together” |
| [E05:425](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:425) | V23 · 1:00–1:01 | MP, educator | Practice | “optimize our code bases for new starters” |
| [E05:434](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:434) | V23 · 1:07 | MP, skill author | Practice | “common set of skills ... AB test things” |
| [E05:442](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:442) | V23 · 1:11 | MP and GO | Pain | “a thousand Git work trees ... hard drive” |
| [E05:446](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:446) | V23 · 1:13 | MP, workflow author | Limit | “wrong code ... influencing everything ... afterwards” |
| [E05:465](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:465) | V23 · 1:30 | MP, novice-programmer retrospective | Pain | “six nested for loops” |
| [E05:469](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:469) | V23 · 1:32–1:33 | MP, reporting Lars Grammel / Vercel AI SDK | Roadmap | “entire software factory ... a ton of issues” |

### E06

| Ledger anchor | Video / caption time | Speaker / role | Signal type | Q — caption excerpt |
|---|---|---|---|---|
| [E06:24](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:24) | V24 · 00:12–00:15 | Lattner | Practice | “every 6 months we'd have a new thing that worked well” |
| [E06:26](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:26) | V24 · 00:18 | Orosz, sponsor narration | Pain, advertisement | “hoping time stamps align across different systems” |
| [E06:33](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:33) | V24 · 00:29 | Lattner | Practice, historical | “pulling the lived experience ... closer to what Swift would be” |
| [E06:39](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:39) | V24 · 00:34 | Lattner | Roadmap, historical | “we will break your source code” |
| [E06:41](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:41) | V24 · 00:38 | Orosz, former Uber engineer | Disagreement, historical | “the results were pretty much 50/50” |
| [E06:43](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:43) | V24 · 00:40 | Lattner | Practice, historical | “Swift UI was like a reason that moved ... longtail people” |
| [E06:89](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:89) | V24 · 01:26–01:27 | Lattner | Limit | “JavaScript will never be a good way to write a ... GPU kernel” |
| [E06:119](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:119) | V25 · 05:00–06:00 | Lattner | Prediction | “AI hardware is only going to [get] weirder” |
| [E06:144](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:144) | V26 · 07:00 | Rashid | Wish / gap | “tooling that will work across a broader diversity of hardware” |
| [E06:150](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:150) | V26 · 10:00–11:00 | d-Matrix panelist | Prediction / adoption | “no longer reluctant ... something which doesn't look like a GPU” |
| [E06:152](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:152) | V26 · 11:00 | d-Matrix panelist | Disagreement | “I partly disagree ... It's just arriving” |
| [E06:153](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:153) | V26 · 11:00 | d-Matrix panelist | Limit | “Vast vast majority ... proprietary ... closed source” |
| [E06:170](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:170) | V26 · 23:00–24:00 | d-Matrix panelist | Prediction | “mix of models ... function calls ... web searches, database lookups” |
| [E06:182](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:182) | V26 · 31:00 | AWS panelist; Lattner | Prediction / open question | “live data ... from the field ... high reliability” |
| [E06:184](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:184) | V26 · 32:00–33:00 | d-Matrix panelist | Hand-rolled | “we created the jetream [Jetstream] card” |
| [E06:212](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:212) | V28 · 02:00–03:00 | Quentin, General Catalyst | Disagreement / prediction | “investment going to everything” |
| [E06:214](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:214) | V28 · 04:00–05:00 | Dave, GV | Disagreement | “the infrastructure layer is pretty well baked” |
| [E06:217](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:217) | V28 · 06:00 | Michelle | Pain | “technology risk ... customer concentration risk” |
| [E06:261](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:261) | V28 · 29:00–30:00 | Liz | Practice | “application layer and ... orthogonal domains” |
| [E06:294](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:294) | V29 · 09:00 | Davis, quoting model output | Limit / hand-rolled | “Only the snapshots we record ourselves going forward” |
| [E06:297](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:297) | V29 · 09:00–10:00 | Davis | Pain | “dozens of threads ... forget where you were” |
| [E06:298](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:298) | V29 · 10:00 | Davis, T3 contributor | Hand-rolled | “feature ... I actually threw in there because I've wanted this” |
| [E06:300](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:300) | V29 · 11:00 | Davis | Pain | “where models really struggle right now” |
| [E06:301](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:301) | V29 · 11:00 | Davis | Wish / gap | “decision making in between ... missing on these long running tasks” |
| [E06:343](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:343) | V30 · 10:00 | Davis, describing his product | Hand-rolled | “one of the things I recently added is a search command” |
| [E06:347](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:347) | V30 · 12:00 | Davis | Wish / practice | “inbox filters and tags and folders ... something like Jev” |
| [E06:350](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:350) | V30 · 13:00 | Davis | Practice | “file downloads and key managements across 10 different tabs” |
| [E06:377](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:377) | V31 · 02:00 | Davis | Hand-rolled | “interface here is custom ... a fork” |
| [E06:380](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:380) | V31 · 03:00 | Davis | Practice | “old laptop ... background server and internal API” |
| [E06:385](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:385) | V31 · 05:00–06:00 | Davis, advertisement/user | Practice / claimed shipped | “actual reproductions ... within their sandboxing system” |
| [E06:390](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:390) | V31 · 07:00 | Davis | Hand-rolled / practice | “another ... central gateway ... Executor” |
| [E06:398](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:398) | V31 · 11:00 | Davis | Practice | “put it in the new format ... It did that” |
| [E06:423](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:423) | V31 · 19:00–20:00 | Davis | Pain | “I find myself losing work more” |
| [E06:429](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:429) | V31 · 22:00–23:00 | Davis | Hand-rolled | “self-hosted custom Agents Google Drive” |
| [E06:455](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:455) | V32 · 05:00 | Davis | Pain / limit | “obscene numbers of unit tests” |
| [E06:457](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:457) | V32 · 06:00 | Davis | Practice / prediction | “normal REST API ... generate ... types” |
| [E06:462](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:462) | V32 · 08:00 | Davis | Prediction / practice | “languages are much more fungible” |
| [E06:540](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:540) | V33 · 00:55–00:56 | Bryce | Limit | “checkpointing frequency” |

### E07

| Ledger anchor | Video / caption time | Speaker / role | Signal type | Q — caption excerpt |
|---|---|---|---|---|
| [E07:53](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:53) | V34 · 18:00 | Gabe / Harvey | Open question | “I don't know how to measure this” |
| [E07:70](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:70) | V34 · 27:00 | Baseten team | Pain | “their value function … is … not as good as … A Human researcher” |
| [E07:128](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:128) | V35 · 30:00–31:00 | Ball / Amp | Pain | “It hit the database a lot” |
| [E07:133](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:133) | V35 · 34:00–35:00 | Slack / Amp | Pain | “a tool to get a lot of humans to work together in alignment” |
| [E07:151](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:151) | V35 · 46:00 | Slack / Amp | Pain | “I would chunk it into bigger chunks, which actually adds risk” |
| [E07:157](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:157) | V35 · 49:00 | Slack / Amp | Pain | “some new versions and some old versions” |
| [E07:158](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:158) | V35 · 49:00 | Slack / Amp | Pain | “No one ever goes back and cleans it up” |
| [E07:159](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:159) | V35 · 49:00–50:00 | Ball / Amp | Practice | “everybody pushes small changes” |
| [E07:174](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:174) | V35 · 56:00–57:00 | Ball / Slack, Amp | Wish / gap | “I don't know which users affected” |
| [E07:213](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:213) | V36 · 10:00 | Slack / Amp | Pain | “typing … feels like breathing through a straw” |
| [E07:221](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:221) | V36 · 15:00 | Slack / Amp | Pain | “we'll see if we can get that on the road map” |
| [E07:232](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:232) | V36 · 21:00 | Slack / Amp | Practice | “not doing code review on 20% of the PRs” |
| [E07:259](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:259) | V37 · 02:00–03:00 | Ball / Amp | Prediction | “prompting is now what and not how” |
| [E07:264](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:264) | V37 · 06:00 | Ball / Amp | Pain | “ran into problems with Cloudflare durable objects” |
| [E07:269](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:269) | V37 · 08:00–09:00 | Ball / Amp | Disagreement | “no more context management” |
| [E07:282](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:282) | V37 · 14:00 | Ball / Amp | Limit | “a CSS error is not the same as a broken database migration” |
| [E07:284](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:284) | V37 · 15:00–16:00 | Ball / Amp | Hand-rolled | “no behavior difference between the main and the refactor” |
| [E07:289](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:289) | V37 · 18:00 | Ball / Amp | Wish / gap | “make your codebase legible for the agent” |
| [E07:318](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:318) | V37 · 32:00–33:00 | Ball / Amp | Hand-rolled | “spawn orbs that run into memory issues” |
| [E07:337](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:337) | V38 · 03:00–04:00 | Ball / Amp, secondhand story | Pain | “€50 a week” |
| [E07:348](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:348) | V38 · 14:00–15:00 | Slack / Amp | Limit | “it would have to be watered down” |
| [E07:360](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:360) | V38 · 24:00 | Slack / Amp | Open question | “what can you do to balance out that risk” |
| [E07:364](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:364) | V38 · 27:00 | Ball / Amp | Pain | “AI generated messages in Slack and Teams and notion and PRDS” |
| [E07:382](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:382) | V38 · 38:00–39:00 | Ball / Amp | Practice | “running on my Raspberry Pi” |
| [E07:397](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:397) | V38 · 51:00–52:00 | Slack / Amp | Prediction | “planning is dead or … change 99.99%” |
| [E07:426](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:426) | V39 · 05:00–06:00 | Amp presenter / evaluator text | Limit | “traces don't show the checkout revision” |
| [E07:431](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:431) | V39 · 07:00 | Amp presenter | Practice | “autonomously use the dev tooling” |
| [E07:476](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:476) | V41 · 04:00–05:00 | Ball / Amp | Practice | “recorded a video … send it to AMP” |
| [E07:479](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:479) | V41 · 06:00–07:00 | Ball / Amp | Practice | “promote this feature … an experimental feature” |
| [E07:491](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:491) | V41 · 14:00 | Ball / Amp | Practice | “we don't crash and instead we show warning” |
| [E07:494](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:494) | V41 · 15:00–16:00 | Ball / Amp | Pain | “every time we send a tool progress we run an expensive query” |
| [E07:528](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:528) | V42 · 03:00 | Ball / Amp | Practice | “SQLite … doesn't need a different database server” |
| [E07:529](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:529) | V42 · 03:00 | Ball / Amp | Practice | “prepare local demo database without reseeding” |
| [E07:532](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:532) | V42 · 04:00–05:00 | Ball / Amp | Practice | “amp resume script” |
| [E07:537](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:537) | V42 · 07:00 | Ball / Amp | Pain | “Laravel isn't recognizing the HTTPS header” |

### E08

| Ledger anchor | Video / caption time | Speaker / role | Signal type | Q — caption excerpt |
|---|---|---|---|---|
| [E08:29](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:29) | V43 · 04:00 | Torsten / Amp | Practice | “click on this to steer” |
| [E08:30](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:30) | V43 · 04:00–05:00 | Torsten / Amp | Practice | “active subscriber count shown elsewhere” |
| [E08:61](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:61) | V44 · 04:00 | Vela / Runpod | Pain | “waiting like 30 minutes” |
| [E08:63](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:63) | V44 · 05:00 | Vela / Runpod | Hand-rolled | “We have a whole watchdog” |
| [E08:73](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:73) | V44 · 09:00 | Vela / Runpod | Pain | “a failure with a GPU” |
| [E08:118](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:118) | V45 · 08:00 | Ali / Arize | Limit | “announce a step in one turn” |
| [E08:132](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:132) | V45 · 12:00 | Ali / Arize | Pain | “we over-engineer” |
| [E08:143](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:143) | V45 · 16:00 | Ali / Arize | Pain | “bugs rarely show up as explicit errors” |
| [E08:150](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:150) | V45 · 18:00 | Ali / Arize | Practice | “errors with an obvious fix” |
| [E08:168](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:168) | V46 · 01:00 | Wotherspoon / DeepMind | Limit | “your own kind of subscription” |
| [E08:175](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:175) | V46 · 05:00 | Wotherspoon / DeepMind | Practice | “upload files to the sandbox” |
| [E08:177](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:177) | V46 · 05:00–06:00 | Wotherspoon / DeepMind | Practice | “different agents pointed at the same sandbox” |
| [E08:185](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:185) | V46 · 10:00 | Wotherspoon / DeepMind | Practice | “a very fresh … context window” |
| [E08:189](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:189) | V46 · 12:00 | Wotherspoon / DeepMind | Practice | “secrets never actually enter the sandbox” |
| [E08:199](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:199) | V46 · 18:00 | Wotherspoon / DeepMind | Practice | “might not want to have this … stream” |
| [E08:220](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:220) | V47 · 03:00 | King / Arize | Practice | “search for the specific tool” |
| [E08:221](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:221) | V47 · 03:00 | King / Arize | Practice | “multiple tools in one turn” |
| [E08:228](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:228) | V47 · 06:00 | King / Arize | Hand-rolled | “a Python's sandbox” |
| [E08:229](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:229) | V47 · 06:00 | King / Arize | Hand-rolled | “hoisted all our rest CRUD endpoints” |
| [E08:231](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:231) | V47 · 07:00 | King / Arize | Pain | “paginate through all your traces” |
| [E08:232](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:232) | V47 · 07:00–08:00 | King / Arize | Hand-rolled | “programming paradigm in our UI” |
| [E08:234](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:234) | V47 · 08:00 | King / Arize | Limit | “CPU, memory, how long those sandboxes stay around” |
| [E08:236](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:236) | V47 · 08:00–09:00 | King / Arize | Pain | “different vaulting strategy” |
| [E08:241](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:241) | V47 · 09:00 | King / Arize | Pain | “sandboxes don't boot … perfectly” |
| [E08:246](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:246) | V47 · 10:00 | King / Arize | Pain | “a double sandboxing … problem” |
| [E08:248](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:248) | V47 · 10:00 | King / Arize | Limit | “You can't resume from that step” |
| [E08:249](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:249) | V47 · 10:00–11:00 | King / Arize | Limit | “JavaScript … maybe not great for math” |
| [E08:250](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:250) | V47 · 11:00 | King / Arize | Limit | “getting that out of the sandbox is quite tricky” |
| [E08:252](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:252) | V47 · 11:00 | King / Arize | Limit | “a smaller model … might not just quite … get there” |
| [E08:253](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:253) | V47 · 11:00–12:00 | King / Arize | Practice | “network access turned off” |
| [E08:256](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:256) | V47 · 13:00 | King / Arize | Practice | “tokens by 43%” |
| [E08:257](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:257) | V47 · 13:00 | King / Arize | Limit | “latency stayed pretty constant” |
| [E08:260](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:260) | V47 · 14:00 | King / Arize | Wish / gap | “bring any model” |
| [E08:273](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:273) | V48 · 00:00 | Matt Carey / Cloudflare | Limit | “about like 2 million tokens” |
| [E08:274](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:274) | V48 · 00:00 | Carey / Cloudflare | Limit | “you actually lose loads of options” |
| [E08:275](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:275) | V48 · 00:00 | Carey / Cloudflare | Hand-rolled | “just over a thousand tokens” |
| [E08:276](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:276) | V48 · 05:00 | Carey / Cloudflare | Wish / gap | “How do you let it access your … data?” |
| [E08:277](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:277) | V48 · 05:00–06:00 | Carey / Cloudflare | Limit | “limited by how many tools you can have” |
| [E08:278](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:278) | V48 · 06:00 | Carey / Cloudflare | Pain | “the less performance the model has” |
| [E08:279](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:279) | V48 · 06:00 | Carey / Cloudflare | Limit | “the API just completely won't work” |
| [E08:280](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:280) | V48 · 06:00 | Carey / Cloudflare | Pain | “turning on tools … turning them off” |
| [E08:281](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:281) | V48 · 06:00–07:00 | Carey / Cloudflare | Hand-rolled | “generate a TypeScript SDK from the tool specification” |
| [E08:282](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:282) | V48 · 07:00 | Carey / Cloudflare | Pain | “that's not exactly how it worked out” |
| [E08:283](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:283) | V48 · 07:00 | Carey / Cloudflare | Pain | “cherrypick the best seven things” |
| [E08:284](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:284) | V48 · 08:00 | Carey / Cloudflare | Limit | “you lose like the edge cases” |
| [E08:285](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:285) | V48 · 08:00 | Carey / Cloudflare | Hand-rolled | “move all of the execution to the server” |
| [E08:286](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:286) | V48 · 10:00 | Carey / Cloudflare | Practice | “narrow it down to the particular account” |
| [E08:287](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:287) | V48 · 11:00 | Carey / Cloudflare | Practice | “it'll just have to do less search” |
| [E08:288](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:288) | V48 · 11:00 | Carey / Cloudflare | Pain | “Unknown field zone name” |
| [E08:289](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:289) | V48 · 11:00–12:00 | Carey / Cloudflare | Pain | “Too many zones requested” |
| [E08:290](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:290) | V48 · 12:00 | Carey / Cloudflare | Open question | “something that was actually impossible potentially” |
| [E08:291](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:291) | V48 · 12:00 | Carey / Cloudflare | Practice | “not always exposed on the dashboard” |
| [E08:292](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:292) | V48 · 13:00 | Carey / Cloudflare | Pain | “doesn't have right permissions” |
| [E08:293](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:293) | V48 · 13:00–14:00 | Carey / Cloudflare | Hand-rolled | “pick exactly the scopes” |
| [E08:294](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:294) | V48 · 14:00 | Carey / Cloudflare | Limit | “want to be able to narrow it down” |
| [E08:295](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:295) | V48 · 14:00 | Carey / Cloudflare | Practice | “enabled the workers.dev subdomain” |
| [E08:296](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:296) | V48 · 15:00 | Carey / Cloudflare | Practice | “if I know the how … I normally tell it” |
| [E08:297](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:297) | V48 · 16:00 | Carey / Cloudflare | Pain | “I had to reload the page” |
| [E08:298](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:298) | V48 · 16:00–17:00 | Carey / Cloudflare | Wish / gap | “make this multiplayer” |
| [E08:299](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:299) | V48 · 17:00 | Carey / Cloudflare | Practice | “haven't saved any of this code on our computers” |
| [E08:300](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:300) | V48 · 17:00 | Carey / Cloudflare | Practice | “a full multiplayer chat room with one prompt” |
| [E08:301](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:301) | V48 · 18:00–19:00 | Carey / Cloudflare | Pain | “I don't really like know how to use that” |
| [E08:302](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:302) | V48 · 21:00 | Carey / Cloudflare | Pain | “reading some docs” |
| [E08:303](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:303) | V48 · 20:00–21:00 | Carey / Cloudflare | Practice | “make a policy of only me” |
| [E08:304](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:304) | V48 · 21:00–22:00 | Carey / Cloudflare | Practice | “remove the policy” |
| [E08:305](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:305) | V48 · 22:00 | Carey / Cloudflare | Pain | “might start costing us money” |
| [E08:306](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:306) | V48 · 23:00 | Carey / Cloudflare | Wish / gap | “anything else we made in this session” |
| [E08:307](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:307) | V48 · 23:00 | Carey / Cloudflare | Practice | “a completely clean slate” |
| [E08:308](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:308) | V48 · 24:00 | Carey / Cloudflare | Practice | “never gets loaded into the LLM's context window” |
| [E08:309](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:309) | V48 · 25:00 | Carey / Cloudflare | Limit | “lose a little bit of granularity” |
| [E08:310](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:310) | V48 · 26:00–27:00 | Carey / Cloudflare | Wish / gap | “how can they do this with their own APIs” |
| [E08:311](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:311) | V48 · 27:00 | Carey / Cloudflare | Roadmap | “version two of the code mode SDK” |
| [E08:312](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:312) | V48 · 28:00 | Carey / Cloudflare | Practice | “don't have to own the underlying MCP server” |
| [E08:313](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:313) | V48 · 29:00 | Carey / Cloudflare | Disagreement | “do CLI kill MCP servers” |
| [E08:314](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:314) | V48 · 30:00 | Carey / Cloudflare | Practice | “keep the models in distribution” |
| [E08:315](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:315) | V48 · 30:00 | Carey / Cloudflare | Practice | “changed something, tested it” |
| [E08:316](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:316) | V48 · 31:00 | Carey / Cloudflare | Prediction | “MCP has one” |
| [E08:317](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:317) | V48 · 31:00 | Carey / Cloudflare | Limit | “would not need shell access on my phone” |
| [E08:318](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:318) | V48 · 32:00 | Carey / Cloudflare | Practice | “restrict what fetch requests can be made” |
| [E08:319](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:319) | V48 · 32:00 | Carey / Cloudflare | Practice | “no access to environment variables” |
| [E08:320](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:320) | V48 · 33:00 | Carey / Cloudflare | Pain | “semblance of giving them code” |
| [E08:321](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:321) | V48 · 34:00 | Carey / Cloudflare | Prediction | “change like how people do a lot of stuff” |
| [E08:322](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:322) | V48 · 34:00–35:00 | Carey / Cloudflare | Practice | “structured data and making it unstructured” |
| [E08:323](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:323) | V48 · 35:00–36:00 | Carey / Cloudflare | Roadmap | “as seamless as possible” |
| [E08:324](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:324) | V48 · 37:00 | Carey / Cloudflare | Roadmap | “email sending soon” |
| [E08:325](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:325) | V48 · 38:00 | Carey / Cloudflare | Roadmap | “coming for MCP portals” |
| [E08:326](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:326) | V48 · 38:00–39:00 | Carey / Cloudflare | Wish / gap | “How do we wire all these things up” |
| [E08:327](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:327) | V48 · 39:00 | Carey / Cloudflare | Prediction | “API it's struggling with … pop open a browser” |
| [E08:328](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:328) | V48 · 40:00 | Carey / Cloudflare | Wish / gap | “meet people where they are” |
| [E08:329](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:329) | V48 · 41:00 | Carey / Cloudflare | Prediction | “we become less useful than the agents” |
| [E08:330](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:330) | V48 · 41:00 | Carey / Cloudflare | Pain | “delete all your emails at the speed of light” |
| [E08:331](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:331) | V48 · 41:00–42:00 | Carey / Cloudflare | Wish / gap | “only do what you let them do” |
| [E08:344](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:344) | V49 · 00:00 | Sunil Pai / Cloudflare | Roadmap | “I think I want to compete” |
| [E08:345](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:345) | V49 · 00:00–01:00 | Pai / Cloudflare | Wish / gap | “something better with Workers and Durable Objects” |
| [E08:346](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:346) | V49 · 01:00 | Pai / Cloudflare | Prediction | “every platform will eventually get” |
| [E08:347](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:347) | V49 · 01:00 | Pai / Cloudflare | Practice | “in an infrastructure layer, not in user land” |
| [E08:348](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:348) | V49 · 02:00 | Pai / Cloudflare | Practice | “cancel all outgoing traffic” |
| [E08:349](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:349) | V49 · 02:00 | Pai / Cloudflare | Prediction | “a new kind of architecture” |
| [E08:350](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:350) | V49 · 02:00 | Pai / Cloudflare | Limit | “the tool for each one of them” |
| [E08:351](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:351) | V49 · 03:00 | Pai / Cloudflare | Practice | “no back and forth with the LLM” |
| [E08:352](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:352) | V49 · 03:00–04:00 | Pai / Cloudflare | Prediction | “software that hasn't existed in the past” |
| [E08:354](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:354) | V49 · 04:00–05:00 | Pai / Cloudflare | Wish / gap | “no one has built the React yet” |
| [E08:355](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:355) | V49 · 05:00 | Pai / Cloudflare | Wish / gap | “reproducible across languages, across companies, across infrastructure” |
| [E08:357](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:357) | V49 · 05:00 | Pai / Cloudflare | Open question | “I might as well just express it as code?” |
| [E08:358](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:358) | V49 · 05:00 | Pai / Cloudflare | Prediction | “the future of software is markdown files” |
| [E08:359](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:359) | V49 · 07:00–08:00 | Pai / Cloudflare | Hand-rolled | “make some of this stuff work with Cloudflare” |
| [E08:360](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:360) | V49 · 08:00 | Pai / Cloudflare | Practice | “on Monday … send a PR” |
| [E08:361](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:361) | V49 · 08:00–09:00 | Pai / Cloudflare | Pain | “trashing my work” |
| [E08:362](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:362) | V49 · 09:00–10:00 | Hosts / Latent Space | Pain | “rewrote it in Python” |
| [E08:363](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:363) | V49 · 10:00 | Pai / Cloudflare | Practice | “take our work, fork it, and do whatever” |
| [E08:364](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:364) | V49 · 10:00 | Pai / Cloudflare | Wish / gap | “go for it” |
| [E08:365](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:365) | V49 · 11:00 | Host / Latent Space | Wish / gap | “then you own the dependency” |
| [E08:366](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:366) | V49 · 11:00 | Pai / Cloudflare | Prediction | “build versus buy has really changed” |
| [E08:367](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:367) | V49 · 11:00 | Host / Latent Space | Wish / gap | “go see prior work, fork it, and adapt it” |
| [E08:368](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:368) | V49 · 12:00 | Pai / Cloudflare | Pain | “we had to shut down contributions” |
| [E08:369](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:369) | V49 · 12:00 | Pai / Cloudflare | Practice | “take a resolution and paste it into Opus” |
| [E08:370](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:370) | V49 · 12:00 | Pai / Cloudflare | Pain | “afraid of gaining … popularity” |
| [E08:371](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:371) | V49 · 12:00 | Pai / Cloudflare | Pain | “fake security reports” |
| [E08:373](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:373) | V49 · 13:00 | Pai / Cloudflare | Wish / gap | “be original” |
| [E08:374](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:374) | V49 · 13:00 | Pai / Cloudflare | Practice | “Build stuff like for your family” |
| [E08:375](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:375) | V49 · 14:00 | Pai / Cloudflare | Wish / gap | “infrastructure and LLMs almost fail you” |
| [E08:376](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:376) | V49 · 14:00 | Pai / Cloudflare | Disagreement | “I don't need another agent framework” |
| [E08:392](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:392) | V50 · 0:04:00–0:05:00 | Host / Latent Space | Prediction | “a hyper scaler and a cloud platform” |
| [E08:397](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:397) | V50 · 0:08:00–0:09:00 | Jiang / Anthropic product, context attribution | Hand-rolled | “harder to distill from” |
| [E08:399](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:399) | V50 · 0:09:00–0:10:00 | Lesse / Anthropic engineering, context attribution | Pain | “really really hard trade-off” |
| [E08:401](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:401) | V50 · 0:11:00 | Lesse / Anthropic engineering | Practice | “two layers” |
| [E08:402](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:402) | V50 · 0:11:00 | Lesse / Anthropic engineering | Wish / gap | “can't accomplish the same things” |
| [E08:403](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:403) | V50 · 0:12:00 | Lesse / Anthropic engineering | Hand-rolled | “worked … with … open-source harness maintainers” |
| [E08:404](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:404) | V50 · 0:12:00 | Lesse / Anthropic engineering | Pain | “compaction strategies … would have been broken” |
| [E08:410](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:410) | V50 · 0:18:00 | Lesse / Anthropic engineering | Pain | “CPU is really constrained” |
| [E08:418](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:418) | V50 · 0:23:00–0:24:00 | Lesse / Anthropic engineering | Hand-rolled | “a single button to pull back for everybody” |
| [E08:422](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:422) | V50 · 0:29:00 | Lesse / Anthropic engineering | Hand-rolled | “a trust grant” |
| [E08:423](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:423) | V50 · 0:29:00 | Lesse / Anthropic engineering | Practice | “grace period” |
| [E08:449](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:449) | V50 · 0:42:00–0:43:00 | Anthropic guest / attribution uncertain | Practice | “skip setting up all the infrastructure” |
| [E08:450](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:450) | V50 · 0:43:00 | Lesse / Anthropic engineering | Practice | “don't actually share a harness” |
| [E08:467](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:467) | V50 · 0:52:00–0:53:00 | Hosts and Lesse / Latent Space, Anthropic | Practice | “actual prompts” |
| [E08:469](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:469) | V50 · 0:54:00 | Lesse / Anthropic engineering | Pain | “cannot get enough VMs” |
| [E08:473](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:473) | V50 · 0:55:00 | Lesse / Anthropic engineering | Limit | “without compromising … tenant isolation” |
| [E08:483](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:483) | V50 · 0:59:00–1:00:00 | Lesse / Anthropic engineering | Practice | “resisted the urge to add features” |
| [E08:486](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:486) | V50 · 1:01:00 | Host / Latent Space | Wish / gap | “every cloud provider should clone” |
| [E08:489](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:489) | V50 · 1:03:00 | Host / Latent Space | Pain | “trouble … containing agents” |
| [E08:491](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:491) | V50 · 1:04:00 | Lesse / Anthropic engineering | Pain | “boot a sandbox and boot cloud code” |
| [E08:492](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:492) | V50 · 1:04:00 | Lesse / Anthropic engineering | Pain | “you lose your whole agent” |
| [E08:494](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:494) | V50 · 1:05:00 | Lesse / Anthropic engineering | Hand-rolled | “a totally separate vault” |
| [E08:499](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:499) | V50 · 1:07:00–1:08:00 | Lesse / Anthropic engineering | Roadmap | “get that for free” |
| [E08:507](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:507) | V50 · 1:14:00 | Host / Latent Space | Pain | “5 minutes in” |
| [E08:553](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:553) | V50 · 1:46:00 | Jiang / Anthropic product | Practice | “not block its sub agents” |
| [E08:568](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:568) | V51 · 01:00–02:00 | Slack / Amp | Practice | “kill the older features” |
| [E08:574](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:574) | V51 · 03:00 | Slack / Amp | Prediction | “local dev … is dead” |
| [E08:583](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:583) | V51 · 07:00–08:00 | Slack / Amp | Practice | “ship a fix 15 minutes” |
| [E08:587](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:587) | V51 · 09:00 | Slack / Amp | Pain | “number one complaint” |
| [E08:593](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:593) | V51 · 12:00 | Host / Latent Space | Wish / gap | “forkable software” |
| [E08:594](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:594) | V51 · 12:00 | Host / Latent Space | Limit | “front and back end contracts … stable” |
| [E08:598](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:598) | V51 · 15:00 | Slack / Amp | Pain | “core of the most important data models” |
| [E08:599](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:599) | V51 · 15:00 | Slack / Amp | Pain | “over so many different steps” |
| [E08:601](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:601) | V51 · 15:00 | Slack / Amp | Practice | “invariants that it thought of” |
| [E08:602](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:602) | V51 · 16:00 | Slack / Amp | Practice | “then it would roll back” |
| [E08:603](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:603) | V51 · 16:00 | Slack / Amp | Pain | “just babysitting that the whole time” |
| [E08:624](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:624) | V51 · 25:00 | Slack / Amp | Prediction | “days of … CI … numbered” |
| [E08:626](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:626) | V51 · 26:00 | Slack / Amp | Practice | “using E2B right now” |
| [E08:627](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:627) | V51 · 26:00–27:00 | Slack / Amp | Wish / gap | “love to get the costs down” |
| [E08:628](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:628) | V51 · 27:00 | Slack / Amp | Pain | “lack the ability to resume” |
| [E08:629](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:629) | V51 · 27:00 | Slack / Amp | Limit | “no network access” |
| [E08:630](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:630) | V51 · 27:00–28:00 | Host / Latent Space | Open question | “discovering the requirements as they build” |
| [E08:631](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:631) | V51 · 28:00 | Host / Latent Space | Practice | “RL sandbox is totally different” |
| [E08:638](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:638) | V51 · 32:00 | Slack / Amp | Pain | “open source maintenance business” |
| [E08:691](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:691) | V52 · 15:00–16:00 | Krentsel / Exo | Pain | “logged in … GitHub credentials” |
| [E08:692](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:692) | V52 · 16:00–17:00 | Krentsel / Exo | Practice | “three distinct important layers” |
| [E08:694](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:694) | V52 · 17:00 | Krentsel / Exo | Practice | “conversation history … secrets … artifacts or snapshots” |
| [E08:696](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:696) | V52 · 18:00 | Krentsel / Exo | Practice | “snapshots … roll itself back” |
| [E08:699](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:699) | V52 · 20:00 | Krentsel / Exo | Hand-rolled | “guardian … process” |
| [E08:701](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:701) | V52 · 20:00–21:00 | Krentsel / Exo | Practice | “rolled back … automatically” |
| [E08:706](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:706) | V52 · 23:00 | Krentsel / Exo | Limit | “50,000 users” |
| [E08:721](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:721) | V52 · 29:00 | Host / Latent Space | Open question | “real time agents” |
| [E08:723](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:723) | V52 · 30:00 | Krentsel / Exo | Limit | “not an interactive model” |
| [E08:727](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:727) | V52 · 31:00 | Krentsel / Exo | Hand-rolled | “start a different conversation” |

### E09

| Ledger anchor | Video / caption time | Speaker / role | Signal type | Q — caption excerpt |
|---|---|---|---|---|
| [E09:50](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:50) | V53 · 44:00–47:00 | Wes | Limit / Wish / gap | “when something changes on this website … poll” |
| [E09:77](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:77) | V54 · 02:00–04:00 | CJ / Wes / Scott | Disagreement / Pain | “monthly bill” / “Free on Cloudflare” |
| [E09:78](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:78) | V54 · 04:00 | Wes, game reveal | Pain / Disagreement | “most overpriced hosting platform” |
| [E09:83](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:83) | V54 · 09:00–10:00 | Scott | Pain | “I get lost in it a lot” |
| [E09:85](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:85) | V54 · 12:00–13:00 | Wes / CJ | Pain / Practice | “something's on the port” / “Just give me a file” |
| [E09:86](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:86) | V54 · 13:00–14:00 | Scott / hosts | Practice / Pain | “migrate the database to post grass [Postgres]” |
| [E09:111](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:111) | V55 · 07:00–09:00 | Wes / Adam | Wish / gap / Practice | “a totally different API … authenticates different” |
| [E09:112](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:112) | V55 · 08:00–09:00 | Adam | Roadmap | “OpenAI … launching a decision's API” |
| [E09:139](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:139) | V55 · 41:00–43:00 | Adam | Practice | “anti-corruption layer” / “reviewed against that skill” |
| [E09:146](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:146) | V55 · 54:00 | Adam | Practice / Prediction | “telling it to fix my laptop” |
| [E09:163](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:163) | V56 · 00:00–01:00 | Scott, Syntax developer | Pain | “you notice that it died” |
| [E09:167](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:167) | V56 · 03:00 | Scott | Hand-rolled / Pain | “delete about 8,000 lines of custom code” |
| [E09:168](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:168) | V56 · 03:00–05:00 | Scott | Practice | “every tool says whether it's safe to run again” |
| [E09:171](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:171) | V56 · 06:00 | Scott | Disagreement / Practice | “agent deciding what it's going to do next” |
| [E09:172](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:172) | V56 · 07:00–08:00 | Scott | Practice | “browser storing to index DB” / “SQLite” |
| [E09:173](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:173) | V56 · 08:00–09:00 | Scott | Hand-rolled | “web hook through a Cloudflare tunnel” |
| [E09:174](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:174) | V56 · 09:00–10:00 | Scott | Practice | “I can resume it … pick up exactly where it was” |
| [E09:179](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:179) | V56 · 12:00–13:00 | Scott | Practice / Roadmap | “Open Code 2 … run it as a library” |
| [E09:198](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:198) | V57 · 00:00–03:00 | Scott, Syntax developer | Pain / Disagreement | “native web view side of things is not it” |
| [E09:202](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:202) | V57 · 06:00–08:00 | Scott / Wes | Practice / Limit | “implement literally everything” |
| [E09:203](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:203) | V57 · 08:00–10:00 | Scott | Practice | “components … props … state” |
| [E09:204](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:204) | V57 · 11:00–14:00 | Wes / Scott | Limit / Open question | “I'm not seeing any grid” |
| [E09:205](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:205) | V57 · 12:00 | Scott | Pain | “big old long files” |
| [E09:206](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:206) | V57 · 13:00 | Scott / Wes | Wish / gap | “a big old reference docs is what I need” |
| [E09:210](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:210) | V57 · 18:00 | Scott | Roadmap / Practice | “get everything ported over” |
| [E09:211](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:211) | V57 · 19:00–21:00 | Scott, relaying community and maintainer | Disagreement / Limit | “only adding things … that serve them” / “create problems without fixing them” |
| [E09:212](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:212) | V57 · 19:00 | Scott, relaying Cameron Campbell | Roadmap / Practice | “corner smoothing … background blur … shadows and borders” |
| [E09:216](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:216) | V57 · 24:00 | Scott | Roadmap | “redoing my video recorder” |
| [E09:217](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:217) | V57 · 24:00–25:00 | Scott | Hand-rolled / Roadmap | “File Bro … file automations” |
| [E09:220](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:220) | V57 · 21:00, 27:00 | Scott / Wes | Pain / Limit | “I don't have the font size” |
| [E09:222](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:222) | V57 · 28:00–30:00 | Scott | Limit / Hand-rolled | “no browser DOM” / “requires a small patch to GPUi” |
| [E09:223](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:223) | V57 · 29:00 | Scott | Limit / Practice | “still very young” / “Rust best practices skill” |
| [E09:224](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:224) | V57 · 30:00–31:00 | Scott / Wes | Limit | “mobile … experimental” |
| [E09:245](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:245) | V58 · 04:00 | CJ | Limit | “answer get cuts off … hallucinate properties” |
| [E09:255](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:255) | V58 · 09:00 | CJ, relaying demos | Practice | “rules of Tetris” / “driving simulator” |
| [E09:267](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:267) | V58 · 17:00 | CJ | Limit / Practice | “wait list” / “Verscell [Vercel] AI gateway” |
| [E09:298](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:298) | V59 · 22:00 | CJ | Practice | “deploy without creating account” |
| [E09:329](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:329) | V60 · 07:00 | CJ | Pain | “reproducible environments … trickier … GUI programs” |
| [E09:330](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:330) | V60 · 08:00 | CJ | Practice | “one command … micro VMs” |
| [E09:353](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:353) | V61 · 01:00–02:00 | Eric, describing Pstack | Practice / Limit | “mostly working for brownfield project” |
| [E09:361](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:361) | V61 · 05:00–06:00 | Eric | Practice / Pain | “set up the database … servers” |
| [E09:428](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:428) | V62 · 59:00–1:02:00 | Karpathy | Limit / Pain | “hesitant … if people aren't able to … read it” |
| [E09:432](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:432) | V62 · 1:04:00–1:05:00 | Karpathy | Limit | “no database or anything like that” |

### E10

| Ledger anchor | Video / caption time | Speaker / role | Signal type | Q — caption excerpt |
|---|---|---|---|---|
| [E10:25](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:25) | V63 · 05:00–06:00 | Other host | Practice / Roadmap | “instantiate and test code as a plugin in memory” |
| [E10:27](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:27) | V63 · 07:00 | Yuri | Practice / Disagreement | “It's not something fundamentally new. It's just that they do it proactively.” |
| [E10:49](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:49) | V64 · 06:00–07:00 | Lu | Pain | “the feedback loop sometimes creates bad oscillations” |
| [E10:56](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:56) | V64 · 15:00 | Lu | Pain | “networking can just get to all kind of mysterious issues” |
| [E10:57](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:57) | V64 · 16:00 | Lu | Practice | “reduce the routing weight to that engine” |
| [E10:58](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:58) | V64 · 16:00–17:00 | Lu | Pain / Hand-rolled | “more failure and cause more retries” |
| [E10:90](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:90) | V65 · 20:00–21:00 | NVIDIA researcher | Practice / Limit | “switch which model does the decoding” |
| [E10:92](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:92) | V65 · 22:00 | NVIDIA researcher | Open question / Limit | “compaction in its very nature is lossy” |
| [E10:93](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:93) | V65 · 23:00–24:00 | Walden | Practice | “references them by file” |
| [E10:94](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:94) | V65 · 25:00 | Alex | Limit | “we can't see into the KV caches of models” |
| [E10:97](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:97) | V65 · 27:00 | Alex | Pain / Practice | “heartbeats every like 10 minutes to your model of choice” |
| [E10:108](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:108) | V65 · 38:00–39:00 | NVIDIA researcher | Practice | “hallucination probes” |
| [E10:109](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:109) | V65 · 39:00–40:00 | Moderator; Alex | Pain / Limit | “these prompts aren't portable” |
| [E10:110](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:110) | V65 · 40:00 | Alex | Pain / Practice | “all these like doom loops ... best ways to recover” |
| [E10:128](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:128) | V66 · 02:00 | Jediah Katz, Cursor/SpaceXAI harness engineer | Practice | “how state is stored so that work can resume” |
| [E10:136](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:136) | V66 · 09:00 | Katz | Pain / Roadmap | “making slide decks and booking travel” |
| [E10:153](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:153) | V66 · 16:00 | Katz | Hand-rolled / Practice | “whenever a shim stops firing ... a PR” |
| [E10:182](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:182) | V67 · 17:00 | Ousterhout | Open question / Wish / gap | “is high latency for short messages affecting your throughput?” |
| [E10:194](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:194) | V68 · 01:00 | Andrew Qu, Vercel | Pain / Roadmap | “switch out 300 400 lines of provider specific code” |
| [E10:198](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:198) | V68 · 04:00 | Qu | Pain / Practice | “SQL did not execute or was too expensive” |
| [E10:200](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:200) | V68 · 05:00–06:00 | Qu | Pain / Limit | “the only thing that the next agent gets is a summary” |
| [E10:201](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:201) | V68 · 06:00 | Qu | Hand-rolled / Practice | “go back and explore more” |
| [E10:205](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:205) | V68 · 08:00–09:00 | Qu | Hand-rolled / Practice | “dump the whole semantic layer into it” |
| [E10:209](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:209) | V68 · 11:00–12:00 | Qu | Wish / gap | “start from the very last insight” |
| [E10:210](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:210) | V68 · 12:00–13:00 | Qu | Roadmap | “two weeks ago we released Eve” |
| [E10:212](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:212) | V68 · 13:00 | Qu | Roadmap | “short-lived [OIDC] tokens for connections” |
| [E10:214](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:214) | V68 · 14:00 | Qu | Roadmap | “observability out of the box” |
| [E10:215](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:215) | V68 · 15:00–16:00 | Qu | Pain / Limit | “what really makes this agent good ... company knowledge” |
| [E10:216](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:216) | V68 · 16:00 | Qu | Practice | “20 roughly decently PMF agents” |
| [E10:230](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:230) | V69 · 01:00–03:00 | Lloyd | Prediction | “every project of significant size ... something like this” |
| [E10:241](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:241) | V69 · 09:00 | Lloyd | Practice / Pain | “they get stuck at certain points” |
| [E10:243](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:243) | V69 · 10:00 | Lloyd | Hand-rolled / Practice | “a product spec and a tech spec” |
| [E10:247](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:247) | V69 · 12:00 | Lloyd | Pain / Limit | “to build a thing that actually scales” |
| [E10:253](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:253) | V69 · 17:00 | Lloyd | Open question / Practice | “almost contradictory” |
| [E10:302](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:302) | V71 · 03:00–04:00 | Sumner | Pain / Open question | “is this the right thing to merge?” |
| [E10:322](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:322) | V71 · 17:00 | Sumner | Wish / gap | “making it easier to ... roll back things” |
| [E10:330](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:330) | V71 · 22:00; 29:00 | Sumner | Pain / Practice | “it's just been sitting there” |
| [E10:334](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:334) | V71 · 25:00–26:00 | Sumner; Cherny | Prediction / Wish / gap | “a deeper layer of verification” |
| [E10:337](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:337) | V71 · 27:00–28:00 | Cherny; Sumner | Prediction / Practice | “PRs become suggestions” |
| [E10:354](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:354) | V72 · 04:00 | Matan | Pain | “for the next year my life is going to suck” |
| [E10:355](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:355) | V72 · 04:00 | Matan | Hand-rolled / Practice | “extracting lessons ... the way this bank does things” |
| [E10:393](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:393) | V73 · 13:00–14:00 | Every speakers | Pain / Hand-rolled | “we don't want to be an infra team” |
| [E10:394](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:394) | V73 · 14:00 | Every speaker | Roadmap / Practice | “sandboxes ... memory ... session control” |
| [E10:397](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:397) | V73 · 16:00–17:00 | Every speaker | Practice | “who accesses what when” |
| [E10:459](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:459) | V75 · 00:00–01:00 | Collison | Pain | “moments of migration ... fraught and scary” |
| [E10:467](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:467) | V75 · 05:00–06:00 | Collison | Hand-rolled / Pain | “a lot of annotating ... granular permissioning” |
| [E10:470](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:470) | V75 · 07:00 | Collison | Pain / Wish / gap | “couple that to some other set of services” |
| [E10:474](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:474) | V75 · 09:00–10:00 | Collison | Practice / Prediction | “more projects ... improve our architecture” |
| [E10:475](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:475) | V75 · 10:00 | Collison | Prediction | “every codebase is now the prompt for another codebase” |
| [E10:484](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:484) | V75 · 17:00 | Collison | Open question | “How will the agents pay each other? What currency” |
| [E10:505](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:505) | V76 · 07:00–08:00 | Gupta | Limit | “single end-to-end latency number blends all of them” |
| [E10:535](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:535) | V77 · 00:00–01:00 | Reza Jelveh, Dynamia.ai / HAMi | Pain / Limit | “every vendor has their own observability ... stack” |
| [E10:554](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:554) | V77 · 14:00 | Jelveh | Practice / Limit | “ratio between 0 and 100” |
| [E10:558](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:558) | V77 · 16:00 | Jelveh | Roadmap / Wish / gap | “proper versioning ... Helm chart ... GPU operator” |
| [E10:574](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:574) | V78 · 00:00–01:00 | Ben, PlanetScale | Wish / gap / Prediction | “ship fast ... also not break” |
| [E10:575](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:575) | V78 · 01:00 | Ben | Pain | “infrastructure struggles to keep up” |
| [E10:576](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:576) | V78 · 03:00–04:00 | Ben | Practice / Limit | “if something fails, it doesn't take down the whole system” |
| [E10:581](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:581) | V78 · 07:00–08:00 | Ben | Practice / Roadmap | “[Vitess] for [MySQL] and niki for [Postgres]” |
| [E10:583](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:583) | V78 · 09:00 | Ben | Practice / Limit | “rest of your stack has to be built to support that” |
| [E10:584](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:584) | V78 · 09:00–10:00 | Ben | Disagreement / Limit | “all of your services combined into one” |
| [E10:586](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:586) | V78 · 11:00–12:00 | Ben | Pain / Open question | “agents ... control ... most important infrastructure” |
| [E10:587](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:587) | V78 · 12:00 | Ben | Limit / Pain | “not as simple as clicking a button to roll it back” |
| [E10:588](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:588) | V78 · 12:00–13:00 | Ben | Practice | “a [VSchema] ... literally a JSON file” |
| [E10:590](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:590) | V78 · 14:00 | Ben | Pain | “traffic ... two or three or 4x ... AI agents” |
| [E10:591](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:591) | V78 · 14:00–15:00 | Ben | Roadmap / Practice | “traffic control ... categorize and tag” |
| [E10:593](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:593) | V78 · 16:00 | Ben | Roadmap / Practice | “branch your database schema ... deploy request” |
| [E10:594](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:594) | V78 · 16:00–17:00 | Ben | Roadmap / Practice | “[one-click] revert ... without data loss” |
| [E10:595](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:595) | V78 · 17:00 | Ben | Wish / gap / Practice | “mirror database state ... in sync” |
| [E10:597](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:597) | V78 · 18:00 | Ben | Open question | “plenty of debate on which ... better” |

### E11

| Ledger anchor | Video / caption time | Speaker / role | Signal type | Q — caption excerpt |
|---|---|---|---|---|
| [E11:35](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:35) | V79 · 12:00 | Max, Capital One | Pain / Wish | “I thought this was going to be disposable and now it needs to be durable” |
| [E11:39](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:39) | V79 · 14:00 | Max, Capital One | Wish / gap | “every test is fast and deterministic without anybody having to be a deep expert” |
| [E11:42](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:42) | V79 · 15:00 | Max, Capital One | Practice / Pain | “here's my 100,000-line change that I need to make” |
| [E11:60](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:60) | V80 · 11:00–14:00 | Geoff vs Armin | Disagreement / Prediction | “The same cycle is going to repeat”; “our exceptional role ... probably will not come back” |
| [E11:61](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:61) | V80 · 12:00–16:00 | Geoff, Antithesis | Practice / Pain | “on a whiteboard explain how to build [Pi]” |
| [E11:73](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:73) | V80 · 36:00 | Armin, Pi / Earendil | Roadmap / Limit | “not yet used in the Pi coding agent because it break quite a few extensions” |
| [E11:75](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:75) | V80 · 37:00–39:00 | Armin, Pi / Earendil | Pain | “we basically copy pasted what [Claude] Code was doing” |
| [E11:77](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:77) | V80 · 38:00 | Armin, Pi / Earendil | Wish / gap | “five people simultaneously talk to the same agent” |
| [E11:78](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:78) | V80 · 39:00–40:00 | Armin, Pi / Earendil | Pain | “super messy ... horrifying and ... not reliable” |
| [E11:80](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:80) | V80 · 41:00 | Geoff, Antithesis | Open question | “cancel that inferencing request ... or is it a follow-up” |
| [E11:83](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:83) | V80 · 44:00–48:00 | Geoff, Antithesis | Hand-rolled | “connect an LLM to Lisp” |
| [E11:85](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:85) | V80 · 47:00–49:00 | Geoff, Antithesis | Practice / Wish | “roll back to the previous generation” |
| [E11:98](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:98) | V80 · 1:01:00 | Armin, Pi / Earendil | Roadmap | “probably going to make it a default ... code mode” |
| [E11:103](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:103) | V80 · 1:06:00–1:07:00 | Armin and Geoff | Pain | “locking away more and more of my stuff” |
| [E11:112](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:112) | V80 · 1:12:00 | Armin, Pi / Earendil | Hand-rolled / Practice | “every morning ... open issues ... How did it change to yesterday” |
| [E11:129](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:129) | V80 · 1:31:00 | Geoff, Antithesis | Practice / Prediction | “no way hyper dependent or coupled to one particular lab” |
| [E11:148](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:148) | V82 · 00:00–02:00 | Ben Vinegar, Modem / Hunk | Hand-rolled / Roadmap | “ended up building ... a context graph” |
| [E11:149](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:149) | V82 · 02:00 | Armin Ronacher, Pi / Earendil | Pain / Open question | “nobody has figured out how to sell this stuff yet other than for coding agents” |
| [E11:154](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:154) | V82 · 08:00–09:00 | Armin, Pi / Earendil | Pain | “rephrase words in a way that is unnatural ... to you” |
| [E11:163](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:163) | V82 · 20:00 | Ben, Modem | Practice / Pain | “I switched off of Windsurf during this time” |
| [E11:166](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:166) | V82 · 25:00–28:00 | Armin / Ben | Prediction / Pain | “people will drop it ... from one moment to another” |
| [E11:183](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:183) | V82 · 47:00 | Armin, Pi / Earendil | Practice / Limit | “easier to sandbox a cloud thingy than ... your local computer” |
| [E11:189](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:189) | V82 · 53:00–54:00 | Armin, Pi / Earendil | Practice / Pain | “startup credits on AWS ... can't be bothered ... Cloudflare works really well” |
| [E11:191](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:191) | V82 · 56:00 | Armin, Pi / Earendil | Prediction | “[Nix] ... a resurgence because it is perfect for agents” |
| [E11:192](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:192) | V82 · 56:00–57:00 | Ben, Modem | Pain | “a ... 10hour outage ... time stands still” |
| [E11:195](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:195) | V82 · 59:00–1:01:00 | Armin / Ben | Pain / Prediction | “AI okay or AI not okay” |
| [E11:196](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:196) | V82 · 1:01:00–1:03:00 | Armin / Ben | Prediction / Pain | “a lot of open source code will just not be available” |
| [E11:210](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:210) | V82 · 1:13:00–1:14:00 | Armin, Pi / Earendil | Hand-rolled / Practice | “Chinese USB devices work with custom firmware” |
| [E11:250](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:250) | V83 · 00:00 | Better Stack presenter | Open question | “is this feature being released too late” |
| [E11:251](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:251) | V83 · 00:00 | Better Stack presenter | Roadmap / Practice | “workers, durable objects, and Cloudflare's containers” |
| [E11:252](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:252) | V83 · 00:00–01:00 | Better Stack presenter | Practice | “manages the sandbox life cycle like creation, activation, deletion” |
| [E11:253](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:253) | V83 · 01:00 | Better Stack presenter | Limit / Pain | “you'll need Docker Desktop or something else if you want to run things locally” |
| [E11:254](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:254) | V83 · 01:00–02:00 | Better Stack presenter | Practice | “either create or get an existing sandbox” |
| [E11:255](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:255) | V83 · 02:00–03:00 | Better Stack presenter | Pain | “I forgot to do in the previous video for this type” |
| [E11:259](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:259) | V83 · 04:00–05:00 | Better Stack presenter | Pain / Open question | “a bit cheaper with a Python SDK and with a few more features” |
| [E11:272](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:272) | V84 · 00:00 | Josh, Better Stack | Limit / Pain | “that container can't tell whether your agent is reading your repo or opening issues on it” |
| [E11:274](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:274) | V84 · 01:00 | Josh, Better Stack | Roadmap / Practice | “a gateway … a supervisor … the sandbox” |
| [E11:275](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:275) | V84 · 01:00–02:00 | Josh, Better Stack | Practice | “file system and process rules are fixed when the sandbox starts” |
| [E11:283](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:283) | V84 · 05:00 | Josh, Better Stack | Pain / Practice | “Those are Nvidia's numbers, not an audit” |
| [E11:284](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:284) | V84 · 05:00–06:00 | Josh, Better Stack | Practice / Open question | “we got a lot out there, but they aren't all the same” |
| [E11:287](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:287) | V84 · 06:00 | Josh, Better Stack | Pain / Wish | “Doctor command says everything's green either way, so test it …” |
| [E11:288](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:288) | V84 · 06:00 | Josh, Better Stack | Pain | “about 12% of sandbox creations failing” |
| [E11:290](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:290) | V84 · 06:00–07:00 | Josh, Better Stack | Limit | “a sandbox is not some guarantee” |
| [E11:291](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:291) | V84 · 07:00 | Josh, Better Stack | Practice | “anthropic sandbox runtime or plain containers is a lot less work” |
| [E11:327](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:327) | V85 · 25:00 | Theo, T3 Code | Prediction | “the VM that runs on is going to be more expensive than the inference” |
| [E11:329](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:329) | V85 · 28:00 | Theo, T3 Code | Hand-rolled | “a terabyte of my own history ... in a clickhouse database” |
| [E11:364](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:364) | V86 · 08:00 | Theo, T3 Code | Hand-rolled / Pain | “customized ... dashboard ... rate limits ... traffic” |
| [E11:365](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:365) | V86 · 08:00 | Theo, T3 Code | Hand-rolled | “all ... requests and responses into a ClickHouse DB” |
| [E11:382](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:382) | V86 · 19:00–20:00 | Theo, T3 Code | Practice / Hand-rolled | “32 times ... 27 merged without ... look ... again” |
| [E11:383](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:383) | V86 · 19:00–20:00 | Theo, T3 Code | Practice | “nightly ... every 6 hours ... before ... stable release” |
| [E11:384](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:384) | V86 · 20:00 | Theo, T3 Code | Wish / Practice | “undo ... mistakes with as little damage as possible” |
| [E11:412](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:412) | V87 · 01:00–02:00 | Theo, citing Anthropic | Prediction / Pain | “infrastructure ... built for humans and not for agents” |
| [E11:416](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:416) | V87 · 05:00–07:00 | Theo, T3 Code | Hand-rolled / Practice | “revoke the build if it was bad” |
| [E11:418](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:418) | V87 · 07:00–10:00 | Theo, citing Meta / Graphite / Anthropic | Roadmap / Practice | “Scion”; “code review service called Antique” |
| [E11:426](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:426) | V87 · 15:00 | Anthropic article, read by Theo | Hand-rolled | “automated bisection revert pipelines” |
| [E11:429](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:429) | V87 · 16:00 | Anthropic article, read by Theo | Practice | “discourages refs ... global state” |
| [E11:433](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:433) | V87 · 18:00–21:00 | Anthropic article, read by Theo | Practice / Roadmap | “derived data ... one generic mechanism” |
| [E11:436](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:436) | V87 · 23:00–24:00 | Anthropic article, read by Theo | Pain / Practice | “maintaining the repo ... significant maintenance burden” |
| [E11:439](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:439) | V87 · 26:00–28:00 | Anthropic article, read by Theo | Practice / Pain | “failure ... overwhelms the upstream servers” |
| [E11:444](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:444) | V87 · 31:00–32:00 | Anthropic article, read by Theo | Prediction | “fast, nimble migration ... more common” |
| [E11:445](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:445) | V87 · 32:00–33:00 | Theo, T3 Code | Hand-rolled / Practice | “clone and mirror and backfill all of our analytics data” |
| [E11:451](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:451) | V87 · 36:00 | Anthropic article, read by Theo | Hand-rolled / Practice | “hermetic simulations ... fuzzing ... rate limiting” |
| [E11:454](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:454) | V87 · 38:00 | Anthropic article, read by Theo | Roadmap / Practice | “permissions to individual directories” |
| [E11:455](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:455) | V87 · 38:00–39:00 | Anthropic article vs Theo | Disagreement / Open question | “complex semantic constraints”; “don't have to do this programmatically” |
| [E11:460](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:460) | V87 · 42:00–43:00 | Anthropic article / Theo | Practice | “post-merge and pre-deploy automated testing” |
| [E11:462](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:462) | V87 · 44:00–45:00 | Anthropic article, read by Theo | Limit | “in no means a suitable replacement for Git in general use” |
| [E11:463](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:463) | V87 · 45:00–46:00 | Anthropic article, read by Theo | Limit | “migrate every piece of the development life cycle” |
| [E11:464](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:464) | V87 · 45:00–46:00 | Theo, T3 Code | Prediction / Open question | “a few thousand dollars in tokens” |
| [E11:480](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:480) | V88 · 00:00–01:00 | Theo Browne, T3 Code / TS Rust | Pain / Limit | “$400,000 of Codex tokens and got nowhere” |
| [E11:481](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:481) | V88 · 00:00 | Theo, TS Rust | Hand-rolled / Practice | “I have not read a single line of code” |
| [E11:482](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:482) | V88 · 01:00 | Theo, TS Rust | Limit / Pain | “the last 16% is way harder” |
| [E11:483](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:483) | V88 · 01:00–02:00 | Theo, TS Rust | Roadmap / Disagreement | “Bun ... even faster ... catches” |
| [E11:484](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:484) | V88 · 02:00–04:00 | Theo, Qdrant sponsor segment | Pain / Practice | “right three rows ... nearly impossible” |
| [E11:485](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:485) | V88 · 03:00–04:00 | Theo, sponsor segment | Hand-rolled | “index all the faces I use in my thumbnails” |
| [E11:487](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:487) | V88 · 07:00–09:00 | Theo, TS Rust | Limit | “all the weirdness of JS has to be encoded faithfully” |
| [E11:488](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:488) | V88 · 09:00–13:00 | Theo, TS Rust | Practice / Open question | “garbage collection ... washes out” |
| [E11:489](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:489) | V88 · 13:00–15:00 | Theo, TS Rust | Hand-rolled / Practice | “Go ... standard library ... ported to Rust” |
| [E11:490](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:490) | V88 · 14:00–16:00 | Theo, TS Rust | Practice / Limit | “Go was a much better starting point ... than JavaScript” |
| [E11:491](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:491) | V88 · 14:00–15:00 | Theo, TS Rust | Pain | “didn't even know ... until somebody else pointed it out” |
| [E11:492](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:492) | V88 · 15:00 | Theo, TS Rust | Practice | “at least two times faster in every way” |
| [E11:493](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:493) | V88 · 15:00–16:00 | Theo, TS Rust | Practice / Open question | “roughly $24,000 ... full API prices”; “500-ish dollars” |
| [E11:494](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:494) | V88 · 16:00–17:00 | Theo, TS Rust | Practice / Limit | “five ... problems ... in TSC 7” |
| [E11:495](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:495) | V88 · 17:00–18:00 | Theo, TS Rust | Hand-rolled / Practice | “[Effect] ... built ... directly into TS Rust” |
| [E11:496](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:496) | V88 · 18:00–19:00 | Theo, TS Rust | Limit / Pain | “Bun ... incorrect errors on Sentry and tRPC” |
| [E11:497](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:497) | V88 · 19:00 | Theo, TS Rust | Open question / Practice | “higher faith it'll be maintained” |
| [E11:498](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:498) | V88 · 20:00–21:00 | Theo, TS Rust | Wish / Open question | “running out of things to throw the LLMs at” |
| [E11:499](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:499) | V88 · 21:00–22:00 | Theo, TS Rust | Wish / Practice | “a little easier to extend and play around with” |
| [E11:500](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:500) | V88 · 22:00 | Theo, TS Rust | Pain / Limit | “lost a lot of the JavaScript APIs” |
| [E11:501](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:501) | V88 · 22:00 | Theo, TS Rust | Limit | “bundle ... garbage collection” |
| [E11:506](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:506) | V88 · 27:00–28:00 | Theo, T3 Code | Wish / gap | “we need a better abstraction layer” |
| [E11:510](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:510) | V88 · 32:00–34:00 | Theo, TS Rust | Hand-rolled / Practice | “under 216 megs of RAM ... peaked ... 4% CPU” |
| [E11:511](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:511) | V88 · 33:00–34:00 | Theo, TS Rust | Pain / Practice | “ESBuild ... 2x the RAM” |
| [E11:512](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:512) | V88 · 34:00–35:00 | Theo, TS Rust | Practice / Wish | “file system on read only and it still works” |
| [E11:514](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:514) | V88 · 38:00–40:00 | Theo, T3 Code | Pain / Disagreement | “Cloudflare sandboxes suck ... entirely different compute” |
| [E11:515](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:515) | V88 · 39:00–40:00 | Theo, TS Rust | Prediction / Open question | “fully possible ... Cloudflare worker” |
| [E11:518](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:518) | V88 · 41:00–42:00 | Theo, TS Rust | Practice / Hand-rolled | “accountability files ... auto notes from the 16-hour run” |
| [E11:519](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:519) | V88 · 42:00 | Theo, TS Rust | Pain / Limit | “bumping me down to medium when it crashed” |
| [E11:520](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:520) | V88 · 42:00 | Theo, TS Rust | Pain / Hand-rolled | “running out of memory and crashing system D constantly” |
| [E11:521](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:521) | V88 · 42:00–43:00 | Theo, TS Rust | Practice | “compatibility and performance ... in parallel” |
| [E11:522](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:522) | V88 · 43:00 | Theo, TS Rust | Hand-rolled / Pain | “SSH access to other machines now” |
| [E11:523](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:523) | V88 · 43:00 | Theo, TS Rust | Pain / Practice | “needed a better end state” |
| [E11:524](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:524) | V88 · 43:00–44:00 | Theo, TS Rust | Hand-rolled / Practice | “auditing constantly ... blockers ... failure modes ... updating the environment” |
| [E11:526](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:526) | V88 · 45:00–46:00 | Theo, TS Rust | Wish / Hand-rolled | “full stack developer experience ... purely within V8” |
| [E11:527](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:527) | V88 · 46:00 | Theo, TS Rust | Open question / Practice | “see if this will actually run on Cloudflare” |
| [E11:528](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:528) | V88 · 46:00–47:00 | Theo, TS Rust | Prediction | “engineering we know and love is dead” |
| [E11:529](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:529) | V88 · 47:00 | Theo, TS Rust | Pain / Practice | “up till 6:00 in the morning prepping” |

### 01-agentweb

| Ledger anchor | Video / caption time | Speaker / role | Signal type | Q — caption excerpt |
|---|---|---|---|---|
| [01-agentweb:30](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:30) | T01 · 02:00 | CF | Hand-rolled / platform capability | “submit a cryptographically verified HTTP header” |
| [01-agentweb:37](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:37) | T01 · 07:00 | CF | Limit / pain | “it's harder for you know bot detection providers such as Cloudflare to actually detect them and stop them” |
| [01-agentweb:41](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:41) | T01 · 10:00 | CF | Wish / roadmap | “we need to make it easy for both sides to to achieve their end goal” |
| [01-agentweb:44](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:44) | T01 · 12:00 | CF | Roadmap | “still very much under development” / “building an open index” |
| [01-agentweb:47](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:47) | T01 · 13:00–14:00 | CF | Hand-rolled / roadmap | “We give them signals of new domains” |
| [01-agentweb:49](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:49) | T01 · 16:00 | CF | Gap / roadmap | “a frontier model provider only needs to crawl you once, and they may reuse that content 100,000 times” |
| [01-agentweb:50](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:50) | T01 · 16:00–17:00 | CF | Roadmap / limit | “still under development” / “pay per use is based on a trust system for now” |
| [01-agentweb:54](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:54) | T01 · 19:00–20:00 | CF | Roadmap / ecosystem | “implement it actually on your own servers without a proxy” |
| [01-agentweb:55](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:55) | T01 · 20:00 | CF | Limit / roadmap | “how do we scale up this concept of micro payments?” |
| [01-agentweb:64](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:64) | T01 · 24:00–25:00 | CF | Limit / policy choice | “a smaller news agent may want to give access ... for free” |
| [01-agentweb:66](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:66) | T01 · 26:00 | CF | Roadmap | “our new model, [Clairic], that we just launched” |
| [01-agentweb:69](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:69) | T01 · 27:00–28:00 | CF | Limit / roadmap explanation | “If I don't know about you ... I don't know where to go.” |
| [01-agentweb:72](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:72) | T01 · 30:00–31:00 | CF | Roadmap / limit | “you need a way to ... notify that your content has changed” / “actively working on” |
| [01-agentweb:73](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:73) | T01 · 32:00 | CF | Prediction / roadmap | “Content definitely value over time goes down.” |
| [01-agentweb:93](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:93) | T02 · 08:00 | CF | Pain / gap | “none of them were flexible enough for what we wanted” |
| [01-agentweb:95](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:95) | T02 · 08:00–09:00 | CF | Hand-rolled | “based on ... [OpenCode]” / “our own version on GitLab” |
| [01-agentweb:99](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:99) | T02 · 10:00–11:00 | CF | Pain / hand-rolled | “fail over quickly” / “break glass mechanisms” |
| [01-agentweb:114](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:114) | T02 · 17:00–18:00 | CF | Wish / requirement | “make sure you measure it” / “keep a way out” |
| [01-agentweb:119](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:119) | T02 · 20:00–21:00 | CF | Roadmap | “internal standards ... one of our big focuses at the moment” |
| [01-agentweb:136](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:136) | T08 · 03:00 | VSCO | Implementation constraint | “We built parts of it using Cloudflare's technologies” |
| [01-agentweb:150](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:150) | T08 · 08:00 | VSCO | Hand-rolled | “completed ... guiding the user ... or ... an upgrade” |
| [01-agentweb:159](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:159) | T08 · 12:00 | VSCO | Customer roadmap | “keep evaluating new models” / “exploring durable objects” |
| [01-agentweb:160](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:160) | T08 · 12:00 | VSCO | Customer roadmap | “[Clef] ... decision model ... manage token spend” |
| [01-agentweb:163](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:163) | T08 · 14:00 | VSCO | Hand-rolled data boundary | “that context never got to the model” / “control that through the harness” |
| [01-agentweb:165](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:165) | T08 · 15:00 | VSCO | Hand-rolled / potential migration | “how we maintain the conversation state today” / “durable objects ... conversation state” |

### 02-storage

| Ledger anchor | Video / caption time | Speaker / role | Signal type | Q — caption excerpt |
|---|---|---|---|---|
| [02-storage:25](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:25) | T03 · 01:00 | J | Prediction | “agentic traffic is making up more and more percentage” |
| [02-storage:28](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:28) | T03 · 03:00 | J | Prediction / design | “it had to start with files” |
| [02-storage:36](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:36) | T03 · 07:00 | J | Roadmap, customer | “plus way, way more as well that's on our road map” |
| [02-storage:48](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:48) | T03 · 12:00–13:00 | J | Workaround | “persist the sandbox for as long as possible. Open up a tunnel” |
| [02-storage:50](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:50) | T03 · 13:00–14:00 | J | Pain / benchmark | “the latency was quicker in regions outside of US as well” |
| [02-storage:58](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:58) | T03 · 21:00–22:00 | J | Wish | “I do wish for Cloudflare Postgres” |
| [02-storage:69](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:69) | T05 · 06:00 | M | Limit | “we're just fundamentally missing the data” |
| [02-storage:74](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:74) | T05 · 09:00 | M | Existing platform | “Basin Catalog does this all for you automatically” |
| [02-storage:79](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:79) | T05 · 12:00 | M | Prediction / design | “fast, cheap, and uh non-destructive” |
| [02-storage:82](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:82) | T05 · 14:00 | M | Existing platform | “agents to just kind of like swarm the problem” |
| [02-storage:87](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:87) | T05 · 16:00–17:00 | M | Gap | “that is I would say the fundamentally hard problem” |
| [02-storage:90](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:90) | T05 · 18:00 | A / M | Limit / roadmap | “Not available yet, but coming in Q4” |
| [02-storage:91](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:91) | T05 · 18:00–19:00 | A / M | Wish / considered | “a basin for platforms kind of sort” |
| [02-storage:92](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:92) | T05 · 19:00–20:00 | M | Limit / setup | “you'll need to instrument your application basically to send those events” |
| [02-storage:94](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:94) | T05 · 20:00 | A / M | Limit / roadmap | “Not today, but it's it's coming soon” |
| [02-storage:100](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:100) | T13 · 00:00–01:00 | D | Hand-rolled / demand | “large customer that had uh come to us with a need” |
| [02-storage:111](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:111) | T13 · 05:00 | D | Design constraint | “do as little CPU work in a durable object as possible” |
| [02-storage:112](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:112) | T13 · 05:00 | D | Limit / design | “we can't put any one durable object in the hot path” |
| [02-storage:116](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:116) | T13 · 07:00 | D | Roadmap | “a clone API is coming” |
| [02-storage:122](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:122) | T13 · 09:00 | D | Roadmap | “hopefully support Git LFS in the future” |
| [02-storage:133](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:133) | T13 · 14:00 | D | Pain | “I never had the time to do by hand” |
| [02-storage:134](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:134) | T13 · 15:00 | D | Pain | “agents weren't able to do it” |
| [02-storage:136](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:136) | T13 · 15:00 | D | Hand-rolled | “add a unique index” |
| [02-storage:138](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:138) | T13 · 15:00 | D | Roadmap, retrospective | “get juris- just jurisdiction support rolled out” |
| [02-storage:148](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:148) | T13 · 20:00 | D | Uncertainty | “I don't know if they're using Artifacts in the core product” |
| [02-storage:152](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:152) | T13 · 14:00 | D | Pain / earlier mistake | “I didn't understand the difference” |

### 03-durable

| Ledger anchor | Video / caption time | Speaker / role | Signal type | Q — caption excerpt |
|---|---|---|---|---|
| [03-durable:17](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:17) | T09 · 01:00 | AP / Cloudflare | Prediction / pain | “AI agent traffic grew by more than 1,700% in the past year.” |
| [03-durable:18](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:18) | T09 · 01:00 | AP / Cloudflare | Pain / prediction | “if your application takes off, you're going to have the same problems.” |
| [03-durable:19](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:19) | T09 · 02:00 | AP / Cloudflare | Pain | “Databases in particular, if you need to shard that because you just can't keep up with the load, that's not something you can do overnight.” |
| [03-durable:20](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:20) | T09 · 02:00–03:00 | AP / Cloudflare | Pain | “with how expensive memory is, disk”; “one failure potentially taking anyone down.” |
| [03-durable:21](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:21) | T09 · 03:00–04:00 | AP / Cloudflare | Prediction / wish | “that's a lot of agents we need to run”; “somewhere to run our AI agents that's economical” |
| [03-durable:22](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:22) | T09 · 05:00 | AP / Cloudflare | Limit | “It can handle up to 1,000 requests per second” |
| [03-durable:23](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:23) | T09 · 05:00 | AP / Cloudflare | Pain / shipped mechanism | “each Durable Object has its own SQLite database”; “That means you get no lock contention.” |
| [03-durable:24](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:24) | T09 · 05:00–06:00 | AP / Cloudflare | Shipped mechanism / prediction | “the database runs on the same metal”; “it scales pretty much to infinity. Obviously, not quite” |
| [03-durable:25](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:25) | T09 · 07:00 | AP / Cloudflare | Limit / design constraint | “they will all be [routed] to one instance of your durable object” |
| [03-durable:26](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:26) | T09 · 07:00–08:00 | AP / Cloudflare | Pain | “you have to change your mental model a little bit.” |
| [03-durable:27](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:27) | T09 · 08:00–09:00 | AP / Cloudflare | Shipped mechanism | “they scale down to zero”; “outside of any storage you have stored in it” |
| [03-durable:28](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:28) | T09 · 09:00 | AP / Cloudflare | Limit | “up to 10 GB of storage”; “up to 128 MB of memory” |
| [03-durable:29](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:29) | T09 · 10:00 | AP / Cloudflare | Pain / mitigation | “smaller objects limit the damage.” |
| [03-durable:30](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:30) | T09 · 10:00–11:00 | AP / Cloudflare | Shipped mechanism | “a batteries included approach”; “WebSockets and sub-agents, scheduled tasks, tools, and MCP.” |
| [03-durable:31](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:31) | T09 · 11:00–12:00 | AP / Cloudflare | Prediction / efficiency claim | “an isolate is roughly 100 times more efficient than a container.” |
| [03-durable:32](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:32) | T09 · 12:00 | AP / Cloudflare | Pain / limit | “the hot singleton is the most common one”; “that one durable object is going to crumple” |
| [03-durable:33](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:33) | T09 · 13:00 | AP / Cloudflare | Pain / tradeoff | “Break it down as small as you can”; “you get this chatty interface where they're always talking to each other.” |
| [03-durable:34](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:34) | T09 · 13:00 | AP / Cloudflare | Hand-rolled pattern | “Take those off the the main path of the durable object” |
| [03-durable:35](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:35) | T09 · 13:00 | AP / Cloudflare | Pain / limit | “broadcast that message to all 1,000 people”; “If you have high throughput, it's probably not going to keep up.” |
| [03-durable:36](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:36) | T09 · 13:00–14:00 | AP / Cloudflare | Hand-rolled pattern | “one durable object that takes the [write] durably”; “10, 20, 30 durable objects that are responsible [for] fanning out those messages” |
| [03-durable:37](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:37) | T09 · 14:00 | AP / Cloudflare | Pain / limit | “Another one is accidental placement.” |
| [03-durable:38](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:38) | T09 · 14:00 | AP / Cloudflare | Limit / default | “we will create the durable object close to where the request originates from.” |
| [03-durable:39](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:39) | T09 · 15:00 | AP / Cloudflare | Pain / shipped mechanism | “you need to use our APIs”; “Make sure you call accept WebSocket on it” |
| [03-durable:40](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:40) | T09 · 15:00 | AP / Cloudflare | Shipped mechanism | “the WebSocket connection will stay open”; “You only get charged when your durable object receives a message” |
| [03-durable:41](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:41) | T09 · 15:00–16:00 | AP / Cloudflare | Limit | “memory starts fresh”; “they will be wiped every time it goes to sleep.” |
| [03-durable:42](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:42) | T09 · 16:00 | AP / Cloudflare | Roadmap disclosure | “A bunch of these features are not out yet”; “they're not publicly available to you.” |
| [03-durable:43](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:43) | T09 · 16:00–17:00 | AP / Cloudflare | Pain / roadmap | “your durable object would just stop doing anything”; “pending IO, stays open for up to 15 minutes.” |
| [03-durable:44](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:44) | T09 · 17:00 | AP / Cloudflare | Roadmap | “we're also adding a shutdown hook”; “you want to flush it” |
| [03-durable:45](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:45) | T09 · 17:00–18:00 | AP / Cloudflare | Pain / roadmap | “it would disconnect your web sockets, which kind of sucked”; “migrate from your old code to your new code gracefully” |
| [03-durable:46](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:46) | T09 · 18:00 | AP / Cloudflare | Roadmap / limit | “run your old code for up to 24 hours”; “eventually we will kill it after 24 hours” |
| [03-durable:47](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:47) | T09 · 18:00–19:00 | AP / Cloudflare | Pain / roadmap | “you can get disconnects any time”; “automatically retrying those requests for you when it's safe to do so.” |
| [03-durable:48](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:48) | T09 · 19:00 | AP / Cloudflare | Roadmap / limit | “opt in some of your methods to double execute if it's [idempotent].” |
| [03-durable:49](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:49) | T09 · 20:00–21:00 | AQ, then AP / Cloudflare | Design question / limit | “millions of users”; “durable objects are single-threaded”; “per per task or per per conversation” |
| [03-durable:50](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:50) | T09 · 21:00–22:00 | AQ, then AP / Cloudflare | Wish / tradeoff | “what's handling… the list of channels or the organization settings”; “D1 is great for life cycle configurations.” |
| [03-durable:51](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:51) | T09 · 22:00 | AP / Cloudflare | Limit / design warning | “I would try to avoid chaining durable objects.” |
| [03-durable:52](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:52) | T09 · 22:00 | AQ, then AP / Cloudflare | Wish / roadmap status | “when that's rolling out?”; “the user facing changes haven't rolled yet.” |
| [03-durable:53](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:53) | T09 · 23:00 | AQ, then AP / Cloudflare | Pain / shipped pattern | “protecting secrets”; “you can basically sub in the secrets there.” |
| [03-durable:54](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:54) | T09 · 24:00–25:00 | AQ, then AP / Cloudflare | Migration pain / limit | “a very large container footprint”; “durable objects aren't like publicly accessible.” |
| [03-durable:55](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:55) | T09 · 25:00 | AP / Cloudflare | Pain / shipped integrations | “re-establishing the connections over and over is is not good”; “gradually migrate those things” |
| [03-durable:56](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:56) | T09 · 25:00–26:00 | AQ, then AP / Cloudflare | Wish / limit | “would the latency be better”; “I haven't tested it”; “there's no guarantee” |
| [03-durable:57](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:57) | T09 · 26:00–27:00 | AQ, then AP / Cloudflare | Limit / design tradeoff | “to interact with D1 you need like a binding to a specific database”; “spin a database up on demand, it's really hard with D1” |
| [03-durable:66](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:66) | T11 · 01:00 | JS / Braid | Pain / demand | “our customers now, all of a sudden, need agents to run their business.” |
| [03-durable:67](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:67) | T11 · 01:00 | JS / Braid | Pain | “Follow up with every lead”; “super open-ended”; “actually really hard to execute” |
| [03-durable:72](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:72) | T11 · 05:00–06:00 | JS / customer | Prediction / design | “Even really tiny models are great at doing really tiny tasks.” |
| [03-durable:77](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:77) | T11 · 09:00 | JS / customer | Wish | “Every single thread needs its own place to run”; “no cold start”; “infinitely scalable” |
| [03-durable:80](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:80) | T11 · 11:00 | JS / customer | Pain | “an O of N squared problem”; “I can't just assume this is in my cache.” |
| [03-durable:82](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:82) | T11 · 11:00–12:00 | JS / customer | Pain / hand-rolled architecture | “all of my agents are trying to read and write from one place”; “every single thread to have its own database.” |
| [03-durable:85](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:85) | T11 · 14:00–15:00 | JS / customer | Limit / workaround | “128 MB”; “there's no file system”; “use a database as a file system.” |
| [03-durable:87](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:87) | T11 · 16:00 | JS / customer | Limit / performance claim | “usually within about 200 milliseconds”; “that's like cold cold.” |
| [03-durable:88](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:88) | T11 · 16:00–17:00 | JS / customer | Pain / claimed solution | “logging is really hard at scale”; “A single thread is a single durable object” |
| [03-durable:89](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:89) | T11 · 17:00–18:00 | JS / customer | Shipped mechanism | “call something called a dynamic worker”; “explicitly grant everything” |
| [03-durable:91](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:91) | T11 · 19:00–21:00 | JS / Standard Agents | Hand-rolled product | “The problem is we need to do that now for every single customer”; “a platform that we wrote” |
| [03-durable:95](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:95) | T11 · 24:00–25:00 | JS / customer | Hand-rolled / live failure | “the accountant… is also a Durable Object”; “you guys are all getting rejected” |
| [03-durable:98](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:98) | T11 · 27:00 | JS / customer | Pain | “probably the number one issue”; “keeping the durable object alive for like hours.” |
| [03-durable:104](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:104) | T11 · 30:00 | JS / customer | Pain | “Durable objects sometimes just go cold, like dead cold”; “pretty common… die mid-execution” |
| [03-durable:105](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:105) | T11 · 30:00–31:00 | JS / customer | Hand-rolled | “you basically need a watchdog”; “a second durable object that's watching the primary” |
| [03-durable:106](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:106) | T11 · 31:00 | JS / customer | Pain / scale | “only shows up when you're sort of like at scale”; “20,000 to 50,000 durable objects” |
| [03-durable:108](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:108) | T11 · 32:00–33:00 | JS / customer | Hand-rolled composition / limit | “you can't use durable objects without workers”; “R2… big files”; “D1… store all the customers” |
| [03-durable:109](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:109) | T11 · 33:00 | JS / customer | Hand-rolled / shipped mechanism | “your agent write agents”; “push it back up to artifacts” |
| [03-durable:111](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:111) | T11 · 35:00 | AQ, then JS / customer | Wish / workaround | “share some persistence across our durable objects”; “tools that it can look up global state.” |
| [03-durable:115](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:115) | T11 · 38:00 | AQ, then JS / customer | Pain / roadmap assessment | “there's no standard”; “project [Think]”; “it's still pretty low level” |
| [03-durable:116](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:116) | T11 · 39:00 | AQ, then JS / customer | Hand-rolled detail | “in the constructor it will boot up another durable object”; “watching for cues in the database” |
| [03-durable:119](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:119) | T11 · 40:00–41:00 | JS / customer | Hand-rolled / convergence | “Sunil has a solution”; “we did the same thing”; “2 megabyte chunks” |

### 04-customers

| Ledger anchor | Video / caption time | Speaker / role | Signal type | Q — caption excerpt |
|---|---|---|---|---|
| [04-customers:17](/Users/noah/code/sofort/arch/research/connect26/04-customers.md:17) | T10 · 10 · 02:00 | Ramp PE | P | “increasing number of scaling problems that we have to deal with” |
| [04-customers:18](/Users/noah/code/sofort/arch/research/connect26/04-customers.md:18) | T10 · 10 · 03:00 | Ramp PE | P | “your systems are getting slower, there is more risk to your system.” |
| [04-customers:21](/Users/noah/code/sofort/arch/research/connect26/04-customers.md:21) | T10 · 10 · 04:00 | Ramp PE | P / H | “one load balancer and the generally monolithic infrastructure” |
| [04-customers:23](/Users/noah/code/sofort/arch/research/connect26/04-customers.md:23) | T10 · 10 · 05:00–06:00 | Ramp PE | P / lesson | “doing any change gets very scary” |
| [04-customers:26](/Users/noah/code/sofort/arch/research/connect26/04-customers.md:26) | T10 · 10 · 07:00 | Ramp PE | L / P | “how do you support data residency if you have only a one monolithic infrastructure” |
| [04-customers:28](/Users/noah/code/sofort/arch/research/connect26/04-customers.md:28) | T10 · 10 · 08:00 | Ramp PE | W / lesson | “you build something new, you test it” |
| [04-customers:29](/Users/noah/code/sofort/arch/research/connect26/04-customers.md:29) | T10 · 10 · 09:00 | Ramp PE | P | “support tickets all over the place” |
| [04-customers:68](/Users/noah/code/sofort/arch/research/connect26/04-customers.md:68) | T10 · 10 · 33:00–34:00 | Ramp PE | W / H | “unify the observability” |
| [04-customers:73](/Users/noah/code/sofort/arch/research/connect26/04-customers.md:73) | T10 · 10 · 35:00–36:00 | Ramp PE | P | “mix server caching and the client caching” |
| [04-customers:77](/Users/noah/code/sofort/arch/research/connect26/04-customers.md:77) | T10 · 10 · 37:00 | Ramp PE | P / lesson | “All of our local tests would work” |
| [04-customers:78](/Users/noah/code/sofort/arch/research/connect26/04-customers.md:78) | T10 · 10 · 39:00 | Ramp PE | P / migration | “if you try doing Go Wasm currently, it gets very bloated” |
| [04-customers:80](/Users/noah/code/sofort/arch/research/connect26/04-customers.md:80) | T10 · 10 · 40:00 | Ramp PE | H | “a build RS file that kind of like reads the YAML” |
| [04-customers:81](/Users/noah/code/sofort/arch/research/connect26/04-customers.md:81) | T10 · 10 · 40:00 | Ramp PE | H | “the same fixture test that are running on both routers” |
| [04-customers:84](/Users/noah/code/sofort/arch/research/connect26/04-customers.md:84) | T10 · 10 · 42:00 | Ramp PE | H / migration | “5-minute expiration that we are doing for freshness” |
| [04-customers:85](/Users/noah/code/sofort/arch/research/connect26/04-customers.md:85) | T10 · 10 · 42:00–43:00 | Ramp PE | H, unused | “configure what is the maximum freshness and maximum expiration” |
| [04-customers:86](/Users/noah/code/sofort/arch/research/connect26/04-customers.md:86) | T10 · 10 · 43:00 | Ramp PE | P / migration | “interaction between businesses” |
| [04-customers:88](/Users/noah/code/sofort/arch/research/connect26/04-customers.md:88) | T10 · 10 · 44:00 | Ramp PE | lesson | “most of the core of the process hasn't changed at all” |
| [04-customers:128](/Users/noah/code/sofort/arch/research/connect26/04-customers.md:128) | T04 · 04 · 11:00 | Sentry eng | P | “traditional ML is a reverse of good developer experience” |
| [04-customers:135](/Users/noah/code/sofort/arch/research/connect26/04-customers.md:135) | T04 · 04 · 13:00 | Sentry eng | Pr / H | “spam detection and um other signals” |

### 05-platforms

| Ledger anchor | Video / caption time | Speaker / role | Signal type | Q — caption excerpt |
|---|---|---|---|---|
| [05-platforms:26](/Users/noah/code/sofort/arch/research/connect26/05-platforms.md:26) | T12 · 03:00 | K | Pain | "sign-in, a domain someone's approved, a security review, observability" |
| [05-platforms:39](/Users/noah/code/sofort/arch/research/connect26/05-platforms.md:39) | T12 · 11:00 | K | Pain | "Every click, every page view, every deploy went into the same D1 database" |
| [05-platforms:41](/Users/noah/code/sofort/arch/research/connect26/05-platforms.md:41) | T12 · 12:00 | K | Hand-built | "the events moved out into analytics engine" |
| [05-platforms:42](/Users/noah/code/sofort/arch/research/connect26/05-platforms.md:42) | T12 · 12:00 | K | Pain | "we weren't counting people properly anymore" |
| [05-platforms:45](/Users/noah/code/sofort/arch/research/connect26/05-platforms.md:45) | T12 · 12:00 | K | Pain | "before I even knew what questions I wanted answered" |
| [05-platforms:55](/Users/noah/code/sofort/arch/research/connect26/05-platforms.md:55) | T12 · 17:00–18:00 | K | Hand-built | "got gizmos.run allowed in Claude co-work's sandbox" |
| [05-platforms:62](/Users/noah/code/sofort/arch/research/connect26/05-platforms.md:62) | T12 · 22:00 | A | Wish | "architect how you want your system to behave" |
| [05-platforms:67](/Users/noah/code/sofort/arch/research/connect26/05-platforms.md:67) | T12 · 26:00 | A | Roadmap | "talking about Telus putting things like Tailscale in front" |
| [05-platforms:90](/Users/noah/code/sofort/arch/research/connect26/05-platforms.md:90) | T06 · 01:00 | L | Hand-built | "databases um, the ability to send an email, to receive payments" |
| [05-platforms:95](/Users/noah/code/sofort/arch/research/connect26/05-platforms.md:95) | T06 · 04:00 | L | Pain / Wish | "best possible SEO search engine optimization" |
| [05-platforms:99](/Users/noah/code/sofort/arch/research/connect26/05-platforms.md:99) | T06 · 06:00 | L | Hand-built / Limit | "a necessity for for doing what" |
| [05-platforms:110](/Users/noah/code/sofort/arch/research/connect26/05-platforms.md:110) | T06 · 14:00 | L | Hand-built / Pain | "rewriting our entire front-end codebase" |
| [05-platforms:113](/Users/noah/code/sofort/arch/research/connect26/05-platforms.md:113) | T06 · 17:00 | L | Pain | "some out of memory errors" |
| [05-platforms:115](/Users/noah/code/sofort/arch/research/connect26/05-platforms.md:115) | T06 · 17:00–18:00 | L | Pain | "the cold start is really the expensive part" |

## 6. Complete prediction and roadmap screening board
**Q/I — Scope:** every row labelled Prediction, Roadmap, or Pr within the broad-keyword register appears below (175 entries). The speaker and original category are retained; wishes already being implemented remain in the board. The right column is the source ledger's inferred required work/candidate, not another quotation or evidence that it is absent. Use the current-status matrix and project cards to distinguish Open, Being built, Shipped, and Roadmap. Repeated forecasts across recordings are intentionally visible but do not increase independence. Incidental out-of-theme predictions remain screening context.

| Source | By whom | Q — forward claim / direction | I — what would have to exist, or work implied by the claim |
|---|---|---|---|
| [E01:77](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:77) · V01 36:00 | Theo / t3.gg | “everything we rely on every day is flexible” | Agents make personally rebuilding infrastructure feel feasible. Workload-specific replacement feasibility report; broad self-extension is taken. |
| [E01:100](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:100) · V03 03:00 | Presenter / dbt Labs | “a tireless analyst at the fingertips of anyone” | Conversational analytics supplies a new adoption incentive. — (conversational analytics is an established vendor category). |
| [E01:103](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:103) · V03 06:00 | Presenter / dbt Labs | “betting on just better models ... is not going to be enough” | He expects more complex questions to preserve the trust problem. Analytical workflow acceptance fixtures independent of model confidence. |
| [E01:105](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:105) · V03 08:00 | Presenter / dbt Labs | “semantic SQL or a more native SQL interface” | A database-like interface is explicitly being built by dbt and others. — (semantic SQL is occupied, not a new opportunity). |
| [E01:109](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:109) · V03 10:00 | Presenter / dbt Labs | “something that the team is working on at DBT” | Automatic/smarter pre-aggregation is claimed territory. — (do not pitch a generic pre-aggregation optimizer as open). |
| [E01:111](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:111) · V03 11:00–12:00 | Presenter / dbt Labs | “a map of your business” | Entity relationships may organize agent context, beyond metric formulas. Entity-linked context map; broad context-layer category already populated. |
| [E01:117](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:117) · V03 14:00 | Presenter / dbt Labs | “looking for design partners” | MetricFlow changes have an active product team and coming onboarding. — (potential upstream design-partner work). |
| [E01:128](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:128) · V03 19:00–20:00 | Presenter / dbt Labs | “output a OSI document” | dbt already provides or claims an export path; a generic exporter is occupied. — (check preservation rather than build another exporter). |
| [E01:129](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:129) · V03 20:00 | Presenter / dbt Labs | “it's not available right now” | The presented SQL interface is a roadmap demonstration at recording time. — (availability must not be inferred from slides). |
| [E01:130](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:130) · V03 20:00–21:00 | Presenter / dbt Labs | “reference metrics and semantics within your DBT project” | dbt plans upstream semantic use in transformations. — (upstream semantic reference support is claimed). |
| [E01:133](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:133) · V03 22:00–23:00 | Presenter / dbt Labs | “repeatable production AI workflows” | He expects data teams to own bounded inference pipelines beyond chat. Data-workflow context contracts and evaluation examples. |
| [E01:227](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:227) · V04 44:00–45:00 | Peter and Michael / users | “personalized for your own taste and preferences” | Personal acceptance criteria may outlast model capability gaps. Preference interview turned into observable examples and workflow rules. |
| [E01:264](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:264) · V05 00:11:00–00:12:00 | Mario / Pi creator | “continues from where it left off automatically” | Pi Durable already provides persisted task recovery. — (durable agents are explicitly killed/taken). |
| [E01:343](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:343) · V05 00:58:00–00:59:00 | Maintainers / Earendil | “shows up for real everywhere” | They expect AI development to spread beyond professional engineers. Nontechnical builder recovery/ownership usability corpus. |
| [E01:509](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md:509) · V08 01:44:00 | Interviewer / tools leader | “that refactor ... now you can do it” | Lower change cost can also improve quality if humans keep standards. Deferred-refactor feasibility/acceptance audit; generic migration/refactoring tools are taken. |
| [E02:116](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:116) · V10 00:11:00 | Scott | “having persistent memory, the ability to run swarms” | He names memory, delegation, always-on operation and reproducible environments as enabling infrastructure. —; agent substrate is in the kill list |
| [E02:146](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:146) · V11 00:07:00 | Sunil | “already made it the default” | He says Vercel adopted Jev for prompt security rating in its harness; unverified secondhand claim. —; prompt classification taken |
| [E02:193](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:193) · V11 00:53:00–00:55:00 | Ree | “everything is a custom tool” | Executor V2 scaffolds code for MCP/OpenAPI so agent edits use one extension path. —; app generation/Code Mode territory taken |
| [E02:197](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:197) · V11 00:57:00–00:58:00 | Ree | “tools, skills, UI, storage, triggers, workflows” | His app unit bundles extensible operational capabilities, deployments and source history on Cloudflare. —; explicitly being built |
| [E02:199](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:199) · V11 00:58:00–00:59:00 | Ree | “Accounts standalone” | Decoupled credentials allow forked and composite apps across providers. Account-binding portability fixtures |
| [E02:216](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:216) · V11 01:13:00–01:14:00 | Ree | “I just want to in-house both of them” | Email/auth purchases shift from convenience features to extensibility, reliability and security. Build-versus-buy boundary worksheet |
| [E02:240](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:240) · V12 00:09:00–00:10:00 | Michelle | “one AI binding one like rest API” | Workers AI and Gateway are being unified with automatic observability/security integration. —; platform owns this direction |
| [E02:251](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:251) · V12 00:17:00–00:18:00 | Michelle | “the industry has taken the opposite” | Cloudflare originally bet on smaller/faster models near users; larger models drove a different architecture. Forecast-versus-fleet-design assumption log |
| [E02:253](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:253) · V12 00:18:00–00:19:00 | Michelle | “a throughput tier” | Cloudflare added high-bandwidth interconnected hardware for larger models. —; named platform investment |
| [E02:285](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:285) · V12 00:45:00–00:46:00 | Michelle | “compute is the new currency” | Cloudflare is investing early in inference capacity as part of its developer-platform strategy. —; infrastructure ambition is explicit |
| [E02:287](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:287) · V12 00:47:00–00:48:00 | Michelle / hosts | “perfect for agents” | They interpret Dynamic Workers and Cloudflare's existing compute/database stack as advantageous for agent workloads. —; platform agent substrate taken |
| [E02:321](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md:321) · V13 00:18:00–00:21:00 | Dax | “remain close source long term” | He predicts open-source defaults in developer infrastructure due to customer incentives and historical patterns. —; not evidence that every proprietary category disappears |
| [E03:45](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:45) · V14 00:31:00–00:35:00 | Hosts / developers | “is it time to slot [slop] fork Android?” | They see room for a compatible mobile platform with better human and agent development ergonomics. Compatible mobile platform experiment; ambitious and speculative. |
| [E03:52](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:52) · V14 00:36:00–00:37:00 | Hosts / builders | “Google search ... longterm doesn't exist or matter” | They expect conversational agents to replace search and many Google surfaces. Search-to-agent workflow migration study; generic agent web on kill list. |
| [E03:67](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:67) · V14 00:48:00–00:49:00 | Hosts / developers | “bringing this stuff in house” | Git-hosting reliability and agent load may push teams to internal platforms. Git hosting already in kill list; —. |
| [E03:120](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:120) · V14 01:43:00 | Theo / T3 Code | “further isolate sub aents [subagents]” | Better subagent context isolation and sandboxes are already T3 intent. Conformance tests for actual information separation. |
| [E03:320](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:320) · V16 00:35:00–00:36:00 | Hosts / developers | “Gro 4.8 ... how they handle this ... fascinating” | They view the next release as evidence of a recovery process, not just another rank. Failure-to-recovery release tracking. |
| [E03:421](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md:421) · V16 02:04:00–02:05:00 | Theo / TS Rust builder | “stuff ... never ... worth writing ... autonomous loop” | Low engineering cost changes which bespoke software is economically reasonable. Newly-viable-workflow diary; no automatic novelty claim. |
| [E04:61](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:61) · V17 38:00 | GB · turbobuffer sponsor segment | “all indexes will share the same columnar storage system” | The advertiser plans a unified storage and vectorized execution architecture. —; this search-database architecture is explicitly being built. |
| [E04:199](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:199) · V18 1:06:00–1:07:00 | GB · host | “code reviews are slowly going away” | GB anticipates less visible peer coding feedback as harness use grows. Alternative learning/verification feedback loop; compare Uber's retained human review in video 19. |
| [E04:272](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:272) · V19 11:00 | Uday · Uber platform engineer | “we open sourced our deep learning ... part of the Michelangelo infrastructure” | Some ML foundations are public, but this does not imply every GenAI feature is open source. Reuse the released subsystem; do not assume the whole platform is available. |
| [E04:288](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:288) · V19 22:00 | Uday · Uber GenAI foundations | “those are not in the open source version yet” | More GenAI components are actively being built beyond the released ML subsystem. —; avoid assuming a public release date or specific open-source promise. |
| [E04:292](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:292) · V19 24:00 | Uday · Uber GenAI foundations | “model routing ... a good entry point” | The gateway is a prospective routing control point, not proof that advanced routing is deployed. Routing policies on the existing gateway; marks intended vendor/internal ground. |
| [E04:309](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:309) · V19 35:00–36:00 | Uday · Uber GenAI foundations | “tell them all kinds of tips to improve their skills” | Skill author coaching is active development. Skill quality advisor; Uber already working on it. |
| [E04:310](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:310) · V19 36:00 | Uday · Uber GenAI foundations | “collect the traces ... generate improvement patches for the skills” | Trace-driven skill improvement is in flight. Trace-to-skill patcher; explicitly being built internally. |
| [E04:326](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:326) · V19 44:00–45:00 | Uday · Uber GenAI foundations | “few more even more futuristic use cases” | Further foundations are contemplated but unspecified. —; no invented product detail or shipping promise. |
| [E04:338](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:338) · V19 51:00–52:00 | Uday · Uber coding-agent platform | “increase the kind of task ... with Minion over time” | Self-validation tools are intended to expand task scope beyond maintenance. Agent self-validation adapters; active internal roadmap. |
| [E04:347](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:347) · V19 58:00 | Uday · Uber review tooling | “adding risk score, blast radius of this PR” | Automated reviewer prioritization is active development. Incident-calibrated review routing (P13); Uber building it. |
| [E04:351](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:351) · V19 59:00–1:00:00 | Uday · Uber engineering leader | “back test it with years of data” | He wants evidence that risk scoring is trustworthy before automatic landing. Risk-score historical calibration and false-negative report (P13). |
| [E04:352](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:352) · V19 1:00:00 | Uday · Uber engineering leader | “green lane ... auto landing” | Automatic landing for low-risk changes is conditional future work. —; do not claim current blanket autonomous merging. |
| [E04:371](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:371) · V19 1:11:00–1:12:00 | Uday · Uber testing infrastructure | “expose all of the Capri functionality to agents” | Agent-driven session selection/replay closes the bug-fix feedback loop. Agent replay adapters; internal extension of an existing system. |
| [E04:381](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:381) · V19 1:17:00 | Uday · Uber maintenance automation | “opt-in phase ... move some of them to opt-out phase” | Broader automatic enrollment depends on skill quality improvements. Skill rollout qualification and opt-in/out migration evidence. |
| [E04:404](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md:404) · V19 1:29:00–1:30:00 | Uday · Uber customer-support collaboration | “past context to create synthetic evals” | They want to automate evaluation further using historical context. Policy-conversion synthetic case pipeline (P14); active direction, not a proven independent oracle. |
| [E05:21](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:21) · V20 0:02 | GO, host; advert | “the platform mirrors your repo” | [Entire] sells an availability path without a full GitHub migration. —; marks mirrored agent Git hosting as taken. |
| [E05:111](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:111) · V20 1:33–1:34 | SN, consultant | “none of it stacks up financially” | Newman fears supplier economics as a long-term dependency risk; this is his argument, not a verified financial conclusion. AI supplier concentration/exit planning worksheet. |
| [E05:117](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:117) · V20 1:37 | SN, consultant | “guardrails ... not long-term going to be the right solution” | Newman predicts current guardrail approaches will be insufficient; no replacement is resolved. —; open research question about action models and consequences. |
| [E05:159](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:159) · V21 02:00–04:00 | GO, industry reporter | “IDEs are just fading away” | He predicts an interface shift toward agent harnesses. Human decision workspace showing changed context; a new IDE fork alone is not a gap. |
| [E05:167](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:167) · V21 06:00–07:00 | GO, reporting Anthropic / OpenAI | “Migration[s] ... no longer take years” | The economics of rewrites are changing, though large production moves still take months. Migration parity evidence pack; migration automation is on the kill list. |
| [E05:168](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:168) · V21 07:00 | GO, reporting OpenAI API migration | “Python to Rust ... about 90% done” | A major production rewrite is in progress, not proof that all migration work is finished. —; retain as a named active migration. |
| [E05:180](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:180) · V21 12:00 | GO, industry reporter | “agentic infra is finally its own discipline” | Maintaining agent systems becomes a distinct engineering responsibility. Agent-infrastructure curriculum covering operation, evaluation and failure recovery. |
| [E05:203](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:203) · V21 24:00 | GO, referencing Charity Majors | “We ... will stop reading the code” | He predicts production operation and verification replacing line-by-line reading. Outcome evidence workspace; compare with Newman's conditional stance in video 20. |
| [E05:204](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:204) · V21 24:00–25:00 | GO, industry reporter | “eval[s] will be part of CICD” | Evaluation and agent operation are expected to become infrastructure responsibilities. CI evidence adapters; generic eval/factory/incident infrastructure is occupied. |
| [E05:205](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:205) · V21 25:00 | GO, industry reporter | “a refactoring wave of migrations, rewriting” | Cheaper changes create more transition frequency and more parity work. Migration behavior ledger; broad migration automation is on the kill list. |
| [E05:262](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:262) · V22 0:32 | PM, systems engineer | “nobody should even implement this anymore” | Agents reduce implementation labor for known algorithms, but optimization still needs evidence. B-tree workload/semantics acceptance corpus; code generation alone is taken. |
| [E05:310](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:310) · V22 1:17–1:18 | PM, database founder | “asymptotically approaching 100% ... written by AI” | He predicts almost all implementation will be generated, with human agency potentially lasting much longer. Long-term ownership/acceptance infrastructure; implementation alone is not the gap. |
| [E05:469](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md:469) · V23 1:32–1:33 | MP, reporting Lars Grammel / Vercel AI SDK | “entire software factory ... a ton of issues” | A library maintainer is actively building an issue-handling factory. —; generic OSS issue-to-fix factory has named ongoing work. |
| [E06:39](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:39) · V24 00:34 | Lattner | “we will break your source code” | Explicit instability plus migration help can enable language iteration. Source-compatibility break forecast and migration guide. |
| [E06:119](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:119) · V25 05:00–06:00 | Lattner | “AI hardware is only going to [get] weirder” | Future interoperability cannot assume a GPU-like device model. Non-GPU semantics and tooling conformance corpus. |
| [E06:150](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:150) · V26 10:00–11:00 | d-Matrix panelist | “no longer reluctant ... something which doesn't look like a GPU” | Customer willingness to try non-GPU hardware has changed. Non-GPU migration trials with explicit acceptance criteria. |
| [E06:170](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:170) · V26 23:00–24:00 | d-Matrix panelist | “mix of models ... function calls ... web searches, database lookups” | End-to-end application paths matter beyond one model's throughput. Mixed agent-path latency trace. |
| [E06:182](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:182) · V26 31:00 | AWS panelist; Lattner | “live data ... from the field ... high reliability” | Dynamic multimodal edge/cloud pipelines complicate static allocation. Edge-to-cloud multimodal timing and recovery fixtures. |
| [E06:212](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:212) · V28 02:00–03:00 | Quentin, General Catalyst | “investment going to everything” | He sees opportunity across stack layers, including physical infrastructure. Stack bottleneck/investment dependency map. |
| [E06:457](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:457) · V32 06:00 | Davis | “normal REST API ... generate ... types” | Less ergonomic but explicit code can substitute for tRPC when agents handle glue. Generated contract drift checks; API migration is taken. |
| [E06:462](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md:462) · V32 08:00 | Davis | “languages are much more fungible” | Source can act as a detailed specification for a cross-language port. Behavioral port acceptance corpus; migration generation is killed/taken. |
| [E07:259](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:259) · V37 02:00–03:00 | Ball / Amp | “prompting is now what and not how” | High-level outcomes may replace detailed file/class instructions for capable models. Outcome-contract examples with observable acceptance criteria. |
| [E07:397](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md:397) · V38 51:00–52:00 | Slack / Amp | “planning is dead or … change 99.99%” | Planning artifacts may be reworked as agents absorb coordination tasks. —; speculative, not evidence planning literally disappears. |
| [E08:311](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:311) · V48 27:00 | Carey / Cloudflare | “version two of the code mode SDK” | Wrapping MCP, tool catalogs, and OpenAPI is already supported territory. Generic Code Mode wrapper — not novel. |
| [E08:316](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:316) · V48 31:00 | Carey / Cloudflare | “MCP has one” | He predicts MCP persists; likely caption means “won,” but retained literally. |
| [E08:321](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:321) · V48 34:00 | Carey / Cloudflare | “change like how people do a lot of stuff” | Controlled arbitrary code may replace some configuration languages. Product-specific programmable extension surface. |
| [E08:323](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:323) · V48 35:00–36:00 | Carey / Cloudflare | “as seamless as possible” | Cloudflare's announced direction is broad code compatibility at the edge. Edge portability — platform-owned direction. |
| [E08:324](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:324) · V48 37:00 | Carey / Cloudflare | “email sending soon” | Outbound email is already an announced Cloudflare primitive. Agent email sending — taken roadmap. |
| [E08:325](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:325) · V48 38:00 | Carey / Cloudflare | “coming for MCP portals” | Managed search/execute compression is planned. MCP portal Code Mode — explicit Cloudflare roadmap. |
| [E08:327](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:327) · V48 39:00 | Carey / Cloudflare | “API it's struggling with … pop open a browser” | Agents can fall back across API and browser modalities; ellipsis omits intervening words. API/browser fallback state handoff. |
| [E08:329](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:329) · V48 41:00 | Carey / Cloudflare | “we become less useful than the agents” | He expects a possible future shift in human economic role, without a date. |
| [E08:344](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:344) · V49 00:00 | Sunil Pai / Cloudflare | “I think I want to compete” | Cloudflare is explicitly considering a managed-agent competitor. Managed-agent hosting — already contested platform territory. |
| [E08:346](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:346) · V49 01:00 | Pai / Cloudflare | “every platform will eventually get” | He expects stateful serverless actors and dynamic workers to spread. Cross-provider semantics comparison. |
| [E08:349](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:349) · V49 02:00 | Pai / Cloudflare | “a new kind of architecture” | He expects agents to change application architecture. Concrete domain example of actor-plus-dynamic-code software. |
| [E08:352](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:352) · V49 03:00–04:00 | Pai / Cloudflare | “software that hasn't existed in the past” | Separating harness and execution prepares for unknown future software. Application experiments using separate policy and execution. |
| [E08:358](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:358) · V49 05:00 | Pai / Cloudflare | “the future of software is markdown files” | Offered as a possibility he would welcome, not a firm forecast. Artifact-plus-skill distribution format. |
| [E08:366](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:366) · V49 11:00 | Pai / Cloudflare | “build versus buy has really changed” | Cheap adaptation shifts software acquisition economics. Fork/adapt versus rebuild decision study. |
| [E08:392](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:392) · V50 0:04:00–0:05:00 | Host / Latent Space | “a hyper scaler and a cloud platform” | Host frames model labs as broader infrastructure vendors. Cross-lab platform ownership map. |
| [E08:499](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:499) · V50 1:07:00–1:08:00 | Lesse / Anthropic engineering | “get that for free” | Managed infrastructure distributes updated controls to customers. Managed control updates — platform responsibility. |
| [E08:574](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:574) · V51 03:00 | Slack / Amp | “local dev … is dead” | Strong forecast, qualified elsewhere by adoption/review differences; ellipsis omits filler. Local-to-cloud migration friction study. |
| [E08:624](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md:624) · V51 25:00 | Slack / Amp | “days of … CI … numbered” | He predicts separate CI's role shrinks; ellipses omit filler. P08 independent acceptance of sandbox-run verification. |
| [E09:112](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:112) · V55 08:00–09:00 | Adam | “OpenAI … launching a decision's API” | He describes forthcoming competition with Jev and an already launched Cloudflare alternative. —; classifier/decision API territory is taken; announcement unverified. |
| [E09:146](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:146) · V55 54:00 | Adam | “telling it to fix my laptop” | Linux desktop maintenance is becoming an agent-operated task in his workflow. Device-specific repair transcript with rollback and hardware verification. |
| [E09:179](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:179) · V56 12:00–13:00 | Scott | “Open Code 2 … run it as a library” | OpenCode and Cloudflare are already integrating durable/server agent patterns. —; occupied platform territory. |
| [E09:210](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:210) · V57 18:00 | Scott | “get everything ported over” | He plans to transfer his Graffiti UI styling into GPUI components. Cross-renderer design-token port with interaction comparisons. |
| [E09:212](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:212) · V57 19:00 | Scott, relaying Cameron Campbell | “corner smoothing … background blur … shadows and borders” | Desired visual features already motivate a community fork. —; do not pitch these features without checking GPUI CE. |
| [E09:216](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:216) · V57 24:00 | Scott | “redoing my video recorder” | A lightweight GPUI recorder is already being built by the speaker. —. |
| [E09:217](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md:217) · V57 24:00–25:00 | Scott | “File Bro … file automations” | He rewrites an Electron/Hazel-like classifier, duplicate checker and merge utility in Rust. File merge/move preview with semantic undo; base app already exists. |
| [E10:25](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:25) · V63 05:00–06:00 | Other host | “instantiate and test code as a plugin in memory” | DeepSeek creative mode is already taking runtime self-extension territory. Independent hot-plugin rollback/crash-recovery fixtures. |
| [E10:136](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:136) · V66 09:00 | Katz | “making slide decks and booking travel” | Core website flows still require domain-specific harness support. Website-task recovery scenarios with explicit completion evidence. |
| [E10:194](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:194) · V68 01:00 | Andrew Qu, Vercel | “switch out 300 400 lines of provider specific code” | AI SDK already abstracts provider interfaces and fallbacks. |
| [E10:210](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:210) · V68 12:00–13:00 | Qu | “two weeks ago we released Eve” | Filesystem conventions for skills/tools/channels and agent infra are already claimed. |
| [E10:212](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:212) · V68 13:00 | Qu | “short-lived [OIDC] tokens for connections” | Vercel Connect covers connection credentials. |
| [E10:214](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:214) · V68 14:00 | Qu | “observability out of the box” | Run/tool/step/cost telemetry is a framework feature. |
| [E10:230](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:230) · V69 01:00–03:00 | Lloyd | “every project of significant size ... something like this” | Lifecycle factories are forecast to become standard infrastructure. |
| [E10:334](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:334) · V71 25:00–26:00 | Sumner; Cherny | “a deeper layer of verification” | The next bottleneck includes semantic correctness, then deciding what should be built. Intent-preserving acceptance scenario corpus. |
| [E10:337](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:337) · V71 27:00–28:00 | Cherny; Sumner | “PRs become suggestions” | Cheap generation reduces sunk-cost pressure and can raise acceptance standards. Generated-proposal acceptance/rejection analytics. |
| [E10:394](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:394) · V73 14:00 | Every speaker | “sandboxes ... memory ... session control” | Claude Managed Agents already provides key execution primitives. |
| [E10:474](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:474) · V75 09:00–10:00 | Collison | “more projects ... improve our architecture” | Agents are used for maintenance/infrastructure quality as well as features. Maintenance-outcome evidence beyond generated diff size. |
| [E10:475](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:475) · V75 10:00 | Collison | “every codebase is now the prompt for another codebase” | Whole-system rewrites become more plausible. —; broad migration/generation categories are already occupied. |
| [E10:558](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:558) · V77 16:00 | Jelveh | “proper versioning ... Helm chart ... GPU operator” | HAMi is already considering release compatibility mapping. Executable upgrade-semantic fixtures as an upstream contribution. |
| [E10:574](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:574) · V78 00:00–01:00 | Ben, PlanetScale | “ship fast ... also not break” | Agent-driven delivery increases demand for reliability under rapid change. Change-throughput versus reliability evidence report. |
| [E10:581](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:581) · V78 07:00–08:00 | Ben | “[Vitess] for [MySQL] and niki for [Postgres]” | PlanetScale already offers sharding paths; each shard still needs redundancy. |
| [E10:591](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:591) · V78 14:00–15:00 | Ben | “traffic control ... categorize and tag” | PlanetScale already offers workload-class resource budgets and graceful degradation. |
| [E10:593](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:593) · V78 16:00 | Ben | “branch your database schema ... deploy request” | Database branches and no-downtime deployment are already platform features. |
| [E10:594](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md:594) · V78 16:00–17:00 | Ben | “[one-click] revert ... without data loss” | A reversibility promise exists for supported schema changes; it is not a guarantee for every database operation. Revert-window/precondition evidence tests with writes during rollout. |
| [E11:60](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:60) · V80 11:00–14:00 | Geoff vs Armin | “The same cycle is going to repeat”; “our exceptional role ... probably will not come back” | Scarcity-led career recovery and lasting commoditization are competing forecasts. Skills-demand evidence tracker; demand is speculative here. |
| [E11:73](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:73) · V80 36:00 | Armin, Pi / Earendil | “not yet used in the Pi coding agent because it break quite a few extensions” | A new durable core cannot be adopted transparently across extensions. Extension migration compatibility fixtures across Pi core versions. |
| [E11:98](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:98) · V80 1:01:00 | Armin, Pi / Earendil | “probably going to make it a default ... code mode” | Pi is moving code execution into its harness loop; Code Mode itself is occupied. —; distinguish harness-local and workspace-local execution in diagnostics. |
| [E11:129](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:129) · V80 1:31:00 | Geoff, Antithesis | “no way hyper dependent or coupled to one particular lab” | A fallback to open-weight inference is his resilience plan. Portable task evidence and configuration export; model substitution needs real trials. |
| [E11:148](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:148) · V82 00:00–02:00 | Ben Vinegar, Modem / Hunk | “ended up building ... a context graph” | A product-manager agent produced reusable conversation/ticket/GitHub infrastructure already being sold. —; generic context graphs and feedback-agent integrations are occupied. |
| [E11:166](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:166) · V82 25:00–28:00 | Armin / Ben | “people will drop it ... from one moment to another” | Switching is easier than in entrenched creative suites, but the speakers later dispute how general this is. Measure migration friction and retention by actual user cohort. |
| [E11:191](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:191) · V82 56:00 | Armin, Pi / Earendil | “[Nix] ... a resurgence because it is perfect for agents” | Reproducible declarative environments may become more approachable through agents. Task-based Nix setup/recovery experiments; Nix itself is shipped prior art. |
| [E11:195](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:195) · V82 59:00–1:01:00 | Armin / Ben | “AI okay or AI not okay” | Host/project contribution rules fragment possible migration destinations; specific policies are unverified here. Contribution-policy compatibility inventory for a project's dependencies and mirrors. |
| [E11:196](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:196) · V82 1:01:00–1:03:00 | Armin / Ben | “a lot of open source code will just not be available” | Self-hosted source can vanish when an owner or subsidy disappears. OSS disappearance drill: recover source, release assets, discussion, and attribution from exports. |
| [E11:251](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:251) · V83 00:00 | Better Stack presenter | “workers, durable objects, and Cloudflare's containers” | Cloudflare already owns the complete orchestration chain in this example. —; basic Workers sandbox hosting is taken. |
| [E11:274](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:274) · V84 01:00 | Josh, Better Stack | “a gateway … a supervisor … the sandbox” | A policy-mediated agent execution architecture is already available. —; another generic policy sandbox would duplicate prior art. |
| [E11:327](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:327) · V85 25:00 | Theo, T3 Code | “the VM that runs on is going to be more expensive than the inference” | Falling inference cost could shift optimization toward execution infrastructure. Measure execution/inference crossover by task; hosting and warm-state mechanisms are kill-listed. |
| [E11:412](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:412) · V87 01:00–02:00 | Theo, citing Anthropic | “infrastructure ... built for humans and not for agents” | Fast generation exposes conventional developer-infrastructure bottlenecks. Per-task checkout/build/test/merge wait breakdown. |
| [E11:418](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:418) · V87 07:00–10:00 | Theo, citing Meta / Graphite / Anthropic | “Scion”; “code review service called Antique” | Alternative VCS, stacking, code review, search, IAM, and landing systems are already owned. —; git storage at agent scale is explicitly kill-listed. |
| [E11:433](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:433) · V87 18:00–21:00 | Anthropic article, read by Theo | “derived data ... one generic mechanism” | Blame, path history, and graph indexes can evolve behind a stable API. —; derived source metadata is part of Scion's architecture. |
| [E11:444](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:444) · V87 31:00–32:00 | Anthropic article, read by Theo | “fast, nimble migration ... more common” | Small teams may undertake infrastructure replacements once too costly. Migration transition rehearsal; do not assume generating the replacement proves cutover. |
| [E11:454](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:454) · V87 38:00 | Anthropic article, read by Theo | “permissions to individual directories” | Scion already provides directory-level controls inside a monorepo. —; do not infer that all forms of secret storage are therefore appropriate. |
| [E11:464](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:464) · V87 45:00–46:00 | Theo, T3 Code | “a few thousand dollars in tokens” | He extrapolates future development cost; neither maintenance nor adoption cost is established. Full-lifecycle replacement costing, including migration and operation. |
| [E11:483](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:483) · V88 01:00–02:00 | Theo, TS Rust | “Bun ... even faster ... catches” | TypeScript checker rewrites already compete on speed, fidelity, and extensions. —; compiler rewrites, TS tooling, and Wasm ports are kill-listed. |
| [E11:515](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:515) · V88 39:00–40:00 | Theo, TS Rust | “fully possible ... Cloudflare worker” | The demonstrated Node loop does not establish compatibility with actual Workers constraints. **Cross-host dev-loop witness:** run the same read-only in-memory workflow on Node, browser, and workerd. |
| [E11:528](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md:528) · V88 46:00–47:00 | Theo, TS Rust | “engineering we know and love is dead” | He forecasts sweeping practice change; this is rhetoric, not evidence of all engineering limits disappearing. —; retain as a prediction without inferring guaranteed outcomes. |
| [01-agentweb:41](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:41) · T01 10:00 | CF | “we need to make it easy for both sides to to achieve their end goal” | Cloudflare's scope includes discovery and efficient access, beyond collecting payment. |
| [01-agentweb:44](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:44) · T01 12:00 | CF | “still very much under development” / “building an open index” | Cloudflare explicitly owns the network-wide discovery/index project. |
| [01-agentweb:47](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:47) · T01 13:00–14:00 | CF | “We give them signals of new domains” | Cloudflare and OpenAI have already piloted discovery assistance. |
| [01-agentweb:49](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:49) · T01 16:00 | CF | “a frontier model provider only needs to crawl you once, and they may reuse that content 100,000 times” | Request billing does not account for subsequent use. Cloudflare explicitly takes this on. |
| [01-agentweb:50](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:50) · T01 16:00–17:00 | CF | “still under development” / “pay per use is based on a trust system for now” | Reuse compensation depends on identified buyers and reported use, not independently observable downstream execution. |
| [01-agentweb:54](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:54) · T01 19:00–20:00 | CF | “implement it actually on your own servers without a proxy” | The payment protocol is open and has other implementers. A Cloudflare-independent wrapper is not intrinsically new. |
| [01-agentweb:55](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:55) · T01 20:00 | CF | “how do we scale up this concept of micro payments?” | Payment scale and Cloudflare's Net Dollar stablecoin initiative are on Cloudflare's agenda. |
| [01-agentweb:66](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:66) · T01 26:00 | CF | “our new model, [Clairic], that we just launched” | Unstructured-to-structured extraction already has a Cloudflare owner. |
| [01-agentweb:69](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:69) · T01 27:00–28:00 | CF | “If I don't know about you ... I don't know where to go.” | Discovery and efficient retrieval solve separate parts of the flow; Cloudflare is building both. |
| [01-agentweb:72](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:72) · T01 30:00–31:00 | CF | “you need a way to ... notify that your content has changed” / “actively working on” | Push updates, subscription, and provider notification are explicitly Cloudflare work. |
| [01-agentweb:73](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:73) · T01 32:00 | CF | “Content definitely value over time goes down.” | Cloudflare is designing buyer offers around changing content value; do not pitch a generic decay-price engine. |
| [01-agentweb:119](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:119) · T02 20:00–21:00 | CF | “internal standards ... one of our big focuses at the moment” | Cloudflare is already pushing standards into generation-time workflows. |
| [01-agentweb:159](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:159) · T08 12:00 | VSCO | “keep evaluating new models” / “exploring durable objects” | VSCO is considering platform primitives that already exist. No new state-hosting product is implied. |
| [01-agentweb:160](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md:160) · T08 12:00 | VSCO | “[Clef] ... decision model ... manage token spend” | Cheaper decision routing is an intended integration with Cloudflare's model family. |
| [02-storage:25](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:25) · T03 01:00 | J | “agentic traffic is making up more and more percentage” | Agents become another major consumer of work infrastructure; the accompanying 60% website-traffic claim is not a verified universal statistic. |
| [02-storage:28](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:28) · T03 03:00 | J | “it had to start with files” | Documents, apps and databases are treated as surfaces over shared file storage. |
| [02-storage:36](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:36) · T03 07:00 | J | “plus way, way more as well that's on our road map” | More surfaces over this storage are already in Arg's plans; this is not a Cloudflare promise. |
| [02-storage:79](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:79) · T05 12:00 | M | “fast, cheap, and uh non-destructive” | Try/check/retry loops need inexpensive disposable infrastructure. |
| [02-storage:90](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:90) · T05 18:00 | A / M | “Not available yet, but coming in Q4” | Jurisdiction-restricted storage and compute are Cloudflare roadmap, not an outsider opening. The date is a speaker commitment, not verified delivery. |
| [02-storage:94](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:94) · T05 20:00 | A / M | “Not today, but it's it's coming soon” | Access/custom departmental RBAC is requested; the response marks work as Cloudflare-owned, without specifying final policy granularity. |
| [02-storage:116](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:116) · T13 07:00 | D | “a clone API is coming” | Cloudflare plans a DO clone primitive to replace the R2-based forking path. Do not build a competing primitive from this hint. |
| [02-storage:122](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:122) · T13 09:00 | D | “hopefully support Git LFS in the future” | LFS is Cloudflare intent, with no delivery date given. |
| [02-storage:138](/Users/noah/code/sofort/arch/research/connect26/02-storage.md:138) · T13 15:00 | D | “get juris- just jurisdiction support rolled out” | Other platform delivery competed with repair work; Artifacts localization is now documented as shipped. |
| [03-durable:17](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:17) · T09 01:00 | AP / Cloudflare | “AI agent traffic grew by more than 1,700% in the past year.” | Agent-generated demand is the framing pressure; the statistic is a talk claim, not a capacity benchmark. |
| [03-durable:18](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:18) · T09 01:00 | AP / Cloudflare | “if your application takes off, you're going to have the same problems.” | GitHub availability is used to argue that demand bursts reach ordinary application owners. |
| [03-durable:21](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:21) · T09 03:00–04:00 | AP / Cloudflare | “that's a lot of agents we need to run”; “somewhere to run our AI agents that's economical” | Multi-agent growth creates demand, but cheap hosting is the advertised platform solution. |
| [03-durable:24](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:24) · T09 05:00–06:00 | AP / Cloudflare | “the database runs on the same metal”; “it scales pretty much to infinity. Obviously, not quite” | Data locality and object creation are provided primitives, not openings. |
| [03-durable:31](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:31) · T09 11:00–12:00 | AP / Cloudflare | “an isolate is roughly 100 times more efficient than a container.” | Platform positioning, without a workload definition; not a basis for a standalone cost-saving project. |
| [03-durable:42](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:42) · T09 16:00 | AP / Cloudflare | “A bunch of these features are not out yet”; “they're not publicly available to you.” | Treat the following capabilities as Cloudflare-owned even when user controls are not released. |
| [03-durable:43](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:43) · T09 16:00–17:00 | AP / Cloudflare | “your durable object would just stop doing anything”; “pending IO, stays open for up to 15 minutes.” | Cloudflare is addressing disconnect-related eviction directly; current availability needs checking. |
| [03-durable:44](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:44) · T09 17:00 | AP / Cloudflare | “we're also adding a shutdown hook”; “you want to flush it” | A pre-shutdown cleanup/flush primitive is taken by the platform roadmap. |
| [03-durable:45](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:45) · T09 17:00–18:00 | AP / Cloudflare | “it would disconnect your web sockets, which kind of sucked”; “migrate from your old code to your new code gracefully” | Seamless connection transfer during code deployment is a platform project. |
| [03-durable:46](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:46) · T09 18:00 | AP / Cloudflare | “run your old code for up to 24 hours”; “eventually we will kill it after 24 hours” | Configurable deployment grace reduces interruptions but retains a forced-update boundary. |
| [03-durable:47](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:47) · T09 18:00–19:00 | AP / Cloudflare | “you can get disconnects any time”; “automatically retrying those requests for you when it's safe to do so.” | Network retry machinery is being absorbed into the runtime. |
| [03-durable:48](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:48) · T09 19:00 | AP / Cloudflare | “opt in some of your methods to double execute if it's [idempotent].” | Even the proposed retries need application-specific repeatability semantics. |
| [03-durable:52](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:52) · T09 22:00 | AQ, then AP / Cloudflare | “when that's rolling out?”; “the user facing changes haven't rolled yet.” | Rolling-release controls are not an outsider opportunity merely because their launch is incomplete. |
| [03-durable:72](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:72) · T11 05:00–06:00 | JS / customer | “Even really tiny models are great at doing really tiny tasks.” | Narrow tasks may make infrastructure cost more material; competence still needs task-specific validation. |
| [03-durable:115](/Users/noah/code/sofort/arch/research/connect26/03-durable.md:115) · T11 38:00 | AQ, then JS / customer | “there's no standard”; “project [Think]”; “it's still pretty low level” | Demand exists for a coherent high-level runtime, while Cloudflare and Standard Agents are actively supplying one. |
| [04-customers:135](/Users/noah/code/sofort/arch/research/connect26/04-customers.md:135) · T04 04 · 13:00 | Sentry eng | “spam detection and um other signals” | They want to amortize classifier infrastructure across more telemetry tasks. |
| [05-platforms:67](/Users/noah/code/sofort/arch/research/connect26/05-platforms.md:67) · T12 26:00 | A | "talking about Telus putting things like Tailscale in front" | VPN fronting is a TELUS possibility, not a shipped feature or Cloudflare commitment. |

## 7. Ranked table of all projects

**E/I — Ranking:** ordered for an individual OSS builder by specificity of evidence, useful bounded output, and ability to run a cheap kill test. Totals are unweighted judgments and do not determine order. `O` = narrow Open hypothesis, `B` = Being built / contribute to named work, `S` = Shipped core / missing fixture only, `R` = Roadmap overlap. None establishes purchase intent.

| Rank | ID / project | Size | Status | C | A | G | V | M | N | Total | Main discount |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | P01 Passive hibernation assertions | Tiny | O | 4 | 5 | 3 | 4 | 5 | 5 | 26 | Runtime-owned; upstream acceptance and current implementation must be checked. |
| 2 | P02 Mixed-version DO migration rehearsal | Big | O | 4 | 5 | 3 | 4 | 5 | 5 | 26 | Existing harness may make the adapter disposable. |
| 3 | P03 Sampling exactness fixtures | Tiny | O | 3 | 5 | 3 | 4 | 5 | 5 | 25 | One concrete incident; actual TELUS query unavailable. |
| 4 | P04 Recovery-load envelope | Big | O | 4 | 5 | 3 | 4 | 5 | 5 | 26 | Mature load/backpressure tools; application integration dominates. |
| 5 | P17 Tenant cutover witness | Big | O | 4 | 5 | 3 | 4 | 5 | 5 | 26 | Requires real operator contracts; no reported failed Ramp cutover. |
| 6 | P11 Nested Code Mode artifact handoff | Small | O | 4 | 5 | 3 | 4 | 4 | 5 | 25 | Existing resource links may suffice for the chosen pair. |
| 7 | P06 Learned-data-skill semantic invalidation | Big | O | 4 | 5 | 2 | 4 | 5 | 5 | 25 | Catalog/lineage vendors may already cover it. |
| 8 | P31 Recovery-path dependency drill | Small | O | 4 | 4 | 3 | 4 | 5 | 5 | 25 | Inventory and disciplined runbooks may be enough. |
| 9 | P14 Worker retained-heap fixture | Tiny | O/S | 4 | 5 | 2 | 4 | 5 | 5 | 25 | Child-isolate targeting is an unproved prerequisite. |
| 10 | P18 Body-routing parity corpus | Tiny | O/S | 3 | 5 | 2 | 4 | 5 | 5 | 24 | Gateway/parser E2E suites are substantial prior art. |
| 11 | P12 Composed permission fixtures | Tiny | O/S | 3 | 5 | 2 | 4 | 5 | 5 | 24 | Often documented behavior; contribution-sized. |
| 12 | P22 App/schema lifecycle fixtures | Small | O/S | 3 | 5 | 2 | 4 | 5 | 5 | 24 | Normal application tests may supply the complete contract. |
| 13 | P37 Runtime architectural obligations | Small | O/S | 4 | 4 | 2 | 4 | 5 | 5 | 24 | Must exceed an ordinary spy/lint assertion. |
| 14 | P09 Event-to-answer coverage | Small | O/S | 3 | 5 | 2 | 4 | 5 | 5 | 24 | OpenLineage plus tracking tests is close. |
| 15 | P13 Sandbox capability probes | Tiny | B | 3 | 5 | 2 | 4 | 5 | 5 | 24 | Named contributor and partial fixes already exist. |
| 16 | P15 Whole dev-loop host conformance | Tiny | O/S | 4 | 5 | 2 | 4 | 4 | 5 | 24 | Likely a project-specific CI fixture. |
| 17 | P21 Current-tip revert rehearsal | Small | O/S | 4 | 4 | 2 | 4 | 5 | 5 | 24 | Known prior survivor; generic integration is occupied. |
| 18 | P23 Session resource cleanup cases | Small | O/S | 3 | 5 | 2 | 4 | 5 | 5 | 24 | Tags/TTL/IaC may already solve the useful part. |
| 19 | P40 Agent bid calibration fixture | Tiny | O/S | 4 | 4 | 2 | 4 | 5 | 5 | 24 | One organization; fixed limits may suffice. |
| 20 | P05 Semantic conversion counterexamples | Tiny | R/S | 3 | 4 | 2 | 5 | 5 | 5 | 24 | Ossie explicitly owns conformance and governance work. |
| 21 | P27 GPU telemetry upgrade fixtures | Tiny | B | 3 | 3 | 3 | 4 | 5 | 5 | 23 | Hardware access; HAMi already owns adjacent tests. |
| 22 | P25 Executable exit drill | Small | O/S | 3 | 4 | 2 | 4 | 5 | 5 | 23 | Customer-specific mapping can become consulting. |
| 23 | P24 Personalized-fork update contract | Small | O/S | 3 | 5 | 2 | 3 | 5 | 5 | 23 | Existing fork update CI; repeat demand unproved. |
| 24 | P32 Retry/repeated-intent corpus | Tiny | O/S | 3 | 4 | 2 | 4 | 5 | 5 | 23 | Mature provider idempotency tests. |
| 25 | P33 Dated failure-policy fixtures | Tiny | O/S | 3 | 4 | 2 | 4 | 5 | 5 | 23 | Could be ordinary policy tests and an owner reminder. |
| 26 | P34 App-retention plan | Small | O/S | 3 | 5 | 2 | 3 | 5 | 5 | 23 | Established GC; urgency and complete roots unproved. |
| 27 | P10 Numeric integrity fixture | Tiny | O/S | 3 | 4 | 2 | 4 | 5 | 5 | 23 | Existing notebooks/provenance tools may suffice. |
| 28 | P07 Semantic-consumer upgrade rehearsal | Small | O/S | 3 | 4 | 2 | 4 | 5 | 5 | 23 | The captioned version incompatibility needs identification. |
| 29 | P28 Shared-batch/excluded-work evidence | Small | O/S | 4 | 2 | 3 | 4 | 5 | 5 | 23 | Existing profilers; causal attribution and representative data. |
| 30 | P26 Disposable-to-durable contract | Ambiguous | O | 4 | 4 | 2 | 3 | 5 | 5 | 23 | No settled product shape or maintained oracle. |
| 31 | P16 GPUI native behavior fixtures | Tiny | S/B | 3 | 3 | 2 | 4 | 5 | 5 | 22 | Detailed native-action guidance already ships. |
| 32 | P19 Lazy Git transitions | Tiny | S | 3 | 4 | 2 | 3 | 5 | 5 | 22 | Existing FUSE/Git and differential suites. |
| 33 | P35 Creation-to-ready semantics | Tiny | S | 3 | 5 | 2 | 3 | 4 | 5 | 22 | Likely an assertion in an existing benchmark. |
| 34 | P39 Emitted-code example | Tiny | S | 4 | 3 | 2 | 3 | 5 | 5 | 22 | FileCheck/Rust tooling already supplies the mechanism. |
| 35 | P30 Legacy-model retirement | Ambiguous | O | 3 | 4 | 2 | 3 | 5 | 5 | 22 | Private operator tools and access to demand/quality data. |
| 36 | P20 Checkout wait report | Tiny | O/S | 2 | 4 | 2 | 3 | 5 | 5 | 21 | CI timings may already answer the useful question. |
| 37 | P29 Small-RPC coordination case study | Tiny | O/S | 4 | 2 | 2 | 3 | 5 | 5 | 21 | Weak platform adjacency and demanding workload access. |
| 38 | P08 Business-definition review bridge | Small | O/S | 2 | 3 | 2 | 4 | 5 | 5 | 21 | Ordinary review tools may be sufficient. |
| 39 | P36 Portable agent abstraction | Ambiguous | O/R | 5 | 5 | 1 | 2 | 2 | 5 | 20 | Underspecified; frameworks and standards already have owners. |
| 40 | P38 Cloudflare-operated Postgres wish | Ambiguous | O/S | 3 | 5 | 1 | 3 | 2 | 5 | 19 | Vendor preference, not an individual-builder product. |

## 8. Top three

1. **P01 — Passive hibernation assertions.** The clearest exact missing surface: two distinct runtime/framework issue requests, an existing reproduction, and an observer effect that better reasoning cannot remove. Success means an accepted upstream test hook; it does not require a company. Gate: demonstrate non-invasive observation and confirm nobody already implemented it.
2. **P02 — Mixed-version Durable Object migration rehearsal.** The best weeks-sized tool: named persisted-identity pain, independent Amp migration experience, live-code constraints, and existing runtime ingredients. Gate: expose a real intermediate-state failure plus a second maintainer's fixture, with no fictional duplicate singleton.
3. **P03 — Sampling exactness fixtures.** The best small artifact: a concrete silent metric discrepancy and a deterministic information-loss counterexample. Gate: outperform existing query/simulator assertions on a real metric contract; otherwise contribute the fixture and explanation upstream.

**I — Alternate choice:** P04 if the builder prefers a broader operations problem and has access to an application's real retry stack. Its independent convergence is stronger than P03's, but its integration and incumbent-tool risks are greater.

## 9. Most surprising signal

**Q — Artifacts got substantially better by moving from Zig/Wasm to JavaScript.** Dillon reports peak memory falling **359 MB → 40 MB**, push time **54 s → 27 s**, and clone time **17 s → 8 s** after replacing a boundary-copy-heavy engine and checking it against existing Git conformance suites (T13 12:00–13:00, [caption lines 16–17](/Users/noah/code/sofort/arch/research/connect26/transcripts/13-artifacts-git-compatible-versioned-storage-from-zero-to-beta.txt:16)). These are speaker-reported benchmark figures, not rerun measurements; the peak-memory accounting is not explained sufficiently to reconcile it with a per-isolate budget.

**I — Why it matters:** the useful signal is the cost of a representation/runtime boundary, not language reputation. It strengthens whole-workflow and memory/serialization measurements. It does not reopen the killed idea of a generic Git engine or another automatic language port. The adjacent surprise is that a newer model solved Dillon's long-blocked migration while legacy spelling compatibility remained an enduring operational obligation.

## 10. Five-line TL;DR

1. **F/I:** Cloudflare, Vercel, database vendors, and agent frameworks already own the broad execution, storage, durability, Git, and observability stack.
2. **Q/I:** Independent speakers converge on transitions: mixed versions, recovery load, lost observations, shared limits, and continuing ownership.
3. **I:** Pick passive hibernation assertions, mixed-version DO migration rehearsals, or sampling-exactness fixtures, each behind its short kill test.
4. **I:** Keep the small and ambiguous ideas, but expect many to become upstream cases, benchmark reports, or ordinary application tests.
5. **Q/I:** Artifacts' JavaScript rewrite is the sharpest surprise; no clearly unoccupied GrowOS-like infrastructure primitive emerged.
