# Brief: product round — how and where to fill the product gaps (2026-10-28)

## Read first
- `arch/PRODUCT-GAPS.md` — the gap table and suggested order. This round answers *how* and *where* to fill each gap.
- `demo.md` (positioning, TL;DR, decisions) and `arch/research/pitch/01–09` (value audit, hosting landscape, agentic
  coding, economics, pitch, four demo angles). Do NOT repeat them; build on them, and say where they are now stale.
- `arch/research/landscape.md`, `arch/research/cloudflare.md`, `arch/research/flip/` + `flip2/` TL;DRs if relevant.
- Current numbers: `arch/research/perf/SUMMARY.md`, the latest bench results under `arch/jitk/` (grep for `RESULTS`),
  `review/R9-ARCH-QUALITY.md`. Facts as of today: ~1.1 ms `execute()` and ~1.7 CPU-ms per run on the Linux shard
  (nested KVM, indicative), ~0.5 MiB per VM, roughly at parity with Hyperlight per VM (HL ~4% lower). aarch64 only.

## Context on the owner
Solo engineer (platform engineer, Germany). Sofort/jitk is also a CV capstone for a move to Kuala Lumpur, so audiences
include hiring managers and engineering communities in KL/SEA, not only investors or users. Time and money are limited:
favour moves one person can do in days to weeks, and give a cost for anything that costs money.

## Questions every report answers (for its own angle)
1. For each gap it touches: the cheapest credible way to fill it, the place to do it (provider, community, venue, tool),
   cost in money and days, and what it unlocks next.
2. **Demos:** concrete demos this angle enables — what the viewer sees in the first 10 seconds, what is real vs staged,
   what number appears on screen, what could go wrong live.
3. **Value gaps:** where a gap blocks someone from getting value (which user, which job), versus gaps that only matter
   for looks. Be honest when a gap does not matter yet.
4. **Presentations:** what to show to whom (talk, post, deck, interview), with the claim it can honestly carry today.

## Rules
- Write ONLY your own report `arch/research/product/NN-<topic>.md` (named in your task). No other edits, no commits, no push.
- Extensive web research expected; cite primary sources with links and dates (today 2026-10-28). Prices and terms change:
  date them. Label claims **F** sourced, **M** measured, **I** inference, **E** estimate. Never write "first"/"unhackable".
- Pure research by default; tiny local experiments only if decisive: scratch in `/tmp/product-<topic>/`, under 200 MB,
  deleted at the end. No Docker, don't touch the kvm-dev VM, no accounts, signups, deploys, purchases or posts.
- End with: ranked top 3 moves, the ONE move to do first, a 5-line TL;DR, and rejected ideas with one-line reasons.
