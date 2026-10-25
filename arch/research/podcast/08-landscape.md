# 08 - Competitive landscape for the podcast-inspired Fern features

Date: 2026-10-24. (F) = fact from a source I read, (I) = my inference. Vendor claims are marked as such. Fern refs are `docs/architecture.md` section numbers. I did not verify "Cloudflare Computer" (searches found nothing) or Cloudflare Containers native snapshots beyond the changelog's promise. Fly checkpoint semantics rest on a vendor comparison page only. Podcast timestamps for features 3-6 are not pinned here; siblings 04 and 05 pin the durable/event ones (43:00, 50:30).

## Landscape in one table (F unless marked)

| Player | State today | Source |
|---|---|---|
| **E2B** | Snapshot = filesystem + memory of a live sandbox, one-to-many; `fork` makes up to 100 running copies in one call. Hosted, Firecracker. | [snapshots](https://e2b.dev/docs/sandbox/snapshots), [fork](https://docs.e2b.dev/sandbox/fork) |
| **Vercel Sandbox** | Persistent by default, auto-snapshot on stop, manual `snapshot()`, `Sandbox.fork`, `getOrCreate` with `onCreate`/`onResume`. **Drives** (GA): mountable storage, forkable, forks never merge back. Workflow = durable control plane. | [persistent](https://vercel.com/docs/sandbox/concepts/persistent-sandboxes), [Drives](https://vercel.com/changelog/vercel-drives-is-now-generally-available) |
| **Cloudflare Sandbox SDK** | `createBackup()`/restore of a directory to R2 as squashfs via FUSE overlay (Feb 2026). Native snapshots promised. No fork found. | [changelog](https://developers.cloudflare.com/changelog/post/2026-02-23-sandbox-backup-restore-api) |
| **Cloudflare Artifacts** | Git-compatible storage, repo per Durable Object, private beta in April, "open beta" per podcast 00:01. Code only, no DB. | [overview](https://flaviocopes.com/cloudflare-artifacts/) |
| **Daytona** | Hot snapshot + fork of memory and filesystem on VM sandboxes, marked experimental (May 2026). One unverified blog claims the repo was archived/closed in Oct 2026. | [docs](https://www.daytona.io/docs/en/persistence), [claim](https://www.agent37.com/blog/daytona-alternative) |
| **Modal** | Filesystem, directory and memory snapshots. Memory snapshots are pre-beta, 7-day expiry, no live network or GPU state. | [docs](https://modal.com/docs/guide/sandbox-memory-snapshots) |
| **Morph Cloud** | Infinibranch: snapshot/branch/restore in under 250 ms (vendor claim), "Liquid Metal" runtime. I found no 2026 release notes. | [site](https://cloud.morph.so/) |
| **Fly Sprites** | Checkpoint restores the same Sprite in place, no expiry (vendor page). | [fly vs modal](https://fly.io/learn/fly-vs-modal/) |
| **Replit** | Checkpoints bundle code, conversation context and connected DB (data + schema), with roll-forward. Hosted, closed. | [docs](https://docs.replit.com/core-concepts/agent/checkpoints-and-rollbacks) |
| **Neon / Xata** | Copy-on-write Postgres branches, per-agent, sub-second (vendor). Neon documents a "memory + DB snapshot = checkpoint" pattern. Databricks is acquiring Neon. DB only, not the box. | [Xata](https://xata.io/use-cases/agent-sandboxes), [Neon](https://neon.com/guides/replayable-ai-agents) |
| **Turso AgentFS** | Agent filesystem in one SQLite file; "snapshot" is `cp`. Alpha. | [docs](https://docs.turso.tech/agentfs/introduction) |
| **GKE Pod Snapshots** | Checkpoint/restore of running pods under Agent Sandbox, GKE-only, limited preview (secondary source). | [article](https://techinformed.com/?p=37344) |
| **Northflank** | Kata/gVisor microVM sandboxes, competes on price (vendor). Not researched further. | see `../landscape.md` |

**agent-sandbox (kubernetes-sigs), v1.0.8 on 2026-10-22 (F, read via `gh`).** The roadmap lists Auto Suspend/Resume, Scale to Zero, Startup Actions, Storage Customization at Claim Time and a first-class router as *planned*, with no fork or rewind item. Open and stale-ish: #694 Suspend API plus a SnapshotProvider interface (priority important-soon, 7 comments), #949 portable snapshot via OCI image, #773 multi-path persistent storage, #36 `pause` field, #952 resume-ready semantics, #1237 in-sandbox guest agent for consistent snapshots, #1343 resume via pre-warmed pods, #1155 and PR #1775 lifecycle metrics. **Nobody owns a btrfs/CSI snapshot provider or anything DB-aware.**

**Cloudflare OS (F, `/tmp/ref-repos/cloudflare-os`, HEAD 2026-10-23).** `plans/step-transactionality.md` is the transactional-turn design: effects buffer in memory and commit in one `transactionSync` at the step barrier. Gatekeepers simulate effects with deferred batch approval. I grepped the plans: no fork or rewind of whole environments; "branch" there means git. It runs on Durable Objects, so it is not self-hostable on k3s.

## Per feature

**1. Transactional turns with deferred effects (sibling 04, ~50:30).**
- *Who has it:* Cloudflare OS only (design plus partial code). Temporal/Restate/DBOS give durable calls but know nothing about disk. Replit checkpoints are per milestone, not effect-aware.
- *Closeness:* conceptually the same, but Cloudflare's version is a DO-storage transaction inside one app. Nobody couples effect release to a disk snapshot.
- *Fern edge:* an effect outbox (`timers` table, §4) whose release is gated on the turn snapshot (§7.2), and `env_restore` (§7.3) cancels effects born after the target. Revert un-sends the email. Requires owning the disk, so hosted sandboxes cannot copy it cheaply. Edge = DB-and-disk-inclusive plus T3 threads.

**2. DB-inclusive fork/rewind.**
- *Who has it:* Replit (closest product, closed, single-vendor). E2B, Vercel, Daytona, Modal, Morph fork the VM, which includes Postgres only if it runs inside and tolerates a memory-less or crash-consistent copy (I). Neon/Xata branch the DB but not the code/box.
- *Closeness:* E2B and Daytona fork are fast and ahead on memory state. None is self-hosted K8s, none is tied to an agent UI's "revert files too", none documents Postgres crash recovery.
- *Fern edge, ranked:* (a) a live Postgres inside every per-turn snapshot, rewound with the conversation; (b) self-hosted on your own cluster with your own subscriptions; (c) T3 thread binding; (d) Kubernetes-native. Honest limit: Fern is filesystem-consistent (crash-recovery Postgres), not memory-consistent, so E2B/Daytona win for processes mid-flight.

**3. Event wakes (sibling 05, 43:00).**
- *Who has it:* Cloudflare DO alarms, Vercel Workflow hooks, E2B/Vercel resume-on-API, agent-sandbox roadmap "auto resume on traffic" (planned).
- *Closeness:* everyone resumes a box on a call. Few resume an *agent conversation* on a webhook.
- *Edge:* `/hooks` front door (§11) that wakes the box and injects a resume prompt into the T3 thread. Mostly glue; moderate edge. Crowded below the line, open above it.

**4. Resource-tree reads without waking.**
- *Who has it:* AgentFS (SQLite file readable without a VM), Artifacts (git remote readable without a container), Vercel Drives (mount without a running sandbox), Cloudflare DO state.
- *Closeness:* these read files, not a typed tree (env, snapshots, services, DB schema).
- *Edge:* reading a sleeping btrfs snapshot read-only from the daemon (file tree, `pg_dump`-free schema peek via a read-only recovery mount) is cheap and unique because the data is a plain dir. Small but demo-able.

**5. Per-step tiered compute.**
- *Who has it:* Cloudflare (isolate vs Container vs Sandbox tiers, [dynamic workers](https://www.infoworld.com/article/4149869/cloudflare-launches-dynamic-workers-for-ai-agent-execution.html)), Vercel (Run SDK/QuickJS vs microVM), agent-sandbox warm pools and the planned multi-sandbox-per-pod. Modal/E2B bill per resource.
- *Edge for Fern:* little. Tiering below the box is jitk's territory (out of scope). Fern's piece is only in-place resize (agent-sandbox #1054, PR #1321 by another contributor).

**6. Capability APIs.**
- *Who has it:* Cloudflare OS Gatekeepers/Cap'n Web, Executor (the product on the podcast), MCP servers with OAuth, Vercel/E2B network allowlists. Fern already has the GitHub App broker (§3).
- *Edge:* a credential-never-enters-the-box broker is real but is the "identity" component, not a new idea. Reuse MCP + Cap'n Web rather than invent a protocol.

## Crowded vs open
- **Crowded:** hosted sandbox snapshot/fork (E2B, Vercel, Daytona, Modal, Morph, Fly), DB branching (Neon, Xata), durable workflow engines, sandbox tiering, git-for-agents (Artifacts).
- **Open:** (1) disk-and-DB-and-conversation rewind, self-hosted; (2) effect release bound to snapshots; (3) the agent-sandbox SnapshotProvider/btrfs implementation; (4) reading sleeping environments cheaply.
- **Trend flags (lens):** 1-2 grow with volume and trust needs. Tiering and approval UX partly shrink as models get trustworthy (crutch risk).

## Don't build (adopt instead)
- Durable workflow engine: use DBOS Go or just Fern's `timers` table; skip Temporal/Restate.
- Postgres branching service: Fern's btrfs snapshot already covers it; do not integrate Neon/Xata (hosted, DB-only).
- Git hosting for agents: use GitHub via the broker; Artifacts is Cloudflare-bound.
- A new RPC or capability protocol: use MCP, and Cap'n Web only if a TS client needs object capabilities.
- Memory-state checkpointing (CRIU/Firecracker snapshots): leave to E2B/GKE/jitk. Say so openly.
- Router/gateway/Helm chart for agent-sandbox: owned by others (#1174, #2043).

## Contribution opportunities (CV and Twitter)
1. **agent-sandbox #694 (Suspend API + SnapshotProvider)**: priority important-soon, stale, still open after 7 comments. Offer a KEP or PR for a `SnapshotProvider` interface plus a reference btrfs/CSI provider (Fern's driver is the working proof). Effort 2-3 weeks. CV 5 (Go, CRDs, SIG project); Twitter 3. Highest leverage because it is exactly Fern's roadmap and unclaimed. Pair with #949 and #773 as design inputs.
2. **#1237 guest-agent freeze for consistent snapshots**: fsfreeze and Postgres CHECKPOINT hook before snapshot is a real, small contribution backed by Fern's E-experiments. 1-2 weeks, CV 4.
3. **Help-wanted smalls** to build reviewer trust first: #2043 router Helm chart, #1822 status-condition docs, #1775 metrics review. Days each, CV 2-3.
4. **Cap'n Web**: `flaticols/capnweb-go` exists (unreviewed, 2026-06). A maintained Go port or server-side Go interop with the TS reference would be the first credible one (I did not check its quality). Open upstream issues of interest: #36 WebSocket hibernation (large), #234, #210 (leak/disposable fixes), #180 reconciliation. Effort 3+ weeks for a port, days for a bug fix. CV 3 (Go RPC, protocol work), Twitter 4 if the demo is "Go agent exposes capabilities to a Cloudflare Worker". Risk: not on Fern's critical path.
5. **Cloudflare OS** (Apache-2.0, new, active): an external PR is unlikely to land quickly; a published comparison "step transactionality, but with disk" is a safer Twitter piece.

## Top 3 recommendations
1. **Ship snapshot-bound effects outbox plus DB-inclusive revert as the headline** (1-2 weeks on top of the MVP). Only combination no one has; demo: agent sends email, rewind, the email never leaves and the DB row is back.
2. **Upstream the SnapshotProvider to agent-sandbox (#694)**, using Fern's btrfs/CSI provider as the reference. Best CV signal for the Grab goal.
3. **Cheap sleeping-env reads and `/hooks` wake-to-thread** as demo polish (about 1 week); skip tiering and a new capability protocol.

## Open risks
Hosted vendors move fast: E2B and Daytona already fork with memory, Vercel forks Drives, and Replit already bundles DB in checkpoints, so "fork" alone is not novel and Fern must lead with self-hosted plus Postgres-in-snapshot plus T3 binding. Postgres on btrfs snapshots is crash-consistent only; if consistency bugs appear, the claim collapses, so crash tests must come first. agent-sandbox could add its own snapshot provider (GKE Pod Snapshots are already in preview), making Fern's driver redundant; upstreaming early mitigates that. The Daytona closure claim, Morph's 2026 status, Fly semantics and "Cloudflare Computer" are unverified. Maintainer responsiveness on stale agent-sandbox issues is unknown.
