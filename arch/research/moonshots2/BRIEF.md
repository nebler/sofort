# Brief: round 2 moonshots — compute, compilers, older CS, and problems that get WORSE with better models (2026-10-27)

## Context
Round 1 (`arch/research/moonshots/01–07`, read their TL;DRs and top bets) converged on one thesis: generation is becoming
free, acceptance/verification is scarce (Oracle Foundry, failure-search gate, notarised computation, fault-grown Node,
immune repair). The builder challenges it: **what if models get so good they don't need verification?** Ideas must
survive that. The builder's rule: anything we build looks 2–5x less exciting when the next model drops, so aim 100–1000x higher.

Stay in or adjacent to the Cloudflare + TypeScript universe (Workers, Durable Objects, R2, Workers AI, the CDN, browsers,
Node, Wasm; scriptc = TypeScript→native compiler the builder already uses). Existing assets: jitk (tiny Rust kernel whose only
I/O is one tool channel; syscalls grown by agents and checked against a Linux oracle = GrowOS), QuickJS/Wasm capsules
(running state as a small forkable file), scriptc. Read `arch/research/v8/02-landscape.md` for prior art on capsules.

## The key search direction
Find problem spaces that get **worse, not better,** as models improve. Example: compute. Better models are used for more
tasks, longer, with more tokens per task (Jevons paradox), so inference compute, energy, latency, memory bandwidth, GPU supply
and cost all grow. Other candidates: agent traffic hitting origins/APIs, latency of long agent chains, data movement, the
volume of generated code to run/maintain, reproducibility, dependency churn, human attention. Ideas that turn these
growing pains into a product are model-proof by construction.

## Per idea (aim for 6–10, then rank)
1. One sentence + the 100x version.
2. **The worsening problem it attacks**, with numbers and sources (how fast is it growing? who pays?).
3. **Superhuman-model test:** assume models 100x better than today. Does the idea still matter, matter more, or vanish? Why?
4. **What it looks like at scale in ~2030** (concretely: who runs it, how big, what flows through it).
5. Lineage: the older CS/compiler/systems idea it revives (cite primary sources), why it stalled, what is different now.
6. Value: who pays and for what.
7. First proof in 1–2 weeks (TypeScript/Wasm/Cloudflare; small, measurable).
8. Demo + draft tweet that survives an expert reply.
9. Kill test.
Label claims: **F** sourced, **M** measured, **I** inference, **E** estimate.
End with: ranked top 3, the ONE bet, a 5-line TL;DR.

## Rules
- Write ONLY `arch/research/moonshots2/NN-<lens>.md` (named in your task). No other edits, no commits.
- Web research expected; cite with links and dates (today is 2026-10-27).
- Small local experiments welcome if they decide something; scratch in `/tmp/moonshot2-<lens>/`, keep small (disk ~16 GB free).
  No Docker prune/restart; don't touch the kvm-dev VM.
- Ambitious in generation, ruthless in evaluation.
