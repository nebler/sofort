# Architect B: keep the computer, replace the lifecycle

2026-10-25. Design only; no new performance measurements. This proposal follows the [shared brief](BRIEF.md) and treats [SYNTHESIS](../research/next/SYNTHESIS.md) as requirements. **M** means an existing project measurement, **C** a fact checked in the present code, and **E** a proposed budget, limit, or experiment gate. All numerical allocations for the proposed system are E unless explicitly marked otherwise.

## 1. Decision

Keep jitk, Bellard QuickJS, the packed read-only filesystem, the TS executor interfaces, the host policy, MCP, and the independent native watchdog. Replace the mechanism that creates and retires a computer. Reuse hardware slots, never a tenant's execution state. Each run starts from a tenant-free prepared snapshot, receives fresh identity and late-bound capabilities, and ends irrevocably.

**libkrun survives the first measurement and sharing steps, then leaves the production path when a narrow replacement passes the same functional, containment, memory, and CPU gates.** It remains the reference backend until that cutover. Do not add a general libkrun snapshot API, a second device model, or a many-VM scheduler inside its event loop. Today's launcher builds a console, device manager, payload, and one-vCPU machine and calls `vm.run()`; its external interface has no reusable-slot or mid-invocation yield contract. The research confirms dedicated libkrun vCPU threads on both platforms. Those are concrete seams, rather than a claim that libkrun is intrinsically slow. [C: launcher](../jitk/vmm/src/main.rs), [R2 §§1,5](../research/next/02-vmm-density.md).

The replacement is one Rust runner with KVM and HVF modules. It owns guest mappings, vCPU entry/exit, bounded scheduling, transport, reset, and cancellation. It does not own credentials or decide tool authority. Use pinned KVM ioctl/binding crates and direct HVF bindings, without another general VMM framework. On Linux it contains many independent KVM VMs in bounded shards; on macOS each persistent worker process owns one HVF VM. There is no macOS logical-context swapping in the first design.

**The executor stays in TS/Node.** Move its physical pool and deadline enforcement into the existing native VMM boundary; do not rewrite schemas, approvals, provenance, provider SDKs, or MCP in Rust. First remove repeated trusted codec/prelude work and measure the remaining TS cost. A native Node addon would put VMM code beside credentials; a separate Rust policy service would introduce another authoritative policy implementation and another deployment. Neither is the smallest next step.

The required target class, **small glue**, is declared before testing: up to 8,192 UTF-8 bytes of fresh JS, at most eight simultaneous tool operations, at most 4,096 bytes per ordinary control request/result, and at most 65,536 bytes of aggregate materialized tool data. These are admission limits, not evidence that every program inside them fits. Code can allocate independently of its inputs: peak private pages and CPU remain measured acceptance conditions. Existing larger v1 requests stay in a separately admitted, measured large class; they cannot silently consume the small-class allowance.

The small-class gates are marginal total physical memory at most 2,097,152 bytes per slot, hot restore p99 at most 1,000 µs, and amortized service CPU at most 1,000 µs per named tiny-run fixture. The synthesis's 1–2 CPU-ms hypothesis is an investigation range, not a reason to soften the final target. Count Node, runner, watchdog, reset, system CPU, and refill; publish local tool CPU separately and include any tool adapter work the service owns. Arbitrary computation and remote tool durations have no universal one-millisecond bound. [Requirements](../research/next/SYNTHESIS.md), [R4 §§3,7](../research/next/04-runtimes-platforms.md).

The old canonical observations are useful comparators, not today's certified baseline: M, 10.657 MiB parked process footprint, 4.859 child CPU-ms for cold `return2`, 5.904 ms cold response, and 285 µs parked `one_tool`. They exclude some host charges. The raw-direct-load patch and measurement chronology must be resolved by rerunning the actual selected artifacts. The older 10.7 MiB figure cannot be reduced by subtracting the loader saving again. [R1 §1](../research/next/01-snapshots-memory.md), [FINAL corrections](../FINAL.md).

## 2. Count the parts and assign ownership

A moving part here means a separately reasoned state machine, external dependency boundary, or operational lifecycle. A module split does not reduce the count. Several processes running the same machine multiply instances, not architectural kinds. The count deliberately charges snapshot correctness and cache identity as new mechanisms.

| Responsibility | Today | Proposed core |
|---|---|---|
| 1. MCP requests and external resource API | SDK/server | Keep |
| 2. Executor and upstream API compatibility | TS wrappers | Keep, cache fixed preparation |
| 3. Capacity admission and physical slot scheduling | TS single-use pool | Move physical scheduling into runner |
| 4. Wire validation and protocol budgets | Canonical TS dispatcher | Keep authoritative validation; adapt framing |
| 5. Grants, effects, credentials, approvals | Host policy | Keep in Node |
| 6. Independent deadline failsafe | Native watchdog process | Keep, add generation-tagged leases |
| 7. Host confinement setup | Sandbox module | Keep, revise native syscall allowances |
| 8. Hardware VM lifecycle | libkrun | Replace with narrow KVM/HVF backend |
| 9. Guest/host I/O and parking | Virtio console, IRQs, WFI | Replace with ring and explicit WAIT |
| 10. Guest Linux ABI and ordinary files | jitk and JITKFS01 | Keep |
| 11. Language execution | QuickJS/bootstrap; separate Lua | Keep |
| 12. Prepared-state capture and complete reset | Absent | Add; earns sharing and avoided initialization |
| 13. Recipe/content/prepared-state identity | Partial artifact hashes | Add one local cache mechanism |

Thus the core grows **11 → 13** parts. The existing offline builder, grow/oracle controller, and benchmark/conformance harness remain three supporting parts: **14 → 16** overall. Implementing synthetic RPC files adds one transaction adapter; enabling Cap'n Web adds one session/reference machine: **15 runtime / 18 overall** with both. Neither is hidden under “just a library.” During migration two VMM implementations temporarily coexist; that extra backend must disappear from shipping configuration after acceptance.

Node owns logical run records and trusted tool work. Rust owns physical leases and treats Node commands as trusted control messages, while treating all guest bytes as hostile. Guest EL1 owns only Linux ABI behavior; it never authorizes a host operation. The builder produces immutable artifacts. The grow controller produces candidates; an independent acceptance harness promotes them. The benchmark harness is the sole source of performance receipts.

```text
                     one long-lived Node process
 MCP SDK -> executor -> policy / credentials -> async tool connections
                |           ^
                | bounded multiplexed control/call channel
                v           |
 Linux: S confined Rust shard processes       macOS: N confined Rust workers
   reactor + W fixed owner threads              control loop + owner thread
   many independent VM/vCPU fd pairs             one HVF VM/vCPU per process
   clean / running / waiting / dirty slots       clean / running / waiting slot
                |                                      |
        separate private mappings              separate private mapping
                +------- common snapshot/CAS -----------+

 One existing native watchdog process observes all shard/worker processes.
 Offline only: pack/build -> prepare artifacts; grow -> oracle -> acceptance.
```

Linux starts with an E shard cap of 64 slots and configurable W bounded by assigned cores; enlarge only after fleet tests. Each owner thread creates its assigned vCPUs and performs all their run/state operations. A reactor delivers completions and deadline kicks to owners. There is at most one runner per slot, no work stealing initially, and no thread per waiting VM. A bounded FIFO runnable queue and E 1 ms host-enforced quantum prevent one CPU loop monopolizing its owner; only running guests arm quanta. KVM VM/vCPU descriptors scale with slots; threads scale with CPU demand. The kernel API and ownership distinctions are documented in [R2 §§3,5](../research/next/02-vmm-density.md).

On macOS the worker retains its VM while a tool waits. Its owner thread returns to an event wait; it consumes no periodic guest wakeups but still has per-process/thread memory. Waiting concurrency therefore consumes processes. Do not replace this with one process per core and quietly serialize waiting tenants: that would either cap outstanding runs or require the unimplemented logical-memory switching mechanism. HVF's process-wide VM is the reason for the different topology. [R1 §6](../research/next/01-snapshots-memory.md), [R2 §7](../research/next/02-vmm-density.md).

Normal runtime process counts change from **N + 2** to **S + 2** on Linux and remain **N + 2** on macOS: Node, watchdog, and runners. Builders never start on an admitted execution. A cache miss returns a preparation-required result or waits in a separately bounded preparation queue, outside the advertised hot path.

## 3. Memory layout and honest accounting

Keep stable guest addresses and the existing 32 MiB base RAM envelope. Initially restore the present packed layout unchanged. Only after sharing works, move resources out of the allocation arena; this addresses the measured resource slope and heap collision without adopting a new filesystem. Existing resources cost M approximately 0.997 MiB host footprint per additional MiB per VM, and resource loading costs about 0.15 ms/MiB on the measured Mac. These are not future CoW costs. [Synthesis spot-checks](../research/next/SYNTHESIS.md), [R5 §7](../research/next/05-io-caps-images.md).

The proposed fixed layout below uses the existing EL0-to-GPA translation for executable, heap, and stack. Resource extents receive their own kernel-only mapping and no longer move `HEAP`. Sizes and addresses in this layout are design choices, not measured savings.

```text
 Guest physical address                        Contents / backing
 0x0a000000                                    unmapped fixed-width doorbell
 0x80000000 .. 0x80080000                       kernel, tables, EL1 stack
 0x80080000 .. 0x80300000                       existing static payload arena
 0x80300000 .. 0x80480000                       EL0 brk arena
 0x80480000 .. 0x81a80000                       anonymous EL0 mmap arena
 0x81a80000 .. 0x81c60000                       reserved/guards
 0x81c60000 .. 0x81c80000                       EL0 stack (128 KiB reserved)
 0x81c80000 .. 0x81e00000                       reserved/guards
 0x81e00000 .. 0x81e14000                       private transport arena (80 KiB)
 remaining through 0x82000000                   reserved
 0x84000000 .. 0x88000000, optional             immutable packed resource window
```

The kernel/payload split and user translation come from [link.ld](../jitk/kernel/link.ld), [user.rs](../jitk/kernel/src/user.rs), and [mmu.rs](../jitk/kernel/src/mmu.rs). The optional window is an address reservation, not a commitment to resident 64 MiB. Map only the admitted resource extent, rounded to the host granule. One additional resource extent and fixed base/ring ranges keep the memslot count small. Feature-probe read-only guest memory support; an unsupported write fails the run. Never use one memslot or host VMA per page.

The prepared base is a sparse immutable file mapped separately with `MAP_PRIVATE` for every slot. Clean pages share file backing; every clone's writes are private. Each VM registers its own mapping, never the same writable host address as a sibling. Rings lie inside this base memslot, with canonical zero bytes in the snapshot; do not register an overlapping ring memslot. On Linux retain stable memslots and virtual addresses across runs; discard private modifications while stopped. Disable hugepage promotion for mutable mappings initially. On macOS unmap the HVF range before replacing its private host mapping, then remap and perform the required translation/cache synchronization. Linux discard semantics cannot be assumed for HVF. [R1 §§3–6](../research/next/01-snapshots-memory.md).

Keep JITKFS01. Its M/C format is a 16-byte header, 24 bytes per node, names, and raw contents; lookup is already local and reads already use checked copies. Changing to squashfs/EROFS adds a reader, decoder/cache state, and reset obligations without solving duplicated resident plaintext. Resource bytes are mapped from one immutable CAS extent. If cold storage later needs compression, decompress and verify once into that shared extent. [R5 §7](../research/next/05-io-caps-images.md), [fs.rs](../jitk/kernel/src/fs.rs).

### Small-class marginal memory ledger

These are **E maximum planning allocations in bytes**, rounded in units compatible with the observed Mac's 16 KiB host granule. They are not guessed measurements of existing libkrun. Every row must be replaced with attributed observations before claiming the target.

| Charged component | Linux budget, bytes/slot | Measurement obligation |
|---|---:|---|
| QuickJS private heap, atoms, allocator changes, materialized values | 786,432 | Peak dirty pages after checkpoint, including freed-but-resident pages |
| Guest stack, globals, writable PTEs, fd/poll state | 196,608 | Incremental pages; no second charge for shared initial tables |
| Two rings and control area | 81,920 | Charge full arena even when mostly empty |
| Private host call/result staging | 131,072 | Combined Node/runner live bytes, not a buffer in each tier |
| Slot/register/descriptor bookkeeping | 65,536 | Rust allocations and mapped run structure |
| KVM objects, stage-2 and host page tables, kernel charges | 524,288 | Reconcile aggregate kernel/system delta with mapping counters; count each allocation once |
| Amortized marginal runner/reactor/Node/watchdog overhead | 131,072 | Include each added shard and touched owner stacks at cap boundaries |
| Unallocated margin | 180,224 | Not permission to omit unattributed bytes |
| **Total** | **2,097,152** | Small glue at measured concurrency |

The first seven rows total E 1,916,928 bytes. A current C guest stage-1 table reservation of 208,896 bytes belongs to the shared snapshot until modified; its modified units belong to the guest-private row. Do not add it twice. The current M raw image size cited by R1 is 2,924,584 bytes, already containing the static payload; it too is shared-base storage, not an extra per-slot allocation. [R1 §§1,4](../research/next/01-snapshots-memory.md).

Shared resident template bytes, resource bytes, Node heap, executable/library pages, and every shard's baseline are reported explicitly alongside this table. Use `M(N) = shared resident bytes + fixed service bytes + marginal slot bytes`, including page-table/slab/hypervisor changes. Report slopes at N=1/16/64/256 and incremental cost when another shard is created. A finite-density report also includes `(shared + fixed)/N`; a marginal claim alone is insufficient for capacity planning.

macOS uses the same guest/ring/staging allocations, but replaces the KVM and amortized-runner rows with **measured per-worker HVF, process, thread, and host-table charges**. There is no defensible byte estimate for those rows yet. The same 2,097,152-byte gate applies independently; a miss means this backend has not earned the density claim. Do not import Linux's allowance or add logical swapping just to preserve a headline.

A single structured 1 MiB JSON parse/stringify already needed M an 8 MiB Bellard heap limit in native tests, so it is outside this class. Blob handles and host projections avoid materializing data; they do not make arbitrary guest allocations cheap. [R4 §2](../research/next/04-runtimes-platforms.md).

Prepare the small template with an E 524,288-byte managed-JS allocation ceiling, leaving the rest of its heap row for allocator/runtime overhead; validate rather than assume that initialization fits. This is a runtime bound, not a host defense against compromised EL1. Such a guest can dirty its entire mapped base. Shard aggregate memory limits and admission reserves must therefore include worst-case resident base bytes per simultaneously runnable hostile slot. Publish that reserve and adversarial peak beside ordinary-workload density. If the reserve prevents useful capacity, the deployment claim fails even when the named fixture meets two MiB.

## 4. Build, prepare, snapshot, restore, reset, discard

**Build.** The existing trusted packer validates the static ELF and produces a versioned image manifest. Pin compiler, musl, kernel, engine, bootstrap, resource hashes, architecture, and layout. Build the superset kernel once per runtime ABI. No model invocation, compiler, filesystem scan, or full-image hashing belongs to execute or to an inner call.

**Prepare.** In an offline runner mode, boot a tenant-free guest, initialize QuickJS and the canonical codec/bootstrap, and exercise a dummy Promise/serialization path without external effects. Drain all jobs and records. The guest publishes READY and reaches its first dedicated PREPARED exit from the empty input wait. Capture only after the ring is drained, no tool exists, no timer is scheduled, no callback is outstanding, and the trusted bootstrap is waiting for RUN. This is a specified checkpoint, not an arbitrary WFI or suspended console transaction.

**Snapshot.** Serialize initialized guest RAM, complete supported vCPU state, layout, and compatibility manifest. Exclude private ring contents; recreate their empty state. Require an explicit register inventory for the backend and reject unsupported CPU-state features. Keep clocks/timers in a known disabled state. Hash and atomically publish the immutable snapshot; verify restore in a second fresh slot before admitting it to the cache. Preparation runs once per artifact, not once per tenant snippet.

**Restore.** Stop every actor that can touch the old mapping; revoke the old generation before accepting further completions. Linux discards the prior private base and zero-backed ring changes without replacing memslots. HVF explicitly unmaps, replaces, and remaps stopped RAM. Restore all architectural state, invalidate translations as required, reset host protocol state, install a new descriptor, and run the trusted uniqueness hook before tenant code. Include mandatory first faults through that hook in restore timing.

**Reset.** Reset is restoration of the prepared execution state, not running JS cleanup. Remove fd positions, allocator changes, globals, kernel counters, partial records, tool responses, stdout, pending promises, host credits, deadline leases, and dynamic resources. Fresh logical run objects are allocated or completely overwritten. Memory remains charged until reset verification returns the slot to CLEAN; returning a result does not immediately free a capacity token.

**Discard.** On a normal validated completion, detach the logical run and restore the physical slot before reuse. On a protocol violation, guest fault, unexpected exit, failed reset, or forced stop, destroy that VM object; on macOS destroy the worker process. A Linux process panic, corrupted runner state, or missed cancellation kills its entire shard. Recreate poisoned capacity outside the response path, while charging the CPU and unavailable capacity.

This deliberately revises v1's physical destruction rule. Keep v1's public single-use execution meaning, but introduce a versioned snapshot backend contract: no tenant continuation, reconnect, or second RUN in the old generation. Existing v1 destruction and snapshot restoration must never be silently interchangeable in a benchmark. [Current normative contract](../jitk/protocol/PROTOCOL-v1.md).

### Uniqueness is a promotion gate

Each restore installs a host-issued run generation, fresh OS CSPRNG seed, realtime epoch, monotonic origin, deadline, and an empty capability view. Seed production `getrandom` from a reviewed guest CSPRNG with a new per-run seed; never use the existing small boot seed as an unexplained cryptographic generator.

Pin the exact QuickJS source and add a narrow trusted restore hook that reseeds the **existing** context's `Math.random` state before the submitted AsyncFunction can run. Merely updating `AT_RANDOM`, kernel entropy, or a bootstrap variable cannot repair that state. R4 identifies the existing QuickJS context RNG and the source-correspondence gap. [R1 §7](../research/next/01-snapshots-memory.md), [R4 §3](../research/next/04-runtimes-platforms.md).

Audit libc guards, userspace IDs, and all hash seeds in the exact runtime build. Never change a seed underneath a table built with it, or a stack guard underneath active protected frames. Any clone-sensitive seeded structure must be rebuilt safely after restore or initialized after the checkpoint. Deterministic, nonsecret internal template state is declared as such; it cannot masquerade as per-run randomness. If the audited runtime cannot provide a safe hook, move its checkpoint earlier and remeasure; do not ship initialized-heap cloning with an entropy disclaimer.

Restore GPRs, SIMD/FP, SP/PC/PSTATE, exception state, translation controls, TLS, debug/PMU and enabled timer/counter state. Disable unsupported optional vector features rather than omit their reset. Clock origin injection must preserve monotonic progress within a run without carrying a previous run's absolute deadline. Tests poison every supported register class, writable mapping, ring cursor, and fd state, then restore siblings with different seeds and timestamps. Include forced-stop and late-completion races. A single leak is a release blocker.

Shared public templates do not remove cache side channels. Private resources are never prepared into a globally shared runtime snapshot. Their authorization domain and lifetime are explicit even if the host CAS deduplicates equal bytes. If a deployment requires stronger separation between distrust domains, use separate shards or private backing and report the extra memory; do not call shared pages secret-free by inference. [R1 §§3,7](../research/next/01-snapshots-memory.md).

## 5. The full execute path and its cost

1. MCP validates one `execute` request and establishes cancellation and the absolute deadline. The executor resolves the principal and grant instance, selects an already prepared artifact, and reserves a small- or large-class logical admission.
2. A bounded runner command leases a slot. The external watchdog acknowledges its generation/deadline before RUN is allowed. The runner restores the slot, injects fresh run metadata, and reports its host confinement plus prepared-state acknowledgement. Guest data cannot forge this acknowledgement.
3. The bootstrap receives code and late-bound namespace/slot descriptions, executes the trusted resume hook, parses the fresh snippet, and starts it. Fixed codecs and authority-free library initialization were prepared already. Unknown user code is still parsed on every execution.
4. Calls are published to the ring and transferred to Node's canonical dispatcher. Policy checks the live slot, exact method, arguments, current revocation state, effects, approval, deadline, and credits. Only then does it mint any call credential and invoke the existing asynchronous adapter.
5. WAIT releases the native owner thread. Tool completion is validated and normalized in Node, generation-tagged, and delivered to that slot. Replies can arrive out of order. Promise.all still issues parallel work; no synchronous callback holds a vCPU runner.
6. The host accepts DONE only under the protocol's terminal rules. It stops the slot before exposing success, detaches the generation, closes capabilities, and returns the bounded result/logs through MCP. Cleanup/reset follows, with its CPU and memory charged to the completed run. Late callbacks cannot become successes or enter a new tenant.

The following is an **E allocation for a resident-cache small echo fixture**, not a prediction derived by subtracting old medians. Remote execution, approval wait, and actual network latency are additional elapsed time. CPU includes owned local processing; a slow tool belongs to its declared workload budget.

| Step | Response-path elapsed budget, µs | Total local CPU budget, µs/run |
|---|---:|---:|
| Outer MCP ingress and SDK validation | 200 | 130 |
| Live grant admission and prepared-cache lookup | 50 | 40 |
| Fresh source normalization; cached trusted wrapper selection | 40 | 35 |
| Slot lease, bounded IPC, acknowledged watchdog arm | 50 | 35 |
| Restore, mandatory faults, uniqueness hook through input acceptance | 250 | 230 |
| Parse and execute tiny submitted JS | 100 | 95 |
| One small echo: codec, exits, IPC, policy, completion, guest decode | 120 | 100 |
| DONE validation, stop, detach, bounded result extraction | 60 | 45 |
| Outer MCP result serialization | 100 | 65 |
| Cleanup/reset housekeeping not already charged above | 0, deferred | 60 |
| **Allocated total** | **970** | **835** |
| **Remaining CPU target margin** | — | **165** |

Charge full RAM/register restoration once, at acquisition or after completion, never both and never neither. If reset was performed after the previous response, the restore row still includes its amortized CPU, and restore latency must additionally be reported from the dirty-slot boundary. The table's critical-path ordering assumes the work occurs at acquisition. Deferred cleanup is only capability disposal/bookkeeping.

The hard restore gate is p99 ≤1,000 µs from stopped dirty slot to the next invocation's first accepted instruction, including invalidations, uniqueness, and unavoidable first touch. Also report time to first result. The table allocates a p50 restore budget of 250 µs; it does not establish a distribution. Percentiles of individual stages cannot simply be added to infer end-to-end p99.

The echo row keeps TS and interprocess hops. It is intentionally different from R5's **E 30 µs** native small-call transport hypothesis. A useful internal split is E 20 µs guest codec/copies, 20 µs exit/runner work, 40 µs batched IPC/scheduling, and 40 µs TS validation/policy/result handling. Test it rather than promising a native-addon's latency from a confined child process. Existing M MCP overhead is roughly 357–518 µs depending on comparator; it is once per execute, not per inner tool. [R5 §§1,8](../research/next/05-io-caps-images.md).

Cache `executionBody`'s fixed codec/prelude by trusted provider shape and move its invariant initialization into preparation. Keep arbitrary provider-specific preludes out of a universal template. Replace repeated provider sanitization/schema/type generation with immutable prepared descriptors. Continue per-call authority and schema validation. The existing `code.ts` injects the whole codec and preludes into every request, and the parked executor was M approximately 2.5–3 ms versus raw 0.2–0.3 ms. That gap is the first host optimization, not evidence that Node must be removed. [C: code.ts](../jitk/executor/code.ts), [FINAL](../FINAL.md), [R4 §3](../research/next/04-runtimes-platforms.md).

## 6. One transport, several views

Use two E 32,768-byte directional byte rings and one 16,384-byte control area: 81,920 bytes per slot. Records have a fixed header containing version, kind, length, correlation ID, generation, capability slot, and method ID. Define maximum record size, wrap padding, credits, and ownership in one ABI document. No host pointers appear on the wire. A control record can describe chunked payload delivery, so a larger-class frame need not fit in a single ring.

Keep JSON and v1 semantic validation initially. The native ring parser bounds lengths/offsets and copies completed records into host-owned buffers. The canonical TS parser remains authoritative for duplicate keys, number/Unicode/depth/structure rules and tool envelopes. Do not introduce an independent Rust JSON policy parser. Node receives bytes from a bounded per-shard IPC stream; guest data cannot select the lease-routing metadata on that stream. Node still validates every forwarded message because the VMM remains outside its authority boundary.

Use acquire/release publication and monotonic cursors with checked distance and defined overflow behavior. Invalid producer movement, lengths, generation, or credit usage poisons the slot. Never retain a reference to guest-writable argument bytes across validation or await. Retain hard upper v1 limits where compatible, including 64 outstanding protocol calls and 4,096 total; policy may be stricter, as its current default is C 256 total calls. The small class's tighter limits are additional admission constraints. [Protocol](../jitk/protocol/PROTOCOL-v1.md), [policy](../jitk/executor/policy/policy.mjs).

Implement four operations: PREPARED, SUBMIT, WAIT, FINISH. SUBMIT drains all published requests and returns promptly; WAIT includes the last observed completion sequence and an optional earliest timer deadline. The host registers waiting state, then rechecks completion sequence under the same owner synchronization before sleeping. A raced completion either prevents parking or schedules exactly one resume. Infinite waits create no periodic timer. Timer expiration and actual tool completion enqueue the owner; WFI is not a scheduler yield.

Start with one fixed-width MMIO-store doorbell on both platforms. This is already supported prior art on ARM64 and avoids adding a second trap mechanism before measuring one. Correctly finish pending MMIO emulation before restoring PC/state. Reject unsupported widths, offsets, and fault syndromes; handle the documented cache-maintenance/NISV cases explicitly. Do not create a GIC or guest timer device for host-managed waits. Bound unexpected timer and exception exits from hostile EL1. HVC forwarding remains a measured later substitution if it beats the common doorbell; it is not a required parallel implementation. [R2 §§2,5,6](../research/next/02-vmm-density.md).

This removes console discovery, interrupt/status traffic and 1,024-byte chunk notifications; it does **not** eliminate the trusted Node boundary or JS serialization. The current queue size and copy path are C findings, not an isolated measured explanation of the full latency. Batch Node IPC, ring records, and replies while preserving immediate wakeup for real work. Default spinning is zero. [R5 §3](../research/next/05-io-caps-images.md).

### Files and capability stubs

`/skills/...` and admitted immutable ordinary files use the existing archive. `/mcp/<binding>/tools/<method>.json` and `.d.ts` are local documentation/schema files, never effectful reads. `/mcp/<binding>/resources/<encoded-uri>` is a granted resource view: one first materialization fetch, then stable per-run bytes and local seek/read. URI-to-path encoding is injective; path spelling grants no authority. Authenticate before a cache lookup, and deduplicate bytes only after authorization.

`/cap/<slot>/call` is a duplex, one-request invocation endpoint. Open/stat/close have no remote effect. Writes accumulate a bounded length-delimited request. Exactly one complete, validated record commits the invocation; partial writes, close before completion, and metadata probes commit nothing. Subsequent reads return response bytes and then EOF, never repeat an effect. A second submission fails. Close after submission requests cancellation but cannot roll back a remote side effect. Host correlation and generation enforce single admission.

The guest kernel demultiplexes reply records by kind and correlation ID before handing JS frames to fd0 or native responses to a call fd. This is necessary: a synchronous file `read()` cannot wait for the QuickJS event loop, which it has suspended, to decode its response. Guest `ppoll` integrates fd readiness and host-managed timer WAIT. Synthetic files use the same ring, policy dispatcher, and quotas; no 9P, FUSE, filesystem daemon, socket stack, or second RPC channel is added. Ordinary Linux-file tests do not define synthetic effect semantics; test those against a host model with effect counters. [R5 §§2,5](../research/next/05-io-caps-images.md).

Budget the optional synthetic adapter at E at most 32,768 additional touched guest bytes per small run, borrowed from existing guest-state/staging allocations, not added invisibly. Limit it to eight active invocation fds with 4,096-byte small-class requests and shared response credits. Metadata has zero host round trips; an invocation pays the ordinary call budget; materialization pays its actual upstream fetch plus bounded copies. Larger resources remain host blobs with authorized, bounded range reads; plain MCP itself does not promise ranged resources.

Generated JS namespace stubs call the live slots directly. **Cap'n Web stubs are an optional prepared profile**, using its custom transport over these same records and exporting only policy-wrapped host targets. Do not implement a new miniature Cap'n Web competitor to save bundle bytes. Preinitialize the real pinned bundle and required globals before snapshotting, or leave it disabled. Its M core bundle is 46,404 bytes, but bundle bytes are not private heap. [Cloudflare study §1.3](../research/cloudflare-deep.md), [R5 §4](../research/next/05-io-caps-images.md).

An ordinary awaited scalar call uses C four Cap'n Web messages versus v1's two frames; batch push/pull and piggyback release. Count calls after `.map()` expansion, bound live imports/exports and graph size, reject unsupported guest exports, and validate resolved arguments at the final host invocation. Admission gate: E ≤65,536 extra private bytes within the total class budget, ordinary-call overhead ≤10 µs beyond the direct stub, and ≥20% end-to-end CPU reduction on a named dependent-chain workload. Otherwise omit it. A list plus Promise.all already has two waiting rounds; it is not N sequential waits. Guest pipelining cannot remove dependencies at a plain remote MCP endpoint. [R5 §4](../research/next/05-io-caps-images.md).

## 7. Grants, recipes, content, and prepared-state cache

Use one local artifact directory and small immutable manifests, not a cache daemon or Nix service. It has three indexes because they answer different questions:

```text
 authenticated grant instance -----> host-only live binding table
          | shape/schema versions                  | bind after restore
          v                                        v
 canonical recipe -> recipeHash -> imageHash -> prepared key -> snapshotHash
                                   |                  |
                          immutable manifest      immutable initialized RAM
                          runtime/resource hashes plus complete CPU-state contract
```

The recipe contains architecture, kernel/ABI and syscall-policy versions, pinned build inputs, runtime/bootstraps, trusted prelude shape, resource digests, and layout. It contains no credential, principal secret, run seed, clock, or live connection. `recipeHash` hashes this canonical construction description. `imageHash` hashes produced immutable image/manifest bytes. A build action cache maps the former to the latter; nondeterministic builds cannot pretend these are identical identities.

The prepared key includes image identity, snapshot format/backend compatibility, CPU-feature contract, runtime resume ABI, and preparation profile. Its entry references `snapshotHash` and read-only extents. A resource-only recipe can reuse the same runtime snapshot when preparation provably never touched those resources; separate prepared-cache entries reference the same content-hashed base. This is one flat runtime snapshot plus resource extents, not an arbitrary layered-memory pager. Resource-dependent initialization must instead produce a distinct snapshot and pay its shared-cache residency.

Cache schemas and generated types by shape, and cache authority-free template work by its immutable identity. At restore bind a fresh live table of slot → principal/resource/method rights, schema version, revocation generation, and host adapter. No grants are accepted from the guest. Credential rotation changes bindings, not executable snapshots. Resource version or schema changes invalidate the affected recipe or compatibility entry. Per-call lookup performs no recipe hash, build, image scan, or grant negotiation. E lookup/admission budget is the 50 µs row above, including bounded live-table work. [R5 §7](../research/next/05-io-caps-images.md).

Bound cache bytes, prepared profiles, and in-progress preparations globally. Start with E 268,435,456 bytes of admitted resident shared artifacts and at most 16,384 bytes of in-memory index metadata per prepared entry; both are fixed service charges, never free per-VM savings. Cache hit work stays inside the existing admission budget. Builder/grow work contributes zero hot-path allocations or calls; publish its preparation CPU separately. Coalesce identical preparations, publish atomically, and hold artifact references while slots use them. A broken or tampered artifact is quarantined and rebuilt offline. Eviction cannot rewrite a live inode. An explosion of grant shapes cannot be excused as “amortized.”

## 8. Failure, timeout, and side effects

The independent watchdog remains necessary because Node can block. Its current pidfd/kqueue design avoids reused-PID signaling and already replaced per-VM Python spawning. Existing M overshoot observations, 1.75 ms on macOS and 0.8 ms on Linux, are specific tests, not guarantees for the new scheduler. [FINAL watchdog update](../FINAL.md), [watchdog source](../jitk/vmm/src/watchdog.rs).

Extend its protocol from PID deadlines to `(process identity, slot, generation, monotonic deadline)` leases. Before RUN, the runner also owns the same deadline. Normally its reactor kicks the exact owner out of KVM/HVF, stops and destroys that slot, and reports terminal failure. A guest CPU loop cannot suppress the host kick. Test signal masks, pending exits, busy host-side exit loops, and cancellation immediately around slot reuse.

Give each runner a preopened bounded control connection directly to the watchdog for stop requests and acknowledgements. It must not depend on Node forwarding either message. Watchdog lease metadata is charged to the host bookkeeping rows; normal arm traffic is charged to the lease CPU row. This adds descriptors to the existing watchdog, not a new supervisor process.

If the runner fails to acknowledge stop within E 10 ms, the independent watchdog kills the process/shard; retain the historical exposure gate of process death and observable failure within 50 ms for the declared load. Process death, not a logged kill syscall, is the evidence. Watchdog EOF, malformed control, loss of process identity, or Node death fail closed. Generation-aware disarm cannot cancel the next tenant's deadline. Capability admission closes before reset; stale tool completions are dropped before any ring write.

A shard escape can reach sibling VMs in that process. Preserve sandboxing and keep credentials and policy in Node; initially shard by distrust domain and cap its slot count. Per-run guest limits replace per-process RLIMITs for small-class admission; Linux cgroup/rlimit limits still bound aggregate shard failure. Apply confinement before entering any hostile guest, including owner threads and refill paths. The existing libkrun thread hook does not automatically cover replacement threads.

Trusted tools must remain asynchronous and bound their allocations, remote requests, and output normalization. Killing a VM cannot interrupt synchronous JS in Node or force an ignoring SDK callback to settle. An offending provider fails its integration gate; adding one process per call is not an acceptable repair. A separate provider worker would be another measured component, outside this core proposal. [Current limitations](../jitk/docs/KILL-CRITERIA.md), [R2 §8](../research/next/02-vmm-density.md).

There is no automatic execution replay. Approval can hold the waiting VM under a bounded lease or return an approval-required result and require a new explicit execution. Tool-specific simulation is optional application behavior, not a generic transaction engine. Keep idempotent cleanup for run-scoped remote handles. If a mutating tool's reply is lost after a possible remote effect, report unknown outcome and reconcile through the remote operation ID/idempotency API; resetting a VM cannot establish exactly once. [R5 §6](../research/next/05-io-caps-images.md).

## 9. Offline growth and native programs

Default to one superset kernel per runtime ABI with per-recipe **policy**, not per-recipe compiled kernels. Unused shared code costs no per-run private pages unless touched. The current fixed kernel/payload split can preserve raw image size even after handlers are deleted. The proposed 32–128 KiB / 5–19 µs specialization upside is E sensitivity arithmetic, not an observed optimization. It cannot justify separate binaries, build keys, and fragmented backing today. [R3 §7](../research/next/03-compat-grow.md).

Policy restricts admitted syscall operations, immutable file roots, runtime quotas, and live host capabilities. Guest policy narrows expected behavior; host policy remains the authority if EL1 is compromised. Allocate new subsystem state lazily. Split profiles only for structural features with measured private-state cost, such as a scheduler, not arbitrary syscall subsets.

Keep the grow loop offline and label the current result correctly: C three regrown handlers with repeated fixtures, not broad unseen Linux compatibility. Extend discovery to unsupported arguments, semantic mismatches, and resource/CPU failures. Extract relevant gVisor/LTP cases, compare defined bytes and errno, exercise fd/mmap sequences, and deliberately mutate candidate handlers. The candidate cannot change the oracle or normalizer. Genuine unseen growth must enable a held-out jq/SQLite workload. [R3 §§5,6,8](../research/next/03-compat-grow.md).

Native binaries need loader and output work before syscall-count promises. Keep build-time validation; add no guest ELF parser initially. Widen the packer's static ET_EXEC arena through an explicit versioned layout, derive heap boundaries from segment extents, validate overflow/alignment/BSS, and preserve W^X including kernel aliases. Static PIE relocation is a separate admitted build feature, not silently accepted ET_DYN. Interpreter/dynamic linking remains unsupported until a workload pays for it. Existing C restrictions are AArch64 static ET_EXEC and a 2.5 MiB payload arena. [prepare.py](../jitk/kernel/prepare.py), [R3 §§1,4](../research/next/03-compat-grow.md).

Add tagged byte stdout/stderr/stdin records for the native profile; never reinterpret raw native output as JSON control or kernel diagnostics. Bound output, spill large data as explicit authorized blobs, and preserve byte-exact Unicode/binary output. For native tools, snapshot at the initialized kernel/pre-entry boundary, inject argv/env/stdin after restore, and enter the binary fresh. Do not claim every unmodified tool supports a post-initialization checkpoint.

Start with synchronous Rust-musl, jq, serial `rg --threads 1 --no-mmap`, SQLite `:memory:` and immutable read-only databases. Pin actual binaries and test real work. Writable SQLite, default parallel rg, Go, Node, and general Python require structural scheduling/signal/mapping contracts; `GOMAXPROCS=1` does not establish one host thread. Restricted anonymous mapping may need file-backed reads, protection, and correct reclamation; add those only from the census. Keep separate QuickJS and Lua templates. Change JS engines only after ≥20% end-to-end CPU improvement within the measured memory budget. [R3 §§4,5](../research/next/03-compat-grow.md), [R4 §§2–4](../research/next/04-runtimes-platforms.md).

## 10. File-level keep/change/delete plan

Paths are under `arch/jitk/`; proposed files do not imply changes made in this design round.

| Files | Concrete action |
|---|---|
| `vmm/src/main.rs`, `build.py`, `patches/series` | Keep current launcher as reference. Add experimental runner entry; remove libkrun build/patch dependency at accepted production cutover. Preserve patch receipts with historical evidence. |
| Proposed `vmm/src/{slot,snapshot,ring,kvm,hvf}.rs` | Native lifecycle, fixed owner scheduler, backing/reset, bounded framing, platform implementations; one executable, no addon/daemon. |
| `vmm/src/watchdog.rs` | Retain independent mode; add generation leases and stop/escalation acknowledgements. |
| `vmm/sandbox/mod.rs`, sandbox profiles/tests | Preserve deny-default confinement; replace libkrun thread-hook integration and audit new mapping/kick syscalls. |
| `executor/backend.ts`, `pool.ts` | Add runner client and logical lease adapter. Delete physical spawn/refill scheduling from TS after cutover; retain bounded logical admission. Keep ProcessBackend for benchmark reference during migration. |
| `executor/executor.ts`, `code.ts`, `providers.ts`, `upstream.ts` | Preserve public contracts, move immutable provider/wrapper preparation off-path, cache normalization where safe, stop reinjecting fixed codec text. |
| `executor/policy/policy.mjs`, `policy-adapter.ts` | One authoritative policy; add live capability slots, revocation generation, bounded cleanup. No Rust policy clone. |
| `protocol/dispatcher.ts`, `PROTOCOL-v1.md`, `bootstrap.js` | Preserve canonical JSON checks; introduce explicit snapshot/ring ABI and terminal generation rules. Bootstrap gets trusted resume hook and batched submit. |
| `kernel/src/{console,wait}.rs`, `fdt.rs` | Keep console lane until acceptance; add ring lane then remove production virtio/GIC discovery/wait machinery. Keep reference fixtures separately. |
| `kernel/src/{main,user,mmu,fs}.rs`, `link.ld`, `prepare.py`, `artifact.py` | Add checkpoint/restore descriptor, grouped writable layout, external resource window, native byte profile, versioned artifact manifests. Preserve checked-pointer helpers and packed lookup. |
| `kernel/src/syscalls/{read,write,writev,ppoll,mmap,munmap}.rs`, `slots.json` | Route typed fd I/O; integrate common WAIT/readiness; grow only reviewed semantic additions, including clone-unique entropy. |
| `mcp/server.mjs`, `jitk.mjs` | Keep SDK and execute shape; use prepared provider descriptors/runner backend; describe actual filesystem classes accurately. |
| `grow/{loop,adapters,agent}.py`, oracle/tests | Keep Python offline; generalize hardcoded regrowth and add hidden semantic/mutation gates. |
| `bench/{run.py,executor.mjs}`, cases, VMM/security tests | Extend existing harness with full-service CPU, dirty/shared/kernel memory, restored lifecycle, burst waiting, failures, and artifact provenance. |

## 11. Incremental build order and kill gates

Every stage leaves the current backend working. Experimental code is selected explicitly; production selection changes only after matching fixtures pass. No benchmark is inferred from a local native mapping proxy or nested KVM timing. Use the existing Mac and authorized local/dev KVM environment; absent Linux metal results remain a blocker, not a cloud-provisioning step.

| Stage and synthesis experiment | Deliverable that still runs | Measurable pass / kill rule (E unless M/C noted) |
|---|---|---|
| **0. Ledger, experiment 1** | Unchanged post-direct-load system with full attribution | N=1/16/64/256; READY, waiting, active peak and churn; identify shared/private/kernel/unattributed bytes and all service CPU. No density claim while a material category is missing. |
| **1. Remove repeated host preparation** | Existing libkrun backend, same executor API | Cache trusted shape/prelude/codec work; exact policy/codec/SDK conformance. Keep only changes improving tiny-fixture total CPU ≥10% or p50 ≥100 µs without >32 KiB new marginal host state. No removal of authority checks. |
| **2. Sharing seam and dirty census, experiments 2–3** | Existing default plus minimal KVM runner spike | Distinct private mappings of one image; guest write/discard/sibling canaries; fixed owners at N=1/16/64/256. Empty-instance marginal cost >1 MiB kills the density premise pending attribution. Do not port the full executor first. A narrow libkrun backing patch may validate raw sharing, but no general snapshot API is authorized by this stage. |
| **3. Ring/WAIT, experiment 5** | Ring guest/native runner behind explicit flag; libkrun reference unchanged | Same v1 logical output and Promise.all behavior; 1,000 pending tool waits with owner count fixed, no periodic guest exits, no lost wakeups. Fleet idle+waiting CPU below the existing 10%-capacity criterion under its declared load. |
| **4. Prepared CoW and reset, experiments 2 and 4** | Restorable QuickJS candidate | At least 1,000 restore cycles per dirty-set/workload; follow with 10,000 mixed/poisoned cycles. p99 full restore ≤1,000 µs; small-class marginal total ≤2 MiB; uniqueness/isolation failures kill promotion. 64 KiB and 1 MiB JSON results are reported separately, not averaged away. |
| **5. Integrate TS and watchdog** | Same MCP/API over candidate runner | Full-service tiny-run CPU ≤1,000 µs, including reset/refill; direct-stub small echo ≤120 µs p50; deadline process-death/API gate ≤50 ms at declared load; existing hostile suites plus EOF-mid-call and stale-generation attacks. A failed callback contract is an integration failure. |
| **6. HVF parity** | Persistent one-VM workers with same guest ABI | Explicit unmap/remap/reset; independent memory ledger, restore and uniqueness gates. If >2 MiB marginal or >1 ms restore, publish failure for Mac; retain development backend without the scale claim. No automatic logical-swap project. |
| **7. Cutover and deletion** | One production native backend per platform | Same declared fixtures and containment pass on old/new artifacts; remove libkrun and duplicate physical pool from shipping path. Missing native Linux timing prevents Linux scale certification. Re-run clean-copy build and aggregate tests. |
| **8. Native census and grow, experiments 6–7** | Existing JS/Lua plus admitted tools | Pin binaries/real workloads; loadability separate from syscall census; semantic cases plus 1,000 bounded stateful sequences. Any important bad-handler mutation surviving acceptance invalidates that gate. One unseen accepted feature must enable held-out work. |
| **9. Optional files / Cap'n Web** | Direct-stub core remains default | Prove single effect per submitted fd and local metadata/rereads; then apply the explicit memory/CPU/session gates above. Delete an integration that fails to pay for its extra state machine. |

For latency tails use at least 10,000 small-call observations; the existing n=30 canonical p99 is poorly resolved. Record hardware, host/guest page sizes, kernel, nested/metal status, CPU affinity, load, artifact hashes, cold creation, hot restore, first-result latency, failure counts, and completion-burst runnable delay. Measure steady-state CPU after draining deferred cleanup. [Existing harness caveats](../jitk/bench/run.py), [R1 §8](../research/next/01-snapshots-memory.md), [R5 §8](../research/next/05-io-caps-images.md).

## 12. What would make B abandon this design

The largest risk is that active QuickJS writes plus unavoidable host state exceed the budget. If empty KVM state passes but small-glue dirty pages consume the remaining allowance, first remove measured eager zeroing/false sharing and reduce unnecessary materialization. Do not add guest CoW, UFFD, KSM, compression, or an alternate JS engine without a specific attribution and a bounded experiment. If the declared small class still fails, the two-MiB claim fails; changing the class after seeing failures must be explicit.

If complete initialized-runtime reset cannot be demonstrated, retain fresh physical VMs. If native Linux restore exceeds one millisecond despite resident backing, first separate reset, fault, and register costs. Guest-assisted CoW is justified only if it beats host discard enough to meet the target while paying its fault handler, scratch allocator, PTE-copy and alias-correctness obligations. The third option's extra pager is otherwise rejected.

If the narrow runner needs a general device platform, scheduler inside the guest, dynamic linker, or many cloned libkrun subsystems to pass the existing workload, stop the replacement and keep patched libkrun. Its replacement was justified by deleting the device/thread lifecycle, not by ownership pride. Conversely, retaining both VMMs indefinitely fails the simplicity goal.

If TS work still exceeds the CPU target after fixed preparation is removed, attribute it. Move a bounded transport operation to Rust only when it saves E at least 100 µs/run or 20% total CPU and preserves the policy boundary. A full executor rewrite is a new design decision with its own compatibility and maintenance cost; this proposal does not smuggle it in as a performance prerequisite.

The earlier third-option Mac density estimates and “fresh seed closes uniqueness completely” claim are rejected by the later synthesis. So are importing the process-only sharing result as KVM density, calling WFI a thread yield, and treating an unbounded Cap'n Web session as free pipelining. These corrections remove speculative components and unsupported numbers from the critical path. [Third option](../research/third-option.md), [SYNTHESIS](../research/next/SYNTHESIS.md).

Finally apply the existing investment criterion against an equivalently isolated, asynchronous Hyperlight baseline. The project should not keep a JS-only custom VMM merely because it is smaller in source. It must demonstrate the required density/throughput advantage or earn its cost through verified non-JS static tools and Linux-ABI coverage. Current historical exposure failures and later fixes must be reconciled against fresh exact-artifact receipts; architecture prose cannot certify them. [Investment/exposure criteria](../jitk/docs/KILL-CRITERIA.md), [updated results](../FINAL.md).

The minimal defensible machine is therefore a shared prepared runtime, a private measured delta, a late-bound host capability table, and a real WAIT exit. Everything else must earn admission through those measurements.
