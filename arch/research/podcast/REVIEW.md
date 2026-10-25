# Lead review: podcast ideas → Fern (8 Sonnet reports, 2026-10-24)

## Spot checks (GitHub API)
- **flaticols/capnweb-go:** exists, MIT, **3 stars**, last push 2026-07-06, wire 0.8 vs reference 0.12. Not adoptable as is.
- **kubernetes-sigs/agent-sandbox #694** ("Suspend API + Snapshot provider"): **open**, updated 2026-10-19. Latest release v1.0.8.
- **Executor:** now `UsefulSoftwareCo/executor`, MIT, about 4.26k stars, active today.

## Corrections to the reports
- **06 (tsrs):** says it has no source for tsrs. Wrong: Cloudflare and VoidZero announced it on 2026-10-20 ([blog](https://blog.cloudflare.com/typescript-rust-port/)).
- **Callscript (04, 06) and "Cloudflare Computer" (08):** the podcast mentions both, but no primary source was found for either. Treat them as unverified and don't cite them publicly.
- **03 (Cloudflare OS):** step-transactionality covers only chat and code-edit durability, not external effects. That corrects my earlier framing.

## Convergence
Reports 03, 04 and 05 each independently propose a SQLite journal in the daemon, fenced by the restore/fork `generation`:
- effects (03): pending GitHub, Slack and email actions;
- delayed sends and undo windows (04);
- `env_wait` park and resume (04);
- cron wakes (05).

These are one subsystem: **a durable journal of effects, waits and timers, bound to snapshots.** Build it once.

## Conflicts resolved
- **Cap'n Web /rpc (01) vs "use MCP" (08):** defer. The Go port isn't credible yet (3 stars, behind the reference). MCP covers Fern's needs. Revisit as standalone open source later.
- **QuickJS-on-wazero stateless tier (06) vs Executor in TypeScript/Bun (07) vs skip tiering (08):** skip both for now. jitk is the stateless tier later, so two extra JS runtimes now would be churn. An Executor spike is optional and can come after v1.
- **OPA (03):** cheap, but not needed until auto-approval exists. Postpone it.

## Ranked plan (on top of the MVP)
0. **Crash-consistency tests** for Postgres on btrfs snapshots (08 risk). If those fail, every claim fails, so they come first.
1. **Effects journal, git first** (03 + 04). The box's `origin` is a Fern-hosted bare repo, with a PR queue, `env_commit`/`env_abort`, generation fencing, idempotency key `(env, snapshot, seq)`, outcome-unknown handling, and an undo window. 3–4 weeks.
2. **Upstream to agent-sandbox #694**: a SnapshotProvider interface, with Fern's btrfs/CSI provider as the reference. 2–3 weeks, can run in parallel. Best CV signal.
3. **`/hooks` bindings** (CI failure, PR review comment), daemon-side triage and coalescing, and cron on the journal's timers (05). About 1.5 weeks.
4. **Sleeping-environment reads**: a `fern://env/snap/path` resource tree plus an `env_read` tool, since client support for resources is weak (02). About 1.5 weeks.
5. **Egress credential broker**, passing model hosts through untouched under §13.1 (03, 07). 1–2 weeks. Needed before non-git effects.

## Deferred
- Cap'n Web Go
- Executor catalog
- stateless runtime tier (jitk)
- OPA and classifiers
- SEP-2640 skills
- `services.yaml` `mcp:` hook

## Skip
- Temporal and Restate
- Neon and Xata
- CRIU and memory snapshots
- a generic API-simulating proxy
- hosted MCP gateways (Composio, Arcade, Smithery)
- compliance features

## Positioning (08)
Fork and snapshot on their own are crowded: E2B and Daytona fork VMs with memory, Vercel forks Drives, and Replit checkpoints already include the database. Lead with the combination nobody has:
- **self-hosted;**
- **a live Postgres in the snapshot;**
- **bound to T3 threads;**
- **effects released only on commit.**

## Verification pass (2026-10-24)

**Confirmed**
- capnweb-go: 3 stars, last push 2026-07-06, targets wire 0.8.0 vs reference 0.12.0.
- Executor: `UsefulSoftwareCo/executor`, TypeScript, MIT, 4,260 stars.
- agent-sandbox: v1.0.8 released 2026-10-22.
- SEP-2640 Skills: merged 2026-09-13, docs updated to published status 2026-09-18.
- SEP-3415 Events: PR still open (draft).
- tsrs announced 2026-10-20.
- Cloudflare OS:
  - step-transactionality excludes gatekeeper effects (lists them as out of scope);
  - `delivery: continue-with-simulation | await-decision`, `claimBeforeApply`, `ActionOutcomeUnknownError` are in `gatekeeper-kit/src/actions.ts`.
- Replit checkpoints include DB data and schema, but restoring them is opt-in and covers the dev DB only.
- E2B fork captures filesystem and memory (official docs).
- Vercel Drives fork exists (API docs updated 2026-10-08; GA vs private beta conflicting), plus `Sandbox.fork()` (2026-07-28).
- Fern:
  - SQLite index and log, Reconcile, and `POST /hooks/{env}/{token}`;
  - "no proxy that intermediates subscription credentials" (§1.2/§13.1).

**Corrected**
- **agent-sandbox #694 "unclaimed":** WRONG.
  - KEP PR #762 ("Suspend and Resume + SnapshotClass", SHRUTI6991) was auto-closed for inactivity 2026-08-28, unmerged.
  - KEP-0968 (#972, janetkuo, auto-suspend) also closed.
  - #694 is `lifecycle/stale`, no assignee. Related open issues #773, #949, #1237.
  - GKE Pod Snapshot primitives merged in the RL SDK (#1540).
  - The opening is real, but the move is to revive or build on KEP #762 with its author, not start fresh.
- **Fern `generation` column:** PLANNED, not built. Restore fencing itself is built (architecture §4).
- **Cloudflare OS Gmail overlay:** `gmail-overlay.ts` is 380 lines, not 705. Simulation is spread across gmail/chat/sheets/slides files.
- **"Cloudflare Computer" unverified (08):** WRONG. `@cloudflare/computer` exists on npm (first published 2026-07-29, latest 0.7.0), described as an isolates-first runtime that escalates to containers.
- **"Two protocol versions behind":** imprecise. It's four minor releases (0.8 → 0.12).

**Still unverified**
- Callscript (no primary source).
- ChatGPT MCP events being webhook-only (secondary: Hookdeck).
- Daytona memory fork (third-party only).
- Claude Code resource-read bug.
