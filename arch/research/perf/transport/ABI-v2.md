# Ring ABI v2 proposal — 2026-10-25

**Proposal, not implemented and not a measured ≤30 µs result.** This fixes the
byte contract for architecture §§2–3. It preserves w2-shard's `SUBMIT=1`,
`WAIT=2`, `FINISH=3`, doorbell GPA `0x10000000`, `generation`, `call_id`,
`request_produced/request_consumed`, and `reply_produced/reply_consumed` names.
Its record/cursor format is deliberately a versioned successor to the shard
README's fixed 64-byte **fixture ABI v0**. That fixture's cursor unit is records;
v2's unit is **bytes**. Never run one format against the other.

## Mapping and control

Per slot, reserve exactly **81,920 B**: control 16,384 B, guest→host request
ring 32,768 B, host→guest reply ring 32,768 B. For the current shard fixture,
retain relative guest RAM offsets `0x04000`, `0x08000`, and `0x10000`; the latter
leaves a deliberate unmapped/unused gap from the first ring. The 80 KiB sum
counts actual extents, not the address span. Rings are ordinary coherent RAM;
the doorbell is an unmapped, aligned 4-byte device register. No GIC, virtio,
guest timer interrupt, or WFI is part of v2.

Control uses little-endian fields. Writer-owned cache lines prevent cursor
false sharing; fields not listed are zero/reserved. Host shadow state is the
authority even where a malicious guest can write a control page.

| Control offset | Bytes | Field | Writer |
|---:|---:|---|---|
| `0x000` | 4 | magic `JTK2` (`0x324b544a`) | host at bind |
| `0x004` | 2 / 2 | major=2 / minor=0 | host at bind |
| `0x008` | 8 | `generation`, nonzero; never reused for a slot lifetime | host at bind |
| `0x010` | 4 / 4 | ring bytes=32768 / max record bytes=16384 | host at bind |
| `0x018` | 4 / 4 | max outstanding=32 / default encoded-reply reservation=65536 | host at bind |
| `0x020` | 8 | negotiated features; zero initially | host at bind |
| `0x040` | 8 | `request_produced` | guest |
| `0x080` | 8 | `request_consumed` | owner |
| `0x0c0` | 8 | `reply_produced` | owner |
| `0x100` | 8 | `reply_consumed` | guest kernel |
| `0x140` | 8 / 8 | `wait_epoch` / `wait_mask` (reply / TX-credit / cancel) | guest kernel |
| `0x180` | 8 / 8 | `completion_epoch` / `completion_mask` | owner |
| `0x1c0` | 4 / 4 | `error` / stopped status | owner |
| `0x200`…`0x3fff` | remaining | bind/checkpoint/repair data; no host pointers or credentials | defined by future minor feature |

Use aligned atomic u64 cursor loads/stores with **release publication and
acquire consumption**. A producer fills the whole record before advancing its
cursor; a consumer owns a copied record before publishing consumed bytes.
Guest `dmb ishst` before a doorbell follows publication; an MMIO trap alone is
not a substitute for memory ordering. Use a shared-atomic-capable native Node
binding for interprocess queues; a JavaScript `SharedArrayBuffer` by itself is
not an interprocess mapping API.

## Record: exactly 32 header bytes

| Offset | Type / bytes | Meaning |
|---:|---|---|
| 0 | u32 / 4 | `record_bytes = align_up(32 + payload_bytes, 8)` |
| 4 | u16 / 2 | `kind`: CALL=1, RET_OK=2, RET_ERR=3, LOG=4, FINISH=5 |
| 6 | u16 / 2 | flags: JSON_UTF8=1, FRAGMENT=2, LAST=4; unknown bits fatal |
| 8 | u64 / 8 | `generation` |
| 16 | u64 / 8 | `call_id`; 1…run call budget; LOG/FINISH=0 |
| 24 | u32 / 4 | `payload_bytes`, excluding header and trailing padding |
| 28 | u32 / 4 | `cap_slot`, a late-bound host registry index; never a credential |

**Maximum record including padding: 16,384 B; maximum unfragmented payload:
16,352 B.** Padding must be zero. A record may wrap: read/write at most two
ring spans, so no PAD record, wrap doorbell, or large-tail hole is required.
The receiver first copies the header, validates length against an acquire-read
producer cursor and its private consumer cursor, then copies the payload into
receiver-owned bounded storage. Validate and use **that same copy**; do not
validate guest RAM and later reread it. This prevents a guest mutation from
turning checked bytes into different policy/provider arguments.

Cursors start at zero for every generation, monotonically count bytes, and
must not overflow during a run. Reject `produced < consumed`, differences
above 32768, non-8-aligned advances, lengths below 32, lengths above 16384,
truncation, generation mismatch, wrong direction/kind, unknown flags, duplicate
call/reply identities, undeclared capability slots, or inconsistent fragment
ranges. Never follow a pointer from a record.

CALL carries only the argument array as UTF-8 JSON; the native header replaces
`t/id/ns/fn` JSON fields. The Node authority resolves `cap_slot` against this
run's grants, enforces ID sequence, call/byte/deadline/effect limits, validates
arguments, and consumes each permission exactly once. RET_OK carries only the
result. RET_ERR carries JSON `{code,message}` with no extra keys: code is an
ASCII token matching `[A-Z][A-Z0-9_]{0,63}`, and message is scalar UTF-8 text
bounded to 4096 bytes. LOG carries JSON `{level,msg}` with the v1 level enum,
4096-byte message cap and existing aggregate log budgets. FINISH carries exactly
one of `{ok:value}` or `{err:{name,message}}`, with 128-byte name and 4096-byte
message caps. Large result/FINISH values require the negotiated bulk byte
reservation; header and record bounds never grow. Binding namespace/function names happens once per run.
Node must validate JSON structure, duplicate keys, Unicode/scalar/number limits,
and effects itself, even if a shard already inspected them. Use one bounded
parse/validation path; remove the current outgoing serialize→parse→UTF-8
encode→UTF-8 decode→parse cycle. Output validation works on the host value.
Binary data gets a separately negotiated byte/blob encoding; do not silently
weaken the codemode typed-array compatibility contract.

## Batching and credit

The native embedder queues CALL records without ringing for each promise.
Flush at an empty QuickJS job queue/first blocking poll, FINISH, 32 queued
calls, 16 KiB queued bytes, or exhausted ring credit. A cooperative QuickJS
interrupt hook must also bound a long CPU job's deferred submission (initial
target ≤20 µs, to be measured); batching must not defer an effect forever while
JS computes. No timer device is needed to read a monotonic counter in that
hook. Ten small Promise.all calls fit in one batch.

Credit is **bytes**, not record count: `free=32768-(produced-consumed)` after
validated monotonic cursor reads. There are no credit messages. A consumer
returns byte credit only after copying to its own bounded staging/user buffer.
Both the guest→owner ring and the independent shard↔Node shared-memory queues
need admission credit. If Node capacity is exhausted, the owner retains bounded
work and parks the slot without holding its lane; it never blocks an owner
thread on a full pipe/queue. The call-count and live-byte budgets apply in
addition to ring capacity.

WAIT is also a **submit-and-park** operation. Therefore the common path emits
one WAIT store, rather than SUBMIT followed immediately by WAIT. A standalone
SUBMIT publishes an eager batch and continues guest work. FINISH also drains
prior committed work, rejects outstanding effects on successful completion,
and stops the slot. PREPARED/CHECKPOINT remain offline operations with separate
operation numbers; no snapshot may contain a tenant grant.

## Doorbell, scheduling, and lost-wakeup rule

At GPA `0x10000000`, an aligned u32 store has w2's values:

* **1 SUBMIT:** acquire and consume all newly committed requests, forward one
  bounded batch to Node; finish the trapped store and continue the guest.
* **2 WAIT:** first perform SUBMIT's drain. Resume immediately for a usable
  reply/credit/cancel, or mark the slot parked and return the lane to its fixed
  owner scheduler. On KVM retain the pending MMIO completion while parked and
  complete it on the ordinary resume KVM_RUN; do not insert a completion-only
  ioctl into every call. No saved registers may be rewritten in that state.
* **3 FINISH:** drain, validate completion, stop, and complete the MMIO exit
  before snapshot/reset/rebind.

Only a slot's owner enters its vCPU, advances host-owned cursors, writes reply
records, or changes parked/runnable state. Other threads enqueue completion
references to that owner. Publication precedes the owner notification. WAIT
carries the guest's observed completion epoch: the owner drains completions,
checks the epoch/condition, marks parked, **rechecks the epoch/condition before
sleeping**, and resumes immediately if it changed. The same owner serializes
completion and parking, so a completion cannot be lost between the check and
park. Notifications are hints; the predicate/cursors/epoch are truth.
Coalesce owner and Node notifications on empty→nonempty transitions with an
armed flag, release/acquire handoff, and recheck-after-arm. One notification
must not be interpreted as one record.

A sleeping owner/reactor needs an OS wake notification (Linux eventfd,
macOS kqueue user event or another measured native mechanism), **not a per-call
pipe payload**. One request batch plus one completion batch can need up to two
notification writes and two kernel waits returning, amortized over the batch;
active polling/cooperative lanes need zero. A notification requires no vCPU
IRQ: the owner directly re-enters the vCPU after committing replies. Do not
claim zero host syscalls for a sleeping cross-process Node broker.

On KVM, complete a pending MMIO operation through the KVM_RUN completion
contract before changing saved registers or reusing the slot; w2 already uses
`immediate_exit=1` for this. Parking alone does not reset or rewrite registers,
so v2 defers WAIT completion to its ordinary resume entry. An implementation
that instead completes each WAIT with `immediate_exit=1` adds one completion-only
KVM_RUN/EINTR per call or batch; include that extra host ioctl/return in its
budget even though it is not another guest-generated MMIO exit. HVF completes its decoded store/PC state before
parking. Request/reply cursors, pending maps, wait epochs, decoder state and
cancellation state all reset under the stopped generation barrier.

## Kernel demultiplexer and large results

The EL1 capability dispatcher owns a bounded pending table indexed by
`(generation, call_id)`, with the capability slot, caller, destination buffers,
remaining length and completion/error state. A `read(/cap/<slot>/call)` waiting
for call B still drains the reply ring and routes call A's reply to A's posted
buffer. Readiness, EOF, error, and cancellation are per call. Plain console
readiness and a suspended QuickJS callback are not the demultiplexer.

Register bounded destination buffers when submitting a call, validate/pin their
guest ranges, and give the demux enough per-call metadata to copy directly into
them. No per-call unbounded kernel Vec, no 32×64 KiB hidden allocation, and no
reply head-of-line deadlock because another promise's reply comes first.
Reserve live-byte credit before issuing the effect; if a response exceeds its
reservation, return a bounded error or an explicit blob handle. Keep aggregate
encoded reply reservations ≤64 KiB in the initial small profile (separate from
the fixed 80 KiB rings); decoded values and transient buffers still count toward
the class peak. A 64 KiB string encodes to 65,538 bytes and therefore needs an
explicit larger reservation/profile. Do not hide those two bytes or claim that
the bulk case passes the 2 MiB gate before its full heap ledger exists.

The cheapest 64 KiB result is a **blob handle plus explicit range reads** when
the program need not materialize the bytes. For compatibility with an actual
64 KiB JSON string, allow bounded fragments: FRAGMENT payload starts with
`total_bytes:u32, offset:u32` (8 B), and LAST marks the final contiguous range.
No interleaving ranges for one ID; total length is admitted before the first
fragment; LAST must end exactly at total length. A JSON string of 65,536 ASCII
characters needs **65,538 JSON bytes**, five records (four 16,384 B records
holding 16,344 data bytes each plus a final 208 B record), **65,744 ring bytes**,
and at least **three** 32 KiB credit windows. The guest demux copies fragments
directly into the posted destination, then invokes JSON parsing once on the
complete value. Include quoting and fragment prefixes in byte math.

If all bytes must arrive before JS can continue, the owner resumes the guest
to return credit after each full window; expect three WAIT exits/resumptions
for the 64 KiB materialized reply, rather than pretending it is a small call.
More windows/exits are allowed if replies arrive separately. Blob lifetime,
reset invalidation, range bounds and aggregate memory accounting are mandatory;
blob handles are data references, never capability grants.

## Expected operation counts, conditional on ready batches

These are predictions from the contract, not benchmark observations.

| Per tool round/batch | 1 small call | Promise.all(10) | Materialized 64 KiB string |
|---|---:|---:|---:|
| Full JSON encodes / decodes, guest+Node | 2 / 2 | 20 / 20 | 2 / 2 |
| Capability enqueue guest syscalls | 1 | 10 | 1 |
| Blocking WAIT syscalls / MMIO exits | 1 / 1 | 1 / 1 | ≥3 / ≥3 |
| Guest IRQ, GIC/timer/WFI exits | 0 | 0 | 0 |
| Host vCPU re-entries | 1 | 1 | ≥3 |
| Owner↔Node request / completion notifications (sleeping peers) | ≤1 / ≤1 | ≤1 / ≤1 | 1 / ≥3 including credit wakeups |
| Guest ring payload copy operations | 2 | 20 | 1 request + 5 reply fragments |
| Host trust-boundary payload copy operations | 2 | 20 | 1 request + 5 reply fragments |
| Payload pipe reads/writes | 0 | 0 | 0 |

Each logical copy may split into two spans on wrap. Four logical payload-copy
stages per call are: EL0→request ring, hostile ring→Node-private staging,
Node completion cell→reply ring, reply ring→posted EL0 buffer. To achieve four,
request IPC carries **bounded descriptors**, and Node has a pre-registered
read-only view of each slot's request ring. Node validates descriptor bounds
against its own slot registry, copies header+payload directly into private
storage, validates that copy, then acknowledges consumed credit to the owner.
A shard cannot choose a host pointer/fd or cause a privileged mapping. A shared
IPC cell that the shard can still mutate is not private storage. If instead the
shard copies request payloads into IPC, Node must make another private copy
before policy validation: **five** logical payload-copy stages, not four. The
owner can copy replies directly from Node's completion cell; extra staging adds
another copy. Serialization
and deserialization allocations are additional. Immutable host→guest mappings
could remove a reply copy later, but are not a v2 requirement.

Promise.all(10) has one WAIT only if replies are published as one ready batch,
or the embedder's wait predicate intentionally waits for the all-of set. In a
normal any-ready asynchronous runtime, independently timed provider completions
can cause up to ten resume/WAIT cycles. Never delay the first required completion
just to advertise a better batch count; always report the completion pattern.
