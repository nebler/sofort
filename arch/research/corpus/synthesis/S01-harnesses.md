# S01 — Harnesses, agent architecture, and the contracts that remain

Research date: **2026-10-28**. Theme: agent harnesses and architecture. **I — Recommendation:** start with a small public contribution that produces evidence about a changing harness. The best candidates are **P01, shim-retirement evidence; P02, settings across restart; and P03, nested Code Mode artifact fixtures**. None is a validated business or an empty category. Their useful scope is smaller than their names suggest.

**I — Main finding:** the corpus does not support a single conclusion that harnesses disappear. It supports three simultaneous movements: models absorb temporary scaffolding; durable state and authority move outside disposable execution; and generated programs make the familiar tool-by-tool interface less informative. Better models can remove a prompt workaround. They cannot reconstruct an unknown external effect, determine an organization's authorization, or tell a disconnected client which work it still owns without runtime support.

**F — Reading and evidence method.** Read in full the per-video digests, recurring themes, prior-art triage and top-five sections of **E01–E11** and **Connect 01–05**. Read matching ledger rows using variants of harness, Pi/Pi Durable, Amp/Orbs/Puck, Claude Code, OpenCode, Codex, Factory, Exo, self-learning/self-modifying, sandbox, Code Mode/codemode, managed, durable/background, interrupt/steer/cancel/resume, permissions, settings/configuration, skills, and React. Followed important claims back to supplied caption blocks, including videos 04, 05, 08, 19, 31, 45, 47, 49, 50, 52, 53, 56, 63, 66, 68, 72, 80, 86 and 88. Search matches on “durable skills” in human careers, generic GPU frameworks, and unrelated UI tools are not independent harness signals.

**F — Background constraints:** [research summary, especially §§11–12](/Users/noah/code/sofort/arch/research/RESEARCH-SUMMARY.md), [stack summary](/Users/noah/code/sofort/arch/research/stack/SUMMARY.md), and [Connect summary](/Users/noah/code/sofort/arch/research/connect26/SUMMARY.md). Generic durable hosting, a brain on a Durable Object, persistent filesystems, heap snapshots/forks, another Code Mode, a skill marketplace, generic agent self-extension, model routing, auth/MCP gateways, review loops and agent Git hosting remain killed as new pitches. No new transcript evidence reopens those broad categories. Specific tests and contributions below do not imply that their underlying runtimes are missing.

**Labels:** **Q** = supplied quotation or attributed experience, including unverified numerical claims; **F** = externally sourced fact or directly inspected documentation; **I** = synthesis, proposed scope or judgment; **E** = estimate, proposed acceptance target or score. Caption timestamps are minute buckets, not exact utterance seconds. Ellipses shorten quotations; bracketed repairs are explicit. Project demos describe proposed behavior, not software built in this research. No external package was installed or benchmark reproduced.

## 1. Signal clusters

**I — Counting rule:** each convergence count is a conservative floor for the explicitly named core evidence set. Related cross-references and secondary/adjacent accounts are retained in the tables and §5 without being extra votes for the narrower core claim. Count a person once per core set, collaborators separately as people but once as an organizational perspective, and a publishing channel once. Do not add cluster counts into a corpus-wide total. An unidentified discussion unit is one attribution unit, not an inferred roster of speakers.

### C1. Temporary scaffolding expires; runtime obligations do not

**I — Core convergence floor:** **six independently attributable speakers / six organizational perspectives / five publishing channels** in the counted set: Jediah Katz (SpaceXAI, AI Engineer), Thariq Shihipar (Anthropic, AI Engineer), Matan (Factory, Claude), Ras Mic/Michael (Peter Yang), Geoff Huntley (Armin Ronacher), and Theo (Nerd Snipe). Repeated Theo appearances are one speaker; Geoff's deletion advice is an opinion rather than a measured result. Fuad Ali and Andrew Qu below are additional architectural counterexamples, counted in C7 instead of inflating this count. Independent organizations appearing on AI Engineer do not create extra publishing channels.

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

**I — Core convergence floor:** **six independently attributable speakers / five organizational perspectives / five publishing channels**: Mario Zechner and Armin Ronacher (one Earendil perspective, Fragmented), Scott Tolinski (Syntax), Katelyn Lesse (Anthropic, Latent Space), Justin Schroeder (Standard Agents/Braid, Cloudflare Connect), and Theo (t3.gg). Ashley Peacock is an additional platform explanation, not an independent customer report. Anthropic's product colleague Angela Jiang does not add another independent implementation.

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

**I — Core convergence floor:** **six speakers / five organizational perspectives / six publishing channels**: Armin Ronacher (Earendil, Fragmented and Armin Ronacher), Thorsten Ball and Quinn Slack (one Amp perspective, Amp channel), Alex Krentsel (Exo, Latent Space), Ben Davis (Ben Davis), and Theo (Nerd Snipe). Armin appears on two channels but remains one practitioner. Most Amp episodes below share builders and infrastructure; ten demonstrations are not ten independent deployments.

| Signal | Video · timestamp · speaker | Q — source anchor | I — implication and qualification |
|---|---|---|---|
| C3.1 | [05 34:00–37:00][v05], Ronacher | “inbox” / watched deltas | Inbox delivery at safe points, live clients and queued work differ from appending a user turn to a transcript. |
| C3.2 | [80 35:00–41:00][v80], Ronacher | “five people” / “steer” / “follow-up” | Background compaction plus simultaneous Slack users breaks the linear transcript model. Steering can cancel current inference; a follow-up can wait. A client disappearing must not imply withdrawal of all durable work. |
| C3.3 | [52 31:00–32:00][v52], Krentsel | “a different conversation”; job-control/signals discussion | An OpenClaw conversation became uninterruptible, so he opened another conversation to ask status. He proposes OS-like job control/pubsub; this is both concrete pain and a speculative API direction. |
| C3.4 | [15 33:00–36:00][v15], Theo and Nerd Snipe discussion | “progress”; full-send/full-stop | Shelling out to another agent obscured progress. Theo distinguishes permission to land work from finishing locally for review; an output message is not always a usable request for intervention. |
| C3.5 | [16 55:00–56:00][v16], Theo | user will not read a final answer | Fully unattended flows need an explicit question/attention path when intervention is necessary. A normal final paragraph can disappear into a background run. |
| C3.6 | [29 05:00, 11:00][v29], Ben Davis | “approve five things per turn” | Frequent approvals trained him to stop reading; steering rescued a wrong turn during a long task. Friction and control cannot be ranked with one approval-count metric. |
| C3.7 | [37 10:00, 22:00–23:00][v37], Thorsten Ball | snooze trigger; runner messages/files | An async wakeup failed for a day; cloud work delegated to a real Mac via a runner. Control must span a sleeping task, a remote agent and a local execution host. |
| C3.8 | [43 04:00–06:00][v43], Ball | “click on this to steer” | Feedback can arrive before commit/push; an orb can end with local uncommitted state. A portal is an existing product, not a missing UI category. |
| C3.9 | [51 09:00–12:00, 23:00–27:00][v51], Quinn Slack | startup “number one complaint”; stable interface discussion | Startup and resume behavior matter to real use; stable frontend/backend contracts are desired. Conditional CI consolidation depends on independent evidence and reproducible execution, not merely the same agent saying it tested. |
| C3.10 | [66 15:00–17:00][v66], Katz | “subscribe to an event” | Slack, CI and timer wakeups already share one internal primitive. Event subscriptions are not a new category; delivery, cancellation and acknowledgement races remain concrete contract cases. |

**F — Current classification:** **Shipped:** Amp runners/portals/Puck control; **specified/being implemented:** [ACP cancellation, resume and config contracts][acp]; **Shipped tooling:** [oneharness turn control][oneharness]. ACP v2 material is a draft protocol baseline with feature negotiation, not proof that every adapter conforms. Its separation between accepted prompts, running/idle/requires-action state, cancellation and late updates already resolves much of the vocabulary. **Open only after checking existing tests:** race fixtures in a real adapter (**P04**), rather than a replacement interruption protocol. **P20** covers an orthogonal question: whose audience and authority survive a handoff.

### C4. Skills are portable files; invocation, policy and effective settings are not equivalent

**I — Core convergence floor:** **nine people/attribution units / seven organizational perspectives / six publishing channels**: Ras Mic and Peter Yang (two independent practitioners, Peter Yang channel); one Jane Street discussion unit (voices not reliably separated); Uday (Uber, The Pragmatic Engineer); Thorsten Ball and Quinn Slack (one Amp perspective); Wes Bos and Scott Tolinski (one Syntax/Sentry perspective); and Theo (t3.gg). Matt Pocock and Eric Tech below add practices/secondary discussion, not extra firsthand deployment votes in this count. A changed skill used by many Amp threads is still one organizational observation.

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
| C4.10 | [61 09:00–13:00][v61], Eric Tech discussing Pstack | maintenance-loop discussion | Useful secondary account of selective loading and shared skill maintenance. It does not independently validate Cursor internals. |
| C4.11 | [Connect 02 21:00][connect02]; [Connect 08 06:00][connect08], Ryan Skidmore; Andreas Salme | “21” skills; same agent through two harnesses | Internal review skills and VSCO's alternate entry points already exist. A changing harness/model prompt must not silently erase stable business prerequisites. |

**F — Current classification:** **Shipped:** [Agent Skills format][skills-spec], Uber's internal AIFX, [skill-up][skill-up], [skilltest][skilltest], [oneharness][oneharness], and Pi's [drift][drift]. **Draft specification with implementations:** GitHub's [Unified Agent Session Specification][session-spec], including prompt/skill provenance and model-routing outcomes. **Research already published:** [cross-framework skill robustness][skill-robustness]. A generic skill evaluator, instruction provenance viewer, config sync CLI or skills-portability benchmark is occupied. **Conditional residuals:** crash/config-update fixtures (**P02**); consumer-owned regression cases (**P05**); intent-combination cases (**P14**); learned-rule condition preservation (**P21**). This is the clearest cluster where demand should not be mistaken for an unbuilt tool category.

### C5. Code Mode compresses the interface while moving the hard boundary underneath it

**I — Core convergence floor:** **six people/attribution units / six organizational perspectives / five publishing channels**: Mikyo King (Arize, AI Engineer), Matt Carey (Cloudflare channel), Armin Ronacher and Geoff Huntley (different perspectives, Armin Ronacher channel), one Jane Street discussion unit (Jane Street), and Greg Pstrucha (Sentry, Cloudflare Connect). Arize's Fuad Ali is the same organization as King and adds no independent organizational vote. Sunil Pai and Anthropic provide adjacent architecture explanations rather than additional field failures here.

| Signal | Video/talk · timestamp · speaker | Q — source anchor | I — implication and qualification |
|---|---|---|---|
| C5.1 | [11 19:00][v11], Sunil Pai/Next Token discussion | “a different way to to call the tools” | Bash or a generated program changes the invocation interface; it does not eliminate external capabilities or their owners. |
| C5.2 | [47 08:00–09:00][v47], Mikyo King | operations one through five versus the sixth; generated-code debugging | Resource lifetime, networking and secrets remain. Permission combinations and generated programs create failures different from a wrong named tool. This is an architectural talk, not a measured failure-frequency study. |
| C5.3 | [47 10:00–11:00][v47], King | “double” sandbox discussion; images/binary | A Code Mode MCP server inside a Code Mode harness introduces another serialized boundary. Partial failure/resume and returning an image without flooding model context are distinct issues. A signed handoff is suggested, not demonstrated as a new protocol. |
| C5.4 | [48 05:00–18:00, 22:00–23:00][v48], Matt Carey | “1,000 tokens”; resource cleanup | Search/execute across a large API and SDK generation from MCP/OpenAPI already ship. Model-visible schema compression does not remove created-resource cleanup or application authorization. |
| C5.5 | [48 33:00–42:00][v48], Carey | DSL replacement; MCP portals; controls | Replacing narrowly designed DSLs and connecting more APIs are predictions/roadmap. API-handler authorization remains necessary underneath generated code. |
| C5.6 | [80 59:00–1:07:00][v80], Ronacher | models avoiding the edit tool; “code golf” | Models increasingly generate programs instead of the tool shapes harness designers expected. The “80%” observation is anecdotal and model-dependent; workspace shell execution and harness-local Code Mode are different execution locations. |
| C5.7 | [80 1:08:00–1:10:00][v80], Ronacher; Huntley | “Pi will probably very soon hide the tool output”; “everything is just like just bash” | A tool-specific UI no longer explains arbitrary programs. Ronacher calls hiding output a regression and floats a commentary model. Huntley independently recalls losing Amp's per-tool UX. It is not evidence that Pi has already shipped this change. |
| C5.8 | [05 54:00–55:00][v05], Zechner/Ronacher | resampling one failure prefix | Prompt/Code Mode behavior depends on model training. Sampling one prefix many times is an empirical debugging technique, not a general effectiveness benchmark. |
| C5.9 | [08 34:00–35:00, 46:00, 1:11:00–1:12:00][v08], Jane Street discussion | notebook permissions; RPC endpoint authority; sandbox shims | The useful authority boundary is an application endpoint/capability, not simply the host the agent can reach. Third-party harness hooks can be insufficient for a consistent execution policy. |
| C5.10 | [Connect 04 00:00–04:00, 18:00–20:00][connect04], Greg Pstrucha | “secret instructions within the skill”; “MCP is kind of out of our hands”; “cases we don't know” | Upstream data labeling helps but cannot enforce arbitrary downstream consumers. Sentry operates screening and feedback paths; this does not justify another generic injection classifier or a claim that stronger models solve all authority problems. |

**F — Current classification:** **Shipped:** Cloudflare Code Mode, Pi Code Mode, PydanticAI/Monty, Docker agent Code Mode and AgentUse; **Being built/prototype:** LeanProxy's optional Code Mode spike. Their permission semantics differ. [Docker][docker-code] documents approval at the whole-script boundary. [AgentUse][agentuse] routes code through its normal policy/effect dispatch. [PydanticAI][pydantic-code] supports typed values and explicit deferred-tool handling. [Pi][pi-code] already handles image blocks, saved image paths, per-script state and nested call records; it prevents recursively starting its own Code Mode tool. [MCP 2026-07-28][mcp-tools] already defines image/resource-link/structured outputs. These kill proposals for inventing binary tool results, a generic nested tracer, or a new durable Code Mode. **Open conditional slices:** an actual cross-boundary artifact lifetime/cancellation fixture (**P03**) and a factual effect display over existing events (**P06**). Do not present trace visibility as comprehensive enforcement or infer unobserved side effects from a generated explanation.

### C6. Self-learning already exists; what changes, who judges, and what survives are separate questions

**I — Core convergence floor:** **six people/attribution units / five organizational perspectives / four publishing channels** in the direct-practice set: Mario Zechner and Armin Ronacher (Earendil, Fragmented), Alex Krentsel (Exo, Latent Space), Uday (Uber, The Pragmatic Engineer), one Every team unit (Claude), and Matt Pocock (The Pragmatic Engineer). Fragmented #311's Yuri and unnamed co-host report others' systems; they are not extra independent implementers of those systems. Mario and Armin share the same project. The strength is convergence on evaluation/maintenance needs, not six verified self-improving production harnesses.

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

**I — Core convergence floor:** **six speakers / six organizational perspectives / five publishing channels**: Fuad Ali (Arize, AI Engineer), Andrew Qu (Vercel, AI Engineer), Matt Pocock (The Pragmatic Engineer), Adam Jacob (Swamp Club, Syntax), Ben Davis (Ben Davis), and Theo (Nerd Snipe). This is convergence on context/verification design, not six independent demonstrations that one architecture wins. Arize's Ali/King talks are one organizational perspective where both are used.

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
| C7.9 | [55 04:00–14:00, 41:00–43:00][v55]; [69 03:00–04:00, 11:00, 16:00][v69], Adam Jacob; Zach Lloyd | application-specific factory; human specification/review | Factory boundaries and anti-corruption/checking layers vary by application. Warp already supplies lifecycle tooling and starter agents. A “factory” label does not identify an unbuilt generic platform. |

**F — Current classification:** **Shipped:** Eve, Arize's described design, [AgentUse outcome reporting][agentuse], skilltest/skill-up and conventional eval tooling. Generic plan managers, finish gates, clean-context runners and multi-agent orchestration are occupied. **Conditional contributions:** explicit finish-state fixtures (**P13**), contaminated-run/negative-control examples (**P12**) and a narrow accepted-outcome cost study (**P16**). A new model may eliminate a bookkeeping shim, but cannot retrospectively make an intervention-free trial out of a supervised one.

### C8. Managed execution does not answer whose permission or whose audience

**I — Core convergence floor:** **eight people/attribution units / seven organizational perspectives / six publishing channels**: Katz (AI Engineer), one Jane Street unit, one Every team unit (Claude), Ball and Slack (one Amp perspective), CJ Reynolds (Syntax/Sentry), Patrick Collison (Stripe, Claude), and Lesse (Anthropic, Latent Space). The two Claude guests are independent companies but one publishing channel. Product demonstrations and opinions are weaker evidence than the named deployment boundaries.

| Signal | Video/talk · timestamp · speaker | Q — source anchor | I — implication and qualification |
|---|---|---|---|
| C8.1 | [35 46:00–47:00][v35]; [51 16:00–18:00][v51], Ball/Slack | time/task-limited production access; ambient laptop credentials | Scoped cloud grants can be narrower than a developer's laptop authority. This is a product claim/practice, not evidence that every runner inherits the restriction. |
| C8.2 | [37 22:00–23:00][v37]; [38 33:00–43:00][v38], Amp team | same action via orb/Puck; attached hardware | Existing runners bridge cloud agents to local Mac/hardware and filesystem assumptions. A standard remote command does not imply a standard principal or workspace isolation. |
| C8.3 | [60 03:00–08:00, 12:00–13:00][v60], CJ Reynolds | VM versus project separation | Local and remote agents both need an explicit scope. Running inside a VM does not automatically isolate projects from each other. |
| C8.4 | [46 09:00–13:00][v46], Jack Wotherspoon | separate interactions/environment; credential proxy | Google DeepMind presents managed environments, fresh context over common files, tools/skills/triggers and credential handling. It is existing supply, not a blank managed-agent opportunity. |
| C8.5 | [50 34:00–46:00, 1:03:00–1:07:00][v50], Lesse/Jiang | preferences; managed integration; secret proxy | Users disagree about laziness versus initiative. Managed agents absorb integration work; identical sandbox infrastructure can support distinct harness behavior. External vault/egress design does not decide whether an otherwise authorized action is appropriate to the request. |
| C8.6 | [52 27:00–28:00][v52], Krentsel | routine task asking for AWS keys | Keeping keys in a vault is necessary but insufficient when a task can induce authorized misuse through an allowed capability. This is not a claim that the proposed guardian has solved semantic authorization. |
| C8.7 | [73 13:00, 16:00–20:00, 25:00–26:00][v73], Every team | managed because they do not want infra; different requester context | Shared coworkers need user-specific permissions/memory and careful public/private transitions. When an agent should interject is a product decision with an identified owner. |
| C8.8 | [66 09:00, 12:00–13:00][v66], Katz | “Acting versus asking”; people/agent scopes | Emailing a colleague and spending money require distinctions beyond model competence. Scope should survive delegation; unknown intent should remain unresolved rather than be guessed as authorization. |
| C8.9 | [75 04:00–06:00][v75], Patrick Collison | hard invariants; semantic permission discussion | Stripe already operates Minions. A longer-term permission problem is acknowledged, not solved by another prompt or a new sandbox wrapper. |
| C8.10 | [Connect 12 17:00, 33:00][connect12], TELUS speakers | CLI surface mismatch; custom permission bindings | A coding-agent CLI was the wrong surface for nontechnical users; organization-specific bindings and authority rules had to be built. The problem is application context, not lack of a generic agent shell. |
| C8.11 | [84 00:00–03:00, 06:00–07:00][v84], Josh/Better Stack | green doctor output; missing macOS prerequisite | A setup diagnostic can be green while a needed platform capability is absent. The reported failure fraction is not independently reproduced. Kernel/network/process policy and application authorization are different tests. |

**F — Current classification:** **Shipped:** Managed Agents, NVIDIA OpenShell integration, Amp runners and [QM][qm] with scoped people/room workspaces. Amp's [shared-runner announcement][amp-shared] explicitly states that threads run as the machine user and share the runner directory. That is a documented boundary, not a discovered vulnerability. [Agent-trace][agent-trace] captures visible hook/proxy events, while [Codex rollout-trace][rollout-trace] represents execution structure; neither establishes complete OS-level visibility from a transcript alone. **Conditional residuals:** a runner authority receipt (**P10**), audience-transition fixtures (**P20**), and a deliberately unresolved application-action study (**P15**). Generic identity, secrets vaults, sandboxing and shared-agent hosting are not reopened.

### C9. The missing “React” is an unanswered abstraction question, not a framework specification

**I — Core convergence floor:** **six speakers / six organizational perspectives / six publishing channels** for adjacent interface pressure: Sunil Pai (Cloudflare, Latent Space and Next Token), Scott Wu (Cognition, Modal), Dax (OpenCode, Baseten), Quinn Slack (Amp, Latent Space), Justin Schroeder (Standard Agents, Cloudflare Connect), and Adam Jacob (Swamp Club, Syntax). **Only one of them makes the React claim.** Their disagreement about the right shape is evidence against pretending they asked for the same framework.

| Signal | Video/talk · timestamp · speaker | Q — source anchor | I — implication and qualification |
|---|---|---|---|
| C9.1 | [49 03:00–05:00][v49], Sunil Pai | “no one has built the React yet” | He wants an original portable abstraction across languages, companies and infrastructure. The host suggests skills; Pai questions whether precise English becomes code, while welcoming a possible Markdown future. He does not specify a new TypeScript framework. |
| C9.2 | [49 13:00–14:00][v49], Pai | original work near capability limits | His explicit advice resists another framework built by copying existing patterns. Reconcile the metaphor with that instruction before proposing infrastructure. |
| C9.3 | [11 50:00–1:05:00][v11], Pai/Next Token hosts | “so bad at SDK design” | Executor/workspaces/custom tools expose hard abstraction choices. App tools, storage, skills, UI and triggers already have active builders; not every integration inconvenience implies a missing universal layer. |
| C9.4 | [10 09:00–14:00][v10], Scott Wu | form factor follows models; outcome ownership | Cognition forecasts persistent agents owning outcomes and more automatic initiation. The reported 91% initiation figure is not a completion/success rate. His commodity/frontier split is a forecast. |
| C9.5 | [13 46:00–48:00][v13], Dax | “switch my whole tooling stack” | A stable tool surface can coexist with changing models. OpenCode's provider curation is already part of that product. |
| C9.6 | [51 03:00–18:00, 32:00–35:00][v51], Slack | local development/CLI death; agents configure agents; “jellyware” | Cloud agents, agent-driven settings and remixable software are concrete product bets. Maintenance burden and user control remain; prediction does not establish an unoccupied business. |
| C9.7 | [Connect 11 35:00–38:00][connect11], Schroeder | “shared schema”; “agent standards very similar to how we had web standards” | Typed parent/child schemas have broken for him; English exchanges are his preference. Standard Agents already owns a standardization initiative. This is a counterpoint to assuming a rigid universal schema will be welcomed. |
| C9.8 | [55 10:00–14:00, 32:00–33:00][v55]; [38 54:00–56:00][v38], Jacob; Amp discussion | factory/framework disagreement | A customer-specific factory and an extensible harness can both be useful without a common product category. |

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
| Factory / Droid | [Settings][factory-settings] distinguishes personal configuration from organization controls; [skills manager][factory-skills] exposes effective/disabled/overridden/invalid sources and multi-skill invocation; [custom droids][factory-droids] supplies separate prompt/model/tool policies. Current docs checked October 28. | A skill picker, settings hierarchy and restricted subagent are already shipped. Skill text itself is not the tool-access enforcement boundary. Natural-dispatch and restart fixtures must add something beyond this documented behavior. |
| ACP | [v2 migration/protocol material][acp], `fe817758`, October 28; npm SDK 2.1.0 October 28. Draft/negotiated features, not uniform installed support. | A new job-control vocabulary is weak. Adapter race cases may still help; respect protocol-defined late-update and cancelled-turn semantics. |
| Code Mode policy/results | [Docker][docker-code], [PydanticAI/Monty][pydantic-code], [AgentUse changelog][agentuse] (`4092f5bd`, October 17), [Pi Code Mode][pi-code], [LeanProxy spike][leanproxy], and [MCP July 28 tools][mcp-tools]. | Existing result types, nested events, dispatchers, approvals and output budgets eliminate many generic pitches. Whole-script approval and per-inner-call approval differ intentionally; compare declared contracts rather than declare one universal bug. |
| Effect visibility | [agent-trace][agent-trace] is experimental hook/proxy capture with structural comparison; [Codex rollout-trace][rollout-trace] describes nested execution structure. Pi already records bounded nested calls. | A generic agent tracer is taken. A useful display must state coverage and loss, distinguish requested/permitted/attempted/observed/completed effects, and avoid manufacturing unseen actions. |
| Runners and shared agents | [Amp shared runners][amp-shared], September 24; [agents anywhere][amp-anywhere], July 8; [Puck cross-agent control][amp-puck], October 13; [QM][qm] provides people/room scoping. | Cloud-to-local control and shared coworkers are shipped. A runner machine user is a different authority boundary from an orb. Application-owned transition tests may be useful. |
| Harness effectiveness/cost | [Apple/EPFL][apple-harness], [Tokens, Mostly][harness-tokens], [conditional harness-design study][harness-design], and [prompt-induced waste][prompt-waste], all 2026. | A generic “does harness choice matter?” paper is no longer fresh. A reproducible accepted-outcome study with intervention, provisioning and model-serving controls has a narrower claim. |

**F — npm cross-checks:** inspected [Pi Durable registry][npm-pi], [durable-harness registry][npm-durable], [Code Mode registry][npm-code], [Eve registry][npm-eve] and [ACP SDK registry][npm-acp]. Versions observed: 1.4.0; 0.0.1; 0.5.5 (October 20); 0.86.0 (October 28); 2.1.0. Registry availability does not certify any particular documentation example or cross-vendor behavior.

**F — HN/X check and its limitations:** HN searches surfaced the [self-improvement author's discussion][hn-pan], [Harness Training launch][hn-training], [QM discussion][hn-qm], and [OpenCode 2 discussion][hn-opencode]. Creator comments help locate source code; discussion votes are not adoption or correctness evidence. Indexed X searches included harness/shim, Code Mode/nested, skills/harness/portability, Pi Durable, Exo/exoharness, the self-improvement author, agents/React/Sunil, ACP/cancel, and managed-agents/sandbox. A runner/permissions HN query mostly returned adjacent CI-runner discussion and did not change the agent classification. No directly verified primary X post changed the classification; a repost mirror was excluded. Lack of an indexed X hit is not evidence of an empty category. These community searches informed discovery; technical claims above rely on the linked implementation/docs/papers.

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

**F / I — Closest art:** [oneharness][oneharness], [Drift][drift], [session provenance specification][session-spec] and [official Codex configuration][codex-config]. [Issue 48802][codex-resume-issue] is a warning against simplistic field comparisons. These sources substantially occupy the idea. [Pi Durable's settings][pi-durable] are live run policy rather than frozen conversation state, so a changed default can be intentional.

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

**Q — Sources:** C3.2, steering versus follow-up; C3.3, Krentsel's “a different conversation”; C3.8, Ball: “click on this to steer.”

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

### P12 — Assisted-run and negative-control examples

**Q — Sources:** C7.4, Ben Davis: “This thread is poison”; C7.5, Amp's hinted trials and missing-browser control.

**I — One sentence:** contribute an evaluation case/report that preserves the original prompt, native loaded context, interventions and a deliberately missing prerequisite.

**I — 30-second demo:** the agent says a workflow passed, but the environment has no browser. The deterministic evidence says it could not have performed the claimed check. A second run succeeds after supervisory steering and is labeled **assisted**, while an unassisted fresh run remains separate.

**F / I — Closest art:** [skilltest][skilltest], [skill-up][skill-up], [session provenance][session-spec] and ordinary negative controls. Simulated users and fresh trials already exist. The residual is a reusable real case, not a new eval runner or a claim that all self-generated tests leak.

**I — Beneficiaries / owner:** workflow/skill authors and benchmark readers. Owners can add controls cheaply; independent contributors can supply adversarial examples and reporting discipline. This likely belongs in documentation or a small dataset.

**E — Initial step / kill test:** turn the missing-browser case into a fixture with deterministic capability evidence and an intervention ledger. **Kill** if existing reports already make the distinction or the negative control changes the task into an irrelevant impossibility. Do not count a simulated supervisor's hints as autonomous capability.

**E — Size:** Tiny, one day. **Scores:** **3 / 4 / 2 / 3 / 4 / 5 = 21**. **I — Confidence:** high on measurement hygiene; low on software novelty.

### P13 — Completion-state contract cases for customer-chosen models

**Q — Sources:** C7.1, Ali: “explicit finish call”; C3.5, an unattended user will not read the final answer; C2.7, finite business-agent execution.

**I — One sentence:** add a small state-transition corpus for announcement, action, completion, blocked input and iteration exhaustion in an existing harness.

**I — 30-second demo:** a model says “I will run the check” without a tool call. One harness incorrectly ends the task; the corrected contract waits for its explicit outcome. A blocked task requests attention; an exhausted task reports incomplete rather than success.

**F / I — Closest art:** Arize's described finish gate, [AgentUse `report_outcome`][agentuse], [ACP states][acp], and Microsoft's bounded looping. Completion gates are shipped. The useful contribution is an uncovered BYO-model edge case or mapping between an application's outcome and a protocol's turn state; those are not necessarily the same thing.

**I — Beneficiaries / owner:** application harness maintainers. They own the semantics and can implement the cases themselves. A public small corpus can reduce rediscovery; there is no evidence for a standalone completion service.

**E — Initial step / kill test:** use deterministic model stubs for announce-then-call, explicit blocked outcome and exhausted budget, then one genuine model trace. **Kill** if current tests already cover all cases or the application's definition of completion cannot be stated independently of an LLM judge.

**E — Size:** Tiny, 1–2 days. **Scores:** **3 / 5 / 2 / 3 / 4 / 5 = 22**. **I — Confidence:** high on the documented issue; low on an uncovered reusable gap.

### P14 — Composed-skill intent and authority cases

**Q — Sources:** C4.7, Theo's “graph of skills,” “full stop” and inferred multi-skill invocation; C4.6, global context causing the wrong framework.

**I — One sentence:** contribute natural-dispatch cases that verify a composed skill graph preserves the user's requested end state and authority.

**I — 30-second demo:** “take over, review, full stop” selects multiple procedures but stops with reviewable local work. A transitive skill containing a full-send example cannot silently authorize merge/push. Compare native dispatch with forced/manual invocation without treating either path as universally superior.

**F / I — Closest art:** [Agent Skills][skills-spec], [skilltest][skilltest], [skill-up][skill-up], Theo's existing fleet and robustness research. Generic invocation testing is occupied. The residual is a small intent/composition case set, ideally part of P05 rather than another tool.

**I — Beneficiaries / owner:** authors of multi-step skills and users combining them by speech. Native harness owners can fix invocation UX; only the skill/user owner can state the intended authority. An external corpus can expose inconsistent boundaries, not settle policy by popularity.

**E — Initial step / kill test:** write a dozen paired prompts with explicit expected final states and a fake merge tool. **Kill** if ordinary skilltest cases cover the native path, no reproducible discrepancy exists, or the skill's own instructions contradict the stated user intent and a simple edit fixes it. Record transitive loading rather than counting a skill name in a transcript as success.

**E — Size:** Tiny, one weekend. **Scores:** **3 / 5 / 2 / 3 / 4 / 5 = 22**. **I — Confidence:** medium on real composition differences; low on a separate package.

### P15 — A bounded study of acting versus asking

**Q — Sources:** C8.8, Katz: “Acting versus asking”; C8.9, Stripe's semantic permission discussion; C3.6, repeated approvals becoming unreadable.

**I — One sentence:** collect application-owner-labeled cases that distinguish intended action, permitted capability and required clarification for one narrow workflow.

**I — 30-second demo:** two requests use the same email capability: drafting a message and explicitly sending it. The case set shows why network access and a valid token are insufficient to determine the requested action. An ambiguous request stays unresolved; the model is not allowed to invent a consent rule.

**F / I — Closest art:** managed-agent approvals, [OpenShell controls][managed-openshell], existing application ACLs and human-in-the-loop harnesses. General authorization products are taken. The unresolved slice is the owner-defined semantic action contract, not a classifier that magically derives permission from language.

**I — Beneficiaries / owner:** one business workflow's users and maintainers. The owner possesses authoritative intent/permission context and is the likely implementer. Independent research can document disagreements; it cannot supply missing organizational policy.

**E — Initial step / kill test:** ask two workflow owners to independently label 20 cases, including delegation and stale grants. **Kill or retain as Ambiguous** if owners cannot agree, existing explicit action forms resolve the cases cheaply, or users will not supply policies. Better models may improve inference, while explicit grants and identity still require evidence.

**E — Size:** Ambiguous; a 1–2-day study before implementation. **Scores:** **3 / 5 / 2 / 4 / 5 / 4 = 23**. **I — Confidence:** high that the question exists; low that it has a useful independent tool shape.

### P16 — Harness cost per accepted task, with assistance visible

**Q — Sources:** C1.2, Katz on efficiency; C7.3, Qu's eval win versus poor user experience; [01 01:00][v01], Theo: “more in compute than ... tokens”; [85][v85], compute-cost forecast.

**I — One sentence:** publish a narrow reproducible comparison of accepted outcomes including provisioning, execution and human steering, using existing runners.

**I — 30-second demo:** two configurations have the same benchmark pass rate. One needs three interventions, a slow environment boot and more compute; another spends more inference but delivers an accepted artifact sooner. The report exposes censored/incomplete runs and endpoint differences rather than displaying one misleading token total.

**F / I — Closest art:** [Tokens, Mostly][harness-tokens], [Apple/EPFL][apple-harness], [conditional design study][harness-design], [prompt-waste research][prompt-waste] and existing telemetry. Generic harness comparison is taken. The residual is a small accepted-outcome dataset for the builder's actual task class with all assistance logged.

**I — Beneficiaries / owner:** teams choosing a harness/configuration and maintainers removing expensive defaults. Owners can measure their own costs; cross-provider fixed task evidence can still be useful. A blog/data artifact is more credible than another benchmark platform.

**E — Initial step / kill test:** run a small paired pilot with fixed model/endpoint/effort, source revision and environment, then vary only one harness choice. Report uncertainty and repeat noise. **Kill** a broad study if current work already covers the task, subscriptions make marginal cost unobservable, or acceptance/human minutes cannot be measured consistently.

**E — Size:** Tiny pilot; Small, 2–4 days for a report. **Scores:** **4 / 5 / 2 / 4 / 4 / 5 = 24**. **I — Confidence:** high on cost differences; low on unique research coverage.

### P17 — A migration drill between existing durable harness adapters

**Q — Sources:** C4.3, “carry forward” settings/tools; C9.5, “switch my whole tooling stack”; C2.5, separate durable state and execution.

**I — One sentence:** demonstrate exactly what one small application can preserve, revalidate or must abandon when moving between two existing durable harness adapters.

**I — 30-second demo:** an interrupted task has files, an inbox item and an unknown external effect. Switch adapters using a sanitized application-owned archive. Files and stable business identifiers survive; an incompatible pending call is surfaced for reconciliation, while hidden model state is explicitly not imported as equivalent context.

**F / I — Closest art:** [durable-harness][durable-harness], [Cloudflare harness adapters][cf-harnesses], [session provenance][session-spec], ACP and oneharness. Cross-harness transport is occupied; no universal live-session conversion is promised. The residual is a real application's exit/upgrade drill above existing formats.

**I — Beneficiaries / owner:** app teams avoiding hidden adapter coupling. Platform owners can supply exports but have less incentive to exercise a competitor's importer; this is a practical portability test, not a defensible new runtime.

**E — Initial step / kill test:** choose two existing adapters and a deliberately small state schema; enumerate which invariants are observable. **Kill** if native export/import already preserves everything the app needs, there is no adopter, or migration requires pretending private provider reasoning/pending calls are portable. A documented stop/reconcile/restart may be the correct result.

**E — Size:** Big, 2–3 weeks after a 2-day feasibility drill. **Scores:** **3 / 5 / 2 / 3 / 5 / 5 = 23**. **I — Confidence:** medium on migration interest; low on reusable implementation scope.

### P18 — Old client / new plugin state transition fixture

**Q — Sources:** C6.3, candidate interface/state versions and in-flight draining; C6.10, a compatibility shim passing examples while damaging the design; C9.7, shared schemas breaking.

**I — One sentence:** contribute a mixed-version fixture for a durable plugin's serialized state and RPC interface across replacement and rollback.

**I — 30-second demo:** an old web client holds an in-flight request while a new plugin candidate changes state shape. Validation fails or the old request drains before activation; rollback restores a compatible reader without erasing accepted work. The fixture identifies an unsupported transition instead of silently coercing data.

**F / I — Closest art:** Pi's candidate/plugin work, [DeepSeek Cordis][deepseek], ordinary schema compatibility testing and the [Connect mixed-version migration proposal][connect-storage]. The latter already covers generic DO/application migration; this project's only residual is a concrete plugin/RPC transition.

**I — Beneficiaries / owner:** plugin runtime and UI maintainers. Owners are better placed to implement it; an outside extension author can contribute a real failing version pair. No separate migration platform is justified.

**E — Initial step / kill test:** inspect existing versioned state tests and encode one old-client/new-plugin case using actual persisted state. **Kill** if runtime contracts disallow the transition, the current suite already covers it, or a generic schema fixture suffices. Do not depend on an unshipped snapshot/clone API.

**E — Size:** Tiny, 1–3 days. **Scores:** **3 / 5 / 2 / 3 / 5 / 5 = 23**. **I — Confidence:** medium on design complexity; low on uncovered cases.

### P19 — Scenario atlas before a “React for agents” proposal

**Q — Sources:** C9.1, Pai: “no one has built the React yet”; C9.2, his warning against derivative frameworks; C9.7, Schroeder's schema/standards tension.

**I — One sentence:** compare existing implementations against a handful of concrete composition scenarios before proposing a new portable abstraction.

**I — 30-second demo:** select “two clients steer one durable task while a delegated tool waits on approval.” The atlas shows how Pi, ACP, a managed agent and QM express ownership/state/authority, and where behavior is incomparable or undocumented. A proposed primitive appears only if several implementations need the same missing contract.

**F / I — Closest art:** [ACP][acp], [Agent Skills][skills-spec], [QM][qm], [Microsoft Agent Framework][ms-harness], Pi and Eve. Existing routers and orchestration libraries make another unified API a poor default. The atlas is exploratory research, not evidence that Pai's metaphor has a single technical answer.

**I — Beneficiaries / owner:** framework/standards designers and app builders evaluating tradeoffs. Cross-project comparison is plausible independent work; vendors can also do it. No demand or durable abstraction has been established.

**E — Initial step / kill test:** write five scenarios using only existing runtimes and ask two unrelated maintainers to correct the descriptions. **Kill** the framework direction if existing primitives compose adequately, failures are merely missing adapters, or no common abstraction survives the examples. A useful essay can be the complete outcome.

**E — Size:** Ambiguous, 2–3-day research spike. **Scores:** **4 / 5 / 1 / 3 / 3 / 3 = 19**. **I — Confidence:** low; intentionally retained rather than discarded.

### P20 — Requester and audience transition cases for shared agents

**Q — Sources:** C8.7, Every's different requester contexts and public/private handoffs; C8.1, scoped people/agent grants; C2.7, persistent business threads.

**I — One sentence:** contribute fixtures that preserve requester identity, audience and permission scope across public chat, private follow-up, delegated work and scheduled continuation.

**I — 30-second demo:** a public-channel agent starts a task for Alice, later receives a private follow-up from Bob and wakes on a schedule. The fixture checks that Bob's visibility does not silently become Alice's authority, and that private content is not emitted to the old channel simply because it was the original task surface.

**F / I — Closest art:** [QM scoped people/rooms][qm], managed-agent sessions, Amp workspaces and ordinary application ACL tests. Shared coworkers and memory scoping are shipped. The residual is an application's transition corpus, not a universal identity broker or a new memory system.

**I — Beneficiaries / owner:** shared-agent app teams and users. Platform owners can provide primitives; only the app owner knows audience policy. A public fixture template may transfer, while the actual policy data stays owner-controlled.

**E — Initial step / kill test:** define two users, two channels and one scheduled continuation with explicit allowed read/write surfaces; run against one existing app. **Kill** if native tests already exercise these transitions, the app has no shared/private boundary, or authoritative policy cannot be supplied. Avoid treating conversation access as a grant to act.

**E — Size:** Tiny, one weekend. **Scores:** **3 / 5 / 2 / 4 / 5 / 5 = 24**. **I — Confidence:** high on the application boundary; low-to-medium on a shared corpus.

### P21 — Preserve the conditions of a learned rule

**Q — Sources:** C6.7, trace-generated skill improvement; C6.8, personal gains not spreading; C4.7, “full stop” versus “full send.” **F — Independent demand:** a [Hermes issue][hermes-rule-issue] reports skill-learning regressions and discusses condition/authority loss; it is a report/proposal, not a verified shipped fix.

**I — One sentence:** add before/after examples to a skill-learning loop so a local successful workaround cannot silently become an unconditional global rule.

**I — 30-second demo:** a successful task records “skip this step only under condition X.” A generated skill drops the condition. A positive case still passes, but a negative context fails and blocks automatic promotion; the report names the condition that was lost rather than asking another model whether the prose looks good.

**F / I — Closest art:** [skill-up][skill-up], [skilltest][skilltest], [Harness Training][harness-training], the Hermes proposal and Uber's improvement pipeline. Generation and regression testing are taken. The residual is a real condition-preservation pair contributed to those loops; this overlaps P05/P14 and should share their runner.

**I — Beneficiaries / owner:** skill learners, shared-skill maintainers and users whose exceptions become persistent memory. Owners can implement it, but downstream owners must supply counterexamples. There is no basis for a new global policy service.

**E — Initial step / kill test:** obtain one authentic lost-condition example and encode both its successful context and a neighboring forbidden context. **Kill** if a one-line skill edit resolves it permanently, current tests already catch it, or all acceptance depends on the same model that proposed the edit. A small upstream fixture is a sufficient result.

**E — Size:** Small, one weekend; likely Tiny. **Scores:** **3 / 4 / 2 / 4 / 4 / 5 = 22**. **I — Confidence:** medium on independent pain; low on reusable tooling.

### P22 — Judgment-pause diary for one real workflow

**Q — Sources:** [09 54:00–55:00, 59:00–1:00:00][v09], Demetri: “judgment interrupts” and “getting that decision 4 hours earlier”; C3.6, approval fatigue; C7.9, humans specifying/reviewing factory work.

**I — One sentence:** publish a small diary of when a long agent run genuinely needed a person's value judgment and whether answering earlier would have changed the outcome.

**I — 30-second demo:** a run is labeled autonomous for a day. The diary separates compute, blocked approvals, useful steering and a genuine “we asked for the wrong thing” judgment. Moving a response four hours earlier changes one critical path but has no effect on another already-complete artifact.

**F / I — Closest art:** existing harness event/attention logs, [oneharness control][oneharness], [session traces][session-spec] and Warp's factory/specification workflow. Generic latency dashboards are taken. The residual is human-labeled counterfactual evidence about usefulness, most plausibly a blog/dataset rather than software.

**I — Beneficiaries / owner:** a small team deciding where to automate and where to retain judgment. The owner knows actual value; a vendor's “autonomous hours” metric cannot infer it. Vendors could run the same study; there is no platform moat.

**E — Initial step / kill test:** record ten authentic pauses without changing the workflow, then ask the owner which earlier answers would have mattered. **Kill** if timestamps and existing labels already answer the question, participants cannot assess it, or the diary merely renames approval wait time. Do not create extra approval gates to manufacture data.

**E — Size:** Tiny, 1–2 days of analysis after observation. **Scores:** **2 / 3 / 2 / 3 / 4 / 5 = 19**. **I — Confidence:** low; the originating speaker explicitly calls the forecast speculation.

## 4. Predictions board

**Q / I — Scope:** the claim column preserves forward-looking statements, wishes and product roadmaps related to this theme, including incompatible ones. The consequence column is an inference about what must exist if the claim becomes true. A forecast is not a demand signal for a new company. Repeated appearances of the same person/team are consolidated; numerical claims are not independently accepted base rates.

| Source / claimant | Q — forward-looking claim or direction | I — what must be built or remain true; current owner/status |
|---|---|---|
| 04 43:00–44:00, Ras Mic/Peter Yang | General engineering skills diminish; personalized workflow/taste lasts. | Model-transition baselines and personal preference tests; generic skill tooling shipped. P01/P05, not another marketplace. |
| 05 35:00–40:00, Zechner/Ronacher | One networked plugin system across server, browser and TUI; candidate replacement. | Versioned state/interfaces, validation and in-flight ownership; Earendil already building. P07/P18 only. |
| 05 41:00–47:00, Zechner/Ronacher | Self-modifying loops improve, but narrow gains may fail to transfer and rollback compounds. | Owner-defined objectives, held-out tasks, resource accounting, promotion/rollback history; Exo/Prime/Harness Training occupy much of this. P08. |
| 05 52:00–55:00, Zechner/Ronacher | Host integration and a new GUI will mature; not a Pi 1 compatibility exercise. | Host-specific lifecycle adapters and clear API/version contracts; current Cloudflare/Vercel work already addresses the core. |
| 10 09:00–14:00, Scott Wu | Form factors follow models; persistent outcome owners; automatic initiation grows; frontier work becomes a small minority. | Durable goals, scheduler/event triggers, supervision and accepted-outcome economics. Cognition/managed-agent platforms active. Initiation is not success. |
| 11 50:00–1:11:00, Pai/Next Token | Agent apps combine tools, storage, skills, UI and triggers; native snooze fits harness UX. | Coherent application interfaces and lifecycle behavior; Executor/Agents SDK and products already building them. Abstraction unresolved. |
| 13 46:00–48:00, Dax | Models change while users keep the same tooling surface. | Capability negotiation, serving metadata and explicit unsupported behavior; OpenCode already supplies the product. P02/P17 are narrower evidence work. |
| 14 1:42:00–1:43:00, Nerd Snipe/T3 discussion | Blind/fresh reviewers should not inherit the parent's hints/history. | Explicit context boundary, original prompt custody and assistance labels; fresh-review tooling already exists. P12. |
| 15 35:00–37:00, Theo | Full-send/full-stop and recurring Markdown jobs replace more manual service glue. | Explicit end states, question channels, scheduling and observable completion; existing skills/harnesses own the loop. P13/P14. |
| 19 35:00–38:00, Uday/Uber | Traces will generate patches that continually improve shared skills. | Consumer regressions, owner review/promotion and correct trace-to-skill attribution; Uber already building. P05/P21. |
| 21, Gergely Orosz reporting industry views | Company harnesses grow; the IDE loses centrality. | Internal tool/identity integration and managed work surfaces; secondary report, not another independent adoption measurement. |
| 23 67:00–74:00, Pocock | Feedback-fix factories and reusable collaborative skills expand. | Evaluation cases, human preference capture and maintained scripts; author already builds related workflows. |
| 36–38, Ball/Slack | More cloud work, agent-operable skills and local runners; frameworks' role disputed. | Remote/local authority boundaries, readiness and control; Amp ships them. P10/P11, not a new runner. |
| 46, Wotherspoon | Managed agents split interactions from reusable environments and support tools, skills, triggers. | Session/environment lifecycle, credential brokering, retention and fresh contexts; Google product direction, not an empty SDK category. |
| 48 33:00–42:00, Carey | Generated programs replace more DSLs; broader portals/API reach. | Typed capability bridges, cleanup, output handling and upstream authorization; Cloudflare roadmap/implementation. P03/P06 only where actual failures remain. |
| 49 03:00–05:00, Pai | A portable React-like abstraction remains to emerge; perhaps the host's Markdown/skills suggestion wins. | A shared composition contract proven across real scenarios; hypothesis only. Existing standards/frameworks are substantial counterpressure. P19. |
| 50 34:00–46:00, Lesse/Jiang | Managed systems absorb integration; configurable initiative and dreaming improve over time. | Owner-specific preference memory, correction and stable interfaces; Anthropic owns the direction. Better models do not set organizational preferences. |
| 50 1:45:00–1:46:00, Lesse/Jiang | Lead agents orchestrate nonblocking workers and agents may architect systems themselves. | Owned background work, shared-state/authority boundaries, resource bounds and independent acceptance evidence; multiple active builders. |
| 51 03:00, 18:00, Slack | Local development is dead; CLI agents will be dead in two months. | Remote reliability, startup/resume, all needed environments and usable intervention surfaces. Date-relative, falsifiable opinion; local hardware workflows in Amp's own demos qualify it. |
| 51 07:00, Slack | Mandatory human review can shrink in trusted teams. | Independent acceptance/rollback/permission policy matching risk. His conditions do not authorize blanket unattended merges elsewhere. |
| 51 10:00–12:00, Slack | The agent becomes the settings UI; stable backend/frontend contracts matter. | Observable effective policy and reversible settings changes; existing products can do this. P02 addresses a boundary, not a settings chatbot. |
| 51 23:00–27:00, Slack | More agent testing can replace duplicated CI; reproducible compute demand grows. | Comparable test/environment evidence and separately selected required suites. An agent's self-report cannot establish CI equivalence. |
| 51 32:00–35:00, Slack/host | Remixable “jellyware”; skill examples may matter more than conventional libraries. | Upgrade/maintenance behavior and inspectable ownership; Amp roadmap. Package compatibility and dependent users do not disappear automatically. |
| 52 31:00–32:00, Krentsel | Agent job control/signals/pubsub should resemble OS coordination. | Task ownership, cancellation, status and event semantics; ACP/oneharness already address much of the control plane. P04 only for uncovered adapter cases. |
| 52 38:00–41:00, Krentsel | Harnesses that see/edit themselves can optimize over tasks; tracking/evaluation grows. | Protected evidence, meaningful objectives, transfer testing and rollback; Exo/Prime/Harness Training active. Local cost reductions do not prove general improvement. |
| 53 11:00, Scott/Wes | Per-chat skill selection should be easier; global skills may be pruned. | Native visibility and selection UX; existing config/provenance tools close much of the gap. A data-backed UI contribution could end the issue. |
| 55, Adam Jacob | Engineering shifts toward application-specific factories. | Explicit domain contracts and checking/anti-corruption layers; factory products and internal systems already exist. |
| 56, Scott Tolinski | Durable agents become easier and more common as reusable lifecycle plumbing replaces custom glue. | Reliable adapters and application deduplication/acceptance; Pi Durable already enabled his deletion of custom code. P09. |
| 63 00:00–12:00, Fragmented hosts | Self-learning harnesses are the next wave; live plugins and recursive programmatic context spread. | Mutable/immutable boundaries, plugin composition and evidence of transfer; DeepSeek/Prime/Exo already named. Do not equate memory with runtime self-modification. |
| 66 06:00–08:00, Katz | Harness functionality is absorbed by models, then new task domains create new scaffolding. | Reversible features and model-transition measurement; P01. Competing hypothesis: design choices remain model/task conditional. |
| 66 09:00–13:00, Katz | Better communication, personalization and scoped permissions remain major work. | Attention policy, requester context, explicit grants and enforcement; active product work. P15/P20 preserve unresolved semantics. |
| 66 15:00–17:00, Katz | Subscriptions unify triggers; agents replace individual LLM calls as composition units. | Delivery/ownership, timeout/cancellation, stable inputs/outcomes and resource accounting; internal primitive already built. |
| 66 17:00, Katz | Within six months, 90% of agent work runs off laptops. | Cheap reliable remote execution, local capability bridges and workable identity. Amp runners are both enabling art and evidence that “off laptop” needs a precise work-unit definition. |
| 68, Qu | One agent using trained filesystem/bash patterns can outperform summary-heavy specialization. | Context/task evidence and application-specific checks; Eve already supplies the design. Prediction should be tested by task, not elevated to a universal single-agent rule. |
| 69, Lloyd | Software engineering becomes factory engineering with fewer specification/review bottlenecks. | Human-efficient definition, review, lifecycle tooling and resource accounting; Warp already owns a product direction. |
| 70 05:00–06:00, Shihipar | Proactive multiplayer is a new wave; newer models may need fewer examples/constraints. | Wakeup relevance and shared ownership; model-specific prompt tests. Removing prompt examples does not remove runtime permission checks. |
| 71 22:00–29:00, Cherny/Sumner | Overnight work needs less approval blocking and better automated proof. | Explicit autonomy policy and evidence tied to intended executables; auto-approval already active work. Not a reason to ignore requested approval. |
| 72 08:00–09:00, Matan | Monthly model changes keep consuming prior harness value; company knowledge remains useful. | Fast reassessment and private-domain acceptance evidence; Factory already adapts. P01/P05. |
| 73, Every team | Shared managed coworkers spread workflow gains; recurring tasks and style learning improve. | Audience/requester separation, maintainable skill promotion and appropriate interjection; Every owns this product. P20/P21. |
| 75, Collison | Stronger agents expand Minions; semantic permission is a longer project. | Hard application invariants, explicit authority, review policy and real outcome evidence; Stripe already building. P15 remains exploratory. |
| 80 35:00–41:00, Ronacher | A linear transcript no longer represents concurrent users/background tasks. | Durable task graph, inboxes and multiple projections; Pi Durable already works on this. Adapter/state transition cases remain. |
| 80 1:08:00–1:10:00, Ronacher/Huntley | Tool output may be hidden; perhaps another model emits commentary. | Truthful progress from execution events, coverage signaling and controllability; a commentary model adds cost and possible misdescription. P06 tests a simpler event view. |
| 82 47:00–56:00, Ronacher/Vinegar | Cloud confinement is easier than local access; Nix-like reproducible environments may return. | Reproducible prerequisites plus actual scope/readiness. Nix/sandboxes already exist; P10/P11 are evidence contributions. |
| 85, Theo | Execution compute eventually outweighs inference cost. | Per-task compute/provisioning measurement and resource-aware configuration; a forecast conditioned on workload/subscription economics. P16. |
| 86 28:00, Theo | Fleet skills/configuration will be shared as T-Stack. | Distribution, trigger definitions and maintenance; named builder/roadmap. Do not pitch his fleet repo as missing software. |
| Connect 03 08:00, 15:00–20:00, Relevance/Arg speaker | Durable shared files increase agent memory; systems prompt agents; personalized work surfaces proliferate. | Shared versioned storage and closed feedback loops; Arg already implements much of it. Generic agent filesystems remain killed. |
| Connect 08, Salme/VSCO | Business actions should stay stable while prompts/models/harnesses change. | Product prerequisites, plan/flag/deep-link and readback fixtures; existing LangGraph/AG-UI implementation. This is application conformance, not a new harness. |
| Connect 09 16:00–18:00, Peacock | Pending-I/O keepalive, shutdown hooks and longer deployment grace reduce lifecycle pain. | Host APIs and recovery that survives forced termination. Keepalive shipped October 1; announced hooks/grace controls retain roadmap qualification. |
| Connect 11 05:00–06:00, Schroeder | Better models do not eliminate business harnesses; tiny models can handle bounded tasks. | Finite loops, state, effects and cost-efficient deployment; Standard Agents/CF already supply much of this. |
| Connect 11 36:00–38:00, Schroeder | A starting harness will open; agent standards resemble web standards. | Interoperable contracts/implementations and real adoption; identified builder, not an unclaimed initiative. |
| Connect 11 41:00–42:00, audience/Schroeder | Operators want fleet dependency topology and aggregate telemetry. | Cross-thread identity/ownership and bounded aggregation. Existing tracing/graphs are close; no separate project promoted without an uncovered query. |
| Connect 12, TELUS speakers | Enterprise agents spread beyond developers; domain skills/bindings and appropriate surfaces matter. | App-specific UX, permission bindings and retained human understanding; broad platform already built internally. |
| 09 54:00–1:00:00, Demetri | Always-on generation may eventually block on “judgment interrupts”; answering sooner may not create proportional value. | Human value judgments and useful-pause measurement; explicitly speculative, P22. This qualifies forecasts that more unattended runtime equals more useful output. |
| 28 18:00–19:00, Michelle | Easier harnesses may make task-specific/cheaper model mixtures practical. | Capability/serving metadata and task-specific acceptance, not merely a prompt router; routing products already exist. |
| 34 02:00–04:00, Baseten discussion | Latent/KV compaction may supersede token summaries; compaction becomes routine harness operation. | Context retention/interpretability evidence and model support. The claim that Codex already uses a particular latent mechanism is speaker speculation, not a sourced implementation fact. |
| 65 39:00–45:00, routing panel | Model-specific prompts and recovery remain; routing may be a product or plumbing inside model/harness/controller. | Explicit ownership and per-target prompt/effectiveness tests. No new router is proposed; provider switching is not behavior preservation. |
| 55 31:00–33:00, Adam Jacob | Software may get smaller; a platform of primitives supports personal applications. | Useful small domain contracts and maintainable composition; overlaps active app-building platforms. This does not establish a need for another universal harness. |
| Connect 13 02:00–03:00, Dillon Mulroy | Git familiarity matters less as agents improve, while client interoperability remains useful. | Stable versioned storage/client behavior; Artifacts already supplies this layer. Do not reopen agent Git hosting. |
| 18 1:06:00–1:07:00, Gergely Orosz | Code review and visible peer feedback decline as harness use grows. | Alternative review/learning and acceptance evidence. Forecast, not measured disappearance of review; overlaps Warp/Factory/managed workflows. |
| 80 1:08:00–1:09:00, Ronacher | Approvals may disappear from more harnesses while critical work still needs verification along the way. | Runtime policy, truthful observations and chosen checkpoints. Fewer buttons do not imply less authority enforcement. P06/P15. |
| 24 01:28:00, Lattner | Better human diagnostics should also make agents more effective. | Tool/compiler-owned error messages and deterministic evidence, rather than another model-facing wrapper. |
| 26 21:00, AWS panelist | CPU/orchestration becomes more significant around agent/guard loops. | Host resource telemetry and bounded scheduling; existing runtime/profiling work. P16 is a small measurement contribution. |

## 5. Coverage, adjacent signals and uncertainty

**F — Ledger coverage:** [E01](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md), [E02](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md), [E03](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md), [E04](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md), [E05](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md), [E06](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md), [E07](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md), [E08](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md), [E09](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md), [E10](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md), [E11](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md); [Connect 01](/Users/noah/code/sofort/arch/research/connect26/01-agentweb.md), [02](/Users/noah/code/sofort/arch/research/connect26/02-storage.md), [03](/Users/noah/code/sofort/arch/research/connect26/03-durable.md), [04](/Users/noah/code/sofort/arch/research/connect26/04-customers.md), [05](/Users/noah/code/sofort/arch/research/connect26/05-platforms.md). All supplied summary/triage sections informed the scan; older candidate names were treated as leads and rechecked, not inherited as novelty claims.

**Q / I — Adjacent and weaker signals retained:** these qualify the main clusters without adding independent core-convergence votes. Each row names its evidence unit; secondary reports are not extra deployments. Human organizational “permissions,” developer career “skills,” unrelated GPU interrupts and plain test-harness references were screened rather than silently turned into agent-architecture demand.

| Source · speaker / evidence unit | Q — anchor | I — disposition |
|---|---|---|
| [09 54:00–1:00:00][v09], Demetri, one speaker / A Life Engineered | “judgment interrupts” | Independent speculative counterweight to autonomous-runtime enthusiasm; P22. No implemented system is claimed. |
| [17 36:00–37:00][v17], Gergely/WorkOS sponsor, one sponsored account | “an agent can never get more access than the person who invoked the agent” | Stated delegated-authority ceiling, not a verified property of arbitrary harnesses. C8/P10/P20. The separate Google “two different permission bits” concern is human code ownership/competence, not agent ACL evidence. |
| [17 1:08:00–1:09:00][v17], Gergely, one anonymized secondary account | “AI wrote a component ... faster and better” | A substantial spec/test harness enabled replacing a licensed component; supports retained acceptance contracts, not a new generic harness. |
| [18 1:06:00–1:07:00][v18], Gergely, one forecast | “code reviews are slowly going away” | Review/learning may change with harness use; application evidence still needed. Same host as prior accounts, not another independent organizational implementation. |
| [20 42:00][v20], Sam Newman recounting a small team | “observability data” / “OTel” | Existing production-evidence feedback into an agent loop. Secondary account, already-occupied monitoring/review space; C7. |
| [20 1:20:00][v20], Newman | “distributed denial of cash attack” | Autoscaling can convert overload into spend. Existing resource bounds and P16 are closer than a new agent runtime. |
| [22 1:22:00][v22], Patrick McKenzie | “every time ... a new version, my setup would break” | Human tooling analogy for configuration-maintenance cost, not an independent agent-settings failure. C4. |
| [24 01:28:00][v24], Chris Lattner | “good error messages” | Human-useful diagnostics also help agents. Compiler/tool-owner contribution territory; no separate harness project. |
| [26 21:00][v26], AWS panelist, one forecast | “CPU ... becoming more of the bottleneck” | Host orchestration/guard loops consume real resources; C1/P16. Model inference is not the entire cost. |
| [28 18:00–19:00][v28], Michelle, one forecast | “as ... the harnesses ... get easier” | Lower model-switching friction is predicted, not demonstrated task equivalence. C4/C9; routing is killed as a generic pitch. |
| [30 07:00–08:00][v30], Ben Davis, partly relaying Hermes engineers | “removed all of the tool calls from their chat history”; “actual context ... on the environment” | Reported compaction failure is secondary; routing needs environment information beyond the prompt. Existing compaction/eval owners, C7/P12/P16; do not claim a reproduced Hermes result. |
| [34 02:00–04:00, 22:00][v34], Baseten/Harvey discussion unit | “compacting the KV cache”; “core part of the harness”; “avoid polluting” | Compaction/subagent context boundaries matter. Latent implementation details are speculation; no fresh compaction-runtime pitch. Client-data training permission is a separate governance boundary. |
| [40 00:00][v40], Amp presenter, same Amp organizational unit | “I have to do this every time” | Manual seed-account login interrupts repeated setup; existing login automation/demo work, P11 if a real readiness fixture is missing. Not demand for a new secrets product. |
| [65 39:00–45:00][v65], moderator/Alex and panel | “these prompts aren't portable” | Same model-switching issue as C4, with a routing ownership disagreement. No independent universal portability standard is established. |
| [79 12:00–13:00][v79], Max/Capital One | “decrease the cost of engineering rigor” | Automatic rigor is useful; a new policy document alone may not be. C1/C7, already established tooling territory. |
| [83 01:00–02:00][v83], Better Stack presenter | “create or get an existing sandbox” | An ID defines reuse/ownership that application code must choose. Existing Sandbox SDK supply; C2/C8 rather than another sandbox manager. |
| [87 38:00][v87], Theo reading Anthropic | “permissions to individual directories” | Scion's directory controls are named existing supply, a secondary article reading. C8; do not pitch fine-grained repository permissions as empty territory. |
| [Connect 03 07:00–13:00][connect03], Relevance/Arg speaker | “every single surface on top got it for free”; “persist the sandbox ... Open up a tunnel” | Shared storage/access/versioning already underlies multiple clients; persistent build environments and custom mounts solved product needs. Storage/mount fidelity belongs with the existing Connect storage candidates. |
| [Connect 04 04:00–05:00][connect04], Pstrucha | “untrusted data blocks” | Upstream labels assist clients; no guarantee that downstream tools honor them. Existing Sentry screening has an owner; no new classifier proposed. |
| [Connect 06 17:00–20:00][connect06], Fabian/Lovable | “encode into into our builder agent” | Closed feedback from generated apps to their builders already exists. It is not a new self-learning-harness category; app retention/memory questions live in the platform ledger. |

**I — Important unresolved evidence:** no private Cursor shim counters, Uber consumer matrix, Amp incident logs, Theo crash environment or Exo optimizer runs were available. No package was executed. Therefore the report establishes source convergence and close competing implementations, not reproduced product defects, performance wins or willingness to adopt another tool. The highest-ranked items are invitations to perform their kill tests, with upstream contribution as a likely successful endpoint.





**F — Link and revision notes:** source-video links below resolve the supplied minute references to the original recordings; the local transcript filenames can be found by the same video/talk number. GitHub links are pinned where practical; living docs and current product pages were checked on the research date. Reference definitions are kept here so the ranked decision below remains the end of the report.

[acp]: https://github.com/agentclientprotocol/agent-client-protocol/blob/fe817758a55792cdb5a09422923d08e6ed7f72b8/docs/protocol/v2/migration.mdx
[agent-trace]: https://github.com/Siddhant-K-code/agent-trace
[agentuse]: https://github.com/agentuse/agentuse/blob/4092f5bd4ef2c756116fd9d4b3e4e345187e688f/CHANGELOG.md
[amp-anywhere]: https://ampcode.com/news/agents-anywhere
[amp-puck]: https://ampcode.com/news/take-puck-with-you
[amp-shared]: https://ampcode.com/news/shared-runners
[apple-harness]: https://machinelearning.apple.com/research/harness-autonomous-ml-engineering
[celld]: https://github.com/denoland/celld/blob/main/docs/testing.md
[cf-harnesses]: https://developers.cloudflare.com/agents/harnesses/
[cf-pi]: https://developers.cloudflare.com/agents/harnesses/pi/
[cf-recovery]: https://github.com/cloudflare/agents/blob/main/docs/agents/long-running-agents.md
[codex-config]: https://learn.chatgpt.com/docs/config-file/config-reference
[codex-effort-issue]: https://github.com/openai/codex/issues/44769
[codex-resume-issue]: https://github.com/openai/codex/issues/48802
[connect-storage]: /Users/noah/code/sofort/arch/research/connect26/02-storage.md
[connect02]: https://www.youtube.com/watch?v=-_qUn_LfJ6M
[connect03]: https://www.youtube.com/watch?v=xMg9VDCQVWM
[connect04]: https://www.youtube.com/watch?v=fPfVJ1pd_B4
[connect06]: https://www.youtube.com/watch?v=CkGY-wtQ0Q0
[connect08]: https://www.youtube.com/watch?v=I4AMpO2KCTA
[connect09]: https://www.youtube.com/watch?v=75jxhU6z3ho
[connect11]: https://www.youtube.com/watch?v=VBsqp3NutAE
[connect12]: https://www.youtube.com/watch?v=9DGeQ6AeL5o
[deepseek]: https://www.deepseek.com/harness/en/
[do-keepalive]: https://developers.cloudflare.com/changelog/post/2026-10-01-pending-io-keep-alive/
[docker-code]: https://docker.github.io/docker-agent/features/code-mode/
[drift]: https://github.com/coylemichael/drift
[durability]: https://www.npmjs.com/package/durability
[durable-harness]: https://github.com/vercel-labs/durable-harness/blob/ea8aa4060cf4fb8cd39737ce8ab21c4e0f40c741/packages/durable-harness/README.md
[eve]: https://vercel.com/blog/introducing-eve
[exo]: https://github.com/exoharness/exo/blob/58fa2ff5fd6f411c2629dfe6b4c1a63c95e62e5b/README.md
[factory-droids]: https://docs.factory.com/harness/subagents
[factory-settings]: https://docs.factory.com/droid-cli/settings
[factory-skills]: https://docs.factory.com/harness/skills
[harness-design]: https://arxiv.org/abs/2609.20804
[harness-tokens]: https://arxiv.org/abs/2610.04433
[harness-training]: https://github.com/workofart/harness-training/tree/0900e8acc124caa8b4c7354cfeeb6750873d395e
[hermes-rule-issue]: https://github.com/NousResearch/hermes-agent/issues/136931
[hn-opencode]: https://news.ycombinator.com/item?id=50094994
[hn-pan]: https://news.ycombinator.com/item?id=48297185
[hn-qm]: https://news.ycombinator.com/item?id=49126604
[hn-training]: https://news.ycombinator.com/item?id=48884984
[krentsel]: https://www.krentsel.com/
[leanproxy]: https://mmornati.github.io/leanproxy-mcp/design/code-mode/
[managed]: https://www.anthropic.com/research/managed-agents
[managed-openshell]: https://claude.com/resources/articles/giving-companies-more-control-over-their-ai-agents-with-nvidia
[mcp-tools]: https://modelcontextprotocol.io/specification/2026-07-28/server/tools
[ms-harness]: https://learn.microsoft.com/en-us/agent-framework/concepts/harness
[npm-acp]: https://registry.npmjs.org/@agentclientprotocol%2Fsdk
[npm-code]: https://registry.npmjs.org/@cloudflare%2Fcodemode
[npm-durable]: https://registry.npmjs.org/durable-harness
[npm-eve]: https://registry.npmjs.org/eve
[npm-pi]: https://registry.npmjs.org/@earendil-works%2Fpi-durable
[oneharness]: https://github.com/nickderobertis/oneharness/blob/6e7c001b4ee310e665775e6835c1579bd6335edd/README.md
[pan-experiments]: https://www.henrypan.com/blog/2026-05-25-self-improvement-harness/
[pi-cf]: https://github.com/earendil-works/pi-durable-cloudflare/tree/dcb56ce2d174babb3f00112ac5b8cd597e58ab45
[pi-code]: https://github.com/earendil-works/pi/blob/c466a35957e73876651d014d6c36d5ea47148344/packages/coding-agent/docs/codemode.md
[pi-durable]: https://github.com/earendil-works/pi/blob/c466a35957e73876651d014d6c36d5ea47148344/packages/durable/README.md
[prime]: https://github.com/PrimeIntellect-ai/prime-agent
[prompt-waste]: https://arxiv.org/abs/2608.01347
[pydantic-code]: https://github.com/pydantic/pydantic-ai/blob/3817d208c237c2327190b0bb46365eb1ec51672a/docs/harness/code-mode.md
[qm]: https://github.com/yc-software/qm
[rollout-trace]: https://github.com/openai/codex/blob/main/codex-rs/rollout-trace/README.md
[session-spec]: https://github.github.com/gh-aw/specs/unified-agent-session-specification/
[skill-robustness]: https://arxiv.org/abs/2608.14036
[skill-up]: https://github.com/alibaba/skill-up/tree/99894b35a29d77ed81594823a736484e67a4f3f4
[skills-spec]: https://agentskills.io/specification
[skilltest]: https://github.com/nickderobertis/skilltest/blob/6c24be526a20dab7337d2f81c281e3f09ee02756/README.md
[v01]: https://www.youtube.com/watch?v=NBCM_ZoWZo8
[v04]: https://www.youtube.com/watch?v=8rEAkEvhhcQ
[v05]: https://www.youtube.com/watch?v=7mBQknCnovM
[v08]: https://www.youtube.com/watch?v=b9Ssp1B_Pf4
[v09]: https://www.youtube.com/watch?v=DF5M5CJi9sM
[v10]: https://www.youtube.com/watch?v=B2Iou-8mu9k
[v11]: https://www.youtube.com/watch?v=Bs3xRsDItiI
[v13]: https://www.youtube.com/watch?v=3C2wWsKXY3c
[v14]: https://www.youtube.com/watch?v=H0H_zhKnu3U
[v15]: https://www.youtube.com/watch?v=ESq3ostvznQ
[v16]: https://www.youtube.com/watch?v=4zMgyhXeGig
[v17]: https://www.youtube.com/watch?v=mQu0zN4IvSI
[v18]: https://www.youtube.com/watch?v=Prl858_AovM
[v19]: https://www.youtube.com/watch?v=MDUYSMJmi8A
[v20]: https://www.youtube.com/watch?v=a0sZV0qIbI0
[v22]: https://www.youtube.com/watch?v=0GzwuYGvKA4
[v23]: https://www.youtube.com/watch?v=4DhcSPkEbwI
[v24]: https://www.youtube.com/watch?v=Fxp3131i1yE
[v26]: https://www.youtube.com/watch?v=TyJkNnXFxKQ
[v28]: https://www.youtube.com/watch?v=5igY763xVk8
[v29]: https://www.youtube.com/watch?v=Dwci2xV0xgo
[v30]: https://www.youtube.com/watch?v=NUTuk5EwxoM
[v31]: https://www.youtube.com/watch?v=O8cl4R5VEOI
[v34]: https://www.youtube.com/watch?v=TU8kwE7z1qY
[v35]: https://www.youtube.com/watch?v=deiLxNZH_DM
[v36]: https://www.youtube.com/watch?v=kQguG4YS0d0
[v37]: https://www.youtube.com/watch?v=Z7l1EHfCMU8
[v38]: https://www.youtube.com/watch?v=3v7dIHh15dk
[v39]: https://www.youtube.com/watch?v=VNJ8P1GqxnA
[v40]: https://www.youtube.com/watch?v=eN5WeD3zlrE
[v41]: https://www.youtube.com/watch?v=0WeQLAZVJ8w
[v42]: https://www.youtube.com/watch?v=1Niex0BvwQk
[v43]: https://www.youtube.com/watch?v=2MUWvEbQI0w
[v45]: https://www.youtube.com/watch?v=YIhvrvHtonk
[v46]: https://www.youtube.com/watch?v=Y_p3y6zP5QE
[v47]: https://www.youtube.com/watch?v=dAoOYFx7ZYw
[v48]: https://www.youtube.com/watch?v=-ZikRWR1Gb4
[v49]: https://www.youtube.com/watch?v=287Q-bs_pEU
[v50]: https://www.youtube.com/watch?v=MRQTlwcW-aQ
[v51]: https://www.youtube.com/watch?v=hvwtHZ5E27c
[v52]: https://www.youtube.com/watch?v=5lFD-34dhqE
[v53]: https://www.youtube.com/watch?v=MrIzFnU0unk
[v55]: https://www.youtube.com/watch?v=aYz9G3__Z4g
[v56]: https://www.youtube.com/watch?v=BLRReTwV8Fc
[v60]: https://www.youtube.com/watch?v=-ulRSvQIObk
[v61]: https://www.youtube.com/watch?v=4wBVuj2an8E
[v63]: https://www.youtube.com/watch?v=W_8R9ZF94tI
[v65]: https://www.youtube.com/watch?v=QHBjufYK8TA
[v66]: https://www.youtube.com/watch?v=7Y4sbZgBdnc
[v68]: https://www.youtube.com/watch?v=9dYcwOkpCE8
[v69]: https://www.youtube.com/watch?v=tUPPVhBBcoM
[v70]: https://www.youtube.com/watch?v=9fubhllmsBU
[v72]: https://www.youtube.com/watch?v=N6FkmdL0Lg0
[v73]: https://www.youtube.com/watch?v=z7cNbsr3b5s
[v75]: https://www.youtube.com/watch?v=S_lzYIvtEaQ
[v79]: https://www.youtube.com/watch?v=bU5gDVyu_28
[v80]: https://www.youtube.com/watch?v=HDdbU10r7Js
[v82]: https://www.youtube.com/watch?v=9UAxrdcDjjU
[v83]: https://www.youtube.com/watch?v=0bkeZOXNJBg
[v84]: https://www.youtube.com/watch?v=SbwckhZkPGs
[v85]: https://www.youtube.com/watch?v=FHGfSjDGUIw
[v86]: https://www.youtube.com/watch?v=5Bmp9cz1JN8
[v87]: https://www.youtube.com/watch?v=hiI0Vk4NgeY
[v88]: https://www.youtube.com/watch?v=ND_kRgU_WlY

## 6. Ranked decision

**E — Ranking:** equal-weight score totals, with ties ordered by a practical combination of authentic source pain, feasibility and suitability for an upstream contribution. These are priorities for cheap validation, not measured market sizes. No item earns more than 3/5 for a real gap after the prior-art checks.

| Rank | Project | Size | Cool | CF/Vercel/TS | Gap | Value | Better models | Not GrowOS | Total | I — condition before investing |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | P01 — Shim-retirement evidence | Small | 4 | 5 | 3 | 4 | 5 | 5 | 26 | One real shim, a meaningful exposure denominator and an owner who would use the decision. |
| 2 | P02 — Restart settings fixture | Small → Tiny | 4 | 5 | 3 | 4 | 5 | 5 | 26 | Reproduce an applied-setting discrepancy beyond existing delivery/provenance tests. |
| 3 | P03 — Nested artifact lifecycle | Tiny | 4 | 5 | 3 | 4 | 5 | 5 | 26 | A genuine cross-service lifetime failure beyond existing MCP/Pi result handling. |
| 4 | P05 — Shared-skill consumer cases | Small | 3 | 5 | 3 | 4 | 4 | 5 | 24 | Downstream owners supply and maintain actual regressions. |
| 5 | P04 — Interrupt/steer races | Tiny | 3 | 5 | 2 | 4 | 5 | 5 | 24 | An uncovered ACP/adapter ordering case. |
| 6 | P09 — Interrupted business effect | Tiny | 3 | 5 | 2 | 4 | 5 | 5 | 24 | Provider identity/readback or an explicit unresolved-outcome policy. |
| 7 | P20 — Audience/identity transitions | Tiny | 3 | 5 | 2 | 4 | 5 | 5 | 24 | One application's authoritative public/private policy. |
| 8 | P16 — Accepted-outcome cost study | Tiny/Small | 4 | 5 | 2 | 4 | 4 | 5 | 24 | A task class and assistance evidence not already covered in current studies. |
| 9 | P10 — Runner authority receipt | Small | 4 | 4 | 2 | 4 | 5 | 5 | 24 | Useful scope evidence missing from the native runner UI. |
| 10 | P06 — Factual effect display | Small | 4 | 5 | 2 | 3 | 5 | 5 | 24 | Existing events plus a measurable comprehension improvement. |
| 11 | P18 — Plugin version transition | Tiny | 3 | 5 | 2 | 3 | 5 | 5 | 23 | One supported transition not already tested. |
| 12 | P17 — Durable adapter migration drill | Big | 3 | 5 | 2 | 3 | 5 | 5 | 23 | Two adapters and an adopter with genuine exit/upgrade needs. |
| 13 | P15 — Acting-versus-asking study | Ambiguous | 3 | 5 | 2 | 4 | 5 | 4 | 23 | Independent owners can agree on narrow action/authority cases. |
| 14 | P14 — Composed-skill intent | Tiny | 3 | 5 | 2 | 3 | 4 | 5 | 22 | Native dispatch exposes a real end-state mismatch. |
| 15 | P21 — Learned-rule conditions | Small → Tiny | 3 | 4 | 2 | 4 | 4 | 5 | 22 | An authentic lost-condition pair survives the existing runner's tests. |
| 16 | P07 — Hot-plugin interference | Tiny | 3 | 5 | 2 | 3 | 4 | 5 | 22 | A supported, minimized two-plugin failure. |
| 17 | P08 — Self-optimizer contract case | Tiny | 3 | 4 | 2 | 4 | 4 | 5 | 22 | Owner actually requires the capability the optimizer removes. |
| 18 | P13 — Completion-state cases | Tiny | 3 | 5 | 2 | 3 | 4 | 5 | 22 | A model/protocol mapping the current suite misses. |
| 19 | P11 — Readiness receipt | Tiny | 3 | 5 | 2 | 3 | 4 | 5 | 22 | More than a one-line documentation/health-check fix. |
| 20 | P12 — Assisted/negative controls | Tiny | 3 | 4 | 2 | 3 | 4 | 5 | 21 | A real misleading success claim with deterministic contrary evidence. |
| 21 | P22 — Judgment-pause diary | Tiny | 2 | 3 | 2 | 3 | 4 | 5 | 19 | Owners can identify useful judgments rather than merely wait time. |
| 22 | P19 — React scenario atlas | Ambiguous | 4 | 5 | 1 | 3 | 3 | 3 | 19 | Multiple implementations lack the same useful primitive; no runtime until then. |

**I — Top three:**

1. **P01: shim-retirement evidence.** Strong direct source and a narrow addition beyond the deletion bot already described. Begin with a public case study, not a service. The key observation is whether the shim had opportunities to matter.
2. **P02: restart settings fixture.** A concrete, small investigation with high practical stakes for long goals, but the current bug hypothesis is unproven and close art is strong. Read applied updates; a stale field alone is insufficient. A tiny upstream patch is the intended scale if reproducible.
3. **P03: nested artifact lifecycle.** The most specific Code Mode integration pain and a good TypeScript-adjacent fixture. Existing result types already solve much of the direct case. Kill quickly if the composed path works; otherwise contribute the failing boundary instead of a new protocol.

**Q — Most surprising signal:** [80 1:08:00][v80], Armin Ronacher: “Pi will probably very soon hide the tool output.” **I:** the interesting reason is architectural: generated arbitrary programs undermine the tool-specific UI that used to explain what an agent was doing. Huntley's recollection of Amp's tool-specific visuals reinforces the observation independently, while remaining a discussion rather than a shipped-product measurement. This cuts against the idea that a more capable model automatically yields a better controllable agent. Mario's optimizer deleting Pi until only a shell remained is the parallel warning: optimizing the measured objective can remove the product humans valued. Neither example justifies another general harness; both justify explicit contracts and honest evidence.

**Five-line TL;DR**

1. **Q / I:** Models absorb temporary shims; state, effects, permission and user-control obligations persist.
2. **F:** Durable hosting, Code Mode, self-extension, skill runners and much cancellation/config machinery already ship.
3. **I:** Prioritize P01/P02/P03 only as narrow evidence or upstream contributions with early kill tests.
4. **I:** Skills are a portable distribution layer; equal invocation, authority and outcomes do not follow from equal files.
5. **I:** The unresolved React analogy is a research question; the concrete surprise is capability increasing while observable control regresses.
