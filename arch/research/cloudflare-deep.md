# Cloudflare OS, Cap'n Web, codemode: what jitk can use

Tags: **[M]** measured by me, **[R]** read in source or docs, **[I]** inferred.
Paths are relative to `arch/research/repos/`. Shallow clones were taken 2026-10-24: `cloudflare-os` @835de9e (pushed 2026-10-23), `capnweb` @7666553 (v0.12.0), `agents` @321814b (codemode 0.5.5), `workerd` @2c37de0, `computer` @2b23503. The last one is not on your list. It turned out to be the most relevant repo.

## 1. Facts

### 1.1 Cloudflare OS is real, but it is not a JIT computer

- **URL.** `github.com/cloudflare/cloudflare-os` exists. [M: `git ls-remote`]
- **What it is.** An agent chat UI, "Gadgets" (per-user app instances) and "Gatekeepers" (capability-wrapped service drivers). It is v2 of an internal product (`cloudflare-os/README.md:3-24`, `:93-110`).
- **The "OS" is a metaphor.** The README maps kernel to `workshop-backend` (a Durable Object plus a Worker), drivers to gatekeepers, processes to gadgets and executables to blueprints (`README.md:95-106`). `AGENTS.md:16` calls `workshop-backend` the "kernel". That means "the part reviewers read line by line". It is not a runnable kernel.
- **How agents run code.** One `executeCode` tool (`packages/workshop-backend/src/agent.ts:3800-3839`). Each call does `env.LOADER.load(workerDef)` to create a fresh Dynamic Worker (`overseer.ts:9044-9067`). The worker def has:
  - `globalOutbound: null`
  - the compat flag `disallow_importable_env`
  - `env` = the chat's named capability stubs (`getEnvForAgent`, `overseer.ts:2629-2690`)
  - a tail worker that captures `console.log` as the tool result
  - a 5 s wait for that trace (`overseer.ts:9097-9102`)
- **Generated code shape.** The code must be `export default async function(self, env, ctx)` (`agent.ts:3806-3818`).
- **Not used.** It does not use `@cloudflare/codemode`; this is a bespoke harness (`overseer.ts:105-132`). It does not use a sandbox container or any VM. [M: grep for firecracker, microvm, unikernel, libkrun, gvisor and hyperlight across cloudflare-os, computer and capnweb found nothing; workerd was searched in `.md` files only. The one hit, `agents/experimental/inference-buffer/README.md`, was not inspected.]
- **Gadgets** run as Dynamic Worker facets with `globalOutbound: null` and cached `LOADER.get(id)` keyed by code version (`overseer.ts:4537-4585`).
- **Isolation.** Isolation is workerd's V8 isolate plus capability scoping:
  - A binding is the only authority. Nothing is ambient (`README.md:164-168`).
  - Agents must be "introduced" to resources.
  - `executionId` is minted into loopback props so a stored stub dies with its run (`overseer.ts:9014-9040`, `2627`).
  - workerd itself says it is **not** a hardened sandbox and must be wrapped in a VM for malicious code (`workerd/README.md:32-34`).
  - `ResourceLimits` has only `cpuMs` and `subRequests`. There is no memory limit (`workerd/src/workerd/io/io-channels.h:551-555`).
  - `env` is capped at 1 MiB and code at 64 MiB (`worker-loader.c++:18-23`).
- **Tools, MCP, files, skills.**
  - Tools are typed RPC methods on gatekeeper sessions. The agent is told to call `describeBinding` and not to guess (`agent.ts:1249-1267`).
  - MCP is a gatekeeper that turns each MCP tool into a generated method plus a generated `.d.ts`, with `callTool` as the fallback. Read-only tools run now and others are queued for approval (`packages/gatekeeper-mcp/README.md:12-60`).
  - The nearest thing to "everything is a file" is git-backed **worktrees** and a per-chat `SCRATCH` worktree. Uploads are git blobs (`plans/worktrees.md:1-40`, `docs/chat-scratch-worktree.md:1-30`).
  - Skills are not shipped next to scripts here. Only `slash-commands.ts` and `.agents/skills/write-gatekeeper`, which is for developers, exist.
  - There is no MCP-resources-as-files layer.
- **Persistence.** The workspace is one Durable Object with SQLite. Each agent step is one `transactionSync` barrier (`plans/step-transactionality.md:1-45`). Spawner calls are durable jobs (`plans/spawner-with-persistence.md`). There is no per-task VM or computer.
- **Gatekeepers.**
  - Pending side-effecting actions are *simulated*, so the agent keeps running and a human approves in bulk later (`README.md:77`, `workshop-shared/src/gatekeeper.ts:1015-1030`).
  - Simulation is a pure replay of the pending-action journal (`gatekeeper-kit/src/simulation.ts:1-50`).
- **Where Cap'n Web is used.** The README says that gadget client/server RPC "must" be Cap'n Web (`README.md:140-142`).
  - Browser to backend: WebSocket (`workshop-frontend/src/main.tsx:91`).
  - Gadget iframes: `MessagePort` (`GadgetUI.tsx:32,384`).
  - Headless browser export: custom transport (`browser-export.ts:196-234`).
  - Agent to gatekeeper: *native workerd RPC* with `RpcStub` and `ctx.restore()`, not Cap'n Web (`overseer.ts:150-170`).
  - Cap'n Web is pinned at ^0.12.0.
- **Performance data.** None for the runtime. `plans/evals-and-e2e-tests.md` is about model evals. [R]

### 1.2 `cloudflare/computer`

This is Cloudflare's closest thing to the podcast's "computer that agents talk to".

- **What it is.** A Durable Object holds a SQLite virtual filesystem and a pluggable `workspace.runtime.exec(source, {backend})` (`computer/README.md:3-24`, `docs/05_runtime_interface.md:3-48`).
- **Three backends:**
  - a Linux container with a FUSE mount, where the `computerd` daemon syncs to the DO over **Cap'n Web on a WebSocket** (`docs/08_capnweb_interface.md:12-36`)
  - just-bash in a Dynamic Worker
  - an ES module in a Dynamic Worker, with `node:fs/promises` backed by the workspace and host modules `ws:git`, `ws:tools` and so on (`docs/17_isolate_javascript.md:276-295`)
- **Status.** Container is *Experimental* and isolate JS is *Stable* (`packages/computer/README.md:21-36`).
- **Files are the shared substrate** (`docs/01_vfs.md`). This is the real "everything is a file".
- **Recovery.** A running isolate cannot survive a host restart and is reconciled to failed (`docs/05_runtime_interface.md:165`). Experimental `onInterrupt: "replay"` and `unsafeToRepeat()` exist.
- **Authority.** Backend choice is "routing, not authorization" (`docs/05_runtime_interface.md:127`). Authority is fixed per backend instance (`docs/16_code_execution.md:66-86`).
- **Performance.** Vendor-reported, container-only numbers [R]:
  - FUSE stat/mkdir/find runs about 0.7x to 1.5x of ext4. Large-file I/O is 17x to 43x slower (`docs/19_performance.md:17-35`).
  - A full `npm install` takes 124.7 s versus 63.9 s on ext4 (`:41-45`).
  - Restoring after a restart takes about 25 ms with a file store (`:132-150`).
  - No microVM boot numbers exist anywhere.

### 1.3 Cap'n Web 0.12.0

**Wire format** (`capnweb/packages/docs/src/content/docs/reference/protocol.mdx`):
- The protocol is bidirectional, with no client or server (`:52-61`).
- Each message is one JSON array. Framing is the transport's job. The HTTP transport uses newline-delimited JSON (`:63-77`).
- Each side has an import table and an export table. IDs are never reused. The importer picks positive IDs and the exporter picks negative ones. ID 0 is the "main" interface (`:79-109`).
- Top-level messages: `push`, `pull`, `resolve`, `reject`, `release`, `stream`, `pipe`, `abort` (`:144-252`).
- Expressions: `["pipeline", id, path, args]`, `["import"]`, `["export"]`, `["promise"]` and `["remap", ...]` for `.map()`. There are also codes for `bytes`, `bigint`, `date`, `error`, `headers`, `request` and `writable`/`readable` (`:254-578`).
- `release` carries a refcount (`:187-202`).

**Pipelining.** A `push` result is addressable immediately, before it is pulled (`:131-133`). `remap` ships a recorded callback as captures plus instructions, and the callee runs it per element (`:486-516`).

**Errors.**
- `["error", type, message, stack?, props?]`. Stacks are redacted by default and `onSendError` rewrites them (`:386-404`, `rpc.ts:449-455`).
- The type name is looked up in a null-prototype table (`serialize.ts:215-216`, `:971`).

**Disposal.**
- Disposal is explicit via `Symbol.dispose`. There is no GC integration (`concepts/disposal.mdx:6-47`).
- Stubs passed in params belong to the caller. Stubs in results are transferred to the caller.
- Sessions end when the transport ends, and nothing is persisted.

**Transports.**
- WebSocket, HTTP batch, `MessagePort` and custom. Custom is `send(string)` plus `receive(): Promise<string>` plus optional `abort` (`rpc.ts:13-45`, `transports/custom.mdx`).
- Other `encodingLevel`s skip the stringify step.

**Safety limits.**
- Receiver-only limits: `maxDepth` 256, `maxMessageSize` 32 Mi UTF-16 units, `maxBigIntDigits` 16384 (`serialize.ts:54-71`).
- Docs admit that **there is no cap on live exports or outstanding calls**, and "pipelining is cheap for attackers" (`guides/security.mdx:64-87`).
- Property paths on an `RpcTarget` may only name prototype members. Own instance properties throw. `Object.prototype` names are blocked (`core.ts:1696-1745`).

**Bundle size.**
- The docs use a `%BUNDLE_SIZE%` placeholder (`start/introduction.mdx:27`).
- esbuild of `src/index.ts` with `--minify --target=es2022`: **59,613 B min, 16,616 B gzip**. Core+rpc only: **46,404 B min, 12,713 B gzip**. [M]
- Zero dependencies. The build asserts that `dist` is ASCII-only (`scripts/check-dist-ascii.mjs`). My bundles contained no non-ASCII bytes. [M]

**Runs in our QuickJS.** [M] I loaded the 56 KB IIFE bundle as `run.code` into the real microVM (the `kernel.bin` at `kernel/dist/kernel.bin`, QuickJS 2026-06-04) via `protocol/vm.mjs`.
- It does not work out of the box. It needed these guest globals: `ReadableStream`, `WritableStream`, `Blob`, `Request`, `Response` and `Headers` as `instanceof` targets (a stub class is enough), plus `structuredClone`, which `.map()` needs (a JSON clone was enough).
- Without the stream classes, the first call raised `ReferenceError: 'WritableStream' is not defined` inside `abort`. qjs then exited 1 on an unhandled rejection, so the host saw no `done`.
- With those stubs, calls, pipelined `.map()`, error rejection, and non-ASCII strings all passed. The test used two sessions in one guest over an in-memory transport.
- Absent in this QuickJS: `queueMicrotask` (used only on transport-error paths, `rpc.ts:769,791`), `btoa`, `TextEncoder`, `structuredClone`. Present: `Symbol.dispose`, `Promise.withResolvers`, `WeakRef`, `FinalizationRegistry`, `Uint8Array.prototype.toBase64`.
- Run time was 38 ms against 13 ms for same-size padding, on a loaded host (load average 13). Treat it as noisy.

**Message-for-message vs v1** (traces from the QuickJS run; sizes include LF) [M]:

| Scenario | v1 | Cap'n Web 0.12 |
|---|---|---|
| One call `github.listIssues({repo:"x"})` | G→H `call`, H→G `ret`: 2 frames, 74+82 B | G→H `push`+`pull`+`release`, H→G `resolve`: 4 frames, 90+74 B |
| Error | `ret{err:{code,message}}` | `["reject",4,["error","Error","denied"]]` |
| `listIssues().map(i=>getIssue(i.id))` | 1 call, then N parallel calls: 1+N round trips from the guest | 2 `push` + `pull`: one guest-visible round trip. The host answers with `["promise",-1],["promise",-2]` and later resolves each |
| End | `done` | none. The session just ends. The ID 0 stub's dispose sends nothing |

Full v1 frame: `{"t":"call","id":1,"ns":"github","fn":"listIssues","args":[{"repo":"x"}]}`. The Cap'n Web push for the same call: `["push",["pipeline",0,["github","listIssues"],[{"repo":"x"}]]]`.

**Round-trip cost in our VM.** [M, host load average ~13]
- 200 sequential `await api.echo(i)` took p50 293 ms, which is about 1.5 ms per hop (best case about 0.5 ms).
- 192 calls issued as 3 batches of 64 took p50 12 ms.
- So guest↔executor hops are roughly 0.5 to 1.5 ms. Compare that with 10 to 300 ms for the executor's calls to remote tool servers [I].

### 1.4 `@cloudflare/codemode` now vs 0.5.5

- **No version difference.** `agents` main is *still* 0.5.5 (`packages/codemode/package.json`, `CHANGELOG.md:3-5`).
- **Same interface.** `Executor.execute(code, providersOrFns, options?: {connectors?})` (`src/executor-types.ts:42-61`) is identical to our installed dist. I diffed the d.ts by eye: the same `ResolvedProvider.prelude` and `ConnectorBinding.callTool(method,args)`.
- **0.5.5 patch.** It releases unawaited pending tool calls when execution settles (`docs/codemode/runtime.md:141-143`). v1 already treats this as an error with `OUTSTANDING_DONE`.
- **No stub or resource hooks.** The only extension points are `ConnectorBinding`, `prelude` and per-execution `executionId` (`docs/codemode/connectors.md:108-160`). MCP resources are not exposed (`src/mcp.ts:57` only mentions mixed content).
- **ToolDispatcher.** It is an `RpcTarget` with `call(name, argsJson): Promise<string>`, so the data on the wire is JSON strings (`src/executor.ts:235-257`). It is simpler than Cap'n Web and close to jitk's v1.
- **The `Runtime` layer** (`docs/codemode/runtime.md:87-143`) is durable abort-and-replay: it logs every call, aborts at an approval-gated call, and re-runs the code on approval. It needs deterministic code and sequential calls. It is the opposite design to Cloudflare OS's simulation (`approvals.md:157-168`).
- **Skills.** `agents` has an Agent Skills layer: `SKILL.md` plus `scripts/` and `references/`, with an optional `run_skill_script` via codemode (`design/skills.md:117,200,258-295`, `packages/agents/src/skills/types.ts:84-91`). This is the "skills shipped next to scripts" idea. It lives in `agents`, not Cloudflare OS.

### 1.5 Novelty check

- **In the repos:**
  - Each task gets a fresh V8 isolate with capability env stubs.
  - A persistent, file-shaped workspace.
  - A container with FUSE if you need Linux.
  - Agent-authored gatekeepers using a skill-guided process, with human code review as the gate (`REVIEW.md:48-52`, `plans/gatekeeper-kit.md:99-100`).
- **Absent in the repos:**
  - Anything that grows or specializes a kernel per program.
  - Anything that differentially verifies agent-written system code against Linux.
  - Any VM, microVM or unikernel.
  - Any boot-time budget.
- **Verdict.** The podcast's "JIT purpose-built computers" and "Cloudflare OS embodies this" are **not supported by the code**. What Cloudflare OS does embody is capability introduction, per-user generated software, and async approval via simulation.
- **Where it is weaker than jitk:** isolation. workerd disclaims being a hardened sandbox. A hardware VM is a stronger boundary [R].
- **Where it is stronger than jitk:** state, durability and the capability UX. Those are what jitk lacks.
- **Skeptical the other way.** "Gadget per user" and "agent writes drivers" are a real, shipped form of "purpose-built software, just in time". They stop at the application layer, though. Nothing under it is generated.

## 2. Ideas to steal, ranked by value / effort

1. **Introduction-based capability scoping per run (high / low).** `ns` already carries per-run method lists. Add Cloudflare OS's rule that a resource becomes ambient only via admin or user config, and never by the tool server's own claim (`AGENTS.md:16-18`). Cheap: make `ns` computed by a "grant" step rather than static config.
2. **Typed `.d.ts` per grant (high / low).** Generate the guest-visible types from each tool's schema, with only the granted subset. MCP gatekeeper does this, plus a 20-result `listTools({search})` for big catalogs (`gatekeeper-mcp/README.md:40-60`). Codemode has search/describe inside the sandbox (`runtime.md:53-76`).
3. **Simulate-then-approve for mutating tools (high / medium).** Let the guest proceed on a deterministic projection of pending actions. This beats codemode's abort-and-replay for jitk because jitk forbids replay. It needs a per-tool simulator in the executor; it is not a protocol change. Use `replaySimulation` as a model (`gatekeeper-kit/src/simulation.ts`).
4. **Pipelining for dependent chains and `.map` fan-out (medium / medium).** See §4 for the size of the win. Strictly an optimization. Defer until the executor talks to Cap'n Web-speaking backends.
5. **Files as the shared substrate (medium / medium, big upside).** Expose resources as paths in a virtual FS: `/mcp/<server>/resources/...`, `/skills/<name>/{SKILL.md,scripts/}`. Computer's `node:fs/promises`-over-RPC is the precedent (`17_isolate_javascript.md:276-295`). In jitk the natural implementation is a *new grown syscall class* (open/read/readdir on a synthetic mount) that maps to `call`. Then the "agent grows missing syscalls, differentially verified" loop could grow *file semantics*. [I] This is the most jitk-specific idea in the set.
6. **Per-execution resource lifecycle hooks (low / low).** `disposeExecution(executionId, status)` is idempotent and never throws (`connectors.md:131-141`). Add the same to executor connectors. v1 already kills the VM, but remote sessions (browser, DB transaction) still need teardown.
7. **Truncate-and-spill (low / low).** Computer saves full output to a file and returns the tail (`05_runtime_interface.md:79-103`). Codemode's structural `truncateResult` keeps valid JSON (`CHANGELOG.md` 0.5.2). Both fit v1's "no silent truncation" for args and results by making truncation *visible at the tool boundary*.
8. **Step barrier (low / low).** Buffer side effects until one atomic commit per step (`step-transactionality.md`). Worth stealing for the executor's audit log.

## 3. Conflicts and risks

- **No call budget in Cap'n Web.** No outstanding or total cap and no cap on live exports (`security.mdx:80-87`). v1's 64-outstanding / 4096-total / 2 MiB-inflight rules must be re-implemented. `.map()` multiplies calls per message, so the budget has to be counted where calls land: in the executor's `RpcTarget` wrappers, not at the frame.
- **Bidirectional means the host could call into untrusted guest code.** v1 forbids it. Allow guest exports only if reviewed: reject `export`, `promise`, `writable`, `readable`, `pipe`, `stream`, `blob`, `bytes`, `headers`, `request` and `response` from the guest.
- **Parsing.** Cap'n Web uses a plain `JSON.parse`. v1 pre-scans for duplicate keys, number limits, depth and structure count. The pre-scan (`protocol/dispatcher.ts`) must run *before* the session sees the string. Our custom transport owns `receive()`, so this is possible [R/I].
- **ASCII-only.** Cap'n Web emits raw UTF-8. A custom transport must escape `[\u007f-￿]` on send (as `bootstrap.js` `ascii()` does) and reject non-ASCII bytes on receive.
- **Guest footprint.** 46 to 59 KB of minified JS is 8 to 10 times the 6 KB bootstrap. It cannot ride in `run.code` (65,536 B cap, `PROTOCOL-v1.md`) alongside real code. It must be embedded in the kernel's `-e`. It also needs 7 globals polyfilled, and an unhandled rejection kills the guest silently with exit 1 [M].
- **Disposal protocol.** Refcounted `release` and negative IDs add guest state. With single-use VMs, disposal only matters for budget accounting, not memory.
- **Error model.** Cap'n Web errors are class-named JS errors with optional props, and stacks are off by default. v1 requires `code` matching `[A-Z][A-Z0-9_]{0,63}` and a 4096-unit message. Map `code` into `props.code` and validate on the host.
- **No in-band cancel, no reconnect.** Same as v1 [R]. Cap'n Web has no resumable session. That matches jitk's kill-the-VM model.
- **Wrong comparison to avoid.** Codemode abort-and-replay needs deterministic code and sequential calls (`runtime.md:123-139`). It cannot be combined with jitk's non-replay rule unless the executor re-runs in a *new* VM.
- **Maturity.** `capnweb` ships in nearly every minor release, with fixes for argument and capture leaks (`CHANGELOG.md` 0.12.0, 0.11.0). `computer-rpc` is explicitly "may change in any release" (`08_capnweb_interface.md:3-6`).
- **Isolation story.** Cloudflare OS relies on workerd; jitk's hardware VM is a better answer for hostile code. Do not weaken it to match.

## 4. What pipelining buys, honestly

Hops are guest→executor (0.5-1.5 ms [M]) and executor→remote tool server (tens to hundreds of ms [I]).

- **Saved on the guest side.** One local round trip per dependent hop: `a = await x.f(); b = await x.g(a.id)` goes from 2 to 1. It saves about 1 ms per hop. That matters only for deep chains, which are rare in agent code [I].
- **`.map`.** `list.map(i => get(i.id))` becomes one guest round trip rather than 1+N. v1 already parallelizes via `Promise.all` (192 calls in 12 ms [M]), so this is not a large win.
- **The real value is executor→remote.** The executor sees the dependency graph and can batch to a Cap'n Web-speaking remote (a Cloudflare OS gatekeeper or an HTTP batch session) in one network round trip. MCP over HTTP does not pipeline. For plain MCP servers the executor would still issue the dependent call after the first returns [I].
- **Policy still holds.** The executor's `RpcTarget` wrappers receive resolved arguments, so per-call schema and policy checks apply to each call (`core.ts:1696-1745`). A resolved value that fails schema validation rejects that call.

Bottom line: pipelining is a **minor win today and a major win only with Cap'n Web remotes**.

## 5. Protocol v2 sketch (a profile of Cap'n Web)

The v1 state machine does not change: `ready` → `run` → traffic → `done`. Frame objects `{"t":...}` and Cap'n Web messages (JSON arrays) can share one stream because the first byte is `{` or `[`.

```text
G→H {"t":"ready","v":2}
H→G {"t":"run","code":"...","ns":{"github":["listIssues"]}}   // unchanged; ns still builds lexical params
G→H ["push",["pipeline",0,["github","listIssues"],[{"repo":"x"}]]]
G→H ["pull",1]
H→G ["resolve",1,[[{"id":1}]]]    // arrays are wrapped, per protocol.mdx:259
H→G ["reject",1,["error","Error","policy denied",null,{"code":"DENIED"}]]
G→H ["release",1,1]
G→H {"t":"log",...}   {"t":"done",...}                        // unchanged
```

- **ID 0** is the main stub, backed by the `ns` tree. It is host-built and frozen.
- **Allowed guest→host:** `push` (only `pipeline` and `remap`), `pull`, `release`, `abort`. Allowed host→guest: `resolve`, `reject`, and `["promise"|"export", ...]` only for host-owned resource stubs.
- **Keep from v1, unchanged:**
  - 1,048,576 B frame cap, checked before accumulation.
  - ASCII-only on the wire, with `\uXXXX` escapes.
  - Reject duplicate keys, unpaired surrogates and numbers beyond ±2^53−1.
  - JSON depth 32 and 32,768 structure tokens. Cap'n Web's own default is 256, so set `limits.maxDepth = 32` and `maxMessageSize = 1 Mi`, and still pre-scan.
  - 64 outstanding calls and 4,096 total. "Call" = one invocation of a host `RpcTarget` method, counted in the executor wrapper. This covers calls expanded from `remap`. Outstanding = pushed but not yet resolved.
  - 2 MiB in-flight, 16 MiB wire, 8,192 G→H records.
  - Name rules: namespaces and methods match the existing regex. No `then`. Exclude the reserved set.
  - The 0x1E diagnostic records.
  - External SIGKILL watchdog. No in-band cancel: `release` of an unresolved push is only a hint.
  - Error `code` regex and message length. Unknown `error` type names collapse to `Error`.
  - Zero outstanding calls at successful `done`. Unawaited calls are `OUTSTANDING_DONE`, as in 0.5.5.
  - Violations poison the dispatcher and kill the VM.
- **New v2 limits** [I]: at most 4,096 `push` messages; `remap` limited to 256 instructions and 8 captures, nesting 1; bounded pending-promise table per run.
- **Rollout.** Keep v1 as the default, gate v2 on `ready.v`, and ship the Cap'n Web bundle in the kernel image. Only worth doing when a remote speaks Cap'n Web.

## 6. Open questions

1. Is there a smaller guest client? Cap'n Web has no tree-shake of streams (`serialize.ts` pulls them in). A 15 KB "calls and maps only" guest could be hand-written against the 5 messages above, which is much less than 46 KB. How much of the protocol would a minimal guest need to speak, and does it stay interoperable?
2. Can the executor gate `remap` safely? Instructions can include any captured stub, so every captured stub must be a policy-wrapped stub.
3. Does the grown-kernel verification loop apply to file semantics (idea 5)? What would the differential reference be for a synthetic `/mcp/` mount?
4. Does the podcast's "Cloudflare OS" refer to a different, unreleased thing? The public repo does not contain what Ep 07 describes. Check the episode transcript.
5. Should approval be simulate-first (OS gatekeepers) or abort-and-replay (codemode runtime)? jitk's single-use, no-replay VM points to simulate, but simulation is tool-specific work.
6. TanStack's `IsolateDriver` (`createContext(bindings)` then `execute(code)`) has no stub or resource concept either. Is the mapping cheap if v2 is a profile?
7. Re-measure on a quiet host. All timings above were taken at load average ~13.
