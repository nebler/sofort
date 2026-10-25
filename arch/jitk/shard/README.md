# jitk-shard: device-free nested-KVM spike

Independent Linux/arm64 Rust crate for architecture gates 2, 4 (basic), and 5.
This runs an assembly fixture, **not jitk, QuickJS, or tenant code**. It has no
GIC, virtio, guest timer, guest interrupt delivery, WFI parking, or HVC transport.
`KVM_ARM_VCPU_PSCI_0_2` is enabled as in `kvm-dev/smoke/kvm-smoke.c`.
There are no Cargo dependencies. Build-time `abi.c` extracts ioctl numbers and
`kvm_run` offsets from the installed Linux UAPI headers; it is not runtime code.

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

Use the existing nested-KVM machine; do not build this Linux crate on macOS:

```sh
# From the repo on the Mac. All outputs/builds stay in our own remote directory.
./kvm-dev/ssh.sh 'mkdir -p /home/dev/w2-shard'
scp -r -P 2222 -i kvm-dev/id_ed25519 arch/jitk/shard/* dev@127.0.0.1:/home/dev/w2-shard/
./kvm-dev/ssh.sh 'cd /home/dev/w2-shard && PATH=/home/dev/.cargo/bin:$PATH cargo build --release --offline'
./kvm-dev/ssh.sh 'cd /home/dev/w2-shard && sudo flock /home/dev/bench.lock ./target/release/jitk-shard selftest'
```

Tool requirements: installed stable Rust, C compiler/Linux UAPI headers, clang,
ld.lld; no network fetch or vendoring. The build compiles the stub with
`clang --target=aarch64-unknown-none` and links a raw image with ld.lld.
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
