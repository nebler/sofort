# jitk — architecture as built

One submitted JavaScript body runs per single-use hardware VM. R4 H2 is reproduced;
H1 fails a stale protocol import guard, strict path hygiene fails, and the deadline
target remains unmet. [Final gates](../../10-minimalist-critic/R4.md), [claims](CLAIMS.md),
[criteria](KILL-CRITERIA.md), [exact artifact hashes](ARTIFACTS-R4.json).

```text
 TRUSTED HOST                                  HOSTILE GUEST
 caller -> TS executor -> bounded single-use pool
            |                    | spawn one process/VM
            +- canonical TS      v
            |  dispatcher   Rust/libkrun VMM -- virtio-console -+
            +- host policy  [OS sandbox; panic=abort]          |
            |  + credentials     ^ external watchdog         v
            +- approved tools    |                     qjs + bootstrap EL0
                 ^              +-- destroy/reap             | SVC
                 +---- ASCII JSON call/ret v1 ----------------+
                                                    Rust kernel EL1
                                                    MMU, syscall slots
 TRUSTED DEV: missing syscall -> Linux oracle -> reviewed proposal -> trace gates
              -> rebuilt RAW image/receipt -> unchanged static Lua fixture
```

Build-time packing selects a static ELF and canonical protocol bootstrap; no
runtime guest ELF parser. Fixed dispatch slots make a deleted handler ENOSYS.
Active consumers use one canonical protocol source; generated JS is build output.
The Hyperlight comparison adapter exposes distinct fresh-VM strict and shared-VM
logical-clone contracts. Growth now uses the explicit confined canonical-v2 VMM. Builder/oracle execution
is trusted; it is a different boundary from running hostile guest JavaScript.

Trust boundaries: guest EL0/EL1, tool results and frames are hostile to the host.
EL0/EL1 mappings mediate pointers/devices; a separate sandboxed VMM process limits
host access. Kernel diagnostics cannot authorize tools or establish success.
Host policy validates lookup/arguments/approvals and owns per-call credentials.
RUN follows stderr sandbox acknowledgement plus guest READY; validated `done`
resolves while capacity stays charged through reap. Each invocation passes its
absolute deadline to a separate watchdog process before RUN. The watchdog
survives blocked Node, but measured scheduling overshoot still fails the target;
API return and cooperative AbortSignal delivery also wait for a blocked callback
to resume ([final failures](CLAIMS.md)). Builder OS isolation remains unproven.

Configured limits: one vCPU/console,32MiB RAM (VMM also accepts64MiB),16MiB qjs
heap; frames1MiB/depth32/outstanding64/calls4096. These do not bound total host
memory or noncooperative tools. [Configuration/test evidence](CLAIMS.md).

Measured R4 using the unchanged R3 counter, load1 45.50. Physical lines include
comments/blanks, tests, build code and selected configuration. Vendor, generated
code, data and output are excluded. [Counter](count-loc.py), [frozen inventory](../../10-minimalist-critic/r4/frozen/review/loc-final.json).

| Component | LOC |
|---|---:|
| Kernel (runtime alone 1,440) | 2,314 |
| VMM | 1,115 |
| Sandbox | 539 |
| Executor | 1,158 |
| Policy | 248 |
| Canonical protocol | 878 |
| Grow | 976 |
| Bench | 691 |
| Hyperlight adapter | 614 |
| Linux kit | 640 |
| Docs scripts | 201 |
| Top Makefile | 35 |
| **Total** | **9,409** |

Down 1,249 from R3's 10,658. All 15 duplicate groups named by the R3 source
audit are resolved: one per-VM watchdog shared by executor/Hyperlight, canonical
kernel handlers for grow, canonical fault fixtures, one exit implementation,
and one policy test. A duplicate Linux/VMM fixture linker script remains.
The benchmark's multiplexed harness watchdog is a separate measurement helper.
Upstream libkrun patch delta +174/−93 remains separate. [Source audit](../../10-minimalist-critic/r4/frozen/review/source-audit-final.json).
No whole-product 1.5k claim; 9,409 still exceeds the 5,750 planning alarm.

Reproduce the inventory with `make loc`. The [Makefile](../Makefile) delegates
subtree README commands. Full source/build/receipt hashes and the separate
certified and rebuilt binaries are in the [frozen manifest](../../10-minimalist-critic/r4/frozen/manifest.json).
