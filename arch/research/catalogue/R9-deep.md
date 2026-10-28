[← Catalogue index](README.md) · [Research summary](../RESEARCH-SUMMARY.md)

**109 entries.** Reports in this round:

- [01-pain: Pain first: thirty developer failures, and three bounded community projects](#01-pain-pain-first-thirty-developer-failures-and-three-bounded-community-projects)
- [02-primitives: Primitives — what only became possible in 2025–2026, and which combinations nobody has assembled](#02-primitives-primitives--what-only-became-possible-in-20252026-and-which-combinations-nobody-has-assembled)
- [03-language: Language lens — a language, TS dialect, or compiler for code that models write and run](#03-language-language-lens--a-language-ts-dialect-or-compiler-for-code-that-models-write-and-run)
- [04-wasm: What important software could actually run in a Worker or a tab?](#04-wasm-what-important-software-could-actually-run-in-a-worker-or-a-tab)
- [05-agentweb: The agent web — missing joints, mostly occupied categories](#05-agentweb-the-agent-web--missing-joints-mostly-occupied-categories)
- [06-tooling: The TS/JS toolchain when agents write most of the code](#06-tooling-the-tsjs-toolchain-when-agents-write-most-of-the-code)

---

## Round 9 — the deep TypeScript/Cloudflare round — `deep/`
The round asked for one small, buildable open-source thing in the TypeScript/Cloudflare/Vercel world that passes all six of the builder's criteria: cool, CF/Vercel adjacent, fills a real gap verified by prior-art search, has value with pain evidence, survives 10–100× better models, and is not GrowOS. Each of six lenses (pain, primitives, language, Wasm, agent web, tooling) generated 10+ ideas and scored its top three 1–5 per criterion. Overall verdict: **no unconditional winner**. Both vendors have shipped the whole single-primitive agent stack, and most categories are owned by whoever owns the check. Each lens ended with a narrow, conditional contribution guarded by a cheap kill test:
- workspace-aware repro reducer (27/30)
- worktree-free Git merge kernel for Workers and browsers (26/30)
- upstream Tenuo edge adapter for task warrants (25/30)
- Replaygate production-traffic replay on Workers (25/30)
- replay diff for edited durable workflows (23/30)
- model-written, law-checked "remix-safe" lenses (23/30)

Every one of these is an extension or port of existing prior art, not a new category.

### 01-pain: Pain first: thirty developer failures, and three bounded community projects
Lens: start from measured developer pain — GitHub reactions across 13 TS/Cloudflare/Vercel repos (320 open-issue records), Cloudflare Discord via Answer Overflow, 2026 HN stories and State of JS 2025. Headline: developers lose time at boundaries (local vs deployed, package graph vs runtime imports, fresh vs cached installs, client vs durable state, TS compiler vs embedding tools); owners fix individual failures, so the community contribution is making failures cheap to reproduce and diagnose. The ONE pick is **A — a workspace-aware repro reducer** (preferably an extension to Repro Surgeon), conditional on a six-case kill test. Verdict: **go-with-changes for a small community contribution; no unconditional new-platform recommendation.**

#### Ranked top thirty pains
Triage ranking of pain clusters (judgment, I), not a reaction leaderboard. Counts are total reactions [M] per linked issue, 2026-10-28 snapshot; separate issues are never summed. Owner status in brackets.
1. A successful local test can miss a deployed-runtime failure — workerd #6903 (startTls SNI) 10; workerd #2328 (timezone) 7; workers-sdk #9489 (global-scope I/O) 4 [?]
2. Same manifest/lockfile does not reliably yield the same installed graph — npm #4263 (cached install drops integrity/resolved) 97; pnpm #17448 (symlinked node_modules) 0 [npm ?; pnpm YES]
3. Package passes type-check/bundling yet fails under the chosen module/runtime rules — Next #46078 (`nodenext` + ESM subpath) 109; workers-sdk #7672 (Stripe dynamic `require("util")`) 6 [?]
4. Tool releases break one another before tests/lint start — Bun #4145 (Vitest) 278; Next #89764 (ESLint 10) 109; workers-sdk #15618 (Vitest 5) 36 [YES/PARTIAL]
5. TS 7 migrations strand tools that embed or patch the old compiler — TS #63771 47; TS #64709 (API status) 23; TS #62508 (migration guide) 67 [YES/PARTIAL; 7.1 Beta ships APIs]
6. Native Node addons remain engine-specific — Bun #4290 276; Deno #16164 (install scripts/global npm) 42 [Bun YES/constraint; Deno YES/PARTIAL]
7. Retry, failover and partial-stream handling need app-specific glue — AI SDK #2636 66; AI SDK #4842 (retry callbacks) 15 [PARTIAL]
8. A durable job silently loses its connection to its agent after a reset — Agents #1918 2 [?]
9. Reconnect and Stop disagree about whether a turn exists — Agents #2741 3; AI SDK #7180 (model/UI history conversion) 24 [PARTIAL]
10. RSC navigation produces too many CDN variants for self-hosters — Next #65335 154 [YES/design direction]
11. Variable serverless/agent work makes spending hard to bound — HN 2026-10-08 65 points/32 comments; HN Vercel pricing 191 points/65 comments (not GitHub reactions) [?]
12. Runtime secrets/config work in one environment and vanish in another — workers-sdk #9369 12; #15343 (atomic vars + secrets) 3 [?]
13. Working in a workspace differs from consuming the packed artifact — npm #3466 67; Computer #106 0 [npm ?; Computer YES/investigation]
14. Dependency overrides do not reliably apply across workspaces — npm #4834 92; npm #4942 (`npm ci` + overrides) 49 [PARTIAL/?]
15. Mock time is not one clock across test runner, Worker and storage — Vitest #5750 10; workers-sdk #5394 4 [PARTIAL/constraint]
16. App Router CSS order differs by navigation/build path — Next #64921 80 [YES/PARTIAL]
17. App Router transitions break shared-layout animation — Next #49279 330 [?]
18. Breakpoints/source maps don't match execution across runtimes — Bun #2445 184; Next #62008 48; Vitest #5380 8 [PARTIAL]
19. A small rendered path still ships unrelated client code — Next #69865 49 [?]
20. Unused modules still hurt Worker cold-start/TTFB — workerd #2372 22 [YES]
21. Outgoing WebSockets keep idle Durable Objects active — workerd #4864 23 [YES, needs deep architectural change]
22. Agent filesystem writes reach a container but not its watchers (stale HMR) — Computer #196 0 [?]
23. D1 query results drop duplicate column names — workers-sdk #3160 24 [?]
24. Object types do not enforce exact boundary shapes — TS #12936 1,638 [?]
25. Suppression is too coarse for controlled migrations — TS #19573 2,274; TS #19139 (specific error codes) 793 [PARTIAL/?]
26. Generic APIs need awkward currying or redundant type arguments — TS #26242 1,254 [?]
27. JSON imports lose literal information — TS #32063 1,837 [?]
28. Compiler-dependent transforms have no in-box TS 7 path — TS #16607 1,548; TS #14419 1,455 [NO; occupied by ttsc]
29. Package trust/provenance policy varies across managers — Bun #15601 117; npm #9242 68 [PARTIAL/?]
30. Monorepo hoisting hides dependencies or forces version choices — Bun #533 226; Bun #6850 97 [YES/PARTIAL]

#### Finding: Discord, HN and survey signals
- **What:** Cloudflare Discord (Answer Overflow) threads on D1 branching (owner plans it, no ETA), D1 overload incidents, Wrangler D1 IAM OAuth failure, remote bindings + DO dev (code 10375), fake timers through `createTestHarness`, R2 429/500 escalation opacity. HN 2026: OpenWorkers 500/158, Matrix-on-Workers dispute 579/211, Vercel plugin telemetry 280/111, Vercel pricing 191/65, agent/DN42 spending 1,467/536 (authenticity disputed), Cloudflare K2 297/112, serverless spending 65/32.
- **How it would work:** Qualitative severity signal, not a sampled survey; Cloudflare community forum returned HTTP 403.
- **Evidence / numbers:** [F] State of JS 2025 usage pain (10,038 respondents): code architecture 3,777, state management 3,461, managing dependencies 3,176, performance 2,554, build tools 2,274, debugging 2,159, typing 1,902; 4,367 of 10,934 report 100% TS. Build-tool pain (1,284): configuration 329, cognitive overload 224. Testing pain (1,405): mocking 286. https://2025.stateofjs.com/en-US/usage/, https://news.ycombinator.com/item?id=46454693
- **Prior art / who has it:** Cloudflare testing docs already provide in-runtime tests, `createTestHarness()`, forced DO abort, graceful eviction, storage reset, alarm helpers.
- **Verdict:** FINDING — "test Workers without deploying" and "force a DO restart" are not gaps; reusable cross-layer scenarios are the residual.
- **Kill test / first proof:** None given.

#### Finding: Corrections that prevent stale opportunity claims
- **What:** (1) TS 7.1 Beta (2026-10-20) ships sync/async compiler clients, AST/FS APIs and content mappers — "no TS 7 API" is obsolete; tsgo-ready exists. (2) Open ≠ unaddressed (Vitest 5 thread, pnpm #17447 fixed on main). (3) Turborepo #14896 is a leftover temp file, not cache corruption. (4) Cloudflare announced inbound TCP/gRPC on 2026-08-03. (5) Agent tracing/replay (docs 2026-10-27), Computer journal/replay and AI SDK stream resumption already ship.
- **How it would work:** Filter applied before idea generation.
- **Evidence / numbers:** [F] https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/, https://blog.cloudflare.com/grpc-workers/, https://developers.cloudflare.com/agents/runtime/operations/observability/tracing/
- **Prior art / who has it:** Microsoft, Cloudflare, Vercel, fernforge/tsgo-ready.
- **Verdict:** FINDING — kills several tempting pitches.
- **Kill test / first proof:** None given.

#### Finding: Opportunity filter and prior-art checkpoint
- **What:** Excludes owner-controlled platform changes with declared intent (outgoing-WebSocket hibernation, workerd cold loading, D1 branching, runtime compat, Vitest-major integration, Next's CDN protocol, Bun's workspace resolver) and earlier-round killed ideas; eligible work = locally runnable, contributable artifacts.
- **How it would work:** —
- **Evidence / numbers:** [F] npm registry: `repro-surgeon@0.2.1` (2026-09-06), `failtrace@1.5.0` (2026-09-07), `repromin@0.1.1` (2026-08-18), `@arethetypeswrong/cli@0.18.5`, `publint@0.3.25`, `resolve.exports@2.0.4`.
- **Prior art / who has it:** Repro Surgeon, FailTrace, ReproMin, attw, publint, resolve.exports.
- **Verdict:** FINDING — kills a generic "AI makes minimal repros / diagnoses modules" novelty claim.
- **Kill test / first proof:** None given.

#### A. Workspace repro reducer
- **What:** Shrink a failing pnpm/npm workspace's packages, peer contexts and configuration into a small, independently runnable issue attachment that preserves the dependency-resolution failure plus an explicit "works here, fails there" control.
- **How it would work:** v1: pnpm, one platform profile, a trusted Next/Workers workspace; import manifests and lockfile identities, build a disposable local fixture, remove workspace nodes/edges/config only while the named failure still reproduces, pin versions/integrities, never silently upgrade; export source, reduced config, versions, graph evidence and a verifier with fresh-install checks; offline HTML report; reuse an existing reducer engine. Demo: 100-package workspace collapses to `app → library ↔ peer`, replays from a fresh directory, passes on the fixed manager version.
- **Evidence / numbers:** [F] pains 2, 4, 13, 14, 30: npm #4263 97, npm #4834 92, Bun #533 226; pnpm #17444 and #17447 (0 reactions/2 comments) needed hand-built local registries/precise combinations. Small new counts do not establish a large market. https://github.com/pavangupta352/repro-surgeon, https://github.com/pnpm/pnpm/issues/17444
- **Prior art / who has it:** Repro Surgeon (explicitly excludes npm workspaces, pnpm/Yarn lockfiles, local deps), FailTrace, ReproMin, `turbo prune`, `pnpm deploy`, GReduce (2024).
- **Verdict:** KEPT (#1, the ONE pick) — scores Cool 4, Adjacent 5, Gap 3, Value 5, Survives models 5, Not GrowOS 5 = **27/30**; tie with B broken by concreteness of documented missing scope. Killing reply: "`turbo prune`/`pnpm deploy` plus one coding agent and Repro Surgeon already gets my failure to three packages."
- **Kill test / first proof:** On six independently authored public workspace failures (≥2 with peer/filter/hook interactions), same budgets: useful independent repro exports for ≥4, no wrong-error substitution on fixed and unrelated-error controls, and ≥2× less human investigation time than the strongest existing-tool-plus-agent baseline (counting install and reduction time). Stop or contribute tests if Repro Surgeon's maintainer already has this underway.

#### B. Reconnect/reset scenario pack
- **What:** Reusable, versioned test scenarios that coordinate client disconnect, server acceptance, partial output, DO reset, history persistence and explicit Stop, then shrink a failing event schedule.
- **How it would work:** Scripted HTTP/SSE model; one AI SDK Node app and one Agents/workerd app; six scenarios (disconnect before first frame, after partial output, during a tool, reset before callback, reconnect then stop, reconnect after completion); event barriers over real processes, fast-check chooses/shrinks orderings; explicit contract assertions; split timeline demo.
- **Evidence / numbers:** [F] Agents #1918 2 reactions (two production dead-stub reports); Agents #2741 3; AI SDK #7180 24. https://github.com/cloudflare/agents/issues/1918, https://github.com/cloudflare/agents/issues/2741
- **Prior art / who has it:** AI SDK mock models, DotMock LLM chaos, MSW SSE, Toxiproxy, fast-check model-based testing/scheduler, Cloudflare abort/evict helpers, Vercel resumable-stream, TanStack durable streams.
- **Verdict:** RUNNER-UP (#2) — Cool 5, Adjacent 5, Gap 3, Value 4, Survives 5, Not GrowOS 5 = **27/30**; low-count demand, credible as contribution/example package. Killing reply: "Those six tests are already in the SDK; MSW plus the eviction helper adds the rest in an afternoon."
- **Kill test / first proof:** Inspect current SDK tests, then compare with existing helpers plus a strong agent on two independent adapters; continue only if it reproduces three distinct real cross-layer failures with replayable schedules and no paid provider, saving setup time in both apps.

#### C. Resolution witness
- **What:** An evidence bundle showing which installed package, export condition, declaration file and executable file each tool (TypeScript, Node, Worker bundler) selected for one failing import.
- **How it would work:** v1: Node plus one Worker build target, pnpm workspace and packed-consumer modes; record paths, hashes, conditions, versions/integrity and outcome; pair a TS trace with a bundler metafile and a tiny runtime probe; separate planned conditions from observed loading.
- **Evidence / numbers:** [F] pains 2, 3, 6, 13, 30: Next #46078 109, npm #3466 67, Bun #4290 276.
- **Prior art / who has it:** Are The Types Wrong?, publint, resolve.exports, bundler metafiles, package-manager `why`/`explain`.
- **Verdict:** RUNNER-UP (#3) — Cool 4, Adjacent 5, Gap 2, Value 4, Survives 5, Not GrowOS 5 = **25/30**; may be a feature of an existing checker. Killing reply: "attw, publint and the esbuild metafile already identify this branch."
- **Kill test / first proof:** On five independent packaging/resolution failures, ≥3 must need an installed-consumer or runtime fact not supplied by attw/publint, reproducible with one command, with materially more setup time for agent-plus-existing-output; fold into A if only workspace vs packed matters.

#### D. RSC cache microscope
- **What:** Replay a short navigation trace and show distinct cache keys versus response bytes.
- **How it would work:** v1: local HAR/report adapter for one Next version.
- **Evidence / numbers:** [F] pain 10, Next #65335 154 reactions.
- **Prior art / who has it:** rsc-parser/RSC DevTools, Chrome network tools, OpenNext, Next's CDN guide.
- **Verdict:** KILLED as standalone — owner is already redesigning keying; possibly an OpenNext diagnostic contribution. Killing reply: "pathname-based keying makes your insight obsolete."
- **Kill test / first proof:** Two real self-hosters must find a costly configuration issue missed by current tools.

#### E. Packed-consumer fixture generator
- **What:** Show a workspace package succeeding internally then failing in a generated fresh tarball consumer.
- **How it would work:** v1: pack plus Node/Worker consumer fixtures.
- **Evidence / numbers:** [F] pain 13, npm #3466 67 reactions.
- **Prior art / who has it:** publint, attw, package smoke tests.
- **Verdict:** KILLED as separate project — fold into A/C. Killing reply: "ten lines around npm pack and a checked-in consumer."
- **Kill test / first proof:** Show three failures not caught by existing checks and lower recurring maintenance.

#### F. Diagnostic debt ledger
- **What:** A reviewed list of accepted diagnostics that flags newly introduced errors on otherwise-ignored lines.
- **How it would work:** v1: one pinned compiler, emitted diagnostics and explicit baseline.
- **Evidence / numbers:** [F] pain 25, TS #19573 2,274 and #19139 793 reactions (not summed).
- **Prior art / who has it:** ts-migrate, type-aware linting, baseline files.
- **Verdict:** KILLED — stable TS 7 diagnostic identity is hard; better models shrink demand. Killing reply: "you recreated suppression with a brittle location/hash scheme."
- **Kill test / first proof:** Survive a routine compiler upgrade without hiding changed errors or mass churn.

#### G. Literal JSON declaration mapper
- **What:** Edit a locale JSON file and derive the literal union without a parallel handwritten type.
- **How it would work:** JSON-to-`.d.json.ts` generator/watch or TS 7.1 content mapper.
- **Evidence / numbers:** [F] pain 27, TS #32063 1,837 reactions.
- **Prior art / who has it:** generated declarations, json-schema-to-typescript, TS 7.1 content mappers.
- **Verdict:** KILLED as headline project — reasonable small upstream example. Killing reply: "an existing plugin or a weekend script."
- **Kill test / first proof:** Prove a maintained consumer existing declaration generation cannot serve.

#### H. TS 7 community transform host
- **What:** A type-driven validator generator keeps running after a native-compiler upgrade.
- **How it would work:** v1: one transformer adapter.
- **Evidence / numbers:** [F] pain 28, TS #16607 1,548 and #14419 1,455 reactions.
- **Prior art / who has it:** ttsc (compiler-powered plugins/typia), ts-patch.
- **Verdict:** KILLED as generic host — contribute a specific adapter instead. Killing reply: "ttsc already ships that exact path."
- **Kill test / first proof:** Find a concrete transform that ttsc and the 7.1 API cannot cover.

#### I. N-API porting workbench
- **What:** Replace one addon's V8-specific boundary with a tested N-API boundary that runs on Node and Bun.
- **How it would work:** v1: one library and a cross-runtime fixture.
- **Evidence / numbers:** [F] pain 6, Bun #4290 276 reactions.
- **Prior art / who has it:** node-addon-api, napi-rs, existing migrations.
- **Verdict:** KILLED as broad infrastructure — a single port could be valuable but no qualifying package was established. Killing reply: "the package already has an N-API release, or engine semantics prevent a mechanical port."
- **Kill test / first proof:** A still-maintained widely used addon with willing maintainers and a bounded testable API.

#### J. Cross-manager provenance difference report
- **What:** Explain why one install policy allows an update and another rejects it.
- **How it would work:** v1: offline metadata comparison, no enforcement guarantee.
- **Evidence / numbers:** [F] pain 29, Bun #15601 117 and npm #9242 68 reactions.
- **Prior art / who has it:** pnpm trust policy, npm provenance/trusted publishing, Socket.
- **Verdict:** KILLED — generic package-trust dashboard crowded. Killing reply: "use pnpm's policy and existing provenance verification."
- **Kill test / first proof:** A real cross-manager discrepancy with useful corrective action.

#### K. Runtime clock scenario adapter
- **What:** Advance an injected application clock while showing real Worker/storage deadlines remain separate.
- **How it would work:** v1: one expiry/alarm scenario.
- **Evidence / numbers:** [F] pain 15, Vitest #5750 10 and workers-sdk #5394 4 reactions, plus a 2026 Discord question.
- **Prior art / who has it:** Cloudflare alarm APIs, Sinon fake timers, dependency injection.
- **Verdict:** KILLED as standalone — fold into B. Killing reply: "inject now() and use the existing alarm helper."
- **Kill test / first proof:** Remove substantial setup in two real apps without pretending to control remote time.

#### L. Remote edit-to-HMR conformance fixture
- **What:** Apply an agent filesystem edit and assert the running container's page updates.
- **How it would work:** v1: one local FUSE/container watcher test and source patch.
- **Evidence / numbers:** [F] pain 22, Computer #196, 0 reactions, single reporter with a proposed patch.
- **Prior art / who has it:** Computer #196's patch, watcher test suites.
- **Verdict:** KILLED as product — normal upstream contribution if still open. Killing reply: "merge the 30-line patch."
- **Kill test / first proof:** Reproduce against current Computer and identify a still-missing regression assertion.

#### M. Request-cost explanation artifact
- **What:** Attach a navigation/request trace and explain edge/origin/model work separately.
- **How it would work:** v1: one trace and one documented pricing profile with ranges for unknown charges.
- **Evidence / numbers:** [F] pain 11, HN 65 and 191 points.
- **Prior art / who has it:** Vercel observability, provider usage dashboards, billing tools.
- **Verdict:** KILLED — missing data access/value validation. Killing reply: "your estimate omits metered work and isn't a cap."
- **Kill test / first proof:** Reconcile an independent real usage period with documented coverage and error bounds.

#### Rejected in this report
- **Generic minimal-repro AI** — Repro Surgeon, FailTrace and ReproMin already implement the workflow.
- **Generic LLM stream chaos** — DotMock, MSW, Toxiproxy, SDK mocks and fast-check supply the components.
- **Another Worker replay runtime or trace dashboard** — Cloudflare durability/tracing and OpenWorkers occupy it.
- **D1 branching** — explicit owner plan exists.
- **Outgoing-WebSocket hibernation** — needs platform architecture; owner wants it.
- **"Workers needs gRPC"** — conflates shipped inbound support with remaining API requests.
- **"TS 7 has no API" migration product** — stale after 7.1 Beta; tsgo-ready exists.
- **Exact-object-type runtime** — mature schema libraries cover boundary validation.
- **New agent filesystem** — Computer #196 suggests a patch, not a replacement.
- **Hard cloud-bill cap from user-space polling** — delayed/incomplete metering cannot give a strict bound.
- **Cache corruption platform from Turbo #14896** — overstates an acknowledged temp-file issue.
- **Immortal Workers, snapshot/fork hosting, agent JIT, agent-grown Node compat, fleet idle hosting** — killed in earlier rounds; not re-pitched.

### 02-primitives: Primitives — what only became possible in 2025–2026, and which combinations nobody has assembled
Lens: a dated map of Cloudflare, Vercel and browser/local-first primitives from 2025-01 to 2026-10-28, then a search over 16 combinations of 2–4 primitives (Firebase-style assembly) checked against GitHub, npm, changelogs and papers. Headline: both vendors shipped the whole single-primitive agent stack in 18 months, so openings exist only in combinations spanning the user's device, other people's data models, or both vendors; 12 of 16 combinations are taken or owned. The ONE pick is **A — "Remix-safe data"**: model-written, mechanically law-checked lenses so forks of generated apps (and ATProto apps) keep sharing records. Verdict: **go-with-changes — conditional on a one-week kill test**; value evidence is quiet.

#### Finding: Dated primitive map and what it says
- **What:** Cloudflare (Agents SDK, DO SQLite GA + sync KV 2025-04-07, Workflows GA, Basin/R2 Data Catalog, Containers/Sandbox, Cap'n Web 2025-09-22, Code Mode + Worker Loader, Dynamic Workers 2026-03-24, DO Facets 2026-04-13, Project Think, Browser Run, Artifacts, Dynamic Workflows, Monetization Gateway/x402, Kitesurf agent browser on Workers, Cloudflare Computer 2026-08-03, celld → Deno joins Cloudflare 2026-10-09, Birthday Week 2026 incl. rebuilt Containers TTI 4.05 s → 0.648 s and K2, tsrs 2026-10-20, WebMCP for commerce); Vercel (Fluid/Active CPU, AI Gateway, Sandbox GA + snapshots, AI SDK 5/6/7, Workflow DevKit, just-bash, quickjs-wasi, Connect, Run SDK, Workflow SDK v5 Worlds, Fluid images, Drives GA 2026-10-15, durable-harness 2026-10-19); browser/local-first (WebGPU in all four engines, DuckDB-Wasm Iceberg in a tab 2025-12-16, Chrome Prompt API, WebMCP origin trial, Zero 1.0, Electric Agents 0.6, panproto, LiveStore/TinyBase/Automerge/Loro/Jazz).
- **How it would work:** I: both vendors converged on model gateway + durable execution + disposable code execution + persistent agent storage + scoped credentials + payments; genuinely new classes are per-request code with its own DB (Dynamic Workers + Facets), versioned everything, browser as a peer, a browser that is a Worker (Kitesurf), self-hostable Workers (celld).
- **Evidence / numbers:** [F] https://blog.cloudflare.com/durable-object-facets-dynamic-workers/, https://blog.cloudflare.com/birthday-week-2026-wrap-up/, https://vercel.com/blog/making-every-harness-durable
- **Prior art / who has it:** Cloudflare, Vercel.
- **Verdict:** FINDING — single-primitive ideas are dead on arrival; neither vendor sells anything spanning both vendors, the user's device, or other people's data models.
- **Kill test / first proof:** None given.

#### Finding: panproto lens measurements
- **What:** Automatic lens generation does not infer intent; an authored lens works.
- **How it would work:** In `/tmp/deep-primitives/` with `@panproto/core` 0.76.1, Node 22.
- **Evidence / numbers:** [M] `panproto.lens(old,new)` on a `text → content` rename returned `{"text":"hello"}` unchanged; a `name → first,last` split passed through untouched; `diff()` saw the rename as remove + add. A one-step DSL `rename_field text→content` produced `{"content":"hello"}` and put back `{"text":"hello"}`. Wasm binary 9.96 MB raw / **2.45 MB gzipped** (fits a Worker).
- **Prior art / who has it:** panproto.
- **Verdict:** FINDING — someone (an agent) must write the intent.
- **Kill test / first proof:** None given.

#### A. Remix-safe data: model-written, mechanically checked lenses so forks keep sharing records
- **What:** When an agent regenerates or a user remixes an app, the agent must also emit a bidirectional lens from old to new schema; the runtime accepts it only if it passes lens-law checks and a replay over a fork of real records, after which every version, fork and offline client reads and writes the same data through the lens graph.
- **How it would work:** Supervisor DO holds a trunk table per record type plus a lens graph (panproto Wasm); each fork is a Dynamic Worker + Facet reading/writing through its lens chain, fanned out over WebSockets; AI SDK returns new code plus a panproto lens DSL document; gate = property-based law checks on 1,000 sampled real records + edge cases, replay of last N writes old→new→old, refusal showing the failing record; second target a Lexicon adapter for standard.site; CLI `lens check`. Demo: a "book club" app with Alice's (split author, tags list) and Bob's (rename title, ratings 1–5 → 1–10) remixes syncing live; Carol's "drop notes" refused with the concrete losing record.
- **Evidence / numbers:** [F] ATProto forbids renames/type changes ("a new Lexicon name must be used"); standard.site (Leaflet, pckt, Offprint) diverge in content formats; Automerge says Cambria-style migration "not yet implemented"; Electric `ALTER TABLE` forces clients to discard data; LiveStore #69 open since 2024-05. Counter-evidence: the most-reacted schema-migration issue across seven sync engines has ~6 reactions; loud incidents (Replit 2025-07, PocketOS HN 860/1,032) are deletions lenses don't prevent. https://jazz.tools/docs/schemas/migrations, https://github.com/panproto/panproto, https://atproto.com/specs/lexicon
- **Prior art / who has it:** Jazz v2 lenses (Rename/Copy/Add/Drop + bijections, one admin catalogue, no model authoring or replay); panproto (engine, law checks "cover only supplied or generated cases", no runtime); Cambria (dormant since 2024-06); Lexicon Community lens proposal (discussion); Cloudflare VibeSDK space (Facet per branch, DB starts empty); Val Town/Glitch (forks copy data); AIM, SchemaMigrate, Atlas, Prisma 6.15, Horizon/LAMT (one-way).
- **Verdict:** KEPT (#1, the ONE pick) — Cool 4, Adjacent 4, Gap 3, Value 2, Survives models 5, Not GrowOS 5 = **23**. Only combination where the missing piece is off both roadmaps, the check is model-independent (GetPut/PutGet + replay) and the artefact runs model-free; build on panproto, offer to Jazz and Lexicon Community. Killing reply: "Real schema changes are lossy… if Bob rates 7/10, what does Alice see? Nobody remixes hoping to share live data; they want a copy."
- **Kill test / first proof:** One week: collect 30 real schema-change commits (Supabase migrations in Lovable/Bolt projects) plus standard.site divergences; a current model writes panproto DSL; run law checks and replay. **Kill if** <60% pass without a human, >half need complements that leak user-visible surprises, or two ATProto/Lexicon Community developers say they would not use it.

#### B. Fork the data, not just the code: copy-on-write SQLite per agent attempt on Facets
- **What:** A userland copy-on-write SQLite (SQLite-Wasm with a page VFS whose pages live in a DO keyed by content hash, so fork copies only the page map), giving every agent attempt its own Facet on a fork of real data and its own live URL in milliseconds.
- **How it would work:** ~600 lines: wa-sqlite VFS over `ctx.storage.kv` pages, `fork()` copying the page map, a Facet loader, a 100-URL grid. Demo: one feature request fans out to 100 attempts, a grid of live URLs in ~2 s, each on a fork of a 50 MB dataset; losers' forks cost nothing.
- **Evidence / numbers:** [F] DOs have no fork/clone (PITR restores in place); D1: "Time Travel does not yet allow you to clone or fork"; Neon branches take seconds to minutes with 10/10 plan caps; BranchBench (2026-04) finds no branchable DB handles agentic workloads (25–1500× slower create/switch); Canon Workers previews 48–54 s median; Supabase branches $0.32/day. [I] PocketOS was an infra-token call, so forks wouldn't have stopped it. https://developers.cloudflare.com/d1/reference/time-travel/, https://arxiv.org/abs/2604.17180
- **Prior art / who has it:** VibeSDK space (empty DB), Replit Agent 4 (~10 parallel copies), Cursor `/best-of-n`, Codex `--attempts`, Freestyle and Morph VM forks (<250 ms claimed), Neon branch per preview.
- **Verdict:** RUNNER-UP (#2) — Cool 4, Adjacent 5, Gap 2, Value 3, Survives 3, Not GrowOS 5 = **22**; likely pre-empted (D1 names fork as planned; native beats Wasm). Survival mixed: best-of-N matters less with better models, "agents only touch forks" more. Killing reply: "Cloudflare ships `fork()` next quarter, your Wasm SQLite is 3–10× slower… Fork Arena's A/A test falsely promoted a challenger in about half of runs."
- **Kill test / first proof:** Kill if the CoW VFS is >3× slower than native DO SQLite on a TPC-C-lite read mix, or Cloudflare confirms native fork.

#### L. Follow-me Durable Objects: the per-user object lives in your tab while you're there
- **What:** Run the same DO class in the user's tab (SQLite-in-OPFS, Web Locks, single-writer lease) while they are present — offline, 0 ms, free compute — and move it back to Cloudflare when they leave so alarms, email and other users still reach it; moving means shipping a database file plus a lease, not a heap.
- **How it would work:** DO programming model + SQLite-in-OPFS + workerd/celld + lease. Demo: indicator flips "edge" → "this tab" (5 MB transfer), Wi-Fi off still works, close tab, object returns, an alarm fires and email arrives.
- **Evidence / numbers:** [I] pain weak — sync engines already serve local-first; agent DOs need a remote model anyway.
- **Prior art / who has it:** Solid Objects (2026-08-24, 42★, DO-style actors in a tab, no move to Cloudflare); TinyBase/LiveStore/Electric/Zero (data replication); celld → workerd (servers, not tabs); earlier teleport rounds moved heaps.
- **Verdict:** RUNNER-UP (#3) — Cool 4, Adjacent 5, Gap 3, Value 2, Survives 2, Not GrowOS 5 = **21**. Killing reply: "Single-writer means your phone stalls while your laptop holds the lease… 'It moves' is a mechanism, not value."
- **Kill test / first proof:** Kill if a 10 MB object handover between workerd and the tab takes >500 ms, or three local-first developers prefer their sync engine.

#### R. Versioned running app (Artifacts commit + DO PITR bookmark + Workflow state)
- **What:** Atomic rollback or fork of a running app — code, data and in-flight work bound into one version.
- **How it would work:** Bind an Artifacts commit, DO PITR bookmark and Workflow state.
- **Evidence / numbers:** [F] Replit App History on Neon (2025-05-21).
- **Prior art / who has it:** Replit App History, Fly Sprites checkpoints, Canon (contest entry).
- **Verdict:** KILLED — partially taken; rewinding production data destroys later legitimate writes, so ops teams forward-fix.
- **Kill test / first proof:** None given.

#### C. Browser-as-hands (Agents SDK DO brain + Cap'n Web + tab tools)
- **What:** Hands on the user's machine (FS Access, WebContainer, WebGPU) at zero server compute.
- **How it would work:** DO brain calls browser-tab tools over Cap'n Web.
- **Evidence / numbers:** [I] sandboxes cost ~$0.08/vCPU-h against dollars of model spend.
- **Prior art / who has it:** Cloudflare Agents client tools + resume-on-reconnect (2026-04→06), `examples/codemode-browser` (2026-05-06), bolt.new.
- **Verdict:** KILLED — taken; compute is not the bill.
- **Kill test / first proof:** None given.

#### D. Code-to-data (local-first replica + QuickJS-Wasm in the tab + schema-only cloud model)
- **What:** The agent works on private data the model never sees; results quarantined.
- **How it would work:** Model sees schema only; generated code runs over a local replica.
- **Evidence / numbers:** [I] every repair loop is a side channel leaking data-derived bits.
- **Prior art / who has it:** CaMeL, FIDES, Anthropic code-execution-with-MCP (2025-11-04), PandasAI `enforce_privacy`, DBeaver metadata-only.
- **Verdict:** KILLED — components taken.
- **Kill test / first proof:** None given.

#### E. Website → tool compiler (Browser Run/Kitesurf + Dynamic Workers + WebMCP shape)
- **What:** Explore a site once, compile a deterministic tool, self-heal.
- **How it would work:** Agent browser exploration emitted as Dynamic Worker tools.
- **Evidence / numbers:** [F] Browser Use retired its Skills marketplace (410 Gone); ~100k Commerce.com stores publish WebMCP themselves.
- **Prior art / who has it:** Skyvern, Stagehand v4 cache, Notte Functions, Browser Use scripts, WALT (ICLR 2026), Unbrowse.
- **Verdict:** KILLED — taken; site owners publish WebMCP.
- **Kill test / first proof:** None given.

#### I. Git for agent swarms (Artifacts + DO merge coordinator + semantic merge)
- **What:** Coordinated semantic merging for many concurrent agents.
- **How it would work:** DO merge coordinator over Artifacts repos.
- **Evidence / numbers:** [F] 24+ contest repos.
- **Prior art / who has it:** Cursor Origin, Zed Delta, GitButler, jj, GitHub stacked PRs/merge queue.
- **Verdict:** KILLED — crowded.
- **Kill test / first proof:** None given.

#### F. x402 budgets (Monetization Gateway + Code Mode budget capability)
- **What:** Agent code that pays per call under a budget capability.
- **How it would work:** —
- **Evidence / numbers:** [F] Cloudflare Wallets + Monetization Gateway (2026-07), x402-mcp.
- **Prior art / who has it:** Cloudflare, Vercel x402-mcp.
- **Verdict:** KILLED — the platform owns it.
- **Kill test / first proof:** None given.

#### G. Iceberg in the tab (Basin + DuckDB-Wasm + Code Mode)
- **What:** Analytics in the browser directly over the R2 lake.
- **How it would work:** —
- **Evidence / numbers:** [F] DuckDB "Iceberg in the browser" (2025-12-16).
- **Prior art / who has it:** DuckDB.
- **Verdict:** KILLED — taken.
- **Kill test / first proof:** None given.

#### H. Durable/forkable agent sessions (sync engine + durable agent sessions)
- **What:** Resumable, forkable, multi-device agent sessions.
- **How it would work:** —
- **Evidence / numbers:** [F] Electric Agents 0.6 + Durable Streams (2026-06).
- **Prior art / who has it:** Electric, Vercel durable-harness.
- **Verdict:** KILLED — taken.
- **Kill test / first proof:** None given.

#### M. On-device inference + DO orchestration (Chrome Prompt API / WebGPU models)
- **What:** Cheap steps on the user's GPU orchestrated by a DO.
- **How it would work:** —
- **Evidence / numbers:** [F] Prompt API contested (Mozilla/WebKit oppose, Edge disabled).
- **Prior art / who has it:** Firebase AI Logic hybrid inference (2025-06/10).
- **Verdict:** KILLED — taken, and the API is contested.
- **Kill test / first proof:** None given.

#### N. Distributed TypeScript type-checking (tsrs-wasm + Dynamic Workers fan-out + Artifacts CAS)
- **What:** Edge-distributed type-checking.
- **How it would work:** —
- **Evidence / numbers:** [F] tsrs (2026-10-20) up to 8× faster than TS 7.0.
- **Prior art / who has it:** VoidZero + Cloudflare (tsrs, Vinext, Oxc).
- **Verdict:** KILLED — the owner will build it.
- **Kill test / first proof:** None given.

#### O. Pre-run type checks for Code Mode (tsrs-wasm + Code Mode)
- **What:** Type-check generated code before running it.
- **How it would work:** —
- **Evidence / numbers:** [F] Code Mode already ships `.d.ts`.
- **Prior art / who has it:** Cloudflare + VoidZero.
- **Verdict:** KILLED — small and owned.
- **Kill test / first proof:** None given.

#### P. Third-party WebMCP injection
- **What:** Agent-ready versions of sites that did not opt in.
- **How it would work:** —
- **Evidence / numbers:** [F] WebMCP permission policy defaults to `self`.
- **Prior art / who has it:** —
- **Verdict:** KILLED — blocked by the spec.
- **Kill test / first proof:** None given.

#### Q. Kitesurf test fleets (Kitesurf + Dynamic Workers)
- **What:** Chrome-free e2e test fleets for generated UIs.
- **How it would work:** —
- **Evidence / numbers:** [F] Kitesurf not open-sourced yet.
- **Prior art / who has it:** Cloudflare Kitesurf.
- **Verdict:** KILLED — Cloudflare owns it.
- **Kill test / first proof:** None given.

### 03-language: Language lens — a language, TS dialect, or compiler for code that models write and run
Lens: should there be a new language, TypeScript dialect or compiler for model-written, durable, pausable, effect-typed code? Headline: a new language is the wrong unit — a TS subset plus host semantics gets every wish-list property, and each property already ships (Vercel Workflow, Cloudflare Code Mode/Dynamic Workflows, Monty, Zapcode, Guild, Golem); the one open seam is **changing a program's code while it runs** against its effect journal. The ONE pick is **Replay diff**: a TS compiler pass plus dry replay that classifies each recorded effect as reused/stale/orphaned/duplicate/new before a durable run resumes on edited code. Verdict: **go-with-changes, confidence medium-low** — run the corpus kill test before building; Vercel says it is building in-flight upgrades.

#### Finding: Is a new language valuable when models write the code?
- **What:** Evidence that language design matters but novelty costs accuracy.
- **How it would work:** —
- **Evidence / numbers:** [F] Octoverse 2025: TypeScript #1 on GitHub by monthly contributors (Aug 2025, +1M, +66% YoY); type-constrained TS decoding (PLDI 2025) halves compile errors; Quasar (COLM 2026) has models write a restricted Python subset (GQA 71.8 → 71.4, AgentDojo 64.5 → 63.4); esoteric-language ICL (NeurIPS 2025) "far below" common languages (Pyth 16.67% → 30.82%, Minipy 51% → 65%); CangjieBench reports negative transfer; AutoCodeBench: Elixir highest completion of 20 languages. [M] Wing 5,403★, last release 2025-02-03, one recent author; Unison 1.0 (2025-11-25) 6,773★; Darklang new version "not yet ready for production" after 3.5 years. https://arxiv.org/abs/2504.09246, https://arxiv.org/abs/2506.12202
- **Prior art / who has it:** MoonBit, Darklang, Wing, Unison, Jac, Pel.
- **Verdict:** FINDING — with 10–100× better models the training-data argument weakens but ecosystem economics (npm, `tsc`, editors, reviewers, toolchains) remain.
- **Kill test / first proof:** None given.

#### Finding: The wish list, property by property
- **What:** Durable, pausable/teleportable, forkable, capability-safe, replayable, compiled-to-JS/Wasm — all taken; effect-typed is research-occupied with no shipping TS runtime; cheap-to-verify was killed earlier; **safe to change while running** is the gap.
- **How it would work:** —
- **Evidence / numbers:** [F] Vercel Workflow SWC transform + event-log replay; Cloudflare Dynamic Workflows ("an agent can write its own durable plan", 2026-05-01); Code Mode `approve()` "resumes a paused execution through replay"; Pydantic Monty (snapshot "single-digit kilobytes", 8,798★ M); Zapcode TS subset (snapshots "under 2KB", 94★ M); Guild babel plugin ("the compiler does not warn you"); Vercel QuickJS PR #3253 (~7–8× slower than node); DBOS `fork_workflow`; Dynamic Workers `globalOutbound: null`. Vercel pins runs to deployments (cancel + "Rerun on latest"); Temporal `patched()`/Worker Versioning (GA 2026-03-30); Inngest memoizes by step ID; Cloudflare "Step names act as the 'cache key'". https://workflow-sdk.dev/docs/how-it-works/code-transform, https://www.inngest.com/docs/learn/versioning, https://developers.cloudflare.com/workflows/build/rules-of-workflows/
- **Prior art / who has it:** Vercel, Cloudflare, Pydantic, Guild, Golem, Effect, Temporal, Restate, Inngest, DBOS.
- **Verdict:** FINDING — a compiler adding durability/pausing/forking to Code Mode would compete with the platforms' core roadmap.
- **Kill test / first proof:** None given.

#### Finding: Five hazard classes when edited code resumes against a journal
- **What:** (1) stale inputs — same key, different inputs, old result silently returned; (2) stale body — the fix never applies to this run; (3) duplicate effect — a renamed/re-keyed completed write re-executes (two emails/charges; Inngest documents it as the way to force re-execution); (4) orphaned effect — a completed write no longer reachable; (5) divergent prefix — code outside steps branches differently.
- **How it would work:** Applies to Inngest, Cloudflare Workflows, Code Mode `step()`, Temporal AUTO_UPGRADE; agents make it worse because Dynamic Workflows' loader "fetches the tenant's latest source" on each wake.
- **Evidence / numbers:** [F] Restate (2024-02-02): safe code updates are "probably the hardest problem"; Vercel forum (2026-01-29) "You cannot update in-flight workflows"; vercel/workflow #13 (7 reactions; maintainer "currently building something for versioning"); discussion #99 (12 upvotes); Temporal doesn't compare activity inputs on replay. https://restate.dev/blog/solving-durable-executions-immutability-problem, https://github.com/vercel/workflow/issues/13
- **Prior art / who has it:** —
- **Verdict:** FINDING — nothing checks this today.
- **Kill test / first proof:** None given.

#### 1. New language "Await"
- **What:** A durable, forkable, effect-typed, capability-safe language compiled to JS/Wasm.
- **How it would work:** —
- **Evidence / numbers:** see language findings above.
- **Prior art / who has it:** Unison, Golem, Vercel, Cloudflare, Quasar; Darklang and Wing as cautionary cases.
- **Verdict:** KILLED — every property is taken; novelty costs accuracy. Scored as the answer to the lens: Cool 4, Adjacent 4, Gap 1, Value 1, Survives 2, Not GrowOS 5 = **17**.
- **Kill test / first proof:** None given.

#### 2. Pause-at-any-await TS compiler pass
- **What:** CPS/state-machine transform on V8 so any await can pause, without QuickJS slowdown.
- **How it would work:** —
- **Evidence / numbers:** [I] Code Mode programs are short and every effect crosses a host boundary, so journaling there gives durability with no compiler.
- **Prior art / who has it:** Guild, Zapcode, Monty, Vercel QuickJS, Code Mode durable runtime, Stopify/Distribufy, Lumenize continuations.
- **Verdict:** KILLED — covered, and replay beats it for short programs.
- **Kill test / first proof:** None given.

#### 3. Effect manifest pass + batched approval (prior-round survivor, re-scored)
- **What:** Quasar for TS: a static tool footprint yields one batched approval.
- **How it would work:** Effect-annotated external calls let the host approve once and autoparallelise.
- **Evidence / numbers:** [F] Quasar: 26–97% fewer approvals (new evidence vs `flip2`).
- **Prior art / who has it:** Quasar, Unison abilities, Koka, Effekt, Effect-TS `R` channel, CaMeL/CaMeLoT/ACE.
- **Verdict:** NARROWED (not picked) — Cool 2, Adjacent 5, Gap 3, Value 4, Survives 5, Not GrowOS 5 = **24**; edges ahead on raw score, but the builder already passed on it (`flip2` #1); not rejected on merit — Quasar plus the `flip2` design is the starting point if reconsidered.
- **Kill test / first proof:** None given.

#### 4. Replay diff: edit a running TypeScript program and see what the edit does to its past
- **What:** A TS compiler pass plus dry-replay engine that, before a durable run resumes on edited code, classifies every recorded effect as reused-valid / stale-inputs / stale-body / orphaned / would-duplicate / new, blocks or asks on write hazards, and suggests the safe resume point.
- **How it would work:** The pass finds a `step.do(name, closure)`'s captured free variables and hashes their values at call time, hashes each step body plus same-module callees (Unison-style), and attaches a read/write effect class from tool types. Week 1: compiler-API step-site table + input-hash journal sidecar; week 2: dry replay in Node vm or workerd with steps served from the journal, seeded `Date`/`Math.random`, writes stubbed, JSON/HTML diff, adapters for Cloudflare Workflows (miniflare), Vercel Workflow (local World event log), Code Mode `step()`; week 3: MCP tool `check_edit(run, newSource)`. Demo: an "onboard Alice" Dynamic Workflow paused at approval; an edit shows `sendWelcomeEmail already sent with OLD template`; renaming the step turns red `DUPLICATE: will e-mail Alice twice`.
- **Evidence / numbers:** [F/M] Restate's "hardest problem"; Temporal built Worker Versioning around it; Vercel #13 (7) and #99 (12); Vercel blog (2026-08) calls patching "full of version flags". Weak: tens of reactions, **no public incident report** of a renamed-step duplicate; incidence unmeasured. https://www.diagrid.io/faq/alternatives-dbos-inngest/what-strategies-do-catalyst-dbos-and-inngest-support-for-deploying-new-workflow-code-versions-without-brea
- **Prior art / who has it:** Temporal replayer (command-sequence divergence only, ignores inputs), Inngest (ordering warning), Cloudflare (no deploy-during-run rules), Vercel (pin + rerun), DBOS (manual fork step), Erlang `code_change`/DSU, Hazel fill-and-resume, Unison. No tool computes effect consequences of an edit against a journal.
- **Verdict:** KEPT (#1, the ONE pick) — Cool 3, Adjacent 5, Gap 3, Value 3, Survives 4, Not GrowOS 5 = **23**; framed as an open-source checker Vercel/Cloudflare would adopt, not a moat. Killing reply: "Nobody edits code under long runs except to fix bugs… Pin, and continue-as-new. Agent-written plans live for minutes."
- **Kill test / first proof:** (1) ≥30 public repos on Cloudflare Workflows/Vercel Workflow/Inngest/Temporal-TS, dry-replay each workflow-touching commit from every step boundary — kill if <5% create a write hazard (classes 1, 3, 4) or ≥80% are already caught by an engine; (2) 50 model-made mid-run edits to Dynamic Workflows plans — kill if write-hazard rate <5%; (3) kill if false positives >20% of flagged items; (4) kill if Vercel ships effect-aware in-flight upgrade checks before week 3.

#### 5. Durable-dialect checker: `tsc` rules for model-written durable TS
- **What:** A type-checker plugin rejecting before deploy: non-serializable values live across `await`, `Date.now`/`Math.random`/`fetch` outside steps, non-deterministic step names, side effects in workflow bodies.
- **How it would work:** Same compiler pass as week 1 of the pick.
- **Evidence / numbers:** [F] Temporal ships `workflowcheck` for Go only; Vercel validates Node API imports at build; Cloudflare's rules are prose; no TS checker for Cloudflare Workflows found. Pain undocumented in issue counts.
- **Prior art / who has it:** Temporal workflowcheck (Go), Vercel build validation.
- **Verdict:** RUNNER-UP (#3) — Cool 1, Adjacent 5, Gap 3, Value 2, Survives 2, Not GrowOS 5 = **18**; small and useful but not cool; platforms would write it in a week; useful mainly as week 1 of the pick.
- **Kill test / first proof:** None given.

#### 6. Choreographic Code Mode: one program projected onto browser + Worker + Durable Object
- **What:** The model writes one TS program with placement types (`@browser`, `@worker`, `@do`); a compiler projects it into per-location programs joined by Cap'n Web and statically rejects browser-only values crossing to the server.
- **How it would work:** v1: a TS transform plus Cap'n Web stubs for two locations. Demo: reconcile a 2 GB local CSV against a CRM; a wire meter shows 41 KB crossed and raw rows never left the tab.
- **Evidence / numbers:** [I] pain only the teleport round's local-data hypothesis; no external issues/threads found.
- **Prior art / who has it:** HasChor (ICFP 2023), ChoRus, census-polymorphic choreographies with a TS implementation (PLDI 2025), Hop.js, Links, Eliom, ScalaLoci, React `"use server"`/`"use client"`.
- **Verdict:** RUNNER-UP (#2) — Cool 4, Adjacent 4, Gap 3, Value 1, Survives 3, Not GrowOS 5 = **20**; cool but no pain evidence; too PL-heavy for the vendors soon. Killing reply: "the model just writes two programs and an RPC; the type check is decoration."
- **Kill test / first proof:** On 20 locality tasks, kill if the model's own two-program split leaks data or fails in <10% of cases.

#### 7. Content-addressed TS
- **What:** Unison-style hashes per function so runs reference code by hash.
- **How it would work:** —
- **Evidence / numbers:** —
- **Prior art / who has it:** Unison 1.0.
- **Verdict:** KILLED as product — folded into the pick as a mechanism.
- **Kill test / first proof:** None given.

#### 8. Typed holes for agents
- **What:** Hazel-style fill-and-resume: run until a hole, the model fills it with live values in view, resume.
- **How it would work:** —
- **Evidence / numbers:** —
- **Prior art / who has it:** CodeAct and Code Mode persistent sessions; Hazel (POPL 2019).
- **Verdict:** KILLED — persistent REPL kernels already give the loop.
- **Kill test / first proof:** None given.

#### 9. LLM-native diagnostics
- **What:** Compiler errors written for repair loops.
- **How it would work:** —
- **Evidence / numbers:** —
- **Prior art / who has it:** MoonBit, Elm.
- **Verdict:** KILLED — fails criterion 5; better models need it less.
- **Kill test / first proof:** None given.

#### 10. Crash-at-every-await testing for model-written workflows
- **What:** Deterministic simulation with crash points.
- **How it would work:** The same dry-replay engine as the pick with crash points.
- **Evidence / numbers:** —
- **Prior art / who has it:** Temporal replayer and time-skipping, DST tools.
- **Verdict:** KILLED as separate tool — folded into the pick.
- **Kill test / first proof:** None given.

#### 11. Replay receipts ("cheap to verify")
- **What:** Verification artefacts from replay.
- **How it would work:** —
- **Evidence / numbers:** —
- **Prior art / who has it:** —
- **Verdict:** KILLED — generic verification-as-a-product was killed in earlier rounds.
- **Kill test / first proof:** None given.

#### 12. TS-to-Wasm durable agents
- **What:** Golem-style durable agents compiled from TS to Wasm.
- **How it would work:** —
- **Evidence / numbers:** —
- **Prior art / who has it:** Golem, Vercel quickjs-wasi, earlier capsule rounds.
- **Verdict:** KILLED — covered.
- **Kill test / first proof:** None given.

#### Rejected in this report
- **Durable Code Mode** — Cloudflare's codemode runtime (`approve()` via replay) and Dynamic Workflows ship it.

### 04-wasm: What important software could actually run in a Worker or a tab?
Lens: existing Wasm/pure-TS ports of important software, the remaining Workers-specific failures (measured with an npm artifact census and local workerd checks), and one useful open-source project. Headline: almost every famous engine (Postgres, SQLite, DuckDB, Python, libgit2, FFmpeg, ImageMagick, TS 7, JS compilers, Tree-sitter, PDF engines, Typst) already has a port, often with Workers prior art; the remaining work is bounded object/file I/O, peak memory and compatibility, not recompiling engines. The ONE pick is a **worktree-free Git merge kernel** (`git merge-tree --write-tree` equivalent with structured conflicts over a bounded object-store API), adapting gix/wasm-git first. Verdict: **go-with-changes / conditional — no unconditional green light**; a two-day adopter/fixture test decides.

#### Finding: The constraints changed; old size objections are misleading
- **What:** Current Workers/Vercel envelopes for Wasm.
- **How it would work:** Admission budget proposed: ≤80–96 MiB total peak, fresh instance after heavy jobs, bounded caches, streamed/ranged input [E].
- **Evidence / numbers:** [F] 2026-09-04: Worker limit is **64 MiB uncompressed on both plans** (was 3 MB Free / 10 MB Paid compressed); still **128 MB per isolate** shared by concurrent requests; global-scope startup ≤1 s; Paid HTTP CPU up to 5 min; precompiled Wasm + SIMD but no Web Worker API or parallel threads; `node:fs` `/tmp` is request-local memory. Vercel Functions 2 GB default, up to 4 GB, 5 GB packages (beta 2026-06-29). A 1 MB Wasm file can still request 128 MB at instantiation. https://developers.cloudflare.com/changelog/post/2026-09-04-increased-worker-size-limit/, https://developers.cloudflare.com/workers/platform/limits/
- **Prior art / who has it:** —
- **Verdict:** FINDING — memory, not bundle size, is the gate; Wasm is less of an unlock on Vercel.
- **Kill test / first proof:** None given.

#### Finding: Measured artifact census
- **What:** Raw/gzip-9 sizes and declared minimum memory of 22 published Wasm artifacts.
- **How it would work:** npm `latest` tarballs streamed without install scripts, SHA-256 hashed, gzip-9 recompressed, import/memory sections decoded.
- **Evidence / numbers:** [M] PGlite 8.667 / 3.090 MiB, declared min **128 MiB** (+ 6.25 MB `pglite.data`); sqlite-wasm 0.838 / 0.388 / 8; DuckDB-Wasm EH 34.25 / 7.68 / 16; Pyodide core 9.15 / 3.37 / 30; wasm-git 0.823 / 0.344 / 16.25; ffmpeg core 30.74 / 9.71 / 32; tsgo-wasm 46.75 / 10.21 / 25.4; Biome **59.83** / 15.52 / **73.4**; SWC 17.2; esbuild 13.3 / 3.55 / 5.9; web-tree-sitter 0.201 / 0.079 / 32; magick-wasm 14.7; resvg 2.36 / 0.90; Typst 27.0; onnxruntime-web 14.2; oxc binding 1.45 / 61.25 shared; Rolldown browser 10.9 / 62.6 shared; ttsc 33.0; mupdf 9.93; qpdf 1.27; docx-to-pdf 2.25. PGlite's measured 3.090 MiB gzip vs its advertised sub-3 MB is a version/compression difference.
- **Prior art / who has it:** —
- **Verdict:** FINDING — "under 3 MB gzipped" and npm unpacked size are insufficient deployment evidence.
- **Kill test / first proof:** None given.

#### Finding: Local workerd checks that changed the verdict
- **What:** Ten local workerd 2026-10-25 experiments.
- **How it would work:** `Workerd.Config` with `wasm = embed`, lazy instantiation inside handlers, loopback HTTP.
- **Evidence / numbers:** [M] esbuild with a plugin VFS bundled TS — **passed** (first request 289–374 ms, warm median 20.82 ms); resvg PNG passed (warm 0.768 ms); ImageMagick PPM → PNG passed (135.7 ms); **TS 7.0.2 tsgo** reported TS2322 in 2,369.7 ms with **110.5 MiB** final linear memory; unadapted Go bridge failed on `node:fs.read` null position (fixed by a numeric-offset shim); PGlite with 64 MiB memory **rejected** (declared initial 2048 pages); dynamic `WebAssembly.compile(bytes)` rejected ("code generation disallowed by embedder"); JSPI async import/export passed; `Worker` absent, SAB present; a 144 MiB memory allocation **succeeded locally** — local workerd does not enforce hosted 128 MB admission.
- **Prior art / who has it:** —
- **Verdict:** FINDING — "a real bundler cannot run in Workers" is false; local "it boots" cannot establish production fit.
- **Kill test / first proof:** None given.

#### Finding: Survey of existing ports by domain
- **What:** Databases, Python, Git, media, compilers, documents and inference already have ports.
- **How it would work:** —
- **Evidence / numbers:** [F] PGlite (memory FS; needs a DO VFS + crash protocol), `@dotdo/pglite`/`@dotdo/postgres` (claims ~1.2 s cold, 13–16 ms warm, unverified), PGlite #1082 closed, PR #1121 `unwasm`; DuckDB Worker ports `ducklings` and `smithclay/duckdb-worker` (16.4 MB engine, 20.2 MB bundle, unreleased branch), DuckDB-Wasm #1904 retained memory; Cloudflare Python Workers (Pyodide + deploy-time snapshots); isomorphic-git (no protocol-v2 partial clone, unbounded pack cache) in Computer; wasm-git (incl. experimental WASI 0.2 component); gitoxide Wasm CI (pack/object crates, not `gix-merge`), #463 20 reactions; dgit (206★) DO-per-repo smart HTTP; ffmpeg.wasm discussion #782, libav.js no-worker mode, openclaw/ffmpeg-wasm (4.5–4.7 MB/tool); magick-wasm discussion #195; Cloudflare worker-bundler; Oxc/SWC/Biome/Rolldown packages; tsgo-wasm, ttsc; Tree-sitter `Language.loadSync` for Workers; ripgrep-node wasip1; LibreOffice headless Emscripten (147–154 MB Wasm + 95–100 MB data); docx-to-pdf-wasm Worker recipe (2.23 MiB); MuPDF, QPDF, PDF Slim, Kreuzberg; typst.ts, cf-rendercv; ORT Worker pipeline (Silero VAD 2.3 MB: ~424 ms session, ~36 ms first, ~0.7 ms avg). [E/I] 1 B params at 4-bit = 500 MB weights. https://github.com/cloudflare/computer/blob/main/docs/13_git_interface.md, https://github.com/littledivy/dgit, https://github.com/microsoft/onnxruntime/discussions/27400
- **Prior art / who has it:** as listed.
- **Verdict:** FINDING — the broad Wasm-port opportunity is far more occupied than it appears.
- **Kill test / first proof:** None given.

#### Finding: WASI, components, GC and stack switching status
- **What:** WASI 0.2 stable; **WASI 0.3.0 shipped 2026-06-11, 0.3.2 on 2026-10-13**; workerd has no native component host (experimental WASI only); jco transpiles components to core modules with a precompiled-module callback; Wasm GC in Chrome 119/Firefox 120/Safari 18.2; JSPI phase 5 (passed locally); general stack switching phase 3.
- **How it would work:** Compile/transpile to imported core modules plus explicit JS host adapters.
- **Evidence / numbers:** [F] https://github.com/bytecodealliance/wasi.dev/blob/main/docs/releases/wasi-p3.md, https://github.com/bytecodealliance/jco, https://webassembly.org/features/
- **Prior art / who has it:** Nimbus (alpha DO filesystem, shell, npm, Python/Ruby, clang-to-WASI; not tested).
- **Verdict:** FINDING — a Worker-native WASI-component adapter is useful enabling work but a weak standalone pick; no OS/syscall-growth project or GrowOS/jitk.
- **Kill test / first proof:** None given.

#### 1. Worktree-free Git merge kernel
- **What:** Two real Git commits go into a browser or DO and a native-Git-compatible merged tree plus typed conflicts comes back without a checkout: `mergeCommits({ours, theirs, objectStore, limits}) → {tree, newObjects, conflicts}`.
- **How it would work:** TS wrapper over immutable Git objects; a DO serializes ref publication with compare-and-swap; pack/object bytes in R2 or the workspace store. Days 1–2: named caller + frozen fixtures, try gix-merge and wasm-git adapters, compile Git's merge path only if they fail; days 3–7: one engine, in-memory and workerd object-provider adapters, structured conflicts, bounded accounting; days 8–12: ≥100 fixtures vs a pinned native Git oracle (rename/modify, rename/delete, dir/file, add/add, binary/mode, Unicode, multiple merge bases), reject unsupported drivers/filters; days 13–15: integration into an existing DO Git store, browser demo, documented profile. Demo: rename/modify and criss-cross history vs stock Git.
- **Evidence / numbers:** [F] Cloudflare OS's Git storage plan works around isomorphic-git's recursive-merge and add/add behavior; GitHub (2023) switched from libgit2 to `merge-ort` after support tickets — rebase experiment run 730,000 times, 2.56 h libgit2 vs <10 min new path (historical, not a Wasm speedup). Acceptance [E]: bundle ≤32 MiB, hosted peak ≤96 MiB. https://github.com/cloudflare/cloudflare-os/blob/main/plans/git-storage.md, https://github.blog/engineering/infrastructure/scaling-merge-ort-across-github/, https://git-scm.com/docs/git-merge-tree
- **Prior art / who has it:** `git merge-tree`, gitoxide (`ort`-level tree merging reported 2024-11), wasm-git/libgit2, isomorphic-git.
- **Verdict:** KEPT (#1, the ONE pick) — Cool 4, Adjacent 5, Gap 3, Value 4, Survives 5, Not GrowOS 5 = **26**; veto: an existing gix/libgit2 adapter may suffice, no committed adopter, parity can exceed scope. Not a new merge algorithm, forge or orchestration product. Killing reply: "You are replacing an adequate libgit2/gix merge with an expensive promise of stock-Git parity."
- **Kill test / first proof:** By day 2, no essential adopter fixture beyond an existing adapter → submit the adapter/docs and stop; by day 5, no useful in-budget merge → stop; any silent tree loss on a held-out fixture blocks release; never relabel a differing gix result as "the same as Git."

#### 2. Partial-clone Git client over DO/R2
- **What:** Open a large remote repo in a DO, fetch one selected blob, edit/commit/push, and show transferred bytes and cache high-water: `openRemote → filtered commit/tree fetch → lazy object read → local commit → push`.
- **How it would work:** v1: one HTTPS smart-HTTP profile, `blob:none`, commits/trees and selected blobs, SHA-1 packs, shallow vs promisor distinction, bounded delta depth/object size, auth at the host boundary, reuse a published object/index engine.
- **Evidence / numbers:** [F] isomorphic-git #1123 (2020-05-06) open, 8 reactions/4 comments; gitoxide discussion #2791 (2026-07-22) tracks partial/promisor work. [E] acceptance: repo with ≥1 GiB reachable blobs, <10 MiB actual Git data transferred, ≤96 MiB hosted target, one valid pushed commit readable by stock Git.
- **Prior art / who has it:** gource-view (minimal protocol-v2 filtered fetch + isomorphic-git indexing), dgit, GitHub content API.
- **Verdict:** RUNNER-UP (#2, backup) — Cool 4, Adjacent 5, Gap 3, Value 4, Survives 5, Not GrowOS 5 = **26**; veto: filtered-fetch prior art, bounded indexing/promisor correctness. Killing reply: "filtered fetch plus isomorphic-git already works."
- **Kill test / first proof:** Implement the best thin extension to gource-view/isomorphic-git first with real indexing; contribute there if it meets the corpus; the unlock fails if packfiles still need whole-pack copies or unbounded caches; native Git in an on-demand container is the baseline.

#### 3. Seekable PDF operations directly on R2
- **What:** Extract text boxes and one thumbnail from a page of a PDF larger than the isolate's memory ceiling, showing range requests and peak memory.
- **How it would work:** An immutable `readAt(offset,length)` source (pinned ETag, small block cache) feeding a PDF engine via JSPI or an existing progressive-stream bridge; page-at-a-time text/thumbnail with explicit memory/pixel limits; try PDF.js's range path and MuPDF's progressive machinery first.
- **Evidence / numbers:** [F] MuPDF #142 (2025-03-01) asks for Workers execution; MuPDF has a native seekable-stream abstraction. [E] acceptance: PDFs >256 MiB, selected page output under <64 MiB total, substantially less than whole-file transfer, incl. unlinearized and large-xref files. https://github.com/ArtifexSoftware/mupdf/blob/master/include/mupdf/fitz/stream.h
- **Prior art / who has it:** PDF.js range loading, MuPDF, PDF Slim, Kreuzberg, QPDF, pdfstudio; MuPDF AGPL/commercial licensing affects adoption.
- **Verdict:** RUNNER-UP (#3, research backup) — Cool 4, Adjacent 5, Gap 2, Value 4, Survives 5, Not GrowOS 5 = **25**; veto: existing range loaders may close the gap, licensing, worst-case working set. Killing reply: "the engine needs a large xref/image/font graph anyway; range support already exists."
- **Kill test / first proof:** By day 2 show an operation current packages cannot do without exceeding memory or downloading the whole file; if the existing range loader works, contribute an R2 example; stop if no bounded bridge works without a major engine rewrite.

#### 4. Bounded FFprobe/remux engine over R2
- **What:** Probe a large video or copy a short audio segment without staging the whole file.
- **How it would work:** v1: two-week range-read integration for one container, probe/remux only.
- **Evidence / numbers:** [F] FFmpeg-Wasm discussion #782 requests Workers/main-thread support; upstream PRs #984 (chunked files) and #987 (JSPI) opened 2026-09-29.
- **Prior art / who has it:** libav.js (device I/O, no-worker mode), OpenClaw narrow build.
- **Verdict:** NARROWED (inspect, then demote) — adapter contribution, not a fresh port; less whitespace than 1–3. Killing reply: "libav.js's device I/O already provides this."
- **Kill test / first proof:** Prove a useful bounded-memory operation libav.js's no-worker path cannot provide.

#### 5. Postgres-compatible database per DO
- **What:** Restart an object and query committed PostgreSQL data.
- **How it would work:** v1 could qualify a reduced-memory build and one transactional storage adapter.
- **Evidence / numbers:** [M] default PGlite module declares 128 MiB minimum.
- **Prior art / who has it:** PGlite, dotdo PostgresDO with tiered VFS; Cloudflare SQLite/Hyperdrive.
- **Verdict:** KILLED (broad pitch). Killing reply: "the fork already supplies it."
- **Kill test / first proof:** Audit fork source and crash recovery first; if commits survive forced restarts within budget, contribute upstream.

#### 6. A real JavaScript build system inside Workers
- **What:** npm imports → bundled app → Dynamic Worker preview.
- **How it would work:** v1: a named missing framework/plugin in two weeks.
- **Evidence / numbers:** [M] esbuild passed locally; [F] agents #1306 is a closed Node-loader issue.
- **Prior art / who has it:** `@cloudflare/worker-bundler` (resolves npm, builds apps; experimental), browser Rolldown.
- **Verdict:** KILLED (broad pitch). Killing reply: "call createApp."
- **Kill test / first proof:** Reproduce an actual unsupported application against current worker-bundler and browser Rolldown; without it, stop.

#### 7. TypeScript 7 typechecking service in each DO
- **What:** Real diagnostics for generated code without a container.
- **How it would work:** v1: qualify a reduced/alternate build plus `.d.ts` source service for a bounded Code Mode profile.
- **Evidence / numbers:** [M] one-file default-lib fixture reached 110.5 MiB.
- **Prior art / who has it:** tsgo-wasm, ttsc, the JS compiler/VFS; Microsoft owns compiler support.
- **Verdict:** KILLED as default choice. Killing reply: "the JS compiler/VFS is smaller and faster here."
- **Kill test / first proof:** Compare exact diagnostics, total peak and latency against the JS compiler on real projects.

#### 8. Oxc/Biome/SWC Workers toolbox
- **What:** Lint, transform and format source in one endpoint.
- **How it would work:** v1: small upstream-compatible lint/format build or resolver adapter.
- **Evidence / numbers:** [M] Biome 59.8 MiB code / 73.4 MiB minimum; [F] Oxc resolver/lint/format request (2026-03-11).
- **Prior art / who has it:** published Oxc, Biome, SWC Wasm packages.
- **Verdict:** KILLED (new rewrite). Killing reply: "this is the existing playground package."
- **Kill test / first proof:** Identify an indispensable missing operation that published packages with a static-module adapter cannot supply.

#### 9. Tree-sitter native structural search in a DO
- **What:** Structural query across a workspace including syntax-error recovery.
- **How it would work:** v1: chunked file source + bounded parser/tree cache.
- **Evidence / numbers:** [F] Web Tree-sitter documents `Language.loadSync(precompiledModule)` for Workers/Vercel Edge; no concrete unmet Workers request found.
- **Prior art / who has it:** web-tree-sitter.
- **Verdict:** KILLED (generic port) — ship an example, not another engine. Killing reply: "instantiate web-tree-sitter."
- **Kill test / first proof:** Demonstrate a real query/corpus the existing binding cannot support within bounds.

#### 10. ripgrep for DO/R2 repositories
- **What:** Ordinary rg output over a repository without syncing it into a container.
- **How it would work:** v1: search crates + explicit file enumerator/stream source, no process spawning.
- **Evidence / numbers:** [I] Worker-native large-repo demand is inferred, not measured.
- **Prior art / who has it:** ripgrep-node (wasm32-wasip1), WASIX ports, JS shell grep implementations.
- **Verdict:** KILLED (generic port). Killing reply: "JS regex plus existing storage enumeration is sufficient."
- **Kill test / first proof:** Compare full-scan bytes/CPU/result parity with that baseline; a faster regex does not fix scanning every R2 object.

#### 11. Full-fidelity Office-to-PDF inside a Worker
- **What:** Word footnotes, tables and tracked changes keep layout in PDF without a browser/container.
- **How it would work:** Two weeks only establishes whether a Writer-only build meets size/memory/thread constraints.
- **Evidence / numbers:** [F] LibreOffice browser builds ~147–154 MB Wasm + 95–100 MB data; docx-to-pdf-wasm omits footnotes/endnotes, inconsistent track changes.
- **Prior art / who has it:** LibreOffice headless Emscripten, deepseek dsh-libreoffice-kit, docx-to-pdf-wasm, Vercel native LibreOffice.
- **Verdict:** KILLED (two-week commitment). Killing reply: "your first useful artifact takes months, or just use Vercel native LibreOffice."
- **Kill test / first proof:** Boot/export a representative corpus within the real Worker envelope before promising a library.

#### 12. Portable small-model inference in ordinary Workers
- **What:** VAD or a small embedding/classification model beside a request.
- **How it would work:** v1: one model-specific reduced-operator build with total-memory measurements.
- **Evidence / numbers:** [F] ORT Worker pipeline (Silero VAD) exists; [E] no resident LLM under 128 MB.
- **Prior art / who has it:** ORT discussion #27400, WebLLM, Transformers.js, Workers AI.
- **Verdict:** KILLED (generic runtime). Killing reply: "use Workers AI, native Functions, or the existing ORT workaround."
- **Kill test / first proof:** Show latency/cost/data-locality wins against all alternatives at equal quality.

#### 13. SQLite extensions/portable SQLite files in DOs
- **What:** Upload a SQLite file and query an extension missing from built-in SQLite.
- **How it would work:** v1: port exactly one demanded extension and a file/VFS adapter.
- **Evidence / numbers:** [I] no indispensable missing extension verified.
- **Prior art / who has it:** official SQLite Wasm, wa-sqlite, sql.js, native DO SQLite, D1.
- **Verdict:** KILLED (generic database). Killing reply: "this is already FTS/JSON in native SQLite."
- **Kill test / first proof:** Get a real failing query from an adopter before compiling anything.

#### 14. Headless Typst/resvg document/image service
- **What:** Generate a polished report/preview from typed data and render the same source in a tab.
- **How it would work:** Fix the particular wrapper in days, or build a domain template in two weeks.
- **Evidence / numbers:** [M] resvg passed locally; [F] typst.ts #716 is a rehype wrapper importing the native compiler (adapter bug).
- **Prior art / who has it:** typst.ts, cf-rendercv, resvg, Cloudflare Browser Run.
- **Verdict:** KILLED (broad pitch). Killing reply: "this is a template, not a missing runtime."
- **Kill test / first proof:** Require a concrete unsupported input/host behavior beyond existing modules.

#### Rejected in this report
- **New Git forge/pack server** — dgit and another DO/R2 smart-HTTP implementation cover it.
- **DuckDB in a Worker as the discovery** — ducklings and a JSPI range-read port already demonstrate it.
- **Python at the edge / generic Pyodide startup** — Cloudflare owns the integration and deploy-time snapshots.
- **Automatic TypeScript-native speedup at the edge** — the Wasm build exists; memory and Wasm performance need qualification.
- **ImageMagick "cannot run in Workers"** — current initialization/resize path passed locally.
- **General FFmpeg port or small-codec build** — FFmpeg-Wasm, libav.js, OpenClaw and upstream PRs overlap.
- **Basic DOCX-to-PDF or PDF text extraction** — Worker-oriented converters and toolkits ship.
- **WebLLM inside an ordinary Worker** — GPU host APIs and resident model memory prevent it.
- **New general component/POSIX runtime** — reuse jco and guest adapters; Nimbus occupies it.

### 05-agentweb: The agent web — missing joints, mostly occupied categories
Lens: agents as a new class of web user — delegated auth, identity, payments, readable sites, discovery/hosting, webhooks/inboxes, browser automation, consent/audit. Headline: Cloudflare/Vercel, identity vendors, payment providers and OSS already cover nearly every broad category ("OAuth/Stripe/inbox/Lighthouse for agents", "exactly-once MCP" are not defensible pitches); three contribution-sized integration gaps remain. The ONE pick is an **upstream-compatible Tenuo edge adapter with a site-owned delegation demo** (Tenuo's TS README explicitly excludes browsers, edge runtimes and Workers). Verdict: **go-with-changes as an OSS contribution; no-go on claiming an unoccupied, obviously viral standalone product.**

#### Finding: Delegated authorization is a stack, not one token
- **What:** Remote MCP hosting + `workers-oauth-provider` (2025-03-25), Auth0 for AI Agents GA (2025-09-25: Token Vault, async authorization, FGA), Cloudflare Managed OAuth for Access (2026); MCP auth revisions through 2026-07-28 (issuer validation, Client ID Metadata Documents, DCR deprecated); Tenuo task warrants (Rust/Python/beta TS) with an individual Internet-Draft dated 2026-10-26 and a separate attenuation-chain draft (2026-10-15).
- **How it would work:** Remaining gap [I]: connecting task-specific authorization to the application's actual execution boundary with clear ownership of roots, revocation and consumable approvals; `payments.write` cannot infer "refund this order".
- **Evidence / numbers:** [F] https://auth0.com/blog/announcing-auth0-for-ai-agents-powering-the-future-of-ai-securely/, https://github.com/tenuo-ai/tenuo, https://datatracker.ietf.org/doc/html/draft-niyikiza-oauth-attenuating-agent-tokens-02
- **Prior art / who has it:** Cloudflare, Auth0, Tenuo.
- **Verdict:** FINDING — generic broker/vault/approval service is occupied.
- **Kill test / first proof:** None given.

#### Finding: Agent identity already has cryptographic and platform support
- **What:** Web Bot Auth (Cloudflare 2025-05-15, Vercel 2025-08-12) with HTTP Message Signatures; official `web-bot-auth` npm package leaves atomic nonce replay rejection to the caller; from 2026-07-01 signed agents are represented as Direct vs Intermediary access metadata.
- **How it would work:** Remaining gap [I]: operator identity, a customer's delegation and authorization for a particular action are different facts.
- **Evidence / numbers:** [F] https://blog.cloudflare.com/web-bot-auth/, https://developers.cloudflare.com/bots/concepts/bot/verified-bots/
- **Prior art / who has it:** Cloudflare, Vercel.
- **Verdict:** FINDING.
- **Kill test / first proof:** None given.

#### Finding: Payments are not the open slot
- **What:** x402 Foundation (2025-09-23), Monetization Gateway beta (2026-09-30), Stripe Machine Payments Protocol (2026-03-18), Google AP2 (2025-09-16, 60+ orgs; v0.2.0 2026-04-28 adds Human Not Present), Stripe Agent Toolkit moving to hosted MCP.
- **How it would work:** Remaining gap [I]: application-specific settlement reconciliation, delivery and understandable records; AP2 already occupies "signed purchase consent receipt".
- **Evidence / numbers:** [F] https://blog.cloudflare.com/x402/, https://stripe.com/blog/machine-payments-protocol, https://github.com/google-agentic-commerce/AP2/blob/main/docs/ap2/specification.md
- **Prior art / who has it:** Cloudflare, Coinbase, Stripe, Google.
- **Verdict:** FINDING — platform territory.
- **Kill test / first proof:** None given.

#### Finding: Readable sites, discovery and hosting are distribution products
- **What:** `llms.txt` (2024-09-03, revised Aug 2026), Cloudflare Markdown for Agents, NLWeb (2025-05-19), AI Index (2025-09-26), official MCP Registry preview (2025-09-08), Vercel `mcp-handler` 2.3.0, Cloudflare stateless MCP in Workers (2026).
- **How it would work:** Remaining gap [I]: preserving correct content/action semantics, authorization and freshness through app changes.
- **Evidence / numbers:** [F] https://llmstxt.org/, https://blog.modelcontextprotocol.io/posts/2025-09-08-mcp-registry-preview/
- **Prior art / who has it:** Cloudflare, Microsoft, Vercel, MCP.
- **Verdict:** FINDING.
- **Kill test / first proof:** None given.

#### Finding: Webhooks and inboxes — durable delivery exists; protocol seams remain
- **What:** MCP Events SEP-3415 (opened 2026-10-05, open) defines poll, push, signed webhooks, opaque cursors, optional replay, explicit loss signaling; Hookdeck documents MCP Events forward proxying; Cloudflare's MCP implementation adapts notifications to webhooks only, excludes poll/push and sends no `gap` envelopes because ChatGPT doesn't support them; AgentMail has inboxes, polling webhooks for start/stop agents, IMAP/SMTP.
- **How it would work:** —
- **Evidence / numbers:** [F] https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3415, https://github.com/cloudflare/mcp/blob/main/docs/mcp-events.md, https://docs.agentmail.to/webhook-polling
- **Prior art / who has it:** Hookdeck, Cloudflare, AgentMail.
- **Verdict:** FINDING — narrow delivery-mode gap, not an empty category.
- **Kill test / first proof:** None given.

#### Finding: Browser automation and legitimate access are different layers
- **What:** Cloudflare Playwright GA + Stagehand (2025-09-25), Browser Run supports Stagehand 2.5.x but not v3+; browser-use; Vercel + Browserbase (2026-02-12) with Web Bot Auth; browser-use #356 (2025-01-23, 15 comments, 0 reactions, closed) agents stuck at Cloudflare verification; WebMCP (Chrome 2026), Cloudflare no-origin-change preview (2026-08-06) and server-tool-to-WebMCP adapter, MCP-B.
- **How it would work:** Better actuation does not grant permission.
- **Evidence / numbers:** [F] https://developers.cloudflare.com/browser-run/stagehand/, https://github.com/browser-use/browser-use/issues/356, https://blog.cloudflare.com/webmcp/
- **Prior art / who has it:** Cloudflare, Vercel, Browserbase, browser-use, MCP-B.
- **Verdict:** FINDING — "turn forms into agent tools" is occupied.
- **Kill test / first proof:** None given.

#### Finding: Consent, audit and site-owner understanding are crowded
- **What:** Signet (signed action/bilateral receipts, TS/MCP), Pipelock (mediated-traffic receipts), Agent Middleware (signed permits, uncertain-outcome records; no production deployments), EMILIA; AI Crawl Control GA (2025-08-28), Agent Readiness scanner (2026-04-17), RFC 9457 agent error pages (2026-03-11).
- **How it would work:** Remaining gap [I]: application-owned explanations distinguishing "denied", "not dispatched" and "may have happened".
- **Evidence / numbers:** [F] Cloudflare's filtered sample of the 200,000 most-visited domains: **3.9%** Markdown negotiation, fewer than 15 sites with MCP-card/API-catalog checks. https://blog.cloudflare.com/agent-readiness/, https://github.com/Prismer-AI/signet
- **Prior art / who has it:** Signet, Pipelock, Agent Middleware, EMILIA, Cloudflare.
- **Verdict:** FINDING.
- **Kill test / first proof:** None given.

#### Finding: Evidence that changes the ranking
- **What:** MCP #3394 (2026-09-27): lost-response reproduction gives two effects after one explicit retry vs one with a stable key (41 comments, 0 reactions); MCP idempotency PR #3182 closed with a reference implementation; A2A #1893 idempotency header closed/consolidated (8 comments, 0 reactions); `@lgolabs/idempotency-mcp` (one DO per key) and `@idempot/hono-middleware`; `effect-broker` (Python, SQLite/Postgres, MCP, unknown outcomes, crash demo, 68 passing / 11 skipped per author); Tenuo TS README excludes browsers/edge/Workers, builds with `wasm-pack --target nodejs`, uses `AsyncLocalStorage`, npm beta 0.3.3-beta.0 requires Node 20+; MCPJam Inspector, official Inspector roadmap, OpZero conformance; HN: MCP OAuth threads at 9 points/0 comments and 2 points/1 comment.
- **How it would work:** —
- **Evidence / numbers:** [F] https://github.com/modelcontextprotocol/modelcontextprotocol/issues/3394, https://github.com/prathamesh-git9/effect-broker, https://github.com/tenuo-ai/tenuo/blob/main/tenuo-ts/README.md
- **Prior art / who has it:** as listed.
- **Verdict:** FINDING — kills novelty of "one DO serializes agent retries", a general effect broker and an OAuth "doctor"; verifies the Tenuo runtime hole.
- **Kill test / first proof:** None given.

#### 1. A general delegated-auth broker
- **What:** Ask an agent to read a private wiki; sign in once and it obtains a scoped token.
- **How it would work:** v1 [E]: 2 weeks for one provider adapter.
- **Evidence / numbers:** [F] MCP auth revisions and interoperability investigations show compatibility work, no broker demand.
- **Prior art / who has it:** Auth0 Token Vault, Cloudflare Managed OAuth, Workers OAuth.
- **Verdict:** KILLED — platforms bundle it. Killing reply: "You rebuilt our sample."
- **Kill test / first proof:** Reject if an existing sample delivers the same flow with no missing policy surface.

#### 2. Supported task warrants on Workers and in the browser (Tenuo edge adapter)
- **What:** A user grants a travel/calendar agent authority over one action, narrows it for a child agent, and the site rejects a modified or overbroad request at its own Worker — via an upstream-compatible Tenuo `edge` entry point, not a new warrant format.
- **How it would work:** Same warrant bytes and Rust decisions; per-request sessions instead of ambient authority; Worker module loading for the Wasm; Hono middleware/example; minimal browser verifier; account authorization kept separate from task authority; one authoritative store for single-use approvals. Days 1–2 try the existing package with compatibility flags; days 3–6 qualify core, keys, time, encoding with upstream vectors; days 7–10 request-scoped Worker verifier + origin adapter; days 11–15 show browser/Node/Worker agreement, expiry, wrong audience/holder, argument widening, revoked root. Demo: grant to reschedule *this meeting*, narrower grant to a child, one permitted move succeeds, other meeting/principal/wider authority denied, site-issued record links action to grant.
- **Evidence / numbers:** [F] explicit unsupported-runtime boundary; core already Wasm. [I] no count of blocked developers; compatibility mode untested.
- **Prior art / who has it:** Tenuo (owns warrants and semantics).
- **Verdict:** KEPT (#1, the ONE pick) — Cool 3, Adjacent 5, Gap 4, Value 3, Survives 5, Not GrowOS 5 = **25**; wins the tie because its gap is explicit. Killing reply: "There is no adopter; this is just a packaging exercise for someone else's library, and our next beta already fixes it."
- **Kill test / first proof:** Within two days, one reproducible unsupported path and a concrete site action needing it; within two weeks, preserve all applicable upstream vectors, identical decisions on Node and workerd, a patch fit for upstream review. Stop if it needs a forked authorization language, no app benefits, or one compatibility flag gives the same result.

#### 3. Another signed-agent identity SDK
- **What:** Sign a fetch from a Worker; the receiving site recognizes the agent despite a changing IP.
- **How it would work:** v1 [E]: a week for an example and DO nonce cache.
- **Evidence / numbers:** [F] Cloudflare's announcement on brittle IP/UA identification; browser-use #356.
- **Prior art / who has it:** Cloudflare `web-bot-auth`, Vercel verification.
- **Verdict:** KILLED — both platforms ship it. Killing reply: "This is our npm README."
- **Kill test / first proof:** Reject if the official signer/verifier plus a replay store covers the demo.

#### 4. Universal agent payment gateway
- **What:** An agent hits HTTP 402, pays, and gets a useful API result.
- **How it would work:** v1 [E]: test-mode merchant adapter only.
- **Evidence / numbers:** [F] AP2 mandates/receipts; 60+ partners is interest, not payment demand.
- **Prior art / who has it:** x402, Stripe MPP, Cloudflare Monetization Gateway, AP2.
- **Verdict:** KILLED — platforms already shipping. Killing reply: "Use our official middleware."
- **Kill test / first proof:** Reject unless a named merchant workflow cannot be served by an existing SDK.

#### 5. Agent-readable website transformer
- **What:** A normal site returns clean Markdown, an `llms.txt` index and NLWeb answers.
- **How it would work:** v1 [E]: 1–2 weeks for a framework plugin.
- **Evidence / numbers:** [F] 3.9% negotiated Markdown in Cloudflare's sample.
- **Prior art / who has it:** Cloudflare Markdown/AI Index, NLWeb, documentation platforms.
- **Verdict:** KILLED. Killing reply: "Enable the existing setting."
- **Kill test / first proof:** Reject if a platform toggle or maintained plugin solves the owner's problem.

#### 6. A public MCP host and discovery registry
- **What:** Deploy a server, publish it, let a second agent discover and call it.
- **How it would work:** v1 [E]: adapter to one existing catalog.
- **Evidence / numbers:** [F] official Registry targets discovery.
- **Prior art / who has it:** MCP Registry, Cloudflare hosting, Vercel `mcp-handler`, gateway products.
- **Verdict:** KILLED. Killing reply: "Another list of servers."
- **Kill test / first proof:** Reject without a named missing metadata/ownership flow in the official API.

#### 7. Replayable MCP Events storage for intermittent agents
- **What:** Stop an agent, accumulate events, reconnect through a different delivery mode, and see recovered events plus an explicit retention gap.
- **How it would work:** DO-backed bounded event log plus an adapter for a pinned SEP-3415 revision: append-only event IDs, principal/event/filter-bound opaque cursors, bounded retention and payload size, loss signaling, signed webhook attempts, poll, TTL subscription teardown, example client storing cursor/projection; push only if it fits; at-least-once, never exactly-once. Demo: client sleeps through five changes, resumes once; sleeps past retention and gets explicit lost history; switches webhook → poll with dedup.
- **Evidence / numbers:** [F] Cloudflare's implementation lacks poll/push/gap; SEP-3415 lists official-SDK reference work outstanding.
- **Prior art / who has it:** Hookdeck, Svix, AgentMail polling, Cloudflare webhook adapter, SEP-3415.
- **Verdict:** RUNNER-UP (#3) — Cool 3, Adjacent 5, Gap 3, Value 3, Survives 5, Not GrowOS 5 = **24**; high risk of rapid upstream absorption. Killing reply: "The protocol is changing, and our queue integration already has cursors."
- **Kill test / first proof:** Compare Hookdeck/Svix and official extension paths first; stop if only a small schema mapping is missing; otherwise require resume, principal isolation, expiry, truncation, duplicate callback and mode-switch cases on local workerd; if no client can use the extra mode, publish a reference adapter only.

#### 8. Email inboxes for agents
- **What:** Create an inbox, send email, stop the agent, deliver after restart.
- **How it would work:** v1 [E]: one inbox-provider adapter.
- **Evidence / numbers:** [F] AgentMail documents ordering, retry and missed-event handling.
- **Prior art / who has it:** AgentMail, SMTP/IMAP.
- **Verdict:** KILLED — avoid becoming a mail operator. Killing reply: "Use an existing mailbox API."
- **Kill test / first proof:** Reject if the only distinction is the recipient being an agent.

#### 9. A legitimate-agent CAPTCHA bypass or special rate-limit lane
- **What:** Signed agents get an authorized route; anonymous automation is challenged.
- **How it would work:** v1 [E]: one-week opt-in route policy sample.
- **Evidence / numbers:** [F] browser-use #356 (15 comments).
- **Prior art / who has it:** Web Bot Auth, Verified Bots, BotID, Browserbase identity.
- **Verdict:** KILLED — site-owner permission cannot come from an SDK; no evasion product. Killing reply: "Your valid signature does not mean I want your traffic."
- **Kill test / first proof:** Reject without explicit site-owner enrollment.

#### 10. Cross-provider personal activity receipts
- **What:** "What my agent did": verify site-issued records and see which grant each action used.
- **How it would work:** v1 [E]: read-only viewer importing two existing formats with coverage labels.
- **Evidence / numbers:** [F/I] many implementations; no strong end-user demand for another standard.
- **Prior art / who has it:** Signet, AP2 receipts, Pipelock, EMILIA.
- **Verdict:** KILLED as standalone layer. Killing reply: "Your signature proves who asserted the record, not that the work occurred."
- **Kill test / first proof:** Reject if records are merely agent-authored claims without counterparty evidence.

#### 11. A2A-to-MCP universal bridge
- **What:** An A2A task delegates a tool call to an MCP service and returns its artifact.
- **How it would work:** v1 [E]: one explicit task/tool mapping.
- **Evidence / numbers:** [F] A2A launch (2025-04-09); A2A #1893 retry-identity concerns; agentgateway #3610.
- **Prior art / who has it:** A2A SDKs, agentgateway.
- **Verdict:** KILLED — lifecycle/auth semantics are not interchangeable. Killing reply: "Your bridge silently changes execution semantics."
- **Kill test / first proof:** Reject a universal claim unless the exact mapping is documented and needed by an adopter.

#### 12. Another browser automation framework
- **What:** An agent navigates a changing site using code plus natural language.
- **How it would work:** v1 [E]: a specific transport spike.
- **Evidence / numbers:** [F] Stagehand 3 / Browser Run incompatibility.
- **Prior art / who has it:** Stagehand, browser-use, Browser Run, Browserbase.
- **Verdict:** KILLED. Killing reply: "Our next integration release removes your project."
- **Kill test / first proof:** Reject unless upstream wants the adapter for a named unavailable feature.

#### 13. Lighthouse or analytics for agent traffic
- **What:** Paste a URL and see why agents cannot discover, authenticate, read or pay.
- **How it would work:** v1 [E]: framework-specific diagnostic view.
- **Evidence / numbers:** [F] Cloudflare's 2026 readiness scan.
- **Prior art / who has it:** Cloudflare Agent Readiness, AI Crawl Control, structured errors, MCPJam/Inspector.
- **Verdict:** KILLED. Killing reply: "A less complete version of our dashboard."
- **Kill test / first proof:** Reject if it cannot expose application authorization/effect evidence unavailable to the edge.

#### 14. Site-owned effect reconciliation on Workers
- **What:** Kill the executor after a remote action commits; recover one result when the target supports it and show an explicit unresolved outcome when it does not — a Workers/DO TypeScript port of effect-broker's state model.
- **How it would work:** Adapters for three target contracts (stable downstream idempotency, authoritative reconciliation, no safe recovery; local atomic only if sharing a transaction). Bind a client occurrence ID to principal, target, operation and argument digest (changed args = conflict); keep one downstream key and record its retention horizon; represent `unknown` after possible dispatch, never redispatch unsafe targets; "not found" conclusive only under a documented contract; no SQL transaction across a network call; authenticated status/receipt URL. Demo: three columns; disconnect after commit; idempotent and reconcilable recover, unsupported stays amber "may have happened; not sent again"; target's independent ledger shown.
- **Evidence / numbers:** [F] MCP #3394; Resend email idempotency (2025-05-01) with a 24-hour horizon. https://resend.com/changelog/idempotency-keys
- **Prior art / who has it:** effect-broker, Agent Middleware, LGO idempotency, Hono middleware, workflow engines.
- **Verdict:** RUNNER-UP (#2) — Cool 4, Adjacent 5, Gap 2, Value 4, Survives 5, Not GrowOS 5 = **25**; clearest failure demo but the same product exists in Python. Killing reply: "This is already effect-broker, and a DO port does not create demand."
- **Kill test / first proof:** Reproduce commit-before-receipt, concurrent duplicates, stale recovery, changed payloads and post-horizon retries against authoritative fixtures; keep only if a named Worker integration becomes substantially simpler and the port tracks upstream; otherwise contribute one adapter and stop.

#### 15. One action exposed through REST, MCP and WebMCP
- **What:** The human form, browser agent and remote agent invoke one operation with the same authorization and operation identity.
- **How it would work:** v1 [E]: one framework example on top of idea 2 or 14.
- **Evidence / numbers:** [F/I] no measured widespread dual-interface drift.
- **Prior art / who has it:** MCP-B, Cloudflare WebMCP adapter, framework action generators.
- **Verdict:** KILLED as broad generator — retained as the demo's implementation pattern. Killing reply: "This is three adapters calling the same function."
- **Kill test / first proof:** None beyond rejecting a new standard.

#### Finding: Boundaries that prevent false demos
- **What:** Six separate facts: operator identity, user delegation, application permission, occurrence identity, effect outcome, evidence and coverage.
- **How it would work:** A signature answers neither intent nor outcome; an OAuth token does not prove a specific action was approved; a model's "done" is not a target receipt; a DO cannot atomically include a remote service.
- **Evidence / numbers:** [I].
- **Prior art / who has it:** —
- **Verdict:** FINDING — why needs survive better models and why new universal protocols are a poor solo start.
- **Kill test / first proof:** None given.

#### Rejected in this report
- **Generic DO idempotency service** — LGO and existing middleware implement it; local serialization does not give remote exactly-once.
- **Universal effect broker** — effect-broker ships the unknown/reconciliation model; only a runtime port remains.
- **Origin work scheduling, agent resource GC, generic verification** — excluded by earlier rounds; not repackaged.

### 06-tooling: The TS/JS toolchain when agents write most of the code
Lens: what breaks or becomes the bottleneck in type checking, tests, builds, previews, supply chain, deploys, replay/observability, codemods, dependency bloat, monorepo tools and registries when agents run thousands of iterations. Headline: most of the lens is already owned by whoever owns the check (TS 7, Vitest `--changed`, npm v12 script defaults, cooldowns in all four package managers, free install firewalls, platform previews with eviction); what is not getting fixed is the **oracle** — agent-written tests are gameable and AI adoption tracks lower delivery stability. The ONE pick is **Replaygate**: record Workers production traffic at the binding boundary and replay base vs candidate in Dynamic Workers on every agent PR. Verdict: **go-with-changes, low confidence on demand** — run fidelity and signal kill tests before building beyond the recorder.

#### Finding: What breaks layer by layer, and who owns it
- **What:** Type checking (owned by Microsoft — TS 7.0 GA 2026-07-08); editor/agent diagnostics (covered by agent vendors and MCP servers); test selection (Vitest building it; killed); previews (platforms evict; preview *data* is the hole); hallucinated names (vendors); worms (npm v12 + cooldowns); deterministic serverless replay (**narrow gap on Workers**); observability explaining agent code (spec backers; killed); codemods (owned); dependency bloat (**narrow gap for the per-project tail**); monorepo tools (Nx, Vercel); registries (vlt, Deno/Cloudflare).
- **How it would work:** —
- **Evidence / numbers:** [F] TS 7: VS Code 125.7 s → 10.6 s, Sentry 139.8 → 15.7 s, Slack CI 7.5 → 1.25 min, Canva first-error 58 s → 4.8 s, `--checkers 8` 10.6–16.7×; Prisma 74 → 24 s. Vitest 5 `AffectedModulesResolver` had five silent-skip bugs filed 2026-10-13/14; coverage-based TIA request #6735 has 4 reactions. Vercel 100 deploys/day Hobby, 6,000 Pro; Cloudflare Previews 500/Worker, fresh DO namespace but D1/KV/R2 shared unless separately bound. 19.7% of 576k generated samples referenced non-existent packages (USENIX Sec 2025); Shai-Hulud 500+ then 796 packages; TanStack (2026-05-11) 84 versions in 6 min **with valid provenance**, detected in 26 min; Aug 2026 waves ~2,200 versions; npm v12 makes lifecycle scripts/git deps opt-in (2026-07-07). Keploy 18.9k★, Tusk Drift 172★, Meticulous backend R&R (2026-07-06), Speedscale MCP; flaredump 1★ (2026-10-25). Socket: agents pull ~50% more deps (2nd-hand); 50.6% of 50,488 CJS deps bloated; Ding & Stevens: LLM stdlib-only modules median 31 KB vs 700 KB. DORA 2024: −7.2% stability per 25% AI adoption; ImpossibleBench: GPT-5 modified tests on 54% of Conflicting-SWE-bench tasks. https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/, https://tanstack.com/blog/npm-supply-chain-compromise-postmortem, https://arxiv.org/abs/2510.20270
- **Prior art / who has it:** Microsoft, Vitest, Datadog, Nx, Socket, Aikido, Replit, npm, pnpm, Yarn, Bun, Keploy, codemod.com, vsr, vlt, JSR.
- **Verdict:** FINDING — a 1-day cooldown alone would have avoided TanStack for consumers [I]; agent loops break stability, not speed.
- **Kill test / first proof:** None given.

#### Finding: The dependency trust surface an agent buys (measured)
- **What:** Lockfile packages, publish-capable accounts, provenance and small leaves for two stacks.
- **How it would work:** `npm install --ignore-scripts` in `/tmp/deep-tooling`, registry `maintainers`/`_npmUser`/`dist.attestations` per exact version, matched against e18e manifests.
- **Evidence / numbers:** [M] "Agent-default" Express API (15 direct deps): 117 packages (23 MB), **147** accounts can publish into the tree, 35 publishers, **12/115 (10%)** with provenance, 43 small leaves = 3,818 LOC (**1.4%** of 270,719), **69 of 147 (47%)** accounts reachable only via small leaves. Modern Workers stack (hono, zod, drizzle, ai, jose…): 24 packages, 51 accounts, 6 publishers, **20/24 (83%)** provenance, 3 small leaves. e18e matched 34/117 names (many "preferred alternative", not drop-in). `ms` alone lists 55 maintainers.
- **Prior art / who has it:** e18e module-replacements.
- **Verdict:** FINDING — modern stacks are already lean; the problem is which stack the agent picks, fixable by an `AGENTS.md` line, which weakens Absorb.
- **Kill test / first proof:** None given.

#### 1. Replaygate — production traffic as the regression oracle for agent changes on Workers
- **What:** A Worker wrapper records sampled production requests plus every nondeterministic input at the binding boundary; a GitHub check replays thousands against base and candidate builds in Dynamic Workers and reports which real requests now behave differently.
- **How it would work:** (1) `withRecorder(handler, {sample, redact})` Proxies KV, D1, R2, service bindings, DO stubs, global `fetch`, and shims `Date.now`, `Math.random`, `crypto.randomUUID/getRandomValues`; NDJSON traces in the user's R2; (2) a replay host loads base/head via Worker Loader with `globalOutbound` → replay entrypoint and `env` from replay stubs; (3) diff engine normalises headers/JSON, compares status, body and binding-call sequence, first unseen binding call = divergence; (4) GitHub Action top-N report + Vitest export. Out of v1: DO state forks, write-heavy flows, Queues/cron. Demo: agent "refactors" a pricing Worker, tests pass; replay of 10,000 requests in ~1,000 Dynamic Workers shows 312 (3.1%) with a different `total` (`POST /checkout`, coupon `SPRING`, 41.90 → 49.90) [E].
- **Evidence / numbers:** [F] Workers replay is tractable: all I/O through `env` and `fetch`, clock frozen during compute, Dynamic Workers control bindings and `globalOutbound: null` (2026-03-24). [I] serving recorded RPC stubs as `env` is inferred, not tested. Pain indirect (DORA, ImpossibleBench); **no Workers-specific request found**. https://developers.cloudflare.com/changelog/post/2026-03-24-dynamic-workers-open-beta/, https://github.com/kanchingyg/flaredump
- **Prior art / who has it:** Keploy (eBPF, 18.9k★), Tusk Drift (Node, 172★), Meticulous, Speedscale, Twitter Diffy (2015), shadow traffic; flaredump (failures only, 1★, 3 days old); Workers Versions/gradual deployments, Tail Workers (no bodies).
- **Verdict:** KEPT (#1, the ONE pick) — Cool 4, Adjacent 5, Gap 3, Value 3, Survives 5, Not GrowOS 5 = **25**; the oracle is reality, ungameable by editing tests; a port of a known category; Cloudflare might add a "replay against version" button later, so ship a library + Action they would adopt. Killing reply: "Recording production bodies is a privacy non-starter… every real refactor shows up as noise."
- **Kill test / first proof:** (a) Fidelity: replay unchanged code on 3 open-source Workers apps — stop if <98% reproduce byte-identical normalised responses; (b) Signal: of 10 historical regressions their tests missed, stop if <5 are flagged or noise on 10 benign refactors >20%; (c) Privacy: stop if redaction-by-default makes most bodies unreplayable. First test that Dynamic Workers `env` accepts arbitrary RPC stubs.

#### 2. Absorb — owned code for the dependency tail, with differential equivalence and ancestry
- **What:** For each small leaf dependency an app actually calls, an agent writes the minimal owned implementation of the used API; a harness fuzzes old vs new on recorded and generated inputs (old package in a network-less Dynamic Worker); emits CycloneDX `pedigree.ancestors` and watches OSV advisories for the ancestor.
- **How it would work:** Demo: `npx absorb` on an Express API: 117 → 74 packages, accounts 147 → 78, 3,818 LOC replaced by ~900 owned LOC [E], 40k differential cases agree, SBOM keeps "derived from ms@2.1.3".
- **Evidence / numbers:** [M] §2 stack measurement; [F] agentpatterns.ai (2026-07-06) names dependency inlining provenance loss as an anti-pattern; Python analogue removes 88 transitive deps from 128 PyPI accounts. https://arxiv.org/abs/2605.21405, https://socket.dev/features/optimize
- **Prior art / who has it:** e18e module-replacements + CLI, Socket Optimize (~130 curated overrides), Vendetect.
- **Verdict:** RUNNER-UP (#3 by total) — Cool 4, Adjacent 2, Gap 4, Value 3, Survives 3, Not GrowOS 5 = **21**; pays off mainly on legacy stacks agents still pick; Cloudflare/Vercel would not ship it, e18e or Socket might adopt. Killing reply: "You are forking the ecosystem… most of `node_modules` is dev tooling you cannot absorb."
- **Kill test / first proof:** On 20 agent-generated public repos, stop if the median removes <15% of runtime packages, or the differential harness passes code a full test suite then fails in >2% of cases.

#### 3. Preview data overlays
- **What:** Per-preview bindings that read through to a frozen production snapshot and write to an isolated layer (KV/R2 prefix overlay; D1 export-at-bookmark plus lazy copy), so 1,000 agent previews see realistic data without copying or writing to prod.
- **How it would work:** —
- **Evidence / numbers:** [F] Cloudflare Previews isolate DO namespaces but not D1/KV/R2.
- **Prior art / who has it:** Neon, PlanetScale, Supabase branching.
- **Verdict:** RUNNER-UP (#2 by total) but effectively KILLED — Cool 3, Adjacent 5, Gap 2, Value 3, Survives 4, Not GrowOS 5 = **22**; exactly the feature Cloudflare will ship next to Previews; production PII in previews is a liability; kept only as a possible Replaygate state layer.
- **Kill test / first proof:** None given.

#### 4. Shared content-addressed type-check cache (weak)
- **What:** Per-file diagnostics keyed by (file hash, imported `.d.ts` hashes, tsconfig hash) with isolatedDeclarations, on R2, shared across all agent worktrees and branches.
- **How it would work:** —
- **Evidence / numbers:** [F/I] TS 7 left little pain below Slack scale; tsbuildinfo does local incremental checks; Nx/Turbo caches ship it between machines.
- **Prior art / who has it:** tsbuildinfo, Nx, Turborepo, Bazel `rules_ts` `isolated_typecheck`.
- **Verdict:** NARROWED (weak) — Cool 3, Adjacent 3, Gap 2, Value 2, Survives 4, Not GrowOS 5 = **19**.
- **Kill test / first proof:** None given.

#### 5. Install firewall Worker for agent sandboxes
- **What:** Cooldown, existence check, script and capability diff at install.
- **How it would work:** —
- **Evidence / numbers:** —
- **Prior art / who has it:** Socket Firewall Free, Aikido safe-chain, npm v12 defaults, cooldown flags, Replit default-on firewall.
- **Verdict:** KILLED — owned.
- **Kill test / first proof:** None given.

#### 6. Hallucinated-name guard or pre-registration
- **What:** Block or pre-register package names agents hallucinate.
- **How it would work:** —
- **Evidence / numbers:** [F] 19.7% hallucinated references; react-codeshift spread across 237 repos (2nd-hand).
- **Prior art / who has it:** Socket, Aikido, Replit.
- **Verdict:** KILLED — same owners; shrinks as models improve.
- **Kill test / first proof:** None given.

#### 7. Coverage-based test impact analysis for Vitest
- **What:** Select tests by coverage on each iteration.
- **How it would work:** —
- **Evidence / numbers:** [F] #6735, 4 reactions.
- **Prior art / who has it:** Vitest `--changed`, Datadog TIA, Nx affected.
- **Verdict:** KILLED — owner is building it; low demand.
- **Kill test / first proof:** None given.

#### 8. One tsgo server for N worktrees
- **What:** Overlay snapshots and shared memory across worktrees.
- **How it would work:** —
- **Evidence / numbers:** [I] no measured pain.
- **Prior art / who has it:** Microsoft TS 7.1 snapshot API.
- **Verdict:** KILLED.
- **Kill test / first proof:** None given.

#### 9. Span → Agent Trace → prompt join
- **What:** "Why does this code exist" by joining production spans to the prompt that wrote the line.
- **How it would work:** —
- **Evidence / numbers:** [F] Agent Trace spec (Cursor, 2026-01-29) backed by Cloudflare, Vercel, Cognition, git-ai; git-ai 2.9k★; Entire CLI 5.3k★.
- **Prior art / who has it:** Entire, Sentry, git-ai, spec backers.
- **Verdict:** KILLED — a feature for them, not a project.
- **Kill test / first proof:** None given.

#### 10. Maintainer-side publish monitor
- **What:** Diff each publish against the git tag and last version and page the owner.
- **How it would work:** —
- **Evidence / numbers:** [F] TanStack had "No internal alerting".
- **Prior art / who has it:** npm staged publishing with 2FA approval, Socket alerts.
- **Verdict:** KILLED.
- **Kill test / first proof:** None given.

#### 11. Per-package isolates on Workers
- **What:** Each dependency in its own Dynamic Worker talking over Cap'n Web.
- **How it would work:** —
- **Evidence / numbers:** [I] per-call RPC breaks fine-grained libraries (identity, prototypes, sync calls); worm payloads run at install time, not in prod Workers.
- **Prior art / who has it:** LavaMoat (1.2k★).
- **Verdict:** KILLED.
- **Kill test / first proof:** None given.

#### 12. Distributed tsgo across 1,000 Workers
- **What:** Fan type-checking out across Workers.
- **How it would work:** —
- **Evidence / numbers:** [I] after TS 7 the work is CPU-bound native; Go→Wasm is slower; lib `.d.ts` re-parsed per isolate; a 16-core box with `--checkers` wins.
- **Prior art / who has it:** TS 7 `--checkers`.
- **Verdict:** KILLED.
- **Kill test / first proof:** None given.

#### 13. Agent-scale codemod fleet runner
- **What:** Run 10k-file migrations by agent fleets.
- **How it would work:** —
- **Evidence / numbers:** —
- **Prior art / who has it:** codemod.com Butterflow, Moderne/OpenRewrite, ast-grep, Grit.
- **Verdict:** KILLED.
- **Kill test / first proof:** None given.

#### 14. R2 remote cache / edge registry
- **What:** Build cache or package registry on R2/Workers.
- **How it would work:** —
- **Evidence / numbers:** [F] vsr on Workers 253★; vlt 1.0 hosted registries.
- **Prior art / who has it:** vsr, Turborepo caches, vlt, JSR.
- **Verdict:** KILLED — exists.
- **Kill test / first proof:** None given.

#### Rejected in this report
- **Preview GC** — platforms evict (Cloudflare: 500/Worker, oldest first); killed in earlier rounds as lease/GC.
- **LSP diagnostics daemon for agents** — small feature gap covered by `cli-lsp-client`, `ts-lsp-mcp` and agent vendors.
