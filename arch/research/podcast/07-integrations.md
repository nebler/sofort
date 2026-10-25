# 07 - Integrations, tool catalogs and credentials

Podcast: Next Token Ep 07. The transcript timestamps are [hh:mm], so "27:00" in the brief is [00:27] in the file. Fern refs are to `docs/architecture.md` (sections marked §).

Source quality: Executor's GitHub page (fetched) is first-party. Gateway comparisons are mostly vendor-sponsored. I could not fetch Cloudflare's `cloudflare/mcp` README, so its details come from third-party write-ups and the podcast itself. I did not read any source code, only READMEs and docs.

## 1. Search + execute over a spec (Cloudflare MCP) - [00:27]-[00:30]

**Idea.** Two code-driven tools, `search` and `execute`. The OpenAPI spec is loaded into a REPL, the model writes JS to filter it, and `execute` is an authenticated fetch. About 2,500 endpoints fit in ~1,000 tokens. The spec is reloaded daily, so there is no second source of truth. Matt: "I'm not touching" a tool-search index.

**What exists.**
- Cloudflare's hosted MCP server uses OAuth 2.1 scoped by the user's approval, or an API token [(MintMCP)](https://docs.mintmcp.com/docs/cloudflare-mcp-setup), [(Scalekit)](https://www.scalekit.com/blog/cloudflare-mcp-vs-api).
- Stainless generates "code tool" MCP servers, but its docs call this experimental [(Stainless)](https://www.stainless.com/docs/mcp/index.md). Speakeasy has a dynamic mode with meta-tools [(Zuplo)](https://zuplo.com/blog/mcp-server-generators-compared).
- FastMCP `from_openapi` maps each route to a tool, resource or template, so 1:1 [(FastMCP)](https://gofastmcp.com/patterns/openapi).
- The podcast says all major harnesses now ship some form of code mode. Claude Code's is still flagged (inference: unverified, the speakers hedged).
- Inference: this is a design pattern, not a product. The ~1,000-token figure is Cloudflare's own claim.

**Fern fit.** An env-scoped MCP server beside the existing agent tools (`env_snapshot`, `env_exec`, ...; §3 and §13, "agents via MCP get a token scoped to their own environment"). Add `catalog_search` and `catalog_execute`. `execute` runs in the daemon, never in the box, so credentials stay host-side (§13 "Non-model secrets").

**Verdict: ADOPT the pattern, ADOPT Executor as the engine (see 2).** Do not write our own indexer. Effort: 3-5 days to wire.

**Model trend: grows.** Search-by-code relies on the model reading a big schema, which gets better with capability.

**Signal:** Twitter 3, CV 2.

## 2. Per-environment tool catalog behind one MCP - [00:38]-[00:39] (CF portal), [00:46]-[00:47]

**Idea.** One MCP hides many (CF portal, internally "code mode over code mode"). The hard part is getting tools into this format, so the model should write the wrapper for the long tail.

**What exists.**
- **Executor** (Rhys): MIT, ~4.3k stars, 2,964 commits, ~47 open issues [(GitHub)](https://github.com/RhysSullivan/executor). Sources are OpenAPI, GraphQL, MCP and Google Discovery. The model is integration, then connection, then policy (allow, gate for approval, or block). Hosts: CLI daemon, Docker, Cloudflare Worker and Cloud. Runtimes: QuickJS, Deno subprocess, Dynamic Worker. It has keychain, file and 1Password secret plugins, and it exposes `executor mcp`. Unverified: encryption at rest, a real health-check story, and whether multi-account is first-class (the README only says an integration can have many connections).
- **Gateways:** Docker MCP Gateway (container-isolated, best local story but tied to Docker Desktop), Composio (managed OAuth), Arcade (multi-user auth), Smithery, MetaMCP [(comparison, vendor-skewed)](https://manveerc.substack.com/p/best-mcp-gateways). I found no neutral comparison of credential models. Most are SaaS and hold the user's tokens, which conflicts with Fern's "self-hosted, nothing proxied" stance.
- Note: Executor's TS/Bun stack is not Go.

**Fern fit.** One catalog per environment class, copy-on-write like everything else. Fern's differentiator is that the catalog (sources, connections, saved wrappers) is in the env's btrfs state or the daemon store, so `env_fork` forks it and `env_restore` rewinds it. Credentials are NOT in `live/` (§13), so catalog entries hold references and the daemon injects secrets at call time. Run Executor as a sidecar in the Sandbox or as one daemon-side process per node, and expose it over MCP to boxes through the front door (§11).

**Verdict: ADOPT Executor, as a daemon-side sidecar, behind a thin Go adapter that does the token scoping. BUILD only the Fern glue** (catalog snapshot/fork semantics, per-env token). Do not build a gateway. Effort: 1-2 weeks including a spike to check Executor's policy/secrets model and whether a Go process can drive it. If the spike fails, fall back to a ~1-week Go `search`/`execute` over OpenAPI with the QuickJS runtime (wazero or goja, inference).

**Model trend: grows.** More agents means more catalog calls and more credential surface, and the policy layer becomes the bottleneck.

**Signal:** Twitter 4 ("fork the agent, fork its tool catalog"), CV 3.

## 3. Multi-account credentials and health checks - [00:47]

**Idea.** Bash has no concept of multiple accounts or health checks. The catalog should treat a connection as a first-class thing: `vercel@personal` and `vercel@work`, with a "are all my accounts alive" probe.

**What exists.**
- **octo-sts** (Chainguard): a GitHub App that exchanges a workload's OIDC token for a 1-hour GitHub token, using trust policies stored in the target repo at `.github/chainguard/<name>.sts.yaml`. It is Go, with v0.8.0 released July 2026 [(docs)](https://edu.chainguard.dev/open-source/octo-sts/overview/), [(pkg.go.dev)](https://pkg.go.dev/github.com/octo-sts/app@v0.8.0). I did not verify how it is deployed or run; it appears to be built for hosted use (inference).
- **Egress credential injection:** the sandbox sends unauthenticated requests and a proxy outside it adds the real header. Blaxel, Freestyle and Onyx's reference design do this [(Blaxel)](https://blaxel.ai/blog/egress-proxy-api-credentials-ai-agent-sandboxes). It is a pattern, not a standard, and it does not stop exfiltration to an allowed host.
- Nothing I found does multi-account health checks for CLIs. This is a real gap.

**Fern fit.**
- The identity component (§3 "identity", §13) already forks into fresh credentials. The GitHub App broker is "per-environment OIDC tokens later".
- **Per-env OIDC** (daemon-signed, `sub = env/<id>`) maps directly onto octo-sts's trust-policy model. Use the model; self-host octo-sts only if the repo-based policy files are wanted.
- The box already has network rules (§13 "Network"). The planned per-class allowlists plus an egress injector in the daemon let a box call `api.vercel.com` with no token in its environment. That is stronger than the current env-var injection of agent logins.
- Health checks: the daemon pings each connection on wake (§6, `resume` timing) and surfaces results in `env_exec`'s MCP tool and in T3.

**Verdict:**
- GitHub App broker: **KEEP, it is ~200 lines of Go.** ADOPT octo-sts's trust-policy schema when per-env OIDC arrives. SKIP adopting the service itself.
- Egress injection: **BUILD** in Go (a goproxy-style MITM or a header-injecting reverse proxy in front of the box's egress). Effort: ~1-2 weeks, with TLS interception being the hard part. No Go reference was found.
- Health checks: **BUILD**, ~3 days on top of the catalog.

**Model trend: grows.** More agent volume means more accounts, and the blast radius of a leaked token grows with it. Egress injection is the opposite of a crutch.

**Signal:** Twitter 3, CV 5 (distributed-systems credential story, k8s admission, OIDC).

## 4. Services auto-exposed as MCP (`mcp: true`) - [01:21]

**Idea.** A framework flag exposes all of an app's APIs as tools. The speakers expect programmatic tool calling by clients to make a thousand APIs from one app workable.

**What exists.** FastMCP `from_openapi`, Stainless, Speakeasy (above). Nothing is a de facto standard. Executor consumes an OpenAPI source, which is the thing `mcp: true` would produce.

**Fern fit.** `services.yaml` (§8) has `run`, `port`, `ready` and `env`. Add one optional field, `openapi: /openapi.json` or `mcp: true`. The daemon registers `http://localhost:<port>` plus the spec in the env's catalog (Idea 2). The agent running in the box gets its own running dev server as a searchable tool set, with no extra MCP server in the repo.

**Caveat.** A running service does not keep the env awake (§8). The catalog must tolerate a sleeping service and ride the front door's 503-while-waking (§11).

**Verdict: BUILD.** It is a ~2-day registration hook once Idea 2 exists. Only the registration is ours.

**Model trend: grows.** **Signal:** Twitter 4 (an agent that fork-tests its own API through a generated tool), CV 2.

## 5. Model-written wrappers saved into the environment - [00:47]

**Idea.** For the long tail with broken specs and odd auth, let the model write the wrapper and keep it.

**What exists.** Executor plugins are the nearest thing (no evidence of model-authored persistence). Bash-style hot patching is what the speakers want to match.

**Fern fit.** Wrappers are files in the repo (`.fern/catalog/*.ts`) and travel with `live/`, so they snapshot, fork and rewind with the code. That is the strong point. Danger: a wrapper is code that runs daemon-side with credentials, so it must run in the sandboxed runtime (QuickJS or a box), never in the daemon's process (§13: boxes are untrusted).

**Verdict: BUILD on top of Executor.** Effort: ~1 week, mostly the trust boundary and review gate (Cloudflare OS's deferred approval is a model for this). **Model trend: grows. Signal:** Twitter 4, CV 3.

## 6. Platform restrictions on MCP clients - [01:15]-[01:19]

Figma and Muse limit which clients may connect (CIMD, DCR). That risks lock-out if Fern's catalog is a "client" the platform has not approved.

**Fern fit.** For a self-hosted tool a personal OAuth token is usually allowed, but vendor-restricted servers may not be. This favors direct API access (Idea 1) over MCP-only. **Verdict: SKIP**, but track it. **Model trend: neutral.**

## Top 3 recommendations

1. **Adopt Executor as the per-env catalog and `search`/`execute` engine** (2 weeks, spike first). It gives the Twitter demo "fork the env, fork its tool catalog".
2. **Build egress credential injection plus per-env OIDC** in the daemon (identity + network, §3, §13). Best CV value, and it makes the zero-secrets-in-box claim true for non-model secrets.
3. **Build `services.yaml` `mcp:` registration** (2 days) on top of 1.

## Open risks

- Executor is TypeScript/Bun with ~46 open PRs, and I could not confirm its secrets encryption, multi-account model or health checks. The spike must test them before any commitment.
- Fern would be running a second runtime (Bun/QuickJS) beside Go. This adds moving parts and cuts against the Go-first CV goal, so measure it.
- TLS interception in a gVisor box needs a CA injected into every image and breaks pinned clients.
- Daemon-side `execute` is a confused-deputy risk: a model-written wrapper could use a credential it should not. Per-tool policy and scoping must be enforced by the daemon, not by the wrapper.
- Cloudflare's claims (1,000 tokens, 2,500 endpoints) are from the vendor and weren't checked. Cloudflare OS Gatekeepers were not re-read for this report.
