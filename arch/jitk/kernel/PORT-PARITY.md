# Kernel tooling parity

macOS arm64, scriptc 0.4.5, 2026-10-26. Compiler/runtime pinned in ../docs.

| Suite / format | Python | Native TS |
|---|---:|---:|
| Build checks | 4 cases + 3 Rust executions | same |
| Packer/archive | 7 cases | 7 cases |
| Handler / filesystem harnesses | 1 Rust test each, assertions retained | same |
| Scratch cleanup | 2 cases | 2 cases |
| Functional checks | churn; 30 clocks; 30 timers; EOF; fragmentation; forgery; 5 atomic bytes | same |
| Common-counter clock | 30 samples, error bound <1 ms | same |
| Protection probes | 11 | 11 |
| Grow contracts | ioctl, ppoll, registered ENOSYS, deleted ioctl | same |
| FS differential | probe/Lua/QJS each 30/30; bootstrap 3 | same |
| FS resource benchmark | 0/1/8 MiB, 30 samples each | same |
| Lua ENOSYS profile | 30 samples | 30 samples |

`make test` passes in place with JITK_NODE=/tmp/jitk-09/node-real and
JITK_VMM_BINARY=/tmp/jitk-01/r3/darwin/jitk-vmm. Normal suites write ignored .work.
The delegate guard's status + staged/unstaged binary-diff snapshots are retained.

Packing qjs yields byte-identical payload.flat, packed.rs and packed.json.
Dispatcher, syscalls.json, features.json, argv.json and Rust argv are byte-identical
on the same root/input. The default kernel binary remains SHA256
`e3d774eb844f2cca9f1ba2b28c5b732c7ebc659e01dbafb0505d0d0f1d08b1f6`.
FS differential evidence agrees exactly after excluding uptime; stdout hashes,
syscall sets, counts and immutable tree hash agree. Resource RNG preserves
CPython Random(integer).randbytes bytes (two 256 KiB blocks for seeds 0/1/8
compared by SHA256). Durations, CPU/memory observations and temp paths naturally
vary. Rust test harness bodies were moved verbatim to fixtures/*.rs.

Lua's old grow receipt is absent in this checkout. Both harnesses were tested
against fresh Linux stdout from the unchanged jitk-oracle:08 image using the
same payload/fixtures; JITK_LUA_ORACLE selects it in TS. The Python parity harness
was patched only in memory to select that path. Both used the same host adapter
which removes only the integrated launcher's exact sandbox acknowledgement from
stderr (the original Lua test expects empty stderr). No oracle/stdout was faked.

The load gate uses the merged bench/build/gate CLI (6, budget .25, poll .1), built
by `make bench-gate`; it does not import Python. The usage and clock ctypes calls
are replaced with small C FFI bindings linked into native scriptc executables.

Contract refresh runs the complete scratch suite and verifies source/manifest
stability. Default output goes to .work/r8; only JITK_RECORD=1 replaces the
verification manifest/recorded receipt. Output/toolchain dirs are excluded from
its source snapshot. A full recording refresh was intentionally not performed.
The Linux-only results-fs checker requires privileged fixture staging on kvm-dev;
its Mac build was verified, but that privileged diagnostic was not run here.
