# D4 — definitive host result

**Use native HvfGicV3 + fully initialized GIC + WFI. It passes on macOS 26.6.1
(25G76); no production libkrun patch is needed.** This file was published early
and updated as source hypotheses were replaced by runtime evidence.

## Which GIC, and why the channel concern does not break native WFI

The private diagnostic build explicitly prints `JITK_GIC hvf`: the native
HvfGicV3 constructor succeeds. Its FDT distributor is 0x09fd0000 (64 KiB),
redistributor 0x09fe0000 (128 KiB). The one-CPU userspace implementation instead
uses redistributor 0x09fb0000. Both constructor and FDT identify the native path.

Host RX trace in the supplied a1d8616 source:

1. console/process_rx.rs reads stdin into the guest RX descriptor and calls
   queue.add_used. On exhausting available descriptors, pop_head_blocking calls
   interrupt.signal_used_queue; WouldBlock/EOF also signal. It then parks/waits.
2. InterruptTransport's MMIO interrupt sets the used-buffer interrupt status
   and calls the configured interrupt controller set_irq for console INTID 33.
3. HvfGicV3::set_irq calls `hv_gic_set_spi(33, true)`. It does **not** touch
   VcpuList pending_irqs or signal a crossbeam WFE channel.
4. Nevertheless, native WFI makes **zero calls to vstate::wait_for_event** in
   the measured idle + 1000-exchange run. Sleep/wake remains inside Apple's
   hv_vcpu_run/native-GIC path; the SPI wakes that vCPU there. This last internal
   ownership is inferred from zero userspace wait entries, native constructor
   success, near-zero CPU, and successful wakeups; Apple internals are not traced.

The alternate path is also proved, not merely source-read:

- diagnostic-gic.patch allows a private JITK_USERSPACE_GIC constructor override.
- Userspace GicV3::set_irq routes via gicd_irouter[irq] to
  VcpuList::set_irq_common. The per-vCPU mutex protects the pending IRQ queue and
  Running/Waiting state. Waiting sends wfe_sender; Running requests vCPU exit.
- vstate::wait_for_event calls should_wait under that same state discipline,
  then selects wfe_receiver/event_receiver/deadline. A queued IRQ prevents sleep;
  an IRQ racing the wait sends the channel. The forced path logged **1462** wait
  entries while completing **1000/1000** exchanges.

Thus the statement “native set_irq cannot wake libkrun's channel” is true, but
“therefore native WFI cannot park” is false on this macOS version. The channel
path matters for the userspace GIC. No assumption about a guest already blocked
in that channel is needed for the native WFI result.

## Tiny guest and measurements

parking-guest.c + start.S: full GIC distributor/redistributor/ICC initialization,
route SPI33 to CPU0, edge trigger (libkrun asserts true without deasserting),
IRQ exceptions masked, IAR/EOI consumed explicitly, CNTV disabled for native WFI,
used-ring recheck before sleep, control RX drain/repost. Exactly one console port.
The host waits 5 seconds while idle, then sends one byte at a time with a 1 ms
pause before each send, checks the echo, and reaps after 1000 exchanges.
These are transport echoes, **not JS tool→result latency**.

Final raw samples are parking-static-trace-*.json. CPU is proc_pidinfo task
user+system mach ticks converted using mach_timebase_info (125/3 ns per tick),
divided by elapsed wall time. cpu-unit-calibration.json compares it with wait4
rusage; an earlier tick-as-ns reporting mistake was corrected in retained files.

- Native GIC + WFI: **1000/1000**, idle **0.000100%** core over 5.004 s;
  echo p50/p90/p99 **0.144/0.669/5.031 ms**.
  Uptime load **27.22/21.10/19.11**. **PASS** <2%.
- Forced userspace GIC + WFI: **1000/1000**, idle **0.000225%** over 5.009 s;
  **0.057/0.117/0.702 ms**; load **25.71/20.98/19.09**. **PASS**.
- Isolated 1 ms CNTV fallback (guest does not initialize GIC): **1000/1000**,
  idle **0.494%** over 5.010 s; **2.014/16.195/106.948 ms**;
  load **101.87/44.64/28.17**. **PASS** CPU, severely contended latency.
- Native GIC + WFE: **1000/1000**, idle **3.190%** over 5.012 s;
  **10.277/98.281/195.099 ms**; load **50.69/27.29/21.45**. **FAIL** CPU gate.
  WFE is not an acceptable substitute for WFI on this host.

Different windows/load preclude a causal ranking of native versus userspace
latency. Native WFI needs no fork and passes the gate. Timer/WFE preliminary
labels accidentally selected only PARK due to zsh argument splitting; the final
POSIX build-guests.sh passes each define separately. The preliminary baseline
“timer” JSON is explicitly marked invalid as timer evidence.

## Area 02 / 04 integration

Use WFI after GIC initialization, consume IAR/EOI, configure the actual FDT IRQ,
and keep the descriptor-check-before-sleep race closed. Native SPI is asserted
true-only: the tested guest configures it as edge triggered. Use timer deadline
for finite ppoll timeouts; indefinite idle should use native WFI without a tick.

CLI final bootargs contain seed, epoch_ns and paired `jitk.counter` host ticks.
02's r2 reader supports the latter: REALTIME includes the counter delta across
--wait-go, rather than freezing at worker preparation. Seed hex is lowercase.

Option C is available in the CLI: sandboxed WAIT_GO worker has no VM/vCPU until
release, idle CPU measured **0%** over 5.004 s. go-results.json contains n=100
bare and n=100 r1-qjs data. R1 qjs needs **64 MiB** because its old physical
mapping places its stack above 32 MiB; packed r2 is the 32 MiB target.

Linux/KVM parking and full JS G1 result remain outside this host proof.
