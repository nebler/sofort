# 01 - Cap'n Web, stubs over the wire, promise pipelining

Podcast refs: 57:50-58:30 (return a stub over MCP, "Cap'n Web style"), 61:00-63:30 (pipelining solves the waterfall, "best fit of any protocol I've seen for the lower level of MCP", "build Rust, Go versions", every client is also a server).

## Facts checked (not just the podcast)

- Reference: `/tmp/ref-repos/capnweb` v0.12.0, MIT, about 6.8k lines of TS in `src/`, "under 16 kB gzip", zero dependencies. Active (changelog 0.8 to 0.12, with PRs from outside Cloudflare).
- Wire spec: `packages/docs/src/content/docs/reference/protocol.mdx` (578 lines). It is genuinely small:
  - Eight top-level messages: `push`, `pull`, `resolve`, `reject`, `release`, `stream`, `pipe`, `abort`.
  - About 20 expression forms. The ones that matter are `import`, `pipeline`, `remap`, `export`, `promise`, `error`, `bytes`, `date`.
  - Transport is just "a stream of JSON messages". WebSocket is one message per frame. HTTP batch is NDJSON in one request and response body.
  - Import and export IDs are signed integers: positive IDs are chosen by the caller, negative by the exporter, 0 is the main interface.
- Pipelining: a `push` returns an import ID immediately. `["pipeline", id, path, args]` can reference it before it resolves, so `a.b().c()` is one flight.
- `.map()` is a `remap` message. The JS client records the callback against a proxy and sends instructions, so a loop over a remote array runs server-side with no per-element round trips.
- The README warns that sessions are not persistent and that "pipelining is cheap for attackers", so rate-limit and validate. Sessions: `guides/sessions.mdx`.
- Cloudflare OS (`/tmp/ref-repos/cloudflare-os`):
  - `README.md:140` says the client and server halves of every Gadget MUST talk Cap'n Web, so the server's API is automatically agent-callable via Code Mode.
  - Gatekeeper RPC contracts live in `packages/workshop-shared/src/gatekeeper.ts`. `AGENTS.md:114` mandates `@validateRpc()` (capnweb-validate) on every RPC implementation.
  - Observers and callbacks are stubs stored and called back later (`plans/gatekeeper-kit.md` around lines 680-730; Workers' persistent-stub restriction applies).
  - Inference: Cap'n Web is the typed-API layer between agent code and capabilities. It is not just a browser convenience.
- Other languages (all third-party, none from Cloudflare):
  - **Go, `flaticols/capnweb-go`** (go.flaticols.dev/capnweb-go): MIT, created 2026-03, pushed 2026-07, 3 stars.
    - Self-described "early-stage, expect breaking changes".
    - Claims all 8 messages and all value types for wire protocol 0.8.0, which is 4 minors behind the reference. It has remap, streams, WS and HTTP batch.
    - About 3.2k non-test lines. There is an `interop/` suite that spawns the TS implementation (`interop_test.go`, 632 lines) plus golden wire vectors.
    - I read the README and file layout and did not run it.
  - Go, `develerltd/capnweb-go`: one-day dump (2025-09-24) with "COMPLETE / production-ready" marketing. Ignore.
  - **Python, `abilian/py-capnweb`**: 38 stars, last push 2026-01, 352 tests, "~99% compliance" self-reported. Also on PyPI as `capnweb` v0.1.0, described as not production ready.
  - Rust: `currentspace/capn-rs` (82 stars, last push 2025-09-30, crates `capnweb-core` 0.1.0 with ~1.1k downloads), and `Dr-Emann/capnweb_types` (serde types only). Stale or thin.
- MCP: I found no SEP or discussion proposing Cap'n Web, and the GitHub search for "capnweb" across the `modelcontextprotocol` org returns exactly one hit.
  - That hit is transports-wg PR #53, "Pluggable Transport Interface" (open, 2026-08). It allows "Cap'n Web tunnels carrying opaque MCP JSON-RPC" and puts "native Cap'n Web object-capability mappings" explicitly out of scope, deferred to a separate proposal.
  - The parent SEP-2598 was **deferred** by core maintainers.
  - So the podcast's "I did propose it" is a verbal proposal, not a tracked one. Adoption into core MCP is unlikely soon (inference).
  - Sources: https://github.com/modelcontextprotocol/transports-wg/pull/53 and https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2598.
- Other sources: https://github.com/cloudflare/capnweb, https://blog.cloudflare.com/capnweb-javascript-rpc-library/, https://pkg.go.dev/go.flaticols.dev/capnweb-go, https://github.com/abilian/py-capnweb, https://github.com/currentspace/capn-rs.

## Idea 1: Fern daemon API as Cap'n Web capabilities (58:00, 62:00)

**Idea.** Replace flat `POST /envs/{id}/fork`-style calls with a capability graph, so an agent writes `env.at(turn).fork().db.query(sql)` and it travels in one round trip. The podcast's claim is that stubs give compute locality and kill waterfalls.

**What exists.** The JS reference and the Go port above. Nothing exists for environment or snapshot capabilities.

**Fern fit.** Today (§5) fork is two calls, create then exec, each woken and queued by the actor (§3, §6). With stubs:
- `Fern` main object exposes `env(id)`, `list()`, `create()`.
- `Env` exposes `snapshots()`, `snapshot(tag)`, `restore(s)`, `fork(snapshot, n)`, `exec(cmd)`, `service(name)`, `sleep()` and `wake()`.
- `Snapshot` exposes `at()`, `fork()` and `delete()`.
- `Service` exposes `url()`, `call()`, and for Postgres `query()`.
- `thread.at(turn).fork().db.query(...)` is `pipeline` on the fork result's unresolved import ID. The daemon actor (§3) receives it in the same WebSocket frame and serializes it through the mailbox. The query waits for wake (§6.1) internally with no client round trip.
- A snapshot stub is an unforgeable handle, so "agent can fork its own snapshots but not another thread's" falls out of what it was handed. This is a better answer to §13 than path-based authorization.
- `fork(count: 50).map(f => f.db.query(sql))` runs fan-out forks in one message via `remap`. Fork caps (§5) still apply server-side.
- Dispose semantics match env lifetime: dropping the last stub of a fork could mean "eligible for GC under retention" rather than delete. That is a design choice to make carefully, because the protocol's `release` is about session memory, not durable lifecycle.
- The Unix socket at `/run/fern/fern.sock` can carry a WebSocket upgrade. Keep the existing REST API; add `/rpc` beside it.

**Verdict: BUILD (Go server side), on top of an existing Go port if it survives testing (see Idea 3).** Effort: 1 to 2 weeks for the object model plus mapping onto the actor mailbox, assuming the transport exists.

**Model trend: grows.** Better models write longer, more correct pipelines. Cheaper inference means more fork fan-out, where per-call latency and round trips dominate. Not a crutch for weak models.

**Signal:** Twitter 4 (a single-flight fork-and-query is a vivid clip; "Kenton's RPC for sandboxes" has pull), CV 4.

## Idea 2: Expose stubs through the agent's tool surface (58:00, 62:30)

**Idea.** Rather than 5 MCP tools (`env_snapshot`, ...), return a stub from MCP and let Code Mode run client-side against it.

**What exists.** Nothing standard (see MCP findings). Cloudflare OS uses Cap'n Web beneath Code Mode already. MCP core is not moving (deferred pluggable-transport SEP, native mappings out of scope).

**Fern fit.** §5 says a "Code Mode client wraps the same API as a small TypeScript library". Make that library a Cap'n Web client, not a REST wrapper:
- Agent's code-mode sandbox gets `fern` as a stub (WebSocket to the daemon).
- `env_exec` and the other MCP tools remain for non-code-mode harnesses, and are one-shot calls over the same object model.
- Do NOT try to carry stubs inside MCP JSON-RPC. There's no place for import tables in the MCP session, and the proposal path is blocked. Use MCP only to hand the agent a URL plus a capability token (inference). The token in a `push` auth call returns the scoped `Env` stub, which is the in-band authentication the Cap'n Web security guide recommends.

**Verdict: BUILD (small). Cap'n Web beside MCP, not inside it.** 3 to 5 days once Idea 1 exists, mostly TS client packaging and an auth bootstrap.

**Model trend: grows** (code-mode agents are the pattern the podcast says is winning). **Signal:** Twitter 3, CV 3. Mostly a packaging step.

## Idea 3: A Go Cap'n Web implementation (62:30, "build Rust, Go versions")

**Idea.** The podcast hopes someone builds Go and Rust ports. Fern is Go, so ours is the Go one.

**What exists.** `flaticols/capnweb-go` (above): MIT, plausibly complete against 0.8.0, small, young, one maintainer, interop tests present, not yet verified by me. It has a stub-and-session design rather than a closure-recording `.map()` (Go has no proxies), so server-side remap is supported but Go-side authoring of maps is not.

**Sizing a minimal interoperating subset.** The Go daemon is the server; clients are JS/TS (agent code mode, browsers). So the server side only has to do:
1. NDJSON framing for HTTP batch, and a WebSocket transport. About 200 lines.
2. The message set `push`, `pull`, `resolve`, `reject`, `release`, `abort`. Skip `stream` and `pipe` at first. About 400 lines.
3. Import and export tables with refcount and the positive/negative ID rule. About 250 lines.
4. Expression evaluator: literals, `array`, `undefined`, `bytes`, `date`, `error`, `bigint`, plus `import`, `pipeline`, `export`, `promise`. About 500 lines, including reflection-based call dispatch to Go methods with a `context.Context` first argument.
5. `remap` evaluator (instruction list, captures, negative index rule). About 200 lines. Needed for the fan-out idea. Could ship later.
6. Release and cancellation correctness (disposing args on every failure path; the reference fixed several leaks in 0.12.0). The hard part.

Total roughly 1.5k to 2.5k lines of Go, matching flaticols' 3.2k including streams and all value types. Estimate: 2 to 3 weeks to write from scratch to a reviewed quality. 3 to 5 days to audit and adopt flaticols (pin the version, fork if needed, bump to 0.12 wire changes), plus upstream fixes.

**Test plan against the JS reference.**
- Differential harness: spawn `capnweb` (pinned to 0.12.0) as a Node process driven by the repo's own `__tests__/index.test.ts` scenarios, once with a Go server and once with a Go client. This is the approach flaticols' `interop/` takes.
- Golden vectors: capture the JS session's NDJSON for each scenario and replay it in both directions byte for byte. Normalize ordering only.
- Property tests: random expression trees, round trip Go to JS to Go.
- Pipelining and ordering: call chains on unresolved imports, calls on a promise that rejects, release racing re-export (the refcount rule), `.map()` with captures.
- Abuse tests: oversize bigint strings, deeply nested arrays, huge refcounts, import IDs never pulled (leak tests under `-race`). The reference has `__tests__/limits.test.ts` and `flow-control.test.ts` that should be ported.
- CI: nightly against the latest npm `capnweb` to catch wire drift (flaticols is already four minors behind).

**Verdict: ADOPT flaticols/capnweb-go provisionally, after a one-day audit. Fall back to BUILD the server subset if the audit fails.** Contribute interop tests upstream. Effort: 1 week to adopt, 3 weeks to build. Standing risk is the single-maintainer drift.

**Model trend: neutral** (infrastructure). **Signal:** Twitter 2, CV 5 (a well-tested Go port of a protocol from Kenton Varda, with a differential test harness against the reference, is exactly the Grab-style distributed-systems artifact; and the podcast literally asks for it).

## Idea 4: "Every client is also a server" (63:30)

**Idea.** The agent hands the daemon a callback stub; the daemon calls it back later.

**Fern fit.** Replaces polling `GET /events` (§5, planned). Agent passes `onSnapshot(cb)`, `onWake(cb)`; the daemon calls the stub on state transitions (§6). Webhooks (§11) could deliver to a registered stub instead of waiting in a mailbox. The T3 hook (§15) subscribes once.
Caveat: sessions are not persistent. The reference docs say a disconnect destroys all stubs, and Fern sleeps and wakes environments for hours. Callbacks are therefore session-scoped conveniences, and durable subscriptions need a resume cursor ("Resumable subscriptions", `sessions.mdx`).

**Verdict: BUILD as a thin layer on Idea 1.** 2 to 3 days. Trend: neutral. Signal: Twitter 2, CV 3.

## Top 3

1. **Audit flaticols/capnweb-go and build a differential test harness against the JS reference (Idea 3).** It is cheap, has the best CV signal, and de-risks the rest. Output: a pinned adopted dependency, or a decision to write 2k lines of server-only Go.
2. **Cap'n Web `/rpc` endpoint on the daemon with `Fern`, `Env`, `Snapshot`, `Service` capabilities (Idea 1).** The demo is a pipelined fork-and-query in one round trip, plus a 50-way `fork().map(...)`.
3. **Code Mode client as a Cap'n Web stub (Idea 2).** Keeps MCP tools as the compat path.

## Open risks

I did not run flaticols' interop suite. The "complete" claims in all the third-party READMEs are self-reported, and the Go port targets wire 0.8.0 while the reference is 0.12.0, so I don't know what changed on the wire in between. Go lacks the proxy trick that makes JS pipelining invisible, so Go clients need an explicit builder (only matters if Fern itself calls other services as a client). MCP will not carry stubs soon; the podcast's own speaker says he has "no idea how we can put it in the MCP core", so anything built on that assumption is wasted. Protocol attack surface grows with pipelining and `remap` (cheap server-side work from one frame), and Fern's actor mailbox plus quotas (§5, §6) must bound it. Mapping the stub lifetime onto durable environments is a semantic trap: session `release` must never delete state. Finally, the lens check: the whole stack is a latency and trust optimization, which grows with better models, but the fan-out demo only matters if someone actually runs many forks, and Fern's current single-node k3s caps that.
