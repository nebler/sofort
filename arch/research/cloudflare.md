# jitk and Cloudflare's platform (research as of 2026-10-24)

Labels: [F] = from a cited source, [I] = my inference, [U] = unverified or not researched in depth. Several sources are secondary coverage of Cloudflare's own claims, and I say so where it matters.

## 1. Current state of each Cloudflare piece

**Workers + V8 isolates.** [F] Each isolate gets 128 MB, covering the JS heap and Wasm. A request gets 30 s CPU by default, configurable to 5 min. The bundle limit is 64 MiB uncompressed. A Worker is single-threaded, and threads and Web Workers are unsupported. https://developers.cloudflare.com/workers/platform/limits/ and https://developers.cloudflare.com/workers/platform/web-assembly/. [F] Isolates cannot run native binaries. The only route to other languages is compiling them to Wasm. [I] Cold start is single-digit ms for a warm-code Worker, but I found no 2026 number I could cite for it.

**Wasm/WASI in Workers.** [F] Wasm is loaded as precompiled modules through the JS API. SIMD works and threads do not. The docs describe WASI but I did not confirm how much of it Workers implements. Rust is the best-supported path, and the docs say "most languages" compile to Wasm. [F] Python Workers reached GA on 2026-09-21. They run Pyodide (CPython compiled to Wasm) inside workerd, and multiprocessing and threading do not work. https://simonwillison.net/2026/Sep/21/cloudflare-python-worker/. [F, secondary] Native Python extensions without a Wasm build need Containers. https://www.issoh.co.jp/tech/details/18259/. [I] Wasm in Workers is a library-embedding model. It is not a "run an arbitrary Linux ELF" model.

**Code Mode / @cloudflare/codemode.** [F] v0.1.0 (2026-02-20) is a runtime-agnostic rewrite with an `Executor` interface. It ships a prebuilt `DynamicWorkerExecutor`, and `createCodeTool()` returns an AI SDK tool. https://developers.cloudflare.com/changelog/post/2026-02-20-codemode-sdk-rewrite/. [I] The Executor interface is the seam where a jitk backend plugs in. This follows from your own adapter already implementing it.

**Dynamic Worker Loader (`worker_loaders`).** [F] Open beta since 2026-03-24 for paid Workers users. `load(code)` makes a one-shot isolate and `get(id, cb)` makes a cached one. `globalOutbound: null` blocks all network. Custom bindings are the only capability channel. Companion libraries are `@cloudflare/codemode`, `@cloudflare/worker-bundler` and `@cloudflare/shell`. Pricing: 1,000 unique Dynamic Workers per month included, then $0.002 per Dynamic Worker per day (not yet charged), plus normal Workers request and CPU rates ($0.30 per million requests, $0.02 per million CPU-ms). https://developers.cloudflare.com/changelog/post/2026-03-24-dynamic-workers-open-beta. [F, vendor claim] Isolates start in "a few ms" with "a few MB" of memory, "~100x faster / 10-100x more memory efficient than containers". https://techstrong.ai/features/cloudflare-says-containers-are-too-slow-for-ai-agent-sandboxing-and-offers-an-alternative-thats-100x-faster/. Analysts note this has not been independently benchmarked. [F] JS and TS are first-class, and Python modules load but start much slower.

**Containers.** [F] GA 2026-04-13, Workers Paid only. https://developers.cloudflare.com/changelog/post/2026-04-13-containers-sandbox-ga/. Instance types run from lite (1/16 vCPU, 256 MiB) to standard-4 (4 vCPU, 12 GiB). Memory and disk are billed on what is provisioned and CPU on active use. Rates: $0.0000025 per GiB-s, $0.000020 per vCPU-s, egress $0.025 per GB. https://developers.cloudflare.com/containers/pricing/. Cold start is "often 1-3 s". Each instance is a Firecracker microVM with its own kernel, running your image as a Linux container. It is reached via a Durable Object (`ctx.container`) and the image is linux/amd64. https://developers.cloudflare.com/containers/platform-details/architecture/. [U] Nested virtualization is undocumented. [I] Stock Firecracker does not expose VMX/SVM to guests (per https://newsletter.iximiuz.com/posts/nested-virtualization-and-more-affordable-prices-come-to-iximiuz-labs), so assume `/dev/kvm` is absent.

**Sandbox SDK.** [F] GA with Containers. It gives a TypeScript API for exec, files, exposed services, preview URLs, PTY, a code interpreter, and backup and restore. Pricing is active-CPU. https://infoq.com/news/2026/04/cloudflare-sandboxes-ga (secondary). The version numbers in coverage conflict (0.8.9 vs 0.12.1), so I did not resolve that.

**Agents SDK, Durable Objects, Workers for Platforms.** [U] I did not fetch these. From general knowledge [I]: Agents are Durable Object-based stateful agents that can use codemode. DOs have SQLite storage and are the orchestration and state layer, and are also the front door to Containers. Workers for Platforms is multi-tenant Worker hosting, and Dynamic Workers are its ad hoc, code-as-string sibling. All of these are JS-isolate-centric. I found no announced plan for microVM or native-binary tenants outside Containers.

## 2. Workloads

| Workload | In isolate/Wasm? | Containers/Sandbox | jitk |
|---|---|---|---|
| JS/TS snippet calling tools | Yes: Dynamic Workers, ms, cheap. Cloudflare's home turf | Overkill | No advantage on Cloudflare |
| Python | Pyodide, GA, no threads, limited native wheels | Yes, 1-3 s cold | Needs a static CPython. Plausible but heavy; the 17-syscall surface likely needs growth |
| sqlite | Wasm builds work; D1 and DO SQLite are native | Yes | Static sqlite3 fits well, but the Wasm alternative is already good |
| jq, ripgrep, pandoc, Go/Rust CLIs | jq and ripgrep have Wasm ports; Go and Rust compile to Wasm with effort. Pandoc-wasm exists but is huge [I] | Yes, trivially | The real gap: unmodified static ELF, ms-scale, no per-tool Wasm port |
| ffmpeg | Wasm build is slow and single-threaded [I] | Yes, but pay for vCPU | Poor fit: needs threads and heavy CPU, and the tool-call-only I/O is awkward for large media |
| Compiled user or LLM-written C/Rust/Go | Needs the user to target Wasm | Yes, with a build step | Strong: an agent compiles a static binary and jitk runs it with no Wasm target |

[I] The honest gap is "an unmodified static Linux binary, in a fresh VM, in single-digit ms, with I/O only through audited tool calls." Cloudflare covers this with Containers at 1-3 s, or with Wasm ports you must build and maintain. That is a 1000x latency gap against Containers. Against Dynamic Workers the gap is a language and ABI gap, not a speed one.

## 3. Where it fits, skeptically

- [I] Dynamic Workers already give hard isolation, ms starts, a bindings-only capability model and a ready Executor path. For JS code mode, jitk has no edge on Cloudflare. Its pitch is the escape hatch for non-JS code and for binaries without Wasm ports.
- [I] The async tool-call advantage is real versus Hyperlight, but Dynamic Workers also have native async JS and RPC bindings, so it does not differentiate against Cloudflare.
- [I] Isolation story: V8 isolates are a large, constantly patched attack surface, and Cloudflare layers OS-level hardening on top. jitk's hardware VM plus a tiny kernel is a smaller, differently shaped boundary, which matters to security-sensitive buyers. This is an argument, not a measurement.
- [I] The 17-syscall surface limits real software. Python, Go runtimes (futex, clone, mmap flags) and pandoc (Haskell) will force syscall growth, which is exactly what the JIT-syscall loop is for. That loop is untested at that scale.

## 4. Can jitk run ON Cloudflare?

- [I] Not in Workers or Dynamic Workers: no KVM, no native code.
- [I] Probably not in Containers or Sandbox: Firecracker guests normally lack nested virt, and nothing in the docs promises `/dev/kvm`. This needs a direct test (`ls /dev/kvm` in a Sandbox) before ruling it out.
- [I] The viable fallback is software emulation of the guest ISA, or running the kernel as Wasm. Those would give up the hardware-VM isolation that is the point.
- [I] So the realistic deployment is jitk as an off-platform Executor backend. A Worker or Agent's `Executor` calls a jitk fleet (own metal or cloud with KVM) over HTTP and tool calls route back via the host executor. The added network RTT eats part of the 1.1 ms advantage.

## 5. Ranked use cases

1. **Code-mode backend for non-JS and native-tool steps behind an `Executor`** (agent writes Lua/Python-style glue or runs a static CLI): fills the gap between Dynamic Workers (JS only) and Containers (1-3 s).
2. **Running LLM-compiled static binaries (Go/Rust/C) as untrusted user code** without requiring a Wasm target: the Wasm path is the main friction in Workers today.
3. **Deterministic data-wrangling tools (sqlite, jq, ripgrep, awk) as tool-call-only sandboxes inside agent loops:** unmodified upstream binaries, with differential verification as a trust story.
4. **Self-hosted or regulated code-mode where a hardware boundary is required** (sidecar to Agents SDK flows): the smaller TCB is the sell, not speed.
5. **High-fan-out parallel tool orchestration (Promise.all over many tools) for polyglot code:** the async-tool-call design plus ~10 MiB/VM density, valued where Hyperlight-style sync calls hurt.

Caveats: Agents SDK, DO and WfP details were not verified. The Sandbox SDK version conflict is unresolved. The "100x" isolate numbers are Cloudflare's own and not independently benchmarked. Nested virt on Containers is unconfirmed either way.
