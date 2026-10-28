# jitk-shard: device-free nested-KVM spike

`jitk-shard` is a library with two CLI entry points, `real` (Linux) and `hvf`
(macOS). `snapshot`, `arena`, `inputs`, `payload`, `streams`, `entropy`, `hv`
and `slot` are portable; `kvm`, `owner`, `lease`, `ipc` and `ipc_service`
contain the Linux arm64 runtime, `hvf` the macOS backend (see "Hypervisor
seam" below). Shard-local UAPI constants live in `constants`, which re-exports
the ring and IPC ABI from the jitk-abi crate (`../abi`). Offline preparation,
fixtures, probes and measurement drivers belong to the `real` binary under
`src/bin/harness` (and `src/bin/hvf.rs`); they are not library modules. (The
synthetic ABI-v0 assembly baseline was deleted in R12; it is at tag
`pre-dead-code-2026-10-28`.)

Every build uses the one Rust pin, `rust_toolchain` in
[`../tools/deps.json`](../tools/deps.json) (`$(CARGO_PIN)` in make,
`../tools/rust-toolchain.sh` in shell); nothing uses a floating `stable`.
The pure library tests run on macOS without KVM, Linux headers or guest assembly:
`make test` (`cargo +1.95.0 test --locked --offline`; the native census check
below prints a skip line off Linux). Run
`cargo +1.95.0 clippy --locked --offline --all-targets -- -D warnings` and
`cargo +1.95.0 fmt --check` there too. Linux-only tests and the native corpus
still require the KVM gate below. Binary names and CLI commands are unchanged.

### Clean clone on Linux arm64 (kvm-dev)

```sh
make -C arch/jitk deps             # pinned Node, shard binary (cache)
make -C arch/jitk/shard snapshot   # prepared helper snapshots (cache)
make -C arch/jitk/shard test       # Rust tests + native census check
flock /home/dev/bench.lock make -C arch/jitk/shard test-kvm
sh arch/jitk/executor/ipc/shard-host.sh   # executor shard suite from the cache
```

Prerequisites: rustup with `rustup toolchain install 1.95.0 --profile minimal
--target aarch64-unknown-none` (the commands print it when missing), `cc`,
`clang`, `llvm-objcopy`, `flock`, network access on first use. No Node is
needed: `../tools/npm.sh` bootstraps the pinned one into the cache.

`make snapshot` ([`snapshot.ts`](snapshot.ts)) builds one ring kernel per arena
class (glue-2m, glue-4m) with the executor helpers spliced in before the QuickJS
checkpoint, prepares it with the cache shard binary, and stores it in the jitk
cache as `shard-snapshot/linux-arm64-<class>-<key>/helpers.{bin,mem,regs,layout,identity}`.
The key is `sha256(ring kernel image sha256, helper identity sha256)`, so the
directory is content-addressed. An index file
(`shard-snapshot/index/linux-arm64-<class>-<inputs>.json`, keyed by kernel and
helper sources, toolchain and class) lets consumers find the entry without a
kernel build. A present entry is reused only after its identity, file hashes and
kernel hash verify. `test-kvm` and the executor use these unless
`JITK_SHARD_TEST_SNAPSHOT(S)` / `JITK_SHARD_SNAPSHOT` are set. The shard binary is
not part of the key: a snapshot-format change must change the kernel or layout
(checked at load), or this is a stale entry (R9 N15's `abi_version`).

**R6 adds a separate real-kernel/QuickJS executable, `real`.** Its measured
results, build/reproduce commands, and remaining gates are in
[RESULTS-R6.md](RESULTS-R6.md); its versioned transport subset is specified in
[ABI-R6.md](ABI-R6.md). Build it with `cargo build --release --bin real` on
Linux/arm64.

**R7 implements the bounded real-kernel runtime.** See [RESULTS-R7-shard.md](RESULTS-R7-shard.md)
for measured limits, evidence and commands. The real executable uses four fixed
owner threads plus the main fixture reactor, and one independent watchdog process.
`JITK_SHARD_THREADS=1…available_cores` selects W. Every owner creates, runs, resets
and drops its own slots; WAIT holds no thread stack. The mixed stress uses the
architecture's initial 64-slot shard. `hold … N` explicitly permits larger
experimental shards (maximum 16,384); this is not a production admission decision.

The ring-only kernel packs mutable backing into a **1,310,720-byte physical
arena at GPA 0x81800000**, plus the original **81,920-byte rings/control** at
0x81d00000. Five stable KVM memslots cover the snapshot: both writable extents
and three immutable `KVM_MEM_READONLY` extents. Host `mprotect` also makes those
immutable extents read-only. No whole-RAM writable fallback is available on
restore. The offline trusted preparer can write the whole boot mapping, verifies
the layout marker, then creates a `.layout` sidecar alongside `.mem`/`.regs`.
Old R6/R7-RNG snapshots need preparation again; their memory layout is incompatible.

Only `transport-ring` moves kernel data, page tables and stack; user virtual
addresses stay unchanged. Ring page tables relocate ELF writable data, brk,
anonymous mmap and the 128-KiB user stack into the arena. The current profile
reserves 64 KiB each for ELF writable data and brk, a canary page, and gives mmap
the remaining space after the linked kernel. Anonymous mmap rejects excess with
ENOMEM. This narrow class does **not** fit the structured `json64k` fixture; it
returns the guest's out-of-memory error. It does not silently select a larger
class. Larger/native profiles need an explicit class/layout contract.

R7 integration adds a versioned `glue-4m` layout (2,883,584 writable arena
bytes). The native preparer selects glue-2m for
jq/SQLite/BusyBox/Lua and glue-4m for MicroPython/zstd; each prepared
snapshot identifies its class and restore verifies the embedded kernel marker.
See [ABI-R7.md](ABI-R7.md) for physical addresses and the identity format.
The default QuickJS class remains glue-2m. Late-bound native archives have their
own read-only stage-1 mapping and reserved read-only KVM memslot 63.

`make -C arch/jitk/shard test` runs the Rust tests **and**, on Linux, rebuilds six fresh
native profiles, checks the exact 41-case Linux differential twice, verifies
fd and relocation-boundary probes, and rejects a mismatched class sidecar.
It requires Linux arm64 KVM and the six pinned census binaries (static musl
builds from the R6 census, sha256-pinned in [`native.ts`](native.ts)). They
are 0.3–1.4 MB each and no upstream URL serves those bytes, so they are not
committed or fetched. They live in a content-addressed store,
`$JITK_NATIVE_CENSUS` or `<jitk cache>/native-census/<sha256>`, filled once with
`./tool.sh import-census FILE|CENSUS_DIR...` (it keeps only files whose hash
is pinned). While any is absent, the check prints `SKIP` naming the missing
tools and the import step. The SQLite fixture (8 KiB) is committed as
[`harness/census-demo.db`](harness/census-demo.db) with its hash. The full
`harness/run-r7-shard.sh` gate invokes it too, sharing the runner's outer
benchmark lock. Standalone `make test` takes its own measurement locks; when
already holding the lock, explicitly set `JITK_BENCH_LOCK_HELD=1`.
Set `JITK_NATIVE_ROOT` to the source tree (otherwise inferred from the harness),
and optionally `JITK_NATIVE_CHECK_OUTPUT` for retained regression receipts.
Preparation uses temporary snapshot files and never replaces an existing image.

Each started run has a monotonic `(shard pidfd, slot, generation, deadline)`
lease. The watchdog sleeps on lease-change eventfd/deadlines and the shard pidfd.
Expiry atomically fences the generation, signals the owner, and wakes its eventfd.
The signal handler sets only its current `kvm_run.immediate_exit` byte. An owner
kick yields to expiry processing, including when a different slot was spinning.
A deadline result is published after MMIO completion, RAM discard and register
restore. If reset is not acknowledged within **100 ms of the watchdog firing**,
a second generation-fenced CAS claims escalation and `pidfd_send_signal(SIGKILL)`
kills the shard. A reset cannot reuse a slot after escalation has claimed it.
The receiving reactor fails the shard closed on unexpected watchdog exit;
production supervision must also cover a stalled reactor/watchdog. No per-VM/call helper or
waiting thread is added. The reactor queues are bounded owner commands/events.
`ipc_service` bridges them to Node's bounded shared-memory policy IPC.

Real-guest commands (all emit JSONL):

```sh
real prepare KERNEL_IMAGE SNAPSHOT_BASE
real bench SNAPSHOT_BASE return2 200       # also one_tool, promise10, canary
real hold SNAPSHOT_BASE wait 1024 3        # READY / completed / failed states too
real hostile SNAPSHOT_BASE arena_attack 100
real hostile SNAPSHOT_BASE bomb 100
real stress SNAPSHOT_BASE mixed 10000      # 64 slots, three successful fixtures + tenant echoes
real deadlines SNAPSHOT_BASE spin 64       # common expiry, reset/error latency, clean reuse
real deadlines SNAPSHOT_BASE staggered 8   # 2W slots; parked expiry interrupts other spins
```

`attack_hold` is a measurement-only EL1 fixture: disable stage 1, read all 32 MiB (including immutable extents), dirty all 320
arena pages and 20 ring pages, then write immutable RAM; retain its stopped
private pages for cgroup accounting. Ordinary `arena_attack` errors reset first.
The existing R6 ledger harness works with the configured thread count and also
records cgroup `memory.peak`; its `spawn-cg` is built from
[`../linux/spawn-cg.c`](../linux/spawn-cg.c). `./tool.sh analyze-r7-shard`, `./tool.sh wait-r7` and
`./tool.sh escalation-r7` are offline observers, never runtime helper processes.

## Hypervisor seam (R10 #5) and the HVF backend

`slot::Slot<V: hv::Vm>` holds everything hypervisor-neutral: guest RAM over the
class regions (immutable extents read-only on the host and in the VM), bind,
the ring record decoder and reply path, and reset, admission sampling, trim
and verify with the pristine invariant (`slot/reset.rs`). `slot/tests.rs` runs
those state machines on any host with a fake backend. Behind the seam
(`hv.rs`):

| | KVM (`kvm/`, Linux) | HVF (`hvf.rs`, macOS) |
| --- | --- | --- |
| `Vm` | one VM fd per slot, memslots | one VM per process, so one slot per engine process |
| memory reset | pagemap: copy private pages + DC CIVAC, or `MADV_DONTNEED` | copy both extents + DC CIVAC (`MemoryReset::Copy`), or fresh mappings (`Remap`) |
| `Vcpu::run` | `KVM_RUN`, MMIO doorbell completed by `settle`, lease check + `immediate_exit` | `hv_vcpu_run`, doorbell data abort completed in place, CNTP RAZ/WI |
| register file | `KVM_GET_REG_LIST` ids (`JTKREGS2`) | recorded table, probed at startup (`JTKHVF02`) |
| kick | lease signal | `hvf::Kicker` (`hv_vcpus_exit`) |

`kvm::Slot` is `Slot<KvmVm>` with the same constructors, labels and call order
as before; the native worker stays KVM-only.

On macOS arm64, `make snapshot` builds the same two classes as on Linux, prepared
by the `hvf` tool (darwin-arm64 cache entries; `.mem` has KVM's format, `.regs`
is HVF's). `make test-hvf` runs `src/hvf/tests.rs` on them (~4 s warm; signed
by `hvf-run.sh`): corpus `return 2` / `one_tool` with a byte+register verify
after every reset, the spike's leak mix (globals, arena dirtying, OOM, canaries),
`kick`, the hostile cache-off check, non-executable writable extents, the
register probe, and host writes to immutable RAM.

**Register coverage (risk 2).** HVF has no register enumeration, so the first
vCPU of a process probes every core, SIMD and system register id on a
throwaway vCPU (~2 ms) and fails closed unless the result equals
`hvf::SYS_REGISTERS` (`probe_check_fails_closed`). On macOS 26.6.1 / M4 Pro that
is 173 system registers: the spike's 107, the 13 VMM-settable ID registers, and
53 undocumented implementation-defined ones (S3_4_C15_\*, S3_6_C15_\*). Those
53 cannot be restored: any write, even of the value just read, makes the next
`hv_vcpu_run` fail with `HV_UNSUPPORTED`. They are `Checked`: every guest MSR
and MRS to them traps to the VMM (`impdef_registers_are_out_of_guest_reach`),
and the verify compares them with their values at vCPU creation.

**Reset vs a cache-off guest (risk 1).** Measured on the M4 Pro: a guest with
its MMU and caches off sees the host's uncleaned stores, and the host sees all
of its stores, so data was coherent in both directions. What was stale is
instruction fetch: after a reset that keeps the physical pages, a fixture ran
the previous fixture's code from the I-cache in 6–14 of 40 runs (0 with an
I-cache invalidate or fresh pages). That is what the spike's unfinished check
tripped over. Now:
- the writable extents are mapped without execute permission (`Region::Writable`),
  so no instruction fetch, and no I-cache line, ever comes from tenant-writable
  memory (`writable_extents_never_execute`; fixtures get one executable page
  until the next reset);
- the default reset copies both extents and cleans every line to the point of
  coherency (DC CIVAC, which macOS executes at EL0; `sys_dcache_flush` is a
  no-op). It relies on the architectural DC CIVAC definition, not on the
  coherency measured above. `Remap` relies instead on XNU handing a VM only
  pages that are coherent at PoC, which XNU needs for its own isolation.

glue-2m, `return 2`, p50 over 1,000 runs, M4 Pro at load 5–6 (`hvf bench`):

| reset | reset | run | run + reset |
| --- | ---: | ---: | ---: |
| spike (memcpy only, unsafe for instruction fetch) | 29 µs | 24 µs | 53 µs |
| **Copy + DC CIVAC (default)** | 71 µs | 24 µs | **96 µs** (one_tool 107 µs) |
| Remap (fresh mappings; next run refaults) | 22 µs | 190 µs | 212 µs |

For the record, DC CIVAC over the 1.39 MiB is ~42 µs, an I-cache invalidate
(`sys_icache_invalidate`) ~90 µs; the non-executable mapping makes the latter
unnecessary.

`json64k` on the helper snapshots ends in `guest_fatal` (out of memory, then
no completion) on HVF and on KVM alike, with this branch's `real` and with
the previous one (`real hostile BASE json64k` on kvm-dev): the harness's
`hostile json64k` expectation of an out-of-memory result is stale for helper
snapshots. The HVF mix expects what KVM does.

Open: the kernel should `tlbi vmalle1` (risk 3) and could `ic ialluis` once
the CHECKPOINT doorbell returns. KVM has no per-memslot execute control, and
its copy path keeps the physical pages, so a tenant's arena code can survive in
the I-cache there too, unless the CPU has CTR_EL0.DIC. A kernel `ic ialluis`
would close both. Not done here: it would change `kernel/.READY`.

## Native TypeScript harness

`make build build-linux` builds the pinned scriptc 0.4.5 tools for Mac and static
Linux aarch64 musl, including the kernel's `.work/linux/prepare` and
`.work/linux/build-args` needed by the native image builds. Set `ZIG` to override
the linker installation. Uploading `build/linux/shard-tools` and both kernel
Linux tools is optional: on Linux, `tool.sh` uses an uploaded cross-build when
present (kernel tools through `JITK_TOOLS_DIR`; an explicit override is still
honored), and otherwise builds `build/native/shard-tools` and the kernel's
`.work/bin` tools natively with the same scriptc pin.
These tools need neither Node nor Python at run time. `./tool.sh NAME ARGS...`
replaces each Python command using the basename without `.py` (for example
`./tool.sh check-native-r7` or `./tool.sh summarize results`). Generic helpers and
lock composition come from `../tslib/` through `lib.ts`. `make test` still takes its own measurement
locks (`JITK_BENCH_LOCK`, default `/home/dev/bench.lock`); never put another
lock around it. `test-kvm` expects the caller to hold that lock and takes the
snapshots from the cache (`make snapshot`) unless the variables are set.
See `PORT-PARITY.md` and `SCRIPTC-GAPS.md` for comparisons and compiler workarounds.
