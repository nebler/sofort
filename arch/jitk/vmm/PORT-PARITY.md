# VMM tooling parity

macOS arm64, scriptc 0.4.5, 2026-10-26. Compiler/runtime pinned in ../docs.

| Suite / output | Python | Native TS |
|---|---:|---:|
| Main CLI + real QuickJS call | 12 checks, 180 fault runs | same |
| Console escape suite | 9 modes × 30 = 270 passes | same |
| FIFO oversized profile | 1 rejection before writer EOF | same |
| Confinement benchmark | 30 measured + 5 warmups | same |
| Guest fixture binaries | baseline SHA256 list | byte-identical |
| Pinned build | signed binary + build.json | byte-identical |
| Relink | signed binary + metadata | identical |
| Clippy | pass | pass |

`make test`, `make build`, native relink/lint and the three additional Mac
controllers were run. Native defaults put outputs in .work unless JITK_RECORD=1;
explicit --output/--out continue to work. Samples normalize elapsed timings,
load/CPU observations and environment-specific paths; checks/counts/pass criteria
are unchanged. Child CPU comes from linked getrusage(RUSAGE_CHILDREN), preserving
reaped-child accounting with finer precision than Python os.times' clock ticks.
Relink resolves /tmp to /private/tmp exactly as pathlib.resolve; parity caught
and corrected the path difference, which also changes Rust's binary identity.

`make linux-tools` builds static aarch64 musl build/check/console/seccomp programs.
The Linux build launcher uses a mounted native build tool, no Python package.
Nested initramfs stages native test executables, retaining the existing guest
command lines, timeout, serial markers and pass checks. gzip headers/CPIO ordering
are normalized format differences, not byte-identical compressed archives.

The nested QEMU run was not executed: the configured /tmp/jitk-07/kvm base.cpio.gz
and vmlinuz are absent. No VM lifecycle operation was attempted. All replacement
native cross-builds succeeded; this is not a claim of fresh nested KVM parity.
