# jitk-shard: the ring engine (KVM on Linux, HVF on macOS)

`jitk-shard` is a library with two CLI entry points, `real` (Linux) and `hvf`
(macOS). `snapshot`, `arena`, `inputs`, `payload`, `streams`, `entropy`, `hv`,
`slot` and `service` (the IPC record and per-slot state machine) are portable;
`kvm`, `owner`, `lease`, `ipc` and `ipc_service` contain the Linux arm64
runtime, `hvf` the macOS backend and engine (see "Hypervisor seam" and "HVF
engine" below). Shard-local UAPI constants live in `constants`, which re-exports
the ring and IPC ABI from the jitk-abi crate (`../abi`). Offline preparation,
fixtures, probes and measurement drivers belong to the `real` binary under
`src/bin/harness` (and `src/bin/hvf.rs`); they are not library modules.

Every build uses the one Rust pin, `rust_toolchain` in
[`../tools/deps.json`](../tools/deps.json) (`$(CARGO_PIN)` in make,
`../tools/rust-toolchain.sh` in shell); nothing uses a floating `stable`.
The pure library tests run on macOS without KVM, Linux headers or guest assembly:
`make test` (`cargo +1.95.0 test --locked --offline`). `make clippy` lints the
host target and, off Linux, the Linux one (`make -C .. test` runs it); run
`cargo +1.95.0 fmt --check` there too. Linux-only tests and the native corpus
still require the KVM gate below. Binary names and CLI commands are unchanged.

### Clean clone on Linux arm64 (kvm-dev)

```sh
make -C arch/jitk deps             # pinned Node, shard binary (cache)
make -C arch/jitk/shard snapshot   # prepared helper snapshots (cache)
make -C arch/jitk/shard test       # Rust tests
flock ~/bench.lock make -C arch/jitk/shard test-kvm
make -C arch/jitk/shard check-native-r7   # native census regression (locks itself)
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
(checked at load), or this is a stale entry (the snapshot's `abiVersion`).

**R6 adds a separate real-kernel/QuickJS executable, `real`.** Its measured
results, build/reproduce commands, and remaining gates are in
[the R6 report](../docs/results/shard-r6.md); its versioned transport subset is specified in
[ABI-R6.md](ABI-R6.md). Build it with `cargo build --release --bin real` on
Linux/arm64.

**R7 implements the bounded real-kernel runtime.** See [the R7 shard report](../docs/results/shard-r7-shard.md)
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

`make -C arch/jitk/shard check-native-r7` (run by `make -C .. test-linux`) rebuilds six fresh
native profiles, checks the exact 41-case Linux differential twice, verifies
fd and relocation-boundary probes, and rejects a mismatched class sidecar.
It requires Linux arm64 KVM and the six pinned census binaries (static musl
builds from the R6 census, sha256-pinned in [`native.ts`](native.ts)). They
are 0.3–1.4 MB each and no upstream URL serves those bytes, so they are not
committed or fetched. They live in a content-addressed store,
`$JITK_NATIVE_CENSUS` or `<jitk cache>/native-census/<sha256>`, filled once with
`./tool.sh import-census FILE|CENSUS_DIR...` (it keeps only files whose hash
is pinned). While any is absent, the check fails naming the missing tools and
the import step, unless `JITK_ALLOW_SKIP` lists `check-native-r7`. The SQLite fixture (8 KiB) is committed as
[`harness/census-demo.db`](harness/census-demo.db) with its hash. The full
`harness/run-r7-shard.sh` gate invokes it too, sharing the runner's outer
benchmark lock. Standalone `make check-native-r7` takes its own measurement locks; when
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
The reactor polls the watchdog's pidfd with its IPC eventfd (no timeout, no
wait4) and fails the shard closed when the watchdog exits. Measured on
kvm-dev (1 slot, 1 owner, through the executor, two runs each, bpftrace over
1,000 one-tool runs): an idle shard wakes 0 times/s (9.7–9.8 with the former
100 ms tick), and a one-tool run makes 258–259 syscalls (268–277 with a
wait4 per reactor pass, 16.5–17.5 of them); about 201 of the rest are the
reset's KVM register ioctls. No per-VM/call helper or
waiting thread is added. One `jitk-clock` thread per pool (`clock.rs`) keeps guest time
real: every 1 ms it stores CLOCK_MONOTONIC into the MONOTONIC_NS control word of each
slot whose vCPU is inside KVM_RUN (the ring kernel reads that word for every
clock_gettime), and it parks while none is. It writes only inside that window, and
leaving the window waits out a store, so decode and reset never race it. The reactor queues are bounded owner commands/events.
`ipc_service` bridges them to Node's bounded shared-memory policy IPC.

### Deadlines: lease, kick, kill

Both engines implement one deadline model with three roles:

| | lease (who holds the deadline) | kick (stop the vCPU at it) | kill (when the kick did not end the run) |
| --- | --- | --- | --- |
| KVM shard | START's deadline, armed by the owner on the lease board | the watchdog process: tgkill SIGUSR1 → `immediate_exit` | the watchdog, 100 ms after the kick without a reset: SIGKILL of the shard |
| HVF engine | the zygote's per-slot `service::State`, from START | the child's reader thread: `hv_vcpus_exit` | the zygote, 100 ms after the deadline: SIGKILL of the child |
| both | Node (`ShardSession`), from the deadline it sent | — | Node, `DEADLINE_GRACE_MS` (1 s) after the deadline without DONE/ERROR (or RELEASED after CANCEL): SIGKILL of the engine |

The kick and the first kill are the engine's own: they hold while Node's
event loop is blocked, and the KVM watchdog is a separate process, so they
also hold for a stopped or wedged shard (`./tool.sh escalation-r7`). Neither
is an authority over a compromised engine: the KVM board is shard memory and
the watchdog is the shard's child; on HVF the kick runs in the child. The
authority is the supervisor that wrote the deadline, Node, whose kill needs
nothing from the engine but silence. What it bounds is the run (no result
past deadline + 1 s); CPU used by a compromised engine beyond that is for
cgroups to bound.

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
[`harness/spawn-cg.c`](harness/spawn-cg.c). `./tool.sh analyze-r7-shard`, `./tool.sh wait-r7` and
`./tool.sh escalation-r7` are offline observers, never runtime helper processes.

## Confinement (Linux shard)

`real ipc` confines itself (`src/confine/`) in three steps that follow its
process model (a reactor thread, W owner threads, one clock thread, and the
watchdog process), all before READY and so before any guest code runs:

1. **Namespaces**, while the process is single-threaded: new user, network
   (no interface up) and IPC namespaces in one `unshare`. Credentials, and so
   access to /dev/kvm, are unchanged.
2. **Files closed**, once setup has opened everything (snapshot, /dev/kvm,
   the reset's pagemap, /dev/urandom, Node's memfd and eventfds) and spawned
   the watchdog (`Pool::prepare`), before any thread exists: RLIMIT_CORE 0,
   no_new_privs, and a Landlock domain that handles every right of the
   kernel's ABI and grants none: no file opened, created or executed, no TCP
   bind or connect, no abstract Unix socket, no signal outside the process.
   The threads started next inherit it.
3. **Syscalls filtered**, once the owner and clock threads run past their
   start-up (`Prepared::start` waits for them): one seccomp filter on every
   thread (TSYNC). Allowed: the allocator without executable mappings,
   futex wait/wake (no PI, no requeue), read/write/ppoll/close on the open
   descriptors, pread64 (pagemap), clocks and sleeps, signal return, tgkill
   of its own threads, exit, and exactly the 11 KVM ioctls an owner issues
   after setup (`confine::policy::KVM_IOCTLS`; slots are created lazily).
   Anything else (open, socket, exec, clone, ptrace, kill, prctl, other
   ioctls, ...) kills the process with SIGSYS.

The watchdog confines itself the same way once its board and pidfd are
open: its own Landlock domain (it must signal the shard, so signals are not
scoped) and a filter that allows its poll loop, tgkill SIGUSR1 to the shard
and SIGKILL through the shard's pidfd.

Not used: a mount namespace (hosts that restrict unprivileged user
namespaces, such as Ubuntu's AppArmor default, refuse it, and Landlock
already closes the file system) and a PID namespace (it needs a fork;
seccomp denies ptrace and outside signals). PR_SET_DUMPABLE stays set, so
Node and the observers can read the shard's /proc files; seccomp and Landlock
keep the shard from reaching other processes' memory. A layer the kernel
lacks (no Landlock, a refused namespace, an older Landlock ABI) is printed
on stderr (`shard IPC: confinement degraded: ...`) and the shard runs with
the rest; no_new_privs and seccomp are required.

`real confine SNAPSHOT_BASE [--allow-degraded]` (`src/bin/harness/confine.rs`,
run by `make test-kvm`) checks it with forked probe processes, each running
`return 2` on a one-slot pool first: an unconfined control may open
/etc/hosts, connect to a local TCP port, exec /bin/true, signal its parent,
setuid, issue FIONREAD and PTRACE_TRACEME; with namespaces and Landlock only,
the open, connect and exec get EACCES and the signal EPERM; each fully
confined probe (`ipc_service::confined_pool`, the code `real ipc` runs) is
killed by SIGSYS at its attempt. It fails if a layer is degraded unless
`--allow-degraded` is given. Measured on kvm-dev (Linux 7.0, Ubuntu 26.04,
AppArmor-restricted user namespaces): every layer applies.

## Hypervisor seam and the HVF backend

`slot::Slot<V: hv::Vm>` holds everything hypervisor-neutral: guest RAM over the
class regions (immutable extents read-only on the host and in the VM), bind,
the ring record decoder and reply path, and reset with its sampled check, trim
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
as before; the Linux native worker keeps its own KVM slot adapter
(`kvm/native.rs`), the HVF one is `hvf/native.rs` (below, "HVF native
worker"); both share the frame loop (`inputs::serve`). The job clock, the per-run LOG
budget and quarantine reasons live in the generic slot, so HVF has them too:
`Slot::set_clock` registers a `clock::Clock` cell (the owner pool does this on
Linux; `clock_advances_inside_a_run` checks it on HVF), and
`Slot::quarantine_reason` is what the IPC QUARANTINED message carries
(`failed_reset_quarantines_with_reason`); on HVF the engine child sends it
(below).

On macOS arm64, `make snapshot` builds the same two classes as on Linux, prepared
by the `hvf` binary from `make -C .. deps` (darwin-arm64 cache entries; `.mem`
has KVM's format, `.regs` is HVF's). `make test-hvf` runs `src/hvf/tests.rs` on them (~4 s warm; signed
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

Open: the kernel should `tlbi vmalle1` (risk 3) and could `ic ialluis` once
the CHECKPOINT doorbell returns. KVM has no per-memslot execute control, and
its copy path keeps the physical pages, so a tenant's arena code can survive in
the I-cache there too, unless the CPU has CTR_EL0.DIC. A kernel `ic ialluis`
would close both. Not done here: it would change `kernel/.READY`.

**Why one long-lived process per slot.** HVF allows one VM per process and
runs a vCPU only on the thread that created it. The HVF spike
([report](../docs/results/hvf-spike-2026-10-28.md); M4 Pro, load 5–11,
medians) measured the process costs that shape the engine:

| | CPU | wall | memory |
| --- | ---: | ---: | ---: |
| cold VM via `posix_spawn` | 3.1 ms | 3.9 ms | |
| VM in a child forked from a parent holding the mapped snapshot | 0.77 + 0.15 ms | 1.2 ms | 1.23 MiB per child |
| first boot to CHECKPOINT | 1.28 ms | 2.35 ms | |
| warm run + reset in a persistent process | ~55 µs | | |

So the zygote forks each engine process once and process creation stays off
the per-run path.

## Limits (ABI 11)

The JS profile has the console path's limits (`../executor/ipc/ABI.md`,
`ABI-R7.md` "JS profile"): 4,096 calls per run with 64 open and 2 MiB in
flight, 1 MiB calls, replies and completions, a 72 KiB START source (64 KiB
of tenant code, `LIMIT.code`), 1,024 one-way console lines, and guest timers
(the WAIT deadline wakes a parked slot). Messages stream over the unchanged
32 KiB rings and 16 KiB IPC records, so the layout, the arena classes, guest
RAM and the reset are as before; host memory per slot is a backlog of at most
the source plus one reply per open call.

What bounds big values is the glue-2m arena: a run has about 400 KiB of
QuickJS heap (each open call costs ~4 KiB of it), so a 64 KiB reply or source
works, a 50 KiB call echoed back works, a 64 KiB echo, a 100 KiB reply or a
100 KiB completion is a QuickJS out-of-memory error. A larger class (glue-4m,
2.75 MiB arena) would lift that at the price of its reset copy.

Cost, `return 2`, glue-2m, p50 of 1,000, before (ABI 10, main) / after:

| | reset | run | max RSS of the one-slot bench process |
| --- | ---: | ---: | ---: |
| HVF (`hvf bench`, M4 Pro, load ~6) | 71.6–72.0 / 71.0–72.4 µs | 23.9–24.3 / 32.6–36.2 µs | 11.71 / 11.70 MB |
| KVM (`real bench`, kvm-dev nested) | 93.4–94.1 / 92.3–93.2 µs | 114.0–115.8 / 118.4–119.0 µs | 49.4–49.9 / 49.9 MB |

The run grew 1.6 µs on HVF with the kernel's TLB and I-cache invalidation
after CHECKPOINT (measured with and without it); the rest follows the guest's
heap layout (variants of the source decode moved it by ±4 µs), not the
message path: `return 2` takes one exit before and after.

Bigger payloads dirty more of the arena: 84 private pages for `return 2`,
173 for a 30 KB source, 184 for a 50 KB result (glue-2m, whose writable
window is 340). The KVM reset therefore copies every private page
(`ResetPolicy::copy_limit` None); with the former 128-page cap such runs
discarded and refaulted. Through `ShardBackend`, one slot, n=200, nested
KVM at load 0.4–1.0, before / after:

| | guest CPU p50 | wall p50 | guest RAM held between runs |
| --- | ---: | ---: | ---: |
| `return 2` | 0.20 / 0.19–0.20 ms | 0.54–0.55 / 0.50–0.54 ms | 336 / 336 KiB |
| 30 KB source | 47.6–47.9 / 4.37–4.38 ms | 48.6–48.9 / 5.07–5.08 ms | 0 / 692 KiB |
| 50 KB result | 44.0–44.6 / 5.17–5.22 ms | 44.7–45.7 / 5.84–5.91 ms | 0 / 736 KiB |

Idle trim (2 s) returns that memory to 0. The shard's own heap is one glibc
arena (`M_ARENA_MAX`, set in `real`'s `main`): per-thread arenas each took a
2 MiB transparent huge page, so an idle shard's Private_Dirty was 11.0 MiB
(10 MiB of it AnonHugePages) at 1 and at 64 slots, and is 0.25–0.76 MiB at
1 slot and 0.76–2.4 MiB at 64 slots.

## HVF engine (`hvf ipc`)

`hvf ipc SNAPSHOT_BASE SLOTS [POLICY]` is the Mac engine the executor drives
by default on macOS arm64 (`JITK_BACKEND=hvf`, `../executor/README.md`). It speaks the Linux shard's
IPC (`service.rs`: the record envelope and the per-slot state machine that
`ipc_service` also runs) over a stream socket on fd 3.

```
Node ShardBackend ──socket──> zygote (hvf/zygote.rs, 1 thread, never a VM)
  PipeChannel                   │ per-slot service::State on both sides,
                                │ escalation timer, reaps children
                                ├─socketpair─> engine process, slot 0 (hvf/child.rs)
                                │                main thread: HvfVm + vCPU + Slot
                                │                reader: commands, CANCEL/deadline kicks
                                │                job clock
                                └─ ... one per slot
```

- **Zygote.** Checks it has one thread before every fork (`proc_pidinfo`),
  loads the verified snapshot, reads the D-cache line size (sysctl, denied
  later), enters its Seatbelt profile (jitk.sb + zygote.sb, "Confinement"
  below) and forks one engine process per slot; READY to Node once every
  child is READY.
  It validates every Node message (START admission, REPLY pending bits,
  CANCEL generation) and every child message (call ids in order, STATS
  before one completion, bounded printable DONE, RELEASED/QUARANTINED only
  while resetting) and forwards them; a Node violation fails the engine
  closed, a child violation kills that child.
- **Engine process.** Drops the inherited fork grant (RLIMIT_NPROC 0), then
  creates its VM, slot
  and job clock, and runs the KVM owner's `Mode::Policy` generation logic:
  admit (reset unless pristine), bind, run to calls or WAIT,
  resume per REPLY, finish (an error resets at once), reset on CANCEL (every
  1,024th reset is then checked before RELEASED), idle
  trim. A failed reset is QUARANTINED with the reason; the slot then admits
  nothing (`slot_unavailable`) and the zygote kills the process.
- **Leases and kicks.** The reader thread holds the running generation's
  START deadline and kicks the vCPU (`hv_vcpus_exit`) at it, and at once on
  a CANCEL; the main thread sees `Exit::Interrupted` and ends the run. If the
  run is still going 100 ms after its deadline (the Linux escalation), or a
  reset is not reported within 1 s of its CANCEL, the zygote SIGKILLs the
  process; its run fails as `deadline_exceeded` (or `slot_unavailable`) and
  the slot is QUARANTINED (`engine process exited (signal 9)`). Node closing
  the socket ends the zygote, which kills and reaps every child; a child whose
  socket closes stops its vCPU and exits.
- **Capacity comes back** (IPC RESTORED, ABI 10). Once a slot is
  QUARANTINED, the zygote forks it a fresh engine process from the snapshot it
  still holds (no file is opened again); when that process is READY the
  zygote sends RESTORED at the generation QUARANTINED ended, and Node counts
  the slot again and admits its next generation (~11 ms from the CANCEL to
  RESTORED in `shard-check`). An engine process that dies while its slot is
  idle is replaced the same way without a message (Node never saw the slot
  go). A re-forked child must be READY within 10 s or is killed. Re-forks are
  budgeted: more than `restore_budget(slots)` = max(4, 2 × slots) within 60 s
  is a crash loop, and the engine exits (`... re-forked within 60 s (crash
  loop); failing closed`) rather than spinning.
- **Clock.** IPC deadlines and STATS times are CLOCK_MONOTONIC_RAW
  (`clock::ipc_ns`), which is mach_continuous_time and Node's process.hrtime.
  macOS's CLOCK_MONOTONIC has a different base.
- **Message path.** An engine process writes what one command produced in
  one write (STATS with DONE; console lines with a WAIT's calls), except that
  an exit the guest runs on from is sent before the vCPU runs again; the
  zygote writes everything queued for Node in one writev. A `return 2` run
  is 2 writes from the engine process and 2 from the zygote to Node.
- **Sampled check.** Every 1,024th reset of a slot compares its writable
  extents and registers with the snapshot before RELEASED (`Slot::reset`),
  so it never delays a run's admission. The 30 MiB of immutable RAM is not
  compared: it is read-only on the host and in the VM. Over 20,000 `return 2`
  runs (8 slots, M4 Pro at load 13–17), engine CPU per run went from 18 runs
  above 3 ms (max 8.6–11.2 ms) to none above 1 ms (max 0.87 ms).

### Handing each engine process's socket to Node (evaluated, not done)

Every message crosses two sockets, Node to zygote to engine process, and
the zygote decodes, checks and re-encodes it. Giving each engine process
its own socket to Node would save that hop, about 70 µs of zygote CPU per
`return 2` run (`ps` over 20,000 runs at load 12). It is not done because
the zygote would lose what it is there for:
- **Descriptors.** Node cannot receive a descriptor from the zygote (`net`
  has no SCM_RIGHTS; only `child_process`'s IPC channel passes handles, in
  Node's own framing), so it would have to create one pipe per slot at
  spawn (fd 4 + slot) and the zygote would hand each to its child.
- **Re-forks.** A replacement engine process must reuse its slot's pipe.
  A killed process can die mid-record, and Node would then read a torn
  record from a stream it cannot reopen: the stream needs a resync record
  (generation-tagged) that Node waits for. Today the zygote drops the dead
  child's socket and Node never sees a partial record.
- **Deadlines.** The zygote kills a run 100 ms past its deadline and a reset
  1 s after its CANCEL; it knows both because it forwards START and CANCEL.
  Without forwarding, Node would have to send every START deadline and
  CANCEL to the zygote as well (a second write per message, the hop saved),
  or the engine process would report its own deadline, which the untrusted
  side must not do.
- **Checks.** The zygote kills a child that breaks the slot state machine
  (call ids, STATS before one completion, bounded DONE). Node's
  `ShardBackend` checks the same records again, so this part would move
  without loss.

If the hop ever matters, the order that keeps the zygote enforcing
deadlines is: a control socket from Node to the zygote carrying each
admitted generation's deadline and its CANCEL; then the per-slot pipes with
a resync record; then the zygote stops forwarding. While the Mac stays a
development engine (about 60 VMs per host), the hop is not worth that.

Confinement (REPORT.md risk 4). The zygote confines itself before its first
fork: `src/hvf/jitk.sb` (deny default, read the snapshot directory, one
sysctl) plus `src/hvf/zygote.sb` (fork, signal its children). macOS refuses a
second `sandbox_apply` in a sandboxed process (EPERM, measured, also with the
Sandbox mac syscall allowed), so an engine process cannot narrow that profile
with Seatbelt; it inherits it and takes away the fork grant itself with
RLIMIT_NPROC 0 before it creates its VM (`child::confine`; unprivileged
processes cannot raise it, and since root is not bound by it the engine
refuses to run as root). `hvf confine BASE` (run by `make test-hvf`) forks
three probe processes. Measured on macOS 26.6.1:
- the unconfined control is allowed everything below;
- an engine process (zygote profile + `child::confine`) creates a VM and runs
  `return 2` and reads its snapshot directory; fork fails (EAGAIN), and so do
  signalling a child and exec; /etc/hosts, the home directory listing, a /tmp
  write, TCP and UDP to localhost get EPERM;
- the zygote (its profile) forks an engine process that confines itself, runs
  `return 2` and then cannot fork; it SIGKILLs and reaps a child and reads its
  snapshot directory; the same files, writes, network and exec get EPERM.
Everything the zygote opens (the snapshot files, the Node socket) is open
before it confines itself, and re-forks reuse them.

Tests: `hvf::tests::engine_child_runs_kicks_and_quarantines` (in-process
child: tool call round trip, deadline kick within 200 ms, CANCEL of a spinning
guest, clean slot after both, failed reset -> QUARANTINED -> slot_unavailable,
socket close ends serve); `hvf::conn`, `service` and
`hvf::zygote::restore_tests` (the re-fork budget) unit tests;
`../executor/shard-check.ts` on the real binary (restore, concurrency, hostile
payloads, environment, a blocked-Node deadline, zygote escalation of a stopped
child, dead-child quarantine then RESTORED and both slots serving, silent
replacement of an idle dead child, a crash loop failing the engine after 5
kills of a one-slot engine, an unsolicited RESTORED, malformed admissions, no
orphans); the parity
corpus on `hvf` (ABI 11: 96 cases, 94 ok, 2 allowlisted, 0 undocumented,
as `linux/shard`; both allowlisted cases are the glue-2m arena).

Per run through the canonical executor (`node ../executor/build/engine-bench.js`;
sequential executes, libkrun with 2 warm VMMs, HVF unwarmed with 8 engine
processes; CPU = user+sys of Node and every engine process, N runs minus 0
runs), M4 Pro, macOS 26.6.1, load average 6.1–7.0 (shared machine), two runs:

| | wall p50 / p99, `return 2` | wall p50 / p99, one tool call | CPU per run |
| --- | ---: | ---: | ---: |
| libkrun (`jitk`, cold VMM per run), n=300 per case | 1.35–1.42 / 15.7–18.2 ms | 1.49–1.60 / 16.4–19.6 ms | 8.5–8.8 CPU-ms |
| **HVF engine (`hvf`)**, n=2000 per case | **0.153 / 0.35–0.38 ms** | **0.28–0.29 / 0.87–0.89 ms** | **0.44 CPU-ms** |

libkrun's p50 hides its VMM boot behind the warm pool; its CPU does not
(every run boots and reaps one VMM). The HVF per-run CPU includes Node's
side (the executor, policy, IPC), the zygote's forwarding and the engine
process's run and reset (~100 µs of it, per `hvf bench` above).

The HVF engine is the executor's and MCP's default on macOS arm64
(`../executor/select-backend.ts`); the table compares it with the libkrun
path it replaced.

## Console runner (`hvf console`) and the watchdog

`hvf console --image KERNEL [--seed HEX] [--epoch-ns NS]`
(`src/hvf/console.rs`) boots the **console** kernel profile (`kernel/build.sh`,
no `transport-ring`) with stdin/stdout as its virtio console: the former
`jitk-vmm --image` launcher contract (`../CONTRACTS.md`), on
Hypervisor.framework. GrowOS (`../grow`, `../scriptc-corpus`), the kernel
suite (`../kernel/tests/host.sh`) and the protocol VM tests use it; the
executor does not. Before the VM exists it enters `jitk.sb` for the image's
directory, drops fork (as an engine process) and prints `{"sandbox":"ok"}` on
stderr. The device (`src/virtio_console.rs`, platform-neutral, unit-tested and
fuzzed) is the subset of a virtio-mmio console with MULTIPORT that
`kernel/src/console.rs` drives (queues serviced synchronously at the guest's
QueueNotify store; a malformed queue is an error that stops the VM, never an
access outside RAM); the FDT names a GIC the kernel never touches, because a
positive `jitk.tick_us` selects its CNTV fallback, so WFI is the only wait:
the runner sleeps until CNTV_CVAL or stdin input (a receive buffer used since
the last WFI completes it at once, as an interrupt would). Guest CNTVCT is
mach_absolute_time (vtimer offset 0), paired with the epoch in
`jitk.counter`. Exit 0 at PSCI SYSTEM_OFF, 70 on an error (an access outside
RAM and the console, an unexpected exception). Measured on the M4 Pro under
load 5–14: ~14 ms from spawn to the guest's READY frame (p50), 0.16–0.24 ms
for a `return` run after it; the kernel suite (`regression`, `fs_diff`)
passes on it unchanged. It is not a tenant boundary beyond jitk.sb: it serves
trusted test and grow images. It goes when the console profile does (the
kernel follow-up; GrowOS first needs a host-visible trace on the ring
profile).

`hvf process-watchdog` and `real process-watchdog` (`src/watchdog.rs`, moved unchanged from
`jitk-vmm --watchdog`) are the process backends' shared deadline watchdog
(`../executor/backend.ts`: Hyperlight's adapter, test peers).

## Fuzzing

`src/fuzz.rs` (feature `fuzzing`) has one harness per parser of untrusted
bytes: the JS and native TX rings (`ring_tx`, `native_tx`), the console
device (`virtio_console`), IPC record streams (`ipc_records`) and native
requests (`native_request`). Each plays its input as guest or peer actions
and checks the decoder's promises (bounded, printable forwarded messages,
reads only of produced bytes, round trips), not only the absence of panics.
`cargo test` replays the seeds, which are generated from
`../abi/guest-payloads.json` and the decoders' test vectors, and every
regression input. `fuzz/` drives the harnesses with libFuzzer and ASan on the
pinned nightly (`tools/deps.json` `fuzz_toolchain`):

```sh
make fuzz-smoke             # every target for 10 s, in parallel (make test, ci-host)
make fuzz FUZZ_SECONDS=1200 # longer runs; corpora grow in .work/fuzz/corpus
```

A finding is written to `.work/fuzz/artifacts/TARGET/`. Replay it with
`.work/fuzz/target/HOST/release/TARGET FILE`, fix it, and add the input to
the harness's regression tests.

## HVF native worker (`hvf native-worker`)

`hvf native-worker TOOL=SNAPSHOT_BASE ...` (`src/hvf/native.rs`) is the Linux
`real native-worker` of ABI-R7 on Hypervisor.framework: the same JNR7 frames
on stdin/stdout (`inputs::serve`, shared with Linux), native bind, byte
streams and output cap, on profiles of both arena classes prepared by `hvf
prepare` (`./tool.sh prepare-native-r7` uses the deps-built engine on the
Mac). The late-bound input archive is anonymous host memory made read-only,
mapped at ARCHIVE_GPA (KVM's memslot 63) read-only and not executable, and
removed before the next run's (`input_archive_is_read_only_and_never_executes`:
a guest read sees the bytes; a store, a branch, and a read once unmapped fault,
both classes). HVF allows one VM per process, so the worker holds one slot: a
run of another profile replaces it. Before any VM exists the process enters
jitk.sb (the first profile's directory) and drops fork; snapshots are mapped
from descriptors opened before, so profiles in other directories work too.
`executor/native-backend.ts` and the MCP `run` tool drive it unchanged
(`mcp/native-linux-test.mjs` passes on the Mac: 10 calls, deadline kill
included).

`make check-native-hvf` (run by `make -C ../executor parity-ssh`) prepares the six census
profiles (jq, SQLite, BusyBox, Lua on glue-2m; MicroPython, zstd on glue-4m)
and runs the 41-case corpus twice. A Mac cannot run the Linux programs, so the
oracle is a Linux `check-native-r7` run's `corpus-1.json` (every row exact
there: KVM worker = the program on Linux), which `make -C ../executor
parity-ssh` fetches to `executor/.work/native/linux-arm64.json`; each HVF row
must reproduce the Linux program's exit status and stdout/stderr bytes
(sha256). Measured 2026-10-28: 41/41 exact twice, every case with an input
archive, median 3.6 ms per case through Node (max 12 ms; nested KVM's
8.3 ms is not comparable). The fd and region probes stay Linux-only (their
oracle is the probe running on Linux). Without the census or the reference it
fails saying why, unless `JITK_ALLOW_SKIP` lists `check-native-hvf`.

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
lock composition come from `../tslib/` through `lib.ts`. `make check-native-r7` takes its own measurement
locks (`JITK_BENCH_LOCK`, default `~/bench.lock`); never put another
lock around it. `test-kvm` expects the caller to hold that lock and takes the
snapshots from the cache (`make snapshot`) unless the variables are set.
See [`SCRIPTC-GAPS.md`](SCRIPTC-GAPS.md) for compiler workarounds and the
[Python port parity report](../docs/results/port-parity-shard-2026-10-26.md).
