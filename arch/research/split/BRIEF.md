# Brief: the split agent — brain on Workers/Durable Objects, hands on demand (2026-10-28)

## The project hypothesis (to be taken apart, not assumed)
Cloud coding agents today get one VM/container per session, which runs (and bills) the whole time — including the large
share of wall time spent waiting on model responses. Hypothesis: split the agent.
- **Brain:** an unmodified Node coding agent — **Pi** (the open-source Pi coding agent by Mario Zechner, repo `badlogic/pi-mono`,
  package `@mariozechner/pi-coding-agent`; verify names) — runs inside a Cloudflare Worker + Durable Object (DO). The DO holds
  session state and the agent's workspace files; it hibernates while idle.
- **Node compatibility layer:** the Node APIs Pi needs but workerd lacks are grown by an agent loop (the builder's GrowOS loop:
  failure → agent writes the missing piece → differential check against real Node, including Node's own tests → accept).
- **Hands:** shell/build/test commands run only when needed, in an on-demand isolated runner: Cloudflare Containers / Sandbox
  SDK, a TypeScript shell for simple commands, or **jitk** (the builder's microVM: ~1 ms `execute()`, ~0.5 MiB per VM, runs on
  Linux/KVM or macOS/HVF hosts — NOT inside Cloudflare).
- Claimed upside: 10–50x lower infrastructure cost/density/startup per session, instant fan-out of sub-agents. Known caveat:
  inference dominates today's bill (infra ≈ 2–5%), but inference prices fall fast while VM prices don't.

## Your job
Take your assigned layer apart: how exactly it would work, what already exists, and the **early blockers** — things that could
kill the project and must be verified first. For each blocker: why it matters, current evidence (sourced), and a **cheap
concrete verification experiment** (hours, not weeks) with a pass/fail threshold. Rank blockers by (probability × damage).
Prefer primary sources: Cloudflare docs/changelog/workerd source, Pi source code, pricing pages. Label **F** sourced,
**M** measured by you, **I** inference, **E** estimate. End with: 5-line TL;DR, go / go-with-changes / no-go for your layer,
the 3 verifications to run first.

## Rules
- Write ONLY your report `arch/research/split/NN-<layer>.md` (named in your task). No other edits, no commits, no push.
- Small local experiments are welcome when they decide a blocker. Scratch in `/tmp/split-<layer>/`, under 1 GB, delete large
  artifacts at the end (keep small result JSON). Disk ~22 GB free. A local workerd binary exists at
  `~/sofort-local-evidence/portability-wasm-2026-10-25/workerd/node_modules/@cloudflare/workerd-darwin-arm64/bin/workerd`
  (read-only; copy if needed); `npx wrangler` may be installed into scratch if under the size limit.
- No paid API/model calls, no Cloudflare account, no deploys, no Docker, don't touch the kvm-dev VM. Clean up spawned processes.
- Use neutral wording for isolation topics ("isolated runner", "execution host").
- Ruthless honesty: "Cloudflare/Vercel/someone already does this" and "this layer kills the project" are valuable findings.
