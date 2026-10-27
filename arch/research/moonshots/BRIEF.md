# Brief: 100x moonshots built on the capsule idea (2026-10-27)

## Why this round exists
The builder's rule: whatever we work on will look 2–5x less exciting when the next model drops. So aim for ideas with
100–1000x the ambition — "batshit, possibly impossible" — that still create real value and make a strong public (X/HN) signal.
Stay in the Cloudflare + TypeScript universe (Workers, Durable Objects, Dynamic Workers, R2, Queues, Workflows, Containers,
workerd, the browser, Node), or adjacent when another stack clearly helps. Ideas should get MORE valuable as models get
stronger, not be eaten by them.

## The seed idea
A program's whole running state can live in a small file. Concretely: QuickJS (or quickjs-ng) compiled to Wasm runs inside
V8; its entire engine state is one linear-memory byte array, so a program parked on an awaited tool call can be snapshotted,
forked, moved between browser / server / edge, and replayed from a journal of its few imports (tool, clock, random, log).
The sibling project jitk does the hardware-isolated version: a tiny Rust unikernel-like kernel whose ONLY I/O is one tool
channel, and whose syscalls are *grown by an agent* and differentially tested against Linux ("GrowOS").

## What is already known (don't re-pitch these as new)
- Snapshotting a QuickJS-in-Wasm heap with pending promises is prior art: Vercel Labs `quickjs-wasi` (+ Vercel Workflow
  snapshot recovery, merged 2026-10-01), LangChain `quickjs-rs`; XS Sandbox ships ~85 kB browser/Node heap images.
- Durable execution (Temporal, Restate, Golem, Cloudflare Workflows), sandboxes (E2B, Daytona, Modal, Dynamic Workers,
  Rivet agentOS), code mode (Cloudflare) all exist.
- Measured limits of the seed: real snapshots 1.5–6.4 MB compressed; interpreter-in-Wasm 5–11x slower than V8 JIT on glue;
  QuickJS memory caps not trustworthy yet; linear memory never shrinks.
Read: `arch/research/v8/02-landscape.md`, `arch/research/v8/03-roadblocks.md`, `arch/research/v8/06-signal.md`, `demo.md` (§0, §9, §10),
`arch/research/portability/02-wasm.md`, and skim `arch/jitk/grow/README.md` for GrowOS.

## Your job
Generate ambitious ideas from your assigned lens, then pressure-test them. For EACH idea (aim for 6–10, then rank):
1. **The idea in one sentence**, and the 100x version of it.
2. **Lineage:** the old system/concept or the science it comes from (cite primary sources), and what was learned there
   (including why it failed or stalled then, and what is different now with agents + edge + Wasm).
3. **Why it gets better with stronger models** (or why it doesn't — then drop or demote it).
4. **Value:** who would pay or depend on it, and for what.
5. **First proof in 1–2 weeks** in TypeScript / Cloudflare / Wasm: the smallest experiment that would show it's real.
6. **Demo + hook:** the 30–90 s video idea and a draft tweet. The hook must survive an expert reply (no "first", no
   unlabelled fakes).
7. **Kill test:** the single result that would prove it's not worth it.
8. Labels on claims: **F** sourced fact, **M** measured, **I** inference, **E** estimate.

End with: a ranked shortlist (top 3) with a one-paragraph case each, the ONE you'd bet on, and a 5-line TL;DR.

## Rules
- Write ONLY your report `arch/research/moonshots/NN-<lens>.md` (named in your task). No other edits, no commits.
- Web research is expected; cite with links and dates (today is 2026-10-27). Primary sources preferred.
- Small local experiments are welcome if they decide something (scratch in `/tmp/moonshot-<lens>/`, keep it small, delete
  big files; disk is tight ~16 GB). No Docker prune/restart; don't touch the kvm-dev VM.
- Be wildly ambitious in generation and ruthless in evaluation. "Impossible" is fine if you can name the first step.
