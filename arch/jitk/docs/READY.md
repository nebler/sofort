# `.READY` markers

A `.READY` file is an owner's signal that a gate passed for a named artifact.
It is not independent proof: read what it names and rerun the gate when it
matters. Nobody edits a marker by hand; only the writer below may change it,
and a marker no tool reads may be deleted with the code it gated. These are
all of them:

| Marker | What it records | Written by | Read by |
| --- | --- | --- | --- |
| [`kernel/.READY`](../kernel/.READY) | the console kernel image (sha256, bytes) and every gate run on it on `hvf console`: G1 parking, G2, isolation, packer, grow contract, clocks, fs differential, grow R7 | `make -C kernel promote` ([`promote.ts`](../kernel/promote.ts)), which refuses unless every gate passes on the rebuilt image | `tools/ci.sh` (the built image must have this hash); `grow/runtime.ts` (required before copying the kernel); `protocol/vm.mjs` (selects the built image); the delegate (`docs/dispatch.ts`: prerequisite of `grow grow` and `bench bench`); `promote.ts` (previous image) |
| [`grow/.READY`](../grow/.READY) | the last accepted GrowOS transaction: run id, the canonical kernel source hashes it grew from, its report path (with [`grow/release.json`](../grow/release.json)) | `grow/loop.ts` when a `grow grow` transaction is accepted | the delegate (prerequisite of `grow demo`); the grow experiments, which refuse to finish if it or `release.json` changed during a run (`experiment-run.ts` `markers()`) |
| [`bench/.READY`](../bench/.READY) | the 2026-10-24 canonical benchmark run (41 cases, 60 samples each) | by hand (R3 bench owner); no tool writes it | `grow/runtime.ts` (present: guest timings use the bench's load gate); `bench/hyperlight/bench.ts` (recorded in the run's selection) |
| [`bench/hyperlight/.READY`](../bench/hyperlight/.READY) | the R3 Hyperlight adapter build and comparison | by hand (R3 owner); no tool writes it | the delegate (prerequisite of `bench bench`) |
| [`executor/policy/.READY`](../executor/policy/.READY) | empty: the policy module's owner declared it ready | by hand; no tool writes it | the delegate (prerequisite of `executor demo` and `bench bench`) |

Other gate receipts are not markers: the HVF parking gate is
`executor/.work/hvf-parking-gate.json` (`make -C executor hvf-parking-gate`),
the engine selection is `executor/.work/integration-selection.json`, and the
prepared shard snapshots carry an `.identity` file. `docs/.R4` and `grow/.R4`
are frozen round-4 review records.

Known gap (`arch/review/R11-REVIEW.md`, fix #7): `kernel/.READY` gates the
console image, while the product runs ring images from prepared snapshots.
