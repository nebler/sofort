# 03 — Guest↔host channel: bounded JSON lines + real promise concurrency

Recommendation: one full-duplex virtio-console port, ASCII JSON lines, a Rust
host decoder, and QuickJS `os.setReadHandler(0, …)` driving ID-indexed promises.
Ship source bootstrap with the supplied unmodified qjs. Bytecode requires a
different executable; it cannot simply be passed to that qjs.

## 1. Concrete design

### Components, versions, and trust

- Guest: Bellard **QuickJS 2026-06-04**, supplied static aarch64-musl executable;
  bootstrap imports only its bundled `std` and `os`. No npm dependencies.
- Trusted host: Rust, **serde 1.0.228** + **serde_json 1.0.145**, exact pins and
  transitive versions in `Cargo.lock`. Built/tested with rustc/cargo **1.85.0**.
  Rust gives bounded byte accumulation, schema enums, and no JS prototype merges.
  No async runtime dependency in this component: integrate its incremental APIs
  with the host's existing fd event loop. TS remains the Executor/tool adapter.
- VMM process transports untrusted bytes and receives no credentials. Decoder
  and policy live on the trusted side of its bounded pipe/socket connection.
  Tool callbacks receive `(host_run_uuid, id, ns, fn, args, remaining_deadline)`.
  The host assigns run identity from the VM connection, never guest fields.
- Test environment: M4 Pro/macOS; Docker Linux arm64, Alpine **3.22**, Python
  **3.12.15**, GCC **14.2.0**, strace **6.13**. Container image ID:
  `sha256:2e0b81d60597f449baa56dc25d355367869d2dca4cd57e866f1e2b52af3eb55f`.
  Native macOS qjs/qjsc were built locally from the same upstream release.

### Wire v1

Each direction is an independent byte stream. One JSON object plus byte `0x0a`.
JSON strings escape embedded newlines. **Wire bytes must be ASCII**: serialize
non-ASCII UTF-16 code units as `\uXXXX`, including surrogate pairs for emoji.
This is a JSON subset, chosen to avoid a guest UTF-8 decoder dependency. Reject
raw CR, non-ASCII bytes, duplicate keys at every depth, unknown envelope fields,
nonfinite JSON numbers, and unpaired surrogates. Numeric magnitude is capped at
9,007,199,254,740,991 to avoid Rust-integer/TS-number disagreement; larger IDs use
decimal strings. No CRLF, BOM, empty lines,
comments, recovery markers, or resynchronization after a violation.

Message shapes (all fields shown are required; no extra envelope fields):

```text
G→H {"t":"hello","v":1}
G→H {"t":"ready"}
H→G {"t":"code","source":"return await api.echo({x:1});",
     "providers":[{"name":"api","fns":["echo"]}]}
G→H {"t":"call","id":1,"ns":"api","fn":"echo","args":{"x":1}}
H→G {"t":"result","id":1,"value":{"x":1}}
H→G {"t":"err","id":1,"code":"DENIED","message":"policy denied"}
G→H {"t":"log","level":"info","text":"message"}
G→H {"t":"done","ok":true,"value":{"x":1}}
G→H {"t":"done","ok":false,"value":"Error: tool failed"}
G→H {"t":"fatal","code":"GUEST","message":"protocol/engine failure"}
```

`err` rejects exactly one tool promise; caught errors permit execution to
continue. `done` terminates execution; `fatal` terminates the connection. Failed
done may have outstanding calls (Promise.all rejects early): host cancels them.
Successful done requires no outstanding calls. EOF
before a terminal frame, or EOF with a partial frame, is failure. Uncaught VM
crashes/OOM need no successful fatal write: host synthesizes a runtime failure.
JSON-compatible values only; top-level undefined becomes null, JSON.stringify
semantics apply to nested undefined/NaN, BigInt/cycles cause serialization failure.
Binary payloads require an explicitly named base64 field or a host-side handle.

JSON lines wins v0 simplicity: one delimiter byte instead of a four-byte length;
the scanner already enforces a bound before parsing. Length-prefixing would not
remove JSON/schema validation. **UNVERIFIED:** no head-to-head framing benchmark;
this is a simplicity decision, not a claim that LF scanning is fastest.
ASCII escaping can expand BMP text from 3 UTF-8 bytes to 6 bytes; caps apply to
encoded wire bytes, not source character counts. This tradeoff is deliberate.

### State, parking, and async execution

Host state: `await hello → await ready → parked → running → terminal`.
Launch with proposed limits `--memory-limit 32M --stack-size 512K` and bootstrap
as a module. `ready` means imports, proxy machinery, and stdin handler exist.
Only then advertise the VM as a pool slot. Kernel parks in blocking `ppoll`,
using WFI/console interrupt rather than spinning; no guest scheduler is needed.

On checkout, the host binds a run/policy/deadline and enqueues exactly one `code`
frame. Source is an **async function body**, allowing top-level `return`/`await`;
the trusted wrapper constructs `AsyncFunction(source)`. Static imports are not
part of that body contract. A second code frame is a protocol violation. There
is no filesystem code delivery, env var, command-line snippet, or reuse after
done. Destroy the VM after any terminal outcome; pool parking TTL is host-owned.

Namespace proxies allow only manifest function names; `then` returns undefined
to avoid accidental thenables. Each call allocates a monotonically increasing
u32 ID, emits immediately, and returns an unresolved promise. A map retains
resolve/reject callbacks. Responses may arrive in any order. One response removes
the map entry before resolving it; continuations run through QuickJS's normal
promise job loop. Duplicate, stale, or unknown response IDs terminate the guest.
No ID reuse, per-call retries, or guest-provided execution identity.

Use one raw `os.read` of at most 16 KiB per readability callback, accumulating
bounded fragments and processing every complete line. **Do not combine** a
readiness callback with `std.in.getline()`: a fragmented line can block it, and
stdio can read ahead beyond the readiness-visible fd buffer. A synchronous
`getline` inside each tool call serializes Promise.all (the original spike does
this). A hand-written blocking JS loop also prevents normal promise-job progress.
The [QuickJS library API](https://bellard.org/quickjs/quickjs.html#os-module)
provides the fd handlers and timers used here.

### Backpressure, bounds, and logging

Fixed v1 policy limits, enforced on host even if guest bypasses bootstrap:

- Frame: **1,048,576 bytes excluding LF**; source: **262,144 UTF-8 bytes** plus
  the total encoded frame cap. Maximum nesting **32**, structural budget **32,768**
  quotes/open-containers/commas/colons outside string bodies.
- Calls: **64** outstanding, **4,096** total, strictly consecutive IDs starting
  at 1; names match `[A-Za-z_$][A-Za-z0-9_$]{0,63}`. Actual tool allowlist,
  args schema, authorization, provenance, and rate limits are checked per call.
- Outstanding call frames: **2 MiB aggregate**, charged until completion is
  enqueued. `Decoder::complete(id)` releases that charge. Exceeding host byte
  credit is fatal; guest API locally rejects count overflow rather than keeping
  an unbounded hidden queue. Byte-credit mirroring in guest is an optional polish.
- Both directions: **16 MiB total wire bytes**; guest→host **8,192 frames**.
  Host output FIFO: **2 × (MAX_FRAME+1)** bytes, one writer, partial-write safe.
  Producer retains/retries a refused frame; never silently drops a response.
  Reserve queue capacity before serialization/starting large tool responses.
- Logs: levels log/info/warn/error/debug; **4 KiB decoded text per record**,
  **256 KiB decoded text total**, **1,024 records**. Bootstrap truncates to 512
  UTF-16 units and drops beyond its own encoded-byte/count budgets. Host kills
  on invalid raw log frames rather than buffering attacker output indefinitely.
- Host must apply an independent wall-clock deadline, including code without
  calls or a promise that never settles. Suggested defaults: 30 s execution,
  each tool ≤10 s and ≤remaining time; these are policy choices, not measurements.

Keep draining guest output while tools execute and host responses wait for
write readiness. Dispatch callbacks enqueue bounded work and never await tool
I/O inside the decoder. A blocked stdout write then provides transport pressure
without a circular host wait. Tool input/output memory also needs bounded backend
adapters and global admission; wire limits alone do not bound arbitrary tool SDKs.
On any protocol/budget violation: cancel outstanding work, revoke the run, kill
the VM, retain a bounded reason. Cancellation cannot undo external side effects;
host-generated `(run_uuid,id)` is the idempotency key where a tool supports one.

All application logs are tagged stdout frames. Map guest fd 2 to a sink in the
production kernel; disable raw kernel/VMM logging on the protocol port. Startup
syntax errors otherwise corrupt framing. Kernel panic terminates the VM and is
reported through host exit/status handling. A malicious snippet can import std
or write forged frames: the bootstrap is **not** a security boundary. Host policy
must treat every valid `call` as guest intent, not proof of API use; log claims
and guest `done` values are also untrusted. No credentials enter guest memory.

## 2. Executable code sketches

- `bootstrap.js` (114 lines): runnable module, Proxy API, parked code delivery,
  async responses, bounded framing/logs, timers, done/fatal. No JS dependencies.
- `parser.rs` + `outbound.rs`: incremental poisoned-on-error decoder, duplicate
  rejecting JSON visitor, typed schema/state/budgets; bounded ASCII encoder and
  FIFO. Public integration APIs: `feed`, `code_sent`, `complete`, `eof`,
  `encode`, `Queue::push`, `Queue::drain`. Call `code_sent` after queue commit;
  call `complete` only after a response is accepted by the writer queue.
  Tools are dispatched by the trusted adapter, not implemented in this sketch.
- `experiments.py`: Linux/native pipe host, reverse-order concurrency, payload
  throughput, alternating source/bytecode process startup. It uses Python's JSON
  decoder for measurement; it does **not** replace/test-integrate the Rust
  production dispatcher. Large throughput runs deliberately bypass session byte
  budgets to collect enough samples.
- `parse-bench.js`, `bytecode-bench.c`: isolated JSON parse and source-compile
  versus trusted-bytecode-decode microbenchmarks. Seven Rust tests passed,
  including a deterministic **20,000-input** mutation smoke test, duplicate keys,
  malformed Unicode/numbers, limits, reordered completion, and partial writes.
  Smoke testing is not exhaustive fuzzing/audit; allocator peak is **UNVERIFIED**.

Reproduction commands are in `REPRODUCE.md`. All builds/cache writes were local
to this directory or `/tmp/jitk-03`; `/tmp/jitk-spike` artifacts were not changed.

## 3. BLOCKERS — experiments and results

### A. Async concurrency and extra syscalls — ELIMINATED

Command: `docker exec jitk-03-lab python3 /proposal/experiments.py concurrency
--trace /work/async.trace`. **PASS:** 32 requests emitted before the host answered
any; responses sent 32→1; result array retained input order. 34 total calls,
2 log frames, Unicode/escaped newline, rejected tool, timer, and seven-byte
fragments of code input all passed. `--n 64` also passed; wrapper invoking
`qjs-static --memory-limit 32M --stack-size 512K` passed with 64 outstanding calls.
Evidence: `concurrency-result.json`, `concurrency-64-result.json`,
`capped-concurrency-result.json`, `async.trace`, `syscalls.json`.

**Exactly one extra unique traced syscall: `ppoll`** (27 calls in retained trace;
counts depend on host coalescing). Observed 15 unique syscalls: baseline getcwd
was absent, ppoll added; baseline union is 16. One timer produced
`ppoll([{fd=0,events=POLLIN}],1,{tv_sec=0,tv_nsec=1000000},NULL,8)=0`.
No select/pselect6/epoll/fcntl/futex/signal syscalls appeared. clock_gettime remains
vDSO-hidden on Linux: source `quickjs-libc.c:get_time_ms` calls CLOCK_MONOTONIC;
jitk must implement it as already acknowledged by the brief (17-call union).
Implement ppoll fd-array validation, POLLIN/HUP/ERR/NVAL, NULL/infinite and finite
timeouts; never report readable with no bytes. See [poll/ppoll semantics](https://man7.org/linux/man-pages/man2/poll.2.html).
The custom-kernel implementation itself is **UNVERIFIED**, not supplied here.

### B. JSON-lines pipes and parse cost — ELIMINATED for baseline measurement

Command: `docker exec jitk-03-lab python3 /proposal/experiments.py pipes`.
Three runs per point, medians below; includes Python host JSON and complete
QuickJS bootstrap, no tool work, no virtio. Small sequential RTT is total run
time/call count, not a per-message p50 histogram. Busy shared development machine;
raw run ranges are retained, so these are not production capacity promises.

- Empty args: **870.8 µs/call**, **1,148 calls/s**, 2,000 calls/run; range 1.02–2.12 s/run.
- 1,024-byte args: **759.5 µs/call**, **1,317 calls/s**, **2.68 MiB/s** bidirectional.
- 102,400-byte args: **26.38 ms/call**, **37.90 calls/s**, **7.41 MiB/s**.
- 1,048,400-byte args: **217.73 ms/call**, **4.59 calls/s**, **9.18 MiB/s**.
- Window 64, empty args: **15,038 calls/s**, **66.50 µs amortized/call**;
  this is throughput, not individual response latency. 4,096 calls/run.
- Native macOS small-call cross-check: **141.0 µs sequential**, **46,955 calls/s**
  with window 64. Different OS/process scheduling: do not subtract these timings
  to estimate virtio overhead. Evidence: `pipes-results.jsonl`, `native-pipes-results.jsonl`.

Parse commands: `qjs-static -m /proposal/parse-bench.js`; `parser bench` (release).
Exact encoded frame sizes: **1,076 / 102,452 / 1,048,452 bytes** (payloads above).
QuickJS JSON.parse: **15.65 / 664.47 / 3,988.48 µs** per parse.
Rust strict frame parser, including ASCII/depth scan, duplicate rejection, and
typed envelope conversion: **5.796 / 404.041 / 3,689.714 µs**.
Iterations: 10,000 small, 1,000 each large. Rust ran natively on macOS, QuickJS
inside Linux: this is not an apples-to-apples language performance comparison.
Evidence: `qjs-parse-results.jsonl`, `rust-parse-results.txt`.

### C. Precompile and load with static qjs — FAIL as stated; alternative PASS

Commands: `qjsc -s -c -m -N bootstrap_bytecode -o bootstrap-bytecode.c bootstrap.js`;
extract its C array to bootstrap.qbc; `qjs-static /work/bootstrap.qbc`.
**FAIL, exit 1:** `SyntaxError: unexpected token in expression: '\x05'`.
Upstream qjs.c's file path invokes JS_Eval on source; no public bytecode-file flag
or std.evalBinary exists. Bytecode output is for C embedding, not qjs input.
Source inspection and the failed run agree. See [qjsc documentation](https://bellard.org/quickjs/quickjs.html#qjsc-compiler).

Alternative command: `qjsc -s -e -m -N bootstrap_bytecode -o bootstrap-main.c
bootstrap.js`; link generated C with matching libquickjs.a using `cc -O2 -static
… -lm -lpthread -ldl`; strip. **PASS:** standalone executable passed the same
32-call reverse-order test. Source **4,731 B → bytecode 4,057 B**, **674 B / 14.2%**
smaller. `bytecode-bench` alternates 1,000 fresh contexts: compile-only median
**271.417 µs** versus JS_ReadObject decode **16.000 µs**, saving **255.417 µs**
(16.96× for that step, excluding initialization/evaluation).

Full stripped Linux processes, 100 alternating pairs: spawn→ready medians
**7.228 ms source / 4.255 ms executable**, p90 **17.537 / 11.702 ms**;
code→done **0.345 / 0.330 ms**. Native paired startup showed the opposite direction
(10.912 / 11.557 ms), so a portable end-to-end startup gain is **UNVERIFIED**.
Binary sizes: supplied qjs **9,688,056 B**, stripped **2,394,464 B**; generated
executable stripped **1,050,560 B**. These are different linked programs/builds
(including REPL/CLI), so the binary saving is not solely bytecode. Evidence:
`bytecode-sizes.json`, `bytecode-concurrency.json`, `bytecode-bench-results.txt`,
`linux-stripped-paired-startup.json`, `native-paired-startup.json`.
Bytecode must be trusted/build-produced and pinned to the exact engine build;
agent snippets always remain source. V0 source bootstrap eliminates this dependency.
If adopted, generated main also needs explicit JS_SetMemoryLimit/JS_SetMaxStackSize;
the standalone executable in this experiment uses qjsc's default runtime limits.

### D. Actual virtio-console transport — REMAINS

Attempt: run supplied `boot/host boot/kk.bin` with a code frame on stdin, with
the read-only dylib linked into `/tmp/jitk-03` for loading. Exit **0**, **0 stdout
bytes**, **12.23 ms** including Python process launch; no hello/ready. Source
`kk.S` only invokes PSCI SYSTEM_OFF. **FAIL as a channel integration test**:
available guest has no ELF loader, QuickJS, or console driver. Evidence:
`virtio-attempt.json`. Need the kernel/virtio team's integrated guest to test
ring saturation, interrupt wakeups, timer accuracy, fd2 suppression, and actual
VM RTT. Pipe timings do not verify these properties.

## 4. What I'd cut

- Semantic batch-call messages: pipeline existing call frames; they preserve
  independent authorization/errors and already allow 64 outstanding calls.
- Length-prefix migration, binary attachments, streaming responses, compression,
  shared-memory rings, per-call cancellation, guest retry, and session resumption.
- Second log port, raw printf compatibility, guest worker threads, and JS sandbox
  hardening presented as a security boundary. Keep credential/policy enforcement
  in the host and stop the VM on malformed frames.
- Bytecode optimization from v0 while unmodified qjs is non-negotiable. Pooling
  already removes bootstrap compilation from checkout→result's critical path.

## 5. Open disagreements with brief consensus

1. “Precompile bootstrap bytecode” conflicts with **unmodified static qjs**:
   actual raw-bytecode load failed. Choose source bootstrap or explicitly adopt
   a qjsc-generated executable; don't silently assume an unavailable loader.
2. The 15-syscall script does not cover async tool calls/timers: the measured
   delta is ppoll; timed wait and monotonic clock are real kernel scope.
3. One console cannot carry arbitrary kernel/stderr text beside JSON. Bootstrap
   multiplexing covers console.*, not engine startup errors or forged raw writes.
   Assign fd2 a sink and make host parsing fail closed.
4. Batch tool semantics are premature: measured pipelining improves empty-call
   Linux throughput from 1,148 to 15,038/s without another message type. It does
   not prove that batching would never improve transport cost.

## 6. Estimated LOC

Measured sketches: guest **114**, host parser/tests/benchmark **208**, host writer
and tests **89**, Python driver **130**, JSON microbench **11**, C bytecode bench
**41** lines. Production channel target:
**~350–500 LOC** including guest bootstrap, Rust decoder/encoder/queue, and host
fd glue; excludes dispatcher policy/tool implementations and test code. Proposed
minimal ppoll/timer/IRQ integration: **~80–150 kernel LOC, UNVERIFIED estimate**.
No claim that the brief's total kernel target is proven by this prototype.

Sources: [release source archive](https://bellard.org/quickjs/quickjs-2026-06-04.tar.xz),
SHA-256 `b376e839b322978313d929fd20663b11ba58b75df5a46c126dd19ea2fa70ad2a`;
qjs binary SHA-256 `d87997d1e249c8dd15e6b7a2f9a8c4932612a023a17b8b2d21e8359739a580e9`.
The [Serde unknown-field control](https://serde.rs/container-attrs.html) informs
schema setup, but tests exposed that an internally tagged unit Ready variant
accepted extra fields; changing it to `Ready {}` fixed this in the pinned build.
