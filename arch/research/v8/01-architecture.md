# Architecture feasibility: portable QuickJS/Wasm capsules

Research date: **2026-10-27**. Scope: architecture feasibility, following [BRIEF.md](BRIEF.md). **F** = source/documentation fact; **M** = measured in this rerun; **I** = inference or proposed design; **E** = effort estimate. All external sources below were checked on **2026-10-27**; an earlier publication/update date is given where useful. Oct 25 measurements are attributed to that record, not represented as new measurements.

## 1. Decision and the conditions that make it sound

**I — The design is sound for a restricted, versioned computer with explicit host-return checkpoints.** The portable object is a fixed QuickJS interpreter compiled to wasm32, its linear memory and remaining module state, and a durable host-side execution record. Guest JS runs in QuickJS; V8 executes the Wasm interpreter. A capsule is not an ordinary V8 isolate snapshot. Promise continuations, closures and cycles can stay as engine objects because this design captures the engine's memory rather than serializing user objects.

**M — The central mechanism reproduced today:** a newly created QuickJS instance in Wasmtime parked on a pending tool promise, its memory was copied, and fresh instances in Node resumed with different replies to produce 42 and 100. There were zero new tool emissions on either restore. The fresh memory image was byte-identical to the original Oct 25 image. Section 2 gives methods and limits.

**I — Four changes are required before calling this an end-to-end durable executor:**

1. Specify a quiescent checkpoint protocol; observing a tool import does not itself establish quiescence.
2. Persist the dispatcher, policy state, pending-call ledger, journal cursor and ownership alongside guest memory. Recreate trusted capabilities from host configuration.
3. Add qualified allocation accounting, deterministic compute budgets and deployment-specific termination. Same-thread JS timers cannot stop synchronous Wasm.
4. Separate the portable executor core from its Node dependencies, and separate durable execution lifetime from the current one-shot `execute()` lifetime.

**F, repository — The integration seam exists, but these changes are not implemented.** [backend.ts](../../jitk/executor/backend.ts) exposes `Backend.park(signal?, deadline?)` and `Sandbox.read/send/kill/exited/armDeadline`. [pool.ts](../../jitk/executor/pool.ts) owns admission and single-use sandboxes. [executor.ts](../../jitk/executor/executor.ts) already keeps tools, policy, credentials, approval and provenance on the host. Its `finally` marks the policy run dead, clears approvals, retires the sandbox and aborts tools. That lifecycle cannot represent an execution waiting three days for approval without a durable coordinator above it.

**I — Isolation remains a tier choice.** This is software isolation with the Wasm runtime, import wrappers and policy dispatcher in the TCB. Keep jitk for hardware isolation and native binaries. A native jitk memory image cannot be copied into wasm32; replay or an explicit application checkpoint must bridge them. Running the same Wasm capsule inside jitk could align formats, but that is additional, unproven integration.

## 2. Oct 25 spike: what I actually reran

### Artifacts, environment and method

**M — Evidence directory:** `/Users/noah/sofort-local-evidence/portability-wasm-2026-10-25/`, treated as read-only. `bridge.c`, `build.py`, `qjs.wasm`, `snapshot.py`, `snapshot.bin`, `snapshot.json` and `restore.mjs` all matched their entries in `SHA256SUMS.json`. I reused the existing binary; I did **not** rebuild QuickJS or independently reproduce the compiler toolchain.

**M — Local environment:** Darwin 25.6.0, arm64; Node **24.22.1**, V8 **13.6.233.17-node.58**; Python **3.15.0**, Wasmtime Python **50.0.1**. The reactor is **966,584 bytes**, built from Bellard QuickJS **2026-06-04**, with SHA-256:

```text
d239715db73722fecd733e0fa111626f47eafcb8067cfe189f596c42f0159df5
```

**M — Procedure:** copied `snapshot.py` and `restore.mjs` into `/tmp/v8-research-architecture/`, changed the hardcoded `/tmp/portability-wasm/` paths to this scratch directory, and symlinked the original `qjs.wasm`. The Python engine label was derived from the installed package version. The algorithms and guest workload were unchanged. `snapshot.py` instantiated and initialized a **fresh** reactor, evaluated the async workload, checked one emitted call and no completed output, captured memory/globals, and restored two Wasmtime forks. Then `restore.mjs` loaded that newly generated image into two fresh Node instances. This did not simply reload the old saved image.

```sh
PYTHONDONTWRITEBYTECODE=1 \
  ~/sofort-local-evidence/portability-wasm-2026-10-25/venv/bin/python \
  /tmp/v8-research-architecture/snapshot.py
node /tmp/v8-research-architecture/restore.mjs
```

**M — Workload:** the guest retains `{n:7}` with a self-cycle, a closure adding `state.n`, a `Uint8Array([2,3,5])`, and a `Map([['x',11]])`; it awaits `tool({value:7})`, then returns `{answer: reply + 7 + 5 + 11, cycle: true}`. This exercises these objects across the checkpoint, not just a numeric program counter.

| Claim | Result of this rerun |
|---|---|
| **M** Park on tool, snapshot, resume in Node | Reproduced: one call, ID 1, `test.echo`, arguments `[{value:7}]`; Node completed correctly. |
| **M** Fork into divergent answers | Reproduced in both Wasmtime and Node: reply **19** → `{answer:42,cycle:true}`; reply **77** → `{answer:100,cycle:true}`. |
| **M** No duplicate emission on restore | Reproduced: **0** new tool emissions in all four restored instances. These are stub calls, not a crash test of external side effects. |
| **M** Raw snapshot size | **2,097,152 bytes** (32 Wasm pages, exactly 2 MiB). |
| **M** Compressed snapshot size | **99,854 bytes** using the original script's `gzip.compress(memory)` defaults on this Python; explicit gzip level 9 produced **99,755 bytes**. Compression settings must accompany size claims. |
| **M** Image identity | New image SHA-256 **`eb468b13256f00ba8d4637340ff8ef53ecf2a3ae095bb7690518f54fbac3e3d2`**, identical to the Oct 25 saved memory image. |
| **M** Copy observations | Python capture **0.502 ms**; Wasmtime restores **0.258 / 0.245 ms**; Node restores **0.464 / 0.206 ms**. One capture and two restores per destination, without compression, storage, transport or cold startup in the restore-copy interval. |

**M — Size scope:** these sizes cover the linear-memory image only. The reactor module, metadata, host checkpoint, journal and storage envelopes are additional. The ~100 KB figure is not the total independently runnable capsule package.

**M — Module state inspected:** Wasmtime's module API reports five function imports, listed exactly in section 3. The saved mutable global is `__stack_pointer = 524288`. The supplied WAT has one mutable i32 global, one immutable i32 global, memory initial/max **32/512** pages, and a fixed-size **463-entry funcref table**. Its table is reconstructed by instantiating the same module. A text inspection found bulk-memory copy/fill and saturating conversions, but no `table.set/grow/init`, `memory.init`, `data.drop` or `elem.drop`; a production gate needs a binary parser, not this text search.

**F, Oct 25 record — Not reproduced today:** Chromium restore, local workerd restore, local Dynamic Worker restore, JSPI, Asyncify unwind/rewind, deterministic two-tool replay, preinitialized/Wizer cold starts, RSS density, tool round-trip throughput, allocator maximum enforcement or any hosted Cloudflare deployment. Those remain prior evidence in [02-wasm.md](../portability/02-wasm.md) and its raw directory. I also did not test x86, mobile, process-loss recovery, S3/R2/IndexedDB durability, concurrent pending tools or a malicious guest. Therefore the ~0.35 MiB RSS and ~0.15–0.3 ms fresh-instance claims are **not** newly validated here.

**I — Interpretation:** the rerun strongly supports exact-build, quiescent memory portability between two local runtimes. It does not establish cross-version heap compatibility, crash-safe effect delivery, arbitrary-stack capture, production deadline enforcement or a general snapshot-size bound. Larger live heaps, source text and retained tool outputs enlarge the image.

## 3. Concrete capsule and import ABI

### What the spike imports, exactly

**M — Actual `qjs.wasm` import list:**

```text
sofort.emit                         (i32 ptr, i32 len)                         -> ()
wasi_snapshot_preview1.clock_time_get(i32 clock, i64 precision, i32 result_ptr) -> i32 errno
wasi_snapshot_preview1.fd_close      (i32 fd)                                  -> i32 errno
wasi_snapshot_preview1.fd_seek       (i32 fd, i64 offset, i32 whence, i32 ptr)  -> i32 errno
wasi_snapshot_preview1.fd_write      (i32 fd, i32 iovs, i32 count, i32 written) -> i32 errno
```

**F, local source — The spike is a small embedding, not the QuickJS shell.** It compiles the engine C files plus `bridge.c`, excludes `quickjs-libc.c`, and uses `__EMSCRIPTEN__` branches to disable atomics/native stack checks and select switch dispatch. Its WASI stubs supply a constant clock and no file access. There is no `random_get` import: this release seeds `Math.random()` from `gettimeofday()` and keeps xorshift state in the QuickJS context. Source: the read-only spike's `build.py`, `bridge.c`, and `quickjs-2026-06-04/quickjs.c` (`js_random_init`, `js_def_malloc_usable_size`).

### Proposed production profile, distinct from the measured build

**I — Build a single, audited reactor with no general WASI capability.** Compile QuickJS, its allocator/libc support and a small bridge to wasm32. Put libc clock/error/diagnostic shims inside the module. Exclude shell modules, filesystem, sockets, dynamic native loading, threads, shared memory, externally backed buffers, externrefs and Wasm-GC state. Use an explicit feature profile covering the build's actual instructions, initially core wasm32 plus mutable globals, sign-extension, non-trapping float-to-int conversions and bulk memory **copy/fill**. Disallow passive-segment mutation, mutable tables and unexpected features in a build-time binary audit. A fixed function table is allowed; it must be recreated identically. This is a proposed profile to qualify, not a claim that the existing spike passed such an audit.

**I — Exact application import list for `capsule-abi/1`:** all imports are synchronous; none returns a host Promise or calls an export reentrantly.

```text
sofort.tool_call   (i32 ptr, i32 len)                     -> i32 status
sofort.clock       (i32 kind, i32 out_u64_ptr)            -> i32 status
sofort.random_fill (i32 ptr, i32 len)                     -> i32 status
sofort.log         (i32 ptr, i32 len)                     -> i32 status
```

**I — Import semantics:**

- `tool_call` copies a protocol-v1 `call` frame into a bounded host outbox. It does not perform the tool or settle the guest promise inline. `log` copies a protocol-v1 `log` frame. Completion/result/error are read from bridge exports after pumping, and `ready` is generated after trusted initialization; they require no extra import.
- `clock` writes a little-endian u64 in integer milliseconds. Kinds 0/1 are guest virtual wall/monotonic time, journaled for replay. Kind 2 is operational monotonic time for trusted interruption checks, unavailable to guest APIs and outside deterministic program inputs. On workerd this last kind cannot supply a continuously advancing clock; section 7 specifies the fallback.
- `random_fill` supplies bounded bytes for explicit seed/entropy requests; returned bytes and order enter the journal. Patch QuickJS initialization to use it explicitly, rather than deriving entropy from wall time. `Math.random` then advances the pinned in-memory PRNG deterministically. Do not call that PRNG cryptographic randomness. If a security randomness API is later exposed, specify it separately.
- Return 0 only on complete acceptance. Invalid ranges, unsupported kinds, journal/outbox exhaustion and quota violations end the turn/run; they cannot silently drop an effect. Validate unsigned pointer/length ranges without overflow against the **current** memory buffer and copy before returning. Reacquire views after memory growth. Host schema/state/budget checks remain authoritative even if the guest engine is compromised.

**I — Bridge exports:** `abi_version`, `init`, bounded input buffer/length accessors, `run`, `deliver_reply`, `pump(max_jobs)`, `status`, bounded result accessors, `memory`, and **every** mutable numeric global needed for restoration. Globals include the C stack pointer and any added metering globals. Replies are parsed as data and delivered through QuickJS APIs; do not extend the spike's numeric `JS_Eval("settle(...)")` convenience path into arbitrary reply-code interpolation. The trusted bootstrap preserves the existing codec, namespace proxy and protocol rules; replace `std/os` I/O and timers with bridge functions and explicit host scheduling.

**I — Resource profile:** start with the spike's 2 MiB initial / 32 MiB maximum linear memory and 512 KiB C-stack allocation as compatibility parameters, with a properly enforced inner heap cap. These are starting values to qualify, not demonstrated sufficient limits for arbitrary code. Hash the whole resulting module: this ABI-cleaned build will have a different identity from the Oct 25 binary.

## 4. TypeScript runtime and the existing Backend/Sandbox seam

**I — Normal one-shot integration:** add `wasm-qjs` to `Backend.kind` and `select-backend.ts`. A `WasmBackend.park()` acquires a fresh initialized instance and returns `WasmSandbox`. `send(run)` loads the validated source/namespaces, enters the bridge, and pumps bounded jobs; `send(ret)` settles one recorded resolver and pumps again. `read()` drains bounded validated ready/call/log/done frames. `kill()` marks the instance dead and stops/destroys its owner as necessary. `exited` resolves only when the instance is no longer executing and the owner/host queues no longer retain it, so pool capacity is not released early.

**F, repository — The dispatcher has more state than its current `snapshot()` exposes.** [dispatcher.ts](../../jitk/protocol/dispatcher.ts) tracks pending IDs and their byte charges, next ID, protocol phase, partial input, wire/frame/log budgets and inflight bytes. Its `snapshot()` returns statistics, not a restorable state. The executor also keeps `nextId`, pending dispatch Promises, log accumulation and provenance. Reconstructing just the QuickJS promise map would reset host budgets and lose outstanding-call ownership.

**I — Add a coordinator, not just a `snapshot()` method.** Keep ephemeral `execute()` behavior for codemode compatibility. Add durable `start/resume/checkpoint/fork/cancel` operations returning an execution handle and status. A `CheckpointableSandbox` capability can expose quiescence/capture and the backend can expose restore, while the coordinator owns the matching host checkpoint. Do not put a checkpoint pointer into the existing JSON tool protocol as if the guest could authorize it.

**I — Host checkpoint requirements:** serialize validated dispatcher state, pending call IDs/requests/byte charges, delivery/outbox state, counters, policy run identity, sticky private/untrusted labels, approval records, tool-registry/schema version, journal position and remaining resource grants. Awaiting host Promises are reconstructed as logical work records. Recreate closures, credential issuers, AbortControllers and transport handles from trusted configuration. The canonical checkpoint has no partially decoded frame and no reentrant import in progress.

**F, repository — A subtle policy hazard:** [policy.mjs](../../jitk/executor/policy/policy.mjs) gives each new run a random UUID, sends `${run.id}:${call.id}` as the tool idempotency key, and uses a process-local `WeakSet` of granted call objects. Those objects cannot be snapshotted. **I:** restoring must preserve the logical run identity for retries, restore taint/counters, and reconstruct authorization through host policy/approval records. Starting a new policy run and resetting taint is incorrect. Forks get new branch identities for new effects; approvals are re-bound or explicitly reissued for that branch and current policy, not copied as ambient authority.

**F, repository — Portability requires a source split:** `backend.ts` imports child process/fs/OS utilities at module load; `executor.ts` uses `node:perf_hooks` and `setImmediate`; `code.ts` reads the codec using `node:fs`; policy uses `node:crypto`, Buffer and a file-URL loader. **I:** extract a pure protocol/codec/policy state machine with injected clock, digest, scheduling, artifact loading, transport and termination adapters. Prebundle the bootstrap/codec as strings. Merely adding a backend class does not make the current package importable in a browser Worker.

## 5. Checkpoint format, page diffs and storage

**I — Use `wasm-quiescent/1`, an immutable manifest plus content-addressed blobs.** Hash a canonical encoding, such as a restricted canonical JSON schema with sorted keys and integers/decimal strings instead of host floating-point metadata. Use SHA-256 over domain-separated, **uncompressed** bytes; compression codec/version lives in the blob envelope, outside logical identity. A full image and a page-diff representation must be unambiguously distinguished.

```text
CheckpointManifest {
  format: "wasm-quiescent/1",
  moduleSha256, capsuleAbi, bootstrapSha256, sourceBundleSha256,
  semanticProfile, codecVersion, toolSchemaVersion,
  parentCheckpoint: hash | null,
  memory: { byteLength, maximumPages, chunkBytes: 4096,
            base: hash | null, changedChunks: [{index, blobHash}] },
  globals: [{exportName, wasmType, exactBits}],
  boundary: {phase: "ready" | "waiting" | "done", noActiveFrames: true},
  hostStateHash, appliedInputSeq, journalPrefixHash,
  resourceGrantHash
}

HostCheckpoint {
  logicalRunId, branchId, policyVersion, toolRegistryVersion,
  dispatcherState, pendingCalls, outboxAndDeliveryState,
  policyCounters, taint, approvalReferences,
  virtualClockState, randomInputCursor, timers,
  remainingComputeGrant, lifecycleDeadlines
}

BranchHead { generation, checkpointHash, journalHead, ownerEpoch, leaseExpiry }
```

**I — Exact numeric bits matter.** Encode i64 as bit strings/decimal strings, not JS numbers; encode float globals by bits if permitted. Record table shape/fingerprint and verify its immutable initializer against the module. Reject unexported mutable globals, mutable imported state, external object references or unrepresented data/element-segment drop state. The C heap, C static variables and QuickJS job queue are in linear memory; Wasm locals/operand/control frames are not. This distinction follows the [Wasm runtime-state model](https://webassembly.github.io/spec/core/exec/runtime.html) (spec checked 2026-10-27).

**I — Page-diff forks:** distinguish **64 KiB Wasm growth pages** from **4 KiB storage chunks**. The root manifest maps the whole address range, with a well-known zero-chunk hash. A child refers to its immutable parent and replaces only changed chunk indices, including chunks zeroed since the parent. Store exact memory length and newly grown chunks. A fork initially shares the checkpoint and journal prefix, creates only a branch record, then persists its divergent chunks/events. Start with comparing/hash-scanning every chunk at capture: portable JS has no universal dirty-page notification for Wasm. This is O(memory size) capture work and storage deduplication, **not** OS copy-on-write RAM sharing. Each runnable fork still needs private restored memory.

**I — Bound restoration cost:** cap delta depth (for example 8), periodically materialize a full page map, pack chunks to avoid thousands of object-store requests, and garbage-collect only blobs unreachable from retained branch heads/journal/snapshot roots. The depth and packing thresholds are initial engineering choices to benchmark. Plain browser/Node Wasm cannot memory-map an S3 parent and fault pages in on demand. Do not claim sparse physical restoration from a Merkle manifest alone.

**I — Capture/commit protocol:** fence the execution owner; stop reply delivery; return from every export/import and drain runnable jobs for the v1 waiting checkpoint; stage guest memory/globals plus host state at the same applied-input cursor. Upload blobs, journal blocks and the manifest, verify their hashes, then atomically advance the branch head with the expected generation/owner epoch. Only after that commit may the owner release the instance or report it durably parked. A storage failure leaves the prior head authoritative; retain the live owner or recover by replay. An interrupted upload leaves reclaimable unreachable blobs, not a half-published checkpoint.

**I — Restore:** load the committed branch head and verify tenant authorization, hashes, module/ABI/profile and resource bounds; resolve parent chunks; instantiate the exact approved module; perform only its specified reactor initialization; grow to the saved page count; overlay memory; restore mutable globals and host checkpoint; replay committed inputs after `appliedInputSeq`; then deliver the next input once. Do **not** initialize QuickJS again after copying the heap. A previously grown Wasm memory cannot be shrunk to an earlier checkpoint, so use a correctly sized fresh instance or reject an unsuitable pooled instance.

| Destination | Concrete storage/authority plan |
|---|---|
| **I** S3 | Immutable module/chunk/manifest/journal objects under hashes; conditional create for immutable keys, conditional generation update or a transactional coordinator for branch heads. ETags are concurrency tokens, not the capsule's SHA-256. |
| **I** R2 + Durable Object | R2 stores bulk immutable objects. A DO's persisted SQLite state holds branch heads, journal sequencing, call ledger, leases and approval references; a short transaction publishes pointers after R2 uploads complete. There is no cross-product R2+DO transaction: use the upload-then-publish protocol. |
| **I** IndexedDB | Separate blobs/manifests/journal/heads object stores. Hash/compress outside the write transaction, then publish local head and associated records in one readwrite transaction; request strict durability where supported. Synchronize committed roots to server storage before promising recovery after device loss. |

**F — Storage premises:** S3 supports `If-None-Match`/`If-Match` conditional writes ([AWS documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html)). R2 object reads/writes are strongly consistent, but simultaneous writes without fencing are last-writer-wins ([R2 consistency](https://developers.cloudflare.com/r2/reference/consistency/)). SQLite-backed DO storage supports transactional updates, including synchronous SQL transactions ([DO storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)). These properties support pointer publication; they do not make a remote tool and a blob upload one transaction.

**F/I — Browser persistence has weaker failure coverage.** IndexedDB has a `strict` durability **hint**, not an unconditional power-loss guarantee ([IndexedDB 3.0](https://w3c.github.io/IndexedDB/#transaction-durability), draft dated 2025-08-13). Storage quotas and eviction need handling; `navigator.storage.persist()` can request persistent storage ([WHATWG Storage](https://storage.spec.whatwg.org/), updated 2026-10-19). A killed tab cannot be assumed to receive a final checkpoint opportunity. A remote committed checkpoint/journal is needed for server-side recovery.

**I — Confidentiality and authenticity:** encrypt/access-control heaps and journals because tool outputs and source can be sensitive; content addressing is not authorization. Share deduplication only inside an allowed trust scope. Sign or authenticate committed manifests and resource grants. A browser can still mutate its working memory: a browser-uploaded heap is not proof that the approved program ran. Server tools must authorize every effect independently; if workflow-state integrity is required, replay/validate on a trusted executor before granting the effect.

## 6. Journal, replay and fork semantics

**I — Make the journal authoritative for committed interaction history; snapshots accelerate it.** Each ordered record contains branch/logical run, sequence, prior hash, event kind, request digest, exact bounded input/output bytes or blob hashes, policy/schema version and relevant call identity. Record source/init inputs, guest clock/entropy results, call intents, normalized authorized arguments, approvals/denials, validated tool replies/errors, delivery order, timer firings, cancellation and lifecycle changes. `Promise.race` makes delivery order observable; a list of unordered tool results is insufficient.

**I — Commit barriers are essential because imports are synchronous.** The import wrappers append clock/random/log/call data to a bounded in-memory turn buffer; they cannot await S3/R2 while a normal Wasm activation is live. Before dispatching any external tool, publishing logs/results or acknowledging a checkpoint, the host returns from Wasm and durably commits that turn's journal/outbox records. If an uncommitted turn crashes, recompute it from the prior committed boundary; no external effect from that turn may already have escaped. Exact replay refers to the committed history, not invisible work discarded before a commit. A deterministic persisted creation seed and explicit virtual-time inputs further reduce retry variation.

**I — Reply ordering:** persist a tool's validated/redacted result and its selected delivery sequence **before** invoking the reply export. A snapshot says which input sequence its bytes have incorporated. On failure between journal commit and guest delivery, restore/replay from that cursor; do not confuse “input durably selected” with “already applied to this heap.” Timer events use the same model; timers are logical host records, never serialized `setTimeout` handles.

**I — Replay algorithm:** instantiate the pinned build from creation or restore the latest compatible checkpoint; replay recorded inputs and scheduling decisions, intercept every tool request, compare its canonical request digest against the journal, return the recorded reply and never call the external tool. Clock/entropy reads consume their matching recorded events. A missing/mismatched record stops replay with divergence; it must not fall through to live dispatch. Replay policy-history events into host taint/counters, and reauthorize genuinely new effects against current policy. Reuse committed logs without printing them twice.

**F/I — Determinism needs a profile beyond clock/random.** Wasmtime identifies NaN payloads, relaxed SIMD and imports as sources of variation ([deterministic execution guide](https://docs.wasmtime.dev/examples-deterministic-wasm-execution.html)). Pin timezone/locale, source/module resolution, QuickJS build, codec, event order and allocation/resource semantics; omit `Intl`, host environment access and GC-observable APIs until qualified. Disable relaxed SIMD. Audit QuickJS/Wasm NaN behavior, especially float/typed-array bit observations, and normalize where needed; browsers do not offer Wasmtime's NaN-canonicalization configuration. A host-pressure `memory.grow` failure or forced deadline termination is an execution failure, not portable evidence of the same logical outcome everywhere. Cross-runtime replay remains a qualification target, not a theorem proved by this rerun.

**I — Effects and crashes:** durably write call intent before dispatch. Assign a stable idempotency key from logical branch + call ID, preserving it across retries. A crash after the remote effect and before its result is journaled leaves an **unknown outcome**. Retry automatically only when the tool supports idempotency or outcome lookup; otherwise require reconciliation or an explicit at-least-once contract. An operation log cannot manufacture exactly-once behavior in an unrelated external system. A fencing token must also be checked at the tool gateway; acquiring a new lease cannot cancel an effect already executing remotely.

**I — Fork rules:** share completed history and checkpoint bytes. Give each child a branch ID and newly authorized future budget; preserve existing resource consumption in history. Pending calls carry an explicit mode: share the original eventual result, inject a hypothetical result for an effect-disabled simulation, or dispatch a newly approved child operation with a new key. Never silently multiply an in-flight payment/write by the number of forks. Default demonstrations should fork at an unissued/read-only tool or approval boundary, with external writes disabled in simulated branches. Decide whether the cloned PRNG stream stays identical or is explicitly reseeded in a new journal event; for deterministic exploration, identical streams are the simpler default.

## 7. Pause points, budgets, pools and memory accounting

### Where pause actually happens

**F/I — The required condition is no live Wasm activation, not the presence of the word `await`.** Core Wasm execution frames are separate from linear memory ([Wasm runtime state](https://webassembly.github.io/spec/core/exec/runtime.html)). In this embedding, `tool()` constructs a QuickJS promise and synchronously emits a request. QuickJS's async JS continuation is heap state. Evaluation/job execution must then return to the host before copying memory. Capturing *inside* `sofort.tool_call` would miss the still-active C/Wasm continuation.

**I — V1 checkpoint policy:** support initialized READY, terminal DONE, and WAITING where every export has returned, runnable jobs are drained, no reply is being applied, and all wake sources are registered host calls/timers. Multiple unresolved tools are permitted if the complete pending set/order is represented. An `await Promise.resolve()` usually just schedules runnable jobs; it is not a durable external wait. An unresolved guest promise with no registered wake source is a deadlock, not a movable work item.

**I — Empty-stack snapshots could also capture a runnable QuickJS job queue after an export returns.** The queue itself is in memory. Supporting that later would allow job-boundary checkpoints; it does not allow portable pause halfway through a synchronous job. V1 deliberately chooses drained waiting boundaries for a smaller scheduling contract. `pump(max_jobs)` must still return periodically for host fairness and enforce cumulative job/compute budgets so a self-rescheduling microtask cannot prevent the host regaining control forever.

| Mechanism | What it preserves | Fit for this architecture |
|---|---|---|
| **I/M** Return to host after QuickJS async yield | QuickJS heap continuation; memory + globals; no active Wasm stack | Default. The minimal migration/fork path reproduced. Requires async tools and explicit safe boundaries. |
| **F/I** JSPI | Engine-owned suspended Wasm execution plus host Promise linkage | Useful for async host APIs behind synchronous C. The API provides no continuation export/serialization operation; copying linear memory does not move that suspended execution. Not the capsule mechanism. |
| **F/I** Asyncify | Transforms code to spill/reconstruct logical Wasm stack state through memory | Optional separate format/ABI for synchronous libraries. Needs transformed code, unwind data, entry/argument and pending-import state, exact rewind protocol and reentrancy rules. Not arbitrary-instruction pause. |

**F — Sources for the latter two:** [JSPI proposal](https://github.com/WebAssembly/js-promise-integration/blob/main/proposals/js-promise-integration/Overview.md), [V8 JSPI introduction](https://v8.dev/blog/jspi) (2024-07-01), and [Emscripten Asyncify/JSPI documentation](https://emscripten.org/docs/porting/asyncify.html). **F, prior evidence:** Oct 25 measured Asyncify at +57% raw module size and demonstrated a separate unwind/rewind clone. I did not rerun that experiment and it is not needed to justify the default design.

**I — Programming model:** normal JS locals, closures, Maps and cycles can survive an awaited tool. All external I/O, sleeps, approvals and entropy must use supported bridge APIs. There is no native filesystem, socket, browser DOM or Node module access inside QuickJS. Long compute loops must reach an explicit async checkpoint/yield tool if the user wants durable progress; otherwise they can only finish or be terminated and replayed from the preceding checkpoint. Cancellation is not a successful pause.

### Deadlines and deterministic compute grants

**F — Available engine hooks:** QuickJS documents `JS_NewRuntime2`, `JS_SetMemoryLimit`, `JS_SetMaxStackSize` and `JS_SetInterruptHandler` ([QuickJS manual](https://bellard.org/quickjs/quickjs.html), version 2026-06-04). **F, pinned local source:** the interrupt handler throws an uncatchable interrupted exception; it does not preserve an interrupted computation for later resumption. Its periodic poll count is not an exact count of JS bytecodes and does not uniformly price all C builtins.

**I — Use three separate controls:**

1. A deterministic cumulative compute grant, implemented by metering the fixed Wasm module or fully qualifying engine-level metering. Charge loops/basic blocks and size-dependent bulk operations, parser/regexp/BigInt work, with a versioned cost model. Meter exhaustion traps/terminates; it does not checkpoint. Put authoritative fuel in protected Wasm globals/host state, not solely in guest-writable linear memory. Capture/restore every added mutable global, and reconcile grants against trusted host records.
2. A host execution deadline, checked before each turn, tool dispatch, reply delivery and checkpoint publication, plus periodic interruption where a real advancing monotonic clock is available. Persist remaining grant/consumption so migration is not free budget reset. Keep guest virtual time separate from enforcement time.
3. An independent termination boundary. In Node run guest execution off the tool/supervisor event loop, with a terminable worker or process. For the current watchdog-strength guarantee even if trusted tools block Node, retain an independent supervisor/process watchdog. A shard can hold many idle instances but only one active turn; killing a shard loses its uncaptured neighbors, so retain their checkpoint/baseline or choose smaller failure domains. Browser Workers can be terminated by the owning page, subject to browser scheduling. Process/worker termination discards execution state and recovers from the last committed boundary.

**F/I — Cloudflare is different:** standard Workers do not supply a worker-thread API, and `Date.now()` is the time of the last I/O, unchanged while synchronous code runs ([Workers Wasm](https://developers.cloudflare.com/workers/runtime-apis/webassembly/), [web standards restrictions](https://developers.cloudflare.com/workers/runtime-apis/web-standards/)). Thus an imported clock polling that value cannot enforce a synchronous per-capsule millisecond deadline. Use deterministic metering, bound each entry, check elapsed time between entries/I/O and rely on platform CPU enforcement as the outer backstop. A strict independent millisecond-kill contract on ordinary Workers is **not proven**; route such jobs to a suitable executor rather than advertising equivalent watchdog guarantees.

**I — Lifetime semantics must be explicit:** retain the current absolute wall timeout for ephemeral `execute()`. Durable mode distinguishes execution expiry, active compute grant, per-tool timeout, checkpoint-storage timeout and wait/approval retention TTL. Pausing for a person does not implicitly disable the execution's business deadline. A stored approval cannot authorize work after its expiry or after policy revocation.

### Pools and memory

**I — Cache the compiled module once per owner, and pool pristine initialized runtimes.** Key pools by module/ABI/bootstrap/resource profile. Initialization contains no credentials/customer state. Creation time/seed is explicitly injected and recorded after acquisition, or bound by a per-execution init input; never accidentally give every pooled execution the same unrecorded entropy. Completed/used instances are disposed, consistent with the existing single-use pool. Checkpoint-restoration pools are distinct from READY runtime pools. Wizer is optional preinitialization; its output is a new module identity with its own baselines.

**F, repository — Pool integration details matter:** warm pools require a `ParkingGate` with measured idle-core evidence below 2%. Capacity includes creating/live/retiring sandboxes and waits for `exited`. **I:** qualify the Wasm gate rather than fabricate a receipt, preserve bounded refill/admission, and use portable scheduling in the shared core. Idle instances must not run timer/pump polling loops. Evicted durable capsules retain storage records, not live runtime capacity tokens; separately limit their storage, pending tools and resumes.

**F, pinned source — The spike's 16 MiB QuickJS heap setting is not a qualified allocation bound.** Its `__EMSCRIPTEN__` allocator's usable-size function returns zero, while the default allocator uses that value to update `malloc_size`. **I:** replace it with an allocator that accounts requested sizes, headers, realloc deltas and frees accurately; qualify JS heap, bridge buffers, libc arena and stack separately. Keep a hard declared Wasm maximum as the outer guest-memory bound. Add stack/recursion checks for the selected wasm32 port; the disabled native C-stack check must not be presented as working protection.

**I — Account five distinct quantities:** (1) live QuickJS allocations, (2) current/maximum linear memory including C heap/stack/static buffers, (3) host protocol/journal/tool buffers, (4) checkpoint materialization/compression/staging copies, and (5) shared engine code/runtime plus worker/process overhead. Stream hashing/upload and bound concurrency to avoid several full-image copies per checkpoint. Admission should reserve worst-case allowed memory and a bounded snapshot staging allowance; track actual RSS/physical charging separately. Node worker `resourceLimits` do not bound external `ArrayBuffer` allocations ([Node 24 worker documentation](https://nodejs.org/docs/latest-v24.x/api/worker_threads.html)); they are not a replacement for the Wasm maximum or process-level accounting.

**F/I — Avoid a density claim from unlike measurements.** Oct 25 reported ~0.32–0.38 MiB incremental RSS for small instances in shared runtimes, with 2 MiB logical memories; this rerun did not measure RSS. [The Oct 27 Linux ledger](../../jitk/bench/RESULTS-LINUX-MEMORY-2026-10-27.md) puts jitk and Hyperlight's shared-snapshot VMs close together (~0.515/0.495 MiB for `return 2`). That is not the same measurement/environment as Mac Wasm RSS. Portability and movable state are the sound case here; there is no demonstrated same-host all-in memory win over those hardware tiers.

## 8. Moving between Node, browser Worker and Workers/DO

**I — Move a reference to committed state, not a live `WebAssembly.Instance`.** The origin reaches a supported boundary, commits the checkpoint/journal, and relinquishes the fenced execution lease. The destination independently instantiates the approved module and restores state as in section 5. Pending tool ownership stays with the durable coordinator; result delivery is routed by logical run/branch/call ID, not the origin's socket or JS Promise. A new owner epoch prevents late results from reviving the old owner. Forking intentionally creates another branch; migration preserves one branch.

| Host | Adapter and lifecycle |
|---|---|
| **I** Node | Dedicated execution Worker or process, portable adapter over message transport, shared module cache, bounded READY pool, server tool broker. Watchdog remains independent where required. Store checkpoint/journal in S3/R2; local disk is an optional cache. |
| **I** Browser Worker | Page transfers a copied snapshot buffer/manifest to the Worker; Worker instantiates the same module, restores and pumps. The page authenticates to a trusted remote tool gateway or supplies explicitly local capabilities. IndexedDB caches/persists checkpoints; sync committed state to server for device-loss recovery. Do not transfer the live Wasm memory buffer as the migration protocol. |
| **I** Cloudflare Worker | Bundle approved `.wasm` modules at deploy time; choose by module hash. Restore heap bytes from R2 using the same ABI. Stateless requests load/advance/checkpoint bounded turns and return pending/completed handles, rather than holding a request open for human approval. |
| **I** Durable Object | One logical run/branch coordinator persists sequencing, call ownership, approvals and heads in storage; its in-memory Wasm instance is a cache. On reconstruction load the saved checkpoint + journal. DO serialization helps ownership, but retain explicit epoch/queue rules across asynchronous I/O and external executors. |

**F — Standard hosted Workers instantiate precompiled modules; runtime Wasm compilation from bytes is restricted.** Wrangler bundles `.wasm` imports ([Wasm in JS](https://developers.cloudflare.com/workers/runtime-apis/webassembly/javascript/)); `compile`, `compileStreaming`, `instantiate(buffer)` and `instantiateStreaming` are restricted in standard Workers ([web standards](https://developers.cloudflare.com/workers/runtime-apis/web-standards/)). **I:** fetching a new QuickJS module from R2 and compiling it in an ordinary Worker is not the deployment plan. Deploy/retain each supported module build, or separately qualify a Dynamic Worker loader design. QuickJS evaluating guest source inside the fixed Wasm interpreter does not call the host's `eval/new Function` APIs.

**F — Platform limits apply to the whole isolate:** published Workers limits are **128 MB** including JS/Wasm allocations; HTTP CPU allowance is **10 ms Free**, **30 s default Paid**, configurable up to **5 minutes Paid** ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/), checked 2026-10-27). **I:** snapshot staging, simultaneous instances and host objects all share that budget. Do not extrapolate a Mac's instance count to a Worker or assume the Free CPU allowance accommodates cold initialization and compression.

**F — Durable Objects keep in-memory variables only until eviction** ([in-memory state](https://developers.cloudflare.com/durable-objects/reference/in-memory-state/), updated 2026-06-29). **I:** neither a DO nor a browser gets automatic heap durability from awaiting a tool. Every acknowledged durable wait needs persisted state. Lost uncommitted compute may replay; committed external effects must not blindly repeat.

## 9. Versioning and portability: what can break

| Change | Raw image compatibility and required action |
|---|---|
| **I** Same module hash; different Node/browser/workerd runtime version | Intended portable case. Wasm pointers remain memory offsets; rebuild engine-native code/table objects from the module. Qualify required features, numeric behavior and imported ABI; do not store native engine frames or compiled caches. |
| **I** Same module hash; arm64 ↔ x86 host | Strong architectural expectation for this wasm32 profile, but **not tested in this rerun**. Run both migration directions and replay/floating-point/resource cases before certifying it. |
| **F/I** New QuickJS release, Bellard ↔ quickjs-ng, wasm32 ↔ wasm64/native | Incompatible by default: runtime structs, JSValue representation, bytecode, function tables, allocators and continuations differ. QuickJS's own bytecode is version-bound ([manual](https://bellard.org/quickjs/quickjs.html)); a whole heap has stricter dependencies. |
| **I** Same QuickJS version, different compiler/linker/options, bootstrap, allocator, metering or Wizer output | Also incompatible by default. Code/data layout, function-table indices and runtime invariants can change. A semantic version or release date alone is insufficient; require exact module hash and bundle/profile match. |
| **I** Different virtual-clock/random/locale/codec/scheduler/tool schema | Memory might copy, but execution/replay/authorization meaning can differ. Reject unsupported profile, migrate explicitly or keep the old adapter. |
| **I** Different CPU budget/host memory pressure or unsupported Wasm feature | May fail to run even with a valid image. Reject before acquisition where possible; resource grant changes are authorized/journaled. Runtime OOM is a failure path, not proof of replay divergence in the program. |
| **I** Native jitk ↔ Wasm | No raw-memory migration. Replay with verified matching semantics or use explicit application state. The existing native QuickJS build has different representations. |

**I — Version the envelope and execution build separately:** `formatVersion`, `capsuleAbi`, exact `moduleSha256`, source/bootstrap/codec hashes, semantic/cost model, tool schema and policy version. Maintain a runtime qualification matrix and a registry of approved build hashes with their import/global/table/memory manifests. Keep old modules available for the supported retention period. Debug metadata can name QuickJS/compiler versions but cannot replace the content hash.

**I — Upgrade policy:** restore old images using their old module and compatible host adapter; upgrade host internals when they preserve the declared ABI/profile. To move to a new QuickJS build, start from source and replay recorded inputs in a restricted mode, verify requests/results and then produce a new checkpoint at an explicit boundary. Replay may diverge when semantics change; fail closed. If a vulnerable old engine must be retired and replay cannot match, require an application-level state migration or expire the run. Do not silently reinterpret old memory or retain insecure engines indefinitely just to honor a format promise.

## 10. Component diagram and effort

**I — Proposed components.** The durable coordinator is shared across deployment adapters; the boxed capsule is the portable execution state. All effect authority stays to its left, behind the host broker.

```text
                        User / codemode / durable execution handle
                                          |
                          +---------------v----------------+
                          | TS executor + durable coordinator|
                          | policy / approvals / taint        |
                          | leases / journal / pending calls  |
                          +-----+---------------------+-------+
                                |                     |
                 +--------------v-------+   +---------v--------------+
                 | Trusted tool gateway |   | Snapshot + journal store|
                 | auth / idempotency   |   | S3/R2 blobs, DO/DB heads |
                 | credentials / effects|   | IndexedDB local replica |
                 +----------------------+   +------------+-----------+
                                                        |
                          +-----------------------------v-----------+
                          | Backend / Sandbox adapter                |
                          | Node owner | browser Worker | Worker/DO  |
                          | bounded pool / budgets / termination     |
                          +--------------------+---------------------+
                                               |
                            tool_call / clock / random_fill / log
                                               |
                          +--------------------v---------------------+
                          | QuickJS -> fixed wasm32 reactor            |
                          | bridge + trusted bootstrap + guest JS      |
                          | QuickJS heap, promises, closures, jobs      |
                          | linear memory + mutable numeric globals    |
                          +--------------------------------------------+
                                 no active Wasm frames at capture

                    checkpoint reference + journal cursor + owner epoch
                     Node <------> browser Worker <------> Worker/DO
```

**E — Effort below is engineer-days for an experienced implementer, starting from the spike and current repository.** It includes component-specific tests, excludes native jitk/Wasm embedding, account provisioning, UI, arbitrary customer Wasm, a security audit and operational on-call work. Rows are work packages, not independent elapsed-time promises. Some validation in the final row spans integration rather than repeating each component's tests.

| Component | Already supported by evidence | Remaining uncertainty/work | E days |
|---|---|---|---:|
| Audited QuickJS reactor/build/import manifest | **M:** existing reactor and imports inspected; cross-runtime raw restore | **I:** four-import build, deterministic init, feature/global/table audit, reproducible artifacts | 3–5 |
| Bridge + bootstrap + codec/protocol parity | **F:** minimal bridge; existing canonical protocol | **I:** full errors, timers, namespace/codecs, bounded pump/outboxes, hostile input behavior | 4–7 |
| Node Backend and portable executor-core split | **F:** usable Backend/Sandbox seam | **I:** adapter, Node dependency removal, off-thread owner, lifecycle hooks | 3–5 |
| Checkpoint/CAS/page-diff capture/restore | **M:** 2 MiB raw image + stack global; forks work | **I:** parent DAG, metadata, atomic heads, memory growth, corrupt/incompatible image rejection | 4–7 |
| Journal/coordinator/replay/effect and fork semantics | **F:** Oct 25 tiny replay record; current policy/idempotency seam | **I:** crash consistency, authorization reconstruction, completion races, leases, unknown outcomes | 7–12 |
| Allocation/stack/compute/deadline enforcement | **F:** hooks exist; spike accounting gap identified | **I:** qualified allocator, metering coverage/cost, resource-failure behavior, watchdog/platform integration | 6–10 |
| Pristine pools/admission/telemetry | **F:** pool implementation and Oct 25 initialization records | **I:** gate evidence, owner failure domains, staging-memory grants, refill/backpressure | 2–3 |
| Browser Worker + IndexedDB adapter | **F:** Oct 25 browser-tab restore record | **I:** actual Worker lifecycle/termination, persistence, authenticated tool bridge, eviction recovery | 3–5 |
| Hosted Workers + DO/R2 adapter | **F:** Oct 25 local workerd/Dynamic Worker records; documented platform APIs | **I:** real deployment, module retention, persisted coordinator, CPU/memory behavior under load | 4–7 |
| Build versioning/upgrade registry | **M:** exact original module and image hashes reproduced | **I:** compatibility policy, old-module routing, replay migration, retirement path | 2–4 |
| Cross-host/cross-ISA and crash/resource qualification | **M:** local Wasmtime→Node case only | **I:** bidirectional browser/Node/workerd matrix, kill-at-each-commit-boundary tests, nested JS/GC/NaN cases | 5–8 |
| **E Total** | | | **43–73** |

**E — Delivery scale:** roughly **9–15 engineer-weeks** for that scoped durable implementation, before an independent audit. A deliberately narrow Node backend proof remains plausible in **3–5 days**, and a live Node/browser checkpoint demo in about **5–8 days total** using the current ABI. Neither milestone should be labeled crash-safe production durability. The larger estimate covers host authorization/lifecycle, crash recovery, accounting and hosted qualification absent from the successful memory-copy spike.

**I — Go/no-go gates:** demonstrate protocol/codec equivalence at the seam; kill between every intent/effect/result/delivery/head-publication transition; restore grown memories and reject missing parents/wrong builds; verify budget persistence across move/fork; terminate JS loops, microtask loops and expensive C builtins without blocking policy; run the same build on x86/arm64 Node plus browser Worker and hosted workerd. These answer the main unknowns more directly than another trivial cold-start benchmark.

## 11. Five-line TL;DR

- **M:** Fresh Wasmtime → Node restore and divergent forks reproduced; both Node forks emitted zero new tool requests.
- **M:** The memory image is 2 MiB raw, 99,854 bytes with the spike's gzip defaults, and byte-identical to Oct 25.
- **I:** Use a fixed four-import QuickJS/Wasm reactor and snapshot only after control returns to the host; JSPI is unnecessary.
- **I:** Durable portability requires journaled effects, host policy/protocol state, fenced ownership, exact build hashes and qualified resource limits.
- **E:** Budget 43–73 engineer-days for the scoped durable system; the memory-copy proof is much smaller than that system.

**Verdict — GO-WITH-CHANGES for architecture feasibility.** **I:** proceed with the explicit checkpoint/lifecycle/resource contracts above; do not represent raw memory copying as completed durable execution or promise strict ordinary-Worker watchdog equivalence.

**The three things I would do next:**

1. **I:** Implement the Node `wasm-qjs` adapter with canonical protocol parity, an auditable build-state manifest and a checkpoint that includes dispatcher/policy state; preserve normal single-use semantics.
2. **I:** Build the durable call ledger + journal + fenced head-publication path, then crash it at every boundary using an idempotent write tool and an explicitly non-idempotent tool to expose unknown outcomes.
3. **I:** Qualify allocator/metering/termination, then run bidirectional Node/browser Worker/hosted Workers restores on arm64 and x86 with wrong-build, memory-growth, concurrency and budget-reset rejection cases.
