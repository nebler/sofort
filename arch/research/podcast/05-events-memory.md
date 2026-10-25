# 05 – Event-driven agents and reusable scripts as memory

Fact vs inference is marked. Fern refs are to `docs/architecture.md`.

## Idea 1: Front door as an event-to-agent trigger (podcast 50:30, 54:00, 68:00)

**Idea.** Services call back into the harness. The speakers say ChatGPT is the first big client with MCP events, and a Discord bot can be built from events and webhooks with no loop.

**What exists.**
- **MCP Events** is a draft, not spec.
  - The Triggers and Events working group charter lists the v1 RFC as "Ideating", with no champion ([charter](https://modelcontextprotocol.io/community/triggers-events/charter)).
  - The proposal is SEP-3415. A client calls `events/subscribe` with an event name, filter arguments, a delivery object (callback URL and signing secret) and an optional cursor.
  - The draft defines webhook, poll and push-stream delivery. Payloads are capped at 256 KiB.
  - ChatGPT supports webhook mode only, on MCP protocol `2026-07-28`. It has no poll, no stream, and no terminated or gap notices ([WorkOS](https://workos.com/blog/mcp-events-chatgpt-subscription-revocation), [Hookdeck](https://hookdeck.com/webhooks/guides/add-mcp-events-to-mcp-server)).
  - I found no evidence that Claude Code supports it (the podcast says so too, at 54:00).
  - Inference: the spec will move, so it is a bad thing to couple to today.
- **GitHub Agentic Workflows** (gh-aw) are Markdown workflows compiled to Actions. They are in technical or public preview. Triggers include issues, PRs, `issue_comment`, `workflow_run`, schedules and slash commands ([changelog](https://github.blog/changelog/2026-02-13-github-agentic-workflows-are-now-in-technical-preview/), [triggers](https://github.github.com/gh-aw/reference/triggers)). The agent runs in an ephemeral Actions runner.
- **Claude Code Routines** launched 2026-04-14 as a research preview. They fire on a schedule, an API call, or GitHub events, and run on Anthropic's cloud ([summary](https://codex.danielvaughan.com/2026/04/14/claude-code-routines-launch/), third-party).
- **Codex "Triggers"** are described by one blog as GitHub events run through `codex-action`. This is unverified against OpenAI docs ([blog](https://codex.danielvaughan.com/2026/04/01/codex-cli-triggers-event-driven-github-automation/)).
- **Inngest** is a durable event-to-function engine. Its AgentKit examples run an agent loop inside an event-triggered function, with a per-session concurrency key and `waitForEvent` ([blog](https://www.inngest.com/blog/ai-agents-inngest-durable-steps)).

**Fern fit.**
- `/hooks/{env}/{token}` (§5, §11) already wakes an environment, coalesces wakes and holds the request for up to `wake_timeout`.
- Today it only delivers the request. What is missing is a **handler binding** per hook, stored in the SQLite data model (§4): `{hook id, source, verifier (HMAC secret), filter, action}`. The action is one of `script <path>`, `turn <prompt template>`, or `drop`.
- The `turn` action is a `claude -p` or `codex exec` run. That is an exec, so the idle rule (§6.3) and the per-turn snapshot (§7.2) apply unchanged.
- A webhook-triggered turn is the "automated turn" that §13.1 flags as risky for subscription terms. Per-subscription rate caps and opt-in are needed.
- A hook should be able to **steer a running thread** (inject a message into the T3 session), not only start a new one. That avoids a second box on the same PR.
- Keep hooks plain HTTP with HMAC. Add an MCP Events adapter (`events/subscribe` mapped to a hook token) only once the spec has stabilised.

**Verdict.** BUILD the handler binding and verifier in `internal/wake/`, about 1 to 1.5 weeks. Existing tools (gh-aw, Routines) run on someone else's runner without Fern's warm DB-backed env, which is the reason Fern exists here. MCP Events adapter: defer, about 3 days later.

**Model trend.** Grows. Cheaper inference means more events turn into turns, and wake latency and dedup become the bottleneck.

**Signal.** Twitter 4, CV 4 (event routing, coalescing, idempotency, HMAC verification).

## Idea 2: Handle cheap events without waking a box (55:30)

**Idea.** Email goes to a classifier that deletes spam: "you don't have to spin up a full VM".

**What exists.** Kody runs scheduled jobs and webhooks as saved package code with no model, "spends no tokens" (self-reported, [Kody post](https://kentcdodds.com/blog/introducing-kody-your-personal-software-factory)). Cloudflare Agents wake a Durable Object from an alarm. The runtime is cheap, but it has no filesystem or Postgres ([schedule docs](https://developers.cloudflare.com/agents/api-reference/schedule-tasks)).

**Fern fit.**
- Put a **tier-0 triage step** in the front door before the actor wakes a box. It runs in the daemon process: signature check, dedup by delivery ID, drop by filter (for example `check_run` with a success conclusion, bot comments, branches that are not ours), and coalescing of bursts (many CI events per push become one).
- Tier 1: a pure-Go rule or small-model classify that writes a row to SQLite (§4) and surfaces a notification to T3 without waking. Only "act" outcomes wake the env.
- **Cheap, no box:** CI success, label changes, review-requested noise, bot comments, repeated Sentry events for a known issue (count only), CVE alerts for packages the repo does not use (lockfile lookup on the **golden snapshot**, readable without a mount via the read-only subvolume).
- **Needs a box:** anything that edits code or runs tests.
- jitk would plug in here later as the sub-millisecond tier-1 runtime for user-written triage scripts (one line, not researched).

**Verdict.** BUILD the tier-0 and rule tier, about 1 week (shares work with Idea 1). Tier 1 with a model: later, and it needs a subscription-free classifier, because API keys are out (§13.1). That is a real constraint to resolve first.

**Model trend.** Grows. Volume rises, and the filter is what protects subscription caps and wake cost.

**Signal.** Twitter 3, CV 4.

## Idea 3: Script library as memory (50:00)

**Idea.** The agent writes reusable scripts and imports them into code mode later, as a form of memory.

**What exists.**
- **Kody** is Kent C. Dodds' product, running on Cloudflare Workers. Source is under the Functional Source License (converts to Apache 2.0 after two years). Agents promote working code into a "durable Kody-hosted repository and package", each package with its own SQLite DB. Packages can include scheduled jobs and webhooks, and can be forked and published. Kent pitches them as replacing SKILL.md ([post](https://kentcdodds.com/blog/introducing-kody-your-personal-software-factory), [listing](https://www.everydev.ai/tools/kody)). All claims are self-reported, with no independent review found. The post does not explain the memory model or scheduler.
- **Skills** (SKILL.md) are the baseline, already supported by Claude Code and Codex.

**Fern fit.**
- **Where it lives:** `.agents/scripts/` in the repo (reviewable, versioned), plus a per-user dir in `envs/<id>/claude/` for personal scripts. Per-user scripts survive restore, because that folder is outside `live/` (§10).
- **Promotion:** a script that was used successfully in N turns, or that a human marks, is committed to the repo or copied to a per-repo library dir. The **golden build** (§7.5) then bakes it in on the next key change, so new envs and forks start with the library already present. Because golden build step 2 strips credentials, scripts must take secrets from env vars and never embed them.
- **Exposure:** an `env_run_script(name, args)` MCP tool beside `env_exec`, and an index file that is the only thing loaded into context.
- Fern adds three things a hosted store does not: scripts run next to the real Postgres and code, they are versioned with the snapshot (restore rewinds a bad script), and they work offline.
- Risk: the library rots as the code changes. Mitigate by re-running each script's `--selftest` in the golden build.

**Verdict.** BUILD, thin. It is a convention plus one MCP tool, about 3 to 5 days. Do not adopt Kody (a Workers-hosted service, FSL licence, not in the box). Borrow its idea: packages carry their own schedule and webhook declarations (see Idea 4).

**Model trend.** Grows. Better models write better scripts, and cheaper tokens mean more are written. A script run costs no tokens, so the saving per reuse grows with model price. It is not a crutch for weak models.

**Signal.** Twitter 3, CV 2.

## Idea 4: Scheduling (cron-like wakes)

**What exists.** Cloudflare Agents SDK supports delayed, date, cron (1-minute floor) and interval schedules on Durable Object alarms, persisted in SQLite, idempotent by callback and payload, and the interval skips on overlap ([docs](https://developers.cloudflare.com/agents/api-reference/schedule-tasks)). Plain timers are lost on hibernation, which is exactly Fern's sleeping-env problem. Routines and gh-aw both offer cron too.

**Fern fit.**
- A `schedules` table in the daemon SQLite (§4): `{env, cron, action, idempotency key, last_run}`. A daemon-level ticker (not inside the sleeping box) wakes through the same front-door path as a hook, so coalescing and the idle rule apply.
- Copy the SDK's semantics: idempotent registration, skip on overlap, persisted across restart.
- Scripts can declare their schedule in a header, so the library (Idea 3) and the scheduler share one mechanism.

**Verdict.** BUILD, about 3 to 4 days once Idea 1 exists. Exact schedules and rate caps matter more than the cron parser.

**Model trend.** Grows. **Signal.** Twitter 2, CV 3.

## Which events matter for coding agents

| Event | Source | Tier | Action |
|---|---|---|---|
| CI failure on our branch | GitHub `check_run`/`workflow_run` | wake | turn: fetch logs, fix, push |
| PR review comment | `pull_request_review_comment` | wake (steer running thread if any) | turn |
| Sentry alert | Sentry webhook | tier 1 then wake | dedupe by issue, turn with stack trace |
| Dependency CVE | Dependabot/GHSA | tier 0 (lockfile check) | script, wake only if affected |

CI failure and review comment are the strongest demo: push, close the laptop, come back to a fixed PR. Always need loop guards (ignore our own pushes and comments).

## Top 3, ranked

1. **Hook handler bindings plus CI-failure and review-comment actions** (Idea 1 and the table). Highest signal, builds on `/hooks` that already exists.
2. **Tier-0 triage and coalescing** (Idea 2). It is the real distributed-systems content and protects subscription caps.
3. **Script library promoted into golden, plus `env_run_script`** (Idea 3), with scheduling (Idea 4) as a small follow-on.

## Open risks

- MCP Events is an unratified draft, so build to plain webhooks and adapt later.
- Automated turns against personal subscriptions are the weakest point of §13.1. Without API keys, event volume is capped by plan limits, and tier-0 filtering becomes mandatory.
- Prompt injection: PR comments and Sentry payloads are attacker-controlled text, and the draft itself says "event receipt does not authorize action". Triggered turns need a restricted tool set and no secrets reachable.
- Event loops (agent pushes, which triggers CI, which triggers the agent) need hard caps.
- Kody and Codex Triggers claims come from vendor or third-party blogs and are unverified.
- The classifier cannot use API keys, so tier 1 may have to be rules only at first.
