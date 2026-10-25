# Scope Q&A: what Sofort is for (2026-10-25)

These are decisions and answers from the discussion about the KL/Cloudflare strategy. Background: `demo.md` (§4.3, §7) and `arch/research/cloudflare-goose/SYNTHESIS.md`.

## 1. Short-lived, not long-lived workspaces

**The decision:** stay short-lived. Support "long" programs by **pausing** them, not by keeping them running.

### If we lifted the limits to run hour-long workspaces (git, npm, tsserver, many processes)
- **The cost advantage disappears.** Workspaces use 1–4 GB, and the kernel is under 5% of that. Snapshots become GB-sized, like E2B, Daytona and Morph.
- **Getting there means rebuilding Linux**, which took gVisor years.
- **What it would uniquely enable comes from the single I/O channel:**
  - exact replay of a whole agent session;
  - a complete effects boundary for a full workspace.
- **But gVisor or Firecracker plus record/replay at the network and FS boundary gets ~80% of that** much more cheaply.

### Short-lived work (the target)
Per task, Sofort costs ~1–6 ms and ~0.5 MiB; a container or VM costs 100–1,000 ms. That enables:
- isolation per call, file, request or user;
- real tools (jq, SQLite, parsers) on untrusted data, with no network;
- code mode with hardware isolation, which removes the "external communication" leg of the lethal trifecta;
- SaaS and automation code steps where credentials never enter user code;
- RL and eval environment resets as a memory copy;
- pause (Capsule) on top: short bursts of compute between long waits.

### Limits and what to do about them
| Limit | Plan |
|---|---|
| Deadline per run | It's a policy setting. Make it configurable. |
| Threads (`clone`/`futex`) | Threads on one vCPU first (weeks). SMP later, if ever. |
| Writable FS | tmpfs in guest memory, captured in snapshots (days to weeks). |
| Network | Only as a tool (`fetch` via the host), never raw sockets. |
| Hour-long workspaces | Out of scope. Use a Linux tier. |

## 2. How per-request builds stay instant
- **Nothing is built at request time.** One kernel ships with every verified handler. A per-task **profile** contains:
  - runtime and binaries;
  - a syscall allowlist bitmap;
  - a resource archive;
  - grants.
- **The profile is hashed.** A cache hit restores that profile's snapshot (CoW): 2.8–6 ms nested [M], ≤1 ms on bare metal [T].
- **A cache miss** boots, initialises, snapshots and stores under the hash, once per profile.
- **The growth loop never runs on the request path.** An unknown syscall gets ENOSYS today. **Planned:** automatic fallback to a Linux microVM for that run, log the syscall, and grow it offline.

### The other angle: use the offline loop to make things faster, not just more compatible
1. **Memoised computers.** Snapshot *after* expensive, input-independent init: runtime loaded, SQLite DB opened, schema parsed, libraries imported. Key it by a hash of profile plus init inputs, so later requests skip the start of the program. This generalises "warm computer as a tool".
2. **Optimisation per profile.** The loop already traces every syscall a profile uses. Use those traces to:
   - put hot handlers on fast paths inside the guest, so there's no VM exit;
   - drop unused page tables and handlers so snapshots and restores get smaller;
   - order the snapshot pages that get touched first.

   This is PGO for a whole computer.
3. **Fail before running.** Give the agent the profile's contract up front (`.d.ts` per grant, the supported syscall/tool set), so unsupported code is rejected at write time instead of after a wasted run.
4. **Tool calls without exits.** The ring ABI v2 lets the guest post tool calls to shared memory with no VM exit per call, which cuts the 0.5–1.5 ms guest↔executor hop.

These are not measured yet. (1) is the most promising and the cheapest to test: snapshot after init on one realistic profile and compare execute→result latency.

## 3. Synthetic mounts: read first, then write through the journal
- **Read-only mounts:**
  - `/mcp/<server>/…` and `/skills/<name>/…` let unmodified tools read agent data with no glue code;
  - each read is a natural park point, and reads are journaled, so replay is exact.
- **Local writable scratch (`/tmp`):** it's guest memory, safe and snapshotted. **Do it now.**
- **Writes that leave the VM** are side effects. Resume or fork can duplicate them. **Do them after the effects journal**, with these semantics:
  - commit on `close()`: one tool call with an idempotency key;
  - forks get read-only or simulated mounts until one branch is chosen.

## 4. Waterfalls
| Waterfall | Cost per hop | What removes it |
|---|---|---|
| model ↔ tool | seconds | **code mode** (already built) |
| guest ↔ executor | ~0.5–1.5 ms | ring ABI / pipelining (small win) |
| executor ↔ remote | tens to hundreds of ms | pipelining **only** with Cap'n Web or batch remotes; locality (move the capsule to the data region) reduces latency, not the number of hops |

## 5. Capsule vs the "Lambda" idea
- **Capsule** (`cloudflare-goose/SYNTHESIS.md`) is a narrow, ~4-week open-source project: **portable Code Mode continuations.**
  - A program pauses at a tool call and becomes a ~100 KB file.
  - A Durable Object holds its effects journal.
  - It resumes or forks in a Worker, in Node or in a browser.
- **"A Lambda that never bills while waiting"** is the broader platform vision in `demo.md` §7: "Workers for native code".
  - Native binaries per request, billed on CPU, scaling to zero.
  - With network as a tool, **every I/O await becomes a park point**, so you never hold memory while waiting.
  - In `demo.md`'s comparison for 1M waiting-heavy calls: about $67 on Lambda, about $0.50 on Workers, and about $0.10 for Sofort [E].
  - **Blockers:** Node and Python with npm/pip packages, threads, a writable FS.
- **Relationship:** Capsule is the first slice of the Lambda vision. It proves the pause/park mechanism and the effects journal. The full platform is L3b in `demo.md` §5.6 ("an entire company"), which is not to be built now.
