# Tool-call transport census and ring ABI v2

The current small-call path serializes six times and invokes JSON parsing
nineteen times: eight full values plus eleven object-key tokens. Ten concurrent
calls batch some stream deliveries but still issue ten console TX notifications;
a 64 KiB reply requires 65 console RX chunks. A byte ring removes this device
protocol, but a separate Node policy process still needs bounded IPC, ownership
checks and wakeups. **≤30 µs is a proposed allocation, not a measured result.**

## Method, environment, scope

Frozen source is `58ab4435ebd450db9754b2b1ece39789805b94b5`; snapshots came from
`git archive HEAD` before executor changes. All executable instrumentation and
builds are under `/tmp/sofort-a4/`. Working-tree writes are only this report
subtree. No commit was made. The clean guest rebuilt byte-identically to
`6c00a278cff95058241967655810dcf0cc9cfa1158a38630d818f26c3b07cbc6`.
The private libkrun source uses pinned upstream `a1d8616765da03980f3be1bb8714bfdd3842f33c`
plus the five HEAD patches, **including raw-direct-load.diff**. The older
`/tmp/jitk-01/r3` cache supplied build dependencies; it was not modified.

Machine: Apple M4 Pro, 12 cores, 24 GiB, macOS/HVF. Node 24.22.1 is
`/tmp/jitk-09/node-real`; Rust 1.95.0. Every timing run was wrapped in
`/usr/bin/lockf -k /tmp/sofort-bench.lock`; each result records uptime/load before
and after. The lock serializes collaborating experiments, not unrelated host
load. These are **contended Mac wall-clock measurements**, not Linux metal
numbers or quiet-machine latency claims. No nested-KVM timing is used.

A tool round starts before the guest compatibility adapter serializes arguments
and ends after that adapter decodes the reply. It excludes VM boot, READY/RUN,
source normalization and prelude parsing, DONE, teardown and refill. Fixtures:
`api.echo('x')`, `Promise.all(10 × api.echo('x'))`, and a provider returning
65,536 ASCII `x` characters. The guest returns the result length, keeping DONE
small. The real HEAD executor, dispatcher and policy invoke immediate async
providers; no network/provider service time is included. Thirty-one measured
samples follow three warmups, except the sequential-100 cross-check (11 samples)
and component inner loops, whose exact iteration counts are in raw JSON.

Instrumentation:

* Guest counter increments at the EL0 trap, console memcpy/MMIO sites and
  WFI/park sites. Consumed stderr BEGIN/END markers delimit the interval;
  marker write/writev syscalls are excluded. The END marker's HVF return is
  subtracted from `hv_vcpu_run` counts. Counter dumps happen after the interval.
* libkrun/HVF atomics count exits, actual GIC SPI injection calls, console
  notifications, worker park returns, queue-event callbacks, read attempts,
  successful bytes and poll returns. IRQ requests are **not** VM exits.
* A Darwin `__interpose` library counts actual calls to `read`, `write`,
  `readv`, `writev`, `poll`, `kevent`, `kevent64`; a N-API `uv_prepare` watcher
  counts real Node loop turns. Node `process.hrtime.bigint()` probes delimit
  frame feed, policy, provider and reply encoding/write completion. JSON calls,
  structured clones and text conversions are counted, not inferred from timing.
* Physical engine-internal string memcpy/allocation counts are not observable
  from these probes. The copy census below distinguishes measured byte-copy
  sites and string materializations from opaque engine behavior. Similarly,
  selected POSIX syscall families are exact, but pthread/Mach traps and
  Hypervisor.framework internals are not a full kernel syscall trace. DTrace
  reports `DTrace requires additional privileges`; no all-syscall total is
  invented. HV entry calls are separately counted.

The baseline disables detailed Node/guest counter wrappers and reads `os.now()`
around the guest tool expression (two clock reads per sample). It uses the
clean image and a private copy of a2-cpu's independently rebuilt current VMM;
its hash is in the manifest. Detailed-probe timings are reported separately;
never subtract their medians to claim a precise instrumentation tax.

## Current tool-round timings

All times are µs. Transport samples are individual rounds; component percentiles
are percentiles of batch means. Empirical p99 with n=31 is the largest sample,
not a tail-latency guarantee.

| Case | n | baseline p50 | baseline p99 | probes p50 | probes p99 |
|---|---|---|---|---|---|
| one | 31 | 611.33 | 2549.79 | 1121.21 | 8052.46 |
| parallel10 | 31 | 2881.33 | 24219.13 | 2805.17 | 15054.67 |
| result64k | 31 | 16184.83 | 32706.21 | 18797.08 | 57697.12 |

Sequential 100-call cross-check: n=11 sessions ×100 awaited calls, per-call
mean p50 **514.18 µs**, range 283.50–830.40 µs.
This amortizes one guest timing pair, not call serialization or policy.

| Run | Load before | Load after |
|---|---|---|
| baseline | 8:24  up 1 day, 10:38, 2 users, load averages: 26.57 26.68 30.15 | 8:24  up 1 day, 10:38, 2 users, load averages: 26.57 26.68 30.15 |
| census | 8:24  up 1 day, 10:38, 2 users, load averages: 27.58 26.88 30.26 | 8:24  up 1 day, 10:38, 2 users, load averages: 26.97 26.76 30.19 |
| sequential100 | 8:24  up 1 day, 10:38, 2 users, load averages: 26.57 26.68 30.15 | 8:24  up 1 day, 10:38, 2 users, load averages: 25.33 26.42 30.03 |

## Counts per call / per ten-call batch

Counts below are medians with observed min–max, n=31 per column. Concurrent
completion, RX coalescing and scheduling legitimately vary counts.

| Metric | one | Promise.all(10) | 64 KiB result |
|---|---|---|---|
| guest total syscalls | 6 (6–6) | 19 (17–25) | 692 (692–692) |
| guest read / ppoll | 1 (1–1) / 1 (1–1) | 3 (2–6) / 3 (2–6) | 65 (65–65) / 65 (65–65) |
| guest writev(66) | 1 (1–1) | 10 (10–10) | 1 (1–1) |
| guest mmap(222) | 2 (2–2) | 2 (2–2) | 282 (282–282) |
| guest munmap(215) | 1 (1–1) | 1 (1–1) | 279 (279–279) |
| guest console TX copies/chunks | 1 (1–1) | 10 (10–10) | 1 (1–1) |
| guest console RX copies/chunks | 1 (1–1) | 3 (2–6) | 65 (65–65) |
| TX / RX wire bytes | 56 (56–56) / 28 (28–28) | 561 (561–561) / 281 (281–281) | 54 (54–54) / 65563 (65563–65563) |
| MMIO write exits | 4 (4–4) | 17 (14–27) | 140 (134–164) |
| MMIO read exits | 4 (4–4) | 10 (6–30) | 184 (146–252) |
| all actual HV returns, marker excluded | 8 (8–8) | 28 (20–57) | 323 (281–411) |
| guest WFI instructions | 1 (1–1) | 2 (0–9) | 23 (5–59) |
| WFX / canceled / vtimer exits | 0 (0–0) / 0 (0–0) / 0 (0–0) | 0 (0–0) / 0 (0–0) / 0 (0–0) | 0 (0–0) / 0 (0–0) / 0 (0–0) |
| actual HVF GIC SPI injection requests | 4 (3–6) | 26 (23–35) | 133 (131–133) |
| console TX worker park returns | 1 (1–1) | 10 (10–10) | 1 (1–1) |
| console RX worker park returns | 0 (0–1) | 2 (1–6) | 65 (64–65) |
| console poll returns | 1 (1–1) | 1 (1–4) | 1 (1–1) |
| console event-manager callbacks | 2 (1–3) | 13 (11–16) | 66 (65–66) |
| Node loop turns spanned | 1 (1–1) | 6 (2–10) | 2 (1–3) |

### Host stream and notification syscalls

VMM counts include Darwin’s **pipe-backed eventfd** notifications. Node’s
first call-delivery read precedes its callback probe; one initiating read is
added explicitly. Counts otherwise cover the stated probe interval. Polls
already sleeping at BEGIN can return inside it without an in-window entry.
Node child stdio uses libuv stream plumbing; the separate pipe microbenchmark
uses actual `pipe()` descriptors.

| Measured syscall family | one | Promise.all(10) | 64 KiB result |
|---|---|---|---|
| VMM console input read attempts | 2 (2–3) | 7 (4–15) | 67 (66–67) |
| VMM console input successful reads | 1 (1–1) | 3 (2–6) | 65 (65–65) |
| VMM console output write attempts | 1 (1–1) | 10 (10–10) | 1 (1–1) |
| VMM all read attempts (incl eventfd) | 4 (3–6) | 19 (15–31) | 133 (131–133) |
| VMM all write attempts (incl eventfd) | 3 (3–3) | 23 (22–26) | 67 (67–67) |
| VMM poll entries / returns | 0 (0–1) / 1 (1–1) | 1 (0–4) / 1 (1–4) | 1 (0–1) / 1 (1–1) |
| VMM kevent entries | 1 (1–2) | 13 (11–16) | 66 (65–66) |
| VMM selected POSIX syscall entries total | 9 (7–12) | 55 (48–76) | 267 (263–267) |
| Node read attempts (+initial call read) | 1 (1–1) | 6 (2–10) | 1 (1–1) |
| Node write/writev attempts | 1 (1–1) | 10 (10–10) | 3 (2–3) |
| Node kevent/kevent64 entries | 0 (0–0) | 6 (1–15) | 2 (0–4) |
| Node selected entries (+initial read) | 2 (2–2) | 23 (13–35) | 6 (3–8) |

### JSON and data movement

| Operation | one | Promise.all(10) | 64 KiB result |
|---|---|---|---|
| Guest JSON encode / full decode | 3 / 3 | 30 / 30 | 3 / 3 |
| Host JSON encode | 3 (3–3) | 38 (30–46) | 3 (3–3) |
| Host all JSON.parse calls | 16 (16–16) | 160 (160–160) | 16 (16–16) |
| Host true envelope-key JSON decodes (source cross-check) | 11 | 110 | 11 |
| Host structuredClone calls | 2 (2–2) | 20 (20–20) | 2 (2–2) |
| Host TextEncoder calls / bytes | 1 (1–1) / 28 (28–28) | 10 (10–10) / 281 (281–281) | 1 (1–1) / 65563 (65563–65563) |
| Host TextDecoder calls / characters | 2 (2–2) / 82 (82–82) | 20 (20–20) / 822 (822–822) | 2 (2–2) / 65615 (65615–65615) |

Guest JSON counters are from the separately retained n=31 JS-counter run
(`transport-node-syscalls.json`), cross-checked against HEAD source. Final syscall
census embeds the **exact unmodified HEAD bootstrap**: wrapping the 1 KiB
`String.fromCharCode(...bytes)` with another rest/spread function itself adds
allocator syscalls, so that observer was removed from the authoritative census.
The supplemental “key decode” token classifier also counts the scalar `"x"`
result: 12 string-token parses means 11 keys plus one scalar, not 12 keys.

## Isolated component microbenchmarks

### QuickJS in the clean HVF guest

| Shape | Operation | samples | iterations/sample | p50 µs | p99 µs |
|---|---|---|---|---|---|
| call | json_encode | 31 | 20000 | 3.171 | 7.564 |
| call | json_decode | 31 | 20000 | 2.411 | 5.584 |
| call | ascii_replace | 31 | 20000 | 2.537 | 6.685 |
| call | ascii_encode | 31 | 20000 | 5.806 | 15.682 |
| reply | json_encode | 31 | 20000 | 1.408 | 3.973 |
| reply | json_decode | 31 | 20000 | 1.041 | 11.588 |
| reply | ascii_replace | 31 | 20000 | 1.726 | 5.662 |
| reply | ascii_encode | 31 | 20000 | 4.461 | 13.244 |
| reply64k | json_encode | 31 | 50 | 506.227 | 2866.797 |
| reply64k | json_decode | 31 | 50 | 416.829 | 3032.089 |
| reply64k | ascii_replace | 31 | 50 | 1349.505 | 2940.708 |
| reply64k | ascii_encode | 31 | 50 | 3007.928 | 7173.113 |
| replyUnicode | json_encode | 31 | 1000 | 6.166 | 100.690 |
| replyUnicode | json_decode | 31 | 1000 | 10.744 | 138.186 |
| replyUnicode | ascii_replace | 31 | 1000 | 454.889 | 1692.902 |
| replyUnicode | ascii_encode | 31 | 1000 | 159.345 | 556.489 |

Load: `8:01  up 1 day, 10:15, 2 users, load averages: 42.74 36.69 23.20` → `8:02  up 1 day, 10:16, 2 users, load averages: 36.78 36.16 23.92`.

### Node dispatcher and codec

| Shape | Operation | samples | iterations/sample | p50 µs | p99 µs |
|---|---|---|---|---|---|
| call | json_encode | 31 | 10000 | 0.444 | 13.924 |
| call | json_decode | 31 | 10000 | 1.012 | 9.222 |
| call | ascii_replace | 31 | 10000 | 0.146 | 2.280 |
| call | parseFrame | 31 | 10000 | 4.038 | 9.594 |
| call | parseFrame_schema | 31 | 10000 | 4.167 | 10.440 |
| call | encode_validated | 31 | 10000 | 6.598 | 18.544 |
| call | codec_args_roundtrip | 31 | 10000 | 1.309 | 5.168 |
| reply | json_encode | 31 | 10000 | 0.247 | 3.770 |
| reply | json_decode | 31 | 10000 | 0.369 | 4.532 |
| reply | ascii_replace | 31 | 10000 | 0.087 | 0.527 |
| reply | parseFrame | 31 | 10000 | 1.303 | 4.902 |
| reply | parseFrame_schema | 31 | 10000 | 1.270 | 7.134 |
| reply | encode_validated | 31 | 10000 | 3.515 | 14.872 |
| reply | codec_reply_roundtrip | 31 | 10000 | 0.928 | 3.444 |
| reply64k | json_encode | 31 | 100 | 95.701 | 699.729 |
| reply64k | json_decode | 31 | 100 | 64.968 | 1412.616 |
| reply64k | ascii_replace | 31 | 100 | 71.154 | 822.810 |
| reply64k | parseFrame | 31 | 100 | 667.260 | 1575.340 |
| reply64k | parseFrame_schema | 31 | 100 | 1267.019 | 2590.234 |
| reply64k | encode_validated | 31 | 100 | 1297.290 | 3719.925 |
| reply64k | codec_reply_roundtrip | 31 | 100 | 161.097 | 2102.168 |
| one | dispatcher_feed_send_batch | 31 | 500 | 13.972 | 164.781 |
| parallel10 | dispatcher_feed_send_batch | 31 | 500 | 123.812 | 415.227 |
| result64k | dispatcher_feed_send_batch | 31 | 50 | 3148.192 | 7030.077 |

Load: `7:58  up 1 day, 10:12, 2 users, load averages: 42.40 32.91 18.94` → `7:59  up 1 day, 10:12, 2 users, load averages: 39.73 33.29 19.64`.

### Node policy, no credentials/network

| Shape | Operation | samples | iterations/sample | p50 µs | p99 µs |
|---|---|---|---|---|---|
| decide |  | 31 | 2000 | 2.734 | 10.805 |
| decide_dispatch |  | 31 | 2000 | 7.382 | 41.404 |
| executor_policy_path |  | 31 | 2000 | 17.571 | 47.406 |

`executor_policy_path` includes argument codec round-trip, both clones,
freeze and async policy callback, decide/dispatch, and result codec. Run creation
is outside the measured interval. The microbenchmark omits the abort signal to
avoid accumulating listeners across 2,000 repeated calls; actual census calls
use the real signal, deadlines and policy path.

Load: `8:01  up 1 day, 10:15, 2 users, load averages: 42.74 36.69 23.20` → `8:01  up 1 day, 10:15, 2 users, load averages: 42.74 36.69 23.20`.

### Persistent fork child, two anonymous pipes

| Shape | Operation | samples | iterations/sample | p50 µs | p99 µs |
|---|---|---|---|---|---|
| 0 |  | 31 | 1000 | 44.599 | 128.324 |
| 1 |  | 31 | 1000 | 92.479 | 247.879 |
| 2 |  | 31 | 100 | 139.839 | 309.132 |

Scenario 0: one 61-byte request, 27-byte reply; 1: ten such calls
per batch; 2: one 61-byte request, 65,564-byte reply. Requests use 61 bytes
as a nearby fixed-size transport fixture; real census frames are 56/28 bytes
(or 54/65,563 for bulk). Batch RTT is not divided by ten in this table.

## Instrumented Node stages for one call

These are wall times from the same process clock with detailed probes active.
They explain the trace; they are not bare implementation CPU costs. Individual
medians do not sum to a median total.

| Stage | n | p50 µs | p99 µs |
|---|---|---|---|
| frame feed + validation | 31 | 48.71 | 104.04 |
| policy decide + argument conversion | 31 | 50.71 | 219.38 |
| freeze + policy callback | 31 | 20.21 | 119.67 |
| policy dispatch + immediate provider | 31 | 42.12 | 2086.58 |
| result conversion + writer scheduling | 31 | 9.29 | 133.25 |
| reply encode + repeated validation | 31 | 30.83 | 216.54 |
| stream write + completion callback | 31 | 24.17 | 327.71 |

## Copy census: measured sites versus opaque engine copies

A “string copy” is not a single stable counter in either engine: ASCII regex
replace can return the input, V8 can retain ropes/slices/interned keys, and
QuickJS has its own ownership rules. The following counts are concrete
source-level copy or materialization operations, rather than invented physical
allocation counts. They exclude engine-internal parse/stringify copies.

| Copy/materialization site | one | ten-call batch | 64 KiB result |
|---|---:|---:|---:|
| Guest console TX memcpy operations / bytes | 1 / 56 | 10 / 561 | 1 / 54 |
| Guest console RX memcpy operations / bytes | 1 / 28 | 3 median / 281 | 65 / 65,563 |
| Node dispatcher per-byte accumulation / bytes | 1 frame / 55 | 10 frames / 551 | 1 frame / 53 |
| Node UTF-8→string decodes / total characters | 2 / 82 | 20 / 822 | 2 / 65,615 |
| Node string→UTF-8 encode operations / bytes | 1 / 28 | 10 / 281 | 1 / 65,563 |
| Guest input `String.fromCharCode` materializations / characters | 1 / 27 | 10 / 271 | 65 / 65,562 |
| Frame + LF string concatenations, both sides | 2 | 20 | 2 |
| Guest + host JSON stringify operations | 6 | 68 median (60–76) | 6 |
| Full-value JSON parse operations, both sides | 8 | 80 | 8 |
| Extra host object-key JSON parse operations | 11 | 110 | 11 |
| Host argument object-graph clones | 2 | 20 | 2 |

The first six rows amount to **7 / 63 median / 135** logical copy or string
materialization operations, moving at least **276 / 2,767 / 262,410** bytes or
ASCII characters at those sites. Per-byte accumulation is one logical pass per
frame, not one “copy” per byte. Additional payload movement through the two
kernel stream buffers in both directions is four user/kernel crossings for a
small round; physical kernel memcpy counts are not measured here. QuickJS stdio
buffering/C-string conversion, line concatenation/reallocation, JSON value and
key storage, and engine internals are additional, uncounted physical copies.
Consequently these are an explicit lower-bound site census, **not a claim to
have measured all physical string copies**.

The guest's 16 KiB `os.read` destination does not make input a 16 KiB transfer:
the console exposes one 1 KiB RX buffer, so the 65,563-byte reply still takes
65 reads and 65 ppolls. The final unwrapped-bootstrap census also observes
282 `mmap` and 279 `munmap` calls in that bulk interval. Allocation counts are
fixture/heap-state dependent; they are not fixed transport ABI constants.
The ring/embedder must address conversion/reassembly as well as MMIO.

The six encodes are guest argument adaptation, guest CALL frame, guest result
adaptation, host argument adaptation, host result adaptation, and host RET frame.
The host parses CALL once, argument and result values once each, then parses
its own outgoing RET **twice**, plus eleven object-key decodes. Queued call
frames add two `JSON.stringify` calls per queued frame solely for queue-byte
accounting; this explains the ten-call encode range. The 64 KiB case has five
full parses of a large value/frame across the two processes. Its guest does
**not** ASCII-encode the large reply: that is host work; the isolated QuickJS
64 KiB ASCII test represents a large outgoing guest value.

Independent cross-check: a2-cpu's n=30 current-build trace reports 5 MMIO returns
for RUN→DONE `return2` versus median 13 for `one_tool`, consistent with the eight
incremental tool exits here. Its source, CPU attribution and workload boundaries
are in [the CPU report](../cpu/RESULTS.md); that lifecycle measurement is not
substituted for this report's narrower call window.

## Concrete ring ABI v2 and expected counts

The full byte-level contract is [ABI-v2.md](ABI-v2.md). It has been coordinated
with [w2-shard's README](../../../jitk/shard/README.md), which now explicitly
links the proposal and keeps its fixed-record test **ABI v0** separate. The
architecture's Node authority, uncredentialed shard and MMIO-first choices are
preserved. No production ring implementation or latency result is claimed.

* Exactly 16 KiB control + two 32 KiB SPSC rings: **80 KiB per slot**.
* **32-byte header**: offset 0 u32 record bytes; 4 u16 kind; 6 u16 flags;
  8 u64 generation; 16 u64 call ID; 24 u32 payload bytes; 28 u32 capability slot.
  Little endian, records aligned to 8 bytes, **16,384-byte maximum record**,
  16,352-byte maximum unfragmented payload; records may span ring wrap.
* Byte cursors and consumed-byte credit, private receiver copies before policy
  validation, strict generation/identity/length/flag validation. Native headers
  carry routing; only arguments/results use UTF-8 JSON. Preserve duplicate-key,
  scalar/number, schema, effect and deadline checks in the sole Node authority.
* Flush a job/budget/credit batch, not every promise. **WAIT implicitly submits
  then parks**, so ten ready small calls can share one MMIO exit. A standalone
  SUBMIT overlaps guest work; FINISH drains and stops. Preserve w2's doorbell
  GPA `0x10000000`, SUBMIT=1, WAIT=2, FINISH=3.
* EL1 demux routes `(generation,call_id)` replies to bounded posted buffers,
  including replies for other capabilities while `read(/cap/…/call)` blocks.
  No per-call thread, unbounded kernel response allocation or guest IRQ wakeup.
* Kernel/owner epochs plus check→arm→recheck prevent lost wakeups. Only the owner
  enters its vCPU; stopped-slot MMIO completion precedes reset. Sleeping Node
  and owner processes still need batched OS notifications.

| Predicted common path | 1 small call | one ready batch of 10 |
|---|---:|---:|
| Full JSON encodes / decodes, both sides | 2 / 2 | 20 / 20 |
| Guest enqueue syscalls + WAIT syscall | 1 + 1 | 10 + 1 |
| MMIO WAIT exits / vCPU re-entries | 1 / 1 | 1 / 1 |
| virtio/GIC/timer/WFI exits | 0 | 0 |
| Logical payload-copy stages | 4 | 40 |
| Sleeping peer request / completion notifications | ≤1 / ≤1 | ≤1 / ≤1 |
| Payload pipe reads/writes | 0 | 0 |

Four copies require descriptor IPC and a pre-registered read-only Node view of
request rings: Node copies hostile bytes directly into private validation
storage, acknowledges byte credit, and the owner copies replies from Node's
completion cell. If the shard instead copies request payloads into mutable
shared IPC, Node must copy again before validating: **five** payload-copy stages.
UTF-8 encoding, JSON allocations and ring-wrap spans are additional. Do not
trade away the trust boundary to advertise zero-copy policy.

For a materialized 65,536-character string, 65,538 JSON bytes plus 8-byte fragment
prefixes need **five records, 65,744 ring bytes, and at least three credit
windows**. Expect at least three WAIT exits/resumptions and completion/credit
handoffs, not the small-call count. It needs a larger encoded-byte reservation
than the default 64 KiB small profile. Prefer a bounded blob handle when the
program does not need the bytes. Independently arriving Promise.all completions
can also require multiple resumes; the one-exit batch prediction assumes an
already-ready batch or an explicit all-of wait predicate.

## Proposed ≤30 µs small-call allocation

All rows below are **targets/estimates to falsify**, not observations. This is
a hot, available-slot, immediate credential-free provider round, excluding boot,
restore, MCP ingress, grant binding, real provider latency and FINISH. The
30 µs target is not reached by today's measured Mac path.

| Step | Allocation µs | Required implementation / evidence gate |
|---|---:|---|
| Guest payload JSON encode + result parse | 2.5 | 5-byte args / 3-byte result; native embedder, no frame codec round-trips |
| EL0 enqueue, header/copy/publication | 0.5 | bounded native capability syscall; no stdio/ASCII pass |
| WAIT MMIO return + owner request drain | 2.0 | one exit, no emulated device; measure on real Linux metal |
| Descriptor IPC publication + Node wake | 3.0 | shared-memory native binding, coalesced notification |
| Node private copy + payload/schema validation | 3.0 | one argument decode, no envelope-key parsers |
| Sole policy authority + immediate public provider | 8.0 | hot decide/dispatch, one canonical immutable call |
| Result JSON encode + completion publication | 2.0 | no stringify→parse output validation cycle |
| Owner wake, reply copy + vCPU re-entry | 4.0 | publish before resume; no interrupt delivery |
| EL1 demux + guest promise resumption | 3.0 | direct posted buffers, one result parse counted above |
| Unallocated margin | 2.0 | contention/implementation margin, not a substitute for tail testing |
| **Total** | **30.0** | **≤30 p50 / ≤60 p99 acceptance target remains unproven** |

The current hot isolated `decide_dispatch` mean-sample p50 is 7.38 µs versus
17.57 µs for the compatibility policy path, supporting removal of duplicate
adaptation before budgeting 8 µs. It does not validate wakeup or HV exit targets.
The current 44.60 µs pipe RTT alone exceeds the complete allocation. Real Linux
metal must measure the two IPC handoffs, MMIO/resume and policy CPU together;
this Mac's timings do not establish feasibility. Start with the architecture's
Node ≤120 µs interim tool-round gate; when measured TS policy exceeds
100 µs/run or 20% of service CPU, evaluate a Rust broker **replacement**, retaining
one policy authority outside credential-free shards. Wall time under contention
alone does not trigger that CPU gate.

## Reproduce, raw data and limits

Raw files and runnable measurement sources are in [raw/](raw/). Important files:

* [transport-final.json](raw/transport-final.json): authoritative n=31 census,
  exact HEAD bootstrap, kernel counters, VMM and Node POSIX interposition.
* [transport-baseline.json](raw/transport-baseline.json) and
  [transport-sequential100.json](raw/transport-sequential100.json): no detailed
  probes, clean guest, per-round guest-clock timing.
* [transport-node-syscalls.json](raw/transport-node-syscalls.json): supplementary
  guest JSON/String operation counts; **do not use its bulk allocator counts**.
* [qjs-components.json](raw/qjs-components.json),
  [node-components.json](raw/node-components.json),
  [policy-components.json](raw/policy-components.json), and [pipe.json](raw/pipe.json).
* [summary.json](raw/summary.json), [SYSCOUNTERS.md](raw/SYSCOUNTERS.md), patches,
  environment/toolchain hashes and [BENCH-NOTES.txt](raw/BENCH-NOTES.txt).

Reproduction outline (paths in the scripts intentionally point to this
experiment's isolated directory; preserve or adapt that directory consistently):

```sh
# Freeze source, including the original codec/executor, not concurrent edits.
mkdir -p /tmp/sofort-a4/head
cd /Users/noah/code/sofort
git archive 58ab4435ebd450db9754b2b1ece39789805b94b5 \
  arch/jitk/kernel arch/jitk/protocol arch/jitk/executor arch/jitk/vmm \
  arch/jitk/bench/hyperlight | tar -x -C /tmp/sofort-a4/head
# Apply raw/guest-node-instrumentation.patch in that copy; archive an additional
# clean kernel/protocol copy under /tmp/sofort-a4/clean for stock bootstrap.
# Reuse pinned upstream libkrun dependencies only in a private cloned target.
# Apply all five frozen vmm/patches/series patches, then libkrun-instrumentation.patch.
# Build through libkrun's Makefile, then use link-vmm.py to link/sign HEAD VMM.
# Compile syscalls.c as a dylib and loopticks.c as an N-API module (Node headers).
# Build the copied executor with its frozen build.mjs and existing locked modules.
python3 /tmp/sofort-a4/build-census.py
# Build the clean kernel into baseline-images and retain the recorded base VMM.
/usr/bin/lockf -k /tmp/sofort-bench.lock sh /tmp/sofort-a4/run-final.sh
/usr/bin/lockf -k /tmp/sofort-bench.lock \
  /tmp/jitk-09/node-real /tmp/sofort-a4/bench-qjs.mjs
/usr/bin/lockf -k /tmp/sofort-bench.lock \
  /tmp/jitk-09/node-real /tmp/sofort-a4/bench-node.mjs
/usr/bin/lockf -k /tmp/sofort-bench.lock \
  /tmp/jitk-09/node-real /tmp/sofort-a4/bench-policy.mjs
/usr/bin/lockf -k /tmp/sofort-bench.lock sh /tmp/sofort-a4/run-pipe.sh
python3 /tmp/sofort-a4/analyze.py
```

`raw/build-private.sh` makes the setup steps concrete without fetching anything
or touching other agents' builds. Existing private measured binaries are retained
under `/tmp/sofort-a4/bin/`; images under `baseline-images/`, `census-images/`
and the instrumented HEAD copy are hashed in `raw/binary-sha256.txt`. The last pre-cleanup directory census was 543 MiB, below the 1.5 GiB cap. Private
Cargo/build output is removed after measurement to respect the disk cap; sources,
patches, scripts, binaries and raw evidence are retained. No runtime helper
process was introduced: the pipe child is an isolation microbenchmark, not an
executor component. No shipping source changed, so the full shared-tree build
test was not rerun while w1 was changing it. Analysis verifies every successful
result, syscall-bin sums, byte conservation and exit-category sums.

Limitations are explicit: no physical JS-copy census, no privileged all-kernel
syscall trace, no Linux-metal timing, no production ring implementation, and
no demonstrated 30 µs result. Raw POSIX attempt counters are interval-scoped
and can differ at pre-existing blocking-call boundaries. The ABI proposal
requires hostile-producer wrap/credit/mutation/generation tests and real
asynchronous reply-demux integration; w2's assembly fixture does not test those.

## Findings → recommended changes

1. **Replace console transport with submit-and-park rings and kernel demux.**
   Highest expected latency and idle-density impact: this census sees 8 returns
   for one small call, median 323 for a 64 KiB reply, ten TX worker park returns
   per ten-call batch and 65 RX worker park returns for bulk. Contract prediction:
   1 small-call WAIT exit, at least 3 for materialized bulk, no console workers
   and no IRQ/GIC/timer/WFI path. Those are expected counts, not measured speedups.
2. **Replace duplicated frame/compatibility work with one canonical value path.**
   Six encodes/nineteen parse invocations become two encodes/two full decodes for
   a JSON-only small call, without weakening authority/schema/scalar/effect
   checks. Bind capability indexes once, eliminate queue-accounting stringify,
   parse arguments once into private storage, validate host result values before
   encoding, and preserve typed-array semantics via an explicit negotiated codec.
3. **Batch requests and completion notifications; implement byte credits.**
   Promise.all currently amortizes reads but retains ten TX wakeups and ten host
   reply writes. One ready request/completion batch can use one WAIT and two
   sleeping-peer notifications. Do not delay unrelated completions to improve
   the batch metric or pin owners behind full Node IPC queues.
4. **Keep bulk values out of glue when possible; otherwise fix conversion.**
   Current 64 KiB result is 16.18 ms p50 under this load, with 65 reads/ppolls,
   hundreds of allocation syscalls and ≥262,410 byte/character movements at
   measured copy sites before JSON internals. Use blob handles/projection, or
   five bounded ring records with direct posted-buffer demux and one result parse.
5. **Treat memory savings and 30 µs as gates, not consequences of a ring.**
   The clean ELF has 16,384 B console queues + 2,048 B control buffers + 16,384 B
   diagnostic backlog = **34,816 B** of static storage (symbol evidence in raw).
   An 81,920 B ring allocation is **47,104 B larger** than those three symbols;
   it earns its memory benefit by removing libkrun devices/console threads and
   sharing/resetting slots, not by shrinking those guest buffers alone. That is
   a static allocation comparison, not RSS/private-memory savings. Measure the
   complete slot ledger and per-process native IPC CPU before claiming the
   `glue-2m` memory or ≤30 µs performance target.
