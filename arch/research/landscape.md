# Agent code-execution sandboxes, 2026: where jitk's niche is real

Evidence tags: [S] = found in a cited source this session (mostly vendor or secondary claims); [B] = background knowledge, not re-verified; [I] = my inference. Only a handful of searches were run. Treat all cold-start and price numbers as vendor claims that were not measured on a common basis.

## 1. Landscape table

Model: BOX = full Linux machine, CAP = capability-restricted runtime.

| System | Isolation | Cold start | Memory/sandbox | Linux ABI | Pricing/density | Model |
|---|---|---|---|---|---|---|
| E2B | Firecracker microVM [B] | ~150 ms commonly cited [S] | GBs configurable [B] | Full | ~$0.05/vCPU-h [S] | BOX |
| Daytona | Container-based by default [B]; Kata/other options [B] | "sub-90 ms" advertised [S] | GBs | Full | ~$0.05/vCPU-h [S] | BOX |
| Modal Sandboxes | gVisor [B] | sub-second for pre-cached images [S] | GBs | Nearly full (gVisor reimplements syscalls) | ~$0.07/vCPU-h [S, units muddled] | BOX |
| Vercel Sandbox | Firecracker [B] | "milliseconds", no number [S] | provisioned GB | Full | ~$0.128/active CPU-h [S] | BOX |
| Fly Machines | Firecracker [B] | hundreds of ms start; sub-second resume from suspend [B] | 256 MB+ | Full | per-second billing [B] | BOX |
| Northflank / Blaxel | Kata/gVisor, microVM [B] | Blaxel claims ~25 ms resume from standby [B] | GBs | Full | Northflank's own 200-concurrent estimate is $7.2k against E2B/Daytona $16.8k and Vercel $31.1k, a vendor-run comparison [S] | BOX |
| Firecracker (raw) | KVM microVM | snapshot restore single-digit ms claimed by a blog [S]; docs say restore cost scales with memory size, vCPUs and devices [S] | tens of MB to GB | Full (guest kernel) | n/a | BOX building block |
| gVisor | User-space kernel (Sentry) | ms [S] | small | ~Most syscalls; I/O "syscall tax" [S] | n/a | BOX-ish |
| Kata | VM per pod | ~150-300 ms boot [S]; one paper measured seconds end-to-end [S] | 100s MB | Full | n/a | BOX |
| Unikraft Cloud | Unikernel on VM | "10 ms" cold start, vendor claim [S] | few MB-tens MB [B] | Binary-compatible layer for many Linux apps [B] | n/a | Mid: app-specific image |
| Hyperlight | KVM/MSHV micro-VM, no OS | ~1-2 ms VM creation, target <1 ms; ~900 us/call reported [S] | 1.8 MiB (per brief) | None (guest functions via host-call ABI) | n/a | CAP |
| hyperlight-wasm | Hyperlight + wasmtime guest | same VM cost plus Wasm instantiate [S] | small | WASI-ish components | n/a | CAP |
| Wasmtime / WASI 0.3 | Wasm sandbox in process | microseconds-ish, unsourced [S, weak] | KBs-MBs | None; WASI 0.3 adds native async (spec ratified, Wasmtime 46 shipping) [S] | n/a | CAP |
| Cloudflare Dynamic Worker Loader | V8 isolate | ~ms, ~1 ms in a third-party table [S] | few MB; 128 MB cap [S] | None (JS/Wasm only) | per-Worker fee waived in beta [S] | CAP |
| Cloudflare Sandbox SDK / Containers | Container VM | 2-3 s [S] | up to 12 GB [S] | Full | usage-based | BOX |
| Deno / Val Town isolates | V8 isolate + permission flags [B] | ms [B] | MBs | None (JS/TS, Wasm) | cheap [B] | CAP |
| Pyodide | CPython in Wasm | ~1-2 s load unless snapshotted [B] | 10s-100s MB | Python only | n/a | CAP |
| Anthropic / OpenAI code-exec tools | Hosted containers (gVisor-ish [B]) | seconds | GBs | Full-ish Python box | tool-priced | BOX |
| MCP "code mode" | A pattern, not a sandbox | n/a | n/a | n/a | n/a | Needs a sandbox |

Key facts on the pattern: Anthropic's "code execution with MCP" post reports 150k to 2k tokens (98.7%) on one worked example, not a general benchmark; Anthropic's productized programmatic tool calling measured a 37% average reduction [S]. Cloudflare's Code Mode and Dynamic Workers target the same pattern with V8 isolates and no network by default (`globalOutbound: null`) [S]. Cloudflare itself says isolates have different security characteristics than hardware-backed environments [S].

Sources: https://www.infoworld.com/article/4149869/cloudflare-launches-dynamic-workers-for-ai-agent-execution.html ; https://lumenize.com/blog/cloudflare-code-isolation-guide ; https://techstrong.ai/features/cloudflare-says-containers-are-too-slow-for-ai-agent-sandboxing-and-offers-an-alternative-thats-100x-faster/ ; https://opensource.microsoft.com/blog/?p=97273 ; https://www.phoronix.com/news/Microsoft-Hyperlight-Wasm ; https://www.superagent.sh/blog/ai-code-sandbox-benchmark-2026 ; https://northflank.com/blog/ai-sandbox-pricing ; https://northflank.com/blog/kata-containers-vs-gvisor ; https://arxiv.org/pdf/2501.04580 ; https://unikraft.com/blog/death-to-cold-boots ; https://github.com/firecracker-microvm/firecracker/blob/master/docs/snapshotting/snapshot-support.md ; https://zylos.ai/research/2026-09-23-agent-sandbox-snapshot-restore ; https://www.anthropic.com/engineering/code-execution-with-mcp ; https://bytecodealliance.org/articles/WASI-0.3 ; https://wasi.dev/releases/wasi-p3

## 2. Where the market is crowded and where it is empty

The market splits in two [I]:
- **BOX tier** (E2B, Daytona, Modal, Vercel, Fly, Blaxel). Full Linux, 100 ms to seconds, GBs, billed per CPU-hour. Strong for "agent gets a computer" work: clone repo, npm install, run tests, browse. These vendors compete on snapshot/resume speed, so the cold-start gap closes over time.
- **CAP tier** (V8 isolates, Wasm, Hyperlight). Ms or less and MBs, but you only run JS/Wasm (or guest code compiled to a custom ABI). Strong for glue code and tool orchestration.

The gap jitk targets: **CAP-tier cost and isolation posture with an unmodified Linux binary ABI.** Nobody in my survey ships "hardware VM per call, ~1 ms, run stock static binaries, zero ambient authority, async tool channel." Candidates for closeness: Unikraft (app-specific images and a broader surface), gVisor (large Sentry TCB, hundreds of syscalls), hyperlight-wasm (needs Wasm compilation, so no arbitrary ELF). [I] I did not find a direct competitor, but my search was shallow, and microVM-per-call research projects (e.g. snapshot-fork systems) may exist.

Skeptical caveats:
- Hyperlight is faster and smaller (1.8 vs 10.7 MiB) and has Microsoft backing and an Azure Front Door roadmap item [S, secondhand]. jitk's edge is the ABI, not speed.
- Isolates are already ~1 ms and effectively free; for JS code mode, Cloudflare Dynamic Workers is a hard incumbent. jitk wins only if the user needs non-JS or wants a hardware boundary.
- jitk's numbers are from a loaded macOS prototype, not Linux/KVM at scale. Density on Linux hosts (hundreds of VMs per host, EPT overhead, snapshot sharing) is unproven.
- "Unmodified binaries" means static binaries with no fs/net. Anything needing /proc, files, sockets, threads, mmap oddities, or fork will hit the missing surface; the grown-syscall approach converts that into an engineering loop, not a free pass. Python (dynamic glibc, many modules) is much harder than QuickJS/Lua.
- Verification "against Linux" proves conformance on tested inputs, not security. A 1.4k-LOC kernel is a small TCB, but the hypervisor (VMM, KVM) remains the dominant attack surface regardless.

## 3. Why a grown, verified syscall surface matters [I]
- **Attack surface:** Linux exposes ~350+ syscalls and large subsystems; gVisor re-implements ~200+ [B]. A surface limited to what workloads actually used is a whitelist by construction, and each syscall has a differential test against Linux. This shrinks guest-kernel bugs to a reviewable size (1.4k LOC is readable in a day).
- **Auditability:** A reviewer or customer can read the whole kernel and the syscall list. That is a procurement and compliance argument, not just a technical one.
- **Determinism:** No fs, no network, no clock/entropy unless provided means a run is a pure function of (binary, input, tool-call responses). Record the tool-call transcript and you can replay bit-for-bit, which BOX products cannot offer.
- **Growth loop risk:** An agent-grown surface means a syscall added to unblock a task is a new attack surface; it needs human or policy gating. This is the weakest point if marketed as "agent-extended."

## 4. Use cases: where jitk wins and loses

| Use case | jitk vs alternatives |
|---|---|
| Tool-orchestration code mode | Wins vs BOX (1 ms vs 100 ms+, MiBs vs GBs, credentials stay host-side, async Promise.all). Roughly ties V8 isolates for JS; wins if the model writes Lua/Python-ish/other. Loses on ecosystem (npm, TS types) to Cloudflare/Deno. |
| Data transforms (jq/sqlite/duckdb over tool results) | Real win if the static binaries run (jq, sqlite: plausible; duckdb: large, C++, threads/mmap, hard). Wasm builds of sqlite exist, so isolates/Wasm are competitive; the advantage is "same binary as production." |
| Document conversion | Weak. pandoc/libreoffice need files, fonts, big deps: BOX wins. |
| Agent-written Go/Rust/C programs | Medium. Static Go/Rust musl binaries are the natural fit, but who compiles them? Compilation needs a BOX; jitk is the run side. Strong pairing: compile in a BOX once, run many times in jitk with a tiny syscall set. |
| Deterministic replay/auditing | Strongest differentiator vs everything else [I]. |
| Multi-tenant SaaS plugins | Strong if plugin authors want any language. Competes with Wasm components (cleaner, standard), V8 isolates (JS only). Edge: no need to recompile to Wasm. |
| Per-request user scripts (Shopify Functions-like) | Shopify uses Wasm with tight limits [B]; jitk matches latency class, offers more languages, loses on standards/tooling. |
| CI-like checks | Loses: needs fs, network, toolchains. BOX territory. |
| Edge | Depends on KVM availability; Cloudflare/Fastly (isolates, Wasm) own this. Loses unless run on own bare metal. |

## 5. Ranked top-6 use cases and who pays

1. **Code mode for tool orchestration at scale (any language), credentials host-side.** Pays: agent platforms and enterprises with hundreds of MCP tools (cost per run and latency matter at millions of snippets). Direct competitor is Cloudflare Dynamic Workers for JS; differentiator is polyglot plus hardware isolation.
2. **Auditable, replayable agent actions.** Pays: regulated industries (finance, health, gov), agent-governance and compliance vendors. Transcript + deterministic VM = evidence. Biggest moat, but demand must be validated.
3. **Multi-tenant plugin/extension execution in any language.** Pays: SaaS platforms (commerce, CRM, workflow tools) who currently force JS or Wasm. Needs a stable ABI and tooling story.
4. **Untrusted-data transforms with stock binaries (jq, sqlite, small parsers) over tool results.** Pays: agent platforms wanting to cut tokens by processing outside the model. Keeps the "same binary as prod" argument. Limited by which binaries run.
5. **Run-side for agent-compiled static programs (Go/Rust/C), compile elsewhere.** Pays: coding-agent vendors and eval/RL-training infra that run millions of untrusted snippets (density plus determinism are valuable there). Needs the compile-in-BOX pairing.
6. **Per-request user scripts at an operator's own edge/bare-metal.** Pays: commerce, API gateway and automation vendors. Lowest rank because Wasm and isolates are entrenched and standard, and edge providers control KVM access.

## 6. Bottom line
The niche is real but narrow: **polyglot, hardware-isolated, ms-scale, replayable glue code with zero ambient authority.** It is not a replacement for E2B-style computers, and it does not beat isolates on JS. Biggest risks: Hyperlight adding a Linux-ish ABI layer, Cloudflare widening beyond JS, and the real-Linux-KVM numbers failing to hold up. Cheapest next validation: run on Linux/KVM at 1k concurrent VMs, and demonstrate three non-JS workloads (sqlite, a Go static binary, Lua) plus a replay demo.
