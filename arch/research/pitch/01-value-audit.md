# Sofort / jitk: technical value audit and public-claim recommendations

**As of 2026-10-25. Research angle: brutally honest technical value.**

## Verdict

Sofort is a credible systems prototype with a useful, narrow job: execute short, untrusted JavaScript programs that coordinate explicitly granted host tools, in disposable hardware VMs. Its most interesting engineering is the combination of a small Linux-like guest kernel, asynchronous tool transport, single-use lifecycle, and an offline compatibility-development loop with Linux as an oracle.

It has **not yet demonstrated a compelling general advantage over the best alternatives for that job**. The measurements show good latency on one developer Mac, including a real concurrency advantage over the tested synchronous Hyperlight-JS bridge. They also show worse footprint and cold CPU cost than that baseline. There is no Linux bare-metal result, broad binary compatibility, production operation, or demonstrated customer workload. This is enough for an honest “I built this; here are the measurements and tradeoffs” post. It is not enough for “the fastest/cheapest/most secure sandbox for agents.”

The biggest competitive correction from this audit: **Hyperlight + Linux compatibility is already a concrete project, not merely a future threat.** The as-of-date `hyperlight-unikraft` README advertises ordinary Linux runtimes, warmed snapshots, default-deny host access, and an MCP integration. Cloudflare Dynamic Workers also explicitly supports Python. Both materially weaken the older internal “polyglot VM gap” framing. These are documented competitor capabilities, not performance or security results independently reproduced here. See the pinned sources below.

**Recommended positioning:** “Disposable computers for agent tool code: a tiny kernel, a hardware VM per invocation, and host-controlled capabilities.” Explain offline kernel growth as the engineering experiment behind that runtime. Reserve “just-in-time, purpose-built computers” for the direction unless the post explicitly distinguishes existing build-time packing from the planned per-request recipe system.

## Evidence and audit scope

I read all requested project documents: root README, FINAL, PLAN-R5, jitk README, CLAIMS, KILL-CRITERIA, ARCHITECTURE, the three top-level `bench/RESULTS*.md` files, landscape, third-option, next/SYNTHESIS, and podcast/REVIEW. I additionally inspected kernel loading/dispatch/memory/syscall sources; the VMM, sandbox and watchdog integration; executor/pool/policy/protocol sources; MCP server and results; grow proposal/acceptance code; and the Hyperlight benchmark adapter.

This was a **source and existing-evidence audit**. I did not rerun builds, tests, benchmarks, live generation, or competitor software. Existing benchmark results are attributed to their harness and artifact, not presented as measurements I took. Only this new report was written; no existing files were edited, no commits were made, and nothing was posted.

Parallel implementation edits appeared in the shared checkout during the final status check, including executor/protocol changes. The source observations below describe the files inspected during this audit; they are not a certification of those later edits or their performance. The historical benchmark artifact boundaries remain essential.

Evidence priority matters. `docs/CLAIMS.md`, `docs/KILL-CRITERIA.md` and parts of `docs/ARCHITECTURE.md` are frozen R4 statements; `FINAL.md` contains later fixes and measurements; R5 adds resource files and MCP. For example, the R4 ledger still says quiet measurements are unavailable and an import guard fails, while later receipts report quiet samples and clean-copy passes. Neither discard the old failures nor present them as unconditionally current: the missing deliverable is a consolidated, current, artifact-bound ledger.

The podcast REVIEW primarily concerns Fern, including Postgres snapshots and effects journals. Those are **not Sofort features** and must not enter Sofort's pitch. Likewise, `next/SYNTHESIS.md` contains sensible experiments and target numbers, not implemented snapshot/restore or density results.

## 1. What the code actually supports

| Topic | Audited observation | Consequence for public wording |
|---|---|---|
| Kernel size | Current `kernel/src` has 1,488 physical Rust lines plus 155 assembly lines by a direct read-only count. This excludes build code, generated dispatch, payloads and dependencies. | Approximately 1.6–1.7k kernel source lines is reasonable with the counting boundary stated. It is not whole-system TCB size. |
| Syscalls | `kernel/slots.json` has **24 syscall numbers, 23 distinct handler modules**, not 26. `exit` and `exit_group` share a handler. `mremap` and both signal handlers return ENOSYS. | Say “a few dozen restricted syscall slots,” or publish the actual list. Do not imply 24 complete Linux implementations. |
| Binary loading | `kernel/prepare.py` requires static little-endian AArch64 ET_EXEC; forbids dynamic ELF/interpreter; constrains segments to 0x400000–0x680000; rejects W+X and page-overlapping segments. | “Selected static Linux binaries” is defensible. “Run your existing Linux binaries unchanged” needs major qualification; nonconforming binaries need relinking. |
| JavaScript | A bundled static Bellard QuickJS binary runs at EL0, with a 16 MiB JS heap limit and a packed bootstrap. | This is JavaScript, not Node.js. Language syntax support does not supply npm, Node APIs or native addons. |
| Lua | A static Lua binary is repacked into an alternate image and exercises compatibility/filesystem fixtures. | Lua is a second-binary demonstration. The MCP `execute` API still accepts JavaScript; Lua tool orchestration is not demonstrated. |
| Freshness | `executor/pool.ts:89–101` retires, kills and reaps a completed VM and refills with a new one. Ready VMs can be prepared before a request. | “Fresh single-use VM per invocation” is accurate. “Cold boot on every timed invocation” is false for parked measurements. |
| Async tool calls | `protocol/bootstrap.js` tracks pending call IDs and returns Promises; `executor.ts` dispatches without awaiting each call before reading the next. | Guest `Promise.all` really can overlap host tool I/O. This is a meaningful behavior, not just syntax. |
| Guest I/O | VMM explicitly adds one virtio-console, no network or disk device. libkrun still supplies infrastructure including GIC/RTC. Packed resource files are readable through kernel syscalls. | Say “external I/O goes through a host-controlled channel; optional files are packed read-only.” “No filesystem” is now stale; “no devices” is false. |
| Binary output | `kernel/src/user.rs` terminates on nonprintable/non-ASCII stdout bytes. JS frames escape Unicode. | Unicode JS results work; arbitrary native byte streams do not. Binary adapters are not a general raw-stdout channel. |
| Persistence | Guest state dies after one invocation. Host providers can retain state; the demo's `kv` does so in host memory. | No durable VM/session filesystem, durable suspended continuation or exactly-once effects claim. |
| MCP | Official SDK server, one `execute` tool plus file resources; stdio and loopback stateless HTTP. HTTP has Host checking but no authentication. | A usable integration surface, not a hosted authenticated multi-tenant service or universal MCP gateway. |
| SDK compatibility | Executor implements the two named interfaces, but explicitly rejects connector RPC and adapts providers/bindings. | “Implements Executor/IsolateDriver” is supported; “complete drop-in support for every upstream feature” is not. |

Sources: [`kernel/README.md`](../../jitk/kernel/README.md), [`prepare.py`](../../jitk/kernel/prepare.py), [`slots.json`](../../jitk/kernel/slots.json), [`syscalls/`](../../jitk/kernel/src/syscalls/), [`user.rs`](../../jitk/kernel/src/user.rs), [`pool.ts`](../../jitk/executor/pool.ts), [`executor.ts`](../../jitk/executor/executor.ts), [`bootstrap.js`](../../jitk/protocol/bootstrap.js), [`mcp/server.mjs`](../../jitk/mcp/server.mjs), [`vmm/README.md`](../../jitk/vmm/README.md).

## 2. Novelty versus existing work

### The individual ingredients are established

Small application-specific kernels, Linux syscall shims, hardware VMs per function, prewarmed pools, snapshots, capability-only host calls, and code-mode tool orchestration all have prior art. Unikraft's binary-compatibility layer is documented; Nanos is explicitly a single-process OS implementing part of Linux's syscall interface. Virtines/Wasp isolates individual functions using a micro-hypervisor; SEUSS uses unikernel snapshots for serverless deployment. None of “small kernel,” “purpose-built computer,” or “VM around a function” is new by itself. [Unikraft compatibility](https://unikraft.org/docs/concepts/compatibility), [Nanos FAQ](https://nanos.org/faq), [Virtines artifact](https://github.com/virtines/wasp), [SEUSS publication](https://research.redhat.com/blog/publication/seuss-rapid-serverless-deployment-using-environment-snapshots/).

Executing code to orchestrate MCP tools and filter intermediate results is also established. Any savings from doing ten calls inside one program rather than ten model turns belong to that execution pattern unless measured as a Sofort-specific improvement. [Anthropic's code execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp).

### The potentially distinctive combination

1. **A deliberately restricted Linux-like kernel for capability-oriented agent snippets**, with selected static ELF compatibility instead of a bespoke guest library or mandatory Wasm target.
2. **Asynchronous host calls inside a disposable hardware VM**, integrated into familiar TypeScript executor interfaces and MCP.
3. **An explicit offline ENOSYS → proposal → Linux differential → image/manifest workflow**, where missing behavior is a development input rather than a reason to embed all of Linux.

That combination is interesting and worth showing. This search does not establish a first-in-world claim. The strongest unusual element is the explicit, reviewable compatibility-growth workflow; its demonstrated breadth is still small.

### Current competitor comparison

| Alternative | Verified capability / distinction | Sofort's honest position |
|---|---|---|
| Firecracker | KVM VMM with jailer, seccomp and snapshot support. Its familiar <125 ms boot / <5 MiB overhead figures are specification-context numbers, not an end-to-end agent workload comparison. | A much smaller guest software contract can avoid a full Linux boot, but snapshot-based Linux is a relevant baseline. No “20× faster than Firecracker” from unrelated vendor boot numbers. [FAQ](https://github.com/firecracker-microvm/firecracker/blob/main/FAQ.md), [snapshot docs](https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/snapshot-support.md). |
| gVisor | Sentry independently implements the Linux interface; systrap does not require virtualization; a KVM platform also exists. It already minimizes the Sentry's host syscall surface and continuously fuzzes it. | Smaller guest scope and a conventional per-VM boundary are tradeoffs, not proof of stronger security. Sofort lacks gVisor's broad compatibility/hardening history. [Security model](https://gvisor.dev/docs/architecture_guide/security/), [platforms](https://gvisor.dev/docs/architecture_guide/platforms/). |
| Hyperlight / Hyperlight-JS | Minimal hardware sandbox with explicit host functions and snapshots; project is pre-1.0. Release 0.18 lays groundwork for future async RPC without changing the user-facing API. | Closest direct measured comparator. jitk's async bridge wins the tested I/O fan-out; Hyperlight wins cold return, CPU and footprint. That gap is implementation-specific and vulnerable to future async support. [README](https://github.com/hyperlight-dev/hyperlight), [release blog](https://hyperlight.org/blog/). |
| **Hyperlight-Unikraft** | The pinned Oct 24 release documents ordinary Linux runtimes, warm snapshots, default-deny access and an MCP Python tool. | This invalidates “Hyperlight cannot run stock Linux programs” as an ecosystem claim. A small, inspectable kernel and concurrent tool transport remain possible differences; they need matched measurements. [As-of-date README](https://github.com/hyperlight-dev/hyperlight-unikraft/blob/5f14d1e73039f2cfb4928766586cfe75a87301ad/README.md). |
| Unikraft | Linux ABI shim and ELF loading already exist, with broad application support and application specialization. | jitk is far narrower and easier to inspect locally; breadth, ecosystem and release engineering favor Unikraft. “Unmodified binaries in a small custom OS” is not unique. [Compatibility](https://unikraft.org/docs/concepts/compatibility). |
| Nanos | Single-process VM OS implementing a Linux syscall subset; supports ARM/Mac as well as x86 use. | Close architectural prior art. Sofort's distinction is its tool-oriented workload and development workflow, not having invented a single-program Linux-compatible kernel. [FAQ](https://nanos.org/faq). |
| Wasmtime / WASI | In-process Wasm sandbox; filesystem access follows capabilities. Embedding and Wasm imports naturally expose controlled host functionality. | Avoids jitk's per-process/per-VM operation and native-ELF restrictions by accepting a different compilation target. Sofort offers a hardware boundary and selected native binaries; hardware plus Wasm is also possible. No general latency, density or security win established. [Wasmtime security](https://docs.wasmtime.dev/security.html), [Hyperlight-Wasm](https://github.com/hyperlight-dev/hyperlight-wasm). |
| V8 isolates / Cloudflare Workers & Dynamic Workers | Runtime-loaded JS, Python and Wasm; `load()` for one-time execution; `get()` for caching. Network can be blocked, proxied and supplied with host-side credentials through `globalOutbound`. | Closest product substitute for JS code mode. “Only JS” and “our host-only credentials are unique” are outdated. Sofort can target local/self-operated hardware-VM execution, but must demonstrate why that justifies running its stack. [Loading/languages](https://developers.cloudflare.com/dynamic-workers/getting-started/), [egress control](https://developers.cloudflare.com/dynamic-workers/usage/egress-control/). |
| E2B | Full Linux microVM sessions, code and commands, files, networking, secrets controls, pause/snapshot/fork. Its runtime builds on Firecracker. | Different primary job: a working agent computer. Sofort may be a smaller execution tier for short tool code; E2B offers the packages and long-lived state many agents actually require. No fair latency comparison has been run. [Official product description](https://e2b.dev/). |
| Deno Sandbox | Deno Deploy's sandbox is a Linux microVM service, not merely a Deno permission flag or V8 isolate. It supports volumes and host-scoped secret substitution. | Broader machine capability and managed operation. Sofort's restricted scope may reduce resources; this is not measured head-to-head. Distinguish Deno runtime from Deno Sandbox. [Sandbox docs](https://docs.deno.com/sandbox/), [security](https://docs.deno.com/sandbox/security/). |
| WebContainers | Browser-local Node.js environment with virtual filesystem/process-style APIs; native addons require a web-compatible alternative/Wasm. | Competes for interactive JS development, not primarily server-side hardware-isolated execution. It has a much better Node toolchain story; Sofort fits host tool access under operator control. [Introduction](https://webcontainers.io/guides/introduction), [native-addon limitation](https://webcontainers.io/guides/troubleshooting). |

**Important Hyperlight verification:** I queried the repository commits API with `until=2026-10-25T23:59:59Z`; the returned commit was `5f14d1e73039f2cfb4928766586cfe75a87301ad`, dated 2026-10-24, release v0.19.1. The pinned README above includes its MCP integration. This is not a speculative roadmap item or a mirror-only search result. I did not install or benchmark it.

Its host-call documentation still says calls are synchronous and run on the thread driving the sandbox. Thus Sofort's concurrent-tool argument remains plausible against that interface, but has not been measured against this different stack. Do not transfer the existing Hyperlight-JS results to it. [Pinned call contract](https://github.com/hyperlight-dev/hyperlight-unikraft/blob/5f14d1e73039f2cfb4928766586cfe75a87301ad/docs/calls.md).

HyperAgent separately already advertises sandboxed JavaScript, controlled capabilities and MCP-connected tools. “MCP-native agent microVM” is therefore an integration choice and distribution story, not a unique invention. Its own pre-release warning also means it is not proof that the problem is solved commercially. [HyperAgent repository](https://github.com/hyperlight-dev/hyperagent).

## 3. Performance: real strengths, fragile headlines

The benchmark methodology is more careful than the likely Twitter headline: randomized blocks, validated outputs, explicit load gates, failure counts, artifact hashes and distributions. Preserve that discipline in the pitch.

| Measurement, p50 | Existing result | What it actually means |
|---|---:|---|
| Raw parked one-tool round trip | 0.285 ms | RUN to validated done in an already READY, single-use VM; local immediate tool; excludes boot, pool preparation and TS executor adapters. |
| Raw cold `return 2` | 5.904 ms | Spawn to done, cached image/binary/signature; not initial installation, Node startup or cold disk/cache. |
| Cold executor `return 2` after native watchdog | 9.241 ms | `execute()` to result; Node startup excluded. Raw cold in this later run was 6.285 ms. |
| Parked executor one-tool | 2.882 ms | Canonical bench adapter context; do not replace it with 0.285 ms when describing this API. |
| Long-lived MCP one-tool | 2.106 ms | Separate MCP harness, warmup and ready pools; core was 1.749 ms, marginal stdio MCP overhead about 0.36 ms. |
| Raw parked `Promise.all(10 × 5 ms)` | 6.544 ms vs Hyperlight strict 63.209 ms | Around 9.7× lower wall latency for this synthetic fan-out through these bridges. Shows overlap versus serial blocking. |
| Parked executor fan-out, later run | 9.262 ms | More representative executor result than raw guest transport timing; cold executor fan-out was 16.186 ms. |
| Child CPU, quiet cold `return 2` | 4.859 CPU-ms vs Hyperlight 3.537 | Includes child user+system through reap; excludes watchdog/supervisor. Later jitk cold row was 5.041 CPU-ms. |
| Per-process physical footprint | 10.657 MiB vs Hyperlight 1.813 MiB | About 5.9× higher for jitk in that Mac probe. Excludes HVF kernel allocations; neither number is a complete host marginal-density bill. |
| Refill at parallelism 8 | 683.721 VM/s | READY plus kill/reap throughput under that test; not completed useful agent programs/sec or fleet throughput. |

Sources: [`quiet results`](../../jitk/bench/RESULTS-quiet-2026-10-24.md), [`native-watchdog results`](../../jitk/bench/RESULTS-native-watchdog-2026-10-24.md), [`MCP results`](../../jitk/mcp/RESULTS.md).

### What these results support

- A hardware boundary need not add hundreds of milliseconds to short agent tool code in this environment.
- An asynchronous guest/host protocol matters when several slow host operations can overlap.
- Most of the remaining API overhead is outside the raw VM exchange; the watchdog change already produced a substantial practical reduction in cold executor latency.
- Prebooting a single-use VM can give low request latency without recycling state from a previous tenant. This spends background CPU and warm capacity; it does not eliminate those costs.

### What they do not support

- **No general 10× Hyperlight speedup.** The adapter source calls a synchronous `bridge.exchange` before the async wrapper returns, serializing the ten tool calls. That is a real current API limitation but not evidence of a slow hypervisor. Timer wakeups and transport add to the nominal 50 ms serialized work. The engines differ too: Bellard QuickJS versus quickjs-ng.
- **No “under 5 CPU-ms” guarantee.** The later cold `return2` median is just over 5, fan-out uses more, structured data costs more, and supervisor/watchdog are excluded. The Mac result does not clear the Linux kill criterion.
- **No fleet p99 claim.** Thirty samples per case provide a weak tail estimate. There is no demonstrated high-concurrency steady-state service SLO, adversarial load distribution, or all-process CPU attribution.
- **No fast-JSON claim.** The canonical `json1m` case is one object containing one large string, and only returns its length. It neither transmits a 1 MiB frame nor represents nested/record-heavy data. Internal QuickJS research reports materially worse structured-JSON and compute performance than V8.
- **No current density victory.** Image/resources are copied. `kernel/RESULTS-fs.md` separately measures the direct-load patch saving an image copy, with resources still costing approximately one additional MiB per MiB per VM. Measurements differ across versions/harnesses: do not subtract 2.8 MiB from the old 10.7 MiB headline and call the result a new measured baseline.
- **No Linux performance inference.** Nested KVM proves useful functionality, not production costs. The reported ~68 CPU-ms under nesting is neither an acceptable metal result nor proof metal will fail.

The missing shootout should compare the same workload, host, concurrency, tool implementation, lifecycle and security contract against at least a V8/Worker-style capability runtime, Wasmtime and a fresh-VM Hyperlight configuration. Include Hyperlight-Unikraft if native compatibility is a leading claim. A plain fresh-process QuickJS arm would also reveal how much cost buys the hardware boundary. Publish both “request after READY” and “full refill/destruction cost.”

## 4. Security model and the growing-kernel trust story

### Good design decisions visible in source

The guest is treated as hostile beyond its JavaScript runtime: kernel/guest frames do not authorize tools, host-only confinement acknowledgment is separate from guest READY, tool names/arguments/results are checked on the trusted side, and credentials are issued to host callbacks rather than guest code. EL0 mappings and checked copy helpers restrict guest access; W^X is enforced for the supported memory contract. The VMM is separately confined with Seatbelt on macOS or Linux mechanisms including Landlock/seccomp. A separate native watchdog is designed to survive a blocked Node event loop. VM capacity stays charged until reap; successful results resolve before deferred retirement/refill.

Those are concrete engineering strengths. In particular, accepting that a compromised guest kernel can attack the VMM is the correct boundary. A tiny guest kernel is useful for inspection and scope control; the host still must distrust it.

### Limits that matter

**“Tiny TCB” needs a named asset and boundary.** For host isolation, trusted code includes the VMM/libkrun, hypervisor and host OS, confinement, protocol parser, executor, policy, and tool implementations. QuickJS/kernel correctness matters for intended guest execution and internal isolation, but a guest compromise should still meet the VM boundary. For protecting tool credentials and preventing unauthorized effects, the host tool and policy path is critical. Counting only 1.6k kernel lines understates all of this. Rust/no_std does not remove the unsafe MMU, pointer, device and trap code.

**A VM does not make an authorized tool safe.** Malicious code can abuse anything the host grants. Misdeclared effects, permissive validators, tool-returned secrets, SSRF in a tool, and writes that a human did not intend remain application problems. Sticky policy labels and exact-call approval digests are useful mechanisms, not a general proof against prompt injection. MCP currently has no approver UI: requests requiring approval fail closed.

**Resource limits stop at trusted callbacks.** Killing the VM does not terminate a synchronous or cancellation-ignoring host callback. The external watchdog improves VM teardown; it cannot settle a promise while Node is blocked or cancel a database mutation already accepted remotely. Output validation happens after host tool code has allocated its output. Production host callbacks need enforceable budgets/isolation and carefully defined side-effect semantics.

**Finite hostile tests are not a security certification.** The repository contains valuable protocol/device/confinement probes, including fixes for guest-triggered libkrun panics/spins. The older exposure ledger explicitly lists gaps, and later watchdog results do not automatically rerun the full matrix on the latest artifact. No independently reproduced current Linux escape matrix or external review is established here. Hardware side channels are not solved by fresh VM objects.

### What “growing” currently means

`grow/loop.py` copies the canonical kernel into a temporary repository, deliberately deletes `ppoll` and the two signal modules, observes misses, obtains one-file proposals, builds and checks fresh VMs, and writes receipts/manifests. Default mode restores canonical proposals and is explicitly labeled REPLAY; `--live` actually calls the CLI. The prompt supplies a narrow implementation specification and trusted helper API. It is not asking an agent to discover arbitrary missing Linux semantics unaided.

The three demonstrated growth contracts are one bounded poll implementation and **two explicit ENOSYS stubs**. The signal oracle uses Linux strace error injection, not normal Linux signal behavior. Lua already computes without those handlers; their addition suppresses missing-slot diagnostics and makes a fallback contract explicit. It is misleading to narrate that as “Lua could not run; the AI wrote Linux signal support; now it runs.” The manifest correctly marks full ABI equivalence false.

Repeating the same probe in thirty fresh VMs adds lifecycle/repeatability evidence; it does not multiply the semantic test domain by thirty. Differential testing must cover diverse valid/invalid arguments, state transitions, pointer boundaries, timeouts and errors to justify a broader contract. The filesystem addition has a richer fixture and corruption testing, but that does not demonstrate automatic synthesis of arbitrary filesystem behavior.

The proposal filters restrict path, source length and some unsafe constructs, and the model is asked for safe Rust against checked helpers. These are useful development rails. A text blacklist plus a few probes does not prove arbitrary malicious source is safe to compile or semantically correct. The compiler/build environment and oracle are trusted development infrastructure. “Generated kernel code automatically shipped after tests” would sound irresponsible unless promotion, review and rollback rules are explicit.

**Public trust explanation:** “The agent proposes a restricted handler offline. The controller builds it in a disposable development copy, checks a stated contract against Linux, and records the artifact. Deployments use a fixed image; a running tenant cannot extend the kernel.” Distinguish the present test gates from proposed stronger promotion/review controls. Sources: [`grow/README.md`](../../jitk/grow/README.md), [`agent.py`](../../jitk/grow/agent.py), [`loop.py`](../../jitk/grow/loop.py), [`manifest`](../../jitk/kernel/syscalls.manifest.json).

**Replay is a future capability, not a demonstrated security moat.** The VMM supplies fresh entropy and real time, QuickJS exposes timers, and Promise completion order depends on host responses. Capturing tool payloads alone is insufficient for bitwise replay. Deterministic replay would need an explicit time/randomness/scheduling/transcript contract. Replaying execution also cannot undo an email or payment. Neither a durable effect journal nor an exactly-once external-effects system is implemented by this runtime.

## 5. Strengths and defensibility

| Asset | Present strength | Moat assessment |
|---|---|---|
| Small kernel | Understandable scope; restricted memory/syscalls; selected stock runtime binaries work. | Good engineering leverage and a strong learning/demo story. Smallness is easy to lose as compatibility grows; not a durable moat by itself. |
| Async tool transport | Real fan-out through the hardware boundary, clear execution contract. | Valuable now versus the tested synchronous bridge. Straightforward for capable competitors to copy or add. |
| Single-use lifecycle | Avoids having to prove reset of previous-tenant application state. | Useful operational/security simplification. Costs refill CPU and warm memory; established pattern. |
| Growth workflow | Traceable misses, proposals, contract tests, manifests and disposable source copies. | Most distinctive research contribution. A corpus of difficult compatibility contracts and rejection tests could become an asset; the current three regrowth targets do not constitute one. |
| MCP and executor adapters | Makes the prototype accessible to existing agent systems. | Good distribution and ergonomics; low technical defensibility. |
| Local/self-operated VM execution | Operator controls images, tool access and deployment locality. | Useful preference for some customers. Operational burden and existing self-hosted alternatives limit uniqueness. |
| Security posture | Correct separation of guest execution from trusted tool authority; multiple containment layers. | Potential credibility asset after hardening and independent review. Current source size/test receipts are not a comparative security moat. |

The strongest prospective moat is **a maintained, tested catalog of useful restricted workloads plus excellent integration and measurable operation**, not an exotic new VM primitive. Before building that catalog, validate that anybody wants the restrictions.

## 6. Is it actually useful, and for whom?

### Best initial user

An agent-platform/runtime engineer who already has trusted, asynchronous tool implementations and wants to execute **small, untrusted glue programs locally or on their own hosts with a hardware VM boundary**. Their snippets join a few JSON tool results, fan out API calls, filter a small set of records, and return compact output. They do not need a shell, package installation, native addons, arbitrary outbound networking, or persistent guest state.

Example: obtain ten independent inventory quotes through host tools, select acceptable offers, return a small ranked JSON list. The VM never needs raw API credentials or a network stack. The business benefit is bounded authority and fewer model round trips; the measured transport helps avoid making that pattern slow. Any actual purchase still belongs behind the host's policy/approval process.

This is a credible **design-partner workload**, not established customer demand. For a JS-only customer, ask specifically why they reject a Worker/V8/Wasm solution. If they do not require self-operation or a hardware boundary, Sofort currently gives them extra infrastructure for limited benefit.

### Workload fit

| Workload / buyer | Fit today | Why it wins or loses |
|---|---|---|
| Short code-mode tool orchestration; agent framework authors | **Best fit** | Implemented JS/MCP path and real overlapping calls; hardware isolation without full Linux userland. Needs truthful latency/budget documentation. |
| Local agent gateway or on-prem platform with sensitive tool credentials | **Plausible** | Host controls authority and deployment. Still requires mature tool policies, patched VMM/OS operation and demand validation; credentials staying outside is not unique. |
| Small SaaS user automations / JSON transformation plugins | **Conditional** | Appropriate for tightly bounded JS and compact data. V8/Wasm have stronger ecosystem and likely compelling economics; no head-to-head proof. |
| Selected native parser/Lua jobs on packed read-only input | **Research fit** | Selected binary compatibility and resource files are real. Needs per-binary packaging, usable output contract and realistic tests before becoming a product promise. |
| jq / sqlite / ripgrep / static Rust tools | **Next experiments** | Potentially useful, but loader arena, relocation constraints, missing ABI and stdout contract can block them. Demonstrate substantive work before listing them as supported. |
| Go, Node, Python with normal packages | **Poor / unsupported** | Threads/futex/signals/runtime ABI, dynamic loading, package files and executable size are structural issues. Static Go is not automatically easy because it is one binary. |
| Coding agents: clone repo, npm install, run tests, browser, git | **Loses** | Requires a full environment and tools absent here. Full Linux sandboxes supply the capability the user is buying. |
| Data science, large structured JSON, numerical work | **Loses** | QuickJS compute speed and 16 MiB heap; no Python scientific ecosystem. Small transforms are different from substantial data processing. |
| Document/media conversion | **Loses** | Large binaries, assets, filesystem writes and native dependencies. Host tool wrapping can do it, but then the conversion runs outside jitk. |
| Persistent agent sessions, databases, web servers | **Loses** | Single-use lifecycle and no writable persistent guest environment. Not a drop-in E2B or Fern replacement. |
| High-scale RL/eval execution | **Unproven** | Density, throughput, Linux costs and language demand dominate. Current Mac microbenchmarks and Lua fixture do not validate this market. |

### Economics and operating cost

At roughly 5 child CPU-ms per tiny invocation, one million invocations consume roughly 5,000 CPU-seconds, or 1.4 CPU-hours, **for that measured component alone**. Arithmetic illustrates why amortized lifecycle cost matters; it is not a cloud bill. Tools, Node/policy, supervision, warm capacity, scheduling, contention and failure handling add costs.

At 10.7 MiB process footprint, a hypothetical 1,000 identical parked VMs already sum to about 10.4 GiB before uncounted host/hypervisor charges; this is an extrapolation, not a measured 1,000-VM result. Packed resources increase the burden. The existing Hyperlight footprint is much lower. Fast request latency obtained from a ready pool must be judged alongside refill throughput, idle capacity and burst admission.

Operational ownership includes custom kernel/runtime images, a pinned patched libkrun, Linux host requirements and confinement support, Apple signing/OS behavior, watchdog lifecycle, pool sizing and overload, provider policy, telemetry, artifact provenance, upgrade/rollback and incident response. The recent glibc/seccomp incompatibility is a concrete example of maintenance beyond “only 1.7k lines.” Staying intentionally small reduces some work; it does not remove the rest.

## 7. Three defensible claims to lead a pitch

These are deliberately bounded; choose one as the opening and put evidence in the follow-up.

### Claim 1 — A disposable hardware computer for tool code

**Suggested wording:** “Sofort runs each agent-written JS program in a fresh, single-use hardware VM. The guest has no direct network access; host tools decide what it can do.”

Why it is impressive: a tangible isolation/lifecycle model attached to an existing MCP execution surface. The kernel and protocol can be shown in source, and a malicious guest should not gain tool authority merely by forging a frame. Add that optional read-only files are packed into the image. Do not promise freedom from escapes or tool misuse.

### Claim 2 — Measured low latency, with real async calls

**Suggested wording:** “On my arm64 Mac, a warmed MCP one-tool call measured 2.1 ms median. Ten 5 ms host tools overlap inside the VM: about 6.5 ms on the raw parked path.”

Why it is impressive: gives users a real MCP number while retaining the most instructive systems result. Link both result files and label warm/raw scopes. If space is short, use only the 2.1 ms MCP figure; put cold executor ~9.2 ms and raw one-tool ~0.29 ms in a follow-up. The Hyperlight comparison is optional and should say “our tested synchronous Hyperlight-JS bridge,” not “Hyperlight is 10× slower.”

### Claim 3 — A small kernel with an explicit growth experiment

**Suggested wording:** “The guest kernel is about 1.6k Rust/assembly source lines. Missing behavior becomes an offline agent proposal, tested in fresh VMs against a restricted Linux oracle before it becomes a versioned image.”

Why it is impressive: inspectability and a concrete workflow people can challenge/reproduce. Immediately disclose that the present demo regrows bounded poll behavior plus two ENOSYS fallback contracts; it is not a general autonomous Linux implementation. A stronger demo that genuinely enables a new workload would make this a much better lead claim.

**Possible short post:**

> I built Sofort: disposable computers for agent tool code. Each JS program gets a fresh hardware VM with a tiny Rust kernel; outside access goes through host tools. Warmed MCP call: ~2.1 ms median on my Mac. Experimental; Linux metal numbers next.

This avoids claiming an unbuilt per-task kernel compiler, a platform-wide performance win or production security. The development thread/demo can then show `Promise.all`, denied capabilities and offline syscall proposals with their precise limits.

## 8. Claims to never make on current evidence

| Tempting claim | Why systems engineers will challenge it |
|---|---|
| “First purpose-built computer / first VM-per-function / first tiny Linux-compatible kernel.” | Extensive prior art, including directly relevant Hyperlight-Unikraft. |
| “Hyperlight can't run Linux binaries or Lua.” | That is at most about the tested JS guest, not the ecosystem; Hyperlight-Unikraft is already documented. |
| “Cloudflare only runs JavaScript.” | Current Dynamic Workers documentation lists Python and Wasm too. |
| “26 Linux syscalls implemented.” | Current tree has 24 numbered slots, including aliases and explicit ENOSYS stubs, with restricted semantics. |
| “Any language / arbitrary Linux binaries / Node support.” | AArch64 static ET_EXEC, fixed small arena, restricted mappings and missing runtime facilities. Lua alternate images do not establish a polyglot code-mode product. |
| “An AI writes a new kernel for every task, in milliseconds.” | Growth/build is offline; per-request recipes and snapshot system are future work; timing rows use prebuilt images. |
| “The AI implemented signals to make Lua run.” | Both handlers return ENOSYS; oracle explicitly injects ENOSYS; Lua already computes without them. |
| “Verified against Linux” without the tested domain. | Selected traces and outputs are checked; full ABI equivalence is explicitly false. |
| “The entire trusted system is 1.7k lines / memory safe / unhackable.” | Ignores host stack, dependencies, trusted tools and unsafe low-level code. No comparative security proof. |
| “Prompt-injection-proof / credentials can never leak.” | Allowed tool authority and tool outputs can still be abused. No end-to-end proof. |
| “0.29 ms cold start” or “0.29 ms MCP.” | It is a raw already-READY one-tool measurement; cold executor and MCP are different rows. |
| “10× faster than Hyperlight” or “100× faster than E2B.” | Synthetic async-versus-sync workload or unmatched lifecycle/network/platform comparisons. |
| “Under 5 CPU-ms, guaranteed / cheapest / highest density.” | Later cold median exceeds 5; supervisor excluded; no metal/fleet cost; footprint loses to measured Hyperlight. |
| “Only 10.7 MiB total” or “≤2 MiB per VM.” | Process footprint excludes kernel charges; latter is a target, not a result. |
| “Fastest JavaScript / fast structured JSON.” | QuickJS is chosen for footprint/startup; internal results favor V8 for substantial compute/structured data. |
| “Deterministic / bit-for-bit replayable / exactly once.” | Time, randomness, completion order and irreversible external effects lack the required contract. |
| “No interpreter on the runtime path.” | QuickJS interprets submitted JS; any intended host-supervision distinction must be stated. |
| “Production-ready / security audited / Linux performance proven.” | Source audit and finite fixtures are not those claims; Linux testing is nested, and evidence spans artifact generations. |

## 9. Minimum work to become pitch-ready, ranked

Effort estimates are my engineering estimates for one person already familiar with the repository, not commitments. Measurement access/toolchain problems can extend them. No cloud resources were provisioned for this audit.

| Rank | Deliverable and acceptance criterion | Estimated effort | Required for |
|---|---|---:|---|
| 1 | **One current claim sheet.** Pin source/image/VMM hashes; reconcile R4 versus later passes; count actual slots; describe JS versus Lua, raw versus executor versus MCP, and resource FS. Link every headline number to its exact row. | 3–5 hours | Any technically serious public post. |
| 2 | **A reproducible useful end-to-end demo.** One MCP invocation fans out independent host tools, filters/join results and returns compact JSON; show denied access and credentials staying host-side. Publish the exact snippet/setup and initial versus warmed timings. | 0.5–1 day | Any product-value pitch. |
| 3 | **Linux bare-metal evidence.** Same harness and code on declared ARM64 KVM hardware; cold and parked API distributions, failures, all-process CPU through reap/refill, at least concurrency 1/8/32. Include a longer sample set for tails and publish raw data. | 0.5–1.5 days once host access exists | Any Linux/hosting/economics claim. A Mac experiment post can precede it with explicit limits. |
| 4 | **Current memory ledger.** Post-patch host private/shared/RSS/PSS or platform equivalents, plus hypervisor/kernel charges where measurable, at N=1/16/64/256; empty/one-tool/structured-data/resources. Do not derive capacity from guest RAM. | 0.5–1 day | Any density or cost pitch. |
| 5 | **A fair narrow baseline.** Same tools/input, concurrency and lifecycle against fresh-process QuickJS, a V8/Worker-style option and Hyperlight; distinguish warm logical reset from fresh hardware VM. If Linux compatibility leads, add Hyperlight-Unikraft. | 1–3 days | Any “better/faster than X” claim. Otherwise omit comparative superlatives. |
| 6 | **Current containment receipt.** Full existing hostile matrix on final artifacts on both OSes; EOF mid-call, latest watchdog probes, callback noncooperation and host allocation/overload cases; document residual limits. | 1–3 days | Inviting users to run hostile workloads; still not production certification. |
| 7 | **A nontrivial live growth win.** A previously failing useful workload becomes functional because genuinely new behavior is added; hidden argument/state tests and intentionally wrong-handler mutations fail the gate. Label replay/live explicitly and separate review/promotion. | 1–3 days for a narrow target; possibly longer | Leading with autonomous kernel growth rather than discussing it as a research experiment. |
| 8 | **Compatibility census before promises.** Run actual jq/SQLite/rg/static Rust/Go/Lua/Python tasks with representative inputs; record loader failures, syscall needs, output limitations and implementation cost. | 1–3 days for census only | A multi-language/native-workload roadmap grounded in evidence. |

**Minimum for an honest experimental Twitter post:** items 1–2, a cited existing Mac receipt, and explicit limitations; approximately 1–2 engineer-days. There is no need to implement snapshots, Python, a filesystem write path or a new VMM to post a truthful engineering result.

**Minimum for a differentiated infrastructure pitch:** items 1–7 and one motivated design partner. Allow roughly 1–2+ weeks rather than assuming all estimates add cleanly; semantic growth or competitor setup can dominate. If the new results show no practical advantage over a maintained baseline, narrow the project to the growth/testing research contribution or consider shipping the executor as a backend integration instead of a standalone platform.

**Not minimum pitch work:** replacing libkrun, a per-request kernel compiler, full Python/Node, broad POSIX support, Cap'n Web pipelining, durable VM state or a compliance product. These can consume months and blur the original value test. Snapshot sharing and WAIT/resume are sensible scale experiments, but their proposed ≤2 MiB and 1–2 CPU-ms numbers must remain hypotheses until measured. Avoid quietly abandoning the fresh-single-use contract when introducing reuse/reset optimizations.

## 10. Questions that decide whether to keep investing

1. Will an actual agent-platform engineer choose this over a capability-restricted V8/Worker/Wasm runtime because they specifically require a hardware boundary or operator-controlled local deployment?
2. Does a real tool workload improve end-to-end user latency or operating cost once model/API/network time, pooling and trusted tools are included?
3. Can Linux sustain the desired concurrency without process/thread/memory costs overwhelming the fast raw path?
4. Can the growth loop implement genuinely useful missing behavior with diverse tests and manageable review cost, rather than repeatedly rediscovering easy fallback contracts?
5. Does a native-binary workload need this narrow ABI enough to tolerate packaging/relinking, instead of choosing Wasm or a larger Linux sandbox?

Until those answers exist, the defensible achievement is a strong prototype and a clear experiment. That is already enough to interest systems engineers—provided the pitch is as careful as the better parts of the repository's own evidence.

## Executive summary

1. Real engineering value exists for short, capability-restricted agent tool programs.
2. Current product scope is JS over MCP; Lua is an alternate-image compatibility demo.
3. Small kernels, native ELF shims and per-function VMs have substantial prior art.
4. Hyperlight-Unikraft already documents native runtimes, snapshots and MCP integration.
5. Cloudflare Dynamic Workers supports Python as well as JS/Wasm.
6. The strongest current behavior is concurrent host-tool I/O inside a single-use hardware VM.
7. Warmed MCP one-tool latency is ~2.1 ms; ~0.29 ms is only the raw parked path.
8. The ~9.7× fan-out comparison is specific to the tested synchronous Hyperlight-JS bridge.
9. jitk loses the existing Hyperlight comparison on footprint and cold CPU cost.
10. Linux metal, full host cost and production-density evidence remain absent.
11. The current tree has 24 syscall slots, including ENOSYS contracts—not 26 complete implementations.
12. Growing means offline proposals and bounded tests; two demo handlers merely return ENOSYS.
13. Tiny kernel source is not the whole TCB, nor proof of security or deterministic replay.
14. Make a truthful demo/evidence post now after 1–2 days of packaging; defer platform superlatives.
15. Validate one hardware-isolation-driven customer and Linux economics before broadening the OS.
