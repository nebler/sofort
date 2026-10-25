# Brief: podcast ideas → Fern (shared by all research agents)

## Context
- **Podcast:** Next Token Ep 07, "What's after Code Mode" (recorded 2026-10-12).
  - Speakers: Dillon Mulroy (Cloudflare), Rhys (Executor), Sunil Pai (Cloudflare), Matt Carey (Cloudflare).
  - Clean transcript with per-minute timestamps: `arch/research/next-token-ep07-transcript.txt`, under `/Users/noah/.t3/scratch/2026-10-23-is-there-a-way-we-5a54f52b/`.
- **Fern** (Noah's project; Go; read-only for you): `/Users/noah/code/ai/fern`.
  - Read `README.md`, `docs/architecture.md`, `docs/roadmap.md`, and `docs/design.md` as needed.
  - In short: every T3 Code agent thread gets a copy-on-write environment (code + deps + running Postgres) on k3s with btrfs and gVisor.
    - It starts from a golden snapshot, sleeps when idle, wakes on touch, snapshots every turn, and can rewind or fork with the conversation.
    - Components: a Go daemon (actor per environment), a CSI driver, an operator, agent-sandbox `Sandbox` objects, a front door with `/hooks` webhooks, and an identity component (GitHub App broker).
    - Agent MCP tools: `env_snapshot`, `env_restore`, `env_fork`, `env_exec`, `env_delete`.
    - Self-hosted, using the user's own Claude/Codex subscriptions. It deliberately does NOT proxy subscription logins.
  - Noah's goals: (a) a strong Go / Kubernetes / distributed-systems CV signal (Grab), and (b) a Twitter-worthy demo.
- **Cloudflare OS** (Kenton Varda, Apache-2.0) is cloned at `/tmp/ref-repos/cloudflare-os`, and Cap'n Web at `/tmp/ref-repos/capnweb`.
  - Cloudflare OS concepts: Gadgets, Blueprints, and Gatekeepers (capability-based, simulated side effects, deferred batch approval).
  - Code-mode agent, Cap'n Web RPC.
  - See `README.md` and `plans/`.
- **Out of scope** (already decided, do not propose): jitk, a micro-VM/unikernel runtime we are building separately, and Fern itself. You may mention where jitk would plug in, in one line, but do not research it.
- **Lens:** prefer ideas whose value GROWS as models get better and inference gets cheaper. Cheaper inference means more agent volume, so execution cost, latency, trust and integration become the bottleneck. Flag ideas that are crutches for weak models.

## Rules
- Do web research and cite URLs. Separate fact from inference. Be skeptical of vendor claims.
- You may clone public repos into `/tmp/ref-repos/<name>` (depth 1) to read the source. Do not write anywhere else except your output file. Do not modify Fern.
- Keep it concrete. For each idea, name the exact Fern component or API it would touch (cite `docs/architecture.md` sections).

## Output (your file, ~900–1300 words)
For each idea in your area:
1. **Idea + podcast timestamp**, 1–2 lines.
2. **What already exists**: projects, products and specs, with status, links and maturity.
3. **Fern fit**: where it plugs in, and what changes.
4. **Verdict**: ADOPT (use an existing thing) / BUILD (our own, and why existing options fail) / SKIP. Include effort in days or weeks.
5. **Model trend**: grows / neutral / shrinks.
6. **Signal**: Twitter (1–5) and CV (1–5).

End with your top 3 recommendations, ranked, and one paragraph of open risks. Return a summary of 150 words or less.
