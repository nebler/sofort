# 03 — Language lens: a language, TS dialect, or compiler for code that models write and run (2026-10-28)

**Labels:** **F** sourced fact (link + date), **M** measured today (GitHub API / issue search, 2026-10-28), **I** inference,
**E** estimate. "F (canonical)" marks well-known lineage that was cited from the project's home page but not re-checked today.

**Scope:** I read [BRIEF.md](BRIEF.md) and the TL;DRs of `teleport/` (03, 05, 08, 09, 10), `flip2/04-codemode.md` and
`moonshots2/02-compilers.md`. No experiments were run. A local spike would not decide anything here: every candidate turned
on prior art and on how often the problem actually occurs, and neither can be measured on a laptop. The only **M** claims
are GitHub API reads (stars, last release, commit authors, issue counts). No scratch files were created.

## 0. The answer in one paragraph

**I —** A new language is the wrong unit. A **TypeScript subset plus host semantics** gets every property on the wish list
(durable, pausable at an await, forkable, effect-annotated, capability-safe, replayable) without asking models to learn new
syntax, and each of those properties already ships somewhere. The things that are **not** taken are not about running a
program. They are about **changing a program while it runs**. Durable engines can move a run across machines (taken) but
not across **code versions**. Vercel pins runs and tells you to cancel and rerun. Temporal makes you write `patched()`
branches. Inngest and Cloudflare Workflows silently reuse cached step results by name: renaming a step re-runs its effect,
and changing a step's inputs keeps the stale result. Cloudflare's Dynamic Workflows, where *agents write their own durable
plans* and the loader fetches the latest source, makes "the code changed under a running program" the normal case. The pick
is a **compiler pass plus dry replay** that, before a running program resumes on edited code, shows a *replay diff*: which
recorded effects are still valid, which are stale, which would be **duplicated**, and which are new. Teleport, but across
time and versions instead of across hosts. The evidence of pain is real but modest, and Vercel has said it is working on
in-flight upgrades. The confidence is medium-low, and the kill test is cheap.

## 1. Is a new language valuable when models write the code?

| Evidence | What it says | Label |
| --- | --- | --- |
| [GitHub Octoverse 2025](https://github.blog/news-insights/octoverse/octoverse-a-new-developer-joins-github-every-second-as-ai-leads-typescript-to-1/) (2025-10-28) | TypeScript became #1 on GitHub by monthly contributors in Aug 2025 (+1M contributors, +66% YoY). GitHub attributes this partly to AI-assisted coding favouring typed languages. | F |
| [Type-constrained decoding](https://arxiv.org/abs/2504.09246), Mündler et al., PLDI 2025 | Constraining decoding with **TypeScript's** type system cuts compile errors by more than half on HumanEval and improves functional correctness. | F |
| [Quasar](https://arxiv.org/abs/2506.12202), Mell et al., COLM 2026 (v2 2026-08-25) | An effect-annotated language for LLM code actions. The authors say LLMs "struggle to generate it directly", so models write a **restricted Python subset** that is transpiled. The subset costs little accuracy: GQA 71.8 → 71.4, AgentDojo 64.5 → 63.4. | F |
| [Esoteric-language ICL](https://neurips.cc/virtual/2025/131647), NeurIPS 2025 | With documentation and examples, models produce some correct code in unseen languages, but "far below" common languages: Pyth 16.67% → 30.82% with self-scaffolding, Minipy HumanEval 51% → 65%. | F |
| [CangjieBench](https://arxiv.org/abs/2603.14501) (2026-03), [ILA-agent](https://arxiv.org/abs/2602.06976) (2026-02) | A new real language (Huawei Cangjie) needs documentation plus an execution environment for the model to learn it. The authors report **negative transfer** from source-language habits. | F |
| [AutoCodeBench](https://arxiv.org/abs/2508.09101) (2025-08); José Valim, Dashbit, 2026-02-05 ([blog](https://dashbit.co/blog/tags/documentation)) | Elixir had the highest completion rate of 20 languages, despite much less training data than the top languages. | F; the figures come from secondary write-ups |
| MoonBit ([LLM4Code 2024](https://conf.researchr.org/details/icse-2024/llm4code-2024-papers/9/MoonBit-Explore-the-Design-of-an-AI-Friendly-Programming-Language), [blog](https://www.moonbitlang.com/blog/ai-coding)) | Claims an "AI-friendly" design (flat top-level definitions, real-time semantic sampling). The results are vendor-reported, and I found no independent benchmark. | F |
| Darklang ([blog](https://blog.darklang.com/); README read today) | Went "all-in on AI" and wound down Darklang-Classic in June 2025. The README says the new version, in work since Feb 2023, "isn't yet ready for production use". | F / M |
| Wing ([repo](https://github.com/winglang/wing)) | A cloud language with preflight/inflight phases. 5,403 stars, last release v0.85.49 on 2025-02-03, and recent commits all by one author. | M |
| [Unison 1.0](https://www.unison-lang.org/unison-1-0/) (2025-11-25) | Content-addressed code, abilities (effects), Unison Cloud. 6,773 stars. Still the cleanest "durable distributed language", and still a niche. | F / M |
| [Jac](https://www.theregister.com/devops/2026/10/23/michigan-prof-creates-python-like-jac-language-for-ai-agents/5305110) (2026-10-23), [Pel](https://arxiv.org/abs/2505.13453) (2025) | New agent-oriented languages. I saw no adoption numbers that would change the conclusion. | F |

**I — What this shows:**
1. Language *design* matters: Elixir's result and Quasar's effects both show it.
2. Language *novelty* costs accuracy now: the esoteric-language and Cangjie results show it.
3. Every recent "language for LLM code" that got good results did it by keeping familiar syntax (Quasar's Python subset).

**I — What changes with 10–100× better models:** the training-data argument against a new language weakens, because a
much better model can learn a language from its documentation. What stays is the cost of the **ecosystem**: npm, `tsc`,
editors, humans reviewing the code, and Workers/Vercel toolchains. The benefit of a new language also stays capturable by
a subset plus host semantics. So the reason to reject a new language survives better models, but it is ecosystem
economics, not model capability. Darklang (3.5 years without a production release) and Wing (no release since Feb 2025)
are the cautionary cases.

## 2. The wish list, property by property: what is taken

| Property | Who already has it (TS/JS world first) | Gap? |
| --- | --- | --- |
| **Durable** (survives restarts) | Vercel Workflow `"use workflow"`/`"use step"`: an SWC transform splits workflow and step bundles, and the workflow body re-runs from an event log in `node:vm` ([how it works](https://workflow-sdk.dev/docs/how-it-works/code-transform)) **F**. Cloudflare Workflows and **Dynamic Workflows**, where "an agent can write its own durable plan" ([blog, 2026-05-01](https://blog.cloudflare.com/dynamic-workflows/); [InfoQ](https://www.infoq.com/news/2026/05/cloudflare-dynamic-workflows/)) **F**. Cloudflare Code Mode's durable runtime (`requiresApproval`, `approve()` "resumes a paused execution through replay", `step()` results recorded; [docs, updated 2026-07-22](https://developers.cloudflare.com/agents/api-reference/codemode/)) **F**. Project Think fibers ([2026-04-15](https://blog.cloudflare.com/project-think)) **F**. Golem TS agents on QuickJS-in-Wasm, durable by default ([docs](https://learn.golem.cloud/how-to-guides/common/golem-js-runtime)) **F**. Effect `@effect/workflow` on `@effect/cluster` ([docs](https://effect.website/docs/v4/api/effect/unstable/workflow/Workflow)) **F**. Temporal, Restate, Inngest, DBOS. | **No** |
| **Pausable at any await / teleportable** | Pydantic **Monty** (Python subset in Rust): pauses at external calls, "snapshot is single-digit kilobytes", type-checks with `ty` before running ([2026-02-27](https://pydantic.dev/articles/pydantic-monty)) **F**; 8,798 stars **M**. **Zapcode**, a *TypeScript* subset interpreter in Rust with snapshots "typically under 2KB" ([repo](https://github.com/TheUncharted/zapcode)) **F**; 94 stars **M**. Guild's `babel-plugin-agent-compiler` turns `"use agent"` async functions into serializable state machines; `Promise.all`, class instances and RegExp fail after resume, and "the compiler does not warn you" ([docs](https://docs.guild.ai/packages/babel-plugin.md)) **F**. Vercel's QuickJS VM with heap snapshots ([PR #3253](https://github.com/vercel/workflow/pull/3253), Jul–Aug 2026, stress test ~7–8× slower than node) **F**. Stopify/Distribufy (research) ([repo](https://github.com/baxtersa/distribufy)) **F**. Lumenize serializable continuations across Durable Objects ([docs](https://lumenize.com/docs/mesh/continuations)) **F**. | **No.** The teleport rounds already found replay to be the strong baseline. Code Mode programs are short and every effect already crosses a host boundary, so journaling at that boundary gives durability **without any compiler** (**I**). |
| **Forkable** | DBOS `fork_workflow(id, start_step, application_version)` ([docs](https://docs.dbos.dev/typescript/tutorials/workflow-management)) **F**. Project Think session trees **F**. Snapshot runtimes above. | **No** |
| **Effect-typed** (host knows the tool/data footprint) | Quasar (above): effect-annotated external calls give batched approvals (26–97% fewer) and autoparallelisation **F**. Unison abilities, Koka, Effekt **F (canonical)**. Effect-TS's `R` channel **F**. CaMeL/CaMeLoT/ACE, already covered in `flip2/04` **F-prior**. | **Research-occupied; no shipping TS runtime.** Already proposed as `flip2` #1 ("effect manifest → one-shot approval"), which the builder found not exciting. Not re-pitched here. |
| **Capability-safe** | Dynamic Workers: `globalOutbound: null`, authority only through bindings ([Project Think](https://blog.cloudflare.com/project-think)) **F**. Cap'n Web. Monty and Zapcode expose "external functions only" **F**. Hardened JS/SES ([endo](https://github.com/endojs/endo)) and E **F (canonical)**. | **No** |
| **Replayable** | Every journal engine above. Temporal's replayer runs recorded histories against new code. | **No** |
| **Cheap to verify** | Replay receipts. Killed in earlier rounds as generic verification-as-a-product. | Killed |
| **Compiled to plain JS/Wasm** | Vercel (SWC), Guild (Babel), Golem (QuickJS-Wasm), Zapcode (Wasm binding). | **No** |
| **Safe to *change* while running** | Vercel: "Workflow runs are pinned to the deployment that starts them". The fix is cancel, then "Rerun on latest" from scratch ([versioning doc, workflow@5.2.0](https://app.unpkg.com/workflow@5.2.0/files/docs/foundations/versioning.mdx)) **F**. Temporal: `patched()` or Worker Versioning (GA [2026-03-30](https://temporal.io/blog/ga-worker-versioning-public-preview-upgrade-on-continue-as-new)), where AUTO_UPGRADE workflows "need to be kept replay-safe manually" **F**. Inngest: memoized by step ID, "completed steps are never re-executed, even across deployments", a *changed* ID re-executes, and the only check is an ordering warning ([docs](https://www.inngest.com/docs/learn/versioning)) **F**. Cloudflare: "Step names act as the 'cache key'"; the rules page does not address deploys during a run ([Rules of Workflows, updated 2026-10-15](https://developers.cloudflare.com/workflows/build/rules-of-workflows/)) **F**. DBOS: manual fork at a chosen step onto a new version, plus patch points (Mar 2026) **F**. | **Yes. Nobody computes the effect consequences of an edit against the journal.** (§3) |

**I — Cloudflare's and Vercel's direction:** both already treat "durable code mode" as their own feature. Lesson (b) of the
brief applies directly: a compiler pass that adds durability, pausing or forking to Code Mode would be competing with
the platform's core roadmap.

## 3. The open seam: running programs whose code changes

**F — Restate (2024-02-02):** "Probably the hardest problem in durable execution … is *safe code updates*"
([post](https://restate.dev/blog/solving-durable-executions-immutability-problem)).
**F — Vercel (2026-08-27):** pins runs to deployments and rejects Temporal's patching
([blog](https://vercel.com/blog/the-best-workflow-engine-is-a-programming-language)).
**F — Vercel forum (2026-01-29):** "You cannot update in-flight workflows to use new code"
([thread](https://community.vercel.com/t/how-do-i-upgrade-an-on-flight-workflow-to-use-the-latest-deployed-code/32373)).
**F/M — vercel/workflow [#13](https://github.com/vercel/workflow/issues/13)** "how to upgrade workflows" (2025-10-23, open,
7 reactions): a maintainer replied "we are currently building something for versioning so that you can upgrade workflows
in-flight". [Discussion #99](https://github.com/vercel/workflow/discussions/99) "What happens when you update a
step/workflow code while they're still running" has 12 upvotes.
**F — Temporal does not compare activity inputs on replay:** "change in activity / child workflow inputs are not
compared during replay" ([forum](https://community.temporal.io/t/deterministic-workflows-replay-and-activity-arguments/12249)).

**I — Five hazard classes when edited code resumes against an existing journal.** This holds for Inngest, Cloudflare
Workflows, Code Mode `step()`, and Temporal AUTO_UPGRADE:

1. **Stale inputs.** Same step key, but the new code would pass different inputs. The engine returns the old result
   silently. For a write, the past effect used the old inputs, for example the old recipient or the old amount.
2. **Stale body.** Same key, but the step's code changed. The fix will never apply to this run.
3. **Duplicate effect.** A completed write step is renamed or re-keyed, so the new code re-executes it. The customer
   gets two emails or two charges. Inngest documents this as the way to *force* re-execution, with only a warning.
4. **Orphaned effect.** A completed write is no longer reachable in the new code. The run's history now contains an
   effect the program no longer accounts for.
5. **Divergent prefix.** Code outside steps now computes different values or branches differently before the frontier.
   Temporal catches this only when the command sequence changes.

**I — Why agents make this worse:** in Cloudflare's Dynamic Workflows the model writes `run(event, step)` and the
platform's loader "fetches the tenant's latest source" on each wake ([blog](https://blog.cloudflare.com/dynamic-workflows/)).
An agent that revises its own plan while the plan waits days for a human approval is exactly the "code changed under a
running program" case. Nothing checks it today.

## 4. Ideas generated (12) and self-critique

| # | Idea | Verdict |
| --- | --- | --- |
| 1 | **New language "Await"**: durable, forkable, effect-typed, capability-safe, compiled to JS/Wasm | Rejected (§1, §2): every property is taken. It would pay novelty costs without enabling anything new. |
| 2 | **Pause-at-any-await TS compiler pass** (CPS / state machine on V8, no QuickJS slowdown) | Rejected: Guild, Zapcode, Monty, Vercel QuickJS, and Code Mode's durable runtime cover it, and replay beats it for short programs. |
| 3 | **Effect manifest pass** (Quasar for TS: static tool footprint → one batched approval) | Prior-round survivor (`flip2` #1). The new evidence is Quasar (26–97% fewer approvals). Re-scored below but **not** picked, because the builder already passed on it. |
| 4 | **Replay diff / edit-and-continue for durable TS** | **Pick** (§5.1) |
| 5 | **Durable-dialect checker** (`tsc`/ESLint: non-serializable values live across `await`, non-determinism outside steps, non-deterministic step names) | Top 3 (§5.3); small and useful, but not cool |
| 6 | **Choreographic Code Mode** (one TS program with placement annotations, split into browser + Worker + DO parts joined by Cap'n Web) | Top 3 (§5.2); cool, but no pain evidence |
| 7 | **Content-addressed TS** (Unison-style hashes per function, so runs reference code by hash) | Folded into #4 as a mechanism; Unison owns it standalone |
| 8 | **Typed holes for agents** (Hazel fill-and-resume: run until a hole, the model fills it with live values in view, resume) | Rejected: persistent REPL kernels (CodeAct, Code Mode sessions) already give the same loop; Hazel ([POPL 2019](https://arxiv.org/abs/1805.00155)) is the formal version. |
| 9 | **LLM-native diagnostics** (compiler errors written for repair loops) | Rejected: fails criterion 5, since better models need it less. MoonBit/Elm already pitch it. |
| 10 | **Crash-at-every-await testing** for model-written workflows (deterministic simulation) | Folded into #4: the same dry-replay engine with crash points. Temporal's replayer and time-skipping cover part of it. |
| 11 | **Replay receipts** ("cheap to verify") | Rejected: generic verification-as-a-product was killed earlier. |
| 12 | **TS-to-Wasm durable agents** (Golem-style) | Rejected: Golem, Vercel quickjs-wasi, and the earlier capsule rounds cover it. |

## 5. The surviving ideas in detail

### 5.1 Replay diff: edit a running TypeScript program and see what the edit does to its past (PICK)

**One sentence (I):** a TypeScript compiler pass plus a dry-replay engine that, before a durable run resumes on edited
code, classifies every recorded effect as *reused-valid / stale-inputs / stale-body / orphaned / would-duplicate / new*. It
blocks, or asks, on write hazards and suggests the safe resume point.

**Demo in 30 s (I):**
- *Left pane:* an agent-written Dynamic Workflow ("onboard Alice") is paused at `waitForEvent("manager-approval")`. It has
  already run `createAccounts` and `sendWelcomeEmail`.
- *User:* "use the new template and also invite her to #eng." The agent edits the plan.
- *Right pane:* `✓ createAccounts reused · ⚠ sendWelcomeEmail already sent with the OLD template (inputs differ), will not
  re-send [accept / resend] · + slack.invite('#eng') new`.
- Then the agent "tidies" a step name. The view turns red: `✗ DUPLICATE: renaming sendWelcomeEmail → sendWelcome will
  e-mail Alice twice` (Cloudflare and Inngest would do this silently).
- Tweet: *"Your workflow engine was about to email the customer twice. Diff your code against the program's past before
  it resumes."*

**The gap (F/I):**
- Temporal's replayer catches only command-sequence divergence and ignores inputs ([forum](https://community.temporal.io/t/deterministic-workflows-replay-and-activity-arguments/12249)).
- Inngest warns only on reordering ([docs](https://www.inngest.com/docs/learn/versioning)).
- Cloudflare documents no deploy-during-run behaviour ([rules](https://developers.cloudflare.com/workflows/build/rules-of-workflows/)).
- Vercel avoids the problem by pinning and offers cancel + rerun from scratch ([doc](https://app.unpkg.com/workflow@5.2.0/files/docs/foundations/versioning.mdx)).
- DBOS lets an operator *choose* a fork step by hand ([docs](https://docs.dbos.dev/typescript/tutorials/workflow-management)).
- Diagrid, a vendor comparing others, says none of DBOS, Inngest or its own Catalyst moves in-flight runs safely without testing ([FAQ](https://www.diagrid.io/faq/alternatives-dbos-inngest/what-strategies-do-catalyst-dbos-and-inngest-support-for-deploying-new-workflow-code-versions-without-brea)).
- Closest lineage: Erlang `code_change` and dynamic software updating (state migration, not effect accounting); Hazel
  fill-and-resume (pure programs, no effects); Unison (old code keeps running by hash, no upgrade analysis).
- **I found no tool that computes the *effect* consequences of an edit against a recorded journal.**

**Why a compiler is needed (I):**
- Cloudflare's `step.do(name, closure)` has no explicit arguments. Its inputs are the closure's **captured free variables**.
- The pass finds those captures and records a canonical hash of their values at call time.
- It also hashes each step body together with its same-module callees (Unison-style content addressing).
- From tool type annotations it attaches an effect class (read vs write) to each call site. Reads are safe to refresh;
  writes are not.
- This is the one place in this lens where static program knowledge is irreplaceable and the platform does not already
  have it.

**Pain evidence (F/M):**
- Restate's "hardest problem" (2024).
- Temporal built a whole product, Worker Versioning (GA 2026-03), around it.
- Vercel #13 (7 reactions; the maintainer says they are building in-flight upgrades) and #99 (12 upvotes); the Vercel
  forum thread (2026-01).
- Vercel's own blog (2026-08) calls patching code "full of version flags".
- **Weak spots:** the counts are small (tens of reactions, not hundreds). I found **no public incident report** of a
  duplicate effect caused by a renamed step. The incidence is unmeasured.

**Survives better models (I):** yes. Better agents edit durable plans more often and keep runs alive longer (approvals,
schedules), so collisions between code versions and live runs grow. A perfect model still has to *see* the journal: the
check is exact ground truth, not a skill that better models make obsolete. Score 4, not 5: a strong model given the
journal could do much of this reasoning itself.

**Would Cloudflare/Vercel ship it (I):**
- **Vercel likely will ship *something*.** The maintainer said so in Oct 2025. As of the 5.2 docs it is cancel + rerun.
- Cloudflare's step-name cache makes it a natural engine feature too.
- So the honest framing is an **open-source checker they would adopt**, not a moat. It can target Vercel's open "World"
  event-log spec and Cloudflare's local Workflows. This is the brief's lesson (b) risk, and it lowers the Gap score.

**First version in 2–3 weeks (I/E):**
- **Week 1:** a TS compiler-API pass over workflow files. It builds a step-site table (key expression, enclosing function,
  normalized body hash plus same-module callees, captured-variable list, effect class from tool types or `@effect`
  JSDoc). It also adds a `step.do`/`"use step"` wrapper that records input hashes as sidecar journal metadata.
- **Week 2:** a dry-replay engine. It runs the new source in a Node vm or workerd with steps served from the journal,
  seeded `Date`/`Math.random`, and writes stubbed out. It produces a classification plus a JSON/HTML replay diff, with
  adapters for Cloudflare Workflows (miniflare), Vercel Workflow (local world event log) and Code Mode `step()`.
- **Week 3:** an MCP tool `check_edit(run, newSource)` so an agent revising a Dynamic Workflows plan gets the diff before
  it deploys; the kill-test corpus run; the demo.

**The expert reply that would kill it (I):** "Nobody edits code under long runs except to fix bugs, and for bugs you
*want* re-execution. Pin, and continue-as-new at boundaries. Agent-written plans live for minutes, so pinning covers them."
The partial counter is Cloudflare's Dynamic Workflows design and the days-long approval waits it advertises. Whether that
counter holds is exactly what the kill test measures.

**Kill test (E):**
1. **Corpus.** Collect ≥30 public repos that use Cloudflare Workflows, Vercel Workflow, Inngest or Temporal-TS. For every
   commit that touches workflow code, simulate runs paused at each step boundary of the old version and dry-replay them
   on the new version. **Kill** if fewer than 5% of workflow-touching commits create a *write* hazard (classes 1, 3, 4).
   Also kill if ≥80% of the hazards are already caught by an engine (Temporal nondeterminism, Inngest warning).
2. **Agent edits.** Have a model make 50 realistic mid-run edits to agent-written Dynamic Workflows plans. **Kill** if the
   write-hazard rate is under 5%.
3. **Noise.** **Kill** if false positives exceed 20% of flagged items after the effect classes are applied.
4. **Owner.** **Kill** if Vercel ships effect-aware in-flight upgrade checks before week 3.

### 5.2 Choreographic Code Mode: one program, projected onto browser + Worker + Durable Object

**One sentence (I):** the model writes one TS program whose values carry placement types (`@browser`, `@worker`, `@do`).
A compiler projects it into per-location programs connected by Cap'n Web, and it rejects the program statically if a
browser-only value would cross to the server.

**Demo (I):** "Reconcile my 2 GB local CSV against our CRM". The join runs in the tab and the CRM calls run in the
Worker, and a live wire meter shows 41 KB crossed and the raw rows never left the tab.

**Gap (F/I):**
- Choreographies with endpoint projection exist as libraries: HasChor ([ICFP 2023](https://arxiv.org/abs/2303.00924)),
  ChoRus, and census-polymorphic choreographies with a **TypeScript** implementation
  ([PLDI 2025](https://pldi25.sigplan.org/details/pldi-2025-papers/47/Efficient-Portable-Census-Polymorphic-Choreographic-Programming)).
- Multitier lineage: Hop.js, Links, Eliom, ScalaLoci; React's `"use server"`/`"use client"` and Vercel's directives are
  the mainstream form (**F canonical**).
- Not occupied: model-written choreographies with a static locality guarantee for Code Mode.

**Pain (I):** only the teleport round's local-data hypothesis (`teleport/05`). I found no external evidence (issues,
threads) of people asking for it. **Survives better models:** partly; locality and privacy are constraints, not skills.
**Cloudflare/Vercel:** wouldn't build it soon; too PL-heavy.
**v1:** a TS transform plus Cap'n Web stubs for two locations. **Kill reply:** "the model just writes two programs and an
RPC; the type check is decoration." **Kill test:** on 20 locality tasks, if the model's own two-program split leaks data
or fails in less than 10% of cases, kill.

### 5.3 Durable-dialect checker: `tsc` rules for model-written durable TS

**One sentence (I):** a type-checker plugin that rejects, *before deploy*, the durable-code bugs models make:
- non-serializable values live across an `await` (Guild: "the compiler does not warn you");
- `Date.now`, `Math.random` or `fetch` outside steps;
- non-deterministic step names;
- side effects in workflow bodies.

**Gap (F):**
- Temporal ships `workflowcheck` for **Go**, because Go has no restricted runtime ([docs](https://docs.temporal.io/develop/go/best-practices/multithreading)).
- Vercel validates Node API imports at build time ([how it works](https://workflow-sdk.dev/docs/how-it-works/code-transform)).
- Cloudflare's rules are prose ([rules](https://developers.cloudflare.com/workflows/build/rules-of-workflows/)).
- I found no TS checker for Cloudflare Workflows.

**Pain (I):** plausible, but undocumented in issue counts. **Survives better models:** weakly; better models make fewer
of these mistakes. **Cloudflare/Vercel:** would happily adopt it or write it themselves in a week. It is useful mainly
as **week 1 of §5.1** (the same compiler pass).

## 6. Ranked top 3 (ideas new to this lens), plus the prior-round survivor re-scored

| Idea | Cool | CF/Vercel | Gap | Value | Survives 10–100× | Not GrowOS | Total /30 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **1. Replay diff / edit-and-continue (§5.1)** | 3 | 5 | 3 | 3 | 4 | 5 | **23** |
| 2. Choreographic Code Mode (§5.2) | 4 | 4 | 3 | 1 | 3 | 5 | 20 |
| 3. Durable-dialect checker (§5.3) | 1 | 5 | 3 | 2 | 2 | 5 | 18 |
| *(flip2 #1, re-scored) Effect manifest + batched approval* | 2 | 5 | 3 | 4 | 5 | 5 | 24 |
| *(answer to the lens) A new language* | 4 | 4 | 1 | 1 | 2 | 5 | 17 |

**I — On the re-scored row:** on raw score the effect manifest edges ahead. Quasar's measured 26–97% fewer approvals is
new evidence the `flip2` report did not have. I score its "Cool" at 2 because the builder already judged it not exciting,
and I do not re-pitch it. If the builder reconsiders, Quasar plus the `flip2` design is the starting point.

**THE ONE PICK: Replay diff, the compiler pass plus dry replay that shows what an edit does to a running program's past
before it resumes.** It is the only piece of the "durable / teleportable / effect-typed TS" vision that is not already
shipped by Cloudflare, Vercel, Pydantic or the workflow vendors. It uses the builder's teleport thread (move a run across
*versions*, not hosts) and Code Mode (agents editing their own durable plans). Confidence: **medium-low**. Run the corpus
kill test before building the demo.

## 7. Five-line TL;DR

1. **F/I:** A new language is not worth it. Models write TS best (Octoverse #1; type-constrained TS decoding), novel syntax costs accuracy, and Quasar had models write a familiar subset that it transpiles.
2. **F:** Durable, pause-at-await, forkable, capability-safe Code Mode is taken: Vercel Workflow (SWC + QuickJS snapshots), Cloudflare Code Mode's durable runtime and Dynamic Workflows, Monty, Zapcode, Guild, Golem.
3. **F:** The open seam is changing code under a running program. Vercel pins and cancels, Temporal patches by hand, Inngest and Cloudflare silently reuse or re-run steps by name, and Temporal ignores changed inputs.
4. **I:** Pick: a TS compiler pass plus dry replay that diffs an edit against the run's journal (stale / orphaned / duplicate effects) before it resumes. It matters most for agent-written Dynamic Workflows.
5. **E:** Kill it if <5% of workflow-touching commits in 30 repos, or of 50 agent mid-run edits, create a write hazard, or if Vercel ships effect-aware in-flight upgrades first.

## 8. Rejected ideas (one line each)

- **New language "Await":** every property is taken (Unison, Golem, Vercel, Cloudflare, Quasar); novelty costs accuracy; Darklang and Wing show the cost of building the ecosystem.
- **Pause-at-any-await compiler pass:** Guild, Zapcode, Monty and Vercel QuickJS exist, and replay at the host boundary makes Code Mode durable without a compiler.
- **Durable Code Mode:** Cloudflare's codemode runtime (`approve()` via replay) and Dynamic Workflows ship it.
- **Content-addressed TS as a product:** Unison 1.0 owns it; kept only as a mechanism inside the pick.
- **Typed holes / fill-and-resume for agents:** persistent REPL kernels already give the loop; Hazel is the formal prior art.
- **LLM-native diagnostics:** shrinks as models improve; MoonBit/Elm already pitch it.
- **Crash-at-every-await testing as a separate tool:** Temporal's replayer and DST tools cover it; folded into the pick.
- **Replay receipts / cheap verification:** killed in earlier rounds.
- **TS-to-Wasm durable agents:** Golem, quickjs-wasi and the earlier capsule rounds cover it.
- **Effect manifest / batched approval:** not rejected on merit; it is the `flip2` survivor the builder declined, now with Quasar as extra evidence.
