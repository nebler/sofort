# Brief: the deep round — one buildable thing in the TypeScript / Cloudflare / Vercel world (2026-10-28)

## The builder's criteria (ALL must hold; small is fine)
1. **Cool** — a demo people share; a strong X/HN signal.
2. **Cloudflare/Vercel adjacent** — Workers, Durable Objects, Dynamic Workers, Containers, R2, D1, Queues, Workflows, Workers AI,
   AI Gateway, Browser Rendering, Cap'n Web, Code Mode; Vercel Functions/Fluid, Sandbox, Workflow, AI SDK, just-bash; browsers,
   Node, Deno, Bun, Wasm. New languages, Wasm rewrites, compilers are all allowed.
3. **Fills a real gap** — verified by a prior-art search (GitHub, npm, product docs/changelogs, papers). Name what is closest.
4. **Value** — someone concretely benefits; evidence of the pain (issues with many reactions, forum threads, numbers).
5. **Survives better models** — still matters, or matters more, when models are 10–100x better.
6. **NOT GrowOS** — not the builder's agent-grown kernel/syscall loop, not built on it, not jitk-dependent.
It is a side/open-source project, NOT a startup. It does not need a business model; it needs users who care.

## What earlier rounds found (read the TL;DRs; do not re-pitch killed ideas as new)
Folders under `arch/research/`: `v8/`, `moonshots/`, `moonshots2/`, `teleport/` (01–10), `flip/`, `flip2/`, `split/`.
- **Taken or killed:** QuickJS/Wasm heap snapshots + fork/move (Vercel quickjs-wasi, Weave, Golem); "immortal Workers"
  (Vercel Workflow ships QuickJS snapshots; Workflows/Temporal/Inngest/Trigger.dev); agent JIT / trace compilation
  (Muscle-Mem, PreAct, Agent JIT, SKILL-DISCO, TraceCompiler); agent fleets idle hosting (DO hibernation, E2B pause);
  brain-on-DO + hands-on-demand coding agent (`cloudflare/computer`: DO-SQLite FS, just-bash in Dynamic Workers, container
  FUSE sync, Pi example; Pi itself ships `pi-durable` + a Cloudflare codemode adapter); agent-grown Node compat (Deno's official
  node-compat agent skill; Deno joined Cloudflare 2026-10-09; workerd already passes ~88% of tested packages); origin work
  scheduling (Cloudflare's own Pay Per Crawl/AI Crawl Control); GPU kernels/distributed training/numerics (labs own the checks);
  generic verification-as-a-product; idle-device compute; Code Mode performance tricks (batching, pipelining — Cap'n Web, LLMCompiler).
- **Survived, but the builder found them not exciting enough:** information-flow labels for Code Mode (CaMeL-style, no shipping
  runtime enforces it); post-merge integration (land first, flake-aware culprit finding, auto-revert — Anthropic merges 30k/day,
  GitHub 2.9B commits/month); evidence gates for agent experiments; lease/GC for agent resources.
- **Lessons:** (a) a desk-generated "plausible" idea is usually already built — prior-art search decides; (b) whoever owns the
  check/platform wins (Cloudflare will build platform features itself — look for things Cloudflare/Vercel would NOT build, or
  would happily adopt); (c) value claims must name a beneficiary and evidence; (d) mechanisms are not products ("it moves",
  "it snapshots" are not value).

## The builder's own threads (combine freely)
Ambition 100–1000x; old technology + new science; compute getting scarcer; teleporting programs; Code Mode; distributed compilers;
agent fleets; extending Workers' lifespan; running Pi in Workers; Durable Objects; rebuilding git-like tools for agent scale;
rewriting things in Wasm; a new programming language; "teleport + codemode".

## Per idea (generate 10+, keep the best 3–4 after self-critique)
One sentence → the demo in 30 s → the gap (closest prior art, with links, and why it does not cover this) → the pain evidence
(links, counts) → why it survives better models → why Cloudflare/Vercel would not simply ship it (or would adopt it) → what a
first version looks like in 2–3 weeks (TypeScript/Wasm, Cloudflare/Vercel) → the expert reply that would kill it → kill test.
Label **F** sourced, **M** measured, **I** inference, **E** estimate. Never "first"/"unhackable".
End with: ranked top 3 against the six criteria (score each 1–5 per criterion), the ONE pick, 5-line TL;DR, rejected ideas (one line each).

## Rules
- Write ONLY `arch/research/deep/NN-<lens>.md` (named in your task). No other edits, no commits, no push.
- Deep web research expected; cite primary sources with links and dates (today 2026-10-28). Search GitHub issues/npm/HN directly.
- Small experiments allowed if decisive: scratch `/tmp/deep-<lens>/`, under 500 MB, delete at end. No Docker, no kvm-dev VM,
  no accounts/deploys/paid APIs. Local workerd binary: `~/sofort-local-evidence/portability-wasm-2026-10-25/workerd/node_modules/@cloudflare/workerd-darwin-arm64/bin/workerd`.
- Neutral wording for isolation/security topics.
- Ambitious in generation, ruthless in evaluation. Rejecting everything is allowed if honest — but then say what came closest.
