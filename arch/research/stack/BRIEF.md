# Brief: round 10 — every layer of the stack, the rigor flip, and self-extending software (2026-10-28)

## Why this round
Two posts the builder saw today:

1. **"Software is having its Industrial Revolution"** (about Alchemy / Foldkit / Effect). Frameworks used to be designed for
   human craftspeople, so they optimised for conciseness and taste. Agents write the code now, so frameworks should optimise for
   *rigor*: things humans found too verbose or too disciplined become free. The post predicts these become commonplace:
   state machines, functional programming, declarative infrastructure, TDD, DDD, actor systems, rigorous API schemas,
   type safety and formal verification, disciplined operations (monitoring, on-call).
   - [Foldkit](https://github.com/foldkit/foldkit): Elm-architecture TS frontend on Effect. The model is an Effect Schema, side
     effects are *returned as Command values*, "story tests" run the update function with commands resolved inline (no mocks),
     "scene tests" drive the real view without a browser. Pre-1.0.
   - [Alchemy](https://alchemy.run/what-is-alchemy/): "Infrastructure-as-Effects" — infra and app code in one typed Effect program,
     Cloudflare-first, v2 beta.
2. **Infinity** ([hydro-project/infinity](https://github.com/hydro-project/infinity/), Rust, Apache-2.0, ~200 stars): agent
   runtime that treats agent concurrency as a scheduling problem; between turns an agent is pure data (its history); tool results
   arrive as asynchronous events (Reactive Agent Protocol, MCP-compatible); serverless/Lambda with scale-to-zero; "75k agents on a
   Raspberry Pi". From the Hydro project (Berkeley).

**The thesis to test, layer by layer:** when the author is an agent, the cost of rigor (verbosity, discipline, ceremony,
formalism) collapses, while the *value* of rigor (a cheap mechanical check that the agent cannot game) goes up. Which old
"too rigorous for humans" techniques flip at *your* layer, and what is the buildable thing that exploits that?

**The second thread: self-extending software.** Software that grows its own features/tools/UI at runtime: generative UI
(Vercel AI SDK genUI, Google's generative UI, Claude Artifacts/imagine), coding agents that write their own extensions (Pi's
extension system, Claude Code skills/plugins, Voyager-style skill libraries), "bb" (the builder named it — find out what it
most plausibly refers to, e.g. babashka-style scriptable tooling or an agent named bb, and say which you assumed), Emacs/Smalltalk/
Lisp images, HyperCard, Glamorous Toolkit (moldable development), Ink & Switch malleable software, spreadsheets. The interesting
question is *patterns*: how does software safely extend itself, and what is the check that makes an extension acceptable?

## The builder's criteria (score every finalist 1–5 on each)
1. **Cool** — a demo people share; a strong X/HN signal.
2. **TypeScript / Cloudflare / Vercel adjacent preferred** (Workers, Durable Objects, Dynamic Workers, Containers, Workflows,
   Code Mode, Effect, AI SDK, browsers, Node/Deno/Bun, Wasm). Other layers are allowed in this round if the idea is strong, but
   say how it connects back.
3. **Fills a real gap** — verified by prior-art search (GitHub, npm, crates, papers, product changelogs). Name the closest thing.
4. **Value** — a named beneficiary and evidence of pain (issues with reactions, threads, numbers).
5. **Survives better models** — matters as much or more when models are 10–100× better.
6. **Not GrowOS** — nothing built on the builder's agent-grown kernel (jitk/GrowOS). Ignore it entirely.
Open-source side project, not a startup.

## What earlier rounds found — read first, do not re-pitch killed ideas
Read `arch/research/RESEARCH-SUMMARY.md` (all of it, ~640 lines) and skim `arch/research/catalogue/README.md` (1,109 ideas,
master index, one file per round). The catalogue is raw material: **actively look for earlier ideas that become newly viable at
your layer under the rigor thesis**, and cite them by catalogue round/report.
- **Kill list (summary §11):** QuickJS/Wasm snapshots/fork/move; immortal Workers; agent JIT; idle agent hosting; warm build
  migration; brain-on-DO coding agent (`cloudflare/computer`, pi-durable); agent-grown Node compat (Deno skill); origin
  scheduling; GPU kernel agents; distributed training ops; old numerics; LLM proposer + classic verifier (CEGIS, egg, Alive2…);
  mutation/property testing, API migration, proofs; git storage at agent scale; durable/forkable Code Mode; a new agent
  language; agent web (auth/identity/payments/MCP); TS tooling (TS 7, Vitest affected tests); Wasm ports of famous engines.
- **Still standing:** post-merge integration; Replaygate (production traffic replayed against agent PRs); replay diff (code
  changed under a running workflow re-runs effects); labelled Code Mode (information-flow control); evidence gates for agent
  experiments; follow-me Durable Objects.
- **New candidate from today (check it, attack it, extend it if it is your layer):** in effects-as-values apps (Foldkit, Effect,
  Elm-style), record production Messages-in / Commands-out traces, replay them through each agent PR's new update function and
  diff the emitted Commands ("after this PR, checkout emits SendEmail twice"); promote interesting traces to story tests.
  Generic traffic replay is already sold (Curtail ReGrade, Replay.io rerecording, RealDiff); nothing found specific to
  effects-as-values.
- **Rules learned:** a desk-generated plausible idea is usually already built — the prior-art search decides; start from pain,
  not technology; a mechanism is not a value; *flip rule*: an old idea returns only if (1) it died of per-case manual work,
  (2) a cheap independent check exists that is not graded by the same kind of model, (3) the result runs without the model,
  (4) whoever owns the check wins — outsiders win only where the check is public or spread across many customers; the platform
  owner builds every single-primitive feature itself.

## Your task (per lens; your lens is in your task message)
1. **Map the layer** briefly: what changed in 2025–26 because agents write the code (numbers, sources).
2. **Generate 12+ ideas** at your layer: rigor techniques that flip, self-extension patterns, combinations with earlier
   catalogue ideas, and anything the two posts suggest. Be ambitious.
3. **Prior-art search every idea** before keeping it. Most will die — say who killed it, with links.
4. **Keep 3–4.** For each: one sentence → 30-second demo → the gap (closest prior art with links, why it does not cover this)
   → pain evidence → the check that makes it trustworthy (and how an agent could game it) → why it survives better models →
   why the platform/framework owner would not just ship it (or would adopt it) → a 2–3-week first version → the expert reply
   that would kill it → a 1–2-day kill test.
5. **End with:** ranked top 3 scored 1–5 on the six criteria; your ONE pick; a 5-line TL;DR; rejected ideas, one line each
   with the killer.
Label claims **F** sourced, **M** measured, **I** inference, **E** estimate. Never write "first" or "unhackable".

## Rules
- Write ONLY `arch/research/stack/NN-<lens>.md` (the exact name is in your task). No other edits, no commits, no push.
- Deep web research; primary sources with links and dates (today is 2026-10-28). Search GitHub issues, npm, crates, arXiv, HN.
- Small experiments allowed if decisive: scratch `/tmp/stack-<lens>/`, under 500 MB, delete at the end. No Docker, no VMs,
  no accounts, deploys or paid APIs.
- Neutral wording for isolation/security topics.
- Ambitious in generation, ruthless in evaluation. Rejecting everything is allowed if honest — then say what came closest.
