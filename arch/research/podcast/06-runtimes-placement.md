# 06 Code-mode runtimes and placement

Fern context: architecture §5 says "A Code Mode client wraps the same API as a small TypeScript library". design.md §17.2 sketches `env.snapshot / fork / exec / delete` scripts for fork, bench and bisect. Those scripts are mostly orchestration: `Promise.all` over forks and an `exec` per fork. They do not compute much.

Facts below come from vendor pages or secondary sources unless noted. Inference is marked.

## Idea 1: Pick the runtime that runs code-mode snippets on the Fern node (podcast 36:00, 42:30-45:30)

**What exists**
- **OpenCode interpreter.**
  - OpenCode 2.0 shipped about Oct 13 2026, with code mode as the default for MCP servers. A confined JS interpreter sits behind one `execute` tool, and a design doc describes it ([doc mirror](https://upd.dev/anomalyco/opencode/raw/branch/dev/packages/codemode/codemode.md), [secondary coverage](https://aiidelist.com/blog/opencode-2-0-release-code-mode-background-agents)).
  - It is a hand-written interpreter, so there is no engine CVE surface. It has been public for days, and I found no official write-up. Maturity: brand new.
- **Vercel Run SDK** ([blog](https://vercel.com/blog/introducing-run)).
  - Released Aug 25 2026. Each run gets a fresh QuickJS context inside a worker thread, with host functions as the only way out.
  - Time and memory limits, and hardened prototypes.
  - `context.interrupt()` returns a signed token, so execution can pause and resume. Completed host calls replay from their recorded results. This is the approval pattern discussed at 43:00.
  - Vercel says it is not an OS-level boundary and points to Vercel Sandbox for that.
  - I found nothing on "Callscript" in a search. The only source is the podcast, where it is described as a serializable JS subset, workflow-like. Treat it as unverified.
- **QuickJS caveats** (the one flagged at 42:30).
  - QuickJS is a C engine with a recurring history of memory-corruption bugs. Examples: quickjs-ng CVE-2026-1145 (heap overflow in the typed-array constructor) and CVE-2026-37630 (sentinelone, AI-generated page, verify upstream). See also [USN-7439-1](https://ubuntu.com/security/notices/USN-7439-1).
  - [rquickjs SECURITY.md](https://docs.rs/crate/rquickjs/0.12.2/source/SECURITY.md) says engine escapes go upstream, and that untrusted bytecode equals untrusted native code.
  - Wasm compilation helps: a QuickJS bug is then confined to linear memory. Native QuickJS in a worker thread (as in Run SDK) is not that.
  - Inference: QuickJS-in-wasm is a reasonable boundary. QuickJS-native is not.
- **Dynamic Workers / workerd.**
  - V8 isolates loaded at runtime through the Worker Loader binding ([docs](https://developers.cloudflare.com/workers/runtime-apis/bindings/worker-loader)).
  - Cloudflare claims a few ms start and a few MB of memory. That is a vendor number.
  - Capabilities arrive as stubs, and the network can be intercepted or blocked.
  - I could not confirm that the loader binding can be self-hosted in open-source workerd. It is documented only for deployed Workers. Verify in the workerd repo before planning around it.
  - V8 isolates are a weaker boundary than a VM, but Cloudflare runs them at scale.
- **Deno Sandbox** ([blog](https://deno.com/blog/introducing-deno-sandbox)).
  - A Firecracker microVM service on Deno Deploy, with secret-substitution at egress. Official claim: boots in under a second.
  - It is a hosted service, so it is not a fit for self-hosted Fern.
  - Its egress-secret trick is worth copying (see Idea 3).
- **Pydantic Monty** ([article](https://pydantic.dev/articles/pydantic-monty)).
  - A Rust Python bytecode VM. Microsecond starts are claimed, and the sources disagree on the exact figure. It can snapshot execution state to bytes. The project calls itself experimental.
  - Only useful if the agent writes Python.
- **tsrs / type-checking** (45:30). A TypeScript checker in Rust/Wasm. I found no solid source in my searches. Treat it as unverified.

**Fern fit**
- Snippets run in the Go daemon's process space, or in a sidecar next to `api` (§3). The snippet's only capabilities are the §5 calls, over the same unix socket. The token is scoped to its own environment (§13).
- Go-native option: `goja` or `wazero` + QuickJS-wasm. Both are in-process, with no V8.
- **Verdict: ADOPT QuickJS-in-wasm via wazero, with a thin Go host-function layer.** Do not build an interpreter.
  - Reasons: it keeps the daemon pure Go with no cgo, and wasm gives memory isolation. The surface is about six host functions.
  - Effort: 1 to 1.5 weeks including limits, a TypeScript `.d.ts` for the model, and tests.
  - Revisit only if OpenCode's interpreter is extractable and proves itself.
  - Dynamic Workers and Deno Sandbox: SKIP. They are Cloudflare- or Deno-hosted and not self-hostable on this stack.
- **Model trend: grows.** More scripted operations means more snippets, so cheap and safe execution matters more.
- **Signal: Twitter 3, CV 4.** A Go wasm sandbox embedded in a distributed daemon is a credible CV piece.

## Idea 2: Stateless tier, so small steps don't wake a gVisor box (37:00-38:00, "stateless dynamic worker; container only when needed")

**Fern fit**
- Today every `env_exec` goes through §5 `GET /envs/{id}/exec`, which wakes the environment. Wake means a pod, CSI mounts and `/readyz` (§11).
- Many operations don't need a box:
  - list or inspect snapshots
  - read `GET /envs`
  - snapshot, fork or restore a sleeping environment (these are btrfs operations in the store, not box operations)
  - dry-run or plan steps
- The embedded wasm runtime from Idea 1 is the stateless tier. It sits in the `api` layer, in front of `wake`. Only `env.exec` wakes the box, and the front door's wake coalescing (§11) already handles that. No new component is needed, because the actor's mailbox serializes mutating calls.
- jitk would be an alternative stateless-tier runtime. (One line, per the brief.)
- **Verdict: BUILD, a few days on top of Idea 1.** Nothing existing knows the actor, store and wake model, so it is just routing. Add an `awake` hint to the snippet's response so the agent learns what cost it incurred.
- **Model trend: grows.** Cheaper inference makes more tiny steps, so the cost of waking becomes the bottleneck.
- **Signal: Twitter 4, CV 4.** "Fork 8 sleeping environments and bench them without waking any" is a demoable claim.

## Idea 3: API shape `fern.exec` / `env.container`, avoiding the nested closure failure (38:30-42:00)

- **The failure.** Matt describes the "number one failure mode": the outer script's variables are unreachable from the inner script. Example: a PNG too big to return, so the model tries to post-process it from inside a nested layer.
- **Their fix.** A module the model imports (`container.exec`, `container.bash`) that takes a string. The model knows it is crossing a boundary.
- **Fern fit.**
  - `env.exec(cmd: string)` crosses into the box. Its argument is a string, not a closure, so the failure cannot occur by construction.
  - The result is returned by value, with large outputs written to a file in the workspace and returned as a path. Fern has an advantage Cloudflare lacks here: a persistent filesystem in `live/` that both tiers share.
  - Names should state the boundary: `fern.*` is the stateless tier, and `env.container.exec` is the box. Keep it flat (the design says four or five tools).
  - Type the API with a `.d.ts` served to the agent, so the model reads the boundary.
- **Verdict: ADOPT the pattern (it is a naming rule, not code).** About 1 day. Strings in, values or paths out. Never closures across the box.
- **Model trend: neutral.** The failure is partly a weak-model crutch ("we'll see with the next generation"), but the string boundary is also simply correct.
- **Signal: Twitter 2, CV 2.**

## Idea 4: Dynamic placement of code next to the API (60:00)

- The claim is that code mode moves off the client and runs next to the API, because each 100 ms round trip slows a fast agent loop.
- **Fern fit.** Fern already does this by default: the daemon is on the same machine as the boxes, and the unix socket is a host directory (§5). The snippet runs at the node that owns the environment (`node` field, §11). On Kubernetes, a multi-node call is forwarded to that daemon.
- **Gap.** A script that forks across nodes needs placement logic. This is a post-v1 feature, because the single-node k3s mode (§14.1) has no such need.
- **Verdict: SKIP for now.** One line in the docs: "run the snippet where the environment lives".
- **Model trend: grows.** Signal: Twitter 3, CV 3.

## Idea 5: Pause and resume for approvals (43:00-44:00)

- Run SDK's `context.interrupt()` and signed resume token show that serializable continuation is a real need (approvals that take days).
- Fern fit: webhooks (§5) plus a snapshot gate on destructive calls like `env_delete` or a fork of 200.
- This is outside the main area, so I only note it. Monty's snapshot-to-bytes is the same idea in Python.
- **Verdict: SKIP for v1.** Revisit if Fern adds approval flows. **Trend: grows.**

## Top 3 recommendations

1. **Embed QuickJS-wasm under wazero as the Code Mode runtime** (ADOPT, about 1.5 weeks). It is pure Go, memory-safe at the boundary and has no hosted dependency.
2. **Make that runtime the stateless tier in front of `wake`**, so snapshot, fork and inspect work on sleeping environments (BUILD, a few days). This is the most demoable thing here.
3. **Adopt the `fern.*` / `env.container.exec(string)` shape**, with a typed `.d.ts` and large results returned as workspace paths (1 day).

## Open risks

- I could not confirm that Dynamic Workers' loader runs in open-source workerd, and I could not find sources for Callscript or tsrs. A fresh check would change Idea 1 if workerd supports it.
- Several sources are vendor claims or secondary blogs: Cloudflare's few-ms start, Deno's under-a-second boot, and Monty's microsecond starts.
- QuickJS-wasm still has an escape risk if the wasm runtime itself has bugs. The daemon is privileged (§13), so the snippet process should run with a minimal token and, ideally, in a separate unprivileged process, not inside the daemon.
- Whether models use the Fern API well from a TypeScript snippet is untested. The OpenCode and Cloudflare reports are anecdotes.
- The stateless tier adds a second place where an operation can fail, in the middle of an actor-owned sequence. It needs the same Reconcile discipline as other changes (§12).
