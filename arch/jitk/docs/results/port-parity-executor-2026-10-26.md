# Executor tooling parity

macOS arm64, scriptc 0.4.5, 2026-10-26. Compiler and runtime pinned in `arch/jitk/tools/`.

| Check | Python baseline | Native TS |
|---|---:|---:|
| Hostile shard fixture | 13 attack modes | queue bytes identical in Linux container |
| Helper-summary reducer | 2 phases × 2 repeats × 4 scales × 3 samples | equivalent numeric JSON |
| SSH transport (offline stub) | command + receipt/source hashes | same shell argv and fields |
| Local executor suite | existing Node suite | complete pass, including 6 Hyperlight cases |

Local suite uses verified JITK_NODE, integrated JITK_VMM_BINARY and the existing
/tmp/jitk-09 Hyperlight worker/snapshot overrides. Core suite has no Python
execution path. breakdown.ts calls the merged bench/build/gate 6 0 native CLI.

The fixture uses positional read/write on inherited memfd 3 (the same shared
pages as the host mmap), and eventfd 5 notifications. All 13 fault records,
producer/consumer words and payload bytes match Python. No-ready/backpressure
are covered by the final focused SSH suite. The fixture is cross-compiled as
static aarch64 musl and added explicitly to the transferred tar archive.

The SSH controller preserves scoped remote scratch paths, locked dependency
install, source hashes, timeouts and lock placement. It never manages the VM.
The lock encloses only shard-check/shard-bench, never shard make test. POSIX shell
quoting and tar metadata are normalized; .work/.scriptc are now excluded from
source discovery, and the native fixture is deliberately included. Native logs
capture stdout/stderr; transport parity used a local stub, not kvm-dev.

The privileged cgroup ledger was compiled but not sampled on the shared VM.
Its 2×4 scale loops, three samples, warm reads, cgroup charging, memory/smaps
fields, TERM/reap and cleanup remain in TS. The final focused SSH outcome is
recorded below after the single authorized run; it is not run twice for parity.

## Final single SSH invocation

After merging main (bench e487de60, grow 02a2bdaa), all local executor checks pass.
The SSH upload/setup initially stopped before the suite because macOS tar added
AppleDouble `._*.ts` entries. COPYFILE_DISABLE=1 now prevents this, discovery also
excludes `._*`, and the fixed archive was checked locally (208 intended entries,
including the static native fixture; no AppleDouble entries). Setup was resumed
at the failed build step without repeating cargo tests/install or managing VMs.

The one actual shard-check invocation then failed immediately at the existing
prepared-snapshot identity guard: `/home/dev/r7-ipc/prepared` has a stale helper
identity. No shared snapshot refresh and no second suite invocation. This is an
external-input limitation, not fresh passing IPC integration evidence. The
pre-suite transport/source checks completed before that constructor failure.
All 15 peer modes (13 attacks, no-ready, backpressure) separately match Python
in offline Linux-container parity, including exact queue bytes/credit behavior.
