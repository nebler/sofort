# 09 — Self-extending end-user applications

Research round 10 · 2026-10-28 · lens: selfext-apps

**I — Verdict:** Generating an interface, persisting an artifact, and giving generated code an isolated database are occupied territory. The interesting remainder is the relationship between extensions: which combinations are acceptable, which personal changes survive an upstream release, and which saved interactions survive a change of app or host. Keep three narrowly scoped experiments. **ONE pick: a feature-collision workbench for generated applications**, built on existing state-machine tools and an application-owned effect broker. Its gap and demand remain conditional.

Claim labels: **F** = sourced fact; **M** = locally measured result; **I** = inference/design proposal; **E** = estimate or proposed threshold. Publication dates appear where available; otherwise a source was inspected on 2026-10-28. No runtime benchmark or product deployment was performed, so there are no **M** performance claims. GitHub reaction counts below came from the public API on that date and are signals of attention, not customer counts.

## 1. What changed at this layer

- **F — Interface generation has demonstrated user appeal.** Google's November 18, 2025 paper reports an **82.8% preference over Markdown** on its LMArena prompt evaluation. It sampled 100 prompts, excluded eight, used two raters per comparison, and showed pre-generated results: generation latency was excluded. This is evidence about presentation preference, not correct business behaviour, persistence, or maintainability. [Paper, §3](https://generativeui.github.io/static/pdfs/paper.pdf). The accompanying product report describes complete HTML/CSS/JS experiences and acknowledges generation times of a minute or more and occasional inaccuracies. [Google Research, 2025-11-18](https://research.google/blog/generative-ui-a-rich-custom-visual-interactive-user-experience-for-any-prompt/).
- **F — End users already generate enormous numbers of artifacts.** Anthropic reported more than **half a billion artifacts** in June 2025; that count includes artifacts generally, not half a billion deployed applications. Its current help page describes persistent personal/shared storage, with a **20 MB text-only limit per artifact**. It also distinguishes artifacts made before September 16, 2026 from the newer system. Calling Artifacts universally ephemeral would be stale. [Anthropic, 2025-06-25](https://www.anthropic.com/news/build-artifacts), [current artifact documentation](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them).
- **F — The rendering approaches are converging.** Google's June 17, 2026 A2UI/MCP Apps article supplies three integration patterns, including native declarative surfaces and embedded custom apps. A new JSON-to-components protocol, or a bridge between native components and iframes, has direct platform prior art. [Google A2UI team](https://developers.googleblog.com/a2ui-and-mcp-apps/).
- **F — Typed machines and executable examples already exist.** Stately generates and modifies state machines with AI; XState provides graph/path generation. Foldkit supplies explicit Model/Message/update architecture, Commands, Story/Scene tests and runtime inspection through MCP. The latter remains pre-1.0. [Stately generation](https://stately.ai/docs/generate-flow), [XState graph utilities](https://stately.ai/docs/graph), [Foldkit README](https://github.com/foldkit/foldkit).
- **F — The infrastructure for durable generated apps is supplied by its owner.** Cloudflare announced Durable Object Facets for Dynamic Workers on April 13, 2026, explicitly targeting an individual database for each generated app. Current Dynamic Workers documentation includes runtime code loading, selected bindings, network controls and custom limits. [Facet announcement](https://blog.cloudflare.com/durable-object-facets-dynamic-workers), [Dynamic Workers, updated 2026-10-12](https://developers.cloudflare.com/dynamic-workers/).
- **F — The small programmable cloud already has a development lifecycle.** Val Town shipped multi-file vals, branches, three-way merges and pull requests in June 2025, with Townie itself implemented in user space. Its March 2026 newsletter describes per-val SQLite databases and agent access to history, branches and data. [2025-06-03](https://blog.val.town/newsletter-25), [2026-03-10](https://blog.val.town/newsletter-26).

**I — The rigor flip:** agents can pay the authoring cost of explicit events, transition tables, schemas, migration fixtures and effect declarations. Users still have to supply intent, and the application still has to supply authority. More code generation makes those boundaries more useful. It does not make a type checker an oracle for whether a new feature is desirable.

**F/I — Historical caution:** Ink & Switch's June 2025 essay explicitly says AI code generation leaves composition and modification of existing tools unresolved. It also documents the maintenance burden of mods and interference between them. This is the closest statement of the problem, rather than proof of a market. [Malleable Software](https://www.inkandswitch.com/essay/malleable-software/).

## 2. Pattern taxonomy: what is actually extended?

**I — Reading rule:** separate UI, data schema and behaviour; separate source-code merging, document-data merging and behavioural compatibility. An entry with no published merge contract below means that the inspected source does not establish one. It is not a claim that the implementation cannot be extended.

### A. A model chooses a view from an existing application

**F — Vercel AI SDK UI/RSC.** The application developer defines tools and components; the model selects tools and supplies data, and application code renders the corresponding components. The extension is usually the current conversation's presentation and interaction path. AI SDK RSC is still marked experimental and its documentation recommends AI SDK UI for production. [Generative UI guide](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces), [RSC overview](https://ai-sdk.dev/docs/ai-sdk-rsc/overview), [documented RSC limitations](https://v4.ai-sdk.dev/docs/ai-sdk-rsc/migrating-to-ui).

**I — Lifetime/check:** persistence belongs to application message/data storage. Typed tool inputs and developer-owned components check the permitted vocabulary; they do not establish a new reusable feature's migration or merge semantics. A model choosing a weather card is a different degree of extension from a user installing new behaviour.

### B. A model writes a whole interactive response

**F — Google's generative UI.** An agent produces a complete web page and associated assets, with tools and post-processing; the result runs in the browser. The paper evaluates the rendered experience. [2025 paper, §2](https://generativeui.github.io/static/pdfs/paper.pdf).

**I — Lifetime/check:** generated source can be retained and edited, but the inspected paper does not specify upstream feature rebasing or multi-user semantic merges. A successful page and a human preference score do not establish those contracts. This approach maximizes freedom and leaves the application's behavioural specification largely to its author.

### C. A user and model co-author a hosted artifact

**F — Claude Artifacts/live apps.** A user asks for changes; Claude edits a retained artifact that can be revisited and shared. Current artifacts can connect apps and store personal or shared data. The storage decision is made by the artifact's builder. [Current Claude help](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them), [2025 AI-powered app announcement](https://www.anthropic.com/news/build-artifacts).

**I — Lifetime/check:** hosting, persistent data and sharing already exist. The current help page does not specify the execution isolation mechanism for every new artifact type, so do not infer it from legacy iframe implementations. Sharing an artifact also does not establish a contract for independently modified users to merge behaviour and data.

### D. A developer supplies an app inside an agent host

**F — ChatGPT Apps SDK and MCP-UI/MCP Apps.** MCP Apps serves HTML interfaces as resources inside sandboxed iframes, with a host bridge. MCP-UI now identifies itself as an implementation of the MCP Apps standard. OpenAI's current plugin reference documents `widgetState`, `setWidgetState`, typed tool output and widget-initiated tool calls. [MCP-UI](https://mcpui.dev/), [official MCP Apps repository](https://github.com/modelcontextprotocol/ext-apps), [OpenAI reference](https://developers.openai.com/plugins/reference).

**I — Who/check:** developers, possibly assisted by agents, extend the host's available tools and UI. Schema validation, sandbox policy and host permission checks constrain execution. Widget snapshots, backend records and an installed extension's source are three different persistence objects. The bridge does not make them one versioned application.

### E. A model composes a trusted component/function catalog

**F — A2UI.** The agent sends declarative descriptions; the client renders its own catalog. Current source includes data-model state, function calls, validation, version adapters, and conformance cases for message-processor state machines. Its composition tests include allowed parent/child constraints. This is much richer than “JSON without state.” [Repository](https://github.com/a2ui-project/a2ui), [pinned conformance overview](https://github.com/a2ui-project/a2ui/blob/2e3d9bc434a34ba25498a11e0bfba079b52dcf29/conformance/README.md), [composition constraints](https://github.com/a2ui-project/a2ui/blob/2e3d9bc434a34ba25498a11e0bfba079b52dcf29/conformance/core/composition_constraints.yaml).

**F — AG-UI.** This supplies streaming interaction events, including state snapshots/deltas and tool/lifecycle events. It connects agent and frontend state; it is not itself a browser isolation mechanism. [AG-UI events](https://docs.ag-ui.com/concepts/events).

**I — Remaining distinction:** protocol validity and a known renderer state machine do not establish application-level rules such as “a cancelled reservation cannot trigger confirmation.” Those rules belong to the host's domain model and effects.

### F. A user and agent edit a conventional source project

**F — v0, Lovable, Bolt and Val Town.** These supply code generation/editing and project lifecycle facilities. v0's current changelog includes Git-backed versions, PR creation/merging, CI visibility and branch-protection handling. Lovable describes remixing as an independent owned project copy. Bolt documents version-history restoration and its integrated database. Val Town provides source branches and merges. [v0 changelog, through October 2026](https://v0.app/changelog), [Lovable remix](https://docs.lovable.dev/features/projects/remix), [Bolt walkthrough](https://support.bolt.new/building/quickstart), [Val Town](https://blog.val.town/newsletter-25).

**I — Lifetime/check:** generated code runs as an application after generation; deployed data lives in its backend. Build/tests, source review and platform checks are the acceptance mechanisms. A clean source merge can preserve syntax while changing someone's personal workflow. An independent project copy also has different semantics from multiple personal interfaces sharing one live data set.

### G. A document gradually becomes software

**F — Potluck and Embark.** Potluck combines live text searches, JavaScript formulas and annotations/widgets. Embark separates structured mentions, formulas and views in an outline; it is a TypeScript web app using Automerge for persistence and collaborative sync. Embark's authors explicitly left principled schema handling out of scope and reported collaboration quality problems. [Potluck, 2022-10](https://www.inkandswitch.com/potluck/), [Embark, 2023-11](https://www.inkandswitch.com/embark/).

**I — Who/check:** a user authors the data and computations; an agent could help. The saved document is the locus of extension. Formula evaluation and schema conventions check some errors; a CRDT merging the document does not establish that two added computations have compatible meanings. Potluck's essay does not specify a production storage/upgrade contract, so none is assumed here.

### H. A program carries its editing environment and live objects

**F — HyperCard and Smalltalk.** HyperCard's cards/stacks and scripts are historical precedents for moving between use and authorship. [Ink & Switch historical discussion, 2025](https://www.inkandswitch.com/essay/malleable-software/). In Smalltalk, saving an image preserves its object world; accepting a method and saving an image are distinct operations. Monticello already provides distributed package versions, optimistic branching/merging and dependency checks on load. [Squeak tools](https://learnsqueak.com/tools), [Monticello, updated 2019-11-26](https://wiki.squeak.org/squeak/1287).

**I — Check/limit:** an image makes persistence tangible, but source-package merging and migration of existing objects remain separate obligations. Reintroducing a live image does not remove them.

### I. The environment grows domain-specific inspection tools

**F — Glamorous Toolkit.** Users/developers extend object inspectors and other tools with contextual views. Its current rules pair `<gtExample>` methods, which return inspectable objects, with `<gtView>` methods, and require running relevant examples. They also document LLM-specific object views. [Moldable Development Patterns, EuroPLoP 2024](https://scg.unibe.ch/assets/archive/papers/Nier24a-MoldableDevelopmentPatterns.pdf), [GT rules](https://book.gtoolkit.com/rules-for-moldable-development-for-glamoro-3bpjoc3wh9imftaigkvwdrvxy).

**I — Lifetime/check:** extensions are Smalltalk methods/packages operating in the image; examples can serve as both tests and useful specimens. This is direct prior art for a generator that emits an inspector alongside its tests. It does not automatically qualify arbitrary end-user app mutations.

### J. A user extends an interpreter through formulas

**F — Excel, Notion and Airtable.** Excel LAMBDA creates named reusable workbook functions without VBA/JavaScript. Notion formulas have editor type checks, rich values and explicit compatibility transformations for older formulas. Airtable offers AI formula generation and formula-version comparison; formulas apply uniformly to records and have defined reference restrictions. [Excel LAMBDA](https://support.microsoft.com/en-us/excel/functions/lambda-function), [Notion Formulas 2.0](https://www.notion.com/help/guides/new-formulas-whats-changed), [Airtable, updated 2026-08-10](https://support.airtable.com/articles/8772429326-getting-started-with-the-airtable-formula-field).

**F — Coda formulas/Packs.** Current documentation, now under Superhuman, describes custom TypeScript formulas/actions, a managed sandbox, declared authentication/networking, versioned releases and doc-level version pinning. Pack code is stateless; formula results and sync-table data have their own document lifecycle. The SDK rename toward Plugins was announced October 22, 2026. [Overview](https://docs.superhuman.com/packs/build/latest/guides/overview/), [formulas](https://docs.superhuman.com/packs/build/latest/guides/blocks/formulas/), [versions](https://docs.superhuman.com/packs/build/latest/development/versions/), [rename](https://docs.superhuman.com/packs/build/latest/blog/2026/10/22/packs-to-plugins/).

**I — Check:** restricted interpreters and dependency recalculation provide a powerful extension boundary. Types and successful recalculation still cannot decide that a budget formula expresses the user's intended policy. Copying a workbook/base/doc shares a program but does not inherently merge later customizations back into its template.

### K. A canvas becomes a computing medium

**F — tldraw computer/make-real.** Computer connects natural-language components into branching/looping workflows and uses a multimodal model as its runtime. Make-real turns drawings into UI; its repository was archived February 20, 2026. The newer tldraw offline stores reusable agent-authored scripts inside `.tldraw` files and explicitly says it does not merge external changes to an open file. [Computer](https://computer.tldraw.com/), [make-real](https://github.com/tldraw/make-real), [tldraw offline README](https://github.com/tldraw/tldraw-offline).

**I — Check/lifetime:** retained documents and script packaging are real, but neither model-driven component execution nor drawing-to-code supplies a semantic merge check. Offline's explicit external-change limitation is a concrete boundary, not evidence of an implemented merge facility.

### L. Behaviour is assembled from explicit features

**F — Varv and concept/synchronization systems.** Varv represents concepts, actions and triggers declaratively; its examples let features be enabled/disabled. Its paper discusses template copying during extension, and its example gallery pins framework versions because upgrades can break examples. Meng/Jackson's 2025 work explicitly targets LLM-generated, granular behaviour through independent concepts and declarative synchronizations. [Varv paper, CHI 2022](https://vis.mit.edu/pubs/varv.pdf), [example gallery](https://varv.projects.cavi.au.dk/examples/), [What You See Is What It Does, 2025-08](https://arxiv.org/abs/2508.14511), [TypeScript skeleton](https://github.com/eagonmeng/sync-blank).

**I — Why this matters:** a feature boundary can expose state, events and effects to a checker. A proposal for “LLMs assemble declarative behaviours” must treat these systems as close prior art. The potential addition is a usable acceptance workflow around independently authored extensions.

**I/F — Brief's “bb” ambiguity:** for this report only, assume **babashka**, whose executable is officially `bb`, rather than identifying an unspecified agent product. It is an example of an existing language runtime exposing scriptable capabilities, outside the main end-user lens. The brief does not provide enough evidence to identify the builder's intended referent. [Babashka book](https://book.babashka.org/).

## 3. Prior rounds that can return, and the conditions

- **F — R2, `01-archaeology`, “Software that can be rebuilt while people are using it.”** It proposed independently checked upgrades against actual old states; its capsule/image dependency was conditional. **I — Revival:** apply the preservation obligation to explicit app state and installed features, with ordinary versioned source and no heap migration. This becomes candidate B. [Catalogue R2](../catalogue/R2-moonshots.md#2-software-that-can-be-rebuilt-while-people-are-using-it).
- **F — R2, `06-selfgrowing`, “A malleable application that grows at the point of use.”** It finished last among its finalists because close prototypes existed and the intended-change oracle was weak. **I — Revival:** separate the user's acceptance of a requested change from host-owned invariants about all installed features; investigate collisions rather than claim that intent is mechanically decidable. This becomes candidate A. [Catalogue R2](../catalogue/R2-moonshots.md#7-a-malleable-application-that-grows-at-the-point-of-use).
- **F — R9, `02-primitives`, “Remix-safe data.”** It already proposed model-written lenses, real-record replay and forks sharing records; its value score was only 2/5. **I — Reuse as a dependency, do not re-pitch it:** schema compatibility is one part of customization rebasing. Cambria, current Jazz migrations and panproto must be in the baseline. [Catalogue R9](../catalogue/R9-deep.md#a-remix-safe-data-model-written-mechanically-checked-lenses-so-forks-keep-sharing-records), [Cambria, 2020-10](https://www.inkandswitch.com/cambria/), [Jazz migrations](https://jazz.tools/docs/schemas/migrations), [panproto](https://github.com/panproto/panproto).
- **F — R5, `10-wild`, save games/fork labs; R9, `06-tooling`, Replaygate.** These are already catalogue entries. **I — Reuse their useful property:** a saved interaction/state is a reproducible specimen. Candidate C adds a bounded app-version/host-profile matrix; it does not claim a new snapshot format or generic traffic replay engine. [Catalogue R5](../catalogue/R5-teleport-06-10.md), [Catalogue R9](../catalogue/R9-deep.md).

## 4. Idea generation and prior-art elimination

**I — Sixteen ideas were screened.** The status is a research decision; linked facts identify the nearest competitor or killer. “Conditional” means the small integration gap survived this search, not that absence of a competitor has been proved.

1. **Prompt an installed app to grow any requested feature. KILL as a broad project.** **F:** Claude Artifacts, Townie, v0/Lovable/Bolt and tldraw document scripts already cover substantial versions of this. **I:** natural-language authorship alone cannot distinguish the project. [Artifacts](https://www.anthropic.com/news/build-artifacts), [Townie v5, 2026-01-22](https://blog.val.town/townie-v5), [tldraw offline](https://github.com/tldraw/tldraw-offline).
2. **A universal native/iframe generative-UI protocol. KILL.** **F:** A2UI, MCP Apps/MCP-UI, AG-UI and Google's hybrid examples occupy rendering and interaction transport. [A2UI/MCP Apps, 2026-06-17](https://developers.googleblog.com/a2ui-and-mcp-apps/), [AG-UI](https://docs.ag-ui.com/concepts/events).
3. **Generate typed state machines and test their paths instead of arbitrary React. KILL as a standalone framework.** **F:** Stately AI, XState, Foldkit and concept/synchronization work are direct precedents. The npm package `@reactive-agents/ui-core` also advertises run reducers, constrained UI trees and recorded fixture replay; registry metadata showed **0.17.0, published 2026-10-10**. **I:** app-domain contracts remain interesting; the basic mechanism is available. [Stately](https://stately.ai/docs/generate-flow), [Foldkit](https://github.com/foldkit/foldkit), [npm registry metadata](https://registry.npmjs.org/@reactive-agents/ui-core).
4. **Give each generated app persistent storage. KILL.** **F:** Cloudflare Facets and Claude personal/shared artifact storage directly provide it. [Facets, 2026-04-13](https://blog.cloudflare.com/durable-object-facets-dynamic-workers), [Artifacts](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them).
5. **A hosted sandbox for per-user generated extensions. KILL as a platform.** **F:** Dynamic Workers explicitly supports generated applications and user-uploaded code, including bindings and egress controls. **I:** an application-specific effect contract is the possible added value. [Dynamic Workers](https://developers.cloudflare.com/dynamic-workers/), [egress controls](https://developers.cloudflare.com/dynamic-workers/usage/egress-control/).
6. **A personal Smalltalk-like live world grown by an agent. KILL.** **F:** historical images and `pi-world` are close; the latter explicitly advertises an agent-grown, snapshotable QuickJS heap on pi-durable. The broad image pitch also died in earlier rounds. [pi-world](https://github.com/igouss/pi-world), [R6 catalogue](../catalogue/R6-flip.md).
7. **An AI formula generator for spreadsheets/databases. KILL.** **F:** Airtable already generates formulas; Excel LAMBDA and Notion supply reusable/interpreted computation. **I:** host ownership and weak intent oracles make a generic formula agent a poor outsider project. [Airtable](https://support.airtable.com/articles/8772429326-getting-started-with-the-airtable-formula-field), [Excel](https://support.microsoft.com/en-us/excel/functions/lambda-function).
8. **Notes that gradually grow forms, maps and calculations. KILL as the core invention.** **F:** Potluck and Embark implement that interaction model. [Potluck](https://www.inkandswitch.com/potluck/), [Embark](https://www.inkandswitch.com/embark/).
9. **Generate a domain-specific inspector plus executable examples. KILL as a new environment.** **F:** Glamorous Toolkit makes those primitives central and documents agent-facing object views. **I:** contributing an adapter there is more credible than recreating its environment in TypeScript. [GT rules](https://book.gtoolkit.com/rules-for-moldable-development-for-glamoro-3bpjoc3wh9imftaigkvwdrvxy).
10. **Let differently shaped app forks share live records through checked lenses. KILL as a new pitch.** **F:** R9 already selected this; Jazz now documents live read/write translations across schema versions, and Cambria/panproto are close. **I:** use existing engines and acknowledge lossy mappings and complements. [Jazz](https://jazz.tools/docs/schemas/migrations), [Cambria](https://www.inkandswitch.com/cambria/), [R9](../catalogue/R9-deep.md#a-remix-safe-data-model-written-mechanically-checked-lenses-so-forks-keep-sharing-records).
11. **Fork an app, change it, and merge the source back. KILL as a generic lifecycle feature.** **F:** Val Town already has three-way merges; v0 exposes PR/CI/merge handling; Patchwork researches universal version control. **I:** semantic preservation of a user's customization is a narrower problem. [Val Town](https://blog.val.town/newsletter-25), [v0 changelog](https://v0.app/changelog), [Patchwork, 2024–2026](https://www.inkandswitch.com/project/patchwork/).
12. **Maintain arbitrary website mods automatically across redesigns. KILL in this broad form.** **F:** Wildcard already mediates website customization through data adapters, and its paper explains stable row IDs and site-specific override requirements. **I:** arbitrary DOM recovery reintroduces a brittle, per-site oracle. Keep explicit extension-point rebasing as B. [Wildcard, Onward! 2020](https://www.geoffreylitt.com/wildcard/Wildcard-Onward-2020.pdf).
13. **Check independently generated features together and show a minimal collision. CONDITIONAL A.** **F:** SPLVerifier already detects feature interactions; Varv and synchronization systems expose features explicitly. **I:** retain only the small adapter/workbench for real app-owned state/effect contracts. No new verifier claim. [Apel et al., ASE 2011](https://www.se.cs.uni-saarland.de/publications/docs/ASE2011.pdf), [Varv](https://varv.projects.cavi.au.dk/examples/).
14. **Rebase installed personal features over an upstream app release, carrying preservation fixtures. CONDITIONAL B.** **F:** Git/Val Town handle source merging; Cambria/Jazz handle data schemas; Varv documents upgrade fragility. **I:** the combined feature-preservation review remains a plausible integration gap. [Varv gallery](https://varv.projects.cavi.au.dk/examples/), [Jazz](https://jazz.tools/docs/schemas/migrations), [Val Town](https://blog.val.town/newsletter-25).
15. **Check saved generated interfaces across app versions and host lifecycles. CONDITIONAL C.** **F:** A2UI already has conformance tests, MCP Apps has a reference host and UI tests, Skybridge has an emulator, and Reactive Agents has run-fixture replay. **I:** retain only application-owned saved-state compatibility and explicit host-profile failures. [A2UI suite](https://github.com/a2ui-project/a2ui/blob/2e3d9bc434a34ba25498a11e0bfba079b52dcf29/conformance/README.md), [MCP Apps testing](https://github.com/modelcontextprotocol/ext-apps/blob/07cda2513b0b691ac261ac69c856062c9afb2824/docs/testing-mcp-apps.md), [Skybridge experience report, 2026-02-04](https://developers.openai.com/blog/15-lessons-building-chatgpt-apps).
16. **Every extension is reversible, including its external actions. KILL the universal claim.** **F:** Coda distinguishes calculation formulas from action formulas and owns their execution boundary. **I:** restoring app state cannot unsend an email or undo a non-participating external service. Local transactions and explicit compensations are usable scoped techniques, not a general undo promise. [Coda formula/action distinction](https://docs.superhuman.com/packs/build/latest/guides/blocks/formulas/), [existing effect-boundary analysis in R2](../catalogue/R2-moonshots.md).

**F — Search coverage:** searched public GitHub issues/repositories; npm search/registry metadata; crates.io queries `generative ui` and `state machine`; arXiv; product docs/changelogs; and HN. Rust results included existing state-machine libraries such as `statig` and `statecraft`, rather than establishing an end-user extension gap. Broad repository search returned substantial irrelevant material, which was excluded. [crates.io state-machine search](https://crates.io/search?q=state%20machine), [arXiv concept paper](https://arxiv.org/abs/2508.14511).

**F/I — Signal quality:** the June 10, 2025 malleable-software HN thread had **294 points and 114 comments**. That supports the theme's shareability, not purchase intent. The author's discussion of a rough SDK and ongoing reliability work is a useful counterweight to an effortless-malleability demo. [HN discussion](https://news.ycombinator.com/item?id=44237881).

## 5. Finalist A — A feature-collision workbench

**I — One sentence:** before installing a generated personal feature, run it with the user's existing features and return a concrete interaction sequence that violates an application-owned state or effect rule.

**I — 30-second demo:** a small shared task app has “archive completed tasks” and “send one completion digest.” Add “reopen a task when feedback arrives.” Each extension passes its individual examples. Install them together: the workbench finds `Complete → Feedback → Complete`, highlights two notification intents for one task lifecycle, and offers the conflicting feature combinations. A separate rename example shows two installed handlers issuing the same move. The agent proposes a corrected feature; the unchanged host checker accepts or rejects it. These are proposed demonstrations, not observed results.

### Gap and closest work

**F — Strong prior art:** Apel et al. already built **SPLVerifier**, applying product-line model checking to an email system and finding interactions from feature-local specifications. FeatureIDE and related contract work further defeat a claim that feature-aware checking is new. [ASE 2011](https://www.se.cs.uni-saarland.de/publications/docs/ASE2011.pdf), [FeatureIDE](https://github.com/FeatureIDE/FeatureIDE), [product-line contracts, 2014](https://wwwiti.cs.uni-magdeburg.de/iti_db/publikationen/ps/auto/K14.pdf).

**F/I — Application integration boundary:** Varv composes feature definitions, Meng/Jackson expose synchronization rules, XState traverses machine paths, and Foldkit tests explicit update behaviour. A2UI's inspected composition cases check component parent/child validity. These are building blocks and serious substitutes. **I:** the bounded gap is an install-time workflow that attaches the host's actual state/effect contract to user-generated feature combinations and renders the counterexample in the user's app. This search did not establish a maintained package that supplies that whole workflow; the gap confidence is medium-low. [Varv](https://varv.projects.cavi.au.dk/examples/), [synchronizations](https://github.com/eagonmeng/sync-blank), [A2UI composition cases](https://github.com/a2ui-project/a2ui/blob/2e3d9bc434a34ba25498a11e0bfba079b52dcf29/conformance/core/composition_constraints.yaml).

**I — Flip-rule audit:** feature-aware verification itself is established work, not a technique shown to have died. The economic hypothesis is narrower: agents can reduce the repeated work of mapping each feature onto an existing app's events, states and effect catalog, while the app owner keeps the acceptance rules fixed. The kill test must demonstrate that saving. If specification and adapter work still scales one-for-one with extensions, the brief's manual-work condition fails and this candidate should die.

### Pain and beneficiary

**F — Concrete proxy pain:** an Obsidian plugin's **4.0.0 release, 2026-09-02**, says five plugins had bundled overlapping rename/delete handlers; two handlers could move attachments twice and corrupt links, depending on load order. The older [issue #59](https://github.com/dy-sh/obsidian-consistent-attachments-and-links/issues/59), opened 2023-05-11 and closed two days later, reports attachment removal from competing plugins and has two reactions. [Release explanation](https://github.com/dy-sh/obsidian-consistent-attachments-and-links/releases/tag/4.0.0).

**I — Named beneficiary:** maintainers of an extensible TypeScript task/document application, and users installing agent-authored features. The Obsidian cases demonstrate the failure class; they do not validate demand for a restricted generated-feature SDK. Existing unrestricted Obsidian plugins cannot be covered merely by asking them to declare their effects.

### Acceptance check and ways to game it

**I — v1 contract:** use an existing serializable state-machine representation, with a host-owned catalog of named guards/actions, finite test domains and typed command intents. The model may compose transitions and parameters; it cannot change the action interpreter, invariant set or effect dispatcher. The representation is authoritative. Supporting arbitrary executable JavaScript guards would make the model correspondence another unproved assumption.

**I — Check:** explore reachable combinations of the installed features under the declared data/event bounds. Observe state changes and actual intents emitted through the host broker. Check, for example, one rename per root user-event/attachment, no notification after cancellation, and preservation of fields owned by unrelated extensions. Return the event sequence, initial state, installed feature hashes and violated rule. The host also enforces applicable effect-count/permission rules during real execution.

**I — Limits/gaming:** an agent could invent fresh operation IDs, misdeclare its read/write set, split one action across multiple command names, exploit unmodelled callbacks, or choose data outside the explored bounds. Count against host-generated root-event IDs and canonical target/action identities; observe accesses at the interpreter/broker rather than trusting the manifest; expose the bounds prominently. Pairwise testing can miss three-feature interactions. A bounded pass is not a proof for arbitrary data, and none of these checks proves that the requested feature matches user intent.

### Why this survives, and who could absorb it

**I — Better models:** the issue survives correct individual implementations because independent authors can make incompatible policy choices. More and cheaper generated features enlarge the composition space. Models can help explain or repair a witness while the owner's contract remains authoritative.

**I — Ownership:** Cloudflare can host each extension but does not own every customer's notification, document or task-lifecycle policy. A portable adapter and regression corpus can cross app/framework boundaries. Stately, Foldkit, Varv or synchronization-system maintainers could adopt it; a successful upstream contribution would satisfy this open-source side-project goal. If one framework already provides the required broker and installation gate, contribute there and abandon a separate runtime.

### Scope and stop conditions

**E — 2–3 weeks:** days 1–4: one task/document app, fixed command catalog and five independently installable features; days 5–9: feature-combination exploration using existing graph tools, trusted state/effect adapters and shrinking; days 10–15: two public failure-class reproductions, an A2UI or React witness view, and install/undo manifests. Keep arbitrary JS plugins and global claims outside v1.

**I — Hypothetical expert reply that kills it:** “You have wrapped product-line verification in a demo; applications will not adopt your restricted extension API, and their real invariants still require the same manual work.”

**E — 1–2-day kill test:** reconstruct at least three real interaction failures from public extensible-app issues; implement only the host adapters and compare with ordinary per-feature tests plus the same XState/Foldkit baseline. Stop if no failure requires composition to expose, if most behaviour bypasses the broker, or if encoding each case requires a bespoke model larger than its regression test. Proceed only if a shared contract exposes multiple failures and produces a shorter actionable witness. This is the ONE pick's next action, not a validated product recommendation.

## 6. Finalist B — Rebase personal features across upstream releases

**I — One sentence:** carry a user's installed feature modules and preservation examples onto a new base-app version, refusing an upgrade that silently changes their established workflow.

**I — 30-second demo:** Alice has a customized issue app with “hide completed,” a personal triage view and a reminder. Bob has different fields and no reminder. The base app ships a richer status model. Both receive the upstream release; Alice retains her personal behaviour and Bob retains his. A deliberately lossy migration gets a visible “this task loses its reminder” witness. A conflicting shared-data policy becomes a choice, with neither fork silently overwriting the other.

### Gap, pain and beneficiary

**F — Existing components are substantial:** Val Town supplies source merges. Cambria translates changes through bidirectional lenses. Current Jazz migrations preserve interoperability across schema versions without rewriting stored rows. Patchwork explores branching/diffing as a general substrate. None should be described as missing. [Val Town](https://blog.val.town/newsletter-25), [Cambria](https://www.inkandswitch.com/cambria/), [Jazz](https://jazz.tools/docs/schemas/migrations), [Patchwork](https://www.inkandswitch.com/project/patchwork/).

**I — Narrow gap:** combine those mechanisms with the *installed feature set and user-owned preservation fixtures* at an explicit extension boundary. A schema translation can preserve values while an upgraded event handler stops invoking a personal reminder. A source merge can succeed while two branches disagree about what “completed” means. This is the app-state version of R2's occupied-software upgrade idea, with the R9 lens engine reused.

**F — Pain:** Varv's own gallery fixes framework versions to keep examples compatible and warns that changing packages may break them. Coda's custom-formula guide warns that renaming a formula breaks existing docs; its release guide supplies pinning and rollback procedures. Obsidian [issue #159](https://github.com/dy-sh/obsidian-consistent-attachments-and-links/issues/159), opened 2026-09-07, reports a settings migration recurring after restart and competing renaming; it has three reactions and was closed 2026-09-24. These are documented compatibility burdens and resolved incidents, not a claim that those bugs remain open. [Varv gallery](https://varv.projects.cavi.au.dk/examples/), [formula compatibility](https://docs.superhuman.com/packs/build/latest/guides/blocks/formulas/), [release lifecycle](https://docs.superhuman.com/packs/build/latest/development/versions/).

**I — Named beneficiary:** a template/app maintainer with a population of persistent personal customizations, and users who otherwise choose between a useful customization and an upstream fix. Evidence for a large population of such typed app forks is weak. That weakness is more serious than the migration algorithm.

### Check, survival and ownership

**I — Acceptable extension:** record stable base/extension/schema identities, dependencies, namespaced state and requested capabilities. Keep UI slot IDs separate from incidental DOM structure. Migrate explicit state with an existing lens/migration engine; replay selected user scenes through the old and proposed app; compare user-approved observations and command intents. Changes intentionally covered by the upstream release have explicit revised expectations. Preserve unrelated observations and private-state fields.

**I — Sharing and merge:** distribute a feature manifest and source independently from private user data. Merge extension modules by stable identity and dependency graph. Data continues through the existing sync engine and version adapters. Where two features assign incompatible meanings to the same field/action, show a witness and require a policy decision. Source merge and CRDT convergence cannot supply that decision.

**I — Gaming/limits:** the generator could weaken fixtures, move behaviour outside the observed surface, or hide data loss in a lens complement. Freeze fixtures/invariants outside its edit authority, hash the accepted artifacts and retain explicit complements. Reject lossy or ambiguous transformations when the owner has supplied no policy. Sampled replay establishes only sampled behaviour; general behavioural preservation across arbitrary upgrades is outside scope.

**I — Better models/owner risk:** better models make repair cheaper, but do not decide whose customization wins or supply missing historical intent. The fixtures belong to many app users, which is the outsider opportunity. App builders have strong incentives to add this themselves; the contribution should be a portable fixture/manifest adapter that Jazz, Patchwork or an app builder can adopt. Platform capture risk is high and reflected in the score.

### Scope and stop conditions

**E — 2–3 weeks:** one small app, three base versions, ten feature manifests, two kinds of schema change and one existing lens engine. Build the upgrade matrix and a side-by-side fixture result view. Run migrations on copied explicit state before replacing an accepted manifest pointer. Avoid arbitrary suspended computations and arbitrary website redesigns.

**I — Hypothetical killing reply:** “Our users want independent copies, not permanently maintained forks; Git plus our migration tests already covers the customers who do care.”

**E — 1–2-day kill test:** find ten genuine customization/base-upgrade pairs in public application history, not ten invented schema exercises. Attempt the matrix with ordinary Git, current schema tooling and fixed user fixtures. Stop if those tools already resolve at least eight cases with clear review, if useful cases need fresh user intent almost every time, or if the public examples of persistent personal customizations cannot be found. This is a conditional revival of earlier work, not a new API-migration pitch.

## 7. Finalist C — Saved-interface compatibility tests

**I — One sentence:** check that an app's saved interactive state still means the same thing after reload, resource update or a declared host-profile change.

**I — 30-second demo:** fill half a booking form and select an option in a generated widget. Save its input, resource version, UI state and expected pending action. Replay after an iframe teardown and resource upgrade: one candidate loses the draft, another emits a submit intent during hydration. The test produces a local executable fixture and identifies whether the app lacks migration logic or the host lacks the requested persistence capability.

### Gap, closest work and actual pain

**F — Very close prior art:** A2UI has language-neutral conformance cases, lifecycle and data-model checks. MCP Apps has a `basic-host`, unit tests and end-to-end examples. Skybridge's builders describe a local emulator after building two dozen ChatGPT apps over three months. `@reactive-agents/ui-core` already records and replays agent runs without a model. A generic recorded-UI test runner is therefore killed. [A2UI conformance](https://github.com/a2ui-project/a2ui/blob/2e3d9bc434a34ba25498a11e0bfba079b52dcf29/conformance/README.md), [MCP Apps testing guide](https://github.com/modelcontextprotocol/ext-apps/blob/07cda2513b0b691ac261ac69c856062c9afb2824/docs/testing-mcp-apps.md), [OpenAI-hosted Skybridge report, 2026-02-04](https://developers.openai.com/blog/15-lessons-building-chatgpt-apps), [Reactive Agents registry metadata](https://registry.npmjs.org/@reactive-agents/ui-core).

**F — Pain:** MCP Apps [#417, “View state persistence”](https://github.com/modelcontextprotocol/ext-apps/issues/417), opened 2026-01-31, remains open with **nine reactions**. It calls browser-storage assumptions brittle; a May 5 comment specifically requests view state roaming between devices. [#201, protocol discrepancies](https://github.com/modelcontextprotocol/ext-apps/issues/201), opened January 5, remains open with **13 reactions**, though its individual discrepancy list is old and cannot be treated as today's implementation matrix. [#433, missing tool input after refresh](https://github.com/modelcontextprotocol/ext-apps/issues/433) was closed completed in March, so use it only as a historical regression specimen.

**F — Useful semantic clarification:** in [A2UI #443](https://github.com/a2ui-project/a2ui/issues/443), a maintainer explained on 2026-01-27 that historical rendering should replay incremental messages; snapshot/compaction was not then a protocol concept. Current source has evolved considerably since that reply. **I:** the candidate must test the exact current SDK/host version instead of selling January's limitations as present facts.

**I — Narrow gap/beneficiary:** maintainers publishing a persistent MCP App across more than one host and app-resource release. Reuse the reference host and existing tests; add the user's domain observations and a persisted-state upgrade matrix. The likely output is a contribution to MCP Apps/Skybridge, with medium-low standalone novelty.

### Check, limits and model survival

**I — Contract:** a fixture records app identity, resource/build hash, protocol/catalog versions, tool inputs/results, private UI state, declared persistence scope, host capabilities and expected observations. Explicitly distinguish view-instance state, conversation state, device state and server-owned records. Test supported transitions: dispose/recreate, old state/new resource, unavailable storage and duplicated delivery. An unsupported scope produces an explicit failure/degradation result; it never silently becomes a promise of cross-host roaming.

**I — Independent check:** compare app-owned expected draft fields, selected stable record IDs and canonical command intents after each transition. Run with fixed tool responses and clocks, and with a broker that records rather than dispatches external actions. The model cannot edit the frozen fixtures. A valid state schema does not by itself count as preserved user progress.

**I — Gaming/limits:** an agent can satisfy snapshots while presenting the wrong selection, omit sensitive state from a fixture or special-case fixture IDs. Include independently captured scenes, varied IDs and actual view observations. Local host profiles approximate clients; they do not certify undocumented behaviour of live proprietary hosts. Avoid storing credentials or an entire conversation in a shareable fixture. This is an artifact-data minimization requirement, not a new identity/auth system.

**I — Better models/owner:** stronger models cannot make host lifecycle contracts agree or reconstruct a draft that was never saved. App-domain expectations are spread across publishers; protocol owners can absorb the common infrastructure. Success as an upstream conformance addition is worthwhile, but a platform may implement most of it quickly.

### Scope and stop conditions

**E — 2–3 weeks:** extend `basic-host`; reuse two existing app examples; add a fixture envelope with two resource versions and four lifecycle profiles; create a local failure report and a minimal compatibility adapter. No live-host coverage claim until maintainers supply reproductions from those hosts.

**I — Hypothetical killing reply:** “A2UI conformance plus the current MCP Apps tests and our existing fixture package already cover this; your remaining cases are host bugs we have fixed.”

**E — 1–2-day kill test:** take six public persistence/refresh/version failures, re-check closure/current behaviour, and implement only missing fixtures in the existing harness. Stop if fewer than two app-specific failures remain beyond current conformance, or if they require a real-host account and cannot be reduced locally. Prefer an upstream test PR over a new package if it fits naturally.

## 8. A concrete Cloudflare connection

**F — Available primitives:** Dynamic Workers accepts code/modules at runtime. `globalOutbound: null` blocks its ordinary outbound `fetch`/`connect` calls; explicitly supplied bindings still provide selected capabilities. Facets give generated apps persistent storage. [Egress documentation](https://developers.cloudflare.com/dynamic-workers/usage/egress-control/), [Facet documentation](https://developers.cloudflare.com/dynamic-workers/usage/durable-object-facets/).

**I — Useful arrangement:** a parent Durable Object owns the accepted base/extension manifests, user-state version and command-intent log. A temporary evaluator runs a proposed feature set against copied explicit state and recorded inputs. The host controls the effect catalog and validates returned commands. Promote an accepted manifest/state version at an event boundary; keep stale UI events tagged with the version that produced them. Reject or explicitly adapt stale commands.

**I — Important boundary:** a supplied storage binding is authority; giving an extension its own Facet does not qualify writes to shared application data. Use the host broker for shared mutations. A Durable Object transaction can update local state and an outbox atomically; it cannot atomically commit an unrelated email/payment service. Retry semantics still depend on that service's idempotency contract.

**I — Implementation choice:** for candidate A, the trusted interpreter can execute the finite declarative machine directly. Dynamic Workers is useful for evaluating additional generated modules behind a command-only interface; it is not required to justify the project. For B/C, explicit saved state and build hashes are sufficient. Adding heap snapshots, a new runtime, or a new agent language would revive killed infrastructure pitches without improving the acceptance oracle.

## 9. Ranked decision

**E — Scores, 1–5, in the brief's order:** Cool / TypeScript–Cloudflare–Vercel adjacency / Real gap / Value / Survives stronger models / Outside the excluded kernel project. These are judgments, not measurements. “Outside” is 5 for all three because the designs have no dependency on that project.

1. **A — Feature-collision workbench: 5 / 5 / 3 / 3 / 5 / 5 = 26/30.** The best concrete failure story and a strong model-independent boundary. The open question is adoption of a checkable extension surface. Gap confidence: medium-low; demand confidence: low-medium.
2. **B — Personal-feature rebase: 5 / 5 / 2 / 3 / 5 / 5 = 25/30.** The most attractive end-user demo and a direct revival of earlier occupied-software work. Close schema/version-control incumbents and uncertain demand for continuing shared forks reduce the gap score. Gap confidence: low; demand confidence: low.
3. **C — Saved-interface compatibility tests: 3 / 5 / 3 / 4 / 5 / 5 = 25/30.** Better direct protocol-publisher pain, modest demo appeal, and substantial current test infrastructure to build on. Likely most useful as an upstream contribution. Gap confidence: medium-low; demand confidence: medium.

**I — ONE pick:** run A's two-day kill test. Build only the reusable host adapter and collision witness. Require a real composition failure, an application-owned rule, and a material advantage over existing per-feature tests. If the evidence does not meet that bar, stop; do not turn it into another general app builder. The defensible object is an installable feature with explicit acceptance obligations, rather than generation alone.

### Five-line TL;DR

1. **F:** UI generation, artifact persistence, per-app databases and AI-authored state machines already have strong prior art.
2. **I:** The remaining opportunity is preserving and composing independently authored features under application-owned contracts.
3. **F:** Obsidian documents destructive plugin interactions; MCP Apps has open persistence/discrepancy discussions with measurable attention.
4. **I:** Keep collision checking, customization rebasing and saved-state compatibility as narrow, conditional integrations.
5. **I/E:** Pick the collision workbench; stop after two days if real failures need bespoke models or bypass the effect boundary.

### Rejected ideas, one line each

- **I — #1 Any-feature app builder:** killed by Artifacts, Townie, v0/Lovable/Bolt and tldraw scripts.
- **I — #2 Another genUI protocol/iframe bridge:** killed by A2UI, MCP Apps/MCP-UI, AG-UI and Google's hybrid work.
- **I — #3 AI-generated typed UI state-machine framework:** killed by Stately, XState, Foldkit, synchronizations and Reactive Agents.
- **I — #4 Persistence for generated apps:** killed by Claude storage and Cloudflare Facets.
- **I — #5 Generated-extension hosting platform:** killed by Dynamic Workers and its owner-supplied controls.
- **I — #6 Personal live image:** killed by Smalltalk history, pi-world and the earlier catalogue verdict.
- **I — #7 Formula-writing agent:** killed by Airtable AI and existing spreadsheet/database extension systems.
- **I — #8 Notes-to-apps substrate:** killed by Potluck and Embark.
- **I — #9 Generated moldable inspector environment:** killed by Glamorous Toolkit.
- **I — #10 Shared-data schema lenses as a new proposal:** killed as a repeat of R9; Cambria/Jazz/panproto are the baseline.
- **I — #11 App forks plus source merges:** killed by Val Town/v0 and Patchwork's ongoing work.
- **I — #12 Automatically maintain arbitrary website mods:** killed by site-specific semantic oracles and close Wildcard precedent.
- **I — #16 Universal extension undo:** killed by irreversible external effects; local state rollback is a narrower contract.
