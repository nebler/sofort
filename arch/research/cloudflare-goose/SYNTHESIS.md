# Synthesis: Sofort × Cloudflare × Goose (2026-10-25)

This summary is built from reports 01–04 in this folder.

## Decision
**Build Capsule: portable Code Mode continuations on Cloudflare primitives.** It is open source and estimated at about 4 weeks (64–72 focused hours) to an artifact others can review.

- **What it does:** a Code Mode program parks at a tool call and becomes a versioned file.
  - A Durable Object owns the effects journal (each call goes prepared → dispatched → completed → delivered, with idempotency keys).
  - R2 stores the capsule.
  - Any Dynamic Worker, Node process or browser tab resumes or forks it.
- **The demo:** pause on an approval, kill the executor *and* the Durable Object, resume elsewhere with the completed write not repeated, then fork into a browser.
- **The engine:** QuickJS-Wasm, already measured working. Goose, jitk snapshots and a workerd fork stay **off the critical path**.

## Why (evidence)
- **Cloudflare's pattern (01):** it buys or hires teams that fill a specific platform gap. There is no star or revenue threshold. Current priorities are agent execution, security, portability and self-hosting. **Being hired is far more plausible than being acquired.** Optimise for trusted engineering, repeat users and an accepted upstream contribution.
- **Feasibility and cost (02):**
  - **Effort:** the core demo runs locally under `wrangler dev` with no account, in about 8–14 focused days.
  - **Terms:** Workers for Platforms is the product that covers running untrusted end-user code.
  - **Storage cost:** about $145/month to park 10M computers.
  - **Resume cost:** about $1.8k per 100M resumes, mostly Durable Object SQL writes and R2 writes, so batching journal writes is a clear optimisation.
  - **Pricing trap:** a fresh Dynamic Worker ID per resume adds about $2k per 1M resumes. Reuse one ID per tenant and runtime version.
- **Goose (03, measured):**
  - **Snapshot size:**
    - A Goose → Wasm capsule is **13.5 KB gzipped**, against **~110 KB for QuickJS**: 8× smaller as a full image.
    - Against an initialised base image the delta advantage is only **1.6–1.7×**, so most of the gap is the missing interpreter, not flat values.
  - **Size and instantiation:** modules are 1.3–48 KB and instantiate in about 9–30 µs.
  - **Restore and fork:** both were correct across Node, Wasmtime and workerd.
  - **Caveats:**
    - It needed Asyncify (restoring memory alone repeated the tool call).
    - Upstream Goose has **no Wasm target**; the spike used an adapter.
    - Stock native Goose needs syscalls jitk doesn't have.
- **Concepts (04):** Capsule scored 4.30, EffectLab (counterfactual tool-response testing) 4.20 and Goose Cells 3.65.

## Plan
| Week | Work | Stop condition |
|---|---|---|
| 1 | Reproduce the host-kill demo. Run the **falsification test**: Capsule vs recorded-result replay vs explicit-state recovery on two fixtures. | If replay or explicit state matches it, stop the product pitch and publish the findings. |
| 2 | Ownership and effects survive crashes: fencing, idempotency, read-only forks. | A stale owner or fork dispatches an effect, or a committed write repeats. |
| 3 | Portability, plus scale and cost measured locally. | |
| 4 | Ship: README, failure harness, launch post, and one PR/issue upstream to cloudflare/agents (codemode). | |
| 5 (optional) | **Goose engine** inside Capsule: show "the same continuation, 8× smaller". Offer an upstream wasm32 contribution to Goose and message Wouter. | Goose doesn't beat a QuickJS delta on a realistic workload. |

**Kill risk:** Cloudflare or Golem exporting the same opaque continuations into stock runtimes. Watch workerd startup snapshots (PR #7880) and the Computer/interruption APIs.
