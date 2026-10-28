# 02 — Primitives: what only became possible in 2025–2026, and which combinations nobody has assembled

Lens: new capabilities. Part 1 is a dated map of the Cloudflare and Vercel primitives (plus the browser and local-first
pieces) that launched or changed substantially between 2025-01 and 2026-10-28. Part 2 searches for **combinations of 2–4
primitives** that unlock something new, the way Firebase was "database + auth + hosting" assembled for one new audience.
Each combination is checked against GitHub, npm, product changelogs and papers.

Labels: **F** sourced (link), **M** measured here (scratch `/tmp/deep-primitives/`, deleted at the end), **I** inference,
**E** estimate. Dates are publication dates of the primary source. Today is 2026-10-28.

## Part 1 — dated map (2025-01 → 2026-10-28)

### 1.1 Cloudflare

| Date | Primitive | What changed (one line) | Source |
|---|---|---|---|
| 2025-01-29 → | **Agents SDK** (`cloudflare/agents`, 5.9k★) | Agent = Durable Object with state, scheduling, WebSockets, MCP client/server; `useAgent` client hook | F [repo](https://github.com/cloudflare/agents) |
| 2025-04-07 | **DO SQLite GA** + **sync KV** | SQLite-backed DOs GA, 10 GB per object, PITR; synchronous `ctx.storage.kv` exists only on SQLite-backed classes | F [changelog](https://developers.cloudflare.com/changelog/2025-04-07-sqlite-in-durable-objects-ga), [storage API](https://developers.cloudflare.com/durable-objects/api/storage-api) |
| 2025-04-07 | **Workflows GA** | Durable steps/sleep/waitForEvent on Workers | F [Workflows](https://developers.cloudflare.com/workflows/) |
| 2025-04 | **R2 Data Catalog** (Iceberg), **Pipelines**, later **R2 SQL** (2025-09) | Managed Iceberg on R2; renamed **Basin** Catalog/Pipelines/SQL at Basin GA 2026-10-01 | F [Basin GA changelog](https://developers.cloudflare.com/changelog/post/2026-10-01-basin-ga/), [The Register](https://www.theregister.com/a/5300618) |
| 2025-06-24 | **Containers** (beta) + **Sandbox SDK** | DO-addressed Linux containers on Workers | F [Containers beta](https://blog.cloudflare.com/containers-are-available-in-public-beta-for-simple-global-and-programmable) |
| 2025-07-01 / 05-15 / 08-28 | **Pay Per Crawl**, **Web Bot Auth**, **signed agents** | HTTP 402 for crawlers; HTTP message signatures identify bots/agents | F (earlier rounds: [flip](../flip/), [product](../product/)) |
| 2025-09-22 | **Cap'n Web** (4.0k★) | Object-capability RPC for browser↔Worker with promise pipelining, ~10 kB | F [blog](https://blog.cloudflare.com/capnweb-javascript-rpc-library/), [repo](https://github.com/cloudflare/capnweb) |
| 2025-09-23 | **x402 Foundation** (with Coinbase) | Open HTTP-402 payment standard | F [The Defiant](https://thedefiant.io/news/defi/cloudflare-monetization-gateway-x402-stablecoin-payments) |
| 2025-09-26 | **Code Mode** + **Worker Loader** (closed beta) | LLM writes TypeScript against tool APIs; runs in a fresh isolate | F [Code Mode](https://blog.cloudflare.com/code-mode/) |
| 2025-11-21 | **Containers active-CPU pricing** | CPU billed on use ($0.00002/vCPU-s); memory/disk still provisioned | F [changelog](https://developers.cloudflare.com/changelog/2025-11-21-new-cpu-pricing/) |
| 2026-02-20 | **Code Mode MCP** + `@cloudflare/codemode` 0.1 | "entire API in 1,000 tokens"; runtime-agnostic rewrite | F [changelog](https://developers.cloudflare.com/changelog/2026-02-20-codemode-sdk-rewrite) |
| 2026-03-24 | **Dynamic Workers** open beta | `LOADER.load/get(code)`, ms startup, `globalOutbound: null` | F [blog](https://blog.cloudflare.com/dynamic-workers/) |
| 2026-04-13 | **DO Facets in Dynamic Workers** | A runtime-loaded class gets its own DO + isolated SQLite under a supervisor DO | F [blog](https://blog.cloudflare.com/durable-object-facets-dynamic-workers/) |
| 2026-04-13 | **Containers + Sandboxes GA** | | F [changelog](https://developers.cloudflare.com/changelog/2026-04-13-containers-sandbox-ga) |
| 2026-04 (Agents Week, recap 04-20) | **Project Think** (`@cloudflare/think`: fibers, sub-agents via Facets), **Browser Run** (was Browser Rendering: live view, CDP, recordings, 4× concurrency), **Email Service** beta, **Agent Memory**, **AI Search**, **Outbound Workers for Sandboxes** (credential-injecting egress), **Workflows v2** (50k concurrency), **Mesh**, **Managed OAuth for Access**, **Artifacts** (git-speaking FS) private beta, **Flagship** flags, **Registrar API**, **Voice for agents** | | F [recap](https://blog.cloudflare.com/agents-week-in-review/), [Project Think](https://blog.cloudflare.com/project-think/) |
| 2026-05-01 | **Dynamic Workflows** | ~300-line lib: tenant/agent-written `run(event, step)` code as real Workflows | F [blog](https://blog.cloudflare.com/dynamic-workflows/) |
| 2026-07-01 → 08 | **Monetization Gateway** (x402, closed beta) + **Cloudflare Wallets** | Sell any resource per request to agents in USDC; agent wallets | F [blog](https://blog.cloudflare.com/monetization-gateway/), [InfoQ](https://infoq.com/news/2026/07/cloudflare-aws-x402-micropayment/) |
| 2026-08 | **Kitesurf** | Agent browser that runs **entirely on Workers** (Boa JS + Wasm DOM); 730k WPT subtests by 09-28; WebMCP; open source "coming soon" | F [update](https://blog.cloudflare.com/kitesurf-update/) |
| 2026-08-03 | **Cloudflare Computer** (`cloudflare/computer`, 9.7k★) | DO-SQLite workspace FS, just-bash in Dynamic Workers, container FUSE sync, gated/audited tools | F [blog](https://blog.cloudflare.com/cloudflare-computer/) |
| 2026-08 / 10-09 | **celld** (Deno, Rust, self-hosted distributed DOs, 6.2k★) → **Deno joins Cloudflare**, celld merges into workerd | "one binary … object storage as its only external dependency" | F [blog](https://blog.cloudflare.com/deno-joins-cloudflare/), [repo](https://github.com/denoland/celld) |
| 2026-09-28 → 10-02 (Birthday Week, 46 items) | **cf CLI**, **Vinext 1.0**, **VoidZero at Cloudflare**, **native Rust (Emscripten) in Workers**, **rebuilt Containers** (median TTI 4.05 s → 0.648 s, filesystem snapshots beta, 100k containers in 5.4 s), **Monetization Gateway beta**, **Pay Per Use**, **AI Gateway Auto Router**, **Issues** (errors → coding agents), **Basin GA**, **Artifacts open beta** (+ git-platform contest, billing from 2026-10-15), **K2** (ordered event streams on R2, $0.04/GB), **Cloudflare OS** (managed agent workspace, waitlist), **Workers KV Instant**, **AI Search GA**, **Web Search API** | | F [wrap-up](https://blog.cloudflare.com/birthday-week-2026-wrap-up/), [faster sandboxes](https://blog.cloudflare.com/faster-agent-sandboxes/), [K2](https://blog.cloudflare.com/cloudflare-k2-streams/), [Artifacts](https://blog.cloudflare.com/next-git-platform-on-cloudflare/) |
| 2026-10-20 | **tsrs** (TypeScript compiler ported to Rust, Oxc; `@tsrs/wasm`) | up to 8× faster than TS 7.0 checker; Wasm-portable | F [blog](https://blog.cloudflare.com/typescript-rust-port/) |
| 2026-10-21 | **WebMCP for commerce** (with Commerce.com) | Storefronts expose WebMCP tools to agents | F [blog](https://blog.cloudflare.com/webmcp-commerce/) |

### 1.2 Vercel

| Date | Primitive | What changed | Source |
|---|---|---|---|
| 2025-02-04 / 06-25 | **Fluid compute** / **Active CPU pricing** | In-function concurrency; bill CPU only while code works | F [Fluid](https://vercel.com/blog/introducing-fluid-compute), [Active CPU](https://vercel.com/blog/introducing-active-cpu-pricing-for-fluid-compute) |
| 2025-05-20 / 08-21 | **AI Gateway** beta / GA | One endpoint, hundreds of models, failover | F [GA](https://vercel.com/blog/ai-gateway-is-now-generally-available) |
| 2025-06-25 → 2026-01-30 | **Sandbox** beta → **GA**; snapshots (2026-04-02); all regions | Firecracker microVMs for untrusted code | F [GA](https://vercel.com/blog/vercel-sandbox-is-now-generally-available), [snapshots](https://vercel.com/blog/optimizing-vercel-sandbox-snapshots) |
| 2025-07-31 / 12-22 / 2026-06-25 | **AI SDK 5 / 6 / 7** | Typed UI messages, agents, harness programming | F [5](https://vercel.com/blog/ai-sdk-5), [6](https://vercel.com/blog/ai-sdk-6), [7](https://vercel.com/blog/ai-sdk-7) |
| 2025-08-11 / 2026-02-03 / 08-05 | **v0.app** / new v0 / new v0 API | Agentic app builder; platform API | F [v0.app](https://vercel.com/blog/v0-app), [API](https://vercel.com/blog/introducing-the-new-v0-api) |
| 2025-09-12 | **x402-mcp** | Paid MCP tools over x402 | F [blog](https://vercel.com/blog/introducing-x402-mcp-open-protocol-payments-for-mcp-tools) |
| 2025-10-23 | **Workflow DevKit** (`vercel/workflow`, 2.5k★), **Queues** beta, **Vercel Agent** | `"use workflow"`/`"use step"` compiled durable functions | F [blog](https://vercel.com/blog/introducing-workflow) |
| 2025-12-23 → | **just-bash** (4.4k★) | Bash interpreter in TS over a virtual FS, for agents | F [repo](https://github.com/vercel-labs/just-bash), [eval](https://vercel.com/blog/testing-if-bash-is-all-you-need) |
| 2026-03-06 → | **quickjs-wasi** (152★) | Snapshotable QuickJS-NG in Wasm (taken idea, see earlier rounds) | F [repo](https://github.com/vercel-labs/quickjs-wasi) |
| 2026-06-17 / 06-20 | **Vercel Connect** (short-lived task-scoped tokens), **eve** (agent framework), **Agent Stack** | | F [Agent Stack](https://vercel.com/blog/agent-stack) |
| 2026-06-30 | **Vercel Services**, **any Dockerfile** | Full-stack + containers | F [blog](https://vercel.com/blog/dockerfile-on-vercel) |
| 2026-07-07 | **Better Auth** acquired | Auth as an open-source primitive | F [blog](https://vercel.com/blog/vercel-acquires-better-auth) |
| 2026-08-25 | **Run SDK** (`vercel-labs/run`, 109★) | QuickJS `eval` replacement; host functions; interrupt → signed token → resume by replay | F [blog](https://vercel.com/blog/introducing-run) |
| 2026-08-27 | **Workflow SDK** v5 beta: "the best workflow engine is a programming language"; swappable "Worlds" (Postgres, Redis, CF Queues…) | | F [blog](https://vercel.com/blog/the-best-workflow-engine-is-a-programming-language) |
| 2026-09-01 | **Fluid images** (VHS boot format), **Hive** | Your container image, ms boot, across functions/sandboxes | F [blog](https://vercel.com/blog/fluid-compute-takes-any-shape) |
| 2026-10-15 (Ship 2026) | **Drives GA** (mountable, forkable, 1–16 TiB, shared/read-only mounts), **Python GA**, **Containers** beta, **Daemons** beta | | F [Drives](https://vercel.com/blog/introducing-vercel-drives-persistent-storage-for-agents), [backends](https://vercel.com/blog/backends-on-vercel-python-containers-and-daemons) |
| 2026-10-19 | **durable-harness** (263★) | Crash recovery for Pi/OpenCode/Codex/Claude Code via a step log on Workflow Worlds | F [blog](https://vercel.com/blog/making-every-harness-durable) |

### 1.3 Browser and local-first (the "other end" of every combination)

| Date | Primitive | Status | Source |
|---|---|---|---|
| 2025-07 → 11-25 | **WebGPU in all four engines** (Chrome/Edge 113+, Firefox 141 Win / 145 macOS ARM, Safari 26) | Linux/Android Firefox still in progress | F [web.dev](https://web.dev/blog/webgpu-supported-major-browsers) |
| 2025-12-16 | **DuckDB-Wasm reads/writes Iceberg REST catalogs in a tab** (works with R2 Data Catalog/Basin) | shipped | F [DuckDB](https://duckdb.org/2025/12/16/iceberg-in-the-browser.html) |
| 2026-05-05 | **Chrome Prompt API** (Gemini Nano, ~4.3 GB) in Chrome 148 | contested; Mozilla/WebKit oppose; Edge disabled | F [Chrome docs](https://developer.chrome.com/docs/ai/prompt-api) |
| 2026-06-02 | **WebMCP** origin trial, Chrome 149 (`document.modelContext`) | no browser ships it to all users | F [spec repo](https://github.com/webmachinelearning/webmcp), [support guide](https://www.mcpbundles.com/guides/webmcp-browser-support) |
| ~2026-06 | **Zero 1.0** (Rocicorp) | stable sync engine | F [InfoQ](https://infoq.com/news/2026/06/zero-version-1) |
| 2026-06-16 / 06-26 / 08-11 | **Electric Agents 0.6** (durable, resumable, forkable agents on sync), **Durable Streams**; Electric joins Neon at Databricks; PGlite 10 M weekly downloads | | F [electric.ax](https://electric.ax/) |
| 2026-03-12 → | **panproto** (84★, Rust + TS/Wasm): schema diff, lens generation, lens DSL, law checks, schema VCS, `applyToFleet`, ATProto lexicons | active (pushed 2026-10-27) | F [repo](https://github.com/panproto/panproto) |
| ongoing | LiveStore (3.7k★), TinyBase (5.2k★), Automerge (6.7k★), Loro (6.3k★), new Jazz relational DB (2026-01) | | F GitHub API, 2026-10-28 |

### 1.4 What the map says (I)

1. **Both vendors converged on the same stack in 18 months:** model gateway + durable execution + disposable code
   execution (isolate *and* microVM) + persistent agent storage + scoped credentials + payments. Every single-primitive
   gap from 2025 (Code Mode runtime, durable agents, agent git, agent FS, agent browser, agent payments) is now a
   first-party product. Single-primitive ideas are dead on arrival.
2. **The genuinely new capability classes since 2025 are:** (a) *code you did not write, loaded per request, with its own
   database* (Dynamic Workers + Facets, 2026-03/04); (b) *versioned everything at agent scale* (Artifacts, Drives forks,
   container snapshots, DO PITR); (c) *the browser as a peer* (WebGPU everywhere, WebMCP, Prompt API, Iceberg-in-a-tab,
   Cap'n Web); (d) *a browser that is itself a Worker* (Kitesurf); (e) *self-hostable Workers model* (celld → workerd).
3. **What neither vendor sells:** anything that spans *both* vendors, *the user's device*, or *other people's data
   models*. Combinations that need the user's browser, local-first data, or cross-app schemas are where a side project
   is not competing with a roadmap (lesson b).

## Part 2 — combinations

### 2.1 Method

I generated 16 combinations of 2–4 primitives from Part 1. Each one includes at least one primitive that did not exist
before 2025 and, where possible, one from the browser or local-first column (§1.4, point 3). I checked each against
GitHub (`gh search`, `gh api`), npm, product docs, changelogs and arXiv. For six of them, three parallel search
passes ran about 180 queries in total. Their results are summarised and cited below.

Two local measurements (M) were taken in `/tmp/deep-primitives/` (Node 22, `@panproto/core` 0.76.1):
- **Automatic lens generation does not infer intent.** `panproto.lens(old, new)` on a `text → content` rename returned
  the view `{"text":"hello"}` unchanged. On a `name → first,last` split it also passed the record through untouched.
  `diff()` reports the rename as one vertex removed and one added.
- **An authored lens works.** A one-step DSL document (`rename_field text→content`) produced `{"content":"hello"}` and
  put back `{"text":"hello"}`.
- **What this means:** structural engines need someone to write the intent, whether a human or an agent. The Wasm
  binary is 9.96 MB raw and 2.45 MB gzipped, which fits a Worker bundle.

### 2.2 The 16 combinations (one line each, with verdict)

| # | Combination (primitives) | What it would unlock | Closest prior art (checked) | Verdict |
|---|---|---|---|---|
| **A** | Dynamic Workers + DO Facets / local-first sync + panproto lenses + model-written lens DSL | Forks or remixes of a generated app keep reading and writing **the same records**, with each fork's schema change gated by lens laws and replay | Jazz v2 lenses (rename/add/drop/bijection only, one admin catalogue); panproto (engine, no authoring); Cambria (dormant); Lexicon Community lens proposal (discussion) | **Partially open → deep dive** |
| **B** | Artifacts fork + Dynamic Worker per attempt + copy-on-write SQLite fork per Facet | 50–200 agent attempts, each a live URL running on its own fork of the real data | VibeSDK "space" (per-branch Facet, but the DB starts empty); Replit Agent 4 (about 10 parallel copies); Freestyle and Morph VM forks; Neon branch per preview | **Partially open → deep dive** |
| **L** | DO programming model + SQLite-in-OPFS + workerd/celld + single-writer lease | A per-user Durable Object (agent, notes app) **moves into the user's tab** while they are there (offline, 0 ms) and back to the edge when they leave | Solid Objects (42★, DO-style actors in the tab, no move to Cloudflare); TinyBase/LiveStore DO sync (data replication, not actor move) | **Partially open → deep dive** |
| R | Artifacts commit + DO PITR bookmark + Workflow state bound into one version | Atomic rollback or fork of a running app (code + data + in-flight work) | Replit App History on Neon (2025-05-21); Fly Sprites checkpoints; Canon (contest entry) | Partially taken. Rewinding production data destroys later user writes, so ops teams forward-fix instead |
| C | Agents SDK DO brain + Cap'n Web + browser tab tools (FS Access, WebContainer, WebGPU) | Hands on the user's machine at zero server compute | Cloudflare Agents client tools + resume-on-reconnect (2026-04→06), `examples/codemode-browser` (2026-05-06), bolt.new | Taken. Sandboxes cost about $0.08/vCPU-h against dollars of model spend, so compute is not the bill |
| D | Local-first replica + QuickJS-Wasm in the tab + schema-only cloud model (quarantined results) | The agent works on private data the model never sees | CaMeL, FIDES, Anthropic code-execution-with-MCP (2025-11-04), PandasAI `enforce_privacy`, DBeaver metadata-only | Components taken. Every repair loop is a side channel |
| E | Browser Run/Kitesurf + Dynamic Workers + WebMCP shape | Explore a site once → a deterministic tool → self-heal | Skyvern, Stagehand v4 cache, Notte Functions, Browser Use scripts, WALT (ICLR 2026), Unbrowse | Taken. Browser Use **retired** its Skills marketplace (410 Gone); site owners publish WebMCP themselves (about 100k Commerce.com stores) |
| I | Artifacts + DO merge coordinator + semantic merge | Git for agent swarms | Cursor Origin, Zed Delta, GitButler, jj, GitHub stacked PRs/merge queue, 24+ contest repos | Crowded |
| F | x402 / Monetization Gateway + Code Mode budget capability | Agent code that pays per call | Cloudflare Wallets + Monetization Gateway (2026-07), x402-mcp | The platform owns it |
| G | Basin (Iceberg on R2) + DuckDB-Wasm + Code Mode | Analytics in the tab straight over the lake | DuckDB "Iceberg in the browser" (2025-12-16) | Taken |
| H | Sync engine + durable agent sessions | Resumable, forkable, multi-device agent sessions | Electric Agents 0.6 + Durable Streams (2026-06); Vercel durable-harness | Taken |
| M | Chrome Prompt API / WebGPU models + DO orchestration | Cheap steps on the user's GPU | Firebase AI Logic hybrid inference (2025-06/10) | Taken, and the API is contested across browsers |
| N | tsrs-wasm + Dynamic Workers fan-out + Artifacts content addressing | Distributed TypeScript type-checking at the edge | VoidZero + Cloudflare own the toolchain (tsrs, Vinext, Oxc) | The owner will build it |
| O | tsrs-wasm + Code Mode | Type-check generated code before running it | Same owner; Code Mode already ships `.d.ts` | Small and owned |
| P | WebMCP + third-party tool injection | Agent-ready versions of sites that did not opt in | WebMCP permission policy defaults to `self` | Blocked by the spec |
| Q | Kitesurf + Dynamic Workers | Chrome-free e2e test fleets for generated UIs | Kitesurf itself (not open-sourced yet) | Cloudflare owns it |

### 2.3 Deep dive A — "Remix-safe data": model-written, mechanically checked lenses so forks keep sharing records

**One sentence.** When an agent regenerates an app, or a user remixes it, the agent must also emit a bidirectional lens
from the old schema to the new one. A runtime on Dynamic Workers + Facets (or a local-first engine) accepts the lens only
if it passes lens-law checks and a replay over a fork of the real records. After that, every version, fork and offline
client keeps reading and writing the same data through the lens graph.

**Demo in 30 s.** A generated "book club" app is open in three panes:
- **Original:** the app as generated.
- **Alice's remix:** "split author into first/last; tags as a list".
- **Bob's remix:** "rename title → name; ratings 1–5 → 1–10".

Edit a book in any pane and the other two update live, each in its own shape. Then Carol asks for "drop the notes
field". The runtime refuses and shows the concrete record whose notes would be lost on the round trip. The agent then
writes a version that keeps notes in the complement, and it is accepted.

**The gap (F, with what each does not cover).**
- **[Jazz v2 lens migrations](https://jazz.tools/docs/schemas/migrations)** (docs 2026-03-31; repo 219★): the closest.
  - Has Cambria-style lenses inside a sync engine.
  - Old offline clients' writes are accepted.
  - Lenses compose across versions, and `deploy` refuses a version with no migration path.
  - **Not covered:** ops are limited to Rename/Copy/Add/Drop-with-default plus registered bijections, so splits,
    restructures and type changes are out. There is one admin-owned catalogue, so no forks by other parties. There is
    no model authoring and no replay against live data
    ([SPEC ch.10](https://github.com/garden-co/jazz/blob/main/crates/jazz/SPEC/10_lenses_migrations.md)).
- **[panproto](https://github.com/panproto/panproto)** (84★, 2026-03→): has the engine (diff, lens DSL, complements,
  law checks, `applyToFleet`). It covers ATProto/SQL/JSON Schema and has a TS/Wasm binding.
  - **Not covered:** its own README says law checks "cover only the supplied or generated cases". Its automatic lenses
    miss intent (**M** above). There is no runtime or sync integration.
- **[Cambria](https://github.com/inkandswitch/cambria-project)** (710★): dormant since 2024-06, with hand-written lenses.
- **Lexicon Community lens proposal** ([discourse](https://discourse.atmosphere.community/t/interoperable-serendipity/1127)):
  proposes lens interop for ATProto and points at panproto. It is a discussion, not a product.
- **[Cloudflare VibeSDK "space"](https://github.com/cloudflare/vibesdk)**: has a Facet per branch, but the DBs start
  empty. Its rollback covers code only.
- **[Val Town](https://blog.val.town/scoped-databases)** (2026-01-23) and Glitch: a fork *copies* the data, so the forks
  diverge.
- **LLM migration tools:**
  - AIM (3★) and SchemaMigrate (2026-04) are one-way and check schema shape only.
  - Atlas and Prisma 6.15 add lint/guard checks on server databases.
  - Horizon/LAMT (VLDB 2025) check cross-dialect SQL. None of these is bidirectional or cross-fork.

**Pain evidence (be honest: moderate, not loud).**
- **ATProto spec:** forbids renames, type changes and removing required fields. "A new Lexicon name must be used" for
  breaking changes ([spec](https://atproto.com/specs/lexicon)). F
- **Standard.site:** Leaflet, pckt and Offprint write the same `standard.site.document` but with different content
  formats, so indexers cannot read each other's posts. The community answer proposed is lenses
  ([jola.dev](https://jola.dev/posts/thoughts-on-standard-site), [discourse](https://discourse.atmosphere.community/t/interoperable-serendipity/1127)). F
- **Automerge:** its docs say Cambria-style migration is "not yet implemented"
  ([docs](https://automerge.org/docs/cookbook/modeling-data/)). F
- **Electric:** any `ALTER TABLE` forces clients to discard local data and re-sync
  ([docs](https://electric.ax/docs/guides/shapes)). F
- **LiveStore:** [#69](https://github.com/livestorejs/livestore/issues/69) has been open since 2024-05. F
- **Counter-evidence:** the most-reacted schema-migration issue across Zero, Electric, Instant, LiveStore, Automerge,
  Triplit and Jazz has about 6 reactions. I found no Reddit threads about Lovable, Bolt or v0 losing data on
  regeneration. The loud incidents (Replit 2025-07; PocketOS 2026-04, HN 860 points / 1,032 comments) are agents
  *deleting* data, which lenses do not prevent. F
- **The Ink & Switch [malleable-software essay](https://www.inkandswitch.com/essay/malleable-software/) (2025-06)**
  names community-shared modifications as the goal. F

**Why it survives better models (I).** This is the flip rule from [flip2/06](../flip2/06-sweep.md):
- **Died of per-case labour:** Cambria failed because people had to write each lens by hand.
- **Has an independent extensional oracle:** GetPut/PutGet plus replay on real records. A better model cannot argue
  its way past a counterexample record.
- **Runs model-free:** the lens executes with no LLM.

Better models write more lenses that pass. More generated software means more schemas that need bridging.

**Why Cloudflare/Vercel would not ship it, and would adopt it (I).** It is about agreement on data models between
independently owned apps, which is research-flavoured and spans vendors. Facets give one SQLite per app and leave
cross-app data meaning to users (F: the Facets post never mentions schema migration). They would adopt it as a library
on Facets or VibeSDK. **Who would absorb it:** Jazz could add model authoring, and panproto could add a runtime. Both
are small teams, and partnering with or building on panproto is the natural path.

**First version in 2–3 weeks (TypeScript/Wasm on Cloudflare).**
- **Storage:** a supervisor DO holds a "trunk" table per record type plus a lens graph (panproto Wasm, 2.45 MB gzipped,
  **M**).
- **Forks:** each fork is a Dynamic Worker + Facet whose reads and writes pass through its lens chain. Changes fan out
  over the DO's WebSockets.
- **Remix flow:** AI SDK takes "change X" and returns new code plus a panproto lens DSL document.
- **Gate:**
  - property-based law checks on 1,000 sampled real records + generated edge cases;
  - replay of the last N writes through old→new→old;
  - refusal with the failing record shown.
- **Second target:** a Lexicon adapter for standard.site documents, as the first non-toy case.
- **Deliverables:** the demo UI and a CLI `lens check`.

**The expert reply that kills it.** "Real schema changes are lossy. Jazz limits lenses to bijections because lossy
lenses mean complements that grow forever and semantics nobody expects. If Bob rates a book 7/10, what does Alice see,
3.5 stars? And nobody remixes an app hoping to share its live data; they want a copy."

**Kill test (one week, before building).**
1. Collect 30 real schema-change commits from public vibe-coded repos (Supabase migration files under
   `supabase/migrations` in Lovable/Bolt-generated projects on GitHub) and the standard.site content-format divergences.
2. Have a current model write panproto DSL for each, then run law checks and replay on synthetic data.
3. **Kill if** fewer than 60% pass without a human, or more than half need complements that leak user-visible
   surprises.
4. **Kill also if** two ATProto/Lexicon Community developers, shown the passing cases, say they would not use it.

### 2.4 Deep dive B — "Fork the data, not just the code": copy-on-write SQLite per agent attempt on Facets

**One sentence.** A userland copy-on-write SQLite (SQLite-Wasm with a page VFS whose pages are stored in a DO and keyed
by content hash, so a fork copies only the page map). Every agent attempt then gets its own Facet backed by a fork of
the app's real data, and its own live URL, in milliseconds.

**Demo in 30 s.** "Add a 'recommend similar books' feature" fans out to 100 attempts. A grid of 100 live URLs appears in
about 2 s. Each runs against its own fork of the real 50 MB dataset. Click any one, poke at it, promote it. The losers'
forks cost nothing because their pages are shared.

**The gap (F).**
- **Missing primitive:** Durable Objects have no fork or clone; PITR restores the object onto itself
  ([API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)). D1's docs say "Time Travel does not
  yet allow you to clone or fork" ([D1](https://developers.cloudflare.com/d1/reference/time-travel/)).
- **Cloudflare's own reference app:** VibeSDK space gives each branch a Facet, but the DB starts empty.
- **Parallel attempts elsewhere:** Replit Agent 4 runs about 10 parallel app copies. Cursor `/best-of-n` and Codex
  `--attempts` (1–4) give diffs, not live data.
- **VM forks:** Freestyle and Morph fork whole VMs (Morph claims under 250 ms) but have no data/compare story.
- **DB branching is slow and capped:** Neon branches take "seconds" to "minutes", and plan caps hit 10/10
  ([thread](https://community.vercel.com/t/neon-postgres-integration-provisioning-failure-blocking-vercel-preview-deployments/34640)).
- **Research agrees:** [BranchBench](https://arxiv.org/abs/2604.17180) (2026-04) finds no branchable DB that handles
  agentic workloads at scale (create/switch 25–1500× slower on some systems).

**Pain.**
- **Slow previews:** Canon's measured Workers previews take a 48–54 s median from push to verdict
  ([README](https://github.com/teslacybrtrk/canon)). F
- **Cost:** Supabase branches cost $0.32/day. F
- **Data destruction:** the agent incidents (PocketOS HN 860/1,032) argue for "agents only ever touch forks". F
- **But:** PocketOS was an infrastructure-token call, not SQL, so a fork would not have stopped it. I

**Survives better models?** Mixed (I). Best-of-N matters *less* as models need fewer attempts. "Agents work on forks,
never on production" matters *more*.

**Why the vendors would ship it themselves (I).** D1 says fork is planned, and a native fork beats a Wasm SQLite. This
is exactly lesson (b).

**First version.** About 600 lines:
- a wa-sqlite VFS over `ctx.storage.kv` pages;
- `fork()` that copies the page map;
- a Facet loader;
- a 100-URL grid.

Measure the read overhead against native DO SQLite.

**Kill reply.** "Cloudflare ships `fork()` next quarter, and your Wasm SQLite is 3–10× slower than native DO SQLite,
which throws away the zero-latency point of DOs. And nobody reviews 100 UIs; Fork Arena's own A/A test falsely promoted
a challenger in about half of runs."

**Kill test.** Kill if the CoW VFS is more than 3× slower than native on a TPC-C-lite read mix, or if Cloudflare
confirms native fork.

### 2.5 Deep dive L — "Follow-me Durable Objects": the per-user object lives in your tab while you're there

**One sentence.** A Durable Object holds all its state in SQLite, so moving it means shipping a database file plus a
lease, not a heap snapshot. A runtime would run the *same* DO class in the user's tab (SQLite-in-OPFS, Web Locks) while
they are present, with offline access, 0 ms latency and free compute. It moves the object back to Cloudflare when they
leave, so alarms, email and other users still reach it.

**Demo in 30 s.**
1. Open a notes/agent app and the object's indicator flips from "edge" to "this tab" (a 5 MB transfer).
2. Turn off Wi-Fi: everything still works, with 0 ms writes.
3. Close the tab: the object returns to the edge.
4. An alarm fires there and an email arrives in it.

**The gap (F).**
- **[Solid Objects](https://lucascarlson.net/2026/08/24/introducing-open-source-durable-objects/)** (2026-08-24; 42★):
  runs DO-*style* actors in a tab on SQLite-Wasm/OPFS. It is not the DO API and does not move objects to or from
  Cloudflare.
- **TinyBase / LiveStore / Electric / Zero:** replicate *data* into the client, a different programming model with
  multi-writer merge.
- **celld → workerd:** self-host on servers, not tabs.
- **Earlier rounds:** the teleport rounds moved *heaps*, not *databases*. This is the cheaper case.

**Pain (weak).** Local-first demand is real, but sync engines already serve it. For agent DOs the model is remote
anyway, so offline buys little. I

**Kill reply.** "Single-writer means your phone stalls while your laptop holds the lease. Sync engines give multi-writer
offline today. 'It moves' is a mechanism, not value" (lesson d).

**Kill test.** Kill if handing over a 10 MB object between workerd and the tab takes more than 500 ms, or if three
local-first developers prefer their sync engine for the same app.

### 2.6 Ranked top 3 against the six criteria (1–5)

| Idea | Cool | CF/Vercel adjacent | Fills real gap | Value (evidence) | Survives better models | Not GrowOS | Total |
|---|---|---|---|---|---|---|---|
| **A Remix-safe data (model-written, checked lenses)** | 4 | 4 | 3 | 2 | 5 | 5 | **23** |
| B Copy-on-write data fork per attempt | 4 | 5 | 2 | 3 | 3 | 5 | 22 |
| L Follow-me Durable Objects | 4 | 5 | 3 | 2 | 2 | 5 | 21 |

### 2.7 The ONE pick

**A, conditional on its kill test.** It is the only combination where all three hold:
- the missing piece is not on either vendor's roadmap;
- the check is independent of the model;
- the artefact runs model-free.

These are the three properties that earlier rounds found decide survival. Its weakness is value evidence: the demand is
real in ATProto (standard.site) and local-first engines, but quiet. That is why the one-week kill test (30 real
migrations + lexicon cases, at least 60% lawful without a human, plus two ATProto developers who would use it) comes
before any build. Build it on panproto rather than beside it, and offer it to Jazz and the Lexicon Community as the
authoring and checking layer they lack.

**If A fails its test:** nothing in this lens clears all six criteria. B came closest on value, but Cloudflare's own
D1 roadmap names the missing primitive.

### 2.8 Five-line TL;DR

1. **F:** Since 2025 both vendors shipped the whole single-primitive agent stack: durable agents, Code Mode/Run,
   Dynamic Workers + Facets, Artifacts/Drives, container snapshots, an agent browser (Kitesurf), x402 payments, and the
   Deno/celld self-host merge.
2. **I:** Openings therefore exist only in combinations that span the user's device, other people's data models, or
   both vendors. Of 16 combinations checked, 12 are taken or owned (browser hands, website→tool, Iceberg in a tab,
   agent git, x402 budgets, durable sessions…).
3. **F/M:** The closest open one is model-written lenses. Jazz ships bijective-only lenses and panproto ships the engine.
   panproto's automatic lenses missed a rename and a split (M), so someone (an agent) must write the intent.
4. **I:** Pick A, "Remix-safe data": forks of generated apps, and ATProto apps, keep sharing records through
   law-checked lenses. It is cool, model-proof and not on a vendor roadmap, but value evidence is quiet.
5. **Next:** a one-week kill test on 30 real migrations + standard.site divergences (at least 60% lawful without a
   human, plus two ATProto developers who would use it). Runner-up B is likely pre-empted by Cloudflare's planned fork.

### 2.9 Rejected (one line each)

- **C browser-as-hands:** Agents SDK client tools + resume-on-reconnect + `codemode-browser` already ship. The compute
  saved (about $0.08/vCPU-h) is not the bill.
- **D code-to-data:** CaMeL/FIDES/Anthropic MCP code execution/PandasAI cover it, and repair loops leak data-derived bits.
- **E website→tool compiler:** Skyvern/Stagehand/Notte/WALT do it. Browser Use retired its marketplace, and owners
  publish WebMCP.
- **R versioned running app:** Replit App History already binds code and data. Rewinding production data destroys
  legitimate writes.
- **I git for swarms:** Cursor Origin, Zed Delta, GitButler, jj, GitHub and 24+ contest repos.
- **F x402 budgets:** Cloudflare Wallets + Monetization Gateway own it.
- **G Iceberg in the tab:** DuckDB-Wasm, 2025-12-16.
- **H durable/forkable agent sessions:** Electric Agents, Vercel durable-harness.
- **M on-device inference + DO:** Firebase AI Logic hybrid; the Prompt API is contested.
- **N/O tsrs fan-out or pre-run type checks:** Cloudflare + VoidZero own the toolchain.
- **P third-party WebMCP injection:** the permission policy defaults to `self`.
- **Q Kitesurf test fleets:** Cloudflare-owned and not open-sourced.

### Sources of the parallel search passes

The three prior-art passes (A/D, C/E, B/R/I) were run as research sub-agents on 2026-10-28. Every fact quoted from them
above carries its primary link. Star counts were read with `gh api` on 2026-10-28.
