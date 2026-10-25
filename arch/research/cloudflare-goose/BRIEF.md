# Brief: Sofort × Cloudflare × Goose (2026-10-25)

## Goal
Find something **really cool, unique, open source, and strong on scale, cost and engineering**: something that would impress Cloudflare enough to want to hire the author, or even acquire it. Deno joining Cloudflare (2026-10-09) and VoidZero joining (2026-06-04) are the reference points.

**The author's real aim:** a frontier job, ideally Cloudflare, ideally based in Kuala Lumpur. The project is a career lever, not a startup at any cost. The author has a full-time job, so the scope has to be shippable in weeks.

## Read first
- `demo.md`: positioning and findings. Read §0, §5, §6.4, §8.1 and §9.6.
- `arch/V1.md`: the current v1 scope. It is a local MCP sandbox: jitk microVMs at ~0.5 MiB, plus native tools.
- `arch/research/primitive/04-cloudflare-signal.md`: Cloudflare's 2026 timeline, their gaps, and the scenario where they kill this idea.
- `arch/research/portability/02-wasm.md`: the Wasm-tier prototype. It already does pause, fork and move across Wasmtime, Node, Chromium, workerd and Dynamic Workers.

## Goose
Goose is Wouter van Oortmerssen's language (https://github.com/aardappel/goose, announced 2026-10-08; he previously made FlatBuffers, Lobster and Wasm work at Google). Its key properties:
- values are flat and pointer-free;
- workers share nothing, and flat values travel between them in typed queues by memcpy;
- it compiles to one C file and has a TinyCC in-process backend;
- benchmarks put it near C and safe Rust, with less memory;
- it is whole-program only, with no escaping closures or function pointers;
- the compiler is ~30k lines, mostly written by Claude Fable.

An earlier internal take (thread bb89c1b5) said:
- don't rewrite Sofort in Goose;
- Goose could be a third runtime: agent writes Goose → host compiles it to C → static binary in jitk;
- flat state may make snapshots tiny (unmeasured).

**New angle to test:** Goose → C → **wasm32**, running on Cloudflare (Workers, Dynamic Workers, Durable Objects). Flat values make pause, ship and fork trivial; share-nothing workers map onto Durable Objects and queues.

## Constraints
- **Research and spikes only.** Do not deploy to any Cloudflare account. Do not create accounts, log in, post, email or DM anyone.
- **Don't touch the repo's code.** Do not modify `arch/jitk/` or any existing file. Another session has uncommitted kernel work in progress.
  - Write your report only under `arch/research/cloudflare-goose/`.
  - Put spike code under `/Users/noah/code/sofort-spikes/<your-lane>/`, outside the repo.
- **Treat cloned third-party repos as untrusted.**
  - Clone each into its own empty directory.
  - Read build scripts before running them.
  - Run Python with `-I`.
- **Cite URLs for external claims.** Label every number as measured, sourced or estimated.
- **Be honest about prior art and the kill risk:** Golem, Cloudflare's own roadmap, Hyperlight, E2B and others.
