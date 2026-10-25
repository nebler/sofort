# Cloudflare, capabilities, and agent sandboxing

Curated for Sofort/Capsule on 2026-10-25, after reading `demo.md` §0–1 and `arch/research/cloudflare-goose/SYNTHESIS.md`. 30 items; eight P1s. P1 = must, P2 = should, P3 = deeper context. Cloudflare reading times are the publisher's estimates; `≈` marks my estimates elsewhere. Video durations come from YouTube metadata.

Verification: every linked item was fetched and its title/content checked. All three YouTube titles and channels were additionally confirmed through YouTube's oEmbed endpoint. The New Stack interview was verified with a successful HTTP 200 GET when the web fetch returned 403. Historical launch posts explain designs, not current pricing or availability.

## Workers architecture and isolation

- [P1] **Mitigating Spectre and Other Security Threats: The Cloudflare Workers Security Model** — Kenton Varda (Cloudflare), Blog, 2020, 25 min — <https://blog.cloudflare.com/mitigating-spectre-and-other-security-threats-the-cloudflare-workers-security-model/>
  Why for Sofort: The essential account of shared-process V8 isolates, API confinement, patching, and Spectre defenses; separate deployed defenses from future measures proposed in this historical post. Concepts: V8, isolates, trusted computing base, timers, dynamic process isolation, side channels.

- [P2] **Safe in the sandbox: security hardening for Cloudflare Workers** — Erik Corry and Ketan Gupta (Cloudflare), Blog, 2025, 17 min — <https://blog.cloudflare.com/safe-in-the-sandbox-security-hardening-for-cloudflare-workers/>
  Why for Sofort: Updates the isolation story with V8 sandboxing and memory protection keys; gives concrete defenses and limitations against which to explain jitk's hardware boundary. Concepts: defense in depth, V8 sandbox, MPK, memory corruption, isolate separation.

- [P2] **Introducing workerd: the Open Source Workers runtime** — Kenton Varda (Cloudflare), Blog, 2022, 13 min — <https://blog.cloudflare.com/workerd-open-source-workers-runtime/>
  Why for Sofort: Explains the server-oriented runtime, nanoservices, capability-oriented configuration, and self-hosting; distinguish the portable runtime from Cloudflare's surrounding production infrastructure. Concepts: workerd, V8, Wasm, event-driven execution, service composition, portability.

## Durable Objects: ownership, consistency, and sleeping

- [P1] **Durable Objects: Easy, Fast, Correct — Choose three** — Kenton Varda (Cloudflare), Blog, 2021, 19 min — <https://blog.cloudflare.com/durable-objects-easy-fast-correct-choose-three/>
  Why for Sofort: Input/output gates explain how Capsule's journal owner can coordinate durable state and observable responses; they do not supply atomic transactions with arbitrary external services. Concepts: single-threaded actors, async interleaving, input gates, output gates, atomic writes, consistency.

- [P2] **Zero-latency SQLite storage in every Durable Object** — Kenton Varda (Cloudflare), Blog, 2024, 21 min — <https://blog.cloudflare.com/sqlite-in-durable-objects/>
  Why for Sofort: Grounds the journal design in colocated synchronous SQL and replicated durability; read the storage architecture rather than treating the title as a claim that durable commits take zero time. Concepts: SQLite, actor-local storage, replication, write-ahead logging, transactions, placement.

- [P2] **New tools for production safety — Gradual deployments, Source maps, Rate Limiting, and new SDKs** — Tanushree Sharma and Jacob Bednarz (Cloudflare), Blog, 2024, 13 min overall; ≈3 min relevant section — <https://blog.cloudflare.com/workers-production-safety/>
  Why for Sofort: Read “Durable Object namespace analytics and WebSocket Hibernation GA”: sockets can survive while serialized state lets the object sleep; arbitrary JS stacks are not preserved. Concepts: hibernation, WebSockets, serialized state, idle billing, lifecycle.

## Code Mode and the execution platform

- [P1] **Code Mode: the better way to use MCP** — Kenton Varda and Sunil Pai (Cloudflare), Blog, 2025, 12 min — <https://blog.cloudflare.com/code-mode/>
  Why for Sofort: Establishes the exact executor problem Sofort implements: generated code composes typed tools and keeps intermediate data outside model context, creating a distinct sandbox and effects boundary. Concepts: MCP, TypeScript APIs, code execution, token economy, tool composition, Dynamic Worker Loader.

- [P1] **Sandboxing AI agents, 100x faster** — Kenton Varda, Sunil Pai, and Ketan Gupta (Cloudflare), Blog, 2026, 13 min — <https://blog.cloudflare.com/dynamic-workers/>
  Why for Sofort: The closest lightweight execution alternative: runtime-loaded Workers, explicitly supplied RPC capabilities, and controlled outbound networking; treat headline performance comparisons as the author's workload-specific claims. Concepts: Dynamic Workers, loader, V8 isolates, bindings, globalOutbound, sandbox economics.

- [P2] **Announcing Workers for Platforms: making every application on the Internet more programmable** — Rita Kozlov (Cloudflare), Blog, 2022, 10 min — <https://blog.cloudflare.com/workers-for-platforms/>
  Why for Sofort: Explains the product model for platforms hosting customer-written programs, including dispatch and control over execution; complements the lower-level Dynamic Worker mechanism. Concepts: multi-tenancy, user code, dispatch namespaces, platform ownership, programmable SaaS.

- [P2] **Cloudflare Containers, rebuilt to scale agent sandboxes** — Thomas Gauvin, Rushil Mehra, Gabi Villalonga Simón, and Thomas Lefebvre (Cloudflare), Blog, 2026, 15 min — <https://blog.cloudflare.com/faster-agent-sandboxes/>
  Why for Sofort: The September update covers native `ctx.container`, Sandbox SDK 1.0, runtime image selection, and reusable filesystem snapshots; those snapshots alone do not establish mid-function continuation recovery. Concepts: Containers, Sandbox SDK, Durable Object controllers, scheduling, filesystem snapshots, Linux workspace.

- [P2] **Project Think: building the next generation of AI agents on Cloudflare** — Sunil Pai and Kate Reznykova (Cloudflare), Blog, 2026, 13 min — <https://blog.cloudflare.com/project-think/>
  Why for Sofort: Positions the Agents SDK's durable fibers, explicit `stash()` checkpoints, recovery handlers, sessions, and execution ladder against Capsule's proposed portable opaque continuation. Concepts: Agents SDK, fibers, recovery, explicit state, facets, session forks, execution tiers.

- [P2] **Cloudflare OS: an open platform for agents, apps, and work** — Phillip Jones and Dan Carter (Cloudflare), Blog, 2026, 13 min — <https://blog.cloudflare.com/cloudflare-os/>
  Why for Sofort: Shows the capability layer Capsule should integrate with: Gatekeepers hold credentials, constrain resources and actions, and track observed data to govern subsequent sharing and effects. Concepts: Gatekeepers, capabilities, information flow, credential separation, outbound mediation, Cap'n Web.

## Capability security, RPC, and the older ideas underneath

- [P1] **Why Workers environment variables contain live objects** — Kenton Varda (Cloudflare), Blog, 2024, 18 min — <https://blog.cloudflare.com/workers-environment-live-object-bindings/>
  Why for Sofort: The clearest bridge from familiar cloud credentials to object capabilities: designation and authority travel together, while code receives resource objects instead of exportable secrets. Concepts: object capabilities, bindings, least authority, SSRF, dependency injection, ambient authority.

- [P1] **Cap'n Web: a new RPC system for browsers and web servers** — Kenton Varda and Steve Faulkner (Cloudflare), Blog, 2025, 16 min — <https://blog.cloudflare.com/capnweb-javascript-rpc-library/>
  Why for Sofort: The most directly reusable thin capability transport: references, callbacks, and promise pipelining across browser/Worker/Node; Capsule must separately define handle rebinding and revocation after restore. Concepts: Cap'n Web, object-capability RPC, stubs, callbacks, pipelining, transports.

- [P2] **Cap'n Proto v0.4: Time Traveling RPC** — Kenton Varda (Cap'n Proto), Blog, 2013, ≈4 min — <https://capnproto.org/news/2013-12-12-capnproto-0.4-time-travel.html>
  Why for Sofort: Distinguishes ordinary asynchronous promises from pipelined dependent calls, explaining why fine-grained capability interfaces need not force a round trip at every step. Concepts: Cap'n Proto, promise pipelining, latency, dependency graphs, event loops.

- [P1] **Paradigm Regained: Abstraction Mechanisms for Access Control** — Mark S. Miller (E Project; Google TechTalks channel), YouTube, 2006 talk / 2007 upload, 1h 00m 06s — <https://www.youtube.com/watch?v=oE3x_gM3YFU>
  Why for Sofort: The classic foundation for arguing that modularity, naming, delegation, and security belong to one model; especially useful for defending scoped tool handles and revocable forwarding objects. Concepts: object capabilities, E, POLA, authority versus permission, confused deputy, revocation, confinement.

- [P2] **Capability Myths Demolished** — Adrian Colyer (The Morning Paper), Blog, 2016, ≈8 min — <https://blog.acolyer.org/2016/02/16/capability-myths-demolished/>
  Why for Sofort: Readable commentary on Miller, Yee, and Shapiro's 2003 work, covering why ACL equivalence, confinement, and revocation objections depend on which capability model is meant. Concepts: capability myths, ACLs, ambient authority, delegation channels, composability, dynamic resources.

- [P3] **All About E: The Language that Infiltrated JavaScript** — David Cassel interviewing Mark S. Miller (The New Stack / Agoric), Blog, 2022, ≈7 min — <https://thenewstack.io/all-about-e-the-language-that-infiltrated-javascript/>
  Why for Sofort: The language designer's retrospective connects E's secure distributed programming and promises to JavaScript, helping separate enduring capability ideas from a particular language's adoption. Concepts: E language, eventual sends, promises, JavaScript lineage, secure distributed objects.

- [P2] **Plan 9: Not dead, Just Resting, by Ori Bernstein** — Ori Bernstein (9front; BSDTV channel), YouTube, 2019, 1h 17m 06s — <https://www.youtube.com/watch?v=6m3GuoaxRNM>
  Why for Sofort: A contributor's deliberately critical overview and demo of files, namespaces, and distributed resources; tests whether Sofort's tool-backed filesystem earns its uniform interface through actual composition. Concepts: Plan 9, 9front, 9P, everything-is-a-file, per-process namespaces, distributed interfaces.

## MCP and agent security: arguments and counterarguments

- [P2] **Introducing the Model Context Protocol** — Anthropic (MCP created by David Soria Parra and Justin Spahr-Summers), Blog, 2024, ≈4 min — <https://www.anthropic.com/news/model-context-protocol>
  Why for Sofort: The primary introduction to the specification, client/server architecture, SDKs, and interoperability goal; use it to distinguish MCP's integration contract from Sofort's execution and authorization responsibilities. Concepts: MCP specification introduction, clients, servers, tools, connectors, interoperability.

- [P2] **Code execution with MCP: Building more efficient agents** — Adam Jones and Conor Kelly (Anthropic), Blog, 2025, ≈10 min — <https://www.anthropic.com/engineering/code-execution-with-mcp>
  Why for Sofort: Independently motivates progressive tool discovery and keeping intermediate data in code, while explicitly acknowledging sandbox, resource-limit, and monitoring costs absent from direct tool calling. Concepts: code-mode critique, MCP, progressive disclosure, context efficiency, privacy, operational overhead.

- [P1] **The lethal trifecta for AI agents: private data, untrusted content, and external communication** — Simon Willison (independent researcher), Blog, 2025, ≈6 min — <https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/>
  Why for Sofort: The necessary counterargument to “the VM contained it”: authorized tools can still read secrets and exfiltrate them, so the trusted host must constrain combinations of effects. Concepts: prompt injection, MCP critique, private data, untrusted content, exfiltration, tool composition.

- [P2] **Prompt injection explained, with video, slides, and a transcript** — Simon Willison (independent researcher), Blog, 2023, ≈15 min including Q&A — <https://simonwillison.net/2023/May/2/prompt-injection-explained/>
  Why for Sofort: A foundational installment of Willison's prompt-injection series challenges prompt-only defenses and introduces separation of privileged control from quarantined content. Concepts: prompt injection, probabilistic defenses, dual LLM pattern, tainted data, control/data separation.

- [P2] **Beyond permission prompts: making Claude Code more secure and autonomous** — David Dworken and Oliver Weller-Davies (Anthropic), Blog, 2025, ≈8 min — <https://www.anthropic.com/research/claude-code-sandboxing>
  Why for Sofort: A production argument for enforcing filesystem and network boundaries together, reducing approval fatigue, and placing sensitive Git authority behind a proxy. Concepts: Claude Code, OS sandbox, filesystem isolation, network isolation, approval fatigue, credential proxy.

- [P2] **How we contain Claude across products** — Max McGuinness, Mikaela Grace, Jiri De Jonghe, Jake Eaton, and Abel Ribbink (Anthropic), Blog, 2026, ≈22 min — <https://www.anthropic.com/research/how-we-contain-claude>
  Why for Sofort: The strongest production challenge to a fresh kernel: mature isolation primitives held while custom integration and egress components failed; compare ephemeral containers, local sandboxes, and VMs. Concepts: containment, gVisor, Seatbelt, bubblewrap, VM boundaries, egress failures, persistent poisoning.

- [P2] **Building a safe, effective sandbox to enable Codex on Windows** — David Wiesen (OpenAI), Blog, 2026, ≈17 min — <https://openai.com/index/building-codex-windows-sandbox/>
  Why for Sofort: A concrete sandbox engineering account showing why advisory proxy settings fail and why filesystem permissions, descendant processes, network identity, and compatibility must be designed together. Concepts: Codex sandbox, Windows tokens, SIDs, ACLs, firewall enforcement, process trees, compatibility.

- [P2] **Ep 07 — “What's after Code Mode”** — Matt Carey with Dillon Mulroy, Rhys Sullivan, and Sunil Pai (Next Token; Cloudflare-sponsored), YouTube, 2026, 1h 25m — <https://www.youtube.com/watch?v=0hRlvn0IPMI>
  Why for Sofort: The requested public episode is verified; prioritize 12:55–1:03:31, especially nested Code Mode at 36:56, permissioning at 46:12, and the future/unikernel discussion from 48:09. Concepts: Code Mode critiques, MCP, execution environments, permissions, durable execution, unikernels.

## How Cloudflare engineers describe building and joining forces

- [P2] **Cloudflare acquires PartyKit to allow developers to build real-time multi-user applications** — Sunil Pai and Rita Kozlov (Cloudflare / PartyKit), Blog, 2024, 5 min — <https://blog.cloudflare.com/cloudflare-acquires-partykit/>
  Why for Sofort: A founder's example of making an existing primitive useful through familiar developer interfaces; a stronger positioning reference than treating low-level novelty as sufficient evidence of value. Concepts: PartyKit, Durable Objects, developer experience, collaboration, local-first, acquisition rationale.

- [P2] **Deno is joining Cloudflare** — Kenton Varda and Ryan Dahl (Cloudflare / Deno), Blog, 2026, ≈10 min; publisher labels it 1 min — <https://blog.cloudflare.com/deno-joins-cloudflare/>
  Why for Sofort: Both engineers explain why distributed Durable Objects, celld/workerd integration, and credible self-hosting matter; directly informs Capsule's portability promise and upstream contribution strategy. Concepts: Deno, celld, workerd, distributed singletons, self-hosting, portability, lock-in argument.

- [P3] **VoidZero is joining Cloudflare** — Evan You and Steve Faulkner (VoidZero / Cloudflare), Blog, 2026, 10 min — <https://blog.cloudflare.com/voidzero-joins-cloudflare/>
  Why for Sofort: Explains the public rationale around shared infrastructure, pre-existing collaboration, and vendor-neutral open source; these statements support a platform-fit hypothesis, not a prediction that Sofort will be acquired. Concepts: VoidZero, Vite, toolchains, open source, vendor neutrality, ecosystem investment.

## If you only have 3 hours

1. **60 min:** Miller, *Paradigm Regained* — establish authority, delegation, confinement, and revocation.
2. **43 min:** Varda, *Workers Security Model* (25) + *Live objects* (18) — connect execution isolation to capability-oriented APIs.
3. **22 min:** *Durable Objects: Easy, Fast, Correct* (19) + the hibernation section of *New tools for production safety* (≈3) — separate durable state from a preserved continuation.
4. **41 min:** *Code Mode* (12) + *Sandboxing AI agents, 100x faster* (13) + *Cap'n Web* (16) — understand the existing execution and RPC stack Capsule must complement.
5. **14 min:** Willison's *Lethal trifecta* (≈6) + Anthropic's *Beyond permission prompts* (≈8) — challenge the claim that sandboxing alone makes an agent safe.
