# 05 — The agent web: missing joints, mostly occupied categories

Research date: **2026-10-28**. Lens: agents as a new class of web user. Read the deep brief and the earlier rounds’ TL;DRs. This report proposes no GrowOS, jitk, capsule, new scheduler, or general verification product.

**Labels:** **F** = sourced fact, including attributed implementation claims; **M** = locally measured execution; **I** = inference or judgment; **E** = estimate or proposed target. There are **no new M execution claims**. Source code, package metadata, GitHub issues, npm listings, and HN were inspected; competitors’ tests were not rerun. Repository descriptions establish prior art, not production reliability. Undated repositories below were inspected on 2026-10-28; dated announcements retain their publication dates.

## Finding

**I — The need is real, but the broad greenfield opportunity is much smaller than the premise suggests.** Cloudflare and Vercel already serve signed agents, host MCP servers, integrate browser automation, and support machine-readable content. Identity vendors handle delegated API access. Payment providers own the payment rails. Open-source projects already implement scoped warrants, signed receipts, and honest recovery from uncertain side effects. “OAuth for agents,” “Stripe for agents,” “an agent inbox,” “Lighthouse for agents,” and “exactly-once MCP” are not defensible new-project pitches.

**I — Three useful contribution-sized gaps remain:** an explicitly supported Workers/browser build of an existing task-authorization core; a Workers implementation of an existing effect-reconciliation contract; and a bounded, replayable MCP Events backend usable across delivery modes. All become more useful as agents do more work. All are integration bets, and none has proven demand sufficient to claim a new category.

**I — My ONE pick is the first: an upstream-compatible Tenuo edge adapter, with a site-owned delegation demo.** The gap is unusually concrete: its current TypeScript README explicitly says browsers, edge runtimes, and Cloudflare Workers are unsupported, while the core already runs through Rust/Wasm. This is a finite port with an existing semantics owner, not an excuse to invent another authorization standard. Overall verdict: **GO-WITH-CHANGES as an OSS contribution; NO-GO on claiming this lens revealed an unoccupied, obviously viral standalone product.**

## 1. What shipped in 2025–2026, and what that removes

### Delegated authorization is a stack, not one token

**F:** Cloudflare released remote MCP hosting and `workers-oauth-provider` on **2025-03-25**. Auth0’s agent offering reached GA on **2025-09-25**, including Token Vault, asynchronous authorization, and fine-grained authorization. Cloudflare’s **2026** Managed OAuth for Access extends discoverable, user-delegated access to protected websites and REST APIs, beyond MCP. A generic broker, vault, approval notification service, or “make a protected wiki agent-readable” proxy now competes directly with these offerings. [Cloudflare launch](https://blog.cloudflare.com/remote-model-context-protocol-servers-mcp/), [Auth0 GA](https://auth0.com/blog/announcing-auth0-for-ai-agents-powering-the-future-of-ai-securely/), [Managed OAuth](https://blog.cloudflare.com/managed-oauth-for-access/).

**F:** MCP authorization evolved substantially across the 2025 and 2026 revisions. The **2026-07-28** release work includes issuer validation, authorization-server binding, scope-handling clarification, and client-registration changes. Current SDK documentation supports Client ID Metadata Documents and marks dynamic registration deprecated in that revision. Do not design a new service around the 2025 assumption that every server must implement DCR. [Release-candidate explanation](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/), [current official Python SDK OAuth guide](https://github.com/modelcontextprotocol/python-sdk/blob/main/docs/client/oauth-clients.md).

**F:** Scoped multi-hop delegation is also occupied. Tenuo implements task warrants with tool/argument restrictions and narrowing delegation, with Rust, Python, and beta TypeScript SDKs. Its token proposal is an **individual Internet-Draft dated 2026-10-26**, not an adopted OAuth standard. A separate attenuation-chain draft, dated **2026-10-15**, profiles JWT/Rich Authorization Requests and proof-of-possession machinery. Existing OAuth building blocks do not automatically imply universal deployment of an agent delegation profile. [Tenuo](https://github.com/tenuo-ai/tenuo), [AAT draft](https://datatracker.ietf.org/doc/html/draft-niyikiza-oauth-attenuating-agent-tokens-02), [delegation-chain draft](https://datatracker.ietf.org/doc/html/draft-asor-wimse-agent-delegation-chain-02).

**I — Remaining gap:** connecting task-specific authorization to an application’s actual execution boundary, on its runtime, with clear ownership of roots, revocation, and consumable approvals. A service owner must still define what “refund this order” means. An OAuth scope such as `payments.write` cannot infer that policy.

### Agent identity already has cryptographic and platform support

**F:** Cloudflare introduced Web Bot Auth on **2025-05-15**, using HTTP Message Signatures rather than relying solely on source IPs or user-agent strings. Vercel added support on **2025-08-12**. Cloudflare’s official `web-bot-auth` npm package already supplies TypeScript signing and verification helpers. Its example explicitly leaves atomic nonce replay rejection to the caller. [Cloudflare announcement](https://blog.cloudflare.com/web-bot-auth/), [Vercel support](https://vercel.com/changelog/vercels-bot-verification-now-supports-web-bot-auth), [npm package](https://www.npmjs.com/package/web-bot-auth), [source](https://github.com/cloudflare/web-bot-auth).

**F:** Cloudflare’s current Verified Bots documentation says that, from **2026-07-01**, the previous signed-agent distinction is represented through Direct versus Intermediary access metadata. A report that treats “signed agents” as a wholly separate, unchanged platform category is already stale. [Verified Bots, updated 2026-10-08](https://developers.cloudflare.com/bots/concepts/bot/verified-bots/).

**I — Remaining gap:** operator identity, a particular customer’s delegation, and authorization for a particular action are different facts. A valid Browserbase or agent-provider signature should not itself grant a customer’s private data access. A small developer can supply an adapter between those facts; they cannot manufacture platform-wide trust or listing in a curated directory.

### Payments are not the open slot

**F:** Cloudflare announced its x402 Foundation partnership and agent/MCP integrations on **2025-09-23**. By **2026-09-30**, its Monetization Gateway beta was charging for APIs, tokens, and MCP tools. Stripe’s **2026-03-18** Machine Payments Protocol announcement describes machine payments integrated with its existing processing stack. A generic paywall or facilitator is platform territory. [Cloudflare x402](https://blog.cloudflare.com/x402/), [Monetization Gateway announcements](https://blog.cloudflare.com/tag/x402/), [Stripe MPP](https://stripe.com/blog/machine-payments-protocol).

**F:** Google announced AP2 on **2025-09-16** with more than **60 participating organizations**; that is a collaboration count, not deployed transaction volume. AP2 **v0.2.0, 2026-04-28**, adds Human Not Present flows. Its specification defines checkout/payment mandates and receipts. Stripe Agent Toolkit is an integration with Stripe tools, not a universal wallet: the current TypeScript migration guide moves it to Stripe’s hosted MCP service, with permissions enforced using restricted API keys. [AP2 announcement](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol), [releases](https://github.com/google-agentic-commerce/AP2/releases), [AP2 specification](https://github.com/google-agentic-commerce/AP2/blob/main/docs/ap2/specification.md), [Stripe migration](https://github.com/stripe/ai/blob/main/tools/typescript/MIGRATION.md).

**I — Remaining gap:** application-specific settlement reconciliation, delivery of the purchased resource, and understandable records. Payment, delivery, and consent are three separate outcomes. AP2 already occupies much of the proposed “signed purchase consent receipt” idea; use its objects when applicable rather than minting a competing standard.

### Readable sites, discovery, and hosting are already distribution products

**F:** `llms.txt` began as a **2024-09-03 proposal**, revised in **August 2026**. It is guidance and linked content, not authorization. Cloudflare’s Markdown for Agents converts negotiated HTML responses; its other products offer rendered Markdown extraction. Microsoft introduced open-source NLWeb on **2025-05-19**, with site-grounded natural-language querying and an MCP surface. Cloudflare announced AI Index on **2025-09-26**, including search APIs, MCP, and `llms.txt`. [llms.txt and revision history](https://llmstxt.org/), [Markdown for Agents](https://blog.cloudflare.com/markdown-for-agents/), [Microsoft NLWeb](https://news.microsoft.com/source/features/company-news/introducing-nlweb-bringing-conversational-interfaces-directly-to-the-web/), [AI Index](https://blog.cloudflare.com/an-ai-index-for-all-our-customers/).

**F:** The official MCP Registry launched in preview on **2025-09-08**. Vercel’s open `mcp-handler` runs servers across web frameworks; the inspected package is **2.3.0**. Cloudflare’s **2026** MCP update supports the newer stateless model in ordinary Workers. Generic hosting, a registry clone, or a Markdown transformer therefore has substantial prior art and strong platform incentives. [Registry launch](https://blog.modelcontextprotocol.io/posts/2025-09-08-mcp-registry-preview/), [Vercel adapter](https://github.com/vercel-labs/mcp-handler), [Cloudflare MCP update](https://blog.cloudflare.com/mcp-v2).

**I — Remaining gap:** maintaining correct content and action semantics through application changes. Better models weaken the argument for elaborate HTML-to-text heuristics; they strengthen the need to preserve original authorization and freshness when exposing a second representation.

### Webhooks and inboxes: durable delivery already exists; protocol seams remain

**F:** MCP Events **SEP-3415**, opened **2026-10-05**, is still an open proposal at inspection. It defines poll, push, and signed webhook delivery, opaque cursors, optional replay, and explicit loss signaling. The earlier design sketch is dated **2026-02-19**. These are evolving extension designs, not universal client capabilities. [Proposal](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3415), [working-group design sketch](https://github.com/modelcontextprotocol/experimental-ext-triggers-events/blob/main/docs/design-sketch-proposal.md).

**F:** Hookdeck already documents acting as an MCP Events forward proxy. Cloudflare’s own MCP implementation already adapts its notification system to webhook delivery; its source documentation explicitly excludes poll and push and says it does not send `gap` envelopes because ChatGPT does not support them. This is evidence for a narrow delivery-mode gap, not an empty event category. [Hookdeck guide, October 2026](https://hookdeck.com/docs/guides/how-to-use-event-gateway-as-mcp-events-forward-proxy), [Cloudflare implementation](https://github.com/cloudflare/mcp/blob/main/docs/mcp-events.md).

**F:** AgentMail already has inboxes, scoped API keys, webhooks, WebSockets, IMAP/SMTP, and polling webhooks. Its polling mode specifically targets agents that start and stop or cannot expose a public URL. Its webhook documentation describes duplicates, out-of-order arrival, and recovery. These are concrete operational constraints, but “an inbox for sleeping agents” is already a product. [Inbox capabilities](https://www.agentmail.to/docs/knowledge-base/inbox-capabilities), [polling](https://docs.agentmail.to/webhook-polling), [delivery semantics](https://www.agentmail.to/docs/webhooks-overview).

### Browser automation and legitimate access are different layers

**F:** Cloudflare made Playwright support GA and added Stagehand support on **2025-09-25**. Browser Rendering is now documented as **Browser Run**. Current documentation supports Stagehand **2.5.x**, explicitly excluding **v3+** because its architecture is no longer Playwright-based. Browser-use supplies another open automation stack and a hosted browser product. Vercel integrated Browserbase on **2026-02-12**, including Web Bot Auth support. [2025 launch](https://developers.cloudflare.com/changelog/post/2025-09-25-br-playwright-ga-stagehand-limits/), [current Stagehand limits](https://developers.cloudflare.com/browser-run/stagehand/), [browser-use](https://github.com/browser-use/browser-use), [Vercel integration](https://vercel.com/changelog/browserbase-joins-the-vercel-agent-marketplace).

**F:** Browser-use issue **#356, 2025-01-23**, records agents stuck at Cloudflare verification; it had **15 comments and zero issue-level reactions** in the GitHub API snapshot. It was closed, so it is historical pain evidence, not proof that the same bug persists. Browserbase’s identity program still requires an application. Better actuation does not itself grant permission. [Issue](https://github.com/browser-use/browser-use/issues/356), [identity program](https://www.browserbase.com/contact-web-bot-auth).

**F:** WebMCP is also relevant to this lens: Chrome’s **2026** proposal exposes site tools in the browser. Cloudflare announced a no-origin-change developer preview on **2026-08-06** and already has a server-tool-to-WebMCP adapter. MCP-B supplies browser bridges, hooks, and polyfills. “Turn forms into agent tools” and “one browser tool bridge” are therefore occupied too. [Chrome documentation](https://developer.chrome.com/docs/ai/webmcp), [Cloudflare launch](https://blog.cloudflare.com/webmcp/), [Cloudflare adapter](https://github.com/cloudflare/agents/blob/main/experimental/webmcp.md), [MCP-B packages](https://github.com/WebMCP-org/npm-packages).

### Consent, audit, and site-owner understanding are crowded as well

**F:** Signet already supplies signed action receipts, delegation evidence, authority decisions, bilateral receipts, and TypeScript/MCP integrations. Pipelock provides mediated-traffic receipts and audit tooling. Agent Middleware implements signed permits, dispatch limits, and uncertain-outcome records; its README explicitly says it has no production deployments. EMILIA also implements mandate/action/evidence/reconciliation machinery. These projects are prior art regardless of adoption; their documentation is not independent validation of their claims. [Signet](https://github.com/Prismer-AI/signet), [Pipelock](https://github.com/pipelab-org/pipelock), [Agent Middleware](https://github.com/agentmiddleware/agent-middleware), [EMILIA](https://github.com/emiliaprotocol/emilia-protocol).

**F:** Cloudflare’s AI Crawl Control reached GA on **2025-08-28** and already exposes crawler visibility and controls. Its Agent Readiness scanner launched **2026-04-17**. On the filtered sample drawn from the **200,000 most-visited domains**, Cloudflare reported **3.9%** Markdown negotiation and fewer than **15** sites with the cited emerging MCP-card/API-catalog checks. These are dated vendor scan results, not current global adoption rates. Cloudflare also shipped RFC 9457-style agent error responses on **2026-03-11**. [AI Crawl Control](https://blog.cloudflare.com/introducing-ai-crawl-control), [readiness research and scanner](https://blog.cloudflare.com/agent-readiness/), [structured error responses](https://blog.cloudflare.com/rfc-9457-agent-error-pages/).

**I — Remaining gap:** application-owned explanations of *this customer’s attempted action*, especially the distinction between “denied,” “not dispatched,” and “may have happened.” Generic crawler analytics and readiness scores are already platform features.

## 2. Evidence that should change the ranking

**F — A real, narrowly specified mutation ambiguity.** MCP issue **#3394**, opened **2026-09-27**, reports a lost-response reproduction: two effects after one explicit application retry, versus one with a stable application key. The report concerns a deliberately non-idempotent handler, an in-memory transport, and a scripted retry; the SDK does not automatically retry and no protocol violation is claimed. GitHub’s API returned **41 comments and zero reactions** on 2026-10-28. This is active engineering discussion, not demonstrated mass demand. [Issue](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/3394), [API snapshot endpoint](https://api.github.com/repos/modelcontextprotocol/modelcontextprotocol/issues/3394), [public reproduction](https://github.com/arjun2075/mcp-b1-lost-response-repro).

**F — The obvious fix already has proposals and code.** MCP request-idempotency PR **#3182**, opened **2026-08-01**, is closed and has a linked reference implementation. A2A issue **#1893**, opened **2026-05-29**, requests a standard idempotency header and is closed/consolidated; its API snapshot had **8 comments and zero reactions**. Do not interpret closure as proof that all deployed SDKs now implement the feature, or absence of a standard field as absence of application-level solutions. [MCP proposal](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3182), [reference implementation](https://github.com/abluva/mcp-request-idempotency-reference), [A2A issue](https://github.com/a2aproject/A2A/issues/1893).

**F — The edge primitive already exists too.** `@lgolabs/idempotency-mcp` advertises a Workers/Durable Objects idempotency API, claiming one DO per customer/key. `@idempot/hono-middleware` already has request fingerprinting and multiple store adapters. These kill the novelty of “one DO serializes agent retries.” Their existence does not establish correct recovery after an external effect commits and the proxy crashes before storing its result. [LGO package](https://www.npmjs.com/package/@lgolabs/idempotency-mcp), [source](https://github.com/lgolabs/idempotency-mcp), [Hono package](https://www.npmjs.com/package/@idempot/hono-middleware).

**F — Even honest reconciliation is already implemented.** `effect-broker` has Python code, SQLite/Postgres stores, MCP integration, operation keys, unknown outcomes, and a subprocess crash demo. Its README reports **68 passing / 11 skipped tests** at a named commit; that is the author’s result, not ours. It already demonstrates recovery for idempotent and reconcilable targets and stopping for an unsafe target. A general effect broker would duplicate direct prior art. The remaining question is a useful Workers implementation or upstream adapter. [README and code](https://github.com/prathamesh-git9/effect-broker), [Python dependencies](https://github.com/prathamesh-git9/effect-broker/blob/main/pyproject.toml).

**F — There is a verified runtime support hole.** Tenuo’s TypeScript README explicitly excludes browsers, edge runtimes, and Cloudflare Workers. Its build uses `wasm-pack --target nodejs`; its SDK also uses Node facilities such as `AsyncLocalStorage`. The npm `beta` tag returned **0.3.3-beta.0**, requiring Node **20+**, during inspection. This proves unsupported packaging/runtime scope, not that an edge port is difficult, demanded, or impossible using compatibility flags. [TypeScript README](https://github.com/tenuo-ai/tenuo/blob/main/tenuo-ts/README.md), [build configuration](https://github.com/tenuo-ai/tenuo/blob/main/tenuo-ts/package.json), [npm metadata](https://registry.npmjs.org/@tenuo/core/beta).

**F — Auth debugging is also an existing OSS category.** MCPJam Inspector includes OAuth debugging/conformance; the official Inspector has OAuth flows and a roadmap covering delegation-related work. OpZero published client-interoperability investigations and a conformance project on **2026-09-01**. A new OAuth “doctor” is not white space. [MCPJam](https://github.com/MCPJam/inspector), [official Inspector roadmap](https://github.com/modelcontextprotocol/inspector/blob/main/docs/inspector-roadmap-2026-h2.md), [OpZero’s investigation](https://open0p.com/blog/mcp-conformance-needs-more-than-the-spec).

**F/I — HN does not establish easy excitement.** Direct HN/Algolia search found *Current state of MCP OAuth: A work in progress* (**2025-07-23**, **9 points / 0 comments**) and *Show HN: Fix MCP OAuth Gaps (CLI and CI Check)* (**2026-02-12**, **2 points / 1 comment**) at inspection. These are small examples, not a representative engagement study. **I:** an auth checklist alone is a weak shareable-demo thesis. [First thread](https://news.ycombinator.com/item?id=44658227), [second thread](https://news.ycombinator.com/item?id=46996347).

## 3. Fifteen generated ideas, each subjected to the brief

**I:** “Keep” below means worth a bounded contribution experiment, not that every criterion is already proven. “Pain” references the primary evidence above; a documented limitation is weaker demand evidence than users asking for a fix.

### 1. A general delegated-auth broker — reject

- **One sentence / 30-second demo — I:** ask an agent to read a private wiki; sign in once and watch it obtain a scoped token.
- **Closest / gap — F/I:** Auth0 Token Vault, Cloudflare Managed OAuth, and Workers OAuth already cover the main integration. Residue is provider-specific interoperability, not a missing broker.
- **Pain — F:** MCP’s successive authorization revisions and the interoperability investigation above show real compatibility work; no new broker demand was established.
- **Better models — I:** delegation remains necessary, but distribution and upstream provider integrations dominate.
- **Platform — I:** both platforms have direct incentives to bundle this; adopt their libraries.
- **V1 — E:** 2 weeks for one provider adapter, not a universal service.
- **Expert killer / kill test — I/E:** “You rebuilt our sample.” Reject if an existing sample delivers the same flow with no missing policy surface.

### 2. Supported task warrants on Workers and in the browser — KEEP, rank 1

- **One sentence / demo — I:** let a user grant a travel agent authority over one booking, narrow it for a child, and have the site reject a modified or overbroad request at its own Worker.
- **Closest / gap — F/I:** Tenuo already owns the warrants and demo concept; its TypeScript distribution explicitly excludes these runtimes. Build an upstream-compatible edge distribution and adapter, not a new warrant format.
- **Pain — F/I:** an explicit unsupported-runtime boundary plus current agent-hosting infrastructure; no direct count of developers blocked on this port was found.
- **Better models — I:** a more capable agent still needs the user’s authority, and more delegation creates more enforcement points.
- **Platform — I:** platforms could add a port; they are more likely to accept a maintained upstream implementation than another competing authorization system.
- **V1 — E:** 10–15 focused working days for a verifier/adapter, pinned vectors, and one demo; full cloud issuance and federation excluded.
- **Expert killer / kill test — I/E:** “Our beta already works under compatibility flags.” Try that baseline first; stop if it satisfies the same supported contract or maintainers already have an equivalent adapter.

### 3. Another signed-agent identity SDK — reject

- **One sentence / demo — I:** sign a fetch from a Worker; show the receiving site recognize the agent despite a changing IP.
- **Closest / gap — F/I:** Cloudflare’s `web-bot-auth` and Vercel verification already do the interesting part. Local replay-cache adapters are a contribution, not a new identity system.
- **Pain — F:** the 2025 Cloudflare announcement explains brittle IP/user-agent identification; browser-use’s verification issue demonstrates access friction.
- **Better models — I:** operator authenticity becomes more useful; inference quality cannot supply a private key or trust listing.
- **Platform — I:** both already ship it.
- **V1 — E:** a week for an example and DO nonce cache.
- **Expert killer / kill test — I/E:** “This is our npm README.” Reject if the official signer/verifier plus a replay store covers the demo.

### 4. Universal agent payment gateway — reject

- **One sentence / demo — I:** an agent encounters HTTP 402, pays, and receives a useful API result.
- **Closest / gap — F/I:** x402, Stripe MPP, Cloudflare Monetization Gateway, AP2 and existing payment tooling occupy the primitives. Cross-rail refund/delivery semantics remain application work.
- **Pain — F:** AP2’s mandate/receipt design directly addresses authorization and accountability; more than 60 announcement partners is ecosystem interest, not payment demand proof.
- **Better models — I:** capable agents purchase more resources, but payment network integration remains the bottleneck.
- **Platform — I:** strong direct incentives to ship; already doing so.
- **V1 — E:** 2 weeks for a test-mode merchant adapter only.
- **Expert killer / kill test — I/E:** “Use our official middleware.” Reject unless a named merchant workflow cannot be served by an existing SDK.

### 5. Agent-readable website transformer — reject

- **One sentence / demo — I:** a normal site returns clean Markdown, an `llms.txt` index, and NLWeb answers to agents.
- **Closest / gap — F/I:** Cloudflare Markdown/AI Index, NLWeb, and documentation platforms already cover this. Private-cache correctness is useful but not a new transformer.
- **Pain — F:** Cloudflare’s dated scan found only 3.9% negotiated Markdown support in its filtered sample.
- **Better models — I:** explicit content can reduce work, but better extraction makes format-only products less differentiated.
- **Platform — I:** CDN/content platforms already own the easiest deployment.
- **V1 — E:** 1–2 weeks for a framework plugin.
- **Expert killer / kill test — I/E:** “Enable the existing setting.” Reject if a platform toggle or maintained plugin solves the owner’s problem.

### 6. A public MCP host and discovery registry — reject

- **One sentence / demo — I:** deploy a server, publish it, and let a second agent discover and call it.
- **Closest / gap — F/I:** official Registry, Cloudflare hosting, Vercel `mcp-handler`; private catalogs and tool authorization have existing gateway products too.
- **Pain — F:** official registry launch explicitly targets discovery/distribution; this supports the need, not another directory.
- **Better models — I:** more tools increase discovery needs, while better selection weakens static “better descriptions” wrappers.
- **Platform — I:** already bundled; neutral metadata should go upstream.
- **V1 — E:** 2 weeks for an adapter to one existing catalog.
- **Expert killer / kill test — I/E:** “Another list of servers.” Reject without a named missing metadata/ownership flow in the official API.

### 7. Replayable MCP Events storage for intermittent agents — KEEP, rank 3

- **One sentence / demo — I:** stop an agent, accumulate events, reconnect through a different delivery mode, and show both recovered events and an explicit retention gap.
- **Closest / gap — F/I:** Hookdeck, AgentMail polling, Cloudflare’s webhook adapter, and SEP-3415. Residue: a small, self-hosted, common cursor/replay backend implementing the evolving MCP extension across modes.
- **Pain — F:** Cloudflare’s implementation explicitly lacks poll/push/gap; the open proposal still lists official-SDK reference work outstanding.
- **Better models — I:** more autonomous background work increases events; no model can recover data never retained.
- **Platform — I:** likely to implement or adopt; contribute an adapter to the extension ecosystem.
- **V1 — E:** 2–3 weeks for bounded retention, poll, webhook, and an identical event store; defer push if necessary.
- **Expert killer / kill test — I/E:** “This is a queue with an unstable schema.” Stop if existing Hookdeck/Svix integration plus a thin mapping already supplies the target behavior.

### 8. Email inboxes for agents — reject

- **One sentence / demo — I:** create an inbox for an agent, send it an email, stop it, and deliver the message after restart.
- **Closest / gap — F/I:** AgentMail already covers this, including polling and standard mail protocols. Self-hosted SMTP/IMAP is older prior art.
- **Pain — F:** AgentMail documents ordering, retry, and missed-event handling; a shipping feature is not evidence of an absent category.
- **Better models — I:** agents can handle more correspondence, but deliverability and abuse controls remain operational infrastructure.
- **Platform — I:** plausible integration/marketplace territory; a solo developer should avoid becoming a mail operator for a side project.
- **V1 — E:** 2 weeks for one inbox-provider adapter, not credible new deliverability infrastructure.
- **Expert killer / kill test — I/E:** “Use an existing mailbox API.” Reject if the only distinction is the recipient being an agent.

### 9. A legitimate-agent CAPTCHA bypass or special rate-limit lane — reject

- **One sentence / demo — I:** a signed agent gets an authorized route while anonymous automation receives a challenge.
- **Closest / gap — F/I:** Web Bot Auth, Verified Bots, BotID, and Browserbase’s identity integration. The missing decision is site-owner permission; an SDK cannot grant it.
- **Pain — F:** browser-use #356 has 15 historical comments; current hosted browser docs still discuss CAPTCHA handling.
- **Better models — I:** stronger actuation does not eliminate quotas, consent, or resource limits.
- **Platform — I:** enforcement belongs to the WAF/site owner; global admission is not solo-developer scope.
- **V1 — E:** a one-week opt-in route policy sample.
- **Expert killer / kill test — I/E:** “Your valid signature does not mean I want your traffic.” Reject without explicit site-owner enrollment; do not build an evasion product.

### 10. Cross-provider personal activity receipts — reject as a standalone layer

- **One sentence / demo — I:** a user opens “what my agent did,” verifies site-issued records, and sees which grant each action used.
- **Closest / gap — F/I:** Signet’s bilateral receipts, AP2 payment receipts, Pipelock, EMILIA. A consumer-friendly viewer remains possible, but another receipt envelope is duplication.
- **Pain — F/I:** numerous implementations address accountability; no strong end-user demand for one more universal receipt standard was found.
- **Better models — I:** more consequential actions increase the need for records, regardless of model quality.
- **Platform — I:** platforms will show their own histories; a neutral importer could be adopted, but needs cooperating issuers.
- **V1 — E:** 2 weeks for a read-only viewer importing two existing formats, with source/coverage labels.
- **Expert killer / kill test — I/E:** “Your signature proves who asserted the record, not that the work occurred.” Reject if records are merely agent-authored claims without useful counterparty evidence.

### 11. A2A-to-MCP universal bridge — reject

- **One sentence / demo — I:** an A2A task delegates a tool call to an MCP service and returns its artifact.
- **Closest / gap — F/I:** A2A SDKs and agentgateway already serve this ecosystem. A2A task lifecycle and MCP tool semantics are not interchangeable.
- **Pain — F:** A2A’s 2025-04-09 launch identifies cross-vendor collaboration; issue #1893 exposes retry-identity concerns at the seam. [A2A launch](https://developers.googleblog.com/a2a-a-new-era-of-agent-interoperability/), [gateway issue showing existing A2A/MCP infrastructure](https://github.com/agentgateway/agentgateway/issues/3610).
- **Better models — I:** more delegation raises demand, but better models cannot resolve mismatched authorization or cancellation contracts.
- **Platform — I:** gateways and framework owners are natural implementers.
- **V1 — E:** 2–3 weeks for one explicit task/tool mapping.
- **Expert killer / kill test — I/E:** “Your bridge silently changes execution semantics.” Reject a universal claim unless the exact lifecycle/auth mapping is documented and needed by an adopter.

### 12. Another browser automation framework — reject

- **One sentence / demo — I:** an agent navigates a changing website using a mix of code and natural language.
- **Closest / gap — F/I:** Stagehand, browser-use, Browser Run, Browserbase. The Stagehand 3 / Browser Run support boundary is real but belongs to an existing library/transport integration.
- **Pain — F:** explicit current version incompatibility; broad browser friction is well documented.
- **Better models — I:** automation gets stronger, making a new prompt/selector wrapper less durable; permission/session ownership remains.
- **Platform — I:** direct platform and browser-provider scope.
- **V1 — E:** 2–3 weeks for a specific transport spike, not a rival framework.
- **Expert killer / kill test — I/E:** “Our next integration release removes your project.” Reject unless upstream wants the adapter and it supports a named unavailable feature.

### 13. Lighthouse or analytics for agent traffic — reject

- **One sentence / demo — I:** paste a site URL and see why agents cannot discover, authenticate, read, or pay.
- **Closest / gap — F/I:** Cloudflare Agent Readiness, AI Crawl Control, structured errors; MCPJam/Inspector for tool-specific debugging.
- **Pain — F:** Cloudflare’s 2026 scan quantifies poor adoption; this is exactly the market it already targets.
- **Better models — I:** real request tracing remains useful; checklist scoring is easier to generate and already commoditized.
- **Platform — I:** the site edge sees authoritative traffic and owns the relevant controls.
- **V1 — E:** 2 weeks for a framework-specific diagnostic view.
- **Expert killer / kill test — I/E:** “A less complete version of our dashboard.” Reject if it cannot expose application authorization/effect evidence unavailable to the edge.

### 14. Site-owned effect reconciliation on Workers — KEEP, rank 2

- **One sentence / demo — I:** kill the executor after a remote action commits; recover one result when the target supports it, and show an explicit unresolved outcome when it does not.
- **Closest / gap — F/I:** `effect-broker`, Agent Middleware, LGO idempotency, Hono middleware, and workflow engines. The gap is a small Workers-native implementation of the known contract, with useful provider adapters—not invention of idempotency.
- **Pain — F:** MCP #3394 plus direct existing reconciliation implementations; Resend shipped email idempotency on **2025-05-01** and documents a **24-hour** horizon. [Resend semantics](https://resend.com/changelog/idempotency-keys).
- **Better models — I:** models cannot observe an unacknowledged remote commit by reasoning harder; more actions increase exposure.
- **Platform — I:** platforms own durable infrastructure, but provider-specific reconciliation is a long tail they can adopt as OSS.
- **V1 — E:** 2–3 weeks for DO state, one idempotent provider fixture, one authoritative-lookup fixture, one unsafe fixture, and MCP/HTTP adapters.
- **Expert killer / kill test — I/E:** “You ported an existing demo and called it a product.” Continue only if a real Worker integration gets a smaller usable dependency and an upstream project wants it.

### 15. One action exposed through REST, MCP, and WebMCP — reject the broad generator

- **One sentence / demo — I:** the human form, browser agent, and remote agent invoke one application operation with the same authorization and operation identity.
- **Closest / gap — F/I:** MCP-B and Cloudflare’s WebMCP adapter already bridge tools; framework action generators exist. Preserving business semantics is useful but belongs in the execution function.
- **Pain — F/I:** new surfaces clearly exist; no measured widespread dual-interface drift was established here.
- **Better models — I:** more interfaces increase the maintenance surface, while model-written glue gets cheaper.
- **Platform — I:** framework and SDK owners are natural implementers/adopters.
- **V1 — E:** 2 weeks for one framework example on top of idea 2 or 14.
- **Expert killer / kill test — I/E:** “This is three adapters calling the same function.” Reject a new standard or generic product; retain it as the demo’s implementation pattern.

## 4. The three small artifacts worth making concrete

### A. Tenuo edge adapter: grant authority where the site actually executes

**I — Beneficiary:** a developer with an existing Workers-hosted tool or site action who wants an explicit user-to-agent-to-child grant checked at the origin, alongside normal account authorization. Vercel Node functions can already use Node-oriented libraries; the distinct missing support is Workers and browser packaging, with Vercel as a convenient issuer/demo host.

**F/I — Why this is a verified but modest gap:** the upstream runtime exclusion is explicit, and the core already uses Wasm. That makes an adapter plausible and removes any novelty claim about the underlying authorization. There is no evidence here that hundreds of users are blocked, or that compatibility-mode execution cannot already work.

**I — Smallest useful OSS artifact:** a proposed upstream `edge` entry point, retaining the same warrant bytes and Rust decisions; explicit per-request sessions instead of ambient authority; Worker module loading for the Wasm artifact; a Hono middleware/example; and a minimal browser verifier. Reuse the upstream decision/evidence formats. Do not translate arbitrary OAuth scopes into purportedly equivalent warrants. Do not weaken an upstream constraint because it is inconvenient on the edge.

**E — Two-to-three-week implementation boundary:**

1. **Days 1–2:** try the existing package with Workers compatibility enabled; inspect the supported build pipeline and licensing. If it already provides equivalent behavior, contribute support documentation/tests instead of a port.
2. **Days 3–6:** qualify the portable core, key input, time input, and canonical encoding; retain upstream positive and negative vectors. Keep issuance on Node initially if browser issuance expands the scope.
3. **Days 7–10:** implement a request-scoped Worker verifier and origin action adapter. Keep account authorization separate from task authority. Use one authoritative store for any single-use approvals the demo consumes.
4. **Days 11–15:** show the browser/Node/Worker agreement, expiry, wrong audience/holder, argument widening, and revoked-root behavior supported by the chosen upstream profile. Document exact limits; do not advertise offline verification as instant global revocation.

**E/I — Thirty-second demo:** a customer grants an assistant permission to reschedule *this meeting*. The assistant hands a narrower grant to a calendar child. One permitted move succeeds at the Worker. A request for another meeting, another principal, or wider authority is denied before execution. The user inspects a site-issued record linking the accepted action to the presented grant. Keep the model optional: scripted requests demonstrate the infrastructure directly.

**I — Why better models increase relevance:** the adapter operates between independently owned systems. A perfect model cannot create the customer’s grant, override another site’s authorization, or make delegated authority self-enforcing. More useful agent delegation creates more places that need the same small verifier.

**I — Platform adoption:** Cloudflare could ship an example quickly. Its incentive is compatible authorization for Workers customers, so the credible positioning is “supported upstream core on Workers,” not “Cloudflare will never build this.” Vercel can use the upstream Node path; shared examples make this a cross-platform artifact without pretending its existing runtime has the same hole.

**I — Expert reply that kills it:** “There is no adopter; this is just a packaging exercise for someone else’s library, and our next beta already fixes it.” That is a valid objection. The app integration—not Wasm packaging—must earn the project.

**E — Kill test:** within two days, establish one reproducible unsupported path and a concrete site action that needs it. Within two weeks, preserve all applicable upstream vectors, show the same request decisions on Node and workerd, and have a patch suitable for upstream review. If the port needs a forked authorization language, if no actual application benefits, or if the same supported result is one compatibility flag away, stop the standalone project.

### B. Workers effect adapter: preserve the difference between failure and unknown

**I — Beneficiary:** a Worker/MCP author sending notifications, creating tickets, or invoking another nontransactional API on a user’s behalf. Their problem is not poor planning; it is “did the call happen before the connection died?”

**I — Smallest useful artifact:** a TypeScript implementation of the existing effect-broker state model backed by a DO, with adapters expressing three target contracts: stable downstream idempotency; authoritative reconciliation; or no safe recovery. Local atomic mutation is a fourth case only when the operation and journal actually share a transaction. Reuse existing schemas/terms where practical. This should be a contribution or port, not a new generic gateway brand.

**I — Necessary semantics:**

- Bind a client-preserved occurrence ID to authenticated principal, target, operation, and canonical argument digest. Same key with changed arguments is a conflict. Identical arguments with a new occurrence may be a deliberate second action.
- Preserve a single downstream key across retries; record its actual retention horizon. A DO’s local consistency does not extend the provider’s horizon.
- Represent `unknown` after possible dispatch; a stale lease or cache expiration does not prove the effect failed. Do not redispatch an unsafe target just because ownership changed.
- A read showing “not found” is conclusive only under an adapter’s documented settlement/visibility contract. Otherwise remain unknown.
- Do not hold a SQL transaction across a network call and call it atomic. A receipt is evidence from its signer; it is not proof of an unobserved external effect.
- Expose an authenticated status/receipt URL so an agent can recover without asking the model to guess. Redact payloads in the user history.

**E — Thirty-second demo:** three columns represent provider contracts. Disconnect immediately after target commit. The idempotent and reconcilable columns recover the original outcome. The unsupported column stays amber: “may have happened; not sent again.” Show the target’s independent ledger, not just the broker’s counter. Retry from another MCP session and show the same logical operation record.

**E — Two-to-three-week V1:** deterministic target fixtures and operation schema first; DO state transitions and crash fencing second; a single real-provider-shaped adapter with documented assumptions third; HTTP/MCP wrappers and a small action-history view last. Live paid APIs are unnecessary for the fixture demo. For Vercel, reuse the pure contract code with a real transactional datastore or point the demo at the Worker; do not use function-local memory as the authority.

**I — Why models and platforms do not erase it:** better models can choose not to retry; they cannot remove the tradeoff between duplicate execution and lost work without target cooperation. Workflow engines and Queues do not automatically make arbitrary external effects atomic. However, `effect-broker` already addresses the semantics, and a platform could ship a reference adapter. Differentiation must be a useful small dependency and maintained target contracts.

**I — Expert killer:** “This is already effect-broker, and a DO port does not create demand.” Correct. **E — Kill test:** reproduce commit-before-receipt failures, concurrent duplicates, stale recovery, changed payloads, and post-horizon retries against authoritative fixtures. Keep the artifact only if a named Worker integration becomes substantially simpler than an existing library/workflow and the port can track upstream semantics. Otherwise contribute one adapter or example and stop.

### C. MCP Events replay backend: intermittent agents should know when history was lost

**I — Beneficiary:** a developer building an MCP server whose clients include hosted webhook consumers and laptop/serverless agents that disconnect. Existing webhook providers are the baseline, not competitors to dismiss.

**I — Smallest useful artifact:** a DO-backed bounded event log plus a protocol adapter for the specific, pinned revision of SEP-3415. Expose poll and webhook delivery over the same stored events. Add push only if it fits. A generic webhook receiver, queue UI, or infinite event archive is outside scope.

**I — Missing integration:** Cloudflare’s current implementation is tied to its notification system and webhook mode; it is not a reusable multi-mode replay backend. AgentMail’s polling is mail-provider-specific. Hookdeck already supplies managed forwarding and delivery, so “receive events while offline” alone is insufficient differentiation.

**E — Thirty-second demo:** a client sleeps while a resource changes five times, then resumes with a stored cursor and sees the retained events once in its local projection. Leave it asleep past retention; the next response explicitly reports lost history. Switch from webhook to poll and demonstrate deduplication using event IDs. Arrival at the inbox is not completion of the agent’s work.

**E — Two-to-three-week V1:** append-only event IDs; principal/event/filter-bound opaque cursors; bounded retention and payload size; loss signaling; signed webhook attempts; poll; TTL-based subscription teardown; an example client that stores cursor/projection consistently. At-least-once delivery is acceptable. Never claim exactly-once downstream processing.

**I — Better models / platforms:** smarter agents perform more background tasks, while missing history remains missing. Cloudflare/Vercel/SDK maintainers have an obvious incentive to implement this; upstream adoption is the expected win. A new subscription service is not required.

**I — Expert killer:** “The protocol is changing, and our queue integration already has cursors.” **E — Kill test:** first compare the maintained Hookdeck/Svix and official extension paths. Stop if the only missing code is a small schema mapping. Otherwise require resume, principal isolation, expiry, truncation, duplicate callback, and mode-switch cases on local workerd. If no client can use the extra delivery mode yet, publish a reference adapter rather than a product claim.

## 5. Boundaries that prevent attractive but false demos

**I:** These projects address different facts, which should stay separate in the demo and API:

1. **Operator identity:** who signed this request?
2. **User delegation:** which principal authorized the agent, under which limits?
3. **Application permission:** does this account have access to the target resource now?
4. **Occurrence identity:** is this a retry of one intended operation or another intended operation?
5. **Effect outcome:** did the authoritative target commit it, fail it, or leave an uncertain result?
6. **Evidence and coverage:** who recorded the claim, and which traffic/actions were actually observed?

**I:** A signature alone answers neither intent nor outcome. An OAuth token does not prove a specific action was approved. A model’s “done” message is not a target receipt. A signed receipt cannot prove completeness of all actions. A Durable Object can serialize its own decisions but cannot undo or atomically include an unrelated remote service.

**I:** These are why the needs survive better models. They are also why new universal protocols are a poor solo-project starting point: the hard part is agreeing with and integrating the actual counterparties. The useful OSS contribution is an implementation of an existing contract at a currently unsupported boundary.

## Ranked top 3 against the six criteria

**I — Scores are comparative judgments, 1–5; they are not measurements or evidence that every criterion has been satisfied.** Cool includes demo potential, not predicted virality. Gap scores penalize direct prior art; value scores penalize the absence of identified adopters. All three are side projects independent of GrowOS.

| Rank | Artifact | Cool | CF/Vercel adjacent | Verified remaining gap | Concrete value | Survives better models | Not GrowOS | Total / 30 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | Upstream-compatible Tenuo edge adapter + site-owned delegation demo | 3 | 5 | 4 | 3 | 5 | 5 | 25 |
| 2 | Workers implementation/adapters for existing effect-reconciliation semantics | 4 | 5 | 2 | 4 | 5 | 5 | 25 |
| 3 | Bounded MCP Events replay backend shared by poll/webhook delivery | 3 | 5 | 3 | 3 | 5 | 5 | 24 |

**I:** Rank 1 wins the tie because its unsupported-runtime gap is explicit. Rank 2 has the clearest failure demo and user harm, but essentially the same product already exists in Python. Rank 3 has a timely protocol gap but high risk of rapid upstream absorption. **No candidate earns an unconditional six-criteria pass today.**

## The ONE pick

**I — Build the supported edge path for Tenuo, preferably upstream, and make one real site enforce a customer’s narrowed delegation.** The artifact is a Worker/browser package entry point plus a small origin adapter, not a new identity service, security framework, or OAuth replacement. Start by trying the existing package under compatibility flags; a successful baseline changes the deliverable to upstream support/tests, not a new runtime.

**E/I:** Spend two days checking the gap and selecting the concrete application, then at most two additional weeks producing a reviewable adapter and demo. If that fails the adopter or equivalence test, reject it. The runner-up is an upstream-oriented Workers port of effect-broker, with its existing uncertainty semantics preserved. This lens does not justify launching another universal agent-infrastructure platform.

## Five-line TL;DR

1. **F:** Cloudflare/Vercel, identity vendors, payment providers, and OSS already cover most broad “web for agents” categories.
2. **F:** Warrants, signed action receipts, idempotency, honest uncertain-effect recovery, agent inboxes, and readiness scanners all have direct prior art.
3. **I:** Better models increase the need for delegated authority and authoritative outcomes; they do not create authority or reveal an unobserved remote commit.
4. **I:** Best small OSS bet: Tenuo’s explicitly unsupported Workers/browser path, shipped as an upstream-compatible adapter and a site-owned delegation demo.
5. **I/E:** No unconditional greenfield winner; validate a concrete adopter and the compatibility baseline in two days, then ship or kill a tightly bounded contribution.

## Rejected ideas — one line each

- General delegated-auth broker: Auth0, Workers OAuth, and Managed OAuth already cover the core and own integrations.
- New signed-agent identity SDK: Web Bot Auth already has official TypeScript code and both platforms’ support.
- Universal agent payment gateway: x402, AP2, MPP, and payment-platform distribution dominate.
- Markdown/llms.txt/NLWeb transformer: existing CDN, documentation, and search products already supply it.
- Generic MCP hosting or public registry: platform hosting and the official Registry already exist.
- New agent email provider: AgentMail and standard mail infrastructure already cover the primitive; deliverability is operational work.
- CAPTCHA bypass or universal legitimate-agent lane: site-owner authorization and platform trust cannot be supplied by a third-party SDK.
- New universal consent/receipt envelope: Signet, AP2, Pipelock, Agent Middleware, and EMILIA already occupy the design space.
- Universal A2A/MCP bridge: existing gateways plus unresolved semantic mappings make it a weak independent project.
- New browser automation framework: Stagehand, browser-use, Browser Run, and Browserbase are substantial baselines.
- Generic agent-readiness scanner or analytics: Cloudflare already ships the score, traffic controls, and structured errors.
- One-action/three-interface generator: retain as an example calling one execution function, not another standard.
- Generic DO idempotency service: LGO and existing middleware already implement it; local serialization does not establish remote exactly-once effects.
- Universal effect broker: effect-broker already ships the honest unknown/reconciliation model; only a useful runtime port remains.
- Origin work scheduling, agent resource GC, and generic verification: excluded by the brief’s earlier findings; not repackaged here.
