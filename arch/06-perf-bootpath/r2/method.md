Measurement notes (live)

- All host spans use Darwin CLOCK_MONOTONIC_RAW ns (also Node hrtime.bigint()).
  01 prints mach_absolute_time ticks; Python reads mach_timebase_info (125/3)
  and samples the absolute clock immediately after the RAW start boundary.
  Node bridges RAW-to-absolute clock origins using control.c's paired reads.
  No comparison uses JS Date or floating point absolute timestamps.
- Guest CNTVCT at 24 MHz: kernel entry captured in _start before BSS zeroing;
  MMU-on after init returns; EL0-entry immediately before eret; first syscall
  on trap entry; first-statement marker when first JS stdout reaches syscall;
  READY when the stdout byte stream contains its JSON prefix. All are buffered
  and emitted at shutdown, with no per-stamp console writes. Guest durations
  use CNTFRQ. Host and guest absolute offsets are not assumed equal.
- FIRST is the first statement's observable syscall, not instruction-level
  JS execution entry. It includes stdio and interpreter dispatch. qjs is an
  unmodified stripped static musl Bellard ELF. The r1 script is deliberately
  synchronous because r1 lacks ppoll; it is not protocol-v1 async bootstrap.
- Host instrumented library is the private r1 libkrun copy, with first-vCPU-only
  buffered instrumentation and panic=abort. Kernel source is a private copy;
  02's source is untouched. Cold VM is fresh process + VM with warm file cache.
- One inout console, 1 vCPU, 64 MiB for r1 (its mappings require the range).
  Deny-default sandbox applied before build; external 10s watchdog. Result is
  asserted from stdout, never exit code alone. Every child exits/is reaped or
  is killed/reaped in finally. No system/other-agent processes are terminated.
- main->build includes argument setup, console/payload builder setup, sandbox
  application, and (for C) WAIT_GO. Guest execution starts before build returns;
  build-to-first-vCPU is the nonoverlapping launch boundary. Phase medians do
  not sum to median end-to-end. Result receipt is host-observed; host exit mark
  is buffered immediately before libkrun's _exit. Reap is waitpid completion.
- n=100 per case, median and nearest-rank p90/p99. p99 at n=100 is sorted index
  98 (the second-largest); no percentile interpolation except even median.
  First observed samples are retained separately, not hidden as warmups.
- Sequential randomized/interleaved controls; the machine is shared. An
  unrelated large process fanout made 1-minute load exceed 100 during controls.
  Raw uptime at start/end and intermediate log readings are retained. No idle
  host assumption, cache purge, OS reconfiguration, or Linux KVM claim.

Final r2 additions:
- Stable READY kernel copied only after marker appeared; original hash retained.
- Final host/guest phase table uses a private reflink of 01's working FFI=0
  static libkrun build, first-vCPU trace only, deferred dump at _exit.
- Timer B skips GIC init and ICC ack (its own private benchmark branch), arms
  CNTV at 1ms. It is not native IRQ WFI plus a timer.
- The unmodified final VMM and untouched READY image are separate exact rows.
- All 800 clock brackets have a nonempty constant-origin intersection, bounding
  RAW/absolute origin to ±2.541us. See refine-clocks.py; original brackets remain.
- Final Node clock bridge offset lies inside the interval; minimum measurable
  guest wake stamp is RX-ready observation in ppoll, not just WFI return.
