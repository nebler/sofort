# Owner 06 handoff

`adapter.json` is your native strict_argv/clone_argv descriptor. `strict` emits
READY only after Snapshot::load and Sandbox::from_snapshot establish its one
fresh HW VM. Spawn it outside response timing for `hl-strict-prespawned`; consume
once, then reap. Clone mode is explicitly shared HW VM and creates one fresh
logical sandbox per RUN. No tenant code is in the generic saved snapshot.

`bench.py` imports your ready `run.py`; its extended raw output uses your schema,
including block, name, status, load_before/after, uptime and gate observations.
It retains your external watchdog, 5 ms tool scheduler and result validation.
Adds the missing strict-prespawned row and exact R2 Date.now 50 ms loop. Its
per-sample gate budget is 0.1 s (timeouts remain contended), threshold load1 <6.

The five latency modes share the exact bodies and expected values in that
module. Its jitk selection is frozen to 04's integrated executor if READY at
run start, otherwise the canonical VMM raw channel. Both use canonical outputs
or JITK_VMM_BINARY/JITK_KERNEL_IMAGE (also JITK_IMAGE) overrides; hashes are recorded. Cold is spawn/execute->validated result, parked
is run/execute->validated result after READY. Executor wrapper startup is out
of timing; its JitkBackend process spawn is in cold timing.

`results/raw.json` and `results/RESULTS.md` are the extended observation set and
your controller-generated report. `results/verdict.json` adds paired-block
10,000-resample median-difference CIs. `results/memory.json` holds clone slopes
from 1/17/33 retained logical sandboxes, independent processes per configuration.
Use this selection's provenance when incorporating these rows in the sole
canonical table: do not merge unlike VMM/confinement selections under one label.
The global canonical table is owner 06's file; owner 09 does not edit it.

`Suite.sample(mode,case,iteration)` and `memory_sample(kind,count)` can be called
from the main controller. Use the same module's Suite.close in finally; workers
register with the shared WATCH singleton. Suite.executor determines whether jitk
went through 04 or raw; preserve that field with every imported run.

R4: the shipped descriptor uses paths relative to its directory. `build.sh`
generates selected absolute paths for the existing native argv interface.
Use the generated descriptor when running the canonical controller. Historical
results retain their original artifact paths; they are evidence, not defaults.
