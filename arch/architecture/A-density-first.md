# Architect A: density-first end state

2026-10-25. Design only, against repository `9d4a598c933c26f8b6a1067dd747eebca9193b75`. **Decision: build a purpose-built, many-VMs-per-process Linux/KVM shard VMM.** Give each guest one vCPU, fixed owner-thread affinity, separately isolated stage-2 memory, shared immutable snapshot backing, bounded private RAM, and an explicit WAIT exit that releases its runner. Remove virtio devices, the GIC, periodic guest wakeups, per-invocation processes, and per-invocation host compilation. macOS/HVF implements the same guest ABI through persistent worker processes; it does not determine the fleet topology.

This implements the [lead synthesis](../research/next/SYNTHESIS.md), including its preference for a common superset kernel with per-recipe policy. It is an end-state design, not evidence that these numbers have been achieved. **[M]** means an existing project measurement; **[S]** means source/API evidence; **[E]** means an engineering estimate, allocation, or proposed gate; **[D]** means arithmetic from explicitly stated inputs. All new performance and capacity numbers below are [E/D]. No measurement, build, cloud operation, or implementation change was performed for this document.

## 1. The promise and its limits

Optimize physical memory per additional hardware VM and whole-service CPU per completed invocation. Report `M(N) = fixed shared bytes + sum(slot private bytes + kernel charges + host request state)`. RSS sums, configured guest RAM, and snapshot-file sizes cannot substitute for this ledger. Measure READY, tool-WAIT, execution peak, reset, and steady-state churn separately.

The existing quiet results are **10.657 MiB parked process footprint, approximately 4.8 child CPU-ms/run, and 285 µs parked raw one-tool latency** [M]. They exclude some HVF kernel costs and supervisor CPU. The footprint predates the latest direct-loader baseline; subtracting that patch's saving again would be wrong. The approximately **2.789 MiB image** and resource residency are the clearest sharing opportunities, while the remainder remains unattributed. [Memory research](../research/next/01-snapshots-memory.md), [quiet results](../jitk/bench/RESULTS-quiet-2026-10-24.md), [synthesis corrections](../research/next/SYNTHESIS.md).

The first admitted fleet class is `glue-2m`: small fresh snippets, at most 8 KiB source, 64 KiB aggregate materialized control/data, at most 32 capability slots, and the existing ceiling of 64 outstanding/4,096 total calls. Byte admission can stop fan-out before the count ceiling. The physical writable guest arena is capped at **1,310,720 B**, including engine heap, stacks, tables, and kernel state; rings are separate. A request that cannot fit returns a resource error or selects a larger class *before execution*. No transparent restart follows a side effect.

The 2 MiB objective is therefore a measured total marginal allocation for this class, with bounded peak guest RAM—not a promise about arbitrary programs. A structured 1 MiB JSON parse/stringify already requires an **8 MiB QuickJS heap limit** and approximately **21 ms native Bellard CPU** in the local study [M]. Keep large responses as host blobs and project/filter at the adapter. Explicitly requesting a materialized large object selects a larger budget. [Runtime research](../research/next/04-runtimes-platforms.md), [QuickJS measurements](../research/quickjs-verdict.md).

A later `glue-compact` profile can cap all mutable guest state at **655,360 B** and target 1.25 MiB total. Whether initialized QuickJS plus useful execution fits is an experiment. It is not inferred from QuickJS's tiny native context allocation.

## 2. Components, ownership, and scheduling

```text
                          OFFLINE / CACHE MISS
  recipe -> pinned builder -> ELF/extents -> prepare runtime -> CAS snapshot
                              | immutable verified descriptors
                              v
  caller -- MCP execute --> sofort-host: admission + policy + capability broker
                                | host-only request/completion rings
                                | eventfd per shard/owner group, not per VM
          +---------------------+----------------------+
          v                                            v
  sandboxed KVM shard 0                         sandboxed KVM shard 7
  7 fixed owner threads + reactor                7 owners + reactor
  owner 0: VM a, b, c ...                        VM ...
     each VM: isolated stage-2; 1 vCPU; private mapping of shared snapshot
     EL0: Bellard/Lua/native -> SVC -> jitk EL1 -> rings + doorbell
                                |
                      WAIT returns to owner queue

  independent native watchdog -> targeted kick -> owner acknowledgement
                              -> pidfd kill shard if owner fails
```

Use three persistent runtime roles, built from native Rust: `sofort-host`, `jitk-shard`, and the independent watchdog. The trusted host owns MCP, principals, live grants, credentials, upstream connections, schema validation, and final-result publication. Shards own VM objects, mappings, scheduling and hostile transport decoding; they hold no upstream credentials. The watchdog owns deadlines and shard liveness independently of either event loop. Builders and agents remain offline. No helper process is spawned per run or call.

On the illustrative 64-core host, start eight shards with seven owner threads each: **56 guest execution lanes**. Their reactors and the host's bounded I/O pool share the remaining eight cores. This is a tunable allocation, not a discovered optimum. Owners create and retain their VM/vCPU objects, issue their own synchronous vCPU ioctls, and run one guest at a time. Slot ownership never migrates during an invocation. New admissions balance owners by runnable work; an idle owner's inability to steal work is a measured tradeoff for simple affinity. Linux permits separate VM fds within one process; vCPU thread affinity is principally a performance recommendation, unlike HVF ownership restrictions. [VMM research](../research/next/02-vmm-density.md).

Each owner has a runnable queue, an indexed slot table and a deadline heap. A VM in WAIT has no dedicated thread, kernel waitqueue sleeper, eventfd, socket, or timerfd. Its vCPU state remains in its KVM object. The reactor routes completion notifications by `(shard, owner, slot, generation)`; only the owner writes that VM's completion ring. One host timer source serves each reactor's nearest deadline. Guests request logical timer wakeups through WAIT; they do not program periodic wakeups.

| Component / ownership | Memory allocation [E] | CPU/latency allocation [E] and cheapest mechanism |
|---|---:|---|
| MCP/admission/capability broker, trusted host | Within 1 GiB fixed service reserve; per-run state in ledger below | 200 µs/run for ingress, cache/grant lookup and egress; bounded native parsing and persistent upstream sessions |
| Shards, owners, reactors | Within same reserve; 16,384 B/slot host metadata | 55 µs/run admission/handoff/cleanup; no per-VM thread or process |
| VM/vCPU backend | Kernel/run-map allowance 196,608 B/slot plus translation rows below | 140 µs/run state restore; entry/exit counted separately |
| Guest kernel and runtime | Shared template plus bounded private rows | 235 µs/run code execution/repair plus fault budget; initialized once |
| Guest transport | 81,920 B/slot | 30 µs/small local host-call round; batch publication |
| Capability/resource adapters | Shared schema/docs; bounded pending buffers charged per run | Validation inside call budget; actual tool CPU, TLS/network and blob bytes charged additionally |
| Watchdog | Fixed service reserve; deadline entry included in slot metadata | One deadline insertion/removal per run, included in cleanup; zero per-idle-VM ticks |
| Builder, snapshot preparation, grow controller | Separate offline budget | Zero CPU on a cache-hit run; misses publish explicit preparation latency |

These allocations overlap the detailed ledger only where stated; the component table is not another sum. Host-only shared rings preserve a process boundary without the current pipe-to-Node transport on every guest frame. They still introduce queueing, copying, notification and scheduling costs: those are included in the call budget. The broker independently validates requests because a compromised shard can forge messages for runs in that shard. Shard membership therefore defines an authority and failure blast radius.

Start with a lower operational slot cap; raise it only after scale gates. The end-state planning cap is 16,384 slots/shard. At that cap, approximately 32,768 VM/vCPU fds are needed per shard [D], plus shared sources. Query memslot and run-mapping sizes, configure fd/VMA limits before confinement, and measure teardown. Do not mistake a per-VM vCPU limit for a process-wide VM limit. [KVM object/limit research](../research/next/02-vmm-density.md).

**HVF development backend.** Keep one independent VM per persistent worker process and one owning vCPU thread. Initially a worker remains assigned throughout a waiting invocation; WAIT returns from HVF so it consumes no runnable thread, but the process remains allocated. This simple backend has bounded, lower development concurrency. Optional later logical multiplexing saves complete suspended contexts, unmaps the old address space, installs only the next context, executes a trusted TLBI stub and restores registers. Never map several tenants concurrently into one HVF stage-2 space. Hyperlight supplies precedent for serial switching, not independent concurrent VMs in one process. [HVF evidence](../research/next/01-snapshots-memory.md), [pinned Hyperlight implementation](https://github.com/hyperlight-dev/hyperlight/blob/8a7e6b8794fea050ce287eed614088f0beb6b973/src/hyperlight_host/src/hypervisor/virtual_machine/hvf/mod.rs).

Use exactly the same guest binary, manifest, ring framing, bounds and WAIT semantics on both backends. Select HVC or MMIO doorbell through the boot descriptor. Prepared register snapshots are backend-specific artifacts; portability means the guest ABI and behavior, not interchangeable KVM/HVF register dumps. HVF process overhead, 16 KiB CoW granularity and remap latency are separately measured; Linux density estimates do not transfer.

## 3. Guest memory: sharing with a hard private ceiling

Retain a 32 MiB guest-physical *address envelope*, but stop treating it as an unrestricted writable RAM memslot. An EL1-compromised guest could otherwise dirty the entire range and defeat every density reservation. Pack immutable and mutable extents separately and enforce their permissions through stage 2, independently of jitk's stage-1 tables.

Illustrative fixed GPA layout [E], all boundaries compatible with 16 KiB host alignment:

```text
  0x80000000..0x80100000  kernel/vector/boot constants, stage-2 read-only
  0x80200000..0x80a00000  executable + runtime immutable extent, read-only
  0x80a00000..0x80b40000  mutable snapshot arena: 1,310,720 B, private CoW
  0x80b40000..0x80b54000  ring/control arena: 81,920 B, per-slot writable
  0x81000000..0x82000000  immutable resource window, read-only
  other GPAs             unmapped; fixed doorbell outside RAM envelope
```

Windows are maximum address capacities, not resident commitments. Register actual aligned extents in approximately five stable memslots, never a slot per page or file. Reserve a contiguous host-VA envelope per slot and install extents within it to bound host page-table fragmentation. Group kernel globals, mutable page tables, stack and ELF RW/BSS into the mutable arena. Guest EL0 virtual addresses retain the ELF/Linux contract; a generated segment map translates them to these GPAs. Replace today's arithmetic `mmu::physical(va)` and contiguous-pointer assumption with page-aware checked copies. This is a prerequisite for shared RX segments, variable native ELF sizes and bounded physical allocation.

Host mappings of immutable extents are read-only, and KVM memslots use `KVM_MEM_READONLY` where supported. Writes fail the VM; they never turn public code/resources into unbounded private CoW memory. Feature-probe the required capability. Keep writable page tables in the private arena; arm64 hardware page-table updates against read-only slots have special abort behavior. [KVM memory-region API](https://docs.kernel.org/6.12/virt/kvm/api.html#kvm-set-user-memory-region).

Each mutable arena is a **distinct `MAP_PRIVATE` mapping of the same immutable prepared file**. The host maps rings separately and shares them only with that VM; “shared rings” means host↔guest, never tenant↔tenant. Clean initialized engine pages, kernel text, runtime RX and public resources share physical backing by inode and offset. Resource CAS files remain separate from prepared mutable state so arbitrary resource trees do not duplicate the common runtime snapshot. Tenant-specific data is authorized separately and excluded from public templates.

The small arena must fit both initialized mutable state and subsequent allocations. Guest mmap/brk allocate from a bounded physical free-page pool; virtual reservation and physical commitment become separate operations. Freed pages are zeroed before reuse inside the same run; whole-run discard reclaims host-private pages. Implement truthful ENOMEM rather than backing unlimited virtual ranges. An EL1 attacker can touch every registered writable page, but no more than the class's arena plus rings. Host translation/kernel overhead must still be experimentally bounded.

Keep guest stage-1 pages at 4 KiB. Use host `MADV_NOHUGEPAGE` on mutable mappings initially; sparse CoW is more valuable than hypothetical hugepage savings. Group mutable fields at 16 KiB boundaries for HVF and validate instruction-cache maintenance. Today's 204 KiB static stage-1 tables can remain in an initial sharing spike, but the final class must reduce tables/stacks to fit its 256 KiB kernel/stack allocation. A provisional partition is 96 KiB tables, 96 KiB user stack, 32 KiB EL1 stack and 32 KiB globals [E]; validate actual requirements and reduce the heap allowance if this fails. Map only required ranges and allocate tables lazily. Do not subtract the current tables' full size from private memory unless measurements show those pages would otherwise be dirtied. [Granule/table accounting](../research/next/01-snapshots-memory.md).

### Snapshot lifecycle

1. **Build:** canonicalize the recipe, validate static ELF off-path, emit extents, permissions, relocations where supported, resource roots and provenance. Hash output bytes once; publish immutable CAS objects atomically.
2. **Prepare:** boot a sacrificial VM, initialize Bellard QuickJS or Lua and the authority-free codec/bootstrap. Exercise dummy tool/Promise paths without external effects. Finish all jobs, close dummy handles, and empty queues.
3. **Snapshot:** stop at a dedicated CHECKPOINT before tenant code, grants, credentials, live timers or connections. Finish pending MMIO operations, capture supported CPU/system state and initialized mutable RAM, sanitize unused memory, and verify the manifest. This is not an arbitrary interrupted console transaction.
4. **Restore:** select a compatible precreated slot, stop all accessors, discard prior private mutable pages, reset rings/host state, restore CPU state, inject fresh run facts, and execute the trusted after-restore gate before accepting code.
5. **Reset:** after validated completion, revoke host handles, invalidate generation, detach/cancel tools and perform the same complete restore. A hardware shell survives; no logical invocation survives. Reset CPU counts even when performed after the response.
6. **Discard:** protocol corruption, timeout, unexpected exits or uncertain reset destroys the slot; close its VM/vCPU fds and unmap RAM on its owner. Corrupt shard state kills the shard. Evict cold clean slots rather than retaining a huge speculative warm fleet.

Linux starts with `MADV_DONTNEED` over the small private file mapping while stopped, using KVM's supported backing invalidation path. Keep memslots registered. Do not overwrite pages with snapshot bytes and claim physical reclamation. Verify guest-observed reset, not just host reads. HVF initially unmaps before discard/replacement, then remaps and flushes translations. No userfaultfd pager, KSM scanner, compression or guest-managed scratch CoW belongs in the first hot path. Firecracker establishes private file-backed restore; Hyperlight's guest-assisted CoW is a different alternative if measured host faults become the bottleneck. [Snapshot research](../research/next/01-snapshots-memory.md), [Firecracker mechanism](https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/snapshot-support.md).

## 4. Per-VM bytes and host-capacity arithmetic

Every value in this table is an **allocation [E], not measured KVM overhead**. The clean column describes an unbound restored shell, not a suspended tenant execution. The WAIT column is a small observed-state target; the peak column reserves the full `glue-2m` writable arena. Shared initialized bytes are counted once outside this table.

| Marginal physical component, bytes | Clean shell | Small tool-WAIT | Light peak |
|---|---:|---:|---:|
| Private runtime/heap delta | 0 | 524,288 | 1,048,576 |
| Private guest stacks, kernel globals, changed stage-1 tables | 0 | 131,072 | 262,144 |
| Ring/control pages | 81,920 | 81,920 | 81,920 |
| KVM VM/vCPU, fd/slab and `kvm_run` allowance | 196,608 | 196,608 | 196,608 |
| Independent stage-2 page-table allowance | 98,304 | 98,304 | 98,304 |
| Host page-table allowance | 73,728 | 73,728 | 73,728 |
| Slot metadata, saved-state storage, timer/queue entries | 16,384 | 16,384 | 16,384 |
| Trusted pending requests/results/capability state | 0 | 32,768 | 65,536 |
| Allocator/measurement headroom | 57,344 | 155,648 | 253,952 |
| **Total** | **524,288** | **1,310,720** | **2,097,152** |

The 192 KiB KVM row and translation allowances are hypotheses. A densely populated 32 MiB span with 4 KiB leaves needs 64 KiB leaf-table storage before parent levels [D/S]; separate host and stage-2 trees cannot be shared merely because guest data is shared. Sparse maps may cost less, optional architectural state may cost more. Disable SVE/SME, nested virtualization, guest PMU/debug features and unused devices in the declared CPU contract where the backend allows it. Enumerate mandatory state rather than assuming it away. [Memory accounting](../research/next/01-snapshots-memory.md), [KVM density research](../research/next/02-vmm-density.md).

For a **synthetic 64 GiB / 64 physical-core host**, reserve 8 GiB: 4 GiB OS/kernel slack, 2 GiB hot shared templates/resources, 1 GiB native services/shard stacks/host rings, 1 GiB emergency margin [E]. This is not a specification for a particular Graviton SKU. The slot pool receives `56 × 1,024 = 57,344 MiB` [D].

| Homogeneous population | Memory-only ceiling [D] | Meaning |
|---|---:|---|
| Clean, unbound 0.5 MiB shells | 114,688 | An idle-object scalability target; no tenant execution state |
| Paused runs averaging 1.25 MiB | 45,875 | Conditional occupancy ceiling; not safe peak admission for `glue-2m` |
| Runs reserved at 2 MiB peak | 28,672 | Intended safe memory admission if measured kernel/host allowances hold |
| Later hard-bounded 1.25 MiB compact class | 45,875 | Safe only after its smaller physical arena and host budgets pass |
| Larger class at 8 / 16 MiB all-in | 7,168 / 3,584 | Sensitivity examples, not measured JSON/native classes |

Retaining 512 clean spare shells costs 256 MiB, leaving **28,544** live 2 MiB reservations or **45,670** compact reservations [D]. Do not advertise the 114,688-shell ceiling as useful concurrent QuickJS execution. The shard cap allows these object counts in principle, but fd limits, VMA count, kernel allocations and creation/teardown tails may invalidate them first. Approximately seven VMAs per VM—including split immutable extents and the run mapping—can exceed common process mapping limits at maximum shard occupancy; provision the measured requirement before startup. The total virtual address envelope is terabytes, not resident RAM.

Admission uses peak class reservation, shared-cache occupancy and bounded tool-buffer reservations. A 1.25 MiB paused `glue-2m` run retains its 2 MiB token. It may dirty more memory after resumption. The mixed-state estimate `0.5 Nc + 1.25 Nw + 2 Na MiB` describes observed occupancy; the admission ledger instead uses `0.5 Nc + 2(Nw + Na)` until a smaller hard class is proven. Arbitrary overcommit plus “most are waiting” is not a containment strategy.

Host tools can dominate: if each live invocation retains an additional 100 KiB outside these allowances, a nominal 2 MiB VM costs 2.09765625 MiB and the no-spare memory ceiling falls to approximately **27,337** [D]. Enforce global byte credits before reading upstream bodies, spill to bounded host blobs, limit connection pools and count per-principal resource cache bytes. Unique private resource sets consume additional physical memory even when identical public templates share perfectly.

Only **56 VMs execute guest instructions simultaneously** in this topology; thousands more may be runnable or waiting. For measured whole-service cost `C` CPU-ms/run, the ideal execution capacity is `56,000/C runs/s`; at a 70% lane-utilization target it is `39,200/C` [D]. Thus 1/2/4.8 CPU-ms imply approximately 39,200/19,600/8,167 runs/s before any separately omitted bottleneck. The 4.8 comparison is illustrative because the historical measurement has a different platform and accounting scope.

Little's law makes concurrency meaningful. At 39,200 runs/s with 1 ms local work and 100 ms average external wait, approximately **3,959 live runs** occupy the host [D]. Filling 28,672 peak reservations at that rate requires roughly **0.731 s** average lifetime. A burst in which all 28,672 need 1 ms guest work takes at least **512 ms** on 56 lanes. Memory density is not submillisecond latency at maximum runnable concurrency. Measure recent-running VM working sets too: arm64 VMID rollover can cause translation flush pressure without limiting allocated VM count. [VMID evidence](../research/next/02-vmm-density.md).

## 5. Request lifecycle and time/CPU allocations

An MCP `execute` authenticates once, resolves grants and selects a resource class. Recipe and prepared-cache hits select immutable descriptors; the scheduler acquires a clean slot, registers its deadline, restores it and injects the run manifest. The guest repair gate acknowledges its generation, then the engine parses fresh source and runs it. Tool submissions reach the broker through bounded host-only queues. Async tools release the guest runner at WAIT; completions make the guest runnable. FINISH is accepted only after complete output validation and zero outstanding calls. The host returns the MCP result, then completes reset/refill while retaining capacity charges.

The following **stretch budget [E]** is for a resident-cache hit, idle queues, tiny source/output and one immediate native echo. Wall time excludes remote tool duration `D` and load-dependent scheduler queueing `Q`. CPU includes reset even when it precedes the next invocation.

| Step | Local wall µs [E] | Whole-service CPU µs [E] |
|---|---:|---:|
| MCP receive, decode and input admission | 70 | 70 |
| Live grant, recipe/prepared lookup, binding table | 60 | 60 |
| Slot selection, owner handoff and deadline registration | 20 | 15 |
| Prior private-page discard, attributed to this run | 100 | 100 |
| Architectural/ring/host-state restore | 140 | 140 |
| Fresh entropy/time and runtime repair gate | 35 | 35 |
| Mandatory first-touch/CoW fault work | 100 | 100 |
| Fresh code parse and trivial guest execution | 200 | 200 |
| One local tool submission/completion round | 30 | 30 |
| FINISH, result validation and bounded copies | 60 | 60 |
| Revocation, accounting, enqueue reset | 40 | 40 |
| MCP encoding and response write | 70 | 70 |
| **Total** | **925 + D + Q** | **920 + actual tool CPU** |

Restore accounts for the four discard/state/repair/fault rows: **375 µs** [D], inside the synthesis's unmeasured 0.1–0.8 ms hypothesis. Publish both reset-to-first-command and first-result distributions. The first practical acceptance gate is **≤2 CPU-ms/run**; ≤1 CPU-ms is the stretch target. The table is an allocation to falsify, not precision obtained from measurements. p99 is measured end to end; summing p50 budgets does not predict it. [Synthesis](../research/next/SYNTHESIS.md), [restore accounting](../research/next/01-snapshots-memory.md).

Budget a small round at 8 µs guest codec work, 5 µs checked copies/validation, 6 µs exit/re-entry, 7 µs broker handoff/policy, 4 µs response copy/dispatch [E]. The 6 µs crossing allocation has **no verified Graviton/Ampere measurement**. Require ≤30 µs p50/≤60 µs p99 for the declared echo/load, or revise the budget. Existing 285 µs one-tool latency is a whole execution, not a measured transport RTT. Current outer MCP adds approximately 0.4–0.5 ms over its named executor comparator; eliminating it requires measured native work, not subtracting that number from the raw result. [Transport research](../research/next/05-io-caps-images.md).

At 30 µs per call, 64 sequential calls consume 1,920 µs locally [D]. Promise.all batches overlap external waits but still consume per-call CPU and buffer credits. The ≤1 ms CPU goal cannot cover unlimited fan-out, JSON size or tool computation. A hot prepared hit performs no builder invocation, whole-image hashing, acorn normalization or prelude evaluation. Cache misses queue preparation with explicit status; they are outside the warm budget. Keep the existing Node SDK executor as a compatibility client of the native service, with its own measured fixed memory and latency; do not apply this budget to arbitrary TypeScript provider callbacks.

## 6. Ring ABI, doorbells and thread-free WAIT

Define `jitk-abi-2` independently of external MCP. One 16 KiB control area and two 32 KiB byte rings cost **81,920 B/slot** [E]. Control contains ABI/version/features, generation, producer/consumer sequences, credits, wait mask/deadline and boot/run descriptors. Each record has a bounded length, kind, correlation ID, capability slot, generation and payload. JSON retains strict depth, duplicate-key, numeric and Unicode checks; native stdout/stderr and blob chunks use separately typed byte records. Full v1-sized payloads require a larger class or explicit chunk/blob contract, not an unbounded reassembly buffer inside an 80 KiB ring.

Producer and consumer cursors occupy separate cache lines. Use monotonic 64-bit sequence arithmetic, release/acquire publication, checked wrap handling, and fixed maximum record sizes. Preserve 64 outstanding/4,096 total invocations and wire/depth limits; smaller class byte limits apply additionally. A full ring yields for credits. FINISH cannot overtake unfinished submissions. Logs have bounded lossy credits, while calls/results fail explicitly on overflow. Broker copies validated metadata and argument bytes to trusted storage before asynchronous dispatch; guest-writable memory is never retained across an await.

SUBMIT notifies without promising suspension; WAIT publishes all queued submissions plus the consumed-completion sequence and returns control to the owner; FINISH terminates the logical run; CHECKPOINT is preparation-only. `SUBMIT_AND_WAIT` is the cheap common path. Flush a batch when the engine has exhausted runnable jobs, rather than trapping once for every Promise creation. SVC filesystem operations execute within the guest and are not inherently VM exits.

Use a permitted SMCCC function range configured with `KVM_ARM_VM_SMCCC_CTRL` / `KVM_ARM_VM_SMCCC_FILTER` forwarding to `KVM_EXIT_HYPERCALL`. Put arguments in the ring rather than fetching many registers. Probe support; use one fixed-width MMIO-store doorbell otherwise. HVC routing is configured, not an arbitrary instruction convention. Complete MMIO's pending instruction with the backend's immediate-exit sequence before snapshot/reset or register replacement. HVF decodes the same selected doorbell operation. [SMCCC API](https://cdn.kernel.org/doc/html/latest/virt/kvm/devices/vm.html#group-kvm-arm-vm-smccc-ctrl), [Hyperlight KVM precedent](https://github.com/hyperlight-dev/hyperlight/blob/8a7e6b8794fea050ce287eed614088f0beb6b973/src/hyperlight_host/src/hypervisor/virtual_machine/kvm/aarch64.rs).

WAIT avoids lost wakeups through owner serialization: drain submissions; register `(slot,generation,observed completion sequence)` as waiting; recheck queued completions; enqueue immediately if anything is ready. A reactor only queues messages for the owner. If completion arrives during registration it is either found by the recheck or consumed as a later event. The guest rechecks its ring after resuming. No WFI, GIC interrupt, polling loop or sleeping KVM_RUN caller is needed. Promise.all may issue many requests before WAIT; each result remains correlated and batches can arrive out of order.

Mask/unarm cooperative virtual timers and maintain timer requests in host heaps. Malicious EL1 code can change system registers, so unexpected timer output, IRQ, MMIO/NISV and exception exits have bounded handlers or fail closed. An owner uses an initial 1 ms host execution quantum [E], with a targeted kick for non-yielding code. A forced preemption has a provisional 2–10 µs scheduling allowance beyond normal entry/exit [E]; measure it rather than using Seattle-era hypercall cycles as a Graviton result. Idle guests generate zero periodic transport exits. [No-GIC and WAIT research](../research/next/02-vmm-density.md).

## 7. Capabilities, synthetic files and immutable identity

Admission separates three keys. **Recipe hash** identifies canonical build inputs: architecture/ABI, superset kernel/manifest, pinned toolchain, runtime/ELF, bootstrap/schema shape, extent layout and resource digests. **Content hashes** identify actual image/extent bytes. **Prepared key** adds snapshot format, backend, CPU-feature contract, engine/prelude ABI and initialization profile. Action cache maps recipe→artifact hashes; prepared cache maps compatible image/profile→snapshot hash. Concurrent misses coalesce. Neither credentials nor principal/run IDs enter these keys. Identical immutable bytes share only when mapped from the same backing object; similar bytes in separately rebuilt files do not automatically deduplicate. [Image/capability research](../research/next/05-io-caps-images.md).

Grant *shape* supplies immutable method descriptions, validators and optional `.d.ts`; grant *instance* supplies a live broker table after restore. A guest handle is a slot in that run's host-owned table, scoped by generation. The broker checks principal, rights, schema, provenance, approval digest, deadline, quotas and revocation for every invocation. A path or integer never grants authority on its own. Secrets and upstream credentials stay in the broker. Revocation changes live tables without rebuilding snapshots. Preparation can preinitialize generic proxies and codecs, but not tenant connections or authorized resource results.

| Guest interface | Semantics | Incremental cost [E] |
|---|---|---|
| `/skills/`, public `/images/<hash>/` | Immutable packed archive metadata/data | Shared bytes once, fd state within guest arena; local lookup/copy, no host exit |
| `/mcp/<binding>/tools/*.json`, `*.d.ts` | Granted schema/docs view; reads cause no effects | Shape cached once; small run overlay; local metadata |
| `/mcp/<binding>/resources/<encoded-uri>` | Authorized snapshot of bytes per run; explicit refresh | First materialization one resources/read; later local/chunk reads, host blob bytes charged |
| `/cap/<slot>/call` | Duplex one-request endpoint with explicit complete-record submit | At most 256 B/fd metadata, 16 KiB at 64 fds; buffered bytes counted separately; one call round |
| Generated JS stubs | Same live slot/method dispatcher | Direct ring submission; avoids open/path parsing and an extra RPC layer |

Resource URI encoding is injective. A per-run manifest fixes resource versions and authorized aliases; authorization precedes content-cache lookup. Opening a large upstream MCP resource may fetch the whole object because MCP resources do not promise range reads. Keep it host-side and expose bounded chunks or read-only extents when worth mapping. Do not pretend public MCP specifies POSIX inode/coherence semantics. Tenant resource mappings need new compatible slot layouts or cold preparation, not per-read memslot churn.

Allocate ≤2 µs per warm local metadata operation and ≤4 µs per checked 4 KiB resource copy [E], inside the guest execution budget; a remote materialization adds actual upstream latency/CPU plus transport cost. Repeated small local reads should not generate host exits. These are spike targets, not extrapolations from the existing large-read benchmark.

`open/stat/readdir/close` on a call endpoint are local. Partial writes accumulate only within a strict request bound; exactly one fully validated length-delimited record submits the effect. Duplicate submission fails. Response reads and EOF do not invoke again; seek returns ESPIPE. Closing an already submitted endpoint cancels local interest without promising remote rollback. Native stdout is bytes, separate from protocol control; Unicode/binary output can no longer corrupt JSON framing.

Kernel-side reply demultiplexing is mandatory: a native program blocking in `read(/cap/...)` cannot depend on QuickJS's JS read-handler loop to dispatch its reply. The common kernel ring routes tagged file replies, stdin, timers and JS control independently. `ppoll` and nonblocking errors reflect real readiness. Endpoint differential tests use a deterministic reference adapter on Linux, while ordinary file/syscall semantics retain normal-Linux oracles.

Cap'n Web is an optional prepared client profile over this same transport. Start with guest stubs for host-owned capabilities; reject guest exports and unsupported streams. Count expanded `.map()` invocations, live imports/exports, graph depth/instructions, bytes and pending answers at the broker. Batch push+pull and piggyback releases. The audited ordinary awaited scalar call uses **four messages**, not one; pipelining saves waiting rounds, not operations. Existing bundle sizes are **46,404 B core/RPC and 59,613 B full**, not resident heap measurements [M/S]. Charge its measured dirty-state delta as another profile; promote only if plain calls regress by ≤10 µs and the memory class still fits [E]. [Cap'n Web audit](../research/next/05-io-caps-images.md), [local integration](../research/cloudflare-deep.md).

MCP remotes still execute dependent operations in dependency order. Cap'n Web can remove guest waits even when the remote is plain MCP, but cannot magically batch that remote protocol. Keep default execution **no replay**. Approval waits are ordinary WAIT states. Optional simulate-then-approve requires an explicitly pure adapter. A future durable replay feature must record completion order, clock/random events, exact results and commit decisions; unknown remote effect outcomes require idempotency/status reconciliation, never automatic rerun.

## 8. Reset, uniqueness and failure containment

The trusted after-restore gate runs before untrusted input. Fresh kernel entropy alone cannot repair a saved userspace PRNG. Add a small audited Bellard integration hook that resets the existing context's random state, supplies fresh getrandom state, clock base and generation, and reports successful repair. Pin the engine source corresponding to the binary. If the stock CLI cannot expose a sound checkpoint/hook, use a minimal static Bellard embedder; count and test that change rather than claiming unchanged stock-qjs semantics. Lua receives its own runtime audit. Native arbitrary binaries start from an entry snapshot and perform their own initialization unless a specific post-init uniqueness contract exists.

Capture with no protected libc/library frames requiring old guards on return. A tiny trusted checkpoint loop can be built without stack-protector instrumentation; initialize per-run libc guards before entering new application frames. Inventory hash secrets and other initialized tables: do not change a hash seed under existing dictionaries without rebuilding them. Public deterministic prepared constants are permitted; copied security-sensitive state is not. This is a runtime-specific gate, not a claim that adding 32 seed bytes closes every uniqueness problem. [Uniqueness analysis](../research/next/01-snapshots-memory.md), [runtime repair](../research/next/04-runtimes-platforms.md).

Reset all supported GPR/SIMD, PC/PSTATE/SP, system/translation registers, exception state, timers/counter offsets, debug state and backend pending operations. Restore stage-1 mappings/allocators through RAM reset, perform required translation/instruction-cache synchronization, and reset host queues, budgets, file offsets, callback tables and diagnostics. Kernel counter/time calibration is sampled per restore. No tenant byte may survive in mapped scratch, partial records or reused host buffers. Generations are host-issued and never reused; callbacks carry their original generation and are dropped after termination.

Clean shell reuse requires both a sandbox-ready host acknowledgement and a successful restore/repair acknowledgement. These replace the old one-time process sandbox ack plus READY rule; neither guest logs nor exit status establishes success. Valid FINISH is followed by closed admission and revoked handles; capacity remains charged until reset or destruction completes. Never optimize same-snapshot reset into a no-op.

Deadline/abort handling closes broker admission first, cancels tools cooperatively and marks the run terminal. A running owner receives a targeted signal/kick with immediate_exit and an activation epoch. The owner acknowledges exit before recycling mappings; signal handlers never dereference freed run mappings. Check cancellation immediately before KVM_RUN to close the kick-before-entry race. Waiting runs terminate without entering the guest. Timeout slots are destroyed, not returned to the clean pool.

The external watchdog tracks owner progress and a bounded stop acknowledgement deadline, then kills the shard via pidfd if it fails. The provisional target is owner stop within 5 ms and observed shard death within the existing ≤50 ms exposure criterion [E]; measure actual stopped execution/death, not just signal timestamps. Host callbacks must be asynchronous, bounded and cancellation-aware. Noncooperative SDKs require a persistent bounded adapter process or exclusion from this service class; a memory-safe ring cannot interrupt synchronous Node code.

A VMM escape compromises every tenant mapped in its shard; process-wide OOM or panic also loses that shard. Credentials remain outside it, but the broker cannot distinguish forged requests for another run in the compromised shard. Shard by trust domain where required, reduce occupancy for stronger containment, apply per-shard cgroup/rlimit/seccomp/Landlock confinement and retain an external killer. Shared public executable pages retain timing-channel risks; secret-free templates do not eliminate access-pattern leakage. Stronger confidentiality domains may need separate backing/hosts, reducing density. [Containment evidence](../jitk/CONTRACTS.md), [exposure criteria](../jitk/docs/KILL-CRITERIA.md), [sharing risks](../research/next/01-snapshots-memory.md).

## 9. Offline growth, native tools and today's files

Use one superset kernel per runtime/structural profile. Recipes restrict allowed syscall numbers, argument variants, filesystem roots and capability methods. Install recipe policy as bounded per-run data after restore; policy identity alone must not duplicate the common prepared runtime. Guest policy limits exposure; host capability checks remain authoritative. Unused handlers allocate no state and execute no work. Separate kernel binaries require a measured private-state or CPU benefit large enough to outweigh lost sharing/cache fragmentation. Research's **32–128 KiB / 5–19 µs** specialization sensitivity is an estimate, not a demonstrated density lever. [Compatibility research](../research/next/03-compat-grow.md).

The offline grow controller discovers missing behavior through exact ARM64 workload traces, optional-feature fault injection, semantic failures and resource regressions. Agents propose bounded changes against controller-owned helpers; the controller owns hidden tests, oracle normalization and promotion. Add gVisor/LTP-derived boundary cases, stateful sequences and deliberate bad-handler mutations. Current 90/90 evidence is three regrown fixtures repeated thirty times, not ninety independent Linux contracts. Growth adds **zero runtime model calls or build CPU** to a cache hit. A new accepted kernel produces new content/prepared keys; already running versions drain normally.

Start native coverage with jq, synchronous Rust-musl, serial `rg --threads 1 --no-mmap`, SQLite `:memory:` and immutable read-only databases. The suggested **30–50 syscall union** remains a census hypothesis [E], not compatibility. Preserve byte stdout/stderr/status and exact error behavior. Writable SQLite durability/locking is another filesystem contract; Go/Node require threads, TLS, futex/signals and real reservation/protection semantics. A single vCPU or GOMAXPROCS=1 does not remove those requirements. [Recipe census and structural barriers](../research/next/03-compat-grow.md).

Today's loader accepts only static AArch64 ET_EXEC within **0x400000–0x680000, 2.5 MiB** [S]. Replace that fixed packed arena with off-path segment placement, validated lengths/alignment/overlap, configurable VA limits, PT_TLS/auxv handling and class-sized RW allocation. Static PIE later needs reviewed relocation support; dynamic ELF needs a loader/dependency closure and is outside the initial class. Enforce W^X, implement required mprotect/PROT_NONE/file-mapping semantics truthfully, and update checked-copy helpers for discontiguous physical pages. No runtime general ELF parser or compiler is necessary for pinned static recipes. [Loader evidence](../research/next/SYNTHESIS.md), [current packer](../jitk/kernel/prepare.py).

All paths below are relative to `arch/jitk/`. This is a proposed replacement map, not edits made in this round.

| Files | Keep / change / delete in the target architecture |
|---|---|
| `kernel/src/{boot.S,vectors.S,trace.rs}`, syscall handlers | Keep EL0/EL1 boundary, diagnostics and tested leaf semantics; add bounded physical allocation and restore gates |
| `kernel/{link.ld,prepare.py,artifact.py}`, `kernel/src/{mmu.rs,user.rs,syscalls.rs}` | Change to separate immutable/mutable extents, page-aware copies, content manifests, checkpoint/repair and binary output |
| `kernel/src/{main.rs,wait.rs}` | Replace GIC/timer/WFI initialization with boot descriptor, ring WAIT and host timers |
| `kernel/src/{console.rs,fdt.rs}` | Delete from production device path after parity; replace with `transport.rs` and fixed versioned boot descriptor |
| `kernel/src/fs.rs`, file/read/write/ppoll handlers | Keep packed archive lookup; add synthetic mount/fd variants and kernel-side reply demultiplexing |
| `protocol/{PROTOCOL-v1.md,dispatcher.ts,bootstrap.js}` | Keep v1 frozen and its hostile vectors as reference; add ABI-2 spec, native canonical validator and prepared engine adapter; TS compatibility delegates to the same service |
| `vmm/src/main.rs`, new `vmm/src/{kvm,hvf,shard,snapshot}.rs` | Replace libkrun builder/event loop with stable VM objects and fixed owners; keep old launcher only until comparison gates pass |
| `vmm/{build.py,build-linux.sh,patches/}` | Remove production dependency on libkrun/console/GIC patch stack after replacement verification; preserve historical evidence |
| `vmm/{src/confinement.rs,sandbox/}` | Keep confinement intent/tests; redesign allowlists for persistent shards, passed CAS fds, mappings, kicks and host-only rings |
| `vmm/src/watchdog.rs` | Keep independent native watchdog and pidfd/kqueue identity safety; change per-VM pid tracking to owner/slot deadlines plus shard escalation |
| `executor/{backend.ts,pool.ts}` | Replace process-per-run spawn/reap/refill with native service/slot client; retain adapters as compatibility/reference, not a parallel pool implementation |
| `executor/{code.ts,upstream.ts,codec.mjs}` | Move fixed trusted codec/prelude initialization to prepared profiles; normalize only fresh source at the API boundary when required |
| `executor/{executor.ts,policy-adapter.ts,policy/policy.mjs}` | Preserve public APIs/effect rules; native broker becomes authoritative runtime policy, validated against existing vectors; TS client does not add a second authority |
| `mcp/{server.mjs,jitk.mjs}` | Preserve external tool/resource contract and tests; native host serves fleet path, SDK wrapper remains compatibility client |
| `grow/{loop.py,agent.py,adapters.py,oracle/}` | Keep offline bounded proposal workflow; replace hardcoded discovery/repetition-led acceptance with semantic corpus and mutation checks |
| `bench/{run.py,cases.json,processes.py,hyperlight/}`, hostile fixtures | Keep comparisons and provenance; add ledger, dirty census, WAIT, scale, native CPU and reset/uniqueness suites; dev Python stays offline |

The architectural simplification is fewer runtime machines and lifecycle states, not a promise of fewer total source lines. A native policy/JSON/MCP implementation needs interoperability tests and careful scope; do not keep two divergent authorities to save migration effort.

## 10. Build order, gates and abandonment

Use the synthesis's experiments in order of uncertainty. Each initial spike is bounded to less than one engineer-day; successful spikes justify a separately planned implementation. Local/nested KVM establishes function, not metal performance. If an authorized metal machine is unavailable, leave those claims unmeasured; this design authorizes no cloud provisioning.

| Order / synthesis experiment | Concrete gate [E] | Failure decision |
|---|---|---|
| 1 — E1 current memory ledger | Post-direct-load build at N=1/16/64/256; READY/peak/WAIT/churn; reconcile aggregate PSS, host page tables, slab/KVM and service buffers; unexplained delta ≤10% | No density claim until attribution closes |
| 2 — E3 minimal KVM shard | No GIC, fixed owners; N through 2,048, then scale; **empty marginal VM ≤1 MiB**, including kernel charges; separate clean-shell 0.5 MiB target | Above 1 MiB: rethink shard/private budget before porting runtime |
| 3 — E2 dirty census and bounded layout | Initialized QuickJS: empty/one_tool/64 KiB/1 MiB JSON; actual private+host peak ≤2 MiB for declared small fixtures; EL1 cannot exceed mapped writable allowance | If initialization or useful small work cannot fit, revise class/density; never hide extra guest RAM |
| 4 — E4 CoW/reset loop | ≥1,000 restores with p99 ≤1 ms including first faults; extend canaries to 10,000 cycles, clean/faulted runs, sibling isolation, fresh random/time and stable post-churn memory | Any leak/duplicate unique state blocks reuse; failed latency kills sub-ms claim |
| 5 — E5 WAIT/resume | 1,000 held runs, then target occupancy; runner count fixed, no periodic guest exits, idle/wait CPU <1% of one core per host; randomized completion/credit/cancel races and Promise.all(10) | If waiting retains runner threads or loses replies, reject scheduler design |
| 6 — E1/E4/E5 integrated native path | One echo ≤30/60 µs p50/p99; tiny run ≤2 CPU-ms including refill/broker/watchdog, stretch ≤1; current policy/protocol hostile matrix and ≤50 ms observed kill gate | Attribute miss; do not solve it by omitting deferred CPU or weakening validation |
| 7 — E3/E4/E5 scale certification | N=4k/16k/32k and larger only if budget allows; completion storms, VMID working sets, fd/VMA/slab limits, shard kill/refill; no swapping/OOM, peak ≤reservation, queue-delay curves published | Reduce advertised count; abandon large shards if kernel/scheduler tails dominate |
| 8 — E6 real native recipe census | Load and run held-out jq/rg/SQLite/Rust/Go fixtures; exact outputs, errors, bytes and resources; class assignment explicit | Reject unsupported runtimes rather than fake threads/futex/signals |
| 9 — E7 semantic growth | 20–50 relevant semantic cases, 1,000 bounded stateful sequences, wrong-errno/skipped-write/dropped-wake mutations detected; genuinely new held-out workload enabled | Surviving material mutation invalidates acceptance; stop broad growth claims |
| 10 — E4/E5 HVF parity | Same ABI corpus, independent process isolation, remap/TLBI/canary/entropy tests; publish its own latency/CPU/memory | Keep simple process pool; no Linux density projection on macOS |

Record artifact hashes, host page size/kernel, CPU model/features, VHE/nVHE/nesting, affinity, load and residency. On Linux use process mappings plus cgroup/system deltas without double-counting the file cache; include kernel allocations outside convenient process counters. On macOS add aggregate HVF/system changes to process footprint. Collect p50/p99/max and CPU/run at steady state, including refill and teardown. Sweep allocated, waiting, runnable and recently-run counts independently. The historical kill-criteria ledger is superseded where [FINAL](../FINAL.md) records repairs, but its exposure and equivalent-isolation comparisons still constrain promotion.

Abandon the **specific density design** if unavoidable empty-state cost exceeds 1 MiB and no budget remains for useful execution; if actual small workloads exceed the 2 MiB all-in class; if reset/first-touch costs erase CPU gains; or if safe cancellation requires killing large shards frequently. A higher-memory class is an honest fallback, but it forfeits this proposal's central advantage. Abandon whole-VM prepared runtime reuse if uniqueness cannot be restored without rebuilding most of the heap. Keep fresh-entry native templates where their startup remains competitive.

The remaining risks are concentrated: private-page churn from engine refcounts/allocators; host-kernel metadata and VMID/cache pressure at high N; queueing under synchronized completions; hard-to-audit reset state; larger shard blast radius; and duplicate work in a native broker migration. Address them through the named gates, not additional speculative mechanisms. Revisit guest-assisted CoW only if fault traces justify its trusted complexity. Consider another engine only after a snapshot-aware test demonstrates **≥20% end-to-end CPU improvement within the memory class**, as required by the synthesis.

## 11. What is borrowed and what is distinctive

**Firecracker:** borrow immutable file-backed MAP_PRIVATE restore and separation of memory from machine state. Its historical approximately **3 MB VMM overhead** excludes configured guest RAM; it does not establish our total. We omit its Linux/device machine, per-VM process lifecycle and disk/network state. [Memory research and source qualifications](../research/next/01-snapshots-memory.md).

**Hyperlight:** borrow callable persistent VM objects, initialized-state reuse, narrow host-call boundaries, no-GIC arm64 precedent, rigorous reset, and HVF's serial address-space-switch lesson. It already uses packed virtqueues without device discovery; ring ownership and batching are established work. We choose host file CoW first instead of its guest-managed scratch paging, keep a Linux EL0 syscall ABI, and add explicit asynchronous mid-run WAIT scheduling. Do not claim Hyperlight inherently supplies our async callback model. [Source audit](../research/next/02-vmm-density.md).

**LightVM:** borrow precreated shells, removal of background guest activity, and minimizing toolstack/control-plane work. Its **8,000 noop VMs** and **2.3 ms device-free creation/boot** are Xen-era measured results on different hardware/workloads, not predictions for QuickJS/KVM. [LightVM evidence](../research/next/02-vmm-density.md).

Solo5, Virtines/Wasp, SEUSS, Plan 9 and capability systems supply further precedent for device-free calls, pooled contexts, prepared sharing and file-shaped authority. SEUSS's tens of thousands of contexts were not individually stage-2-isolated KVM VMs. No novelty is claimed for a ring, a snapshot, fixed threads, a content hash, or a many-VM KVM process.

The distinctive proposed combination is **a very small Linux-ABI guest whose coverage grows offline through independently owned semantic tests, composed from shared prepared parts, with late-bound capabilities and thread-free tool waits**. Its testable contribution is the resulting all-in private-memory slope and useful CPU/run under hardware isolation. The architecture earns its density claims only when the ledger and scale gates produce those results.
