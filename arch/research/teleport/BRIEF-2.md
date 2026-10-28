# Brief round 2: where does moving a LIVE program clearly beat replay? (2026-10-28)

Read first: `arch/research/teleport/BRIEF.md` and the TL;DRs + verdicts of `01-compute.md … 05-product.md` in the same folder.
Round 1 established: the mechanism works (live QuickJS/Wasm heap hops Node→workerd→Chrome→Node, 100 forks, restore ~0.4 ms,
~20 KB deltas/hop); "it moves" is not novel (Weave, Vercel quickjs-wasi, Golem); it does not relieve GPU/HBM scarcity;
the cross-machine contract (home broker owns effects/secrets/budgets) is the unsolved, buildable part.

**The builder's demand: the idea has to have VALUE.** Find concrete situations where a movable/forkable live program is
clearly better than the alternatives: plain JSON state, journal replay (Temporal/Restate/Golem/Cloudflare Workflows),
Durable Objects with hibernation, V8 startup snapshots, containers, or just re-running.

For every candidate use case:
1. Who has the pain today, how big (numbers, sources), what they use now and what it costs them.
2. Why live state wins here specifically. Useful test: live state wins when rebuilding the state is expensive or impossible
   (long history, costly/nondeterministic inputs such as LLM calls, slow initialization) and the state is small to ship.
   Quantify both sides.
3. Value: who pays, how much, a rough business size.
4. A 1–2 week proof in TypeScript/Wasm/Cloudflare, small and measurable, with the strongest baseline named.
5. Demo + one tweet, and the expert reply that would kill it.
Label claims **F** sourced, **M** measured, **I** inference, **E** estimate. End: ranked top 3, the ONE bet, 5-line TL;DR, verdict.

## Rules
- Write ONLY your own report `arch/research/teleport/NN-<topic>.md` (named in your task). No other edits, no commits.
- Web research expected; cite primary sources with links/dates (today 2026-10-28).
- **Disk is critically low (~5 GB free).** Prefer pure research. Any experiment: scratch in `/tmp/teleport2-<topic>/`, under 200 MB,
  no npm installs over 100 MB, no browser profiles, no builds of large toolchains; delete scratch at the end except small JSON.
  No Docker at all. Don't touch the kvm-dev VM. No accounts/deploys.
- Ambitious in generation, ruthless in evaluation. Never write "first"/"unhackable".
