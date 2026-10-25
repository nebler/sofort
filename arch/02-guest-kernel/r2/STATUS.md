# R2 kernel READY — final handoff

Stable kernel: `/tmp/jitk-02/r2/kernel.bin`
Native host: `/tmp/jitk-02/r2/host`
External-watchdog launcher: `/tmp/jitk-02/r2/launch`
SHA256: `3d64c3dd05494f879cb2ffbe6c520730d2e6d14baea9b75961688d7a69d510b8`

G1 PASS: native GICv3 IRQ33 + WFI, 1000/1000 exchanges, 0.00 CPU-s / 10.010s idle (0.01s measurement resolution). The fresh used-ring check after IAR/EOI fixes the early lost wakeup. Native WFI sleeps inside HVF; no userspace-channel patch or forced-userspace GIC required.

G2 PASS: n=30 x 64 concurrent calls, host waits for all calls and replies 64..1. Final contended window batch p50/p90/p99 29.387/102.535/265.234ms, median 2182 calls/s. Earlier window achieved 2.094/2.665/2.881ms and 30.6k calls/s; all load averages retained. Do not claim quiet-machine latency.

All isolated CNTV fallbacks pass 1000 exchanges: 50us 11.49% CPU, 200us 4.60%, 1000us 1.20%. Default indefinite wait is IRQ-only; finite ppoll uses CNTV. Bootargs require paired epoch_ns/counter for sub-ms host clock accuracy. REALTIME 30-sample worst error bound 0.963ms.

128MiB cumulative JS churn succeeds in 32MiB. Existing 9/9 isolation probes pass. EOF, partial reads, D8 forgery rejection, finite ppoll, memory cap and external watchdog pass. Guest kernel 1218 LOC; RAW 2924544 bytes. Final response/evidence: `../R2.md`; exact commands/protocol: `README.md`. All started VMs reaped.
