# The cross-machine contract: move computation, keep effects at home

Research/design date: **2026-10-28**. Follows [BRIEF.md](BRIEF.md). **F** = sourced fact, including attributed prior local evidence; **M** = measured/checked in this research; **I** = inference or proposed normative contract; **E** = estimate. All external sources linked here were checked on **2026-10-28**; publication dates or documentation versions are identified where available. All v1 requirements, types, algorithms, tables and examples below are **I**, unless explicitly marked otherwise. This is a proposed protocol, not a claim that the spike implements it.

## 1. Decision and scope

**I — A capsule may move its continuation, but must not move its authority or the identity of an already accepted operation.** Implement one trusted, durable **home broker** for a run and its branches. Executors in Node, browser Workers and Workers/DOs run the same approved QuickJS/Wasm build. The home owns the journal, pending operations, deadlines, capability grants, approvals and budget accounts. An executor owns only a fenced right to propose the next turn. The home's outage suspends progress; there is no offline authority transfer in v1.

**I — The implementable v1 is deliberately asymmetric:** a trusted server may continue directly from a trusted snapshot; a user-controlled phone may execute a speculative copy, but its returned memory cannot become an authoritative continuation. A trusted executor must independently reconstruct the authoritative state. This sacrifices some CPU offload benefit to preserve the workflow's integrity.

**F — Existing evidence, not rerun here:** the [Oct 25 spike](../portability/02-wasm.md) established exact-build, empty-Wasm-stack heap restoration and divergent stub replies across local runtimes. [V8 architecture §§5–9](../v8/01-architecture.md), [landscape](../v8/02-landscape.md), [roadblocks](../v8/03-roadblocks.md), [tech stack](../v8/04-techstack.md), [demo](../v8/05-demo.md) and [signal](../v8/06-signal.md) separate this from durable effects, resource enforcement and untrusted-state acceptance. The four-import ABI below is a new profile; the spike's WASI imports and integer-only reply helper do not implement it.

**I — Three invariants are the contract:**

1. **One authoritative continuation per branch:** only the current `(branchId, ownerEpoch, turnId, expectedHead)` may commit. Copying a file creates no owner, grant or budget.
2. **One identity per accepted operation:** transport retries, moves and all inherited fork observers refer to the original `callKey`. A replay never sends an external request.
3. **Authority and conserved resources live outside the heap:** the broker authenticates, authorizes and reserves resources before releasing effects. Heap counters, claimed approvals and cap names are untrusted assertions.

**I — Compute relevance:** this moves CPU-side orchestration and data transformations, and can externalize sleeping application heaps. It does not move a provider's GPU kernel, HBM/KV allocation or origin service. Keeping effects at home also keeps their network path there. As the [systems](../moonshots2/05-systems.md) and [compute](../moonshots2/01-compute.md) reports explain, accelerator savings require a separate inference-serving integration; this contract does not establish them.

## 2. Semantics to borrow, with their limits

| Primary-source fact (**F**) | Consequence for this design (**I**) |
| --- | --- |
| Temporal compares replayed commands with event history; activities are separate work whose implementations should be idempotent. [Workflow execution](https://docs.temporal.io/workflow-execution), [Activities](https://docs.temporal.io/activities), current docs. | Compare the exact operation request before supplying a recorded result. Treat an interrupted external attempt separately from replaying the guest. |
| Restate journals nondeterministic step results, provides retry-stable random/time helpers, and retries failed steps. [Durable Steps](https://docs.restate.dev/develop/ts/durable-steps), current docs. | Deterministic inputs and persisted results are necessary; a failed HTTP step is still subject to the external service's deduplication contract. |
| Golem's v1.6 oplog includes host interactions, clocks, random values and concurrent completion order. Its docs distinguish internal exactly-once calls from outgoing HTTP, which needs the remote service to honor its idempotency key. [Durable execution](https://learn.golem.cloud/v1.6/concepts/durable-execution). Its [`fork()`](https://learn.golem.cloud/v1.6/develop/forking) creates an independently identified continuation. | Journal delivery order as well as results; make fork identity explicit. Do not translate an internal journal guarantee into an unconditional external-effect guarantee. |
| E describes a vat as an event loop, checkpointable between turns with an empty stack. Its persistent-vat model breaks live cross-vat references on revival and uses offline references to reconnect. [Message passing](https://www.erights.org/elib/concurrency/msg-passing.html), [Miller's dissertation, 2006, §17.4](https://erights.org/talks/thesis/markm-thesis.pdf). | Treat the capsule as a small vat: heap plus inbox/outbox and logical references. Reconstitute connections; never serialize a session as if it were a durable resource. |
| Waterken's Ken lineage buffers output during a turn, commits state and output before transmission, and retransmits protocol messages with receiver deduplication. It explicitly gives outside-world I/O weaker guarantees. [Yoo et al., USENIX ATC 2012, §3.1; updated 2012-07-20](https://www.usenix.org/system/files/conference/atc12/atc12-final206-7-20-12.pdf). | Commit the checkpoint and effect outbox together. Choose this output barrier explicitly; do not assume E-style eventual-send alone supplies transactional external effects. |
| Cap'n Proto pipelines dependent operations by referencing an unresolved result; disconnects break connection-served capabilities. [RPC protocol](https://capnproto.org/rpc.html). Cap'n Web's [README](https://github.com/cloudflare/capnweb) describes object capabilities and pipelining; its [session guide](https://github.com/cloudflare/capnweb/blob/main/packages/docs/src/content/docs/guides/sessions.mdx) says tables are session-local, pending calls reject on disconnect, and reconnection needs fresh stubs. | Pipelining saves round trips; it supplies neither persistent promises nor exactly-once effects. Use Cap'n Web optionally between host and broker, with durable operation IDs above it. No serialized RPC stubs or pipeline graphs in v1. |
| E's mint/purse example models nonnegative conserved balances and transfer through narrow authority. [From Objects to Capabilities](https://erights.org/elib/capability/ode/ode-capabilities.html), historical E documentation. Cap'n Web also requires application operation limits and runtime validation. [Security guide](https://github.com/cloudflare/capnweb/blob/main/packages/docs/src/content/docs/guides/security.mdx), current source. | Fork a resource account by debiting the parent and crediting children in one transaction. Charge operations, bytes and outstanding references, not HTTP requests alone. |
| Restate sagas use compensating actions, require idempotent compensations, and discuss registering compensation before a one-shot keyed operation. [Sagas](https://docs.restate.dev/guides/sagas), current docs. | A refund is a new effect with its own identity and authorization. Compensation does not erase the charge, unsend an email or resolve an unknown outcome by itself. |

## 3. Execution, persistence and ownership

**I — Small deployment:** one broker service plus SQLite on a trusted Node host; one database transaction covers all branches of a run. Store immutable compressed images on local disk initially. A SQLite-backed Durable Object with R2 blobs is an alternative adapter, not a second implementation required for v1. Upload/write blobs first; atomically publish their hashes, branch head, journal entries, new operations and budget reservations afterward. Unpublished blobs are garbage. Never hold a SQL transaction open while making HTTP requests.

**I — Minimum tables:** `runs`, `branches`, `turns`, `events`, `operations`, `attempts`, `observations`, `grants`, `effect_permits`, `budget_accounts`, `reservations`, `snapshots`. Use unique constraints on `(branch, localId)`, `callKey`, `(branch, eventSeq)` and `(tenant, businessPermit)`. Append-only event rows are hash chained. An operation's outcome is write-once; reconciliation may fill an unknown outcome but cannot replace an already known receipt.

**I — Turn:** select at most one external input, enter the guest, drain runnable jobs with a bounded pump, then return fully to the host at `WAITING` or `DONE`. No imports or exports may be active, no partially decoded frame, and no unregistered native wake source may exist at capture. Multiple pending guest promises are allowed, up to the cap. A bare unresolved promise with no registered host wake source is a deadlock. CPU loops and endless microtasks exhaust a grant and fail the attempt; cancellation is not a successful snapshot.

**I — Output barrier:** synchronous imports only copy proposals into a bounded turn outbox. Before any tool dispatch, visible result or log publication, the trusted broker atomically commits the resulting snapshot/host state, applied-input cursor, import trace, outbox intents and reservations. If this transaction fails, discard the candidate heap and retry from the previous committed state. This snapshot-every-turn choice avoids building a partial-turn durability protocol in the initial implementation.

**I — Delivery barrier:** the broker first commits a validated operation outcome and a branch-specific selected input event. The executor applies that event to a heap whose `appliedEventSeq` precedes it. Only a committed next checkpoint acknowledges application. A crash after selection or during delivery replays it into the previous heap; a crash after the next commit does not deliver it again. Several executions may occur physically; one continuation/output history becomes authoritative.

**I — Journal format:** each record contains `(branchId, eventSeq, previousHash, turnId, kind, canonicalPayload)`; hash the canonical record without its own hash field. Turn-start records contain the chosen input, clock values and starting RNG cursor. Import records contain import ordinal, kind and canonical request or returned scalar/bytes; tool records bind guest and normalized request hashes to `callKey`. Result records contain exact bounded, redacted outcomes, and delivery records contain the selected order. Fork/control records bind seed changes, grants and budget revisions. Retain these bytes, not only a trace digest, for comparison during replay. Parent-prefix references are immutable and include the cut hash.

**I — Ownership:** moves use an atomic compare-and-swap from the parked source to a reserved target with incremented `ownerEpoch`. Target admission checks/build availability happen before this handoff. Target starts only after receiving the broker's committed claim. If it never starts, the broker issues a further epoch to a replacement from the same committed checkpoint. The old source may still be alive, but its new turns fail fencing. Leases and their expiry are decided by the broker's clock, never the phone's clock. An epoch is not an external idempotency key.

**I — Accepted calls do not acquire the new executor's ownership.** An operation admitted before the move continues in the broker's dispatcher even if the originating executor disappears. Responses go to the home `callKey` ledger, then to whichever branch observers remain authorized. Source-owned `fetch()` and host Promise objects never need to survive. A reply received during the handoff is simply persisted at home; it cannot be lost between two executor sockets.

**I — A correlation ID is not reply authority:** only the trusted connector's response path, authenticated provider callback or verified reconciliation lookup may settle an operation. Verify provider signatures/principal and correlate account, operation and request before accepting a webhook. An executor or phone cannot call `resolve(callKey, receipt)` to manufacture success. Callback duplicates are deduplicated in the home transaction.

## 4. Concrete v1 import ABI

**I — Fixed Wasm namespace `teleport_v1`; all imports are synchronous and non-reentrant.** The approved build contains no ambient WASI networking, filesystem, wall-clock or random imports. `ptr`/`len` are unsigned wasm32 offsets; check `ptr <= memory.byteLength` and `len <= memory.byteLength - ptr`, copy bytes immediately, and reacquire views after growth. Host failure returns a nonzero status and ends the turn without publishing its effects. Do not synchronously settle a guest promise from an import.

```ts
// JSON wire types: validate at runtime; TypeScript alone supplies no boundary.
type Id = string;          // UUID/opaque identifier; not a bearer credential
type Hash = string;        // exactly 64 lowercase hexadecimal characters
type U64 = string;         // canonical unsigned decimal, checked <= 2^64-1
type Ms = number;          // nonnegative safe integer milliseconds
type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

type HostRequest =
  | { v: 1; kind: "call"; localId: number; capSlot: number;
      method: string; args: Json; dispatchBeforeUtcMs: Ms | null }
  | { v: 1; kind: "sleep"; localId: number; dueTickMs: Ms }
  | { v: 1; kind: "cancel"; localId: number; targetLocalId: number };

interface WasmImportsV1 {
  teleport_v1: {
    call(ptr: number, len: number): number; // UTF-8 HostRequest; 0 = staged only
    clock(kind: number, outU64Ptr: number): number; // 0=wall, 1=virtual elapsed
    random_fill(ptr: number, len: number): number; // simulation entropy only
    log(ptr: number, len: number): number; // UTF-8 bounded Json; staged only
  };
}

type Outcome =
  | { ok: true; value: Json }
  | { ok: false; code: string; message: string }; // normalized, secret-free

interface DeliveryV1 {
  v: 1;
  eventSeq: U64;
  localId: number; // resolver in THIS heap; mapped to a broker operation
  outcome: Outcome;
}

// Trusted host API, not available to guest JS; travels over authenticated RPC.
interface ExecutorClaimV1 {
  runId: Id;
  branchId: Id;
  ownerEpoch: U64;
  turnId: Id;
  expectedHead: Hash;
  executionClass: "authoritative" | "speculative" | "replay";
  selectedEvent: DeliveryV1 | null; // null for initialization/control-only turn
  wallMs: Ms;                    // fixed for the entire turn
  elapsedMs: Ms;                 // fixed for the entire turn
  grantSetId: Id;                // resolves only inside this authenticated claim
  fuelReservationId: Id;
  fuelLimit: U64;
}
```

**I — Encoding and limits:** JCS-canonical UTF-8 JSON ([RFC 8785, June 2020](https://www.rfc-editor.org/rfc/rfc8785)); reject duplicate object keys, malformed Unicode, nonfinite numbers and excessive nesting. Do not silently truncate integers; money is an integer decimal string in connector schemas. `localId` is strictly increasing, 1…2³²−1; overflow terminates the run. IDs are allocated to cancel/sleep requests too. v1 defaults: 64 KiB/request or reply, depth 32, 32 outstanding promises, 64 requests/turn, 256 KiB total outbox/turn, 4 KiB/log and 16 KiB logs/turn, 4 KiB/random import and 64 KiB random output/turn. These are proposed admission limits, not measured optimal values. Oversize bodies fail or become broker-authorized blob references through a dedicated connector.

**I — Import statuses:** `0=STAGED_OR_WRITTEN`, `1=BAD_RANGE`, `2=BAD_FRAME`, `3=LIMIT`, `4=BAD_SEQUENCE`, `5=UNSUPPORTED`, `6=HOST_FAILURE`. All nonzero statuses poison the current turn; its outbox cannot commit even if guest code catches an exception. Policy denials of an otherwise valid staged request become durable asynchronous error deliveries, not ambiguous import failures. Every import advances `nextImportSeq`, including clock/random/log, so a changed request order stops replay before live-mode admission.

**I — Guest surface:** `tool(capSlot, method, args) -> Promise<Json>`, `sleepUntil(tick) -> Promise<void>`, `cancel(localId) -> Promise<CancelStatus>`. Timers use the same `call` import and reply queue; no extra Wasm timer import is needed. `Date.now()` and `performance.now()` use `clock`; all built-in `Math.random()` draws must route through `random_fill`, replacing the spike's internal clock-seeded QuickJS PRNG. No `crypto.getRandomValues`, `setInterval`, arbitrary native `fetch`, sockets, DOM, Node APIs or arbitrary host callbacks. A whitelisted fetch connector returns a fully buffered bounded response as data, including status and permitted headers.

**I — Required exports:** `memory`, ABI version, bounded input-buffer accessors, `init`, `deliver`, `pump(maxJobs)`, `status`, result accessors and every mutable numeric global in the approved build manifest. `deliver` parses data through QuickJS APIs, without constructing source code from replies. Initialization occurs only for a fresh run; restore instantiates the exact reactor, copies memory/globals and host state, and never initializes QuickJS over the restored heap.

**I — Identity and retry:** host/broker derive `callKey = hex(SHA256(JCS(["teleport-call/1", tenantId, runId, originBranchId, localId])))`. The guest does not supply `callKey`, account, policy, retry classification or provider key. Compute `requestHash` over the versioned method, normalized args, deadline, and stable capability identity including connector version, account and scope. Persist both the guest request digest and the normalized dispatch digest. Retries cannot change request bytes, API version, provider account or credentials' effective principal. A refreshed credential for the same principal is allowed after policy check. A different principal is a new explicitly authorized operation.

## 5. Snapshot envelope and host state

**I — File framing:** eight ASCII bytes `TLPT0001`, little-endian u32 envelope length (maximum 64 KiB), canonical JSON `SnapshotEnvelopeV1`, then exactly `memory.storedBytes` gzip bytes and `hostState.bytes` canonical JSON bytes. No trailing data. Verify compressed hash and enforce raw-size bounds while streaming decompression; verify the raw hash before instantiating. Module and application artifacts are addressed by hash in the receiver's approved registry. The journal and authority records remain at the home; the capsule is not a standalone permission to act offline.

```ts
interface CapabilityRequirementV1 {
  slot: number;
  bindingId: Id;          // durable logical designation, NOT a bearer reference
  schemaHash: Hash;
  required: boolean;
}

interface PendingBindingV1 {
  localId: number;
  callKey: Hash;          // unchanged when this promise is inherited by a fork
  requestHash: Hash;
  kind: "call" | "sleep" | "cancel";
  observation: "waiting" | "delivery-selected";
  selectedEventSeq: U64 | null;
}

interface HostStateV1 {
  v: 1;
  nextLocalId: number;
  nextImportSeq: U64;
  pending: PendingBindingV1[];
  rng: {
    algorithm: "xoshiro256ss-le/1";
    domainBranchId: Id;
    seedHex: Hash;        // public simulation seed, NEVER cryptographic entropy
    wordsHex: [string, string, string, string]; // four fixed-width 64-bit words
    nextByte: number;    // 0..8; 8 means no buffered bytes remain
    outputWordHex: string;
    bytesConsumed: U64;
  };
  clock: { createdTickMs: Ms; lastTickMs: Ms; wallMs: Ms; elapsedMs: Ms };
  // Durable subscription designations only; no reader/socket/RPC stub.
  subscriptions: { bindingId: Id; lastAppliedCursor: string }[];
}

interface SnapshotHeaderV1 {
  format: "teleport-snapshot/1";
  abi: "teleport-imports/1";
  tenantId: Id;
  runId: Id;
  branchId: Id;
  snapshotId: Id;
  parent: { branchId: Id; snapshotId: Id; forkEventHash: Hash } | null;
  authorityId: Id;       // local registry lookup; never follow an arbitrary URL
  checkpointNo: U64;
  ownerEpochAtCapture: U64; // historical only; NEVER grants a current lease
  phase: "READY" | "WAITING" | "DONE";
  createdUtcMs: Ms;
  build: {
    wasmSha256: Hash;
    applicationSha256: Hash;
    bootstrapSha256: Hash;
    codecSha256: Hash;
    manifestSha256: Hash; // imports, globals, table, memory and Wasm features
    determinismProfile: "qjs-wasm32-utc/1";
    costModel: string;
  };
  memory: {
    codec: "gzip";
    storedBytes: number;
    storedSha256: Hash;
    rawBytes: number;    // 64 KiB page multiple; v1 maximum 32 MiB
    rawSha256: Hash;
    maximumPages: number;
  };
  globals: { name: string; type: "i32" | "i64"; bitsHex: string }[];
  hostState: { bytes: number; sha256: Hash }; // v1 maximum 128 KiB
  history: {
    committedEventSeq: U64;
    appliedEventSeq: U64;
    headHash: Hash;
    importTraceHash: Hash;
  };
  requirements: CapabilityRequirementV1[];
  authorityRefs: {
    grantSetId: Id;
    policyRevision: string;
    budgetAccountId: Id;
    budgetRevision: U64;
    informationLabelSetId: Id;
  };
  executionExpiryUtcMs: Ms | null;
  provenance: {
    producerId: Id;
    class: "trusted-executor" | "unverified-device";
    trustedBaseSnapshotId: Id;
  };
}

interface SnapshotEnvelopeV1 {
  header: SnapshotHeaderV1;
  authentication: {
    algorithm: "Ed25519";
    keyId: Id;
    signatureBase64: string;
  };
}
```

**I — Signature:** sign UTF-8 `teleport-snapshot/1\n` concatenated with JCS(header); the header binds both payloads by digest. Check against a preconfigured authority/producer key registry, not a key supplied by the sender. A home signature can record an unverified upload for storage; it must keep `unverified-device` provenance. It does not certify execution. Encryption/access control is separate: heaps and journals may contain confidential inputs or responses even though connector credentials never enter them. Do not send a heap containing private data to an unauthorized phone.

**I — Globals and seed:** the approved manifest declares the complete ordered globals list and exact types. Do not accept sender-chosen extra globals or mutable tables. `xoshiro256ss-le/1` uses Blackman/Vigna's [xoshiro256** 1.0 transition, authored 2018](https://prng.di.unimi.it/xoshiro256starstar.c), unsigned 64-bit arithmetic modulo 2⁶⁴. Interpret the seed as four consecutive little-endian u64 words; the all-zero seed is rejected by the broker before branch creation. Initially `nextByte=8`, `outputWordHex=0000000000000000`. When exhausted, produce one output word and advance the state once using that transition, set `nextByte=0`, then consume low-order bytes in order. Preserve leftover bytes and the post-generation state across imports/checkpoints. `Math.random()` consumes eight consecutive bytes, takes the upper 53 bits of the resulting little-endian u64 and divides by 2⁵³. These are simulation values; ID collision resistance and authorization use broker-generated identities, not this RNG.

**I — Header fields describe a checkpoint, not current authority.** At import, compare its signed history and checkpoint identity with the home's committed record, reconstruct pending mappings, and get current grants/budget/labels from the database. For a checkpoint made by the output-barrier protocol, all selected guest inputs are applied (`committedEventSeq == appliedEventSeq`); newer home events may already exist after capture. Lifecycle events that require no guest input are marked applied by the host. A move may have a newer epoch than `ownerEpochAtCapture`. An old checkpoint may be used only for replay/recovery under a new broker claim, never as permission to roll back the current head.

**I — Avoid a hash cycle:** `history.headHash` is the event-chain tip through the represented cut, excluding checkpoint-publication metadata that names this image. Compute/sign the header and complete file afterward; the branch head points to `SHA256(complete file)`. `ExecutorClaimV1.expectedHead` is that file digest, distinct from the journal tip. Staging can prepare the next cut against an expected head; its publishing SQL transaction verifies the expected head/epoch and commits exactly those prepared events. A signed but unpublished staged file is not admissible. Durable home completions received after the prepared cut remain a later replay/delivery tail.

**I — Import order:** bounded framing/decompression → hash/signature/tenant/provenance checks → approved exact-build manifest → home checkpoint/history lookup → current ownership and target admission → data-export policy → capability rebinding and resource reservation → fresh instance/copy/global restore → replay any selected input tail → authorize live mode. Mandatory missing bindings reject admission; optional missing/revoked slots reject calls with `CAP_UNAVAILABLE` without dispatch. No effects are possible during validation or replay. A fork creates a new home-signed child header/host-state overlay referencing the same memory bytes; the parent file is not edited to invent a child.

## 6. A pending call through move, fork and replay

**I — There are two state machines: one real operation, and an observation in each guest branch.** Combining them into a single `Promise.pending` flag is the common error.

```text
Operation at the home (one callKey)

  STAGED (volatile in a turn)
       |
       | commit checkpoint + intent + budget reservation + outbox
       v
  READY ---------------------------> KNOWN_NO_EFFECT
       |                            denied / expired / cancelled before send
       | commit attempt admission
       v
  ATTEMPT_ADMITTED --> IN_FLIGHT (transport is ephemeral)
       |                      |
       | crash / lost reply   | durable validated receipt
       v                      v
  UNKNOWN ------------------> KNOWN_OK or KNOWN_ERROR
       |   lookup / same-key retry only under connector recovery contract
       +--> BLOCKED_RECONCILIATION when no safe recovery exists

Observation at branch B (many may point to the same operation)

  WAITING -> DELIVERY_SELECTED(eventSeq) -> APPLY_TO_HEAP -> CHECKPOINT_ACKED
                   |                            |
                   +---- crash: restore prior heap and reapply ----+
  selected outcome and order are persisted before APPLY_TO_HEAP
```

**I — Transition rules:** `ATTEMPT_ADMITTED` is deliberately pessimistic. A crash after recording it but before any bytes are sent is indistinguishable from a crash after remote acceptance; recover it as `UNKNOWN`. Only definitive provider evidence may produce `KNOWN_ERROR` with “no effect” semantics. A network timeout, socket close, cancelled request or generic 500 is not that evidence. Known results are immutable and can be either success or a known application failure. `BLOCKED_RECONCILIATION` is a recoverable operational substate of unknown, not a definitive failure returned to the guest; a later validated receipt can still resolve it.

| Event at a pending call (**I**) | Operation ledger | Guest observation and dispatch consequence |
| --- | --- | --- |
| Move before intent commit | No accepted operation exists. | Discard uncommitted heap; reconstruct from committed state. No old outbox may escape. |
| Move while READY, IN_FLIGHT or UNKNOWN | Same call, args, provider principal, key and reservation remain at home. | Rebind the pending resolver by `localId → callKey`; only the new owner applies the reply. No automatic retry just because location changed. |
| Reply arrives while no executor is resident | Persist known outcome, then selected delivery. | Wake/restore the current owner later. Do not route to an originating socket. |
| Source wakes after handoff | Accepted old calls may still finish at home. | Reject its new turn, outbox and ACK by epoch/head fencing. |
| Fork at committed wait | Child gets an observer of every inherited pending call, including writes and paid reads; it does not get a copied dispatcher attempt. | Same original result can settle each copy's resolver. Child receives no cancellation authority over the original operation and no copied effect approval. |
| Fork after outcome known but before delivery applied | Child observes the same immutable outcome and already-selected ordering through the cut. | No reissue. A fork is not an instruction to redo the prefix. |
| New call after fork | New child branch participates in key derivation. | Only newly authorized child calls create effects; speculative children have no mutation permission. |
| Replay for inspection/validation | Read only; no operation/attempt creation. | Compare import sequence, request bytes/digests and delivery order; supply recorded outcomes, clock and entropy. Missing record or mismatch stops with `REPLAY_DIVERGED`/`REPLAY_END`. |
| Recover to live frontier | Existing accepted operations remain in their ledger states. | Explicit fenced broker transition from replay to authoritative mode; recheck current policy before new effects. A dry replay never auto-transitions. |
| Cancel/timeout after send | Stop observation or request best-effort cancellation; retain ledger and reservation if unknown. | A timeout may win `Promise.race`, but cannot promise that a payment/email did not happen. Block a replacement business permit until reconciled. |

**I — Ordering:** the broker transaction that appends a selected delivery is the linearization point for `Promise.race`. Duplicate callbacks/receipts do not append duplicate branch deliveries. For independent inherited calls completing after a fork, the home assigns each outcome a stable completion sequence; observers receive them in that sequence, with any already selected prefix preserved. New child-specific operations may interleave differently. A child may detach its observation; only the operation's authorized original owner/control plane can cancel a shared operation. Detaching all observers does not cancel it implicitly.

**I — Fork control plane:** `fork(currentParentHead, childAllocations, mode="speculative")` is a broker operation with its own deduplication ID. It requires the parent's current committed quiescent checkpoint, creates child branch records atomically, preserves the parent and pending mappings, splits budgets, and appends RNG-domain changes before any child turn. Historical live forks are rejected in v1; old checkpoints remain usable for read-only replay. v1 does not allow injecting hypothetical results into an authoritative branch or reissuing inherited calls as new calls. Speculative results stay labeled and cannot merge state or grant authority. A separately approved new live child may use a constrained grant, but business mutation permits remain unique across the lineage.

## 7. Clocks, timers and randomness

**F — A local monotonic timestamp is not a portable machine-wide epoch.** High Resolution Time defines environment time origins and nonnegative differences for the same origin; it does not synchronize two devices. [W3C High Resolution Time, Working Draft 2026-09-01, §§4 and 7](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/). Temporal's [durable timers](https://docs.temporal.io/develop/typescript/workflows/timers) likewise separate waiting from keeping a worker process resident.

**I — Choose logical time, not imported `performance.now()` offsets:**

- The home maintains durable `tickMs = max(previousTickMs, sampledHomeUtcMs)`. At each turn it records this tick and the trusted UTC wall sample. Guest wall time returns the recorded sample; guest monotonic/elapsed time returns `tickMs - createdTickMs`. Both are frozen throughout the turn. Only the elapsed value is guaranteed nondecreasing; civil wall time can adjust backward. Replays use the recorded values, never either executor's clock.
- Timers store `dueTickMs`, not a `setTimeout` handle or remaining device milliseconds. A move/fork inherits the same absolute due tick. Waiting, transfer and device sleep count as elapsed authority time. A timer already due is eligible immediately on arrival. On home restart, a scan resumes due timers; a local alarm is only a wake-up optimization. One `TIMER_FIRED` event per timer identity, deduplicated before delivery. No repeated intervals or missed-tick catch-up in v1.
- `sleep(ms)` is sugar for `sleepUntil(currentElapsedMs + createdTickMs + ms)`. This means “not before that authority tick,” not a real-time scheduling guarantee. Clock forward jumps can make timers eligible early in physical elapsed time; backward jumps can stall advancement. Clamp regressions; flag major clock discontinuities and suspend new irreversible dispatch until clock health is restored. Do not claim restart-spanning physical monotonic accuracy from this algorithm.
- Business expiry and `dispatchBeforeUtcMs` are trusted absolute UTC constraints. Recheck at attempt admission, including retries; expiry before dispatch yields a known no-send outcome. Expiry after admission cannot recall the request. Need “payment must not execute after 17:00”? Require a provider-enforced expiry/reservation protocol; a client deadline alone cannot enforce it. Strict hard real-time guarantees are rejected in v1.
- Host-local monotonic timers and termination enforce active turn limits only on that host. Resource fuel and absolute run expiry survive moves; guest time is never an enforcement clock. Phone-reported timestamps cannot extend leases, approvals or dispatch windows.

**I — Fork entropy rule:** the broker persists a public root simulation seed at creation. Each branch seed is `SHA256(JCS(["teleport-rng/1", rootSeed, branchId]))`; the 256 bits initialize the versioned host RNG. Moves preserve state and byte cursor. A newly created child resets the host RNG to its child seed in a recorded fork-boundary event before any guest job runs; the parent continues its old stream. Replaying that child uses the same recorded boundary and seed. Replaying the shared prefix uses the original seed/state. No reseeding from destination clocks or `crypto` on restore.

**I — Exact scope of “forks diverge”:** future calls to the runtime entropy API use different branch domains; individual draws may coincide by chance. Already computed random values and a user-implemented PRNG copied in the heap remain identical historical state. The runtime cannot make arbitrary user state diverge automatically. Cryptographic key generation, nonces for security protocols and private signing are broker connector operations; their credentials/keys do not enter the heap.

## 8. Capabilities, secrets, real effects and conserved budgets

### Rebind names to authority

**I — A `capSlot` is a logical designation, not an unforgeable network capability by itself.** The host presents an authenticated executor claim; the broker maps `(tenant, run, branch, grantSet, slot)` to a narrow connector facet. The facet fixes method allowlist, target account, permitted objects/recipients, maximum amounts, information labels and expiry. The guest cannot name an arbitrary credential, hostname or account. All slots, methods and arguments are revalidated even if a trusted engine emitted them.

**I — Arrival authority = creation ceiling ∩ current home policy ∩ destination policy ∩ branch mode ∩ current approvals.** A required binding unavailable at the destination rejects the move before handoff; there is no fallback to a more powerful local tool. Optional bindings may be absent and fail calls asynchronously. Current revocation applies to every not-yet-admitted attempt; already sent work must be reconciled. An inherited receipt may itself be confidential: sharing it with a child requires the original data scope and destination export permission. Migration does not clear taint/private labels, regenerate an approval or convert a speculative branch into a trusted one.

**I — Credentials never enter the capsule:** provider OAuth tokens, API keys, cookies, broker bearer tokens, TLS state and signing keys stay in trusted host/broker stores. Snapshot requirements contain only non-authorizing IDs. Reauthentication/rebinding happens outside Wasm on arrival and yields a new ephemeral session, not a copied session secret. Redact provider auth headers and secret-bearing responses before guest delivery. A program that intentionally receives an arbitrary user secret can retain it in its heap; no snapshotter can reliably discover and remove all such values. Such data needs an export label and authorized destination, or the move is rejected. The credential guarantee concerns broker-managed credentials, not magical heap scrubbing.

### Exactly-once: define the boundary

**I — Promise:** one logical accepted operation and one committed outcome per `callKey`; no dispatch during replay; no multiplication of inherited operations on fork. **External exactly-once is conditional on the effect sink.** If a service may execute a write and lose its reply, neither a heap snapshot, outbox, saga nor client-side idempotency table can determine whether it happened. Losing availability by blocking is the safe outcome when the sink cannot resolve that ambiguity.

**I — Name the actual boundary:** for an email connector, once-only provider acceptance is not once-only delivery to a person's inbox; downstream SMTP/mailbox behavior is outside this broker. For a payment, the adapter must name the particular create/authorize/capture/refund transition it deduplicates. A later refund is another real event, not evidence that the charge never occurred.

| Connector recovery contract, set by broker (**I**) | v1 handling |
| --- | --- |
| Pure/repeatable read, explicitly approved as such | Retry within bounded attempt/cost/deadline budgets. Only the chosen persisted response enters the guest; a retry may observe newer data. “GET” alone does not prove purity, absence of billing or absence of side effects. |
| Mutation and dedup/result row in the same database transaction | Strong once-per-key effect within that database, with durable unique key and sufficient result/tombstone retention. Use this as the v1 reference sink. |
| Provider atomically enforces stable business operation ID and supports durable outcome lookup | Reconcile/retry the same operation under its documented contract. Lookup must distinguish pending/committed/definitively absent; a transient 404 alone is insufficient. |
| Provider has a finite idempotency retention window | Conditional duplicate prevention only within that contract. Persist first-admitted time, provider/account/API version and a conservative retry cutoff. Outside the safe window: `BLOCKED_RECONCILIATION`; no new key. |
| No provider deduplication or reliable outcome reconciliation | Reject mutation capability binding in v1. Generic SMTP/email send, arbitrary webhook POST and unkeyed tool writes fall here. A local outbox does not fix the remote crash window. |

**F — Stripe API v1 specifics matter:** the first executed request's status/body are retained, including 500 responses; same-key parameter changes error; keys can be pruned after at least 24 hours, after which reuse can initiate a new request. Validation failures and concurrent conflicts do not necessarily create a saved result. Keys have a 255-character maximum. Stripe's page now distinguishes API v2 semantics, so an adapter must pin its API family/version. [Stripe, Idempotent requests](https://docs.stripe.com/api/idempotent_requests), current reference.

**I — Concrete Stripe-v1 adapter policy:** send `Idempotency-Key: tp1_<callKey>` (68 characters), keep the normalized request/account/version fixed, and stop automatic resends no later than 23 hours after first admission, earlier if a connector-specific transport allowance requires it. This is a conservative policy choice, not a new Stripe retention promise. A cached 500 remains ambiguous with respect to business completion; reconcile provider objects/webhooks rather than changing keys. If the provider outcome remains unknown, retain the operation and its business permit indefinitely until resolved or explicitly administratively closed. Do not promise unconditional once-only charging across unbounded delays or provider data loss. A finite window plus a presumed bounded request lifetime cannot prove that property for arbitrary network delays or zombie senders.

**I — Business identity is additional to execution identity.** A child has new future call keys; that must not authorize a second charge for the same order. The home issues a narrow, single-use `businessPermit` bound to operation/argument constraints (e.g. order, amount, recipient and maximum capture). In one transaction it assigns that permit to the first accepted call; later branches either observe that same permitted result for identical args or receive `PERMIT_CONSUMED`/`PERMIT_CONFLICT`. The program cannot manufacture new permits by changing an order string. A legitimately additional purchase/email/write requires another explicit grant from the application/control plane. “Exactly once” for the business is defined by that application identity, not guessed from equal payloads.

**I — Permit aliasing:** when the application explicitly allows an authorized second branch to observe the same permitted operation, compare the normalized dispatch digest (including principal and API version), create only an observation mapping for its new local resolver, and point it to the original `callKey`. Do not insert a second dispatchable operation under the child's candidate key. A guest request digest may differ because its local resolver ID differs; that is not permission to change the actual dispatch payload.

**I — Dispatcher fencing:** only the home releases network work. It commits attempt admission before sending and validates current policy/budget. A dispatcher restart treats unfinished attempts as unknown. A late old attempt may still arrive: local epochs cannot fence an uncooperative external server. Safe sinks must deduplicate at the actual mutation boundary. Never put owner epoch, attempt number or destination ID in a provider idempotency key; doing so defeats retry deduplication.

**I — Sagas:** record a compensation obligation keyed by the original call before releasing it, with a condition that checks whether the effect actually occurred. A compensation uses its own stable `comp:<callKey>:<step>` logical identity and appropriately scoped permit, and goes through the same ledger. Unknown effects and failing compensation remain visible work. Refunds are not automatic upon moving, forking, a transport timeout or replay. This avoids speculative children independently refunding a shared parent charge. v1 needs at most an explicit charge/refund adapter example, not a generic saga engine.

### Conservation

**I — Use integer account balances at home:** separate fuel units, remote-cost microunits, egress bytes, storage bytes, outstanding-operation slots and branch slots. The invariant for each consumable dimension is `issued = spent + reserved + sum(available accounts)`; returning or releasing a reservation is a transaction with evidence. Memory/concurrency capacity has separate admission reservations and cannot be treated as spendable historical fuel.

**I — Move transfers the account reference; replay never restores balances from a file. Fork subtracts each child's allocation from the parent's available balance in the same transaction that creates the child.** Example: 100 cost units, 20 already spent and 10 reserved for a pending call leaves 70 available; giving three children 15 each leaves 25 for the parent. The inherited call's 10-unit reservation exists once. Sharing its result costs no second call reservation, but each child's future tools, transfer and CPU consume its allocation. Repeated fork requests are deduplicated by control-operation ID.

**I — Failed attempts still cost resources:** reserve a bounded fuel grant before a turn. A crash/unverified report burns the whole reservation; only a trusted supervisor may return verified unused fuel. Retries of paid reads reserve new attempt costs even if the business operation is idempotent. Replays consume a separate capped recovery/validation CPU allowance, not free unmetered work. Phone fuel reports cannot refund trusted balances; v1 pays it no verified-compute rewards. This closes rollback/fork/refill attacks without implementing a marketplace or proof system.

## 9. Streams, sockets and reconnect

**I — No live transport crosses a snapshot.** A fetch is home-owned and buffered before delivering a result. TCP, TLS, WebSockets, Cap'n Web import/export tables, host Promises and stream readers/writers are never in the guest snapshot. A moving executor reconnects and asks `observe(callKey)`/`readEvents(afterEventSeq)` through a newly authenticated session. A transport-level rejected RPC promise means “ask the ledger,” not “perform a new tool call.”

**I — Minimal resumable stream adapter:** represent a subscription by a durable broker binding plus cursor. Expose `stream.read({afterCursor, maxBytes})` as an ordinary bounded call returning `{items, nextCursor, eof}`. Broker retains the source event log and monotonically ordered cursor; the guest's last-applied cursor is part of the committed checkpoint. A failure before ACK can redeliver a chunk to an older heap; it cannot duplicate effects from the failed turn. Reconnection asks after that committed cursor; detect `CURSOR_EXPIRED` and stop rather than silently jumping to the present. Side-effecting consumer actions still use the effect ledger/permits. Inherited observers can share an immutable pending read, then advance independently against retained history and their own budgets.

**I — v1 scope:** implement only a synthetic broker event-log connector to prove this API. A real SSE/WebSocket upstream needs stable IDs, replay retention and reconnect semantics from that upstream or a durable broker spool; do not pretend to recover bytes never received. Reject migration with an executor-local active stream or exclusive external session. Holding a remote lock/transaction/lease requires an explicit connector that owns it at home and revalidates expiry/fencing at the resource; arbitrary held DB transactions, file descriptors and locks are rejected. No automatic rebinding that silently creates a different resource.

## 10. Rules table and v1 rejection boundaries

| Thing held/waited on (**I**) | Move | Fork | Replay |
| --- | --- | --- | --- |
| Accepted buffered fetch/tool | Home owns attempt/reply; new executor observes same key. | Share original operation, result and charges; authorize new calls separately. | Recorded result/order only; never network. |
| Unknown payment/write | Preserve unknown state, original key, account and permit. | Share unknown observation; no copied approval/cancel right. | Remains unknown at historical frontier; cannot invent a success or resend. |
| Timer/deadline | Same due tick/UTC expiry; no reset of duration. | Same inherited due time, distinct observer. | Recorded firing and clock inputs. |
| Runtime random source | Same state/cursor. | Child domain reset before next job; parent unchanged. | Original branch seeds/boundaries and draw order. |
| Capability slot/approval | Fresh current-policy rebind; required mismatch rejects. | Grant attenuation and explicit child approval; no duplicated business permit. | No live authority; historical policy events are data. |
| Credential/session | Never in the capsule; authenticate outside it. | Never clone. | Never needed for historical results. |
| Paid quota/fuel | Same authoritative account; charge transfer/turns. | Atomic split; inherited outstanding reservation counted once. | Capped separate validation/recovery cost. |
| Cursor subscription | Reconnect to same durable binding and committed cursor. | Independent read observers within retention/export rules. | Exact recorded chunks/cursors. |
| Socket/raw stream/held lock | Reject unless an approved home-owned connector makes it logical. | Reject exclusive resources; never clone ownership. | No socket access; logged observations only. |
| Phone-produced heap | Speculative only; never direct authoritative import. | Speculative descendants retain taint. | Trusted reconstruction ignores its bytes and checks broker history. |

**I — Reject in v1, with explicit errors:**

1. `NOT_QUIESCENT`: live Wasm/JSPI stack, active export/import, partial frame, runnable jobs that cannot drain within a grant, or unregistered wake source.
2. `INCOMPATIBLE_BUILD`: wrong engine/module/application/bootstrap/ABI/profile, mutable tables, unexpected globals, externrefs/native pointers, or an unsupported maximum memory. No cross-build raw-heap upgrades.
3. `BAD_SNAPSHOT`/`STALE_AUTHORITY`: invalid framing/hash/signature, decompression over cap, wrong tenant, unrecognized home, noncommitted checkpoint or an attempted stale-head live restore.
4. `UNVERIFIED_CONTINUATION`: use of user-device state to inherit authoritative workflow privileges. A device's valid signature is insufficient evidence of intended execution.
5. `CAP_UNAVAILABLE`/`EXPORT_DENIED`: required destination binding absent, current policy revoked, confidential heap/result export prohibited, or secrets-only-on-origin resource required. No credential bundling to repair it.
6. `UNSAFE_EFFECT`: mutation without adequate sink deduplication/reconciliation, replacement of an unknown operation with a new key, uncontrolled SMTP/email, or arbitrary side-effecting HTTP. An adapter must define whether its guarantee is permanent or window-bound.
7. `RESOURCE_NOT_PORTABLE`: raw sockets, in-flight direct host fetches, partial bodies, RPC stubs/pipelines, native DB transactions/locks and unreconnectable streams. No transparent relocation of these objects.
8. `FORK_AUTHORITY_DENIED`/`BUDGET_EXHAUSTED`: copying effect approvals, unsplit balances, duplicating exclusive permits, automatic speculation promotion, state merges, or fork fan-out above the account's branch slots.
9. `OFFLINE_AUTHORITY_UNSUPPORTED`/`DEADLINE_UNSUPPORTED`: migrating the home/coordinator to another trust domain, disconnected irreversible execution, strict cross-machine physical monotonic guarantees, or provider-unenforced completion-by deadlines.
10. `REPLAY_DIVERGED`/`REPLAY_END`: mismatched requests/order/entropy profile or missing history. No fallback to live calls; no replay that resets resource accounts or quietly creates a new branch.

## 11. Three adversarial scenarios

### A. “The charge succeeded, the reply vanished, and both laptops woke up”

**I — Attack:** A issues order-42's €40 payment. Home commits the intent and assigns its single-use permit. Provider charges; broker crashes before recording the receipt. While A is partitioned, the user moves to B and forks C. A later submits another turn; B and C both try to recover the payment. At hour 30, someone proposes retrying with a new key.

**I — Answer:** all observers still point to the one original `callKey`; A's new commit is fenced out. The home recovers the admitted attempt as unknown. Only its dispatcher may retry the exact key within the provider's safe window or reconcile the existing operation. C gets no duplicate payment authority; changing local call ID cannot recreate the consumed order permit. At hour 30 an unresolved finite-window Stripe operation blocks for reconciliation; a new key is rejected. A late valid receipt fills the original ledger row and can settle authorized observers once. Neither movement nor cancellation proves that the charge failed. This chooses a visible unresolved payment over a possible duplicate.

### B. “The phone skips approval, adds money and signs its modified heap”

**I — Attack:** a phone receives a search-only speculative capsule, edits memory to set `approved=true`, changes a pending call to `transfer(1_000_000)`, sets the displayed budget to a billion, and signs the snapshot with its genuine device key. It uploads a forged transcript that claims the trusted approver said yes.

**I — Answer:** the signature proves which device supplied bytes, not which program ran. The receiver accepts, at most, a bounded untrusted artifact/proposal. It grants no privileged pending calls, budget, receipt authenticity or workflow-state claims from that heap. The broker checks grants, arguments, permits and balances independently; its own journal contains no approval. For authoritative continuation, a trusted executor starts from the last trusted snapshot and replays broker-authenticated inputs, or recomputes the proposed work. It never overlays the phone's bytes or accepts a phone import trace as proof. A matching trace alone cannot prove that an arbitrary candidate heap has no latent tampering. Returning from a speculative branch cannot remove its label. TEE attestation and verifiable computation are outside v1.

**I — Consequence for the compute thesis:** arbitrary integrity-critical CPU work offloaded to a hostile phone must run again on a trusted machine in this v1, so it saves no trusted computation and may increase total CPU. Useful cases are trusted spare executors, user-owned computation under that user's own authority, or untrusted proposals with an application-specific cheap validator. Snapshot transport alone does not supply that validator.

### C. “Rollback for more time and money, then exploit reconnect”

**I — Attack:** take a snapshot with 70 available units and a five-minute timer; fork it 100 times, restore an older copy to refill quota, set the target clock back a day, and disconnect just after consuming stream item 81. Each copy requests the side effect for item 81 again on reconnect.

**I — Answer:** files grant no ownership/account. Home atomically allocates child budgets and branch slots; the requested fan-out fails once availability is exhausted. Stale snapshots can only replay under capped claims and never refill home balances. Home time preserves the original timer/deadline regardless of the device clock. A stream read restarts from the last committed cursor and may return item 81 again only to a heap that did not commit its application; no outbox from that failed turn escaped. If the mutation for item 81 was accepted, its ledger key/unique business permit and sink deduplication prevent a second effect across retries/branches. If the source retained no cursor history, return `CURSOR_EXPIRED`; do not skip data or claim seamless recovery.

## 12. Buildable in a few weeks, and what to verify

**E — 15–20 engineer-days, assuming the spike's reactor and a familiar TypeScript implementer:** 3–4 days for four imports, bounded JSON reply delivery and exact-build envelope; 4–5 for one SQLite home, commit barriers, pending-call routing and epoch fencing; 3–4 for fork accounts, RNG boundaries, timers and replay checks; 3–4 for executor handoff plus crash injection; 2–3 for hostile-envelope/authority tests and documenting adapter limits. This is a local research implementation, not the broader 43–73-day hardened architecture estimated by the V8 report. General resource metering qualification, production Cloudflare deployment, untrusted-compute proof, home migration, marketplace rewards and broad connector support are excluded. Direct authoritative moves are between trusted executors (e.g. two Node processes); a browser on a user-controlled device resumes speculatively, and the trusted server reconstructs state independently on return. A controlled browser trusted by the authority is a different deployment trust decision, not a property conferred by running in a Worker.

**I — Prove one reference effect sink:** a small HTTP service with SQLite transactionally inserting `(businessPermit, callKey, requestHash, receipt)` and applying a mock balance/write in that same transaction. Keep durable deduplication tombstones. Also expose a deliberately unsafe endpoint for rejection/unknown-outcome tests. Do not call real payment or email APIs for this proof. The source, effect sink, target executor and broker may all run locally while remaining separately crashable processes.

**I — Required acceptance checks:** kill before/after intent commit, attempt admission, sink mutation, receipt commit, input selection, heap application, checkpoint commit and handoff. Assert one sink mutation, one accepted outcome, no duplicated committed delivery and no stale-epoch outbox. Test two pending replies racing a timer; fork while a write is pending; move repeatedly; replay prefix and child RNG boundaries; wrong account/args under the same key; key-window exhaustion; absent optional/required caps; revoked approval; stale budget header; cursor loss; memory hash/global mismatch; oversized compressed data; and phone-signed tampering. Simulate a dispatcher zombie: safe receiver deduplication must carry the guarantee that local fencing cannot supply.

**I — Do not call design reasoning a measurement:** this report's protocol is specified rather than runtime-qualified. The checks below do not establish network crash safety, engine safety or exact cross-runtime replay.

**M — Local document checks:** extracted both TypeScript blocks (145 lines) into `/tmp/teleport-contract/abi.ts`; TypeScript **5.9.3** passed `tsc --strict --noEmit --skipLibCheck --lib es2022` with exit code 0. Checked all ten local report links, balanced code fences, the 68-character proposed provider key and the 100-unit conservation example. Small results are retained in `/tmp/teleport-contract/report-check.json`. No engine rebuild, external effect, deployment or runtime fault-injection experiment was performed; the acceptance matrix remains required implementation work.

## 13. Five-line TL;DR

1. **I:** Move the heap between fenced executors; keep pending calls, secrets, policy, deadlines and budgets at one durable home.
2. **I:** A fork shares inherited operations and receipts, splits budget and changes future entropy domain; it copies no effect approval.
3. **I:** Replay consumes exact recorded imports/deliveries and performs no network effects; live continuation requires a new fenced claim.
4. **I:** External exactly-once needs sink deduplication/transactions or reconciliation; finite-window ambiguity blocks instead of changing keys.
5. **E/I:** A restricted local v1 is a 15–20-day project; an untrusted phone's heap cannot directly resume a privileged workflow.

**Verdict — GO-WITH-CHANGES for the cross-machine contract.** **I:** build the home-broker, transactional-output version. Reject the stronger claims of autonomous offline authority, arbitrary external exactly-once effects and trusted return of phone-executed memory.

**The three next steps:**

1. **I:** Freeze the four-import profile and envelope; implement bounded capture/import plus one SQLite branch/call ledger and reference deduplicating sink.
2. **I:** Run the kill-at-every-boundary matrix with move/fork/replay, quota splitting and timeout/unknown outcomes before expanding connectors.
3. **I:** Demonstrate trusted Node ↔ Node moves, speculative browser-Worker resume with trusted reconstruction on return, and a phone-tampering rejection; then measure whether offloaded CPU work exceeds transfer and revalidation cost.
