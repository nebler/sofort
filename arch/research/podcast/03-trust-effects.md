# 03 - Trust, approvals and side effects

Transcript times are minutes from the start (the file's `[00:17]` is 17:30). Facts come from source or cited pages. Inference is marked **(inf)**.

## What Cloudflare OS actually does (read from source)

- **Flow.** A gatekeeper stages an action in a durable `ActionJournal` and calls `queue.submitAction(id, description)` (`packages/gatekeeper-kit/src/actions.ts`). Nothing runs until the user approves. Then the overseer calls `applyAction`. The kit applies at-least-once, and the action ID is stable so it can seed provider idempotency keys. A `claimBeforeApply` option writes a durable claim before the irreversible call. A crash after the claim becomes a terminal `ActionOutcomeUnknownError` and is never replayed.
- **Delivery modes.** Each action kind declares `delivery: "continue-with-simulation" | "await-decision"`. With simulation, later reads are overlaid with the pending actions, so the agent sees a consistent world and the user approves a batch at the end (`plans/gmail-simulation.md`; helpers in `simulation.ts`). The overlay rules are that it only changes or hides provider data, never invents it, and it renders the pending message with the same code `apply` uses. `await-decision` stops the agent. It is kept for things that cannot be simulated, such as paid lookups, opaque MCP calls and arbitrary SQL.
- **Dependencies.** `provides` / `dependsOn` track provisional IDs. If an action that was to create an ID is rejected, its dependents are retired.
- **Fences.** Each action is pinned to a connection generation. Re-authorizing the account invalidates the pending queue.
- **Other fields.** `autoApprovable` per kind, and `implementsRevert` (optional).
- **`plans/step-transactionality.md` is not about external effects.** It makes the agent's code and chat edits durable if and only if the step's transcript record is durable. Edits are buffered in memory and written in one `transactionSync()` at the step barrier. It is a crash-consistency fix, so do not cite it as cross-service transactionality.
- **What Cloudflare OS does not have.** It has no rollback of internal state coupled to the effect queue, and no atomic cross-service commit. Approve and reject are per action. The partial-failure story is "terminal failure, user rejects or retries, outcome-unknown stays visible".

## Idea 1 - Credentials off the box: egress broker (0:17, "outbound proxying")

- **Exists.**
  - Vercel Sandbox firewall `transform` rules inject headers per domain, path and method. They use a per-sandbox CA and overwrite agent-set headers. Available on Hobby ([docs](https://vercel.com/docs/sandbox/concepts/firewall), [changelog](https://vercel.com/changelog/safely-inject-credentials-in-http-headers-with-vercel-sandbox)).
  - Cloudflare Outbound Workers ([blog](https://blog.cloudflare.com/sandbox-auth/)).
  - Blaxel ([blog](https://blaxel.ai/blog/egress-proxy-api-credentials-ai-agent-sandboxes)).
  - agentgateway's decision/delivery split ([post](https://agentgateway.dev/blog/2026-07-27-credential-injection-ai-agent-egress-cb4a/)).
  - Most sources are vendor blogs. The pattern is consistent across them but not a standard.
- **Fern fit.**
  - §13 already has "host-side broker for short-lived, scoped tokens" and per-class network allowlists marked planned.
  - Add a Go egress proxy beside the daemon. The box NetworkPolicy forces non-model egress through it. The proxy injects the GitHub App token (from `identity`) and other tokens per `(env, host, path)`.
  - Each environment gets a per-env CA, created by the identity hook on fork and restore (so forks never share one).
- **Subscription constraint (§13.1).** The proxy must pass through Anthropic and OpenAI hosts without interception, with no `ANTHROPIC_BASE_URL` change and no header rewriting. Scope the rules to an allowlist of non-model hosts. If we MITM model traffic it breaks the "never proxies" promise.
- **Verdict: BUILD**, 1-2 weeks, borrowing the Vercel rule shape. Nothing existing runs on k3s/gVisor next to Fern's identity component. Reuse `goproxy`-style libraries rather than writing TLS code.
- **Model trend:** grows (more agents means more credentials to keep off boxes).
- **Signal:** Twitter 2, CV 4.

## Idea 2 - Transactional turns (deferred batch approval, 0:34 and 0:43)

**Fern's version.** A turn runs against a real fork: files, running Postgres and processes. External effects go to Fern-owned gatekeepers and return simulated success. At turn end the human sees one diff plus one effect list.
- Commit promotes the fork (head and snapshot advance) and applies the effects.
- Abort restores the pre-turn snapshot and drops the effects.
- The approval can arrive days later (0:43, Executor's pause/resume use case). The fork just sits asleep, which costs btrfs blocks only.

**Fit with Fern concepts.**
- **Fork as a pending transaction (§2, §7.4).** Internal state needs no overlay: the real DB is the simulation. This is the real gain over Cloudflare OS, whose simulation is a hand-written overlay per provider (705 lines for Gmail alone).
- **Pending effect ID.** Use `(env, snapshot-id, seq)`, i.e. the §2.1 snapshot ID plus a sequence. That is the §2.1 idempotency-key pattern (`t3:checkpoint:7f3a`), now also passed upstream as the provider idempotency key, as in Cloudflare OS's stable action ID. Queue rows go in the §4 SQLite as `effects(env, snapshot, seq, kind, payload, state)`, with the same state set as Cloudflare OS: staged, submitted, applied, rejected, failed, outcome-unknown.
- **Fencing.** §4 `generation` already bumps on every restore/fork and cancels in-flight execs (§12). Extend it so a bump invalidates queued effects from the old generation. This maps onto Cloudflare OS's connection-generation fence, and it is nearly free.
- **Operations.** Commit and abort become actor operations in the mailbox (one at a time), with `Idempotency-Key` as §5 plans. Reconcile (§3, §12) gets one more state to finish or clear on start: "effects journal says applying".
- **Agent surface.** `env_commit` / `env_abort` MCP tools, and T3 Revert maps to abort.

**Where it is hard (inf).**
- Fern boxes run unmodified processes (`git`, `curl`, `psql`), not RPC capabilities. A generic HTTP egress proxy cannot fake a Slack or GitHub response, because it would have to know each API's semantics. So simulation only works where Fern owns the interface:
  - **Git.** The box's `origin` is a Fern-hosted bare repo. A push lands there, which is a perfect simulation, and the real push happens on approval. Cheap and robust.
  - **Slack, email, PRs, issues.** Shim CLIs or MCP tools served by Fern that write to the queue. Read-back overlay is only needed for objects the agent just created.
  - **Everything else.** Unknown egress is deny-by-default or `await-decision`.
- Read-after-write overlays are per-provider work. Start with GitHub (push, PR open/comment) and one chat or email provider.
- The user's DB side effects that call out (webhooks from the app under test) are covered by the egress deny, not by simulation.

**Partial commit across services.**
- No cross-service atomicity exists, and we should say so.
- Order: apply effects first, in `seq` order. Put irreversible ones last, and honour `dependsOn` (a PR needs its pushed branch). Only then promote the fork. Promotion is local and idempotent, so Reconcile can always finish it.
- Use `claimBeforeApply` semantics: claim, call with the idempotency key, mark. A crash between call and mark becomes outcome-unknown, which is shown and never auto-retried.
- If effect k fails, stop the rest. Offer three choices: keep the fork unpromoted and retry; promote anyway with a visible "partial" record; or abort and run compensations. Compensation is real only where the service has an inverse (delete branch, close PR, delete message). Email send and chat posts have none.
- This is a saga with a mostly-forward-recovery policy. SagaLLM ([arXiv 2503.11951](https://arxiv.org/abs/2503.11951)) uses LLM-generated compensations, which is research-grade and not something to rely on for irreversible effects. Do not claim "rewind undoes the world". It undoes the box.

**What is genuinely new versus Cloudflare OS.**
1. One rewind primitive covers state and effects: the btrfs snapshot plus the generation bump, instead of per-service overlays and no internal rollback.
2. Unmodified tools and a real database inside the transaction. Cloudflare OS works because the agent only has gatekeeper RPC (code mode), so everything it touches is mediated.
3. "Commit = promote a fork" gives approval a git-merge shape that T3 users already know (Revert and Fork exist).
4. Weak spot (inf): Cloudflare OS is more rigorous on the effect side (dependsOn, fences, outcome-unknown, 705-line overlay). Fern should copy those semantics, not re-derive them.

**Verdict: BUILD**, narrowly.
- Git remote plus PR queue plus commit/abort: 2-3 weeks.
- A second provider, a read-back overlay and a UI: another 2-3 weeks.
- A generic version should be SKIPPED. Do not try to proxy arbitrary APIs.
- The effect-queue logic is a Go port of the Cloudflare OS action journal, not an adoption. Their kit is TypeScript on Durable Objects, though the design is Apache-2.0 and worth reading closely.
- **jitk** could replace the box later. The queue and journal would not change.
- **Model trend:** grows. Better models run longer unattended turns, so batch approval beats per-step prompts. Rhys's point (0:34) is that per-step approvals disappear.
- **Signal:** Twitter 5 ("agent turns are git commits with a database; abort rewinds Postgres and cancels the email"), CV 5 (journals, fencing, idempotency, sagas, Reconcile crash tests).

## Idea 3 - Classifier auto-approval and policy (0:17 "classifiers", 1:23 regulated)

- **Exists.**
  - Claude Code auto mode: a Sonnet classifier gates shell and network actions, with hard-deny categories and a fall-back to prompting after repeated blocks. Anthropic admits it can mistake loosely related user text for consent ([engineering post](https://www.anthropic.com/engineering/claude-code-auto-mode), [docs](https://code.claude.com/docs/en/permission-modes)).
  - OPA for tool-call policy ([OPA docs](https://www.openpolicyagent.org/docs/agent-tool-calling), AI SDK package `@ai-sdk/policy-opa`).
  - Invariant Gateway guardrails, which match flows across calls, e.g. read inbox then send email ([docs](https://explorer.invariantlabs.ai/docs/guardrails/gateway/)). A third-party review says coverage of third-party MCP runtime calls is not fully shown. Invariant is now part of Snyk.
  - Executor: tools set to allow/ask/block, with approval pausing execution ([repo](https://github.com/RhysSullivan/executor)). Maturity unclear: the repo has moved to UsefulSoftwareCo and v2 is in progress.
  - HumanLayer: an approval SDK with Slack/email routing. Third-party pages only, and I found no evidence of a deferred mode.
- **Fern fit.** A policy hook at queue submit time: OPA (Go library, so in-process) decides auto-approve, queue or deny per effect kind, like Cloudflare OS's `autoApprovable`. A classifier is an optional second opinion, running on the user's own subscription via a headless CLI call. That is a normal use under §13.1, but it is automated usage, so cap and opt in.
- **Verdict: ADOPT OPA** (embedded, 3-5 days). The classifier is SKIP for now, since it is a bet on judgement quality we do not control and the queue is the safer base. It is not a crutch for weak models: it gets better as they do.
- **Model trend:** grows for classifiers and policy. The human-in-the-loop-per-step model shrinks.
- **Signal:** Twitter 2, CV 3.

## Idea 4 - Untrusted LLM code in regulated settings (1:23, Lockheed)

Not a separate idea, only evidence for the market: people build their own clusters for this. Fern's snapshot-per-turn chain plus the effect journal is an audit trail by construction. Say that in the README and do not build compliance features. **SKIP**, signal 1/2.

## Top 3

1. **Transactional turns, git-first** (idea 2): fork-as-pending-transaction, Fern-hosted git remote, effect journal in SQLite, `env_commit` / `env_abort`. This is the one distinctive thing nobody else has with a real database in the loop.
2. **Egress credential broker** (idea 1): a prerequisite for 1, small and credible, with the §13.1 carve-out for model hosts.
3. **Embedded OPA policy at queue submit** (idea 3): cheap, and it gives auto-approval without trusting a classifier.

## Open risks

- Simulation outside Fern-owned interfaces is a trap. Any agent that shells out to an arbitrary SDK bypasses the queue unless egress is deny-by-default, which will break real setups.
- Promote-then-apply or apply-then-promote cannot be atomic across services. The "outcome unknown" state will occasionally need a human, and the demo must not overclaim.
- Long-lived pending forks hold snapshots and retention (§12, quota). Three-day approvals need a TTL and a rebase story if main moves (merge conflicts at promote time).
- A MITM proxy next to subscription traffic invites a terms question. Keep model hosts untouched and re-check §13.1 before release.
- Cloudflare OS may ship a "Gatekeeper as a service" outside its own platform (README says "envision"), which would shrink the novelty on the effects side. The fork-plus-DB side would still be ours.
