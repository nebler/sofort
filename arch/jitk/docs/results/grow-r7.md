# R7 grow: immutable read-only SQLite

**Completed:** configurable named growth and stronger acceptance in the existing
controller; fstat and pread64; **10/10 distinct unchanged SQLite cases**, each
checked in both handler transactions (**20/20 exact stdout/stderr/exit tuples**).
No further implemented syscalls were needed for this corpus.

Worktree: `/Users/noah/.t3/worktrees/sofort/t3-c8b22fdc`

Branch: `t3/grow-sqlite-readonly`

Starting commit: `a3e85d5` (round-7 brief).

## Changes and incremental commits

- `3072954` — immutable archive fstat/pread64, common stat layout replacing
  newfstatat's duplicate layout, independent full-stat/error/offset host tests.
- `9969999` — the existing controller accepts explicit repeatable `--target`,
  and requires semantic/error/state probes, rejected executable mutants and
  unchanged integration. Replay/live share this transaction. Deleted the old
  fixed acceptance flow and its staged presentation; demo calls the controller.
- `a905286` — accepted contracts/manifests, causal SQLite diagnostics, fatal
  discovery classification, exact-output parsing and kernel documentation.
- The report/evidence commit follows these verified implementation commits.

**Handler authorship:** I wrote both handlers directly, then submitted their
canonical source through the **same generalized loop in REPLAY mode**. No live
model proposal is claimed. Live one-file/auth/isolation rails remain tested.

Named targeting works even for a registered handler. Five trusted profiles are
available (ppoll, rt_sigaction, rt_sigprocmask, fstat, pread64); another target
needs its slot and an independent profile. Unsupported names fail closed.
There is one grow transaction, rather than a second SQLite-specific grow loop.

fstat/pread64 add 10/17 Rust source lines. fstat shares the existing 128-byte
AArch64 layout, validates fd before output pointer, and describes console fds
as synthetic pipes. pread64 checks signed offsets/arithmetic, returns exact
short/EOF reads and never moves the descriptor position. No write path exists.

## Environment, method and raw data

Functional kernel runs: Apple M4 Pro, arm64, macOS 26.6.1, 24 GiB, HVF/libkrun;
Rust 1.95.0, clang/lld, canonical confined VMM SHA256
`23ffc4114cff036370bf30b10f727da7fbb23774e3f23c05eb4baeb26c4f1616`.
Native oracle: pinned arm64 Alpine Docker image `jitk-oracle:08`, ID
`sha256:458a19a1e97ca3687507732f8e11cc5054f97cf4989fd796f4cc9faddba08f67`.
Both sides have pipe stdio. Native argv/query/resources are the same; native
LC_ALL/LANG/TZ and guest startup environment/auxv are not claimed identical.

SQLite source verification/build: existing nested **kvm-dev**, Ubuntu 26.04 arm64,
Linux 7.0.0-38-generic, GCC 15.2.0, census musl toolchain. Built only in the new
empty `/home/dev/r7-grow/sqlite-source/`; no third-party binary ran on the Mac
host. `sqlite-build.sh` reproduces the recipe. Published sqlite3.c SHA3-256 was
verified against [SQLite's 3.50.4 release receipt](https://sqlite.org/releaselog/3_50_4.html):
`9145255e83da6529e70121ee4d7a4c88fe83ca4511da0c9ed13d10842df36782`.
Archive SHA256: `1d3049dd0f830a025a53105fc79fd2ab9431aea99e137809d064d8ee8356b032`.
The modern GCC/musl rebuild is `9738d764d61c212592212d0c3f493ba179b8caec6f08810f1d6520c38757f539`;
**it was not substituted for the census binary in the corpus**.

The immutable corpus uses the original census/pitch SQLite shell 3.50.4:
`005073a6c1c0e71c22ad8b752f1ffb6c35c8d913fe91f5795038c7d52cf639ff`
(1,392,336 bytes), unchanged on Linux and jitk before/after. The census database
is 8,192 bytes, `f3d4180cd07ad9eed5a674c7ff4e5f6d817eb517029c185f66af862a30eac059`,
with `n(v)` rows 9,1,5,3,5. It has different creation bytes from the pitch's
`4b36…` DB; the rows/profile and binary are the same. The same census DB bytes
are used throughout this report. An empty regular `/dev/null` is explicitly
packed for shell initialization, alongside `/demo.db`.

Loads were contended (Mac load1 roughly 10–16). The 30-run growth and corpus
batches were **functional, unlocked** after cancelling their lock waits while
r7-suite held the benchmark lock. Stage elapsed times are diagnostics, **not
performance results**. Executor certification and the parking measurement used
`/usr/bin/lockf -k /tmp/sofort-bench.lock`; uptime/load is retained. Source builds
are not benchmarks. No nested timing or metal claim is made.

Raw paths, relative to this directory:

- `results/r7-acceptance/`: both named transactions; Linux strace/output,
  per-VM trace/output/status/load/parsed failure classes, compiled mutant
  manifests/logs/rejections, host handler tests, per-case integration reports.
- `results/r7-legacy/`: original discovery flow, 30 full-trace probe comparisons
  per target, rejected mutants and unchanged QuickJS/Lua integrations.
- `results/r7-diagnostics/`: two causal before-states, native sensitivity,
  combined-ENOSYS profile, real ET_DYN loader rejection and fatal-output event.
- `results/r7-grow/`: build/source provenance, Mac suites, enabled Hyperlight,
  certification receipt/selection/breakdown, parking evidence, environment,
  old/default artifact identity and final parser recheck.

Every VM was deadline-bounded, sandbox-ack checked, and reaped. Build failure
and host termination never count as a rejected semantic mutation. Final parser
changes were rechecked against every saved accepted/mutant/application trace;
`results/r7-grow/final-recheck.json` records this. Tests also explicitly exercise
fatal output during discovery, rather than losing it to a JSON parse exception.

## Acceptance measurements

| Target | Independent probe observations | Fresh VM passes | Executable rejected mutants | Unchanged integration |
|---|---|---:|---:|---|
| fstat | 17 semantic, 8 error, 5 state | 30/30 | 3/3 | SQLite 10/10 |
| pread64 | 9 semantic, 15 error, 5 state | 30/30 | 4/4 | SQLite 10/10 |
| ppoll | readiness, errors, revents and input-consumption state; complete trace | 30/30 | 2/2 | unchanged QuickJS |
| rt_sigaction | explicit injected ENOSYS, inaccessible pointers, query/canary after attempted set | 30/30 | 2/2 | unchanged Lua |
| rt_sigprocmask | explicit injected ENOSYS, inaccessible pointers, query/canary after attempted set | 30/30 | 2/2 | unchanged Lua |

fstat mutants: zero size, false success, wrong fd errno. pread64 mutants: always
read page zero, advance fd offset, wrong negative-offset errno, false success.
All **13/13 total mutants compiled and produced complete traces, then failed**
the independent gate. These are deliberate variants, not naturally sampled
model failures. The host test additionally checks all 128 stat bytes including
padding, archive identity/mode/size, exact logical block count and pointer/fd
precedence. Pread cases cover read-only/wrapping destinations, negative and
near-INT64_MAX offsets, count overflow, EOF/zero-count/directory/pipe behavior,
subsequent ordinary read and a separately opened descriptor's position.
Repetition alone is never acceptance.

`observations.py` records every registered ENOSYS with its six argument
registers/return, other argument-dependent errors, tolerated missing calls,
terminal status and fatal/malformed output events. Build/loader exceptions
retain `failure.json` plus `build.log`. Returned stat/pread bytes are checked
through the independent raw-syscall probe's printable hex output, without
modifying kernel trace.rs or trusting syscall-name disappearance.

## SQLite corpus and exact comparison

The corpus is committed as `sqlite-corpus.json`. Each case runs once per
handler transaction, against its own normal-Linux oracle run. For jitk,
stdout is application bytes separated from trace records; stderr is reconstructed
in order from fd2 `log.hex` records; exit comes from the validated guest `done`
record. Linux stdout/stderr bytes and process exit are compared directly, with
no text/whitespace/error normalization. VMM host status 0 is checked separately
and never substituted for guest status. All tuples below match **2/2** times.

| Case | SQL | stdout bytes (escaped) | stderr bytes (escaped) | Exit | Exact matches |
|---|---|---|---|---:|---:|
| aggregate | `SELECT json_object('count',count(*),'sum',sum(v),'max',max(v)) FROM n;` | `"{\"count\":5,\"sum\":23,\"max\":9}\n"` | `""` | 0 | 2/2 |
| ordered | `SELECT v FROM n ORDER BY v;` | `"1\n3\n5\n5\n9\n"` | `""` | 0 | 2/2 |
| grouped | `SELECT v,count(*) FROM n GROUP BY v ORDER BY v;` | `"1&#124;1\n3&#124;1\n5&#124;2\n9&#124;1\n"` | `""` | 0 | 2/2 |
| filtered | `SELECT sum(v),min(v) FROM n WHERE v>=5;` | `"19&#124;5\n"` | `""` | 0 | 2/2 |
| join | `SELECT count(*) FROM n a JOIN n b ON a.v=b.v;` | `"7\n"` | `""` | 0 | 2/2 |
| schema | `SELECT name,type FROM sqlite_schema ORDER BY name;` | `"n&#124;table\n"` | `""` | 0 | 2/2 |
| integrity | `PRAGMA integrity_check;` | `"ok\n"` | `""` | 0 | 2/2 |
| bad-query | `SELEC v FROM n;` | `""` | `"Error: in prepare, near \"SELEC\": syntax error\n  SELEC v FROM n;\n  ^--- error here\n"` | 1 | 2/2 |
| missing-table | `SELECT * FROM missing_table;` | `""` | `"Error: in prepare, no such table: missing_table\n"` | 1 | 2/2 |
| readonly-write | `INSERT INTO n VALUES(42);` | `""` | `"Error: stepping, attempt to write a readonly database (8)\n"` | 8 | 2/2 |

In every case, only missing **48 faccessat** and **172 getpid** remain;
registered **134 rt_sigaction / 135 rt_sigprocmask** return ENOSYS. No extra
implemented syscall is required for this corpus. Normal native Linux is the
corpus reference. A separate combined native injection of all four ENOSYS
profiles preserves the aggregate tuple (exit 0, exact JSON, empty stderr).

Causal checks (n=1 each, complete guest traces): without both new handlers,
SQLite exits 1 at fstat, missing set {48,80,172}; with only fstat restored, it
exits 1 at pread64, missing set {48,67,172}. Native ENOSYS injection into either
fstat or pread64 independently produces the same disk-I/O-error tuple. Thus
these are causal missing operations, rather than tolerated-probe names.

## Default image and regression gates

| Artifact | SHA256 | Bytes |
|---|---|---:|
| Starting default (reconstructed from starting committed sources at the same build path) | `6c00a278cff95058241967655810dcf0cc9cfa1158a38630d818f26c3b07cbc6` | 2,924,584 |
| New default | `75b2abe26021d9d0624b0555a64ed589d251cb7d30aa2965754974f3716d1732` | 2,924,584 |

The default kernel **changed**, as intended. `original-image/identity.json`
records the starting-commit reconstruction; final build restored the final
sources and reproduced exactly the certified new digest. An earlier preliminary
build overlapped edits while waiting for the shared lock and failed its stale
verification check; its hash is not used as the baseline. Default and immutable
image manifests are committed in `kernel/dist/`; >1 MiB image/binary files stay
ignored/local, as required.

| Gate | Result | Evidence |
|---|---|---|
| All ten requested Mac subtree suites | PASS | `results/r7-grow/mac-suites.log` |
| Hyperlight adapter with explicit pinned source/worker/snapshot | 13/13 PASS | `hyperlight-adapter.log` (initial aggregate had documented SKIP; enabled rerun passes) |
| Grow portable tests + oracle tokenizer | 22 + 4 PASS | final source tests; aggregate log ran prior 20 + 4, two final discovery/parser regressions pass |
| Existing filesystem Linux differential | probe/Lua/QuickJS 30/30 each; bootstrap 3/3 | `fs-diff.json` |
| New-image executor certification | PASS; n=50 integrated certification breakdown | `executor-certification.log`, `executor-certification.json`, `executor-selection.json` |
| New-image parking | 1,000/1,000 exchanges; 0.0 CPU seconds / 10.010 s idle | `parking-0.json`, `parking.log` |

QuickJS, Lua, protocol, confinement and executor behavior pass their existing
checks on the new image. The parking run's load gate timed out under contention;
its functional exchange/idle result passes, and no latency target is claimed.

## Exact reproduction commands

Run from this worktree. Keep each run ID/directory new:

```sh
# Corpus prerequisite: reuse the exact census artifact, do not execute it on Mac.
TASK_INPUTS="$PWD/arch/jitk/grow/results/r7-reproduce-inputs"
mkdir "$TASK_INPUTS"
/Users/noah/code/sofort/kvm-dev/ssh.sh 'cat /home/dev/r6-census/sqlite3-static' > "$TASK_INPUTS/sqlite3-static"
chmod 755 "$TASK_INPUTS/sqlite3-static"
cp arch/jitk/grow/results/r7-grow/demo.db "$TASK_INPUTS/demo.db"
shasum -a 256 "$TASK_INPUTS/sqlite3-static" "$TASK_INPUTS/demo.db"

# Separate checksum-verified source build, only in kvm-dev, in an empty directory.
/Users/noah/code/sofort/kvm-dev/ssh.sh 'JITK_MUSL_CC=/home/dev/r6-census/toolchain/musl-install/bin/musl-gcc sh -s /home/dev/r7-grow/sqlite-reproduce' < arch/jitk/grow/sqlite-build.sh

export JITK_VMM_BINARY=/tmp/jitk-01/r3/darwin/jitk-vmm
python3 -B arch/jitk/grow/loop.py --run-id r7-reproduce --validate-only   --target fstat --target pread64 --samples 30   --sqlite-elf "$TASK_INPUTS/sqlite3-static" --database "$TASK_INPUTS/demo.db"
python3 -B arch/jitk/grow/loop.py --run-id r7-legacy-reproduce --samples 30 --validate-only
python3 -B arch/jitk/grow/sqlite_checks.py --run-id r7-diagnostics-reproduce   --sqlite-elf "$TASK_INPUTS/sqlite3-static" --database "$TASK_INPUTS/demo.db"
sh arch/jitk/kernel/build.sh

export JITK_NODE=/tmp/jitk-09/node-real
export JITK_NPM_CLI=/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js
export JITK_KERNEL_IMAGE="$PWD/arch/jitk/kernel/dist/kernel.bin"
export HYPERLIGHT_JS_SRC=/tmp/jitk-09/hyperlight-js
export HYPERLIGHT_WORKER=/tmp/jitk-09/adapter-target/release/r2-worker
export HYPERLIGHT_SNAPSHOT=/tmp/jitk-09/r3-snapshot
python3 arch/jitk/docs/delegate.py executor dependencies
python3 arch/jitk/docs/delegate.py mcp build
for t in kernel vmm vmm/sandbox protocol executor executor/policy mcp grow bench bench/hyperlight; do
  python3 arch/jitk/docs/delegate.py "$t" test || break
done
/usr/bin/lockf -k /tmp/sofort-bench.lock sh -c 'cd arch/jitk/executor && sh run.sh certify'
/usr/bin/lockf -k /tmp/sofort-bench.lock python3 arch/jitk/kernel/tests/measure.py park 0
```

The actual aggregate run additionally selected task-local VMM fixtures via
`JITK_TEST_IMAGES` and existing `JITK_VMM_BUILD=/tmp/jitk-01/r3/darwin`;
these do not select a different runtime binary. The initial full command had
HYPERLIGHT_JS_SRC unset; its separate enabled rerun supplies the value above.
No nested Linux suite was run by this agent (r7-suite owns it).

## Not done, scope and cleanup

This proves this **static immutable read-only SQLite corpus on developer
libkrun/grow-trace images**. It does not implement production ring byte streams
or production stderr, arbitrary stdout controls/Unicode/binary data, native MCP
`run`, dynamic ELF, SQLite extensions, temp spill, journal/WAL/locking, writes,
large/adversarial databases or full Linux ABI/metadata equivalence. The existing
production fd2-drop/printable-stdout contract remains. Live model generation for
the new handlers was not run. Metal performance and density were not measured.

No source changes outside the assigned write scope. No edits to ring.rs,
arch/, ring-bootstrap.js, build-ring.sh, shard/ or linux/. Required tests and
certification temporarily regenerated executor/protocol/VMM/test-work receipts;
these were archived in this scope and restored. **Lead action after merge:**
refresh the canonical kernel/executor `.READY` receipts for the merged artifact;
they are outside this agent's write scope and were not committed here. The
archived executor certificate names exactly the new image above.

Entire worktree disk use was 671 MiB at cleanup (includes inherited files and
all caches); task-owned VM source/build scratch peaked at 15 MiB and was removed,
leaving 4 KiB under `/home/dev/r7-grow/`. No VM restart/kernel change/cloud action.
The local pinned binary and >1 MiB images remain ignored; all committed evidence
files are <=1 MiB.

## Findings → recommended changes

1. **Use explicit target + semantic/mutation/integration gates for future
   growth.** First-missing names alone selected tolerated faccessat; the causal
   checks instead identify fstat followed by pread64. Keep repeated runs as
   stability evidence, not acceptance criteria.
2. **Land native byte/stderr/completion transport before broadening product
   claims.** Exact SQL errors are already verified through developer hex logs,
   but the production stream contract remains separate work owned by r7-rng.
3. **Adopt these two handlers for the bounded immutable profile.** No additional
   syscall implementation was needed here. Keep signal ENOSYS and tolerated
   faccessat/getpid profiles explicit; broaden DB size/query/error coverage
   before claiming general SQLite compatibility.
4. **Refresh merged artifact receipts and retain raw causal evidence.** Both
   default images have the same length despite different hashes. Certify the
   final merged image; do not reuse a historical `.READY` by filename or size.
