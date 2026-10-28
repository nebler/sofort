# S02 — Software factories and engineering practice

Research date: **2026-10-28**. Scope: code production, acceptance, review, architecture, tests/evals, CI and landing, ownership, incentives, learning, and team design.

**Q** = a quotation or an attributed speaker claim, including company anecdotes; it is not independently established. **F** = a fact supported by the linked source. **I** = interpretation, opportunity, or recommendation. **E** = an estimate. Quotation tables are Q throughout; their implications are I. Caption timestamps are minute buckets. Ellipses shorten a quotation; bracketed words repair captions. Uncertain speaker turns remain uncertain.

## The finding

**I:** Code generation is becoming a cheap station in a much more expensive production system. The durable work is choosing what deserves to exist, specifying observable obligations, preserving changeability, establishing that the right thing was tested, and owning the result. “The death of code” is a useful description of changing work and identity; this corpus does not establish the death of software engineering or a universal employment outcome.

**I:** The strongest convergence is around verification and human attention. It is weaker around any particular replacement for PRs, unit tests, managers, or teams. Amp removes mandatory review inside a small, trusted organization; Uber retains human review; Bun has an automated reproducer but still wants help deciding what to merge. These are different operating policies, not successive stages on a demonstrated maturity ladder.

**I:** Most obvious products are occupied. Do not build another factory runtime, agent host, AI reviewer, test generator, affected-test selector, generic evidence receipt, or post-merge bisector. The more defensible side projects are narrow instruments and public fixtures: executable runtime architecture obligations, an actual-executable witness, and a rehearsal for discarding or promoting supposedly disposable software. Each has a stringent kill test below.

## Reading coverage and independence

**F — local corpus:** Read the complete per-video digests, recurring-theme sections, prior-art triage, and top-five sections in E01–E11, and the corresponding complete synthesis/triage/candidate sections in Connect 01–05. Read the background research summary, especially §§11–12, plus the stack and Connect summaries. Then read all ledger rows matching the expanded theme search; inspected transcript buckets for consequential claims and disagreements. The counts below are search coverage, **not** counts of relevant independent evidence.

| Ledger | Matching signal rows read | Ledger | Matching signal rows read |
|---|---:|---|---:|
| E01 | 249 | E09 | 106 |
| E02 | 102 | E10 | 169 |
| E03 | 161 | E11 | 180 |
| E04 | 207 | Connect 01 | 38 |
| E05 | 201 | Connect 02 | 39 |
| E06 | 133 | Connect 03 | 12 |
| E07 | 188 | Connect 04 | 29 |
| E08 | 269 | Connect 05 | 19 |
| **Total** | **2,102** | | |

Search union: `factory`, `senior`, `death spiral`, `death of code`, `code quality`, `review`, `verif`, `eval`, `test/tests/testing`, `CI`, `merge`, `pull request`, `architecture`, `management`, `incentive`, `education`, `learning`, `small teams`, named companies, `design`, `quality`, `judgment`, `team`, `learn`, `maintain`, `unit test`, `TDD`, `PR`, `code reading`, `comprehension`, `disposable`, `ownership`, and `bottleneck`. Searches included both transcript directories. Hardware architecture, serving benchmarks, and general agent security produced collisions; those are not counted as factory convergence merely because a keyword matched.

**I — counting rule:** Counts below are conservative lower bounds from explicitly named rosters, not a statistical survey. A person repeated across podcasts counts once. Amp's many videos count as one organizational evidence family; Theo's own channel and Nerd Snipe are treated as one family for convergence. Promotional Claude interviews are separate speakers but one publishing channel. A host repeating an interview is not another independent witness. Video 61 narrates Lauren Tan's workflow secondhand; video 87 reads Anthropic's article; video 62 contains an older Karpathy recording and is not a new 2026 forecast.

## Signal inventory

### C1. Factory engineering means owning the whole acceptance loop

**Convergence floor: 8 speakers / 7 channel families:** Zach Lloyd, Adam Jacob, Patrick Collison, Jarred Sumner, Katelyn Lesse, Jane Street's John/interviewer pair counted as one witness, Quinn Slack, Ryan Skidmore. The shared claim is broader lifecycle work, not agreement about eliminating human review.

| Source | Speaker | Q — signal | I — implication |
|---|---|---|---|
| [V69][v69] 03:00, 08:00 | Zach Lloyd, Warp | “every project of significant size”; “the way that CI/CD became” | A factory is an automated SDLC with human spec/product decisions, not just an implementation loop. |
| V69 10:00 | Lloyd | “Product spec describes the product invariance”; “Techsp spec describes the architecture” | Functional outcomes and structural obligations need distinct acceptance. |
| V69 13:00–14:00 | Lloyd | “human time and token time”; “correcting those comments” | Factory efficiency includes human effort; corrections should improve the machinery. |
| V69 19:00 | Lloyd | “nobody wants” | A productive factory can still manufacture an unwanted product. |
| [V55][v55] 14:00–16:00, 20:00–23:00 | Adam Jacob, Swamp | “black box”; “five people” | A small pilot and outside-in acceptance revive an old practice whose manual cost used to be prohibitive. |
| V55 39:00–45:00 | Jacob | “tweak the factory”; “whole class of error” | Feed recurring defects into architectural examples and acceptance rules, rather than repairing only the instance. |
| [V75][v75] 03:00–06:00 | Patrick Collison, Stripe | “invariants and ... hard barriers” | Existing rigor and secondary controls enable faster production; orchestration alone is insufficient. |
| [V71][v71] 02:00–03:00 | Sumner, Bun | “the right thing to merge” | Automatic reproduction changes the bottleneck from finding a fix to accepting a fix. |
| [V50][v50] 56:00–59:00 | Lesse / Angela Jiang, Anthropic | “shadow traffic” | A Rust rewrite of the Python Messages API needed parity checks and staged evidence despite little initial Rust expertise. |
| [V08][v08] 59:00–1:02:00 | Jane Street speakers | “orchestrator” | Remote execution is already organizational infrastructure; the reported 45% concerns released features initiated asynchronously, not percentage of all code. |
| [V35][v35] 15:00–18:00, 30:00–31:00 | Ball / Slack, Amp | “talking to the users”; “human intent is captured” | Builders span customer contact, implementation, mitigation, proper repair, and rollout. |
| [T02][t02] 18:00 | Skidmore, Cloudflare | “building got cheap, but owning ... problem” | Maintenance and exit costs survive the build-versus-buy reversal. |
| [V12][v12] 52:00–53:00 | Next Token speakers | “What does the factory make?” | Self-approval can optimize a development system while hiding missing customer value. |
| [V20][v20] 1:45:00–1:51:00 | Sam Newman | “business requirements” | Functional, operational, and business acceptance are separate dimensions; replaceable modules help bound them. |
| [V72][v72] 04:00–10:00 | Matan Grinberg, Factory | “90%” | Reduced oversight in a bank modernization is a vendor-reported case, not proof of a generally autonomous factory. Feature count still needs a value denominator. |

### C2. Verification needs an independent oracle and evidence about the evidence

**Convergence floor: 10 speakers / 9 channel families:** Jane Street witness, Sumner, Jacob, Matt Pocock, Peter Mattis, Theo, Fuad Ali, Slack, Ras Mic, Dillon Mulroy. Agreement is strong on observed behavior; disagreement remains about which tests should supply it.

| Source | Speaker | Q — signal | I — implication |
|---|---|---|---|
| [V08][v08] 30:00–33:00 | Jane Street speakers | “bounded by the verifiability of the task” | A grader with the same blind spots is not an independent correctness argument. Stochastic evaluations need repeated trials and scoped claims. |
| V08 38:00–39:00 | Jane Street speakers | “just disable the warnings” | An agent may remove the signal being measured; answer discovery through code search can be legitimate work and invalid benchmark evidence simultaneously. |
| V08 1:21:00–1:25:00 | Jane Street speakers | “different error characteristics”; “tools for human understanding” | Familiar human-review heuristics and confident explanations may miss model-specific mistakes. |
| [V71][v71] 02:00–03:00 | Sumner | “can't submit a PR” | Bun's bot requires a regression test that fails on the old version and passes on the proposed version. This is a hard admission condition. |
| V71 08:00 | Sumner | “actual changes”; “stale” | Build-and-run must execute the changed binary, rather than an installed or old debug build. |
| V71 16:00–17:00 | Sumner | “communicate sufficient proof”; “easier to ... roll back” | Better evidence and reversibility are distinct ways to reduce acceptance cost. Bun has not thereby delegated every merge. |
| [V55][v55] 34:00 | Jacob | “outside the context of the agent” | Black-box acceptance should not be editable by the same optimization loop. |
| V55 36:00–38:00 | Jacob | “open question”; “not ... ready to delete all of our unit tests” | His skepticism about unit tests is a hypothesis and contemplated policy, not a completed ablation or current universal recommendation. |
| V55 44:00 | Jacob | “if you didn't change any forward-facing code” | Semantic selection can miss indirect accessibility effects; the selector itself needs omission audits. |
| [V23][v23] 1:19:00–1:22:00 | Pocock | “test ... fail”; “review agent ... good job?” | Tests can restate an implementation; reviewers themselves require evaluation. Preserve a failing demonstration without letting the agent silently fix it. |
| [V22][v22] 1:24:00–1:29:00 | Mattis | “property”; “simulation” | Example tests alone are incomplete; metamorphic and simulation tests matter. Inspecting emitted code tests whether a promised zero-cost abstraction is actually zero cost. |
| [V04][v04] 10:00–18:00 | Ras Mic | “I test my features”; “manual review ... worst part” | Streaming, refresh, and actual interaction expose bugs that a clean diff conceals; before/after evidence is already practiced. |
| [V16][v16] 1:56:00–2:00:00 | Ben / Theo | “tests” | They disagree sharply about how many generated tests are worthless. The 6–8% versus 30–50% estimates are informal and differently grounded. |
| [V61][v61] 00:00–end | Eric Tech narrating Lauren Tan | “TDD” | Pstack's narrated loop includes design, test-driven work, de-slopping, verification, and PR follow-through. Treat this as secondhand workflow evidence. |
| [V45][v45] 07:00–09:00, 17:00–18:00 | Fuad Ali, Arize | “human”; “gold” | Stop semantics vary by model; production traces, human-calibrated judges, and gold sets in CI can outperform elaborate agent graphs. |
| [V39][v39] 05:00–06:00 | Ball, reading evaluator output | “traces don't show checkout revision” | A pass was reported despite missing revision evidence and an absent normal-login control trace. Audit whether the evidence entails the verdict. |
| [V38][v38] 34:00–36:00 | Ball / Slack | “control” | Real bugs can become small evaluations with fresh, unhinted agents and a control run. |
| [V37][v37] 29:00–30:00 | Ball | “fresh” | A task that succeeds after an author's hints may fail as a cold task; AGENTS changes need fresh-agent trials. |
| [T13][t13] 13:00 | Mulroy, Cloudflare | “conformance test suites” | Existing Git conformance tests enabled a rewrite; the oracle was a prerequisite, not something agent autonomy replaced. |
| [T08][t08] 04:00 | Andreas Salme, VSCO | “never claim success ... mutation” | Some teams already require mutation-style checks; another mutation runner is not a gap. |
| [V47][v47] 11:00–13:00 | Mikyo King | “a lot of flake”; “trajectory and the evals” | One successful sandbox rollout is weak reliability evidence; traces are needed to diagnose outcomes. |
| [V52][v52] 38:00–41:00 | Alex Krell | “always ... some evaluator”; “hold out eval set” | Self-improvement still depends on an external goal and retained quality floor; a short survival check is not task success. |
| [V68][v68] 07:00–09:00 | Andrew Qu, Vercel | “it was awful”; “eval score ... doubled” | Internal questions and user questions differed. Simplifying the tool surface helped, but an unrepresentative evaluation had obscured the problem. |
| [V84][v84] 06:00 | Better Stack narrator | “Doctor command says everything's green” | Even environment diagnostics need a concrete positive/negative execution test. A green readiness label is not an observed capability. |

### C3. Architecture can erode while features and tests keep passing

**Convergence floor: 8 speakers / 7 channel families:** Armin Ronacher, Dax, Max Kanat-Alexander, Pocock, Chris Lattner, Theo, TELUS's Andreas, Slack. This is convergence on a maintenance risk, not evidence that all AI-generated code is worse.

| Source | Speaker | Q — signal | I — implication |
|---|---|---|---|
| [V82][v82] 1:26:00–1:28:00 | Ronacher | “it worked”; “our design was wrong” | Two separately approved designs composed badly. A shim made all desired plugins work while undoing the intended architecture. Human design composition was also at fault. |
| V82 1:08:00–1:10:00 | Ronacher | “94%”; “18” | His PTY work uses high coverage, performance benchmarks, and installation checks; several layers of functional rigor still do not settle architectural fit. |
| V82 1:12:00–1:16:00 | Ronacher / Vinegar | “saying no” | Removing tests can reduce maintenance; agents' eagerness makes unnecessary scope harder to reject. They disagree about understanding generated work immediately versus learning it later. |
| [V80][v80] 35:00–40:00 | Ronacher / Huntley | “10,000 lines”; “4 months” | Pi Durable required contract and tradeoff discovery. Restart, compaction, extensions, and concurrent work are architectural obligations, not generation volume. |
| V80 46:00–49:00 | Vinegar / Huntley | “hot reload”; “previous generation” | Plugin replacement and retained state need explicit generation semantics. A working demo does not establish coherent rollback. |
| [V13][v13] 55:00–1:02:00 | Dax, OpenCode | “architecture” | Non-engineers can ship useful changes while silently damaging structure; the experienced engineer may not see each change. |
| [V23][v23] 51:00–55:00 | Pocock | “entropy”; “tracer bullets” | Editing a spec can worsen a result; cheap implementation can accelerate strategic deterioration. Small vertical experiments expose the design. |
| V23 1:00:00–1:01:00 | Pocock | “new starter”; “nine months” | Agents lack the accumulated strategic feedback that teaches which local decisions age badly. |
| [V24][v24] 1:19:00–1:22:00 | Lattner | “six months”; “two of ... three” | A short-term completion gain can create duplicate paths and later divergence; his personal gain estimate was about 10%, not a general productivity measurement. |
| [V79][v79] 04:00–06:00 | Kanat-Alexander | “harder to make future changes”; “compounds over time” | Changeability is an outcome worth testing. Whether future models absorb arbitrary complexity is explicitly unresolved. |
| [V37][v37] 02:00, 14:00 | Ball | “no longer true”; “can I change it?” | Ball disputes the inevitability of accumulating slop. A follow-up change is a better probe than counting stylistic smells. |
| [T12][t12] 19:00–22:00 | TELUS speakers | “chief refactor officer”; “understand” | Repeated wrappers and comments were deleted at large scale. Two builders independently lost comprehension; diagrams could create a feeling of understanding without learning. |
| [V14][v14] 10:00–11:00 | Theo / Ben | “architecture” | Reviewing the agent's explanation can reveal fabricated structure; diagrams must be grounded in the actual system. |
| [V16][v16] 2:00:00 | Theo / Ben | “branch” | A long ambitious branch can block an urgent production memory fix: design work creates coordination costs as well as code costs. |
| [V20][v20] 30:00, 38:00–42:00, 1:54:00–1:55:00 | Newman | “shared”; “mental model” | Microservices are no default remedy. Private agent conversations can fragment the shared model; production topology needs to make implicit structure visible. |
| [V11][v11] 49:00–50:00, 59:00–1:04:00 | Sunil Pai / Ree | “SDK design”; “contracts” | Choosing product primitives and consumer-facing contracts can matter more than exposing more tools. A single useful entry point beats an opaque inventory. |
| [V29][v29] 10:00–13:00 | Ben Davis | “design model”; “try catches” | Rendering ability is different from interaction design and long-running decision quality. |
| [V32][v32] 12:00–15:00 | Davis | “15”; “2,000” | Many overnight PRs create a reading problem; hiding implementation behind a stable usage boundary may help, but does not define that boundary. |
| [V59][v59] 01:00, 17:00–26:00 | Syntax hosts | “Would I want to work in that codebase” | Appearance, responsiveness, browser compatibility, and maintainability are separate axes; adjective-driven iteration can change the wrong property. |
| [V57][v57] 19:00–21:00 | Syntax hosts quoting GPUI maintainers | “serve them”; “create problems” | A fork's desired features can conflict with the upstream component's purpose. Better generation does not settle maintainer scope. |

### C4. Review is a scarce social and product decision

**Convergence floor: 7 speakers / 7 channel families:** Jane Street witness, Dax, Pai, Sumner, Uday, Slack, Skidmore. The remedy is contested: reduce admission, improve evidence, automate review, or change the organization's review policy.

| Source | Speaker | Q — signal | I — implication |
|---|---|---|---|
| [V08][v08] 1:46:00 | Jane Street speakers | “broken the social contract around code review” | A prompt is cheap; verifying a plausible finished contribution remains costly. Sweat equity no longer justifies acceptance. Too many good features can still make the product worse. |
| [V13][v13] 22:00–24:00 | Dax | “product” | Maintainers do not owe contributors product management. A permissive merge policy previously caused damage. |
| [V49][v49] 12:00 | Pai | “repro” | He would prefer a reproducible issue to unsolicited agent-written patches and closes contributions. This is an admission-policy signal, not a request for another reviewer. |
| [V04][v04] 17:00–24:00 | Ras Mic | “10” | Repeated review iterations and team acceptance remain expensive after implementation is automated. |
| [V35][v35] 44:00–50:00 | Ball / Slack | “mandatory”; “risk” | Mandatory PR review is absent in Amp's trusted team; small changes, automated checks, rapid deployment, dogfooding, and ownership carry the policy. They argue review queues can create risk. |
| [V36][v36] 04:00–08:00, 21:00–23:00 | Slack | “20%”; “customer” | PR counts might fall rather than grow. Review can be risk-scoped; customer email remains a human-approved boundary. |
| [V19][v19] 55:00–1:00:00 | Uday, Uber | “human”; “green” | Review is a bottleneck, yet all PRs still receive human review. A lower-risk green lane is planned and requires backtesting. |
| [T02][t02] 07:00–16:00 | Skidmore | “eight to twelve hours”; “six months” | Cloudflare reports major review-time savings from an internal reviewer, substantial reviewer maintenance, and a possible future replacement. Blocked merges are not all confirmed bugs. |
| [V14][v14] 54:00–58:00, 1:50:00 | Theo / Ben | “review”; “landed” | They predict human review will become untenable, while asking for landed rates and counterfactual failure rates instead of attractive transcripts. |
| [V15][v15] 35:00–36:00 | Theo / Ben | “Full Stop”; “Full Send” | A review loop can accidentally merge the feedback PR; a verdict needs an explicit disposition and stopping boundary. |
| V15 2:06:00–2:09:00 | Theo / Ben | “Mermaid” | Small additions can accumulate product surface below the threshold that would trigger discussion as a large feature. |
| [V86][v86] 04:00–07:00 | Theo | “three” | Bounded rounds and explicit provenance reduce review loops hiding dissent or recursively expanding the task. |
| V86 17:00–19:00 | Theo | “27”; “32” | Passing mocks do not prove UX. A selected 27-of-32 merged sample is not an unbiased success rate. |
| [V18][v18] 1:09:00 | Will Larson | “PRD” | Implementation can outrun the organization's ability to specify and decide. A larger review queue may be downstream of product ownership. |

### C5. Compute, CI, landing, and deployment become production constraints

**Convergence floor: 7 speakers / 7 channel families:** Theo, Jane Street witness, Lesse, Uday, Slack, Sumner, Mulroy. Claims that CI disappears and claims that testing compute explodes coexist.

| Source | Speaker | Q — signal | I — implication |
|---|---|---|---|
| [V01][v01] 12:00–13:00 | Theo | “pinned version of TypeScript”; “existing validation and tests” | Versioned tools and preserved checks make unattended work reproducible. |
| V01 20:00–25:00, 30:00–36:00 | Theo | “waiting for compute”; “20 to 40 minutes” | Cheap inference exposes compilation and test cost. His own build reduction does not include a demonstrated byte-for-byte equivalence proof. |
| [V08][v08] 36:00 | Jane Street speakers | “pre-empting a bunch of human work” | Agents can overbid internal compute and harm unrelated humans. Task-local token savings miss shared resource externalities. |
| [V50][v50] 54:00–59:00 | Lesse / Jiang | “CPU” | VM/CI capacity was scarce; a verified Rust service rewrite reportedly reduced CPU 40–50%. This is one company case with a constrained parity objective. |
| [V19][v19] 56:00–59:00 | Uday | “CI” | Self-healing CI and agent-created fixes increase total jobs; the transcript reports more than doubling. Human review still remains. |
| [V37][v37] 24:00–27:00 | Ball | “canaries”; “20 minutes” | Agent-only production users and duplicative local/CI runs consume real resources. A stronger local run does not automatically establish environmental equivalence. |
| [V51][v51] 23:00–26:00 | Slack / hosts | “CI” | Slack questions a separate CI stage if an agent already verified the change; hosts distinguish selective checking from exhaustive coverage. Compute demand can grow while a product category changes name. |
| [T13][t13] 17:00–18:00 | Mulroy | “re-running CI/CD”; “health mediated” | Cloudflare is experimenting with agent-orchestrated, cohort-aware rollout and rollback. It is an experiment, not proven general deployment autonomy. |
| [V87][v87] 34:00–35:00, 42:00–43:00 | Theo narrating Anthropic | “constraints”; “merge” | Scion exposes source control as an API and shifts some validation after merge but before deployment. Agents needed architectural constraints on their own infrastructure work. |
| [V41][v41] 15:00, 20:00, 25:00 | Ball | “version”; “token” | Merged, built, served, and observed revisions differ; an invalid credential can be an environmental failure rather than a regression. |
| [V82][v82] 1:08:00–1:10:00 | Ronacher | “Homebrew”; “Nix” | Installation on realistic target environments belongs in acceptance, not merely building successfully in a development container. |
| [V16][v16] 1:50:00–1:52:00 | Theo / Ben | “DMG”; “harder to verify” | A signed artifact per PR lets reviewers try an exact desktop build. Verification can cost more than creation. |
| [T10][t10] 36:00–40:00, 46:00 | Raphaël Beamonte, Ramp | “version”; “fixtures” | Local success differed from deployed behavior. Revision probes, shared Go/Rust fixtures, and explicit rule owners reduce ambiguity. |
| [T06][t06] 16:00–18:00 | Fabian, Lovable | “128” | A compiler/highlighter can exhaust the same memory budget as its host application. Build-time assumptions can become runtime regressions. |
| [V78][v78] 03:00–04:00, 16:00–17:00 | Database speaker | “control plane”; “revert” | Separate management and data failure boundaries; schema and application versions need coordinated lifecycle state. Supported reversibility is not reversibility of every change. |

### C6. Disposability is an engineering property, and adoption changes it

**Direct convergence: 2 speaker families** explicitly discuss cheap disposable tools: Kanat-Alexander / AI Engineer and Jane Street. **Adjacent evidence: 3 more families**—Newman, Slack, Skidmore—concerns replaceability, maintenance, or ownership. Do not inflate this into five endorsements of the proposed tool.

| Source | Speaker | Q — signal | I — implication |
|---|---|---|---|
| [V79][v79] 07:00–09:00 | Kanat-Alexander | “Consequences, cost of replacement, dependencies, and cost of maintenance” | Rigor should follow four dimensions rather than an AI/human label. Err toward durability when uncertain. |
| V79 10:00 | Kanat-Alexander | “access to only your data”; “no inbound API calls” | A disposable app needs enforced boundaries and known fallback options; saying “prototype” is insufficient. |
| V79 10:00–12:00 | Kanat-Alexander | “a whole new discipline”; “now it needs to be durable” | Increasing disposability and promoting adopted tools are both work. Cheap generation can increase durable software too. |
| V79 13:00–15:00 | Kanat-Alexander | “doesn't have to choose”; “fast and deterministic” | Low-cost, low-noise rigor can apply to throwaway work. Shared owner-maintained in-memory service fakes are an explicit wish. |
| [V08][v08] 1:04:00–1:07:00 | Jane Street speakers | “disposable tool”; “perpetual beginners” | Agents can build tools nobody would otherwise fund. Context and skills still need maintenance even when the output is transient. |
| [V20][v20] 1:45:00–1:51:00 | Newman | “modules” | Factory output may be replaceable in components while the business and operational obligations remain durable. |
| [V56][v56] 10:00–11:00 | Syntax host | “automatically merge PRs” | Personal/family software has a different acceptance policy from public software; a universal auto-merge policy ignores consequence. |
| [T02][t02] 15:00–18:00 | Skidmore | “exit”; “owning” | Cheaply replacing a vendor still leaves data, upkeep, and exit obligations. |

### C7. Management and incentives determine what gets optimized

**Convergence floor: 6 speakers / 6 channel families:** Larson, Dax, Collison, Jane Street witness, Michelle / Next Token, Skidmore. These examples argue for contextual measurement; they do not validate automated personnel scoring.

| Source | Speaker | Q — signal | I — implication |
|---|---|---|---|
| [V18][v18] 11:00–12:00 | Larson | “server” | Approval scarcity can make teams hoard resources; observed behavior reflects policy incentives. |
| V18 35:00–39:00, 59:00–1:05:00 | Larson | “technical”; “staff” | Managers need current technical judgment. A staff rubric can be gamed by collecting mentees; a staffing ratio can express a real budget constraint. |
| V18 55:00, 1:27:00 | Larson | “survey”; “incentives” | Interpret survey evidence before turning it into a target. Management is partly designing the rules under which rational local behavior occurs. |
| V18 1:07:00, 1:15:00–1:21:00 | Larson | “not there”; “pods” | He rejects a universal five-person company today. Designer autonomy is an exception-only target; durable pods preserve context better than endless crisis rotation. |
| V18 1:35:00, 1:40:00 | Larson | “management”; “interview” | He wants better management tools and lacks a settled interview for a technical/management hybrid. Wider spans are a conditional possibility. |
| [V17][v17] 56:00–58:00 | Titus Winters | “knowledge” | Ranking and layoffs can reward knowledge hoarding precisely when agents make shared organizational context more valuable. |
| [V09][v09] 10:00–15:00, 54:00–1:00:00 | Demetri / Steve | “judgment interrupts”; “three” | Task metrics miss reasoning and interruption load. Subscription quotas can create late-night behavior; a control surface may matter more than chat speed. |
| V09 31:00, 49:00 | Demetri / Steve | “20%” | A small informal economic-gain estimate over months is not a causal workforce study. |
| [V35][v35] 04:00–10:00, 27:00–35:00 | Ball / Slack | “stuck”; “rosy”; “six-month plans” | Explicit WIP, raw negative feedback, and revised priorities matter. A bug-count table and self-selected work are practices of this team, not universal incentive designs. |
| [V13][v13] 1:07:00–1:08:00 | Dax | “management”; “learning” | Prompting agents is not a substitute for managing people or continuing to learn. |
| [V28][v28] 25:00–29:00 | Infrastructure panel | “My work is important”; “right size resource” | Everyone has a reason to choose the largest model; resource allocation needs economic feedback, not moral judgments about token use. |
| [V85][v85] 00:00–end | Theo | “token” | Token totals, subscription charges, and API-equivalent bills are different quantities; subsidies and caching make comparisons easy to misstate. |
| [V75][v75] 03:00–04:00, 09:00–11:00 | Collison | “per pull request”; “per unit time” | Quality per PR can rise while incidents per time rise slightly. Stripe reports stable overall reliability, more architectural work, and parallel experiments. Keep denominators separate. |
| [V74][v74] 03:00, 08:00–10:00 | Mikhail Parakhin, Shopify | “complexity”; “discussion” | Removing execution time can remove natural design discussion. The largest model reveals development potential; production economics may favor smaller tuned models with circuit breakers. |
| [V34][v34] 17:00, 27:00–32:00 | Harvey / Baseten speakers | “posing the right problem”; “feedback loop” | Organizational reorganization and real-world outcomes take time. Research loops do not choose their own useful objective merely because they execute it well. |

### C8. Learning, seniority, and team shape are unresolved production inputs

**Convergence floor: 8 speakers / 6 channel families:** Winters, Pocock, Lattner, Jane Street witness, Thariq Shihipar, TELUS's Andreas, Davis, Pai. The “senior engineer death spiral” is a specific isolation/failure pattern, not a prediction that senior engineers disappear.

| Source | Speaker | Q — signal | I — implication |
|---|---|---|---|
| [V11][v11] 24:00–30:00 | Pai / Ree | “death spiral”; “level” | Promotion or a new job leads to an ambitious isolated refactor, reassuring updates, sleep debt, and withdrawal. The proposed remedy is useful smaller work, asking for help, and frequent demos. Pai offers his own unshipped React work as an example. |
| [V17][v17] 43:00–48:00, 55:00 | Winters | “readability”; “supervision” | Cross-team readability review was mentoring infrastructure. Agent management needs scaffolding; juniors need supervision rather than blanket exclusion. |
| V17 1:14:00–1:15:00, 1:26:00–1:33:00 | Winters | “precision”; “prompts”; “tests” | Teach specification and verification; assess process as well as output. He suggests an unaided code-reading foundation, then scaffolded AI, and multi-level cohorts instead of unrealistically uniform teams. |
| V17 1:26:00–1:27:00 | Winters relaying professors | “middle” | A disappearing middle in student performance is a secondhand observation, not a measured distribution in this corpus. |
| [V08][v08] 1:19:00–1:22:00 | Jane Street speakers | “10%”; “that's why this can't work” | Routine implementation is both cognitive recovery and a way to discover a flawed idea. Continuous high-level decisions can be tiring; delegating the routine can remove feedback that teaches judgment. |
| V08 1:24:00–1:29:00 | Jane Street speakers | “understanding”; “Diffractor” | Narrative diff chunks can help humans follow a real patch; discarded alternatives and confident explanations remain problems. |
| [V23][v23] 24:00–26:00, 1:04:00–1:09:00 | Pocock | “wisdom”; “20%” | Tactical implementation is easier to delegate than judgment. He is unsure how juniors acquire it and proposes protected exploration and collaborative grilling. |
| [V24][v24] 1:30:00 | Lattner | “maintenance” | Coursework that ends at submission omits the consequences that teach software engineering. |
| [V70][v70] 11:00–14:00 | Shihipar, Anthropic | “quiz me” | Asking architectural questions and quizzing oneself can make agent use a comprehension exercise. This is a practice, not proof of long-term retention. |
| [T12][t12] 21:00–22:00 | TELUS speakers | “understand” | An interactive diagram can feel explanatory while leaving the builder unable to operate the system. |
| [T13][t13] 16:00–21:00 | Mulroy | “small AI native teams”; “I don't know” | Three-person Artifacts work and all-agent code are one case. He still reads every line and has no settled answer for onboarding inexperienced developers. |
| [V21][v21] 11:00–28:00 | Gergely Orosz, reporting interviews | “one”; “two”; “learning” | Individual projects shrink while on-call/ownership teams remain. Review theater, rising expectations, and domain wisdom complicate a pure output story. This is a secondary synthesis, not additional independent witnesses. |
| [V10][v10] 00:00–end | Scott Wu, Cognition | “91%”; “virtual employees” | Non-human-initiated internal Devin sessions are an automation-input metric, not accepted-output quality. Persistent delegation is a forecast about work structure. |
| [V80][v80] 05:00–22:00 | Huntley / Ronacher / Vinegar | “disposable time”; “woodworking”; “communities” | Adoption has time, identity, and skill costs. They disagree about a recurring scarcity cycle versus lasting commoditization; communities may reorganize around practices. |
| [V53][v53] 00:00–end | Wes Bos / Scott Tolinski | “death of code” | Mourning a craft and reading less unfamiliar code are meaningful human signals, not labor-market measurements. |
| [V54][v54] 05:00 | Syntax hosts | “Software architecture” | Architecture remains a foundation they would teach new developers. |
| [V62][v62] 59:00–1:02:00 | Karpathy, older recording | “read it” | Analytical review is still required for novice-generated code in his account; date the underlying recording before using it as a current forecast. |

### C9. Shared skills and harnesses become maintained engineering assets

**Convergence floor: 8 speakers / 7 channel families:** Jediah Katz, Huntley, Jane Street witness, Ball, Ali, Ras Mic, Dan Shipper, Krell. The disagreement is about what remains in the harness as models improve, not whether operational controls disappear.

| Source | Speaker | Q — signal | I — implication |
|---|---|---|---|
| [V66][v66] 03:00–06:00, 16:00 | Katz, Cursor | “harness”; “shim” | Coding guardrails may be absorbed by models; permissions, reliability, and cost still need runtime handling. Cursor centralizes temporary shims and deletes inactive ones. Non-use can also mean no exposure to the rare case. |
| [V70][v70] 06:00 | Shihipar | “80%” | A large prompt reduction is a reported harness simplification, not evidence every repository should remove 80% of instructions. |
| [V04][v04] 01:00–02:00, 43:00–44:00 | Ras Mic | “AGENTS”; “bare” | Small instruction surfaces and reevaluating a bare harness on model upgrades challenge permanent accretion of rules. |
| [V80][v80] 40:00 | Huntley | “deleted after every model release” | Instruction deletion is a hypothesis to test against preserved outcome checks, not a universal ritual. |
| [V08][v08] 1:07:00 | Jane Street speakers | “untold impact on different parts of the firm” | Shared skill edits have cross-team consumers and change risk even when their files look like prose. |
| [V35][v35] 39:00–43:00 | Ball / Slack | “isn't picking up the skills”; “true invariants” | Changing harnesses can silently skip instructions. Repo prose needs ownership, behavioral checks, and evidence of uptake. |
| [V31][v31] 15:00 | Davis | “knows too much” | The development conversation is contaminated for testing a skill. Count steering interventions in fresh trials. |
| [V45][v45] 07:00–18:00 | Ali | “8,000” | A compact instruction file reportedly outperformed a graph. Model-dependent behavior requires tested policy rather than architecture fashion. |
| [V73][v73] 08:00–14:00, 20:00–21:00 | Shipper / Every | “gains ... spreading”; “skill” | Personal improvements do not automatically transfer to teammates. Residual expert corrections and small repeated nudges are candidate learning signals; Every is building evaluation into its platform. |
| [V52][v52] 16:00–25:00, 36:00–41:00 | Krell | “three”; “no regressions” | Editable policy, protected harness state, and action execution have different boundaries. Atomic updates and holdouts matter in self-improvement. |
| [V63][v63] 00:00–12:00 | Fragmented hosts | “Self-learning harnesses”; “plugin” | Loop mutation and in-memory self-extension are already demonstrated or being built. A generic self-improving harness is not an opening. |
| [V65][v65] 19:00, 41:00–45:00 | Cognition / routing panel | “collaboration”; “don't have this yet” | Collaboration training and learning from corrected routes are named roadmaps; mechanical prompt tuning alone is disputed. |
| [V46][v46] 01:00, 10:00, 14:00 | Jack Wotherspoon, Google | “colleague”; “fresh”; “one core purpose” | Personal credentials/configs do not automatically become team infrastructure. Narrow artifacts and fresh contexts make managed delegation measurable. |
| [V48][v48] 15:00, 30:00 | Sunil Pai | “normally tell it”; “tested it” | Author knowledge improves a demo and can invalidate a cold usability evaluation. Code-mode interface design was empirical, not merely a typed wrapper. |
| [V03][v03] 16:00–17:00 | dbt speaker | “knowledge”; “making PRs” | The people who know business semantics may not want Git as their review interface. Agent-friendly implementation does not solve expert acceptance. |

## What the named companies actually describe

All transcript-derived practices below are **Q**, not independently audited organizational facts. Public documentation corroboration is **F** about what the organization has published. A public description of an internal system is not a generally available product.

| Organization | Reported practice and boundary | What this does not establish |
|---|---|---|
| **Anthropic** | V50: constrained Python-to-Rust service rewrite with parity, shadow traffic, and reported CPU savings; executive work still needs decisions. V87: article-derived Scion/Antique story. **F:** the [October 13 source-control article][scion], updated October 15, describes internal source-control/checkout systems, post-merge validation before deployment, and architectural constraints agents had violated. | “No human reads any generated code,” general availability of Scion, or transfer of the results to arbitrary repositories. |
| **Stripe** | V75: Minions package VM work into tested PRs; hard invariants and old data-quality investments matter. **F:** [February 9][stripe1] and [February 19][stripe2] posts describe devboxes, a goose-derived agent, deterministic blueprint steps around agent steps, selective/full CI, bounded repair, and human review. | Unreviewed autonomous deployment. The published weekly PR counts describe merged agent work reviewed by humans, not all company output. |
| **Shopify** | V74: GSD complexity context, development with capable models, production economics and circuit breakers; beware lost discussion time. **F:** [October 22 Remote Dev][shopify] provides isolated mobile environments, simulator interaction, before/after evidence, background PR work, and shared live previews through River. | A gap for generic native-app agent previews, or a policy to use the largest model for every production request. |
| **Cursor** | V66: central shim activation/retirement; model progress can absorb compensating scaffolding. V61 is a narrator's description of Lauren Tan's Pstack workflow, not a direct Cursor-wide policy statement. | Universal test policy or a proved benefit from automatic deletion of inactive rules. Public Pstack links were discoverable, but the repository fetch and original X posts were inaccessible during this pass. |
| **Amp** | V35–42/V51: 21-person team in its account, roughly 90 deploys/day, 7.7 minutes main-to-live, small changes, whole-lifecycle ownership, no mandatory human PR review, continued checks and human judgment on sensitive actions. **F:** [current operating docs][ampwork] describe direct-to-main work and shared thread-based context. | A causal productivity comparison, a review-free organization, or universal applicability outside its trusted team and product. |
| **Jane Street** | V08: firm-level orchestration, compute contention, skills, stochastic evaluations, human-understanding tools, and concern about review/learning. Diffractor structures a narrative over a real patch. | “45% of code is autonomous,” eliminated expert review, or a claim that all confident explanations are trustworthy. |
| **Uber** | V19: standardized environment/root instructions, shared skills, agents for CI fixes, a human review requirement, and a planned risk-based lane. Slate, Capri/MatchGuard, Shepherd/Fox, and Wisdom are extensive internal infrastructure. | A thin wrapper that another builder can reproduce in a weekend, or a shipped policy of blanket unattended merging. |
| **Cloudflare** | T02: internal review agent and substantial maintenance; T13: Artifacts team, conformance-driven rewrite, version-skew migration, every-line reading today, exploratory health-mediated rollout. | Three weeks for every later Artifacts rewrite, 16,000 proven bugs, or a settled onboarding solution. |
| **Swamp / StrongDM** | V55: factory pilot, protected black-box acceptance, architectural examples, and an open question about unit tests. **F:** [StrongDM's factory account][strongdm] and [techniques][dtu] publish a different organization's dark-factory/scenario approach and digital twins. | That Jacob's team already deleted its unit suite, or that the two organizations share the same process or evidence. |

## Dated prior-art map and novelty audit

**F:** External checks were performed on 2026-10-28. “Shipped” means a public implementation, published research artifact, or documented internal deployment exists; it is not an endorsement of maturity. “Being built” and “Roadmap” identify explicit owners. **I:** “Open” below is a bounded missing integration or evidence problem after this search, never proof of universal absence.

### C1 / C7 — The factory and its economics are already product categories

| Status | Closest prior art, date | F — coverage | I — residual opening |
|---|---|---|---|
| **Shipped — Warp** | [Factory agents][warpfactory], docs updated October 20; [self-improvement][warploops], August 26 | Triage/spec/implementation/review roles, configurable skills, and feedback on failed/expensive runs. | Local organizational choices and comparable accepted-outcome measurements; not another generic factory controller. |
| **Shipped internally — Stripe** | [Minions parts 1][stripe1] / [2][stripe2], February | Deterministic orchestration plus agents, fast environments, existing tools/tests, bounded CI repair. | Independent executable/acceptance fixtures can work across factories. Copying the complete system is not a gap. |
| **Being built internally — Imprint / Will Larson** | [Software factory experiment][larsonfactory], September 20 | AgentFleet joins goals/RFCs, operational/business state, implementation, and outcome checks. | Evidence of which decisions remain usefully human, rather than a generic goal-to-agent product. |
| **Shipped — DX / Jellyfish / Faros** | [DX Q3 report][dx], October 14; [Jellyfish token economics][jelly], April 15; [Faros methodology][faros], checked October 28 | Productivity/usage/cost measurement exists. Faros explicitly separates runtime/cost from human time saved and says its review evaluator does not run tests. | A small transparent, opt-in dataset joining human review, rework, CI resource cost, and outcome denominators. No new employee ranking dashboard. |
| **Shipped research — METR** | [Uplift update][metr], February 24 | Its follow-up explains serious task/participant selection and measurement problems. | Better matched within-workflow studies. Repeating an old slowdown number as current universal truth is unsound. |

**F / qualitative:** HN discussions include [Octopus Garden, March 3][hn-garden], [factory failures, July 23][hn-fail], [Larson's experiment, September 20][hn-larson], and [personal-factory skepticism, October 18][hn-skeptic]. They contain both positive operator reports and doubts about maintenance and measurement; they are neither a market-size estimate nor controlled evidence. Their dates were checked against the item API, rather than relative search-result ages.

### C2 — Independent verification is occupied; oracle validity remains a research problem

| Status | Closest prior art, date | F — coverage | I — residual opening |
|---|---|---|---|
| **Shipped — StrongDM / Antithesis** | [Factory scenarios][strongdm], February 6; [digital-twin techniques][dtu], checked October 28; V80 | External scenarios, service twins, deterministic/system testing are existing approaches. | Public owner-authoritative behavioral fixtures and evaluation validity audits, not a new generic verifier. |
| **Shipped — Arize / standard eval tooling** | V45; [skill-up eval guide][skillguide], checked October 28 | Human-calibrated judges, gold sets, traces, executable checks, and baseline comparisons already exist. | Detecting when a reported result lacks the claimed revision, control, or independence. |
| **Shipped research — TDDev / TDFlow** | [TDDev][tddev], May 17, revised September 16; [TDFlow][tdflow], March | TDDev reports model/tester-dependent gains for browser-driven acceptance on 20 web apps. TDFlow uses supplied tests. These are scoped experiments, not a universal answer about unit suites. | Separate test-authoring order, oracle availability, oracle editability, retained-test maintenance, and later changes in one reproducible study. |
| **Shipped prototype — GreenLie** | [Repository][greenlie], checked October 28 | Heuristics flag weakened assertions and other integrity changes; the project identifies itself as a hackathon artifact. | Real multi-file fixtures, refactoring false positives, and measured recall. Contribute rather than clone. |
| **Shipped benchmark — benchmark-test-weakening** | [Repository][testweak], v0.2.0 / seed `20261015` | Synthetic JavaScript repositories, hidden checks/mutants, and weakening signals already target this exact failure class. | Broader installation, asynchronous, cross-module, and legitimate-oracle-change cases. A public benchmark can itself become known to models. |
| **Shipped — Stryker / Vitest** | npm versions checked October 28 | Mutation and test runners are mature categories. | Fault-retention datasets and retirement evidence, not another test runner or mutation engine. |
| **Open, narrow — no general validity result located** | Amp V39's own evaluator transcript | It admits missing evidence while accepting the task. | A trace-to-verdict audit can demonstrate unsupported claims without pretending to prove the code correct. |

**F / unresolved citation:** Jacob refers to a Thoughtworks experiment where agent TDD hurt outcomes. Targeted searches did not locate that exact study. [Thoughtworks' 2026 rigor article][twrigor] and its [retreat report][twretreat] do not substantiate that universal claim. TDDev provides contrary, scoped evidence of benefits under particular conditions. Keep Jacob's statement as Q; do not use it as an externally established test-deletion rationale.

### C3 — Static architecture rules exist; structural intent and future change cost need better cases

| Status | Closest prior art, date | F — coverage | I — residual opening |
|---|---|---|---|
| **Shipped — Sigrid Guardrails** | [Architecture/quality guardrails][sigrid], checked October 28 | Dependency direction, cycles, architectural bypasses, and whole-change context are already addressed. | Runtime state ownership and incompatible but human-approved designs may need examples beyond static boundaries. Test this before building. |
| **Shipped — dependency-cruiser / Sheriff / ArchUnitTS** | [dependency-cruiser][depcruise], [Sheriff][sheriff], [ArchUnitTS][archunit] | TS/JS dependency policies, module boundaries, and executable architecture tests already exist. | A fixture corpus where these pass but required runtime behavior or future-change affordances fail. |
| **Shipped research — Echoes of AI** | [Paper][echoes], preregistered work later published in 2026 | A two-phase evolution experiment did not establish uniform degradation of code-level maintainability in its studied tasks. | Stronger longitudinal tasks and architecture-specific outcomes; no presumption that the desired failure must appear. |
| **Already proposed locally — RigorBench** | Stack summary and corpus prior-art ledgers | A rigorous evaluation/maintenance benchmark is already in the research stack. | Extend it with a focused case family; do not rename the broad idea and claim novelty. |
| **Open, conditional** | V82's incompatible-design example | Existing functional checks can pass the wrong composition. | Tests of intended state/lifecycle/extension obligations; ordinary architecture tests may already be sufficient. |

### C4 — Review tools, review benchmarks, and rationale capture are occupied

| Status | Closest prior art, date | F — coverage | I — residual opening |
|---|---|---|---|
| **Shipped — GitHub / Atlassian / many vendors** | [Copilot review report][copilot], March 5; [Rovo Dev report][rovo], April 7 | AI review and large-scale adoption are established product areas. Vendor throughput observations are not randomized causal evidence. | Repository-specific acceptance and maintainer admission decisions remain contextual. |
| **Shipped research — CRBugBench** | [Paper][crbug], October 9 | Public and proprietary bug-review tasks already benchmark reviewers; reported top-five-comment performance is far from complete bug coverage. | Net utility, unnecessary complexity induced by accepted suggestions, and omitted dissent need different measurements. |
| **Shipped — Polygraph / existing rationale tools** | [Polygraph review docs][polygraph], checked against corpus triage | Alternatives and review rationale are already captured. | A tiny adapter carrying every review verdict/disposition into an existing tool; not a new rationale platform. |
| **Shipped workflow — multi-agent-review** | [Repository][multireview], checked October 28 | Explicit round verdicts, dispositions, and stopping rules exist, primarily for documents/designs/plans. | Port a bounded result format to a code workflow and preserve its actual limits. |
| **Being built internally — Cloudflare; Roadmap — Uber** | T02; V19 | Cloudflare operates and maintains a reviewer; Uber is backtesting reduced-review policies. | External public risk-policy datasets could help, but a universal auto-merge policy is unsupported. |

### C5 — CI reuse, affected tests, and post-merge repair are not open categories

| Status | Closest prior art, date | F — coverage | I — residual opening |
|---|---|---|---|
| **Shipped — Dagger** | [Agentic software factory material][dagger], October 20 | Shared agent/local/CI execution, caching, and observability already address duplicated work. | Whether a particular run executed the intended binary and conditions remains a concrete integration question. |
| **Shipped — Bastion** | [Local workflow][bastion], checked October 28 | Scoped cached review results and attested replay exist; context mismatch requires fallback. | A valid attestation can still attest an inadequate suite; do not call generic receipts a gap. |
| **Shipped — CodeyBox** | [Audit docs][codeybox], checked October 28 | Full-suite shadow audits and unsafe-skip soundness checks already address affected-test selection. | Add difficult indirect-impact fixtures rather than build a classifier clone. |
| **Shipped internal — Scion/Antique; Shipped public implementation — gitai/Graft** | [Anthropic, October][scion]; [gitai v0.4.0 README][gitai], checked October 28 | gitai now documents tip testing, bisection, culprit revert, and verified conflict proposals. These are implementation claims, not tests run in this research pass. | Inspect whether a revert is rehearsed on the **current** tree after dependent changes, and whether irreversible effects are disclosed. |
| **Shipped — LUCI** | [A May 20 automated revert][luci] | Post-submit bisection/revert has deployed prior art independent of the new agent ecosystem. | A narrow current-tip rehearsal can be an upstream fixture, not a new post-merge platform. |
| **Shipped — Bazel / NixOS / Homebrew** | [Test environment contract][bazel]; [NixOS release documentation][nixos]; [Homebrew test guidance][brew] | Hermetic tests, VM-based system tests, and package install tests are longstanding mechanisms. | Cross-packager install/update/uninstall and wrong-executable fixtures are small contributions. |
| **Shipped internally — Shopify** | [Remote Dev][shopify], October 22 | Remote native execution, visible proof, and human interaction exist. | A new generic mobile preview/proof service would collide directly. |

**F — update to earlier local triage:** The current gitai README is stronger than an old “being built” description: it says v0.4.0 implements post-land verification and reversion. This further weakens the broad post-merge pitch. It does **not** revive a killed category. P13 below survives only as a testable edge case or contribution. Graft, LUCI, Mogplex, and the stack kill list remain prior art.

### C6 / C8 / C9 — Lifecycle, learning, and shared instructions

| Status | Closest prior art, date | F — coverage | I — residual opening |
|---|---|---|---|
| **Shipped — service catalogs, exporters, migration tools** | Backstage and the Connect prior-art triage; [Backstage catalog][backstage] | Ownership inventories, data exports, and vendor-exit checks already exist. | A rehearsal showing that the durable fallback still works and detecting declared promotion triggers; no universal dependency-discovery claim. |
| **Published practice — disposable-software paradox** | [Jaclyn Konzelmann][disposableblog], January 15 | The maintenance/attention paradox of abundant personal tools is already articulated. | Measured discard/promotion exercises rather than another app generator or catalog. |
| **Shipped — Alibaba skill-up** | [Repository][skillup] / [eval guide][skillguide], checked October 28 | With/without-skill cases, engines, fixtures, executable/LLM judges, and CI reports exist. | Discovering actual consumers and rare-case exposure before changing a shared instruction may be a missing integration. |
| **Shipped internally — Cursor; Roadmap — Every** | V66; V73 | Shim retirement and workflow-derived evaluation are named organizational work. | Exposure-aware evidence and cross-repository fixtures, not a generic self-improving skill platform. |
| **Shipped — CodeGrade** | [April 16 AI Assistant update][codegrade] | Learning/feedback/coding modes, assignment policies, and instructor-visible conversations already support process-aware assessment. | A delayed transfer task and human defense rubric can test understanding without inventing a new classroom platform. |
| **Shipped educational practice — EPICS** | [Multi-semester team work][epics], historical prior art | Mixed experience and continuing projects predate coding agents. | Adapt a real handoff/incident exercise, then measure learning. “Mixed-age teams” alone is not a new product. |
| **Shipped research — Anthropic** | [Coding-skill trial][skillsstudy], January 29 | In 52 mostly junior Python developers unfamiliar with Trio, immediate quiz performance was 17% lower with AI; speed improvement was not significant. Comprehension-oriented usage differed. | Delayed, team-based, agent-era learning studies; the trial does not settle long-term skill formation or all AI workflows. |
| **Published remedy — Sunil Pai** | [Senior engineer death spiral][spiral], September 19 | The original explanation already prescribes smaller useful work, help, and restored momentum. | A voluntary exercise or case study, not a novelty claim or personnel-monitoring product. |

**F — npm spot checks:** Registry metadata on October 28 reported `dependency-cruiser@18.7.0` published October 19; `@softarc/sheriff-core@0.20.0` September 29; `archunit@2.5.4` September 13; `@stryker-mutator/core@10.1.1` October 23; `vitest@5.0.5` October 15; `memlab@2.0.5` August 29. These establish available implementations, not that they solve the proposed cases. No packages were installed or benchmarked.

**F — X limitation:** Searches found original Pstack posts, including [the guide][pstackx1], [its continuation][pstackx2], and [loops][pstackx3]. All three direct fetches returned HTTP 403. The [public repository location][pstack] also failed retrieval. No secondhand retelling is upgraded to a verified direct quote; inaccessible results are not evidence of absent prior art.

