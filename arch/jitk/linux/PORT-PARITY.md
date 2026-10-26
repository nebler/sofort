# Linux TypeScript port parity

Baseline: parent of `96c09e93`, 2026-10-26. scriptc and the arm64 musl runtime
are pinned to 0.4.5 in package.json and package-lock.json. Mac arm64 builds use
clang; static Linux aarch64 builds use zig 0.16.0. Linux requires no Node.
No Rust source was changed. Raw logs, transferred binaries and reports remain
outside Git. `JITK_RECORD=1` and output.sh's READY/evidence rules are unchanged.

## Completed paired checks

| Check | Mac controller | kvm-dev | Comparison |
|---|---|---|---|
| build-probes | PASS | Linux artifact exercised by full suite | 3 BPF files, probe binary and input manifest byte-identical |
| build-faults | PASS | All 6 images exercised | 7 images byte-identical |
| stage-canonical | PASS | Same VMM hash in both full runs | VMM and build.json byte-identical |
| build-kernel | PASS | Final profile uses current e3d774eb… image | kernel.bin byte-identical; all input hashes equal |
| cpu-analysis | PASS | Same report input | Parsed JSON identical, including negative residuals |
| summarize | PASS | Same report input | report.md byte-identical |
| out/r7 analyzer | PASS | Historical final-1/final-2 inputs | Parsed summary identical; all original validation gates retained |
| watchdog injection | 5 tests / 16 assertions PASS | Static binary build verified | Stalls, duplicate progress, absolute gate/suite limits, silent startup, exits 0/7 |
| full SSH profile, Python vs TS | PASS | 17/17 gates each | Identical artifact hashes, gate order, counts and pass states; 0 children |

The paired full runs used the same existing staged inputs (kernel 75b2abe2…,
VMM f0483380…). Counts in each: 1,000 parking exchanges, 10 delayed replies,
0 stalls; smoke/tool smoke 1 each; 100 boots; 30 one-tool runs; 100 runs at each
concurrency 1–8; density 1/32/64/128/256 and 256 validated after parking;
100 setup-only and 100 bare-VM controls; 720 seccomp probes; 180 hostile guests
with 30 external watchdog kills. Each left zero owned children/cgroups.

The final in-place `make test` rebuilds the kernel from current sources and uses
the e3d774eb… image. Its result is recorded below after completion.

## Formats and normalization

All report fields, sample cardinalities, CPU attribution warnings, BPF bytes and
protocol assertions are retained. JSON comparison ignores whitespace, object key
order, and integer-vs-integral-float spelling. Live timestamps, PID/cgroup names,
loads, timings, resource/counter measurements and READY creation times cannot be
byte-identical across runs; compare their schemas and functional decisions.
CPU totals remain measured, and the guest split remains explicitly unverified.
Python traceback/exception wrappers become native diagnostic messages with the
same failure status; watchdog timeout diagnostics retain the original reason.

SSH receipts now hash/upload `linux-tools` instead of Python source files and
invoke its `watch` and `suite` subcommands. This is an intentional provenance
change; image, VMM and filter hashes stay authoritative. Remote directories are
private and removed only after success. No VM lifecycle change is made.

## Entrypoints and scope

All 17 tracked Python files are replaced. `output.py` becomes the OUT helper in
report.ts; the remaining original basenames are subcommands of `./tool.sh`.
`preflight`, `parking-check`, `reproduce` and `watch-cleanup-child` remain explicit
diagnostics. `run-qemu` retains its command and watchdog contract; the full live
validation uses the documented SSH backend. The obsolete QEMU Python stdlib
overlay is removed; nested/init runs the static binary.

`build-linux.sh` still invokes the other owner's `../vmm/build.py`; the kernel
build script still invokes its owner's artifact.py. Those files are outside
this port's allowed scope and must be switched by their owners. The aggregate
arch/jitk/Makefile and docs/delegate entrypoint were intentionally not edited.
