# Sofort in the agentic coding industry

Research date: **2026-10-25**. Scope: execution infrastructure, code mode, MCP, buyers, and a defensible Twitter/X pitch. All linked web sources were accessed on this date. Dates beside announcements are publication dates; undated documentation is identified as a current documentation snapshot. This report uses primary sources. Vendor scale, performance, and security statements are attributed claims, not independent measurements.

**Assessment:** Sofort has a credible place as a disposable execution plane for short, untrusted programs that orchestrate tools. The strongest adoption route is through existing code-mode interfaces and enterprise agent builders. The mainstream coding-agent workspace is a different workload: it needs git, package managers, compilers, services, browsers, and durable state. Selling Sofort as its replacement would obscure the real opportunity.

The most natural technical partner is the **Cloudflare codemode / TanStack AI ecosystem**. The most relevant lab prospect is **Anthropic's agent infrastructure and SDK ecosystem**, although its hosted programmatic tool calling currently uses Python. **OpenAI has the closest already-shipped workload match**, but that also makes it a particularly difficult displacement sale: it already has a fresh V8 execution runtime. Concrete integration sketches for these three appear below. Factory, Amp, and enterprise platform teams are plausible early design partners; no public evidence establishes buying intent from any named company.

## 1. What Sofort actually supplies

The project context comes from [FINAL.md](../../FINAL.md), [PLAN-R5.md](../../PLAN-R5.md), the [Cloudflare source investigation](../cloudflare-deep.md), and the [claims ledger](../../jitk/docs/CLAIMS.md). The claims ledger freezes an earlier review state; the later dated additions in FINAL.md report subsequent fixes and measurements. I did not rebuild or independently reproduce them for this report.

The working architecture is a trusted TypeScript executor, a strict JSON-lines tool channel, and a fresh single-use libkrun microVM running static QuickJS or Lua over a small Rust kernel. R5 adds a read-only resource filesystem. Guest programs receive explicitly supplied capabilities; remote API credentials and actual tool execution belong outside the guest. Existing integration surfaces are Cloudflare's `Executor` and TanStack's `IsolateDriver`.

Important measurement boundaries:

- **0.29 ms** is the reported raw parked-VM one-tool p50 on macOS. A parked VM is prebooted and consumed once; it is not a reused tenant interpreter.
- The native-watchdog TypeScript executor reports approximately **9.2 ms cold for return-only and 9.6 ms cold for one tool**. Its parked path remains roughly **2.5–3 ms**. These are the relevant application-facing numbers, before a remote MCP/network hop.
- The reported raw cold benchmark is approximately **5.9 ms**, and reported CPU consumption is **4.8 CPU-ms per VM**. These are different metrics from end-to-end `execute()` latency.
- R5 reports **0.4–0.5 ms added by the stdio MCP front end**. This is not the cost of remote MCP over the internet.
- The existing comparison reports roughly **10.7 MiB process footprint**, with measurement exclusions documented in the ledger. It is not total host memory. Hyperlight wins that local footprint comparison; Sofort should not claim a memory-density lead.
- Linux functionality has been exercised under nested KVM. A macOS CPU result does not establish Linux bare-metal fleet cost or throughput.

Kernel growth is **offline**: observe an unsupported syscall, capture Linux behavior, generate a handler, differential-test bounded cases, and ship a versioned artifact. R5 lists a cached, per-request computer builder as future work. The safe claim is that agents can extend and test a purpose-built kernel; it is premature to claim that every incoming prompt already causes a new kernel to be synthesized and securely deployed.

The kernel's small size is an interesting audit and specialization property. It is not the size of the whole trusted computing base: libkrun, host confinement, the host kernel/hypervisor, QuickJS, protocol parsing, policy, and trusted tool implementations remain relevant. Differential testing establishes the tested behavior, not arbitrary Linux compatibility or proof of isolation.

## 2. How agents execute code today

Three workloads are often incorrectly merged:

1. **Development workspace:** clone a repository, install dependencies, run tests, keep a database alive, launch a browser, preserve edits. Needs a substantial OS and environment lifecycle.
2. **Code interpreter:** run Python/Bash against uploaded files, scientific libraries, office formats, and generated artifacts. Usually needs state and installed packages.
3. **Tool-orchestration program:** run loops, conditionals, pagination, filtering, and parallel calls against a granted API surface; return a compact answer. Often needs neither a general shell nor direct networking.

Sofort's demonstrated scope is primarily the third, plus a deliberately limited class of static binaries and resource-reading workloads. It can sit beside the first two without implementing them.

### Anthropic: several execution boundaries, not one sandbox

**Claude Code local.** It runs with a developer's shell and filesystem. Anthropic's sandboxing announcement, **2025-10-20**, describes OS-enforced filesystem and network restrictions using Seatbelt on macOS and bubblewrap on Linux, and reports an 84% reduction in permission prompts internally. This is a policy-constrained local environment, not a fresh hardware VM for every command. [Anthropic sandboxing announcement](https://www.anthropic.com/research/claude-code-sandboxing).

**Claude Code cloud/web.** Current documentation says each Anthropic-hosted session runs in an isolated managed VM. Git credentials and signing keys remain outside the sandbox behind a scoped authenticating proxy; network secrets can similarly be attached after requests leave the session. Self-hosted sessions transfer isolation responsibility to the deployer. These controls are directly relevant to Sofort's trusted-executor architecture, but the session itself still needs a full coding environment. [Claude Code in the cloud, current docs](https://code.claude.com/docs/en/claude-code-on-the-web).

**claude.ai execution.** Anthropic's **2026-05-25** containment article identifies a per-session gVisor container on isolated infrastructure for code execution in claude.ai. It also says its custom proxy, rather than the mature hypervisor/gVisor components, was the failure point in a consequential incident. The lesson for Sofort is to treat capability forwarding and credential policy as security-critical engineering, not assume a small guest kernel settles the entire problem. [How we contain Claude](https://www.anthropic.com/research/how-we-contain-claude).

**Claude API code execution.** Current documentation supports Python and Bash, file operations, preinstalled data/document libraries, and container reuse; current versions can preserve Python interpreter state. The documented environment has no internet access. That API contract is considerably broader than a JS glue-code VM. Sofort cannot transparently replace it today. [Code execution tool, current docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool).

**MCP and programmatic calling.** The **2025-11-04** engineering article explains generating filesystem-discoverable TypeScript interfaces for MCP tools and executing programs that call them. Its worked example reduces loaded tokens from 150,000 to 2,000; that is an example, not an industry average. The **2025-11-24** advanced-tool-use release turns the direction into product features: tool search, programmatic calling, and examples, with Claude for Excel named as a user. [Code execution with MCP](https://www.anthropic.com/research/code-execution-with-mcp), [advanced tool use](https://www.anthropic.com/research/advanced-tool-use).

Current programmatic-tool-calling docs describe async Python wrappers in the code-execution container. They report about 38% fewer billed input tokens on a 75-tool benchmark, but about 8% higher cost on a benchmark dominated by one or two sequential calls; production requests with 10–49 tool definitions reportedly see typical token savings of 20–40%. **This is unusually useful negative evidence:** code mode needs workload selection, and a smaller runtime cannot make a poor batching opportunity good. [Programmatic tool calling, current docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/programmatic-tool-calling).

**Agent SDK and Skills.** Current hosting docs say the SDK launches a long-lived `claude` CLI subprocess with a shell, working directory, and on-disk session state; it is not merely a stateless Messages API wrapper. Managed Agents can host the loop separately from managed or self-hosted tool execution. Skills, introduced **2025-10-16**, package instructions, scripts, and resources for progressive loading. Neither the SDK nor a Skill intrinsically provides an isolation boundary. Sofort fits as an additional bounded execution tool, not as the environment in which the entire CLI subprocess runs. [Agent SDK hosting](https://code.claude.com/docs/en/agent-sdk/hosting), [Agent Skills introduction](https://www.anthropic.com/research/equipping-agents-for-the-real-world-with-agent-skills).

### OpenAI: full computers and a separate code-mode runtime

**Codex CLI/local.** Current permission documentation describes Seatbelt on macOS, bubblewrap plus seccomp on Linux/WSL, and Microsoft eXecution Container on Windows. It explicitly treats legacy Landlock as unsuitable for certain filesystem-restricted policies. An old account saying simply “Codex uses Landlock” is incomplete as of this research date. These mechanisms run real developer commands under OS policy. [Permissions, current docs](https://learn.chatgpt.com/docs/permissions).

**Codex cloud.** Current cloud-environment docs describe reusable published environments whose repositories, dependencies, and tools seed isolated per-task workspaces. Tasks run in VMs; default documented sizes range from 2 vCPUs/8 GiB to 4 vCPUs/16 GiB depending on plan. The page distinguishes the current experience from Codex Cloud Legacy. This is an environment-preparation product, not a per-snippet microVM API. [Cloud environments, current docs](https://learn.chatgpt.com/docs/environments/cloud-environments).

**Responses Code Interpreter and containers.** The API runs Python in a sandboxed environment represented by a container object; the docs call it a fully sandboxed VM. Containers can be created explicitly or automatically reused, support files and memory tiers, and expire after inactivity. It is an interpreter workspace, not Sofort's current runtime contract. Avoid inferring the implementation is ordinary shared-kernel Docker just because the API says “container.” [Code Interpreter, current docs](https://developers.openai.com/api/docs/guides/tools-code-interpreter).

**Programmatic Tool Calling is now explicit.** Current Responses API docs describe model-authored JavaScript running in a fresh isolated V8 runtime, with top-level await but no Node, package installation, direct network, general filesystem, subprocesses, or persistent JS state. Eligible tools are the external interface. OpenAI executes the generated program; the application still executes client-owned calls returned from it. This is extremely close to Sofort's target workload. I found current documentation, but did not establish a dated launch announcement, so do not assign it a speculative launch date. [Programmatic Tool Calling, current docs](https://developers.openai.com/api/docs/guides/tools-programmatic-tool-calling).

**Agents SDK / Agents API.** The SDK now documents a clear separation of trusted harness from sandbox compute, with providers including Cloudflare, Daytona, E2B, Modal, and Vercel. Separately, the managed Agents API exposes a Codex harness, sessions, MCP, subagents, recovery, and optional execution environments. Its self-hosted path expects `codex exec-server` in a capable environment connected over WebSocket. A minimal JS microVM cannot impersonate that full executor. [SDK sandbox agents](https://developers.openai.com/api/docs/guides/agents/sandboxes), [Agents API](https://developers.openai.com/api/docs/guides/agents-api/overview), [self-hosted environments](https://developers.openai.com/api/docs/guides/agents-api/environments/self-hosted).

**Apps SDK and MCP.** The older Apps SDK MCP-server URL now redirects to current Plugins documentation. MCP servers supply optional tools/resources; Skills-only plugins are also possible. UI remains a separate browser boundary: current docs describe optional MCP Apps components in an iframe communicating through a JSON-RPC bridge. Sofort could run server-side generated tool logic; it does not replace the UI iframe or the Apps/MCP integration contract. [MCP server / current Plugins docs](https://developers.openai.com/plugins/concepts/mcp-server), [MCP Apps UI](https://developers.openai.com/plugins/build/chatgpt-ui).

**Commercial implication:** OpenAI validates the product category especially clearly, while weakening a “they have no runtime” sales narrative. A credible proposal must demonstrate why an additional hardware boundary, placement option, or non-JS static binary matters enough to replace or supplement their existing engine.

### Cursor: cloud agents need rich, increasingly reusable environments

Cursor's **2026-02-24** release describes dedicated agent VMs with full development environments and computer use. It reports that more than 30% of Cursor's merged PRs were then created by autonomous cloud agents. Its **2026-06-02** engineering account says environment completeness is the largest factor in output quality and describes browser/VNC resources shared with computer-use subagents. These are vendor descriptions and internal adoption figures. [Agent computers](https://cursor.com/blog/agent-computer-use), [cloud-agent lessons](https://cursor.com/blog/cloud-agent-lessons).

The **2026-08-19** changelog adds subagents on separate VMs. Current docs support parallel cloud agents, MCP, and multi-repository environments; October release notes describe project coordinators launching workers across approved environments. The direction is more environments and orchestration, but not evidence that every child agent should receive a tiny JS-only computer. [August changelog](https://cursor.com/changelog/08-19-26), [Cloud Agents docs](https://cursor.com/docs/cloud-agent), [current release notes](https://cursor.com/docs/release-notes/cloud-agents).

Acquisition context matters for a late-2026 pitch:

- Supermaven joined Cursor on **2024-11-12**, strengthening model/editor expertise. [Announcement](https://cursor.com/blog/supermaven).
- Graphite's **2025-12-19** announcement described a definitive agreement for acquisition and continued independent operation, extending the review/merge workflow. [Announcement](https://cursor.com/blog/graphite).
- Firetiger's team joined on **2026-08-13**, bringing production monitoring and operational agents. [Announcement](https://cursor.com/blog/firetiger).
- Cursor says its acquisition by SpaceX completed on **2026-08-14**. Treating it as an independent startup with an unchanged acquisition strategy would be stale. [Cursor announcement](https://cursor.com/blog/joining-spacex).

**Fit:** isolated API/data orchestration for operational agents, MCP-heavy automations, or restricted helper programs. **Poor fit:** replacing the machine that runs arbitrary builds, browsers, git, and services. There is no primary evidence here that Cursor is seeking a specialized kernel supplier; its acquisitions establish strategic expansion, not intent to buy Sofort.

### Cognition / Windsurf / Devin

Cognition announced its agreement to acquire Windsurf on **2025-07-14**, including the IDE, IP, business, and team. The announcement explicitly planned product integration. [Cognition announcement](https://cognition.com/blog/windsurf).

Current Devin surfaces span local and cloud: the CLI works with the user's repository and shell and supports cloud handoff; Devin's product page describes its own Windows, Mac, and Linux VMs for building and browser testing. MCP and Skills appear in the CLI's extensibility surface. This is another full-computer customer, not evidence that a limited syscall ABI can host Devin. [Devin CLI](https://devin.ai/cli), [Devin product](https://app.devin.ai/).

**Fit:** inexpensive restricted scripts in a tool broker, bulk external-service queries, or narrow evaluation environments. **Poor fit:** general software engineering trajectories, desktop testing, or preserving an interactive machine. Any internal code-mode subsystem here is a proposed integration, not a verified deployment.

### Replit Agent

Replit's **2026 spring** security article describes hardened Linux containers and a rollout toward microVM isolation; the precise publication day was not exposed in the retrieved text. A later **2026-10-22** security post already refers to an existing microVM architecture. Together these establish that “Replit is just using containers” is stale, without proving migration coverage or hypervisor details. [Defense in depth](https://replit.com/blog/defense-in-depth-how-replit-secures-every-layer-of-the-vibe-coding-stack), [October security update](https://replit.com/blog/security-vulnerabilities-across-the-internet).

Its **2026 summer** evaluation write-up describes Playwright-based testing, production sandboxes, fast forks, and parallel evaluation. The source establishes environment branching as a real operational need; it does not show that the workload can discard its application stack. [Evaluating Agent at scale](https://replit.com/blog/evaluating-and-improving-agent-at-scale).

**Fit:** a second execution tier for short API scripts or narrow, stateless evaluation tasks. **Poor fit:** replacing Replit's persistent development environment, app runtime, browser tests, or its existing snapshot/fork infrastructure. A faster tiny VM supplies only one part of a system Replit already operates.

### Lovable

Lovable's **2026-09-15** preview engineering post claims around **one million sandboxes per day** and names the accumulated runtime/toolchain memory held by preview servers as a problem. This is unusually direct scale evidence, but it concerns real application previews: a JS glue runtime cannot host an arbitrary Vite application merely by booting faster. [Faster previews / OJ](https://lovable.dev/en/blog/faster-previews-oj).

Its **2026-09-24** multi-agent architecture article separates the agent fleet from sandboxes and keeps durable project state in git; it reports about 2.6 million user turns on a typical weekday. Its **2026-10-14** AWS preview puts a data plane, including build/preview sandboxes, in a customer's EKS/VPC environment. This makes deployable, customer-controlled execution relevant, but the product still needs full app-building environments. [Agent coordination](https://lovable.dev/blog/how-lovable-agents-work-together), [Deploy on AWS](https://lovable.dev/blog/deploy-on-aws).

**Fit:** workspace-level tool automation, sandboxed generated API transformations, or an execution service in the customer's VPC. **Poor fit:** a claim to eliminate the million preview sandboxes; their work has different compatibility and persistence requirements.

### GitHub Copilot coding/cloud agent

Current GitHub docs say the cloud agent gets an ephemeral development environment powered by Actions, with configurable setup steps, dependencies, runner sizes, and supported self-hosted runners. A VM boot benchmark does not replace that provisioning and CI compatibility contract. [Environment configuration](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/customize-the-agent-environment).

GitHub's **2026-10-07** announcement makes local sandboxing generally available through MXC, translating policy into native OS controls across Windows, macOS, and Linux. Current firewall docs also acknowledge that coverage differs across Bash-started processes, setup steps, and MCP server processes. Avoid describing any one command firewall as universal agent egress mediation. [Local sandboxing GA](https://github.blog/changelog/2026-10-07-local-sandboxing-for-github-copilot-now-generally-available/), [firewall limitations](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-the-firewall).

The distinct Agentic Workflows architecture keeps agent execution, MCP credentials, API proxying, and governed writes in separate components. That is a strong precedent for Sofort's trusted broker, but is not the same product as the coding agent's development VM. [GitHub Agentic Workflows security architecture, 2026](https://github.blog/ai-and-ml/generative-ai/under-the-hood-security-architecture-of-github-agentic-workflows/).

**Fit:** an optional bounded program runner attached to an MCP gateway or workflow job. **Poor fit:** a universal Actions runner or local-shell replacement. Also expect an unusually strong internal alternative: Microsoft already develops sandbox and virtualization infrastructure.

### Google Jules and Antigravity

Google's **2025-10-02** Jules Tools release says Jules runs tasks in temporary remote VMs and returns PRs. The **2025-11-20** Antigravity introduction describes editor, terminal, browser, and a manager for multiple asynchronous agents, with screenshots and recordings as artifacts. [Jules Tools](https://developers.googleblog.com/meet-jules-tools-a-command-line-companion-for-googles-async-coding-agent/), [Antigravity introduction](https://developers.googleblog.com/en/build-with-google-antigravity-our-new-agentic-development-platform/).

For late-2026 accuracy, Google's **2026-05-19** announcement says Gemini CLI is transitioning to Antigravity CLI, with a unified server-side harness and multi-agent workflows. Do not pitch solely against the original Gemini CLI architecture or infer Jules has disappeared from that announcement. [CLI transition](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/).

**Fit:** specialized function/tool evaluation or an optional generated-code service. **Poor fit:** repo tasks and browser-driven verification; no demonstrated gap in Google's ability to build isolation infrastructure.

### Amp

Current Amp docs distinguish CLI execution on the user's machine from hosted “orbs,” which are thread-associated machines. Orbs clone projects, reuse setup snapshots, sleep, and wake with files and services. Current customization documentation explicitly mentions E2B microVM orbs. The hosting substrate should therefore not be guessed from Amp's earlier CLI-only identity. [Amp overview](https://ampcode.com/docs), [orb lifecycle](https://ampcode.com/docs/orbs/customizing).

Its **2026-06-19** custom-agent announcement supports pluggable agents, one-shot tool pipelines, and multiple workers. Current tool docs describe subagents with their own context. A separate context window is not itself a separate security boundary. [Custom agents](https://ampcode.com/news/custom-agents), [tools](https://ampcode.com/docs/tools).

**Fit:** a plugin exposing bounded JS tool orchestration, especially for API-heavy work without a repository. **Poor fit:** replacing orbs, their prepared Linux environment, or snapshot lifecycle. Amp's plugin route could be a relatively small design-partner experiment; actual code-mode adoption was not established by the sources reviewed.

### Factory

Factory's **2026-04-08** desktop release describes multiple concurrent Droids and persistent Droid Computers. Its current compute product retains installed packages, repositories, configuration, and services and offers managed or customer-owned machines, pause/resume, checkpoints, and SSH. [Desktop release](https://factory.ai/news/factory-desktop), [Droid Computers](https://factory.ai/product/droid-computers).

**Fit:** an additional execution tier for untrusted tool scripts in enterprise automation, particularly where the broker must remain inside a customer's network. Factory's managed/private deployment options make that distribution discussion plausible. **Poor fit:** a replacement for the persistent computer that the product explicitly sells. There is no verified internal `IsolateDriver` hook or code-mode implementation here; an integration would require a new tool/plugin adapter. [Factory deployment choices](https://factory.ai/deployment/factory-private).

## 3. Code mode is a product pattern now, with several runtime strategies

The core technique is to let a model express control flow as a program, then execute the program against granted tools. Discovery and execution are separate improvements: searching tool definitions avoids loading a whole catalog; running a program avoids model inference between mechanically dependent calls and keeps large intermediate results out of context. A product may adopt one without the other.

Evidence for adoption, beyond conference discussion:

- **Cloudflare, 2025-09-26:** publishes the TypeScript-API-over-MCP pattern and the motivation for code-driven composition. [Original Code Mode post](https://blog.cloudflare.com/code-mode/).
- **Anthropic, November 2025 onward:** publishes the MCP execution design, then ships programmatic calling; current docs include positive and negative cost results, as discussed above.
- **Cloudflare, 2026-02-20:** ships its entire API behind two MCP tools, `search` and `execute`, using Dynamic Worker isolates. It claims around 1,000 initial tokens instead of 1.17 million for equivalent endpoint schemas. This is a catalog-size claim, not a universal end-to-end task speedup. [Cloudflare API MCP server](https://blog.cloudflare.com/code-mode-mcp/).
- **Cloudflare, 2026-06-17:** describes Flue's use of `@cloudflare/codemode`, fresh workers per snippet, sub-10-ms isolate starts, and capability bindings. [Harness/platform integration](https://blog.cloudflare.com/agents-platform-flue-sdk/).
- **OpenAI, current docs:** offers hosted programmatic JavaScript, described above; this is a first-class API feature rather than merely a Python interpreter users can script manually.
- **TanStack AI, current docs:** supplies code-mode drivers for isolated-vm, QuickJS/WASM, native QuickJS/Bun, Cloudflare, Daytona, and E2B. Tool implementations stay on the server side. This provides a concrete runtime abstraction that Sofort already implements. [Isolate drivers](https://tanstack.com/ai/latest/docs/code-mode/code-mode-isolates).

**How big is it?** There is solid evidence of adoption by two major model platforms, a major infrastructure platform, and an application framework. There is no defensible public estimate here for the fraction of all agent tool calls using code mode. MCP server counts, SDK downloads, and code-agent revenue do not measure code-mode execution volume.

The runtime needs strict cancellation, output and concurrency limits, async host callbacks, explicit per-execution capabilities, errors the model can recover from, and usable typed tool descriptions. Isolation alone is not sufficient. For a JS-only program, an embedded V8 isolate or QuickJS/WASM is a serious competitor. For Python libraries or arbitrary package execution, a full sandbox is the natural choice. Hardware isolation per snippet is Sofort's proposed tradeoff: accept a narrower environment and operational complexity to make the execution boundary independent of just the language engine.

There is also a measurable commercial wrinkle. Cloudflare's current Dynamic Workers pricing charges **$0.002 per unique worker per day**, with code and ID determining uniqueness; `.load(code)` or no ID counts per invocation. Request and CPU charges are separate. One million separately created billable snippets would therefore mean roughly **$2,000 in worker-creation charges**, before other usage and allowances. Reusing a stable code/ID changes that calculation. This is retail pricing, not Cloudflare's internal cost, and not a proof that Sofort can serve the same workload for less. [Pricing, updated 2026-06-11](https://developers.cloudflare.com/dynamic-workers/pricing/).

## 4. MCP state of the art: the protocol no longer implies a desktop subprocess

**Adoption and governance.** Anthropic's **2025-12-09** donation announcement names the Linux Foundation's Agentic AI Foundation and reports 10,000+ active public servers, with adoption by ChatGPT, Cursor, Gemini, Copilot, and VS Code. Those are historical vendor figures, not an audited count today. The MCP maintainers' **2026-07-28** release reports close to half a billion monthly Tier 1 SDK downloads; downloads are not users or executions. [AAIF donation](https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation), [July specification release](https://blog.modelcontextprotocol.io/posts/2026-07-28/).

**Remote transport.** The July release introduces a stateless request/response core, removes the initialization/session machinery for the new revision, adds routing headers and cache hints, and moves long-running Tasks into an extension. Ordinary HTTP load balancing becomes a reasonable deployment model. Older client/server versions still matter. For Sofort, a long-lived HTTP broker can own auth and routing while each execution consumes a fresh local VM; MCP server lifetime need not equal VM lifetime. Do not describe the project's stdio implementation as already proving conformance with all of this remote revision.

**Authentication.** The current specification bases HTTP authorization on OAuth 2.1 and associated metadata/discovery standards. It prefers Client ID Metadata Documents, retains deprecated Dynamic Client Registration for compatibility, and requires issuer-aware validation. Stdio credential handling is separate. The **2026-08-22** roadmap still identifies autonomous agent identity and delegated authority as ongoing work. Sofort should keep OAuth tokens and refresh state in the trusted host and pass only authorized methods/data into the guest. The microVM does not implement OAuth policy or solve identity delegation. [Authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization), [August roadmap](https://blog.modelcontextprotocol.io/posts/mcp-roadmap/).

**Registries.** The official registry launched in preview on **2025-09-08** as an open catalog/API, intended to feed public marketplaces and private enterprise registries. The repository still contains an old preview/API-freeze development-status note in the current fetched README; that is insufficient evidence for a new GA declaration. Discovery metadata is not proof a server is safe or approved for a particular tenant. [Registry introduction](https://blog.modelcontextprotocol.io/posts/2025-09-08-mcp-registry-preview/), [current repository](https://github.com/modelcontextprotocol/registry).

**Implication:** MCP offers distribution and interoperability for an `execute` service. The executor's grant policy, schema validation, credential broker, rate limits, audit trail, and deployment remain a separate product responsibility. A remote MCP hop can also dwarf a sub-millisecond local dispatch measurement.

## 5. Parallel agents, RL, and ephemeral compute

There is direct evidence of more execution environments, rather than just speculation that better models will need them:

- Anthropic's **2026-02-05** compiler experiment used 16 agents across nearly 2,000 Claude Code sessions. It demonstrates parallel agent work, not the suitability of a minimal kernel for compiling Linux. [Parallel compiler experiment](https://www.anthropic.com/research/building-c-compiler).
- Cursor now gives subagents their own VMs; Lovable reports millions of daily turns and preview sandboxes; Amp and Factory productize sleeping, reusable agent computers. These systems combine disposable processes with durable state rather than making everything stateless.
- Modal's **2026-07-16** engineering report claims one million concurrent sandboxes created in under a minute, with end-to-end starts below half a second at the median. It distinguishes scheduling/creation acknowledgement from time until code can run. This is vendor benchmark evidence of demand and engineering maturity, not a comparable local microVM measurement. [Modal scale report](https://modal.com/blog/scaling-to-1-million-concurrent-sandboxes-in-seconds).
- Modal's **2026-10-01** VM sandbox release offers full Linux machines alongside its gVisor default for Docker, FUSE, and kernel-dependent workloads. It explicitly illustrates why RL environments may need realistic multi-container application setups. [VM Sandboxes](https://modal.com/blog/vm-sandboxes-agent-computers).

**Where Sofort can help RL:** tool-use rollouts with small JSON state, synthetic API worlds, short JS/Lua actions, cheap resets, and a trusted external verifier. Per-attempt hardware isolation and explicit capabilities are attractive if the workload fits. **Where it does not:** SWE environments needing git/npm/pip, browsers, services, GPUs, rich filesystem semantics, or stateful machine checkpoints. General SWE RL is not solved by adding a few more syscalls to a QuickJS image.

The scale arithmetic should remain honest. At 4.8 CPU-ms of measured VM CPU, one million runs imply about **1.33 CPU-hours for that measured component**. This excludes tool work, JS workload, broker costs, idle capacity, observability, control-plane overhead, and Linux production differences. Conversely, a million simultaneously resident instances at 10.7 MiB each imply roughly **10.2 TiB of process footprint**, before exclusions; retaining a huge parked pool is not free. These calculations motivate experiments, not a cost-per-million sales claim.

As inference gets cheaper, execution, auth, and environment management can account for a larger share of total cost. That is a plausible directional argument, not evidence that models cease to dominate cost today. Code mode often saves seconds of avoided inference; optimizing 3 ms down to 0.3 ms is material only in the appropriate high-volume or low-latency workload.

## 6. Buyer, partner, and acquirer assessment

The following ranking is judgment based on the cited architecture, not evidence of procurement activity.

**Best near-term distribution partner: TanStack AI and the Cloudflare codemode ecosystem.** Both already have the runtime seam. Sofort can offer hardware-separated, self-hosted execution while preserving the surrounding tool API. Framework maintainers are distribution partners; the paying customers would more plausibly be enterprise platform teams and SaaS vendors with many tenants. A shared-kernel host process, WASM runtime, or managed worker is already adequate for many customers, so the qualifying question is whether they need a distinct VM boundary or customer-controlled placement.

**Best named platform partnership: Cloudflare.** Strong conceptual and API fit; the project already speaks its executor interface. Possible benefit is a specialized static-binary/hardware-boundary tier or reference backend outside Workers. The objection is substantial: Cloudflare owns workerd, Dynamic Workers, Sandboxes, and distributed infrastructure. Its current customer need is not an unfilled generic JS sandbox. It is a plausible collaborator and evaluator, not an obvious first software-license buyer.

**Best model-lab prospect: Anthropic.** It has published extensively on reducing tool costs and constraining agent execution; SDK customers also own their compute decisions. The immediate route is customer-hosted JS code mode through MCP/custom tools. Its existing hosted Python calling and document ecosystem create a clear compatibility boundary. A pitch to replace all Claude code execution would fail this qualification.

**Closest workload match, harder displacement: OpenAI.** Hosted programmatic JS already matches the restricted environment model. Sofort would need a measured security/placement/static-binary advantage, not an explanation of why code mode exists. SDK applications can try Sofort without any internal platform replacement. There is no documented API switch that swaps Sofort into OpenAI-hosted V8 execution.

**Useful design-partner candidates: Factory, Amp, and Cursor's operations/automation teams.** Their broader tool surfaces and enterprise environments make an additional restricted execution tier plausible. Factory/Amp offer accessible plugin or integration discussions; Cursor has enormous environment sophistication and a changed ownership context. In every case the proposed product is a tool runner next to the development machine. No public evidence in this research proves they currently incur a separate VM boot for each small orchestration snippet.

**Lower-priority direct workspace buyers: Cognition, Replit, Lovable, GitHub, Google.** Large sandbox demand is real, but the largest visible execution costs involve rich dev environments, previews, and verification. Their interest in Sofort would require finding a small-program subset first. Broad application compatibility, not kernel boot time alone, determines whether the substitution is valid.

**Plausible acquirer categories:** Cloudflare for capability-compute/runtime expertise; a sandbox supplier such as Modal for a specialized short-program tier; or an agent platform for infrastructure talent. These are strategic hypotheses only. Of the named platforms, Cloudflare is the most coherent technical conversation. An acquisition thesis is weak until Sofort demonstrates demand, reliability, and a reason customers prefer its boundary to mature alternatives. Tiny LOC and agent-generated kernel extensions alone do not establish a moat.

## 7. Concrete integration sketches for the top three

### 1. Cloudflare codemode / TanStack: alternate executor beside the existing tool broker

**Entry point today:** the project's implemented `Executor` and `IsolateDriver` interfaces. This is the shortest path to a demonstrable integration, although the project adapter is not an upstream endorsement.

Flow:

1. A trusted application discovers tools, checks the user's grant, and emits the supported typed API.
2. Its code-mode tool passes generated JS plus only granted bindings to Sofort's adapter.
3. A local broker consumes one prebooted VM, or creates a fresh one, using a versioned kernel/runtime artifact.
4. Guest calls cross the JSON-lines boundary. The host validates arguments and budgets, invokes actual MCP tools or API functions, and returns structured values. Credentials never need to enter the guest.
5. The guest returns a compact result. The VM is reaped, remote resources are cleaned up, and the broker replenishes its pool.

**Pain addressed:** per-snippet isolation without provisioning a full dev environment, code execution near a customer's private APIs, and potentially creation economics for unique generated programs. **Not established:** a latency or cost win against Cloudflare's own production isolates.

**Integration work:** verify adapter behavior against the current framework package version; preserve cancellation, logs, errors, parallel calls, and disposal; clearly document supported JS globals; make a Node/Linux deployment package. An ordinary Worker cannot simply invoke local KVM. This would initially be an external self-hosted service or runtime integration, with networking cost measured explicitly.

**Pilot:** replay realistic pagination, 50-way lookup, and filtering tasks with identical tool results. Compare application-facing p50/p95/p99, CPU, total memory, queueing, and failure recovery against existing Node/QuickJS/Worker drivers. Measure separately with 0-ms local tools and 50–200-ms remote tools to expose where runtime overhead matters.

### 2. Anthropic: JS code-mode custom tool or MCP service for SDK customers

**Entry point today:** a custom tool or MCP server presented to a Claude Agent SDK application. The SDK and model loop stay outside Sofort. Keep the full development environment available when the task requires it.

Flow:

1. A trusted tenant service advertises a bounded `execute` tool plus discovery/type resources for approved operations.
2. Claude writes a JS program that queries issue trackers, observability, source hosting, or internal APIs and reduces the response in the guest.
3. The trusted broker authenticates each actual call and preserves the application's approval policy for mutations.
4. A fresh VM executes the program and returns only selected results. A separate state store holds reusable snippets or durable workflow data.

**Pain addressed:** multi-tool context and inference overhead, restricted execution on customer-owned compute, and cross-tenant separation for generated programs. **Compatibility boundary:** this is a custom JS path. It does not replace Anthropic's Python `allowed_callers` implementation, pandas environment, bash skills, or document-generation tools.

**Integration work:** model instructions/type descriptions, a supported MCP transport, host-side approval/cancellation plumbing, tenant identity, quotas, and deployment hardening. Approval pauses must have explicit lifecycle rules: persist the intended action in the host and start another fresh execution when appropriate. Do not promise transparent resumption or replay of side effects in a consumed VM.

**Pilot:** an enterprise read-only operations agent comparing issue/release/telemetry data over hundreds of records. Compare direct tool calls and JS code mode on the same model. Count billed tokens, accuracy, model turns, and complete task time. Then compare Sofort against another sandbox for the exact same JS path; otherwise model-orchestration savings will be incorrectly credited to the kernel.

### 3. OpenAI: customer-owned execute tool alongside Responses / Agents SDK

**Entry point today:** an ordinary customer function tool or remote MCP endpoint that invokes Sofort. This is distinct from the built-in hosted programmatic runtime.

Flow:

1. A customer-controlled harness registers an execution tool and a capability catalog, keeping policy and API credentials in its trusted service.
2. A Responses/SDK agent emits a JS program as that tool's input.
3. The Sofort broker runs it against the explicitly permitted callbacks in a disposable VM and returns the result as a normal tool result.
4. Full shell tasks continue to use the customer's existing Linux sandbox provider; file artifacts and durable session state stay there or in external storage.

**Pain addressed:** a customer requirement for hardware-isolated generated code, private/local placement, or a controlled static-binary extension to a JS-only tool runner. **Boundary:** no assertion that the customer can route OpenAI's internal `program` items into Sofort. A built-in hosted feature and an application-owned function are different contracts.

**Integration work:** function/MCP adapter, type/contract prompts, billing/trace attribution, cancellation, and output handling. A Sofort host broker may run beside `codex exec-server` in a normal environment, but the tiny guest cannot host that full executor as-is.

**Pilot:** customer-private API fan-out with a documented requirement that arbitrary generated code gets a VM boundary. Compare end-to-end workflow quality and cost with direct calls and hosted programmatic calling where compatible. The first sales proof should be a requirement the hosted runtime cannot satisfy for that customer, rather than a synthetic millisecond win against an unspecified OpenAI baseline.

## 8. Exact pains Sofort solves, and what remains unproven

**Tool-chain latency:** code mode can remove model turns; parallel async callbacks can shorten independent I/O chains. Sofort enables that code-mode execution. Its own speed contribution is the difference between equivalent runtimes, not the whole savings from replacing direct tool calls. It does not eliminate real API latency or inference required to interpret each result.

**Cost per execution:** a small single-use environment can avoid paying for unnecessary OS functionality and may reduce per-creation charges or idle reservations. The project has not yet measured full fleet cost against modern V8/WASM, gVisor, or production microVM services. Short CPU accounting is promising but insufficient for a price claim.

**Untrusted-code isolation:** a fresh guest with an explicit tool channel can reduce ambient authority and reset execution state. It does not prevent an authorized but harmful API request, a vulnerable trusted tool, secret-bearing tool output, or a malicious caller consuming an allowed budget. These are broker and application-policy concerns. A small kernel also carries maturity and assurance risk relative to extensively tested systems.

**RL rollout scale:** promising for narrow tool environments, currently unproven at fleet scale. Scheduler throughput, parked-pool sizing, memory sharing, artifact distribution, verifier cost, and realistic workload compatibility remain necessary. “Millions of Linux coding sandboxes” is not the current product claim.

**Agent-generated software:** offline specialization and differential tests make it plausible to expand a controlled runtime contract as workloads emerge. That is an interesting research/product advantage if the acceptance process remains reviewable. It does not remove the need to version, audit, and roll back the privileged code an agent produces.

## 9. How to pitch this on Twitter/X

The strongest opening names the problem before the kernel:

> Agents increasingly write little programs to use tools. I built a disposable computer for those programs: static QuickJS, a tiny Rust kernel, a fresh microVM, and one capability-scoped tool channel.

Then demonstrate an actual integration:

> It implements Cloudflare's codemode Executor and TanStack's IsolateDriver. Same generated tool program; a different execution boundary. On my Mac: about 9–10 ms cold through the executor; 0.29 ms for the raw parked one-tool path.

Then show the unusual part, with its timing made explicit:

> The kernel grows offline. An unsupported syscall becomes a Linux trace, an agent-written handler, and differential tests. The shipped computer gets only the runtime contract its workload needs.

A good short video would show typed tool discovery, one generated program doing real API fan-out/filtering, the VM lifecycle, and a separate missing-syscall growth/test sequence. Show the artifact hashes and measurement scope alongside the demo. Lead with an agent task someone recognizes; use the kernel footage as the technical reveal.

Avoid these claims:

- “A replacement for Cursor/Devin's Linux VM.” It cannot run their general development workload.
- “0.29-ms cold computers.” It mixes a raw prebooted measurement with cold application execution.
- “Code mode is new.” Major vendors already ship it.
- “Hardware-isolated means prompt-injection-proof.” Tool authority still matters.
- “A 1.7k-line secure computer.” The entire system and trusted computing base are larger.
- “We can run a million RL environments cheaply.” Neither compatible workloads nor fleet economics have been demonstrated.
- “Agents build a new OS for every request.” The existing extension loop is offline; the per-request builder is roadmap work.

**Best framing:** a concrete runtime experiment at the intersection of code mode, capability-mediated I/O, single-use hardware isolation, and tested kernel specialization. That is technically distinctive without inventing a missing market or claiming to replace the computers coding agents actually need.

## Executive summary

1. Sofort fits short generated tool programs most directly.
2. Full coding workspaces still need Linux, dependencies, services, and browsers.
3. Anthropic, OpenAI, Cloudflare, and TanStack provide real code-mode adoption evidence.
4. There is no supported industry-wide code-mode market-share estimate.
5. OpenAI already runs programmatic JS in a fresh restricted V8 runtime.
6. Anthropic's hosted programmatic path currently uses Python; Sofort needs a separate JS tool.
7. Cloudflare/TanStack offer the clearest existing integration interfaces.
8. Enterprise builders are more plausible first customers than frontier labs.
9. Factory, Amp, and operational-agent teams are useful design-partner prospects.
10. MCP's July 2026 stateless revision supports a persistent broker with disposable compute.
11. OAuth, approvals, credentials, quotas, and audit remain host responsibilities.
12. RL fit is narrow tool-use environments, not arbitrary software-engineering simulations.
13. Report roughly 9–10 ms cold executor latency; label 0.29 ms as raw parked latency.
14. Kernel growth is offline and tested; per-request computer synthesis remains roadmap work.
15. Pitch the demonstrated execution boundary and specialization loop, then prove fleet economics.
