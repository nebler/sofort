# Prior art: a persistent filesystem with disposable agent execution

Research cutoff: **2026-10-31**. Desk research only; no builds, benchmarks, containers, Linux guests, or VMs were run. Only this new report was written. Scope: public work from 2023–2026, plus older foundational work where it directly defeats a novelty claim.

Evidence labels: **V** = verified in inspected primary documentation/source (verification of what it says, not independent validation); **P** = author/vendor performance or security claim; **I** = inference/assessment; **U** = unresolved or not established. “Current” means observed at the cutoff. A repository creation date is not a product launch date. Live documentation and `main` links can change.

## Verdict

- **The broad idea is taken.** Plan 9 establishes services as files; recent work explicitly applies that model to agents. “Everything is a file for agents” is positioning, not a defensible invention. [S01][S06][S12]
- **MCP mounted as files is taken literally.** `airshelf/mcpfs` exposes MCP reads through FUSE; Airstore exposes integration data as files and MCP tools as executables. [S03][S05]
- **Persistent state plus disposable hardware execution per command is also taken.** Medeloop describes that exact split using Firecracker and EFS in July 2026. Its published design does not establish versioned, transactional workspace commits. [S16]
- **Copy-on-write workspaces with atomic commit are taken.** BranchFS and BranchContext implement speculative filesystem branches, commit/abort, and command-oriented workflows. [S14][S15]
- **AgentFS is the closest storage substrate.** SQLite-backed files, state, tool-call records, overlays, and a Firecracker/NFS example already exist. A database transaction is not automatically a transaction around an entire shell command. [S10][S11][S13]
- **Some combinations are already explicit.** AgentFS + just-bash ships; ToolFS advertises files, skills, snapshots, permissions, and audit; Lanix reifies bounded operations as filesystem jobs. Their execution guarantees differ substantially. [S09][S07][S08]
- **`just-bash` is a shell/command interpreter in TypeScript; `bash-tool` is an AI SDK adapter.** The former shares files while resetting shell state per `exec`; the latter can use either it or a real sandbox. Neither promises a fresh hardware VM per call. [S17][S18]
- **Per-command confinement is routine; a fresh kernel is a different boundary.** Codex/Claude local sandboxes use host OS mechanisms. A separate `exec` inside one gVisor/VM session does not reset that session. [S19][S20][S21][S23]
- **Persistent agent files, snapshots, forks, and stopping idle compute are crowded product features.** E2B, Daytona, Modal, Vercel, Cloudflare, Morph, Freestyle, Runloop, and Fly cover much of this surface. [S25], [S26], [S27], [S28], [S29], [S30], [S31], [S32], [S33], [S34], [S35], [S36], [S37], [S38], [S39], [S40], [S41], [S42]
- **The potentially open contribution is a precise combined contract:** persistent versioned state, one pristine hardware execution generation per command, atomic workspace publication, and mediated, replayable tool receipts. No inspected public source demonstrated that entire arrangement; this is a search finding, not a priority proof.
- **The strongest claim should be measured, not categorical.** Show lower all-in cost per correct committed command under that contract, with useful CLI compatibility. The supplied microsecond/reset and cents claims do not establish end-to-end filesystem economics. [L02][L06]
- **Most dangerous fast follower: Vercel (I).** It already spans the shell interface, adapter, VM sandbox, persistent storage, distribution, and scriptc. Turso is the closest storage challenger; Fly is a serious systems challenger. [S09][S17][S18][S34][S35][S42][S48]

## Closest prior work table

Cost entries describe the billing/operating model, not a normalized benchmark. Rates exclude model tokens, taxes, egress, plans, and storage unless stated. **No row's advertised start/fork latency is a matched Sofort pristine-command measurement.** “No boundary established” means the inspected material does not justify treating it as a hostile-code sandbox.

| Work; date | What it does / proximity | Isolation and state contract | Cost model / evidence |
|---|---|---|---|
| **Plan 9 / 9P**; foundational, pre-2023 | Services and devices exported as file trees; private namespaces. Direct ancestor of `/mcp/...`. | Namespace/file-server authority; not a fresh hardware VM or generic transaction per command. | Self-host resources; no agent tariff. V [S01] |
| **githubfs / restfs**; older API-FUSE precedents, inspected 2026 | GitHub repositories and web resources mounted as files. API-as-files predates MCP. | FUSE daemon and underlying API permissions; no execution sandbox established. | Self-host + API quotas. V [S02] |
| **airshelf/mcpfs**; repository created **2026-03-04** | MCP tool classification → readable files; writes/searches via CLI. Exact MCP-to-files precedent. | FUSE/host RPC broker; not hardware execution isolation. | MIT; self-host + API costs. V [S03] |
| **agent-fuse / Emmerling**; **2026-01-11** post | Demonstrates application data through FUSE for ordinary agent shell operations. | Filesystem adapter, not a command sandbox. | Prototype/self-host; no matched tariff. V/P with access limitation [S04] |
| **Airstore**; repo created **2026-01-27** | Integration source views as files, MCP tools as pipeable executables. | Mount/gateway; no per-command VM or transactional branch contract verified. | AGPL-3.0 local mode; hosted tariff U. V [S05] |
| **Namespace-Bounded Agents / llm9p / InferNode**; **Jan 2026** onward | Agent capabilities represented by 9P paths; model/service access via read/write. | Scoped namespaces; implementation/model assumptions apply. Not hardware reset. | MIT artifacts/llm9p; hosting/model costs separate. V/P [S06] |
| **IceWhaleTech ToolFS**; repo created **2026-01-18** | Unified files, memory, RAG, skill execution, snapshots and audit. Very close conceptual combination. | Source's `InMemorySandbox` is explicitly a mock; native skills run callbacks. No hardware boundary established. | MIT/self-host + integrations. V/P [S07] |
| **Lanix ToolFS**; repo created **2026-06-10** | Host-approved capabilities become job directories with inputs, controls, results, quotas and identity. | Wasm tasks elsewhere; host `ProcRunner` explicitly has no OS sandbox yet. | MIT/self-host; no usage tariff verified. V [S08] |
| **AgentFS + just-bash**; **2026-01-02** | Persistent database filesystem behind a shell tool, including Workers deployment. Existing state/compute separation. | In-process interpreted shell; depends on embedding runtime and hooks. | Open components + host/Turso/Workers costs. V [S09] |
| **Turso AgentFS**; launch **2025-11-13**, overlay **2025-12-31** | Portable/queryable filesystem, KV, tool-call history, CoW sessions. Closest durable workspace. | FUSE/NFS + OS-confined processes; VM integration optional. No automatic command-wide atomicity verified. | MIT/local resources; hosted storage optional. V [S10], [S11], [S12], [S13] |
| **BranchFS / BranchContext**; paper **2026-02-09**, revised March | CoW branches, atomic commit/abort, nesting, command-oriented speculation. Closest transaction semantics. | FUSE branch views; mount namespaces for confinement; proposed `branch()` kernel facility is distinct. | MIT/self-host. P: sub-350 µs branch creation; not VM start. [S14][S15] |
| **Medeloop**; **2026-07-30** | Each agent bash command gets a disposable Firecracker environment with persistent `/workspace`. Closest execution/state split. | Linux microVM per command; EFS private workspace, scoped temporary credentials. No CoW command commit shown. | Bare-metal EC2 + EFS/control plane; no public per-command tariff. V/P [S16] |
| **Vercel just-bash**; repo created **2025-12-23** | TypeScript bash/Unix utilities, virtual filesystem; optional runtimes. | Interpreter boundary; fresh shell state, shared filesystem. Not a Linux kernel or arbitrary ELF execution. | Apache-2.0 package; embedding compute/storage. V [S17] |
| **Vercel bash-tool**; repo created **2026-01-06** | AI SDK `bash`, `readFile`, `writeFile`; interchangeable runtime adapters. | Inherits just-bash or VM provider boundary; sandbox reconnection deliberately preserves state. | MIT adapter + chosen runtime. V [S18] |
| **Codex local sandbox**; 2025–2026, current docs | Restricts generated commands' filesystem/network access. | macOS Seatbelt; current Linux bubblewrap path; legacy Landlock needs version qualification. Shared host kernel/workspace. | Local resources + product/model charges. V [S19] |
| **Claude Code sandbox / sandbox-runtime**; **2025-10-20** launch | Sandboxed bash with filesystem restrictions and mediated network access. | Seatbelt on macOS; bubblewrap/network namespace on Linux. Persistent allowed workspace. | Open runtime + local resources/model subscription. V [S20] |
| **bubblewrap**; mature, current 2026 | Builds restricted process/mount/network environments; useful per-command wrapper. | Shared host Linux kernel; safety depends on complete policy. No built-in durable commit protocol. | OSS/self-host. V [S21] |
| **gVisor SandboxExec / Ray Sandboxes**; current 2026 | Programmable command execution with filesystem/network control; Ray adds snapshots. | Userspace Linux-ABI Sentry; multiple commands may share one sandbox. | OSS runtime/cluster resources. V/P [S22][S23] |
| **Firecracker / Hyperlight–Unikraft**; established / current 2026 | Hardware sandboxing, restored guest state, Linux programs/host callbacks. | KVM microVMs or Hyperlight guest/LibOS; storage effects require integration. | OSS/runtime infrastructure costs; no universal per-command tariff. V/P [S24] |
| **Anthropic code execution + MCP code mode**; **2025-05**, **2025-11**, 2026 versions | Bash/Python/file tools; tool API files enable lazy discovery and composition. | Hosted container; reusable execution state. TypeScript wrapper file read is not itself an MCP call. | Typically $0.05/container-hour after allowance, five-minute minimum; search/fetch exception. V [S25][S26] |
| **OpenAI Code Interpreter / Hosted Shell**; CI 2023 onward, hosted shell **2026-02-10** | Reusable containers, shell/code execution, file upload/download and artifacts. | Hosted container contract; low-level hypervisor implementation not established by these docs. | Container memory-tier/session billing + tokens; 1 GiB listed $0.03/20-minute session. V, billing caveat below [S27][S28] |
| **Cloudflare Sandbox SDK / Containers**; current docs **2026-09/10** | File APIs, persistent workspace restore, R2 mounts, Linux execution. | Container-backed Linux/microVM service; snapshot is filesystem-only; sessions reuse environment. | Active CPU $0.072/vCPU-h + provisioned RAM $0.009/GiB-h + disk, paid plan. V [S29], [S30], [S31] |
| **E2B**; current **2026-10**, filesystem-only update **Oct 12** | File APIs; durable memory+disk or filesystem-only snapshots → independent sandboxes. | Firecracker/Linux sandbox lifecycle; command `exec` need not create/reset VM. | Per-second running CPU/RAM: $0.0504/vCPU-h + $0.0162/GiB-h; optional $150 Pro. V [S32] |
| **Daytona**; current **2026**, VM/v2 docs separately scoped | File/Git APIs, persistent files, snapshots, memory/disk forks, volumes. | Container and Linux VM classes differ; VM fork not an atomic merge into parent. | Posted resource rates $0.0504/vCPU-h + $0.0162/GiB-h + disk; class/plan terms apply. V [S33] |
| **Vercel Sandbox**; snapshots **2026-01-22**, current Oct docs | Firecracker execution, filesystem snapshots, persistent drives, reconnectable sandboxes. | Hardware VM session; full-filesystem snapshot does not establish RAM snapshot or command transactions. | `iad1`: active CPU $0.128/h + RAM $0.0212/GB-h, creations/storage extra. V [S34][S35] |
| **Modal**; VM GA **2026-10-01** | File handles, volume commits, filesystem/directory/memory snapshots, exit snapshots. | Choose gVisor or KVM VM; `exec` uses sandbox; volumes have separate semantics. | CPU/RAM billed `max(request, actual)`; storage/GPU/plan charges separate. V [S36][S37] |
| **Morph Cloud**; current 2026 docs | Infinibranch full-environment snapshots and independent VM branches. | Full-state VM, not just files; automatic atomic child-to-parent merge U. | Standard $0.05/MCU; resource-based max formula, snapshots billed too. P: <250 ms lifecycle. [S38] |
| **Freestyle**; **2026** live-fork guides | Duplicates running VMs, memory/processes/files; branch agent exploration. | VM CoW fork; preserving live state differs from pristine command execution. | $0.04032/vCPU-h + $0.0129/GiB-h + storage/transfer; allowances. V/P [S39] |
| **Runloop**; snapshots **2024-11-12**, current docs | Devbox disk snapshots, branch into new environments, suspend/resume. | MicroVM service; documented snapshot captures disk, not process memory. | $0.108/CPU-h + $0.0252/GB-h + storage; optional $250 Pro. V [S40] |
| **Cursor worktrees**; current 2026, Apr 24 update | Separate agent checkouts and bringing selected work back. | Git/filesystem separation, not hostile-process containment or transactional arbitrary files. | Local disk/compute + product/model fees. V [S41] |
| **Fly Sprites**; 2026, July engineering update | Durable agent computer, checkpoint/restore, drive forks, credential-hiding connectors. | Firecracker/Linux; storage outlives execution; session/per-command freshness not promised. | Metered CPU/memory/storage; sleep separates storage from active compute. V/P [S42] |
| **AIOS / MemGPT / filesystem agent papers**; **2023–2026** | Agent-serving “kernel,” virtual LLM context, Unix/filesystem interface arguments. | Application/runtime abstractions; no implied privilege or hardware boundary. | OSS/research + model/backend resources. V [S43], [S44], [S45] |

## Detailed notes

### 1. Local baseline: what this proposal adds to the repository

**V:** The seed passage is at approximately **0:19–0:20** in the requested Next Token episode transcript: a shell tool presents a large command vocabulary through one entrypoint. This motivates interface composition and local result filtering; it does not establish workload frequency, pause distributions, or infrastructure costs. [L01]

**V:** jitk already executes each JS body or prepared native program in a single-use hardware execution generation restored from a checkpoint. Trusted host Node code owns policy and credentials; tools cross bounded guest/engine/host records. The VM slot is reused after reset: “fresh VM” here should mean pristine execution state, not necessarily a newly booted guest or newly created VMM process. [L02][L03]

**V:** The inspected README explicitly disclaims broad Linux compatibility and production containment/performance conclusions. The requested GrowOS summaries recommend bounded static CLI/file workflows before Node, and distinguish agent-generated kernel work from a novel acceptance methodology. **I:** a persistent writable, versioned agent workspace and `/mcp` syscall-to-tool bridge are additions under study, not capabilities proved by the existing code-mode executor. File-backed MCP resources are also not the same direction as mounting arbitrary MCP services inside the guest. [L02], [L03], [L04], [L05]

**V:** The October 31 memory report's **34–40 µs** is a small-job HVF reset median; its real-task reset medians are **83–208 µs**, by class, with larger tails and write-fault costs. It reports approximately **2.4–2.5 MiB idle HVF engine-process memory**, with fixed/other costs separate. **U:** the assignment's ~0.5 MiB/VM and “10,000 runs for a few cents” cannot be promoted into a universal current product result from those figures. Different platform, fixture, accounting, and billing boundaries must stay separate. Nothing was remeasured here. [L06]

### 2. Services-as-files: the central interface is established

**V:** Plan 9 unifies disparate services through file objects, 9P operations, and per-process namespaces. It already provides the crucial idea that authority and service discovery can be represented by what is mounted. **I:** changing the backend from a device/network service to MCP does not create a new abstraction. Neither an ordinary pathname nor possession of an unrestricted FUSE mount alone proves capability security: a program must lack alternate access paths. [S01]

**V:** `githubfs` mounts repository listings/content through GitHub's API; `restfs` is an older FUSE web-resource browser. They establish API projection as prior art, but not agent-safe effect handling. Modern storage mounts such as object-store filesystems similarly establish data transport, not a tool invocation contract. [S02]

**V:** `airshelf/mcpfs` connects to stdio/HTTP MCP servers, classifies `list/get`-style tools into files/directories, and routes `cat` reads to tool calls. Mutation and search/query tools use `mcpfs tool`. Its name-based classifier is not a proof that a tool is safe or side-effect-free. **I:** this is the most exact rebuttal to “we invented MCP as a filesystem,” and a useful adapter baseline. **U:** hardware containment, durable command transactions, and cryptographically bound receipts were not established in its inspected README. Repository creation is March 4, 2026; metadata is linked separately. [S03]

**V:** Emmerling's *FUSE is All You Need* demonstrates domain data with ordinary shell operations and anticipates sandbox providers offering virtual filesystem callbacks. **Access caveat:** indexed primary text and the linked author repository were discoverable; a direct article fetch failed with 502 and a later TLS hostname mismatch. Its experimental/forward-looking statements are not a measured advantage. [S04]

**V:** Airstore separates source views, materialized/synced integration data, from MCP tools exposed as executable commands. It explicitly supports piping results and a local self-hosted mode. **I:** `/mcp/github/issues/123.json` and `/tools/github create-issue ...` are both already natural public design patterns. Neither pattern requires a custom kernel; Sofort needs an additional execution/state guarantee to distinguish itself. [S05]

**V:** Do not conflate this with `modelcontextprotocol/server-filesystem`, or the unrelated `jeswin/mcpfs`: those expose filesystem operations **through MCP**, the reverse direction. IBM's `chuk-mcp-vfs` provides MCP-accessed virtual workspaces/checkpoints; its README labels the FUSE `workspace_mount` tool planned. These are adjacent storage surfaces, not evidence that every advertised MCP filesystem is an actual OS mount. [S49]

### 3. The unusually close small projects require source-level qualification

**V:** *Namespace-Bounded Agents* describes 9P path capabilities and scoped namespaces, with artifacts for model checking and attack evaluation. The README itself says the AgentDojo experiment uses a tool-visibility filter replicating namespace semantics and that benign utility under that adapter is incompletely measured. **I:** it preempts “files-as-capabilities protects agents” as an original thesis, but its attack success claims are not a general proof about arbitrary mounted tools or hostile native programs. `llm9p` separately makes prompts/responses accessible by file I/O; InferNode continues the Plan 9/Inferno agent-namespace direction. No per-command hardware reset/CoW transaction combination was established. [S06]

**P:** IceWhaleTech ToolFS advertises one namespace for local files, memory, RAG, native/Wasm skills, atomic CoW snapshots, permissions, and JSON auditing. That is a close conceptual combination, not just a storage SDK. **V:** its `sandbox.go` names `InMemorySandbox` a mock for testing and says a real Wasm runtime would be used in production. `RestrictedSkill` checks request paths before invoking a supplied callback. **I:** those checks cannot establish containment of hostile callback code. The snapshot implementation walks mounted directories and reads file contents; do not repeat “instant atomic” as an independently demonstrated O(1) transaction. Its optional `SandboxBackend` interface is not proof of a shipped microVM backend. [S07a][S07b]

**V:** Lanix's unrelated ToolFS is more explicit about operation semantics: `spec.json`, allocation through `new`, and per-job input/parameters/control/output/error/status/result files. The host fixes executable/argv/environment; callers supply validated data. Job IDs carry idempotency meaning. Its design states that `ProcRunner` uses an empty environment, private temporary working directory, and process-group cleanup, **with no OS sandbox yet**. **I:** this is strong prior art for filesystem-native tool jobs, structured receipts/results, and authority-visible mounts. Its Wasm execution tier does not prove arbitrary native Linux CLI containment. [S08]

**I:** The two ToolFS projects should never be collapsed into one competitor. Their names are similar; their architectures and implementation maturity differ. The opportunity left by a prototype's incomplete security is an implementation opportunity, not permission to ignore its earlier interface design.

### 4. Persistent state and transactions: AgentFS and BranchFS

**V:** AgentFS launched November 13, 2025. Its storage abstraction includes a POSIX-like filesystem, key/value state, and tool-call tracking in SQLite-compatible storage. The SDK example explicitly records tool calls; audit coverage depends on how execution/integrations use it. **I:** queryable history is close to receipts, but is not by itself a tamper-evident authorization/effect ledger. Copying a database can capture state, but safe concurrent snapshots must respect the database's WAL/backup rules; “copy one file” marketing does not define a command transaction. [S10]

**V:** The December 31 overlay design copies workspace writes into AgentFS while preserving the host lower layer, and allows other commands to join an existing session. The shell/agent process can therefore be replaced while the workspace survives. Its published example also allows writes to selected agent configuration/cache directories. **I:** the real isolation contract is the effective mount/allowlist configuration, not “nothing ever touches the host.” Local process confinement and persistent upper-layer state are already coupled. [S11]

**V:** The January 2 AgentFS/just-bash integration puts its filesystem behind an interpreted shell, including deployment to Cloudflare Workers/Durable Objects. This already realizes cheap computation over durable agent files without retaining a full computer. **I:** Sofort's distinction would be native compatibility and a hardware boundary, not discovering that filesystem lifetime can exceed execution lifetime. [S09]

**V:** AgentFS also includes a **Firecracker example with NFSv3** and a BusyBox rootfs. It is direct evidence that database-backed agent files can be mounted into a hardware VM. **U:** that example does not establish per-command pristine restoration, command-wide atomic commit, or mounted MCP semantics. Adding a VM beneath AgentFS is therefore not a sufficiently specific novelty claim. [S13]

**V:** BranchFS's February/March 2026 paper and source provide CoW branches, nesting, atomic parent publication, abort, and sibling invalidation under a first-winner policy. Its preliminary timings are author results, not numbers transferable to another filesystem or machine. The paper separates a usable FUSE implementation from a **proposed** `branch()` syscall coordinating processes and namespaces. **I:** file isolation is not automatically hostile-process isolation, especially if other branches remain reachable. [S14]

**V:** BranchContext's CLI `branching run -- CMD` commits on exit 0 and aborts on nonzero, while other patterns support explicit selection. Its source recommends combining process forking with a separate sandbox for confinement/resources/syscall filtering. **I:** even the command/transaction lifecycle is occupied. Sofort should compare hardware isolation plus durable publication against this arrangement, and should not silently define “success” as exit 0 for every task. [S15]

### 5. The closest execution architecture: Medeloop

**V/P:** Medeloop describes warm-pool Firecracker execution per bash command, an EFS-mounted `/workspace`, and temporary dataset-scoped credentials. **I:** this directly preempts the disposable-compute/persistent-workspace split. EFS writes are persistent effects; CoW command publication is not specified. **U:** no source artifact or per-command tariff was established. Recycling clean slots also needs a precise reset guarantee. The July 30 article body/date were recovered from embedded page data. [S16]

### 6. Shells, code mode, and local command sandboxes

**V:** just-bash is not GNU Bash running in a VM. It interprets shell syntax and implements a command vocabulary in TypeScript, with pluggable filesystems and optional runtime support. Each `exec()` resets shell variables/functions/cwd while files persist. The current README documents differences even for its ripgrep-style command. Its threat model trusts host hooks, Node/V8, and the underlying OS. **I:** this is a compelling cheaper substitute for bounded text/data workflows, but not an arbitrary ELF/test-runner compatibility layer. Apache-2.0 is verified in the package license. [S17]

**V:** bash-tool is a distinct MIT adapter exposing bash/read/write tools for AI SDK. Its README explicitly supports `@vercel/sandbox` and reconnecting through `Sandbox.get`; custom sandbox implementations are allowed. **I:** it could consume Sofort as a backend. The wrapper is not a security architecture and says nothing about reset frequency unless its provider does. [S18]

**V:** Vercel's January 9, 2026 post advocates representing business data as files and giving agents bash. Its reported sales-summary cost reduction is a model/application result, not sandbox infrastructure pricing. **I:** the shell-interface thesis has clear commercial prior art independent of coding tasks. [S12]

**V:** Anthropic's November 4, 2025 MCP article lays out `servers/<service>/<tool>.ts` wrappers for discoverability, code composition, filtering, and persistent files. Reading a wrapper learns its interface; importing/calling it invokes MCP. **I:** distinguish this from mcpfs's read-triggered RPC, but both already remove the need to put every tool schema/result in model context. Cloudflare's February 20, 2026 Code Mode MCP uses typed API code in Dynamic Workers; it is another code-first alternative, not proof of filesystem mounts or native hardware guests. [S26][S47]

**V:** Current official Codex documentation specifies Seatbelt on macOS and bubblewrap on Linux/WSL2. It treats legacy Landlock separately, including limitations for restricted filesystem policies. **I:** a blanket “Codex Linux uses Landlock” is outdated at this cutoff. These mechanisms restrict a command/process tree while writing into an allowed persistent workspace; they do not supply CoW command commit or a fresh guest kernel. A host OS policy boundary can be much cheaper than any VM but exposes a different kernel attack surface. [S19]

**V:** Claude's October 20, 2025 sandbox launch and sandbox-runtime describe OS-enforced filesystem/network restrictions, using Seatbelt and Linux bubblewrap, with host-side network proxies. The runtime can wrap arbitrary processes/MCP servers. **I:** per-command permission enforcement is already established; replacing it with hardware isolation is a threat-model/performance tradeoff, not inventing per-command sandboxing. [S20]

**V:** bubblewrap constructs a process environment using namespaces and configurable mounts/seccomp; upstream explicitly says it is not a complete policy. gVisor SandboxExec exposes programmable sandboxes with commands/timeouts and mount/network controls. Ray's sandbox APIs add a cluster execution/snapshot layer using `runsc`. **I:** distinguish a newly created Sentry per operation from `exec` repeatedly entering an existing one. Neither “per-command timeout” nor unique command logs proves fresh execution state. [S21], [S22], [S23]

**V:** Firecracker restores private memory mappings from snapshots; disk state/lifecycle and external connections require integrator handling. Hyperlight–Unikraft already advertises ordinary Linux runtimes, warmed snapshots, default-deny capabilities and host callbacks. **I:** a tiny VM, restored initialized state, Linux ABI support, and mediated host effects are independently established. Neither project's basic runtime defines the filesystem/MCP transaction semantics proposed here. Self-hosting cost is resources/operations, not a universally fixed cents-per-run tariff. [S24]

### 7. Hosted model execution and file tools

**V:** Anthropic's API code execution supports Bash/file operations and newer versions add persistent REPL state/programmatic tool calling. Its standard schedule includes a five-minute execution minimum, 1,550 free container-hours per organization/month, then $0.05/container-hour; requests using qualifying web search/fetch tools waive additional execution charges. These terms can change. **V:** Anthropic separately documents claude.ai code execution as a per-session gVisor container. **I:** do not transfer that implementation claim to every Anthropic API/product without evidence; neither establishes a pristine hardware VM per tool call. [S25]

**V:** OpenAI Code Interpreter uses containers with 1/4/16/64 GiB tiers and supports files/artifacts; inactive containers expire after 20 minutes and are not durable workspaces. Hosted Shell supports Debian commands and reusing a container across responses. Its February 10, 2026 launch is recorded in the official API changelog. **U:** these public contracts do not specify the underlying VMM or kernel isolation mechanism. [S27]

**V:** The current pricing page lists 1 GiB at $0.03 per 20-minute container session, scaling by memory tier, for both Hosted Shell and Code Interpreter; it also mentions eligible per-minute billing with a five-minute minimum. **U:** that eligibility makes a single universal per-command quote unjustified. **I:** a reusable hosted container can already cost pennies for many commands, so “10,000 commands for a few cents” needs stated runtime/retention assumptions and a full API/storage cost boundary. [S28]

### 8. Sandbox vendors: persistence is not a transactional filesystem

**V:** Cloudflare's October file guide exposes file operations through `Files` and maps each sandbox name to a Durable Object managing a Linux instance. It documents root-filesystem snapshots and R2-backed directory persistence. **V:** Container snapshots are immutable filesystem captures, excluding memory/running processes, tied to an image version; current documentation limits their scheduling-policy support. **I:** this provides storage/compute lifetime separation already, without promising commit after each shell operation. A Durable Object can coordinate a protocol, but that does not make external filesystem or SaaS effects transactional. CPU billing is active usage, while memory/disk are provisioned; idle-compute savings are not unique to Sofort. [S29], [S30], [S31]

**V:** E2B's current snapshot API captures memory and files by default; filesystem-only mode keeps the source running and boots restored children from disk. Snapshots survive source deletion. The October 12 changelog records the filesystem-only lifecycle work. These are independent restored environments; no automatic atomic merge is documented. File reads/writes/command APIs target a sandbox that can handle many calls. **I:** E2B could implement command-scoped disposable instances around a separate store; integration overhead and exact mount/commit semantics would decide competitiveness. Per-second allocated running CPU/RAM and optional subscription costs differ from reset-only CPU cost. [S32]

**V:** Daytona's docs now distinguish container and Linux VM classes: filesystem captures for containers, memory-plus-files capabilities/fork for VMs, and independently persistent volumes. VM fork duplicates state into a new sandbox; disk-only fork boots fresh. **U:** do not apply every v2/VM feature or billing unit to historical/default container deployments. Shared object-backed volumes are not automatically included in VM snapshots or transactions. **I:** a fork is a branch starting point, not a conflict-checked child-to-parent commit. [S33]

**V:** Vercel Sandbox has filesystem snapshots, reconnectable runtime sessions, and persistent drives. The snapshots changelog is January 22, 2026; snapshot/drive lifecycles and charges are distinct. **I:** “filesystem state” does not establish full memory snapshots; file APIs do not mean API-as-files mounts. Its active-CPU model already avoids charging a fully busy CPU during thinking, although provisioned memory and storage remain relevant. It could combine existing adapters/storage with short-lived VM sessions; the unverified part is the exact transaction/reset contract and its cost. [S34][S35]

**V:** Modal offers explicit `runtime="gvisor"` or `runtime="vm"`; the latter reached GA October 1, 2026. It supports separate filesystem/directory/memory snapshot products and persistent volumes. Current docs include beta automatic filesystem exit snapshots, even for several ungraceful termination cases, while disclaiming guarantees under rare host failure. **I:** automatic snapshot-on-exit is particularly close to command-scoped persistence if the sandbox lifetime equals one command, but still does not establish branch validation or atomic SaaS effects. Its `max(request,actual)` billing already targets bursty compute; CPU requests are not total sandbox overhead. [S36][S37]

### 9. Branching vendors and git worktrees

**V/P:** Morph's Infinibranch advertises snapshots/branches/restores of full computational environments in under 250 ms. Pricing uses MCUs; the displayed devbox formula takes the maximum of CPU, rounded RAM/4 GiB, and disk/16 GiB, rather than adding three independent full rates. Snapshot storage consumes MCUs as well. **I:** this is a strong exploration primitive but preserves live state rather than intentionally discarding it at each command. No atomic merge-to-parent protocol was established. [S38]

**V/P:** Freestyle's 2026 agent guides explicitly fork running process trees, memory, file descriptors and filesystem state, with CoW economics. **I:** this is close to branching agent computers, while the proposal is closer to branching workspace state with replaceable computation. Its VM live-state duplication must handle external I/O separately; no generic rollback of remote effects follows from fork. Current resource billing/allowances are documented, but no normalized pristine-command price was verified. [S39]

**V:** Runloop's snapshot documentation says **disk state**, supporting new devboxes from a saved filesystem. Suspend/resume and storage billing are separate; its pricing page explicitly targets agents' intermittent activity. **I:** do not describe its disk snapshots as preserving a live heap merely because Morph/Freestyle do. It is a plausible storage/execution competitor without a demonstrated files-as-MCP interface. [S40]

**V:** Cursor's worktrees create separate checkouts per agent/task and support reviewing/applying results. Git worktree shares repository metadata/object storage while giving each checkout its own files; it is not a general CoW namespace for all application state. **I:** agents can still reach another worktree or host files unless an additional sandbox prevents it. Dependencies, untracked state and services need their own lifecycle. Worktree-based tools occupy workflow isolation/parallel coding, not a new hardware or transaction primitive. [S41]

**V/P:** Fly Sprites markets persistent Linux agent computers with checkpoints and sleep. Its July engineering account describes a new Sprite Block Device enabling drive forks and connectors that keep service credentials outside the agent. **I:** this is a particularly dangerous systems alternative: combine durable storage, cheap wake, cloned environments and credential mediation without growing a new ABI. The documents do not establish fresh execution after every command or transactional external tool effects. Avoid conflating disk checkpointing with a universal guarantee about preserving every process/connection. [S42]

### 10. “LLM OS,” growing compatibility, and compiled scripts

**V:** MemGPT (October 2023) uses OS-inspired virtual memory/context management. AIOS (March 2024; COLM 2025 paper) provides an agent-serving layer with scheduling, context, memory/storage, tools and access management. The January 16, 2026 *Files-Are-All-You-Need* paper explicitly argues for Unix/file-centric agent design. **I:** “OS” in these works does not imply EL0/EL1 separation, a Linux-compatible kernel, or hardware isolation. They occupy the vocabulary and broad motivation, not every implementation detail. [S43], [S44], [S45]

**V:** OSFoundry is an agent harness for building/evolving operating systems; Ginux is a public independent-kernel/Linux-userspace effort. The local GrowOS novelty report compares these and differential low-level synthesis work. **U:** this pass's LEMU publisher fetch returned 403; details remain secondary to the earlier local research and are not used as independently reverified novelty evidence here. OSFoundry's displayed August 8 submission and September-shaped arXiv ID disagree; no day-level priority conclusion relies on that metadata. [S46][L05]

**I:** GrowOS's plausible methodological contribution is the exact acceptance gate: real-Linux differential observations, held-out probes, mutant rejection and regression histories, with honestly costed compatibility growth. Agent-written syscalls and executable-reference checking are insufficient broad claims. Native Linux ABI differences, loading, processes, signals, threads, `mmap`, locks and dynamic dependencies decide whether the promised command set actually works. The inspected repository summaries explicitly warn against extrapolating static corpus coverage to ordinary Node. [L04][L05]

**V:** scriptc is itself a public TypeScript-to-native compiler with explicit static/dynamic tiers; it is not a Sofort-only invention. **I:** compilation/caching can lower initialization/runtime cost for suitable scripts, but changes the compatibility/semantic equivalence question. A claimed saving must include compilation, invalidation, output equivalence, and dependencies. Shipping a compiled subset does not demonstrate that arbitrary unmodified `git`, test runners, npm and shells work. Native executable support and execution-isolation strength are separate axes. [S48]

## Taken / open

### What is already taken

| Proposed claim | Prior work that defeats the broad version | What could still distinguish Sofort |
|---|---|---|
| Services/tools are files; shell is the agent interface | Plan 9, mcpfs, Airstore, Lanix, Vercel's filesystem/bash post | A rigorously specified safe effect protocol implemented across guest and host |
| Capabilities are mounted paths with policies | Plan 9 namespaces, Namespace-Bounded Agents, Lanix | Correct confinement for hostile native binaries; receipt-bound authority under concurrency |
| The workspace persists while execution is disposable | AgentFS integrations; Medeloop per-command Firecracker/EFS | Versioned workspace transactions coupled to pristine hardware execution |
| CoW branches with atomic commit/abort | BranchFS/BranchContext; mature CoW/transactional storage | Crash-consistent publication plus execution/effect lineage, with stated conflict semantics |
| Hardware VM per agent command | Medeloop; straightforward runtime composition | Much lower complete lifecycle cost under equivalent semantics, not reset-only figures |
| Snapshots and forks for agent exploration | Morph, Freestyle, E2B, Daytona, Modal, Fly | Store-only branches that avoid keeping irrelevant process/kernel state |
| Sandboxed command tools and restricted network | Codex, Claude, bubblewrap, gVisor | Different hardware threat boundary at an economically competitive cost |
| Code mode, lazy tool discovery and filtered results | Anthropic MCP code execution, Cloudflare Code Mode | A filesystem-native invocation protocol with replay/audit guarantees |
| Agents grow an OS / scripts become native | OSFoundry/Ginux; scriptc and prior compiler work | Reproducible cost/compatibility gains from the complete development/runtime system |

### The combination that remains plausible, but unproved

**I:** The credible unit of differentiation is an **execution-and-publication protocol**, not a list of ingredients. Its contract should state:

1. A command starts from a specific immutable workspace root and receives only scoped input/capability mounts.
2. It runs in a pristine hardware-isolated generation; all child processes and transient kernel state disappear before reuse.
3. Writes accumulate in a private branch. Publication produces a new root atomically, with a defined parent-version/conflict rule. The policy for nonzero exit, timeout, cancellation, and deliberately useful partial output is explicit.
4. Tool calls are mediated outside the guest, with credentials kept outside; receipts identify operation, authority, arguments/results or hashes, execution ID, and observed workspace version.
5. Recovery can distinguish a failed command, a committed workspace update, and an external effect with an uncertain outcome. Durable receipts are not silently discarded because the VM timed out.
6. Resource accounting includes the host broker, idle/warm pool, storage, page tables/KVM objects, network/tool latency, commit cost, failures and compatibility maintenance.

**V/I:** No inspected primary source demonstrated all six as one system. Conversely, close pairs already exist: **mcpfs + FUSE** for tool reads; **AgentFS + Firecracker** for durable agent files in hardware VMs; **BranchContext + sandboxing** for command transactions; **Medeloop** for per-command hardware and persistent state; **Lanix** for filesystem-native operation lifecycles. An integrator could assemble a credible alternative without a new kernel. The remaining claim must survive comparison against those compositions.

### The transaction trap: files cannot make external effects atomic

**I:** `cat /mcp/github/issues/123.json` can be a mediated observation, but the remote issue can change between reads. `stat`, `readdir`, retries, buffering, caching and partial reads must not accidentally multiply expensive calls or trigger mutations. A read handle should have explicit consistency/cache semantics. Tool names or MCP annotations alone cannot prove that a provider is side-effect-free.

**I:** A workspace commit cannot roll back an already-created GitHub issue, sent email, database write, or deployed service. An atomic filesystem pointer swap plus a local receipt is not an atomic distributed transaction with arbitrary MCP servers. Use explicit effect jobs, idempotency keys where supported, intents/outbox/reconciliation, and visible uncertain outcomes. Lanix's job directories are relevant prior art for separating invocation from ordinary repeated file reads. Claims of exactly-once execution must state provider cooperation and failure assumptions.

**I:** Consequently, “every command atomically commits its changes” can honestly refer to **workspace changes**. It cannot imply all external effects commit or abort with them. Persisting a receipt and publishing a workspace version can itself require a coordinated durable protocol. This semantic work is more important than choosing `/mcp` versus `/tools` as the path prefix.

### Strongest honest claim

**Safe now:** “We are building a persistent, versioned workspace whose commands run in disposable hardware-isolated execution generations, with host-mediated tools and auditable effects. The components have substantial prior art; our research question is whether a small Linux-compatible guest makes that complete contract cheaper and faster for short agent commands.”

**Stronger only after implementation/evidence:** “For the specified CLI corpus, architecture, security policy and failure model, Sofort publishes correct workspace transactions at X cost and Y p99 latency, using Z incremental host memory, compared with tuned Linux/Firecracker plus a versioned store and a process/gVisor alternative.” Report unsupported commands and separate compilation costs.

**Not supportable from this desk research:** first agent filesystem; first tools-as-files system; first persistent-files/disposable-VM design; first per-command hardware sandbox; universal 0.5 MiB VM footprint; universal few-cents/10,000-command price; generic transactional MCP effects; full Linux compatibility.

### Fast followers and where the risk lies

**I — Vercel is the most dangerous product fast follower.** It has agent-facing shell semantics, AI SDK distribution, a backend-neutral adapter, Firecracker sandboxing, snapshots/drives, and scriptc. It could offer persistent workspace + command-scoped execution as an SDK contract and route easy commands to just-bash, harder ones to Linux. It need not match a custom kernel's reset time to erase a customer-visible advantage. This is a capability/distribution assessment, not evidence of an announced competing roadmap. [S17][S18][S34][S35][S48]

**I — Turso is the closest substrate fast follower.** The versioned/auditable agent-state story and VM mount bridge already exist. It needs execution-provider integration and a command commit/effect protocol more than a new filesystem abstraction. Its existing just-bash integration makes a Vercel/Turso composition a particularly direct benchmark. [S09], [S10], [S11], [S12], [S13]

**I — Fly is the strongest adjacent systems threat; Cloudflare is the scale/distribution threat.** Fly's storage/wake/fork/connectors stack attacks durable agent-computer economics. Cloudflare combines durable coordination/storage, sandbox file APIs and code-mode tooling. Neither needs to adopt a literal MCP mount to deliver similar user value. Morph/Freestyle win when preserving live process state is valuable; Sofort's file-only state model then becomes a limitation rather than a benefit. [S29], [S30], [S31][S38][S39][S42][S47]

## Sources with URLs

All accessed **2026-10-31** unless an access failure is stated. Primary sources support V claims; P results remain author claims. Source titles below also serve as the reference-link definitions.

### Local material read

- **L01:** [Next Token ep. 6 transcript, 0:18–0:20](../corpus/transcripts/11-next-token-ep-06-the-senior-engineer-death-spiral.txt).
- **L02:** [jitk README](../../jitk/README.md).
- **L03:** [jitk architecture](../../jitk/docs/ARCHITECTURE.md).
- **L04:** [GrowOS→Node synthesis](../growos-node/SUMMARY.md) and [competition report](../growos-node/01-COMPETITION.md), October 31, 2026. Leads were rechecked where used as current product evidence.
- **L05:** [GrowOS novelty synthesis](../growos-novelty/SUMMARY.md) and selected [prior-art source entries](../growos-novelty/01-PRIOR-ART.md), October 31, 2026.
- **L06:** [October 31 memory/reset report](../../jitk/bench/v1/results/2026-10-31-memory.md) and [R11 review](../../review/R11-REVIEW.md). No measurements reproduced.

### Filesystem interfaces and state substrates

- **S01:** [Plan 9 from Bell Labs](https://9p.io/sys/doc/9.html), foundational Bell Labs paper; [9P overview](https://9p.io/plan9/about.html).
- **S02:** [githubfs](https://github.com/danishprakash/githubfs), read-only GitHub FUSE; [restfs](https://github.com/dbushong/restfs), web-resource FUSE. Older precedents, current repositories inspected.
- **S03:** [airshelf/mcpfs](https://github.com/airshelf/mcpfs); [repository metadata](https://api.github.com/repos/airshelf/mcpfs), created March 4, 2026. Read/write classification and mounting docs inspected.
- **S04:** [FUSE is All You Need](https://jakobemmerling.de/posts/fuse-is-all-you-need/), Jakob Emmerling, January 11, 2026; [agent-fuse implementation link](https://github.com/Jakob-em/agent-fuse). Indexed primary text read; direct article fetch failed (502/TLS mismatch). No execution performed.
- **S05:** [Airstore README](https://github.com/beam-cloud/airstore), [raw README](https://raw.githubusercontent.com/beam-cloud/airstore/main/README.md), [metadata](https://api.github.com/repos/beam-cloud/airstore). Created January 27, 2026; source views, tool executables, local mode, AGPL.
- **S06:** [Namespace-Bounded Agents artifacts](https://github.com/NERVsystems/namespace-bounded-agents), January 2026, [raw README with limitations](https://raw.githubusercontent.com/NERVsystems/namespace-bounded-agents/master/README.md); [llm9p](https://github.com/NERVsystems/llm9p), created January 22; [InferNode concepts](https://www.infernode.io/docs/concepts/). Security claims are author results, not independently audited.
- **S07a:** [IceWhaleTech ToolFS README](https://raw.githubusercontent.com/IceWhaleTech/ToolFS/main/README.md), [metadata](https://api.github.com/repos/IceWhaleTech/ToolFS), created January 18, 2026.
- **S07b:** [ToolFS sandbox implementation](https://github.com/IceWhaleTech/ToolFS/blob/main/sandbox.go), [snapshot implementation](https://github.com/IceWhaleTech/ToolFS/blob/main/toolfs.go). Read-only source inspection found mock sandbox and recursive filesystem capture; no audit/test run.
- **S08:** [Lanix ToolFS design](https://loopwork.github.io/lanix/reference/toolfs/), [canonical source](https://raw.githubusercontent.com/loopwork/lanix/main/docs/design/toolfs.md), [composition walkthrough](https://loopwork.github.io/lanix/learn/compose-volumes-and-tools/), [metadata](https://api.github.com/repos/loopwork/lanix), created June 10, 2026. Web text fetch initially failed; canonical raw doc and lightweight HTTP retrieval succeeded.
- **S09:** [Building AI agents with just bash and a filesystem in TypeScript](https://turso.tech/blog/agentfs-just-bash), January 2, 2026.
- **S10:** [AgentFS launch](https://turso.tech/blog/agentfs), November 13, 2025; [README](https://github.com/tursodatabase/agentfs), [schema specification](https://github.com/tursodatabase/agentfs/blob/main/SPEC.md).
- **S11:** [AgentFS copy-on-write overlay](https://turso.tech/blog/agentfs-overlay), December 31, 2025; [manual](https://github.com/tursodatabase/agentfs/blob/main/MANUAL.md).
- **S12:** [How to build agents with filesystems and bash](https://vercel.com/blog/how-to-build-agents-with-filesystems-and-bash), January 9, 2026. Reported application savings are not infrastructure benchmarks.
- **S13:** [AgentFS Firecracker/NFS example](https://raw.githubusercontent.com/tursodatabase/agentfs/main/examples/firecracker/README.md), current repository example; precise feature introduction date U.
- **S14:** [Fork, Explore, Commit](https://arxiv.org/abs/2602.08199), February 9, 2026; [March 19 revision](https://arxiv.org/html/2602.08199v2), Agentic OS Workshop March 23; [BranchFS](https://github.com/multikernel/branchfs), [metadata](https://api.github.com/repos/multikernel/branchfs), created February 2.
- **S15:** [BranchContext/branching README](https://github.com/multikernel/branching), current 2026 command lifecycle and sandbox separation.
- **S16:** [A Clinical Researcher's Sandbox](https://medeloop.ai/press/release.html?id=sandbox-engineering), July 30, 2026, Medeloop Engineering Team. Embedded article record/body read via lightweight HTTP; normal web extraction returned empty body.

### Execution interfaces and containment

- **S17:** [just-bash package README](https://raw.githubusercontent.com/vercel-labs/just-bash/main/packages/just-bash/README.md), [threat model](https://github.com/vercel-labs/just-bash/blob/main/THREAT_MODEL.md), [package license](https://github.com/vercel-labs/just-bash/blob/main/packages/just-bash/LICENSE), [metadata](https://api.github.com/repos/vercel-labs/just-bash), created December 23, 2025.
- **S18:** [bash-tool README](https://raw.githubusercontent.com/vercel-labs/bash-tool/main/README.md), [metadata](https://api.github.com/repos/vercel-labs/bash-tool), created January 6, 2026; [skills launch](https://vercel.com/changelog/use-skills-in-your-ai-sdk-agents-via-bash-tool), 2026.
- **S19:** [Official Codex sandbox docs](https://learn.chatgpt.com/docs/sandboxing), [permission profiles and legacy Landlock](https://learn.chatgpt.com/docs/permissions), current October 2026. Older developers.openai.com Codex URLs redirect to ChatGPT Learn.
- **S20:** [Claude Code sandboxing launch](https://www.anthropic.com/research/claude-code-sandboxing), October 20, 2025; [sandbox-runtime source/docs](https://github.com/anthropics/sandbox-runtime), current 2026.
- **S21:** [bubblewrap README](https://github.com/containers/bubblewrap), current upstream policy/namespace description; mature pre-agent runtime.
- **S22:** [gVisor SandboxExec examples](https://github.com/google/gvisor/blob/master/examples/sandboxexec/README.md), current 2026; [gVisor architecture](https://gvisor.dev/docs/architecture_guide/intro/).
- **S23:** [Ray Sandboxes](https://docs.ray.io/en/latest/ray-core/sandboxes.html), [master API](https://docs.ray.io/en/master/core/sandboxes.html), current 2026 alpha documentation; [session-based gVisor agent example](https://github.com/misterwilliam/gvisor-agent-sandbox) explicitly uses one container per session, multiple `exec`s.
- **S24:** [Firecracker snapshot support](https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/snapshot-support.md), [Hyperlight–Unikraft](https://github.com/hyperlight-dev/hyperlight-unikraft), current 2026. See local competition report for broader measured-vs-advertised distinctions; no fresh runtime measurements here.
- **S25:** [Anthropic code execution tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool), versions `20250522`, `20250825`, `20260120`, `20260521`; [product containment patterns](https://www.anthropic.com/research/how-we-contain-claude), May 25, 2026. Product-specific boundaries preserved.
- **S26:** [Code execution with MCP](https://www.anthropic.com/research/code-execution-with-mcp), November 4, 2025, with later update metadata on page.
- **S27:** [OpenAI Code Interpreter](https://developers.openai.com/api/docs/guides/tools-code-interpreter), [Hosted Shell](https://developers.openai.com/api/docs/guides/tools-shell), [API changelog](https://developers.openai.com/api/docs/changelog), February 10, 2026 shell launch/current October contracts.
- **S28:** [Official OpenAI API pricing](https://developers.openai.com/api/docs/pricing), current October 2026. Markdown representation was fetched directly because web tool rejected its content type; session table and eligible per-minute note both retained.

### Hosted workspaces, branching and billing

- **S29:** [Cloudflare sandbox files](https://developers.cloudflare.com/sandbox/files/), updated October 22, 2026; [save/restore workspace](https://developers.cloudflare.com/sandbox/files/save-and-restore-a-workspace/).
- **S30:** [Cloudflare Container snapshots](https://developers.cloudflare.com/containers/guides/snapshots/), updated September 30, 2026.
- **S31:** [Cloudflare Container pricing](https://developers.cloudflare.com/containers/platform/pricing/), updated October 5, 2026; [Sandbox SDK](https://github.com/cloudflare/sandbox-sdk). Hourly equivalents computed from published per-second rates.
- **S32:** [E2B snapshots](https://e2b.dev/docs/sandbox/snapshots), [SDK implementation](https://github.com/e2b-dev/E2B/blob/main/packages/js-sdk/src/sandbox/index.ts), [October changelog](https://changelog.e2b.dev/product-updates), [pricing](https://e2b.dev/pricing). CPU/RAM hourly rates are conversions from seconds.
- **S33:** [Daytona snapshots](https://www.daytona.com/docs/snapshots), [Linux VM/v2 lifecycle](https://www.daytona.io/docs/en/v2/linux-sandboxes/), [volumes](https://www.daytona.io/docs/volumes/), [pricing](https://www.daytona.io/pricing), current 2026. Parallel/stable/v2 documentation may describe different service classes; no universal class assumption.
- **S34:** [Vercel filesystem snapshot launch](https://vercel.com/changelog/filesystem-snapshots-supported-on-vercel-sandboxes), January 22, 2026; [snapshot contract](https://vercel.com/docs/sandbox/concepts/snapshots), [Drives guide](https://vercel.com/kb/guide/vercel-drives), July 2026 guide/current documentation.
- **S35:** [Vercel Sandbox pricing](https://vercel.com/docs/sandbox/pricing), current October 2026; region-specific active CPU, memory, creation, snapshot/drive charges. Current billing page supersedes older private-beta “free drives” guide wording.
- **S36:** [Modal sandboxes](https://modal.com/docs/guide/sandboxes), [VM GA launch](https://modal.com/blog/vm-sandboxes-agent-computers), October 1, 2026; [snapshots](https://modal.com/docs/guide/sandbox-snapshots), [exit snapshots beta](https://modal.com/docs/guide/sandbox-exit-snapshots).
- **S37:** [Modal sandbox resources/billing](https://modal.com/docs/guide/sandbox-resources), [volumes](https://modal.com/docs/guide/volumes), current October 2026. Default requests and billable usage are not a physical-memory overhead benchmark.
- **S38:** [Morph Cloud documentation](https://cloud.morph.so/docs/developers), [MCU pricing](https://cloud.morph.so/web/subscribe), current 2026; lifecycle timing is vendor-advertised.
- **S39:** [Freestyle agent live-fork guide](https://www.freestyle.sh/blog/engineering/how-to-build-deep-research-agents-on-freestyle), 2026; [pricing](https://www.freestyle.sh/pricing), [limits](https://www.freestyle.sh/docs/vms/pricing-and-limits), current 2026.
- **S40:** [Runloop snapshot introduction](https://runloop.ai/blog/product-update-introducing-suspend-resume-and-snapshots), November 12, 2024; [snapshot docs](https://docs.runloop.ai/docs/devboxes/snapshots), [pricing](https://runloop.ai/pricing), current 2026.
- **S41:** [Cursor worktrees](https://cursor.com/docs/configuration/worktrees), [April 24, 2026 update](https://cursor.com/changelog/04-24-26); [Git worktree manual](https://git-scm.com/docs/git-worktree), underlying primitive.
- **S42:** [Fly Sprites](https://fly.io/sprites/), [agent architecture](https://fly.io/ai-agents/), [Sprite Block Device/forks/connectors account](https://www.fly.io/blog/kurt-scott-money-sprites/), July 2026, current product docs. Product performance remains vendor evidence.

### OS metaphors, compatibility generation and compilation

- **S43:** [MemGPT: Towards LLMs as Operating Systems](https://arxiv.org/abs/2310.08560), October 12, 2023; revised February 12, 2024.
- **S44:** [AIOS: LLM Agent Operating System](https://arxiv.org/abs/2403.16971), March 25, 2024; [COLM 2025 paper](https://openreview.net/pdf?id=L4HHkCDz2x).
- **S45:** [From Everything-is-a-File to Files-Are-All-You-Need](https://arxiv.org/abs/2601.11672), January 16, 2026. Conceptual argument, not a demonstrated microVM filesystem system.
- **S46:** [OSFoundry](https://arxiv.org/abs/2609.25018), 2026 preprint, displayed submission August 8 (ID/date inconsistency retained); [Ginux](https://github.com/gmkurtzer/ginux), October 2026. [LEMU publisher](https://www.sciencedirect.com/science/article/abs/pii/S1383762126001888) returned 403 in this pass; earlier local report describes August 2026 publication. Not counted as newly verified here.
- **S47:** [Cloudflare Code Mode MCP](https://blog.cloudflare.com/code-mode-mcp), February 20, 2026; typed API execution and context compression, distinct from native filesystem mounts.
- **S48:** [scriptc](https://scriptc.dev/), [source](https://github.com/vercel-labs/scriptc), current October 2026. Public compiler tiers, not a Sofort-only runtime feature.
- **S49:** [MCP filesystem reference server](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem), [jeswin/mcpfs](https://github.com/jeswin/mcpfs), [IBM chuk-mcp-vfs](https://github.com/IBM/chuk-mcp-vfs). Distinguish MCP→filesystem tools from filesystem→MCP invocation; mounting features may be planned.

### Search coverage and limitations

Searches covered literal phrases (`MCP as a filesystem`, `mcpfs`, `MCP FUSE`, `MCP 9P`, `per-command Firecracker`, `files tools sandbox`), vendor-specific persistence/fork/snapshot/billing queries, primary GitHub READMEs and selected source files, agent-OS papers, and cited adjacent work. Important leads discovered beyond the assignment were **BranchFS/BranchContext, Medeloop, Namespace-Bounded Agents, Airstore, two distinct ToolFS projects, and Fly Sprites' drive/connector changes**. Repository metadata was fetched through read-only GitHub API requests for dates/licenses; no repositories/dependencies were installed.

No videos were watched and no runtime/security claims were independently exercised. Primary conference papers and engineering text substitute for talk recollections. Mutable live documentation cannot prove the exact feature set on an earlier launch date. A source's absence of a feature is reported as “not established,” not evidence the company lacks it internally. This is not a patent clearance or exhaustive priority search.

[L01]: ../corpus/transcripts/11-next-token-ep-06-the-senior-engineer-death-spiral.txt
[L02]: ../../jitk/README.md
[L03]: ../../jitk/docs/ARCHITECTURE.md
[L04]: ../growos-node/SUMMARY.md
[L05]: ../growos-novelty/SUMMARY.md
[L06]: ../../jitk/bench/v1/results/2026-10-31-memory.md
[S01]: https://9p.io/sys/doc/9.html
[S02]: https://github.com/danishprakash/githubfs
[S03]: https://github.com/airshelf/mcpfs
[S04]: https://jakobemmerling.de/posts/fuse-is-all-you-need/
[S05]: https://github.com/beam-cloud/airstore
[S06]: https://github.com/NERVsystems/namespace-bounded-agents
[S07]: https://github.com/IceWhaleTech/ToolFS
[S07a]: https://raw.githubusercontent.com/IceWhaleTech/ToolFS/main/README.md
[S07b]: https://github.com/IceWhaleTech/ToolFS/blob/main/sandbox.go
[S08]: https://loopwork.github.io/lanix/reference/toolfs/
[S09]: https://turso.tech/blog/agentfs-just-bash
[S10]: https://turso.tech/blog/agentfs
[S11]: https://turso.tech/blog/agentfs-overlay
[S12]: https://vercel.com/blog/how-to-build-agents-with-filesystems-and-bash
[S13]: https://raw.githubusercontent.com/tursodatabase/agentfs/main/examples/firecracker/README.md
[S14]: https://arxiv.org/html/2602.08199v2
[S15]: https://github.com/multikernel/branching
[S16]: https://medeloop.ai/press/release.html?id=sandbox-engineering
[S17]: https://raw.githubusercontent.com/vercel-labs/just-bash/main/packages/just-bash/README.md
[S18]: https://github.com/vercel-labs/bash-tool
[S19]: https://learn.chatgpt.com/docs/sandboxing
[S20]: https://www.anthropic.com/research/claude-code-sandboxing
[S21]: https://github.com/containers/bubblewrap
[S22]: https://github.com/google/gvisor/blob/master/examples/sandboxexec/README.md
[S23]: https://docs.ray.io/en/latest/ray-core/sandboxes.html
[S24]: https://github.com/hyperlight-dev/hyperlight-unikraft
[S25]: https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool
[S26]: https://www.anthropic.com/research/code-execution-with-mcp
[S27]: https://developers.openai.com/api/docs/guides/tools-shell
[S28]: https://developers.openai.com/api/docs/pricing
[S29]: https://developers.cloudflare.com/sandbox/files/
[S30]: https://developers.cloudflare.com/containers/guides/snapshots/
[S31]: https://developers.cloudflare.com/containers/platform/pricing/
[S32]: https://e2b.dev/docs/sandbox/snapshots
[S33]: https://www.daytona.io/docs/en/v2/linux-sandboxes/
[S34]: https://vercel.com/docs/sandbox/concepts/snapshots
[S35]: https://vercel.com/docs/sandbox/pricing
[S36]: https://modal.com/docs/guide/sandboxes
[S37]: https://modal.com/docs/guide/sandbox-resources
[S38]: https://cloud.morph.so/docs/developers
[S39]: https://www.freestyle.sh/blog/engineering/how-to-build-deep-research-agents-on-freestyle
[S40]: https://docs.runloop.ai/docs/devboxes/snapshots
[S41]: https://cursor.com/docs/configuration/worktrees
[S42]: https://fly.io/sprites/
[S43]: https://arxiv.org/abs/2310.08560
[S44]: https://arxiv.org/abs/2403.16971
[S45]: https://arxiv.org/abs/2601.11672
[S46]: https://arxiv.org/abs/2609.25018
[S47]: https://blog.cloudflare.com/code-mode-mcp
[S48]: https://scriptc.dev/
[S49]: https://github.com/IBM/chuk-mcp-vfs
