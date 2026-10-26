# jitk-vmm

Area 01 wrote this launcher and its patch-only libkrun build; since R3 (v2 robustness swap) area 07 maintains `vmm/`. Area 07 owns
`sandbox/`; `src/confinement.rs` is the integration adapter. Before that
module's `.READY`, builds use a fail-closed stub and cannot launch a VM.

## CLI contract

```
jitk-vmm --image RAW [--mem-mib 32|64] [--seed HEX32] [--epoch-ns U64]
         [--wait-go] [--sandbox-profile FILE] [--netns-fd FD]
jitk-vmm --compile-profile OUT --images IMMUTABLE_IMAGE_DIRECTORY
```

`--image` is required and canonicalized before confinement. Memory defaults
to 32 MiB. Seed defaults to 16 OS-random bytes; explicit seeds are exactly
32 ASCII hex digits and normalized to lowercase. Epoch defaults to current
UNIX nanoseconds. The bootargs are exactly:
`jitk.seed=<hex> jitk.epoch_ns=<decimal> jitk.counter=<decimal>`.
Counter is the matching host virtual counter at epoch capture (macOS uses
`mach_absolute_time`, Linux uses `CNTVCT_EL0`). The default epoch uses the
least-preempted of five counter brackets. There is no arbitrary bootarg
or device configuration option.

fd0 and fd1 carry only console port 0 input/output. fd2 carries host diagnostics
and the exact line `{"sandbox":"ok"}\n`. **The supervisor must wait for this
host-only line AND the guest protocol READY before sending a run frame.**
Guest stdout can never satisfy the host acknowledgement. Keep fd2 as a pipe:
Linux's zero file-size rlimit forbids logging to regular files.

`--wait-go` writes `jitk-vmm: WAIT_GO\n` to stderr, blocks without creating a
VM, then consumes exactly one unbuffered byte from fd0. Its value is ignored;
all following bytes remain for the guest. EOF before go exits 70. On macOS
the sandbox ack precedes WAIT_GO; on Linux ack follows `build()` and final
seccomp installation. WAIT_GO does not mean guest READY or sandbox ack.

Fixed topology: one vCPU, one inout console, no default console, no optional
devices, nested virtualization disabled, shutdown support disabled. libkrun
also attaches its mandatory GIC and PL031 RTC. One process owns one VM and
must never be reused. No credentials are passed into the VM.

Exit 0 means SYSTEM_OFF, never a successful JS result; require a validated
protocol `done` frame. Exit 70 means CLI/setup/confinement failure. Exit 75
means a patched HVF guest-fault stop. Linux KVM error paths may exit 1.
Unexpected host panics abort (SIGABRT, or SIGSYS under Linux confinement).
The supervisor supplies an external wall-clock SIGKILL watchdog and reaps
every child; signals and deadline kills are never valid results.

## Build

Requires Rust 1.95.0, Python 3, git, make and a native C linker. Builds keep
the pinned libkrun checkout and all binaries outside the repository, under
`/tmp/jitk-01/r3/<platform>` by default (`JITK_VMM_BUILD` overrides this).
`LIBKRUN_SOURCE` may name a local git clone or a remote; the exact full commit
is always checked. No installed libkrun is used. Optional libkrun features
and FFI are disabled, rlib linked with fat LTO, stripped, and panic=abort in
both dependency and executable. The build emits `build.json` with hashes.

macOS aarch64 (Hypervisor entitlement is ad-hoc signed by the build):

```
.work/bin/build
/tmp/jitk-01/r3/darwin/jitk-vmm --compile-profile /tmp/jitk-01/r3/jitk.sbbin --images /absolute/images
/tmp/jitk-01/r3/darwin/jitk-vmm --image /absolute/images/kernel.bin --sandbox-profile /tmp/jitk-01/r3/jitk.sbbin
```

The trusted supervisor compiles the profile once on its current OS, before
launching workers. A profile rejection fails closed. Warm the signed binary
once after installation to absorb macOS's first-CodeDirectory scan.
Omitting `--sandbox-profile` uses area 07's compatibility path that compiles
the same policy inside the worker; production supervisors pass a profile to
avoid that per-VM cost. `JITK_VMM_TIMING=1` adds stderr setup timing on macOS;
it never disables confinement or changes stdout.

Linux aarch64: run `.work/bin/build` natively with `/dev/kvm` available for
execution (compilation alone needs no KVM). A Docker build and nested-KVM
verification use the same pinned patch build:

```
sh build-linux.sh
.work/bin/tests/nested-kvm
```

Docker uses `rust:1.95-slim` for `linux/arm64`; its writable mounts are confined
to `/tmp/jitk-01`. The nested test reads area 07's prepared
`/tmp/jitk-07/kvm/{vmlinuz,base.cpio.gz}` and writes a private overlay under
`/tmp/jitk-01/r3/nested`. It uses the same QEMU HVF `virtualization=on` setup.
On Linux, seccomp and Landlock are mandatory; unsupported Landlock fails
closed. An optional `--netns-fd` is closed after joining a supervisor-created
empty network namespace. The supervisor owns cgroup creation and places the
process with `clone3(CLONE_INTO_CGROUP)`, never a `cgroup.procs` write. Use
area 07's spawner for that deployment boundary. No cgroup migration occurs
inside this launcher.

## Patch provenance

`patches/series` applies to full commit
`a1d8616765da03980f3be1bb8714bfdd3842f33c` in order. `libkrun-robustness.diff` is area 07's
**v2**, a superset of v1. v2 adds these console fixes:
- A TX chain that yields 0 bytes is consumed instead of `undo_pop()`ed. Before, it was re-popped forever and a host thread spun at 100%: 5.8 CPU-s in 3 s wall on stock libkrun.
- An unusable RX chain (out of RAM, or zero-length) is consumed, so pending host input no longer causes a spin.
- A zero-length RX buffer is no longer misread as host EOF, which used to close the port.

`thread-hook.diff` is unmodified from area 07. `control-rx.diff` is area 02's
control-RX kick fix. `native-build.diff` only scopes the upstream Makefile to
the native library with a locked dependency graph, omitting unrelated init
and FFI artifacts. `raw-direct-load.diff` (kernel README "Read-only resources")
reads the RAW image directly into guest RAM instead of via a heap `Vec`. On macOS
that `Vec` stayed dirty in libmalloc and doubled the per-VM image cost (−2.8 MiB
footprint per VM; see `../kernel/RESULTS-fs.md`). Load behavior is otherwise unchanged. No experiment instrumentation ships.

## Tests
`make test` runs the 12 CLI checks plus 6 fault guests ×30. `tests/console-abuse.ts` runs 07's hostile console
guests (`fixtures/console-abuse.c`, modes 1–9: bad port ids, PORT_OPEN repeat/spam, TX outside/straddling RAM,
looping chain, host EOF, unusable RX chains) ×30 and records the reaped CPU time of every VMM. Every mode must
print `ALIVE <n>` and exit 0. The exception is mode 7 (host EOF; the guest idles in WFI), which must be stopped by the external
deadline with near-zero host CPU. `.work/bin/tests/nested-kvm` runs the CLI checks, the fault guests, console-abuse
and the seccomp probe under nested KVM, and asserts CHECKS-PASS, CONSOLE-PASS, SECCOMP-PASS and INIT-DONE.

**Outcome classes.** *clean exit* (0 SYSTEM_OFF, 75 HVF guest fault) and *contained by external watchdog* (SIGKILL
at the deadline, with the sandbox ack already seen) are distinct. Both count as contained when there is no host effect. On KVM the original
`bad-sysreg` is always watchdog-contained (KVM injects UNDEF into a guest that has no vectors). `bad-sysreg-handled`
is the clean-exit variant.

```
.work/bin/tests/build-guests
"/tmp/jitk-01/r3/darwin/jitk-vmm" --compile-profile /tmp/jitk-01/r3/jitk.sbbin --images /tmp/jitk-01/r3/images
.work/bin/tests/check
.work/bin/tests/sandbox-bench
```

All test child processes have external timeouts and are reaped. Evidence is
saved in `evidence/`, including the host uptime/load around measurements.
Nested KVM is functional evidence only, never a performance claim.
The Linux byte-preservation check uses a 1,000-byte polling echo fixture;
macOS retains the original 1,000 single-byte WFI fixture. The old HVF-specific
fixture stalls on KVM after one or two bytes and is not a Linux parking gate.
The qjs tool-call check uses the actual canonical kernel and its native wait path.
On KVM, the original `bad-sysreg` guest has no exception vectors and is stopped
by the test supervisor's explicit 500 ms SIGKILL deadline. Its outcome is
recorded as `watchdog: true`, never a clean exit. The additional
`bad-sysreg-handled` fixture uses the same instruction and requires an EC=0
UNDEF exception before shutting down through PSCI. HVF instead reports the
patched VMM guest-fault status 75 for the original fixture.

Formatting/lint gate (R8): `cargo +1.95.0 fmt --check` from this directory;
`.work/bin/lint` runs strict offline Clippy against the exact cached patched
libkrun artifacts selected by `JITK_VMM_BUILD` (same default as `build.ts`).
The Cargo manifest is for tooling; `build.ts` remains the signed production build.
Clippy and rustfmt components for Rust 1.95.0 are required. The gate includes
`-D warnings -D clippy::undocumented_unsafe_blocks`; the seccomp-only probe
allows unused launcher APIs locally because it intentionally excludes the CLI.

Native tooling is pinned to scriptc 0.4.5 in `../docs/package.json`. Run
`make tools` to compile the tools under `.work/bin/`. See `PORT-PARITY.md`
and `SCRIPTC-GAPS.md` for parity coverage and platform details.
