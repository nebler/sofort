# Brief: old ideas whose economics flipped (2026-10-28)

## Why this round exists
Earlier rounds searched for NEW ideas anchored on a technology (capsules, teleporting programs) or on a scarcity, and
everything dissolved: someone already built it, or plain alternatives were good enough. The one thing that held up was
GrowOS: an agent grows a minimal kernel's syscalls on demand, each piece checked against Linux as an oracle (81% of a
program corpus passes on held-out programs). It works because it revives an OLD, technically right idea (unikernels, ~2013)
that died from manual labour — the long tail of compatibility — which agents can now absorb.

So this round does not ask "what's new?". It asks two questions across ALL of computer science:

**Lens A — the graveyard.** Which technically right ideas died (or stayed niche) because of manual labour, long-tail effort,
or expert scarcity, and could flip now that writing code is nearly free, agents loop for hours without a human, and checking
is cheap? Strongest when an **oracle** exists (an original system, reference implementation, test suite, spec, old outputs)
so results can be checked automatically. Examples to calibrate (do not stop at these): unikernels, formal verification
(seL4 ≈ 20 person-years), Wine-style API compatibility, legacy migration, superoptimisation, literate programming.

**Lens B — needed more than ever.** Which old ideas become MORE necessary because of the new scale and demand (agents and
beyond: 10–100x more code, commits, branches, CI runs, requests, sandboxes, identities, data)? Calibration example: version
control strained at monorepo scale and big companies rebuilt it (Google Piper, Meta Sapling/Mononoke, Microsoft VFS for
Git/Scalar) — verify any such claim before using it. Look for systems built for human-scale assumptions that break at
agent scale, and the old idea that fixes them.

Smart people had these ideas decades ago. Read primary sources (papers, essays, theses) and say what they actually proposed.

## Per idea (aim for 8–12, then rank)
1. The idea in one sentence; who proposed it, when (primary source).
2. Why it died or stayed niche (cite evidence: post-mortems, papers, adoption data).
3. What flipped: labour cost, oracle availability, new scale/demand — be specific; numbers with sources for 2024–2026.
4. Oracle: what can automatically check the result? (none / weak / strong)
5. Superhuman-model test: does a 100x better model make this MORE valuable or obsolete?
6. Who is already doing the revived version in 2025–2026 (prior art search — this killed earlier rounds; be thorough).
7. Value: who pays, for what, rough size.
8. A 2-week proof a single engineer could build (any stack; Rust/TypeScript preferred; the GrowOS loop —
   fault → agent writes piece → differential test vs oracle → accept — is available but not mandatory).
9. Demo + one tweet; the expert reply that would kill it; kill test.
Label claims **F** sourced, **M** measured, **I** inference, **E** estimate. Never write "first"/"unhackable".
End with: ranked top 3, the ONE bet, 5-line TL;DR, and which ideas you rejected and why (one line each).

## Rules
- Write ONLY your own report `arch/research/flip/NN-<topic>.md` (named in your task). No other edits, no commits, no push.
- Web research expected; cite primary sources with links and dates (today 2026-10-28).
- Pure research by default. If a tiny experiment decides something: scratch in `/tmp/flip-<topic>/`, under 200 MB, delete at end.
  No Docker, don't touch the kvm-dev VM, no accounts or deploys.
- Ambitious in generation, ruthless in evaluation. "Someone already does this well" is a valid, important finding.
