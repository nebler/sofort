# Architecture round — shared brief

Project: **Sofort** (kernel: **jitk**). Repo `/Users/noah/code/sofort` (git, main).
"Just-in-time, purpose-built computers that agents talk to over MCP": agent-written code (JS via QuickJS,
Lua, later native tools like rg/sqlite3/jq) runs in single-use microVMs on a tiny no_std Rust arm64
kernel that grows offline via an agent + differential tests against Linux.

**The two metrics that decide everything: memory per VM and performance (latency + CPU per run) —
i.e. SCALE.** Every component you propose must state its memory and latency/CPU cost per VM / per call,
and why it is the cheapest option. Convenience choices on the runtime path are not acceptable
(no Python/helper processes on the hot path, no per-call process spawns). Simplicity is judged by
moving parts and "fits in one head", not lines of code.

Inputs — read these first, in this order:
1. `arch/research/next/SYNTHESIS.md` (the lead's merged verdict — treat as requirements)
2. `arch/research/next/01..05-*.md` (the five research reports; go to them for evidence/numbers)
3. `arch/FINAL.md`, `arch/PLAN-R5.md`, `arch/research/third-option.md`, `arch/research/cloudflare-deep.md`
4. `arch/jitk/README.md`, `arch/jitk/CONTRACTS.md`, `arch/jitk/docs/ARCHITECTURE.md`, `docs/KILL-CRITERIA.md`
5. The code you need: `arch/jitk/{kernel,vmm,executor,mcp,protocol,grow,bench}`.

Deliverable: a concrete architecture — **how we actually wire everything together** — written to
`/Users/noah/code/sofort/arch/architecture/<your-file>.md` (4,000–8,000 words, diagrams in ASCII/mermaid). Must include:
- Component list with ownership boundaries; process/thread model on Linux/KVM and on macOS/HVF.
- Guest memory layout and the snapshot lifecycle (build → prepare → snapshot → restore → reset → discard),
  with what is shared vs private and a **per-VM memory budget table** (bytes, by component).
- Full request lifecycle from MCP `execute` → result, with a **latency and CPU budget table** (µs per step).
- Host↔guest transport (ring/doorbell/WAIT), tool calls, `/mcp/` + `/cap/` files, Cap'n Web stubs, grants →
  recipe → content hash → cached snapshot; late-bound capabilities.
- Reset/uniqueness contract, failure containment, and kill/timeout path.
- How the grow loop and per-recipe policy fit (offline), and native binaries (loader changes needed).
- What we keep, change and delete from today's code (file-level).
- Build order with gates: each step has a measurable pass/kill criterion tied to the experiments in SYNTHESIS.md.
- Explicit risks and what would make you abandon this design.
- Every external number cited (link to the research reports or sources); mark estimates as estimates.

Rules: design only. Do not edit any file except your output file; no commits; no cloud; never touch
/tmp/arch-R2C, ~/.local, or global toolchains. Small local measurement probes are allowed only inside
`/tmp/sofort-arch-<your-letter>/` and must not change the repo. Node is at /tmp/jitk-09/node-real.
