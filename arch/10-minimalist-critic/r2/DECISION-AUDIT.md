# D1–D14: minimalist red team

2026-10-24. These are proposed amendments, not edits to binding DECISIONS-R1.md.
KEEP means retain the architecture, not that its implementation/release gate passed.
All nine existing R1 proposals were read completely. `07-security-sandbox/PROPOSAL.md`
does not exist in this checkout; REVIEW-R1 also has no 07 section. Its available
`linux-confinement.md` was read for integration context; security work is not duplicated.

1. **D1 KEEP — 02's EL0/EL1 kernel.** R1 02 actually executes static qjs and
   passes 9 isolation probes; its user mapping/checking regions cost ~73 lines.
   R1 10's 51 live freestanding unresolved symbols make a fresh libc port a
   larger unknown than retaining the working kernel. Neither statistic proves
   complete correctness or that EL1-only Hyperlight is inherently unsafe.

2. **D2 CHANGE — retain build-time packing, complete its contract.** The R1
   packer produces a flat *virtual-address extent*, not a linked kernel RAW
   image or final physical mappings. Its manifest lacks AT_PHDR/PHENT/PHNUM,
   physical backing and reserved-range metadata. The kernel must still prepare
   musl startup state. New `audit-probes.json`: the packer accepts disjoint RX
   and RW byte segments sharing one 4-KiB page. Segment-only W^X is insufficient.
   Validate page permissions/overlaps/alignment, image bounds, entry, program
   header coverage and reserved arenas at build time. Generate physical page
   maps and auxv constants; make writable image pages RW/NX before EL0 entry,
   with no writable alias of RX pages. No runtime ELF parser is needed for a
   trusted fixed executable. Budget and measure separately: host RAW read/copy
   remains (06: ~665 us stripped); in-place guest mapping removes only the
   *second guest copy*. It does not implement fleet file-backed sharing (05).

3. **D3 KEEP — one native Rust VMM process per VM.** 01 and 05 establish HV_BUSY
   and libkrun `_exit`; 01's rlib launcher already exists. Comparing its R1
   6.731 ms to C's 6.809 ms does not establish a static-link speedup. Keep
   `panic=abort`, pre-build sandbox, one inout port, independent watchdog and
   completion-frame authority. Cut further linker optimization until controlled
   measurements justify it. Do not instantiate both 01's supervisor and 04's
   process manager: select one lifecycle owner; Rust should own VM setup only.

4. **D4 CHANGE — order alternatives and retain the blocker during tool waits.**
   Try proper GIC+WFI first; WFE's one-reply failure does not prove WFI fails.
   Timer-only fallback must be measured with virtio IRQ disabled; otherwise
   its success does not identify the wake mechanism. Measure finite ppoll with
   zero ready FDs, NULL/infinite timeout, EOF, and RX arriving around sleep.
   C (preloaded process, build on demand) removes pre-request guest parking,
   but *does not fix spinning while awaiting a slow tool response*. It also
   needs a safe pre-build GO wait after sandboxing: build starts vCPUs (01).
   Pool admission requires <2% idle core AND 1000 stall-free exchanges in the
   actual qjs/ppoll stack, not only bare echo. Bound aggregate parked+waiting
   CPU too: 1000 VMs at 1.7% consume 17 cores. This is arithmetic, not a fleet
   measurement. See the live R2 snapshot note below; no extra GIC fork is justified yet.

5. **D5 CHANGE — 32 MiB is a target pending a new physical layout.** New
   `audit-probes.json` derives 02's stack end PA=0x82c00000, beyond 32-MiB
   RAM's end 0x82000000; full old user mapping reaches 0x83000000. Merely
   lowering the launcher RAM flag cannot work. Generate a compact layout,
   validate every arena/FDT/stack/queue bound, then run peak/churn/fragmentation
   cases. 06's >128-MiB cumulative mmap with ~2.2-MiB live peak proves real
   reuse is necessary. Reuse must also zero recycled pages and maintain
   permissions/accounting. A qjs heap cap is not total guest or host memory.

6. **D6 CHANGE — pass a time/counter calibration pair.** Epoch alone cannot
   be added to the raw uptime counter; subtract a defined counter origin.
   Capturing the origin only at guest entry loses build/boot time. Define the
   counter timebase/frequency and a bounded calibration error; 02 R1 measured
   Date.now wrong by an epoch. Pass both host epoch and a compatible counter
   sample, test REALTIME vs host brackets and MONOTONIC progression separately.
   Keep fresh per-VM AT_RANDOM. A one-time seed is not an infinite entropy
   device if SQLite's optional random/time profile is added.

7. **D7 KEEP — FDT discovery, control queues, EOF, partial reads.** 01 shows
   four queues even with one port; 02 R1 omitted control drain/repost and EOF.
   Readv must support immutable-file FDs for the Lua demo, not only fd0. Add
   backpressure/control saturation tests; ring size 8 and a 1-KiB bounce buffer
   do not establish 64-call transport correctness. No new port is necessary.

8. **D8 CHANGE — reserved prefix needs record-boundary rules.** Blocking 0x1E
   from EL0 establishes provenance only against uncompromised EL0. Diagnostics
   inserted between fragments of a guest JSON line still corrupt that line.
   Scan *all* iovecs before emission; defer diagnostics until a complete line
   or terminate without a diagnostic. Bound/escape fd2 dev payloads. Kernel
   records must never invoke tools or prove successful completion. The current
   `03-channel-protocol/PROTOCOL-v1.md` now explicitly specifies these repairs;
   preserve them in integration. Ordinary Lua output can contain tabs/UTF-8
   and SQLite output need not be an envelope: D14 needs an image-selected
   bounded output-capture mode, not relaxed parsing of the production channel.

9. **D9 KEEP — TypeScript as the only authoritative host dispatcher.** One
   trusted process avoids native bridge/second schema and copy overhead. But
   "same TCB" does not imply duplicate rejection, depth/byte limits or schema
   parity. 03's Rust tests establish requirements; 04's R1 `codec.mjs` uses
   JSON.parse with a binary reviver, loses duplicate keys and implements a
   conflicting wire codec. Port the adversarial corpus and use bounded lexical
   checks before JSON.parse, including escaped duplicate keys and surrogate
   keys/values. Decode once, freeze the validated snapshot, use own-property
   registries. A scanner is useful even with one authoritative JSON decoder.
   Externally enforce deadlines if trusted tool callbacks can block Node's loop.

10. **D10 KEEP — one v1 spec, with explicit compatibility exclusions.** 03/04/09
    R1 frame names, IDs, args and result shapes conflict; wire tests must use
    D10 exactly. Preserve 64 concurrent calls and variadic args; withdraw 10's
    one-outstanding-call suggestion (03 measured reverse-order 64-call success).
    R1 04 also promises provider preludes and automatic binary envelopes;
    current v1 deliberately excludes both. Either implement trusted prelude
    injection within the adapter's source budget or reject nonempty preludes
    explicitly; do not claim complete Cloudflare compatibility. Binary values
    require an explicit application codec; undefined maps to null. Standardize
    code limits in encoded bytes versus decoded units; R1 differs by 4x.

11. **D11 KEEP — tiny Backend/Sandbox interface, no backend framework.** I
    withdraw the blanket abstraction objection: 04's four operations suffice
    for real/development fixtures and a fair comparison. Keep its existing
    `exited` promise: `kill():void` alone cannot release capacity after reap.
    Contract: park resolves only after validated ready(v=1); send is bounded,
    ordered and backpressure-aware; kill is idempotent; failure aborts pending
    reads/writes and eventually settles exited. Do not keep the R1 CLI guess
    (`--channel stdio --memory-mib`) after 01 supplies the actual launch API.
    Put only jitk in the production factory; local qjs is explicitly unsafe,
    Hyperlight remains an external benchmark adapter. One lifecycle owner (D3).

12. **D12 KEEP — capped pristine single-use pool, gated by D4.** Refill_p99
    includes process/signature/image/boot/ready and creation contention, not
    hv_vm_create alone. Count STARTING/READY/RUNNING/REAPING and failed boots;
    reserve creation capacity below 05's observed Mac HVF ceiling. Little's
    law includes tool waits. Pool-hit latency alone cannot show sustainable
    replacement throughput. Use measured bursts, not a fixed 64-slot minimum.

13. **D13 KEEP — separate security owner and mandatory integration gate.** 01's
    Seatbelt/HVF denial probes establish compatibility; 07's Linux document
    explicitly marks KVM confinement unverified and calls for a pre-resume
    thread/filter barrier. No production Linux readiness claim follows from
    Docker's native syscall oracle. Preserve panic=abort/watchdog/one-port.
    No additional security implementation is proposed in this review.

14. **D14 CHANGE — a bounded ABI-growth demo, not arbitrary-runtime support.**
    New n=30/binary native oracle measurements find Lua 14 guest names (+2 vs
    jitk's 17); SQLite aggregate query 13 (+3). See EXPERIMENTS.md for exact
    sets, hidden clocks and richer-query results. Both expose new argument
    domains even when a name exists: immutable file FDs, signal setup,
    memory guards and argv/auxv. Signal-ENOSYS and guard-denial experiments
    distinguish application fallback from strict conformance. Choose Lua's
    file-processing fixture first; budget 200–350 incremental kernel LOC
    (UNVERIFIED, including profile/file/memory plumbing), no host filesystem,
    actual signal delivery, threads or DB persistence. A real-kernel grow
    transaction must fail before, add a measured semantic contract, pass
    differential/bounds cases and run unchanged static Lua after. It is not
    established by Linux strace, and Hyperlight's Linux-ABI incompatibility is
    not a lower bound on its ability to embed a Lua/SQLite library. The honest
    differentiator is reuse of an unchanged static Linux binary and a tested
    growth contract, not exclusive access to another language/database.

## Live R2 evidence observed, not independently reproduced

At ~02:29 local, 01's `r2/PARKING.md` reports native GIC+WFI bare echo
1000/1000, ~0 idle CPU, RTT p50/p90/p99 0.1518/1.9717/7.7375 ms at load
18.93/18.71/18.15. The timer-labelled bare test still had IRQ enabled.
02's `r2/STATUS.md` reports full qjs timer(1 ms) 1.70% core/10 s and
1000/1000 exchanges, but IRQ-only stalls. These are different paths, not a
contradiction to erase by declaring parking universally solved. Both notes
are live/provisional: require final G1/G2/G3 receipts on the integrated image.
02's R2 source snapshot counted 1194 physical guest lines; this is not a
complete tested release or a reason to add an unrelated VMM/GIC patch.

## Components the lead must cut or assign once

Cut duplicate TS lifecycle managers (01 vs 04), a daemon/SEQPACKET API (05),
authoritative Rust plus TS decoders (03 vs 04), source bytecode work (03/06),
and a second product Hyperlight backend (09) from v0. Keep the Hyperlight
snapshot baseline, real async v1 bootstrap, finite ppoll deadlines, honest
memory reuse, packer/startup ABI and one owner for image/CLI/protocol contracts.
These required pieces, plus 08's 600–900 LOC controller, make whole-product
"1.5k LOC" untenable; that figure is a guest budget, not a total-system claim.
