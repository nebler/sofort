# Workers + Durable Objects as the agent's brain and home

Research date: **2026-10-28**. Scope: brain execution, billing, persistence, filesystem, and existing implementations. **F** = sourced fact; **M** = measured locally in this investigation; **I** = inference/design recommendation; **E** = estimate or proposed acceptance threshold. Prices are USD, excluding tax.

## Decision

**Go-with-changes.** A durable agent brain and small workspace inside a DO are feasible and already implemented by Cloudflare. The premise that a DO can stop billing while its unchanged agent loop awaits an LLM stream is false. For the example workload, duration alone costs approximately **$0.00096–$0.00576 per agent hour**, before storage operations, ingress, execution hosts, and the account minimum. Against a specific $0.023/hour VM this is approximately **24×–4×**, not a general 10–50× infrastructure result. **I/E**, calculated below.

The larger discovery is prior art: **Cloudflare already offers a Pi Durable harness, a SQLite filesystem, and interchangeable isolate/container execution backends.** Reimplementing those layers should require evidence that they fail the intended workload. The remaining opportunity could be a better execution host, compatibility, economics, or developer experience; this layer alone is no longer a novel architecture. **F/I**. [Cloudflare Pi overview](https://developers.cloudflare.com/agents/harnesses/pi/), [Computer announcement](https://blog.cloudflare.com/cloudflare-computer/).

## 1. Billing: waiting on the model is charged in a DO

### What the billing rules actually say

**F:** Workers Standard charges CPU, not elapsed request duration: $0.02/million CPU-ms and $0.30/million inbound requests beyond inclusions. The paid subscription is $5/month. Network wait consumes no CPU. This rule does **not** replace DO duration billing. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

**F:** DO duration is wall-clock time while active or unable to hibernate, priced at $12.50/million GB-s. Each object is charged for **128 MB regardless of actual memory usage**, including when multiple objects share an isolate. Cloudflare's worked example uses **0.128 GB**, not 0.125 GiB. Included monthly usage: 400,000 GB-s and one million DO requests; excess requests cost $0.15/million. Usage beyond inclusions is rounded upward to whole billable units, including million-GB-s units. [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

**F:** Hibernation requires all handlers finished, no outstanding I/O or `waitUntil` promise, no open outbound connection, no scheduled JS timeout/interval, and no standard-WebSocket API usage. Thus **an awaited outbound fetch, its live response stream, or an awaited service-binding/RPC call prevents hibernation**. Pending operations protect against eviction for up to 15 minutes each; they accrue duration throughout. Hibernation discards JS memory. Merely persisting some state does not suspend a live JavaScript continuation. [DO lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/).

**I:** Moving `fetch(model)` into another Worker but awaiting that Worker's response from the DO does not fix the bill. Neither does switching SSE to an outbound WebSocket. The DO must persist a continuation and **finish its current operation**, with a later event supplying the result. Returning a still-active response stream from the DO also does not establish free waiting.

Hibernation is not restricted to WebSocket applications. An idle DO without sockets can sleep. The WebSocket Hibernation API adds the ability to preserve **accepted inbound** connections while the object sleeps; it does not checkpoint arbitrary outbound HTTP requests. **F**. [WebSocket guidance](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).

### One agent hour, with arithmetic that can be audited

**E:** Assume 120 sequential model turns, 5/15/30 seconds each. Use the union of intervals in which this one object cannot hibernate, not the sum of overlapping requests. Ignore tool execution initially to isolate the disputed claim.

```text
DO duration cost = active_seconds × 0.128 GB × $12.50 / 1,000,000 GB-s
                = active_seconds × $0.0000016
```

**F baseline:** AWS currently lists Linux/Unix US East (N. Virginia) `t2.small`, **1 vCPU / 2 GiB**, at **$0.023/hour**. It is a burstable instance, not a guaranteed continuously usable core; its CPU-credit allowance is 12/hour. This is a concrete reference, not the cheapest possible VM. EBS, networking, and inference are excluded on both sides where applicable. [AWS T2 specifications/prices](https://aws.amazon.com/ec2/instance-types/t2/).

| E: model duration per turn | Waiting seconds | DO GB-s | DO duration-only cost | VM / DO duration ratio |
| --- | ---: | ---: | ---: | ---: |
| 5 s | 600 | 76.8 | $0.000960 | 24.0× |
| 15 s | 1,800 | 230.4 | $0.002880 | 8.0× |
| 30 s | 3,600 | 460.8 | $0.005760 | 4.0× |

These are **unrounded rate-equivalent marginal costs**, not standalone invoices. The 30-second case fills the entire hour with inference waits; adding CPU and tools means fewer than 120 sequential turns fit in that hour. If the DO stays continuously active for an hour for any reason, duration is $0.00576 at these rates. Multiple sessions in one object share this duration but also its execution and memory constraints. **I/E**.

**E:** Add, for example, 120 separate DO submissions ($0.000018), 120 inbound Worker requests ($0.000036), and 1 ms ingress CPU each ($0.0000024): approximately **$0.0000564** at excess rates, before alarms and SQL. A persistent WebSocket protocol has different request counts. DO CPU is not an additional Workers CPU line item in this model; time executing it contributes to DO duration. If DO code spends another 100 ms CPU per turn outside the waits, 12 seconds adds $0.0000192 in duration. These assumptions are illustrative, not measurements of Pi.

**E:** A 10× advantage against $0.023 requires total split infrastructure below **$0.0023/hour**. With duration alone, that permits 1,437.5 active seconds, or **11.98 seconds per turn** at 120 turns. At 15–30 seconds, the simple one-DO-per-agent design already fails that threshold before the execution host. A 50× advantage requires under 287.5 active seconds, below even the 5-second case. Cheaper VMs, shared execution hosts, or smaller conventional processes reduce these ratios further.

### Inclusions, rounding, storage, and the rest of the bill

**E:** For monthly aggregate active seconds `A`, the DO duration portion of an actual paid invoice is:

```text
$12.50 × ceil(max(0, 0.128 × A − 400,000) / 1,000,000)
```

The account's $5 subscription and other meters are separate. One new account running one agent hour normally stays inside inclusions but still needs the subscription; an existing paid account may see zero incremental usage charge. The included duration covers roughly **868 continuously active DO-hours/month**. Conversely, the first duration overage can add $12.50 even for a tiny excess. Do not present either zero marginal usage or that first overage slab as the universal per-session price.

**F:** SQLite excess rates are $1/million rows written, $0.001/million rows read, and $0.20/GB-month; monthly inclusions are 50 million writes, 25 billion reads, and 5 GB-month. Alarm scheduling writes a row; deletion also counts as a write. [SQLite storage pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/#sqlite-storage-backend).

**M/E:** In the local Computer test below, 1,000 overwrites incurred 9,000 reported row writes. At that workload's amplification, 120 small-file overwrites would add about **$0.00108** at excess rates. A cold path-resolution test read **4.033 million rows for 1,000 stats**, equivalent to $0.004033 beyond inclusions. Those two effects can exceed the model-wait duration cost. They are workload/package-specific, and inclusions substantially change small deployments.

**F:** Pi Durable defaults to publishing partial progress at most every 100 ms, with deferred storage persistence within approximately 1 second, also flushing on relevant durable commits. Therefore counting one database write per completed model turn is unsafe; counting every token as a durable write is also inaccurate. [Pi Durable progress/persistence](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/durable/README.md#events).

**I/E:** Measure actual transcript/stream row writes, index amplification, retained storage, and recovery retries. For illustration, 3,600 progress checkpoints/hour at 5 billed row writes each would cost $0.018 beyond inclusions; **5 rows/checkpoint is an unverified sensitivity assumption**, not a Pi measurement. A 100 MB workspace retained for a month adds roughly $0.02 beyond storage inclusions. Cheap active compute is compatible with a material storage bill.

**F:** Cloudflare Containers now charge CPU by **active CPU use**, while provisioned memory and disk accrue while running. Current marginal rates include $0.000020/vCPU-second and $0.0000025/GiB-second. The baseline argument that every competing container bills a full allocated CPU during model wait is therefore too broad. [Container pricing](https://developers.cloudflare.com/containers/platform/pricing/), [active CPU change](https://developers.cloudflare.com/changelog/post/2025-11-21-new-cpu-pricing/).

**I:** A full comparison must add execution-host start/stop tails, workspace transfer/synchronization, ingress, R2 requests, retries, and retention. No whole-system 10× result is established here. Even taking the brief's 2–5% infrastructure share as an assumption, reducing that component 10× reduces today's total bill only 1.8–4.5%.

### Long model calls: SDK support and viable changes

**F:** The Agents SDK's fibers persist task/checkpoint data and recover interrupted work; `keepAlive()` uses a 30-second alarm heartbeat. `AIChatAgent` automatically protects model streaming with keep-alive. These mechanisms preserve/recover work rather than making model waits hibernatable. An interrupted upstream HTTP connection is lost. [Fibers](https://developers.cloudflare.com/agents/runtime/execution/durable-execution/), [keep-alive](https://developers.cloudflare.com/agents/runtime/execution/schedule-tasks/#keeping-the-agent-alive).

**F:** Current `PiHarness` uses durable wake jobs and passes `onWake` into Pi. It can sleep through retry backoffs, has a 30-second heartbeat while running, and hands alarm work off after 10 minutes. A single stream lasting more than the 15-minute alarm limit can be interrupted. The documentation explicitly says a running session keeps work in flight. [Pi limitations/recovery](https://developers.cloudflare.com/agents/harnesses/pi/#limitations). Release 0.30.0 added Pi 1.4 support and improved sleeping-task recovery; 0.30.1 fixes another sleeping-task wake case. [Agents releases](https://github.com/cloudflare/agents/releases).

**F:** AI Gateway's `cf-aig-request-timeout` measures time to the **first response**, so a stream can continue afterward. Gateway retries can prolong total elapsed time. This is transport handling, not a DO billing exemption. [Gateway request handling](https://developers.cloudflare.com/ai-gateway/configuration/request-handling/).

**F:** AI Gateway now also documents `/ai/run` background requests with `options.background: true` and `webhookUrl`, returning before generation finishes. Delivery is best-effort with **no webhook retry**. The example is image generation; the page does not establish that every frontier text/reasoning model and Pi provider path supports this mode. [Gateway background API](https://developers.cloudflare.com/ai-gateway/usage/rest-api/#background-requests-and-webhooks).

**I:** Three designs deserve comparison:

1. **Keep the existing DO loop:** accept $0.00576 per fully active hour plus other meters. This is the least integration work and can still be economical.
2. **DO as mailbox, Worker/Workflow as model-call executor:** commit a request ID and continuation; return from the DO; process the model elsewhere; deliver persisted results/chunks in short DO events. Do not hold a DO RPC or `waitUntil` open. Batch progress so every token does not wake and write the object. This changes the loop/provider contract and needs deduplication and reconnection recovery.
3. **Background model jobs:** submit and sleep, wake on callback or an alarm checking stored job status. First verify selected model support and recover missed callbacks. This loses ordinary live streaming unless another service owns the stream.

**F/E:** Workflows charge CPU, requests, storage, and steps, and explicitly do not charge CPU while awaiting API I/O. Excess steps are $0.80/100,000; 120 steps cost $0.00096 before CPU/storage. This can eliminate DO waiting charges but does not automatically beat the 5-second DO case. Streaming and step-result persistence need their own design. [Workflows pricing](https://developers.cloudflare.com/workflows/reference/pricing/).

## 2. Current limits and what they mean for a coding agent

The following use Workers Paid and **SQLite-backed** DOs, not legacy KV limits.

| F: constraint | Current documented limit |
| --- | --- |
| Isolate memory | 128 MB, shared across concurrent work; includes JS heap and Wasm |
| Worker global startup | 1 second; Worker bundle 64 MiB uncompressed |
| Subrequests | Paid default 10,000/invocation, configurable up to 10 million; Free 50 |
| Connections | Six simultaneously waiting for headers; received headers release that slot |
| HTTP / DO RPC duration | No hard wall limit while caller remains connected |
| DO alarm duration | 15 minutes |
| Worker after response/disconnect | `waitUntil` extension up to 30 seconds |

[Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

| F: DO/storage constraint | Current documented limit |
| --- | --- |
| CPU per HTTP request, message, alarm | 30 seconds default; configurable to 300,000 ms active CPU |
| SQLite per object | 10 GB Paid; 1 GB Free |
| SQLite KV entry | Combined key + value at most 2 MB |
| SQL text/BLOB/whole row | 2 MB |
| SQL statement / parameters / columns | 100 KB / 100 / 100 |
| SQL LIKE/GLOB pattern | 50 bytes |
| Incoming WebSocket message | 32 MiB |

[DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/).

**F:** The Hibernation API permits up to 32,768 accepted WebSockets per object, subject to memory/CPU. Application auto-responses avoid waking JS for static heartbeats. [DO State API](https://developers.cloudflare.com/durable-objects/api/state/#acceptwebsocket).

**I:** Do not confuse a CPU allowance with wall time. Also do not treat the six-connection rule as a universal maximum of six already-streaming models; current documentation specifically describes connections waiting for headers. Parallel models still accumulate heap, buffers, and provider limits. Use separate DOs for independent agents if clean per-agent state is more valuable than duration sharing.

**F:** Idle eligible objects currently hibernate after about 10 seconds, but eligibility already stops duration charging before physical hibernation. Ineligible idle objects normally evict after 70–140 seconds; pending I/O changes that behavior as described above. Constructors rerun after hibernation. There is no durable heap, file-descriptor table, timer callback, or closure. [Lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/).

**I:** A stock Node process that happens to run successfully is not yet a recoverable agent. Persist accepted inputs, turn IDs, intended tool calls, results, and committed workspace revisions. After failure, distinguish a completed external command whose response was lost from a command that never started. CPU limits must cover parsing, prompt assembly, JSON repair, search, hashing, and compaction—not just inference orchestration.

### Memory and cold starts

**F:** Cloudflare's own Oct 27 Pi profiling issue reports **25.0 MB heap after the first DO workload** for the then-current example; proposed combined fixes reduced it to 10.5 MB, or 8.8 MB without Git. These are maintainer workload measurements, **not M here**, not peak process memory, and not a long-context guarantee. [Issue #2735](https://github.com/cloudflare/agents/issues/2735).

**F:** A companion issue identifies quadratic streaming JSON work and substantial partial-generation copying/allocation in Pi; it also reports approximately 0.6 MB of schema-conversion allocation per workspace tool set. [Issue #2736](https://github.com/cloudflare/agents/issues/2736).

**I:** A 128 MB ceiling is plausible for a bounded text agent but unproven for the unchanged coding CLI plus long context, extensions, Git, large tool output, and workspace cache. Measure heap **and ArrayBuffer/external memory**, startup and streaming peaks, repeated compaction, and concurrent sessions. Avoid loading `node_modules` or the repository into JS memory. Context size in tokens is not a reliable heap budget because SDKs retain multiple representations and partial outputs.

**F/M:** SQLite APIs operate through synchronous queries/cursors; no documented rule requires loading an entire 10 GB database on activation. My 136 MB database reopened without reading all file contents, below. This is evidence of feasibility, not a production latency guarantee. [SQLite API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/).

**I:** Production relocation/cold-storage locality, database opening, schema migrations, and application rehydration are separate costs. Do not turn “DO startup is fast” into a promise that reconstructing a large transcript or scanning every workspace path is fast. No Cloudflare documentation found guarantees a cold-start percentile as a function of SQLite size.

## 3. Filesystem: reuse the existing implementation, then test its contract

### What Cloudflare already ships

**F:** workerd's built-in `node:fs` VFS is memory-backed: read-only `/bundle`, writable temporary `/tmp`, and selected `/dev` devices. It is not the DO's SQLite store. The docs describe `/tmp` as request-scoped and nonpersistent; all operations are implemented synchronously, even promise/callback variants. [Workers fs](https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/).

**M:** In the tested workerd version, `/tmp/probe` survived two separate requests to the **same live DO**, but disappeared on process restart. This observed DO-context behavior is narrower than the generic docs' request-scoped description. Either way, native `/tmp` is not durable storage; do not depend on cross-request survival.

**F:** `@cloudflare/computer` provides `Workspace({ storage: ctx.storage })`, durable file tools, a node-shaped provider, Git support, and execution backends. Its current status table labels the filesystem and JavaScript backend stable; shell, container/FUSE synchronization, and interrupted-run replay have experimental components. A documentation design proposal is not proof of implementation; the repository explicitly cautions that design docs are forward-looking. [Package status](https://github.com/cloudflare/computer/blob/b681446f0eaed8ad010bcd2f5e61b3680a6c02c4/packages/computer/README.md#status), [repository overview](https://github.com/cloudflare/computer/blob/b681446f0eaed8ad010bcd2f5e61b3680a6c02c4/README.md).

**F:** The SQL schema has inodes, directory entries, content-addressed blobs and ordered file chunks. Current code chunks content at **512 KiB**, stages streaming writes, and atomically installs file metadata/chunk references. Its blob cache is capped at 16 entries, approximately 8 MiB per database. This already addresses the 2 MB SQL row ceiling. [Schema](https://github.com/cloudflare/computer/blob/b681446f0eaed8ad010bcd2f5e61b3680a6c02c4/packages/dofs/src/schema/core.ts), [write implementation](https://github.com/cloudflare/computer/blob/b681446f0eaed8ad010bcd2f5e61b3680a6c02c4/packages/dofs/src/fs/writeFile.ts), [cache](https://github.com/cloudflare/computer/blob/b681446f0eaed8ad010bcd2f5e61b3680a6c02c4/packages/dofs/src/fs/blobCache.ts).

**F:** The public Workspace API is promise-based and supports streaming content, metadata, rename, symlinks, and file tools. The Dynamic Worker JavaScript backend exposes a Workspace-backed **subset of `node:fs/promises`**. This does not demonstrate that an unchanged package importing native `node:fs` sees that filesystem. [Agent filesystem documentation](https://developers.cloudflare.com/agents/tools/filesystem/).

### Recommended design if adaptation is necessary

**I:** Keep one authoritative mutable filesystem per agent in the DO. Use the existing inode/chunk model and transaction boundaries; keep generated files and metadata together. Treat the execution host as a projection of a named workspace revision, and return changes against that revision. For parallel writers, explicitly reject a stale base or merge changes; single-threaded JS does not prevent interleaving across `await` or protect against a disconnected execution host finishing late.

**I:** Prefer injected filesystem/tool interfaces. If the requirement remains “unmodified Node package,” intercept imports at bundle/module-loader boundaries for `fs`, `node:fs`, `fs/promises`, and `node:fs/promises`, including dependencies. Validate import styles and dynamic imports. Merely adding a provider object does not mount it into workerd's native VFS. Keep the shim bound to the current DO, not a global mutable session pointer.

**I:** Synchronous `readFileSync` can query **local DO SQLite**. It cannot transparently await a missing R2 blob or another DO. Offer asynchronous hydration, eagerly pin the bounded set of files needed by synchronous callers, or change those callers. A promise hidden inside a sync shim is not Node compatibility.

**I:** For large immutable content, use R2 keyed by content hash and keep metadata/chunk manifests in SQLite. Upload the immutable blob first, verify it, then atomically publish the manifest. A crash before publication leaves garbage rather than a visible broken file. Garbage-collect only after a grace period and reference checks. Whole-file rename can remain a metadata transaction; cross-DO moves and SQLite/R2 writes are not one atomic transaction. Don't store one mutable R2 object per tiny source-code edit without measuring requests and latency.

**F/E:** R2 Standard is $0.015/GB-month, $4.50/million Class A and $0.36/million Class B requests beyond inclusions; egress is free. It is cheaper for retained bulk bytes, but 120 separate writes cost $0.00054 at excess rates before reads. [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

### Semantics gaps that matter

**M:** Testing `workspace.provider()` from published Computer 0.8.0 found:

| Probe | Result | POSIX/Node implication |
| --- | --- | --- |
| Open file, rename path, read from old fd | `ENOENT` | A real open fd continues to name the inode |
| `realpathSync` on a valid symlink | Returned the symlink's path | Realpath should resolve to the target path |
| `accessSync(path, R_OK)` with mode `000` | Allowed | Provider checks existence; permissions are not equivalent to an ordinary unprivileged process |
| Symlink target renamed away | Following link gave `ENOENT` | Expected dangling-link behavior |

**F/I:** Current source stores fd state by path, returns a canonicalized spelling for `realpathSync`, and ignores `accessSync`'s mode argument, consistent with these probes. Additional unsupported provider operations exist, including `internalModuleStat`. A node-shaped method list is not complete compatibility. [Provider implementation](https://github.com/cloudflare/computer/blob/b681446f0eaed8ad010bcd2f5e61b3680a6c02c4/packages/dofs/src/provider.ts).

**I:** Differentially test append/exclusive flags, short/positional reads, truncate, hard links, open-unlink, symlink loops, cross-directory rename, directory ordering, error codes, UTF-8/binary paths, timestamps, and watcher cleanup. Do not assume OS ownership, advisory locks, mmap, device files, or cross-process fd sharing. A JS watcher implemented with repeated timers also changes hibernation economics. On eviction, reopen by durable identifiers/revisions; fd integers and stream readers cannot survive.

### Local experiment: actual published Computer on workerd DO SQLite

**M setup:** macOS 26.6.1 arm64; supplied **workerd 2026-10-25** binary; compatibility date `2026-10-25`; published **`@cloudflare/computer@0.8.0`**, esbuild 0.25.12. A `Brain extends DurableObject` constructed `Workspace({storage: ctx.storage})`. A workerd Cap'n Proto config enabled SQL and persisted to a local disk service. No Cloudflare account, deployment, paid API, model call, Docker, or KVM access was used.

**M method:** Python `perf_counter` measured localhost HTTP batches. Seven samples per operation, same object, 1,000 files of 4 KiB. Content reused 251 byte patterns, so deduplication and warm caches benefit these figures. Timings include HTTP overhead and local persistence, but not production replication or geographic latency. Rename batches did two renames per iteration. Row instrumentation was a separate run, after timing, using SQL cursor counters.

| M: operation | Median batch wall time | Amortized per operation |
| --- | ---: | ---: |
| No-op request | 0.757 ms | 0.757 ms |
| 1,000 warm `stat`s | 6.599 ms | 6.6 µs |
| 1,000 streamed 4 KiB reads, consumed | 33.921 ms | 33.9 µs |
| 1,000 4 KiB overwrites | 47.745 ms | 47.7 µs |
| 100 rename-out/rename-back pairs | 14.995 ms | 150.0 µs/pair |

**M:** A **128 MiB** file, generated and written incrementally in 512 KiB chunks, completed in **792.4 ms**. Each chunk had 64 KiB random bytes and zero-filled remainder, avoiding identical-chunk deduplication. SQLite reported **136,114,176 bytes** total. After a process restart, consuming the file stream read exactly **134,217,728 bytes in 256 chunks**, taking 149.3 ms. This checks size/persistence/streaming, not a complete hash comparison or production memory-limit enforcement.

**M:** Five clean workerd restarts reused that database. After an outer-Worker health check confirmed readiness, the first DO request—which constructs the Workspace—took **1.69–14.07 ms**, median **1.84 ms**. The first 1,000-path stat batch then took **149.8–173.2 ms**. This separates opening the database from rewarming the filesystem. The OS page cache was not cleared; this is a process restart, **not a production relocation/cold-disk benchmark**.

**M:** Row counters showed 9,000 writes/11,000 reads for 1,000 overwrites; 2,200 writes/4,400 reads for 100 rename pairs; and 4,000 reads for 1,000 warmed content reads. More significantly, 1,000 uncached path stats read **4,033,000 rows**, through the recursive path-resolution CTE; repeating the batch read **1,000 rows**. A fast warm benchmark hides materially different SQL cost. Scaling that cold query pattern to a large tree is an early verification target, not a demonstrated asymptotic result.

**I:** The experiment passes the narrow question “can we keep durable files larger than isolate memory and perform useful file operations in a local DO without building a filesystem?” It does not pass “can we run the unchanged Pi CLI within 128 MB?” or “is production rehydration always milliseconds?”

Small evidence is retained at `/tmp/split-brain/results.json`, with `bench.js`, `bench.capnp`, and replay scripts in the same scratch directory. Reproduction requires reinstalling the pinned packages there, bundling `bench.js` with `cloudflare:workers` external, and running the supplied binary against the config. Generated SQLite state, dependencies, and bundle were removed after measurement; all spawned workerd processes were stopped.

## 4. Prior art: this split already exists

**F:** The brief's Pi identity is historical. npm currently marks `@mariozechner/pi-coding-agent` **0.73.1** deprecated in favor of `@earendil-works/pi-coding-agent`; current source identifies the latter at **1.4.0**. `badlogic/pi-mono` resolves to the current Earendil Pi project. Pi's current package family separately includes the interactive CLI and **`@earendil-works/pi-durable`**. [Current Pi repository/package family](https://github.com/earendil-works/pi), [coding-agent package](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/coding-agent/package.json), [legacy npm metadata](https://registry.npmjs.org/@mariozechner%2Fpi-coding-agent/latest).

**F:** Cloudflare's current Pi example actually constructs a plain DO, PiHarness/Lifecycle, SQLite Workspace, Workspace tools, WebSocket sessions, a Workers AI provider, and a Dynamic Worker JavaScript backend. It includes Git host operations. This is a complete model/tool loop hosted inside a DO, not a DO merely supervising a model loop on a VM. However, it uses **Pi Durable and adapted tools**, not an unchanged historical Pi coding-agent CLI. [Example server](https://github.com/cloudflare/agents/blob/d69277b51d073065e037fe9072dadaa2555d0037/examples/next/harnesses/pi/src/server.ts), [tool adapter](https://github.com/cloudflare/agents/blob/d69277b51d073065e037fe9072dadaa2555d0037/examples/next/harnesses/pi/src/workspace.ts).

**F:** Cloudflare also documents an **OpenCode Workerd SDK harness inside a plain DO**, with SQLite sessions, agent-loop recovery, models, and bundled plugins. It is another direct counterexample to “a full agent loop needs a persistent VM,” while remaining an adapted embedded API. [OpenCode harness](https://developers.cloudflare.com/agents/harnesses/opencode/).

**F:** Project Think introduced persistent sessions, subagents, recoverable execution, and code execution in April 2026. Cloudflare's Flue integration likewise describes each agent becoming a DO with a SQLite workspace and optional execution. [Project Think](https://blog.cloudflare.com/project-think/), [Flue integration](https://blog.cloudflare.com/agents-platform-flue-sdk/).

**F:** Cloudflare's September container redesign explicitly describes an agent loop in a DO that starts a Linux workspace only for shell/compiler/dev-server work. It also offers per-task image/instance selection and workspace snapshots. That is substantially the proposed brain/hands split. [Container architecture](https://blog.cloudflare.com/faster-agent-sandboxes/).

**F:** Artifacts is now **open beta for Workers Paid**, as of October 1, rather than the closed beta shown in older indexed pages. It stores Git-compatible versioned trees, with operations/storage billing starting October 14. New repos have a **1 GB** limit (older pre-September-29 repos 10 GB). Excess pricing: $0.15/1,000 operations and $0.50/GB-month. [Open beta changelog](https://developers.cloudflare.com/changelog/post/2026-10-01-artifacts-open-beta/), [limits](https://developers.cloudflare.com/artifacts/platform/limits/), [pricing](https://developers.cloudflare.com/artifacts/platform/pricing/).

**F/I:** ArtifactFS uses blobless cloning and **FUSE** to lazily hydrate a working tree on an execution host. It is useful for handing large repos to the hands, not a direct persistent `node:fs` mount inside workerd. Artifacts supplies history/forks/exchange; Computer supplies the mutable local agent workspace. [ArtifactFS](https://developers.cloudflare.com/artifacts/guides/artifact-fs/).

## 5. Early blockers, ranked by probability × damage

Scores are **E**, on 1–5 scales; probability means risk to the **original claim**, not probability that Cloudflare itself fails. Confirmed invalid assumptions receive probability 5. Experiments below require hours, not a compatibility project. No production billing experiment was run under this brief's no-account/no-deploy rule.

| Rank | Blocker and score | Why it matters; evidence | Cheap verification and pass/fail |
| --- | --- | --- | --- |
| 1 | Free model waiting is false; **5×5=25** | Confirmed wall-clock billing; direct 15–30 s case misses 10× before other costs. Sections 1–2. | **2–4 h:** replay 120 recorded or synthetic turns, log active intervals, SQL cursor rows, alarms and execution-host time, then price aggregate monthly usage including rounding. **Pass:** total infra ≤$0.0023/hour for the stated $0.023 baseline over representative sessions; otherwise withdraw the blanket 10× claim or change architecture. Local traces estimate usage, not a billed invoice. |
| 2 | Claimed new brain/home already shipped; **5×4=20** | PiHarness + Computer + on-demand execution are direct prior art. Section 4. | **2–4 h:** run Cloudflare Pi example locally with a scripted provider and the intended edit/tool task. **Pass:** identify a measured unmet requirement worth building; **fail:** the proposed product is principally a duplicate of the SDK example. |
| 3 | Unchanged CLI/process lifecycle is not durable; **4×5=20** | Hibernation erases heap; fd probe fails after rename; native fs is not SQLite. | **3–4 h:** use Node and workerd against the same filesystem corpus, then kill between input acceptance/tool intent/result commit. **Pass:** no acknowledged edit lost; deterministic file/error parity for APIs Pi actually calls; no duplicate external command when the response was lost. **Fail:** wrapper must silently change core semantics or cannot resume. |
| 4 | 128 MB/CPU budget fails on real context; **3×5=15** | Existing Pi example fits one workload, but current issues expose allocation/streaming costs. | **3–6 h:** scripted 120-turn run at the chosen model's maximum supported context, with 1/8/32 MiB tool outputs, a 128 MiB streamed file, and compaction. **Pass:** peak total accounted memory <96 MB (25% headroom), no leaks after repeated runs, no CPU-limit failures, usable cancellation. Test additional concurrent sessions separately. |
| 5 | SQL amplification/retention defeats savings; **4×3=12** | Measured 9 writes/overwrite and 4.033M cold-read rows/1,000 stats; model checkpoints add unknown writes. | **2–4 h:** instrument actual Pi storage and Computer SQL across warm/cold 1k/10k/100k-file trees. **Pass:** full priced trace remains inside rank-1 target; **fail:** optimize/query-plan/batch or stop claiming the target. Do not rely solely on generous monthly inclusions. |
| 6 | Workspace rehydration/synchronization becomes the latency bottleneck; **3×4=12** | Local DB opens quickly; cold paths cost more; large execution-host projection remains untested. | **3–6 h:** persist 256 MiB with distinct chunks, restart without scanning, then read one small file; repeat with 100k paths and execution-host edit return. **Local pass:** first useful read <250 ms p95 after runtime readiness, no whole-workspace allocation. **Correctness pass:** stale-revision updates rejected or merged, interrupted publication leaves old/new complete file. Production geography/replication remains a separate later measurement. |

## Five-line TL;DR

1. **F:** A DO holding an outbound model stream bills wall-clock duration and cannot hibernate during the wait.
2. **E:** 120 × 5–30 s costs $0.00096–$0.00576 in duration alone: about 24×–4× versus a $0.023/hour 1-vCPU/2-GiB VM.
3. **F:** Cloudflare already runs Pi Durable/OpenCode loops in DOs and ships Computer's SQLite workspace and execution adapters.
4. **M:** Published Computer worked locally, including 128 MiB persistence/streaming, but fd/realpath parity and cold SQL-read amplification failed important assumptions.
5. **I:** **GO-WITH-CHANGES:** reuse the existing durable harness/workspace, bound memory and recovery semantics, and prove total economics before promising 10×.

**The three verifications to run first:** (1) replay and price the complete 120-turn trace, including SQL and execution-host tails; (2) run the existing PiHarness/Computer example under the 96 MB peak-memory threshold with large context and compaction; (3) run Node differential filesystem probes plus forced restarts at tool/commit boundaries. These decide the cost, capacity, and correctness claims before growing a Node compatibility layer.
