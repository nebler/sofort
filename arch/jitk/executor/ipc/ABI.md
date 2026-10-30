# Node ↔ shard shared-memory IPC, revision 3 (ABI version 12)

Every number below is defined once in the jitk-abi crate (`../../abi`,
`ipc` and `ring` modules); `bridge_abi.h` and `../abi.ts` are generated from it.

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
length u32 @20, flags u32 @24 (MORE=1, nothing else), reserved u32=0 @28.
Length <=16,384. A message is one or more consecutive records of one direction
with the same kind, slot, generation and identity; every record but the last
carries MORE and exactly 16,384 payload bytes, the last none. Senders queue a
message's records together, so a receiver reassembles at most one message per
direction and the per-kind bounds below are on whole messages. Node
reassembles the shard's messages, which carry guest bytes, to 1 MiB
(`IPC.messageBytes`); the shard (and an HVF engine process, from its zygote)
reassembles Node's to 4 MiB (`IPC.nodeMessageBytes`), the largest class reply. Slot <configured cap<=64;
generation nonzero and <2^62 for run messages. READY has all header fields zero
other than kind and length; its 4-byte payload is the ABI version (u32 LE).
Node refuses a shard whose READY carries another version or none. Node sends
strictly increasing per-slot generations; Rust admits
exactly `last+1` only after reset. Every response must match the current Node
slot object and generation. Unexpected/stale/direction-invalid messages fail
the entire shard connection closed.

| Direction / kind | Payload / identity |
|---|---|
| Node START=1 | id=0; deadline monotonic ns u64, call cap u32=4096, call bytes u32=1048576, source bytes u32<=73728, memory reservation u32 = the snapshot class's admission bytes (glue-2m 2097152, the default; glue-4m 4194304; glue-8m 8388608; glue-16m 16777216), exact UTF-8 source bytes (the run body, NUL, the tenant code as data: `shardWire`); deadline no more than 60 s ahead |
| Node REPLY=2 | id of an open call, exactly one `{"ok":value}` or `{"err":{"code":...,"message":...}}`, escaped ASCII JSON of at most the snapshot class's reply bound (`ARENA_CLASSES[class].replyBytes`: 1048576 on glue-2m/4m, 2097152 on glue-8m, 4194304 on glue-16m) |
| Node CANCEL=3 | id=0, no payload; reset before RELEASED; reserved but unstarted slots can release directly |
| Shard CALL=16 | id 1..4096 in sequence, at most 64 open (sent, not answered), <=1048576 printable ASCII bytes; Node requires JSON `["call",namespace,function,args]` |
| Shard LOG=25 | id=0, one tenant console line, <=32768 printable ASCII bytes, at most 1024 per generation, no reply; Node requires JSON `[level,message]` under the v1 log budget |
| Shard DONE=17 | id=0, <=1048576 printable ASCII bytes, no outstanding calls; Node requires JSON `{"ok":value}` or `{"err":{"name":...,"message":...}}` |
| Shard ERROR=18 | id=0, <=512 diagnostic bytes; lease failure/memory bound/fatal guest |
| Shard RELEASED=19 | id=0, no payload; owner has completed stopped reset, slot may admit its next generation |
| Shard QUARANTINED=23 | id=0, 1..512 printable ASCII bytes (the reason); in place of RELEASED: the reset failed (HVF: or the slot's engine process died), the slot admits nothing until RESTORED. Node stops counting it as capacity and reports it (`onQuarantine`, else one stderr line); the Linux shard never restores a slot, so there Node fails the shard once every slot is lost |
| Shard RESTORED=24 | HVF engine only. id=0, no payload, generation = the one QUARANTINED ended, only for a quarantined slot: the zygote re-forked the slot's engine process from the snapshot and it is READY. Node counts the slot as capacity again (`onRestore`, else one stderr line) and admits its next generation. Unsolicited, it fails the connection |
| Shard READY=20 | ABI version u32 LE (exactly 4 bytes), once per connection after loading the snapshot (whose `.identity` must carry the same `abiVersion`) and starting owners/watchdog |
| Shard STATS=22 | id=0; owner CPU ns, stopped ns, reset-completed ns, the run's heap high-water bytes (ring `HEAP_PEAK`, at most the class's arena bytes; 0 when no run was bound) @24, count @32 (u64 each), count<=4096 u64 owner-observed policy round trips; once before DONE/ERROR |

PING=21 is only accepted by the offline `ipc-probe echo` executable mode; it
never admits a VM or grants guest access. Tests use it to exercise queue wrap
and pressure. The production reactor rejects it.

Rust checks admission fields, current generations/phases, reply identities,
payload lengths and printable ASCII; it forwards CALL/DONE/REPLY JSON opaquely
and never parses it. Node is the only JSON authority: the canonical protocol
dispatcher checks grammar, depth, scalar Unicode, duplicate keys, JSON numbers,
schemas, outstanding calls, wire budgets and frame order, then canonical
executor policy runs for every actual tool. A guest payload that fails those
checks fails only its own sandbox (Node sends CANCEL for that generation);
envelope, identity, order and state violations still close the whole shard
connection. `abi/guest-payloads.json` is the shared acceptance corpus for
both sides' tests. Logs are one-way LOG messages with their own budget (the
console path's LIMIT.logs/logBytes), not calls. A provider reply over its
class's reply bound (LIMIT.frame on glue-2m and glue-4m) fails its generation
as it fails a console-path run; a call over LIMIT.frame reaches the guest as a
LIMIT tool error (prepared helpers). In practice the snapshot's arena class
bounds big messages first (glue-2m by default, glue-4m, glue-8m or glue-16m with
`JITK_SHARD_CLASS`; executor/parity, shard/README.md "Limits").

Node's writer retains at most 1,048,960 unflushed records (every slot's START, a
reply of the largest class bound per open call, CANCEL). Rust's outbound queue is capped at 69,825
messages (per slot: the open calls, every log, STATS, DONE/ERROR,
RELEASED/QUARANTINED; plus READY); each owner command queue is
`66 * owned_slots + 1`; owner events are bounded by slots+owners. One live
generation per physical slot; no waiting thread per VM. Node queues at most
64+1024+2 events per sandbox and accepts at most 5,123 shard messages per
generation. Completion resolves before deferred stopped
reset; capacity stays charged until RELEASED. A dead connection fails every
live logical sandbox and Node kills the shard, whose watchdog observes its
pidfd. Node death kills the shard through PDEATHSIG.

The shard confines itself before READY (namespaces, Landlock, a seccomp
allowlist; `../../shard/README.md`, "Confinement (Linux shard)"). No cgroup
confinement, cache identity/signature, process-restart supervision, larger
`/cap` parity is claimed. Timers are the guest's: a WAIT whose DEADLINE word is finite parks
the slot until that time (or a reply), then the engine resumes it. Existing shard assertions can terminate the shard on hostile guest
ring violations. A CANCEL of a running slot kicks its owner out of KVM_RUN
and resets the slot at once; no command waits behind another slot's running
vCPU on the same owner (`../../shard/README.md`, "Owners"). The
independent watchdog stops a run at its deadline, and Node kills the shard
when a run reports no DONE/ERROR (or RELEASED after CANCEL) 1 s past it
(`DEADLINE_GRACE_MS`; `../../shard/README.md`, "Deadlines"). Per-run abort
also rejects an admission/reply blocked on queue credit. Pool shutdown kills
the persistent backend before waiting on logical slot exits, so an unresponsive
peer cannot hold shutdown behind a missing RELEASED acknowledgement.
