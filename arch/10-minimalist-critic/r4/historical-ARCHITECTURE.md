# jitk — architecture as built

One submitted JavaScript body runs per single-use hardware VM. H2 is reproduced;
H1 still fails a copied-tree fixture dependency. [Gate evidence](../../10-minimalist-critic/R3.md), [claims](CLAIMS.md), [criteria](KILL-CRITERIA.md).

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
logical-clone contracts. Growth currently uses a separate native functional host.

Trust boundaries: guest EL0/EL1, tool results and frames are hostile to the host.
EL0/EL1 mappings mediate pointers/devices; a separate sandboxed VMM process limits
host access. Kernel diagnostics cannot authorize tools or establish success.
Host policy validates lookup/arguments/approvals and owns per-call credentials.
RUN follows stderr sandbox acknowledgement plus guest READY; validated `done`
resolves while capacity stays charged through reap. A fixed-lifetime external
watchdog survives blocked Node, but the short invocation deadline can overrun
([observed failure](../../10-minimalist-critic/r3/h5-resource-probe.json)). Builder/oracle/proposal execution is trusted; builder OS isolation is unproven.

Configured limits: one vCPU/console,32MiB RAM (VMM also accepts64MiB),16MiB qjs
heap; frames1MiB/depth32/outstanding64/calls4096. These do not bound total host
memory or noncooperative tools. [Configuration/test evidence](CLAIMS.md).

Measured02:21 UTC, owned physical lines including tests/build/config and copies;
exclude vendor/generated/data/output. [Script](count-loc.py), [per-file hashes](../../10-minimalist-critic/r3/loc-final.json).

| Component | LOC |
|---|---:|
| Kernel (runtime alone1455) | 2,187 |
| VMM / sandbox | 1,115 / 539 |
| Executor / policy | 1,089 / 248 |
| Canonical protocol | 878 |
| Grow (includes fallback kernel) | 2,505 |
| Bench / Hyperlight | 535 / 585 |
| Linux kit | 749 |
| Docs scripts / top Makefile | 193 / 35 |
| **Total at snapshot** | **10,658** |

Separate [source audit](../../10-minimalist-critic/r3/source-audit-final.json): upstream libkrun patches+174/−93; external native grow host31 owned lines. No whole-product1.5k claim.
Reproduce inventory with `make loc`; [top Makefile](../Makefile) delegates subtree README commands. Evidence: [H1](../../10-minimalist-critic/r3/h1-poll-05.json), [H2](../../10-minimalist-critic/r3/h2-01.json), [H3](../linux/out/report.md), [canonical H4](../bench/RESULTS.md), [H5](../../07-security-sandbox/R3.md).
