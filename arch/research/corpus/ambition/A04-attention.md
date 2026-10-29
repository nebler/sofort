# A04 — Make human judgment accumulate

Research cut: **2026-10-29**, against the ambition brief dated 2026-10-28. **Q** = corpus quotation or attributed practitioner account; **F** = inspected source/documentation; **I** = interpretation or proposal; **E** = estimate, budget, or experimental target. Quotations establish what someone said. Product documentation establishes a described implementation, not independently measured effectiveness. None of the proposed experiments has been run.

**I — ONE pick: a judgment compiler backed by an owner-governed precedent commons.** A person decides a difficult case, approves a narrow statement of when that decision may be reused, and receives future cases only when the available evidence cannot establish applicability. The ambition is an institution through which millions of agents reuse human judgments without acquiring the authority to generalize those judgments themselves. The six-week step is a single-maintainer experiment in whether this produces more accepted work per total human hour than manual review, a strong model reviewer, and retrieval of past decisions.

**I — Crucial restriction:** predicting what someone would approve is different from having their permission. Neither preference confidence nor a proof about a formal policy establishes that the policy captures what its owner meant. A compiler may check a declared region of reuse; it cannot certify that it has recognized every form of meaningful novelty.

## Evidence and scope

**F — Local material:** consulted both ambition briefs, E01–E19, the five Connect ledgers, S01–S07, the S05 prediction board, the research kill list, and the stack/Connect summaries. Used searches across the ledgers and transcript collections to select the attention, authority, changing-intent, composition, and institutional-knowledge cases; revisited the caption passages used below. This is a lens-specific investigation, not a new exhaustive extraction of every utterance. The current transcript directories contain 152 corpus files plus 13 Connect files. S05's 1,917-row board describes the earlier 96-transcript extraction; its coverage should not be silently extended to the later material.

**Q — Scarcity, independently expressed:** Will Larson says “their attention runs out before their … ability to write code does” [V18, 1:21](https://www.youtube.com/watch?v=Prl858_AovM&t=4860s). Titus Winters says “we can't review everything” and advocates learning hard lessons once and codifying rules [V17, 35:00](https://www.youtube.com/watch?v=mQu0zN4IvSI&t=2100s). Demetri calls the stopping points “judgment interrupts”: an agent can implement the requested change while the human discovers that the request was wrong [V09, 54:00–55:00](https://www.youtube.com/watch?v=DF5M5CJi9sM&t=3240s). S07 §5 enumerates 13 practitioners across seven publishing channels; those are overlapping experiences, not 13 buyers for this proposal.

**Q — Capability can reduce legibility:** Armin expects Pi to “hide the tool output” as generated programs replace recognizable tool calls, and calls the resulting loss of visibility a regression [V80, 1:08](https://www.youtube.com/watch?v=HDdbU10r7Js&t=4080s). In another episode, two individually approved designs worked together only because an agent supplied a shim that defeated their architecture; his conclusion was “our design was wrong” [V82, 1:26–1:28](https://www.youtube.com/watch?v=9UAxrdcDjjU&t=5160s). These support preserving the meaning and scope of approval, rather than merely increasing approval speed.

**Q — New corroboration and a constraint:** Runlayer's speaker reports “over 300 agents” in a company of approximately 50–60 people [p3-04, 01:00](https://www.youtube.com/watch?v=BgLdvF7Qkh8&t=60s), then describes drift across a session rather than a single call [08:00](https://www.youtube.com/watch?v=BgLdvF7Qkh8&t=480s). Fuad Ali describes dataset curation and evaluation design as places for “imparting your taste” [p3-05, 24:00](https://www.youtube.com/watch?v=UGuNt2_Oz8s&t=1440s). Conversely, Ben's hour of family-display customization ends with “And I'm good” [V80, 1:33](https://www.youtube.com/watch?v=HDdbU10r7Js&t=5580s). A useful judgment infrastructure should allow something to become settled and quiet.

**I — What does not follow:** these accounts do not prove a permanent human advantage in judgment. Better models may eliminate most current questions. The durable scarcity is access to a particular person's changing preferences, commitments, authority, and observed consequences. If a strong model with ordinary retrieval already resolves those sufficiently, the proposed compiler loses its opening.

## The scaling requirement

**E — Attention arithmetic:** suppose one million agents each encounter ten consequential decisions daily: ten million decisions. At three minutes of human work each, this requires 500,000 human hours a day, or 62,500 eight-hour working days. Summarizing each decision twice as efficiently leaves the basic impossibility intact.

**I — A compiler-like change:** the unit of human work must become an approved *class of decisions*, with explicit conditions, evidence, exceptions, ownership, and retirement. A market can allocate the residual decisions. A delegation system can limit what happens while judgment is unavailable. Version control can keep the classes current. These are four distinct proposals below, not a claim that one person should build the entire stack.

**E — Leverage has a floor:** if the baseline and escalated decisions take similar time, steady-state multiplication is approximately `1 / (escalation fraction + audit fraction + maintenance fraction)`. A 100× result needs the sum below 1%; 1,000× needs it below 0.1%. Those figures are plausible only for very repetitive, well-observed decision populations. Diverse product discovery will not achieve them through notification management. Even 99.9% decision accuracy at ten million decisions creates 10,000 errors a day; severity and bounded consequences matter more than a reassuring percentage.

**E — Shared engineering assumptions:** illustrative API costs below use $2–$10 per million combined input/output tokens, not a vendor price quote. A semantic review of 2,000 input plus 300 output tokens costs $0.0046–$0.023. Ten million such reviews cost $46,000–$230,000 daily. Running them for 1% of decisions costs $460–$2,300 daily, provided the rest can actually be checked mechanically. At an assumed 0.1–5 joules per token, that 1% is roughly 6–319 kWh/day of inference energy; this deliberately broad scenario excludes storage, networking, redundancy, and cooling. Measure real deployment energy before an environmental claim. The important economic choice is whether a precedent eliminates repeated semantic inference and human investigation, not whether its policy evaluator saves a few microseconds.

## Prior art that changes the proposal

### Learned preferences and constitutions already multiply human feedback

**F:** Christiano and colleagues demonstrated learning behavior from human comparisons in [Deep reinforcement learning from human preferences](https://arxiv.org/abs/1706.03741), published in 2017. Anthropic's [Constitutional AI](https://www.anthropic.com/news/constitutional-ai-harmlessness-from-ai-feedback) uses human-written principles to guide AI critique and preference training. [Collective Constitutional AI](https://www.anthropic.com/research/collective-constitutional-ai-aligning-a-language-model-with-public-input) involved approximately 1,000 participants and trained models against a publicly informed constitution; the researchers report difficulties translating principles, constructing relevant training prompts, balancing objectives, and evaluating constitutional fidelity.

**I — Limit, not a historical failure claim:** these efforts succeeded at reducing direct feedback requirements. They do not establish that a particular user's inferred preference is a transferable execution permission, or that a constitution remains coherent after months of local exceptions. “Turn my decisions into rules” is old. A new proposal needs evidence about applicability, authority, correction, and actual human effort after deployment.

### Funded 2026 competition already evaluates intent and learns recurring decisions

**F:** [WorkOS Airlock](https://workos.com/blog/workos-airlock), in early access as described September 23, evaluates proposed agent calls against intent and organizational policy, allowing, denying, or escalating them. Its [August demonstration](https://workos.com/blog/agent-night-recap-airlock-intent-based-access-control) explicitly describes compiling intent into actions and negotiating authorization at runtime. WorkOS announced a [$100 million Series C](https://workos.com/blog/series-c) in March 2026. This is a well-funded direct competitor to a generic judgment-compiler pitch, not a distant analogy.

**F:** [Microsoft agent-learning](https://github.com/microsoft/agent-learning/blob/main/docs/decision-making.md) maintains inspectable policies over executable alternatives, records independently supported outcomes, updates preferences, gates statistical autonomy with evidence, and samples drift audits. Its documentation distinguishes decision authority from execution authorization. No large public effectiveness result was established in this investigation.

**I — Consequence:** neither an inspectable learned policy nor evidence-gated autonomy is an empty category. The residual worth testing is owner-ratified, portable precedents with counterexamples and observed downstream outcomes. If that is merely configuration for these systems, contribute it there and abandon a standalone product.

### Natural language to formal policy, including history, is shipping

**F:** [Amazon Bedrock AgentCore Policy](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy.html) supports policies outside the agent's code. Its [natural-language authoring](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy-natural-language.html) generates Cedar policies against tool schemas. [AWS's architecture account](https://aws.amazon.com/blogs/security/why-policy-in-amazon-bedrock-agentcore-chose-cedar-for-securing-agentic-workflows/) describes automated reasoning in policy authoring and analysis. [Temporal policies](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy-temporal.html) support session history, counts, sums, and preceding approvals. Updating temporal policy invalidates active temporal sessions; the documented recovery creates a session with empty history.

**I — Consequence:** policy compilation, accumulated-action checks, approval-before-action, and invalidation on change are occupied. The temporal documentation gives a particularly strong baseline for the intent-version-control proposal: can it preserve valid work while requesting substantially less rejudgment than ending all affected sessions? No assertion is made that AWS cannot extend its implementation to do so.

### A 200× approval-friction result already exists

**F:** OpenAI's April 2026 [Auto-review report](https://alignment.openai.com/auto-review/) describes a separate reviewing agent at the sandbox boundary and reports roughly 200× fewer stops for human approval. It discusses dangerous-action evaluations and recovery after denials. That is a vendor-reported result for a particular boundary and deployment; it is not 200× more useful engineering judgment. Anthropic's February [autonomy study](https://www.anthropic.com/research/measuring-agent-autonomy) analyzes millions of interactions and finds experienced users auto-approve more while also interrupting more. Its April [trustworthy-agents account](https://www.anthropic.com/research/trustworthy-agents) identifies user control, clarification, and oversight of coordinated agents as continuing design work.

**I — Consequence:** fewer approval prompts is insufficient as the main result. The compiler must beat a capable independent model reviewer on accepted outcomes per human hour, including misses and corrections. Do not report a gain against a deliberately annoying manual permission dialog as a gain in judgment.

### Interruptions have a mature research history and fresh agent-specific competition

**F:** Horvitz's [mixed-initiative interfaces](https://www.microsoft.com/en-us/research/publication/principles-mixed-initiative-user-interfaces/) and [adjustable-autonomy research](https://projects.iq.harvard.edu/files/teamcore/files/2002_9_teamcore_ss02.pdf) already reason about when to transfer control. [CrowdSynth](https://www.erichorvitz.com/CrowdSynth.pdf) combines learned human/machine performance models with decisions about obtaining more contributions. Mark, Gudith, and Klocke's [interruption experiment](https://www.ics.uci.edu/~gmark/chi08-mark.pdf) found compensation through faster work accompanied by greater stress; it does not justify applying a universal fixed recovery-time penalty to all interruptions. Anderson and colleagues' [warning-habituation study](https://doi.org/10.1080/07421222.2016.1243947) directly examines decreased responses to repeated warnings.

**F:** October 2026's [Ask Less, Ask Better](https://arxiv.org/abs/2610.24411) distinguishes question counts from effort and utility, reporting attention-cost reductions under interruption budgets in customer-service tasks. [PITCH](https://arxiv.org/abs/2610.25896) evaluates the timing of proactive contributions in group conversations. These are recent research baselines, not established long-term results for parallel coding agents.

**F:** [Cue](https://github.com/murtazox04/Cue) already implements attention budgets, quiet hours, digests, and approval mediation. [Happier](https://guides.happier.dev/get-notified-when-an-agent-is-waiting-across-many-parallel-sessions) documents cross-session approval notifications. [LangSmith Fleet](https://www.langchain.com/blog/introducing-langsmith-fleet) includes an Agent Inbox. These kill a new inbox as the proposed contribution.

### Delegation, temporal memory, and enterprise approval are also occupied

**F:** [SecPAL](https://www.microsoft.com/en-us/research/publication/design-and-semantics-of-a-decentralized-authorization-language-2007/) formalizes decentralized authorization and controlled delegation. [Biscuit](https://doc.biscuitsec.org/reference/specifications) implements attenuable tokens and decentralized verification; its [Datalog semantics](https://doc.biscuitsec.org/reference/datalog.html) constrain added blocks to narrowing authority. [Tenuo](https://tenuo.ai/spec/protocol-spec-v1) specializes signed, attenuated warrants for agents and already offers a [six-agent delegation lab](https://tenuo.ai/lab/) with a total travel budget. A six-agent spend-cap demo would therefore add little.

**F:** [Graphiti](https://help.getzep.com/graphiti/getting-started/overview) maintains evolving temporal context; [LangSmith prompt repositories](https://reference.langchain.com/go/langsmith/repos) version prompts; [Suggested Is Not Superseded](https://arxiv.org/abs/2610.15710), released October 11, evaluates memory-retirement judgments. [Manyshape](https://github.com/Them-labs/manyshape) already frames malleable software around authority, contracts, and surfaces. [The Intent Stack](https://www.intentstack.org/docs/specification) is an independent public governance draft, not an adopted standards-body specification. The [Agent Control Standard's intent concept](https://genai-security-project.github.io/agent-control-standard/docs/concepts/intent/) already binds authorized capabilities to a purpose established before untrusted content enters the session.

**F:** [ServiceNow's March approval documentation](https://www.servicenow.com/docs/r/intelligent-experiences/ai-control-tower/explore-approvals.html) describes steward approval gates for AI assets and workflows. Its [May 2026 AI Control Tower announcement](https://newsroom.servicenow.com/press-releases/details/2026/ServiceNow-expands-AI-Control-Tower-to-discover-observe-govern-secure-and-measure-AI-deployed-across-any-system-in-the-enterprise/default.aspx) describes broader governance and intelligent approvals. An agent approval center, decision log, or organization chart is incumbent territory.

**I — Honest status:** the closest efforts generally have not “stalled”; many are actively shipping. The relevant limits are the boundaries of demonstrated/documented results. This investigation found no independently reproduced result establishing 100–1,000× more accepted, intent-faithful work per human hour across changing agents and owners. That is a bounded research observation, not an absence claim about all private systems.

## Idea 1 — Precedent: a judgment compiler and a commons of reusable decisions

### 1. Seed

**Q:** Winters's “we can't review everything” and prescription to codify lessons [V17, 35:00](https://www.youtube.com/watch?v=mQu0zN4IvSI&t=2100s); Ali's “imparting your taste” during fixture selection [p3-05, 24:00](https://www.youtube.com/watch?v=UGuNt2_Oz8s&t=1440s); Armin's approved-design composition failure [V82, 1:26–1:28](https://www.youtube.com/watch?v=9UAxrdcDjjU&t=5160s). The lesson is that a useful reusable judgment includes its limits, not just the winning answer.

### 2. Vision at full scale

**I — Rung: infrastructure for a field, potentially changing what organizations can delegate.** Every consequential agent action may cite an owner-authorized precedent: decision, purpose, applicable facts, evidence sources, rejected alternatives, counterexamples, expiry, and supersession. Models propose applications; resource owners enforce authorization. Independent projects can adopt public precedents, narrow them, or explicitly dissent without surrendering their own authority.

**I:** Think of a maintained body of case law with executable applicability checks. A difficult decision can govern a million later instances, while an appeal produces a counterexample that narrows or retires the precedent. No central model decides whose preferences are correct. The durable network consists of accountable owners, shared cases, adapters for real effects, and longitudinal outcomes. A model-independent policy format is useful plumbing, not the central asset.

### 3. Why now

**I:** Expert systems and rule induction were possible decades ago. The previously uneconomic part was constructing, testing, and maintaining task-specific representations for a vast range of messy decisions. Strong coding/reasoning agents can now reconstruct changes, extract candidate rules from actual review histories, generate boundary cases, and adapt checks to many tools. This makes the million-agent vision plausible; it does not make the compiler a new scientific concept. The newly cheap labor should be spent finding where a rule fails, while the human retains the authority to adopt it.

### 4. One-shot test

**I — Non-code value:** situated decisions that have actually been made, explicit permission to reuse them, evidence about subsequent outcomes, and a community willing to accept and maintain precedents. A better model can build the software, propose a superior policy, and perhaps eliminate the need for compilation on many tasks. It cannot retrospectively obtain an owner's unexpressed consent or create six months of observed consequences from a prompt. If no participant values the accumulated evidence beyond ordinary model memory, stop.

### 5. Physics, economics, data, and law

**E:** At ten million decisions/day, a 2 KB metadata record is 20 GB/day, approximately 7.3 TB/year before replication; full traces cost much more. A hypothetical 0.5 ms deterministic check consumes about 1.4 CPU-hours/day. Evidence extraction and inference dominate: use the shared $460–$2,300/day scenario only if 99% mechanical coverage is measured, not assumed. A six-week local prototype can cap inference at 5–30 million tokens, $10–$300 on the stated pricing scenario, with a $500 contingency for comparisons.

**I:** Public PR comments omit private constraints, abandoned designs, and later regret; approval is also a noisy label for actual preference. Start with one consenting maintainer's history and fresh counterfactual labels. Keep private rationales local. Publish separately licensed/redacted cases. Adoption of a precedent must be explicit; a prediction about approval never grants a resource permission. The compiler verifies declared predicates, not legal compliance or the truth of all supplied evidence.

### 6. Closest attempts and remaining opening

**F/I:** Microsoft agent-learning is closest on recurring decisions and evidence-gated autonomy; WorkOS Airlock on intent-sensitive authorization; AWS on checked policy generation; Constitutional AI on scaling principles; Arize's corpus account on joining human judgments to traces. These are serious overlaps. The testable residual is whether **human-ratified boundaries plus transferable counterexamples and outcome histories** improve real judgment reuse over their ordinary policy/retrieval mechanisms. Neither “uses a proof” nor “stores precedents” establishes that residual.

### 7. Six-week step for one person

**I:** Build one TypeScript adapter for an existing agent workflow around a maintainer's public API/configuration/plugin changes. Recover 30–50 past decisions with their context and counterexamples; compile at most six owner-ratified reuse regions. Run held-out and prospective proposals in shadow mode. Show a live case where a known decision is reused, an attractive but inapplicable analogy is escalated, and an owner's revised preference invalidates the relevant precedent. Compare against retrieval-only guidance and a strong independent model reviewer. Detailed protocol follows the four ideas.

**I — Distinct artifact sought:** a public, reproducible trajectory linking a person's decisions to justified reuse, boundary failures, later revisions, accepted work, and the complete human-time ledger. The experiment may reveal a new result; no claim is made that nobody has previously built the individual mechanisms.

### 8. What would kill it

**I:** Most apparent precedent is either an ordinary lint rule or context-dependent taste that cannot be cheaply bounded. The compiler then creates a second software system the owner must maintain. Cheapest test: spend two working sessions on 30 real decisions before building a compiler. Ask the owner to state where each would reverse. If fewer than roughly one third yield reusable, checkable regions, or a strong model with retrieved history matches them at the same risk and lower effort, abandon this domain. Also stop if owners will not authorize reuse even after inspecting counterexamples.

### 9. Builder fit

**I:** Strong: compiler IRs, TypeScript, Wasm checkers, reproducibility, small trusted enforcement boundaries. Start with ordinary JSON plus existing policy machinery; Rust or Lean becomes useful only for a concrete invariant that needs it. The difficult work is collecting owner decisions and measuring consequences. This is neither a new operating system nor a generic agent harness, and it must not turn into months of runtime engineering before obtaining usable cases.

## Idea 2 — Intent version control: keep a principal's meaning coherent over months

### 1. Seed

**Q:** Gergely Orosz says “my opinions change all the time” when discussing a bot that retrieved his outdated views [V18, 1:48](https://www.youtube.com/watch?v=Prl858_AovM&t=6480s). Dodds describes corrective rules accumulating for months into “a big ball of mud” [p3-51, 07:00–08:00](https://www.youtube.com/watch?v=7cUEIh4jMrQ&t=420s). Runlayer reports session-level intent drift [p3-04, 08:00](https://www.youtube.com/watch?v=BgLdvF7Qkh8&t=480s). These are three different problems: changed preferences, accumulated rules, and execution drift.

### 2. Vision at full scale

**I — Rung: infrastructure for long-lived organizations of agents.** A principal's commitments form a versioned dependency graph, with named owners, scopes, validity intervals, and explicit precedence. Every delegated plan and external commitment records which intent version justifies it. Changing “minimize cost” to “preserve delivery date” produces a semantic impact set: continue these tasks, re-evaluate those, revoke these authorities, and reconcile these effects that have already happened.

**I:** The equivalent of a merge conflict is a concrete situation in which two accepted intentions prescribe incompatible behavior. Agents may suggest resolutions but cannot silently smooth them into a shim. Across months, the organization retains a coherent account of what it currently owes people and why. This is more ambitious than a better memory database: it governs the survival of commitments across changing owners, models, and policies.

### 3. Why now

**I:** Versioning requirements and checking dependency graphs were always possible. Keeping a semantic account of many independently generated plans was not economical when humans had to enumerate the implications manually. Agents make it feasible to extract proposed dependencies, generate conflicts, and revise thousands of plans after a change. The hard new scale is millions of evolving obligations, not Git for Markdown. Incompleteness of the extracted dependency graph remains a central limit.

### 4. One-shot test

**I — Non-code value:** a live history of accepted and revoked commitments, resource-owner cooperation, identities entitled to change intent, and observations of work already executed. Better models improve impact analysis but cannot undo a sent message, refund a charge without authority, or decide that one person's commitment outranks another person's. The process survives only if independent owners actually use its records when coordinating.

### 5. Physics, economics, data, and law

**E:** One million active tasks with ten 1 KB dependency edges each require about 10 GB for raw edges; indexes, versions, and evidence will multiply this. A policy revision affecting 1% of tasks triggers 10,000 semantic rechecks. At 5,000 tokens each, that is 50 million tokens, or $100–$500 per revision on the stated scenario, rather than $10,000–$50,000 for checking every task. Missing edges can erase the saving or create unsafe continuation; incomplete evidence must fall back to broader invalidation.

**E/I:** At 0.1–5 J/token, that revision's inference is approximately 1.4–69 kWh. The local demo needs a laptop and tens of thousands of metadata records, not a GPU cluster. Data must include actual in-flight state and external effect acknowledgments, not just intent text. Use simulated resources initially. Historical authorization does not justify continuing after revocation; contracts and already executed obligations need explicit reconciliation, rather than deletion of their history.

### 6. Closest attempts and remaining opening

**F/I:** Graphiti handles evolving facts; LangSmith versions prompts; memory-retirement evaluation addresses supersession; Manyshape addresses authority/contracts; the Intent Stack and Agent Control Standard cover governance concepts. AWS already invalidates temporal sessions when policy changes. The proposed residual is **selective, evidence-backed migration of in-flight obligations across a human intent change**, with conservative fallback when dependency coverage is uncertain. A version number, rationale graph, or policy-diff screen alone would not earn the ambition claim.

### 7. Six-week step for one person

**I:** Weeks 1–2: model one repository-maintenance organization and its two owners' accepted priorities. Weeks 3–4: run 100 simulated tasks with two agent adapters; introduce changes in compatibility policy, publication authority, and cost limits. Weeks 5–6: inject owner-authored intent revisions into real shadow runs and compare selective migration against full restart and direct model re-prompting. Demonstrate the incompatible-design composition case as an explicit unresolved obligation, rather than accepting a passing test suite as a conflict resolution.

**E — Target:** at least 80% less human rejudgment time than full reapproval, with every seeded unauthorized stale action blocked at the resource boundary and no weakening of unrelated policy. Simulation results and real-owner results must be separated. Months of coherence cannot be validated by a six-week trial; the demo establishes migration mechanics and starts a longitudinal observation.

### 8. What would kill it

**I:** There is no reliable semantic dependency graph, and restarting cheap agents is simpler and safer. Cheapest test: take ten genuine preference changes and compare ordinary fresh-context regeneration to explicit dependency maintenance. Kill if maintaining the graph costs more human time, stale commitments escape the boundary, or fewer than two owners need a shared history. For a single short-lived agent, a new prompt and a new session are probably sufficient.

### 9. Builder fit

**I:** Excellent systems fit: dependency invalidation, event logs, effect boundaries, transactional state, compiler diagnostics. Harder social fit than Idea 1 because demonstrating coordination requires more than one owner. Use Workers/Durable Objects only after a local causal model is useful; this is not a storage or durability project.

## Idea 3 — A constitution with conserved authority: bounded organizations of agents

### 1. Seed

**Q:** Jane Street reports models bidding excessive amounts for cluster capacity and “pre-empting a bunch of human work” [V08, 36:00](https://www.youtube.com/watch?v=b9Ssp1B_Pf4&t=2160s). Armin's tool-output concern raises the question of control when actions become arbitrary programs [V80, 1:08–1:09](https://www.youtube.com/watch?v=HDdbU10r7Js&t=4080s). The Runlayer account supplies an existing many-agents-per-person organization [p3-04, 01:00](https://www.youtube.com/watch?v=BgLdvF7Qkh8&t=60s).

### 2. Vision at full scale

**I — Rung: shared infrastructure for delegating across autonomous organizations.** A principal allocates a finite authority budget to an organization. Every descendant can narrow its rights and reserve a portion of the remaining budget; nobody can duplicate consumable authority by forking a task. At effect time, the resource owner verifies scope, current intent, reservation, and consumption. The human approves an operating envelope rather than all descendants' actions.

**I:** The ambitious destination is a resource-owner settlement convention used across independent services: bounded money, bounded external messages, bounded tenant changes, explicit owners, disputes, and revocation. Millions of agents could reorganize themselves inside an agreed envelope while preserving the principal's total exposure to the specific counted effects. It is not a proof that their work is useful, that semantic harm is bounded, or that the owner's chosen cap was sensible.

### 3. Why now

**I:** Capability systems, quotas, and escrow are old. The new challenge is distributing authority across continuously generated, heterogeneous software and dynamically changing delegation trees without a human IAM engineer per integration. Agents can generate and verify adapters and prove small conservation properties; enforceable resource accounting gives these programs a common limit. If the useful artifact is only a spend-limited token, it fails the ambition test and should be an upstream contribution.

### 4. One-shot test

**I — Non-code value:** resource owners accepting the same delegation/settlement rules, tested interoperability under failures, and a sustained record of limits holding in real use. A better model writes the protocol implementation quickly; it cannot make an airline, repository owner, and payment provider accept the same principal or enforcement terms. The adopted convention is the potential asset. Without that adoption, this is a library in a crowded category.

### 5. Physics, economics, data, and law

**E:** At one million irreversible effects per second, one globally serialized ledger is an inappropriate design. Allocate disjoint escrow allowances to 1,000 owner/shard ledgers: approximately 1,000 commits/second per shard. This is a load target, not a demonstrated Cloudflare guarantee. A 1 KB event at that global rate is 86.4 TB/day before replication: retain compact settlement proofs, aggregate routine events where acceptable, and price audit retention explicitly. At ten million effects/day instead, it is 10 GB/day.

**I:** A partition creates an unavoidable choice: spend already allocated escrow offline or lose availability while checking the current global state. Immediate global revocation, arbitrary offline spending, and strong aggregate limits cannot all be promised. Expiry and resource-side checks bound the window. An external action with an unknown outcome retains its reservation until reconciled; a timeout is not evidence that it failed. Low inference demand helps energy costs, but signing, replicated writes, and retained logs still need measurement.

**I:** Limit the experiment to fake money and local services. Real settlement needs agreements about whose authority counts, duplicate execution, liability, disputes, and identity. A $100 action can still cause far more than $100 of consequential loss. The bound is on the metered resource, not on every form of harm.

### 6. Closest attempts and remaining opening

**F/I:** SecPAL, Biscuit, Tenuo, payment wallets, and cloud quota systems supply most primitives. Tenuo's existing budgeted delegation lab is especially close. AWS's temporal policy supports counts and sums, so “aggregate agent spending” alone is not new. The residual is **independently enforced, cross-owner conservation under retries, forks, partitions, and policy changes**, backed by adopted settlement semantics and real failure histories. This search did not establish that existing payment/authorization platforms lack that combination; integration research must precede a new protocol.

### 7. Six-week step for one person

**I:** Reuse an existing attenuable-token implementation. Build three independently keyed mock resource owners, a budget ledger, and a delegation tree that can fork 1,000 times. Specify the reservation/consume/reconcile model, model-check small states, then inject crashes, duplicate messages, delayed acknowledgments, and a parent revocation during execution. Use two actual agent adapters only to supply action proposals; scripted actors are sufficient for the larger fault sweep.

**E — Target:** one human grant remains within its counted resource limits through 100,000 fault-scheduled operations; useful permitted actions still finish after recovery; all human interventions are recorded. The new evidence sought is cross-owner composition under ambiguous outcomes, not a bigger version of Tenuo's travel demo. Obtaining even two independent service maintainers' acceptance of the semantics is more valuable than increasing the synthetic agent count.

### 8. What would kill it

**I:** Existing tokens plus a conventional centralized budget database solve the target use case. Cheapest experiment: implement the complete three-owner example on existing Tenuo/Biscuit and ordinary quota accounting in two days. If it works cleanly, do not create a protocol. Also stop if no resource owner will enforce the boundary: the remaining “proof” only describes cooperative simulation.

### 9. Builder fit

**I:** Strongest technical fit of the four: Rust, Wasm, type systems, small invariants, replay, failure injection. It also has the greatest temptation to hide a modest security library inside a grand vision. Keep it ranked below the judgment experiment until independent resource owners supply a real coordination problem.

## Idea 4 — A judgment exchange: allocate scarce decisions among agents

### 1. Seed

**Q:** Demetri questions whether receiving a judgment four hours sooner necessarily changes business value [V09, 59:00–1:00](https://www.youtube.com/watch?v=DF5M5CJi9sM&t=3540s). Jane Street's excessive-bidding incident shows that agents' declared importance is already unreliable [V08, 36:00](https://www.youtube.com/watch?v=b9Ssp1B_Pf4&t=2160s). Tao's “proof indigestion” is another domain where output exceeds expert absorption [p3-46, 20:00–21:00](https://www.youtube.com/watch?v=svl_1upFpQo&t=1200s). These are signals for selective allocation, not evidence that auctions are the right mechanism.

### 2. Vision at full scale

**I — Rung: an institution for allocating expert judgment across a field.** Autonomous organizations submit decision contracts: named principal, unresolved choice, available evidence, deadline, cost of waiting, authorized reviewer, and what later observation will reveal whether the intervention helped. Principals allocate scarce, non-mintable attention credits. Cases compete for a finite service budget; resolved decisions produce reusable precedents instead of merely closing tickets.

**I:** At scale this resembles a clearinghouse for residual human decisions after routine judgment has been compiled away. Some capacity belongs to an owner's private preferences and cannot be traded. Other capacity can be delegated to qualified specialists. Emergency and public-interest reserves remain outside bidding. The exchange's value is a trusted network with observed calibration and legitimate decision rights, not an urgency score assigned by an LLM.

### 3. Why now

**I:** Auctions and expert marketplaces were never impossible. What was uneconomic was forming millions of small, evidence-complete decision contracts, routing them, and following their outcomes without consuming the human time being sold. Agents can now prepare those contracts and maintain outcome trails. This creates a possible large-scale institution; a simple priority queue with tokens does not pass the ambition filter.

### 4. One-shot test

**I — Non-code value:** enrolled principals and experts, accepted authority to answer, reputation tied to observed decisions, and scarce capacity with enforceable budgets. A stronger model may eliminate many expert tasks, shrinking the exchange. It cannot sell a person's unavailable attention, grant another person's permission, or create a trusted network instantly. If models solve nearly all eligible residual cases, this institution is unnecessary; that is a real extinction condition.

### 5. Physics, economics, data, and law

**E:** Suppose 10,000 principals each have 30 review-minutes/day: 300,000 minutes. At three minutes per meaningful decision, capacity is 100,000 cases/day. Against ten million cases, at least 99% must be compiled, delegated to a model, postponed, or abandoned. A market cannot manufacture the missing capacity. At an imputed $100/hour, those minutes cost $500,000/day before administration. The exchange must improve portfolio outcomes enough to justify routing and evaluation costs.

**E/I:** Reviewing 100,000 submitted packets at 2,300 tokens each costs roughly $460–$2,300/day on the shared assumptions, plus human expertise; inference energy is approximately 6–319 kWh/day. Utility labels are delayed and counterfactual: a reviewed issue's later success does not prove the review caused it. Collect matched outcomes and randomly allocate a small exploration budget. Do not expose private decision packets to an open marketplace; reviewers need explicit confidentiality and domain authority. Statutory or contractual approval requirements cannot simply be auctioned to a cheaper reviewer.

### 6. Closest attempts and remaining opening

**F:** [Auction protocols for decentralized scheduling](https://graphics.stanford.edu/courses/cs468-05-winter/Papers/Distributed/auction_protocols.pdf) analyze market scheduling and the difficulty posed by complementary/nonconvex jobs. [Holmström and Milgrom's multitask principal–agent analysis](https://web.stanford.edu/~milgrom/publishedarticles/Multitask%20Principal%20Agent.pdf) explains why rewarding measurable outputs can distort effort across tasks. Horvitz, adjustable autonomy, and CrowdSynth already allocate human/machine work. Cue, Happier, and enterprise approvals supply delivery and routing.

**I:** The narrow hypothesis is that scarce principal-issued budgets plus outcome-calibrated bids allocate *residual judgment* better than a centralized scheduler. Classical incentive guarantees do not automatically transfer: agents share owners, may have no independent utility, cannot meaningfully pay from invented budgets, and can split tasks or collude. Decision value is not necessarily additive. In the single-principal case, a central value-of-information scheduler is the stronger default; an auction may be theater.

### 7. Six-week step for one person

**I:** Reuse Cue or an existing inbox; build no notification UI. Start with 50–100 real blocked decisions and their later outcomes from a cooperating maintainer/team. Allocate a fixed 60-minute daily human budget among 20–50 simulated competing workstreams. Compare FIFO, deadline ordering, a calibrated centralized value-of-information scheduler, and scarce-credit bidding. Include inflated urgency, duplicated requests, hidden dependencies, and reviewers who cannot legally or practically substitute for the principal.

**E — Target:** at least 20% greater owner-rated accepted portfolio value per human minute than the strong centralized baseline, without increasing missed mandatory decisions or starving a protected workstream. This requires owner evaluation of actual consequences; simulated rewards establish only mechanism behavior. The sought artifact is a longitudinal, adversarially tested allocation record, not an auction animation.

### 8. What would kill it

**I:** The main problem is learning value rather than allocating it, and a market adds gaming and administrative effort. Cheapest experiment: replay a week's actual decisions under the centralized baseline and the proposed market before connecting live agents. Kill the auction if its benefit disappears after calibration or if credits do not represent a real sacrifice by principals. Do not relabel a surviving queue as a marketplace.

### 9. Builder fit

**I:** A good distributed-systems experiment but the weakest solo launch: it needs participant recruitment, economic judgment, difficult causal measurement, and an authority network. A simulation alone is easy to one-shot. Treat this as the most speculative institutional direction, conditional on Ideas 1–2 establishing a useful residual decision population.

## The six-week commitment for the ONE pick

**I — Scope:** one maintainer, one real TypeScript repository, one family of consequential public API/configuration/plugin decisions, two agent adapters, no automatic public merges. The maintainer may be the builder if suitable history exists. No promise of broad personal-preference learning. Allocate approximately 10–15 hours/week, 60–90 hours total. Reserve roughly half for cases, owner interaction, measurement, and analysis rather than implementation.

### Week 1 — Establish whether there is reusable judgment

**I:** Select 30–50 historical decisions containing a real trade-off: compatibility versus simplification, adding a new escape hatch versus preserving a coherent interface, accepting a dependency versus maintaining a small trusted surface. Avoid mechanically checkable formatting decisions. Preserve the evidence the owner had at the time; do not leak later outcomes into earlier decisions. Record why an adjacent case would receive the opposite answer. Obtain explicit permission to store and, separately, publish each case.

**I:** Run the two-session kill test. Check whether a prompt with retrieved precedents already solves the decisions at an acceptable level. If reusable regions are absent, write up the negative result instead of implementing an elaborate compiler.

### Week 2 — Build a small representation of precedent

**I:** Each precedent contains:

- An owner, purpose, decision, version, and explicit grant of reuse authority.
- Required facts, where each fact comes from, and what missing/ambiguous facts mean.
- A bounded applicability predicate and observable obligations after the action.
- At least one nearby reversal/counterexample, plus expiry and supersession rules.

**I:** Let a model propose the representation; the owner ratifies no more than six reusable regions. Reuse Cedar/Datalog or simple typed predicates. No foundation-model training, new policy language, or formalization of arbitrary human values is needed. A confidence score cannot bypass a missing condition.

### Week 3 — Make reuse checkable at the real boundary

**I:** Integrate with an existing harness. For a candidate change, compute independently observable facts where possible, identify the proposed precedent, check applicability, and return reuse, rejection, or escalation with the unmet condition. Bind the decision to the actual candidate artifact and current intent version. The implementation agent cannot edit the policy or its authoritative evidence. Unknown facts escalate. Changes inside arbitrary code that the adapter cannot observe remain outside the envelope.

**I — Demo example:** the maintainer permits simplifying an internal plugin representation while preserving the documented ordering behavior and forbids a new global registry. A successful shim that restores examples by adding such a registry fails the declared envelope. A different internal simplification that preserves the obligations reuses the precedent. The novelty is not detecting a forbidden symbol; it is measuring whether declaring the boundary once avoids repeated architectural judgments across genuinely different proposals.

### Week 4 — Challenge the boundaries and change the owner's mind

**I:** Build at least 120 held-out challenge cases from authentic decisions and controlled variants, preserving which are synthetic. Include changed scope, misleading similarities, missing evidence, altered artifact after approval, contradictory precedents, and an explicit preference revision. Lock the challenge set before final tuning. Add 20–30 owner-authored novelty/conflict cases; report their source and construction separately from naturally occurring exceptions.

**I:** Audit evidence extraction independently from policy evaluation. An exact checker over a hallucinated fact is not a success. Present failures with the actual human and model interventions, including the cases for which no correct reusable rule was found.

### Week 5 — Run the comparison on actual useful work

**I:** Seek at least 60 maintainer-selected, useful change proposals in shadow mode; if the repository does not naturally supply enough, extend observation rather than padding the operational metric with generated trivialities. Compare:

1. The maintainer's ordinary workflow, including whatever model review it already uses.
2. A strong independent model reviewer with retrieved history and the same evidence.
3. The precedent compiler, with the same underlying model and evidence budget.

**I:** Use matched task families and randomized assignment/order where feasible. Separate historical replay from prospective work. Capture active reading, fact checking, answering questions, policy setup, policy repair, audit, integration, and later rework. Record elapsed waiting separately; do not count agent idle time as human time saved. Record self-initiated checking outside working hours, given the Dodds counterexample.

### Week 6 — Deliver a result that can be falsified

**I:** Publish the licensed/redacted case corpus, compact precedent representation, two adapters, exact comparison settings, failure cases, and a human-time ledger. The demo shows work continuing under an adopted precedent, stopping at a reversal, and reacting correctly when the owner changes the rule. Include one successful case and the strongest failure; a clean scripted success alone does not demonstrate multiplication.

**I:** The end product is a measured, owner-governed judgment-reuse experiment with reusable evidence. If it is promising, invite another maintainer to adopt or narrow one precedent. Cross-owner acceptance is the next step toward field infrastructure. Do not spend the six weeks creating a general marketplace, hosted control tower, or elaborate proof framework.

## Measurement: what would count as multiplication

**I — Primary metric:** `accepted useful outcomes / total active human hours`, at a declared quality/risk level. “Accepted” means the owner would retain the result after inspecting its behavior and consequences, not that the agent, compiler, or tests said pass. Review-only classification cases use owner-agreed decisions as their outcome; they must not be presented as completed engineering work. Keep task mix visible and report per-family results before any aggregate.

**E — Six-week success target:** at least **5×** more accepted work per human hour in the bounded family after counting actual setup, policy maintenance, routine checks, audits, corrections, and observed rework. Also report the operational rate after setup as a separate number. A short trial that achieves 10× after excluding ten hours of policy construction has not achieved a net 10× result. If the full-cost result does not clear the target, report it plainly; the 100–1,000× ambition remains a long-run hypothesis.

**E/I — Scale illustration, not a prediction:** 200 ordinary decisions at four minutes each cost 800 minutes. A compiler run costing 60 minutes of policy work, 40 of escalations, 30 of audits, and 30 of maintenance/rework costs 160 minutes: 5×. If the same regions subsequently cover 2,000 equally useful decisions with total human effort still near 160 minutes, the ratio becomes 50×. The hard empirical question is whether coverage grows faster than exceptions and upkeep. Count the process that obtains reliable outcome evidence in that effort; do not assume a free oracle.

**I — Quality and control gates:** report owner reversals of autonomous decisions, missed novel cases, evidence-extraction errors, conflict resolution, stale-authority attempts, and downstream rework separately. A proposed target is at least 90% recall on the declared novelty/conflict challenge set, zero observed major out-of-envelope acceptance, and no material accepted-outcome degradation against the strong model baseline. A critical miss blocks expanding the scope even if the average time result looks good.

**I — Statistical honesty:** zero failures among 60 independent audited decisions gives a one-sided 95% binomial upper error bound of approximately 4.9%, not a production safety guarantee. Repeated variants are correlated and provide less evidence. Obtaining a corresponding bound below 0.1% with zero observed failures requires roughly 3,000 independent relevant observations; below 0.01% requires roughly 30,000. A six-week trial cannot establish that arbitrary million-agent deployment is safe. [Conformal Risk Control](https://arxiv.org/abs/2208.02814) offers principled calibration under its stated assumptions; it does not turn nonstationary preferences and adversarially selected tasks into a universal guarantee.

**I — Better-model survival test:** rerun the same held-out set with a stronger available model, with and without accumulated precedents, using equivalent evidence and permissions. The desired result is that better models improve boundary discovery and ordinary execution while owner-specific decisions and legitimate authority remain valuable. If the stronger retrieval-only baseline achieves the same outcomes and human effort, the compiler mechanism is redundant. The corpus might remain useful, but that is a narrower result.

**F/I — Legal boundary:** [Article 14 of the EU AI Act](https://eur-lex.europa.eu/eli/reg/2024/1689) concerns effective human oversight for high-risk systems, including awareness of automation bias and intervention. A low prompt count or a signed rule is not evidence of satisfying those requirements. Applicability depends on the deployment; the proposed OSS maintenance experiment makes no compliance claim. All four visions need explicit authority, access control for personal decision histories, and an owner who can correct or revoke a rule. These are design constraints, not reasons to stop a local research prototype.

## Ranking and decision

1. **I — Precedent / judgment compiler: ONE pick.** Best combination of strong corpus convergence, a solo experiment, compounding non-code evidence, and a credible path from one owner to shared field infrastructure. Competition is substantial; the result must beat retrieval and independent model review. The accepted precedent corpus is more defensible than the compiler code.
2. **I — Intent version control.** Strong long-run problem and excellent systems fit. More distinctive when it migrates real obligations selectively; weaker if it becomes a graph of prompts. Start after Idea 1 produces decisions worth preserving and revising.
3. **I — Conserved authority.** Clear guarantees for metered effects and good technical fit, but substantial capability/payment/quota prior art. Prefer an integration or upstream contribution unless independent owners reveal missing settlement semantics.
4. **I — Judgment exchange.** Potentially the largest new institution, with the weakest evidence that a market beats a well-designed scheduler. Need legitimate participants, real budgets, and observable value; simulation is insufficient.

**I — Most crazy but not physically impossible:** the judgment exchange as a federation of human-owned precedent institutions, each able to delegate routine judgments while buying scarce residual expertise. Its constraint is legitimacy and value measurement, not implementation. If the market component fails, do not preserve it for dramatic effect: a federation with calibrated scheduling could still realize much of the vision.

**I — Why choose the compiler now:** it tests the prerequisite shared by the other ideas. Can human judgment become a maintained, reusable asset whose value exceeds the cost of recording and updating it? Until that works for one person, markets, constitutions, and million-agent organizations are abstractions without a demonstrated source of leverage.

## Five-line TL;DR

- **Q/I:** Practitioners converge on scarce judgment; more capable agents can increase volume while concealing mismatched intent.
- **F:** Approval automation, learned policies, intent authorization, temporal memory, delegation tokens, and inboxes already have serious implementations.
- **I:** Build a judgment compiler whose durable value is owner-authorized precedents, counterexamples, real outcomes, and eventual cross-owner adoption.
- **E:** In six weeks, test one maintainer and one decision family; target 5× accepted work per total human hour against strong existing workflows, with explicit quality gates.
- **I:** Kill the mechanism if ordinary retrieval/model review matches it, reuse boundaries do not hold, or policy upkeep consumes the saved judgment.
