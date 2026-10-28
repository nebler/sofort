# Shard TypeScript port parity

Baseline: parent of `96c09e93`, 2026-10-26. Both native Mac arm64 and static
Linux aarch64 musl tools use locked scriptc 0.4.5; zig 0.16.0 links Linux.
All 20 tracked Python files are replaced by TypeScript. No Rust source changed.
Generic process/hash/JSON/assertion helpers and bench.lock composition are in
lib.ts. `./tool.sh ORIGINAL-BASENAME [ARGS...]` retains each script's arguments.
The former native_r7_lock module is now `locked()` in lib.ts.

## Paired checks

| Suite | Mac | kvm-dev Python baseline | TypeScript |
|---|---|---|---|
| Rust unit tests | 14 portable tests (+1.95.0) | 29 PASS | 29 PASS after Python removal |
| Native regression | Linux-only | 41/41 exact twice, fd + region probes PASS | 41/41 exact twice, fd + region probes PASS |
| KVM ignored tests | Linux-only | 5/5 PASS | 5/5 PASS after Python removal |
| Mixed restore stress | Linux-only | 10,000 runs, 0 leaks, 0 cross-talk, 10,000 fresh entropy | 10,000 runs, 0 leaks, 0 cross-talk, 10,000 fresh entropy |
| Six offline reducers / summary | PASS | Same retained inputs | Parsed structures equal, numerical tolerance below |
| RNG checker | 10,000 canary samples PASS | Same archived input | Same checks/summary/exit 0 |

Reducers covered: analyze-native-r7 (Lua and cache-before curves), analyze-r6
(5 ledger fixtures + 5 benches), analyze-r7-rng, analyze-r7-shard (7 ledger
fixtures, 4 benches, 3 hostile fixtures, 10,000 stress runs, WAIT/deadlines),
analyze-r7-integrate (6 native tools, 2 classes, 5 hostile counts), summarize
(7 density, 8 reset, 14 WAIT, 2 pooled WAIT and 21 idle rows).

Two retained R6/R7 receipts predate the current validator: the R6 canary file is
truncated and the R7 arena error text predates the current spelling. Successful
paired reducer fixtures append an explicitly marked synthetic R6 summary and
normalize only that historical arena error string in disposable copies supplied
identically to Python and TS. Unmodified stale fixtures fail validation. No
historical evidence was rewritten in Git.

## Evidence comparison

Native protocol outputs, exit codes, lengths, digests and all 41 input file hashes
must match exactly. The USTAR fixture is byte-for-byte Python tarfile's 10 KiB
record, including zero device fields; a full input-hash comparison caught and
fixed an initially different header despite both native oracles passing.
Normalize corpus elapsed_ns/load only. Snapshot register/clock observations,
PID/cgroup paths, time/load/counter/memory measurements and observer timing are
inherently live; preserve fields and compare decisions/counts rather than values.
JSON whitespace/key order and integral float spelling are ignored. Reducer
floating arithmetic uses relative tolerance 1e-12 and absolute tolerance 1e-8
because Python statistics uses compensated/exact accumulation. No acceptance
threshold changed. Raw bytes remain separate files and large hex fields remain
null, as before. Stack traces are replaced by native diagnostics with exit 1. The archival
trace-memory stdout uses JSON instead of Python dict repr; its persisted JSON
schema is unchanged.

The archival wait-deadline-r6, trace-memory and pilot-brk commands retain their
old hardcoded scratch prerequisites. They compile into both binaries; destructive
historical kernel/mutation experiments are not part of the live R8 gate replay.
The maintained WAIT, escalation and ledger observers are validated separately.

## Verification procedure

(As run for this record. The current clean-clone procedure, with cache
snapshots and no host paths, is in README.md "Clean clone on Linux arm64".)

Use a private /home/dev checkout. Build on Mac with `make build build-linux`,
copy build/linux/shard-tools, and run `make test` without an outer flock.
`test-kvm` expects the caller's lock and both classes:

```
JITK_SHARD_TEST_SNAPSHOT=/home/dev/r8-lead/helpers \
JITK_SHARD_TEST_SNAPSHOTS=/home/dev/r7-integrate/qjs-glue-2m:/home/dev/r7-integrate/qjs-glue-4m \
flock /home/dev/bench.lock make test-kvm
```

The mixed stress uses `real stress /home/dev/r8-lead/helpers mixed 10000` under
the lock. Tests never restart kvm-dev. Final outcomes are recorded below.

## Final live observer results

- Ledger-r6: both implementations completed 41 cells across ready, return2,
  one_tool, promise10 and json64k (two 1/16/64/256 curves each plus ready/1024).
  Each has 3 samples: 123 per implementation. Event/sample fields and case counts
  match; every idle_cpu_usec is 0; memory.events and remaining cgroups are empty.
- Native Lua ledger: both completed 8 cells / 24 samples, with matching schemas,
  zero idle CPU, zero memory events and no remaining child cgroups.
- WAIT: both validated 1,024 slots, 5 task IDs, a single-thread watchdog and no
  lost releases. Escalation in both stopped the owner and observed SIGKILL.
- Fresh Python native corpus vs final TS: all 41 receipt objects match exactly
  against each TS repetition after removing elapsed_ns/load, including input
  hashes, binary stdout/stderr, exit codes and all digest/length fields.
- Duplicate RNG negative fixture: both report identical failed checks and exit 1;
  statistical floating results use the tolerance above. Canary 10,000 passes.
- IPC SSH suite: 121 assertions PASS, 34 metrics; prepared snapshot copied inside
  the private remote root as required. It uses the executor owner's existing
  private Node artifact; shard tools themselves require no Node.
- Mixed restore summary is identical before/after: 10,000 runs / 64 slots,
  canary_leaks=0, cross_talk=0, fresh_entropy=10,000.

Mac's installed stable Rust is older than the crate's 1.95 minimum, so the
portable unit check explicitly uses +1.95.0 (14 tests); kvm-dev stable passes 29.
All test evidence stays in scratch/ignored paths. Neither kvm-dev nor Docker was
restarted or pruned. Final disk checks remained above the 15 GiB Mac floor.

Aggregate Makefile was not edited. It must switch its docs-owned DELEGATE and loc
commands to that agent's TypeScript launchers. Shard's Linux KVM gate remains a
separate explicit target because the Mac aggregate cannot run it locally.
