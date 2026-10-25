# Third option: in-house multi-VM-per-process VMM with CoW snapshots

Evidence tags: [src] read in code (Hyperlight HEAD 8a7e6b8, 2026-10-22, cloned to /tmp/hl/hyperlight), [hdr] macOS 26.5 SDK headers, [web] cited page, [est] my estimate. Where I found no number I say so.

## 1. Hyperlight internals

- **Layout.** Guest = a statically linked ELF/PE, no kernel. The host owns a read-only *snapshot* region plus a small writable *scratch* region (`DEFAULT_SCRATCH_SIZE` 0x64000 = 400 KiB, `DEFAULT_HEAP_SIZE` 128 KiB) [src: sandbox/config.rs:107-111]. A snapshot is guest memory plus page tables, the vCPU state and the "next action" [src: sandbox/snapshot/mod.rs].
- **Restore** (`MultiUseSandbox::restore`) [src: sandbox/initialized.rs:465-600, mem/mgr.rs:692-800]:
  - If the snapshot memory is already the mapped one, nothing is copied.
  - Scratch is reset with `madvise(MADV_DONTNEED)` on KVM (lazy zeroing). Other platforms get `fill(0)` or a fresh mapping [src: mem/shared_mem.rs:1440-1470].
  - Then it resets the virtqueue state and the vCPU registers.
  - The snapshot stays read-only and shared. Writes are **copied in by guest code**. The guest page-fault handler walks the original page tables and copies the page into scratch ("CoW fault-in") [src: mem/mgr.rs:800-815].
  - There is no host MAP_PRIVATE or UFFD. Snapshot and scratch are two KVM memslots, and a restore touches only the dirtied scratch.
  - Same-snapshot restore is deliberately not shortcut. Their comment worries about cross-request leakage via physical memory.
- **Host calls.**
  - Old path: x86 `out dx, eax`.
  - Current path: two shared-memory VIRTIO *packed* virtqueues (G2H and H2G), not discoverable devices. The arena is 21 pages (64-descriptor G2H ring, 32-descriptor H2G ring, 12 + 8 pages of buffer pool) [src: docs/virtio-host-guest-communication.md].
  - **arm64 has no hvc.** The "doorbell" is a store to a reserved "io page" MMIO address. The offset/8 is the port, and the value is read from the source register in the fault syndrome [src: kvm/aarch64.rs:208-246, hvf/mod.rs:625-670]. The guest-side exit is still a TODO [src: hyperlight_guest/src/arch/aarch64/exit.rs:4].
  - Halt is an MMIO write too. On KVM it then needs `run_immediate_exit()` to clear the pending PC increment [src: kvm/aarch64.rs].
- **Guest-call model.** Synchronous. The host writes a request into H2G, enters the VM, and the guest runs to Halt. Host functions are guest-to-host calls that block the guest, so there is no async. The guest's restricted/unrestricted mode and poisoning handle failure: a guest that does not reach Halt poisons the sandbox, and the fix is `restore`.
- **KVM aarch64 without a GIC works in practice.** Hyperlight's aarch64 KVM backend calls `create_vm`, `get_preferred_target`, `vcpu_init` and `KVM_CAP_ARM_NISV_TO_USER`. It never creates a vGIC (no `vgic` or GIC reference in kvm/aarch64.rs) [src]. This is the best precedent for your no-GIC design.
- **macOS: yes, HVF is supported** (hvf/mod.rs, 1236 lines).
  - One `hv_vm_create` per process, guarded by a static mutex (`HV_VM_CREATED`) [src: hvf/mod.rs:713-740].
  - The module doc says "hvf assumes that there is only <= 1 VM per process, and <= 1 VCPU per thread". Hyperlight maps "sandbox" onto that by keeping one global "loaded memory space". Switching sandboxes means `hv_vm_unmap`/`hv_vm_map` of that sandbox's regions, then running a tiny EL1 stub (`dsb; tlbi vmalle1; dsb; isb; hvc #0`) on the vCPU to flush stale translations. Registers are re-synced on every exit [src: hvf/mod.rs:8-60, 760-960].
  - "More than one Sandbox per process" via nested virt is listed as not implemented.
  - **Inference:** Hyperlight's HVF multiplexing is time-multiplexed, not concurrent isolation.
- **Their claimed numbers.** 1-2 ms to create a micro-VM [web: opensource.microsoft.com/blog/2024/11/07/...]. About 0.9 ms per call, VM recycled, in a demo [web: .../2025/02/11/hyperlight-creating-a-0-0009-second-micro-vm-execution-time/]. Your 1.8 MiB / 9 ms CPU / 18 ms cold numbers are your own measurements. I found no independent public ones.

## 2. Firecracker snapshots

- **Backends.**
  - File backend: `MAP_PRIVATE` of the memory file, so pages load on demand and writes go to anonymous CoW. The file must stay alive and immutable.
  - UFFD backend: a separate handler process serves faults over a unix socket. It is required for 2M hugepages [web: firecracker docs/snapshotting/snapshot-support.md].
- **Latency.**
  - Brooker: about 4 ms to restore a snapshot, about 10 ms for a "decent-sized Linux" [web: brooker.co.za/blog/2022/11/29/snapstart.html]. This is the author's figure, not a methodology.
  - REAP (ASPLOS'21): vanilla Firecracker restore was 50 ms for VMM+emulation plus 182 ms for a helloworld invocation, because of page faults on a cold disk. REAP's record-and-prefetch working set cut cold start 3.7x on average [web: arxiv.org/abs/2101.09355].
  - On mmap vs UFFD: one 2026 paper measured per-page `mmap` install at 2.6x the cost of `uffd.copy()`, which matters when ranges are fragmented [web: arxiv.org/pdf/2606.24079]. I found no clean MAP_PRIVATE vs UFFD head-to-head for Firecracker.
  - For a warm page cache and a ~10 MiB image, a file-backed MAP_PRIVATE restore needs only minor faults. That is the right regime for you [est].
- **Uniqueness.**
  - Firecracker says "we consider resuming execution from the same state more than once insecure".
  - Kernel >= 5.18 reseeds on a VMGenID change. DeviceTree/ARM needs kernel >= 6.10 for VMGenID (Firecracker's supported guests are 6.1, so a backport is needed).
  - A race window remains between vCPU resume and CSPRNG reseed.
  - App-level state (UUIDs, userspace PRNGs, tokens) is still duplicated [web: firecracker docs/snapshotting/random-for-clones.md].
  - The AWS paper proposes `MADV_WIPEONSUSPEND` and VmGenID [web: arxiv.org/abs/2102.12892].
  - **For jitk:** your guest is custom, so just inject a fresh 32-byte seed into the ring header on each run. QuickJS `Math.random` and any `getrandom` must read it. This closes the problem completely [est, high confidence].
- **Clock.** The wall clock continues from the snapshot instant. Firecracker's `clock_realtime` is x86 kvmclock only [web: same doc]. On arm64, the generic-timer virtual counter (CNTVCT) = host counter - CNTVOFF. After restore, set CNTVOFF (KVM: `KVM_REG_ARM_TIMER_CNT`) or just pass host time in the request header, as you control the guest.

## 3. KVM costs

- **No clean public numbers** for CREATE_VM / CREATE_VCPU. Data points:
  - One VMM log: CREATE_VM about 16 ms and CREATE_VCPU about 0.5 ms (70 MB guest, one run, github.com/just-js/joos) [web, weak].
  - A Feb 2026 LKML thread: strace shows first CREATE_VCPU about 137 us before a patch. A `synchronize_srcu` in memslot swap caused about 20 ms stalls (about 1 ms at HZ=1000) [web: lkml.iu.edu/hypermail/linux/kernel/2602.1/07200.html].
  - **Takeaway:** memslot changes can block on an SRCU grace period. Never do `KVM_SET_USER_MEMORY_REGION` on the hot path. Create slots once per VM, and reset by changing page contents, not slot layout.
- **Limits.** The VM fd is an fd and not process-limited. Practical caps are `RLIMIT_NOFILE`, ~`KVM_MAX_VCPUS`, and kernel memory per VM (stage-2 tables, `kvm_vcpu` ~ tens of KB) [est]. Hundreds of VMs per process is normal (Hyperlight, Cloud Hypervisor's per-process model aside).
- **arm64 specifics.**
  - Hyperlight runs without a vGIC (above).
  - From kernel knowledge (not re-verified in-tree): with no irqchip, KVM_RUN proceeds with a userspace irqchip, and the arch timer fires through `KVM_EXIT_ARM_TIMER`/`kvm_run` sync regs only if you ask for it. If the guest never unmasks a timer or IRQ, nothing is needed [est, medium].
  - **WFI parking will not work.** A WFI with no wake source never returns. Make WFI trap (KVM exits to userspace on WFI only with `KVM_EXIT_*` in some cases) or use hlt-by-MMIO as Hyperlight does.
  - NISV exits (`KVM_CAP_ARM_NISV_TO_USER`) are needed to decode MMIO syndromes with no ISV. There is a stage-2 cache-maintenance-on-read-only-page corner case; Hyperlight works around it (code comment in kvm/aarch64.rs).

## 4. macOS Hypervisor.framework

- **The header says** `hv_vm_create`: "Creates a VM instance for the current process"; `hv_vm_destroy`: "Destroys the VM instance associated with the current process", requires all vCPUs destroyed [hdr: hv_vm.h:28-42]. `HV_BUSY` exists in hv_error.h. No header text says a second create yields BUSY, but Hyperlight (and you) treat <= 1 as fact.
- **Not changed in macOS 15/26 headers I have (SDK 26.5).** New in 15: GIC API (`hv_gic_*`) and EL2 (nested virt) config. New in 26: `hv_vm_config` additions at line 113 [hdr]. None lifts the cap. A forum report of `HV_DENIED` on macOS 26 exists [web: search result, unverified detail].
- **`hv_vm_space_create`** (additional address space) is declared only in the Intel-era `hv.h` [hdr].
- **Map/unmap cost.** I found no published numbers [gap]. Hyperlight's design implies unmap+map plus a TLBI stub per switch is acceptable for them. Measure `hv_vm_map` on 16 KiB pages at your image size. Expect tens of us to low ms [est, low].
- **Remap-for-reset has pitfalls.** The IPA->host-VA relationship is established at map time, so changing host mappings underneath (MAP_FIXED over the same VA, or `madvise`) may leave stale stage-2 entries or pinned pages. Safer: unmap, replace host mapping, map again, TLBI. Hyperlight does exactly this.
- **Others.**
  - Virtualization.framework caps *macOS guests* at 2 (license-driven). Linux guests are not capped [web: eclecticlight.co/2022/08/04/...].
  - libkrun on macOS runs one VM per process (your finding). I found no source for how Tart or OrbStack structure processes [gap].
- **Concurrency caveat.** All vCPUs in a process share one stage-2 IPA space.
  - Two tenants running concurrently in one HVF process do *not* get a hardware address-space boundary. Only guest page tables separate them, and a compromised EL1 guest can edit those.
  - Hyperlight's answer is time-multiplexing, or a future nested-virt design.
  - **Recommendation for macOS:** keep N worker *processes* (one per core), each with one VM reused serially. This preserves the process isolation boundary and still amortizes `hv_vm_create`.

## 5. Prior art

| System | Headline | Note |
|---|---|---|
| Firecracker snapshots (Lambda SnapStart) | ~4 ms restore, ~10 ms full Linux | Brooker blog, author's estimate |
| REAP | 3.7x cold-start cut; vanilla restore 50 ms + 182 ms | cold disk, 8 MB working set [arxiv 2101.09355] |
| SEUSS | deploy < 10 ms vs 100s of ms; 51x throughput | unikernel snapshots, CoW page sharing [arxiv 1910.01558] |
| Catalyzer | "sub-millisecond" best case, gVisor `sfork` | author claim, not verified [ASPLOS'20] |
| FaaSnap | up to 3.5x over REAP; avg 3.5% slower than in-memory snapshot | [EuroSys'22] |
| Virtines/Wasp | KVM contexts reused from a pool, ~tens of us to ~100s of us creation | numbers in PDF not extractable: verify [arxiv 2104.11324] |
| Hyperlight | 1-2 ms/VM (claimed) | above |

Modal, CodeSandbox, Nanos, Unikraft and Lupine: I did not verify any figures, so I am omitting them.

## 6. Security

- **Shared CoW pages across tenants.**
  - Flush+Reload needs *shared physical pages* and `clflush`/cache-line flush, and it was demonstrated cross-VM on KVM/VMware with KSM/TPS [web: Yarom-Falkner; Irazoqui et al., IEEE S&P'15].
  - A read-only shared snapshot is exactly such a page set. Cross-tenant timing channels on **snapshot-resident** code/data are possible. What leaks is which snapshot lines the other tenant touched, i.e. access pattern of kernel/QuickJS init data, which is public. Per-tenant secrets live in CoW'd private pages, which are not shared once written. The risk is low *if the snapshot has no secrets* [est, medium].
  - Vendors disabled cross-VM dedup (KSM, TPS) because it merges private pages, which you do not do.
  - Mitigations: no secrets in the snapshot, per-process snapshot mappings (the page cache is still shared on one host), and arm64's lack of an unprivileged flush (EL0 `dc civac` is allowed if SCTLR.UCI is set, which is the guest's choice and not the attacker's) [est].
- **Reuse of VM object + reset vs fresh VM.**
  - Needs a complete reset: all GPRs, SIMD/SVE, system registers (TTBR, SCTLR, VBAR, timers, CNTVOFF), debug/PMU state, and any residual stage-2 or TLB state. Hyperlight needs an explicit TLBI for this reason.
  - Anything missed becomes cross-tenant leakage. The leakage is bounded when the reset is "restore a full register snapshot", so test with a canary guest.
  - Microarchitectural state (BTB, branch history, caches) is NOT reset by either approach. A fresh VM does not help here either.
  - Hyperlight even refuses the same-snapshot fast path out of caution (initialized.rs).
  - A failed or poisoned run must destroy the VM, not reuse it.
- **Uniqueness**: see section 2. Fresh entropy and time per run, and never reuse a snapshot's PRNG state.

## Expected numbers for the third option

| Metric | Linux/KVM | macOS/HVF (1 VM reused / process) | Confidence |
|---|---|---|---|
| Per-VM memory (dirty private pages + KVM/stage-2 + ring) | ~1-2 MiB (est. 0.5-1.5 MiB dirty + ~0.3 MiB overhead) | similar, ~1-2 MiB | medium |
| CPU per run, including a small QuickJS eval | ~1.5-4 ms | ~2-5 ms | low-medium |
| Restore latency (reset to ready) | ~0.3-1.5 ms (with fresh VM create ~1-3 ms) | ~0.3-1 ms for remap + vCPU reset (hv_vm_map cost unmeasured) | low-medium |
| vs today: memory 10.7 MiB, CPU ~14 ms, cold 25 ms | about 5-8x less memory, 4-7x less CPU | about the same | |

## Top 3 risks

1. **macOS isolation and throughput.** One VM per process means no concurrent isolation inside a process. Time-multiplexing or process pools cap concurrency at core count, and the remap-reset path is untested and stale stage-2/TLB bugs are subtle. Prototype `hv_vm_map` cost first.
2. **Incomplete state reset or uniqueness bugs** (registers, timers, PRNG, clock, or ring state), leaking across tenants. Mitigate with a canary-guest fuzz test and by injecting a fresh seed and time into every request.
3. **KVM edge cases without a GIC:** WFI parking with no wake source, NISV/MMIO decode, cache-maintenance faults on read-only snapshot pages, memslot-update SRCU stalls, and a hand-written VMM's long-tail bugs (no Firecracker/libkrun hardening). Keep the doorbell design identical to Hyperlight's, which is proven on this exact setup.

## Sources
Hyperlight code at /tmp/hl/hyperlight (github.com/hyperlight-dev/hyperlight); Firecracker docs (snapshot-support.md, random-for-clones.md); brooker.co.za/blog/2022/11/29/snapstart.html; arxiv 2101.09355, 2102.12892, 1910.01558, 2104.11324, 2606.24079; lkml.iu.edu/hypermail/linux/kernel/2602.1/07200.html; eclecticlight.co/2022/08/04/virtualisation-on-apple-silicon-macs-8-how-apple-limits-vms/; macOS SDK 26.5 Hypervisor.framework headers.
