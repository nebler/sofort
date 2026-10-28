# jitk-shard: device-free nested-KVM spike

`jitk-shard` is a library with two CLI entry points. `snapshot`, `arena`,
`inputs`, `payload`, `streams` and `entropy` are portable; `kvm`, `owner`,
`lease`, `clock`, `ipc` and `ipc_service` contain the Linux arm64 runtime. Shard-local
layout and UAPI constants live in `constants`. Offline preparation, fixtures,
probes and measurement drivers belong to the binaries under `src/bin/harness`
and `src/synthetic`; they are not library modules.

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
[ABI-R6.md](ABI-R6.md). The original `jitk-shard` binary and v0 description below
remain the assembly-fixture baseline. Build both with `cargo build --release` on
Linux/arm64, or select `--bin real` / `--bin jitk-shard` explicitly.

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
records cgroup `memory.peak`. `./tool.sh analyze-r7-shard`, `./tool.sh wait-r7` and
`./tool.sh escalation-r7` are offline observers, never runtime helper processes.

The assembly-only baseline below retains its separate ABI and implementation.

Independent Linux/arm64 Rust crate for architecture gates 2, 4 (basic), and 5.
This runs an assembly fixture, **not jitk, QuickJS, or tenant code**. It has no
GIC, virtio, guest timer, guest interrupt delivery, WFI parking, or HVC transport.
`KVM_ARM_VCPU_PSCI_0_2` is enabled as in `kvm-dev/smoke/kvm-smoke.c`.
There are no Cargo dependencies. The ioctl numbers, ONE_REG ids and `kvm_run`
offsets are checked in (`src/kvm_abi.rs`, generated by `abi-gen.ts` from the
UAPI encoding rules; `make abi`), and `tests/kvm_abi.rs` compares them with the
host's installed headers on Linux. The build needs no C compiler.

One process has W total threads (default 4). Main is owner 0 **and** the synthetic
completion reactor; W−1 additional owners block on channels when idle. Every
owner creates, runs, resets, and destroys its own vCPUs. Each slot has its own
VM fd, vCPU fd, stage-2, private snapshot mapping, and shared `kvm_run` mapping.
No helper process or thread is created for a VM or call. Owner queues carry
bounded fixture workloads; they are not yet the separately bounded Node IPC.
No credentials or policy implementation are present in the shard.

## Fixture ABI v0 (published for transport coordination)

The architecture fixes sizes and operations, not a byte-level record format.
This is a **fixed-record test ABI**, not a commitment to the real jitk kernel's
variable-size transport. In particular, the transport experiment's proposed
32-byte header, consumed-byte cursors, fragmentation/blob handles and batched
SUBMIT can replace this fixture format. Preserve generation, call identity,
release/acquire publication, and the stop/reset ordering below.
The proposed successor is [transport ABI-v2](../../research/perf/transport/ABI-v2.md):
its cursors count bytes, WAIT implicitly submits a batch, and its control/header
layout is incompatible with v0. This crate implements v0 only.

All fields are little endian. Guest RAM is a 2 MiB `MAP_PRIVATE` mapping of the
**same one snapshot file**, registered as one stable KVM memslot at GPA
`0x80000000`. Offsets relative to RAM:

| Offset | Size | Purpose |
|---|---:|---|
| `0x00000` | one code page | EL1 assembly stub, entry GPA `0x80000000` |
| `0x04000` | 16 KiB | control |
| `0x08000` | 32 KiB | guest → host request SPSC ring |
| `0x10000` | 32 KiB | host → guest reply SPSC ring |
| `0x20000` | 1 MiB | pristine-check/dirty-page arena |

Control offsets (all `u64`, offsets relative to `0x4000`):

| Offset | Name | Writer |
|---|---|---|
| 0 | `generation` | host before entry |
| 8 | `seed` | host before entry |
| 16 | `dirty_pages` (0…256) | host before entry |
| 24 | `call_count` (0…10) | host before entry |
| 32 / 40 | `request_produced` / `request_consumed` | guest / host |
| 48 / 56 | `reply_produced` / `reply_consumed` | host / guest |
| 64 | `error` (1 = pristine/counter/reply failure) | guest |
| 72 | `run_counter` (snapshot 0; run must set 1) | guest |
| 80 | `wait_target` (reply count required to resume) | guest |
| 88 | `park_only` (density mode) | host before entry |

Each ring contains 512 fixed **64-byte records**. The first four `u64` fields
are `generation`, `call_id`, `value`, `counter`; remaining 32 bytes are reserved.
Requests use `value=seed`, `counter=1`. Replies use
`value=seed XOR call_id`; the counter/reserved fields are zero. Call IDs are
0…`call_count−1`. Cursors count **records**, monotonically within a run, starting
at zero on reset. This fixture never wraps (at most 10 records/run), so variable
records, ring wraparound and backpressure are not validated by these results.
Host bounds cursor advancement by declared outstanding calls and ring capacity,
checks generation/request identity, and tracks a reply bitmap to reject duplicate
completion. The guest validates reply identity/value; host validates uniqueness.
For `call_count=0`, the guest publishes one result record and FINISH without a
SUBMIT/WAIT. That record proves the guest observed the new generation/seed even
when K=0; it is a run result, not a synthetic tool call.

The doorbell is unmapped GPA **`0x10000000`**, with one aligned **32-bit store**:

| Value | Name | Owner action |
|---:|---|---|
| 1 | `SUBMIT` | acquire cursor, consume/validate requests, continue this vCPU |
| 2 | `WAIT` | complete the MMIO exit, mark parked, return to owner scheduler |
| 3 | `FINISH` | validate guest status; stop slot; complete MMIO before reuse |

The stub sends one SUBMIT per request, then one WAIT after all requests. The
ten-call case has ten outstanding calls before WAIT. Completions may arrive in
any order; the owner publishes reply data before `reply_produced`, then resumes
only when `reply_produced >= wait_target`. Therefore the fixture needs exactly
one WAIT even for ten calls. A real kernel reply demultiplexer can instead wake
on any usable reply and decide which blocked operation is ready. That kernel
demultiplexer is **outside this crate**. Guest uses `dmb sy`; host uses Rust
acquire/release fences. Only the owner touches a slot or its KVM mapping.

## Snapshot/reset contract exercised here

The prepared file has code, zero control/rings, and `0xa5` in the data arena.
Each configured slot privately initializes all 80 KiB of control/rings, including
in density mode. `MADV_NOHUGEPAGE` fixes the CoW granularity at 4 KiB. The host
discards the **entire** stopped 2 MiB mapping using `MADV_DONTNEED`, preserves the
memslot, restores the saved x0…x30, SP_EL0, PC and PSTATE, verifies all 2 MiB against
the snapshot, then installs a new generation and deterministic, distinct test
seed. The guest verifies arena boundary canaries and the zero run counter before
dirtying K pages; host checks every dirty word and the untouched boundary.
K shrinks to zero every fourth iteration to detect lingering prior-run pages.
The seed generator is **test data, not production entropy**.

Before register restore/discard, any pending MMIO operation is completed by
re-entering `KVM_RUN` with `immediate_exit=1`, expecting `EINTR`. Merely restoring
PC at a userspace MMIO exit can leave hidden KVM completion state. See the
[KVM API's MMIO completion contract](https://www.kernel.org/doc/html/latest/virt/kvm/api.html#the-kvm-run-structure).
The fixture never changes system/FP/SIMD registers, MMU state or device state;
this is not a complete reset implementation for the real kernel.

## Build and run

Run the runtime binaries on the existing Linux arm64 nested-KVM machine:

```sh
# From the repo on the Mac. All outputs/builds stay in our own remote directory.
./kvm-dev/ssh.sh 'mkdir -p /home/dev/w2-shard'
scp -r -P 2222 -i kvm-dev/id_ed25519 arch/jitk/shard/* dev@127.0.0.1:/home/dev/w2-shard/
./kvm-dev/ssh.sh 'cd /home/dev/w2-shard && PATH=/home/dev/.cargo/bin:$PATH cargo build --release --offline'
./kvm-dev/ssh.sh 'cd /home/dev/w2-shard && sudo flock /home/dev/bench.lock ./target/release/jitk-shard selftest'
```

Crate build requirements: Rust 1.95 or newer, a C compiler/Linux UAPI headers,
and the cached `libc` 0.2.186 crate used by the VMM kit. The build script extracts
only Linux UAPI constants; each binary's fixture uses Rust's integrated assembler.
The complete native test gate also needs the kernel/census build prerequisites.
Run as root only to read `/proc/slabinfo`; `/dev/kvm` itself is available to dev.
The process raises its own fd limit to 65,536; it changes no system settings.

Commands: `selftest`, `density [maximum_N]`, `reset [iterations]`, `wait [N]`.
Set `JITK_SHARD_THREADS=1…6` to select total owner/thread count. Raw stdout is
JSONL. Density includes N=1/16/64/256/1024/2048 and larger checkpoints when a
conservative memory forecast permits, stopping below 7 GiB of nested-machine
memory use. The forecast reserves 1 MiB per next slot and uses a 6,500 MiB ceiling.
WAIT runs three rounds each with 1 and 10 calls per VM, holding all VMs idle for
two seconds before completing requests in deterministic random order/delays.

See [RESULTS.md](RESULTS.md) and `results/` for measurements and exact scope.

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
