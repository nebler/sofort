# 08 — Grow a measured ABI contract, not a list of syscall names

Read `../BRIEF.md` completely. Experiments: 2026-10-24, Docker Desktop
linux/arm64, Linux 6.10.14-linuxkit, strace 6.13, native Rust 1.85.0.
All source/results here; private builds and the demonstration Git repo are in
`/tmp/jitk-08/`. `/tmp/jitk-spike` was read-only.

## 1. Concrete design for this area

**Recommendation:** a development-only, fail-closed transaction:
`discover → Linux oracle → propose one handler → build → differential gate → commit`.
Production executes an immutable kernel/QuickJS/manifest bundle. It never invokes an
agent, compiler, Docker, or automatic growth. Cache oracle runs by binary + fixtures
+ argv + stdin + environment + oracle image + trace/profile version; deduplicate
work by kernel commit + syscall number + argument discriminator (e.g. ioctl request).

### Transaction and ownership

1. Start the guest with exact fixtures, bounded stdin, deterministic tool responses,
   fixed argv/env/cwd/auxv and resource budget. Start tracing before EL0 execution.
2. An **unregistered** handler emits `missing(nr,x0..x5,pc,seq)` and returns -ENOSYS.
   The harness stops that disposable run at the first missing event. An implemented
   handler deliberately returning ENOSYS emits an ordinary exit, avoiding a growth loop.
   Discovery must include unsupported argument variants of registered syscalls.
3. Run that same static ELF and inputs on native arm64 Linux in the oracle container.
   Include the native successful/error probes for the selected syscall, the relevant
   Linux ABI spec, manifest, source, trace and failure in the agent brief. Workload
   strings and trace contents are data, never instructions or tool permissions.
4. A headless CLI returns a structured patch. The controller materializes **only**
   regular files under `kernel/src/syscalls/*`, ideally the one selected module.
   Pre-generated dispatch slots and a fixed handler API avoid editing traps, MMU,
   VMM, Cargo files, policy, or the verifier. Tests inside the module are permitted;
   independent conformance fixtures and acceptance criteria remain controller-owned.
5. Compile cleanly with locked dependencies in an unprivileged, offline, credentialless
   builder. Run selected native probes first, handler tests/fuzz second, then fresh
   guest probes and the entire supported workload corpus. Any mismatch rejects the patch.
6. On pass, the controller commits handler + generated manifest + evidence receipts
   atomically on the development branch. Rebuild identity includes that commit.
   On reject, retain trace/diff and reset the candidate. Bound retries (proposal: 3),
   wall time, output size, and new surface; repeated identical misses stop for review.

The agent process holds its own API credential; **the builder, oracle and guest do
not**. Give the agent read-only context and patch-output authority, not a writable
repository shell. Validate paths, symlinks, hardlinks, modes, new/untracked files and
changed-file allowlist before building. A source filter alone is not a sandbox.
No generated code can change tests, tracing rules, allowlists or syscall specs.

### Console and trace format

One virtio-console can carry length-bounded frames with an envelope written only by
EL1. `write/writev` wrap EL0 output as `stdout`/`stderr` byte payloads; EL0 must never
write an arbitrary top-level console frame. Otherwise JS could forge `missing` or
trace records with a JSON print. Kernel frames are still untrusted input to the host
parser; cap lengths/counts and reject malformed, out-of-order or incomplete records.
Tool calls remain schema-checked and policy-checked independently of growth events.

Guest **wire format** (development tracing feature, absent from production):

```json
{"v":1,"kind":"sys.enter","seq":40,"tid":1,"nr":29,"args":[1,21523,140000,0,0,0]}
{"v":1,"kind":"sys.exit","seq":40,"ret":-25,"mem":[]}
{"v":1,"kind":"missing","seq":41,"nr":999,"args":[0,0,0,0,0,0],"pc":4194304}
```

`mem` entries specify argument/iovec index, offset, direction (`in`/`out`), length,
and bytes encoded as hex, chunked with a final marker. Copy input before dispatch
and output after dispatch through checked user-memory helpers, never raw dereference.
For read/readv, collect exactly the positive returned byte count across iovecs;
for write/writev collect supplied input; for paths collect the NUL-terminated bytes;
for structures collect defined ABI fields, excluding padding. Errors must not turn
tracing an invalid pointer into a kernel fault. Native probes check untouched memory.

Both host adapters produce the same **canonical JSONL v1**, demonstrated here:

```json
{"v":1,"seq":40,"tid":"T0","nr":29,"name":"ioctl","args":["1","0x5413","P2"],"ret":-1,"errno":"ENOTTY"}
{"v":1,"seq":41,"tid":"T0","nr":66,"name":"writev","args":["1","[{iov_base=\"\\x68\\x69\\x0a\", iov_len=3}]","1"],"ret":3,"errno":null}
```

These are the actual tokenized format of `oracle/normalize.py`: argument tokens
retain all decoded strace byte strings, iovec lengths, scalar values and flags.
The guest adapter uses syscall metadata + captured buffers to render those same
canonical tokens. Raw guest negative errno becomes `{ret:-1,errno:"..."}`; exit_group
has null return and a separate process exit receipt. Preserve raw traces as evidence.
A future typed schema can replace textual structure tokens; bump adapter version.
**UNVERIFIED:** the real guest wire emitter/adapter is designed, not implemented here.

Normalization removes OS PID/TID identities, retaining stable logical identities;
file descriptors use allocation order (0/1/2 reserved), not path-name guesses.
ASLR becomes allocation ID + byte offset; lengths/protection/flags remain exact.
The sketch handles mmap/mremap regions and brk offsets; anonymous pointers use
stable P tokens. It does not fully model unmap lifetimes, FD reuse, or arbitrary
pointer graphs. That is sufficient for the measured single-thread errno proxy,
**not proof of guest memory correctness**. Real acceptance needs the region-aware
adapter plus invalid-pointer/canary probes. Unsupported parsing fails closed.
`execve` is a Linux harness loader event: retain in evidence, exclude from the
in-guest ABI sequence. Match initial memory layout through auxv/loader fixtures.

### What equivalence means

Default **strict conformance**: same ordered syscall events, scalar arguments,
flags, buffer lengths, defined input/output bytes, return scalar or mapped address,
errno, stdout/stderr bytes, tool-call transcript and exit/signal outcome. Match
partial I/O, EOF, signed offsets and error precedence. `brk` failure returns the old
break, not the generic -ENOMEM rule. No wildcard for unexpected syscalls/errors.
Do not silently drop unknown trace lines, signals, truncation, or missing exits.

Nondeterministic data needs an explicit test mode, not blanket deletion:

- ASLR addresses and PID/TID: bijective identity/offset mapping; preserve aliasing.
- Time/random: replay a recorded input tape for syscall conformance; compare clock
  ID, flags, size, result shape and progression constraints in live smoke tests.
  Do not mask randomness-derived output or tool arguments. A deterministic JS
  prelude is adequate for a workload fixture, not for validating clock/getrandom.
- Linux's vDSO hides calls. Disable AT_SYSINFO_EHDR for coverage runs; measure ordinary
  oracle performance separately. `oracle/no-vdso.c` demonstrates this on the real ELF.
- Fixed filesystem fixtures, cwd, stdin delivery schedule, timezone and env are
  part of the case. No host network, credentials, mutable `/proc` or wall-clock
  observations in reproducible fixtures. NG allocator OS probes need explicit policy.

**Profile conformance** permits a declared partial ABI (e.g. no terminal, read-only
virtual files). The manifest specifies the exact domain and errno, and a Linux
fault-injected oracle checks that profile. Also require equal application/tool
results against unmodified Linux. Approved fallback sequences can differ only by
an explicit, reviewed relation; strict comparisons remain strict. Never accept a
new stub solely because the JS printed the expected answer. The ioctl demonstration
matches unmodified Linux exactly; the mremap fallback experiment does not.

### Tests, fuzzing, and the public artifact

Every supported argument domain needs native Linux probes and the same guest probes:
empty/short buffers, partial I/O, EOF, invalid fd, invalid flags, integer overflow,
unmapped/read-only/cross-page pointers, overlapping iovecs, errno precedence,
budget exhaustion and untouched-buffer canaries. Invalid-memory tests run inside
the VM; handler unit tests use an abstract checked UserMemory implementation.

Use gVisor's native-first compatibility-test discipline [2]. Reuse selected LTP
syscall cases/semantics [4], adapted into static single-process probes; don't
pretend the full LTP harness runs on this kernel. Generate bounded syscall sequences
from a syzkaller-style typed description [3] on the host, transport into fresh VMs,
record seeds, shrink failures, and retain regression cases. Run boundary corpus on
every candidate; bounded fuzz on every commit and longer campaigns offline.
**UNVERIFIED:** real-guest fuzzing and imported LTP/gVisor tests have not run.

`syscalls.manifest.json` is a real **evidence-only** artifact from these runs, explicitly
marked not yet kernel-verified. A promoted manifest must include architecture/ABI,
semantic surface version, kernel/ELF/bootstrap hashes, oracle OCI digest, adapter
version, exact argument domains, partial/stub/full status, errno rules, fixture/test
hashes, fuzz receipt, accepted commit and forbidden interfaces. Enforceable policy
comes from that manifest, never just a count. Additions bump minor; behavior changes,
removals or tighter domains bump major; evidence-only changes bump patch. A revoked
policy produces a new bundle. The demo is a manifest diff showing one verified
contract added, backed by a rejected-before trace and passing-after receipt.

## 2. Code sketches — real files and commands

- `oracle/Dockerfile`: pinned Alpine base, native strace/Python; toolchain for probes.
- `oracle/run.sh`, `entry.py`: binary + argv + stdin runner, no network, read-only root
  and fixtures, uid 65534, all capabilities dropped, no-new-privileges,
  512 MiB/1 CPU/16 pids, 20 s process timeout, 32 MiB per-file limit.
- `oracle/normalize.py`, `test_normalize.py`: strict token adapter, four decoder tests.
  `-f -qq -v -X raw -xx -s 1048576` keeps flags numeric and bytes unambiguous.
  Unexpected threads, signals, truncated strings and unknown syscall numbers reject.
- `oracle/suite.py`: six corpus cases; optional result label and fixture directory.
- `oracle/no-vdso.c`: ptrace auxv rewrite + native syscall-entry counter.
- `oracle/build-ng.sh`: v0.17.0 musl static build with mimalloc disabled.
- `proxy/loop.py`: missing → native oracle → headless Codex JSON patch → allowlist →
  rustc rebuild → tests/fuzz → injected candidate → differential gate → Git commit.
- `proxy/kernel/src/syscalls/ioctl.rs`: ENOSYS seed. `proxy/driver.rs`: trusted runner
  and four tests. `results/proxy/accepted.rs`: agent-produced accepted implementation.
- `proxy/compare.py`: byte-exact trace/stdout/stderr comparison plus exit/ELF/arch.
- `results/*`: raw strace, canonical JSONL, stdout, stderr and provenance per run.
  `results/oracle-image.json`, `oracle-image-final.json` and `oracle-packages.txt`
  identify the measured corpus and final proxy images.

From the workspace root:

```sh
D=arch/08-grow-loop
mkdir -p /tmp/jitk-08
cp /tmp/jitk-spike/sc/qjs-static /tmp/jitk-08/qjs-static
docker build --platform linux/arm64 -t jitk-oracle:08 "$D/oracle"
python3 -B "$D/oracle/suite.py" /tmp/jitk-08/qjs-static
python3 -B "$D/oracle/test_normalize.py"
# Requires configured CLI auth in the private CODEX_HOME, never in the builder.
JITK_PROXY_RUN_DIR=/tmp/jitk-08/new-loop python3 -B "$D/proxy/loop.py"
```

The Docker image contains compiler tools for this spike; split oracle/build images
later. Base is digest-pinned; APK package receipts are captured but package download
repositories remain mutable. Preserve/publish the built OCI digest for exact replay;
rebuilding that Dockerfile in the future alone is not a reproducibility guarantee.
The strace adapter supports this single-process ABI, not general strace syntax.

## 3. BLOCKERS — experiments, commands, results

### (a) ELIMINATED: native arm64 machine-readable oracle

Command: `python3 -B arch/08-grow-loop/oracle/suite.py /tmp/jitk-08/qjs-static`.
All six exit 0. Same original hello.js/codemode.js and canned stdin as the spike.
Hello: **70 events / 12 names**. Codemode: **93 / 15**.
ELF SHA256: `d87997d1e249c8dd15e6b7a2f9a8c4932612a023a17b8b2d21e8359739a580e9`.
Full normalized output: `results/hello/trace.jsonl`, `results/codemode/trace.jsonl`.
Selected actual hello records (whole event objects):

```json
{"v":1,"seq":1,"tid":"T0","nr":96,"name":"set_tid_address","args":["P0"],"ret":"T0","errno":null}
{"v":1,"seq":2,"tid":"T0","nr":214,"name":"brk","args":["NULL"],"ret":"HEAP+0","errno":null}
{"v":1,"seq":3,"tid":"T0","nr":214,"name":"brk","args":["HEAP+8192"],"ret":"HEAP+8192","errno":null}
{"v":1,"seq":40,"tid":"T0","nr":29,"name":"ioctl","args":["1","0x5413","P2"],"ret":-1,"errno":"ENOTTY"}
```

Two setup failures were fixed and rerun: nested binary bind mount needed an existing
placeholder under the read-only fixture mount; Docker's `ulimit fsize` value was
bytes, so 32768 truncated JSON output. Corrected to 33554432; no partial trace accepted.

### (b) ELIMINATED: broader corpus measurement; added surface is bounded here

Same suite command, source files in `workloads/`:

- `json-heavy.js`: 12,000 objects, JSON roundtrip + Map aggregation; **551 / 13**.
  Output `{"count":12000,"groups":71,"sum":71994000}`. Adds **mremap**, called 8 times;
  265 mmap and 264 munmap calls, cumulative requested mmap length **25,518,773 B**.
- `time-random.js`: 100,000 Date.now + Math.random pairs; **78 / 12**.
  Output has `ok:true`, `randomMeanInRange:true`, epoch ISO string. No visible time
  syscall under strace; that observation alone is incomplete coverage.
- `loadfile-arrays.js`: load/parse 1,000 records plus sixteen filled 4 MiB typed arrays;
  **154 / 14**, output `{"records":1000,"bytes":67108864,"checksum":240}`.
  67 mmap calls; largest requested mapping 4,194,332 B. No new syscall beyond the union.

Union including launch: **16** — `brk close execve exit_group getcwd ioctl lseek mmap
mremap munmap openat read readlinkat readv set_tid_address writev`.
Drop launcher execve, add the experimentally exposed clock_gettime: **16 guest calls**
for this ELF/corpus. This is observed coverage, not a universal upper bound.

Command (after compiling `no-vdso.c` in the oracle image):
`/work/no-vdso /work/qjs-static -e 'print(Date.now(), Math.random())'`.
Result: cleared one AT_SYSINFO_EHDR, exit 0, **nr 113 clock_gettime twice**, no nr 169.
See `results/no-vdso.txt`. Although QuickJS source calls gettimeofday [6], this musl
binary reaches clock_gettime at the kernel ABI. The brief's hidden-clock claim holds.

Command: `INJECT_SYSCALL=mremap INJECT_ERRNO=ENOSYS "$D/oracle/run.sh"
/tmp/jitk-08/qjs-static "$D/workloads" "$D/results/mremap-enosys"
"$D/workloads/empty.stdin" json-heavy.js`.
Result: **8 ENOSYS**, exit 0, identical stdout; **567 events**, 273 mmap + 272 munmap,
29,548,760 requested mmap bytes. Strict trace gate rejects. A measured partial ABI
could keep mremap stubbed; it spends ~4.03 MB more cumulative mapping requests here.
This is not a peak-memory or latency measurement.

QuickJS-ng: downloaded official **v0.17.0** aarch64 static PIE; also ran
`sh "$D/oracle/build-ng.sh"`, building static musl with mimalloc OFF [5].
Command for each: `python3 -B "$D/oracle/suite.py" BINARY LABEL workloads-ng`.
Both pass all six cases after changing only imports from `std` to `qjs:std`.
Unchanged imports initially failed (exit 1); retained under `results/ng-{musl,official}`.
Corrected evidence: `results/ng-{musl,official}-compatible/summary.json`.
Official build: **19 names**, hello 40 events, all-corpus union also 19; adds allocator
sysinfo/getrandom/faccessat/madvise/mprotect/rt_sigprocmask and `/proc`/`/sys` probes.
The trace includes a **1 GiB virtual mmap request**; this is not 1 GiB resident use.
Musl/no-mimalloc: **16 names**, hello 105 events; same union as Bellard.
Auxv-disabled NG runs also expose nr 113 (3 calls musl, 25 official):
`results/no-vdso-ng-{musl,official}.txt`; guest totals remain 16 and 19 respectively.
Binary hashes are in every receipt; syscall count is a build property, not an engine brand.

### (c) ELIMINATED: one complete pre-kernel iteration

Command: `JITK_PROXY_RUN_DIR=/tmp/jitk-08/loop-final python3 "$D/proxy/loop.py"`.
Proxy choice: **strace ptrace fault injection driven by a compiled pure Rust errno
handler**. Native execution avoids QEMU translation noise and installing all of gVisor.
This is sufficient to exercise missing-event discovery, agent patching, build,
negative/positive gates and commit. It is not an EL1 syscall emulator.

Before: handler -38 drives `inject=ioctl:error=ENOSYS`. Missing event nr 29/TIOCGWINSZ.
Unmodified Linux oracle returns ENOTTY. Headless **Codex CLI 0.164.0** receives the
specification, source and trace and returns the replacement Rust JSON, with read-only
sandbox and ephemeral session. Controller writes only the allowed handler file.
After: rustc builds; **4 tests pass, including 10,000 deterministic scalar fuzz cases**;
handler -25 drives ENOTTY injection. Exact **70-event** trace/stdout/stderr/exit match.
A static native Linux probe confirms fd -1/3 → EBADF and 0/1/2 → ENOTTY on non-TTYs.
Broken ENOSYS candidate had identical stdout and was correctly rejected on trace.
Private atomic handler + generated-manifest commit: `25278beba9ca7be793f88a358e68f0444db16809`.
End-to-end wall time: earlier iteration **26.708 s**; final manifest-committing
rerun **133.607 s**. Each is one observation including containers, CLI and compilations;
neither is a guest latency benchmark. Evidence: `results/proxy/{report.json,agent.log,
patch.diff,tests.txt,before,oracle,after}`. The full earlier iteration also passed.

### Additional blocker eliminated: nondeterministic differential fixtures

Commands: rerun codemode and codemode-deterministic with `oracle/run.sh`; compare
with `proxy/compare.py`. Original codemode differs in trace **and stdout** across
Linux runs (Math.random changes the comment). Fixed Date.now/Math.random fixture:
**97 events, exact match**. Results in `results/comparisons.json`.
Child tracing also succeeds with **all capabilities dropped**, exit 0 and 70 events
(`results/no-ptrace-cap`); the final runner needs no SYS_PTRACE capability.
Four normalizer tests pass: ASLR invariance, changed brk size rejection, mapping
offset retention, buffer bytes/errno retention, fail-closed malformed/truncated input.

### REMAINING / UNVERIFIED (attempts and limits)

- **Real EL0/EL1 transport, copyin/out and VM differential run:** no booting jitk kernel
  exists in this task's inputs. The complete proxy transaction above removes harness
  boot dependency, but cannot prove traps, page permissions, buffer effects or isolation.
- **Full decoder equivalence:** prototype passes this corpus and deterministic-repeat
  tests; cannot certify arbitrary structs, FD/VM lifetime reuse or signal behavior.
  Fail-closed parsing and raw receipts constrain the gap; production adapter work remains.
- **Kernel fuzz/conformance coverage:** attempted scalar handler fuzz + native errno
  probes, not syzkaller/LTP/gVisor execution. Full tools need an executor ABI and more
  Linux facilities than jitk provides. Use the bounded host-generated probes proposed above.
- **Strict equivalence versus deliberate partial ABI:** measured mremap failure changes
  sequences and costs. Manifest/profile policy must resolve this explicitly; no automatic
  broadening or false strict pass. Reclaiming munmap semantics remain other areas' work.

## 4. What I'd cut

No online production growth, general Linux syscall grammar, QEMU/gVisor installation
in the main grow path, full LTP/syzkaller in-guest runtime, multi-agent voting, or
automatic host networking/filesystem support. Pin musl/allocator build. Keep replay
fixtures and a small typed probe corpus. Disable tracing in measured production images.
Use the existing CLI, Docker and Git; do not invent an agent orchestration platform.

## 5. Open disagreements with the brief's consensus, with evidence

- **A trace-derived syscall count is neither a necessary nor sufficient implementation
  list.** mremap adds one observed name but ENOSYS preserves application results with
  changed cost; vDSO hides clock_gettime. Loupe's stubbing/faking analysis is the right
  precedent [1], rather than blindly implementing every observed syscall.
- **A universal byte-for-byte trace comparison conflicts with partial stubs and fixed
  guest environment.** Our mremap fallback passes output but fails trace. Define strict
  and declared-profile conformance separately; never silently weaken the comparator.
- **A no-reclaim bump allocator is a workload restriction.** Only 12,000 JSON objects
  cause 265 mmap/264 munmap calls, and a valid typed-array workload needs 64 MiB live
  buffers. Those measurements challenge an unqualified density/simplicity claim.
  We have not measured peak RSS or a reusable allocator's kernel LOC.
- **“Static QuickJS” does not identify an ABI surface.** Official NG uses 19 names and
  OS allocator probes; the same release built without mimalloc uses 16. Pin artifacts.
- **Tagged JSON lines require trusted framing.** Untrusted JS can print any tag;
  wrapping EL0 writes in EL1 frames is necessary for trace provenance. This is a
  design argument; the actual console implementation is UNVERIFIED here.

## 6. Est. LOC

Delivered executable/script sketches: roughly **350 LOC**, excluding JS fixtures,
JSON receipts and this document. UNVERIFIED production estimates: controller/adapters
600–900 LOC; syscall specs/native probes/fuzz 400–700; trace emitter 80–150 kernel LOC,
compiled out of release. Grow tooling is outside the 1–1.5k guest-kernel budget.
A complete safe memory/FD canonicalizer may exceed these estimates; do not hide it.

Sources: [1] [Loupe, ASPLOS'24 paper](https://owl.eu.com/papers/loupe-asplos24.pdf)
and [reproducible artifact](https://github.com/unikraft/loupe);
[2] [gVisor native-first syscall tests](https://github.com/google/gvisor/blob/master/test/syscalls/README.md);
[3] [syzkaller typed syscall descriptions](https://github.com/google/syzkaller/blob/master/docs/syscall_descriptions.md);
[4] [LTP individual tests](https://linux-test-project.readthedocs.io/en/latest/users/quick_start.html);
[5] [QuickJS-ng v0.17.0 build options](https://github.com/quickjs-ng/quickjs/blob/v0.17.0/CMakeLists.txt);
[6] [QuickJS time/random implementation](https://github.com/bellard/quickjs/blob/master/quickjs.c);
[7] [strace tracing/injection options](https://man7.org/linux/man-pages/man1/strace.1.html).
