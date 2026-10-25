# Hosting and executing agent code: the October 2026 landscape

Research date: **2026-10-25**. Scope: execution infrastructure, its economics, and the credible market position for Sofort/jitk. No vendor workloads were benchmarked during this research. Prices are USD list prices, before tax, discounts, model tokens, and usually storage/network/control-plane charges. This is research and pitch material, not a purchasing quote.

## Verdict

**There is demand for disposable code execution, but “fast microVMs for agents” is already a crowded category. Sofort's plausible wedge is an embeddable, hardware-isolated executor for short, capability-scoped tool programs.** It should attach to existing agent frameworks and computers, rather than compete to provide the entire computer.

Cloudflare already implements almost exactly the proposed code-mode programming model; Vercel now offers QuickJS code mode as well as Linux sandboxes; Hyperlight supplies the small, hardware-isolated function runtime; Unikraft advertises sub-10-ms machines and now ships a sandbox SDK. AWS launched **Lambda MicroVMs on June 22, 2026**, a particularly important addition missing from earlier local research. None of those observations establishes that Sofort has no value. They establish that speed, a VM boundary, MCP, and snapshots are individually insufficient differentiation.

The most promising combination is **a fresh VM for every generated program, a very small auditable guest kernel, no ambient network or credentials, local asynchronous tool calls, and a framework-neutral host API**. Today this is a promising research prototype, not a demonstrated price/density leader or a general Linux-compatible product.

### Evidence conventions and relationship to prior work

- **[V]**: first-party vendor/project statement, not independently measured here.
- **[L]**: local project documentation/measurements; conditions and limitations retained.
- **[I]**: this report's inference, commercial judgment, or explicit calculation.
- **NR**: not reported or not verified in the primary sources inspected. It does not mean the feature does not exist.
- Dates below are publication/update dates when available. **“Accessed Oct 25” means the page is undated**, not that the feature launched that day.
- “Cold start” can mean VM creation, restoring a prepared image, API allocation, first command, or application readiness. These are different measurements. Public vendor numbers and local Sofort measurements are not a head-to-head benchmark.
- Density means **simultaneously resident/runnable environments per physical host at a declared workload**, not an account concurrency quota, a fleet-wide launch test, a monthly start count, or the number of sleeping snapshots.
- MCP hosting a trusted server, exposing a sandbox-management API over MCP, and executing generated code that calls MCP tools are three separate capabilities.

Read first: [FINAL.md](../../FINAL.md), [PLAN-R5.md](../../PLAN-R5.md), [prior landscape](../landscape.md), [Cloudflare source research](../cloudflare-deep.md), [next-round synthesis](../next/SYNTHESIS.md), and [podcast landscape](../podcast/08-landscape.md). This report updates them rather than treating their unverified background entries as facts.

### Material updates and corrections

1. **Dynamic Workers are no longer free during a beta.** New Worker creations have been billable since May 26; one-off `load()` is materially different from repeated invocation of a stable `.get()` ID. [Cloudflare pricing, updated Jun 11](https://developers.cloudflare.com/dynamic-workers/pricing/).
2. **Cloudflare native Container snapshots are documented now**, with filesystem-only semantics, image-version constraints, and a required scheduling policy. The earlier “promised” characterization is stale. [Snapshot guide, updated Sep 30](https://developers.cloudflare.com/containers/guides/snapshots/).
3. **Deno Sandbox is Firecracker/Linux, not a V8-isolate-only service.** Its current landing-page rates also differ from the February launch rates. [Current product page, accessed Oct 25](https://deno.com/deploy/sandbox).
4. **Modal has both gVisor and VM runtimes.** Its Sandbox rate card differs from ordinary Functions. [Runtime docs](https://modal.com/docs/guide/sandboxes), [Sandbox pricing](https://modal.com/products/sandboxes), accessed Oct 25.
5. **Daytona closed its production codebase in June, not an unverified October event.** Its older code remains public but is no longer maintained by the company. [Daytona announcement, Jun 11](https://www.daytona.io/dotfiles/updates/daytona-is-going-closed-source).
6. **`boat.dev` really exists.** Covering only Bolt.new would omit an actual low-cost VM competitor. [Boat](https://boat.dev/), [YC Fall 2026 company page](https://www.ycombinator.com/companies/boat), accessed Oct 25.
7. **E2B's current fork guide says up to 20 forks per SDK/CLI call**, not the prior report's 100. [Current fork docs](https://docs.e2b.dev/sandbox/fork), accessed Oct 25.
8. **Fly added a unified Machines/Volumes/Apps/Sprites MCP endpoint on October 23**, two days before this report. [Launch](https://fly.io/changelog/new-fly-mcp/).

## 1. What the industry is converging on

There are four execution products, with increasing overlap:

| Execution product | Typical operation | Relevant suppliers | What the buyer is buying |
|---|---|---|---|
| In-process capability runtime | Run 20 lines of JS against provided functions | Vercel Labs `run`, AI SDK code mode, QuickJS/Wasm libraries | Very low integration and launch overhead; software isolation |
| Managed isolate runtime | Load generated JS/Python/Wasm beside an application | Cloudflare Dynamic Workers | Multi-tenant runtime operations, placement, policy, observability |
| Hardware-isolated function runtime | Run a constrained program in a tiny VM | Hyperlight; Sofort | Another security boundary without a full Linux environment |
| Full agent computer | Clone a repo, install packages, run Docker/browser/tests, retain work | E2B, Daytona, Vercel Sandbox, Modal, Fly, Boat, Deno, AWS, Northflank, Morph, Unikraft | Compatibility, persistent state, fast reuse, networking, fleet operations |

**[I] The commercial dividing line is increasingly authority and lifecycle, not just language.** Does generated code receive narrowly scoped functions, or a shell/filesystem/network? Is the unit of trust a snippet, user, conversation, or whole developer workspace? A persistent computer and a disposable tool-program runtime can be complementary: the computer can delegate small untrusted transformations to the latter.

Secret brokering is already widespread. Deno injects secrets at an outbound proxy, Runloop has a Credential Gateway/MCP Hub, Fly has connectors, Cloudflare can add credentials outside the sandbox, and Modal introduced same-host trusted Sidecars on October 1. Credentials staying outside generated code is valuable but not unique. [Deno launch, Feb 3](https://deno.com/blog/introducing-deno-sandbox), [Runloop security](https://runloop.ai/security-compliance), [Fly connectors](https://fly.io/sprites/), [Cloudflare runner docs, Sep 30](https://developers.cloudflare.com/sandbox/coding-agents/), [Modal Sidecars, Oct 1](https://modal.com/blog/introducing-sandbox-sidecars-trust-boundary).

## 2. Comparison tables

### Isolation, startup, languages, and density

Startup figures below are **[V] unless marked [L]**. “Any Linux” describes a provider's environment, subject to its architecture, image, privilege, network, and quota restrictions. No shared workload/density benchmark exists in the inspected evidence.

| Product | Isolation technology | Published startup / response claim and what it measures | Languages / compatibility | Memory and density evidence |
|---|---|---|---|---|
| **Sofort / jitk** | libkrun + HVF/KVM; tiny `no_std` guest kernel; user-mode static runtime | **[L] 5.9 ms raw cold return; 9.2 ms executor cold return; 0.29 ms raw parked one-tool** | Proven QuickJS JS and static Lua; restricted AArch64 static ELF subset, not general Linux | **[L] historical 10.7 MiB footprint/VM**; current post-loader-patch baseline unmeasured; no production host-density result |
| [Cloudflare Workers](https://developers.cloudflare.com/workers/reference/how-workers-works/) | V8 isolates with platform defense in depth; no dedicated hardware VM per Worker | Isolate startup avoids conventional container boot; application/network latency separate | JS/TS, Wasm, Python runtime support; Node compatibility subset | Shared process/platform resources; 128-MB Worker memory limit is a limit, not measured resident size |
| [Cloudflare Dynamic Workers](https://blog.cloudflare.com/dynamic-workflows/) | Dynamically constructed workerd/V8 isolates; explicit bindings/egress | **Single-digit ms**, same-machine generated Worker creation | JS, Python, Wasm; TS compiled first | No comparable per-isolate private-memory or per-host figure verified |
| [Cloudflare Containers / Sandboxes](https://developers.cloudflare.com/sandbox/) | Linux Container in its own microVM/kernel/network | Earlier local survey quoted 2–3 s; no current cross-workload cold SLA verified | Linux images, shell, Node, Python, native tools | Published types start at 256 MiB; provisioning is not marginal VM overhead |
| [Vercel Sandbox](https://vercel.com/sandbox) | Firecracker microVM, dedicated guest kernel | “Milliseconds”; no comparable fixed cold-start percentile published on inspected page | Full Linux; managed Node/Python images and custom images, Docker/FUSE | 2 GB provisioned per vCPU; 10,000 Pro concurrency quota is fleet/account, not host density |
| [Vercel `run`](https://run-sdk.dev/docs/foundations/sandbox) / [AI SDK code mode](https://ai-sdk.dev/docs/ai-sdk-core/code-mode) | Fresh QuickJS context in a host worker-thread environment; `run` explicitly is not a process/VM boundary | No verified numeric launch or per-host benchmark | JS and type-stripped TS; explicit host functions, no general Node | Per-run budgets; no trustworthy resident-size comparison found |
| [Firecracker OSS](https://firecracker-microvm.github.io/) | KVM VMM, jailed host process, Linux/other supported guest | **<125 ms boot**, up to 150 creations/s/host; traditional published primitive figures | Guest OS determines languages | **<5 MiB VMM overhead**, not complete Linux/runtime memory; project claims thousands/server |
| [Lambda Event Functions](https://aws.amazon.com/lambda/pricing/) | Managed function execution environments; reuse means no fresh VM guarantee per invocation | Runtime/image-dependent cold start; SnapStart/provisioning change the path | Managed runtimes or custom Linux runtime/container image | 128 MB–10 GB configured memory; internal packing NR |
| [Lambda MicroVMs](https://aws.amazon.com/about-aws/whats-new/2026/06/aws-lambda-microvms/) | Managed Firecracker, prepared memory/disk image, ARM64 at launch | “Near-instant”; launch blog describes user availability/resume within seconds, no universal ms percentile | Linux Dockerfile-based environment | Default 1 vCPU/2 GB baseline; automatic burst; no per-host density disclosed |
| [AgentCore Runtime](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-sessions.html) / [Code Interpreter](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/code-interpreter-resource-session-management.html) | Dedicated microVM per Runtime session; managed microVM-based interpreter sessions | “Low latency”; no comparable end-to-end cold percentile verified | Runtime: framework/container choice; interpreter: Python, JS, TS, shell | Consumption accounting with 128-MB memory billing floor; not evidence of actual VM footprint |
| [Fargate](https://aws.amazon.com/fargate/faqs/) | VM isolation boundary per ECS task / EKS pod; full container environment | Image pull + scheduling + initialization; numeric general cold claim NR | Linux OCI; Windows on supported ECS configurations | Configured resource shapes; no public equivalent per-host packing data |
| [Bolt / WebContainers](https://webcontainers.io/guides/introduction) | Wasm-based runtime inside browser security/origin boundaries; not hardware virtualization | Millisecond environment boot claim; package install and client hardware still matter | Node ecosystem; WASI extends tools/languages; not arbitrary Linux ELF | Client RAM/CPU; hosted server density is inapplicable |
| [Boat](https://boat.dev/) | Full Ubuntu VM; exact hypervisor NR | “VM in a second” | Broad Ubuntu tooling, Docker, desktop, Chrome | 2 vCPU/4 GB minimum listed; account limits 100–2,000 active VMs are not host density |
| [E2B](https://e2b.dev/) | Proprietary snapshot/memory layer built on Firecracker | ~150 ms historically published for template startup; snapshot-backed, not booting Linux from scratch | Linux toolchains, Python/JS/Bash, custom templates and desktop | Default 2 vCPU/4 GiB; tens of thousands of sessions across fleet; no marginal per-host memory disclosed |
| [Daytona](https://www.daytona.io/docs/en/sandboxes/) | Docs distinguish default Linux containers and dedicated VM sandboxes; hardware claims elsewhere conflict (see §6) | **<90 ms** advertised for default path; VM pause/resume under a second claimed separately | Linux, dedicated Windows/Linux VMs, GPUs, Mac integration; SDK execution Python/JS/TS | Default 1 vCPU/1 GiB; no apples-to-apples host-density figure |
| [Modal](https://modal.com/docs/guide/sandboxes) | Selectable **gVisor or VM**; GPUs on gVisor path | Fast/prepared-image startup, but no single comparable cold percentile verified | Linux packages and languages; VM path adds Docker/FUSE/nested features | Resource requests/usage; “1M+ parallel” is fleet scale, not per-host density |
| [Fly Machines / Sprites](https://fly.io/sprites/claude-code/) | Firecracker Linux microVMs | Sprites cold wake typically <1 s on inspected older feature page; warm vs cold matters | General Linux, native tools, coding-agent CLIs | Machines 256 MB+; Sprites actual-use RAM metering, no verified per-host packing number |
| [Northflank](https://northflank.com/blog/how-to-spin-up-a-secure-code-sandbox-and-microvm-in-seconds-with-northflank-firecracker-gvisor-kata-clh) | Kata with VM backends or gVisor; **gVisor itself is not a microVM** | Sub-second; vendor cites external fleet test with p99 readiness 733 ms | OCI images, broad Linux and GPU workloads | 100,000 fleet sandboxes in cited test; intelligent packing, actual per-host density NR |
| [Runloop](https://runloop.ai/security-compliance) | Vendor-described custom bare-metal microVM hypervisor plus container boundary | Seconds via blueprints in product description; numeric comparable cold percentile NR | Full development environment via images/blueprints | Configurable CPU/RAM; per-host density NR |
| [Morph Cloud](https://cloud.morph.so/docs/developers) | Full MorphVMs / proprietary Infinibranch; VMM implementation NR | **<250 ms snapshot/branch/restore**, vendor claim | Full Linux VMs, Docker and persistent CLI agents | Cheap snapshot branches; resident private bytes and active density NR |
| [Hyperlight / Hyperlight-JS](https://hyperlight.org/) | KVM/MSHV/WHP hardware-isolated microguest without conventional OS | **1–2 ms VM creation**, project claim; not a remote service's request latency | Custom-ABI native guests; QuickJS-based JS; Wasm components; Python guest work | **[L] 1.8 MiB comparator footprint** in Sofort harness, not universal upstream claim |
| [Deno Sandbox](https://deno.com/deploy/sandbox) | **Firecracker Linux microVM** plus egress/secret proxy | **<200 ms** current product claim | Any supported Linux binary; Deno preinstalled | Default 2 vCPU/1.2 GiB; maximum/session details vary across older docs; host density NR |
| [Google Cloud Run sandboxes](https://cloud.google.com/blog/topics/developers-practitioners/google-cloud-run-sandboxes-are-in-public-preview/) / [GKE Agent Sandbox](https://agent-sandbox.sigs.k8s.io/) | Nested gVisor boundary inside existing Cloud Run instance; GKE gVisor, upstream Kata option | Launch example **500-ms average** including execution/start/stop; GKE warm pools change latency | Container-supplied Linux tools/languages | Cloud Run children share parent allocation; GKE density workload/node-dependent |
| [Unikraft / KraftCloud](https://unikraft.com/) | VM platform with purpose-built guests; current product includes a trimmed Linux guest path | **<10 ms** launch/resume/branch marketing claims | Current Dockerfile/Linux path is broader than historical unikernel-only framing | **100K+ instances/server** marketing; sleeping/scale-to-zero counts must be separated from active density |

Sofort references: [quiet benchmark](../../jitk/bench/RESULTS-quiet-2026-10-24.md), [executor watchdog benchmark](../../jitk/bench/RESULTS-native-watchdog-2026-10-24.md), [R5 results](../../PLAN-R5.md), [known blockers](../next/SYNTHESIS.md). The raw parked number uses a prepared but **single-use** guest; it is neither a cold boot nor the complete MCP-facing request latency. The documented complete parked executor path remained about **2.5–3 ms**, and the separately measured stdio MCP front end adds about **0.4–0.5 ms** over in-process execution. Do not add independently measured medians and present the sum as an observed benchmark. Cloudflare's 128-MB figure is the [per-isolate memory limit](https://developers.cloudflare.com/workers/platform/limits/), not a resident-footprint measurement.

### State, MCP, and demonstrated users

“Can host” below means the environment can run your MCP server; it is weaker evidence than an official sandbox-management MCP service. Customer/integration examples are vendor-attributed, not an exhaustive or independently audited customer list.

| Product | Persistence / snapshots | MCP relationship | Who uses it / evidence quality |
|---|---|---|---|
| Sofort | Fresh single-use VM; immutable resources; snapshot/CoW restore still proposed | Local stdio MCP front end; implements Cloudflare `Executor` and TanStack `IsolateDriver` | Repository demos/tests only; no verified production adoption [L] |
| Cloudflare Workers/Dynamic | Durable Objects/storage outside ephemeral invocation; Dynamic DO facets add app storage, not live execution snapshots | Official remote MCP hosting, client tooling, code-mode executor | Cloudflare's own MCP services and published application code; do not infer a Dynamic-Workers customer count |
| Cloudflare Sandboxes | Native **filesystem** snapshots; R2 directory backups; memory/process continuation not promised by those snapshots | Can host MCP; Agents SDK connects MCP tools and code execution | Official coding-agent integrations; integrations alone do not prove paid production customers |
| Vercel Sandbox | Persistent sandboxes, automatic stop snapshots, forks; separately mountable/forkable Drives | Can host MCP; Vercel/AI SDK integration ecosystem | **v0, Blackbox AI, RooCode**, per Jan 30 GA announcement |
| Vercel `run` / code mode | Fresh context; `run` supports interrupted-run replay; no VM snapshot | Explicit functions can wrap MCP tools; SDK supplies MCP client | Public libraries; named production users NR |
| Firecracker OSS | Memory/device/disk snapshot mechanisms; operator owns lifecycle/reset | No MCP product layer | AWS Lambda, E2B, Fly and others listed by project |
| Lambda Event Functions | Reused execution envs, `/tmp`; SnapStart is initialization reuse, not arbitrary user workspace fork | Host a trusted HTTP MCP service; generated-code isolation must be designed separately | Very broad AWS service adoption; no implication every invocation gets a fresh VM |
| Lambda MicroVMs | Prepared images; full state suspension up to eight hours; automatic resume | Can host network MCP; own sandbox API, not inherently an MCP tool surface | Official Claude Managed Agents self-hosted-sandbox integration pattern |
| AgentCore | Session state; Runtime storage options; V2 managed initialization snapshots | Runtime hosts MCP; Gateway exposes/governs tools; interpreter is its own API | AWS framework examples; named interpreter-specific production customer NR here |
| Fargate | Long-running task state; external EFS/S3/etc.; no ordinary task memory-fork API verified | Can host MCP servers | Established ECS/EKS users; not a code-mode-specific product |
| Bolt/WebContainers | Browser filesystem/project export and snapshot facilities; no hardware VM checkpoint | App integrations possible; WebContainers is not an MCP hosting service by itself | Bolt, StackBlitz, Svelte/Angular/Nuxt learning environments |
| Boat | Persistent disks, stop/snapshot, disk-level fork; memory checkpoint not verified | API/CLI/SDK verified; official native MCP management endpoint NR | Active YC company; named paying customers NR |
| E2B | Filesystem+memory snapshots, independent forks; optional filesystem-only capture | Official historical MCP server **archived Apr 16, 2026**; can host servers inside sandbox | Manus, Genspark, Groq, Hugging Face, Lindy; current case studies include Rogo and Arena |
| Daytona | VM memory+filesystem pause/fork; container snapshots/archive; volumes | Official CLI MCP server | LangChain Open SWE association and Cursor/Devin integrations; avoid equating all integrations with customers |
| Modal | Filesystem/directory snapshots, volumes, memory-snapshot features with runtime/access limitations | Can host MCP; core Sandbox API is SDK-controlled | Ramp Inspect; VM customers Linear, Legora, Snorkel per Oct 1 update |
| Fly Machines/Sprites | Machines volumes/suspend; Sprites durable filesystem and **disk-only** checkpoints | Native Sprites MCP since Mar 4; unified Fly MCP beta Oct 23 | Official agent plugins and integrations; named enterprise Sprites customer NR here |
| Northflank | Persistent volumes/object stores/databases; no equivalent universal VM memory-fork API verified | Can host MCP; primary sandbox-management MCP verification NR | Sentry platform testimonial, Cedana Kata workloads; not all testimonials are sandbox customers |
| Runloop | Blueprints, snapshots, suspend/resume; storage remains billable | CLI MCP server plus **MCP Hub** tool permissions and credential brokering | Accrual case-study listing; internal Reflex product |
| Morph Cloud | Full computational-state snapshots, branches, sleeping persistent devboxes | API/SSH/SDK verified; first-party VM-management MCP NR | Coding/proving/CI examples, named customers NR; do not confuse with morphcloud.com or MorphLLM |
| Hyperlight | Prepared guest snapshots/reinitialization under embedding host control | Host functions can bridge MCP; no managed MCP cloud offering | Microsoft project; Azure Front Door Edge Actions direction announced, production breadth not established here |
| Deno Sandbox | Volumes and read-only preparation snapshots; live memory fork NR | Can run MCP; official sandbox-management MCP endpoint NR | Public product and SDK; named production Sandbox customers NR |
| Google | Cloud Run persistent mounts/workspace snapshots; GKE stable identity, storage, warm pools and evolving snapshots/hibernation | Cloud Run can host MCP; execution launcher is separate from protocol | Official Google product/examples; named child-sandbox customer NR |
| Unikraft | Templates, branches, checkpoints, volumes, scale-to-zero | SDK/CLI and hosting possible; native MCP management endpoint NR | Netlify production use is vendor-attested; workload details must be checked |

Sources for the second table and vendor-specific details follow in the corresponding sections. An NR entry deliberately avoids turning a search failure into a claim of nonexistence.

## 3. Cloudflare: the closest product-model competitor

### Workers versus Dynamic Worker Loader

**Workers** hosts deployed application code in isolates. **Dynamic Workers** gives that application the lower-level ability to supply code, modules, bindings, resource limits, and outbound policy at runtime. It is the relevant primitive for agent-written snippets. It can use `load()` for a fresh instance or stable-ID `get()` for reuse. The current umbrella documentation explicitly includes **JavaScript, Python, and WebAssembly**, so “Cloudflare only supports JS” is an unsafe competitive claim. [Sandboxes overview, Sep 30](https://developers.cloudflare.com/sandbox/), [Dynamic Workers overview, Oct 12](https://developers.cloudflare.com/dynamic-workers/), [environment choice, Oct 22](https://developers.cloudflare.com/sandbox/concepts/).

Cloudflare's May 1 Dynamic Workflows announcement describes same-machine Dynamic Worker creation in single-digit milliseconds. This validates the local-executor model: generated code need not make a trip to a remote general-purpose sandbox service. It also means comparing a local 0.29-ms tool benchmark with a remote full-computer API is the wrong comparison. [Dynamic Workflows, May 1](https://blog.cloudflare.com/dynamic-workflows/).

Isolation is V8/workerd plus Cloudflare's platform hardening, **not one dedicated hardware VM per Worker**. That difference is a valid design distinction, not proof that a small new VMM/kernel stack is safer. The public workerd README also says standalone workerd needs additional containment for malicious code; that warning should not be misrepresented as a claim that Cloudflare's managed service is merely an unhardened process. [workerd README](https://github.com/cloudflare/workerd), accessed Oct 25.

### Code Mode, typed tools, and capabilities

`@cloudflare/codemode` packages tools as a program-writing surface. `DynamicWorkerExecutor` runs the code with calls routed to host providers over Workers RPC and denies external networking by default. The pluggable `Executor` interface is the integration point Sofort already implements. The current API also includes connectors/provider namespaces; compatibility should be pinned to a version rather than assumed forever. [Code Mode example, May 5](https://developers.cloudflare.com/dynamic-workers/examples/codemode/), [API reference](https://developers.cloudflare.com/agents/tools/codemode/api-reference/), accessed Oct 25.

**[I] This is both validation and displacement risk.** Cloudflare has already articulated the workload and owns distribution to Workers developers. A Sofort backend is useful chiefly when the application cannot or will not run on Cloudflare, or requires a hardware boundary around each generated program. A Cloudflare-only application has little reason to pay an extra network round trip to an external Sofort service.

### Containers and Sandbox SDK

Cloudflare distinguishes generated code calling known methods from code expecting Linux packages, processes, native add-ons, compilers, or a preview server. Containers supply the latter, each in a microVM. The September documentation now routes new work toward the current Sandboxes APIs and retains Sandbox SDK 0.x migration material. Saying “Cloudflare only offers the old Sandbox SDK” misses the newer Durable Object Container API. [Current overview](https://developers.cloudflare.com/sandbox/), [Agents sandbox tool, Oct 22](https://developers.cloudflare.com/agents/tools/sandbox/).

Native `snapshotContainer()` captures the complete filesystem **without RAM or running processes**; it is tied to an image version and requires `durable_object` scheduling. This is distinct from directory backups to R2 and from E2B's live memory fork. [Native snapshot guide, Sep 30](https://developers.cloudflare.com/containers/guides/snapshots/).

Container billing is 10-ms-granular: active CPU at $0.000020/vCPU-s, provisioned memory at $0.0000025/GiB-s, provisioned disk at $0.00000007/GB-s, plus applicable Worker/DO and egress charges; Workers Paid starts at $5/month. [Container pricing, Oct 5](https://developers.cloudflare.com/containers/platform/pricing/). The billing design already recognizes that tool-heavy work waits a lot.

### Agents SDK, MCP hosting, Cap'n Web, and Cloudflare Computer

The **Agents SDK is the durable control plane**: Durable Object identity, SQLite, connections, schedules and recovery. It can attach Linux execution or Dynamic Worker code mode. It is not itself a new sandbox isolation technology. [Agents overview, Oct 22](https://developers.cloudflare.com/agents/), [Agents API, Aug 4](https://developers.cloudflare.com/agents/runtime/agents-api/).

Cloudflare hosts remote MCP over Streamable HTTP and also supplies MCP client integration. Current docs recommend `createMcpHandler` for new stateless servers; older `McpAgent` routes remain a migration concern. MCP hosting is already a commodity integration capability. [Remote MCP guide, Oct 22](https://developers.cloudflare.com/agents/model-context-protocol/guides/remote-mcp-server/), [own MCP catalog, Oct 12](https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/).

**Cap'n Web is capability-oriented RPC, not compute isolation**. JSON-based, TypeScript-friendly references and promise pipelining reduce round trips and let hosts grant object-level authority. It can complement either isolates or VMs. [Announcement, Sep 22, 2025](https://blog.cloudflare.com/capnweb-javascript-rpc-library/).

The local October 24 source review found that **Cloudflare OS is an application over Workers/DOs, not an operating-system kernel**. `cloudflare/computer` combines a durable virtual filesystem with Linux-container, JS-isolate, and just-bash execution paths. Those projects already explore the “computer agents talk to” experience; Sofort adds an execution backend rather than originating the entire interaction model. [Local source review](../cloudflare-deep.md), [Cloudflare OS](https://github.com/cloudflare/cloudflare-os), [Computer](https://github.com/cloudflare/computer).

### Critical pricing nuance

Dynamic Worker overages are **$0.002 per unique Worker/code identity per day**, plus standard request/CPU usage. `load()` without a stable identity counts anew per invocation; reuse amortizes creation. Included quotas and plan minimums apply. This is a real opening for high-entropy one-off snippets, but not evidence that V8 execution itself is intrinsically expensive. See §8 for calculations. [Pricing, Jun 11](https://developers.cloudflare.com/dynamic-workers/pricing/).

## 4. Vercel: both ends of the market are now covered

**Vercel Sandbox** became GA January 30. It runs arbitrary untrusted code in a Firecracker Linux microVM; v0, Blackbox AI and RooCode were named production users. The current product page supports custom images, package installs, Docker/FUSE and longer sessions. [GA announcement, Jan 30](https://vercel.com/changelog/vercel-sandboxes-ga), [current Sandbox product](https://vercel.com/sandbox).

State is no longer merely ephemeral: persistent sandbox lifecycle, automatic/manual snapshots, forks and separate Drives support reuse across sessions. These are full environment features that Sofort deliberately lacks today. [Persistence concepts](https://vercel.com/docs/sandbox/concepts/persistent-sandboxes), [Drives GA](https://vercel.com/changelog/vercel-drives-is-now-generally-available), accessed Oct 25.

**Fluid compute** is an execution/billing model with multiple trusted application requests sharing an instance and active-CPU accounting. It is not a claim that arbitrary mutually hostile snippets should share a Node process. The Functions docs describe reuse, concurrency and bytecode caching. A Function can orchestrate an isolated Sandbox; application-error isolation is not a hostile-code boundary. [Fluid compute, updated Jan 29](https://vercel.com/docs/fluid-compute), [service behavior, Jun 30](https://vercel.com/kb/guide/vercel-services-fluid-compute).

**AI SDK is the framework and distribution surface**, not a VM. Its current v7 docs now include experimental `@ai-sdk/code-mode`: JS/type-stripped TS runs in a fresh QuickJS context with asynchronous tools and execution limits. It requires Node, supports `Promise.all`, and keeps system/network access behind provided tools. Tool approval integration currently has explicit limitations. Separately, **Vercel Labs `run`** uses QuickJS in Node worker threads, fresh context per invocation, explicit host functions, limits, and interrupted-run replay. Its docs explicitly disclaim a process or VM boundary. [AI SDK code mode](https://ai-sdk.dev/docs/ai-sdk-core/code-mode), [MCP tools](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools), [`run` implementation](https://github.com/vercel-labs/run), [`run` sandbox model](https://run-sdk.dev/docs/foundations/sandbox), accessed Oct 25.

**[I] This is a more direct squeeze than Sandbox alone.** For teams satisfied with a hardened QuickJS context, the capability pattern costs no new vendor relationship. Sofort must justify the extra hardware boundary and prove its end-to-end overhead. Simply adding a QuickJS host bridge is no longer an unusual product idea.

**v0** uses Vercel Sandbox for full application previews, replacing earlier browser-based previews. It needs native/server-side behavior and repository/package compatibility. Sofort cannot replace that environment. It could execute small transforms or tool orchestration within the broader product. [v0 FAQ, effective Mar 31](https://v0.app/docs/faqs), [new v0, Feb 3](https://vercel.com/blog/introducing-the-new-v0).

Pricing at default `iad1`: **$0.128/active CPU-hour**, **$0.0212/provisioned GB-hour**, **$0.60/million creations**. Crucially, provisioned memory has a **one-minute minimum increment**. Default 2 vCPU means 4 GB, so fresh tiny calls face a memory floor; persistent reuse amortizes it. [Current pricing and quotas](https://vercel.com/docs/sandbox/pricing), accessed Oct 25.

## 5. AWS: include the new managed microVM primitive

### Firecracker, Lambda Functions, and Lambda MicroVMs are distinct

**Firecracker is an open-source VMM**, not a hosted sandbox service or agent API. The historic <125-ms boot and <5-MiB overhead claims describe a minimal VM/VMM setup, not total memory or latency for a modern agent image. An operator still builds scheduling, images, storage, networking, metering and abuse controls. [Project](https://firecracker-microvm.github.io/), accessed Oct 25.

**Lambda Event Functions** handles deployed function invocations and may reuse an execution environment. Loading arbitrary generated code into an otherwise trusted function does not create a new per-snippet boundary. SnapStart captures initialized applications; it does not automatically turn each arbitrary code submission into an independent user workspace. Example first-tier x86 pricing is $0.20/million requests plus roughly $0.0000166667/GB-s, with region/architecture/tier variation. [Lambda pricing](https://aws.amazon.com/lambda/pricing/), accessed Oct 25.

**Lambda MicroVMs**, launched **June 22, 2026**, exposes the Firecracker lifecycle directly as a managed product. Create an image from a Dockerfile, initialize it once, launch isolated environments from its snapshot, connect through a dedicated HTTPS endpoint, suspend/resume memory and disk for up to eight hours. Launch was ARM64 in five regions; the launch article lists up to 16 vCPU/32 GB. It is explicitly for user/AI-generated code. [Launch notice](https://aws.amazon.com/about-aws/whats-new/2026/06/aws-lambda-microvms/), [launch walkthrough, Jun 22](https://aws.amazon.com/blogs/aws/run-isolated-sandboxes-with-full-lifecycle-control-aws-lambda-introduces-microvms/).

The July technical explanation describes both ready images and lifecycle hooks for regenerated IDs/entropy and refreshed credentials/connections. Its “within seconds” user examples should not be converted into a guaranteed sub-millisecond allocation number. This is also evidence that snapshot uniqueness/reset is an industry-standard obligation, not a Sofort invention. It documents Claude Managed Agents integration. [Compute Blog, Jul 10](https://aws.amazon.com/blogs/compute/announcing-lambda-microvms-serverless-compute-environments-with-vm-level-isolation-and-near-instant-startup/).

MicroVM example rates in US East/Graviton are approximately $0.0997/vCPU-h and $0.0132/GB-h. Baseline resources bill while running; bursts bill on consumption, suspended compute does not. Snapshot reads/writes/storage are additional, including initialization-image reads and a one-week minimum image retention. For a 2-GB image the documented $0.00155/GB read rate implies **$0.0031 per launch just in image reads** under that example's accounting. A tiny prepared image changes this substantially. [Lambda pricing, MicroVM section](https://aws.amazon.com/lambda/pricing/).

### Bedrock AgentCore Runtime and Code Interpreter

**Runtime hosts the agent/tool service** with per-session microVM isolation, multi-invocation state and MCP/HTTP/A2A support. Session affinity is a lifecycle/auth concern owned partly by the application. Current docs distinguish microVM sessions up to eight hours from longer-lived Instances, and describe **Runtime V2 restoring prepared snapshots**. Do not conflate initialization snapshots with user-directed fork/rewind. [Sessions](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-sessions.html), [microVM platform versions](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-how-it-works.html), accessed Oct 25.

**Code Interpreter is a managed tool environment**, with Python, JavaScript and TypeScript, Node/Deno runtime choices, shell/AWS CLI and file operations. Context can persist between executions in a session. The execution role and network configuration determine authority; it is not a zero-authority JSON callback runtime by construction. [Session/resource management](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/code-interpreter-resource-session-management.html), [runtime selection](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/code-interpreter-runtime-selection.html).

Runtime consumption mode and Code Interpreter list **$0.0895/vCPU-h + $0.00945/GB-h**. Interpreter accounting uses active CPU and running peak memory, per-second with a one-second minimum and 128-MB memory floor; boot/system overhead counts. No CPU during I/O does **not** imply all retained memory is free. Runtime Instances has a different EC2-plus-management model. [AgentCore pricing](https://aws.amazon.com/bedrock/agentcore/pricing/).

**Gateway** adds tool discovery/auth/policy and MCP transformation; this is an adjacent paid layer. Sofort could be an execution component beneath an AWS-hosted tool service, but replacing AgentCore's identity, networking or operational product would be a different undertaking. [AgentCore tool types](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness-tools.html).

### Fargate

Fargate provides a task/pod VM boundary for container workloads and their provisioned resources. It is a reasonable place for long-running agents, tool servers, browsers and compilers. It is poorly shaped for a new allocation per tiny snippet: Linux billing is per second with a **one-minute minimum**, beginning at image download; Windows has a five-minute minimum. US East example x86 rates are approximately $0.04048/vCPU-h + $0.004446/GB-h. Persistent external storage is separate; no standard task memory-branch API was verified. [Pricing](https://aws.amazon.com/fargate/pricing/), [FAQ](https://aws.amazon.com/fargate/faqs/), accessed Oct 25.

**[I] AWS's likely response to Sofort is “show us workload evidence,” not “we need a microVM company.”** It already owns the primitive, managed lifecycle, distribution and procurement channel. A narrowly demonstrated kernel/runtime optimization or compatibility-testing technique is more plausible than wholesale replacement.

## 6. Browser compute and specialist platforms

### Bolt.new / StackBlitz WebContainers

Bolt's development environment is powered by **WebContainers**, a Wasm-based runtime within the user's browser. It provides Node tooling, files/process-like APIs and interactive previews without a remote VM for every development session. Browser security mechanisms and separate project origins are the relevant boundary. It is not “Firecracker running in Chrome.” Current StackBlitz docs also describe WASI extensions including Python/jq; it is broader than browser JavaScript alone but not a general Linux ABI. [Bolt introduction](https://support.bolt.new/building/intro-bolt), [WebContainers introduction](https://webcontainers.io/guides/introduction), [environment compatibility](https://developer.stackblitz.com/guides/user-guide/available-environments), [browser configuration](https://developer.stackblitz.com/platform/webcontainers/browser-config), accessed Oct 25.

Hosted development compute cost is shifted to the user's CPU/RAM, not eliminated from the world. Browser availability and support govern long-running/background use. Commercial WebContainer API licensing is separate from public consumer access; no universal per-exec fee was verified. Bolt's current Pro plan starts at **$25/month with token allowances**, rather than a CPU-per-snippet quote. Production hosting/databases in Bolt Cloud are separate from in-browser development. [API licensing FAQ](https://developer.stackblitz.com/guides/user-guide/general-faqs), [Bolt pricing](https://bolt.new/pricing).

Users include StackBlitz/Bolt themselves and Svelte, Angular and Nuxt educational tooling. The API exposes filesystem export and mountable file snapshots, not process-memory VM checkpoints, and calls `boot()` an expensive operation; its headline boot claim should not be treated as a complete project-readiness benchmark. [API reference](https://webcontainers.io/api). **[I] Sofort makes more sense as an optional server execution backend for unsupported/native tasks than as a WebContainers replacement.** Replacing in-browser execution would add a network dependency and hosted compute bill.

### Boat.dev: real, separate, and relevant

Boat is listed as an active **YC Fall 2026** company, based in Paris, supplying persistent Ubuntu VMs with SSH/SCP, Docker, Chrome, desktop, APIs and agent CLIs. It advertises roughly one-second creation and disk-level snapshot forks. Exact hypervisor and live-RAM snapshot semantics were not verified. [YC company page](https://www.ycombinator.com/companies/boat), [product](https://boat.dev/), accessed Oct 25.

Its own rate card lists **2 vCPU/4 GB at $0.018/h**, 4 vCPU/8 GB at $0.036/h and 8 vCPU/16 GB at $0.072/h, metered by the second with a $20 monthly minimum. These are whole-machine rates, not a per-vCPU quote. Account concurrency and Europe-only placement matter; the page mentions Germany/Finland/France. It supplies CLI/HTTP API/Python/TS SDKs; an official MCP management endpoint and named paying customers were not established here. [Product/rate card](https://boat.dev/), [SDK docs](https://docs.boat.dev/sdks/overview).

**[I] Boat weakens “Linux sandboxes are inevitably expensive.”** Its claims still need availability, CPU quality and isolation verification. Sofort can win at short-call granularity, restricted authority and embedded deployment; it cannot establish a cost advantage by comparing against only the most expensive sandbox plans.

### E2B

E2B is a mature agent-computer product, with Firecracker plus proprietary snapshot/memory machinery, custom templates, shells/files/desktop, and managed/BYOC/Embed deployment choices. Its May 2025 Manus case study provides the often-quoted **~150-ms template start**, not a universal 2026 latency percentile. Current messaging emphasizes prepared snapshots rather than fresh Linux boot. [Architecture/product](https://e2b.dev/), [Manus case study, May 6, 2025](https://e2b.dev/customers/how-manus-uses-e2b-to-provide-agents-with-virtual-computers).

Snapshots capture **filesystem and RAM** and can spawn many children. Snapshot capture briefly pauses the original and drops active connections. Fork is a convenient one-call snapshot-and-start operation, currently up to 20 children per SDK/CLI call. Templates can be faster and more compact than arbitrary live snapshots. These are substantive lifecycle capabilities, not a minor optimization that Sofort can claim today. [Snapshots](https://docs.e2b.dev/sandbox/snapshots), [fork](https://docs.e2b.dev/sandbox/fork).

Rates are **$0.000014/vCPU-s + $0.0000045/GiB-s**; default 2 vCPU/4 GiB is $0.1656/h. Pro adds $150/month; concurrency and session entitlements vary. Current customer evidence includes Manus, Genspark, Groq, Hugging Face, Lindy, Rogo and Arena. The company labels “Fortune 100 signed up” as accounts, not paying production deployment by all those firms. [Pricing](https://e2b.dev/pricing), [customer case studies](https://e2b.dev/customers), accessed Oct 25.

MCP integration needs a current-maintenance caveat: E2B's official historical `mcp-server` repository was **archived April 16, 2026**. That verifies an integration existed, not that this package is the currently supported management path. The Linux sandbox can also host ordinary MCP implementations. [Official repository](https://github.com/e2b-dev/mcp-server), accessed Oct 25.

**[I] Partnership candidate:** let E2B remain the persistent computer and run small non-shell code-mode snippets through an embedded Sofort tier. The condition is demonstrated savings at its own volume; E2B already has deep snapshot expertise and can build optimizations itself.

### Daytona

Primary pages currently conflict. The July 10 “VMs (Pause & Fork)” announcement says sandboxes can run as true microVMs and emphasizes machine isolation. The detailed current `/docs/en/sandboxes/` page still distinguishes **default containers** from **VM sandboxes**, gives the <90-ms label to containers, and reserves live fork/pause/nested KVM for VM classes. A separate newer-looking docs host claims every sandbox is Firecracker. This report does **not** silently combine the fastest container number with the strongest VM guarantee. Obtain the contract for the selected class before comparing isolation. [VM announcement, Jul 10](https://www.daytona.io/dotfiles/vms-pause-and-fork), [class documentation](https://www.daytona.io/docs/en/sandboxes/), [conflicting isolation page](https://daytona-website-website-prod.daytona.workers.dev/docs/en/isolation).

VMs preserve RAM+filesystem through pause/fork; container images/archive/volumes have different semantics. Linux, Windows, GPU and Mac-adjacent products broaden the compatibility target far beyond Sofort. [Persistence](https://www.daytona.io/docs/en/persistence/).

Published base rates are **$0.0504/vCPU-h + $0.0162/GiB-h**, with disk charges after an allowance. Canonical billing docs describe reserved resources while running and disk charges while stopped/paused. Other surfaced docs describe a newer consumption model; do not assume the newer host's rules apply to all plans. [Pricing](https://www.daytona.io/pricing), [canonical billing](https://www.daytona.io/docs/billing).

Daytona has an official CLI MCP server, documented Cursor/Devin integrations and LangChain Open SWE association. The production codebase was closed June 11 while SDKs/docs continue publicly. This creates a possible open/auditable component angle for Sofort, but closed source is not itself evidence of inferior isolation. [MCP](https://www.daytona.io/docs/en/mcp/), [official updates/customer-integration listings](https://www.daytona.io/dotfiles), [source-policy announcement](https://www.daytona.io/dotfiles/updates/daytona-is-going-closed-source).

### Modal Sandboxes

Modal now provides **gVisor and full VM Sandboxes**; a VM is preferable for Docker, FUSE, nested cgroups and workloads expecting a real guest kernel. GPUs currently use gVisor. The October 1 update names **Linear, Legora and Snorkel** as VM customers. [Sandbox runtimes](https://modal.com/docs/guide/sandboxes), [Runtime roundup, Oct 1](https://modal.com/blog/runtime-product-update-sandbox-endpoints).

Sandbox CPU is priced per **physical core**, equivalent to two vCPUs. The surfaced Sandbox rate card lists **$0.00003942/core-s + $0.00000667/GiB-s**, unlike the lower generic Functions card. Billing is `max(request, actual)` by the second; pinning geography/hardware can affect rates. One 2-vCPU-equivalent/4-GiB sandbox is approximately $0.23796/h before extras. [Sandbox product rate card](https://modal.com/products/sandboxes?trk=article-ssr-frontend-pulse_little-text-block), [resource accounting](https://modal.com/docs/guide/sandbox-resources), [general pricing for contrast](https://modal.com/pricing), accessed Oct 25. The current canonical product-page extraction did not expose its pricing block, while the indexed first-party rate card did; recheck before quoting commercially.

State includes filesystem/directory snapshots and volumes; memory snapshots have runtime-specific availability and restrictions. Current docs give memory snapshots a seven-day expiry, close TCP connections on capture, terminate the source, disallow capture during an active exec, and warn that exec-launched background processes do not restore correctly. A blanket “snapshots preserve everything” claim is inappropriate. [Current snapshot guide](https://modal.com/docs/guide/sandbox-snapshots).

Most strategically relevant: **Sidecars**, introduced October 1, isolate trusted proxies/harness logic beside untrusted code on the same host. Ramp uses them for a custom egress proxy. This directly addresses the latency-versus-trust split that Sofort would pitch. [Sidecars](https://modal.com/blog/introducing-sandbox-sidecars-trust-boundary). **[I] Modal is a plausible adopter of a demonstrably denser short-program tier, but has both the motivation and implementation capacity to build it.**

### Fly.io Machines and Sprites

Machines are programmable Firecracker VMs; Sprites adds persistent Linux computers, elastic usage and agent-oriented lifecycle. Sprites checkpoints capture the **whole writable disk, not process/RAM continuation**. Current docs describe CoW live capture, automatic checkpointing, an early-access S3 block backend, and HTTP wake. This resolves the previous report's reliance on a competitor comparison page. [Sprites product](https://fly.io/sprites/), [checkpoint details](https://fly.io/sprites/checkpoint-restore/).

Current top-level pricing lists Machines shared-CPU 256 MB from roughly **$0.003/h** in the displayed region. Sprites meters cumulative CPU at **$0.0385/CPU-h**, actual memory at **$0.021875/GB-h**, plus hot/cold storage. Older subpages still show higher rates and explicit resource minima; prefer the current rate card and verify account terms. [Current Fly pricing](https://fly.io/pricing/), accessed Oct 25.

Sprites has native hosted MCP with OAuth since **March 4**; **October 23** added a unified Fly MCP beta covering Machines, volumes, apps and Sprites. Plugins support coding agents; those integrations are evidence of distribution, not a list of paying customers. [Sprites MCP launch](https://fly.io/changelog/sprites-mcp-support/), [new Fly MCP](https://fly.io/changelog/new-fly-mcp/), [ecosystem](https://fly.io/sprites/ecosystem/).

Fly's public position favors real persistent computers over stateless sandboxes. **[I] It will likely ignore a replacement-computer pitch and consider a small execution primitive only if it improves Sprites' cost or trust model.** A persistent Sprite can still use disposable sub-execution internally. [Fly's argument, Mar 10](https://fly.io/blog/unfortunately-mcp/).

### Northflank

Northflank offers selectable **Kata/microVM or gVisor** isolation, managed or BYOC, with surrounding databases, storage, GPUs and application services. “Every workload in a microVM with Kata or gVisor” is loose vendor language: gVisor is a user-space kernel boundary and should not be relabeled hardware virtualization. It accepts OCI workloads and supports both ephemeral and persistent state. [Sandbox product](https://www.northflank.ai/product/sandboxes), [architecture/options](https://northflank.com/blog/how-to-spin-up-a-secure-code-sandbox-and-microvm-in-seconds-with-northflank-firecracker-gvisor-kata-clh).

Rates are **$0.01667/vCPU-h + $0.00833/GB-h**, prorated to the second, plus storage/egress and deployment terms. Its own benchmark summaries cite sub-second readiness and large fleet scale; those do not disclose per-host marginal memory at tiny snippet workloads. Sentry is a platform testimonial; Cedana describes Kata/runtime workloads. A universal memory fork API or native sandbox-management MCP endpoint was not verified. [Pricing](https://northflank.com/pricing), [product/testimonials](https://www.northflank.ai/product/sandboxes).

**[I] Northflank is a possible distribution/integration partner for a portable runtime class**, especially BYOC. Its immediate incentive is to support established runtimes and OCI compatibility; an experimental guest kernel needs a measurable customer use case.

### Runloop

Runloop's primary security page describes a **custom bare-metal hypervisor** with microVM plus container boundaries. Do not substitute an unverified Firecracker implementation claim. Devboxes are full coding environments, with blueprints, snapshots and suspend/resume. Pricing lists **$0.108/CPU-h + $0.0252/GB-h** and retained storage charges; Basic is usage-only, Pro adds $250/month. Its CPU unit/performance should not be assumed identical to competitors' vCPUs. [Security](https://runloop.ai/security-compliance), [pricing](https://runloop.ai/pricing).

It already sells the authority layer: **Credential Gateway** keeps raw keys off Devboxes; **MCP Hub** filters tools and binds tokens to an agent/Devbox; the CLI exposes a management MCP server. These are more complete operational controls than a sandbox boundary alone. [MCP Hub](https://runloop.ai/blog/use-mcp-fearlessly-with-mcp-hub), [CLI release, Jan 2026](https://runloop.ai/blog/rli-release-jan-2026).

The official blog lists an Accrual case study; Reflex is Runloop's own coding-agent workspace and not an independent customer. Exact per-host density and comparable cold-start distributions were not found. [Case-study listing, Aug 21](https://runloop.ai/blog?865b4e83_page=2&ac0f3ebe_page=5), [Reflex](https://reflex.runloop.ai/). **[I] A fast executor plugin could fit, but the product moat would need to exceed Runloop's existing microVM/credential investment.**

### Morph Cloud / Infinibranch

Morph's primary docs advertise **<250-ms snapshot, branch and restore** of whole computational environments. Devboxes retain processes and memory, expose SSH/tmux/preview APIs, support Docker stacks, and can scale to zero. Its public implementation details are insufficient to assert Firecracker, gVisor, or a particular density. “Liquid Metal” should remain branding unless backed by current architecture documentation. [Docs](https://cloud.morph.so/docs/developers), [Devboxes](https://cloud.morph.so/web/product/devboxes), accessed Oct 25.

Current pricing uses **Morph Compute Units**: one MCU covers 1 vCPU-h with 4 GiB RAM and 16 GiB disk, with sizing based on the maximum resource dimension. Standard MCU value is $0.05; Team/Scale commit tiers offer discounts. Snapshot storage is another MCU conversion. This is not simply $0.05 per CPU-hour regardless of RAM/disk shape, and billing granularity/minimum was not established. [Pricing](https://cloud.morph.so/web/subscribe).

Named production customers and a first-party VM-management MCP endpoint were not verified; demos include Lean proving, parallel execution and coding. **Morph Cloud at `cloud.morph.so` is not the unrelated `morphcloud.com` MCP workspace or MorphLLM editing/search service.** [Product](https://cloud.morph.so/web/). **[I] Its natural interest is branching long-lived compute; single-use tool glue is an adjunct, with strong build-itself incentives because fast snapshots are its core.**

## 7. The closest technical alternatives and Google

### Microsoft Hyperlight / Hyperlight-JS / Hyperlight-Wasm

Hyperlight was announced **November 7, 2024** as an embedded Rust library for small hypervisor-protected functions. It avoids a conventional guest OS and permits only explicitly registered host calls. The project claims 1–2-ms VM construction. Current public overview emphasizes KVM/MSHV/WHP and x86, with macOS/ARM work described as forthcoming; local comparator ports/builds must not be confused with the full upstream support matrix. [Microsoft introduction](https://opensource.microsoft.com/blog/2024/11/07/introducing-hyperlight-virtual-machine-based-security-for-functions-at-scale/), [current project](https://hyperlight.org/).

**Hyperlight-JS already uses QuickJS**. Local source research clarifies quickjs-ng rather than Bellard QuickJS. **Hyperlight-Wasm** embeds a no-OS Wasmtime guest for components. This covers several languages without a Linux syscall ABI. There is no hosted per-exec price, persistence product, customer billing plan, or native MCP service; embedding applications supply those. [Hyperlight-JS](https://github.com/hyperlight-dev/hyperlight-js), [Wasm announcement, Mar 26, 2025](https://opensource.microsoft.com/blog/2025/03/26/hyperlight-wasm-fast-secure-and-os-free/), [local corrections](../../FINAL.md).

The Microsoft Wasm announcement identified Azure Front Door Edge Actions as a forthcoming use case. It is evidence of platform intent, not proof of production adoption in every Azure edge product. Microsoft's reported microVM timings and Sofort's quiet local comparison use different paths and engines. Locally, Hyperlight won cold return (4.8 versus 5.9 ms), CPU (3.5 versus 4.8 CPU-ms), and footprint (1.8 versus 10.7 MiB); Sofort won the raw asynchronous tool benchmark. [Local benchmark](../../jitk/bench/RESULTS-quiet-2026-10-24.md).

**[I] This is the first technical comparison to win, not a footnote.** Sofort's distinguishing bet is a tiny Linux-shaped ABI for selected unmodified static binaries plus its asynchronous bridge. If the paying workload is exclusively JS, stock-binary compatibility contributes little. Microsoft is likelier to build/adopt individual techniques than buy a parallel guest kernel without adoption.

### Deno Sandbox

Deno Sandbox launched in beta **February 3, 2026**. It supplies Linux microVMs, package managers, SSH/HTTP access, JS/Python SDKs, volumes and preparation snapshots. The **current product page says Firecracker and <200-ms start**, not just V8 and permission flags. Secret placeholders are replaced at an outbound proxy only for approved destinations. Broad Linux compatibility is a service feature; Deno's own permission system can add another layer for Deno code. [Launch](https://deno.com/blog/introducing-deno-sandbox), [current product](https://deno.com/deploy/sandbox).

Current listed rates are **$0.10/CPU-h + $0.025/GiB-h**, versus the February article's $0.05/$0.016. Current Deploy pricing includes Sandboxes only on paid plans, with per-plan concurrency and storage entitlements; older docs show different prerelease limits. Do not copy those older allowances into a 2026 cost model. [Current product rates](https://deno.com/deploy/sandbox), [Deploy plans](https://deno.com/deploy/pricing).

Snapshots/volumes prepare or preserve disk; live memory-fork semantics were not verified. Named Sandbox customers and native management MCP were not found in the inspected primary sources. **[I] A portable strict-capability executor could complement Deno, but its existing secret/egress model removes much of the “credentials never enter the box” novelty.**

### Google: Cloud Run sandboxes, gVisor, and GKE Agent Sandbox

**Cloud Run sandboxes entered public preview July 9, 2026.** They run **inside an existing second-generation Cloud Run instance**, sharing its CPU and memory, rather than allocating a new Cloud Run service for every snippet. The launch example starts, executes and stops 1,000 Python sandboxes at about **500-ms average**. Later Google summaries identify gVisor and advertise sub-500-ms startup; these remain vendor demonstrations with different scopes. [Launch](https://cloud.google.com/blog/topics/developers-practitioners/google-cloud-run-sandboxes-are-in-public-preview/), [configuration](https://docs.cloud.google.com/run/docs/configuring/services/sandboxes), [Google infrastructure summary, Sep 2026](https://cloud.google.com/blog/products/containers-kubernetes/2026-gartner-magic-quadrant-for-container-management).

The `sandbox do` CLI defaults to no egress and protects the parent environment/credentials/metadata. Tools come from the container; package installation, explicit mounts and persistent-directory/workspace-snapshot mechanisms expand the environment. This is already a same-host untrusted-code helper architecture, albeit much broader than jitk. [Code execution guide, updated Oct 22](https://docs.cloud.google.com/run/docs/code-execution).

**gVisor is a user-space application kernel**, not a VM. Its syscall coverage buys Linux compatibility with an I/O/syscall translation cost. Cloud Run's outer instance boundary can separately be VMM-enforced. The inner boundary for these child sandboxes must be distinguished from the outer instance. [Cloud Run security](https://docs.cloud.google.com/run/docs/securing/security), [gVisor architecture](https://gvisor.dev/docs/architecture_guide/intro/).

**GKE Agent Sandbox** brings templates, warm pools, stable identities and persistent storage to Kubernetes. Google deployment instructions require a gVisor runtime and hardened pod configuration; the upstream API is runtime-agnostic and also documents Kata. The public upstream site now describes hibernation and automatic wake, so the earlier local roadmap snapshot is not sufficient evidence of today's shipped/available semantics. Google-specific snapshot and Filestore features have their own access/launch stages. [GKE setup](https://docs.cloud.google.com/kubernetes-engine/docs/how-to/how-install-agent-sandbox), [upstream current docs](https://agent-sandbox.sigs.k8s.io/docs/), [Filestore integration, Oct 2026](https://docs.cloud.google.com/filestore/docs/agent-sandbox).

No universal per-child-exec tariff was established: shared Cloud Run allocation or GKE node/pod economics apply, plus storage and operational overhead. MCP can be hosted above either substrate. **[I] Google is a competitor to broad execution hosting and a potential integration channel for a new runtime class; gVisor's compatibility/security engineering makes “tiny kernel automatically wins” a weak argument.**

### Unikraft / KraftCloud: strongest challenge to the empty-gap thesis

Unikraft's **October 5 R14 release** adds a sandbox plugin across CLI/dashboard/JS SDK, command execution, shell/file transfer, volumes and scale-to-zero. It also mentions Linux guest-kernel updates, ARM nested virtualization, Dockerfile builds and dynamic resource growth. Thus the current commercial platform cannot be summarized solely as “recompile your app into a classic unikernel.” Open-source Unikraft and the evolving commercial Cloud stack need separate treatment. [R14 release](https://unikraft.com/blog/harpalyke-14-release).

The company advertises **<10-ms launch/resume/checkpoint**, template-based machines, branches, and 100K+ instances/server. A May-era engineering post reports over a million **scaled-to-zero** VMs stored on a host; this is not a million active Linux runtimes. Likewise a snapshot launch's initial latency may exclude later faults/work. These claims are directly relevant competition but not a common benchmark against Sofort. [Current product](https://unikraft.com/), [scaled-to-zero experiment](https://unikraft.com/blog/1m-vms-single-box).

Unikraft distinguishes platform-created **branches** from a guest-requested **fork** in an October 15 engineering post. Avoid treating all vendors' fork labels as identical POSIX or memory-checkpoint semantics. [Branch versus fork](https://unikraft.com/blog/branch-is-not-fork).

Current public pricing lists **Hobby free, Team $39/month and Pro $199/month**, with running/standby/resource limits; Enterprise offers dedicated/on-prem/BYOC. This inspected card does not provide a clean comparable marginal per-exec price. Native MCP management was not verified. Netlify production use is attested by the company, including its current hiring material; precise workload scope remains unverified here. [Pricing](https://unikraft.com/pricing), [vendor customer evidence](https://careers.unikraft.com/jobs/8532372-account-executive-europe).

**[I] Sofort cannot claim nobody offers app-specific fast hardware-isolated computers.** Its possible difference is a far narrower guest contract with a small reviewable implementation and local code-mode API. That needs measured evidence and design-partner demand, not category rhetoric.

## 8. Pricing and per-execution economics

### A normalized meter comparison, not a performance benchmark

For rows marked **2/4**, calculate one second with **two vCPU-equivalents fully busy and four vendor GB/GiB of billable memory**, after included credits. CPU capabilities and GB conventions differ; the arithmetic intentionally does not pretend equivalent throughput. “Per million” is one million of these one-second meter units, **not one million model turns**. Creation, minimums and shape exceptions are called out. New environment boot/teardown time often adds billable duration.

| Product | Meter / example rate | Calculated dollars per million one-second units | Fresh-allocation and minimum caveat |
|---|---|---:|---|
| Sofort | Self-hosted; no retail rate | **Unknown** | See lower-bound CPU illustration below; operations and density unproven |
| Standard Cloudflare Worker | $0.30/M requests + $0.02/M CPU-ms | **$0.40/M calls at 5 CPU-ms** | Different workload: JS request, not 2/4 machine; excludes plan/other services |
| Dynamic Worker, fresh unique code | Same execution meters + $0.002 creation/day identity | **About $2,000.40/M at 5 CPU-ms** | Stable code/ID reuse amortizes creation; included quotas excluded |
| Cloudflare Container standard-3 | 2 vCPU, **8 GiB**, 16 GB disk | **$61.12** | Shape exception; active CPU + allocated RAM/disk; Worker/DO extras |
| Vercel Sandbox 2/4 | $0.128/CPU-h + $0.0212/GB-h + $0.60/M creates | **$94.67 ongoing compute; about $1,485.04 for fresh 1-s environments including creates** | **60-s memory floor**; the ongoing rate applies when that floor is amortized |
| Vercel `run` / AI SDK code mode | Library inside own service | **No separate execution tariff verified** | Pay host CPU/RAM; software boundary rather than VM |
| Firecracker OSS | Own hardware/operator | **Unknown** | VMM is free software, not free compute |
| Lambda Event Function | Example x86 1 GB × 1 s + request | **About $16.87** | **1-GB function example**, not 2/4 or fresh-VM guarantee; init/other charges matter |
| Lambda MicroVM 2/4 | ~$0.0997/CPU-h + $0.0132/GB-h | **About $70.06 compute** | **Snapshot reads/writes extra**; a 2-GB launch image adds $3,100/M at documented example read rate |
| AgentCore consumption 2/4 | $0.0895/CPU-h + $0.00945/GB-h | **$60.22** | One-second minimum, running peak memory, boot/system overhead; no 2/4 sizing assumption required by service |
| Fargate x86 2/4 | ~$0.04048/CPU-h + $0.004446/GB-h | **$27.43 ongoing; about $1,645.73 fresh minimum** | **60-s floor**; image download adds duration |
| Bolt/WebContainers | User browser + commercial license / Bolt subscription | **No universal host per-exec rate** | Client compute and commercial API/product pricing are different bills |
| Boat 2/4 | $0.018/h whole VM | **$5.00** | $20/month minimum; boot/stop time, capacity and terms still matter |
| E2B 2/4 | $0.000014/CPU-s + $0.0000045/GiB-s | **$46.00** | Running reservation time; Pro subscription separate |
| Daytona 2/4 | $0.0504/CPU-h + $0.0162/GiB-h | **$46.00** | Storage/transition time; selected class/account billing must be confirmed |
| Modal 2/4 equivalent | 1 physical core × $0.00003942/s + 4 × $0.00000667/s | **$66.10** | Sandbox-specific rate, `max(request, actual)`; placement extras possible |
| Fly Sprites 2/4 used | $0.0385/CPU-h + $0.021875/GB-h | **$45.69** | Actual used resources; storage/idle-state semantics separate |
| Fly Machine 2/4 performance | $0.0917/h displayed region | **$25.47** | Configured shape, region-dependent; disk/egress separate |
| Northflank 2/4 | $0.01667/CPU-h + $0.00833/GB-h | **$18.52** | Reservation/platform economics; storage/egress separate |
| Runloop 2/4 nominal | $0.108/CPU-h + $0.0252/GB-h | **$88.00** | CPU unit not independently normalized; storage/plan separate |
| Morph 2/4, ≤32 GiB disk | 2 MCU at standard $0.05/MCU-h | **$27.78 rate-equivalent** | **Not verified to bill one-second executions**; resource max/rounding and commits affect price |
| Hyperlight | Embedded OSS | **Unknown** | Own compute/operations; no managed per-call tariff |
| Deno 2/4 | $0.10/CPU-h + $0.025/GiB-h | **$83.33** | Current product rates, paid Deploy entitlement; boot/host overhead/minima need verification |
| Google Cloud Run/GKE sandbox | Shares parent allocation or node/pod budget | **No standalone child-exec quote established** | Concurrency amortization and parent lifecycle dominate |
| Unikraft Cloud | Current plan/resource entitlements | **No verified marginal per-call tariff** | Do not convert running/standby limits into a per-exec quote |

Rate sources are the vendor pricing links in §§3–7; arithmetic is **[I]**. These figures are deliberately not a “cheapest sandbox” leaderboard.

### What these numbers do and do not prove

**Freshness can dominate the invoice.** At Vercel's default 4 GB, the memory floor alone is `4 × $0.0212 / 60 = $0.0014133` per new environment. At Cloudflare, a fresh unique Dynamic Worker costs $0.002 before execution. Conversely, a stable Worker ID invoked thousands of times, or a Linux sandbox reused for a conversation, spreads its fixed charges over many runs. **[I] Sofort's economic opening depends on customers actually requiring a new boundary for each program and generating sufficiently unique programs.** It disappears if an incumbent can safely cache/reuse the same code identity or change its rate card.

**Long I/O waits make memory and scheduling matter.** A five-millisecond program can wait seconds for tools. Active-CPU billing is already common. Sofort currently has a thread-pinning wait issue and per-process/per-VM costs; the synthesis calls for WAIT/resume, shared immutable prepared state and late-bound grants. Until that exists, a small kernel does not automatically deliver high concurrent density. [Local synthesis](../next/SYNTHESIS.md).

**A CPU-only lower-bound illustration is not a retail quote.** One million runs at 4.8 CPU-ms/VM use 4,800 CPU-seconds, or 1.333 CPU-hours. At an *assumed* $0.05 per fully utilized CPU-hour, creation CPU would cost about **$0.067 per million**, before snippet CPU, trusted tools, memory residency, refill capacity, hypervisor charges, control plane, utilization loss, monitoring and margin. The $0.05 is a modeling assumption, not a sourced host offer. QuickJS is slower than V8 for substantive computation, so creation savings can be lost in execution. [Measurements/corrections](../../FINAL.md).

**Density remains the missing business proof.** Historical 10.7 MiB × 1,000 is about 10.45 GiB before other host charges, but this arithmetic is not evidence that a production host sustains 1,000 active VMs. VMM processes, page tables, pinned threads, guest dirtiness and reset/refill behavior matter. Likewise Unikraft's sleeping-snapshot counts and Modal's fleet concurrency cannot be used as equivalent density measurements.

**Latency must include placement.** A network RTT to a remote Sofort service can outweigh its raw local execution advantage. Its strongest deployment model is embedded beside the trusted executor, self-hosted/BYOC, or offered by an existing provider on the same host. A laptop microbenchmark is evidence about a primitive, not a production p99 service SLA.

## 9. The gap Sofort could own—and why it may be squeezed

### A concrete initial workload

An enterprise agent has hundreds of tools. The model writes a short program to fetch several sources concurrently, filter/join results, and return a small answer. The code should not get credentials, network sockets, a durable home directory, or arbitrary shell access. The application already knows how to authorize the underlying tools. It wants a **new hardware boundary for the program**, with resource limits and an auditable host transcript.

**[I] That is a real execution job.** Cloudflare's and Vercel's implementations validate the programming model. The unresolved market question is how many buyers demand the extra hardware boundary strongly enough to pay for another runtime rather than accept managed isolates/QuickJS or reuse a Linux sandbox.

### Differentiators ranked by present credibility

| Proposed differentiator | Assessment as of Oct 25 | What would make it defensible |
|---|---|---|
| Tiny guest kernel, about 1.7k implementation LOC / ~26 syscalls | Strong engineering story; **not total TCB size** | Public threat model, complete TCB inventory, hostile guest tests, external review |
| Hardware boundary per generated program | Real distinction versus in-process QuickJS and ordinary isolates | Linux/KVM production evidence; fresh/reset invariants under malicious workloads |
| Zero ambient authority; only JSON tool channel | Clear product contract, but peers have capability/egress brokering | Stable grants/schema, host authorization, bounded async bridge, no accidental escape hatches |
| 0.29-ms parked one-tool path | Good local primitive result | Complete `execute()`/MCP distributions, CPU/refill cost, p99 under load, same-host controls |
| Unmodified static binaries | Useful long-term bet, **currently narrow** | Real workload census; loader/ABI expansion, byte stdout, resources; multiple non-JS successes |
| Agent-grown syscall surface | Distinctive research method; **not online kernel generation** | Semantic differential coverage, mutation tests, reproducible signed manifests, review gates |
| Replay/audit | Transcript-friendly architecture, **not proven universal determinism** | Clock/random/ordering contract, recorded tool results, repeated-output tests, idempotency/effect policy |
| Density and low price | Not established | PSS/private-dirty/shared-memory ledger, WAIT/resume, clean snapshots/reset, bare-metal Linux benchmarks |
| MCP-native | Useful packaging, little moat | Distribution/integration quality; many competitors already ship MCP |

The current loader accepts static AArch64 `ET_EXEC` with a small payload arena; threads/futex/signals and several `mmap` behaviors are structural gaps. “Runs arbitrary Linux binaries” is false today. Lua is proven, but Go, Node, Python, sqlite and ripgrep workloads should not be promised merely because they can be compiled statically. The growth loop has limited handler examples; repeated successful differential runs do not prove broad Linux conformance. [Compatibility blockers and verified constraints](../next/SYNTHESIS.md).

### The squeeze from below

- A fresh QuickJS context with explicit host calls already solves much of the job, with lower integration cost and no mandatory KVM/HVF access.
- Cloudflare can offer local typed capabilities, Python/Wasm, durable state and RPC with a mature platform around it.
- Wasm components provide a standard portable sandbox ABI; Hyperlight-Wasm adds a hardware boundary if required.
- Many customers will rationally accept software isolation. A hardware boundary is a requirement to validate, not an automatic purchase order.

### The squeeze from above

- Full Linux products offer npm/pip, browsers, threads, native modules, real files and persistent state immediately.
- Snapshots, forks, idle suspension and secret proxies reduce their historical cost/latency disadvantages.
- Unikraft and Hyperlight attack the fast-VM premise directly; new AWS/Google primitives add strong incumbent distribution.
- Many agent tasks last seconds/minutes or are model-latency-bound. Saving a few milliseconds alone is rarely the budget owner's problem.

### Where there is still room

**[I] Best initial customer:** a security-conscious agent platform or SaaS vendor running large volumes of short tool programs on its own infrastructure, with an explicit requirement for per-program VM separation. The sales object is an **execution component**, not a new hosted cloud. Cloudflare/TanStack compatibility helps an evaluator swap the backend without rewriting its tools.

**[I] Strong secondary experiment:** a persistent computer delegates tiny untrusted programs to Sofort beside a trusted capability broker. This preserves a broader Linux workspace for builds and tools while narrowing the code-mode boundary. It pairs with E2B/Runloop/Modal/agent-sandbox rather than replacing them.

**[I] Weaker initial targets:** v0/Bolt full-app previews, arbitrary coding environments, GPU/RL environments with substantial dependencies, browser automation and document conversion. Their compatibility and state needs swamp the current kernel's savings.

**What can become a moat:** tested runtime recipes, measured clean-reset/density behavior, a stable capability contract, maintained framework integrations, external security confidence and actual workload adoption. **What is easy to copy:** the headline “QuickJS in a microVM,” a JSON bridge, an MCP wrapper, and a single favorable benchmark.

## 10. What each company would likely think: buy, build, partner, ignore

All entries here are **[I] strategic hypotheses**, not interviews, acquisition interest, or inside information. “Buy” means acquiring/licensing the component or team, not a predicted transaction. **None is a credible near-term acquisition thesis without adoption, security evidence and production economics.**

| Company | Most likely near-term response | Why / plausible opening | Evidence that could change it |
|---|---|---|---|
| Cloudflare | **Build / ignore external service** | Owns workerd, codemode, capabilities and Containers; external RTT is unattractive | A hardware-isolated backend with substantially better verified cost/reset characteristics and easy integration |
| Vercel | **Build / partner experimentally** | Already spans QuickJS libraries and Firecracker; framework distribution is strong | Drop-in hardware code-mode tier meeting latency/CPU targets without burdening users |
| AWS | **Build / ignore** | Firecracker + Lambda MicroVMs + AgentCore cover primitive through platform | A proven kernel/verification technique at meaningful volume; a component contribution is more plausible than a new cloud purchase |
| StackBlitz / Bolt | **Ignore core runtime; possible partner for server-native execution** | Browser compute is a central advantage; full Linux gaps could need a remote backend | Unsupported native workflows with measurable demand and a clean browser-to-server contract |
| Boat | **Ignore / light integration** | Low-cost full VMs are its product; micro-snippet optimization not immediate focus | Fleet customers requesting a more restricted execution primitive inside persistent VMs |
| E2B | **Partner or build a small tier** | Strong agent distribution and snapshot experience; could route simple programs away from full guests | Material creation/idle-memory savings on its real traces and reliable support |
| Daytona | **Build / partner** | Pursuing composable computers across OSes; could add a lightweight class | Portable implementation, customer demand and a clear support/isolation contract |
| Modal | **Build / selective component partnership** | gVisor/VMs/Sidecars already address trust/latency; high volume rewards efficiency | Better same-host code-mode density on real agent traces, independently reviewed boundary |
| Fly | **Ignore replacement pitch; build/partner for sub-execution** | Persistent-computer thesis and owned Firecracker/storage stack | Clear complement to Sprites, not a demand to abandon durable computers |
| Northflank | **Partner / offer runtime class** | Multi-runtime/BYOC platform makes integration natural | Kubernetes/operator packaging, workload compatibility and documented operations/security |
| Runloop | **Partner / build** | Already owns microVM, credentials and MCP control layers | Fast strict executor that plugs into the host-side tool broker and reduces measured costs |
| Morph Cloud | **Build / ignore** | Snapshot branching is its central technology; short tool glue peripheral | Cheap local branch/reset engine with a differentiated audited capability surface |
| Microsoft / Hyperlight | **Build / upstream collaboration** | Closest architecture, own native/Wasm/JS guests | A useful compatibility-test corpus, async bridge improvement, or proven Linux-ABI demand |
| Deno | **Build / partner on portable component** | Owns JS runtime, Firecracker product and network secret broker | Demonstrated need for VM-scoped short programs with smaller private footprint |
| Google | **Build / upstream integration** | gVisor, Cloud Run child sandboxing and GKE ecosystem already exist | A useful pluggable runtime with hard density/security evidence and maintenance commitment |
| Unikraft | **Build / ignore; collaboration possible** | Already markets fast purpose-built machines, templates and snapshots | Novel syscall-growth/conformance technique or a customer segment requiring a much narrower audited guest |

**[I] Commercially, selling first to an independent agent-platform customer is more realistic than waiting for one of these vendors to acquire the technology.** Their willingness to partner depends on whether Sofort removes work rather than creates a new kernel-maintenance obligation.

## 11. Pitch implications for Twitter/X

### A defensible main post

> Agents write little programs to call tools. I built a little computer for each one.
>
> Sofort runs JS in a fresh hardware-isolated microVM, on a ~1.7k-line Rust kernel. No guest network or credentials—only the tools the host grants.
>
> macOS prototype: ~9 ms cold `execute()`. Kernel coverage grows offline against a Linux oracle.

This is a draft, not posted. Check the live kernel/LOC count and benchmark commit before publication. The 9-ms figure is the measured executor path for a tiny return, not a guaranteed arbitrary-program latency. Do not quietly append the raw parked number as if it described the same measurement.

### Useful follow-up material

1. **Show the boundary:** generated program → tiny guest → JSON tool channel → trusted executor. Demonstrate a useful `Promise.all` tool workflow and a blocked network/credential attempt.
2. **Show the research loop:** missing syscall → Linux trace oracle → proposed handler → semantic differential tests → versioned manifest. State that growth is offline and reviewed, not self-modifying production infrastructure.
3. **Show the honest comparison:** raw cold, complete executor, MCP overhead, CPU/VM, private memory, refill and p99. Include Hyperlight's wins.
4. **Show one non-JS workload that already works.** Lua is real. Additional binaries become claims only after end-to-end workloads pass.
5. **Ask for design partners with a specific workload:** short tool programs, large volume, own infrastructure, per-program VM requirement. That is more useful than a generic “agents need computers” waitlist.

### Claims to avoid

- “The first computers for agents,” “the first MCP computer,” or “nobody is doing this.”
- “100× faster than sandboxes” without workload, path, preparation state and transport controls.
- “0.29-ms cold boot” or “0.29-ms MCP execution.”
- “1.7k lines is the whole trusted computing base.” libkrun, hypervisor, host kernel, protocol, executor and dependencies remain relevant.
- “Arbitrary Linux binaries,” “polyglot Linux compatibility,” or “Python/Go supported” without real tests.
- “Formally verified,” “secure because differential-tested,” “deterministic replay,” or “cannot exfiltrate.” A granted tool can still be misused; recorded effects are not automatically reversible.
- “Agent builds a fresh kernel on each request.” The current defensible design uses shared grown components and per-run policy/capabilities, not online synthesis.
- “Cheaper than isolates.” Separate underlying execution cost, current vendor tariff and complete self-hosted operating cost.

## 12. Validation priorities before a business or performance claim

1. **Bare-metal Linux/KVM:** complete execute/MCP p50/p95/p99, CPU/refill at multiple concurrency levels; no extrapolating Mac or nested-KVM numbers.
2. **Current memory ledger:** post-loader-patch private/PSS/dirty/shared bytes, hypervisor/page-table costs and peak, with small and structured-JSON request classes.
3. **Fresh/reset contract:** snapshot/CoW restore, entropy and capability rebinding, zero prior-tenant bytes, bounded tool queues, abort/deadline behavior.
4. **Wait without a pinned thread:** measure thousands of tool-waiting programs, not only sequential empty VM starts.
5. **Same workload, same host:** Vercel `run`, AI SDK code mode, QuickJS-Wasm, Hyperlight-JS and, where operationally possible, a prepared Linux microVM. Include same-engine controls if comparing mechanisms.
6. **Actual binary census:** useful QuickJS/Lua tasks plus realistic sqlite/jq/rg/static-native candidates; publish failures and missing syscall/loader requirements.
7. **Three design-partner interviews:** identify the required trust unit, current runtime, calls/day, idle time, support expectations and maximum acceptable added latency. Ask whether hardware per snippet is actually required.
8. **Trace-based cost model:** distinguish fresh unique programs from reusable code IDs and persistent sessions. Include server utilization, operations and support—not only creation CPU.

Research scope: existing local evidence and public sources; only this report was created by this researcher. The items above are proposed follow-up work.

## Executive synthesis

1. Agent execution infrastructure is a real market, with production adoption and many mature suppliers.
2. Full Linux computers increasingly persist, sleep, checkpoint and fork; basic sandbox hosting is crowded.
3. Cloudflare already sells the exact known-method code-mode pattern, now including Python/Wasm options.
4. Its fresh Dynamic Worker creation tariff creates a specific economic opening, not a permanent architectural moat.
5. Vercel spans Firecracker computers and fresh-context QuickJS code mode; Sofort is squeezed from both sides.
6. AWS Lambda MicroVMs, launched June 2026, must be included in any current landscape.
7. Google now runs gVisor child sandboxes inside existing Cloud Run instances.
8. Boat.dev exists and sells very inexpensive whole Ubuntu VMs; Bolt.new is a separate browser-compute product.
9. Hyperlight is the closest technical rival; Unikraft is the strongest challenge to an “empty market gap” claim.
10. MCP, secret brokering and snapshots are useful integrations but individually weak differentiators.
11. Sofort's credible wedge is an embedded per-program hardware boundary around narrow asynchronous tool glue.
12. The tiny kernel and offline Linux-oracle growth loop make an interesting, honest engineering story.
13. Broad Linux compatibility, production density, retail pricing and universal replay remain unproven.
14. Win a same-host benchmark and a real design partner before pursuing a generic hosted sandbox business.
15. Pitch the small computer and its explicit authority; do not claim the first or fastest computer for agents.
