# T06 — Web, browsers, UI, and generative interfaces

Research date: **2026-10-29**. **Q** = transcript quotation; **F** = externally sourced fact; **I** = inference/proposal; **E** = estimate. Quotations were checked against the raw transcript lines linked below. Caption timestamps identify minute buckets, not exact utterance offsets. Proposed architectures, rankings, feasibility, and novelty judgments are **I**, even where not repeated on every sentence.

**I — Recommendation: Interaction Foundry.** Grow a library of substantial editing behaviors that applications can request when their existing UI cannot perform a task. The interesting artifact is the expanding, composable interaction repertoire. A component registry, an app generator, and a generated canvas are already occupied ground.

## What the practitioners actually open up

- **Q — Phil Messeldyne, SAP, 14:00:** “anytime we need to ship a new primitive, we need to update the clients.” At 15:00 he describes reducing the shipped basis to “around nine primitives.” His implemented answer is cataloged compositions of those primitives. **I:** investigate growing genuinely new behavior above an explicit host boundary, rather than another catalog-selection service. [p3-67-vercel-evolving-generative-interfaces-at-sap-with-vercel.txt, lines 18–19](/Users/noah/code/sofort/arch/research/corpus/transcripts/p3-67-vercel-evolving-generative-interfaces-at-sap-with-vercel.txt:18), [video](https://www.youtube.com/watch?v=q87GXeyPRTg&t=840s).
- **Q — Adam Jacob, Syntax, 32:00:** “what is the platform of primitives that we need to build those personal applications?” He immediately asks what Adobe Creative Suite would look like on a flexible foundation. **I:** the opportunity can be a substrate and an accumulated body of working capabilities; it need not depend on recruiting people to endlessly customize their apps. [55-syntax-wtf-is-a-software-factory.txt, line 36](/Users/noah/code/sofort/arch/research/corpus/transcripts/55-syntax-wtf-is-a-software-factory.txt:36), [video](https://www.youtube.com/watch?v=aYz9G3__Z4g&t=1920s).
- **Q — Geoff Huntley, 49:00:** “evolve the program that's running live by just chatting.” This is accompanied by working Lisp and web demonstrations, not evidence of an empty category. [80-armin-ronacher-state-of-agentic-coding-11-with-geoff-armin-and-ben.txt, line 53](/Users/noah/code/sofort/arch/research/corpus/transcripts/80-armin-ronacher-state-of-agentic-coding-11-with-geoff-armin-and-ben.txt:53), [video](https://www.youtube.com/watch?v=HDdbU10r7Js&t=2940s).
- **Q — Ben, Modem, 1:33:00:** “I spent it like an hour” making a family display more appealing; “And I'm good.” **I:** growth should happen when a capability is missing, followed by ordinary use. Daily editing, constant regeneration, and engagement with an assistant are unnecessary assumptions. This Ben is distinct from Ben Davis. [80-armin-ronacher-state-of-agentic-coding-11-with-geoff-armin-and-ben.txt, line 97](/Users/noah/code/sofort/arch/research/corpus/transcripts/80-armin-ronacher-state-of-agentic-coding-11-with-geoff-armin-and-ben.txt:97), [video](https://www.youtube.com/watch?v=HDdbU10r7Js&t=5580s).
- **Q — Theo, discussing design with Ben Davis, 1:06:00:** “design like four to 10 versions of the thing and then I pick the best one.” He proposes learning from his selections. **I:** stronger design judgment belongs inside these projects as an improving input. None should require models to remain permanently tasteless. The owner's chosen behavior and direction still determine what gets kept. [14-nerd-snipe-we-can-t-trust-gemini-4.txt, line 70](/Users/noah/code/sofort/arch/research/corpus/transcripts/14-nerd-snipe-we-can-t-trust-gemini-4.txt:70), [video](https://www.youtube.com/watch?v=H0H_zhKnu3U&t=3960s).

## Prior-art boundary, checked in this round

**F — Search coverage:** live searches covered public GitHub repositories and documentation, product pages, arXiv/primary papers, HN, and indexed X posts. HN was also queried through its Algolia API with a 2026-01-01 through 2026-10-29 date filter. The table records discoveries that changed the proposals; absence of an exact implementation is bounded search evidence, not proof of vacancy. Repositories and products were read, not installed or benchmarked.

| Search family | Closest checked evidence | Consequence |
|---|---|---|
| `generative UI persistent self extending applications 2026`; `Manyshape authority contract surface` | **F:** [Manyshape](https://github.com/Them-labs/manyshape) separates capability contracts from personal AI-generated surfaces. Its [mail example](https://github.com/Them-labs/manyshape-examples/blob/main/README.md) persists surfaces and intent, restricts capability calls, and keeps the previous surface when activation checks fail. | Personal interfaces, durable intent, sandboxed surfaces, and promotion gates are taken. |
| `generative UI components state catalog 2026` | **F:** [A2UI](https://github.com/a2ui-project/a2ui/blob/main/docs/public/guides/client-setup.md) supports custom catalogs and shared state/binding machinery across web renderers; [Tambo](https://github.com/tambo-ai/tambo) has persistent interactable components. [Thesys/OpenUI](https://www.thesys.dev/) and [CopilotKit](https://www.copilotkit.ai/blog/the-developer-s-guide-to-generative-ui-in-2026) already cover substantial generative UI infrastructure. | A schema, renderer, streaming layer, or stateful component SDK is insufficient. |
| `design system AI generated components state machines`; `v0 registry` | **F:** [SAP](https://www.sap.com/uk/design/stories-resources/evolving-design-systems-for-ai-driven-ux) encodes composition logic and design knowledge; [v0 registries](https://vercel.com/blog/ai-powered-prototyping-with-design-systems) distribute model-readable components; [Zag](https://zagjs.com/overview/introduction) already models reusable interaction behavior with state machines. [Boardstate](https://github.com/100yenadmin/boardstate) includes agent-authored widgets, a guarded control plane, bindings, and history. | “AI grows a design system” is too broad. Candidate 1 must add reusable complex behavior and demonstrate composition beyond these systems. |
| `self-extending web app`; `malleable software 2026` | **F:** [Microsoft Apeiron](https://github.com/microsoft/apeiron) synthesizes and iteratively refines applications using computer-use evaluation and change-locality controls. [Powermove](https://github.com/iterative-computer/powermove) already grows panels, effects, and workflows through typed undoable operations. Its [HN launch](https://news.ycombinator.com/item?id=50066460) is dated 2026-10-13. | Drop the general self-editing app and the self-extending video editor. Neither is a surviving proposal below. |
| `AI debugger custom visualizer`; `Glamorous Toolkit AI views` | **F:** [Glamorous Toolkit](https://gtoolkit.com/) explicitly builds contextual tools with AI, associates them with relevant objects, and retains executable examples. | Drop the tempting “agent-grown program microscope.” A browser implementation alone would not reopen it. |
| `AI file viewer generate`; `LLM binary parser`; `round-trip AI ImHex` | **F:** [Persephone](https://github.com/andriy-viyatyk/persephone) grows HTML/JS boards for unsupported files; [TextView](https://github.com/gddickinson/textview) teaches itself formats; [FormatSense](https://formatsense.com/about) analyzes unfamiliar binary structures; [3DGen](https://arxiv.org/abs/2404.10362) synthesizes checked binary parsers. [ImHex](https://github.com/WerWolv/ImHex/releases) already has generated save-editor surfaces from annotated patterns. | Drop the growable viewer/parser pitch. Candidate 2 concerns format-preserving semantic editing and its reusable mutation implementations. |
| `generative UI task state cross-device`; `migratory user interfaces state Paterno` | **F:** [SUPPLE](https://www.eecs.harvard.edu/~kgajos/papers/2010/gajos10supple-aij-publisher_version.pdf) generates personalized interfaces. [Migratory UI research](https://iris.cnr.it/retrieve/514ca4e0-126d-4614-a168-eaf5e877d56c/prod_160152-doc_122396.pdf) already preserves interaction state across devices. [Jelly](https://doi.org/10.1145/3706598.3713285) evolves task data models and their interfaces. | Adaptation, task models, and state-preserving migration are established. Candidate 3 must grow new semantic transfer implementations, not rediscover migration. |
| `site:arxiv.org generative UI maintenance 2026` | **F:** [EvoGenUI-Bench](https://arxiv.org/abs/2608.29387), revised September 2026, evaluates multi-turn retention and external-state consistency. [GenUI-Harness](https://arxiv.org/abs/2610.11123), submitted October 2026, generates task interfaces and evaluates interaction. | Another generated-UI test suite or benchmark is taken. The deliverable here must be functioning software that accumulates capability. |
| `site:x.com genui 2026 A2UI`; `site:x.com generative UI state` | **F:** [Atai Barkai's April 24, 2026 post](https://x.com/ataiiam/status/2047710347445088338) describes a Google Cloud Next panel with A2UI and MCP Apps practitioners. **I:** useful evidence of an established ecosystem; indexed X coverage was otherwise sparse. | No novelty claim rests on a missing X result. |

**I — Scope discipline:** none of the following requires browser-engine replacement, browser divergence mapping, an executable web specification, a community, private enterprise data, or a kernel. The larger goal in each case is an accumulated working artifact, not an evidence commons. All proposed implementation paths use TypeScript and/or Rust.

## 1. Interaction Foundry — grow the behaviors a UI can perform

**I — One sentence:** an application encountering an unsupported editing task asks the foundry to synthesize a reusable interaction module, exercises it against independently owned behavioral requirements, and keeps it for subsequent applications without inference.

### The seed

**Q:** Messeldyne's “ship a new primitive” bottleneck, SAP 14:00, and Jacob's “platform of primitives,” Syntax 32:00, cited above. **I:** SAP demonstrates runtime composition; Jacob asks for a flexible creative-software foundation. The extrapolation is a foundation that can acquire new *operations and interaction protocols*, including the state behind them.

### What grows, and what the builder designs

**I — Concrete example:** start with an interval table. Request “trim this interval, ripple later intervals, keep linked tracks aligned, and leave locked tracks alone.” The missing capability triggers synthesis of a ripple-edit controller and its pointer/keyboard presentation. It becomes an ordinary tool. A second application uses the same controller for subtitle alignment. This is a new edit behavior, not a differently arranged form.

The builder supplies an interaction module boundary: typed document access, pure transition functions, staged edits, selection identities, cancellation, history, serialization, and a bounded effects interface. Existing DOM controls handle ordinary controls. Models grow modules such as linked-range manipulation, constrained graph rewiring, tree restructuring, and spatial snapping. Modules declare the document operations and guarantees they require, allowing incompatible combinations to be refused explicitly.

**I — Check:** the host owns document laws and task examples before generation. For ripple editing these include locked-object preservation, required offsets, linked-track alignment, cancellation identity, and undo of committed edits. A small independent reference operation computes expected document changes. Event sequences exercise pointer interruption, keyboard alternatives, reload, and combinations with existing tools. Static checking, browser execution, and owner inspection decide promotion. A generated module cannot rewrite the host's acceptance rules. Accessibility automation checks specified mechanics; it does not establish universal usability.

The retained artifact is a coherent library of useful manipulators, their adapters, and their exercised compositions. The builder's difficult contribution is deciding the common document/edit vocabulary and which apparent special cases deserve reusable operations.

### Tailwind and one-shot test

**I — Tailwind:** a stronger model can implement more involved manipulations, diagnose failing compositions, and propose simpler controllers. Old accepted modules keep working; new model releases increase the range of unsupported tasks that can be filled. If a model becomes excellent at design, it improves candidate interfaces inside the same boundary. The project has no dependence on preserving today's model mistakes.

**I — One-shot:** the loader, a ripple editor, or even a small component library could become prompt-sized. The target value is a substantial repertoire already exercised together in different applications, with stable editing/history semantics. A replacement must reproduce that behavior across the accumulated combinations, not just emit a plausible implementation of the brief. This is an empirical engineering claim, not an assertion that software cannot be copied. If a stronger model recreates the repertoire and passes those independent tasks in one unattended request, the project loses this argument.

### Value and six-week version

**I — Value:** “When your app lacks the right way to edit something, it learns that tool once and keeps it.”

**E — Six weeks:** TypeScript browser host; interval and tree document types; three grown behaviors; two deliberately different host applications; a persistent local module store; about 40–80 independently specified task sequences. Start with ripple trim, linked selection, and constrained reparenting. **Demo:** request a missing operation in application A, watch the failed candidate corrected and admitted, then open application B and use the retained behavior with the model disconnected. Show a deliberate violation rejected, alongside a real successful edit.

**E — Ambition/solo:** a 9–12 month solo program aiming at roughly two dozen substantial manipulators and several host domains is very ambitious but bounded. Use existing controls, browser rendering, and agent tooling. The hard work is behavioral composition and abstraction quality; no adoption network is required for a useful library.

### Prior art and precise remainder

**F:** Zag already separates state-machine behavior from framework presentation. v0 can generate and distribute components. SAP already carries design knowledge in a compositional catalog. Boardstate already admits agent-authored widgets. Powermove already grows a creative editor. See the primary links in the search table.

**I — Remainder:** automatic acquisition and retained reuse of complex, domain-level interaction behavior across different host applications, under shared edit/history semantics. “We generate a new widget and test it” would not distinguish this project. No reviewed source demonstrated the specific interval-to-subtitle reuse plus independently checked composition described here. This narrower gap remains **unvalidated**, and the existing libraries are the starting material.

### The kill

**I — Strongest objection:** useful interactions are so tied to each application's semantics that the common module boundary becomes either a weak wrapper or an elaborate programming language. Then ordinary coding agents already solve the problem better.

**E — Cheapest test, 3–5 days:** hand-build only the boundary and the reference ripple operation. Have a model implement one controller, then reuse it in the second host without changing the controller or loosening either host's rules. Compare with direct agent edits to each app. Stop if reuse demands app-specific branches throughout the module, if composition cannot be checked independently, or if the foundry only saves a trivial amount of integration work. Do not spend six weeks building a registry before this passes.

## 2. File Surgery — a browser editor that grows lossless editing capabilities

**I — One sentence:** opening a documented but unsupported file can grow a domain-specific editor whose permitted edits preserve unrelated content, produce independently readable files, and remain available offline for the next file of that type.

### The seed

**Q — Ron Minsky, Jane Street, 1:33:00:** “custom ad hoc one-time-only visualizers” for understanding technical issues. [08-jane-street-how-ai-is-changing-programming.txt, line 97](/Users/noah/code/sofort/arch/research/corpus/transcripts/08-jane-street-how-ai-is-changing-programming.txt:97), [video](https://www.youtube.com/watch?v=b9Ssp1B_Pf4&t=5580s). The [official episode page](https://signalsandthreads.com/the-changing-craft-of-programming/) establishes the speaker identities; the local captions misspell the guest's surname.

**Q — Adam Jacob, Syntax, 32:00:** “What would the Adobe Creative Suite look like” on a flexible foundation, in the transcript linked above. **I:** moving from an improvised visualization to a retained, format-preserving editor is my extrapolation. Neither speaker explicitly requests an automatic binary-file editor.

### What grows, and what the builder designs

**I — Concrete example:** drop a Broadcast WAV file containing cue points and an unfamiliar vendor chunk. Ask for a cue-point editor. The model grows the format adapter and timeline controls. Dragging a cue changes its location, updates the relevant structure, and leaves the audio and opaque vendor content intact. A fresh file then opens with the same editor, without generating again.

The builder supplies an immutable original-byte store, a parsed tree with source spans, explicit opaque regions, a patch planner, transaction history, and a small vocabulary of semantic edits. Modules grow three things together: a format interpretation, permitted mutation implementations, and domain controls. The host performs actual writes; generated UI submits typed edits. Variable-length operations must declare relocated regions and derived fields such as sizes or checksums.

**I — Check:** no-op export must reproduce the original bytes; unrelated payloads must survive edits; undo must recover the original artifact. Crucially, identity checks alone are insufficient: an independent reader must observe the requested changed value, and the original consumer or another independent implementation must still accept the file. Keep mutations disabled where this cannot be established. Use documented formats and public specimens; do not pretend a model can infer the meaning of arbitrary opaque bytes.

The artifact that accumulates is a family of usable editors and mutation implementations, including preserved unknown-extension behavior. A tree view, a format signature database, and a pile of generated parsers are not the intended endpoint.

### Tailwind and one-shot test

**I — Tailwind:** stronger models expand supported container variants, more complicated offset relationships, and richer editing affordances. The original-byte/patch discipline and independent consumers stay valuable even if parser generation becomes nearly effortless. Runtime use remains ordinary local software.

**I — One-shot:** a WAV cue editor is prompt-sized. A maintained set of editors across chunked, indexed, and nested formats, with real mutation behavior exercised against independent readers, is the larger target. The builder contributes the preservation model and chooses useful edit semantics; models populate it. The claim fails if supplying that architecture to a model yields the same breadth and preservation behavior without the sustained growth process. Counting formats alone would not rescue it.

### Value and six-week version

**I — Value:** “Edit the part of a file you understand while keeping the rest intact.”

**E — Six weeks:** a TypeScript browser application with Rust/Wasm support where useful; grow support for WAV cue/metadata edits, PNG ancillary-metadata edits, and MIDI tempo/event edits. Use existing independent readers rather than building reference parsers. Demonstrate offline reopening and original-file recovery. **Demo:** a WAV cue edit preserves a deliberately inserted opaque chunk and the audio payload, an independent reader reports the new cue, and an attempted unsupported structural change remains unavailable.

**E — Ambition/solo:** 9–12 months to a bounded collection of roughly 10–15 documented format families and meaningful editing operations, not a replacement for all media applications or codecs. Public files and local tools suffice. Model execution is needed to grow support, not to use an admitted editor.

### Prior art and precise remainder

**F:** Persephone explicitly supports made-to-order file viewers and editors. TextView's [unknown-file workflow](https://raw.githubusercontent.com/gddickinson/textview/main/docs/unknown-files.md) registers generated handlers. ImHex already derives save-editor UIs from pattern annotations. FormatSense analyzes file structures. 3DGen already combines AI, format specifications, symbolic test generation, and external oracles. These invalidate any novelty claim about generated parsers, file-type growth, or UI-from-grammar.

**I — Remainder:** a growing collection of *semantic mutation editors* with preservation of opaque content, independently checked changed outcomes, and retained domain-specific controls. That combination was not established by the reviewed material. This is a narrower product/artifact opening, with **medium-to-low novelty confidence**. Adding an “AI generate” button to ImHex or Persephone does not satisfy it; an extension of either may nevertheless be the economical implementation path.

### The kill

**I — Strongest objection:** this is simply Persephone plus good plugin-development instructions, while the supposedly general preservation boundary breaks down on real formats. Unknown bytes can contain offsets or checksums; copying their payload unchanged does not imply semantic preservation.

**E — Cheapest test, 2–4 days:** give an existing host and a strong agent the WAV task, including unknown chunks and edits that change metadata length. Compare with the proposed patch boundary. Reject the standalone project if the existing workflow already provides the claimed behavior with little special machinery. Also stop if every meaningful mutation requires hand-writing most of the adapter or if only fixed-width edits can be admitted. The useful result could be a contribution to an existing editor, but that smaller contribution would not pass this round's ambition filter.

## 3. Task Continuations — grow another interface for unfinished work

**I — One sentence:** represent an unfinished interaction independently of its current UI, then let models grow and retain alternative ways to complete that same interaction without losing drafts, selections, validation, or pending decisions.

### The seed

**Q — Phil Messeldyne, SAP, 11:00–12:00:** “we're on desktop, we're on tablets, we're on car play”; the experience differs from sitting at a large browser display. At 12:00 he describes planning around “the user needs to make two decisions.” [p3-67-vercel-evolving-generative-interfaces-at-sap-with-vercel.txt, lines 15–16](/Users/noah/code/sofort/arch/research/corpus/transcripts/p3-67-vercel-evolving-generative-interfaces-at-sap-with-vercel.txt:15), [video](https://www.youtube.com/watch?v=q87GXeyPRTg&t=660s).

**Q — Sophia Levins, SAP, 06:00:** “today, and tomorrow” a similar intent should yield “a similar type of interface.” [Same transcript, line 10](/Users/noah/code/sofort/arch/research/corpus/transcripts/p3-67-vercel-evolving-generative-interfaces-at-sap-with-vercel.txt:10), [video](https://www.youtube.com/watch?v=q87GXeyPRTg&t=360s). **I:** preserve the actual work in progress while offering another interaction form. Ben's completed-tailoring example argues for explicit requests, rather than interfaces that continually reshape themselves.

### What grows, and what the builder designs

**I — Concrete example:** a desktop user has selected graph nodes, started a batch reparent operation, and resolved some but not all validation conflicts. They request a narrow, keyboard-only interface. The system grows a stepwise editor for that pending operation. It retains the selected objects, resolved conflicts, remaining obligations, and cancellation/history behavior. Completion changes the same underlying document. Returning to the original UI shows the same result.

The builder owns a task representation containing stable object identities, draft values, partially completed operations, explicit obligations, preconditions, and commit/cancel semantics. Models grow interaction realizations and mappings between their intermediate states. Those mappings are retained per operation family; the next request for the same task/input setting uses them directly.

**I — Check:** the application defines valid terminal document changes and pending obligations. Generate interruption cases at every modeled phase; transfer to the new realization; complete or cancel; compare the resulting document and obligation history with the reference operation. Exercise stale data, changed selections, and repeated transfer. A different UI may take a different number of steps; it must not silently resolve an unanswered decision or commit twice. Manual inspection still determines whether the resulting interface is sensible.

This requires an instrumented application built around the task representation. Arbitrary websites and private SaaS integrations are outside the solo core. The growing artifact is a library of transferable task implementations, not a browser session snapshot or a new UI transport protocol.

### Tailwind and one-shot test

**I — Tailwind:** better models can realize more complicated operations through different input methods and produce better intermediate-state mappings. They can grow a useful narrow interface when an existing task is awkward, while the original task semantics remain fixed. The accumulated realizations become more capable without turning ordinary interaction into a model call.

**I — One-shot:** draft persistence and a responsive form are prompt-sized. The ambitious artifact is a repertoire of genuinely different interaction protocols that preserve partial progress across multi-step operations. The builder contributes the task/continuation semantics and the retained relationships between implementations. If this reduces to serializing form values and repopulating another form, it fails the ambition and one-shot tests immediately.

### Value and six-week version

**I — Value:** “Change how you work without starting the work again.”

**E — Six weeks:** one TypeScript graph/interval application, three multi-step operations, desktop direct manipulation and keyboard/narrow-screen realizations, persisted task continuations, and transfer cases covering each declared phase. **Demo:** suspend a partly resolved bulk edit, grow an alternative interface, finish resolving it there, and return with exactly the intended edit or cancellation. A plain synchronized form is not an acceptable demo.

**E — Ambition/solo:** a 9–12 month program covering several dozen operation/realization pairs in two instrumented applications. Native CarPlay and universal app migration are unnecessary. It can be valuable as a working substrate before anyone adopts it.

### Prior art and precise remainder

**F:** SUPPLE already adapts interfaces to users/devices. Migratory UI research already preserves interaction state when changing devices; it must receive full credit for the central concept. A2UI already provides cross-renderer state machinery. Jelly already makes task models malleable. SAP already plans situated interfaces. EvoGenUI-Bench already tests retention as artifacts evolve. Sources are in the search table.

**I — Remainder:** models synthesize and retain new realizations *and semantic transfer mappings for partially completed, non-form operations*, reducing the manual per-task transformations required by a fixed repertoire. This is a revival of an established research direction under different implementation economics. It is not a new claim to task migration. No reviewed implementation established that narrow growth loop; **novelty confidence is low**, and it ranks below the other two because the useful task representation may demand too much manual work.

### The kill

**I — Strongest objection:** capturing partial intent costs as much as building every alternative interface, and some direct-manipulation states have no useful counterpart. A transfer that is technically faithful can still confuse its user.

**E — Cheapest test, 3 days:** model one incomplete graph operation and ask an agent to grow the keyboard realization and state mapping without manual transfer code. Interrupt at five materially different phases. If the system needs a manually authored mapping for each phase, or if it must discard partial work to become understandable, stop. Also compare with a straightforward A2UI/shared-state implementation: serialization alone is not the proposed advance.

## Ranking and ONE pick

**I — Ranking for this builder; E — scope estimates above are provisional.**

| Rank | Candidate | Why it deserves consideration | Main reason it could fail |
|---|---|---|---|
| **1** | **Interaction Foundry** | Closest to the desired shape: missing capability → grown implementation → checked reusable behavior → richer applications. A useful artifact exists without a user network. | Cross-application behavior may not factor cleanly; existing component generation may already be sufficient. |
| **2** | **File Surgery** | Tangible artifact, concrete preservation checks, ordinary offline use, and strong model tailwind across format complexity. | Close existing hosts; “preserved bytes” may conceal broken semantics; the residual may be only a plugin workflow. |
| **3** | **Task Continuations** | Makes interface diversity compatible with completing real work; more capable models grow more realizations. | Very old conceptual prior art and expensive task modeling; low confidence that the residual is large enough. |

**I — ONE pick: Interaction Foundry.** Run the two-host behavior-reuse test before constructing a general platform. The direction to own is the interaction/edit vocabulary and the growing body of useful manipulators. If it cannot carry the same substantial behavior between two different applications, withdraw the recommendation rather than rename it a generative UI SDK.

### Three-line TL;DR

**I:** Grow the missing interaction, retain its behavior, and reuse it across applications.
**I:** Better models expand that repertoire; the builder owns the edit semantics, composition boundary, checks, and direction.
**I:** Begin with one difficult interval manipulation in two hosts; stop if it collapses into ordinary per-app code generation.
