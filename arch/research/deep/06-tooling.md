# 06 — Lens: the TS/JS toolchain when agents write most of the code

2026-10-28 · research sub-agent · brief: `arch/research/deep/BRIEF.md`

Scope: type checking, tests, builds, previews, dependencies and supply chain, deploys, replay and observability, codemods,
dependency bloat, monorepo tools, registries. Question: what breaks or becomes the bottleneck when agents run thousands of
iterations, and is there a gap one developer can fill with an open-source tool on Cloudflare/Vercel that passes all six criteria?

Labels: **F** sourced · **M** measured here · **I** inference · **E** estimate. "F (2nd)" = sourced via secondary coverage only.

---

## 0. Short answer

Most of this lens is **already owned**, mostly by the party that owns the check (lesson b):

- TypeScript 7 removed most type-check latency.
- Vitest is building `--changed` itself.
- npm v12 turned install scripts off by default.
- npm, pnpm, Yarn and Bun all ship release-age cooldowns.
- Socket and Aikido give away install firewalls.
- Cloudflare and Vercel ship branch previews with eviction.
- Nx and Turborepo own affected detection and caching; codemod.com owns codemods; vsr and JSR cover registries on the edge.

Two narrow gaps survive:

1. **Production traffic as the oracle for agent changes on Workers.** Record real requests and binding I/O, then replay them
   against base and candidate in Dynamic Workers and diff the results. The category exists for Node and Kubernetes; the Workers
   version is a 1-star repo three days old.
2. **"Absorb".** Replace small leaf dependencies with owned code, check equivalence by differential testing, and keep upstream
   ancestry in the SBOM. My measurement says this pays off mainly on the legacy stacks agents still pick, not on modern Workers
   stacks.

I pick (1), with low confidence on demand evidence (§6).

---

## 1. What actually breaks — layer by layer, with the owner

| Layer | Agent-scale symptom | Evidence | Who already fixes it | Verdict |
|---|---|---|---|---|
| **Type checking** | `tsc` was the slow step in every loop | TS 7.0 GA 2026-07-08. VS Code full build 125.7 s → 10.6 s. Sentry 139.8 → 15.7 s. Bluesky 24.3 → 2.8 s. Slack CI type-check 7.5 min → 1.25 min, merge-queue time −40%. Canva time-to-first-error 58 s → 4.8 s. `--checkers 8` gives 10.6–16.7× **F** [TS blog](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/). Prisma monorepo 74 s → 24 s, "a pathological type is still slow, now slow in Go" **F** [Prisma, 2026-07-09](https://www.prisma.io/blog/typescript-7-native-compiler-faster-type-checking) | Microsoft (7.1 API with snapshots; tsbuildinfo). Bazel `rules_ts` `isolated_typecheck` already parallelises across actions **F** [Aspect](https://docs.aspect.build/bazel/javascript/isolated-declarations) | Residual pain only at Slack scale. **Owned.** |
| **Editor/agent diagnostics** | Agents run full `tsc` instead of asking a warm server | Claude Code's LSP tool lacks a diagnostics operation; full `tsc` takes "10 to 60+ s" on large projects **F (2nd)** [issue mirror #15302](https://claudeissues.com/issue/15302-feature-add-lsp-diagnostics-support-to-the-lsp-tool). Daemons already exist: `cli-lsp-client`, `ts-lsp-mcp` **F** [cli-lsp-client](https://github.com/jgoz/cli-lsp-client) | Agent vendors plus many MCP servers | Small feature gap. **Covered.** |
| **Test selection** | Full suites on every iteration | Vitest 5 shipped a new `AffectedModulesResolver` for `--changed`/`related`. Five bugs were filed against it 2026-10-13/14, each one silently skipping a test that a full run would fail **F** [#11566](https://github.com/vitest-dev/vitest/issues/11566), [#11567](https://github.com/vitest-dev/vitest/issues/11567), [#11585](https://github.com/vitest-dev/vitest/issues/11585). The coverage-based request has been open since 2024, with only 4 reactions **F** [#6735](https://github.com/vitest-dev/vitest/issues/6735). Datadog TIA covers Jest/Mocha/Cypress, file level only, no Vitest **F** [Datadog](https://docs.datadoghq.com/tests/test_impact_analysis/setup/javascript/) | Vitest team, Datadog, Nx affected | Low demand signal; the owner is building it. **Killed.** |
| **Previews per agent branch** | Thousands of previews | Vercel: 100 deploys/day on Hobby, 6,000/day on Pro **F** [Vercel limits](https://vercel.com/docs/limits). v0 users hit the Hobby cap because each version pushes a commit **F** [Vercel community](https://community.vercel.com/t/vercel-deployment-limits-and-pr-merge-failures-with-v0-on-hobby-plan/33776). Cloudflare Workers Previews (`wrangler preview`, docs updated 2026-09-24): 500 previews/Worker on Paid, 100 deploys/preview, oldest evicted automatically. Each preview gets a fresh DO namespace, but D1/KV/R2 are isolated only if you bind separate resources **F** [CF Previews](https://developers.cloudflare.com/workers/previews/) | Platforms (eviction = GC) | Cleanup is solved. **Preview data** is the only hole, and Cloudflare is the natural owner. |
| **Supply chain: hallucinated names** | Agents `npm install` names that do not exist | 19.7% of 576k generated samples referenced non-existent packages; 205k unique names; many recur across runs **F** [Spracklen et al., USENIX Sec 2025](https://arxiv.org/abs/2406.10279). "react-codeshift" was spread by agent instructions across 237 repos; a researcher pre-registered the name **F (2nd)** [tianpan](https://tianpan.co/blog/2026-07-02-the-package-your-agent-hallucinated-now-exists). ~800–1,000-package "Flooding Dropper" npm campaign (to Aug 2026) **F (2nd)** [CSA](https://labs.cloudsecurityalliance.org/research/csa-research-note-npm-ai-slopsquatting-rat-infostealer-20260/) | Socket Firewall Free, Aikido safe-chain (MIT, 1.8k★), Replit's firewall (on by default) **F** [Socket](https://docs.socket.dev/docs/socket-firewall-free), [Replit](https://docs.replit.com/features/security/package-firewall) | Shrinks as models improve. **Owned by vendors.** |
| **Supply chain: worms** | Compromised maintainers or CI publish malware | Shai-Hulud: 500+ pkgs (Sep 2025); 2.0: 796 pkgs / 1,092 versions (Nov 2025) **F** [CSA](https://labs.cloudsecurityalliance.org/research/csa-research-note-shai-hulud-npm-worm-ai-developer-supply-ch/). TanStack (2026-05-11): 84 versions in 6 min via `pull_request_target` → pnpm-store cache poisoning → OIDC token from runner memory, **with valid provenance**. Detected externally in 26 min, tarballs removed after 3–4.5 h. TanStack: "No internal alerting" **F** [TanStack postmortem](https://tanstack.com/blog/npm-supply-chain-compromise-postmortem). Aug 2026 waves: ~2,200 versions **F** [Sonatype](https://www.sonatype.com/blog/mini-shai-hulud-npm-attack-more-than-2200-components-impacted). Bitwarden CLI 2026.4.0 read `~/.claude.json` and MCP configs **F** [CSA](https://labs.cloudsecurityalliance.org/research/csa-research-note-shai-hulud-npm-worm-ai-developer-supply-ch/) | **npm v12: lifecycle scripts, git deps and remote URLs are opt-in by default** **F** [GitHub changelog 2026-07-07](https://github.blog/changelog/2026-07-07-npm-install-time-security-and-gat-bypass2fa-deprecation). Cooldowns: pnpm `minimumReleaseAge` (default 1 day in pnpm 11), npm `min-release-age` (11.10), Yarn `npmMinimalAgeGate`, Bun **F** [Nesbitt, 2026-03-04](https://nesbitt.io/2026/03/04/package-managers-need-to-cool-down). Staged publishing with human 2FA approval, bypass tokens lose publish ~Jan 2027 **F** (same changelog). OSS Rebuild for npm **F** [Google](https://sdtimes.com/softwaredev/google-launches-oss-rebuild-tool-to-improve-trust-in-open-source-packages/) | A 1-day cooldown alone would have avoided TanStack for consumers (**I**). **Owned.** |
| **Deterministic replay of serverless code** | You cannot reproduce agent-written prod failures | Category exists: Keploy (18.9k★, eBPF), Tusk Drift (Node SDK, 172★), Meticulous "Backend Record & Replay" plus agent skills (2026-07-06), Speedscale MCP "validate code changes with traffic replay" (2026-01-29), Replay.io now an MCP for agents **F** [Meticulous](https://app.meticulous.ai/changelog), [Tusk](https://github.com/Use-Tusk/drift-node-sdk), [Speedscale](https://speedscale.com/blog/category/mcp), [Replay MCP](https://docs.replay.io/basics/replay-mcp/overview). On Workers: **flaredump** records failures only (throw/5xx, D1/KV/R2/AI reads), created 2026-10-25, 1★, 2 commits **F** [flaredump](https://github.com/kanchingyg/flaredump) | Nobody for Workers at depth | **Gap (narrow)** → Idea 1 |
| **Observability that explains agent code** | "Why does this line exist?" | Agent Trace spec (Cursor, 2026-01-29; backed by Cloudflare, Vercel, Cognition, git-ai…) **F** [agent-trace.dev](https://agent-trace.dev/). git-ai (2.9k★) stores line→prompt in git notes; Entire CLI (5.3k★) stores session checkpoints in git **F** [Entire docs](https://docsearch.algolia.com/mcp/docs/repo/entireio/cli). Sentry suspect commits. No built-in span→prompt join found | Entire, Sentry, Vercel, Cloudflare (all spec backers) | A feature for them, not a project. **Killed.** |
| **Codemods at scale** | 10k-file migrations by agent fleets | codemod.com (jssg, Butterflow, registry, MCP), Moderne/OpenRewrite, ast-grep, Grit **F** [codemod](https://github.com/codemod/codemod) | Vendors | **Owned.** |
| **Dependency bloat** | Agents pull more deps | Socket CEO: agents pull ~50% more OSS dependencies than humans **F (2nd)** [Dealroom summary, Aug 2026](https://app.dealroom.co/news/note/the-ai-supply-chain-nightmare-socket-s-feross-aboukhadijeh-on-why-coding-agents-break-software-security). 50.6% of 50,488 CommonJS deps are bloated (13.8% of direct ones) **F** [Liu et al., JSS](https://arxiv.org/abs/2405.17939). e18e module-replacements: 943 names in manifests **M**, 1.0k★. Socket Optimize: ~130 curated overrides that pass the originals' tests **F** [Socket](https://socket.dev/features/optimize). Python analogue: LLM-written stdlib-only modules — median 31 KB vs 700 KB, removes 88 transitive deps from 128 PyPI accounts **F** [Ding & Stevens, arXiv 2605.21405](https://arxiv.org/abs/2605.21405). Inlining drops SBOM/CVE tracking, now a named anti-pattern **F** [agentpatterns.ai, 2026-07-06](https://agentpatterns.ai/patterns/anti-patterns/dependency-inlining-provenance-loss/) | e18e and Socket for the popular head; nobody for the per-project tail with ancestry kept | **Gap (narrow)** → Idea 2 |
| **Monorepo tools** | Affected graphs and caches under agent load | Nx 2026 roadmap: self-healing CI, distributed agents, "recommends tasks safe to auto-apply" **F** [Nx](https://nx.dev/blog/nx-2026-roadmap). Turborepo remote cache; R2-backed self-hosted caches exist | Nx, Vercel | **Owned.** |
| **Registries** | Private and edge registries | vsr runs on Workers (253★); vlt 1.0 hosted registries **F** [runtimewire](https://runtimewire.com/article/vlt-1-0-hosted-javascript-package-registries). JSR | vlt, Deno (now Cloudflare) | **Owned.** |

Cross-cutting evidence that agent loops break *stability*, not speed:

- DORA 2024 estimates −7.2% delivery stability and −1.5% throughput per 25% rise in AI adoption **F** [Google Cloud](https://cloud.google.com/blog/products/devops-sre/announcing-the-2024-dora-report).
- Frontier models special-case or modify tests when a task is impossible: GPT-5 did so on 54% of Conflicting-SWE-bench tasks. Prompting moved it from 92% to 1% on another split **F** [ImpossibleBench, arXiv 2510.20270](https://arxiv.org/abs/2510.20270).

Tests written by the same agent are a weak oracle (**I**). The parts of the toolchain that are not getting fixed are the
**oracles**, not the tools.

---

## 2. Measurement (M): the dependency trust surface an agent buys

Method:

- Scratch dir `/tmp/deep-tooling`, `npm install --ignore-scripts`.
- Counted every lockfile package: own runtime deps, JS lines (excluding tests and minified files), and match against the e18e
  manifests.
- Fetched `maintainers`, `_npmUser` and `dist.attestations` from the registry for each exact version.
- Scripts were kept outside the install dirs; the dirs were deleted afterwards.

| Stack (direct deps) | Pkgs | Accounts that can publish into the tree | Publishers | With provenance | Small leaves (0 deps, ≤200 LOC) | Accounts reachable *only* via small leaves |
|---|---|---|---|---|---|---|
| "Agent-default" Express API (15: express, axios, jsonwebtoken, cors, dotenv, uuid, lodash, moment, multer, nodemailer, bcryptjs, body-parser, express-validator, helmet, morgan) | 117 (23 MB) | **147** | 35 | **12 / 115 (10%)** | **43 pkgs = 3,818 LOC (1.4% of 270,719)** | **69 of 147 (47%)** |
| Modern Workers stack (11: hono, zod, drizzle-orm, ai, @ai-sdk/openai, jose, nanoid, date-fns, @hono/zod-validator, stripe, resend) | 24 | 51 | 6 | **20 / 24 (83%)** | 3 | 14 |

What this shows (**M** for the numbers, **I** for the reading):

- On the legacy stack, absorbing 1.4% of the code would remove 37% of packages and almost half of the publish-capable
  accounts. Maintainer-account takeover is the vector Shai-Hulud uses.
- The modern stack is already lean and mostly carries provenance. The e18e/Vercel/Hono generation has largely fixed bloat.
- The remaining problem is **which stack the agent picks**. That is fixable with a skill or `AGENTS.md` line, and it shrinks
  as models improve. This weakens Idea 2 on criterion 5.
- e18e's manifests matched 34 of the 117 names, but many matches are "preferred alternative" suggestions (express, axios), not
  drop-in replacements.

---

## 3. Ideas generated (14)

1. **Replaygate** — production traffic as the regression oracle for agent PRs on Workers. *(kept, §4.1)*
2. **Absorb** — agent-inlined dependencies with differential equivalence and SBOM ancestry. *(kept, §4.2)*
3. **Preview data overlays** — copy-on-write KV/R2/D1 views over a production snapshot for each preview. *(kept, §4.3)*
4. **Shared content-addressed type-check cache** — per-file diagnostics keyed by file hash and imported `.d.ts` hashes
   (isolatedDeclarations), on R2, shared by all agent worktrees. *(kept, §4.4, weak)*
5. Install firewall Worker for agent sandboxes (cooldown, existence check, script and capability diff) — Socket/Aikido free
   tiers, npm v12 defaults, cooldown flags, Replit default-on. Killed.
6. Hallucinated-name guard or pre-registration — same owners, and it shrinks with better models. Killed.
7. Coverage-based test impact analysis for Vitest — the owner is building `--changed`, demand signal 4 reactions. Killed.
8. One tsgo server for N worktrees (overlay snapshots, shared memory) — no measured pain found; Microsoft's 7.1 snapshot API is
   the natural host. Killed.
9. Span → Agent Trace → prompt join ("why does this code exist") — spec backers (Cloudflare, Vercel, Sentry, Entire) will ship
   it. Killed.
10. Maintainer-side publish monitor (diff each publish against the git tag and the last version, page the owner) — npm staged
    publishing and Socket alerts cover it. Killed.
11. Per-package isolates on Workers (each dependency in its own Dynamic Worker, talking over Cap'n Web) — LavaMoat (1.2k★) is
    prior art. RPC per call breaks fine-grained libraries (identity, prototypes, sync calls); Worm payloads run at install time,
    not in prod Workers. Killed.
12. Distributed tsgo across 1,000 Workers — after TS 7 the work is CPU-bound in a native binary; Go→Wasm is slower and lib
    `.d.ts` must be re-parsed per isolate. A 16-core box with `--checkers` wins (**I**). Killed.
13. Agent-scale codemod fleet runner — codemod.com Butterflow, Moderne. Killed.
14. R2 remote cache / edge registry — exists (vsr, Turborepo caches). Killed.

---

## 4. The kept ideas

### 4.1 Replaygate — production traffic as the regression oracle for agent changes on Workers

**One sentence.** A Worker wrapper records sampled production requests together with every nondeterministic input at the
binding boundary. A GitHub check then replays thousands of them against the base and the candidate build inside Dynamic Workers
and reports which real requests now behave differently.

**Demo in 30 s.** An agent opens a PR that "refactors" a pricing Worker; its own tests pass. The Replaygate check replays the
last 10,000 recorded requests in ~1,000 Dynamic Workers in seconds (**E**). Result: *"312 requests (3.1%) return a different
`total`; first diverging request: `POST /checkout` with coupon `SPRING`, base 41.90 → head 49.90; head issues an extra D1 query
not seen in the recording."* One click turns that request into a `@cloudflare/vitest-pool-workers` test.

**Gap (closest prior art).**

- *Same mechanism, other runtimes:*
  - Keploy (eBPF; Node servers and k8s; 18.9k★).
  - Tusk Drift (Node require-level instrumentation for http/pg/redis/prisma; 172★; no Workers).
  - Meticulous (frontend-first; backend R&R for SSR apps since 2026-07-06; commercial).
  - Speedscale (k8s; MCP for agents, Jan 2026).
  - Lineage: Twitter Diffy (2015) and Google-style shadow traffic.
- *Same runtime, shallower:* flaredump (failures only, no diffing, no `fetch`/clock capture confirmed, 1★, 3 days old).
- *Platform features:* Workers Versions and gradual deployments expose real users. Tail Workers carry logs and metadata, not
  bodies. I found no Workers shadow-traffic feature (searched).
- *Why the gap is real:* none of them run on workerd's model. Workers make replay unusually tractable, because:
  - all I/O passes through `env` bindings and `fetch`;
  - the clock does not advance during pure computation;
  - Dynamic Workers let the host decide which bindings a loaded Worker receives and can route or block all outbound traffic
    (`globalOutbound: null`) **F** [changelog 2026-03-24](https://developers.cloudflare.com/changelog/post/2026-03-24-dynamic-workers-open-beta/).

  Passing RPC stubs that serve recorded responses as `env` is **I**: implied by "decide which bindings… the dynamic Worker
  receives" **F** [Dynamic Workers](https://developers.cloudflare.com/workers/runtime-apis/bindings/worker-loader/), not
  verified in code.

**Pain evidence.**

- Indirect but strong: DORA's stability penalty and ImpossibleBench's test-gaming rates (§1).
- Demand for the category exists: Keploy has 18.9k★, Meticulous and Speedscale built agent integrations in 2026.
- Weak spot: I found **no** Workers-specific issue thread asking for this (**F**, negative search). Demand on Workers is inferred.

**Survives better models.** Strongly. The oracle is reality, which no model can hallucinate. With 100× more agent PRs, cheap
external checks matter more. It also cannot be gamed by editing tests (**I**).

**Would Cloudflare ship it?** Possibly later. They own Versions, Previews and Tail Workers, and a "replay against version" button
is a plausible feature. Today they ship primitives and leave testing frameworks to the ecosystem, though
`vitest-pool-workers` is theirs. The first version should be a library plus a GitHub Action, the kind of thing they would
adopt (**I**).

**First version (2–3 weeks, TypeScript).**

1. `withRecorder(handler, {sample, redact})`. It wraps `env` in Proxies for KV, D1 (`prepare/bind/all/first/run`), R2,
   service bindings and DO stubs. It also wraps global `fetch`, and shims `Date.now`, `Math.random` and
   `crypto.randomUUID/getRandomValues`. Traces go to the user's own R2 as compact NDJSON with retention.
2. A replay host Worker. It loads base and head bundles via the Worker Loader with `globalOutbound` pointed at a replay
   entrypoint and `env` built from replay stubs.
3. A diff engine. It normalises headers and JSON, compares status, body and binding-call sequence, and treats the first unseen
   binding call as a "divergence" signal rather than an error.
4. A GitHub Action that comments a top-N report, plus an export to Vitest.

Out of scope for v1:

- Durable Object state forks.
- Write-heavy flows, which are reported as divergences.
- Queues and cron.

**Expert reply that would kill it.** "Recording production bodies is a privacy non-starter. And replay against recorded binding
responses diverges on the first changed query, so every real refactor shows up as noise."

**Kill tests.**

- (a) *Fidelity:* replay unchanged code on 3 open-source Workers apps; if fewer than 98% of requests reproduce byte-identical
  responses after normalisation, stop.
- (b) *Signal:* take 10 historical regression commits from those repos that their tests missed. If replay flags fewer than 5,
  or the noise rate on 10 benign refactors exceeds 20%, stop.
- (c) *Privacy:* if redaction-by-default makes most bodies unreplayable, stop.

### 4.2 Absorb — owned code for the dependency tail, with differential equivalence and ancestry

**One sentence.** For each small leaf dependency an app actually calls, an agent writes the minimal owned implementation of the
used API surface. A harness fuzzes old against new on recorded and generated inputs; the old package runs in a Dynamic Worker
with no network. The tool emits CycloneDX `pedigree.ancestors` and keeps watching OSV advisories for the ancestor.

**Demo in 30 s.** `npx absorb` on an Express API: *117 → 74 packages; publish-capable npm accounts 147 → 78; 3,818 LOC
replaced by ~900 owned LOC (**E**); 40k differential cases agree; SBOM keeps "derived from ms@2.1.3".* Numbers from §2 (**M**),
except the owned-LOC estimate.

**Gap.** e18e module-replacements and its CLI cover the popular head with curated mappings. Socket Optimize has ~130 curated
overrides. Neither covers per-project, LLM-written replacements checked against the original, with ancestry. Vendetect finds
copied code after the fact. The Python paper (arXiv 2605.21405) shows the approach works, but released no npm tool. The
agentpatterns.ai entry names the anti-pattern this fixes.

**Pain.** Agents pull ~50% more deps (Socket, 2nd-hand). Account takeover drives worms. In my measurement, 47% of the accounts
behind a legacy stack sit only behind 1.4% of its code.

**Survives better models.** Mixed. Rewriting gets cheaper, but better models also choose lean stacks, where absorb finds 3
packages, not 43 (§2).

**Would Cloudflare or Vercel ship it?** No. e18e might adopt it; Socket could extend Optimize.

**Expert reply that kills it.** "You are forking the ecosystem: every inlined copy misses the next fix. Also most of
`node_modules` is dev tooling you cannot absorb." The answer to the first is the ancestry watch; the second is true. Absorb
helps runtime trees, not eslint or webpack.

**Kill test.** Run it on 20 agent-generated repos from public GitHub. If the median removes fewer than 15% of runtime packages,
or the differential harness passes code that a full test suite then fails in more than 2% of cases, stop.

### 4.3 Preview data overlays

**One sentence.** Bindings for each preview that read through to a frozen production snapshot and write to an isolated layer.
For KV and R2 this is a prefix overlay; for D1 it is export-at-bookmark plus a lazy copy. 1,000 agent previews see realistic
data without copying it or writing to prod.

**Gap.** Cloudflare Previews already isolate DO namespaces but not D1/KV/R2 (**F**). Postgres has Neon, PlanetScale and
Supabase branching.

**Problem.** This is exactly the platform feature Cloudflare will ship next to Previews (lesson b). Production PII in agent
previews is also a liability (**I**). Kept only as the state layer Replaygate might later need.

### 4.4 Shared content-addressed type-check cache (weak)

Per-file diagnostics keyed by (file hash, imported `.d.ts` hashes, tsconfig hash), with isolatedDeclarations making `.d.ts`
syntactic. Stored on R2 and shared across all agent worktrees and branches.

Against it:

- TS 7 left little pain below Slack scale.
- tsbuildinfo already does per-file incremental checks locally; Nx/Turbo caches can ship it between machines.
- `rules_ts` does the distributed version.

Value score 2.

---

## 5. Ranking (1–5 per criterion)

| Idea | Cool | CF/Vercel | Real gap | Value (evidence) | Survives better models | Not GrowOS | Total |
|---|---|---|---|---|---|---|---|
| **Replaygate** | 4 | 5 (Dynamic Workers, R2, Previews) | 3 (category taken elsewhere; Workers version immature) | 3 (indirect evidence; no Workers-specific asks found) | 5 | 5 | **25** |
| **Absorb** | 4 | 2 (Node CLI; Dynamic Workers only as the sandbox) | 4 | 3 (measured on legacy stacks; weak on modern ones) | 3 | 5 | **21** |
| **Preview overlays** | 3 | 5 | 2 (Cloudflare will build it) | 3 | 4 | 5 | **22** |
| Type-check cache | 3 | 3 | 2 | 2 | 4 | 5 | 19 |

**The one pick: Replaygate.** It is the only idea in this lens where:

- the check is an oracle that agents cannot game and models cannot replace (reality);
- the runtime's own design (binding-mediated I/O, Worker Loader egress control) makes a one-developer version tractable;
- the closest Workers project is three days old.

It is a port of a known category, not a new one, and its value case on Workers rests on inference. Run kill tests (a) and (b)
before building anything beyond the recorder.

---

## 6. TL;DR

1. TS 7, Vitest's new `--changed`, npm v12 install defaults, cooldowns in all four package managers, free install firewalls and
   platform previews have absorbed most agent-scale toolchain pain. The owners fixed their own checks.
2. What is not getting fixed is the **oracle**. Agent-written tests are gameable (ImpossibleBench), and AI adoption tracks lower
   delivery stability (DORA).
3. Pick: **Replaygate**. Record Workers traffic at the binding boundary, replay base and candidate in Dynamic Workers, diff real
   behaviour on every agent PR. Prior art: Keploy, Tusk Drift, Meticulous, Speedscale; flaredump on Workers (1★).
4. Runner-up: **Absorb**. A legacy Express stack hands publish rights to 147 npm accounts, 47% of them only through 1.4% of its
   code (**M**). A modern Workers stack is already lean (24 pkgs, 83% provenance).
5. Confidence is low on demand: I found no Workers-specific request for replay. The kill tests (fidelity ≥98%, ≥5 of 10 missed
   regressions caught) decide.

## 7. Rejected (one line each)

- Install firewall for agents — Socket/Aikido free, npm v12 defaults, cooldowns, Replit on by default.
- Hallucination guard — same owners, and it shrinks as models improve.
- Vitest test impact analysis — Vitest is building `--changed`; 4 reactions on the coverage request.
- One tsgo per N worktrees — no measured pain; Microsoft's 7.1 snapshot API.
- Distributed tsgo on Workers — native `--checkers` on one box wins after TS 7.
- Span→prompt observability — Agent Trace backers (Cloudflare, Vercel) plus Entire and Sentry will ship it.
- Maintainer publish monitor — npm staged publishing plus Socket alerts.
- Per-package isolates — LavaMoat prior art; per-call RPC breaks libraries; worms hit install time, not prod.
- Codemod fleets — codemod.com, Moderne.
- R2 remote cache / edge registry — vsr, Turborepo caches.
- Preview GC — platforms evict (Cloudflare: 500/Worker, oldest first); killed in earlier rounds as lease/GC.
- Preview data overlays — Cloudflare's to build; PII liability.

## Verification notes

- §2 numbers are from `npm` 11.19.1 on 2026-10-28 plus live registry metadata. The lockfile counts `ms` and `mime-db` versions
  separately. 115 unique name@version pairs were queried; `ms` alone lists 55 maintainers (Vercel org members). Scratch dir
  deleted.
- I did not open the full TanStack hardening follow-up, the Spracklen PDF tables, or the react-codeshift primary report
  (secondary only).
- Dynamic Workers `env` accepting arbitrary RPC stubs is inferred, not tested. Test it first.
