# scriptc 0.4.5 findings

Local Mac arm64 findings; nothing filed upstream. These are not reasons to
change the canonical executor/MCP. Minimal repros live in [repros/](repros/).
Build with `node build.mjs repros/NAME.ts` (or `.mjs`); execute emitted binaries
separately with `node run.mjs repro ./dist/NAME`. Failure is expected for these
repros. Build logs, binaries and samples remain ignored.

| Repro | Observed on 0.4.5 | Workaround used |
|---|---|---|
| `backend-method.ts` | Emits; `this.backend.park is not a function` through an interface when the native fake returns a callback/promise-bearing sandbox. A simpler number-returning method control passes. | Test adapter represents the same fake as an explicitly typed plain record (`fake-fixture.txt`); assertions and lifecycle remain the same. Production uses the concrete process backend. |
| `nonnull-method.ts` | Emits; `expected Owner at $, got undefined` calling `owner.arm!(7)`; receiver is lost. | Assert presence, then use receiver-preserving `owner.arm?.(7)`. |
| `mixed-all.ts` | SC2020 for heterogeneous `Promise.all([s.read(),s.confined,s.watchdogReady])`. Simple constant promise controls can pass. | Register rejection handlers immediately, then await each original promise. Each failure remains fatal. |
| `child-write.ts` | SC0001: child stdin `write` accepts one argument, no completion callback. | Serialize producers; use boolean backpressure and await `drain` on false, with stream-error rejection. |
| `recursive-frame.ts` | SC9001 `expected record, got union` after narrowing a nested recursive JSON dictionary. | Keep the canonical parser/schema/limits unchanged, use a checked-dynamic `Frame` dictionary and bracket access for nested error fields. |
| `tuple-loop.ts` | SC0004 typescript-go panic: value is not an instance of TupleType. | Explicit tuple element types in the copied API test. |
| `assert-callback.mjs` | Emits; SC2020 at runtime for `assert.throws(fn, Error, message)` with a nonliteral callback. | In the owner test helper, catch, assert the same exception class and assert that an exception occurred. Same assertion count and conditions. |

Other applied spike patterns: real cwd, `/usr/bin/env -i` with argv environment
assignments, string queues instead of dictionary-array class fields, promise
arrays/counters instead of `Set<Promise>`, static imports, separate signal
registrations, and executable rather than async library mode. No host
`Function`, `node:vm`, Acorn, addon, AI SDK, zod or Ajv enters the native graph.

An early watchdog-test executable printed its valid deadline receipt, then
stayed in `scr_children_wait` → `kevent`. A one-second `/usr/bin/sample` was
captured at `.work/watchdog-before-close.sample` before terminating that run.
The process inventory showed a **live watchdog**, not a zombie child. The
canonical fixture relies on Node's unref behavior. The native adapter now
explicitly closes and awaits the backend in teardown, and the test exits 0.
No zombie-child runtime hang was observed. Every emitted test spawn runs under
`run.mjs`'s 90-second bound; a timeout captures a sample before group SIGKILL.
Compiler invocations have a 180-second timeout and a 15-GiB disk guard.

Negative attempts were retained locally, not presented as passing tests:
native Fake methods, exported Fake methods, and an arrow field all failed via
the interface; a closure bridge returning a Backend record hit SC1101. The
plain-record fake preserves the original 10-ms boot, 20-ms auto-reap, manual
reap, counters and abort behavior and passes every original pool assertion.
