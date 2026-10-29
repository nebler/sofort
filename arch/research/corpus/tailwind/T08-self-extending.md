# T08 — Self-extending software and the software process itself

Research date: **2026-10-29**. **Q** = quotation checked against the local raw transcript; **F** = externally sourced fact; **I** = inference, design, or ranking; **E** = estimate or proposed experimental threshold. Caption timestamps identify minute-sized blocks, not exact utterance start times. Proposals and demos below have not been implemented.

**I — The result:** investigate **a dependency that has an explicit unfinished boundary and grows when a program reaches it**. Two other leads are a live developer workbench that can retire an older feature without reverting later work, and a build system that grows reusable rule implementations. These are substantial software artifacts to grow, rather than skill collections or experiments about software methods. **None earns a high-confidence novelty claim.** The broad versions of all three already have direct prior art; the remaining scopes are stated below, with tests that can kill them.

**I — Scope:** Rust and TypeScript implementations; existing execution, storage, build, and model interfaces wherever possible. One builder can use public source, public specifications, and self-generated local application data. No customers, participating maintainers, private company data, community, kernel work, or new institution is necessary for the core demonstrations. Judgment compilers and methods laboratories are excluded.

## What the practitioners actually suggest

1. **Q — Ree, building Executor, Next Token Ep 06, 00:52:00:** “I have a contracts folder and I have an implementation folder.” At **01:03:00**, explaining why lazy loading was the wrong fix: “the better fix there is to just not use the autumn SDK”. [Video transcript, lines 56 and 67](../transcripts/11-next-token-ep-06-the-senior-engineer-death-spiral.txt). **I:** the interesting seed is owning the useful implementation behind a deliberately chosen interface. It is not the claim that model weakness at SDK design lasts forever. Ree's surname is unresolved in the corpus; do not invent it.
2. **Q — Armin Ronacher, Fragmented #312, 00:43:00:** “you actually do want it to have a certain shape at least”. He then favors a harness “capable of self-extending”, with the qualification continuing into **00:44:00** that it should not completely rewire itself. [Transcript, lines 47–48](../transcripts/05-fragmented-ai-developer-podcast-312-understanding-pi-durable-with-mari.txt). **I:** a growing program needs a retained structure people and other programs can still address.
3. **Q — Mario Zechner, the same interview, 00:45:00:** when asked to accelerate Pi startup, the agent “basically removed everything”. [Transcript, line 49](../transcripts/05-fragmented-ai-developer-podcast-312-understanding-pi-durable-with-mari.txt). **I:** successful optimization is insufficient unless the preserved behavior is independently specified.
4. **Q — Geoff Huntley, State of Agentic Coding #11, 00:49:00:** “you can evolve the program that's running live”. His preceding Lisp demo defines and retains functions, and at **00:47:00** demonstrates reverting a change. [Transcript, lines 49–53](../transcripts/80-armin-ronacher-state-of-agentic-coding-11-with-geoff-armin-and-ben.txt). **I:** creation inside a running program is already demonstrated; the lead is what happens after a long history of useful changes.
5. **Q — John Crepezzi, Jane Street, 00:07:00:** general tooling targets the “greatest common denominator use case” and “the most mainstream build systems or the most mainstream test setups”. [Transcript, line 11](../transcripts/08-jane-street-how-ai-is-changing-programming.txt). His name is corroborated by the [official episode page](https://signalsandthreads.com/), dated October 16, 2026. **I:** model-generated support for the long tail can grow inside an existing tool rather than become another general agent.

**Q — A warning against choosing the wrong accumulating artifact:** Quinn Slack asks, at **51:00**, “if a skill stack is so good, why isn't it built in to the agent?” [Amp, Raising an Agent: Stop Boxing In Your Agent, transcript line 55](../transcripts/38-amp-inc-raising-an-agent-stop-boxing-in-your-agent-season-2-episode-5.txt). **I:** instructions compensating for today's model are a weak asset. Executable behavior that remains useful with inference disconnected is a stronger one.

## Occupied territory removed from the shortlist

| Broad pitch | Checked prior art | Disposition |
|---|---|---|
| An IDE that builds its own features | **F:** [bb](https://github.com/get-bb/bb) describes exactly that, with a plugin architecture. | **I:** dropped. A different editor shell is insufficient. |
| An agent that rewrites its harness behind protected state | **F:** [Exo](https://github.com/exoharness/exo) and its [architecture documentation](https://exoharness.ai/docs/architecture/harnesses) separate replaceable harness semantics from durable history and infrastructure. | **I:** dropped. The corpus's own practitioner is already building the broad proposal. |
| Generated tools or libraries, tested and retained across sessions | **F:** [NVIDIA NOOA](https://github.com/NVIDIA-NeMo/labs-OO-Agents/blob/main/skills/nooa-self-extending/SKILL.md) documents persistent agent-written libraries and reload; [AWS Strands' 2026 article](https://aws.amazon.com/blogs/devops/building-self-extending-cli-tools-with-aws-strands/) demonstrates self-extending CLIs. | **I:** dropped. Adding a registry or a validator does not reopen it. |
| Generated, managed, or pruned skill libraries | **F:** [SELM, October 2026](https://arxiv.org/abs/2610.24630) explicitly manages retrieval, updates, utility, and lifecycle. | **I:** dropped. Skill accumulation itself is taken. |
| An SDK generated from an API description | **F:** [Stainless](https://www.stainless.com/docs/sdks/typescript/) already generates typed clients; its [feature comparison](https://www.stainless.com/docs/compare/speakeasy/) includes retries, pagination, idempotency, and streaming. | **I:** dropped. Those features are not a residual gap. |
| An issue-to-fix software factory | **Q:** Matt Pocock describes Lars Grammel building an “entire software factory” for the Vercel AI SDK at **01:32:00–01:33:00**. [Transcript, lines 96–97](../transcripts/23-the-pragmatic-engineer-ai-skills-with-matt-pocock.txt). **Q:** Zach Lloyd calls for a “skill loop” with observer agents at **14:00**. [Warp talk, line 18](../transcripts/69-ai-engineer-software-engineering-is-becoming-factory-engineering-zach-.txt). | **I:** dropped. Named teams are doing the broad work. |

## 1. Unfinished Library — a dependency that grows at its declared boundary

**I — One sentence:** an application owns a deliberately partial library; an unsupported operation stops with a structured growth request, an agent extends the library inside a fixed semantic boundary, and accepted code becomes an ordinary dependency requiring no model to run.

### The seed

**Q — Ree, Next Token Ep 06, 00:52:00:** “implementation becomes like an implementation detail”; **01:03:00:** “I don't need all of it.” [Transcript, lines 56 and 67](../transcripts/11-next-token-ep-06-the-senior-engineer-death-spiral.txt). **I:** make that distinction executable: an application asks for precisely the behavior it needs, while the implementation can remain unfinished elsewhere. The proposal extrapolates from his SDK discussion; he does not describe this design.

### What grows, and what the builder designs

**I — Grown artifact:** a source-owned library of useful data operations, their explicit supported domains, and implementations. Start with pure structured-data and text operations; postpone network clients, cryptography, object identity, and frameworks with ambient behavior. The destination is a broad, composable local data toolkit whose implementation expands through real application demands, rather than a collection of endpoint wrappers.

**I — The structure:** every operation has a stable typed identity, an executable semantic contract, an explicit domain predicate, and one of three outcomes: value, ordinary semantic error, or `NeedsGrowth`. The dispatcher, contract interpreter, domain checks, and promotion rules are outside the generator's edit surface. The model may implement an uncovered operation or enlarge a domain, but cannot convert unsupported behavior into a plausible default. Growth happens in a development copy; production never silently sends an unexpected input to a model.

**I — A concrete case:** the application already uses an owned CSV reader. A newly encountered export needs embedded newlines and a distinct quoting convention. The reader reports an unsupported dialect before producing records. The growth task supplies the format requirement and independent examples. The agent grows parser support, the old application and its accepted cases continue to run, and the new parser is retained. Later, a structured projection requested by the application grows as another operation and composes with the reader. Repeating either task uses the compiled library.

**I — The check:** validate code against the executable contract and the existing operation suite; run differential tests against an appropriate pinned reference where one exists; keep held-out dialect and malformed-input cases outside the editing workspace. A claim that an entire input domain is covered needs a proof or exhaustive check in the restricted representation. Tests alone confer only tested confidence. An uncertain generalization keeps a narrower domain or remains `NeedsGrowth`. The builder must distinguish an executable specification from a reference implementation that happens to share the same defect.

### Tailwind and the one-shot test

**I — Tailwind:** a stronger model implements more difficult operations and larger supported domains per growth attempt. It also becomes better at replacing old implementations while the fixed contract remains. The grown code continues to work locally, quickly, and without inference. The project benefits when synthesis becomes cheap enough to turn previously uneconomic edge cases into ordinary library support.

**I — One-shot test:** a future model could generate the seed and many common functions in one prompt. That alone is not a defensible project. The larger artifact consists of an application-driven closure of operations, accepted semantic choices, and compositional behavior, repeatedly extended as new requirements arrive. A prompt containing only this idea cannot supply those future requirements or an already executed validation history. Conversely, if supplying the known requirements to a stock agent recreates an equally usable library with equally clear unsupported boundaries, the structure contributes too little; kill it. Size and accumulated test counts are not sufficient defenses.

**I — Value proposition:** **own the small, useful library your program actually needs, and make its unfinished parts visible instead of trusting a plausible imitation.**

### Six-week version and demo

**E:** Rust library modules, a TypeScript consumer, ten useful operations across two families, and a permanent `NeedsGrowth` path. Weeks 1–2 establish the contract/domain boundary; weeks 3–4 grow operations from actual consumer requests; weeks 5–6 exercise compositions, domain expansion, and replacement of an accepted module. Use public format specifications and locally generated fixtures. Set a €400 inference ceiling; reduce scope if it is reached.

**E — Demo:** disconnect inference after growth. Run an application over a directory of exports using only the retained modules. Introduce a new dialect: it stops explicitly. Reconnect the builder, grow support, rerun the same application, then disconnect inference again. Include an agent patch that tries to remove an old error case; the promotion fails. The surprise is that the dependency gets more complete and remains ordinary software.

### Prior art and precisely what is left

**F:** [Harp, CCS 2021](https://doi.org/10.1145/3460120.3484736), already learns component behavior through queries and regenerates string libraries in a restricted language. **F:** [Singla and Davis, July/October 2026](https://arxiv.org/html/2607.13021v1), directly study regenerating only a repository's used dependency slice. Their reported 99.8% preservation is bounded to repository validation; they explicitly discuss missing edge behavior and the need to refresh replacements. Their paper already proposes stronger differential and coverage-guided checks. These are direct predecessors, not distant analogies.

**I — Residual:** a continuously usable, explicitly partial library with operation/domain misses as its normal extension interface, and preserved compositions across growth. Merely adding better tests, provenance, or an LLM to Harp does not qualify. No reviewed source established the complete residual product, but that is a low-to-medium-confidence search result, not evidence that nobody is pursuing it. This should begin as an extension of those systems' ideas, with a functional artifact as the outcome, rather than a new dependency-regeneration category.

### The kill

**I — Strongest objection:** partial-domain validation is either prohibitively expensive or so restrictive that ordinary vendoring plus a coding agent is better. If the reference package remains necessary on every real input, there is little practical ownership gain.

**E — Cheapest test, two days:** take three public consumers and two operation families. Compare ordinary vendoring plus a stock coding agent with an explicit partial implementation, then reveal five new requirements per consumer. Require the latter to detect misses before emitting an incorrect result and to preserve accepted compositions after growth. Stop if every miss becomes a bespoke human specification exercise, if useful domain claims cannot be checked, or if the ordinary-agent baseline gives the same behavior with less machinery. Bundle-size gains must be compared with tree shaking, not an unoptimized install.

## 2. Living Workbench — software that can outgrow an older feature

**I — One sentence:** a local developer workbench grows its own commands, views, and data model, while retaining the ability to remove an earlier feature and keep compatible later features and subsequent user work.

### The seed

**Q — Armin Ronacher, Fragmented #312, 00:43:00:** “you actually do want it to have a certain shape at least”. **Q — Geoff Huntley, State of Agentic Coding #11, 00:51:00:** “you could develop the software in the software”. [Armin transcript, line 47](../transcripts/05-fragmented-ai-developer-podcast-312-understanding-pi-durable-with-mari.txt); [Geoff transcript, line 55](../transcripts/80-armin-ronacher-state-of-agentic-coding-11-with-geoff-armin-and-ben.txt).

**I:** take these literally as a product architecture. The application grows around the builder's own research/code artifacts. Its defining challenge is long-lived evolution of code **and** data, not generating another panel.

### What grows, and how it is checked

**I — Grown artifact:** one complete local workbench for inspecting repository results, grouping failures, comparing runs, annotating findings, and assembling views. Missing capabilities become extensions inside the running product. Build the useful workbench itself; a generic extension validator would be too small a destination.

**I — The structure:** TypeScript feature modules expose typed commands and views; a Rust/SQLite host owns stable record IDs, the event log, schema versions, and the accepted feature graph. Record creation and manual edits belong to the durable user history. Feature-derived indexes and materialized views are separately rebuildable. Features declare dependencies and effects through host interfaces. Migrations retain the information needed to reconstruct older representations; generated modules cannot issue arbitrary SQL against shared tables.

**I — A concrete retirement:** feature 3 adds automatic tags and rewrites a display name; feature 11 adds a comparison view; the person later corrects several names and writes annotations. Removing feature 3 must remove its rule and derived tags while keeping annotations, manual corrections, and feature 11 where its contract remains satisfiable. Replay recomputes derived state from durable events with feature 3 absent. A genuine dependency on feature 3 produces an explicit removal closure or an offered replacement, rather than a promise to preserve an impossible combination. External effects such as sent messages are outside the reversible domain.

**I — The check:** exercise candidate histories against copied databases, compare preserved record IDs and manual edits, and replay protected observation cases for retained features. Check declared effects against observed host calls. Promote code, schema mapping, and the accepted feature graph together at a transaction boundary. Compare this with scoped snapshots and ordinary event sourcing; generated recovery programs receive no presumption of superiority. Arbitrary JavaScript semantics and unmediated effects remain outside the supported contract.

### Tailwind, one-shot test, and value

**I — Tailwind:** each model generation can grow more capable features and synthesize better adaptations between older and newer ones. Faster feature creation makes controlled retirement more useful. The retained application, its data, and deterministic commands remain usable when the model is unavailable. This does not depend on preserving today's harness tricks or inferring a person's judgment from decisions.

**I — One-shot test:** an agent can generate a fresh workbench and an undo button. It cannot reconstruct an unknown history of later manual edits, retired schemas, and independently grown features from the product idea alone. The designed distinction between durable human work and recomputable feature effects is what permits future models to change the program without recreating that history. If the design only stores a full application snapshot per edit, this collapses into existing products.

**I — Value proposition:** **keep improving your tool without making every successful customization permanent.**

### Six-week version and demo

**E:** a single local repository-results workbench, eight grown features, three schema shapes, and at least twenty interleaved feature/data events. Weeks 1–2 build the useful seed and event model; weeks 3–4 grow features through its own interface; weeks 5–6 implement retirement, replay, restart, and dependent-feature handling. Rust/SQLite plus TypeScript; a €500 inference cap. A broad desktop productivity platform is outside this version.

**E — Demo:** use the workbench, grow features around a real public repository, add annotations, restart the process, grow more features, and then remove an early behavior. Show retained later results and manual edits. Include a truly dependent feature so the product visibly refuses an invalid removal rather than faking success. Turn off the model: the resulting workbench still functions.

### Prior art and precisely what is left

**F:** [Powermove](https://github.com/iterative-computer/powermove) already builds a running application through typed, transactional, undoable extensions. **F:** [EvoUndo v2, September 2026, Appendix D.4](https://arxiv.org/html/2608.28363v2), already evaluates undoing one mutation while preserving an intervening mutation. Its scoped-snapshot baseline is stronger in that modeled serializable regime, with no EvoUndo-only wins. Its stated limits include unmodeled external state. **I:** therefore selective undo, recovery checks, and live self-extension are all taken.

**F:** [Cambria](https://www.inkandswitch.com/cambria/) supplies schema-evolution lenses, and [Patchwork, 2024–2026](https://www.inkandswitch.com/project/patchwork/) explores universal version control. **I — Residual:** an actual developer workbench maintaining long histories of evolving executable features, changing schemas, and subsequent manual data edits, with a concrete retirement operation. Changing the domain of Powermove alone is insufficient; that history-preservation capability must be demonstrated. The remaining uncertainty is large: these mechanisms may compose cleanly enough that an existing app can add it directly. Novelty confidence is low-to-medium.

### The kill

**I — Strongest objection:** append-only records plus namespaced extensions already solve nearly every useful case. The exceptional cases require human decisions rather than a better software substrate. An elegant retirement mechanism might never earn its architectural cost.

**E — Cheapest test, two days:** implement only three features, a schema change, and later manual edits. Try the retirement using ordinary event sourcing, scoped snapshots, and a normal agent before designing anything else. Stop if those baselines meet the promised behavior directly, if the effect boundary excludes most useful features, or if every removal needs a fresh product decision. Do not turn a failed product hypothesis into another lifecycle benchmark.

## 3. Growing Build Rules — teach the build system a new kind of work

**I — One sentence:** when a repository contains a build step the tool does not understand, models grow a reusable, parameterized rule implementation that joins the ordinary deterministic build graph and can serve subsequent repositories without inference.

### The seed

**Q — John Crepezzi, Jane Street, 00:07:00:** “the most mainstream build systems or the most mainstream test setups”. At **00:09:00**, he describes “a team that kind of works to take us out of that”, referring to tooling inflexibility. [Transcript, lines 11 and 13](../transcripts/08-jane-street-how-ai-is-changing-programming.txt). **Q — Mario Zechner, Fragmented #312, 00:42:00:** extensions bundle “system prompt contributions, tools, and hooks”. [Transcript, line 46](../transcripts/05-fragmented-ai-developer-podcast-312-understanding-pi-durable-with-mari.txt).

**I:** extend the executable build vocabulary itself, instead of handing every unsupported project back to an agent to improvise a shell script.

### What grows, and how it is checked

**I — Grown artifact:** a reusable rule library for code generators, asset pipelines, native add-ons, and unusual combinations of TypeScript and Rust tooling. Begin with ordinary compilation delegated to existing tools. A missing integration grows into a named rule with parameters, declared tools, input discovery, outputs, and invalidation behavior. The destination is build support that expands with encountered software, without a human team hand-authoring each long-tail integration.

**I — The structure:** reuse an existing hermetic executor and content store. A small Rust coordinator accepts TypeScript rule modules that produce a declarative action graph. Rule modules get a constrained discovery interface; build actions run with declared inputs and controlled effects. Missing-rule requests include the original successful build command, observed inputs/outputs, and the unsupported step. The builder owns graph validation and acceptance criteria. An agent cannot accept an opaque `run the old build system` action as a newly understood rule.

**I — The check:** compare the candidate with the original build's required outputs and functional tests. Repeat in a clean environment; vary source inputs, generator options, and dependency versions; confirm the right outputs rebuild and unrelated actions remain cached. Observed reads are evidence of inputs for those runs, not a proof of complete dependency discovery. Undeclared reads fail inside the executor. A successful exit or byte-identical repeated output alone does not establish functional equivalence.

**I — Crucial distinction:** after learning a generator in repository A, the frozen rule must recognize and correctly build a second, independently selected repository B with different paths and options. No model invocation or repository-specific patch may be needed for B's supported case. Otherwise the artifact is a pile of per-project recipes, already well served by existing work.

### Tailwind, one-shot test, and value

**I — Tailwind:** stronger models can understand more build conventions, infer better parameters, and grow integrations for harder pipelines. Retained rules then schedule, cache, and execute with no model. The project becomes more useful as generated applications choose a wider variety of tools and as model output creates more build load.

**I — One-shot test:** a future model can write a BUILD file or an individual adapter in one prompt. The intended artifact is a working closure of reusable rules, with observed functional and incremental behavior across independently varying consumers. That closure is not supplied by the idea or by a single successful build. If a stock agent plus existing rules produces equivalent reusable support on demand, the project has no separate justification.

**I — Value proposition:** **use an unfamiliar tool without spending a week teaching your build system how to run it correctly.**

### Six-week version and demo

**E:** one host platform, existing sandbox/executor, Rust coordinator, TypeScript rule modules, and six public repositories covering three integration families. Weeks 1–2 implement action contracts and ordinary compilation; weeks 3–4 grow three reusable rules; weeks 5–6 apply frozen rules to reserved repositories and verify functional outputs and invalidation. Set a €350 inference ceiling. Cross-platform coverage and new compilers are outside the version.

**E — Demo:** encounter an unknown generator in repository A, grow its rule, and build it. Disable inference and build repository B, which uses the same generator with different options. Change one generator input: only the correct downstream actions rebuild. Deliberately introduce an undeclared file read and show rejection. The surprise is newly acquired build understanding being reused, rather than another green migration report.

### Prior art and precisely what is left

**F:** [Gazelle](https://github.com/bazel-contrib/bazel-gazelle) already generates BUILD files and supports language/rule-set extensions. **F:** [Vibenix, 2026](https://sr-lab.github.io/publication/2026/Vibenix-Extended/) already generates and repairs Nix packaging expressions; its evaluation distinguishes buildability from functional correctness. **F:** [EngFlow's any2bazel work, October 13, 2026](https://blog.engflow.com/2026/10/13/benchmarking-any2bazel-towards-more-efficient-migrations/), already automates migration and compares outputs against original builds. A funded vendor is directly pursuing that broad opportunity. **I:** generic AI packaging, migration, or build repair is dropped.

**I — Residual:** automatic growth of reusable rule **implementations**, with parameters and incremental dependency semantics that transfer to another repository. This is narrower than those broad products, but dangerously close to their natural expansion. Search did not establish that this exact loop ships; it also did not establish that the owners are ignoring it. Novelty confidence is low. Prefer an extension to an existing build ecosystem over a competing build engine, and stop if EngFlow or another current tool already produces the demonstrated transferable rule.

### The kill

**I — Strongest objection:** useful tools either already have rules, need only a small command wrapper, or have such project-specific behavior that the supposedly reusable rule keeps reopening into bespoke agent work. Build vendors can absorb the middle ground.

**E — Cheapest test, two days:** choose two public repositories using one generator without adequate existing native support. Ask an ordinary coding agent to create a general rule using current build tooling. Freeze it and apply it to the second repository. If it transfers and passes clean, functional, and invalidation checks, there is no missing growth substrate to build. Also stop if the candidate requires project-specific human intervention for every use. This test validates a product affordance; it is not a proposal for a software-methods lab.

## Ranking and ONE pick

**I — Ranking is relative to this brief, not a measured market forecast.** All three have substantial prior art and uncertain differentiation.

| Rank | Direction | Why it is still worth considering | Main reason to reject it |
|---|---|---|---|
| **1** | **Unfinished Library** | Closest to demand-triggered growth of useful, retained code; the explicit unsupported boundary is a concrete semantic contribution. Public inputs suffice. | Harp and 2026 regeneration work are very close; checking useful domains may erase the advantage. |
| **2** | **Living Workbench** | The most compelling product demo: the running tool grows around real work, then sheds a feature while keeping that work. | Powermove, EvoUndo, event sourcing, and schema lenses already cover much of the mechanism. |
| **3** | **Growing Build Rules** | Clear engineering value, independent functional checks, and executable reuse after growth. | Funded build companies occupy the surrounding opportunity; reusable rule growth may be an ordinary extension. |

**I — ONE pick: Unfinished Library, subject to the two-day boundary-and-growth test.** Its useful distinction is that partial software remains explicitly partial while becoming more capable. Start with actual consumer demands and the existing Harp/regeneration baseline. If the result is merely a generator plus tests, drop it. Do not rescue it as a package-behavior atlas, a software factory, or a provenance institution.

**I — The 10× ambition:** each destination is a sizable useful system whose supported surface grows over months: an application-shaped data library, a continually evolving developer workbench, or reusable support for a long tail of build conventions. **E:** a dedicated solo builder can attempt a narrow seed in six weeks and a serious system over roughly a year; this is a scope estimate, not a schedule promise. Producing the whole advertised surface in six weeks would require removing the central claims.

### Three-line TL;DR

1. **I:** Pick an explicitly unfinished dependency: real application needs trigger checked growth, and accepted code runs without a model.
2. **F/I:** Self-extension, selective undo, usage-based regeneration, SDK generation, and AI build migration all have direct prior art; the narrow residuals above are the proposals.
3. **I/E:** Run the two-day tests against those incumbents before building a platform; stronger models should enlarge the retained software, not just obsolete its instructions.

## Search audit and limits

**F — Work performed:** re-read the brief and kill-list context; searched the S05 prediction board and extraction ledgers, including the Pi, Exo, Amp, skills, and factory rows; checked the quotations above in the raw transcripts. Earlier stack reports were background and competitor leads, not substitutes for opening the primary sources.

**F — Live prior-art searches on 2026-10-29 included:**

- `"self-building" "bb" IDE` → bb; primary repository opened.
- `"Exo" "harness" Krentsel 2026 self improving` → Exo; repository and current architecture opened.
- `"self-extending" library code generation` → NOOA and Strands; primary documentation opened.
- `self evolving software library persistent synthesis 2026 site:arxiv.org` → self-evolution surveys, Genesis, and SELM. **I:** generic persistent-project orchestration is also crowded; Genesis is not evidence that this report's partial-library contract exists.
- `self modifying software feature selective undo migrations agent 2026` and `"EvoUndo" "2608.28363"` → EvoUndo; the full text and selective-undo appendix were read, not just its abstract.
- `AI dependency replacement application specific minimal libraries self growing 2026` → Singla/Davis; the full text was opened, including its maintenance and verification agenda. Its cited Harp predecessor was then checked at the publisher.
- `"Nix" "agent" "build" "2026" automatic packaging` → Vibenix; the lab's publication page was opened.
- `"Bazel" "AI" "migration" "2026" BuildBuddy EngFlow` → any2bazel; EngFlow's current report was opened.
- `"build rules" "agent" "reusable"` and `"Bazel" "AI" "rule"` → general build tooling and Gazelle; no verified exclusive gap.
- `AI maintain downstream forks upstream patches agent 2026` → GitHub's [feature-sync workflows](https://github.github.io/gh-aw/gallery/multi-repo/feature-sync/) and other fork-maintenance agents. **I:** ordinary autonomous fork maintenance was dropped rather than added as a fourth idea.
- `site:news.ycombinator.com/item "self-extending"` → creator posts for [Moltis](https://news.ycombinator.com/item?id=46993587) and [Wizard](https://news.ycombinator.com/item?id=48845182). **I:** these reinforce that runtime skill creation and self-modifying Rust agents are occupied; HN comments are not reliability measurements.
- `site:x.com "self-extending" "Pi"` and `site:x.com "getbb.app"` → no indexed results returned. **I:** X coverage is weak; this is a search limitation, never an absence claim.

**I — What remains uncertain:** no code was run, no vendor was privately contacted, and unannounced roadmaps cannot be excluded. Current documentation can describe work in progress; a research result is not a production product. The three residuals are bounded build hypotheses with identifiable incumbents and stop conditions, not claims of an untouched field.
