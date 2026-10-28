# 05 — Workspace data plane

Research date: 2026-10-28. **F** = sourced fact; **M** = measured locally for this report; **I** = inference/design judgment; **E** = estimate or proposed acceptance threshold. Sizes use MiB/GiB unless explicitly marked MB/GB; vendor prices use their published units. No deployment, paid API call, Docker, or execution-host VM was used.

## Verdict

**GO WITH CHANGES.** The workspace does not inherently kill the split, but the literal plan to put the entire development environment in a DO and cheaply reconstruct a disposable runner for each command does. Keep durable **source state and workspace coordination** in the brain's storage plane; keep dependencies, Git object packs, and build state in reusable runner snapshots or shared cached layers. Publish incremental source changes at command boundaries. Whether 10× is achievable depends on the measured runner duty cycle, cache misses, snapshot latency, and unchanged CPU work—not on edit bytes alone. **[I]**

There is unusually direct prior art: **Cloudflare already implements much of this exact split in `@cloudflare/computer`**. It has a DO-backed SQLite filesystem, a `computerd` FUSE mirror inside a container, and incremental bidirectional synchronization around execution. Its container backend and synchronization interfaces remain experimental. This layer should start by evaluating that code, not by independently inventing a DO filesystem. [Cloudflare Computer status](https://github.com/cloudflare/computer/blob/b681446f0eaed8ad010bcd2f5e61b3680a6c02c4/packages/computer/README.md#status), [sync protocol](https://github.com/cloudflare/computer/blob/b681446f0eaed8ad010bcd2f5e61b3680a6c02c4/docs/02_sync_protocol.md). **[F, I]**

The sharp distinction is **a warm workspace without a running session VM**, versus **a warm session VM**. Content-addressed storage and snapshots can provide the former. Keeping one runner alive for every session supplies the latter and removes the intended density gain. **[I]**

A naming correction from the brief: fetching `badlogic/pi-mono` currently resolves to **`earendil-works/pi`**. The measured revision is `c3d8ce44d3231c7e46071d2d859f41ca7d39d21b`; its coding-agent package is **`@earendil-works/pi-coding-agent` 1.4.0**, rather than the historical `@mariozechner` package name. Pin a revision before doing compatibility work. [Pinned package manifest](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/coding-agent/package.json). **[F, M, I]**

## 1. How much state is there?

### Planning envelope, not a claimed population median

I did not find a defensible public distribution of *coding-agent customer workspaces* split into source, history, installed dependencies, and caches. The following are sizing assumptions to test, not statistics about an average agent customer. Repositories containing media, datasets, native toolchains, or vendored dependencies can exceed them substantially. **[E]**

| Workload | Checked-out tracked files, including tests/assets | `.git`, with useful history | Installed dependencies | Build outputs / incremental caches |
|---|---:|---:|---:|---:|
| Small service/library | 1–20 MiB | 5–100 MiB | 50–500 MiB | 1–200 MiB |
| Medium TS application/monorepo | 20–200 MiB | 50 MiB–2 GiB | 300 MiB–3 GiB | 100 MiB–5 GiB |
| Large monorepo/native-heavy project | 0.2–10+ GiB | 1–100+ GiB | 1–20+ GiB | 1–100+ GiB |

There is a sourced large-repository example: Cloudflare reports a popular web framework with **2.4 GB** and a long history taking nearly two minutes to clone in its launch example. That is one vendor example, not a benchmark transferable to every host. Git's own documentation also explicitly addresses repositories whose full clones consume over 100 GiB. [Artifacts announcement](https://blog.cloudflare.com/artifacts-git-for-agents-beta/), [Git partial-clone design](https://git-scm.com/docs/partial-clone). **[F]**

### Local measurements

Two public repositories were fetched into `/tmp/split-workspace/`. File sizes below are logical bytes, not allocated disk blocks; symlink targets were not recursively duplicated. Pi was a depth-one checkout. Fastify was subsequently unshallowed without fetching tags. **[M]**

| Sample | Tracked files | Tracked bytes | `.git` bytes | Dependencies | Generated output |
|---|---:|---:|---:|---:|---:|
| Pi, revision above | 2,397 | 30,677,301 B / **29.26 MiB** | **10.28 MiB**, shallow | **481.42 MiB**, 21,830 files before test-cache creation | **7.31 MiB**, partial build only |
| Fastify `5df959f3af698823dd582f1c3661f3e80df0b5da` | 397 | **2.90 MiB** | **11.33 MiB**, 4,917 reachable commits | Not installed | Not built |

Pi's `npm ci --ignore-scripts --no-audit --no-fund` reported **303 packages added in 12 seconds**. Its scratch npm download cache was another **136.36 MiB** before deletion. Ignoring lifecycle scripts avoids native downloads/build steps; consequently this understates environments needing those steps. This is one machine and one registry/network run, not a cloud install SLA. **[M]**

Streaming gzip-tar measurements, without storing the archives: **9.43 MiB source**, **10.11 MiB `.git`**, **132.97 MiB root `node_modules`**. Archive generation took **2.39 s**, **0.20 s**, and **28.97 s**, respectively, in concurrent local runs. Compression itself can cost more time than sending a small delta. The dependency archive covers root `node_modules`; the logical dependency total also counts any nested workspace directories. **[M]**

The full `build:offline` attempt stopped after five packages because generated AI-provider catalog data was absent. Therefore **7.31 MiB is not a full Pi build/cache measurement**. A separate `packages/tui` TypeScript build succeeded in **0.379 s**. Two small added unit tests also passed. No model call was made to obtain missing data. **[M]**

### How much changes during an edit?

For capacity planning, distinguish three quantities:

| Quantity | Ordinary small edit assumption | Why it matters |
|---|---:|---|
| Text actually inserted/replaced | Tens of bytes–several KiB per file | What an edit tool already knows |
| Complete contents of changed source files | 1–100 KiB per file; often 1–10 files per turn | Simple file-addressed CAS sends this, even for a one-line edit |
| Command-produced writes | Zero to GiB | Formatters, lockfile updates, generators, installs, Git maintenance, and builds dominate the tail |

These are **[E]**, not measured agent-trace percentiles. My deliberately small code/test/doc sequence produced **88–9,715 B of changed-file contents per boundary**, with **327–2,905 B gzip bundles**, before explicit deletion metadata. A broad formatter or regenerated catalog can invalidate this assumption immediately. **[M, I]**

### Transfer time and money

Assume **100 Mbit/s** effective payload throughput between services, and **1 Gbit/s** for a good colocated path. These are experiment settings, not Cloudflare bandwidth guarantees. Pure transfer time is `bytes × 8 / bits_per_second`; add request latency, metadata work, decompression, installation, and disk writes. **[E]**

| Payload | At 100 Mbit/s | At 1 Gbit/s | External runner egress at $0.025/GB, if applicable |
|---|---:|---:|---:|
| 2,905 B compressed edit bundle | 0.23 ms | 0.023 ms | $0.000000073 |
| Pi source, 29.26 MiB | 2.45 s | 0.245 s | $0.00077 |
| Pi source gzip, 9.43 MiB | 0.79 s | 0.079 s | $0.00025 |
| Pi shallow `.git`, 10.28 MiB | 0.86 s | 0.086 s | $0.00027 |
| Pi dependencies, 481.42 MiB | 40.38 s | 4.04 s | $0.01262 |
| Pi dependency gzip, 132.97 MiB | 11.15 s | 1.12 s | $0.00349 |
| 1 GiB cache | 85.90 s | 8.59 s | $0.02684 |
| 5 GiB cache | 429.50 s | 42.95 s | $0.13422 |

Times and dollar products are **[E]**, using the measured Pi byte counts where shown. Cloudflare's published NA/EU Container egress price is $0.025/GB; R2 itself charges **no egress fee**. Do not automatically charge that runner rate to every internal path or to both directions. [Container pricing](https://developers.cloudflare.com/containers/platform/pricing/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/). **[F]**

At marginal published rates, storing **1 GB for a month** costs **$0.015 in R2 Standard**, **$0.20 in DO SQLite**, or **$0.50 in Artifacts**, excluding included allowances and operation charges. Ten thousand separate R2 GETs cost $0.0036 and PUTs $0.045; copying tens of thousands of tiny dependency files into separate objects on every command is an operation problem even with free read egress. Pack small files/changes into bounded bundles; preserve per-file hashes in the manifest. [R2 rates](https://developers.cloudflare.com/r2/pricing/), [DO rates](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Artifacts rates](https://developers.cloudflare.com/artifacts/platform/pricing/). **[F, E, I]**

## 2. The DO is not already a durable Node filesystem

Workers' `node:fs` operates on an in-memory VFS: `/bundle` is read-only and `/tmp` is request-scoped, nonpersistent, and counts against memory. That does **not** turn `ctx.storage` or R2 into the filesystem seen by an unmodified Node program. [Workers `fs`](https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/). **[F]**

A SQLite-backed DO has a **10 GB storage limit**, **2 MB maximum row/BLOB size**, and the Workers memory limit applies; the usual isolate limit is **128 MB**. Streaming/chunking is necessary for larger files and repositories. A 481 MiB dependency tree cannot simply be loaded into the isolate's `/tmp`. [DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/). **[F, I]**

Pi's current `read`, `write`, and `edit` implementations expose asynchronous operation overrides, including explicit remote-file-operation interfaces; Bash execution has a similar seam. A first implementation can keep the harness source unchanged while supplying custom operations, instead of solving every Node filesystem syscall first. That is a configured harness with adapters—not evidence that arbitrary extensions, configuration loaders, or synchronous `fs` calls will work unchanged. [Read operations](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/coding-agent/src/core/tools/read.ts), [edit operations](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/coding-agent/src/core/tools/edit.ts). **[F, I]**

The useful invariant is: **every acknowledged agent operation observes one durable workspace version**. It need not mean every dependency and every Git object is physically stored in that DO. **[I]**

## 3. Designs evaluated

### A. Copy on command, using rsync-style deltas

**How:** keep a materialized runner tree; push pending brain edits before execution and pull command changes afterward. Exclude rebuildable directories from source synchronization. **[I]**

This is a good first prototype **if the receiver's base survives across invocations**. Rsync saves bytes against a previous copy; a fresh, empty runner has nothing to delta against. Deleting the receiver every command makes this a full hydration design again. A shared cached base or restored snapshot is therefore a prerequisite, not an optional optimization. **[I]**

Main shortcomings: recursive scans/file lists; size/mtime heuristics; deletes and renames; modifications outside Git tracking; and a consistent boundary while subprocesses are still writing. `git diff` alone misses untracked and ignored files and does not capture staging/index/rebase state. A mutation journal plus hashes is better than rescanning every directory after every read-only command. **[I, M: §4]**

**10× result:** potentially preserves it with a reusable base and low runner duty cycle; destroys it if it repeatedly reinstalls dependencies or requires a continuously running receiver. **[I]**

### B. Runner owns the workspace; DO caches files

**How:** all durable edits ultimately commit to the runner's persistent volume or snapshot; the DO caches text reads and records pending edits. Invalidate/version that cache after every command that may write. **[I]**

This offers the cleanest ordinary Linux/Git semantics. It also makes cache misses, `grep`, configuration discovery, and uncached reads liable to wake the runner. To edit while it sleeps, the DO must either maintain an authoritative overlay until the next handoff or use a snapshot/object-store API that can update the workspace without booting it. The former converges on design C; the latter depends on provider capabilities. **[I]**

**10× result:** good if “runner owns it” means **durable disk state independent of allocated compute**. Bad if it means “the only copy is on a live runner.” A DO cache does not make a live VM free. **[I]**

### C. Content-addressed workspace snapshots with lazy fetch

**How:** immutable file/tree manifests reference Git blobs or CAS objects; the DO owns the current root/version and small pending overlay. The execution host presents a normal filesystem, reading cached objects locally and fetching misses in batches. Source files can use whole-file hashes initially; large blobs can use chunks. A separate native Git-state/environment snapshot retains everything not represented by a Git tree. **[I]**

This avoids repo-size work for ordinary edits and permits independent forks by referencing a common base. However, **Git objects are not a complete workspace checkpoint**: staging state, untracked files, Git LFS materialization, submodules, executable bits, symlinks, empty directories where relevant, and in-progress operations need explicit representation. Nor does `git clone --filter=blob:none` by itself make the ordinary checked-out worktree lazy: Git documents that checkout bulk-fetches the required blobs. ArtifactFS/EdenFS provide the extra filesystem layer. [Git partial clone](https://git-scm.com/docs/partial-clone), [ArtifactFS](https://developers.cloudflare.com/artifacts/guides/artifact-fs/). **[F, I]**

Lazy loading moves cost to first use; it does not erase it. An unrestricted recursive content search or whole-project compiler can touch most source files. Node module resolution can require many small metadata accesses even when few bytes are read. Batch metadata, cache negative lookups, prefetch manifests/config/source hot sets, and report bytes actually touched. **[I]**

Cloudflare Computer already uses SHA-256-addressed **512 KiB fixed chunks**, revision watermarks, coalesced per-path changes, and missing-object exchange. Its protocol also describes last-writer-wins conflict cases. Fixed chunking does not imply that every tiny insertion has a tiny transfer: shifting the offsets of a large file can invalidate all following chunks. [Sync protocol](https://github.com/cloudflare/computer/blob/b681446f0eaed8ad010bcd2f5e61b3680a6c02c4/docs/02_sync_protocol.md). **[F, I]**

**10× result:** the strongest candidate, combined with dependency/environment snapshots and an execution-host cache shared across dormant sessions. It becomes a substantial filesystem/cache product if built from scratch. **[I]**

### D. Network filesystem: 9P/FUSE/NFS over a DO/WebSocket/R2 bridge

**How:** a filesystem client on the runner translates filesystem calls into remote requests. The mount lives on the Linux runner; `workerd` is not mounting a Linux filesystem. FUSE is an interface, 9P/NFS are protocols, and WebSocket is a transport; none supplies persistence or POSIX correctness by itself. **[I]**

A naive per-operation network design is unacceptable for `npm`/Git/compiler workloads. For example, **10,000 serialized cache misses × 5 ms = 50 s**, or **500 s at 50 ms**, before useful work. These are illustrative latency products, not measured application slowdown. A viable implementation serves metadata and hot data locally and uploads a write journal, effectively approaching C. **[E, I]**

An R2 bucket mounted via `s3fs` is particularly poor as the main checkout: Cloudflare explicitly says renames, locks, and permissions differ from local disk and recommends keeping dependencies/build output on sandbox disk. Object consistency is not a POSIX transaction or file-lock implementation. [R2 mount guidance](https://developers.cloudflare.com/sandbox/files/mount-an-r2-bucket/). **[F, I]**

Cloudflare's own Computer benchmark provides concrete caution: `sandbox-sdk` dependency installation, 854 packages/36,675 files, took **124.7 s on computerd FUSE versus 63.9 s on ext4**, on a standard-2 container. Crucially, those numbers **exclude the subsequent pull into the DO**. The same performance document reports local-only/native-root improvements and expressly distinguishes local-machine measurements from Cloudflare-host measurements. Do not treat all FUSE implementations as having the same cost. [Vendor performance measurements](https://github.com/cloudflare/computer/blob/b681446f0eaed8ad010bcd2f5e61b3680a6c02c4/docs/19_performance.md). **[F]**

**10× result:** poor if every syscall touches the DO or if the connection prevents brain hibernation. Plausible only with an aggressively local mirror/cache and durable batched writeback. **[I]**

### E. Keep a warm runner pinned; only hibernate the brain

Correctness and latency are straightforward because the working tree, Git index, dependencies, caches, and processes stay together. The workspace layer then saves **no runner provisioned memory/disk** and obtains no runner density improvement. It can be an explicitly priced mode for dev servers, browser sessions, databases, or watches, but cannot support the general 10× claim. **[I]**

A pause-to-disk VM is different: if it releases allocated execution resources, it is a snapshot design, not a pinned warm runner. Include its storage, pause/resume work, and cold-cache reads in the bill. **[I]**

### F. Cached base plus writable overlay

**How:** a shared immutable toolchain/dependency/base-repo image plus a private writable source/environment delta. Cache keys must include lockfile, OS/architecture/libc, runtime ABI, setup script, and relevant installation inputs. Invalidating the lockfile may invalidate much more state than a normal source edit. **[I]**

Linux OverlayFS supplies lower/upper layers and deletion whiteouts, but writing a lower-layer file can copy the whole file into the upper layer. Its upper filesystem has requirements that ordinary object storage does not meet. OverlayFS is not itself remote persistence: preserve the upper layer and its metadata, or use a block/snapshot system underneath it. [Kernel OverlayFS documentation](https://docs.kernel.org/filesystems/overlayfs.html). **[F, I]**

Keep installed packages and build caches on native paths in the runner image/volume; keep a separate source change stream. Do not blindly exclude everything in `.gitignore`: ignored fixtures, user data, local config, or generated input may be essential. Make durability classes explicit, allow promotion of any file to durable state, and keep excluded files accessible through an on-demand runner tool. **[I]**

**10× result:** preserves the possibility when bases are shared and runners actually stop; loses it if every host downloads every base anew, or if private overlays grow without compaction/retention. Best combined with C. **[I]**

## 4. Local experiment: small edits versus discovery overhead

The experiment used the Pi revision above on **macOS 26.6.1 arm64**, Node **23.10.0**, npm **10.9.2**, and system **openrsync protocol 29**. It created a second source tree, excluding `.git`, `node_modules`, `dist`, `.artifacts`, `.cache`, `.vite`, and `.turbo`. It used `rsync -a --no-whole-file --delete --stats`; timestamps of actually changed files were advanced between rounds. Hashes and modes of both source trees were compared after each boundary. No network, throttling, FUSE, or DO was involved. **[M]**

| Boundary | Changed-file bytes | Gzip-tar changed files | Rsync unmatched data | Rsync sent + received | Local sync time |
|---|---:|---:|---:|---:|---:|
| Fix size-format utility; add test | 9,517 B | 2,870 B | 962 B | 185,291 B | 185 ms |
| Extend utility to GB; extend test | 9,715 B | 2,905 B | 1,131 B | 185,454 B | 167 ms |
| Add documentation/temp file | 88 B | 327 B | 88 B | 184,435 B | 170 ms |
| Rename test; delete temp file | 330 B plus tombstones | 403 B plus tombstones | 330 B | 184,526 B | 220 ms |

The tar bundle numbers include headers but omit explicit delete records; the rsync stream includes deletions. These are deliberately constructed ordinary edits, **not a sampled real-agent trajectory**. **[M]**

Other results:

- Initial source hydration: **0.820 s**, 30.68 MB file data, roughly 31.03 MB protocol traffic. Local filesystem/cache performance is not network throughput. **[M]**
- Seven warm no-change rounds: **161 ms median**; about **184 KB sent per round** despite zero changed content. Adding checksums increased the seven-round median to **353 ms**. **[M]**
- A whole-workspace metadata walk, including dependencies/build files, visited **25,293 files**; five-run median **194 ms**. This does not include hashing their contents or remote metadata latency. **[M]**
- The renamed test ran successfully: **2 tests passed**, **0.523 s process wall time**. The TUI build also succeeded. Synchronizing after each transferred no source file contents, only the usual file-list/protocol traffic. **[M]**
- An explicit 5-byte same-size rewrite with its original mtime restored was **missed by normal rsync quick-check**, then repaired by checksum mode. Size/mtime-only synchronization is not a correctness proof. **[M]**
- On a deterministic 8 MiB sample split into 512 KiB content-addressed fixed chunks, a **32-byte append** needed 32 new bytes; a **32-byte middle overwrite** needed **512 KiB**; a **32-byte prepend** needed **8 MiB + 32 B**. This measures chunk-offset amplification, not Cloudflare's end-to-end wire encoding/compression. **[M]**

**What this decides:** ordinary source deltas are small enough; sending changed whole small files is already cheap. A mutation journal can eliminate far more overhead than adding sophisticated block diffing to every small source file. **[I]**

**What it does not decide:** persistence after runner destruction, actual R2/DO latency, Linux mount semantics, Git-index consistency, safe handling of long-running writers, or the cost of restoring dependencies on a different host. `.git` was sized but deliberately excluded from the sync experiment. The 10× claim remains unverified. **[M, I]**

Small reproducibility records remain in `/tmp/split-workspace/results.json`, `/tmp/split-workspace/compression.json`, and `/tmp/split-workspace/build-result.json`, together with the experiment script. Large scratch checkouts, dependency trees, and mirrors were removed after measurement. Peak scratch usage was below 1 GB. **[M]**

## 5. Who already handles workspace state?

| System | Publicly documented state mechanism | What it establishes / what remains unknown |
|---|---|---|
| **Cloudflare Computer** | SQLite VFS in DO, local computerd/FUSE mirror, incremental push/pull, optional disk-backed mirror and local-only native paths | Closest implementation of this brief. Container/sync components remain experimental. Evaluate rather than reimplement. [Status](https://github.com/cloudflare/computer/blob/b681446f0eaed8ad010bcd2f5e61b3680a6c02c4/packages/computer/README.md#status), [computerd](https://github.com/cloudflare/computer/blob/b681446f0eaed8ad010bcd2f5e61b3680a6c02c4/packages/computerd/README.md). **[F, I]** |
| **Cloudflare Artifacts + ArtifactFS** | Git-compatible versioned tree storage; ArtifactFS performs blobless preparation and hydrates a FUSE worktree on demand | Already provides lazy Git-backed checkout. It does not automatically persist dirty workspace files back to the remote; ordinary commit/push remains the writeback mechanism. Dependencies/Git-local state need another layer. [ArtifactFS guide](https://developers.cloudflare.com/artifacts/guides/artifact-fs/). **[F, I]** |
| **Cloudflare Sandbox / Containers** | Explicit root-filesystem snapshots, directory backups, and R2 mounts | Snapshot API is public beta; filesystem, not RAM/processes; image-version compatibility constraint; 30-day TTL refreshed by restore; snapshot support requires `durable_object` scheduling. Snapshot latency and incremental transfer behavior are not established by the public guide. [Snapshot API](https://developers.cloudflare.com/containers/guides/snapshots/), [sandbox persistence choices](https://developers.cloudflare.com/sandbox/files/). **[F]** |
| **Vercel Sandbox** | Filesystem snapshots and persistent sandbox resume; separate persistent Drives | Already supports compute lifetimes independent of workspace storage. Drives became GA **2026-10-15**, including independent writable forks; older June guides still say private beta. Full-memory process continuation is not implied by filesystem snapshots. [Persistence guide](https://vercel.com/kb/guide/vercel-sandbox-duration-and-persistence), [Drive GA announcement](https://vercel.com/changelog/vercel-drives-is-now-generally-available). **[F, I]** |
| **E2B** | Pause/resume saves filesystem and memory; filesystem-only mode also exists | Pausing removes running-compute billing; public docs quote approximately **4 s/GiB RAM to pause** and **1 s to resume**, not our measurement. An already-snapshotting node can refuse a pause, leaving compute running. An unmodified whole-agent VM can also be paused, so it is a necessary competing baseline. [Persistence](https://docs.e2b.dev/sandbox/persistence), [billing](https://docs.e2b.dev/billing). **[F, I]** |
| **Codex Cloud** | Published prepared environment; separate per-task files and saved state, including uncommitted changes and installed tools; repository refresh preserves dependency caches | Current official docs describe reusable setup and task continuation, not the internal filesystem/CAS or per-command VM lifetime. Legacy Cloud docs separately describe cached containers for up to 12 hours; do not mistake that legacy detail for the current implementation. [Current Cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environments), [legacy environment guide](https://learn.chatgpt.com/docs/environments/cloud-environment). **[F]** |
| **OpenAI Agents API** | Harness runs on OpenAI; executor runs commands and file tools inside an attached environment over an outbound connection | The control/execution split itself is already a product pattern. It does not establish that the harness holds a second source tree or that execution resources release between commands. [Architecture](https://developers.openai.com/api/docs/guides/agents-api/architecture), [self-hosted executor](https://developers.openai.com/api/docs/guides/agents-api/environments/self-hosted). **[F, I]** |
| **Cursor Cloud/background agents** | Dedicated development VM, prepared Builds, encrypted VM-disk snapshots to start/resume without setup | Documents reusable environments, not public details of chunk-addressing or a per-command brain/files split. Snapshot inactivity retention is 30 days. [Setup](https://prod.cursor.com/docs/cloud-agent/setup), [snapshot retention](https://prod.cursor.com/docs/cloud-agent/security-network), [VM model](https://prod.cursor.com/help/ai-features/background-agents). **[F]** |
| **Replit** | GCS-backed virtual block devices, lazily fetched/cached near compute; immutable **16 MiB chunks** and manifests; copy-on-write filesystem forks | Already decouples workspace storage from compute. Manifest forks share unchanged chunks. Agent code checkpoints additionally use Git; filesystem snapshots can recover damaged Git state. It is not merely uploading source diffs. [Replit snapshot engine](https://replit.com/blog/inside-replits-snapshot-engine). **[F]** |
| **BuildBuddy** | Chunked disk/RAM snapshots in local and remote caches; content hashes, compression, lazy download, FUSE disk access, `userfaultfd` memory loading | Direct precedent for retaining large warm build state without full downloads or a pinned VM. Requires execution-host machinery, not just a Worker-side object store. [Chunked snapshots](https://www.buildbuddy.io/blog/fast-runners-at-scale/), [runner recycling](https://www.buildbuddy.io/docs/remote-runner-introduction/). **[F, I]** |
| **Meta EdenFS** | Virtualized source-control tree with on-demand data and modification tracking; hash retrieval without rereading file content | Established lazy source workspace, including Linux FUSE and local overlays. It does not by itself snapshot a language runtime or dependency/build environment. [EdenFS design](https://github.com/facebook/sapling/blob/main/eden/fs/docs/Overview.md). **[F, I]** |
| **Google Piper / CitC** | Historical monorepo/workspace precedent described by Potvin and Levenberg | Google's primary publication page was accessible, but its linked ACM full text returned 403 during this research. I therefore do not use the commonly repeated CitC FUSE/overlay details as independently verified performance or implementation evidence here. ArtifactFS, EdenFS, Replit, and BuildBuddy already establish the needed mechanisms from accessible primary sources. [Google publication](https://research.google/pubs/why-google-stores-billions-of-lines-of-code-in-a-single-repository/). **[F]** |

Two Cloudflare details materially limit a “this already works” conclusion:

1. The current Computer lifecycle documentation and inspected backend both use ordinary WebSocket acceptance; the docs explicitly say **DO hibernation is not shipped for that connection**. A live workspace connection can retain the brain. The source also supports restoring a supplied container snapshot, so old lifecycle text anticipating future platform snapshots is stale; it must not be read as saying the platform still lacks them. [Lifecycle](https://github.com/cloudflare/computer/blob/b681446f0eaed8ad010bcd2f5e61b3680a6c02c4/docs/11_lifecycle.md), [current container backend](https://github.com/cloudflare/computer/blob/b681446f0eaed8ad010bcd2f5e61b3680a6c02c4/packages/computer/src/backends/container/container-backend.ts). **[F]**
2. Dependency synchronization has produced a concrete failure report: Computer 0.3.1, a roughly 400-file TS monorepo, install timeout at 120 s, around three more minutes before return, then DO storage timeouts. **The issue is closed and current local-only-path support addresses that direction; this is evidence of the failure mode, not proof that current releases still have the bug.** [Issue #179](https://github.com/cloudflare/computer/issues/179). **[F]**

## 6. Which versions of the cost/density claim survive?

Let `d` be the fraction of session wall time during which the runner is allocated, **including restore, synchronization, checkpointing, and idle grace periods**. Let `b` be the brain's resident fraction. Ignoring host-shared cache overhead for the moment:

`memory-density gain ≈ runner_RAM / (d × runner_RAM + b × brain_RAM)`

This is a capacity model, not a measured provider density result. A 10× runner-memory gain needs `d < 10%` before accounting for the brain and cache; 50× needs `d < 2%`. A shared cache is economical when it is host-level and amortized; reserving a full dependency tree and process state in RAM per dormant session consumes the gain. **[E, I]**

**Billing has a different ceiling.** Cloudflare already bills Container CPU for **active usage only**, while memory/disk are provisioned-resource time. Hibernating the runner therefore primarily removes idle memory/disk; it does not remove CPU needed to compile/test. DO duration is billed for 128 MB while active or ineligible for hibernation; the documentation uses 0.128 GB in its calculation. [Container pricing](https://developers.cloudflare.com/containers/platform/pricing/), [DO duration pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/). **[F]**

For an illustrative **one-hour standard-2 session**, use **6 GiB memory, 12 GB disk, 180 active vCPU-seconds**, and the published marginal rates. Baseline runner cost is **$0.057024 memory/disk + $0.003600 CPU = $0.060624**. This excludes included allocations, account-level rounding/minimums, network, snapshot storage/operations, and frontend costs common to both alternatives. **[E]**

| Split scenario | Runner allocated time | Added brain duration | Modeled cost | Baseline / split |
|---|---:|---:|---:|---:|
| Ideal: 5% duty cycle, zero restore/tail | 180 s | 60 s | $0.006547 | **9.3×** |
| Same work, 30 resumes adding 2 s each | 240 s | 60 s | $0.007498 | **8.1×** |
| Runner stops; DO stays resident for the hour | 180 s | 3,600 s | $0.012211 | **5.0×** |
| Pinned runner, brain hypothetically free | 3,600 s | 0 | $0.060624 | **1.0×** |
| Pinned runner plus nonhibernating DO | 3,600 s | 3,600 s | $0.066384 | **0.91×** |

The 2-second resume overhead and 60 seconds of brain residency are **optimistic assumptions**, not measured Cloudflare behavior. In particular, waiting for an outbound model HTTP request/stream is pending I/O, not automatically a hibernation interval: Cloudflare says pending I/O retains an object and incurs duration charges. The nonhibernating workspace socket is an additional issue. Any storage/network/extra filesystem CPU cost reduces these ratios. Other duty cycles and baselines can exceed 10×; this example shows that 20× less allocated runner time does **not** automatically mean 20× less infrastructure money. [DO billing notes](https://developers.cloudflare.com/durable-objects/platform/pricing/). **[F, E, I]**

Two further arithmetic constraints:

- With a **30-second gap** between commands and a **60-second keepalive**, a runner never stops. Even a 5-second grace period adds **150 allocated seconds across 30 gaps**, before checkpointing. Choose a bounded lease from trace data. **[E]**
- Re-fetching the measured compressed dependency archive on **30 commands** moves **4.18 GB** and requires at least **335 seconds at 100 Mbit/s**, before unpacking. Its illustrative priced external egress would be about **$0.105**, already above the example baseline's complete runner cost. R2 read egress can make bandwidth dollars disappear; it cannot remove transfer time or runner memory/CPU during hydration. **[E, I]**

Finally, compare against **a whole-agent VM that also pauses and snapshots**. E2B already provides that pattern. A split must beat this optimized baseline, not just an artificially always-on machine. If preserving arbitrary process state is the main requirement, pausing the whole VM may be simpler than maintaining two filesystem views. **[I]**

The brief's jitk execution latency and VM-size claims are not workspace measurements: an almost-empty VM can start quickly while still needing hundreds of MiB of dependencies and cached files before its command becomes useful. Host-shared cached pages can help, but include their memory and miss rate in a density calculation. No jitk measurement was performed here. **[I]**

## 7. Early blockers, ranked by probability × damage

Scores are subjective **[E]**, on 1–5 scales; they rank risk in the naive implementation, not measured failure probabilities. Proposed tests below are hours-scale and have not been claimed as completed.

| Rank / score | Blocker, consequence, and evidence | Cheap verification and pass/fail threshold |
|---|---|---|
| **1 — 5×5 = 25** | **Runner destruction loses the expensive state.** Reinstalling/rehydrating dependencies and caches on every command erases latency and cost savings. Pi has 481 MiB dependencies versus 29 MiB source **[M]**; Cloudflare's disk is ephemeral absent restore **[F: snapshot docs above]**. | Replay 30 command bursts with actual runner termination between bursts; preserve source, dependencies, Git state, and caches through a snapshot/base. Test warm-host and forced cache-miss cases. **Pass:** no reinstall on unchanged lockfile; all overhead included in `d`; source/dependency correctness survives. To advertise 10×, measured end-to-end marginal cost must be ≤10% of the baseline, rather than just `d ≤ 10%`. **[E]** |
| **2 — 4×5 = 20** | **Lost or stale edits from two writers and incomplete checkpoints.** Rsync quick-check missed a same-size/mtime edit **[M]**; Computer documents conflict cases **[F]**. Untracked/ignored files and `.git/index` are not captured by ordinary source diffs. | Against native filesystem results, run a seeded trace of 10,000 operations: overwrite, replace-by-rename, delete/recreate, chmod, symlink, hardlink, Git staging, and generated/untracked files. Inject termination before/after publish/ack and delayed replies from an old runner. **Pass:** zero acknowledged-write loss, zero stale-writer publication, matching file bytes/modes/link relationships and Git status/index; ambiguous command completion is surfaced, not automatically rerun. **[E]** |
| **3 — 4×5 = 20** | **The filesystem connection or background jobs pin both halves.** Computer's current WebSocket backend does not hibernate **[F]**. A watcher/dev server/database continues writing after the command's parent exits **[I]**. | Close/detach the workspace transport after durable publication; evict the local workerd DO and reconstruct it. Record runner allocated intervals, socket/timer lifetimes, and pending jobs during 30 simulated model waits. **Pass:** ordinary waits retain no runner process allocation and no brain connection that prevents eligibility; ongoing jobs explicitly select a persistent mode and its cost. A local pass is necessary; actual provider billing eligibility still needs later platform verification. **[E]** |
| **4 — 4×4 = 16** | **DO memory/storage limits become a hard ceiling.** 128 MB isolate limit; 10 GB SQLite; 2 MB rows **[F]**. Materializing the whole checkout/dependency tree in Worker `/tmp` fails **[I]**. | Use local workerd with a >128 MiB virtual source corpus and large blobs stored outside the isolate; exercise reads/edits/search and crash recovery. **Pass:** peak working memory <96 MiB, bounded streaming, no object/row above supported limits, and dependencies never duplicated into DO storage by default. **[E]** |
| **5 — 4×4 = 16** | **Lazy loading becomes a metadata/working-set tax.** Recursive searches and compilers hydrate broad sets; remote metadata can dominate bytes **[I]**. Computer's full-install benchmark is ~2× ext4 before pull **[F]**. | Run `git status`, `rg`, a focused test, and one incremental build against native disk and the proposed mount. Emulate 5/20/50 ms storage RTT and 100 Mbit/s, then force an empty host cache. **Pass:** warm command p95 added latency ≤1 s; cold recovery-to-first-useful-command p95 ≤3 s for the declared target workload, and incremental build wall time ≤1.2× native. If full dependency hydration makes this physically impossible, narrow the target or abandon per-command teardown. **[E]** |
| **6 — 3×4 = 12** | **Write amplification and storage/operation overhead consume the margin.** Fixed chunks can amplify tiny edits **[M]**; Git pack replacement, large tree renames, and thousands of object PUTs can be expensive **[I]**. | Replay a source edit, lockfile/dependency change, large prepend, directory rename, and Git repack in scratch; count manifest records, bytes written/uploaded, operations, CPU, and retained versions. **Pass:** ordinary source boundaries upload ≤1 MiB and avoid whole-tree listings; large jobs are charged/handled as large jobs; the measured aggregate still meets the target cost ratio. Implement retention/GC before extrapolating monthly cost. **[E]** |

## 8. The design I would pick, and the experiment that decides it

Pick **C + F: a versioned source manifest and edit journal coordinated by the DO, backed by content-addressed durable objects, plus a reusable native runner environment snapshot/base and a private writable overlay**. Start with whole small files and compressed change packs. Add content-defined chunking or lazy mounts only where measured working sets justify them. For small repos, eagerly materializing the 9 MiB compressed source once per genuine cold start is simpler than implementing a new filesystem. **[I]**

The contract should be explicit:

1. **One durable root and one writer lease.** The DO stores `(workspaceVersion, manifestRoot, environmentSnapshot, leaseEpoch)`. Source blobs can live in R2/Artifacts; recent small file content can stay in SQLite. A durable reference is sufficient—do not require the full environment to live inside the object. Fork parallel agents from independent roots and merge their results explicitly. **[I]**
2. **Edits while hands sleep.** Pi file-operation adapters read/edit the canonical source version, append a journal entry, and publish durable bytes before acknowledging. Bulk search uses an index or bounded streaming; dependency/generated-file inspection can wake the runner. Arbitrary extension filesystem access remains a separately tested compatibility requirement. **[I]**
3. **Dispatch at a version fence.** Restore an environment/base, apply only source changes since its recorded root, and run on local native storage wherever possible. Keep `.git` staging/refs/local state with the environment snapshot; synchronize its checkpoint identifier with the source root. A Git tree hash alone is insufficient. **[I]**
4. **Collect command writes, then publish.** Capture all authoritative writes through a journal/tracked mount or a conservative checksum scan initially. Include new files, deletes, mode/link changes, and command-modified source even when the command fails. Upload blobs first, then transactionally advance the manifest/version and execution result in the DO, fenced by the current lease epoch. A partial multi-file sync is never exposed as a completed version. **[I]**
5. **Keep rebuildable bytes outside source sync.** Dependencies and caches use native paths retained in the environment snapshot or host-shared immutable bases. Classify durability explicitly; ignored does not automatically mean disposable. Any changed lockfile/setup input selects a new environment key. **[I]**
6. **Stop execution resources after publication/checkpoint.** Disconnect workspace transport; retain no runner solely to receive later patches. For an initial implementation, serialize source edits and shell writes around this boundary. If a background process must continue, charge a persistent-runner mode and exclude it from the split's density promise. **[I]**

Do not promise exactly-once shell execution. Persist execution IDs/results and fence stale completions, but a disconnected command may have performed external side effects before its workspace checkpoint. Retry source publication idempotently; report ambiguous command completion instead of silently replaying the command. **[I]**

**The three verifications to run first:**

1. **Lifecycle-and-cost replay, first.** In one afternoon, build a local subprocess runner plus manifest/change-pack prototype and replay 30 edit→command→wait cycles on Pi and one application with a real incremental build. Compare three modes: pinned native runner, whole-agent pause/snapshot where available, and split runner destroyed between bursts. Force one execution-host cache miss in five; model 100 Mbit/s and 20 ms RTT; measure restore, hydrate, command, pull, checkpoint, tail, allocated-memory seconds, CPU seconds, and object operations separately. Include initial setup separately and amortize it honestly. **Decides the 10× claim:** total modeled/provider-measured cost ≤10% of the best comparable baseline, plus the §7 latency thresholds. The present local delta experiment does not pass this test on its behalf. **[E]**
2. **Crash-and-Git differential test.** Use the §7 seeded mutation trace with two stale-lease runners, especially staged/untracked files, atomic replacement, command failure, and interruption between blob upload and root publication. **Decides viability:** zero acknowledged loss or stale versions. This is useful locally without any Cloudflare account. **[E]**
3. **Real adapter and mount check.** Exercise Pi's normal startup/configuration/extensions plus file tools under local workerd, and benchmark the selected runner filesystem on an appropriate Linux host when available. Start from Cloudflare Computer's source and explicit local-only paths. **Decides scope:** bounded memory, correct source visibility, supported Git operations, and acceptable test/build slowdown without a pinned connection. Linux mount behavior and actual provider snapshot/billing behavior remain unverified here; the existing prohibited execution-host VM was not touched. **[E]**

### Five-line TL;DR

1. **GO WITH CHANGES:** store a durable source version in the brain's storage plane; retain the full development environment independently of running compute.
2. **Measured:** Pi has 29 MiB tracked files, 481 MiB dependencies, and small edit bundles of roughly 0.3–3 KiB; delta bytes are not the main blocker.
3. **Already built:** Cloudflare Computer supplies the DO/FUSE/delta pattern; ArtifactFS, Replit, EdenFS, and BuildBuddy supply lazy-workspace/snapshot precedents.
4. **Reject the cheap version:** pinned session runners, whole dependency syncs, and per-syscall remote filesystems defeat the intended cost/density gain.
5. **Pick manifest + journal + cached native snapshot/overlay; decide with a forced-stop, cache-miss, crash-injected lifecycle replay that proves correctness and ≤10% total infrastructure cost.**
