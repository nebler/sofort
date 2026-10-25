All latency numbers are host wall-clock observations on the shared M4 Pro,
macOS 26.6.1. Uptime load accompanies each JSON. No outlier exclusion, no quiet
machine claim. Parking CPU uses process cumulative CPU `ps time` before/after
10 seconds; 0.01 CPU-second resolution means a displayed zero is below roughly
0.1% of a core over that interval, not a claim of literally zero cycles.

`parking-0-final.json` and `integration-final.json` use the final kernel hash.
`timer-only-{50,200,1000}.json` also use that hash: positive tick skips all GIC
initialization and IAR/EOI so these are genuinely isolated timer fallback runs.
Earlier `parking-*.json` used timer+GIC together and cannot be used to infer
isolated timer RTT. `c-host-*` are retained as historical investigation evidence.

`integration.json` is an earlier 30-sample window before the timer-only mode
branch was isolated; default WFI behavior was the same. It achieved 342us
parked single-call median and 2.094ms/30.6k calls/s for 64 calls. The final-hash
window was substantially slower under changing contention. Report both; do not
select only the fastest window or infer a causal speed change from load average.

The sequential exchange RTT is from host run/ret send to next call (1000 calls,
consecutive IDs). Every 100 calls the host withholds a reply for 3ms to exercise
a genuinely parked wait. The separate single-call benchmark waits 5ms after
ready, then times run → call → ret → done. Promise64 waits for all 64 calls before
sending any reply, then answers IDs 64..1. Thus it cannot accidentally measure
serial tool calls or a pipe-only simulation.

Clock RTT midpoint comparisons in checks.json are only coarse interval checks.
clock-check.json is the stronger test: compare REALTIME−CNTVCT with host
REALTIME−mach counter, using bracketed samples and including Date.now's 1ms
quantization. No transport RTT enters that error bound.
