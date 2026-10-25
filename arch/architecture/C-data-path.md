# C — Design from the execute call inward

Architect C, 2026-10-25. Design only; no implementation or new measurements.

## 1. Decision and accounting boundary

Build one native execution service around **immutable prepared state, reusable hardware slots, late-bound authority, and a bounded ring**. MCP is its public request boundary. Tool methods, synthetic files, blob operations, native program execution, and Cap'n Web use the same host capability dispatcher. A run gets a fresh logical computer; a successful reset lets its hardware shell serve another run. No builder, agent, Python helper, process launch, image hash, MCP handshake, or schema compilation belongs on a cache-hit request path.

This follows the [synthesis][S], including its corrections to older reports. Keep one small superset kernel per runtime family and apply recipe-specific syscall/file/capability policy. Keep Bellard QuickJS until a snapshot-aware alternative improves whole-run CPU by at least 20% within the memory budget. Linux has independent KVM VMs inside bounded native shards. macOS has persistent HVF worker processes, initially one logical run per worker, including while waiting. Serial multiplexing of saved contexts is a separate macOS experiment.

Evidence labels throughout: **M** means an existing project measurement, **D** a source-derived fact, **E** an engineering estimate, target, or proposed limit. All new budgets are E, including every number in a budget or gate table. They are allocations to disprove, not benchmark results.

The important measured comparison is parked raw `return2` at **183 µs** and complete parked raw `one_tool` at **285 µs**. Their 102 µs median difference is an indicative increment, not a paired tool RTT. Reported footprint was **10.657 MiB**, excluding HVF kernel allocations; it cannot establish today's post-loader baseline. The separate MCP experiment measured `one_tool` at **1.749 ms core / 2.106 ms MCP**, a **357 µs** difference, or **518 µs** against its plain-executor comparator. Do not subtract those numbers across harnesses. [M: memory report §1][R1], [I/O report §1][R5], [MCP results][MCP]

Define the small memory class as: QuickJS source at most 8 KiB; bounded scalar/control results; aggregate live control payload at most 16 KiB; at most eight outstanding small calls; no materialized large JSON; public immutable resources mapped read-only. Protocol ceilings can be higher, but admission then chooses another class. The latency fixture is narrower: `return await math.add(1,1)`, source below 1 KiB, tiny arguments/result, immediate host tool, resident snapshot and available slot. General remote tools add their actual critical-path duration.

Measure memory as

```text
M(N) = shared resident artifacts + shared service/cache state
     + N * (guest-private + host-per-run + hypervisor/kernel)
     + running-thread state + bounded transient/peak buffers.
```

Publish marginal slope, shared bytes, peak, and total system charges separately at N=1/16/64/256. Likewise publish response latency and total service CPU, including resets performed after a response. A warm pool may move work in time; it cannot delete it from the bill.

## 2. Ownership and execution topology

```text
 agent / Cloudflare Worker
        | MCP execute or embedded Executor call
        v
 native ingress: authenticate, admit grant, choose compatible warm host
        | one run envelope over a persistent host connection
        v
 native executor shard
   run table + policy + native adapters + blob references + journal
   bounded reactor / completion queue <---- upstream MCP / RPC services
        |                     ^
   fixed owner runners        | same-process bounded queues
        |                     |
   independent KVM slots -- shared rings -- jitk EL1 -- runtime / ELF EL0
        ^
 native deadline owner; external supervisor can kill the whole shard

 offline builder/grow -> action cache -> immutable CAS -> prepared snapshots
```

The following are E storage allowances and steady-state costs. Shared-cache limits are operator-set caps; they are not compulsory allocations per VM. Per-run figures are accounted again in the detailed ledger, not added twice.

| Component and owner | Boundary / work | Storage and CPU allocation; cheapest reason |
|---|---|---|
| Native ingress, service owner | Authentication, routing, MCP session lifecycle | 8 MiB initial shared metadata cap; at most 4 KiB ingress state/run. MCP work budget 32 µs/run in the embedded/native comparison. No second application server behind MCP. |
| Recipe/CAS/preparer, build owner | Trusted artifacts and compatibility manifests | Disk/cache quota, with an E 6 MiB resident common template allowance plus resources; 4 µs hit lookup. Builds and hashing occur on ingest/miss. |
| Native executor shard, runtime owner | Policy, adapters, admission, run state | 8 MiB initial shared bookkeeping cap plus per-run ledger; 64 slots/shard initially. Shares one allocator/reactor instead of a process per Linux VM. |
| Owner runners, VMM owner | Create and operate vCPUs, drain submitted rings | One fixed runner per selected CPU; E 128 KiB committed stack/runner. A waiting VM retains no runner stack. |
| Guest kernel/runtime, kernel owner | ELF execution, checked copies, fd/ring demultiplexing | Shared clean pages plus private ledger. Guest syscalls stay in EL1; only submit/wait/finish cross to host. |
| Adapter and blob layer, capability owner | Bounded requests, upstream sessions, projection | E 32 KiB request workspace/run; large payloads charged separately to host blob quota. No helper process for a call. |
| Native deadline owner and external supervisor, containment owner | Cancellation independent of guest and language event loops | E 16 KiB amortized/run plus fixed process state; E 7 µs arm/queue work included below. One timer structure per shard. |

**A deliberate trust change:** the fast native shard contains both VMM code and capability dispatch. It is part of the trusted host, unlike today's separate untrusted VMM process in [PROTOCOL-v1][V1]. This removes the VMM→Node pipe handoff, but a VMM host-memory bug can affect every live capability in that shard. Credentials stay outside guest memory and snapshots. Shards receive only the live connector authority needed for their admitted authorization domain; root signing keys remain in ingress/issuer services. Calls needing an external credential issuer pay that issuer's real latency. They are not represented by the local math fixture.

Confinement applies to the whole shard: preopened artifact descriptors, narrow connector endpoints, host resource limits, no general filesystem or ambient network access. If policy requires the former broker/VMM process boundary, provide a separate broker over bounded shared queues and count its process wakes and copies. That deployment must earn its own latency budget. Never silently call a privileged callback from an otherwise “untrusted VMM.”

On Linux, a shard owns VM/vCPU fds and fixed guest mappings. An owner thread creates its subset of vCPUs and continues running those vCPUs; KVM affinity is preserved without a thread per waiting VM. A reactor handles network completion, and a fixed deadline thread kicks running owners. Runners process immediate native callbacks inline; asynchronous adapters return a pending token immediately. Cross-thread queues are bounded and wake once on empty→nonempty. No per-VM timerfd, event-loop thread, console device, vGIC, or NIC is needed. [D: KVM topology and no-GIC precedents][R2]

On macOS, keep ingress and tools in the shared service, with persistent native HVF processes and owner-thread vCPU operations. Each worker's guest channel is mapped into the service through a bounded IPC bridge; include those process wakeups. WAIT returns its owner thread to an event wait, but the logical VM still occupies that worker. Initial concurrency therefore requires a process per occupied slot. Do not overwrite a waiting guest to run another. A later serial-context backend may save registers, unmap the previous address space, flush translations, map the next, and restore registers; it must pass the same reset tests. Concurrent tenants at different GPAs in one HVF VM do not have independent stage-2 isolation. No Linux density or 30 µs call claim transfers to this backend. [D][R1], [R2]

## 3. Grants → recipes → bytes → prepared state

`execute` begins by resolving an authenticated principal and a host-issued grant reference. Guest-supplied names, schemas, binary names, content hashes, and filesystem paths cannot introduce authority. Compile the admitted grant into a host-only `RunBindings` table: principal, revocation epoch, resource roots/versions, schema-validator references, method rights, effect/taint rules, output policy, deadlines, and connector references. Cache validator code and type declarations by schema shape; recheck live authority and effect-sensitive policy for every invocation. Approval binds the normalized call and current run, never just a method name.

Keep three identities distinct:

```text
recipeKey = H(canonical build inputs)
actionCache[recipeKey] = { imageDigest, manifestDigest }
CAS[imageDigest] = immutable image bytes / extent manifest

preparedKey = H(imageDigest, snapshot-format, VMM ABI, runtime/prelude ABI,
                CPU-feature contract, host granule, initialization profile)
preparedCache[preparedKey] = { snapshotDigest, checkpoint, working-set list }

live run = { slot, generation, admitted grant, seed, clock, budgets, bindings }
```

The recipe declares architecture, common kernel and syscall contract versions, trusted compiler inputs, static runtime/binary digests, bootstrap/optional RPC bundle, immutable resource tree digests, and memory layout. Canonicalize a short manifest of existing digests; never reread or hash the whole image on a hit. Grant **shape** selects interfaces and compatible policy. Grant **instance**, tenant identity, credentials, approval state, current time, code, and seed are excluded from shared prepared state. Dynamic private resources are late-bound blobs. A snapshot containing tenant resource bytes is a separate authorization-domain artifact, with separate access checks even if CAS deduplicates bytes. [D: cache distinction][R5]

A miss is explicit: coalesce identical build requests, build and validate offline, hash resulting bytes, publish immutable CAS objects atomically, then prepare. The request either waits within its declared deadline or receives `PREPARING` with a retryable operation reference. No request runs an agent or invokes the grow loop. Verify trusted manifest→artifact digest on cache ingest; retain immutable inode/descriptor lifetime for active mappings. CPU-specific prepared snapshots are not portable merely because source images match.

Method dispatch uses `{capSlot, methodOrdinal, callId}` against the current run table. The host gets the run from the slot/completion context, not from a guest-supplied execution ID. Rotating credentials or revoking a grant changes live binding state without rebuilding snapshots. Revocation stops new calls and checks again immediately before an approved effect commits; already committed remote effects require their own cancellation/reconciliation semantics.

## 4. Guest memory and snapshot lifecycle

Keep the current 32 MiB guest-physical envelope initially. The new manifest assigns host-granule-aligned extents within it; the sketch is a physical offset plan, not today's EL0 VA map. Preserve static ELF virtual addresses through reviewed stage-1 mappings rather than expanding today's unchecked assumptions.

```text
GPA base 0x80000000, offsets below; initial qjs profile
  0x000000..0x080000  kernel RX/RO, initial tables, EL1 mutable cells/stack
  0x080000..0x780000  runtime ELF + prepared heap; fixed addresses, host CoW
  0x780000..0x7a0000  startup stack/auxv and bounded invocation metadata
  0x7a0000..0x7b4000  80 KiB private transport/control, outside snapshot data
  0x7b4000..0x800000  unmapped guard / reserved layout space
  0x800000..0xa00000  public immutable resource extents, stage-2 read-only
  0xa00000..0x1f00000 scratch/heap address reservation, demand-backed zeroes
  0x1f00000..0x2000000 user stack reservation and unmapped guards
```

E profile choices: initialized runtime must fit its 7 MiB extent; larger profiles get a different layout. The startup stack extent need not all become resident. Kernel public text and immutable resources have read-only host backing; prepared writable runtime state is a distinct private mapping for **each** slot. Never register one writable host mapping in several VMs. Unused RAM uses fresh anonymous demand-zero backing. Align mutable cells and immutable extents to 16 KiB as well as guest 4 KiB pages, avoiding host-granule false sharing. Stage-1 aliases must preserve permissions; a compromised EL1 still cannot change stage-2 read-only public bytes.

A snapshot manifest references the same CAS-backed kernel/resource extents across recipes, plus its prepared mutable extent. Do not copy common kernel pages into separately backed snapshot files and assume equal bytes share physical memory. Keep the mapping count small by coalescing compatible extents.

The current 204 KiB static stage-1 tables and 64 KiB EL1 stack are reservations inside guest memory, not extra allocations to add on top. Initially share initialized table pages and count only later private copies. Avoid redesigning the MMU before the dirty census identifies a benefit. Disable hugepage promotion on mutable CoW regions in the first Linux experiment; compare later. [D: current layout and granules][R1], [kernel MMU][MMU]

The lifecycle is a state machine:

1. **Build:** trusted, reproducible-enough artifacts and contract receipts; no run identity.
2. **Prepare:** boot with an isolated, credential-free initializer. Initialize QuickJS, codec, fixed bootstrap, optional RPC library, and a dummy Promise/call path. Return to a reviewed root safepoint with no jobs, exported resources, active timers, live tool promises, or device transactions.
3. **Snapshot:** capture memory extents, complete CPU state and format/feature manifest at that safepoint. Exclude the transport arena. Validate the artifact against the input digests; retain the common backing across clones.
4. **Restore:** select a stopped shell with stable GPAs/memslots, restore backing and CPU state, and service required first faults. Mandatory runtime repair happens before accepting code.
5. **Bind/run:** inject new generation, clock, entropy, policy descriptor, namespace/type manifest, and code. The host table owns actual authority; guest descriptors are hints/indices.
6. **Reset:** terminalize the previous generation, revoke callbacks, stop all actors touching RAM, discard private memory changes, reset zero/scratch/control regions, restore CPU state, and verify readiness. Return the shell to the clean queue only after reset completes.
7. **Discard:** malformed transport, unexpected privileged exit, timeout, failed reset, or uncertain CPU state destroys the hardware slot. Replenishment happens under a bounded budget, with its CPU attributed to runs.

On Linux, begin with warm file-backed `MAP_PRIVATE` snapshots and `MADV_DONTNEED` on stopped private mappings; discard anonymous scratch too. Keep KVM memslots stable. This drops private changes instead of copying bytes over already-private pages. Host page invalidations and first faults remain real costs. [D: memory mechanism][R1]; [madvise semantics](https://www.man7.org/linux/man-pages/man2/madvise.2.html)

On HVF use an explicit stop→unmap→replace/reset backing→map→translation-flush sequence until tested otherwise. Do not assume Linux's mapping-discard behavior behind HVF. Guest-assisted scratch CoW, UFFD, compression, and KSM are deferred: each adds another trusted memory path before ordinary shared mappings have been measured.

### Small-run marginal physical budget

All amounts below are E allocations in bytes, not measured structure sizes. The KVM row is the most uncertain. Dirty logging is measurement-only initially; no production tracking cost is assumed free.

| Component | Bytes/slot | Latency / CPU relevance |
|---|---:|---|
| QuickJS heap, allocator, atoms/refcount private delta | 655,360 | Code/JSON/promise CPU; fixed warmed state remains shared until written |
| Guest stacks, kernel globals, libc/runtime mutable state | 131,072 | Reset and first-touch budget |
| Stage-1 table modifications | 65,536 | Count CoW table writes and TLB work |
| Two 32 KiB rings + 16 KiB control arena | 81,920 | Fixed transport allocation; no maximal-frame buffer |
| Guest input/output windows and live stub state | 98,304 | Bounded copying and materialization |
| Host binding/pending-call/run state | 65,536 | Direct slots and policy checks |
| Host-owned request/validator scratch | 32,768 | Stable copy before validation/use |
| VMM slot metadata and saved register state | 32,768 | Register restore and owner queue |
| KVM objects, host/stage-2 tables, mapping charges | 393,216 | Unmeasured kernel cost; ledger must replace this allowance |
| Runner/shard overhead amortization | 65,536 | Includes committed stacks at declared occupancy |
| Deadline/supervisor amortization | 16,384 | Includes queue/timer ownership |
| **Allocated marginal total** | **1,638,400** | **1.5625 MiB** |
| **Headroom to 2 MiB** | **458,752** | Consumed by real measurements before expanding limits |

Add common resident snapshot/resources and fixed service memory once. Amortization assumptions fail at low occupancy: report N=1 independently. The optional Cap'n Web profile gets an E additional 65,536-byte dirty allowance from headroom, conditional on measurement. Hash-table/export churn may exceed it. Large host blobs are separately admitted system memory/disk consumption, never “free because outside the VM.” A host burst of thousands of large upstream responses must be backpressured before allocation.

This is a workload density target, not a hard physical cap on hostile EL1: it can touch the admitted guest arena. Enforce runtime allocation limits, aggregate commitment/reserve accounting and shard memory backstops separately. Pressure terminalizes offending work or the shard. Never admit an adversarial fleet using only the measured mean private delta as its worst-case reservation.

For HVF, replace the KVM and runner rows with measured HVF kernel and worker-process charges. Until measured, a sensitivity calculation adds an E worker premium of **524,288–2,097,152 bytes/occupied worker** to the Linux ledger, putting it around **2.06–3.56 MiB**. This is not a forecast. Reject a two-MiB macOS claim until the full process pool proves it.

## 5. Request and tool transport

The warm request path is: authenticate/admit grant → canonical recipe lookup → action/content identity → prepared snapshot lookup → warm-compatible slot → reset/restore → runtime repair → bind → execute → tool traffic → validated result → retire/reset. Agent source parsing remains per run. Only immutable, authority-free wrappers move into preparation; arbitrary preludes must be trusted versioned inputs or ordinary request code.

Use a versioned binary **envelope**, with bounded JSON payloads initially. Do not add a new general object codec before removing the existing crossings. A record header contains kind, flags, bounded byte length, generation, call ID, cap slot/method ordinal, and reserved-zero fields. Generation and IDs are checked against host state. Lengths use checked arithmetic. Records wrap with a padding marker; cursors are monotonic counters with bounded distance. Release/acquire publication commits complete records. Host counters and ownership, not guest-writable indices, decide what is valid.

The two byte rings carry CALL/RETURN, RUN/FINISH, resource/blob operations, stdout/stderr bytes, and bounded diagnostics. Reserve a control/credit lane so byte output cannot starve cancellation or completions. Maximum inline record is E 16 KiB; larger messages use blob handles/chunks. A 64 KiB source from the compatibility class can stream through the fixed arena under a total bound; the small class does not allocate a 1 MiB frame buffer.

The guest kernel owns demultiplexing by record kind and call ID. The QuickJS shim uses a preopened RPC fd/native bridge; synthetic file reads use that same kernel dispatcher. A synchronous `/cap/` read must not depend on the suspended JS stdin event loop to receive its reply. This resolves the deadlock in the current bootstrap-owned reply path. [D: current blocker][R5]

Three operations are sufficient: `SUBMIT_CONTINUE`, `SUBMIT_WAIT(observed_response_seq, deadline)`, and `FINISH`. Batch CALLs until the JS microtask/job queue has no runnable work or ring credits require a flush. At that point use SUBMIT_WAIT. Independent `Promise.all` calls publish together. A call followed by useful guest computation can use SUBMIT_CONTINUE and later WAIT, paying the extra exit explicitly.

On KVM, feature-probe SMCCC forwarding and configure a permitted function range before vCPU execution. Use a constant operation selector, with payloads in the ring; avoid a sequence of register-fetch ioctls per call. Unconfigured HVC is not an arbitrary VMM callback. Use one fixed-width MMIO-store doorbell as the fallback. [D][R2]; [KVM SMCCC interface](https://docs.kernel.org/virt/kvm/devices/vm.html)

WAIT drains requests, checks the host-owned completion queue and requested observed sequence, registers a waiter, then rechecks before releasing the runner. Completion publication and WAIT registration use the same per-slot synchronization. If ready, resume immediately; otherwise return the runner to its queue. A concurrent completion either prevents parking or enqueues that generation once. Resume with response bytes already published; no guest interrupt is required. WFI is not this scheduler yield. The MMIO backend must finish KVM's pending instruction completion before parking/reset; count any immediate-exit KVM_RUN needed for that bookkeeping. “One logical exit” does not justify hiding it. [D][R2]

| Workload | Boundary accounting target E |
|---|---|
| One immediate awaited tool | Two logical records, one SUBMIT_WAIT service/resume cycle, no host-thread sleep/wakeup, then one FINISH exit for the run |
| B immediate independent calls | B requests and B replies; one submission per arena-capacity batch; zero sleeps if completed inline |
| One asynchronous tool | One submit/wait exit, no retained runner, one runnable-queue enqueue on completion; zero wakes if owner is already active, at most one wake of a sleeping owner |
| Submit while guest continues | One submit exit plus a later wait exit if needed |
| Read local docs/immutable resource | Zero host calls; local guest SVC/copy only |

Baseline copying is two copies per direction: guest buffer→ring→stable host request, and encoded host result→ring→guest buffer. Some serialization can write directly into a reserved ring span, but that is an optimization, not a zero-copy promise. The host copies guest-writable data before releasing the vCPU or retaining arguments across an await. It validates and invokes from the **same owned value**. No repeated stringify→parse→clone normalization stack is necessary. Preserve duplicate-key, Unicode, depth, numeric, schema, and state checks from v1 in a single canonical implementation.

### Latency and CPU allocations

These are E targets for a Linux/native **resident-cache** fixture at declared load. Wall columns exclude tool service time and admission queue delay; queue delay is measured separately and overload sheds at a bound. CPU includes host, guest execution and attributed reset, not remote-provider CPU.

| One small inner call | Wall µs | CPU µs |
|---|---:|---:|
| Guest stub / JSON encode / decode / Promise delivery | 6 | 6 |
| Checked copies, envelope and structural validation | 4 | 4 |
| Host exit/reentry, including backend instruction completion | 8 | 8 |
| Binding/revocation/schema/effect checks; immediate adapter dispatch | 5 | 5 |
| Completion publication and queue/owner handling | 3 | 1 |
| Slack | 2 | 2 |
| **Incremental target** | **28** | **26** |

Target ≤30 µs p50 and ≤60 µs p99 for the incremental slope of 0/1/10/100 echoes. An async call has additional real queue/wakeup delay; publish its distribution. The exit allocation has no verified Graviton/Ampere measurement. Nested KVM cannot validate that number. Expensive policy or remote credential minting is additional real work, not permission to skip enforcement. [Evidence boundaries and proposed transport goals][R2], [R5]

| Warm execute → result, one immediate tool | Wall µs | CPU µs |
|---|---:|---:|
| MCP decode, bounded validation, authenticated context | 15 | 14 |
| Grant admission / cached shape binding | 8 | 8 |
| Recipe/action/prepared-cache references | 4 | 4 |
| Owner queue, slot selection, deadline arm | 8 | 7 |
| Backing reset, CPU restore, mandatory first-touch | 75 | 70 |
| Generation/entropy/time repair and late binding | 15 | 15 |
| Fresh snippet parse plus fixed runtime execution | 40 | 40 |
| One immediate inner call | 28 | 26 |
| FINISH validation and owned result | 10 | 10 |
| MCP response encode/flush | 20 | 18 |
| **Allocated warm total** | **223** | **212** |

The comparable already-reset raw parked fixture spends an E **93 µs** in binding, snippet work, one call and finish; gate it at ≤120 µs p50 / ≤200 µs p99 against today's measured 285 µs. The full restore-inclusive warm target is ≤250 µs p50 / ≤1,000 µs p99. Also test restore p99 independently at ≤800 µs. These tight targets can fail while the broader synthesis hypothesis of 0.1–0.8 ms restore and 1–2 CPU-ms remains viable. Do not turn a failed 250 µs target into a measured claim by quietly removing restore.

Successful-run background reset is charged once: either in the table before the next invocation, or as attributed retirement CPU, never both and never neither. Target ≤1 CPU-ms steady-state per tiny fixture including supervisor, admission, reset and refill; allow no hidden per-run boot cost. Native ELF startup and materialized JSON get separate rows/classes rather than borrowing the 40 µs snippet allowance.

### Removing most MCP overhead requires changing its local topology

Make the native MCP handler an entrypoint to the native executor, also exposing an embedded Executor ABI. A colocated native agent uses an in-process MCP transport or direct adapter; no separate Node MCP server, executor server, or intermediary subprocess. Compile static envelope validators once and decode each request once. Cache tool/resource discovery; maintain upstream MCP sessions and HTTP connections. Serialize the final bounded response once, retaining a compact text representation where client compatibility needs both text and structured content. [M: repeated validation and process wakes][MCP]

Allocate E **≤70 µs incremental local MCP cost**, including local delivery and margin, versus the measured 357–518 µs comparators: roughly 80–86% removed **if that topology passes measurement**. The table's decode+encode allocation is 35 µs wall; 35 µs remains for local delivery/margin. Test the actual client, not only a no-op internal handler.

A third-party Node client over stdio still pays two process wakeups, its own SDK validation, and scheduling after idle. A native server cannot promise to erase that client-owned cost. Preserve standard stdio as compatibility mode and publish it separately; if it stays around the old overhead, the “most removed” claim applies only to embedded/native ingress. Cloudflare adds a real network/service-binding hop and cannot inherit a local sub-millisecond end-to-end guarantee. MCP defines both stdio and HTTP transports; this design changes deployment topology, not MCP semantics. [M][MCP]; [MCP transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)

## 6. Files, blobs, and keeping big data outside the VM

| Interface | Semantics and path cost |
|---|---|
| `/skills/...`, `/images/<digest>/...` | Trusted immutable archive; metadata local; ordinary reads copy into EL0 with no host RPC. |
| `/mcp/<binding>/tools/<method>.json` and `.d.ts` | Cached schema/type documents for admitted shape; no effect from reading metadata. |
| `/mcp/<binding>/resources/<encoded-uri>` | Injective URI alias from a granted local manifest. First materialization fetches once; later opens/read/seek see the same run-version bytes. |
| `/cap/<slot>/call/<method>` | Duplex invocation endpoint, not a seekable regular file. One complete bounded request submission commits one invocation. |
| `/blob/<run-handle>` | Read-only bounded view of an authorized immutable host blob; chunks copied on demand. |

Open/stat/readdir/close of capability endpoints are local and side-effect-free. Partial writes accumulate under a per-fd limit without invoking. A complete length-delimited record submits exactly once; a second submission fails. Reads return the tagged response then EOF; repeated reads do not reinvoke. Nonblocking reads return EAGAIN until ready; blocking reads use kernel WAIT and common demultiplexing. `ppoll` watches the same completion state. Seek on a call endpoint returns ESPIPE. Close cancels interest and releases handles; it does not roll back an already submitted effect.

For resources, authorization precedes content-cache lookup. The host may deduplicate bytes but must never treat knowing a digest as permission. Explicit refresh obtains another authorized version and new fd/blob identity. Stock MCP `resources/read` may require retrieving the entire resource upstream once; local range reads do not invent an upstream range protocol. Namespace traversal cannot escape grant roots through `..`, encoded separators, symlinks, or numeric slot reuse. [D: resource/FS contracts][R5]

Large tool results should produce `{blob: opaqueHandle, bytes, mediaType, preview}` under a new negotiated result profile. No silent v1 truncation or automatic replacement of a declared JSON result. Tools expose explicit `project`, `slice`, bounded `read`, or streaming adapters; simple schema-checked projections run in native host code with no dynamic guest code evaluation. If an upstream server already serialized a huge JSON document, the host still pays its receive/parse cost; retain/spill it once and avoid a second parse inside QuickJS.

Handles are run-table entries, with rights, generation, lifetime and host byte quota. Digests identify content; handles authorize access. Cross-run transfer requires the host to reauthorize and mint a new handle. Small reads use at most an E 16 KiB guest window. No transparent 1 MiB “helpful” materialization. The local structured-JSON fixture needed an **8 MiB QuickJS heap limit** and about **21 ms** native Bellard parse/stringify, so it cannot inhabit the two-MiB class. [M][R4]

At FINISH, output policy may transfer selected blob references into the host computer-session table before run handles are revoked. That session has a byte quota and expiry; a subsequent execute/exec receives a newly authorized run handle. All untransferred references are released. This makes result→native-tool composition possible without retaining the previous VM.

For byte-oriented native tools, stream host blob chunks into guest stdin and stream stdout chunks back into a host blob with bounded windows/credits. Processing a large input does not imply a large QuickJS heap. A tool such as jq can still build a large private native data structure: its working set gets its own class and measured limit. Do not market streaming as a universal constant-memory algorithm.

## 7. Cap'n Web and the Cloudflare computer

Use Cap'n Web as an optional prepared guest client with a ring custom transport and a host session adapter. Keep plain CALL/RETURN for simple tools. Preserve its JSON protocol; Cap'n Web is not Cap'n Proto's binary format. Native dispatch stays the common authority boundary even if the initial interoperable session adapter requires a persistent JS adapter worker. Such a worker adds measured process crossings; it is excluded from the 28 µs plain-call budget until replaced or proven within it.

Ordinary awaited Cap'n Web calls can produce push, pull, resolution, and release: **four logical messages**, versus two for plain calls. Batch push+pull into one publication, piggyback/defer bounded releases, and bulk-dispose at run termination. Count wire messages, ring records, doorbells, VM exits and waiting rounds separately. The measured bundled core/RPC was **46,404 bytes**, full bundle **59,613 bytes**; neither establishes resident heap cost. Prepare it once with reviewed QuickJS shims, including error-path globals, rather than embedding it into every request. [D/M][R5], [Cloudflare study][CF]

Pipelined calls target a prior promised answer without pulling intermediate JSON into the guest. A dependent chain can publish its graph and await the final result once. A remote map can resolve a list and expand calls at the host, keeping its IDs/results out of guest memory. Normal `list` followed by `Promise.all(get...)` already has **two waiting rounds**, not one plus N. Plain MCP remotes still execute their dependent network calls in order; only compatible remote graph/batch interfaces remove those upstream waits. [D][R5]; [promise-pipelining mechanism](https://capnproto.org/rpc.html)

Bound the graph before and during expansion: E 64 outstanding leaf invocations, 4,096 total protocol ceiling with the smaller host-policy default retained, 256 live promise/export entries, nesting one for remap, eight captures, and 256 instructions. Admit all expanded calls individually through schema, effect, taint, revocation, approval, byte, and global concurrency checks. Stop expansion when credits run out. Return handles/projected data rather than retaining an unbounded list of pending promises. Only host-issued resource stubs may introduce authority; reject arbitrary guest exports and callbacks into guest code. Explicit disposal and host bulk cleanup are idempotent.

The proposed Cloudflare-facing API is a backend adapter, not a claim that Workers can create KVM guests locally:

```javascript
// Worker-side code; SOFORT is a trusted service binding / authenticated client.
const grant = await grants.forRequest(request); // host-issued, scoped, revocable
const bins = [pinnedBins.jq, pinnedBins.rg];      // validated immutable digests
const computer = await env.SOFORT.computer({grant, bins});
try {
  return await computer.execute({
    code: `
      const issues = env.github.listIssues({repo: "example/project"});
      const details = issues.map(issue =>
        env.github.getIssue({repo: "example/project", id: issue.id}));
      return await details;
    `,
    result: {mode: "blob", previewBytes: 1024}
  });
} finally {
  await computer.dispose();
}
```

`computer()` returns a short-lived host session descriptor and admitted tool types/mounts. It can reuse a prepared-key reference, connector sessions and host affinity across several execute calls. Every execute gets a fresh run generation and restored guest. The guest's `env.github` is created after restore from a live slot table; the base snapshot contains no GitHub principal, stub target, token, resource session, or approval. The granted `.d.ts` is generated/cached by shape and delivered as authorized metadata. `bins` limits executable artifacts; it grants no network or file authority by itself.

The computer recipe references per-binary templates; it does not concatenate every binary into the QuickJS snapshot. Different binary allowlists can share identical QuickJS prepared bytes while the host admission table exposes different executable capabilities.

`computer.exec({bin: "jq", args: [filter], stdin: blobHandle})` selects an admitted native template and returns status plus stdout/stderr blob handles. A guest JS `env.bins.jq.exec(...)` uses that same host capability and acquires another bounded VM slot; it does not spawn a host process. Child slot CPU, memory and count are charged to the parent operation. This permits tool-result→jq→next-tool composition with only handles crossing the JS VM. Simulate-then-approve requires a declared tool-specific simulator; simulated results carry that label and cannot be confused with committed effects.

## 8. Native binaries, byte output, and offline growth

Today's packer accepts only static AArch64 ET_EXEC, rejects interpreters/dynamic segments, and confines loads to `0x400000..0x680000`, **2.5 MiB**. `mmap` is anonymous RW only, and the address translation helper assumes today's affine layout. These precede many syscall misses. [D][R3], [packer][PACK]

Change the offline packer to emit a checked segment/extent manifest with profile-specific bounds, holes and BSS demand-zero regions. Review changes to `mmu::physical`, `user::access`, startup stack/auxv, cache maintenance ranges and mapping tests together. Support larger static ET_EXEC first. Add static PIE only with explicit relocation validation, supported relocation types, overflow checks and load-bias rules. Dynamic ELF/PT_INTERP, executable mappings, threads and signal delivery remain separate structural profiles.

Native templates snapshot at the initialized kernel/loader gate **before entering the binary**, rather than guessing a safe checkpoint inside an arbitrary program. Fresh argc/argv/env/AT_RANDOM/stdin descriptors are then built per run. Their libc startup remains paid work; E reserve an initial extra 50–250 µs for simple native startup, to be replaced by census measurements. Start with synchronous Rust-musl, jq stdin transforms, `rg --threads 1 --no-mmap`, and SQLite `:memory:`/immutable read-only fixtures. None is declared compatible until its real workload passes. Writable SQLite requires actual locking/journaling/sync semantics; Go and ordinary Node require scheduler/futex/signal work, not fake success returns. [D/E scope][R3]

Give fd1/fd2 dedicated BYTE_STDOUT/BYTE_STDERR records. Any byte, including NUL, Unicode and diagnostic-looking prefixes, remains opaque payload. Program exit produces an exit-status record, then FINISH; it is not JSON and cannot forge a tool call by printing JSON. Control RPC is a different preopened fd/record kind. A forged raw ring remains hostile host input. Apply output limits with explicit failure/spill receipts. For JS, its normal return still needs validated FINISH; process exit alone is never success. This is a new ABI, not a relaxation of v1's ASCII rule.

The grow loop stays offline. Discovery records exact binary hash, argv/input corpus, libc, architecture, syscall **arguments**, synthetic paths, load failures, semantic mismatch and resource failures. It runs Linux reference probes, held-out application checks, then a candidate implementation in isolated fresh guests and snapshot-reset guests. The common superset grows only after independently owned tests, deliberate wrong-handler mutations, and memory/CPU regression gates pass. Recipe policy exposes the accepted subset and returns truthful errors outside it. No model participates in execution or missing-call recovery.

Keep existing leaf-handler checked-copy ownership. Threads/signals/mappings need subsystem-wide reviewed contracts, not one-file patches pretending to add complete semantics. Use extracted gVisor/LTP cases plus stateful sequences and output canaries. Synthetic RPC files need a separate executable contract/oracle backed by a fake deterministic adapter; ordinary Linux files cannot define their effects. The existing 90/90 regrowth is three repeated fixtures, not unseen-feature coverage. [D][R3]

## 9. Reset, termination, and record/replay

Terminal state invalidates the run generation **before** callbacks can publish more data. Require zero outstanding calls for successful FINISH. An error FINISH cancels interest in the rest; host operations may finish later, but their generation-tagged results are dropped and their retained resources remain charged until released. Capacity stays charged through reset/destruction, including noncooperative adapter work. Tool adapters must expose async, bounded, cancellation-aware contracts; arbitrary synchronous JS callbacks cannot sit on runner or deadline threads.

The reset receipt covers RAM and zero/scratch regions; ring cursors/credits; guest fd/allocator state; promises/exports; host bindings and approvals; GPR/SIMD/system registers; debug/PMU/optional vector state; timers/counter offsets; exception state; and required instruction/translation coherence. Disable unsupported optional CPU features. Test stale stage-1/stage-2 mappings with guest canaries, not only host memory reads. Cache/branch-predictor microarchitectural state is not fully reset by restoring architectural state; public-page sharing remains a side-channel risk and may require authorization-domain placement.

A fresh kernel seed is insufficient for initialized QuickJS `Math.random`, libc guards or secret-derived hash state. The prepared runtime must expose an audited after-restore hook at its root safepoint. Refresh the existing JS PRNG, entropy stream, time/IDs and runtime secrets before accepting tenant code. Ensure no protected live C stack frames retain old stack-guard expectations; use a reviewed leaf/root boundary or reconstruct those frames. Hash tables depending on a secret cannot survive arbitrary key changes without repair: either use a safe supported rehash or delay that state until after restore. Updating AT_RANDOM alone repairs none of these existing objects. Reject a runtime template if its repair cannot meet correctness/budget gates. [D][R1], [R4]

Use host monotonic absolute deadlines. While a VM runs, the deadline thread requests KVM immediate exit plus a targeted owner kick; HVF uses its supported vCPU-exit request. The owner terminalizes the slot, aborts tools and destroys it after an unclean stop. If an owner/shard fails to acknowledge cancellation within a bounded grace period, the separate native supervisor kills that shard using stable process identity. Sibling runs receive a terminal infrastructure error. A blocked trusted adapter belongs in a separate persistent adapter service or is unsupported. No per-call watchdog process is created.

E cancellation goal: VM execution stopped within 5 ms p99 after deadline on the declared load, with the historical **≤50 ms, 30/30** exposure threshold retained as a mandatory hard test. API completion, actual CPU stop, tool cancellation and process death are separate observations. Report shard-kill blast radius. Historical failures in the [kill ledger][KILL] and the newer watchdog improvements in [FINAL][FINAL] must both inform the regression matrix.

Record/replay is a new explicit mode, because v1 excludes it. Record host-observable decisions: image/prepared/code digests, grant provenance and policy version, guest issuance IDs, exact normalized calls/argument hashes, ordered completion delivery, result/error bytes or blob digests, clock/random/timer events, approvals, and upstream operation IDs. Diagnostic mode uses bounded host append buffers/spill; E reserve 256 bytes fixed metadata per call plus payload/blob accounting. Add E 2–5 µs/call for a memory journal and measure it outside the base table.

Deterministic replay starts a **new** single-use VM, reauthorizes access to recorded private data, feeds logged entropy/time/results, and checks each issued call before supplying its recorded completion. `Promise.race` needs the recorded delivery order, not merely the same result set. Clock reads must use a controlled logical clock or logged events; the advancing hardware counter path is not replay deterministic. Reject unsupported nondeterminism/divergence instead of invoking a live tool opportunistically.

Replay profiles disable direct EL0 counter access or reject binaries relying on it; syscall clock hooks alone cannot control a directly read counter. Resource/stdin versions and every permitted external byte stream also belong to history. This is boundary replay for the admitted deterministic profile, not instruction-level replay of arbitrary Linux programs.

Approval-resumable mode needs durable intent/completion records, with fsync/replication latency reported separately. It cannot use the 2–5 µs diagnostic journal estimate. A crash after a remote effect but before completion becomes `UNKNOWN_OUTCOME`. Retry only with the remote's durable idempotency/status contract; otherwise stop for reconciliation. Local content hashes, SSE resume and reconnect do not establish exactly-once effects. [D: replay boundary and ambiguity][R5]

## 10. Fleet placement and cache locality

Make the run the placement unit. Route by architecture/features, prepared key, authorization domain, memory class, data locality, ready slots and load. Ingress uses an in-memory host directory with readiness/cache summaries; hosts validate the manifest and live grant. No global scheduler/database lookup occurs per inner tool call. Cache-key knowledge never substitutes for authorization.

Return an authenticated short-lived affinity hint with `computer()`/execute results: agent-session reference, region, host, compatible prepared key and expiry. It contains routing preference, no capability. On the agent's next call, try that healthy host if it has compatible capacity and its blob/connector cache is useful. Reauthorize the new run and reset a slot. Prefer warm host state, not a previous tenant heap. If overloaded, compare estimated queue delay with measured cold/local-cache cost and spill to another compatible host.

Keep separate cache levels: shared artifact CAS; host-local verified snapshot/working-set cache; ready hardware slots. Prewarm likely templates after a grant shape is introduced, using a bounded background budget. Hot code/resources are prefaulted once into shared cache, not copied into every VM. E affinity record budget is 128 bytes/session, with a capped TTL table and E ≤10 µs route lookup at ingress. Blob retention, prewarm CPU and cache replication are globally charged and evicted by quota; hints may be stale without causing incorrect execution.

An in-flight guest remains on one host. Async completion routing uses its host/slot/generation. Do not migrate live VM state to chase tools. On host failure, reconcile journal/effect state; only restart safely replayable work. The next fresh execute can run elsewhere. Snapshots transfer only across compatible CPU/backend/granule contracts, while ordinary immutable binary/resource bytes can have a wider cache domain. Region/network latency and remote snapshot fetch are outside the local hot-cache budget and must be shown in service SLOs. [D: working-set and cache requirements][R1], [R5]

## 11. Keep, change, and delete at file level

These are proposed edits, not edits made by this document. New paths below are proposed owner boundaries.

| Existing files | Decision |
|---|---|
| `kernel/src/syscalls/*.rs`, `syscalls.rs`, `slots.json`, `build.rs` | Keep reviewed restricted contracts/copy helpers; add cheap immutable per-run policy masks. Grow semantics offline. |
| `kernel/prepare.py`, `artifact.py`, `link.ld` | Keep validation/provenance/archive discipline; change to versioned extent/segment manifests, larger profiles and host-granule alignment. Python remains offline only. |
| `kernel/src/{mmu,user}.rs` | Change together for manifest mappings, safepoint/repair gate, native startup and permissions. Preserve hostile-pointer/alias tests. |
| `kernel/src/fs.rs`, syscall read/write/ppoll/fstat/open handlers | Keep archive behavior; add tagged fd kinds and synthetic mounts over common kernel demux. |
| `kernel/src/{console,wait,fdt}.rs` | Replace production console/GIC discovery/wait path with proposed `kernel/src/channel.rs`; retain legacy backend only as a comparison until gates pass. |
| `protocol/dispatcher.ts`, `PROTOCOL-v1.md`, `bootstrap.js` | Preserve normative checks/test vectors and v1 compatibility. Add a separately versioned ring ABI; move fixed wrappers to prepared state. Proposed `protocol/ring.md` and native checker own that ABI. |
| Proposed `runtime/qjs-jitk.c` | Small Bellard embedder/bridge owns the root checkpoint, job-loop ring batching and runtime repair hooks. Stock qjs remains the legacy comparator; safe heap snapshots require this explicit runtime integration. |
| `executor/{executor,pool,backend,code}.ts` | Keep public Executor/IsolateDriver adapters. Replace process-per-run core with proposed `executor/native/` and slot leases; remove per-run codec injection and repeated normalize/clone passes after conformance. |
| `executor/policy/policy.mjs`, policy adapter/tests | Keep effects, taint, exact approvals, credential lifecycle and replay rejection as normative fixtures; port execution to the native capability table. No security reduction to meet 5 µs. |
| `vmm/src/main.rs`, `watchdog.rs`, `sandbox/` | Keep CLI compatibility, native external supervisor and confinement tests. Add `vmm/src/{slot,snapshot,kvm,hvf}.rs`; rework cancellation to slot/generation plus shard fallback. |
| `vmm/patches/*` | Keep robustness/direct-load patches for legacy baseline. Remove libkrun/device patch dependency from the new backend only after equivalent hostile-exit tests pass; never claim another 2.8 MiB saving from an already-applied loader patch. |
| `mcp/{server,jitk}.mjs` | Keep official-SDK compatibility/conformance harness. Replace fast service with native ingress; remove a distinct Node server hop from the supported embedded topology. |
| `grow/{loop,agent,adapters}.py` | Keep offline controller ownership, immutable receipts and proposal constraints. Replace hardcoded regrowth scope with reviewed feature contracts, semantic sequences and hidden cases. |
| `bench/{run.py,cases.json,executor.mjs}`, MCP bench | Keep benchmark provenance and legacy comparators. Add restore-inclusive/service-CPU/dirty/exit/copy counters and realistic structured/blob/native fixtures. Dev watchdogs stay dev-only. |

Avoid permanently keeping two production codecs, two policy engines, and two dispatchers. Differential migration uses one normative fixture corpus; remove superseded production paths after the replacement is certified.

## 12. Build order, gates, and abandonment

Each experiment below is initially a less-than-one-day local or existing-dev-KVM spike. Nested KVM establishes functionality only. This architecture requires no new cloud work. Link reports/receipts to exact artifact and host metadata, including host granule, CPU mode and concurrency. Gates are E decisions based on [synthesis experiments 1–7][S].

| Order | Concrete experiment | Pass / kill criterion |
|---|---|---|
| 0 — B1, experiments 1–2 | Post-direct-load ledger at N=1/16/64/256; booted-QJS dirty census for empty, one_tool, 64 KiB and structured 1 MiB JSON | Attribute all guest/host/kernel/shared/transient categories. No ≤2 MiB claim if small-class measured marginal total exceeds 2,097,152 bytes. Large JSON exceeding it defines a larger class, not a normalization trick. |
| 1 — B2/B5, experiment 3 | Minimal independent-VM Linux shard, fixed owners, no devices; count fds, kernel objects, translation tables and idle CPU | Synthesis kill line: empty VM >1 MiB marginal triggers redesign before porting runtime. At 1,000 waiting slots, runner count remains bounded and aggregate idle/wait CPU stays below the historical 10% host-capacity threshold. |
| 2 — B3, experiment 4 | Host-CoW restore ×1,000; canaries and entropy/runtime repair; vary dirtied bytes and recent-runnable VM count | Zero cross-run/sibling leaks or cloned unique streams. p99 restore ≤800 µs target, including mandatory first faults; >1 ms kills sub-ms restore claim. Total reset/refill-inclusive tiny-run CPU ≤1 ms target; >2 ms reopens the mechanism choice. |
| 3 — B4, experiment 5 | WAIT/ring plus native echo, HVC and MMIO; 0/1/10/100 sequential calls and 64-wide batches, ≥10,000 small-call observations | Increment ≤30 µs p50/≤60 µs p99; raw parked one_tool ≤120/200 µs. No lost wakeups, zero retained waiting runners, and Promise.all overlaps tool durations. Failure kills the 28 µs allocation; investigate actual exits/copies before adding a codec. |
| 4 — B9 and I/O experiments | Late-bind two principals to one snapshot; schema/resource/policy changes; cached wrappers and native MCP ingress | No builder/whole-image hash on hit; cache bookkeeping <20 µs; same prepared snapshot survives credential rotation. Core tiny warm execute ≤250 µs p50/≤1 ms p99; local embedded MCP increment ≤70 µs. Publish unchanged-client stdio separately. |
| 5 — B6/B7, experiments 6–7 | Exact jq/serial-rg/SQLite/Rust/Go census; native byte stdout; extracted gVisor/LTP and stateful sequences; genuinely new leaf growth | Byte/status/defined-error equivalence, no unexpected effects; wrong errno/skipped-copy/stale-fd mutations must fail. Prohibited Go threads/signals put Go in another tier. No “version command passed” compatibility claim. |
| 6 — B9 | Resource/call-fd contract fixtures, blob projection, graph/quotas, deterministic replay/crash-after-effect | Metadata/rereads cause zero extra tool effects; partial writes cause zero effects; replay preserves race order; unknown mutation outcomes never blind-retry. Optional RPC adds ≤10 µs to equivalent plain-call control cost and stays within measured dirty allowance, otherwise keep it optional/larger-class. |
| 7 — platform/fleet | HVF worker reset/cancellation and occupied-worker ledger; two-host next-call affinity with host loss/overload | No stale translations/authority, bounded wake/IPC CPU, explicit macOS slope. Warm routing chooses compatible cached hosts without reviving old heap; fallback reauthorizes and safely reconciles effects. No cross-host low-latency claim from a local benchmark. |

Abandon or narrow this design if unavoidable KVM metadata plus the small QuickJS dirty set cannot fit the two-MiB slope; if correct restore requires repeated boot or >2 CPU-ms steady-state; if WAIT retains threads; or if a second host hop is mandatory for every tiny call and defeats the budget. A shared snapshot that still allocates private pinned copies fails the mechanism, whatever RSS appears to say.

Do not trade reset correctness, Linux semantics, credentials, or effect policy for a target. If the native shard's larger trust/blast boundary is unacceptable, retain a broker boundary and accept its measured cost. If secret-free shared pages are unacceptable for an authorization domain, use domain-specific backing and account the lost sharing. If engine refcount/hash repair dominates, run the synthesis's snapshot-aware engine shootout rather than shrinking syscall wrappers. If JS-only density/throughput cannot beat an equivalent-isolation Hyperlight baseline by the investment margin in the kill ledger, prefer that backend; retain jitk only where restricted native Linux ABI and verified offline growth earn their maintenance cost.

## Evidence and input notes

The requested root `docs/KILL-CRITERIA.md` is absent. Read the actual [jitk kill ledger][KILL], reconciled its historical status with [FINAL][FINAL] and the binding [synthesis][S]. Current code was inspected for the packer/MMU/startup, console/wait, bootstrap/dispatcher, executor/pool/backend/wrappers/policy, MCP, grow controller, and benchmark accounting. Older reports' uniqueness, HVF and pipelining overclaims are superseded by the next-round reports.

[S]: ../research/next/SYNTHESIS.md
[R1]: ../research/next/01-snapshots-memory.md
[R2]: ../research/next/02-vmm-density.md
[R3]: ../research/next/03-compat-grow.md
[R4]: ../research/next/04-runtimes-platforms.md
[R5]: ../research/next/05-io-caps-images.md
[FINAL]: ../FINAL.md
[CF]: ../research/cloudflare-deep.md
[MCP]: ../jitk/mcp/RESULTS.md
[KILL]: ../jitk/docs/KILL-CRITERIA.md
[V1]: ../jitk/protocol/PROTOCOL-v1.md
[MMU]: ../jitk/kernel/src/mmu.rs
[PACK]: ../jitk/kernel/prepare.py
