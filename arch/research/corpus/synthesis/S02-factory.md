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
| V69 19:00 | Lloyd | “no one cares about” | A productive factory can still manufacture an unwanted product. |
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
| [V39][v39] 05:00–06:00 | Ball, reading evaluator output | “traces don't show the checkout revision” | A pass was reported despite missing revision evidence and an absent normal-login control trace. Audit whether the evidence entails the verdict. |
| [V38][v38] 34:00–36:00 | Ball / Slack | “control” | Real bugs can become small evaluations with fresh, unhinted agents and a control run. |
| [V37][v37] 29:00–30:00 | Ball | “fresh” | A task that succeeds after an author's hints may fail as a cold task; AGENTS changes need fresh-agent trials. |
| [T13][t13] 13:00 | Mulroy, Cloudflare | “conformance test suites” | Existing Git conformance tests enabled a rewrite; the oracle was a prerequisite, not something agent autonomy replaced. |
| [T08][t08] 04:00 | Andreas Salme, VSCO | “never claim success ... mutation” | Some teams already require mutation-style checks; another mutation runner is not a gap. |
| [V47][v47] 11:00–13:00 | Mikyo King | “a lot of flake”; “trajectory and the evals” | One successful sandbox rollout is weak reliability evidence; traces are needed to diagnose outcomes. |
| [V52][v52] 38:00–41:00 | Alex Krentsel | “always ... some evaluator”; “hold out eval set” | Self-improvement still depends on an external goal and retained quality floor; a short survival check is not task success. |
| [V68][v68] 07:00–09:00 | Andrew Qu, Vercel | “it was awful”; “eval score ... doubled” | Internal questions and user questions differed. Simplifying the tool surface helped, but an unrepresentative evaluation had obscured the problem. |
| [V84][v84] 06:00 | Better Stack narrator | “Doctor command says everything's green” | Even environment diagnostics need a concrete positive/negative execution test. A green readiness label is not an observed capability. |

### C3. Architecture can erode while features and tests keep passing

**Convergence floor: 8 speakers / 7 channel families:** Armin Ronacher, Dax, Max Kanat-Alexander, Pocock, Chris Lattner, Theo, TELUS's Andreas, Slack. This is convergence on a maintenance risk, not evidence that all AI-generated code is worse.

| Source | Speaker | Q — signal | I — implication |
|---|---|---|---|
| [V82][v82] 1:26:00–1:28:00 | Ronacher | “it worked”; “our design was wrong” | Two separately approved designs composed badly. A shim made all desired plugins work while undoing the intended architecture. Human design composition was also at fault. |
| V82 1:08:00–1:10:00 | Ben Vinegar | “94%”; “18” | His Hunk PTY work uses high coverage, performance benchmarks, and installation checks; several layers of functional rigor still do not settle architectural fit. |
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
| [V14][v14] 10:00–11:00 | Theo / Ben | “architectural ... observations” | Reviewing the agent's explanation can reveal fabricated structure; diagrams must be grounded in the actual system. |
| [V16][v16] 2:00:00 | Theo / Ben | “branch” | A long ambitious branch can block an urgent production memory fix: design work creates coordination costs as well as code costs. |
| [V20][v20] 30:00, 38:00–42:00, 1:54:00–1:55:00 | Newman | “shared”; “mental model” | Microservices are no default remedy. Private agent conversations can fragment the shared model; production topology needs to make implicit structure visible. |
| [V11][v11] 49:00–50:00, 59:00–1:04:00 | Sunil Pai / Ree | “SDK design”; “contracts” | Choosing product primitives and consumer-facing contracts can matter more than exposing more tools. A single useful entry point beats an opaque inventory. |
| [V29][v29] 10:00–13:00 | Ben Davis | “design model”; “try catches” | Rendering ability is different from interaction design and long-running decision quality. |
| [V32][v32] 12:00–15:00 | Davis | “15”; “2000” | Many overnight PRs create a reading problem; hiding implementation behind a stable usage boundary may help, but does not define that boundary. |
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
| [V36][v36] 04:00–08:00, 21:00–23:00 | Slack | “20%”; “email” | PR counts might fall rather than grow. Review can be risk-scoped; customer email remains a human-approved boundary. |
| [V19][v19] 55:00–1:00:00 | Uday, Uber | “human”; “green” | Review is a bottleneck, yet all PRs still receive human review. A lower-risk green lane is planned and requires backtesting. |
| [T02][t02] 07:00–16:00 | Skidmore | “8, 12 hours”; “6 months” | Cloudflare reports major review-time savings from an internal reviewer, substantial reviewer maintenance, and a possible future replacement. Blocked merges are not all confirmed bugs. |
| [V14][v14] 54:00–58:00, 1:50:00 | Theo / Ben | “review”; “landed” | They predict human review will become untenable, while asking for landed rates and counterfactual failure rates instead of attractive transcripts. |
| [V15][v15] 35:00–36:00 | Theo / Ben | “Full Stop”; “Full Send” | A review loop can accidentally merge the feedback PR; a verdict needs an explicit disposition and stopping boundary. |
| V15 2:06:00–2:09:00 | Theo / Ben | “Mermaid” | Small additions can accumulate product surface below the threshold that would trigger discussion as a large feature. |
| [V86][v86] 04:00–07:00 | Theo | “three” | Bounded rounds and explicit provenance reduce review loops hiding dissent or recursively expanding the task. |
| V86 17:00–19:00 | Theo | “27”; “32” | Passing mocks do not prove UX. A selected 27-of-32 merged sample is not an unbiased success rate. |
| [V18][v18] 1:09:00 | Will Larson | “PRD” | Implementation can outrun the organization's ability to specify and decide. A larger review queue may be downstream of product ownership. |
| [V50][v50] 1:21:00–1:24:00 | Lesse / Jiang | “extra burden on the consumer”; “quick stamp” | Unread generated documents transfer work to readers. Some implementation can receive light review when design and verification are strong; that is not permission to ship unchecked documents or every change. |

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
| [V82][v82] 1:08:00–1:10:00 | Vinegar | “homebrew”; “[Nix]” | Installation on realistic target environments belongs in acceptance, not merely building successfully in a development container. |
| [V16][v16] 1:50:00–1:52:00 | Theo / Ben | “DMG”; “harder to verify” | A signed artifact per PR lets reviewers try an exact desktop build. Verification can cost more than creation. |
| [T10][t10] 36:00–40:00, 46:00 | Raphaël Beamonte, Ramp | “version”; “same fixture test” | Local success differed from deployed behavior. Revision probes, shared Go/Rust fixtures, and explicit rule owners reduce ambiguity. |
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
| [V13][v13] 1:07:00–1:08:00 | Dax | “manager of real people” | Prompting agents is not a substitute for managing people or continuing to learn. |
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
| [V24][v24] 1:30:00 | Lattner | “turn it in throw it away” | Coursework that ends at submission omits the consequences that teach software engineering. |
| [V70][v70] 11:00–14:00 | Shihipar, Anthropic | “quiz me” | Asking architectural questions and quizzing oneself can make agent use a comprehension exercise. This is a practice, not proof of long-term retention. |
| [T12][t12] 21:00–22:00 | TELUS speakers | “understand” | An interactive diagram can feel explanatory while leaving the builder unable to operate the system. |
| [T13][t13] 16:00–21:00 | Mulroy | “small AI native teams”; “I don't know” | Three-person Artifacts work and all-agent code are one case. He still reads every line and has no settled answer for onboarding inexperienced developers. |
| [V21][v21] 11:00–28:00 | Gergely Orosz, reporting interviews | “one”; “two”; “learning” | Individual projects shrink while on-call/ownership teams remain. Review theater, rising expectations, and domain wisdom complicate a pure output story. This is a secondary synthesis, not additional independent witnesses. |
| [V10][v10] 00:00–end | Scott Wu, Cognition | “91%”; “virtual employee” | Non-human-initiated internal Devin sessions are an automation-input metric, not accepted-output quality. Persistent delegation is a forecast about work structure. |
| [V80][v80] 05:00–22:00 | Huntley / Ronacher / Vinegar | “disposable time”; “woodworking”; “communities” | Adoption has time, identity, and skill costs. They disagree about a recurring scarcity cycle versus lasting commoditization; communities may reorganize around practices. |
| [V53][v53] 00:00–end | Wes Bos / Scott Tolinski | “death of code” | Mourning a craft and reading less unfamiliar code are meaningful human signals, not labor-market measurements. |
| [V54][v54] 05:00 | Syntax hosts | “Software architecture” | Architecture remains a foundation they would teach new developers. |
| [V62][v62] 59:00–1:02:00 | Karpathy, older recording | “read it” | Analytical review is still required for novice-generated code in his account; date the underlying recording before using it as a current forecast. |

### C9. Shared skills and harnesses become maintained engineering assets

**Convergence floor: 8 speakers / 7 channel families:** Jediah Katz, Huntley, Jane Street witness, Ball, Ali, Ras Mic, Dan Shipper, Krentsel. The disagreement is about what remains in the harness as models improve, not whether operational controls disappear.

| Source | Speaker | Q — signal | I — implication |
|---|---|---|---|
| [V66][v66] 03:00–06:00, 16:00 | Katz, Cursor | “harness”; “shim” | Coding guardrails may be absorbed by models; permissions, reliability, and cost still need runtime handling. Cursor centralizes temporary shims and deletes inactive ones. Non-use can also mean no exposure to the rare case. |
| [V70][v70] 06:00 | Shihipar | “80%” | A large prompt reduction is a reported harness simplification, not evidence every repository should remove 80% of instructions. |
| [V04][v04] 01:00–02:00, 43:00–44:00 | Ras Mic | “AGENTS”; “start fresh” | Small instruction surfaces and reevaluating a bare harness on model upgrades challenge permanent accretion of rules. |
| [V80][v80] 40:00 | Huntley | “deleted after every model release” | Instruction deletion is a hypothesis to test against preserved outcome checks, not a universal ritual. |
| [V08][v08] 1:07:00 | Jane Street speakers | “untold impact on different parts of the firm” | Shared skill edits have cross-team consumers and change risk even when their files look like prose. |
| [V35][v35] 39:00–43:00 | Ball / Slack | “isn't picking up the skills”; “true invariants” | Changing harnesses can silently skip instructions. Repo prose needs ownership, behavioral checks, and evidence of uptake. |
| [V31][v31] 15:00 | Davis | “knows too much” | The development conversation is contaminated for testing a skill. Count steering interventions in fresh trials. |
| [V45][v45] 07:00–18:00 | Ali | “8,000” | A compact instruction file reportedly outperformed a graph. Model-dependent behavior requires tested policy rather than architecture fashion. |
| [V73][v73] 08:00–14:00, 20:00–21:00 | Shipper / Every | “gains ... spreading”; “skill” | Personal improvements do not automatically transfer to teammates. Residual expert corrections and small repeated nudges are candidate learning signals; Every is building evaluation into its platform. |
| [V52][v52] 16:00–25:00, 36:00–41:00 | Krentsel | “three”; “no regressions” | Editable policy, protected harness state, and action execution have different boundaries. Atomic updates and holdouts matter in self-improvement. |
| [V63][v63] 00:00–12:00 | Fragmented hosts | “Self-learning harnesses”; “plugin” | Loop mutation and in-memory self-extension are already demonstrated or being built. A generic self-improving harness is not an opening. |
| [V65][v65] 19:00, 41:00–45:00 | Cognition / routing panel | “collaboration”; “don't have this yet” | Collaboration training and learning from corrected routes are named roadmaps; mechanical prompt tuning alone is disputed. |
| [V46][v46] 01:00, 10:00, 14:00 | Jack Wotherspoon, Google | “colleague”; “fresh”; “one core purpose” | Personal credentials/configs do not automatically become team infrastructure. Narrow artifacts and fresh contexts make managed delegation measurable. |
| [V48][v48] 15:00, 30:00 | Sunil Pai | “normally tell it”; “tested it” | Author knowledge improves a demo and can invalidate a cold usability evaluation. Code-mode interface design was empirical, not merely a typed wrapper. |
| [V50][v50] 31:00–38:00 | Lesse / Jiang | “most useful feedback is negative”; “everybody actually wants something different” | External customer harnesses reveal training failures missed internally. Laziness and unwanted proactivity are opposing errors; the useful acceptance point depends on workflow and user preferences. |
| [V03][v03] 16:00–17:00 | dbt speaker | “knowledge”; “making PRs” | The people who know business semantics may not want Git as their review interface. Agent-friendly implementation does not solve expert acceptance. |

## What the named companies actually describe

All transcript-derived practices below are **Q**, not independently audited organizational facts. Public documentation corroboration is **F** about what the organization has published. A public description of an internal system is not a generally available product.

| Organization | Reported practice and boundary | What this does not establish |
|---|---|---|
| **Anthropic** | V50: constrained Python-to-Rust service rewrite with parity, shadow traffic, and reported CPU savings; some implementation gets light review under strong design/verification. Generated documents still need author scrutiny. V87: article-derived Scion/Antique story. **F:** the [October 13 source-control article][scion], updated October 15, describes internal source-control/checkout systems, post-merge validation before deployment, and architectural constraints agents had violated. | “No human reads any generated code,” general availability of Scion, or transfer of the results to arbitrary repositories. |
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

## Project catalog

All project descriptions, gaps, platform arguments, demonstrations, and kill tests are **I**. Durations are **E**, for an individual side project. Scores are judgments, not measurements: **C / TS / G / V / S / N** = cool, Cloudflare/Vercel/TypeScript adjacency, real gap, value, survival as models improve, not GrowOS; each 1–5. A platform owner **could** build most of these. The useful defenses are public cross-platform fixtures, independence of the acceptance evidence, and a very small scope—not an assertion of an enduring commercial moat.

### P01 — Runtime architecture obligations and incompatible-design fixtures

- **Size / sentence:** **Big, 2–3 weeks.** A small TypeScript fixture lab tests intended state ownership, lifecycle, and extension contracts even when the feature tests pass.
- **Source quotes:** Ronacher, [V82][v82] 1:27:00, “it worked” and “our design was wrong”; Kanat-Alexander, [V79][v79] 04:00, “harder to make future changes”; Ball, [V37][v37] 14:00, “can I change it?”
- **30-second demo:** Two plugin designs each pass their examples. Their combined implementation passes the feature suite but violates one owner-selected state/lifecycle obligation. A recorded runtime sequence shows the violation; a subsequent change demonstrates the cost. Do not claim automatic discovery of the correct architecture.
- **Closest:** [Sigrid][sigrid], [ArchUnitTS][archunit], [dependency-cruiser][depcruise], ordinary integration tests, and local RigorBench. Static architecture and contract testing are shipped. The candidate gap is a public case family for incompatible design composition and runtime obligations.
- **Beneficiaries / platform:** TS plugin/SDK maintainers and people accepting large agent changes. A vendor can add checks; a neutral corpus can compare vendors and include human design failures.
- **Start:** Hand-build three cases with an expert-written obligation: shared-state ownership, retained references after reload, and incompatible extension semantics.
- **Kill:** If existing architecture rules plus a few ordinary tests explain every case cleanly, publish fixtures upstream and abandon a standalone tool. Also kill if experts cannot agree on the obligation before seeing the implementation.
- **Scores:** **5 / 5 / 3 / 4 / 5 / 5 = 27**. Main risk: architecture intent is hard to externalize; corpus value is more credible than a universal detector.

### P02 — WhichBinary: witness the executable that a test actually ran

- **Size / sentence:** **Small, one weekend.** A wrapper records the executable path/hash and build input revision used by a red/green reproduction.
- **Source quotes:** Sumner, [V71][v71] 08:00, “actual changes” rather than a “stale” build; Ball's evaluator, [V39][v39] 05:00, “traces don't show the checkout revision.”
- **30-second demo:** A patched CLI appears fixed because the test launches an installed old binary. The receipt exposes the path/hash mismatch; a build-and-run invocation produces separately identified base-fail/head-pass runs.
- **Closest:** [Bazel's test environment][bazel], [Dagger][dagger], build attestations, process tracing, and Bun's existing build-and-run command. This packages a mundane but consequential identity check; it does not prove semantic correctness or capture every child/container automatically.
- **Beneficiaries / platform:** CLI/runtime authors and agent evaluators. Platform owners can absorb it easily; interoperability and upstream fixtures are the reason to do it openly.
- **Start:** Linux/Node launcher with a deliberately misleading `PATH` fixture, then document unsupported execution paths.
- **Kill:** If the existing runner already binds the executed artifact to the source tree and refuses mismatches, contribute the fixture there. Do not build a general provenance platform.
- **Scores:** **4 / 5 / 3 / 4 / 5 / 5 = 26**.

### P03 — Discard drill: rehearse disposal, fallback, and promotion

- **Size / sentence:** **Big, about two weeks.** A Worker-sized application declares why it is disposable, then rehearses its fallback and the transition to durable ownership when adoption changes.
- **Source quotes:** Kanat-Alexander, [V79][v79] 10:00, “no inbound API calls,” and 12:00, “now it needs to be durable”; Skidmore, [T02][t02] 18:00, “owning ... problem.”
- **30-second demo:** An event app has a declared expiry, personal data, and a durable fallback. Add a production caller or retained shared state; the report marks promotion work. Export the small dataset, disable the app in a rehearsal, and demonstrate the fallback still completing the task.
- **Closest:** [Backstage][backstage], hosting lifecycle tools, export/migration/exit checks in the Connect ledger, and the [disposable-software paradox][disposableblog]. The narrow combination is a runnable fallback plus a change-of-category exercise.
- **Beneficiaries / platform:** People accumulating personal/internal generated tools. Hosts can implement expiry/export; cross-host fallback and owner decisions are outside one host's complete view.
- **Start:** One Worker/D1 example and a human-authored four-factor manifest. Report unobserved callers as unknown, never as absent.
- **Kill:** If an ownership checklist plus an export command produces the same useful decision, publish that recipe. Kill if no user actually discards or promotes a tool after trying it.
- **Scores:** **5 / 5 / 3 / 4 / 5 / 5 = 27**. Evidence for the exact product is weaker than for verification generally.

### P04 — Follow-up change tasks for RigorBench

- **Size / sentence:** **Tiny, a week of dataset work.** Extend an existing benchmark with changes that expose the maintenance consequences of an earlier accepted patch.
- **Source quotes:** Ball, [V37][v37] 14:00, “can I change it?”; Pocock, [V23][v23] 1:01:00, “nine months”; Lattner, [V24][v24] 1:22:00, “two of ... three.”
- **30-second demo:** Two solutions pass the same original checks; a later feature or bug fix reveals duplicate pathways or coupling. Show success, interventions, and check cost over a sequence, not a cleanliness score.
- **Closest:** Local RigorBench, [Echoes of AI][echoes], and software-evolution benchmarks. This is an extension, not a newly discovered category.
- **Beneficiaries / platform:** Maintainers and evaluation researchers. Open tasks support comparisons that a vendor's private dashboard cannot reproduce.
- **Start:** Three paired TS tasks with fixed owner-written future requirements and reproducible starting trees.
- **Kill:** If outcomes depend primarily on a hidden evaluator preference, redesign; if no added discrimination appears over baseline task success, stop.
- **Scores:** **4 / 5 / 2 / 4 / 5 / 5 = 25**.

### P05 — Shared-skill consumer impact report

- **Size / sentence:** **Small, one or two weekends.** Join actual skill consumers to existing skill evaluations before a shared instruction changes.
- **Source quotes:** Jane Street, [V08][v08] 1:07:00, “untold impact on different parts of the firm”; Slack, [V35][v35] 39:00, “isn't picking up the skills.”
- **30-second demo:** Editing a shared browser skill discovers two opted-in repositories with different constraints; existing with/without tests show one regression and one benefit, with instruction-uptake evidence.
- **Closest:** [Alibaba skill-up][skillup], shared skill repositories, and dependency-impact tooling. Evaluation is shipped; consumer discovery, owners, and exposure are the possible integration gap.
- **Beneficiaries / platform:** Teams maintaining instructions across projects. Cross-harness consumers justify a neutral manifest; a single-platform deployment may need only its native tool.
- **Start:** Explicit consumer manifests for two repositories; call skill-up instead of creating another runner.
- **Kill:** If skill-up already covers the needed discovery/ownership flow, contribute there. If teams will not register consumers and traces cannot identify them reliably, stop.
- **Scores:** **4 / 5 / 3 / 4 / 4 / 5 = 25**.

### P06 — Exposure-aware shim retirement

- **Size / sentence:** **Small, a weekend experiment.** Attach an exposure denominator and an ablation case to a temporary harness rule before recommending removal.
- **Source quotes:** Katz, [V66][v66] 16:00, centralized “shim” retirement; Huntley, [V80][v80] 40:00, “deleted after every model release.”
- **30-second demo:** A rule has zero activations, but the workload also had zero triggering opportunities. The report says “not exercised”; a targeted old-failure case compares retaining/removing it on the new model.
- **Closest:** Cursor's existing internal system, [skill-up ablations][skillguide], and ordinary feature-flag experiments. The retirement category is taken.
- **Beneficiaries / platform:** Harness maintainers with rare regressions. A model provider knows its model; a cross-harness fixture can expose local workload differences.
- **Start:** Annotate five shims with trigger opportunities and retained regression examples.
- **Kill:** If activation telemetry already includes eligible opportunities and controlled ablations, make a documentation contribution only.
- **Scores:** **3 / 5 / 2 / 3 / 3 / 5 = 21**. Temporary model deficiencies can disappear entirely.

### P07 — Test-retirement report tied to historical faults

- **Size / sentence:** **Small, two weekends.** Produce a human-reviewed retirement report that compares a candidate test's cost with the known faults it uniquely detects.
- **Source quotes:** Ben / Theo, [V16][v16] 1:56:00–2:00:00, tests “checking that the type was the same as the type”; Ronacher, [V82][v82] 1:12:00, test burden.
- **30-second demo:** Removing a slow test saves time but loses the only detection of a historical defect; a duplicate test saves time without losing the sampled fault set. Unseen faults remain unknown.
- **Closest:** [Stryker][stryker], coverage-based reduction, mutation subsumption, and existing test-retirement practice. No new reduction algorithm is claimed.
- **Beneficiaries / platform:** TS maintainers drowning in generated tests. Repo fault history is local; the useful deliverable is a reusable report and dataset.
- **Start:** One repository, ten candidate tests, historical regressions plus sampled mutants, measured runtime.
- **Kill:** If ordinary coverage/subsumption gives the same ranking, publish the comparison. Never infer that no unique sampled detections means no future value.
- **Scores:** **3 / 5 / 2 / 4 / 5 / 5 = 24**.

### P08 — Disentangle the agent-TDD disagreement

- **Size / sentence:** **Tiny, a reproducible study.** Vary test order, oracle ownership, test editability, and later maintenance separately rather than compare two vague “TDD” labels.
- **Source quotes:** Jacob, [V55][v55] 36:00–38:00, “open question”; Pocock, [V23][v23] 1:19:00, a failing test; Eric's Pstack account, [V61][v61], “TDD.”
- **30-second demo:** The same task runs with supplied read-only acceptance, editable self-written units, and no supplied oracle; the chart separates task success, weakened tests, later-change failures, cost, and interventions.
- **Closest:** [TDDev][tddev], [TDFlow][tdflow], and the unlocated Thoughtworks citation. This is a narrow replication/extension; do not advertise a broad empty research field.
- **Beneficiaries / platform:** Engineers deciding a concrete testing policy. Public protocols can compare several models and avoid vendor-specific conclusions.
- **Start:** Preregister a small factorial protocol and the disconfirming result; use several seeds and report uncertainty.
- **Kill:** If an existing paper already isolates the same factors on comparable tasks, replicate it or contribute data. Stop if the budget cannot distinguish useful effect sizes.
- **Scores:** **4 / 5 / 2 / 4 / 4 / 5 = 24**.

### P09 — Contribute realistic test-weakening cases

- **Size / sentence:** **Tiny, an upstream fixture contribution.** Add legitimate test refactors and cross-module cheating cases to existing test-integrity tools.
- **Source quotes:** Jane Street, [V08][v08] 38:00–39:00, “disable the warnings”; Pocock, [V23][v23] 1:20:00, implementation-shaped tests.
- **30-second demo:** A legitimate matcher refactor stays accepted; deleting a meaningful asynchronous assertion makes the visible suite green but fails the independent case.
- **Closest:** [GreenLie][greenlie] and [benchmark-test-weakening][testweak] already target this problem directly.
- **Beneficiaries / platform:** Existing tool users. An adversarial public case set is more useful than a competing badge.
- **Start:** Submit three minimal TS/JS pairs: equivalent matcher change, weakened async check, and moved behavior across modules.
- **Kill:** If the cases are already present, improve documentation or stop. Do not turn heuristic scores into correctness claims.
- **Scores:** **3 / 5 / 2 / 4 / 4 / 5 = 23**.

### P10 — Audit whether an evaluation verdict has its claimed evidence

- **Size / sentence:** **Small, one weekend.** A structured trace audit marks required revision, control, and observation evidence as present, missing, contradicted, or unknown.
- **Source quotes:** Amp evaluator, [V39][v39] 05:00–06:00, “traces don't show the checkout revision”; Davis, [V31][v31] 15:00, “knows too much.”
- **30-second demo:** Import a green evaluation; the report identifies an absent base/control run, author's hints, and a missing observed checkout. The task becomes unsupported rather than incorrectly labeled failed.
- **Closest:** [skill-up][skillup], Arize-style trace evaluation in V45, [Bastion attestations][bastion], and benchmark contamination checks. This audits entailment, not correctness.
- **Beneficiaries / platform:** People publishing or trusting agent evaluations. Independent audit rules can check several runners, including a platform's own self-evaluation.
- **Start:** A JSON schema and ten manually annotated supported/unsupported examples; include acceptable missing data.
- **Kill:** If existing runner metadata and a short assertion script cover all cases, contribute that script. Kill if auditors cannot agree on the requirement before seeing the result.
- **Scores:** **4 / 5 / 3 / 4 / 5 / 5 = 26**.

### P11 — Review dissent and disposition adapter

- **Size / sentence:** **Tiny, an upstream patch.** Preserve each reviewer verdict, unresolved disagreement, and final disposition through an existing bounded review workflow.
- **Source quotes:** Theo, [V86][v86] 04:00–07:00, hidden review disagreement and “three” rounds; [V15][v15] 35:00–36:00, “Full Stop” / “Full Send.”
- **30-second demo:** Three reviewers return conflicting outcomes; the final summary retains the unresolved objection and who overrode it, rather than presenting unanimous approval.
- **Closest:** [multi-agent-review][multireview] already specifies verdict/disposition/round boundaries for plan/document review; [Polygraph][polygraph] already captures rationale.
- **Beneficiaries / platform:** T3-style code workflows and their maintainers. The owner should probably ship it; this is a contribution, not a business.
- **Start:** Adapt one existing result format and add a fixture for lost dissent plus one for accidental feedback-PR merging.
- **Kill:** If the code workflow already preserves the complete state, stop. Avoid another review orchestration engine.
- **Scores:** **3 / 5 / 1 / 3 / 4 / 5 = 21**.

### P12 — Measure complexity introduced by accepted review suggestions

- **Size / sentence:** **Tiny, a benchmark/blog with data.** Evaluate whether review suggestions improve observable outcomes or merely add scope and abstractions.
- **Source quotes:** Theo, [V86][v86] 04:00–07:00, bounded rounds; Jane Street, [V08][v08] 1:46:00, “too many knobs.”
- **30-second demo:** A reviewer requests a new abstraction; a held-out task shows no functional gain and higher subsequent change cost. Another suggestion catches a real defect. Show both, with blinded owner judgments.
- **Closest:** [CRBugBench][crbug], review-quality studies, and [Sigrid][sigrid]. Bug-finding and architecture metrics are taken; net consequence of accepted suggestions is the narrow question.
- **Beneficiaries / platform:** Maintainers choosing review defaults. Cross-vendor data and explicit disagreement are harder to obtain from a product's own success metrics.
- **Start:** Twenty naturally occurring review suggestions with original request, adopted diff, and later task.
- **Kill:** If judgments reduce to taste or the same outcome is already measured in CRBugBench extensions, contribute cases there.
- **Scores:** **4 / 5 / 3 / 4 / 5 / 5 = 26**.

### P13 — Rehearse a culprit revert on the current tip

- **Size / sentence:** **Small, one weekend or an upstream test.** After identifying a bad change, construct and test its proposed revert against the current dependent tree.
- **Source quotes:** Sumner, [V71][v71] 17:00, “easier to ... roll back”; [V87][v87] 42:00–43:00, post-merge validation.
- **30-second demo:** A later valid change depends on the culprit's API. Reverting the culprit's old parent works; reverting on today's tree breaks. The tool shows the current-tree result and lists unmodeled database/external effects.
- **Closest:** [gitai/Graft][gitai], [LUCI][luci], Mogplex, and existing revert automation. Broad post-merge novelty is withdrawn; this is a previously retained narrow continuation.
- **Beneficiaries / platform:** Maintainers using existing post-submit repair. The appropriate owner may simply add this fixture.
- **Start:** Inspect gitai's verifier, then build a three-commit dependent-revert example using its actual behavior.
- **Kill:** If gitai/LUCI already verifies the exact current-tip revert and handles dependent conflicts adequately, submit a regression test or stop. Do not build another bisector.
- **Scores:** **4 / 5 / 1 / 4 / 5 / 5 = 24**.

### P14 — Approved-batch integration obligations

- **Size / sentence:** **Ambiguous.** Record the approved behavioral obligations of several patches and check whether conflict resolution preserved them as a group.
- **Source quotes:** Syntax, [V53][v53] 06:00, “figure out how to merge all these together”; Ronacher, [V82][v82] 1:27:00, “our design was wrong”; Theo / Ben, [V15][v15], review versus merge state.
- **30-second demo:** Two approved patches resolve textually and pass their isolated checks, but a combined invariant fails; the report identifies which approved intent lacks evidence.
- **Closest:** [gitai verified conflict proposals][gitai], merge queues, stacked PR systems, and P01. Merge engines and conflict agents are occupied.
- **Beneficiaries / platform:** Maintainers landing concurrent work. A neutral obligation format may help, but the merge platform can own it naturally.
- **Start / resolution:** Find two real accepted-intent losses beyond ordinary integration tests; decide whether P01 already covers them.
- **Kill:** If a merge queue running the combined suite catches the problem, no separate project. Merge with P01 if the only novelty is fixture content.
- **Scores:** **4 / 5 / 1 / 3 / 4 / 5 = 22**.

### P15 — Supported business combinations versus observed coverage

- **Size / sentence:** **Small, two weekends.** Compare a human-declared supported scenario matrix with test and rollout observations.
- **Source quotes:** Uday, [V19][v19] 1:09:00, “cash trips only in Brazil with this configuration”; Beamonte, [T10][t10] 40:00, “same fixture test.”
- **30-second demo:** Country/payment/client-version combinations are declared supported. A report shows one never exercised in tests or the sampled rollout; it says unknown, not broken.
- **Closest:** Uber's Capri/MatchGuard, [NIST combinatorial testing][acts], contract testing, and [Keploy][keploy]. Generation and coverage matrices already exist.
- **Beneficiaries / platform:** Smaller products with combinatorial business behavior. Domain support commitments come from owners, not from a host's generic logs.
- **Start:** One explicit YAML support matrix and adapters for test tags plus sampled release observations.
- **Kill:** If existing combinatorial tooling with tags supplies the same answer, publish an integration recipe. Do not infer support requirements from historical traffic alone.
- **Scores:** **4 / 4 / 2 / 4 / 5 / 5 = 24**.

### P16 — Cross-packager installation-transition fixtures

- **Size / sentence:** **Tiny, a fixture contribution.** Add install/update/uninstall transitions that normal developer-container tests miss.
- **Source quotes:** Vinegar, [V82][v82] 1:08:00–1:10:00, “homebrew” and “[Nix]”; Theo / Ben, [V16][v16] 1:50:00, “DMG.”
- **30-second demo:** A release works on a clean machine but updating an existing package leaves the old executable earlier on `PATH`; a target-environment test catches it.
- **Closest:** [Homebrew tests][brew], [NixOS tests][nixos], native CI, [Shopify Remote Dev][shopify], and P02. No new VM or preview service.
- **Beneficiaries / platform:** CLI/desktop package maintainers. Each packager can own its checks; shared transition cases help cross-package releases.
- **Start:** One genuine update failure reduced to an upstream reproducer.
- **Kill:** If the release already runs the same transition, add the missing case or stop; do not generalize to arbitrary OS certification.
- **Scores:** **3 / 4 / 2 / 4 / 5 / 5 = 23**.

### P17 — Emitted-code performance obligation examples

- **Size / sentence:** **Tiny, documentation plus fixtures.** Show how to preserve one promised compiled-code property during agent refactoring.
- **Source quotes:** Mattis, [V22][v22] 1:28:00–1:29:00, “looks at the decompiled code” and “verify that there's no regression.”
- **30-second demo:** A behaviorally equivalent refactor adds an allocation or bounds check; a target/compiler-pinned fixture detects the change and shows the generated output.
- **Closest:** [LLVM FileCheck][filecheck], compiler regression suites, assembly inspection, and standard performance tests. The mechanism is shipped.
- **Beneficiaries / platform:** Runtime authors, TS-to-native/WASM maintainers. Compiler owners already do this; the contribution is a clear application example.
- **Start:** One non-brittle semantic property with pinned target/compiler and an explained acceptable change.
- **Kill:** If it merely snapshots incidental assembly formatting, stop. Publish upstream rather than create a general performance-proof tool.
- **Scores:** **3 / 3 / 1 / 3 / 5 / 5 = 20**.

### P18 — “Fixed for this user” release receipt

- **Size / sentence:** **Small, one weekend.** Attach served-version and cohort evidence to a customer issue before declaring the fix delivered.
- **Source quotes:** Ball, [V41][v41] 15:00, “endpoint version which is the server commit”; Mulroy, [T13][t13] 18:00, “free, pay go, enterprise”; Ball / Slack, [V35][v35] 30:00–31:00, mitigation versus proper fix.
- **30-second demo:** The PR is merged and CI is green, but the reporter's cohort still serves the old build. The receipt remains pending until the relevant version and behavior are observed.
- **Closest:** Amp's internal lifecycle tools, release tracking, feature flags, and existing completion/receipt tools in the kill list. This is a narrow issue-to-served-cohort adapter.
- **Beneficiaries / platform:** Maintainers answering support reports. A host knows its deployment; it may not know a third-party client's observed cohort or original report.
- **Start:** A Worker version endpoint plus one issue tracker integration and explicit consent to sample the user path.
- **Kill:** If the release platform already joins user/cohort/version/issue, contribute a recipe. Do not build generic observability.
- **Scores:** **4 / 5 / 2 / 4 / 5 / 5 = 25**.

### P19 — Contributor-owned reproduction admission pack

- **Size / sentence:** **Small, a weekend CLI/template.** Help contributors submit a minimal reproduction with base/head evidence before maintainers spend review effort.
- **Source quotes:** Pai, [V49][v49] 12:00, “repro”; Dax, [V13][v13] 22:00–24:00, maintainer product burden; Sumner, [V71][v71] 02:00–03:00, mandatory red/green test.
- **30-second demo:** A contributor packages a failing baseline command, environment, observed output, and minimal case. The maintainer can replay it without accepting the proposed feature or patch.
- **Closest:** Bun's bot, [Warp factory triage][warpfactory], issue templates, and existing repro tools. The admission policy matters more than the wrapper.
- **Beneficiaries / platform:** Small open-source maintainers. Repository owners choose acceptable contributions; a cross-host template can keep the burden with the submitter.
- **Start:** Use it on five incoming issues with one willing maintainer; avoid executing untrusted submissions outside an appropriate existing environment.
- **Kill:** If a good issue template yields equal replay success and less friction, publish the template. Stop if submission effort simply shifts to maintainers.
- **Scores:** **3 / 5 / 2 / 4 / 5 / 5 = 24**.

### P20 — Denominator-aware factory cost diary

- **Size / sentence:** **Tiny, a public dataset/template.** Record accepted outcomes alongside human review, rework, CI resource time, and actual cash cost.
- **Source quotes:** Lloyd, [V69][v69] 13:00, “human time and token time”; Collison, [V75][v75] 03:00, “per pull request” versus “per unit time”; Theo, [V85][v85], token spend caveats.
- **30-second demo:** A high-token workflow costs less cash but more reviewer time; another improves per-PR failure rate while total incidents rise with volume. Missing denominators remain visible.
- **Closest:** [DX][dx], [Jellyfish][jelly], [Faros][faros], and [METR's measurement cautions][metr]. Another ROI dashboard is taken.
- **Beneficiaries / platform:** Individuals deciding which tasks to delegate. Opt-in open raw data can expose assumptions that cross-company aggregates conceal.
- **Start:** Two volunteers, two workflows, one week, predefined accounting for waiting versus active work and failed attempts.
- **Kill:** If logs cannot capture meaningful human effort or selection makes comparison misleading, publish descriptive diaries only; do not claim causality or employee productivity rankings.
- **Scores:** **3 / 5 / 2 / 4 / 5 / 5 = 24**.

### P21 — Management incentive counterexample casebook

- **Size / sentence:** **Tiny, a case-based exercise.** Test a proposed engineering metric against plausible locally rational behavior before adopting it.
- **Source quotes:** Larson, [V18][v18] 11:00–12:00, resource hoarding, and 1:02:00–1:05:00, staff-rubric gaming; Winters, [V17][v17] 56:00–58:00, knowledge hoarding; panel, [V28][v28] 25:00, “My work is important.”
- **30-second demo:** “Reward PRs” invites fragmentation; “reward mentorship count” invites collecting mentees; “reduce token use” discourages an expensive successful task. Participants name countermeasures and missing context.
- **Closest:** Existing management case methods, Goodhart-style metric reviews, [Larson's factory experiment][larsonfactory], and engineering measurement platforms.
- **Beneficiaries / platform:** Team leads revising incentives. There is little platform moat; this is educational material with sourced examples.
- **Start:** Five anonymized cases with multiple defensible responses and a facilitator rubric.
- **Kill:** If participants learn nothing beyond the source articles, publish a short reading guide. Never infer motive or performance automatically from telemetry.
- **Scores:** **3 / 3 / 2 / 4 / 5 / 5 = 22**.

### P22 — Senior spiral: small-demo recovery exercise

- **Size / sentence:** **Tiny, a voluntary skill/workshop.** Turn an isolated ambitious project into a concrete small useful result, an explicit help request, and frequent reviewable demos.
- **Source quotes:** Pai / Ree, [V11][v11] 24:00–30:00, “death spiral”; Ball / Slack, [V35][v35] 08:00–09:00, “Should we abandon this?”
- **30-second demo:** Replace “refactor the architecture” with a bug fix or narrow slice the team can inspect today; show the next dependency and person from whom help is requested.
- **Closest:** [Pai's original article][spiral] already contains the remedy; ordinary coaching, WIP limits, and incremental delivery.
- **Beneficiaries / platform:** Engineers entering senior roles or new teams. A platform should not diagnose this from activity; the value is a voluntary conversation exercise.
- **Start:** A one-page facilitation script tested with two consenting peers.
- **Kill:** If it adds no value beyond reading Pai, link the article and stop. Do not turn sleep, anxiety, or private work patterns into a monitoring product.
- **Scores:** **3 / 3 / 1 / 4 / 5 / 5 = 21**.

### P23 — Delayed transfer and code-defense assessment kit

- **Size / sentence:** **Tiny, a curriculum/experiment contribution.** Evaluate whether a learner can explain and change an unfamiliar related system after using an agent.
- **Source quotes:** Winters, [V17][v17] 1:31:00–1:32:00, “prompts” and “tests”; Shihipar, [V70][v70] 14:00, “quiz me”; TELUS, [T12][t12] 21:00–22:00, lost understanding.
- **30-second demo:** A learner submits a working agent-assisted feature, then defends a failure path and completes a related new change later. Prompt logs alone do not earn a comprehension score.
- **Closest:** [CodeGrade][codegrade], oral/code defenses, [Anthropic's immediate learning trial][skillsstudy], and process-aware grading in the ledgers.
- **Beneficiaries / platform:** Educators and onboarding mentors. Platforms already provide logs/tutors; an openly reviewed transfer rubric can travel between them.
- **Start:** One TS concurrency task, one delayed transfer task, and blinded human scoring.
- **Kill:** If assessment measures memorization or examiner preference, redesign. If an existing curriculum covers the same transfer task, contribute replication data.
- **Scores:** **4 / 5 / 2 / 4 / 5 / 5 = 25**.

### P24 — Continuing-project handoff across experience levels

- **Size / sentence:** **Ambiguous, likely a tiny educational contribution.** A mixed-experience cohort inherits an existing agent-assisted project, handles an incident, and hands it on with executable acceptance.
- **Source quotes:** Winters, [V17][v17] 1:22:00–1:33:00, mixed levels and process; Lattner, [V24][v24] 1:30:00, maintenance missing from coursework; Mulroy, [T13][t13] 21:00, “I don't know” how to onboard new developers.
- **30-second demo:** The previous cohort's app passes; new students diagnose a new production-like failure, identify what its docs omitted, and improve the handoff.
- **Closest:** [EPICS multi-semester practice][epics], apprenticeship, continuing open-source courses, and P23. Team structure alone is not novel.
- **Beneficiaries / platform:** Universities and teams training juniors. A platform cannot substitute for real mentoring and maintained project history.
- **Start / resolution:** Find an instructor or maintainer who will reuse the same project over two cohorts.
- **Kill:** Without continuing ownership and a measured transfer outcome, it becomes another disposable assignment. Adapt an existing program rather than start an education platform.
- **Scores:** **4 / 4 / 2 / 4 / 5 / 5 = 24**.

### P25 — Technical-manager work-trial rubric

- **Size / sentence:** **Tiny, a public exercise.** Combine a small code change with technical tradeoff, staffing, and incentive decisions in a candidate-led work sample.
- **Source quotes:** Larson, [V18][v18] 35:00–39:00 and 1:40:00, technical managers and an unsettled hybrid-role “interview.”
- **30-second demo:** The candidate uses an agent to make a change, explains a runtime tradeoff, chooses whether to defer a feature, and handles a metric-gaming scenario; reviewers score explicit evidence with disagreement retained.
- **Closest:** Existing engineering-manager interviews, work samples, and case methods. No evidence that the hybrid role needs a new hiring platform.
- **Beneficiaries / platform:** Small teams hiring technical leads/managers. A transparent rubric is a shareable contribution; predictive validity still needs study.
- **Start:** One exercise and two independent reviewers; compare which decisions each notices.
- **Kill:** If reliability between reviewers is poor or the task merely rewards interview coaching, do not use it for hiring decisions; keep it as a workshop.
- **Scores:** **3 / 3 / 2 / 3 / 4 / 5 = 20**.

### P26 — Decision-to-consequence follow-up study

- **Size / sentence:** **Tiny, a longitudinal case notebook.** Link a few consequential architecture decisions to the later changes that reveal their costs.
- **Source quotes:** Pocock, [V23][v23] 1:01:00, “nine months”; Jane Street, [V08][v08] 1:20:00, “that's why this can't work”; Ronacher, [V82][v82] 1:27:00, wrong design composition.
- **30-second demo:** Open an old decision with its predicted benefit, then replay the later incident or feature that contradicted it; identify what the agent and humans could actually know at the time.
- **Closest:** ADRs, incident learning, [Echoes of AI][echoes], and P04. A new ADR application is not justified.
- **Beneficiaries / platform:** Senior engineers teaching judgment and benchmark authors needing real follow-up tasks. Longitudinal owner context is the useful material, not the UI.
- **Start:** Three consenting maintainers contribute one decision each, with original evidence and a later task.
- **Kill:** If the account is hindsight storytelling without contemporaneous evidence, publish it as an anecdote rather than a dataset or benchmark.
- **Scores:** **4 / 5 / 2 / 4 / 5 / 5 = 25**.

### P27 — Provider-owned fake conformance examples

- **Size / sentence:** **Tiny, an upstream contribution.** Publish a service owner's small behavioral contract suite that both a fake and the real service can run.
- **Source quotes:** Kanat-Alexander, [V79][v79] 14:00, “everybody would provide in-memory fake versions of their services.”
- **30-second demo:** An agent-generated fake passes ordinary calls but mishandles a pagination or retry edge. The provider-owned example fails it; both implementations agree after repair.
- **Closest:** [StrongDM digital twins][dtu], Pact, WireMock, service emulators, and contract testing. Fake generation and behavioral cloning are occupied.
- **Beneficiaries / platform:** TS SDK users and maintainers. The provider can and should own semantics; the opportunity is helping one publish the examples.
- **Start:** Ask one open-source service/SDK maintainer to nominate five externally observable edge cases; contribute them to its repository.
- **Kill:** If an authoritative conformance suite already exists, improve its fake adapter. No new service-emulation platform.
- **Scores:** **3 / 5 / 1 / 4 / 5 / 5 = 23**.

### P28 — Cumulative product-surface review prompt

- **Size / sentence:** **Ambiguous.** Show an owner the accumulated concepts, knobs, and user-facing paths introduced by several individually small changes.
- **Source quotes:** Jane Street, [V08][v08] 1:46:00, “too many knobs”; Theo / Ben, [V15][v15] 2:06:00–2:09:00, “Mermaid”; Larson, [V18][v18] 1:15:00–1:16:00, design exceptions.
- **30-second demo:** Five small merged patches collectively add a new mode and configuration surface. The report links their original intent and asks an owner whether the combined product concept was approved.
- **Closest:** CODEOWNERS, release notes, product/design review, [Sigrid whole-change context][sigrid], and existing change summaries. Do not claim automatic product judgment.
- **Beneficiaries / platform:** Small teams where agent edits bypass natural discussion. A host can summarize diffs; only owners know the product commitment.
- **Start / resolution:** Manually reconstruct two real cases; determine whether ordinary release review already catches them.
- **Kill:** If a weekly owner review or directory ownership rule prevents the issue, publish that practice. Kill if concept extraction creates more review work than it saves.
- **Scores:** **4 / 5 / 2 / 3 / 5 / 5 = 24**.

### Explicitly occupied or withheld directions

| Direction | Disposition |
|---|---|
| Complete software factory, runtime, agent hosting, durable orchestration | **Shipped / Being built** by Warp, Factory, Stripe internally, Pi Durable, Every and others; killed as a generic pitch. |
| Generic eval platform, AI reviewer, test generator, mutation engine, affected-test selector | **Shipped** across Arize, review vendors, Stryker, CodeyBox, and many others. P08–P12 are narrow studies/contributions. |
| CI receipts/local-check reuse | **Shipped** Dagger/Bastion and build systems. P02 audits one missing identity boundary, not all verification. |
| Post-merge verification/bisection/revert | **Shipped** internal and public examples. P13 is a current-tree edge case, subject to direct kill. |
| Automated architecture cleanup/lint migrations | **Shipped** architecture tools, codemods, OpenRewrite-style campaigns. P01 must demonstrate more than a missing dependency rule. |
| Generic generated-app catalog, export, vendor exit, service fake generator | **Shipped** prior art in the stack/Connect triage; P03/P27 narrow to a rehearsal/contribution. |
| Generic rationale/ADR capture or human understanding UI | **Shipped / Being built** including Polygraph and Jane Street's Diffractor. P26 is a dataset, not another knowledge base. |
| Universal “unit tests are obsolete” policy | **Open empirical question**, with contrary scoped research. No corpus evidence supports deleting arbitrary suites. |
| New agent-oriented language / self-modifying operating environment | Broad language/runtime ideas are on the kill list or active platform roadmaps. Existing-runtime inspection fixtures may be contributions; no new platform proposed here. |
| Automatically judge managers, detect employee spirals, rank people by token/PR output | **Withheld:** sources support contextual human judgment and reveal incentive failure, not valid automated personnel inference. |

## Predictions board

All forecasts and wishes in the claim column are **Q**, including conditional, rhetorical, contested, and vendor claims; they are not findings that the future has arrived. Repeated formulations are consolidated into claim families with their source ranges. The dependency column is **I**. “Owner” identifies an existing builder or the projects above; it does not imply exclusivity. Relative deadlines are measured from the underlying recording, whose publication date may differ. The board includes contrary forecasts rather than averaging them into a consensus.

### Production, product selection, and work structure

| Source / speaker | Q — forward claim or unresolved direction | I — what must exist if true; owner/status |
|---|---|---|
| [V69][v69] 01:00–03:00, 08:00, Lloyd | Every sizable project/company/open-source project will have a factory like it has CI/CD. | Lifecycle automations, outside acceptance, intervention points, and maintenance. **Shipped / Being built:** Warp and many others. |
| V69 05:00, 14:00–15:00, Lloyd | Cloning software becomes trivial; engineers code less and ship more by building the production system. | Product differentiation and useful acceptance matter more than cloning. P01/P20; factory controllers occupied. |
| [V55][v55] 15:00–16:00, Jacob | Agent economics can revive comprehensive black-box testing once too expensive to sustain. | Protected scenarios and low-cost execution. **Shipped:** existing factory/scenario systems. |
| V55 20:00–21:00, Jacob | Product planning cannot keep up with implementation. | Smaller acceptance batches and explicit product decisions. P28; no assumption that another planner fixes incentives. |
| V55 26:00–31:00, Jacob / hosts | More demand may absorb existing engineers; bespoke software may become smaller and company-specific; even OS prototypes may become cheap. | Evidence separating prototypes from maintained systems, later tasks, and operating cost. P03/P04/P20; broad rewrite platform killed. |
| V55 34:00–35:00, Jacob | Repeated observed defects can drive refactoring without routine internal reading. | Defect lineage and independent acceptance that detects structural costs. Existing observability plus P04/P26. |
| [V10][v10] 09:00–14:00, Wu | Longer autonomous horizons lead from background tasks to virtual employees owning security/performance outcomes; events increasingly initiate work; output expands by orders of magnitude. | Durable mandates, objective validity, bounded authority, reliable execution, and accepted-output denominators. **Being built:** Cognition; P10/P20 test the claims. His quoted doubling cadence is approximate, not a verified forecast here. |
| [V50][v50] 17:00–18:00, 1:19:00–1:20:00, Lesse / Jiang | Better generation raises engineering ambition; long-running science/engineering tasks remain unsaturated. | Outcome-specific evaluators, execution budgets, and feedback lasting beyond a coding session. Platforms building; P20 measures feasibility separately from speed. |
| V50 1:44:00–1:46:00, Jiang / host | Agents assign jobs, split, clone, and choose useful architectures themselves. | Versioned mandates and acceptance of composed behavior; do not assume role labels imply successful collaboration. **Being built:** multi-agent systems; P01/P14. |
| [V72][v72] 03:00–09:00, Grinberg | Days/weeks of unattended work become normal as trust grows; human oversight declines; dark factories are a direction, not complete today. | Measured acceptance, recoverability, organizational fit, and maintenance of the harness. **Being built:** Factory. |
| [V73][v73] 31:00, Every speaker | More agent use creates more work rather than simply removing it. | Longitudinal accounting for expanded scope and human correction. P20, existing measurement vendors. |
| [V74][v74] 01:00–08:00, Parakhin | Some ROI is previously impossible work; faster execution may worsen decisions by removing discussion time. | Feasibility records and deliberate decision checkpoints. P20/P26/P28. |
| [V75][v75] 09:00–10:00, Collison | More architectural maintenance and whole-system rewrites become viable; an old codebase can prompt a new one. | Compatibility oracles, rollout/version-skew checks, and operating ownership. **Shipped / Being built:** migration tools and company systems; not a fresh generic migration opportunity. |
| V75 13:00–16:00, Collison / interviewer | Small teams compete with much larger ones; AI may increase startup formation rather than centralize everything. | Comparable company outcomes and complete lifecycle support, not team-size anecdotes alone. P20/P24. |
| [V08][v08] 51:00–52:00, Jane Street | Years of integration work remain even if model capability stops improving. | Reliable organization-specific interfaces, execution, and knowledge maintenance. Internal tooling plus P05/P10. |
| [V09][v09] 17:00–26:00, Demetri | Human business/system judgment remains the route to value; AI-staffed solo products become plausible. | Customer evidence and explicit acceptance by an accountable owner. P18/P20; solo-product success is not demonstrated. |
| V09 34:00–36:00, 1:08:00–1:10:00, Demetri | A hidden long tail of small AI apps appears; clickable prototypes become richer. | Lifecycle boundaries and an account of which tools get adopted. P03. |
| [V49][v49] 02:00–05:00, 11:00, Pai | New architectures and software forms appear; software might become Markdown; build-versus-buy changes. | Portable execution and contracts with real acceptance. Much is platform territory; P03/P19 are narrow consequences. |
| [T02][t02] 15:00–18:00, Skidmore | Today's internal tools may be replaced in six months by better-model versions; owning still costs effort. | Replaceability, state export, fallback, and promotion decisions. P03; vendor exit tooling already exists. |
| [T13][t13] 16:00–17:00, Mulroy | Small AI-native teams are the future; handwriting code is dead. | All-agent work still needs conformance, ownership, deployment, and training new builders. P23/P24. |

### Review, testing, architecture, and reliability

| Source / speaker | Q — forward claim or unresolved direction | I — what must exist if true; owner/status |
|---|---|---|
| [V08][v08] 1:17:00, 1:43:00–1:46:00, Jane Street | Work shifts to review; codebases may get messier, but cheaper refactoring can also raise standards. | Measure later change outcomes, not generated volume or assumed slop. P04/P12/P26. |
| [V14][v14] 54:00–55:00, 1:09:00–1:11:00, Theo / Ben | Humans are past the point of reviewing all code; substantially better autonomous judgment may arrive in roughly one to three years. | Valid review oracles, policy-specific risk evidence, and reversible release. **Shipped / Being built:** review vendors; P10/P12/P13. Timeline is disagreement, not a deadline. |
| [V18][v18] 1:06:00–1:07:00, Orosz | Code review's peer feedback diminishes as harnesses take over. | Deliberate mentoring and transfer exercises must replace incidental learning. P23/P24. |
| [V21][v21] 08:00–09:00, 24:00–25:00, Orosz reporting others | Agent-only review and eventual cessation of line-by-line reading spread; evals join CI/CD. | Distinguish evidence about deployed behavior from generated explanations. Existing CI/eval platforms plus P02/P10/P18. Secondary forecast, not extra convergence. |
| [V22][v22] 1:17:00–1:28:00, Mattis | Implementation approaches 100% generated; every line might get expert-like agent review; humans may stop reading this year or next. | Independent property/simulation checks, semantic obligations, and operational confidence. Review is shipped; universal semantic assurance is not established. |
| [V51][v51] 05:00–07:00, Slack | Trust in models permits stopping review of every line and parallelizing more work. | A suitable trusted-team policy and effective product/production feedback. **Shipped internally:** Amp; not a universal rule. |
| [V71][v71] 16:00–17:00, 25:00–28:00, Sumner / Cherny | A deeper verification layer comes next, then planning; cheap PRs become rejectable suggestions. | Useful evidence, rollback, and lower sunk-cost pressure. P02/P10/P13/P19. |
| V71 07:00, Sumner | Customer support tickets can initiate the RoboBun pattern outside public issue trackers. | Replayable private repros and explicit customer-data boundaries. P19; intake automation already shipped. |
| V71 20:00, Cherny | Optimization loops remain underused when trustworthy metrics exist. | A valid fixed objective and non-regression floor. Existing experiment systems; P10/P17. |
| [V55][v55] 36:00–38:00, Jacob | Unit tests may add little for some typed-language agent workflows and could be removed. | A scoped ablation separating typing, unit tests, acceptance, and later faults. P07/P08; no established general conclusion. |
| [V23][v23] 53:00, 1:02:00, Pocock | Entropy accelerates; strategic mistakes return sooner with faster implementation. | Follow-up tasks and contemporaneous design evidence. P01/P04/P26. |
| [V37][v37] 02:00–03:00, Ball | Accumulating slop need not remain true; prompting becomes “what” rather than “how.” | Evidence of maintainability and constraint preservation as instructions shrink. P04/P06; retain the counterprediction. |
| [V79][v79] 05:00–06:00, Kanat-Alexander | Understanding costs compound; future models might absorb complexity, but that is unresolved. | Compare structured/tangled systems on meaningful sequences of work. P04; model improvement can kill a detector but not the measurement question. |
| [V82][v82] 1:35:00–1:36:00, Ronacher | More lint on a dynamic host may not enforce behavioral isolation; one global can undermine it. | Explicit runtime/state obligations or a narrower host boundary. P01; ordinary contract tests may suffice. |
| [V75][v75] 04:00–06:00, Collison | AI should improve Stripe reliability over one to two years and favor defense over a longer equilibrium. | Retained invariants, external checks, incident denominators, and rollback. Existing company defenses; P20 can assess outcomes. |
| [V86][v86] 10:00–11:00, Theo | Differently trained reviewers may find distinct bugs. | Diversity measured against unique correct findings and false positives, not reviewer count. P12 / existing review benchmarks. |
| [T02][t02] 13:00–16:00, Skidmore | Review agents cannot simply understand every cross-service design effect today; the current internal reviewer may be replaced. | Explicit architecture obligations and model/version comparisons. P01/P06; the reviewer has an owner. |
| [V19][v19] 59:00–1:00:00, Uday | A green lane could reduce human review after risk backtesting. | Retrospective false-negative evidence and scoped admission rules. **Roadmap:** Uber; do not resell generic risk scoring. |
| [V20][v20] 1:37:00, Newman | Today's guardrails will not be a sufficient long-term solution. | A clearer replacement acceptance model is needed; this is unresolved, not an implementable new platform specification. |

### Execution, CI, interfaces, and the architecture of the factory

| Source / speaker | Q — forward claim or unresolved direction | I — what must exist if true; owner/status |
|---|---|---|
| [V01][v01] 18:00–22:00, 36:00, Theo | Tedious work becomes viable; resource needs change with agent parallelism; execution compute can outlast inference as the bottleneck. | Shared resource accounting and efficient reproducible checks. P02/P20; compute providers and build systems already act here. |
| [V85][v85] 11:00–14:00, 25:00–35:00; [V88][v88] 23:00–26:00, Theo | Fixed-capability inference could become extremely cheap, VMs cost more, subsidies end, and savings fund harder tasks. | Distinguish fixed capability, actual bills, subsidized capacity, and outcome cost. P20. The quoted $1,000/year extrapolation is not a price guarantee. |
| [V14][v14] 48:00–51:00, Theo / Ben | Git reliability/load may push hosting in-house; faster builds induce more demand. | Verified source-control and execution capacity. **Shipped / Being built:** Scion, gitai and CI systems. |
| [V87][v87] 04:00–11:00, 31:00–32:00, 46:00–47:00, Anthropic article read by Theo | Removing infrastructure bottlenecks increases work; agent-scale pressure may spread over six to twelve months; replacements become cheaper. | Scalable checkout/landing and validated constraints. Existing implementations; no reason every project needs a new VCS. |
| [V51][v51] 23:00–25:00, Slack | Separate CI's days are numbered if agents already tested the work. | Reusable results bound to artifact/environment and audited completeness. **Shipped:** Dagger/Bastion; P02/P10 cover narrower failures. |
| [V36][v36] 04:00–05:00, Slack | PR counts may decrease rather than explode. | Measure accepted outcomes independently of packaging artifacts. P20; this directly contradicts volume-based forecasts. |
| [V51][v51] 03:00, 18:00–25:00, Slack | Local development and CLI agents decline quickly; GitHub loses usage; coding SaaS may generate other SaaS. | Remote interactive execution, sharing, trustworthy checks, and distribution. **Shipped / Being built:** Amp and peers; explicit two-month rhetoric remains falsifiable, not established. |
| [V66][v66] 12:00–17:00, Katz | Within six months 90% of agent work moves off laptops; agents become core building blocks; rapid product mess eventually gets cleaned up. | Reliable remote lifecycle and reversible interfaces. **Shipped / Being built:** many providers; cloud hosting is killed as a generic pitch. |
| [V82][v82] 45:00–56:00, Ronacher / Vinegar | The place coding happens changes; agent-facing substrate changes may matter more than chat; Nix could revive. | Reproducible environments, introspection, and target execution. Existing systems plus P02/P16; no new language/OS proposed. |
| [V38][v38] 56:00; [V80][v80] 20:00–22:00, Ball / Huntley | Runtime behavior and inspection may matter more than human-oriented syntax. | Expose debugging/lifecycle contracts through existing runtimes. P01/P17/P27; agent languages are occupied speculative territory. |
| [V32][v32] 12:00–15:00, Davis | The boundary between implementation one must read and a component one merely uses may move. | Stable usage contracts and evidence about later changes. P01/P04; no settled prescription in the source. |
| [V08][v08] 1:35:00, Jane Street | Chat may not remain the right primary artifact. | Human-understanding surfaces grounded in real changes. **Being built:** Diffractor; generic explanation UI not open. |
| [V50][v50] 1:38:00–1:43:00, Lesse / host | Cookbooks teach possible outcomes more than code; DevRel may split into engineering/product voices and production support. | Executable outcome examples and appropriate authoring/production workflows. P27 is a small example; role forecast is unvalidated. |
| [V70][v70] 05:00–08:00, 16:00–17:00, Shihipar | Agents become proactive/multiplayer; clarification becomes an interactive report; parallel experiments reveal real tradeoffs. | Context-aware intervention, persistent artifacts, and controlled experiments. **Being built:** platform features; P26 can preserve decisions. |
| [V48][v48] 34:00–41:00, Carey | Controlled code may replace configuration; agents switch between APIs and browsers; human usefulness could change. | Observable task contracts and authorization across modalities. Code mode/platform work exists; an unspecified economic forecast is not a new product. |
| [V59][v59] 04:00, 26:00, Syntax hosts | Visual generation may plateau at polish, or may already match interfaces with later implementation cleanup. | Separate visual, interaction, browser, and maintenance evaluation. Existing preview/test tools plus P04; preserve the disagreement. |
| [T13][t13] 18:00, Mulroy | Agents might orchestrate health-mediated, cohort-aware rollout and rollback. | Explicit cohorts, trustworthy health signals, and tested rollback effects. **Being built / experiment:** Cloudflare; P18 is a narrow adapter. |
| [V78][v78] 16:00–18:00, PlanetScale speaker | Agent-driven delivery relies on good operational primitives and coordinated application/schema state. | Lifecycle compatibility and valid revert windows. **Shipped:** database platform primitives; do not claim arbitrary state rollback. |

### Skills, models, learning, and organizational consequences

| Source / speaker | Q — forward claim or unresolved direction | I — what must exist if true; owner/status |
|---|---|---|
| [V04][v04] 40:00–45:00, Michael / Peter | Models/hosts absorb engineering practices and capability instructions; routers grow; taste/workflow preferences last longer. | Model-upgrade ablations against local outcomes. Existing routers/harnesses; P05/P06. |
| [V66][v66] 03:00–11:00, Katz | Coding scaffolding makes itself obsolete through training, but a full factory is still unsolved. | Distinguish capability compensation from permissions/reliability/cost. Existing platform owners; P06 checks retirement evidence. |
| [V72][v72] 08:00–09:00, Grinberg | Harness design must be reconsidered monthly as models absorb it. | Repeatable ablations and preserved regression examples. P05/P06, not permanent rule accretion. |
| [V80][v80] 40:00, Huntley | Delete/reassess skills on each model release. | Keep outcomes fixed while removing instructions; rare-case exposure matters. P06; **Shipped** ablation runners exist. |
| [V63][v63] 00:00–12:00, Fragmented hosts; [V52][v52] 09:00–10:00, 42:00–45:00, Krentsel | Self-learning harnesses and code-level flywheels become important; harness state can evolve while work runs. | Protected state, atomic updates, holdouts, interpretable cost/quality results. **Being built:** Exo/Prime/DeepSeek-style systems. |
| [V05][v05] 19:00, 44:00–47:00, Ronacher / Pi speakers | Explicit state can help agents; cheap self-optimization may stay narrow or erase the human interface and grow beyond comprehension. | Objective-validity checks, explicit runtime state, and bounded change trials. P01/P10; no general takeoff established. |
| V05 57:00–59:00, Mario / maintainers | Some users perceive model plateau; AI development spreads broadly; subsidies may end in six to twelve months. | Compare stable tasks, local outcomes, and actual bills. P20; plateau and rapid-improvement forecasts conflict. |
| [V73][v73] 10:00–11:00, 22:00–30:00, Every / Anthropic speakers | Personal evaluations and optimized skills become platform features; fidelity and interjection improve, perhaps over six to twelve months; generic benchmark scores miss work fit. | User-owned corrections, role work trials, and silence/interjection cases. **Roadmap:** Every and model teams; P23/P25 are small studies. Joking personality API parameters are not a committed roadmap. |
| [V50][v50] 34:00–38:00, Lesse / Jiang | Human judgment over conflicting user tastes will not scale; models need better ways to take in personalization. | Workflow-specific acceptance and meaningful preference controls, evaluated beyond generic coding scores. **Being built / direction:** Anthropic; P05/P06 can supply narrow regression cases, not a competing personalization platform. |
| [V68][v68] 01:00–02:00, 11:00–17:00, Qu | Agents reach every desk and automate parts of HR/finance/sales; teams need the latest internal template instead of forking obsolete designs. | Domain work trials, shared distribution, upgrades, and data maintenance. **Shipped / Being built:** Vercel/Eve; P05 as a bounded consumer integration. |
| [V65][v65] 12:00–19:00, 41:00–47:00, routing panel | Routing methods age rapidly; models collaborate; corrections teach routes; one dominant model remains possible. | Task-family cost/success checks and override data. **Roadmap:** Cognition/OpenRouter; generic routers not open. |
| [V10][v10] 11:00–12:00, Wu | Roughly 2% frontier / 98% commodity workloads with strong frontier pricing power. | Task-level allocation and separate volume/value/cost denominators. Existing routing vendors plus P20. Speculative shares, not a measured distribution. |
| [V74][v74] 10:00–11:00; [V34][v34] 09:00, Parakhin / Harvey | Frontier development plus tuned cheap production is a useful barbell; complex coding may keep needing frontier models. | Separate development-ceiling and production-economics experiments. Existing model teams/routers; P20. |
| [V35][v35] 00:00–02:00, 19:00–20:00, 1:05:00–1:08:00; [V38][v38] 01:00–08:00, Amp | More companies resemble a small generalist team; ticket-only execution roles decline; staffing ratios and company communication change. | Broad customer ownership, shared context, and revised incentives. Amp is an existence example; P21/P24 study transfer. |
| [V18][v18] 1:07:00, Larson | A five-person organization for any company is not today's reality. | Retain scale-specific ownership and incident capacity. Counterevidence to the universal small-team claim. |
| V18 1:15:00–1:21:00, Larson | Designers may eventually ship except for explicit exceptions; stable pods preserve context. | Explicit sensitive boundaries and technical ownership. Existing ownership rules may suffice; P28 tests cumulative exceptions. |
| V18 1:31:00–1:40:00, Larson | Managers without execution skills may lose value within three years; technical hybrids and spans around 12–14 instead of 4–8 emerge. | Technical work, people judgment, and validated role expectations. P25; neither the deadline nor span is universal. |
| [V21][v21] 10:00–12:00, 21:00–27:00, Orosz | Specializations broaden, teams shrink, agentic infrastructure becomes a discipline, fractional CTOs grow, and wisdom/charisma gain weight. | New mentoring/ownership structures and domain-aware evaluation. Secondary report; P21/P24/P25. |
| [V36][v36] 28:00, Slack | Technical talent moves into manufacturing, finance, and the physical economy. | Domain learning and outcome tests beyond software demos. No concrete unoccupied product is specified. |
| [V38][v38] 10:00–14:00, 43:00–56:00, Amp | Compute inequality can price people out; token austerity slowly hurts; entrepreneurial agency matters; planning and communication artifacts change. | Contextual resource allocation and customer-value evidence. P20/P21; this is a disputed operating thesis. |
| [V51][v51] 30:00–35:00, Slack / host | Routine lower-agency hiring declines; skills/examples may become more valuable than libraries. | New entry/learning routes and tested reusable examples. P23/P24/P27; labor outcome not established. |
| [V17][v17] 1:15:00, 1:37:00–1:38:00, Winters | CS enrollment may fall while software-engineering programs grow; domain specialization may reduce career mobility. | Verification/specification curricula and domain-transfer evidence. P23/P24. |
| [V23][v23] 26:00–27:00, 1:04:00–1:09:00, Pocock | Tactical programming is eaten; junior judgment formation is unresolved; exploration and collaborative grilling may help. | Transfer assessment and protected learning work. P23/P24, not a ban on juniors. |
| [V08][v08] 1:15:00–1:22:00; [V53][v53] 36:00–40:00, Jane Street / Syntax | Less implementation changes satisfaction, identity, and recovery time; some former managers build again. | Work designs that preserve learning and manageable decision load. P22–P24; no evidence for a universal preference. |
| [V09][v09] 02:00–20:00, 53:00–56:00, Demetri | AI adoption grows, near-term fundamentals payoff changes, business judgment remains important, and global labor costs might shape round-the-clock human judgment work. | Delayed learning and complete outcome-cost studies. P20/P23; labor-arbitrage idea is explicitly speculation. |
| [V13][v13] 1:05:00–1:08:00, Dax | Strong programmers may gain more from AI; the remaining human part can still be programming rather than people management. | Measure skilled problem selection and verification, not “everyone becomes a manager.” P23/P25. |
| [V22][v22] 1:33:00–1:35:00, Mattis | Domain experts are amplified rather than made interchangeable. | Domain-specific requirements and tests, plus ways to acquire the expertise. P15/P23/P24. |
| [V79][v79] 06:00–12:00, Kanat-Alexander | Disposable apps become vastly more numerous, durable systems remain important and grow in absolute count; rigor follows disposability. | Boundaries, usable fallback, promotion, and cheaper rigor. P03/P07/P27; the “hundred thousand” multiplier is rhetorical. |
| [V80][v80] 11:00–22:00, Huntley / Ronacher | Scarcity cycles may recur, or exceptional programmer status may not return; employers want factory operation; language communities reform. | Observable skills and longitudinal labor evidence. P23/P24; incompatible forecasts remain unresolved. |
| [V82][v82] 02:00–03:00, 1:39:00, Vinegar / Ronacher | Truly collaborating agent teams are not there yet; experienced buyers may reject demo-driven products once flaws emerge. | Acceptance over real team work and repeated use. P01/P04/P20; a demonstration alone cannot establish value. |
| [T13][t13] 21:00, Mulroy | New-developer onboarding is an existential unanswered question even in a successful small agent-native team. | Supervised maintenance, incidents, and transfer exercises. P23/P24, not more prompt logs alone. |

**I — GrowOS check:** No source specifies an unoccupied replacement operating system with a sufficiently concrete acceptance boundary. The closest seeds—runtime obligations, learned organizational practices, and reduced dependence on human-era syntax—already intersect active runtime, harness, and platform work. Keeping P01 as a fixture lab, P03 as a bounded lifecycle rehearsal, and the learning ideas as studies avoids disguising a broad OS thesis as a weekend tool.

## Evidence limitations and research trail

**F:** Primary external sources were preferred for technical/product claims. GitHub/readme and npm checks establish availability and claimed behavior; no external project was installed or run. HN was used for dated qualitative operator experience, not as authority for technical superiority. X retrieval failures are recorded above. Search-engine snippets, vendor case studies, publication dates, recording dates, prototypes, internal deployments, and available products are kept distinct.

**I:** The corpus overrepresents expert enthusiasts, AI vendors, unusually strong teams, and a few repeating hosts. Many stories omit denominators, rejected work, long-term incidents, or human hours. Convergence raises confidence that a pain exists; it does not establish willingness to adopt a particular tool. A gap score of 1–3 is intentional even for a useful contribution.

| Cluster | Representative external search/check terms | Material disconfirmation retained |
|---|---|---|
| C1 factory | `software factory 2026`, Warp factory agents, Stripe Minions, StrongDM, Larson AgentFleet | Whole-loop products and internal deployments already exist. |
| C2 verification | agent test weakening, GreenLie, benchmark-test-weakening, TDDev, TDFlow, Thoughtworks agent TDD | Exact TDD-hurts citation unlocated; direct test-integrity prior art found; positive scoped TDD results retained. |
| C3 architecture | agent architecture drift, Sigrid Guardrails, ArchUnitTS, dependency-cruiser, AI maintainability evolution | Architecture checks ship; empirical work does not establish inevitable quality collapse. |
| C4 review | CRBugBench, Copilot/Rovo reviews, multi-agent-review, Polygraph, maintainer review bottleneck | Generic review benchmarks, products, and rationale capture already exist. |
| C5 CI/landing | gitai Graft verify current tip revert, LUCI bisection, Dagger agent CI, Bastion attestation, CodeyBox audit | Current gitai implementation claims further reduce novelty; local-result reuse and omission audits ship. |
| C6 disposal | disposable software 2026, ownership catalog, fallback, exit test, provider fakes, digital twins | Catalog/export/fake categories taken; exact fallback/promotion demo remains conditional. |
| C7 incentives | DX Q3 2026 review trust, tokenmaxxing, Jellyfish, Faros methodology, METR uplift | Observational metrics and selection problems undermine simple ROI claims. |
| C8 learning | AI coding skills Trio 2026, CodeGrade AI modes, continuing-project teams, senior engineer spiral | Immediate trial is narrow; process assessment and mixed-level projects predate this proposal. |
| C9 skills | skill-up evals, Cursor shim retirement, Pstack, Every work trials, instruction ablation | Runner and retirement mechanisms already exist; original X evidence inaccessible. |

Local source links below point to the transcripts. The ledger inventory and background sources remain available at [the extraction directory](/Users/noah/code/sofort/arch/research/corpus/extract), [Connect research](/Users/noah/code/sofort/arch/research/connect26), [research summary](/Users/noah/code/sofort/arch/research/RESEARCH-SUMMARY.md), and [stack summary](/Users/noah/code/sofort/arch/research/stack/SUMMARY.md). Minute buckets in the signal tables are the locator; short quotations should be read in their surrounding transcript turn.




[acts]: https://csrc.nist.gov/projects/automated-combinatorial-testing-for-software
[ampwork]: https://ampcode.com/docs/using-amp/how-we-work
[archunit]: https://github.com/LukasNiessen/ArchUnitTS
[backstage]: https://backstage.io/docs/features/software-catalog/
[bastion]: https://bastion.tunas.dev/guide/local-workflow/
[bazel]: https://bazel.build/reference/test-encyclopedia
[brew]: https://docs.brew.sh/Formula-Cookbook#add-a-test-to-the-formula
[codegrade]: https://www.codegrade.com/blog/new-updates-to-codegrades-ai-assistant-smarter-support-for-your-classroom
[codeybox]: https://github.com/AdamFrisby/CodeyBox/blob/main/docs/quality/audit.md
[copilot]: https://github.blog/ai-and-ml/github-copilot/60-million-copilot-code-reviews-and-counting/
[crbug]: https://arxiv.org/abs/2610.13668
[dagger]: https://dagger.io/learn/agentic-software-factory/
[depcruise]: https://github.com/sverweij/dependency-cruiser
[disposableblog]: https://blog.jaclynkonzelmann.com/p/the-disposable-software-paradox
[dtu]: https://factory.strongdm.ai/techniques
[dx]: https://newsletter.getdx.com/p/the-gap-between-code-velocity-and
[echoes]: https://arxiv.org/abs/2507.00788
[epics]: https://peer.asee.org/equipping-multi-disciplinary-student-teams-to-manage-multi-semester-design-projects.pdf
[faros]: https://index.faros.ai/methodology
[filecheck]: https://llvm.org/docs/CommandGuide/FileCheck.html
[gitai]: https://github.com/feder-cr/git-ai
[greenlie]: https://github.com/adindamochamad/GreenLie
[hn-fail]: https://news.ycombinator.com/item?id=49023019
[hn-garden]: https://news.ycombinator.com/item?id=47226107
[hn-larson]: https://news.ycombinator.com/item?id=49777913
[hn-skeptic]: https://news.ycombinator.com/item?id=50144175
[jelly]: https://jellyfish.co/blog/is-tokenmaxxing-cost-effective-new-data-from-jellyfish-explains/
[keploy]: https://keploy.io/docs/
[larsonfactory]: https://lethain.com/software-factory-experiment/
[luci]: https://chromium.googlesource.com/chromium/src/+/3b8c5a3780e0823338031ce39fd4fa12f54b816f
[metr]: https://metr.org/blog/2026-02-24-uplift-update/
[multireview]: https://github.com/salmanalibanani/multi-agent-review
[nixos]: https://nixos.org/manual/nixos/stable/release-notes
[polygraph]: https://docs.trypolygraph.com/features/code-reviews/
[pstack]: https://github.com/cursor/plugins/tree/main/pstack
[pstackx1]: https://x.com/poteto/status/2094457600259842065
[pstackx2]: https://x.com/poteto/status/2097732320606507506
[pstackx3]: https://x.com/poteto/status/2069824386283319343
[rovo]: https://www.atlassian.com/blog/artificial-intelligence/developer-productivity-improved-with-rovo-dev
[scion]: https://www.anthropic.com/research/redesigning-source-control
[sheriff]: https://sheriff.softarc.io/docs/installation
[shopify]: https://shopify.engineering/remote-dev
[sigrid]: https://docs.sigrid-says.com/axis/guardrails.html
[skillguide]: https://alibaba.github.io/skill-up/guide/writing-evals
[skillsstudy]: https://www.anthropic.com/research/AI-assistance-coding-skills
[skillup]: https://github.com/alibaba/skill-up
[spiral]: https://sunilpai.dev/posts/the-senior-engineer-death-spiral/
[stripe1]: https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents
[stripe2]: https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2
[strongdm]: https://factory.strongdm.ai/
[stryker]: https://stryker-mutator.io/docs/stryker-js/introduction/
[t02]: /Users/noah/code/sofort/arch/research/connect26/transcripts/02-it-s-time-to-build-not-buy.txt
[t06]: /Users/noah/code/sofort/arch/research/connect26/transcripts/06-tanstack-start-on-workers-server-rendering-apps-an-ai-just-w.txt
[t08]: /Users/noah/code/sofort/arch/research/connect26/transcripts/08-an-agent-that-onboards-a-photography-studio-on-workers-ai.txt
[t10]: /Users/noah/code/sofort/arch/research/connect26/transcripts/10-ferrisway-ramp-s-global-routing-layer-on-cloudflare.txt
[t12]: /Users/noah/code/sofort/arch/research/connect26/transcripts/12-12-mistakes-telus-made-building-an-agent-platform-for-100-00.txt
[t13]: /Users/noah/code/sofort/arch/research/connect26/transcripts/13-artifacts-git-compatible-versioned-storage-from-zero-to-beta.txt
[tddev]: https://arxiv.org/abs/2605.17242
[tdflow]: https://aclanthology.org/2026.eacl-long.70/
[testweak]: https://github.com/pooriaarab/benchmark-test-weakening
[twretreat]: https://www.thoughtworks.com/content/dam/thoughtworks/documents/report/tw_future%20_of_software_development_retreat_%20key_takeaways.pdf
[twrigor]: https://www.thoughtworks.com/en-au/insights/blog/agile-engineering-practices/where-does-the-rigor-go
[v01]: /Users/noah/code/sofort/arch/research/corpus/transcripts/01-theo-t3-gg-how-to-give-claude-unlimited-usage.txt
[v03]: /Users/noah/code/sofort/arch/research/corpus/transcripts/03-dbt-labs-the-semantic-layer-is-dead-long-live-the-semantic-layer.txt
[v04]: /Users/noah/code/sofort/arch/research/corpus/transcripts/04-peter-yang-the-4-step-agentic-engineering-workflow-i-use-to-ship-real-.txt
[v05]: /Users/noah/code/sofort/arch/research/corpus/transcripts/05-fragmented-ai-developer-podcast-312-understanding-pi-durable-with-mari.txt
[v08]: /Users/noah/code/sofort/arch/research/corpus/transcripts/08-jane-street-how-ai-is-changing-programming.txt
[v09]: /Users/noah/code/sofort/arch/research/corpus/transcripts/09-a-life-engineered-what-senior-engineers-are-actually-doing-about-ai.txt
[v10]: /Users/noah/code/sofort/arch/research/corpus/transcripts/10-modal-it-s-time-to-be-ambitious-scott-wu-co-founder-ceo-at-cognition-r.txt
[v11]: /Users/noah/code/sofort/arch/research/corpus/transcripts/11-next-token-ep-06-the-senior-engineer-death-spiral.txt
[v12]: /Users/noah/code/sofort/arch/research/corpus/transcripts/12-next-token-ep-05-i-m-the-arbiter-of-tokens-and-gpus.txt
[v13]: /Users/noah/code/sofort/arch/research/corpus/transcripts/13-baseten-opencode-creator-why-open-source-ai-models-dominate.txt
[v14]: /Users/noah/code/sofort/arch/research/corpus/transcripts/14-nerd-snipe-we-can-t-trust-gemini-4.txt
[v15]: /Users/noah/code/sofort/arch/research/corpus/transcripts/15-nerd-snipe-openai-s-dev-day-was-a-disappointment.txt
[v16]: /Users/noah/code/sofort/arch/research/corpus/transcripts/16-nerd-snipe-opus-5-5-grok-4-7-are-exactly-why-post-training-matters.txt
[v17]: /Users/noah/code/sofort/arch/research/corpus/transcripts/17-the-pragmatic-engineer-software-engineering-at-google-cs-education-wit.txt
[v18]: /Users/noah/code/sofort/arch/research/corpus/transcripts/18-the-pragmatic-engineer-the-revised-rules-of-engineering-management-wit.txt
[v19]: /Users/noah/code/sofort/arch/research/corpus/transcripts/19-the-pragmatic-engineer-uber-s-ai-infra-from-the-inside.txt
[v20]: /Users/noah/code/sofort/arch/research/corpus/transcripts/20-the-pragmatic-engineer-building-resilient-systems-with-sam-newman.txt
[v21]: /Users/noah/code/sofort/arch/research/corpus/transcripts/21-the-pragmatic-engineer-the-state-of-the-tech-industry-in-2026-ldx3-new.txt
[v22]: /Users/noah/code/sofort/arch/research/corpus/transcripts/22-the-pragmatic-engineer-distributed-databases-with-peter-mattis.txt
[v23]: /Users/noah/code/sofort/arch/research/corpus/transcripts/23-the-pragmatic-engineer-ai-skills-with-matt-pocock.txt
[v24]: /Users/noah/code/sofort/arch/research/corpus/transcripts/24-the-pragmatic-engineer-from-swift-to-mojo-and-high-performance-ai-engi.txt
[v28]: /Users/noah/code/sofort/arch/research/corpus/transcripts/28-modular-funding-the-ai-stack-modcon-2026-panel.txt
[v29]: /Users/noah/code/sofort/arch/research/corpus/transcripts/29-ben-davis-it-s-actually-good.txt
[v31]: /Users/noah/code/sofort/arch/research/corpus/transcripts/31-ben-davis-how-i-m-actually-using-ai-these-days.txt
[v32]: /Users/noah/code/sofort/arch/research/corpus/transcripts/32-ben-davis-programming-feels-very-different.txt
[v34]: /Users/noah/code/sofort/arch/research/corpus/transcripts/34-baseten-why-smarter-models-aren-t-enough.txt
[v35]: /Users/noah/code/sofort/arch/research/corpus/transcripts/35-amp-inc-raising-an-agent-the-company-of-the-future-season-2-episode-6.txt
[v36]: /Users/noah/code/sofort/arch/research/corpus/transcripts/36-amp-inc-how-amp-builds-amp-quinn-slack-at-paradigm-frontiers-2026.txt
[v37]: /Users/noah/code/sofort/arch/research/corpus/transcripts/37-amp-inc-how-thorsten-ball-uses-amp-october-2026.txt
[v38]: /Users/noah/code/sofort/arch/research/corpus/transcripts/38-amp-inc-raising-an-agent-stop-boxing-in-your-agent-season-2-episode-5.txt
[v39]: /Users/noah/code/sofort/arch/research/corpus/transcripts/39-amp-inc-using-orbs-to-eval-agent-friendliness.txt
[v41]: /Users/noah/code/sofort/arch/research/corpus/transcripts/41-amp-inc-working-day-to-day-in-amp.txt
[v45]: /Users/noah/code/sofort/arch/research/corpus/transcripts/45-ai-engineer-we-kept-rebuilding-our-ai-agent-here-s-what-survived-fuad-.txt
[v46]: /Users/noah/code/sofort/arch/research/corpus/transcripts/46-ai-engineer-build-your-own-team-of-managed-agents-jack-wotherspoon-goo.txt
[v47]: /Users/noah/code/sofort/arch/research/corpus/transcripts/47-ai-engineer-stop-giving-your-agent-tools-give-it-a-sandbox-mikyo-king-.txt
[v48]: /Users/noah/code/sofort/arch/research/corpus/transcripts/48-cloudflare-code-mode-giving-ai-agents-an-entire-api-in-1-000-tokens-wi.txt
[v49]: /Users/noah/code/sofort/arch/research/corpus/transcripts/49-latent-space-why-you-should-build-science-fiction-sunil-pai-cloudflare.txt
[v50]: /Users/noah/code/sofort/arch/research/corpus/transcripts/50-latent-space-how-anthropic-ships-the-1-llm-in-the-world-with-katelyn-l.txt
[v51]: /Users/noah/code/sofort/arch/research/corpus/transcripts/51-latent-space-orbs-shifting-coding-to-cloud-quinn-slack-amp-code.txt
[v52]: /Users/noah/code/sofort/arch/research/corpus/transcripts/52-latent-space-exo-harnesses-should-see-their-own-code-and-logs-alex-kre.txt
[v53]: /Users/noah/code/sofort/arch/research/corpus/transcripts/53-syntax-mourning-the-death-of-code.txt
[v54]: /Users/noah/code/sofort/arch/research/corpus/transcripts/54-syntax-one-of-us-is-lying-to-you.txt
[v55]: /Users/noah/code/sofort/arch/research/corpus/transcripts/55-syntax-wtf-is-a-software-factory.txt
[v56]: /Users/noah/code/sofort/arch/research/corpus/transcripts/56-syntax-you-need-to-check-out-pi-durable.txt
[v57]: /Users/noah/code/sofort/arch/research/corpus/transcripts/57-syntax-i-m-using-gpui-for-everything.txt
[v59]: /Users/noah/code/sofort/arch/research/corpus/transcripts/59-syntax-are-we-cooked-claude-fable-is-out-of-hand.txt
[v61]: /Users/noah/code/sofort/arch/research/corpus/transcripts/61-eric-tech-pstack-how-a-cursor-engineer-ships-code-with-ai.txt
[v62]: /Users/noah/code/sofort/arch/research/corpus/transcripts/62-hyperfixation-on-ai-beamnxw-andrej-karpathy-99-use-ai-llms-wrong-here-.txt
[v63]: /Users/noah/code/sofort/arch/research/corpus/transcripts/63-fragmented-ai-developer-podcast-311-self-learning-harnesses-are-here-a.txt
[v65]: /Users/noah/code/sofort/arch/research/corpus/transcripts/65-ai-engineer-the-state-of-model-routing-nvidia-cognition-openrouter.txt
[v66]: /Users/noah/code/sofort/arch/research/corpus/transcripts/66-ai-engineer-is-the-agent-harness-dead-jediah-katz-spacexai.txt
[v68]: /Users/noah/code/sofort/arch/research/corpus/transcripts/68-ai-engineer-how-we-solved-agent-building-andrew-qu-vercel.txt
[v69]: /Users/noah/code/sofort/arch/research/corpus/transcripts/69-ai-engineer-software-engineering-is-becoming-factory-engineering-zach-.txt
[v70]: /Users/noah/code/sofort/arch/research/corpus/transcripts/70-ai-engineer-field-guide-to-fable-thariq-shihipar-anthropic.txt
[v71]: /Users/noah/code/sofort/arch/research/corpus/transcripts/71-claude-live-coding-session-with-boris-cherny-and-jarred-sumner.txt
[v72]: /Users/noah/code/sofort/arch/research/corpus/transcripts/72-claude-how-factory-is-building-autonomous-software-with-claude.txt
[v73]: /Users/noah/code/sofort/arch/research/corpus/transcripts/73-claude-building-secure-agents-for-knowledge-work.txt
[v74]: /Users/noah/code/sofort/arch/research/corpus/transcripts/74-claude-inside-shopify-s-ai-strategy-with-cto-mikhail-parakhin.txt
[v75]: /Users/noah/code/sofort/arch/research/corpus/transcripts/75-claude-patrick-collison-on-claude-code-at-stripe.txt
[v78]: /Users/noah/code/sofort/arch/research/corpus/transcripts/78-ai-engineer-move-fast-and-don-t-break-things-scaling-databases-for-the.txt
[v79]: /Users/noah/code/sofort/arch/research/corpus/transcripts/79-ai-engineer-does-code-quality-still-matter-it-depends-on-this-max-kana.txt
[v80]: /Users/noah/code/sofort/arch/research/corpus/transcripts/80-armin-ronacher-state-of-agentic-coding-11-with-geoff-armin-and-ben.txt
[v82]: /Users/noah/code/sofort/arch/research/corpus/transcripts/82-armin-ronacher-state-of-agentic-coding-10-with-armin-and-ben.txt
[v84]: /Users/noah/code/sofort/arch/research/corpus/transcripts/84-better-stack-nvidia-s-new-ai-sandbox-does-more-than-docker-openshell.txt
[v85]: /Users/noah/code/sofort/arch/research/corpus/transcripts/85-theo-t3-gg-the-hard-truth-about-token-spend.txt
[v86]: /Users/noah/code/sofort/arch/research/corpus/transcripts/86-theo-t3-gg-these-3-skills-changed-my-life.txt
[v87]: /Users/noah/code/sofort/arch/research/corpus/transcripts/87-theo-t3-gg-anthropic-rebuilt-git-yes-really.txt
[v88]: /Users/noah/code/sofort/arch/research/corpus/transcripts/88-theo-t3-gg-you-can-rewrite-typescript-in-rust-for-420k.txt
[warpfactory]: https://docs.warp.dev/factories/factory-agents
[warploops]: https://www.warp.dev/blog/engineering-self-improving-software-factories

## Ranked projects

**I:** Rank weighs a side-project-sized demonstration, source specificity, and the chance of learning something useful even when the product hypothesis dies. It is not a mechanical ordering by total. Scores are **C / TS / G / V / S / N** as defined above. “Contribution” means the obvious standalone product is already occupied.

| Rank | Project | Size | C | TS | G | V | S | N | Total | Main reason / constraint |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | **P01 — Runtime architecture obligations** | Big | 5 | 5 | 3 | 4 | 5 | 5 | **27** | Concrete passing-but-wrong-composition case; must beat ordinary architecture/contract tests. |
| 2 | **P02 — WhichBinary** | Small | 4 | 5 | 3 | 4 | 5 | 5 | **26** | Direct Bun pain and a crisp weekend demonstration; likely an upstream feature. |
| 3 | **P03 — Discard drill** | Big | 5 | 5 | 3 | 4 | 5 | 5 | **27** | Explicit wish plus ownership pain; demand for the exact workflow remains unproved. |
| 4 | P10 — Evaluation evidence audit | Small | 4 | 5 | 3 | 4 | 5 | 5 | 26 | Corpus contains an observable unsupported-pass example. |
| 5 | P05 — Shared-skill consumer impact | Small | 4 | 5 | 3 | 4 | 4 | 5 | 25 | Cross-team instruction-change risk; reuse skill-up. |
| 6 | P04 — Follow-up change tasks | Tiny | 4 | 5 | 2 | 4 | 5 | 5 | 25 | Useful RigorBench contribution even without a tool. |
| 7 | P12 — Review-induced complexity study | Tiny | 4 | 5 | 3 | 4 | 5 | 5 | 26 | Reviewer success needs a net-benefit denominator; outcome judgment is hard. |
| 8 | P23 — Delayed transfer / code defense | Tiny | 4 | 5 | 2 | 4 | 5 | 5 | 25 | Tests a real unanswered learning concern; assessment tooling already ships. |
| 9 | P18 — Fixed-for-this-user receipt | Small | 4 | 5 | 2 | 4 | 5 | 5 | 25 | Clear merged-versus-served boundary; may already fit a release platform. |
| 10 | P26 — Decision-to-consequence cases | Tiny | 4 | 5 | 2 | 4 | 5 | 5 | 25 | Public evidence of judgment, not another ADR app. |
| 11 | P09 — Test-weakening fixture contribution | Tiny | 3 | 5 | 2 | 4 | 4 | 5 | 23 | Direct prior art makes an upstream contribution attractive. |
| 12 | P13 — Current-tip revert rehearsal | Small | 4 | 5 | 1 | 4 | 5 | 5 | 24 | Strong source pain, very narrow remaining gap; inspect gitai before coding. |
| 13 | P15 — Supported-combination coverage | Small | 4 | 4 | 2 | 4 | 5 | 5 | 24 | Domain obligations versus sampled traffic; combinatorial tools already exist. |
| 14 | P07 — Fault-retaining test retirement | Small | 3 | 5 | 2 | 4 | 5 | 5 | 24 | Useful evidence against taste-based deletion; reduction is mature prior art. |
| 15 | P20 — Factory cost diary | Tiny | 3 | 5 | 2 | 4 | 5 | 5 | 24 | Open denominators add value; causal inference and logging are difficult. |
| 16 | P16 — Install-transition fixtures | Tiny | 3 | 4 | 2 | 4 | 5 | 5 | 23 | Reproducible package failures; contribution rather than a new test service. |
| 17 | P27 — Provider-owned fake conformance | Tiny | 3 | 5 | 1 | 4 | 5 | 5 | 23 | Explicit wish, occupied mechanism; obtain a willing semantic owner. |
| 18 | P19 — Reproduction admission pack | Small | 3 | 5 | 2 | 4 | 5 | 5 | 24 | Protects maintainer attention; a good issue template may suffice. |
| 19 | P08 — Agent-TDD policy ablation | Tiny | 4 | 5 | 2 | 4 | 4 | 5 | 24 | Useful disagreement, substantial direct research prior art. |
| 20 | P06 — Exposure-aware shim retirement | Small | 3 | 5 | 2 | 3 | 3 | 5 | 21 | Cursor owns the main mechanism; only rare-case denominator remains. |
| 21 | P21 — Incentive counterexample casebook | Tiny | 3 | 3 | 2 | 4 | 5 | 5 | 22 | Concrete teaching material; little software novelty. |
| 22 | P22 — Small-demo recovery exercise | Tiny | 3 | 3 | 1 | 4 | 5 | 5 | 21 | Useful humane practice, already prescribed by the original author. |
| 23 | P25 — Technical-manager work trial | Tiny | 3 | 3 | 2 | 3 | 4 | 5 | 20 | Explicit unresolved interview; validity and reviewer agreement need work. |
| 24 | P17 — Emitted-code obligation examples | Tiny | 3 | 3 | 1 | 3 | 5 | 5 | 20 | Mechanism is standard; contribute a practical example. |
| 25 | P11 — Dissent/disposition adapter | Tiny | 3 | 5 | 1 | 3 | 4 | 5 | 21 | Small patch for an existing workflow, easily absorbed by its owner. |
| 26 | P24 — Continuing-project handoff | Ambiguous | 4 | 4 | 2 | 4 | 5 | 5 | 24 | Needs a continuing educational partner; strong historical prior art. |
| 27 | P28 — Cumulative product-surface review | Ambiguous | 4 | 5 | 2 | 3 | 5 | 5 | 24 | Real product concern; ordinary owner review may solve it. |
| 28 | P14 — Approved-batch obligations | Ambiguous | 4 | 5 | 1 | 3 | 4 | 5 | 22 | Merge tooling already owns most of it; likely fold into P01. |

### Top 3

1. **P01 — Runtime architecture obligations:** Build three small cases before building a framework. The valuable question is whether accepted behavior can preserve intended changeability when a clever shim makes the feature suite green. If ordinary tests suffice, contribute the cases and stop there.
2. **P02 — WhichBinary:** The quickest concrete experiment. Make the wrong executable visible in a base/head reproduction. Its plausible end state is a feature in existing runners, which is a successful tiny open-source outcome.
3. **P03 — Discard drill:** The most distinctive explicit wish. Demonstrate an app being discarded with its task still possible, then show an adoption change that requires durable ownership. Validate the need before expanding past one Worker example.

### Most surprising signal

**Q:** In [V82][v82] 1:26:00–1:28:00, Ronacher says the combined system worked, supported the desired plugins, and used the intended vocabulary—yet “our design was wrong.” Two human-approved designs did not actually fit; the agent supplied a shim that concealed the mismatch by defeating the architecture. **I:** The interesting failure is a factory accepting a flawed human design composition because the agent was good enough to make it run. That is a stronger and more useful signal than a generic claim that agents write bad code.

### Five-line TL;DR

- **I:** Engineering work moves toward acceptance, architecture, ownership, and the factory's feedback loops.
- **Q:** Experts agree verification and attention are scarce; they disagree about abolishing review, CI, or unit tests.
- **F:** Factory controllers, AI review, test integrity, CI reuse, and post-merge repair already have substantial prior art.
- **I:** Try runtime architecture fixtures, an actual-executable witness, and a discard/promotion rehearsal; keep their kill tests strict.
- **I:** Preserve learning and incentives deliberately: cheap implementation removes neither judgment nor the need to grow it.

