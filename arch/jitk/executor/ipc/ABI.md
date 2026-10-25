# Node ↔ shard shared-memory IPC, revision 1

Linux arm64, little endian, one Node producer/consumer and one shard reactor.
Three inherited descriptors: fd3 sealed memfd, fd4 Node→shard eventfd, fd5
shard→Node eventfd. Doorbells carry counters only; every payload uses shared
memory. Eventfd callbacks also return queue credit. Fixed owner channels wake
the reactor through fd4. No per-call process, pipe write or helper thread.

The memfd has exactly 2,105,344 bytes, with SHRINK/GROW/SEAL seals. The first
4,096 bytes are control. Atomic u64 record cursors: Node produced @64, shard
consumed @128, shard produced @192, Node consumed @256. Each direction has 64
fixed 16,416-byte slots (32 header + 16,384 payload); Node TX starts at 4,096,
shard TX at 1,054,720. Publication is release, observation acquire. Cursors
count records and never reset during a connection. Slots wrap modulo 64.

Each endpoint privately shadows its own producer and consumer cursors and the
last peer-consumer value. Producer checks `last_peer <= consumed <= private_tx`
and `private_tx-consumed <=64`; consumer checks `private_rx <= produced` and
`produced-private_rx <=64`. A compromised peer cannot grant credit by rewriting
local published cursors. Counter exhaustion fails closed. A receiver copies the
entire fixed slot to private storage before parsing its header; no hostile field
controls that copy or supplies an address. Padding beyond payload is ignored.

Header: kind u32 @0, slot u32 @4, generation u64 @8, identity u32 @16, payload
length u32 @20, reserved u64=0 @24. Length <=16,384; slot <configured cap<=64;
generation nonzero and <2^62 for run messages. READY has all fields zero other
than kind. Node sends strictly increasing per-slot generations; Rust admits
exactly `last+1` only after reset. Every response must match the current Node
slot object and generation. Unexpected/stale/direction-invalid messages fail
the entire shard connection closed.

| Direction / kind | Payload / identity |
|---|---|
| Node START=1 | id=0; deadline monotonic ns u64, call cap u32=32, call bytes u32=1024, source bytes u32<=8192, memory reservation u32=2097152, exact ASCII source bytes; deadline no more than 60 s ahead |
| Node REPLY=2 | physical id 1..32, exactly one `{"ok":value}` or `{"err":{"code":...,"message":...}}`, escaped ASCII JSON <=1024 bytes |
| Node CANCEL=3 | id=0, no payload; reset before RELEASED; reserved but unstarted slots can release directly |
| Shard CALL=16 | physical id 1..32 in sequence, <=1024-byte JSON array `["call",namespace,function,args]` or `["log",level,message]` |
| Shard DONE=17 | id=0, <=16352-byte JSON `{"ok":value}` or `{"err":{"name":...,"message":...}}`; no outstanding calls |
| Shard ERROR=18 | id=0, <=512 diagnostic bytes; lease failure/memory bound/fatal guest |
| Shard RELEASED=19 | id=0, no payload; owner has completed stopped reset, slot may admit its next generation |
| Shard READY=20 | empty, once per connection after loading snapshot and starting owners/watchdog |
| Shard STATS=22 | id=0; owner CPU ns, stopped ns, reset-completed ns, count (u64 each), count<=32 u64 owner-observed policy round trips; once before DONE/ERROR |

PING=21 is only accepted by the offline `ipc-probe echo` executable mode; it
never admits a VM or grants guest access. Tests use it to exercise queue wrap
and pressure. The production reactor rejects it.

Rust checks admission fields, current generations/phases, reply identities and
bounded duplicate-free JSON (depth<=32, structural nodes<=4096). Node additionally
uses the canonical protocol dispatcher for scalar Unicode, duplicate keys,
JSON numbers, schemas, outstanding calls, wire budgets and frame order, then
canonical executor policy for every actual tool. Log records get only a null
acknowledgement. Logical tool IDs exclude logs; Node privately maps them back
to physical ring IDs. Oversized provider replies become a bounded LIMIT error.

The generic writer retains at most 2,241 records. Production messages have
smaller per-kind bounds above. Rust's outbound queue is capped at 2,241 records;
each owner command queue is `34 * owned_slots + 1`; owner events are bounded
by slots+owners. One live generation per physical slot; no waiting thread per
VM. Node queues at most 34 protocol frames per sandbox and accepts at most
35 shard records per generation. Completion resolves before deferred stopped
reset; capacity stays charged until RELEASED. A dead connection fails every
live logical sandbox and Node kills the shard, whose watchdog observes its
pidfd. Node death kills the shard through PDEATHSIG.

No production seccomp/Landlock/cgroup confinement, cache identity/signature,
process-restart supervision, larger memory class, timer or `/cap` parity is
claimed. Existing shard assertions can terminate the shard on hostile guest
ring violations. Busy-vCPU cancellation waits for its existing lease; the
independent watchdog remains the deadline enforcement mechanism.
