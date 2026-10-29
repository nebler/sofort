# S07 — Four families, tested adversarially

Research date: **2026-10-28**. Scope: the supplied 98-video corpus and current public prior art. **Q** = transcript quotation/attributed claim; **F** = checked source or research observation; **I** = inference, classification or proposal; **E** = estimate or score. A quotation establishes what was said, not that the reported result was independently reproduced.

## Verdict

| Hypothesis | Verdict (I) | Conservative independent evidence count | What survives |
|---|---|---|---|
| 1. Rehearse the change before consumers | **Real convergence on compatibility and pre-exposure trials; no evidence for one universal product.** | **At least 9 speakers / 7 publishing channels**, enumerated in §1. Four core anchors, five corroborating accounts. | A small mixed-version Durable Object fixture contribution. Shared-skill consumer discovery is worth investigating; model-retirement and fork-rehearsal demand are less established. |
| 2. Meaning changed underneath you | **Real convergence, with an inferred learned-SQL branch.** | **3 core speakers / 3 channels**; two additional speakers/channels report adjacent stale-instruction or stale-opinion failures. | Exactness/measurement contracts with concrete counterexamples. Do not equate an executable query, preserved YAML, or an unchanged metric name with preserved meaning. |
| 3. Did the check run what you think? | **Partial convergence; the three proposed products are substantially agent-shaped.** | **At least 5 speakers / 5 channels** discuss the underlying failure/control. Only one of the three named seed examples is a human-reported wrong-artifact hazard; the skipped-check audit is inferred. | A tiny executed-binary diagnostic. Generic receipts, blind-eval runners and skip auditing already have close implementations. |
| 4. Fork and own | **Partial: real convergence on adaptation and ownership costs, weak convergence on an unmet continuing-fork product.** | **5 direct voices / 3 channels** in the core discussion; **6 voices / 5 channels** in the broader direct set. Syntax supplies additional reported maintainer testimony. | A longitudinal fork-upkeep casebook/benchmark, using existing sync tools. A new fork-sync or AI merge product does not survive prior art. |
| Missed: human attention and judgment limit throughput | **Stronger convergence than the four proposed families.** | **At least 13 speakers / 7 channels**, enumerated in §5. | Measure accepted work and human decision load under agent concurrency. Another notification inbox is occupied territory. |

**I — Main correction to the lead's pattern:** these are not four independent votes for a “check everything” platform. Family 1 describes change management; family 2 describes semantic validity/information loss; family 3 describes experimental and execution validity; family 4 describes distribution and maintenance economics. They share some implementation techniques, but their oracles, users and adoption costs differ. The scarcity of human judgment cuts across all four and can make *adding* checks counterproductive.

## Method, independence and limits

**F — Reading:** read the brief; every E01–E11 per-video digest, recurring-theme/tension section, prior-art triage and top-five section; all five Connect reports and Connect SUMMARY; the background kill list/rules and stack SUMMARY. Then searched ledger rows across all eleven extraction files and revisited caption spans for both corroboration and counterevidence. The coverage map in §7 records the disposition of each ledger. Local source links below are absolute; timestamps are caption minute buckets.

**I — Counting rule:** the counts are conservative lower bounds from the explicitly enumerated human quote set, not estimates of corpus-wide prevalence. A repeated speaker counts once, even across episodes/channels. Ben Davis's solo videos and Nerd Snipe appearances are one person; Sunil's Next Token and Latent Space appearances are one person. Repeated Amp examples are not new independent customers. A publishing channel is not an independent organization: Cloudflare publishes its engineers and customer speakers, while Latent Space publishes several organizations. Unidentified Latent Space hosts are conservatively one host slot across the cited appearances. An audience questioner is one slot, not an inferred company or buyer. No phase-one candidate name, implication column, lead synthesis, sponsor repetition or demo-agent conclusion adds a human to a count.

**I — Strength:** a paid-for workaround or a concrete failure is stronger than a preference, prediction, question or hypothetical example. “Raised the issue” does not mean “asked to buy a product.” Historical agency work is not a new 2026 incident. Counts for the four families overlap; they must not be added together.

**F — Prior-art work:** checked primary project repositories/docs, product documentation and release notes, npm registry metadata, and indexed HN/X searches on 2026-10-28. No software was installed or benchmarked; no customer interviews were conducted. **Shipped** below means a documented public implementation/package or an attributed internal deployment, with those distinguished. **Being built** means an identifiable unfinished implementation. **Roadmap** means an explicit intention. **Open, conditional** means a bounded artifact remains unverified, not that search established absence. Older mechanisms still count as prior art in 2026.

## 1. Rehearse the change before consumers

### Human evidence, including the uncomfortable parts

All quotations in this table are **Q**; interpretations are **I**.

| Anchor / source | Speaker / publishing channel | Quote | What this actually supports |
|---|---|---|---|
| A1 — [v08], 1:07, L71 | Jane Street speaker, attributed to John in E01 / Jane Street | “changes to skills might have kind of untold impact on different parts of the firm” | A shared behavioral dependency has unknown consumers. Strong organizational change pain; no specific rehearsal tool is requested. |
| A2 — [v03], 17:00, L21 | Unnamed Hex user / dbt Labs | “we cannot upgrade to V2 because Hex doesn't parse the new specification” | An actual consumer blocks a producer upgrade. This is parser/compatibility breakage, not evidence of a silently wrong metric. “V2” is not identified precisely enough to map to a particular dbt release. |
| A3 — [v31], 15:00, L19 | Ben Davis / Ben Davis | “this thread is poison. This thread already knows too much” | He actually rehearses a learned media workflow in a fresh thread using his original prompts. He also sends steering messages: it is a useful test, not demonstrated autonomous success. |
| A4 — [c13], 14:00–16:00 | Dillon Mulroy / Cloudflare | “make sure that we didn't have like version skew”; “the spelling that comes in and the lowercase version” | Persisted repo identity and intermediate rollout states mattered. The migration was eventually implemented by a newer model; the coding blockage is resolved. |
| A5 — [v39], 01:00 and 06:00 | Thorsten Ball / Amp | “without hinting at these new endpoints”; “let's do a manual check here” | Fresh-agent trials and manual trace inspection are already a practice. One team's repeated tutorial is one corroborator. |
| A6 — [v50], 0:57, L61 | Anthropic engineering guest, Lesse per E08 / Latent Space | “started running shadow traffic through it and verifying” | The Python-to-Rust API rewrite was checked against existing behavior before full rollout. Guest turns are unlabelled; count one engineering speaker, not two named guests. |
| A7 — [c10], 36:00–37:00 | Raphaël Beamonte / Cloudflare | “deploy a canary with 0% of traffic”; “worker return the version ID”; “All of our local tests would work” | Real production-configured probes catch differences local tests miss; they verify which version answered. Already built by Ramp. |
| A8 — [v23], 0:09, L13 | Matt Pocock / The Pragmatic Engineer | “The backend team kept changing their contracts without telling us” | Independent, historical consumer-breakage experience. Not evidence that a new agent-specific protocol is necessary. |
| A9 — [v19], 1:07–1:10, L71–74 | Uday / The Pragmatic Engineer | “run pre-deploy in our CI/CD”; “show the delta before and after” | Uber already captures dependencies and replays live business combinations. It confirms the practice and occupies a large part of the proposed mechanism. |

**I — Count:** A1–A9 = **9 distinct speaker slots / 7 channels**: Jane Street, dbt Labs, Ben Davis, Cloudflare, Amp, Latent Space, The Pragmatic Engineer. A4 and A7 share a publisher but are different organizations; A8 and A9 share a publisher but are different practitioners. A1–A4 are the core listed domains with direct support; A5–A9 are independent corroboration of the broader practice.

**Q — Weakest named seed:** Michelle Chen says people remain “attached” to released models and an old model “sits there eating up GPU space” ([v12], 27:00, L31). **I:** this establishes retirement pressure and user preference, not a request for migration acceptance cases, replay, or a retirement planner. She is **not** counted as an explicit rehearsal advocate. Fork-update rehearsal is likewise an inference from §4, not an extra quote-backed vote here.

**Q — Counterevidence:** Scott Wu says “you can swap out models and most of the time no one even notices” ([v10], 12:00, L16). Dillon says later models solved the difficult migration. Ramp's canary and Uber's replay already work. **I:** rehearsal is not required at equal depth for every change, and a general platform is not implied by these heterogeneous examples. Michelle's capacity problem might be better solved by ordinary deprecation policy and usage data.

**I — Strongest evidence:** Ben's actual fresh-context workaround and Dillon's intermediate-state problem. **I — Weakest:** turning Michelle's attachment complaint or a fork preference into demand for a universal rehearsal service.

### Prior art that materially reduces the opening

| Status / closest source (F) | What is already covered | Residual, if any (I) |
|---|---|---|
| **Shipped — [Pact Broker can-i-deploy](https://docs.pact.io/pact_broker/can_i_deploy), [pending pacts](https://docs.pact.io/pact_broker/advanced_topics/pending_pacts)** | Consumer/provider version matrix, published verification results and deployment decisions. | A generic “discover consumers, verify compatibility before deploy” pitch is old. Stateful application effects and agent behavior are not automatically covered by message contracts. |
| **Shipped — [skill-up](https://github.com/alibaba/skill-up), [Promptfoo skill testing](https://www.promptfoo.dev/docs/guides/test-agent-skills/), [Caliper](https://github.com/edonadei/caliper)** | Agent/skill/workspace cases, comparative runs, tool/file outcomes and reports across engines; Promptfoo also asserts skill use. | Ben's fresh-thread idea is largely existing evaluation workflow. A consumer-owned registry of real shared-skill cases could be an integration, but demand and incremental discovery value remain unverified. |
| **Shipped — [Cloudflare integration test harness](https://developers.cloudflare.com/workers/testing/test-harness/) and [state preparation](https://developers.cloudflare.com/workers/testing/test-harness/prepare-test-state/)** | Production builds, multiple Workers, bindings, diagnostics and SQL-backed DO state seeding. The state-preparation page is dated July 27, 2026. | Do not build a runner. A reusable old/new application-version and persisted-identity fixture matrix remains **Open, conditional**. Stable DO identity across the proposed version transitions must be demonstrated, not assumed. |
| **Shipped — [Hex dbt integration/migration guidance](https://learn.hex.tech/docs/connect-to-data/data-connections/dbt-integration)** | Legacy/current integration paths and warnings about breaking existing cells during an older migration. | It does not establish the exact audience member's “V2” compatibility today. Reproduce that incident/version pair before proposing a connector or migration checker. |
| **Shipped — [SQLMesh plans](https://sqlmesh.readthedocs.io/en/stable/concepts/plans/), [Datafold parity validation](https://www.datafold.com/data-migration-guide/validate-prove-parity/)** | Downstream change categorization/backfill and cross-database value comparison. | Generic data-change rehearsal and parity are occupied; a new boundary must add a concrete unsupported case. |
| **Roadmap / internal implementation — [c09], 16:00–19:00; [v66], 16:00** | Cloudflare's shutdown/deploy/retry work; Cursor's central shim telemetry and cleanup-PR bot. | Rehearsal must not be a repitch of rolling deployment, durable execution or simple unused-shim deletion. |

**I — Decision:** retain the family as real engineering convergence, reject a combined skills/semantics/GPU/model/fork platform. The best bounded project is **P1** in §6. Shared-skill consumer enrollment is an **ambiguous** alternative: resolve it by finding two teams with shared skills, unknown consumers, and no usable existing eval registration—not by inventing a dependency graph.

## 2. Meaning changed underneath you

### Separate observed drift from a plausible future failure

| Anchor / source | Speaker / channel | Q — quote | I — evidential strength |
|---|---|---|---|
| B1 — [v77], 10:00, L14; 16:00, L20 | Reza Jelveh / CNCF | “when Nvidia updates their GPU operator the metrics change or or like stuff breaks”; “your dashboard breaks” | Direct recurring upgrade complaint. It does **not** establish that an unchanged-name counter silently changed denominator in a specific release. The ledger's proposed semantic contract is a further inference. |
| B2 — [v03], 19:00–20:00, L23–24 | dbt presenter / dbt Labs | “every spec is different. It's not going to be one-to-one”; “how do you provide enforcement through these conversions?” | Explicit risk of loss in semantic conversion and governance. An open question, not a measured failed conversion. |
| B3 — [c12], 12:00, L16 | Kevin / Cloudflare | “we weren't counting people properly anymore”; “our numbers jumped like seven times” | Actual reported adoption-metric error after moving event storage to Analytics Engine and moving people counting back. The corpus does not supply SQL, index strategy, identity definition or sampling settings. |
| B4 — [v68], 10:00–11:00, L14–15; 15:00–16:00, L19–20 | Andrew Qu / AI Engineer | “distill them into a skill”; “roughly 100 skills”; “very specific ... company knowledge” | Strong evidence of learned query assumptions being stored. **No quote reports those assumptions going stale.** Do not count this as another drift incident. |
| B5 — [v73], 07:00, L11; 21:00, L25 | Every speaker / Claude | “took like 30,000 of her historical edits and turned it into a skill” | A second learning practice, **not** an independent report of semantic invalidation. Retained as a hypothesis branch, excluded from the core count. |
| B6 — [v14], 1:07, L71 | Theo / Nerd Snipe | “using an ancient prompt in my skill” | Actual stale-instruction failure, fixed by removing unwanted design instructions. Adjacent: the world or SQL definition need not have changed. |
| B7 — [v18], 1:48, L112 | Gergely Orosz / The Pragmatic Engineer | “my opinions change all the time”; “spit back something that I said ... years back” | Actual faithful-but-outdated retrieval. Adjacent: applicability and supersession, rather than schema or telemetry drift. |

**I — Count:** **3 core speakers / 3 channels** (B1–B3). B6–B7 add **2 independent speakers / 2 channels** to the wider stale-assumption phenomenon. B4–B5 add **zero** observed-invalidation reports. This is the most important subtraction from phase one's apparent convergence.

**I — Strongest evidence:** TELUS's concrete operational reversal. **I — Weakest:** treating Vercel's successful skill mining as a complaint about stale learned SQL. **Q — Related but different:** GPU utilization can be reported as 97% without measuring useful intensity ([v76], 02:00–03:00); that is an interpretation problem, not necessarily a change underneath the operator. Micah and an audience member debate competing revenue definitions ([c05], 16:00–17:00); disagreement between people is not automatically drift over time.

**I — Counterevidence and important limits:** TELUS does not establish that sampling alone caused the entire sevenfold difference. A missing weighting term, a different qualifying-event rule or a bad identity/index design could contribute. Reza describes explicit breakage as well as uncertainty, so “everything stays green” overstates his account. More accurate semantics are not always the user's requirement: approximate traffic trends may be entirely adequate. Governance loss and numeric loss are separate acceptance claims.

### Prior art, including a roadmap phase one understated

| Status / source (F) | Covered ground | What it leaves unresolved (I) |
|---|---|---|
| **Shipped components + Roadmap — [Apache Ossie documentation](https://github.com/apache/ossie/blob/main/docs/index.md), [converters](https://github.com/apache/ossie-converters), [roadmap](https://github.com/apache/ossie/blob/main/ROADMAP.md)** | Schema/SQL/reference validation, converter implementations and extension metadata. The roadmap explicitly includes a reference semantic query engine, conformance tests, governance and verified queries. | “No one is checking semantic conversion” is untenable. Preserving opaque metadata does not prove that a destination engine enforces it. An executed metric/permission counterexample is sensible **upstream work**, with strong incumbent ownership. |
| **Shipped — [dbt semantic validation in CI](https://docs.getdbt.com/docs/deploy/ci-jobs), [dbt State](https://docs.getdbt.com/docs/deploy/dbt-state-about)** | Modified/downstream semantic-node checks; semantic validation uses warehouse explain queries; State analyzes SQL/source changes. | Do not pitch lineage or affected-node validation as missing. Explain success does not establish an owner-approved business result. External generated skills require explicit registration/lineage before these systems can know they exist. |
| **Shipped — [sqlsure](https://github.com/sqlsure/sqlsure)** | Declared grain, join cardinality, additivity and policy checks; working dbt/OSI/WrenAI integration paths. | Its inspected rule list does not include an exact-distinct-under-sampling rule. This is the closest upstream target for that narrow contract; its own correctness/performance claims were not reproduced. |
| **Shipped specification — [OpenTelemetry schemas](https://opentelemetry.io/docs/specs/otel/schemas/) and [schema transformations](https://opentelemetry.io/docs/specs/otel/schemas/file_format_v1.0.0/)** | Versioned schema identifiers and translation of declared metric/attribute changes. | A renamed series is not a new product gap. A known-workload test of units, scope, denominator and unsupported/unknown values can add evidence beyond declared translations. |
| **Being built / partial implementation — [HAMi utilization design](https://project-hami.io/docs/developers/gpu-utilization-metrics), [dynamic MIG design](https://project-hami.io/docs/developers/dynamic-mig)** | Per-Pod utilization test plan, workload/device identity and compatibility handling. The utilization design explicitly excludes non-NVIDIA utilization. | A broad cross-vendor telemetry validator is not established as an empty field. A single supported release-pair fixture is more credible, but requires real hardware and upstream coordination. |
| **Shipped — [WAE sampling guidance](https://developers.cloudflare.com/analytics/analytics-engine/sampling/)** | Per-row sampling weights, index-aware equitable sampling and read-time resolution selection. | Ordinary weighted aggregates are documented. Arbitrary exact distinct identities cannot generally be recovered after information is discarded. That claim is narrower than “Analytics Engine cannot count people” under every possible ingestion design. |

**I — Decision:** the core family survives. Keep the learned-SQL invalidation branch explicitly **ambiguous**, with no claimed customer incident. **P2** is the best project: a small counterexample corpus/contract for exactness, ideally contributed to sqlsure or existing analytics examples. A platform-wide semantic truth layer does not survive prior art or the need for human-owned definitions.

## 3. Did the check actually run what you think?

### This is where the extraction prompt most visibly shapes the result

| Anchor / source | Speaker / channel | Q — quote | I — what is and is not established |
|---|---|---|---|
| C1 — [v71], 08:00, L11 | Jarred Sumner / Claude | “make sure that it's running the actual changes and not like a debug build that's like stale” | A specific wrong-artifact hazard and an existing build-and-run helper. Strongest direct seed. He does not ask for a new attestation service. |
| C2 — [v39], 01:00, 05:00–06:00, L5/9–10 | Thorsten Ball / Amp | “without hinting”; “let's do a manual check here” | The human explicitly cares about unhinted trials and checks traces. The phrase “traces don't show the checkout revision” is **the demo agent's assessment read by the presenter**. Count Thorsten's procedure once; do not turn that model assessment into a second practitioner complaint. |
| C3 — [v55], 44:00, L48 | Adam Jacob / Syntax | “if you didn't change any forward-facing code, I shouldn't need to run the accessibility tests” | He proposes a selector and describes the benefit. **He does not report an unsafe skip, request an auditor or demonstrate the selector's false-negative rate.** Those are phase-one inferences. |
| C4 — [v14], 1:43, L107 | Ben Davis / Nerd Snipe | “use them as a blind tester”; “normal sub [agents] do default pull in all the context” | Explicit concern that inherited context defeats independent evaluation. Same Ben as §1, not a new person. |
| C5 — [v08], 0:38–0:39, L42–43 | Jane Street speaker / Jane Street | “we see models disable the warnings”; “cheating by looking at the answer sheet” | Actual verification-boundary failures. A check can run and still cease to test the intended requirement. |

**I — Count:** **5 speakers / 5 channels** in this underlying validity family. Among the three named seeds, C1 is a concrete human-reported artifact hazard, C2 is a human procedure plus a model-generated evidence warning, and C3 is a proposed optimization whose failure mode was supplied by the extraction agent. Calling them three independently requested “witness/auditor” products would be an artefact.

**I — Strongest evidence:** C1, reinforced by Jane Street's proxy gaming. **I — Weakest:** C3 as evidence of demand for a skipped-check audit. **Q — Counterevidence:** Sumner already solved the stale-build class with a combined build/run command; Thorsten manually checks the useful path after the agent's summary. Other practitioners intentionally retire expensive tests ([v82], 1:12). **I:** the correct answer is sometimes a simpler build rule or fewer redundant checks, rather than another report.

### Close implementations already exist

| Status / closest source (F) | Coverage | Boundary that remains (I) |
|---|---|---|
| **Shipped — [in-toto](https://in-toto.io/docs/getting-started/)** | Signed step metadata for commands, declared materials/products and inspections. | Its docs explicitly say artifacts are recorded only when declared, and can be recorded even if not used. A signed list of files is not proof of which child executable a test invoked. |
| **Shipped — [Bazel test contract](https://bazel.build/reference/test-encyclopedia), [nextest build archives](https://nexte.st/docs/ci-features/archiving/)** | Controlled build/run dependencies; separating compiled tests from execution and reusing known test artifacts. | A non-hermetic Bun-like project may need a tiny bridge. Do not pitch reproducible test execution or artifact reuse as new. |
| **Shipped — [Promptfoo coding-agent evaluation](https://github.com/promptfoo/promptfoo/blob/main/site/docs/guides/evaluate-coding-agents.md), [skill-up](https://github.com/alibaba/skill-up)** | Workspace cases, baselines, repeated trials, assertions over tool paths and file changes. | A generic blind-eval runner is covered. Auditing a particular harness's actual loaded context and revision is integration work; a self-reported manifest is insufficient. |
| **Shipped — [Launchable observation mode](https://www.launchableinc.com/docs/features/predictive-test-selection/observing-subset-behavior/)** | Runs the full suite while comparing what the proposed subset would have caught, including potential savings/misses. | This directly covers the generic skipped-check-audit idea and predates 2026. A semantic accessibility corpus can be a contribution, not a new selector platform. |
| **Shipped public code — [CodeyBox test-selection policy](https://github.com/AdamFrisby/CodeyBox/blob/main/docs/quality/test-selection.md), [soundness report](https://github.com/AdamFrisby/CodeyBox/blob/main/docs/quality/audit.md)** | Shadow-before-enforce, unsafe-skip records, staleness fallbacks, a calibration gate and a full-suite merge path. | Very close implementation, not just a blog suggestion. Zero observed misses over a finite window does not certify all future changes, but that limitation does not make the mechanism unbuilt. |

**I — Decision:** retain **P3**, an upstream-scale executed-binary diagnostic/fixture. Kill generic execution receipts and generic skip auditing as novelty claims. Retain blind-eval evidence checks as an add-on checklist/corpus until an existing runner demonstrably cannot capture the required context/revision facts.

## 4. Fork and own

### Three different claims were being merged

1. **Q — Adapt rather than rebuild:** a Latent Space host advocates “go see prior work, fork it, and adapt it” ([v49], 11:00, L15).
2. **Q — Control rather than buy convenience:** Ree chooses to “in-house both of them” and emphasizes extensibility, security and reliability ([v11], 1:13–1:14, L77–78).
3. **Q — Continuing ownership is costly:** Ryan says owning means “running it, fixing it, and replacing it” ([c02], 05:00, L9).

**I:** these do not all mean “track upstream forever.” In-housing email/auth is not necessarily a source fork; a disposable one-off app may intentionally stop following upstream; a hard fork can legitimately diverge. Those cases have different maintenance contracts.

| Anchor / source | Speaker / channel | Q — quote | I — evidence |
|---|---|---|---|
| D1 — [v49], 10:00–11:00 | Sunil Pai / Latent Space | “take our work, fork it, and do whatever”; “build versus buy has really changed” | Explicit adaptation preference; not an observed repeated-update problem. |
| D2 — [v49], 11:00, L15 | Unidentified host / Latent Space | “then you own the dependency”; “go see prior work, fork it, and adapt it” | Advocates a neglected acquisition path. Dependency control does not remove patch, update or operational responsibility. |
| D3 — [c02], 05:00–06:00 and 18:00 | Ryan Skidmore / Cloudflare | “running it, fixing it, and replacing it”; “building got cheap, but owning it is still kind of a problem for now” | Strong, explicit lifecycle economics. His reviewer used OpenCode and accumulated about 500 internal merge requests; it was not maintenance-free. |
| D4 — [v11], 1:13–1:14, L77–78 | Ree / Next Token | “I just want to in-house both of them”; “what is extendable, what has the best security, what has the best reliability” | Independent builder's actual buying/building choice. Email and auth are the referents; this is not Sunil's statement. |
| D5 — [v51], 32:00–33:00, L36–37 | Quinn Slack / Latent Space | “the headache of getting in the open source maintenance business. We don't want to do that”; “remix that and customize it” | Plans jellyware distribution while avoiding a support business. It transfers some ownership to recipients; it does not solve their upkeep. |
| D6 — [v38], 55:00 | Quinn Slack / Amp | “patched [SvelteKit]”; “PNPM patch”; “two or three times” | Actual local dependency adaptation. Already the same Quinn, so no extra speaker; another publishing channel. |
| D7 — [v31], 02:00 | Ben Davis / Ben Davis | “a fork” of his dictation interface | Actual personalized fork use. No account of several upstream refreshes or an unpaid upkeep problem. |
| D8 — [v57], 19:00–21:00, L23–25 | Scott Tolinski relaying GPUI community/maintainer / Syntax | “only adding things ... that serve them”; “these projects create problems without fixing them” | Concrete compatibility/support tension: component-library version pins and a maintainer declining the fork. This is reported third-party testimony; neither Cameron nor that maintainer becomes an independently interviewed speaker. |

**I — Count:** D1–D5 = **5 direct voices / 3 channels** (Latent Space, Cloudflare, Next Token). D7 adds one direct practitioner/channel, and D6 adds a channel without adding a person. Thus the broader direct set is **6 voices / 5 channels**. D8 adds a **reported** speaker/channel, kept separate. Only D3 and D5 explicitly name ongoing ownership/support cost in the core set; neither asks for a generic fork-updater. This is real convergence on a change in distribution economics, **partial** convergence on the task's continuing-fork opportunity.

**I — Strongest evidence:** Ryan's ownership statement, plus the GPUI dependency/support conflict as a concrete warning. **I — Weakest:** a desire to in-house two services as proof of demand for upstream merge tooling. **Q — Counterevidence:** Ben Vinegar doubts how often ordinary people want repeated malleability after initial customization ([v80], 1:31–1:33). Every's speakers say “we don't want to be an infra team” ([v73], 13:00–14:00). **I:** managed services and infrequent customization can win even when implementation is cheap. A fork may reduce vendor control while increasing operational dependency work.

### Search found much closer 2026 projects than the phase-one triage

| Status / source (F) | What already exists | Consequence (I) |
|---|---|---|
| **Shipped public project — [loongxjin/ForkSync](https://github.com/loongxjin/forksync)** | Scheduled upstream sync, AI conflict resolution, review workflow, history and post-sync commands. | “Agents maintain your fork” is already a named implementation. Custom tests can be attached; a new wrapper around merge plus tests is weak. |
| **Being built with published package — [monadoid/forksync](https://github.com/monadoid/forksync)** | Replays a patch layer onto upstream; optional build/test commands; GitHub Action plumbing; a Workers/D1 registry scaffold. | Exceptionally close to the builder's stack and theme. README defaults validation to none and retains public-release/hosted-flow TODOs. npm publication alone does not establish finished end-to-end behavior. |
| **Shipped — [Copier updates](https://copier.readthedocs.io/en/stable/updating/), [Cruft](https://github.com/cruft/cruft)** | Preserve project evolution while updating templates; tracked template versions, conflict handling and update checks. | “Living with generated code after the template changes” is not new. Full application behavior and external service contracts still need the owner's tests. |
| **Shipped, older — [git-upstream](https://git-upstream.readthedocs.io/en/latest/intro.html)** | Local patch import/rebase, re-review, logging and dropping changes already adopted upstream. | Long-lived vendor forks have mature workflows. The agent era changes cost, not the existence of the discipline. |
| **Shipped — [pnpm patch](https://pnpm.io/cli/patch); [Renovate configuration](https://docs.renovatebot.com/configuration-options/)** | Version/range-bound patches and processing dependencies inside forked repositories. | Renovate's forkProcessing is **not** a promise to merge upstream application commits. Neither is an unmet generic package-update category. |
| **Being built/public specialized implementation — [100Ways](https://github.com/nastechresearch/100Ways)** | Declares a rebrand-preserving Hermes-fork update pipeline, owned assets and parity gates. | Direct evidence that fork preservation plus checks has builders. Its generated inventory of approaches is not proof that every listed mechanism or behavioral guarantee is mature. |
| **Roadmap (Q) — [v51], 32:00–35:00** | Amp intends to release remixable jellyware. | Distribution itself already has an owner. Do not describe the promise as an established deployed ecosystem or an ownerless product seed. |

**I — Decision:** no new fork manager. Keep **P4**, a reusable, owner-labeled upkeep casebook tested against these tools. The unproven question is whether a clean merge plus the existing suite preserves the *reason the fork exists*, and how much human work repeated updates actually require. A few concrete clean-merge regressions would justify fixtures upstream; absence of them should end this direction.

## 5. The missed family: attention and judgment are the scarce queue

**I — Claim:** the lead missed a stronger cross-ledger convergence by prioritizing things that look like executable checks. Several practitioners explicitly distinguish generation throughput from their capacity to decide, understand, review and absorb notifications. This is a family of operating constraints, not a claim that models can never exercise better judgment.

| Source | Speaker / channel | Q — quote |
|---|---|---|
| [v09], 0:54–0:55, L58–59 | Demetri / A Life Engineered | “what I call judgment interrupts”; “You just can't proceed with the work unless someone comes in” |
| [v15], 1:56, L120 | Theo / Nerd Snipe | “six five paragraph essays to read through to pull out four or five useful pieces of signal” |
| [v17], 0:35, L39 | Titus Winters / The Pragmatic Engineer | “we can't review everything”; “this human attention is ... well spent” |
| [v18], 1:21, L85 | Will Larson / The Pragmatic Engineer | “their attention runs out before their ... ability to write code does” |
| [v19], 0:55, L59 | Uday / The Pragmatic Engineer | “review has become a big bottleneck” |
| [v22], 1:21, L85 | Peter Mattis / The Pragmatic Engineer | “my kind of cognitive overhead is about five to 10 sessions concurrently” |
| [v23], 0:44, L48 | Matt Pocock / The Pragmatic Engineer | “let the agent work for a couple of hours and then I can do other work” |
| [v32], 12:00, L16 | Ben Davis / Ben Davis | “15 PR show up overnight”; “Are you going to read every” |
| [v66], 09:00, L13 | Jediah Katz / AI Engineer | “keep you up to date ... without overwhelming you” |
| [v69], 11:00, L15 | Zach Lloyd / AI Engineer | “review ... the most painful part”; “tired of reviewing ... slop” |
| [c02], 07:00, L11 | Ryan Skidmore / Cloudflare | “waiting 8, 12 hours for it to get a review”; “someone context switches to read it” |
| [c13], 17:00, L21 | Dillon Mulroy / Cloudflare | “where ... my team is feeling bottlenecks”; “reading every line of code” |
| [v51], 06:00, L10 | Quinn Slack / Latent Space | “what's the benefit of me stacking up 20 things that are waiting for review” |

**I — Count:** **13 distinct practitioners / 7 channels**. This exceeds each counted core family without treating the phase-one agents' proposed check products as evidence. Five practitioners share the Pragmatic Engineer publisher; they remain distinct people, and that channel concentration is visible rather than hidden.

**I — Strongest:** Will's explicit capacity distinction, Peter's operating limit, and Theo's corrected notification anecdote. The important email **had been found and delivered**; he had not absorbed the notification. A retrieval check would address the wrong bottleneck. **I — Weakest:** a theoretical permanent human bottleneck inferred from a current workflow preference. **Q — Counterevidence:** Amp avoids mandatory pre-main review and reports benefiting from parallelism; Ryan's internal reviewer reduced review waiting to minutes. **I:** the bottleneck can move or shrink; measuring it must include the team's actual review policy and accepted outcomes.

**F — Close prior art:** [Cue](https://github.com/murtazox04/Cue) already supplies per-person/per-agent budgets, quiet hours, digests, engagement feedback and approval mediation. [Happier's guide, updated October 26, 2026](https://guides.happier.dev/get-notified-when-an-agent-is-waiting-across-many-parallel-sessions) covers cross-session approval notifications. [PITCH, submitted October 19 and revised October 22](https://arxiv.org/abs/2610.25896), evaluates when agents should interject. [Ask Less, Ask Better, submitted October 17](https://arxiv.org/abs/2610.24411), explicitly evaluates interruption budgets and user-attention cost. [Anthropic's February 18 study](https://www.anthropic.com/research/measuring-agent-autonomy) measures clarification and intervention in real sessions. These are substantial existing products/research, not a blank attention-management market.

**I — Best remaining project:** **P5**, a narrow empirical study of *parallel coding work*: when does increasing active sessions cease to improve accepted output after counting human decision/review/rework time? Extend existing telemetry and notification tools; avoid a new inbox, a universal interruption score or a leaderboard of busy agents. This family has stronger convergence but not necessarily a better side-project opportunity than P1–P3.

## 6. Best project per surviving family, with size options

**I — Size convention:** each numbered project is one project with alternative scopes; the Big/Small/Tiny rows are not separately ranked products. The Ambiguous row states a direction and the evidence needed to give it a shape. All demos and effort bands are **E**, not implemented results. Six scores for every project appear in the final ranking.

### P1 — Mixed-version DO identity fixtures

**Source quotes (Q):** Dillon's “version skew” and compatibility reads (A4); Uday's “pre-deploy ... delta before and after” (A9). **One sentence (I):** contribute a small set of old/new caller, registry and persisted-identity cases to the existing Workers integration harness.

**30-second demo (E):** create `RepoA` under the old code. The all-new path passes; a new lowercase caller talking to an old registry fails to find it, or creates a duplicate. Show the exact version pair, legacy state and request sequence; apply the compatible read/write sequence and rerun. This reconstructs a failure class, not private Artifacts code.

**Closest prior art (F):** [Cloudflare harness/state seeding](https://developers.cloudflare.com/workers/testing/test-harness/prepare-test-state/), [Pact's version matrix](https://docs.pact.io/pact_broker/can_i_deploy). **Gap (I):** persisted application identity across selected intermediate states, not a new migration generator or deployment orchestrator. **Who benefits:** tenant-DO and sharded-registry maintainers. **Why the platform does not trivially settle it:** it supplies the runner but cannot infer an application's identity equivalence. It can readily adopt the fixtures; upstream is the intended destination.

| Size | Scope (I/E) |
|---|---|
| Tiny | One documented casing/uniqueness regression fixture and an explicit version-pair table. |
| Small, weekend | Reusable seed/build/version-matrix helper with two application invariants and JSON failure output. |
| Big, weeks | Add interrupted-step cases, a small failing-sequence reducer and one independent application's real migration fixture. |
| Ambiguous | Shared-skill consumer contracts using an existing eval runner. Resolve only when two teams supply owner-controlled consumer cases that current skill-up/Promptfoo registration cannot manage adequately. |

**Next action:** use the existing harness to establish whether the *same logical persisted DO identity* can be exercised through the required sequential upgrades and cross-object version pairs. One DO instance has one running code version; do not simulate two simultaneously active versions of that same instance. Keep application SQL/data migrations separate from class-lifecycle migrations. **Kill test (E):** two days; catch a casing/legacy-read bug and one independently supplied compatibility bug. Stop or publish a recipe if existing helpers make this trivial, storage identity cannot be preserved faithfully, or no second maintainer supplies a case. **Status:** **Open, conditional contribution**, with high platform-ownership risk.

### P2 — Exactness counterexamples for sampled analytics

**Source quotes (Q):** Kevin's “weren't counting people properly” and “seven times” (B3); dbt's “not ... one-to-one” (B2). **One sentence (I):** a tiny metric-contract corpus shows when a retained sampled representation cannot support a promised exact answer, with an exact D1/SQLite alternative fixture.

**30-second demo (E):** compare two event histories under one app-level sampling index. One repeats user A seven times; the other contains users A–G. A deliberately thinned fixture retains A with weight seven in both. The weighted event count agrees; exact distinct users differ, one versus seven. Reject the exactness claim and show a full-input dedup table yielding the declared answers. This is an information-loss example, **not** a reproduction or emulation of TELUS's unknown SQL or Cloudflare's sampler.

**Closest prior art (F):** [WAE sampling](https://developers.cloudflare.com/analytics/analytics-engine/sampling/), [sqlsure](https://github.com/sqlsure/sqlsure), existing WAE analytics packages. **Gap (I):** a small declared exactness rule plus runnable counterexamples, not weighting advice, a dashboard or a new semantic engine. **Who benefits:** Workers teams moving operational events out of D1, and analytics-library maintainers. **Why a platform does not automatically do it:** the customer defines canonical identity and exactness requirements; the fixture can also exercise other stores. Cloudflare could still ship this easily, so seek an upstream home.

| Size | Scope (I/E) |
|---|---|
| Tiny | Publish the two-history counterexample and a correct full-input dedup example. |
| Small, weekend | TypeScript fixture runner for event totals, weighted sums and declared exact distinct identities; explicitly reject unsupported SQL/contracts. |
| Big, weeks | Integrate one real analytics library and contribute a sampling/exactness rule to an existing checker; add retries, late events and identity aliases. |
| Ambiguous | Link a mined SQL skill to versioned business definitions and revalidate it. Resolve with one real stale-skill incident and a catalog/skill-store comparison before building an invalidator. |

**Next action:** inspect sqlsure's actual extension points, then run the illustrative histories plus a real WAE-library query against owner-authored expectations. **Kill test (E):** two days; stop if an existing checker already expresses the contract and witness, target users only require approximate trends, or no maintainer provides a real metric/schema. An exact lane must account for accepted-input loss and deduplication; a best-effort side write is not evidence of exactness. **Status:** **Open, conditional fixture/rule contribution**. The semantic-conversion alternative is largely Ossie's roadmap/upstream territory.

### P3 — Executable identity in a regression-test report

**Source quote (Q):** Sumner's “actual changes” versus “debug build ... stale” (C1). **One sentence (I):** improve a repo's existing build-and-run helper so the red/green evidence names the compiled artifact that the test actually invoked.

**30-second demo (E):** a test passes using an old installed Bun while the head build is broken. The ordinary result is green; the report shows source/build identity differs from the invoked executable. Route the test through the intended absolute build artifact and show the genuine base/head outcomes.

**Closest prior art (F):** [Bazel](https://bazel.build/reference/test-encyclopedia), [nextest archives](https://nexte.st/docs/ci-features/archiving/), [in-toto](https://in-toto.io/docs/getting-started/). **Gap (I):** exposing an accidental mismatch in a repo outside those controlled paths, not certifying arbitrary test correctness. **Who benefits:** Bun/compiler/native-extension maintainers and agent contributors. **Why a model/platform does not automatically settle it:** executable lookup and build state are repo/host facts; Bun's own helper is the likely owner and may already make an extra tool unnecessary.

| Size | Scope (I/E) |
|---|---|
| Tiny | Add executed build identity to Bun's existing helper/test report and document the stale-PATH reproduction. |
| Small, weekend | A Linux diagnostic binding the expected absolute artifact/hash, executed process identity and test outcomes for one build workflow. |
| Big, weeks | Support one additional native repo and controlled child-exec observation; compare with existing build-system provenance. Add platforms only when their execution evidence can be observed faithfully. |
| Ambiguous | Audit blind-eval revision/context/control evidence in a real runner. Resolve by showing a wrong-revision, hinted-task or unexecuted-control result that the existing runner cannot already flag. |

**Next action:** inspect the existing Bun helper before writing a wrapper. **Kill test (E):** a day; seed stale installed, stale debug and intended fresh binary cases. Stop at a documentation/report PR if the helper already prevents all mismatches. Do not call a declared file hash an observed child execution; do not claim resistance to a malicious test executor. **Status:** **Open, conditional tiny diagnostic**; generic execution receipts and skipped-test auditing are **Shipped**.

### P4 — The fork-upkeep casebook

**Source quotes (Q):** “then you own the dependency” (D2), “owning it is still kind of a problem” (D3), “maintenance business” (D5). **One sentence (I):** publish a small set of real, owner-labeled customization/update histories and measure whether existing sync tools preserve the customization over repeated upstream changes.

**30-second demo (E):** a clean upstream merge keeps tests green but removes the fork owner's custom export format; a separate textual conflict is repaired correctly. Show the owner-held acceptance case failing only in the clean-merge example, alongside human repair time and whether the upstream fix was retained. This tests the fork's purpose, not whether a merge command exited successfully.

**Closest prior art (F):** [ForkSync desktop](https://github.com/loongxjin/forksync), [ForkSync patch layers](https://github.com/monadoid/forksync), [Copier](https://copier.readthedocs.io/en/stable/updating/), [git-upstream](https://git-upstream.readthedocs.io/en/latest/intro.html). **Gap (I):** reusable evidence and repeated-update cost, not another update tool; these tools already accept validation commands. **Who benefits:** maintainers and personal-app owners deciding whether to carry a patch. **Why a platform does not simply own it:** real fork purposes and upstream histories are distributed across owners. That supports a public dataset, not a moat in a merge runner.

| Size | Scope (I/E) |
|---|---|
| Tiny | Two redistributable update histories with owner rationale and one failing customization case each. |
| Small, weekend | Replay/report adapters for existing tools and a transparent human-effort log. |
| Big, weeks | Five consenting projects, several successive updates each, clean-merge and conflict cases, preserved upstream fixes, and published per-case limitations. |
| Ambiguous | A portable owner-customization manifest. Give it a shape only after the casebook shows common information missing from ordinary tests, rather than merely absent tests. |

**Next action:** obtain one real fork with a reason to track upstream and several already completed updates; reconstruct the history with its maintainer. **Kill test (E):** two days; if the useful cases are already ordinary tests plus ForkSync/Copier configuration, contribute them there. Stop if evidence only shows branding differences, generic merge conflicts or one-time customization with no continuing upstream need. **Status:** **Open, conditional dataset/study**; general fork maintenance is **Shipped/Being built**. No outreach is performed by this report.

### P5 — Accepted output versus human attention under concurrency

**Source quotes (Q):** Will's “attention runs out,” Peter's “five to 10 sessions,” Ben's “15 PR ... overnight,” and Demetri's “judgment interrupts” (§5). **One sentence (I):** a local study kit measures accepted work, review/rework minutes, decision waiting and interruptions as a person varies parallel agent work.

**30-second demo (E):** replay one operator's study results for one, three and six concurrent tasks. More sessions increase generated PRs, while accepted output flattens and review time rises. Show whether batching decisions or lowering concurrency changes that result. These would be measured observations, not numbers invented for this report.

**Closest prior art (F):** [Cue](https://github.com/murtazox04/Cue), [Happier](https://guides.happier.dev/get-notified-when-an-agent-is-waiting-across-many-parallel-sessions), [Ask Less, Ask Better](https://arxiv.org/abs/2610.24411), [Anthropic's autonomy study](https://www.anthropic.com/research/measuring-agent-autonomy). **Gap (I):** bounded parallel coding experiments connecting actual accepted outcomes to human load across sessions/providers. Generic interruption measurement is already research territory. **Who benefits:** individuals and small teams choosing concurrency and notification policy. **Why a platform does not automatically settle it:** off-platform review, other providers and business acceptance are missing from one vendor's telemetry; cross-session identity and human effort still need explicit recording.

| Size | Scope (I/E) |
|---|---|
| Tiny | A preregistered diary protocol and anonymized within-person case study. |
| Small, weekend | Local TypeScript importer for two session-log formats, explicit decision/acceptance events and a manual review-time diary. |
| Big, weeks | Counterbalanced concurrency/batching trials with multiple operators, matched task blocks, completion quality and uncertainty reporting. Reuse notification tools. |
| Ambiguous | An attention-aware admission policy. Resolve only after measurements show a stable enough relationship to outperform an ordinary fixed concurrency cap. |

**Next action:** define accepted outcomes and human-time recording before collecting a week of data. **Kill test (E):** two days for the study design/pilot, not a false claim of a completed longitudinal result. Stop if attention proxies cannot distinguish thinking from waiting, tasks cannot be compared credibly, or a simple fixed cap supplies the same benefit. Better models may remove some interruptions, so do not assume a permanent personal capacity of five to ten. **Status:** **Open, conditional study/adapter**, with direct adjacent research and weak product novelty.

## 7. Coverage and negative evidence map

**F/I:** this records what the full summary-section read and row searches contributed. It also prevents an attractive family from consuming unrelated evidence.

| Ledger | Related material retained | What was not promoted to new convergence |
|---|---|---|
| E01 | Semantic conversion/Hex, shared skills, blind grader leakage, explicit effects and acceptance gaming. | Generic evidence capture, durability and typed tool return values are occupied. Skill impact is not automatic consumer discovery. |
| E02 | Michelle's old-model residency; Scott's unnoticed swaps; Ree's email/auth in-housing; Demetri's judgment interrupts. | Old-model residency is not a quoted retirement-rehearsal request; model swaps are often adequate. |
| E03 | Ben's blind testers, Theo's stale design skill, hidden-decision experiment, attention saturation, local forks. | Three episodes with the same two hosts do not supply six independent people; hypothetical autonomous forks are experiments, not demand. |
| E04 | Titus's live foundational change constraints, Will's no-rollback history/finite attention/stale-author-bot discussion, Uber's replay and review queue. | Historical incidents and existing internal tooling do not prove a new agent-era market. |
| E05 | Consumer contract changes, emitted-code checking, failure-policy meaning tied to business strategy, recovery and attention. | Decompiled-code elimination is a different claim from which executable a test ran. Policy testing, architecture rules and fakes have prior art. |
| E06 | Ben's fresh media-workflow rehearsal, native handoff, routing under missing environment context, PR overload. | The same Ben remains one person. Cross-silicon parity and hybrid cache correctness are separate specialist projects. |
| E07 | Amp's fresh agents/manual controls, shared-skill regression possibilities, production fixtures, SvelteKit patches and review choices. | Eight Amp videos are not eight independent organizations. The evaluator's warning is not a new human interviewee. |
| E08 | Fork/adapt, stable frontend/backend wish, jellyware, API shadow traffic, actual Code Mode composition and artifact boundaries. | Generic Code Mode, receipts, managed agents, context storage and review loops are taken; fork maintenance is explicitly not proven. |
| E09 | Adam's proposed test selector, GPUI fork/version-pin objection, stale global context and analytical chart/prose errors. | An unsafe skip is inferred, not observed. The older Karpathy repost is not current 2026 product evidence. |
| E10 | Bun executable identity, HAMi telemetry, learned query skills, shim cleanup and attention. | Skill mining/correction is not evidence of stale SQL; a dashboard of shim firings is already implemented. |
| E11 | Old instruction retirement, actual install/update gates, disposability turning into durability, reviewer dissent, restart settings. | Ben Vinegar is not Ben Davis. Anthropic's article read by Theo is not a separate interviewed speaker. Generic test pruning/provenance remains occupied. |
| Connect 01 | Ryan's ownership/exit thesis, review queue, VSCO's stable mutation checks across changing surfaces. | A universal internal platform, business completion receipts and entitlement engines already exist. |
| Connect 02 | Artifacts' identity/version-skew migration; Basin's competing meanings/missing data; Arg's format/mount work. | The migration code blockage is solved. Missing historical events cannot be fixed by better SQL or a rehearsal runner. |
| Connect 03 | Lifecycle interruption and effect semantics; runtime roadmap; hibernation observer requirements. | Recovery, schedules, watchdogs, files and most lifecycle primitives have owners. Runtime hibernation assertions are a separate upstream candidate, not a new vote for fork maintenance. |
| Connect 04 | Ramp's shared fixtures/versioned live probes; stale cache cutover assumptions; Sentry's selective screening economics. | Ramp does not report a failed tenant cutover. A cheap-path/fallback architecture does not make the two talks buyers for one tool. |
| Connect 05 + SUMMARY | TELUS's count error, Lovable's memory failures and learned guidance, retained app versions, Runway's evolving models. | Retention urgency, a generic learning layer and a combined transition platform are agent inferences. The SUMMARY's shared pattern contributes zero independent speakers. |

**I — Other family worth preserving, but weaker than attention:** disposable tools acquiring durable obligations. Max says “I thought this was going to be disposable and now it needs to be durable” ([v79], 12:00); Ryan describes replacement/ownership; TELUS reports accumulating app versions. This is related to §4, but the third example does not establish a live dependency or an urgent retirement problem. It is not a stronger counted family than §5.

## 8. Predictions, wishes and roadmap board

**Q** in the claim column means an attributed forward-looking statement or proposed practice. Requirements in the final column are **I**. These are the theme-related forward signals retained from the ledger scan; current implementations and retrospective complaints are not silently turned into forecasts.

| Source / speaker | Q — forward claim, wish or proposed practice | What would need building if it matters (I) |
|---|---|---|
| [v12], 27:00, Michelle | Faster model-release cadence; she wishes it would slow because old models retain users. | Explicit retirement policy and task/user evidence. A new planner is not necessarily needed. |
| [v10], 12:00, Scott Wu | Increasing model substitutability; many swaps go unnoticed already. | Lightweight adequacy checks, with high-cost rehearsal reserved for actual sensitive consumers. This can reduce the opportunity. |
| [v80], 0:40, Geoff Huntley | Delete/rethink AGENTS.md and skills after releases or every few months. | Existing no-skill ablations and owner cases, rather than automatic age-based deletion. |
| [v66], 14:00–16:00, Katz | Harnesses get messier before cleanup; central shim telemetry can drive removals. | Exposure denominators and ablations only where simple telemetry cannot decide. Cleanup bot already exists. |
| [v70], 06:00; [v72], 08:00–09:00, Shihipar / Matan | Remove obsolete constraints; revisit harness design frequently. | Small release-comparison cases. These are two speakers, not proof that all prompts should shrink. |
| [v03], 19:00–20:00, dbt presenter | Explore conversion loss and governance while investing in interchange. | Executed converter conformance and authority cases, preferably in Ossie's owned work. |
| [v77], 10:00 and 16:00, Reza | Standardize metrics and associate chart/operator versions. | Version/semantic contracts plus supported-workload tests. This is identified HAMi work. |
| [v55], 44:00, Adam | Select necessary quality checks with a classifier. | Existing observation/shadow audit and a useful semantic regression corpus. No unsafe-skip incident was supplied. |
| [c09], 17:00–19:00, Ashley Peacock | Shutdown hooks, graceful code changes/longer old-code grace and safe retries. | Runtime-owned lifecycle implementation; customer-owned business-effect cases. These are roadmap, not outsider primitives. |
| [c13], 16:00–18:00, Dillon | Small AI-native teams, less hand-written code, higher quality and reconsidered CI/review. | Acceptance/operating evidence and reduced duplicated work. Current review bottleneck is not proof of a new CI platform. |
| [c02], 06:00 and 15:00, Ryan | “a thousand versions” of similar software; build a replacement in six months with better models. | Exit drills and measured ownership costs; replacement may be preferable to tracking upstream. |
| [c02], 16:00–18:00, Ryan | Keep an exit and an escape hatch. | An executable application-level restore/operate drill, using existing backup and test tools. |
| [v49], 10:00–12:00, Sunil / host | Encourage adaptation and owning dependencies rather than only rebuild/buy. | Existing patch-layer workflows and owner-specific cases; P4 determines whether additional common machinery is useful. |
| [v51], 12:00, host | Forkable software with stable frontend/backend contracts. | Service compatibility checks and a stated contract owner; no guarantee that the service vendor will keep supporting a private UI forever. |
| [v51], 32:00–35:00, Quinn | Release remixable jellyware without entering the maintenance business. | Recipient-side ownership/support expectations, update cases and operational prerequisites. Distribution is already planned. |
| [v11], 1:13–1:14, Ree | In-house email/auth; buying criteria shift toward extensibility/reliability/security. | Appropriate operational ownership and requirements. Convenience disappearing does not remove those obligations. |
| [v79], 09:00–12:00, Max | Engineer greater disposability; disposable software proliferates while durable software also grows. | Data/dependency/fallback boundaries and evidence of when a tool's obligations change. A generic expiration timer is insufficient. |
| [v80], 1:31–1:33, Ben Vinegar | Questions whether users want continuing malleability beyond initial tailoring. | Repeated-use cohorts before an upkeep product. This is a falsifier of the market thesis. |
| [v66], 09:00, Katz | Autonomous colleagues must communicate without overwhelming people. | Existing budgets/timing tools, evaluated against accepted work rather than notification count alone. |
| [v69], 11:00–20:00, Zach | Factory engineering shifts work to review/risk/product judgment; efficient factories can build unwanted things. | Human-time and usefulness evidence across the lifecycle. More green checks do not answer the value question. |
| [v09], 0:54–1:00, Demetri | Judgment interrupts remain necessary; possibly a large bottleneck. | P5's bounded measurements, not a universal claim that autonomy must always stop at a person. |

**I — No hidden GrowOS seed found:** none of these speakers identifies a comparably concrete, unoccupied compute primitive. The clearest opportunities are maintenance evidence, small fixtures and empirical studies. Better models strengthen some transitions while removing the implementation blockage that originally made others painful.

## 9. Search audit and source register

### Search coverage that affects confidence

**F — npm registry reads:** `promptfoo` **0.125.1**, metadata modified **2026-10-25**; `@pact-foundation/pact` **17.1.4**, modified **2026-09-07**; `@tabslabs/forksync` **0.1.2**, modified **2026-04-08**. These are publication checks, not execution/adoption evidence. [Promptfoo registry](https://registry.npmjs.org/promptfoo), [Pact registry](https://registry.npmjs.org/@pact-foundation%2fpact), [ForkSync registry](https://registry.npmjs.org/@tabslabs%2fforksync).

**F — Correction to adjacent prior art:** `@d1testflare/analytics-engine` resolves to **2.9.0**, metadata modified **2022-10-04**, with repository metadata pointing to Miniflare's old analytics-engine package. It is not evidence of an active 2026 exactness/sampling conformance simulator. [Registry](https://registry.npmjs.org/@d1testflare%2fanalytics-engine). A queried `@sqlmesh/cli` name returned 404; SQLMesh's documented project exists independently, so that exact-name miss has no novelty implication.

**F — Dated product/source checks:** Promptfoo's skill guide and current GitHub docs; dbt's October 15, 2026 compatible-track changelog; Cloudflare's July 27 harness/state docs; pnpm's current patch behavior and October release notes; Happier's October 26 guide; October 17/19 attention papers. Undated project README capabilities were inspected as current public claims, not assigned invented release dates. ForkSync's published npm package and unfinished README promises were kept distinct.

**F/I — HN discovery:** [Caliper's launch discussion](https://news.ycombinator.com/item?id=48709606) led to its primary repository; [skill-eval discussion](https://news.ycombinator.com/item?id=48046023) and [skills-management discussion](https://news.ycombinator.com/item?id=49589914) expose testing/maintenance concerns. [A Darktable discussion](https://news.ycombinator.com/item?id=49096654) proposes a maintained-fork service, and [the MkDocs discussion](https://news.ycombinator.com/item?id=48037261) contains an account of choosing a fork when upstream cannot keep up. These are discovery anecdotes, not transcript-count additions or verified demand for P4. An older [internal-forks question](https://news.ycombinator.com/item?id=30772911) also prevents mistaking the maintenance problem for a 2026 invention. Technical capability claims above rely on primary sources.

**F/I — X coverage:** searched indexed X combinations for 2026 skill regressions/Promptfoo, Ossie/semantic layers, GPU operator metric changes, test-selection audits and ForkSync. No directly inspectable matching primary post materially improved the conclusions. This is a coverage limitation, not evidence of an empty market. Similarly, narrow HN queries for the sampled-analytics and stale-binary cases did not establish a new exact product. Existing primary implementations, not search silence, drive the negative novelty verdicts.

**I — Reproducible query families:** `agent skill regression consumer impact`, `Pact can-i-deploy pending pacts`, `semantic conversion Ossie conformance`, `SQLMesh breaking downstream plans`, `dbt semantic validations CI`, `WAE sampling exact distinct`, `in-toto materials products actual execution`, `nextest archives`, `Launchable observation mode`, `CodeyBox test-selection soundness`, `fork maintenance upstream custom patches`, `Copier Cruft updates`, `ForkSync parity validation`, and `coding agents attention concurrency interruption budgets`, with GitHub/npm/HN/X filters and 2026 terms where appropriate.

### Local transcript links

[v03]: /Users/noah/code/sofort/arch/research/corpus/transcripts/03-dbt-labs-the-semantic-layer-is-dead-long-live-the-semantic-layer.txt
[v08]: /Users/noah/code/sofort/arch/research/corpus/transcripts/08-jane-street-how-ai-is-changing-programming.txt
[v09]: /Users/noah/code/sofort/arch/research/corpus/transcripts/09-a-life-engineered-what-senior-engineers-are-actually-doing-about-ai.txt
[v10]: /Users/noah/code/sofort/arch/research/corpus/transcripts/10-modal-it-s-time-to-be-ambitious-scott-wu-co-founder-ceo-at-cognition-r.txt
[v11]: /Users/noah/code/sofort/arch/research/corpus/transcripts/11-next-token-ep-06-the-senior-engineer-death-spiral.txt
[v12]: /Users/noah/code/sofort/arch/research/corpus/transcripts/12-next-token-ep-05-i-m-the-arbiter-of-tokens-and-gpus.txt
[v14]: /Users/noah/code/sofort/arch/research/corpus/transcripts/14-nerd-snipe-we-can-t-trust-gemini-4.txt
[v15]: /Users/noah/code/sofort/arch/research/corpus/transcripts/15-nerd-snipe-openai-s-dev-day-was-a-disappointment.txt
[v17]: /Users/noah/code/sofort/arch/research/corpus/transcripts/17-the-pragmatic-engineer-software-engineering-at-google-cs-education-wit.txt
[v18]: /Users/noah/code/sofort/arch/research/corpus/transcripts/18-the-pragmatic-engineer-the-revised-rules-of-engineering-management-wit.txt
[v19]: /Users/noah/code/sofort/arch/research/corpus/transcripts/19-the-pragmatic-engineer-uber-s-ai-infra-from-the-inside.txt
[v22]: /Users/noah/code/sofort/arch/research/corpus/transcripts/22-the-pragmatic-engineer-distributed-databases-with-peter-mattis.txt
[v23]: /Users/noah/code/sofort/arch/research/corpus/transcripts/23-the-pragmatic-engineer-ai-skills-with-matt-pocock.txt
[v31]: /Users/noah/code/sofort/arch/research/corpus/transcripts/31-ben-davis-how-i-m-actually-using-ai-these-days.txt
[v32]: /Users/noah/code/sofort/arch/research/corpus/transcripts/32-ben-davis-programming-feels-very-different.txt
[v38]: /Users/noah/code/sofort/arch/research/corpus/transcripts/38-amp-inc-raising-an-agent-stop-boxing-in-your-agent-season-2-episode-5.txt
[v39]: /Users/noah/code/sofort/arch/research/corpus/transcripts/39-amp-inc-using-orbs-to-eval-agent-friendliness.txt
[v49]: /Users/noah/code/sofort/arch/research/corpus/transcripts/49-latent-space-why-you-should-build-science-fiction-sunil-pai-cloudflare.txt
[v50]: /Users/noah/code/sofort/arch/research/corpus/transcripts/50-latent-space-how-anthropic-ships-the-1-llm-in-the-world-with-katelyn-l.txt
[v51]: /Users/noah/code/sofort/arch/research/corpus/transcripts/51-latent-space-orbs-shifting-coding-to-cloud-quinn-slack-amp-code.txt
[v55]: /Users/noah/code/sofort/arch/research/corpus/transcripts/55-syntax-wtf-is-a-software-factory.txt
[v57]: /Users/noah/code/sofort/arch/research/corpus/transcripts/57-syntax-i-m-using-gpui-for-everything.txt
[v66]: /Users/noah/code/sofort/arch/research/corpus/transcripts/66-ai-engineer-is-the-agent-harness-dead-jediah-katz-spacexai.txt
[v68]: /Users/noah/code/sofort/arch/research/corpus/transcripts/68-ai-engineer-how-we-solved-agent-building-andrew-qu-vercel.txt
[v69]: /Users/noah/code/sofort/arch/research/corpus/transcripts/69-ai-engineer-software-engineering-is-becoming-factory-engineering-zach-.txt
[v70]: /Users/noah/code/sofort/arch/research/corpus/transcripts/70-ai-engineer-field-guide-to-fable-thariq-shihipar-anthropic.txt
[v71]: /Users/noah/code/sofort/arch/research/corpus/transcripts/71-claude-live-coding-session-with-boris-cherny-and-jarred-sumner.txt
[v72]: /Users/noah/code/sofort/arch/research/corpus/transcripts/72-claude-how-factory-is-building-autonomous-software-with-claude.txt
[v73]: /Users/noah/code/sofort/arch/research/corpus/transcripts/73-claude-building-secure-agents-for-knowledge-work.txt
[v76]: /Users/noah/code/sofort/arch/research/corpus/transcripts/76-cncf-cloud-native-computing-foundation-the-noisy-neighbour-inside-your.txt
[v77]: /Users/noah/code/sofort/arch/research/corpus/transcripts/77-cncf-cloud-native-computing-foundation-vendor-neutral-gpu-observabilit.txt
[v79]: /Users/noah/code/sofort/arch/research/corpus/transcripts/79-ai-engineer-does-code-quality-still-matter-it-depends-on-this-max-kana.txt
[v80]: /Users/noah/code/sofort/arch/research/corpus/transcripts/80-armin-ronacher-state-of-agentic-coding-11-with-geoff-armin-and-ben.txt
[v82]: /Users/noah/code/sofort/arch/research/corpus/transcripts/82-armin-ronacher-state-of-agentic-coding-10-with-armin-and-ben.txt
[c02]: /Users/noah/code/sofort/arch/research/connect26/transcripts/02-it-s-time-to-build-not-buy.txt
[c05]: /Users/noah/code/sofort/arch/research/connect26/transcripts/05-turning-data-questions-into-data-infra-with-cloudflare-basin.txt
[c09]: /Users/noah/code/sofort/arch/research/connect26/transcripts/09-why-modern-software-engineering-needs-durable-objects.txt
[c10]: /Users/noah/code/sofort/arch/research/connect26/transcripts/10-ferrisway-ramp-s-global-routing-layer-on-cloudflare.txt
[c12]: /Users/noah/code/sofort/arch/research/connect26/transcripts/12-12-mistakes-telus-made-building-an-agent-platform-for-100-00.txt
[c13]: /Users/noah/code/sofort/arch/research/connect26/transcripts/13-artifacts-git-compatible-versioned-storage-from-zero-to-beta.txt

## 10. Ranked projects

**E — Scores:** 1–5, higher is better; gap is discounted for close prior art, and survival is about the problem rather than a durable moat. Rank also considers the strength of the oracle, individual-builder scope and how cheaply the project can be disproved. No implementation or user demand has been validated by this report.

| Rank | Project / best size | Cool | CF/Vercel/TS | Real gap | Value | Survives models | Not GrowOS | Total |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | **P2 — Exactness counterexamples**, tiny/upstream | 3 | 5 | 3 | 4 | 5 | 5 | **25** |
| 2 | **P1 — DO identity/version fixtures**, small/upstream | 4 | 5 | 2 | 4 | 4 | 5 | **24** |
| 3 | **P3 — Executable identity report**, tiny/upstream | 3 | 4 | 2 | 4 | 5 | 5 | **23** |
| 4 | **P5 — Attention/concurrency study**, tiny study → small kit | 3 | 4 | 2 | 4 | 4 | 5 | **22** |
| 5 | **P4 — Fork-upkeep casebook**, tiny dataset | 4 | 4 | 2 | 3 | 4 | 5 | **22** |

**I — Top three:** **P2** has the clearest model-independent information-loss example and the sharpest reported harmful outcome. **P1** has a concrete state-transition problem and an existing platform home, but the runner and compatibility discipline already exist. **P3** is the cheapest useful contribution and may correctly collapse to a short improvement to Bun's current helper.

**I — Most surprising signal:** the lead's apparently broad “fork and own” opening already has a near-literal implementation in `monadoid/forksync`, including patch layers, optional validation and a Workers/D1 registry. Meanwhile the strongest transcript convergence is a human capacity problem. Both findings argue for small empirical contributions before another general-purpose framework.

### Five-line TL;DR

1. **I:** Rehearsal is real convergence; its universal-product framing is not supported.
2. **I:** Meaning loss is real; stale learned SQL remains a hypothesis, and TELUS's sevenfold story is not a reproduced sampling diagnosis.
3. **I:** Check validity is partial convergence; two proposed auditors were mostly supplied by the extraction agents, and close audit tools already ship.
4. **I:** Fork/adapt converges, but continuing-fork demand is thinner and fork-maintenance implementations already exist.
5. **I:** The missed stronger family is human attention/judgment: 13 practitioners across seven channels; build tiny fixtures or studies and apply the kill tests before expanding.
