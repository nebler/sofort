# Hyperlight baseline integration

`backend.ts` exports `HyperlightBackend(worker, snapshot, watchdogMs=5000)`.
It implements 04's R2 `park/read/send/kill/exited` lifecycle and uses protocol v1
without aliases. A strict worker receives exactly one run, then exits; snapshots
contain only the fixed bootstrap and initialized runtime. The trusted executor
continues owning tools, policy, credentials and cancellation.

The worker is `/tmp/jitk-09/adapter-target/release/r2-worker`; the immutable
persisted template is `/tmp/jitk-09/r2-snapshot` (OCI tag `base`). The saved
manifest digest is recorded in `metadata.json`. Production digest pinning and
OS confinement are not implemented by this benchmark adapter.

04's R2 `Backend.kind` union currently admits only `'jitk'|'local-qjs'`.
For a statically typed baseline selector it must also admit `'hyperlight-js'`.
09 cannot edit 04's files. `BaselineBackend` therefore widens only that tag and
typechecks all other members against 04's actual interface. The discriminator
does not affect 04's executor at runtime: `executor-test.mjs` imports the actual
04 R2 built executor and passes all six integration checks, including denial,
state isolation and deadline termination. No backend is mislabeled as jitk.

The adapter launches a signed Rust helper with an empty environment. A separate
Python watchdog can kill its process group even if Node's event loop is blocked.
`exited` waits for both worker and watchdog to be reaped. It uses a bounded,
copy of 03's v1 dispatcher, with the raw-DEL rejection corrected to match the
normative 0x20–0x7E wire range. No timer shim is provided: guest
`setTimeout` parity remains UNVERIFIED/unsupported here, outside the G5 corpus.

Two additional worker modes are for benchmarking only: `fresh` initializes a
new sandbox from source per request; `clone` restores a new logical sandbox
from the template per request. Both reuse one Apple hardware VM within their
process. They are never the strict adapter's execution mode.

Run `sh reproduce.sh` with the already-built R1 Hyperlight sources/toolchains.
It does not install packages, run copied Node launchers, or access `~/.local`.
The benchmark selects 02 R2 only when READY exists, otherwise uses the unchanged
R1 print image for the permitted cold print-only comparison. All child processes
are killed/reaped; failed samples stop the run and remain in the raw JSONL.
