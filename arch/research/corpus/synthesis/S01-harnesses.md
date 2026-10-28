# S01 — Harnesses, agent architecture, and the contracts that remain

Research date: **2026-10-28**. Theme: agent harnesses and architecture. **I — Recommendation:** start with a small public contribution that produces evidence about a changing harness. The best candidates are **P01, shim-retirement evidence; P02, settings across restart; and P03, nested Code Mode artifact fixtures**. None is a validated business or an empty category. Their useful scope is smaller than their names suggest.

**I — Main finding:** the corpus does not support a single conclusion that harnesses disappear. It supports three simultaneous movements: models absorb temporary scaffolding; durable state and authority move outside disposable execution; and generated programs make the familiar tool-by-tool interface less informative. Better models can remove a prompt workaround. They cannot reconstruct an unknown external effect, determine an organization's authorization, or tell a disconnected client which work it still owns without runtime support.

**F — Reading and evidence method.** Read in full the per-video digests, recurring themes, prior-art triage and top-five sections of **E01–E11** and **Connect 01–05**. Read matching ledger rows using variants of harness, Pi/Pi Durable, Amp/Orbs/Puck, Claude Code, OpenCode, Codex, Factory, Exo, self-learning/self-modifying, sandbox, Code Mode/codemode, managed, durable/background, interrupt/steer/cancel/resume, permissions, settings/configuration, skills, and React. Followed important claims back to supplied caption blocks, including videos 04, 05, 08, 19, 31, 45, 47, 49, 50, 52, 53, 56, 63, 66, 68, 72, 80, 86 and 88. Search matches on “durable skills” in human careers, generic GPU frameworks, and unrelated UI tools are not independent harness signals.

**F — Background constraints:** [research summary, especially §§11–12](/Users/noah/code/sofort/arch/research/RESEARCH-SUMMARY.md), [stack summary](/Users/noah/code/sofort/arch/research/stack/SUMMARY.md), and [Connect summary](/Users/noah/code/sofort/arch/research/connect26/SUMMARY.md). Generic durable hosting, a brain on a Durable Object, persistent filesystems, heap snapshots/forks, another Code Mode, a skill marketplace, generic agent self-extension, model routing, auth/MCP gateways, review loops and agent Git hosting remain killed as new pitches. No new transcript evidence reopens those broad categories. Specific tests and contributions below do not imply that their underlying runtimes are missing.

**Labels:** **Q** = supplied quotation or attributed experience, including unverified numerical claims; **F** = externally sourced fact or directly inspected documentation; **I** = synthesis, proposed scope or judgment; **E** = estimate, proposed acceptance target or score. Caption timestamps are minute buckets, not exact utterance seconds. Ellipses shorten quotations; bracketed repairs are explicit. Project demos describe proposed behavior, not software built in this research. No external package was installed or benchmark reproduced.

## 1. Signal clusters

### C1. Temporary scaffolding expires; runtime obligations do not

**I — Convergence count:** **six independently attributable speakers / six organizational perspectives / five publishing channels** in the counted set: Jediah Katz (SpaceXAI, AI Engineer), Thariq Shihipar (Anthropic, AI Engineer), Matan (Factory, Claude), Ras Mic/Michael (Peter Yang), Geoff Huntley (Armin Ronacher), and Theo (Nerd Snipe). Repeated Theo appearances are one speaker; Geoff's deletion advice is an opinion rather than a measured result. Fuad Ali and Andrew Qu below are additional architectural counterexamples, counted in C7 instead of inflating this count. Independent organizations appearing on AI Engineer do not create extra publishing channels.

| Signal | Video · timestamp · speaker | Q — source anchor | I — implication and qualification |
|---|---|---|---|
| C1.1 | [66 03:00–06:00][v66], Jediah Katz | “The model has natively absorbed these skills.” | Edit-model and other guardrails became unnecessary as models improved. This is removal of particular scaffolding, not removal of state, execution or policy. |
| C1.2 | [66 06:00–08:00][v66], Katz | “cost” / “new domains” | Similar task scores can coexist with different token and runtime costs. New tasks introduce new holes and shims. |
| C1.3 | [66 12:00–16:00][v66], Katz | “permissions ... scoped down to specific agents and specific people”; “whenever a shim stops firing ... a PR” | Runtime, authorization and efficiency remain. Cursor/SpaceXAI already tracks shims centrally and proposes deletion; an activation counter is occupied ground. Non-activation without eligible exposure does not establish safe retirement. |
| C1.4 | [70 06:00][v70], Thariq Shihipar | “80%” | Anthropic removed a large portion of a system prompt. The reported fraction is a particular development example, not evidence to strip every application constraint. |
| C1.5 | [72 08:00–09:00][v72], Matan, Factory founder | “filling this hole in the meantime” | Factory describes model, harness and company knowledge as different contributions; the prior harness can become model capability. Monthly reassessment is part of their own practice. |
| C1.6 | [04 43:00–44:00][v04], Ras Mic/Michael and Peter Yang | “we tend to use less and less skills”; “no agents.mmd with no skills” | Ras Mic starts a new-model baseline without accumulated scaffolding, then restores his workflow. Peter distinguishes personal taste from general engineering instructions. This is a useful experimental control, not permission to remove established authority rules. |
| C1.7 | [15 44:00–47:00][v15], Theo | “half” / skills' model dependence | Accumulated Markdown was deleted as models improved; model-specific skill cost and behavior can change. The captions describe personal experience, not a controlled ablation. |
| C1.8 | [80 40:00][v80], Geoff Huntley | “delete” / “AGENTS” / “skills” | His new-model reset advice is intentionally aggressive. Treat it as a testable hypothesis about baggage, not a general operational prescription. |

**F — Current classification:** **Shipped/Being built:** harnesses, prompt simplification and automated shim inventories; **Open, narrowly:** public evidence that distinguishes obsolete protection from an unexercised code path. Contemporary counterevidence is conditional: [Liu and Han, October 2026][harness-tokens] find cost and runner differences with limited correctness separation on their tasks; [Fan et al., September 2026][harness-design] find design choices matter differently across models and settings; [Apple/EPFL, October 2026][apple-harness] report a competitive minimal baseline in autonomous ML engineering. These do not establish universal equivalence. Closest residual: **P01**, with **P16** measuring accepted outcomes rather than another leaderboard.

### C2. Durable ownership is different from keeping a sandbox alive

**I — Convergence count:** **six independently attributable speakers / five organizational perspectives / five publishing channels**: Mario Zechner and Armin Ronacher (one Earendil perspective, Fragmented), Scott Tolinski (Syntax), Katelyn Lesse (Anthropic, Latent Space), Justin Schroeder (Standard Agents/Braid, Cloudflare Connect), and Theo (t3.gg). Ashley Peacock is an additional platform explanation, not an independent customer report. Anthropic's product colleague Angela Jiang does not add another independent implementation.

| Signal | Video/talk · timestamp · speaker | Q — source anchor | I — implication and qualification |
|---|---|---|---|
| C2.1 | [05 15:00–19:00][v05], Zechner/Ronacher | “intent” / “result”; explicit phases | Pi Durable records the effect boundary and an explicit program counter. Wrapping opaque Pi in one Temporal activity does not make its internal work resumable. Verbose explicit workflows became more tolerable when agents could write them. |
| C2.2 | [05 20:00–23:00][v05], Zechner/Ronacher | “bash” / “monster in the room” | A replay-safe read may see a changed world. Arbitrary shell actions cannot be blindly retried after interruption; unknown external effect requires reconciliation rather than a fabricated success or a duplicate action. |
| C2.3 | [05 23:00–24:00, 34:00][v05], Zechner/Ronacher | “background” / “compaction” | Owned children, compaction and normal work may coexist. A durable task graph and small watched deltas are more expressive than one linear transcript. |
| C2.4 | [56 02:00–07:00, 12:00–14:00][v56], Scott Tolinski | “delete about 8,000 lines”; “same Sentry issue for one pull request” | An independent adopter reports replacing brittle sockets, persistence and resumption code with Pi Durable. He still wrote admission/duplicate-work rules above it. Storage durability is not business deduplication. |
| C2.5 | [50 1:03:00–1:07:00][v50], Lesse/Jiang | “brain separate from the hands”; “your whole agent doesn't die” | Anthropic separated the durable harness and state from execution environments, initially for reliability/latency, then emphasized credential isolation. The source also makes strong security claims that are not independently certified here. |
| C2.6 | [01 05:00][v01]; [88 42:00][v88], Theo | “continue when I had to reboot machines”; “bumping me down to medium when it crashed” | Local goal continuity and execution settings are separate recovery obligations. The effort anecdote is not a reproduced Codex defect. |
| C2.7 | [Connect 11 01:00–06:00][connect11], Justin Schroeder | “Follow up with every lead”; “persistent thread state and telemetry and isolate namespaces” | A short business request hides finite execution policy, scheduling, conversation continuity and consistent writes. This practitioner is also building Standard Agents. |
| C2.8 | [Connect 11 09:00–18:00][connect11], Schroeder | “we have to send the entire history back”; “128 MB”; “one alarm” | Hydration, history growth, filesystem representation and multiplexed logical schedules are real constraints. His O(N²), cold-start and limit claims are workload/talk claims, not universal runtime laws. |
| C2.9 | [Connect 11 27:00–31:00, 39:00–41:00][connect11], Schroeder | “eternally booting itself up”; “a second durable object”; “a small percentage of time when it fails” | Alarm/watchdog workarounds can create loops and still lose liveness. Sparse production failures need lifecycle fixtures; the quoted historical 30-second behavior must not be substituted for current documentation. |
| C2.10 | [05 52:00–55:00][v05], Ronacher/Zechner | “We are not experts on these infrastructure pieces” | They explicitly request host expertise on scheduling, inboxes and lifecycle. This is a contribution invitation, not an empty durable-hosting category. |
| C2.11 | [Connect 09 03:00–06:00][connect09], Ashley Peacock | “somewhere to run our AI agents that's economical” | The platform supplies the basic per-object persistence/compute mechanism. Object creation does not remove per-object limits. |

**F — Current classification:** **Shipped, with experimental APIs:** [Pi Durable][pi-durable], [Cloudflare's Pi harness][cf-pi], and [Vercel durable-harness][durable-harness]; **Shipped managed architecture:** [Anthropic Managed Agents][managed]. The [Pi/Cloudflare sample][pi-cf] already contains restart, scheduler, inbox and storage-conformance work. A new host adapter or generic conformance suite would repeat it. Cloudflare's [2026-10-01 pending-I/O keepalive change][do-keepalive] addresses an important historical complaint, but a bounded pending operation is not a guarantee that an entire agent lives forever. Deployment grace/recovery statements in the Connect ledger remain roadmap unless a release source establishes delivery. **Open conditional slices:** application effect fixtures (**P09**) and a compatibility drill across existing adapters (**P17**). Fleet topology/global telemetry are genuine wishes; tracing/service-graph systems and runtime owners are closer than a new generic dashboard.

### C3. Interrupt, steer, cancel, follow up and disconnect have different owners

**I — Convergence count:** **six speakers / five organizational perspectives / six publishing channels**: Armin Ronacher (Earendil, Fragmented and Armin Ronacher), Thorsten Ball and Quinn Slack (one Amp perspective, Amp channel), Alex Krentsel (Exo, Latent Space), Ben Davis (Ben Davis), and Theo (Nerd Snipe). Armin appears on two channels but remains one practitioner. Most Amp episodes below share builders and infrastructure; ten demonstrations are not ten independent deployments.

| Signal | Video · timestamp · speaker | Q — source anchor | I — implication and qualification |
|---|---|---|---|
| C3.1 | [05 34:00–37:00][v05], Ronacher | “inbox” / watched deltas | Inbox delivery at safe points, live clients and queued work differ from appending a user turn to a transcript. |
| C3.2 | [80 35:00–41:00][v80], Ronacher | “five people” / “steer” / “follow-up” | Background compaction plus simultaneous Slack users breaks the linear transcript model. Steering can cancel current inference; a follow-up can wait. A client disappearing must not imply withdrawal of all durable work. |
| C3.3 | [52 31:00–32:00][v52], Krentsel | “second chat”; job-control/signals discussion | An OpenClaw conversation became uninterruptible, so he opened another conversation to ask status. He proposes OS-like job control/pubsub; this is both concrete pain and a speculative API direction. |
| C3.4 | [15 33:00–36:00][v15], Theo and Nerd Snipe discussion | “progress”; full-send/full-stop | Shelling out to another agent obscured progress. Theo distinguishes permission to land work from finishing locally for review; an output message is not always a usable request for intervention. |
| C3.5 | [16 55:00–56:00][v16], Theo | user will not read a final answer | Fully unattended flows need an explicit question/attention path when intervention is necessary. A normal final paragraph can disappear into a background run. |
| C3.6 | [29 05:00, 11:00][v29], Ben Davis | “approve five things per turn” | Frequent approvals trained him to stop reading; steering rescued a wrong turn during a long task. Friction and control cannot be ranked with one approval-count metric. |
| C3.7 | [37 10:00, 22:00–23:00][v37], Thorsten Ball | snooze trigger; runner messages/files | An async wakeup failed for a day; cloud work delegated to a real Mac via a runner. Control must span a sleeping task, a remote agent and a local execution host. |
| C3.8 | [43 04:00–06:00][v43], Ball | “click on this to steer” | Feedback can arrive before commit/push; an orb can end with local uncommitted state. A portal is an existing product, not a missing UI category. |
| C3.9 | [51 09:00–12:00, 23:00–27:00][v51], Quinn Slack | startup “number one complaint”; stable interface discussion | Startup and resume behavior matter to real use; stable frontend/backend contracts are desired. Conditional CI consolidation depends on independent evidence and reproducible execution, not merely the same agent saying it tested. |
| C3.10 | [66 15:00–17:00][v66], Katz | “subscribe to an event” | Slack, CI and timer wakeups already share one internal primitive. Event subscriptions are not a new category; delivery, cancellation and acknowledgement races remain concrete contract cases. |

**F — Current classification:** **Shipped:** Amp runners/portals/Puck control; **specified/being implemented:** [ACP cancellation, resume and config contracts][acp]; **Shipped tooling:** [oneharness turn control][oneharness]. ACP v2 material is a draft protocol baseline with feature negotiation, not proof that every adapter conforms. Its separation between accepted prompts, running/idle/requires-action state, cancellation and late updates already resolves much of the vocabulary. **Open only after checking existing tests:** race fixtures in a real adapter (**P04**), rather than a replacement interruption protocol. **P20** covers an orthogonal question: whose audience and authority survive a handoff.

### C4. Skills are portable files; invocation, policy and effective settings are not equivalent

**I — Convergence count:** **nine people/attribution units / seven organizational perspectives / six publishing channels**: Ras Mic and Peter Yang (two independent practitioners, Peter Yang channel); one Jane Street discussion unit (voices not reliably separated); Uday (Uber, The Pragmatic Engineer); Thorsten Ball and Quinn Slack (one Amp perspective); Wes Bos and Scott Tolinski (one Syntax/Sentry perspective); and Theo (t3.gg). Matt Pocock and Eric Tech below add practices/secondary discussion, not extra firsthand deployment votes in this count. A changed skill used by many Amp threads is still one organizational observation.

| Signal | Video/talk · timestamp · speaker | Q — source anchor | I — implication and qualification |
|---|---|---|---|
| C4.1 | [04 01:00, 16:00–20:00][v04], Ras Mic; Peter Yang | “model and harness agnostic”; “not very reliable in following my skills” | A small portable instruction set is attractive; installed review/cleanup instructions were sometimes skipped. Presence, loading, invocation and successful outcome are distinct observations. |
| C4.2 | [08 1:07:00–1:12:00][v08], Jane Street discussion | “untold impact on different parts of the firm”; “don't always have all the right plug points” | They replaced internal context bundles with the public skills pattern, while retaining custom tools and third-party clients. Cross-firm consumers make shared edits costly; consistent sandboxing still needs shims at suitable hooks. |
| C4.3 | [19 25:00, 34:00–38:00][v19], Uday, Uber | “carry forward all of my settings, all the skills, all the tools”; “settings are synced” | AIFX already wraps harnesses, personas, installs and settings. A skill monorepo plus shared quality gates exists; trace-generated improvement patches are in flight. This is strong demand and strong prior art simultaneously. |
| C4.4 | [35 39:00–43:00][v35], Ball/Slack | “isn't picking up the skills”; “don't know that” | Switching agents silently changes whether the shared instructions are used. Shared edits can make other threads worse. They put invariants into AGENTS.md; that is a workaround, not proof the invariant is enforced. |
| C4.5 | [36 19:00][v36]; [13 16:00–17:00, 46:00–48:00][v13], Slack; Dax | provider endpoint differences; “switch my whole tooling stack” | Provider, endpoint and serving quality matter alongside model identity. OpenCode already supports model choice; a model name alone is insufficient reproduction metadata. |
| C4.6 | [53 07:00–11:00][v53], Wes/Scott | “it still gets out of sync”; “18 different skills”; “I didn't mention SvelteKit” | A Git repo did not prevent machine drift. Global context incorrectly imposed SvelteKit on a scripts-only project. A per-chat skill picker is requested; some saved procedures should have been scripts. |
| C4.7 | [86 02:00–04:00, 24:00–28:00][v86], Theo | “graph of skills”; “full stop”; multiple manual invocation discussion | Theo already maintains fleet configuration and composed skills. Trigger intent, transitive end states, manual versus inferred invocation, and duplicate context are separate behavior cases. His claims about particular Claude Code invocation behavior are observations at recording time, not a current universal specification. |
| C4.8 | [88 42:00][v88], Theo | “bumping me down to medium when it crashed” | A user may intend an effort setting different from the apparent restored setting. Compare intent, UI, submitted configuration and applied per-turn updates; do not infer effective effort from one field. |
| C4.9 | [23 30:00–33:00, 67:00–74:00][v23], Matt Pocock | editable skills; A/B discussion; feedback loop | Distribution, auditing and skill improvement are already active work. Collaborative grilling and expert preferences differ from universal prompt optimization. |
| C4.10 | [61][v61], Eric Tech discussing Pstack | maintenance-loop discussion | Useful secondary account of selective loading and shared skill maintenance. It does not independently validate Cursor internals. |
| C4.11 | [Connect 02 21:00][connect02]; [Connect 08 06:00][connect08], Ryan Skidmore; Andreas Salme | “21” skills; same agent through two harnesses | Internal review skills and VSCO's alternate entry points already exist. A changing harness/model prompt must not silently erase stable business prerequisites. |

**F — Current classification:** **Shipped:** [Agent Skills format][skills-spec], Uber's internal AIFX, [skill-up][skill-up], [skilltest][skilltest], [oneharness][oneharness], and Pi's [drift][drift]. **Draft specification with implementations:** GitHub's [Unified Agent Session Specification][session-spec], including prompt/skill provenance and model-routing outcomes. **Research already published:** [cross-framework skill robustness][skill-robustness]. A generic skill evaluator, instruction provenance viewer, config sync CLI or “skills portability benchmark” is occupied. **Conditional residuals:** crash/config-update fixtures (**P02**); consumer-owned regression cases (**P05**); intent-combination cases (**P14**); learned-rule condition preservation (**P21**). This is the clearest cluster where demand should not be mistaken for an unbuilt tool category.

### C5. Code Mode compresses the interface while moving the hard boundary underneath it

**I — Convergence count:** **six people/attribution units / six organizational perspectives / five publishing channels**: Mikyo King (Arize, AI Engineer), Matt Carey (Cloudflare channel), Armin Ronacher and Geoff Huntley (different perspectives, Armin Ronacher channel), one Jane Street discussion unit (Jane Street), and Greg Pstrucha (Sentry, Cloudflare Connect). Arize's Fuad Ali is the same organization as King and adds no independent organizational vote. Sunil Pai and Anthropic provide adjacent architecture explanations rather than additional field failures here.

| Signal | Video/talk · timestamp · speaker | Q — source anchor | I — implication and qualification |
|---|---|---|---|
| C5.1 | [11 19:00][v11], Sunil Pai/Next Token discussion | “You're just giving it a different way to call tools” | Bash or a generated program changes the invocation interface; it does not eliminate external capabilities or their owners. |
| C5.2 | [47 08:00–09:00][v47], Mikyo King | operations one through five versus the sixth; generated-code debugging | Resource lifetime, networking and secrets remain. Permission combinations and generated programs create failures different from a wrong named tool. This is an architectural talk, not a measured failure-frequency study. |
| C5.3 | [47 10:00–11:00][v47], King | “double” sandbox discussion; images/binary | A Code Mode MCP server inside a Code Mode harness introduces another serialized boundary. Partial failure/resume and returning an image without flooding model context are distinct issues. A signed handoff is suggested, not demonstrated as a new protocol. |
| C5.4 | [48 05:00–18:00, 22:00–23:00][v48], Matt Carey | “1,000 tokens”; resource cleanup | Search/execute across a large API and SDK generation from MCP/OpenAPI already ship. Model-visible schema compression does not remove created-resource cleanup or application authorization. |
| C5.5 | [48 33:00–42:00][v48], Carey | DSL replacement; MCP portals; controls | Replacing narrowly designed DSLs and connecting more APIs are predictions/roadmap. API-handler authorization remains necessary underneath generated code. |
| C5.6 | [80 59:00–1:07:00][v80], Ronacher | models avoiding the edit tool; “code golf” | Models increasingly generate programs instead of the tool shapes harness designers expected. The “80%” observation is anecdotal and model-dependent; workspace shell execution and harness-local Code Mode are different execution locations. |
| C5.7 | [80 1:08:00–1:10:00][v80], Ronacher; Huntley | “Pi will probably very soon hide the tool output”; “everything is just like just bash” | A tool-specific UI no longer explains arbitrary programs. Ronacher calls hiding output a regression and floats a commentary model. Huntley independently recalls losing Amp's per-tool UX. It is not evidence that Pi has already shipped this change. |
| C5.8 | [05 54:00–55:00][v05], Zechner/Ronacher | resampling one failure prefix | Prompt/Code Mode behavior depends on model training. Sampling one prefix many times is an empirical debugging technique, not a general effectiveness benchmark. |
| C5.9 | [08 34:00–35:00, 46:00, 1:11:00–1:12:00][v08], Jane Street discussion | notebook permissions; RPC endpoint authority; sandbox shims | The useful authority boundary is an application endpoint/capability, not simply the host the agent can reach. Third-party harness hooks can be insufficient for a consistent execution policy. |
| C5.10 | [Connect 04 00:00–04:00, 18:00–20:00][connect04], Greg Pstrucha | “secret instructions within the skill”; “MCP is kind of out of our hands”; “cases we don't know” | Upstream data labeling helps but cannot enforce arbitrary downstream consumers. Sentry operates screening and feedback paths; this does not justify another generic injection classifier or a claim that stronger models solve all authority problems. |

**F — Current classification:** **Shipped:** Cloudflare Code Mode, Pi Code Mode, PydanticAI/Monty, Docker agent Code Mode and AgentUse; **Being built/prototype:** LeanProxy's optional Code Mode spike. Their permission semantics differ. [Docker][docker-code] documents approval at the whole-script boundary. [AgentUse][agentuse] routes code through its normal policy/effect dispatch. [PydanticAI][pydantic-code] supports typed values and explicit deferred-tool handling. [Pi][pi-code] already handles image blocks, saved image paths, per-script state and nested call records; it prevents recursively starting its own Code Mode tool. [MCP 2026-07-28][mcp-tools] already defines image/resource-link/structured outputs. These kill proposals for “invent binary tool results,” a generic nested tracer, or a new durable Code Mode. **Open conditional slices:** an actual cross-boundary artifact lifetime/cancellation fixture (**P03**) and a factual effect display over existing events (**P06**). Do not present trace visibility as comprehensive enforcement or infer unobserved side effects from a generated explanation.

### C6. Self-learning already exists; what changes, who judges, and what survives are separate questions

**I — Convergence count:** **six people/attribution units / five organizational perspectives / four publishing channels** in the direct-practice set: Mario Zechner and Armin Ronacher (Earendil, Fragmented), Alex Krentsel (Exo, Latent Space), Uday (Uber, The Pragmatic Engineer), one Every team unit (Claude), and Matt Pocock (The Pragmatic Engineer). Fragmented #311's Yuri and unnamed co-host report others' systems; they are not extra independent implementers of those systems. Mario and Armin share the same project. The strength is convergence on evaluation/maintenance needs, not six verified self-improving production harnesses.

| Signal | Video · timestamp · speaker | Q — source anchor | I — implication and qualification |
|---|---|---|---|
| C6.1 | [63 00:00–07:00][v63], Fragmented hosts, including Yuri | “Self-learning harnesses feels like that next big thing”; “What happens if one instruction overwrites the other?” | Distinguish passive memory, skill generation, plugin installation and modification of the agent loop. The hosts describe DeepSeek's plugin kernel and live in-memory candidate testing; this is secondary product discussion. |
| C6.2 | [63 08:00–12:00][v63], Yuri | “function calls and variables”; “contribute to the harness states while the work is being done” | Prime's REPL represents context and delegation programmatically. It is named available prior art, not an invitation to invent persistent REPL orchestration. |
| C6.3 | [05 35:00–40:00][v05], Zechner/Ronacher | “candidate”; versioned interface/state discussion | Plugin replacement across server, web and Node TUI needs validation, in-flight draining and old-state compatibility. The described candidate system is not claimed battle-tested. A server-delivered local Node plugin also carries a different trust boundary from a browser plugin. |
| C6.4 | [05 41:00–47:00][v05], Zechner/Ronacher | “it basically removed everything”; “just left a shell” | Mario reports an optimizer deleting Pi to meet a startup-time objective. A hypothetical optimizer deleting human UI is separate from this actual example. Cheap evaluator success is not preservation of the product contract. |
| C6.5 | [05 46:00–47:00][v05], Ronacher | rollback after successive self-updates discussion | A long chain of dependent changes makes rollback more complicated than reverting the latest code. The million-line scenario is hypothetical. Narrow optimization may generalize poorly or become expensive. |
| C6.6 | [52 16:00–20:00, 38:00–41:00][v52], Krentsel | mutable executive; protected state; “do nothing” cost objective | Exo separates editable executive code from history/secrets/artifacts and uses rebuild/replace/soak/rollback. Its reported Discord context optimization is task-specific; cost-only evaluation can reward not doing the task. A soak test detects basic liveness, not preserved quality. |
| C6.7 | [19 35:00–38:00][v19], Uday | “generate improvement patches for the skills” | Trace-driven skill improvement is already being built at Uber. Shared downstream quality, not generating another patch, is the difficult residual. |
| C6.8 | [73 07:00–12:00, 15:00–16:00][v73], Every team | editorial edit learning; improvements not spreading | They report deriving style from about 30,000 edits, while personal workflow gains fail to propagate. Production-state copies enable experiments. These are owner-specific knowledge loops, not proof every skill should be globally promoted. |
| C6.9 | [23 52:00–54:00, 67:00–74:00][v23], Pocock | spec updates worsened results; A/B and factory discussion | Human and agent edits can regress outcomes. Editable source and an evaluator are already part of his workflow. |
| C6.10 | [82 1:26:00–1:36:00][v82], Ronacher/Ben Vinegar discussion | compatibility shim; global-variable interference | Passing extension examples can still destroy the intended design or fail under composition. Module/global state and plugin ordering create non-local behavior. |

**F — Current classification:** **Being built/open preview:** [DeepSeek Harness/Cordis][deepseek], [Exo][exo]; **Shipped research code:** [Prime Agent][prime], [Harness Training][harness-training], [skill-up][skill-up]. Exo's October README emphasizes a neutral hosting runtime/adapters and labels unfinished work; the interview's recursive architecture must not be assumed to describe every current feature. Henry Pan's [May experiments][pan-experiments] already document evaluator gaming, budget changes and task-specific logic; the [July framework][harness-training] preserves measured candidates and promotion history. A generic self-improvement framework or anti-reward-hacking benchmark is taken. **Conditional contributions:** plugin failure fixtures (**P07/P18**), a product-contract case that defeats a shallow optimizer (**P08**), and preserving conditions in learned rules (**P21**). “Self-learning” is not itself a differentiation claim.

### C7. Context, plan and completion ownership are still application decisions

**I — Convergence count:** **six speakers / six organizational perspectives / five publishing channels**: Fuad Ali (Arize, AI Engineer), Andrew Qu (Vercel, AI Engineer), Matt Pocock (The Pragmatic Engineer), Adam Jacob (Swamp Club, Syntax), Ben Davis (Ben Davis), and Theo (Nerd Snipe). This is convergence on context/verification design, not six independent demonstrations that one architecture wins. Arize's Ali/King talks are one organizational perspective where both are used.

| Signal | Video · timestamp · speaker | Q — source anchor | I — implication and qualification |
|---|---|---|---|
| C7.1 | [45 02:00, 07:00–09:00][v45], Fuad Ali | “20 plus iterations on the to do tools themselves”; “explicit finish call” | To-do bookkeeping consumed work; the harness eventually rendered plan state and enforced completion. Text without a tool call incorrectly meant “done” for models that announce before acting. They allow customer-chosen providers, so native behavior varies. |
| C7.2 | [45 09:00–14:00][v45], Ali | “up to three times”; “8,000 characters”; “10 specialists” | Their explicit gate, bounded retries, pointer-based large results, small per-user memory and rollback to one skill-loading agent are concrete application choices. They are not universal optimal constants. Background memory writes need user separation. |
| C7.3 | [68 05:00–11:00][v68], Andrew Qu | summaries between agents; “30%”; filesystem/bash | Vercel found handoffs/summary chains impaired its application. An evaluation increase coexisted with poor user experience; a simpler filesystem/bash design reportedly improved task outcomes. Eve is already released. |
| C7.4 | [31 15:00–16:00][v31], Ben Davis | “This thread is poison. This thread already knows too much.” | A fresh simulated user replayed original prompts. The supervising agent also steered the run, so the improved workflow was not an unassisted independent holdout success. Record interventions rather than laundering them into the score. |
| C7.5 | [37 29:00–33:00][v37]; [39 03:00–06:00][v39], Ball/Amp team | fresh orbs; control group; missing browser | They run several clean instances, notice hints contaminate results, and see summaries claim success despite a deliberately missing capability. Source revision, loaded context and negative controls matter. |
| C7.6 | [41 02:00–03:00, 13:00–20:00][v41], Amp team | Nix config failure; global `process.cwd()`; token environment | Environment assumptions and shared process state can masquerade as model failure. A missing token or read-only global path is not evidence of insufficient model intelligence. |
| C7.7 | [14 20:00, 1:07:00, 1:42:00–1:43:00][v14]; [16][v16], Nerd Snipe discussion | product/harness changes; stale prompt; goal plateau | Harness choices can make a weak model useful; old prompts can distort newer models. Long-running goals can lose the objective or plateau. Training-specific behavior should not be inferred to transfer to every harness. |
| C7.8 | [23 42:00, 69:00–74:00][v23], Pocock | incremental contexts; collaborative grilling | A fresh bounded task with a checkable result differs from collaborative requirements exploration. Context splitting alone does not supply a good specification. |
| C7.9 | [55][v55]; [69][v69], Adam Jacob; Zach Lloyd | application-specific factory; human specification/review | Factory boundaries and anti-corruption/checking layers vary by application. Warp already supplies lifecycle tooling and starter agents. A “factory” label does not identify an unbuilt generic platform. |

**F — Current classification:** **Shipped:** Eve, Arize's described design, [AgentUse outcome reporting][agentuse], skilltest/skill-up and conventional eval tooling. Generic plan managers, finish gates, clean-context runners and multi-agent orchestration are occupied. **Conditional contributions:** explicit finish-state fixtures (**P13**), contaminated-run/negative-control examples (**P12**) and a narrow accepted-outcome cost study (**P16**). A new model may eliminate a bookkeeping shim, but cannot retrospectively make an intervention-free trial out of a supervised one.

### C8. Managed execution does not answer whose permission or whose audience

**I — Convergence count:** **eight people/attribution units / seven organizational perspectives / six publishing channels**: Katz (AI Engineer), one Jane Street unit, one Every team unit (Claude), Ball and Slack (one Amp perspective), CJ Reynolds (Syntax/Sentry), Patrick Collison (Stripe, Claude), and Lesse (Anthropic, Latent Space). The two Claude guests are independent companies but one publishing channel. Product demonstrations and opinions are weaker evidence than the named deployment boundaries.

| Signal | Video/talk · timestamp · speaker | Q — source anchor | I — implication and qualification |
|---|---|---|---|
| C8.1 | [35 46:00–47:00][v35]; [51 16:00–18:00][v51], Ball/Slack | time/task-limited production access; ambient laptop credentials | Scoped cloud grants can be narrower than a developer's laptop authority. This is a product claim/practice, not evidence that every runner inherits the restriction. |
| C8.2 | [37 22:00–23:00][v37]; [38 33:00–43:00][v38], Amp team | same action via orb/Puck; attached hardware | Existing runners bridge cloud agents to local Mac/hardware and filesystem assumptions. A standard remote command does not imply a standard principal or workspace isolation. |
| C8.3 | [60][v60], CJ Reynolds | VM versus project separation | Local and remote agents both need an explicit scope. Running inside a VM does not automatically isolate projects from each other. |
| C8.4 | [46 09:00–13:00][v46], Jack Wotherspoon | separate interactions/environment; credential proxy | Google DeepMind presents managed environments, fresh context over common files, tools/skills/triggers and credential handling. It is existing supply, not a blank managed-agent opportunity. |
| C8.5 | [50 34:00–46:00, 1:03:00–1:07:00][v50], Lesse/Jiang | preferences; managed integration; secret proxy | Users disagree about laziness versus initiative. Managed agents absorb integration work; identical sandbox infrastructure can support distinct harness behavior. External vault/egress design does not decide whether an otherwise authorized action is appropriate to the request. |
| C8.6 | [52 27:00–28:00][v52], Krentsel | routine task asking for AWS keys | Keeping keys in a vault is necessary but insufficient when a task can induce authorized misuse through an allowed capability. This is not a claim that the proposed guardian has solved semantic authorization. |
| C8.7 | [73 13:00, 16:00–20:00, 25:00–26:00][v73], Every team | managed because they do not want infra; different requester context | Shared coworkers need user-specific permissions/memory and careful public/private transitions. When an agent should interject is a product decision with an identified owner. |
| C8.8 | [66 09:00, 12:00–13:00][v66], Katz | “Acting versus asking”; people/agent scopes | Emailing a colleague and spending money require distinctions beyond model competence. Scope should survive delegation; unknown intent should remain unresolved rather than be guessed as authorization. |
| C8.9 | [75][v75], Patrick Collison | hard invariants; semantic permission discussion | Stripe already operates Minions. A longer-term permission problem is acknowledged, not solved by another prompt or a new sandbox wrapper. |
| C8.10 | [Connect 12 17:00, 33:00][connect12], TELUS speakers | CLI surface mismatch; custom permission bindings | A coding-agent CLI was the wrong surface for nontechnical users; organization-specific bindings and authority rules had to be built. The problem is application context, not lack of a generic agent shell. |
| C8.11 | [84][v84], Josh/Better Stack | green doctor output; missing macOS prerequisite | A setup diagnostic can be green while a needed platform capability is absent. The reported failure fraction is not independently reproduced. Kernel/network/process policy and application authorization are different tests. |

**F — Current classification:** **Shipped:** Managed Agents, NVIDIA OpenShell integration, Amp runners and [QM][qm] with scoped people/room workspaces. Amp's [shared-runner announcement][amp-shared] explicitly states that threads run as the machine user and share the runner directory. That is a documented boundary, not a discovered vulnerability. [Agent-trace][agent-trace] captures visible hook/proxy events, while [Codex rollout-trace][rollout-trace] represents execution structure; neither establishes complete OS-level visibility from a transcript alone. **Conditional residuals:** a runner authority receipt (**P10**), audience-transition fixtures (**P20**), and a deliberately unresolved application-action study (**P15**). Generic identity, secrets vaults, sandboxing and shared-agent hosting are not reopened.

### C9. The missing “React” is an unanswered abstraction question, not a framework specification

**I — Convergence count:** **six speakers / six organizational perspectives / six publishing channels** for adjacent interface pressure: Sunil Pai (Cloudflare, Latent Space and Next Token), Scott Wu (Cognition, Modal), Dax (OpenCode, Baseten), Quinn Slack (Amp, Latent Space), Justin Schroeder (Standard Agents, Cloudflare Connect), and Adam Jacob (Swamp Club, Syntax). **Only one of them makes the React claim.** Their disagreement about the right shape is evidence against pretending they asked for the same framework.

| Signal | Video/talk · timestamp · speaker | Q — source anchor | I — implication and qualification |
|---|---|---|---|
| C9.1 | [49 03:00–05:00][v49], Sunil Pai | “no one has built the React yet” | He wants an original portable abstraction across languages, companies and infrastructure. The host suggests skills; Pai questions whether precise English becomes code, while welcoming a possible Markdown future. He does not specify a new TypeScript framework. |
| C9.2 | [49 13:00–14:00][v49], Pai | original work near capability limits | His explicit advice resists another framework built by copying existing patterns. Reconcile the metaphor with that instruction before proposing infrastructure. |
| C9.3 | [11 50:00–1:05:00][v11], Pai/Next Token hosts | “so bad at SDK design” | Executor/workspaces/custom tools expose hard abstraction choices. App tools, storage, skills, UI and triggers already have active builders; not every integration inconvenience implies a missing universal layer. |
| C9.4 | [10 09:00–14:00][v10], Scott Wu | form factor follows models; outcome ownership | Cognition forecasts persistent agents owning outcomes and more automatic initiation. The reported 91% initiation figure is not a completion/success rate. His commodity/frontier split is a forecast. |
| C9.5 | [13 46:00–48:00][v13], Dax | “switch my whole tooling stack” | A stable tool surface can coexist with changing models. OpenCode's provider curation is already part of that product. |
| C9.6 | [51 03:00–18:00, 32:00–35:00][v51], Slack | local development/CLI death; agents configure agents; “jellyware” | Cloud agents, agent-driven settings and remixable software are concrete product bets. Maintenance burden and user control remain; prediction does not establish an unoccupied business. |
| C9.7 | [Connect 11 35:00–38:00][connect11], Schroeder | “shared schema”; “agent standards very similar to how we had web standards” | Typed parent/child schemas have broken for him; English exchanges are his preference. Standard Agents already owns a standardization initiative. This is a counterpoint to assuming a rigid universal schema will be welcomed. |
| C9.8 | [55 54:00–56:00][v55]; [38 54:00–56:00][v38], Jacob; Amp discussion | factory/framework disagreement | A customer-specific factory and an extensible harness can both be useful without a common product category. |

**F — Current classification:** **Shipped/Being built:** Agents SDK/Computer, Pi Durable, Eve/durable-harness, ACP, Agent Skills, QM and other orchestration frameworks. Microsoft's [Agent Framework Harness][ms-harness] also composes session, approval, memory and looping capabilities. None proves the React analogy resolved, and none warrants claiming nobody is working on portable composition. **Ambiguous:** **P19**, a small scenario atlas that could reveal a missing common primitive; build no runtime until multiple existing implementations fail the same concrete scenario.

## 2. Current prior art and disposition

**F — Search boundary:** checked public GitHub repositories/readmes/issues, npm registry metadata, product documentation/changelogs, papers, creator blogs, HN and indexed X results on 2026-10-28. A repository README establishes documented implementation intent, not independent production validation. “Shipped” below means available in the stated channel; experimental releases and drafts are labeled. **Open** means a conditional residual not established as supplied by the inspected sources, not proof of absence across the internet.

| Area / closest art | F — current evidence and date/version boundary | I — what that removes; what may remain |
|---|---|---|
| Pi Durable / Cloudflare | [Pi Durable README][pi-durable], pinned `c466a359`; npm `@earendil-works/pi-durable` 1.4.0, October 21. [Cloudflare Pi docs][cf-pi] updated October 27. [Sample][pi-cf], pinned `dcb56ce2`, includes restart/inbox/scheduler and upstream storage tests. Experimental API. | Durable hosting, adapter skeletons and generic lifecycle conformance are taken. Application effect ambiguity and versioned integration fixtures need a concrete failing case. |
| Vercel durable-harness / Eve | [durable-harness][durable-harness], pinned `ea8aa406`, npm 0.0.1 October 23, wraps several existing harnesses; Claude Code/Codex use sandbox-backed execution. [Eve launch][eve], June 17, describes durable execution, approvals, environments and extensible channels. npm `eve`, not the nonexistent `@vercel/eve`, was checked. | Another common durable wrapper is especially weak. Do not imply the event log makes every arbitrary external action exactly-once. A migration drill may add evidence above existing adapters. |
| Managed agents | [Anthropic architecture][managed], April 8; [NVIDIA/OpenShell control article][managed-openshell], September 28. Session/harness/sandbox separation and external credentials are documented product architecture. | A durable brain with disposable hands and a vault is taken. Requester/audience semantics and business intent still belong to the application. |
| Exo / DeepSeek / Prime | [Exo README][exo], `58fa2ff5`, October 27; [creator release chronology][krentsel], July 16. [DeepSeek preview][deepseek] and plugin tutorial. [Prime Agent][prime], release/blog August 5 and current source. | Runtime adaptation is active work. Distinguish demonstrated historical prototypes from incomplete current hosting docs; do not sell “can edit itself” as the gap. |
| Self-improvement evaluation | [Pan's May experiments][pan-experiments]; [Harness Training][harness-training], `0900e8ac`, July 20; [author HN discussion][hn-training]. Frozen-model candidate training, promotion records and transfer questions are public. | Generic self-improvement experiments and candidate-vs-baseline gates are occupied. A product-specific invariant omitted by those experiments could be a useful contributed case. |
| Portable skill format/evals | [Agent Skills][skills-spec]; [skill-up][skill-up], `99894b35`, October 28; [skilltest][skilltest], `6c24be52`, October 18; [robustness paper][skill-robustness], August 14. Format, cross-engine runs, optional no-skill trials, simulated users, tool mocks and behavioral assertions are already available across these projects. | Neither another runner nor invocation-only pass/fail is justified. Residual: real consumer-owned regressions and natural dispatch cases that prompt injection of a skill body does not exercise. |
| Config/control transport | [oneharness][oneharness], `6e7c001b`, October 23, documents cross-harness command/config delivery, model readback on a supported path, live effort checks and interruption. [Drift][drift] profiles and measured Pi handoffs. | Generic config sync, model mismatch alarms and cancellation wrappers are taken. A crash/restart/config-update boundary may remain an upstream fixture. Unsupported observation must stay unknown. |
| Session provenance | [GitHub Unified Agent Session Specification][session-spec], draft v2.6.0 October 26. It includes source-dependent prompt/skill provenance, configured model versus observed routing, and effort/application information. | Do not invent another universal receipt schema. Reuse it where possible; its schema is not proof every native app emits all required evidence. |
| Codex settings | [Official configuration reference][codex-config] distinguishes layered/explicit settings and defaults. [Issue 44769][codex-effort-issue], September 11, reports UI effort reset before a message; [issue 48802][codex-resume-issue], September 27, concerns resume/cache-baseline changes while high effort remains in configuration updates. | Theo's crash story is a research lead, not a confirmed common bug. A low top-level field plus a later high update does not prove lower effective effort. Separate cache-prefix change, display reset and applied settings. |
| ACP | [v2 migration/protocol material][acp], `fe817758`, October 28; npm SDK 2.1.0 October 28. Draft/negotiated features, not uniform installed support. | A new job-control vocabulary is weak. Adapter race cases may still help; respect protocol-defined late-update and cancelled-turn semantics. |
| Code Mode policy/results | [Docker][docker-code], [PydanticAI/Monty][pydantic-code], [AgentUse changelog][agentuse] (`4092f5bd`, October 17), [Pi Code Mode][pi-code], [LeanProxy spike][leanproxy], and [MCP July 28 tools][mcp-tools]. | Existing result types, nested events, dispatchers, approvals and output budgets eliminate many generic pitches. Whole-script approval and per-inner-call approval differ intentionally; compare declared contracts rather than declare one universal bug. |
| Effect visibility | [agent-trace][agent-trace] is experimental hook/proxy capture with structural comparison; [Codex rollout-trace][rollout-trace] describes nested execution structure. Pi already records bounded nested calls. | A generic agent tracer is taken. A useful display must state coverage and loss, distinguish requested/permitted/attempted/observed/completed effects, and avoid manufacturing unseen actions. |
| Runners and shared agents | [Amp shared runners][amp-shared], September 24; [agents anywhere][amp-anywhere], July 8; [Puck cross-agent control][amp-puck], October 13; [QM][qm] provides people/room scoping. | Cloud-to-local control and shared coworkers are shipped. A runner machine user is a different authority boundary from an orb. Application-owned transition tests may be useful. |
| Harness effectiveness/cost | [Apple/EPFL][apple-harness], [Tokens, Mostly][harness-tokens], [conditional harness-design study][harness-design], and [prompt-induced waste][prompt-waste], all 2026. | A generic “does harness choice matter?” paper is no longer fresh. A reproducible accepted-outcome study with intervention, provisioning and model-serving controls has a narrower claim. |

**F — npm cross-checks:** inspected [Pi Durable registry][npm-pi], [durable-harness registry][npm-durable], [Code Mode registry][npm-code], [Eve registry][npm-eve] and [ACP SDK registry][npm-acp]. Versions observed: 1.4.0; 0.0.1; 0.5.5 (October 20); 0.86.0 (October 28); 2.1.0. Registry availability does not certify any particular documentation example or cross-vendor behavior.

**F — HN/X check and its limitations:** HN searches surfaced the [self-improvement author's discussion][hn-pan], [Harness Training launch][hn-training], [QM discussion][hn-qm], and [OpenCode 2 discussion][hn-opencode]. Creator comments help locate source code; discussion votes are not adoption or correctness evidence. Indexed X searches included harness/shim, Code Mode/nested, skills/harness/portability, Pi Durable, Exo/exoharness and the self-improvement author. No directly verified primary X post changed the classification; a repost mirror was excluded. Lack of an indexed X hit is not evidence of an empty category. These community searches informed discovery; technical claims above rely on the linked implementation/docs/papers.

**I — Kill-list reconciliation:** the tempting “big ideas” are the most occupied: runtime hosting (C2), universal tool execution (C5), a self-improving loop (C6), and a React-like framework (C9). The remaining proposals mostly belong inside those projects. Better models may make some fixtures obsolete; that is a successful kill outcome, not a reason to inflate a fixture into a platform.

## 3. Projects of every size

**E — Scoring convention:** the vector is **cool / Cloudflare–Vercel–TypeScript adjacency / real gap / value / survives better models / not GrowOS**, each 1–5. Gap scores are deliberately modest because many closest projects already have the machinery. Scores assess the residual scope, not the attractiveness of the larger occupied category. Size estimates assume an individual contributor; access to authentic private failures is an additional dependency. Big candidates can collapse into a tiny upstream contribution after the kill test.

### P01 — Shim-retirement evidence packet

**Q — Sources:** C1.3, Katz: “whenever a shim stops firing ... a PR”; C1.6, Ras Mic: “no agents.mmd with no skills”; C1.5, Matan: “filling this hole in the meantime.”

**I — One sentence:** attach eligible-exposure counts, paired removal trials and a rollback condition to the proposed deletion of one temporary model workaround.

**I — 30-second demo:** a deletion bot says a shim has not fired in a week. The report shows that no eligible task ran, so the decision is **insufficient evidence**. Replay matched eligible tasks with and without the shim under the same model/endpoint/settings; the packet exposes a rare regression hidden by the aggregate score.

**F / I — Closest art:** Katz's existing internal bot, [Harness Training][harness-training], [skill-up][skill-up], and the [conditional harness-design study][harness-design]. Those occupy inventories, ablation and promotion gates. The residual is the exposure denominator and a reviewable retirement decision for a real shim, using existing runners.

**I — Beneficiaries / owner:** harness maintainers and teams carrying model-era patches. The owner could readily implement this. The external contribution is a reusable case and evidence format across model transitions, not a moat or a replacement feature-flag platform.

**E — Initial step / kill test:** spend two days instrumenting one open shim with an explicit eligibility predicate and two model/settings combinations. Keep sampling and human intervention visible; do not equate zero observed failures with proof of safety. **Kill** if existing promotion tooling already produces the packet with trivial configuration, no maintainer can define eligible exposure, or no real retirement decision would use it. Publish a small case study instead of a new package if that is all the work needs.

**E — Size:** Small, 2–4 days. **Scores:** **4 / 5 / 3 / 4 / 5 / 5 = 26**. **I — Confidence:** medium on the pain; low-to-medium on reusable packaging.

### P02 — Effective settings across crash, resume and config update

**Q — Sources:** C4.8, Theo: “bumping me down to medium when it crashed”; C4.3, Uday: “all of my settings”; C4.5, endpoint differences.

**I — One sentence:** contribute a restart fixture that compares requested, displayed, submitted and observably applied model/effort settings without conflating them.

**I — 30-second demo:** select an effort level, terminate a disposable test process, resume, and inspect the next turn. A timeline shows the intended setting, UI/config value, wire configuration and later update; a low stale field followed by a high applied update is classified differently from a genuine downgrade. If the provider exposes no applied value, show **unobserved**.

**F / I — Closest art:** [oneharness][oneharness], [Drift][drift], [session provenance specification][session-spec] and [official Codex configuration][codex-config]. [Issue 48802][codex-resume-issue] is a warning against simplistic field comparisons. These sources substantially occupy the idea. Pi Durable's settings are live run policy rather than frozen conversation state, so a changed default can be intentional.

**I — Beneficiaries / owner:** native client and adapter maintainers, users with multi-day goals. Native owners should fix any native defect. An external contribution can provide a reproducible boundary fixture and sanitized evidence; it should not claim a universal settings authority.

**E — Initial step / kill test:** inspect the existing effort/model tests, reproduce one crash/resume path with a disposable account/workspace, and record configuration-update ordering. **Kill** a standalone tool if one existing test covers it, the discrepancy is only display/cache metadata, or effective policy cannot be observed. An unknown result remains useful evidence but is not a detected downgrade.

**E — Size:** Small, 2–3 days; likely Tiny upstream. **Scores:** **4 / 5 / 3 / 4 / 5 / 5 = 26**. **I — Confidence:** medium on user confusion; low on a current reproducible defect.

### P03 — Artifact lifetime through nested Code Mode

**Q — Sources:** C5.3, King: nested/double sandbox and image/binary handoff; C5.7, Ronacher: “unreadable code”; C7.2, Ali: large results should remain outside context.

**I — One sentence:** add a regression fixture for an image/binary result crossing an outer code executor and an inner MCP/code service, including cancellation, expiry and restart.

**I — 30-second demo:** an inner tool creates an image; the outer script returns an existing resource reference instead of printing base64. A restarted client can retrieve the intended artifact under its actual authority. Expire the reference or cancel the producer: the result says **expired**, **cancelled**, or **unknown**, rather than claiming a valid image or silently duplicating creation.

**F / I — Closest art:** [MCP tool outputs][mcp-tools], [Pi image/state handling][pi-code], [PydanticAI Code Mode][pydantic-code], and Cloudflare Code Mode. These already provide the core types and much direct handling. The residual is an end-to-end cross-service lifecycle case; do not create a replacement URI/handle protocol or assume a local temp path exists remotely.

**I — Beneficiaries / owner:** MCP server and harness maintainers composing code executors. Both owners can implement it. A neutral fixture is useful where neither owns the whole path; a new product is not justified.

**E — Initial step / kill test:** connect one existing outer executor to a fake inner service that returns an MCP image/resource reference, then vary lifetime and process ownership. **Kill** if existing examples/tests already cover all transitions or a short documented recipe works without a reproducible failure. Use provider-issued authorization; never turn a file reference into an implicit cross-user grant.

**E — Size:** Tiny, 1–2 days; Small only if a real adapter patch is needed. **Scores:** **4 / 5 / 3 / 4 / 5 / 5 = 26**. **I — Confidence:** medium on the named boundary; low-to-medium on today's unhandled cases.

### P04 — Cancellation and steering race fixtures for an existing adapter

**Q — Sources:** C3.2, steering versus follow-up; C3.3, Krentsel's “second chat”; C3.8, Ball: “click on this to steer.”

**I — One sentence:** add adversarial scheduling cases to ACP or one concrete harness adapter for accepted work, queued input, cancellation and late progress.

**I — 30-second demo:** a tool is pending; one client queues feedback while another cancels and disconnects. The fixture delivers late updates in a controlled order and shows which task remains owned, which input was withdrawn and which UI is stale. A follow-up cannot accidentally revive a cancelled turn.

**F / I — Closest art:** [ACP][acp], [oneharness][oneharness], Pi Durable task cancellation and Amp's existing controls. The protocol and wrappers already do most of the job; the residual is a reproducible adapter race not in their suites.

**I — Beneficiaries / owner:** adapter/client maintainers and multi-client users. Owners are the natural destination; an external contributor supplies a difficult minimized schedule, not a new protocol.

**E — Initial step / kill test:** map ACP's current state machine and existing fixture coverage, then implement one deterministic delayed-tool case. **Kill** if upstream already asserts the ordering, or the proposed behavior contradicts the negotiated protocol. Do not test that every late update disappears: some late observations are valid before cancellation reaches confirmed idle.

**E — Size:** Tiny, 1–2 days. **Scores:** **3 / 5 / 2 / 4 / 5 / 5 = 24**. **I — Confidence:** medium on demand; low on an uncovered common race.

### P05 — Consumer-owned regression matrix for a shared skill

**Q — Sources:** C4.2, Jane Street: “untold impact on different parts of the firm”; C4.4, Amp: “isn't picking up the skills”; C4.3, Uber's shared quality gates.

**I — One sentence:** contribute real downstream cases to an existing skill-test runner so a shared change is judged by consumers' outcomes and native invocation behavior.

**I — 30-second demo:** an edit improves a web task but makes a scripts-only consumer introduce SvelteKit. The report names the affected consumer and distinguishes not discovered, not loaded, invoked-but-failed, and passed outcome. The skill author sees why a global promotion is inappropriate.

**F / I — Closest art:** [skilltest][skilltest], [skill-up][skill-up], [session provenance][session-spec], [cross-framework robustness research][skill-robustness], Uber AIFX. General cross-harness testing is taken. In particular, skilltest documents passing the skill body through a system-input path; that does not by itself test every native skill discoverer or composed trigger path.

**I — Beneficiaries / owner:** shared-skill authors and downstream teams. The owner can add cases, but only consumers possess their real failures and acceptance policies. This is a contribution/data collection problem; another centralized test service lacks evidence.

**E — Initial step / kill test:** obtain three authentic consumer fixtures for one skill, including a no-skill control and a native dispatch path. **Kill** a new package if a plain case file in the current runner suffices; kill the reusable direction if no downstream owner will maintain a case. Keep model, serving endpoint, settings, revision and assistance in the report.

**E — Size:** Small, one weekend. **Scores:** **3 / 5 / 3 / 4 / 4 / 5 = 24**. **I — Confidence:** high on shared-change pain; medium on fixture adoption.

### P06 — A factual effect display for generated programs

**Q — Sources:** C5.7, Ronacher: “I would have to run a second LLM”; Huntley: “everything is just like just bash.”

**I — One sentence:** render existing nested execution events as bounded, factual progress cards with explicit observation coverage.

**I — 30-second demo:** a program makes several API calls and edits a file. The UI shows the observed target, policy decision, attempt and returned result as events arrive; omitted nested events or a disconnected runner produce a visible coverage gap. Clicking a card opens the source event, not an invented explanation of the program's intent.

**F / I — Closest art:** [agent-trace][agent-trace], [rollout-trace][rollout-trace], Pi nested events and ordinary OTel viewers. Generic tracing and semantic diff are occupied. The residual is one useful native view for arbitrary-code tools, tested for comprehension rather than claiming complete capture.

**I — Beneficiaries / owner:** users trying to steer opaque runs and harness UI maintainers. The owner could build the best-integrated version. An external prototype supplies a tested view and adapter; there is little standalone defensibility.

**E — Initial step / kill test:** render ten sanitized traces, including partial/failed calls, and ask three users to identify what happened and where certainty ends. **Kill** if current trace views answer those questions just as quickly, required events do not exist, or the display is merely a costly prose classifier. Do not infer every shell side effect from its command string.

**E — Size:** Small, 2–4 days. **Scores:** **4 / 5 / 2 / 3 / 5 / 5 = 24**. **I — Confidence:** high on lost UX; low-to-medium on this view improving it.

### P07 — A minimized hot-plugin interference case

**Q — Sources:** C6.1, “What happens if one instruction overwrites the other?”; C6.3, candidate validation/draining; C6.10, global-variable interference.

**I — One sentence:** add two interacting plugins and a failed replacement candidate to the existing plugin runtime's regression suite.

**I — 30-second demo:** both plugins pass in isolation. Together, one mutates process-wide state and changes the other's behavior; hot replacement occurs with an in-flight call. The case demonstrates the failure and verifies that a rejected candidate leaves the old plugin usable.

**F / I — Closest art:** [DeepSeek/Cordis][deepseek], Pi's plugin/candidate architecture and conventional plugin isolation testing. This is occupied runtime territory. The opportunity is a missing composition fixture, not a new extension system or an assertion that every plugin needs a sandbox.

**I — Beneficiaries / owner:** runtime and extension maintainers. The owner should absorb the test; external minimal repros are valuable because extension authors encounter combinations the owner does not.

**E — Initial step / kill test:** inspect candidate/reload tests and reproduce one actual interaction without a model call. **Kill** if it is already specified/tested or depends on unsupported plugin behavior with no reasonable contract. Do not expand it into a universal collision recorder.

**E — Size:** Tiny, one weekend. **Scores:** **3 / 5 / 2 / 3 / 4 / 5 = 22**. **I — Confidence:** medium on composition pain; low on a missing reusable primitive.

### P08 — Product-contract fixture for a self-optimizing harness

**Q — Sources:** C6.4, Mario: “just left a shell”; C6.6, cost-only “do nothing”; C6.9, a spec update worsened results.

**I — One sentence:** add a held-out product-contract case that rejects an optimizer's cheaper candidate when it removes a capability the owner explicitly wants preserved.

**I — 30-second demo:** candidate A starts faster by removing the client interface; candidate B retains it. The optimization score likes A, while a separate owner-selected task/interaction assertion rejects it. A deliberately headless configuration is allowed to remove the UI, demonstrating that preservation is a declared contract rather than a moral judgment about minimalism.

**F / I — Closest art:** [Harness Training][harness-training], [Pan's experiment report][pan-experiments], Prime/Exo and ordinary constrained optimization/eval practice. Generic anti-gaming and paired acceptance are taken. A concrete cross-domain retained-capability fixture is the possible contribution.

**I — Beneficiaries / owner:** self-modifying harness researchers and maintainers. They can implement it themselves; an outsider may contribute a realistic user-visible regression outside the optimizer's familiar benchmark.

**E — Initial step / kill test:** reproduce the deletion failure with a small deterministic mock candidate and a task held outside the proposer context. **Kill** if current suites already reject it or no owner actually requires the supposedly lost capability. Track budget changes, task-specific hints and model/effort changes; do not pretend a holdout prevents all gaming.

**E — Size:** Tiny, 1–2 days. **Scores:** **3 / 4 / 2 / 4 / 4 / 5 = 22**. **I — Confidence:** high on the general trap; low on novelty.

### P09 — Application effect evidence across interrupted execution

**Q — Sources:** C2.2, bash as the “monster in the room”; C2.4, duplicate Sentry/PR guards; C2.9, rare mid-execution loss.

**I — One sentence:** contribute a fake external provider plus fault cases that distinguish an intended, accepted, acknowledged and reconciled business effect.

**I — 30-second demo:** an email/PR-like fake provider accepts an operation and the worker dies before acknowledgement. Resume shows **outcome unknown** until a stable provider key is reconciled. Repeat after the provider's deduplication window expires; the fixture does not silently turn runtime replay into a guarantee about the external world.

**F / I — Closest art:** [Pi/Cloudflare tests][pi-cf], [Cloudflare recovery][cf-recovery], [durability storage/effect semantics][durability], provider idempotency APIs and [celld testing][celld]. These already supply retry/conformance machinery. The residual is one authentic application effect and retention contract.

**I — Beneficiaries / owner:** app teams sending consequential external operations. Runtime owners cannot know every provider's business identity or retention window, but can host the contributed example. Do not sell a universal exactly-once layer.

**E — Initial step / kill test:** inspect existing effect fixtures, add an accept-before-ack fault to one real integration's fake provider, and specify the reconciliation policy. **Kill** if the upstream suite already captures it, no stable external identity/readback exists, or the only proposed behavior is “retry.” In an unobservable case the correct result may remain uncertain.

**E — Size:** Tiny, 1–3 days. **Scores:** **3 / 5 / 2 / 4 / 5 / 5 = 24**. **I — Confidence:** high on the boundary; low-to-medium on missing shared fixtures.

### P10 — Authority receipt at the cloud-to-runner handoff

**Q — Sources:** C8.1, time/task-limited grants; C8.2, a real Mac runner; C8.3, VM versus project scope.

**I — One sentence:** display the actual execution principal and declared workspace/network/tool scope when a cloud agent delegates to a runner.

**I — 30-second demo:** the orb has a narrow production grant; a local runner executes as the logged-in machine user. The receipt makes that boundary explicit before a test action, shows what the runner reports, and marks unobserved capabilities unknown. It never prints secret values or claims the receipt enforces isolation.

**F / I — Closest art:** [Amp shared runners][amp-shared], [OpenShell integration][managed-openshell], [QM][qm], and existing capability/identity inventories. Amp already documents the key warning. The residual must be executable per-handoff evidence, not a restatement of its documentation or another credential vault.

**I — Beneficiaries / owner:** teams mixing local hardware with remote agents. Runner owners could supply this directly and likely should. Cross-provider scope vocabulary can be contributed, but business authorization cannot be inferred from process identity.

**E — Initial step / kill test:** use a disposable runner with two known principals/workspaces and compare the provider's declared scope with a harmless capability probe. **Kill** if current runner UI already exposes the needed information or scope cannot be observed without excessive host access. Keep requested, declared and tested capability separate.

**E — Size:** Small, one weekend. **Scores:** **4 / 4 / 2 / 4 / 5 / 5 = 24**. **I — Confidence:** high on documented scope differences; low on separate-tool demand.

### P11 — Setup snapshot versus run readiness receipt

**Q — Sources:** C7.6, Nix/global configuration failures; [42 06:00–08:00][v42], HTTPS portal failure; C8.11, a green diagnostic with a missing platform prerequisite.

**I — One sentence:** add a task-owned readiness check that distinguishes an installed environment snapshot, source revision and actually running prerequisites.

**I — 30-second demo:** a snapshot restores successfully but the daemon/HTTPS endpoint the task needs is absent. The receipt shows the snapshot identity, current source revision and failed readiness assertion; a task cannot be reported ready merely because setup exited zero.

**F / I — Closest art:** Amp Orbs setup/snapshot documentation and ordinary devcontainer, health-check and service-readiness tools; OpenShell diagnostics cover neighboring setup work. No new environment manager is warranted.

**I — Beneficiaries / owner:** example-repository and sandbox maintainers. Only the task owner knows the needed service/capability. The platform can provide hooks; an external fixture can expose one misleading example.

**E — Initial step / kill test:** reproduce the portal/service example on a disposable environment and add a read-only readiness command. **Kill** the package if one README correction or existing health check suffices. Prefer that correction over a wrapper CLI.

**E — Size:** Tiny, half a day to two days. **Scores:** **3 / 5 / 2 / 3 / 4 / 5 = 22**. **I — Confidence:** medium on the specific failure; low on reusable packaging.



