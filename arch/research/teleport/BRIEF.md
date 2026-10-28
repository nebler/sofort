# Brief: teleporting programs — JS that pauses on one machine and resumes on another (2026-10-28)

## The idea
A running JavaScript program pauses mid-`await` and resumes on another machine — another Cloudflare Worker / Durable Object,
another city, a browser tab, a phone — with all its state, never restarting. It can also fork into N copies.
Mechanism we already proved in a spike: QuickJS compiled to wasm32 running inside V8; the whole engine state is one
linear-memory byte array; at an awaited host call the Wasm stack is empty, so memory + a small header is a complete,
portable snapshot (~100 KB gzip). Imports are the whole ABI: tool call, clock, random, log.

This is **separate from Sofort/jitk/GrowOS** — pure TypeScript/Wasm/Cloudflare/browser. Do not pitch jitk.

## The builder's new angle (take it seriously, test it ruthlessly)
"Compute is getting scarcer — but if programs can move, we can distribute the compute." Programs that go to wherever
capacity is free/cheap/green/close: idle user devices (laptops, phones, browser tabs), cheap regions, the data's location,
the machine where the model/GPU has room. Be precise about WHICH compute is scarce (GPU/HBM inference vs CPU glue vs
network/origin) and whether moving a JS program actually relieves it.

## Existing evidence (read first, do not redo)
- `arch/research/v8/01-architecture.md … 06-signal.md` (+ BRIEF.md): architecture, prior-art landscape (Vercel quickjs-wasi /
  Workflow snapshot recovery, Golem, Temporal, Restate, Wasmer WASIX, XS, LangChain quickjs-rs), roadblocks (16 MiB cap not
  enforced, linear memory never shrinks, real snapshots 1.5–6.4 MB, interpreter 5–11x slower than V8 JIT), tech stack, demos, signal.
- `arch/research/portability/02-wasm.md`: Oct 25 spike numbers. Raw spike files (read-only):
  `~/sofort-local-evidence/portability-wasm-2026-10-25/`.
- `arch/research/moonshots2/05-systems.md` and `01-compute.md` (compute-scarcity numbers; "a parked JS heap is not a parked KV cache").

## Rules
- Write ONLY your own report `arch/research/teleport/NN-<topic>.md` (named in your task). No other edits, no commits, no push.
- Web research expected; cite primary sources with links and dates (today 2026-10-28).
- Label claims: **F** sourced, **M** measured by you, **I** inference, **E** estimate. Never write "first"/"unhackable".
- Disk is tight (~12 GB free): scratch in `/tmp/teleport-<topic>/`, keep it under 1 GB, delete big artifacts at the end
  (keep small result JSON). No Docker prune/restart; don't touch the kvm-dev VM. Any spawned processes must be cleaned up.
- No paid cloud accounts or deploys; local Node / Chromium / workerd (wrangler dev) only.
- End with: 5-line TL;DR, verdict (go / go-with-changes / no-go for your angle), the 3 next steps.
