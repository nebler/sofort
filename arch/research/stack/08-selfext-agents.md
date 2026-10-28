# 08 — Self-extending agents and developer tools

Research round 10 · 2026-10-28 · lens: self-extension patterns and acceptance checks

**Labels:** **F** = sourced fact; **M** = local measurement; **I** = inference or proposed design; **E** = estimate. Undated documentation and repository pages below were inspected on **2026-10-28**. Issue descriptions are reports by their authors, not independently reproduced defects. No model calls, deployments, or runtime benchmarks were performed.

**I — Verdict:** Self-extension is established practice, including agent-written extensions, tests, capability declarations, versioned registries, and retirement. The defensible remainder is narrower: make the *test environment's claims* answerable to the actual installed host, especially across reload, overlapping sessions, and removal. My ONE pick is a **small lifecycle conformance contribution to existing Pi testing tools**, conditional on a two-day kill test. There is no strong greenfield platform recommendation here. Agent JIT, trace compilation, skill compilation, a new agent language, and another agent host remain killed.

## 1. What changed at this layer in 2025–26

- **F:** Mario Zechner's [2025-11-30 Pi account](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/) advocated small command-line tools with on-demand documentation. Armin Ronacher's [2026-01-31 account](https://lucumr.pocoo.org/2026/1/31/pi/) describes having Pi build and maintain his extensions and skills, including a todo interface, review workflow, and command interception. He also discards skills he no longer needs. **I:** The change is who supplies the per-user integration labor; neither executable libraries nor extensible editors are new.
- **F:** Public GitHub API snapshots showed [Pi](https://api.github.com/repos/earendil-works/pi) at **118,513 stars** and [get-bb/bb](https://api.github.com/repos/get-bb/bb) at **4,682**, with repository creation dates of 2025-08-09 and 2026-02-24 respectively. **I:** These establish attention and ecosystem size, not extension reliability or willingness to adopt another tool.
- **F:** The February [SkillsBench paper](https://arxiv.org/abs/2602.12670) evaluated **7,308 trajectories** across seven configurations. It reports **+16.2 percentage points** average benefit from curated skills and **−1.3 points** from self-generated skills. The abstract says 86 tasks while parts of the paper analyze 84; the [current project site](https://www.skillsbench.ai/) separately identifies a July-recomputed, 87-task v1.1 registry. **I:** Do not pool these versions or generalize the February result to today's models. Pre-task self-generated advice is also a different intervention from an extension built using repeated environment feedback.
- **F:** By this inspection, [Claude Code offers plugin evals](https://code.claude.com/docs/en/plugin-evals) and [offline mod tests](https://code.claude.com/docs/en/plugins/mods/test); bb has a published testing SDK; Pi has multiple community test hosts. **I:** “Make agents test their own extensions” has already flipped. The remaining problem is whether those tests exercise the relevant behavior and whether the acceptance decision survives a changed environment.

**I — Rigor flip:** An extension's implementation and supporting fixtures can now be cheap to produce. The expensive part is deciding what its user actually requires, observing effects outside the extension, and maintaining a faithful check as the host changes. The check must remain owned by the consumer or host. A second model praising the extension is not an independent acceptance boundary.

## 2. Resolving “bb”

### Most plausible: get-bb/bb

**F:** The [project's own README](https://github.com/get-bb/bb/blob/9c1346d232adb2654c1bb3358eac924823db9ab1/README.md) describes an IDE that can build, control, and customize itself through desktop, web, CLI, and HTTP surfaces. Its TypeScript plugin system adds backend behavior, agent tools, providers, and UI. **I:** In a brief pairing “bb” with Pi and self-extending software, this is a substantially closer semantic match than a general-purpose scripting runtime. I assume **get-bb/bb**, with medium-high confidence; the builder's intended referent has not been confirmed.

**F:** bb's [agent-configuration guide](https://github.com/get-bb/bb/blob/9c1346d232adb2654c1bb3358eac924823db9ab1/packages/templates/src/templates/bb-guide-agent-configuration.md) resolves plugin, user, and project skill sources with explicit precedence, detects same-source collisions, and exposes revision-checked skill updates. Its [plugin-authoring instructions](https://github.com/get-bb/bb/blob/9c1346d232adb2654c1bb3358eac924823db9ab1/plugins/bb-guide/skills/bb-plugin-authoring/SKILL.md) require bounded output, typed boundaries, cleanup, and builds. These are existing self-extension facilities, not proposed additions.

**F:** The [portable-plugin CI workflow](https://github.com/get-bb/bb/blob/9c1346d232adb2654c1bb3358eac924823db9ab1/docs/forkable-plugins.md) copies selected built-ins outside the monorepo, installs public dependencies, and typechecks, tests, and builds them. A lint rule rejects private imports. **I:** This is a particularly good acceptance pattern: test the distributed artifact in its consumer setting. Merely passing inside the author's monorepo is a weaker claim.

### Plausible alternative: babashka, executable `bb`

**F:** [Babashka](https://github.com/babashka/babashka) is a native Clojure scripting interpreter. The [Babashka book](https://book.babashka.org/index.html) documents task/dependency configuration in `bb.edn`, REPL use, and versioned executable pods. [SCI](https://github.com/babashka/sci) lets an embedding application expose selected namespaces, classes, and symbols. **I:** This is a different extension pattern: grow a script/task vocabulary or a restricted embedded language, rather than modify an agent IDE.

**F:** [bmorphism/babashka-mcp-server](https://github.com/bmorphism/babashka-mcp-server) exposes code execution and command history, while [noblepayne/searxng-mcp](https://github.com/noblepayne/searxng-mcp) is an MCP server implemented in Babashka. **I:** Babashka can be the material an agent writes extensions *in*. It is not itself evidence of autonomous extension admission. SCI's configurable surface should not be confused with a blanket restriction on everything available in the normal `bb` process. Both interpretations are covered; no third “bb” product is assumed without primary evidence.

## 3. The systems, in depth

### Pi: a deliberately writable extension surface

**F:** Source inspection used Pi commit [`97553d10f2cb8be11a4d0fda331fe06967139643`](https://github.com/earendil-works/pi/tree/97553d10f2cb8be11a4d0fda331fe06967139643), dated 2026-10-28. The [extension manual](https://github.com/earendil-works/pi/blob/97553d10f2cb8be11a4d0fda331fe06967139643/packages/coding-agent/docs/extensions.md) explicitly encourages asking Pi to create extensions. TypeScript factories register tools, commands, event handlers, and UI. Global discovery uses `~/.pi/agent/extensions`; project discovery uses `.pi/extensions` after trust resolution. Reload emits shutdown/start lifecycle events, but the old command frame continues after `await ctx.reload()`. Background resources need cleanup. Extensions execute with Pi's process authority.

**F:** The [loader implementation](https://github.com/earendil-works/pi/blob/97553d10f2cb8be11a4d0fda331fe06967139643/packages/coding-agent/src/core/extensions/loader.ts) has different module paths for source, bundled Node, and compiled runtimes, using aliases or virtual modules for host packages. **I:** A normal import in an author's test does not establish that the installed extension will load in every Pi distribution. Loader shape belongs in the tested environment.

**F:** [Pi packages](https://github.com/earendil-works/pi/blob/97553d10f2cb8be11a4d0fda331fe06967139643/packages/coding-agent/docs/packages.md) bundle extensions, skills, prompts, and themes; sources include npm, Git, and local directories. Versioned npm specifications and configured Git tags/commits remain pinned. Project declarations are trust-gated; runtime dependencies and host-provided peer dependencies have different treatment. Resources can be filtered or disabled. **I:** Pinning gives reproducible selection, not a behavioral guarantee; transitive dependencies and host APIs still matter.

**F:** Pi's [session implementation](https://github.com/earendil-works/pi/blob/97553d10f2cb8be11a4d0fda331fe06967139643/packages/coding-agent/src/core/agent-session.ts) coordinates resource reload and extension rebinding. **I:** Treat persisted extension entries as an explicit state format. Reloading code does not by itself undo files, subprocesses, or external effects the previous code created. A failed candidate and a successful uninstall need separate contracts.

**F:** Ronacher's January practice report describes agent-built UI and skills, session branches for repairing tools, persisted extension state, and a write/reload/test loop. It also says Pi lacked built-in MCP then. Current Pi documentation includes MCP registration. **I:** The useful historical evidence is the practice of self-extension; its January feature inventory must not be presented as October's inventory.

**F:** The same monorepo now includes [Chord](https://github.com/earendil-works/pi/blob/97553d10f2cb8be11a4d0fda331fe06967139643/packages/chord/docs/spec.md), with schema-described contracts, principal-dependent objects, tracked resources, and prepare/commit reload semantics. Its specification explicitly puts build/typechecking outside Chord and documents reload failure behavior. **I:** A generic “typed hot-reload runtime for self-building software” would compete with the ecosystem's own work. CLI extensions and Chord objects are distinct interfaces; do not assume one inherits the other's guarantees.

### bb: transactional host lifecycle and portable tests already exist

**F:** At bb commit [`9c1346d232adb2654c1bb3358eac924823db9ab1`](https://github.com/get-bb/bb/tree/9c1346d232adb2654c1bb3358eac924823db9ab1), its [lifecycle reference](https://github.com/get-bb/bb/blob/9c1346d232adb2654c1bb3358eac924823db9ab1/plugins/bb-guide/skills/bb-plugin-authoring/references/backend-ui-lifecycle.md) describes preparing replacement registrations before replacing the old generation, LIFO disposal, service cancellation, bounded draining, and rejection of stale API objects. Its [testing reference](https://github.com/get-bb/bb/blob/9c1346d232adb2654c1bb3358eac924823db9ab1/plugins/bb-guide/skills/bb-plugin-authoring/references/testing.md) supplies fake backend, host-entry, and frontend hosts, including reload and disposal drivers. It explicitly reserves worker crashes, startup, and reconnect behavior for integration tests. **I:** This stated boundary is the right place to add evidence, rather than rebuild the host or its test kit.

### Claude Code: instructions, packaged distribution, deterministic hooks, and mods

**F:** [Skills](https://code.claude.com/docs/en/skills) can be local, personal, or plugin-provided instructions with optional executable resources. Discovery and invocation controls differ from permissions. In particular, `allowed-tools` pre-approves listed tools for the invoking turn; it does **not** remove every other tool. The current documentation also describes `disallowed-tools` and managed restrictions. **I:** A portable manifest must name its host semantics; a field called “allowed” is not a universal capability boundary.

**F:** [Classic hooks](https://code.claude.com/docs/en/hooks) react at host lifecycle and tool boundaries, with structured decisions and event-specific failure behavior. Matching handlers run in parallel; current documentation deliberately keeps a plugin's copy distinct from a settings copy. **I:** A test expecting universal sequential execution or deduplication would be wrong. Compare documented partial orders and consumer requirements, not an invented common hook model.

**F:** [Manifest validation](https://code.claude.com/docs/en/plugins/manifest-reference) checks loading structure and paths. [Mod tests](https://code.claude.com/docs/en/plugins/mods/test) can exercise hooks, commands, and UI with host answers stubbed, without a session or network. [Plugin evals](https://code.claude.com/docs/en/plugin-evals) compare with/without-plugin task runs, offer transcript/file checks and model graders, and can replay recorded mock answers. Eval runs themselves use real model calls; offline mod tests do not. **I:** Structure validation, deterministic runtime tests, task efficacy, and live installed-session transitions are four different claims. These shipped tools kill a generic plugin testing pitch.

### Codex: discoverable workflow bundles, not a new executable runtime

**F:** The [official skill documentation](https://learn.chatgpt.com/docs/build-skills) describes `SKILL.md` plus optional resources/scripts, progressive disclosure, explicit or implicit invocation, repository/user/admin/system discovery, automatic detection of skill changes, and disablement through configuration. Plugins distribute reusable bundles. **I:** A file that teaches the model when to run a script and a host that constrains that script are separate layers. Version scripts and fixtures in the containing repository/package; do not infer tested behavior merely from a valid skill folder.

**F:** The [open Agent Skills format](https://agentskills.io/specification) permits extra supporting files and optional compatibility metadata; its required fields are primarily discovery metadata. **I:** A skill can already carry `tests/` or a contract file. The missing guarantee is not a place to put tests: it is a host/consumer rule that runs an independently owned check and binds the result to the loaded artifact and environment.

### Agent-written MCP servers and the AutoGPT lineage

**F:** [selfMCP](https://github.com/yoheinakajima/selfMCP) supplies fixed bootstrap operations for a persistent SQLite skill store, search, creation/update, version history, soft deletion, and execution. Its [executor](https://github.com/yoheinakajima/selfMCP/blob/main/executor.py) launches Python in a fresh working directory while inheriting the server environment and privileges. **I:** This is direct prior art for an agent extending its own MCP surface. A subprocess and fresh directory are useful lifecycle mechanisms, but do not themselves establish attenuated authority.

**F:** [AutoGPT's historical plugin documentation](https://github.com/Significant-Gravitas/AutoGPT/wiki/Plugins), edited 2024-06-17, records the move from old plugins to components. The [plugin repository](https://github.com/Significant-Gravitas/Auto-GPT-Plugins) illustrates directory/ZIP discovery and explicit enablement. [BabyAGI/functionz](https://github.com/yoheinakajima/babyagi) stores functions, dependencies, versions, triggers, and logs; its draft self-building flow chooses existing functions or writes more. **I:** Separate these dated mechanisms from a claim that 2023 AutoGPT shipped today's tested self-extension lifecycle.

**F:** [LATM](https://arxiv.org/abs/2305.17126), submitted 2023-05-26, separates a tool maker from a tool user. Its [released notebook](https://github.com/ctlllll/LLM-ToolMaker/blob/main/toolmaker.ipynb) generates Python utilities, executes generated validation calls against supplied answers, then packages code and usage examples. **I:** Known answers provide a useful anchor, but validation code remains generated and executed in a shared namespace. This is not equivalent to a sealed consumer checker. The maker/user split and reuse economics are taken, not a new opportunity.

**F:** [ToolMaker, ACL 2025](https://github.com/KatherLab/ToolMaker), turns repository code into callable tools with iterative repair and benchmark tests. **I:** “The agent manufactures a missing wrapper, tests it, and saves it” is occupied even outside MCP.

### Voyager-style executable libraries

**F:** [Voyager](https://arxiv.org/abs/2305.16291), submitted 2023-05-25, uses generated JavaScript behaviors and environment feedback. The released [skill manager](https://github.com/MineDojo/Voyager/blob/main/voyager/agents/skill.py) persists code, descriptions, a JSON inventory, and a Chroma index; same-name replacements keep numbered code files while retrieval uses the current entry. The [critic](https://github.com/MineDojo/Voyager/blob/main/voyager/agents/critic.py) can use human feedback or an LLM's success judgment on observations. **I:** Environment feedback is valuable but does not make every acceptance decision mechanical. This is executable skill accumulation, not evidence of a general versioned contract, retirement, or least-authority system.

### Emacs: the archetype, including the hard part of undoing an extension

**F:** Emacs supports immediate evaluation, libraries on a load path, `require`/`provide`, hooks, advice, and [autoloaded entry points](https://www.gnu.org/software/emacs/manual/html_node/elisp/Autoload.html). Package installation manages discovery and compilation. [ERT](https://www.gnu.org/software/emacs/manual/html_node/ert/Introduction.html) tests currently loaded definitions. **I:** The modern agent loop fits this architecture naturally: inspect the running tool, write behavior, evaluate it, exercise it, and keep the useful result.

**F:** [Unloading](https://www.gnu.org/software/emacs/manual/html_node/elisp/Unloading.html) tracks definitions and dependencies, removes certain hook registrations, cancels tracked timers, and permits package-specific cleanup. It normally refuses removal of a required library. **I:** This is a much older answer to “extensions that decay safely.” It is still not a proof that arbitrary side effects have been reversed. An agent makes writing unload code cheaper; it does not make every effect invertible.

### Shell aliases and dotfiles grown by agents

**F:** [brianlovin/agent-config](https://github.com/brianlovin/agent-config) shares agent configuration using symlinks and includes Bats tests for installation, syncing, and validation. [Bats](https://github.com/bats-core/bats-core) already provides shell-level assertions. A [maintainer's harness README](https://github.com/Screddyice/claude-code-harness) documents removing a registered Codex hook after its backing memory systems had been decommissioned; it had continued firing and failing. **I:** This is concrete lifecycle pain, but also concrete prior art for tested, agent-maintained personal tooling.

**I:** An alias may work interactively and disappear in a noninteractive child shell; a shell function, sourced file, executable on `PATH`, and host-integrated tool have different discovery rules. Store a personal helper in versioned source and test the actual invocation shape. Generating another alias manager, dotfile sync tool, or shell-test generator has little gap.

## 4. Taxonomy of self-extension patterns

**I:** These patterns are composable. A skill can instruct the agent to invoke an MCP server that loads a generated function. Classify the *executable boundary*, not the branding.

| Pattern | Where it lives; loading and scope | Versioning and sharing | Test/admission gate; retirement |
|---|---|---|---|
| **Instruction bundle** — Codex/Claude/Pi skills | Files; metadata discovered before full instructions; repository, user, or plugin scope | Git/package revision plus whole-tree digest | Format validation, then consumer task checks; remove from future discovery, account separately for text already injected into a conversation |
| **Executable skill library** — Voyager/LATM/functionz | Function files or database rows; retrieve by task then execute | Function version, dependency graph, description/index revision | Expected outputs or environment predicates; quarantine failed revisions and update retrieval indices, preserving evidence |
| **In-process extension** — Pi, Emacs, bb server plugins | Factory/library loaded into the host; registrations and closures live in process | Host API floor plus package/tree revision; personal fork or published package | Loader and event behavior tests; explicit cleanup and stale-reference policy; arbitrary ambient effects need their own accounting |
| **Tool-server extension** — agent-written MCP | Separate process/service; discovery and invocation over a protocol | Server artifact, protocol/schema revision, launch configuration | Protocol conformance plus application contracts; disconnect, stop process and revoke scoped access; removing a config line does not prove downstream effects stopped |
| **Application-owned module** — bb UI, Claude mods, Chord | Host-specific backend/UI surfaces and state | SDK/contract version, artifact, migration plan | Type/schema checks and host tests, then installed-surface transition tests; dispose registrations and retain/migrate owned state explicitly |
| **Ambient environment patch** — aliases, dotfiles, wrappers | Startup files, symlinks, `PATH`, command interception | Dotfile Git tree and concrete executable/shell identities | Bats or equivalent on real shell shapes; ownership-aware edit reversal, fresh-shell check, retain user-modified files |
| **Live image/object evolution** — Emacs/Smalltalk lineage | Definitions and state already in the running world | Code revision plus state format and live-generation identity | State invariants, migration and rollback/abort behavior; unloaded code can still have external effects |
| **Capability-constrained executable** — SCI embedding, Extism, Corral | Restricted evaluator or isolated executable; host supplies grants | Artifact plus effective grant and host enforcement revision | Positive functionality and denied-operation tests; revoke authority before deleting code; manifests alone confer no enforcement |

**F:** The last row has direct implementations: [Extism manifests](https://extism.org/docs/concepts/manifest/) constrain host/file access and memory; [Corral](https://github.com/longzhi/corral) declares skill capabilities and brokers access. Their existence kills the broad “capability-scoped skill runtime” idea. **I:** This table is a pattern synthesis, not a claim that every named implementation enforces every recommended gate.

### Acceptance should be a conjunction, not a badge

**I:** Keep these six claims separate:

1. **Loads:** the selected artifact actually registers on this installed host, including the package manager and loader path.
2. **Works:** immutable consumer fixtures produce the required output/effects.
3. **Composes:** the installed extension set preserves consumer invariants, under the host's actual ordering/concurrency rules.
4. **Stays within authority:** operations are mediated by an enforcement boundary with an effective grant owned outside the extension.
5. **Survives transitions:** reload, resume, failed replacement, and concurrent sessions preserve the declared generation/state contract.
6. **Can be withdrawn:** no further owned callbacks/wakeups/calls occur after the withdrawal barrier; retained data and in-flight work have an explicit policy.

**I:** A replayable result should identify artifact tree, dependency closure, host/loader version, configuration and effective grant, fixture/checker digests, transition script, observed effects, and pass/fail/unsupported status. Do not put secret values into fingerprints. Any omitted dependency limits the claim. A signature authenticates an assertion; it does not make the assertion true.

**I:** The extension can propose tests. Acceptance fixtures and checker policy must come from a read-only consumer/host checkout, and the runner must observe results outside the candidate's writable area. Otherwise the easiest “fix” can be changing the check, disabling the old invariant, or fabricating a success log. Even an external checker covers only its stated cases.

## 5. What is already built, and what might still be missing

| Apparent missing thing | Primary-source finding | Remaining question |
|---|---|---|
| Extensions that carry tests | **F:** [Claude mod tests](https://code.claude.com/docs/en/plugins/mods/test), bb's SDK, ERT, and Pi test libraries already do this | **I:** Does a fast test host behave like the actual installed host on the cases the consumer relies on? |
| Registry with evidence | **F:** [Tessl](https://docs.tessl.io/support/faqs) offers skill evaluation and conformance review. [Agent Skills Pipeline](https://github.com/2702207741-dev/agent-skills-pipeline) advertises 42 replayable traces, 12 pinned reconstructions, lifecycle metadata, and release evidence | **I:** Is a particular acceptance result applicable to this host, load set, and current environment? This is a narrow integration question, not an empty registry category |
| Hash-bound trust/advisories | **F:** [AbstractSkill](https://github.com/lpalbou/AbstractSkill/blob/main/docs/trust.md) binds validations and advisories to skill tree hashes, distinguishes review methods, and invalidates trust on byte changes | **I:** Add evidence adapters there if useful; do not rebuild its trust registry |
| Capability-scoped skills | **F:** SCI, Extism, Corral, and [SkillSandbox](https://github.com/theMachineClay/skillsandbox) cover restricted execution patterns | **I:** Verify each host's enforcement and escape surface. A generic sandbox is taken |
| Decay and lifecycle states | **F:** [Cortex's skill lifecycle](https://github.com/CortexPrism/cortex/blob/main/docs/SKILLS.md) includes degradation, deprecation, archival, and freshness; archived skills leave retrieval | **I:** Decreasing a score is different from proving a withdrawn extension no longer acts |
| MCP contracts | **F:** [Pact's MCP plugin](https://github.com/pactflow/pact-mcp-plugin), [mcpward](https://github.com/TsvetanG2/mcpward), and [official conformance tests](https://github.com/modelcontextprotocol/conformance) cover contracts, drift, and protocol behavior | **I:** Reuse these. Schema compatibility does not cover arbitrary plugin side effects |
| Extension differential testing | **F:** [Rust Pi's architecture](https://github.com/Dicklesworthstone/pi_agent_rust/blob/cf478e7e8ad693f461e8aa79e5e320f3b7611fea/docs/planning/EXTENSIONS.md) describes a TS-versus-Rust differential oracle and a 223-extension corpus | **I:** This kills the broad differential-testing pitch. Only a small, reusable harness-fidelity/transition contribution remains worth testing |

**F:** Rust Pi's [current README](https://github.com/Dicklesworthstone/pi_agent_rust/blob/cf478e7e8ad693f461e8aa79e5e320f3b7611fea/README.md) carefully distinguishes historical conformance results from current certification and says its strict drop-in program was retired. **I:** Do not quote the architecture document's old pass rate as present coverage. This is also a useful example of evidence that explicitly stops making a current claim.

## 6. Pain evidence and its limits

| Evidence, with date/status at inspection | What it supports |
|---|---|
| **F:** [Pi harness fork](https://github.com/jimmyrisk/pi-test-harness), inspected 2026-10-28, documents four breakages after Pi v0.66: tool registration, registry replacement, authentication checks, and validation before mocked execution | **I:** Testing infrastructure drifts too. Its fixes are historical evidence, not proof the current fork is broken |
| **F:** [pi-lens #171](https://github.com/apmantza/pi-lens/issues/171), 2026-06-07, closed: helper tests omitted registration-level coverage for roughly nine hooks | **I:** Extension authors need wiring checks; closure means a general mock-host project is not an untouched gap |
| **F:** [Claude #97847](https://github.com/anthropics/claude-code/issues/97847), 2026-09-28, open, **0 reactions**, three comments. An October 8 commenter reports losses across about **30 transcripts**, sometimes recovering after **9–90 minutes** | **I:** Concurrent installed-session transitions matter. These are reporter observations, not a measured incident rate |
| **F:** [Claude #83643](https://github.com/anthropics/claude-code/issues/83643), 2026-08-03, open, **3 positive reactions**: desktop/SSH plugin synchronization reportedly omits hooks although skills load | **I:** Testing a source directory alone misses a distributed-install path |
| **F:** [Claude #36800](https://github.com/anthropics/claude-code/issues/36800), 2026-03-20, closed as not planned, **6 positive reactions**: duplicate plugin processes and tool loss, with PID-file workarounds | **I:** Resource/process lifecycle has reported user cost; the report does not establish a current-version reproduction |
| **F:** [Claude #76297](https://github.com/anthropics/claude-code/issues/76297), 2026-07-10, closed as not planned, **0 reactions**: a reporter's note-mirroring hook ran three times across settings/plugins | **I:** Consumer composition invariants are useful. Current hook documentation keeps these sources separate, so this is not automatically a host conformance violation |
| **F:** [Claude #11240](https://github.com/anthropics/claude-code/issues/11240), 2025-11-08, closed as duplicate: a plugin maintainer describes three manual cleanup commands before uninstall | **I:** Footprint cleanup is a real workflow, but this old request is not evidence that October lacks all cleanup features |

**F:** Reaction/status values above were checked through public GitHub issue API responses on 2026-10-28. The [current troubleshooting documentation](https://code.claude.com/docs/en/plugins/troubleshooting) now describes reload/reload-force recovery for missing plugin directories. **I:** An open old report and a newer documented recovery can coexist. The proposed project must test pinned current versions; it cannot market an old bug as still present without reproduction.

**F:** HN's [January Pi submission](https://news.ycombinator.com/item?id=46837424) had 13 points and no comments in the retrieved record. npm's [Pi extension harness page](https://www.npmjs.com/package/@danypops/pi-extension-harness) exposed an already-published testing package. Searches of the npm and [crates skill listings](https://crates.io/search?q=agent%20skill) returned numerous installers/parsers. **I:** These searches weaken novelty claims; broad keyword rankings are not ecosystem totals or proof of demand for any finalist.

## 7. Generate broadly, then kill: 18 ideas with prior-art checks

**I:** “Keep” below means a bounded experiment survives to the next section. It does not mean a new category or a proven beneficiary. The three retained experiments may ultimately be suites in one existing tool.

| # | Idea and rigor that becomes affordable | Search result / closest thing | Verdict |
|---|---|---|---|
| 1 | Agent writes a missing Pi tool and hot-reloads it | **F:** Pi's manual and Ronacher's practice report above | **I:** **Kill**; this is the product's intended workflow |
| 2 | IDE that edits its own UI and orchestration | **F:** [get-bb/bb](https://github.com/get-bb/bb), Chord, Claude mods | **I:** **Kill** the platform pitch |
| 3 | Compile successful trajectories into reusable skills | **F:** LATM/Voyager plus the summary's Muscle-Mem/PreAct/Agent JIT/SKILL-DISCO/TraceCompiler kill list | **I:** **Kill**; no renamed agent JIT |
| 4 | Bootstrap MCP server creates and versions further tools | **F:** [selfMCP](https://github.com/yoheinakajima/selfMCP), BabyAGI/functionz, ToolMaker | **I:** **Kill** |
| 5 | Every extension ships tests and a typed input/output contract | **F:** bb test SDK, Claude mod tests, ERT, [Pact MCP](https://github.com/pactflow/pact-mcp-plugin) | **I:** **Kill** broad novelty; require this in retained work |
| 6 | Public skill registry with evaluations and replay evidence | **F:** [Tessl registry](https://tessl.io/registry), Agent Skills Pipeline, AbstractSkill | **I:** **Kill**, including “just add attestations” |
| 7 | Skill-specific file/network/service grants | **F:** Corral, SkillSandbox, [Extism](https://extism.org/docs/concepts/manifest/) | **I:** **Kill** generic runtime; host enforcement is already the primitive |
| 8 | Smaller tool context through searchable on-demand extensions | **F:** selfMCP's fixed discovery tools; skill progressive disclosure; [mcporter](https://github.com/openclaw/mcporter) | **I:** **Kill**; distribution/context mechanics are occupied |
| 9 | Skill quality decays; poor or stale skills leave retrieval | **F:** Cortex's documented lifecycle, Tessl's efficacy comparisons | **I:** **Kill** score-driven pruning as a new project |
| 10 | Automatic self-written shell aliases, dotfiles, and regression tests | **F:** agent-config plus Bats; [agentic coding setup tests](https://github.com/Dicklesworthstone/agentic_coding_flywheel_setup) | **I:** **Kill** generic automation |
| 11 | Reproducible extension artifact detached from the author repo | **F:** bb's actual fork CI and Pi package distribution | **I:** **Kill** standalone; use their packaging discipline |
| 12 | “Universal MCP compliance and tool drift CI” | **F:** official conformance, mcpward, Pact MCP, [mcp-hook-conformance](https://github.com/studiomeyer-io/mcp-hook-conformance) | **I:** **Kill**; a different wrapper is insufficient |
| 13 | Agent learns contracts from its own happy-path calls | **F:** LATM verification; [R7 tool-contract research](../catalogue/R7-flip2.md#contracts-and-refinement-types-on-tool-apis-with-blame-idea-13) | **I:** **Kill** general synthesis; its own trace cannot supply missing requirements |
| 14 | Prove all extensions harmless by types/static analysis | **F:** Existing capability runtimes and host checks; ambient Node hooks can still do arbitrary effects | **I:** **Kill**: missing authority/semantic specification, not missing code |
| 15 | **Host/harness lifecycle differential checks** | **F:** Rust Pi already has differential extension conformance; Pi test-host drift supplies specific pain | **I:** **Keep A**, only as a contribution checking test-host fidelity, not a new oracle framework |
| 16 | **Consumer-owned checks on an installed extension set** | **F:** bb and Claude test kits, [AWS AI-DLC composition fixtures](https://awslabs.github.io/aidlc-workflows/harness-engineering/10-authoring-a-plugin/); duplicate-effect report above | **I:** **Keep B** narrowly for effect invariants across independently maintained plugins; no universal conflict solver |
| 17 | **Withdrawal rehearsal for persistent personal tooling** | **F:** Emacs unloading, bb disposal, [agent configuration install/sync tests](https://github.com/brianlovin/agent-config), stale registered-hook report | **I:** **Keep C** only for cross-host registrations/owned footprints; ordinary uninstall is taken |
| 18 | Leased extension hosting, snapshots, or a durable agent runtime | **F:** Summary kill list; Pi Durable, Cloudflare Computer, workflow engines | **I:** **Kill**; unrelated to the check shortage |

### Earlier catalogue ideas that become more concrete here

- **I:** [R5, teleport/10, failure specimen](../catalogue/R5-teleport-06-10.md#7-failure-specimen-attach-the-actual-failing-computation-to-an-issue) becomes a pinned extension transition script plus a small fixture directory. The earlier proposal's opaque live heap is usually unnecessary: ordinary restart and deterministic replay should be the baseline.
- **I:** [R7, flip2/04, contracts with blame](../catalogue/R7-flip2.md#contracts-and-refinement-types-on-tool-apis-with-blame-idea-13) narrows to attributing a failed observation to the extension, harness, host, or distribution path. Consumer assertions supply intent; the agent may generate adapters but cannot widen acceptance.
- **I:** [R3, moonshots2/04, Lease OS](../catalogue/R3-moonshots2.md#b-lease-os-garbage-collection-for-generated-computers) and [R6, flip/03, resource cleanup](../catalogue/R6-flip.md) suggest retirement roots and ownership. Apply them to hook registrations, timers, helper processes, and retained state; do not launch another hosting/GC platform.
- **I:** [R7, flip2/05, evidence gates](../catalogue/R7-flip2.md#evidence-gate-for-agent-run-ml-experiments-design-of-experiments-sequential-tests-and-the-reusable-holdout-owned-by-the-harness-idea-1) contributes checker ownership and separation from the proposer. Extension lifecycle assertions are often deterministic, so statistical model grading should not be the default.
- **I:** [R9, deep/06, Replaygate](../catalogue/R9-deep.md#1-replaygate--production-traffic-as-the-regression-oracle-for-agent-changes-on-workers) suggests external effect recording. Here the narrower observation is hook/registration behavior, rather than general HTTP traffic replay. This is a specialization, not a claim that replay itself is new.

## 8. Three narrowed finalists

### A. Host/harness lifecycle conformance — conditional lead

**I — One sentence:** Give extension-test-host maintainers a small public set of transition playbooks that must agree with a pinned, actual host, so a convenient mock cannot silently redefine the contract.

**I — 30-second demo:** A tiny extension counts invocations and rejects an invalid argument. The fast harness reports the candidate passes. Running the same playbook through the real installed Pi exposes either a different validation outcome or a missing result. Update the harness adapter and both agree. Then reload and remove the extension: exactly the declared generation remains active, with an external event ledger showing the transition. The demo is proposed; no such result was measured during this research.

**F/I — Closest art and the gap:** [DanyPops' harness](https://github.com/DanyPops/pi-extension-harness) already offers in-process tests, production-style jiti loading, and a subprocess test CLI. [marcfargas' harness](https://github.com/marcfargas/pi-test-harness) and its jimmyrisk fork already drive a real AgentSession with scripted model responses. Rust Pi's differential corpus makes the oracle pattern prior art too. The remaining contribution would be **testing the equivalence claims made by these harness substitutions**, with publishable lifecycle cases. A real subprocess running a stub is not automatically the unmodified host reference. Whether maintainers need a shared contribution is unverified.

**I — Beneficiary and pain:** Named beneficiaries are maintainers of those Pi test libraries and extension authors represented by pi-lens #171. The four historical harness incompatibilities are the strongest direct evidence. bb can be a later adopter; its documented integration-test boundary is explicit. Do not begin by supporting every host.

**I — Trustworthy check and gaming:** Keep the host's real loader, schemas, registration path, and execution dispatch intact. Replace the provider at a supported boundary with a scripted responder; use inert test tools. Compare external observations, not candidate-authored “pass” messages. Cover startup, invalid input, active-tool changes, two sessions, failed replacement, and withdrawal. Compare partial orders with barriers, not timings. Freeze assertions separately from adapters. A candidate can still detect fixtures, a harness can over-normalize differences, and both paths can share a bug; document those limits.

**I — Better models / ownership:** Better generation increases both extensions and adapter churn; the comparison runs without a model. Owners may ship this themselves, and that is an acceptable open-source outcome. An outsider's useful asset is a shared public failure corpus contributed upstream, not a monopoly over Pi semantics.

**E — Two–three weeks:** Days 1–2: kill test. Week 1: one host release pair, one existing harness, roughly eight deterministic playbooks and an external recorder. Week 2: loader/distribution case, overlapping sessions, machine-readable divergences and pinned CI artifacts. Week 3 only if needed: second harness adapter, documentation and an upstream-ready patch. TypeScript/Node implementation; a static report could later be hosted anywhere. Cloudflare hosting is optional and provides no moat.

**I — Killing expert reply:** “Our existing real-session suite or Rust Pi's fixtures already cover these exact cases; your runner duplicates tests while adding another adapter that can drift.”

**E — One–two-day kill test:** Reconstruct **two** historical host/harness divergences from pinned versions, without live inference. Require an externally observed difference while intended host behavior remains intact, then show the corrected harness agrees. Require one case beyond cold registration, and zero false failures on fixed pairs. Inspect existing upstream fixtures before writing an adapter. **Kill the separate project if the historical differences cannot be reproduced, the reference requires modifying the disputed host path, or existing tests already provide the same check.** A few upstream regression tests are still a good result; do not inflate them into a framework.

### B. Consumer effect checks for the installed extension set — conditional backup

**I — One sentence:** Before adding an agent-written extension, run the user's existing event/effect invariants against the whole installed set, and return the smallest demonstrated conflicting set.

**I — 30-second demo:** A notes hook works alone. Another plugin registers the same integration through a different source, and a single fixture edit yields three notes. The installation candidate is withheld because the consumer contract requires one. The report identifies the active sources and recorded effects. This can be a consumer conflict even where the host correctly runs all registered hooks.

**F/I — Gap and baseline:** Claude's test/eval tools, bb's testing SDK, and AWS AI-DLC already test plugin composition within their own systems. [Pi handler composition](https://github.com/earendil-works/pi/blob/97553d10f2cb8be11a4d0fda331fe06967139643/packages/coding-agent/src/core/extensions/runner.ts) is another host-specific surface. No universal algebra for arbitrary plugin side effects follows. The narrow remaining work is an **installed-set adapter to consumer-owned effect assertions**, not another test runner, plugin manager, or generated conflict explanation. Search found components, not enough evidence to establish a missing general product.

**I — Beneficiary and pain:** Authors combining personal hooks from several sources, represented by #76297 and #97847. Demand is narrow and reaction counts are modest. The crucial user input is the invariant—such as one note per edit—not a model's guess that two hooks look redundant.

**I — Check and gaming:** Run isolated fixtures with an external append-only sink or observable local state; assert counts, allowed operations, and preserved decisions. Exercise both load orders where the host permits them and concurrent scheduling where it is part of the contract. A failing set can be minimized using ordinary delta debugging. Keep the consumer's existing assertions immutable. An extension can fake its own log, silently disable a sibling, or pass a tiny fixture set; observe the sink and include known-good sibling behavior.

**I — Better models / owner:** Better code cannot infer another plugin user's intent. Private load sets and consumer checks sit across platform boundaries, but owners can add an installed-set mode quickly. Adoption into the existing kits is more plausible than maintaining an independent platform.

**E — Two–three weeks:** Reuse one host's existing runner; support two effect sinks, a manifest of selected packages/configuration, failing-set reduction, and a readable diff. No automated repair or policy rewriting. A fixture connector implemented as a local TS server makes this TypeScript-adjacent without deploying anything.

**I — Killing expert reply:** “This is an integration test and a short reducer; my existing suite already loads several plugins, and only I know the assertion.”

**E — One–two-day kill test:** Use three public plugin/configuration pairs; require two distinct externally observable composition failures that single-plugin checks miss, with no semantic guesswork. Compare effort with writing two ordinary integration tests. Kill the standalone idea if the new adapter saves no meaningful repeated work. If useful, fold its cases into A instead of maintaining a second project.

### C. Withdrawal rehearsal for generated personal tooling — weakest conditional backup

**I — One sentence:** Rehearse removing an extension in a disposable environment and report owned registrations or dependencies that would remain, while preserving modified user data and active retained generations.

**I — 30-second demo:** The agent removes a no-longer-used helper, but its global hook still calls a deleted interpreter environment. A rehearsal finds the dangling registration; an ownership-aware plan removes only that entry. A second run observes no new callback and shows the user's unrelated configuration unchanged. Evidence remains archived.

**F/I — Gap and baseline:** Emacs already has dependency-aware unloading, bb has disposal and stale-generation checks, and [agent-config](https://github.com/brianlovin/agent-config) tests its installation and synchronization scripts. Cortex already removes archived skills from matching. The narrower question is **cross-host persistent footprints grown by agents**, particularly configuration entries pointing to decommissioned helpers. A fresh process plus a normal uninstall script is the strongest baseline. This is not a claim to reverse arbitrary effects or a new lease system.

**I — Beneficiary and pain:** Users maintaining shared personal Claude/Codex/Pi tooling. The decommissioned memory-hook example is direct pain; the old #11240 cleanup request supports the workflow but cannot establish today's missing functionality. Cross-host prevalence remains unmeasured.

**I — Check and gaming:** Require an owner-attributed registration/footprint inventory captured by the installer or runner, not just supplied by the extension. Rehearse disable → drain/revoke → remove registrations → invoke the old trigger again → cold start. Verify no owned new activity after the declared barrier and unchanged unrelated state. Quarantine only with declared authority; preserve user-modified files and required data. Report unknown resources as **unverified**, never clean. A timeout cannot prove an arbitrary callback will never run; enumerate mediated schedules/resources or narrow the claim.

**I — Safe decay:** Expire *eligibility for reuse* when the host, checker, environment dependency, or grant changes. Keep the bytes/evidence available for review and run renewal probes in a disposable environment. Do not delete a rarely used skill because a model judges it stale, and do not remove a guard from an active session unless the host enforces the replacement/withdrawal policy.

**I — Better models / owner:** Better models can create more persistent registrations; external ownership still matters. A single host should own its disposal machinery. Only footprints spanning several tools justify an outsider, and even there a contribution to an existing config manager may win.

**E — Two–three weeks:** One recorded JSON-config edit format plus owned symlinks/executables, two host configuration adapters, read-only dependency audit, fixture-based withdrawal rehearsal, and a reviewable plan. No remote-resource collector or automatic deletion daemon.

**I — Killing expert reply:** “My dotfile manager, uninstall breadcrumb, and fresh-shell tests already cover it; arbitrary ambient side effects make your completeness claim impossible.”

**E — One–two-day kill test:** Replay three real removal histories in temporary home directories, including a modified shared file and a still-retained dependent. Require discovery of two actual dangling registrations, preservation of all user edits/retained roots, and a result stronger than path-existence checks alone. Kill if inventories cannot be captured independently or normal uninstall plus restart covers the cases. This finalist has the weakest verified gap.

## 9. Ranked top three

**I:** Scores are judgments, not measurements. “Gap” is deliberately low because the core mechanisms and several implementations already exist. “Not GrowOS” is 5 throughout: all three operate on existing developer tools and ordinary host APIs. B and C may become test suites inside A rather than separate projects.

| Rank | Finalist | Cool | TS / Cloudflare / Vercel adjacency | Real gap | Value | Survives 10–100× models | Not GrowOS | Total |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | A — host/harness lifecycle conformance contribution | 3 | 5 | 2 | 4 | 5 | 5 | **24/30** |
| 2 | B — installed-set consumer effect checks | 4 | 5 | 2 | 3 | 5 | 5 | **24/30** |
| 3 | C — withdrawal rehearsal for personal tooling | 3 | 4 | 2 | 3 | 5 | 5 | **22/30** |

**I:** A wins the tie because the Pi harness fork documents a concrete mismatch family and the check has a public reference. B has a flashier duplicate-effect demo, but consumer requirements and repeated demand are less established. None earns an unconditional build recommendation.

## ONE pick

**I — Pick A: contribute a small, pinned lifecycle conformance corpus to an existing Pi test harness.** Begin with host-versus-harness validation and active-tool/registration behavior, then reload/removal. Do the two-day reconstruction test before making a package. The mechanism is prior art; the contribution succeeds only if it catches a real uncovered divergence with less maintenance than today's ad-hoc fixtures. If existing upstream suites cover it, upstream the missing regression cases or stop. Do not start a registry, runtime, compiler, or agent platform.

## Five-line TL;DR

1. **F/I:** Pi and get-bb/bb already embrace self-extension; get-bb/bb is the likeliest “bb,” with Babashka a distinct plausible alternative.
2. **F:** Tests, evaluated registries, capability-scoped execution, and skill retirement all have direct prior art.
3. **I:** The useful boundary is independently checked behavior of the actual artifact, host, installed set, and lifecycle transition.
4. **F/I:** Historical harness drift and installed-session failures justify a narrow experiment, not a claim that current hosts remain broken.
5. **I:** Pick a small Pi lifecycle conformance contribution; kill the separate project if two days cannot expose an uncovered real divergence.

## Rejected ideas — one line each, with the killer

- **I:** Agent-written Pi extensions — killed by Pi's intended workflow and Ronacher's documented practice.
- **I:** Self-building IDE — killed by get-bb/bb, Claude mods, and the existing malleable-tool lineage.
- **I:** Agent JIT / skill compilation — killed by the explicit series kill list, LATM, Voyager, and later trace-compilation work.
- **I:** Self-growing MCP toolkit — killed by selfMCP, BabyAGI/functionz, and ToolMaker.
- **I:** Tests inside skill folders — killed by existing skill formats, ERT, bb, and Claude testing tools.
- **I:** Evaluated/evidence-carrying skill registry — killed by Tessl, AbstractSkill, and Agent Skills Pipeline.
- **I:** Generic MCP contract or protocol tester — killed by Pact MCP, mcpward, official conformance, and mcp-hook-conformance.
- **I:** Another capability sandbox — killed by SCI embeddings, Extism, Corral, and SkillSandbox.
- **I:** Generic differential extension oracle — killed by Rust Pi's corpus; only a concrete upstream harness-fidelity contribution remains conditional.
- **I:** Automatic stale-skill scoring/pruning — killed by Cortex's lifecycle and existing efficacy evaluation.
- **I:** Alias/dotfile generator with shell tests — killed by Bats and public agent configuration repositories.
- **I:** Detached, portable plugin packaging — killed by bb's fork CI and existing package managers.
- **I:** On-demand tool discovery to save context — killed by progressive disclosure, selfMCP, and mcporter.
- **I:** Learning a sufficient contract from the agent's own trace — killed by missing consumer requirements and earlier tool-contract prior art.
- **I:** A universal conflict solver or guarantee for arbitrary plugins — killed by ambient effects and absent semantic specifications.
- **I:** Another typed hot-reload application runtime — killed by Chord, bb, and platform-owned extension machinery.
- **I:** Durable or snapshotted extension hosting — killed by the summary's existing agent/runtime/hosting products.
