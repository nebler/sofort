02 / Round 4 — kernel PASS; `kernel/.R4` created.

FIXED F1: ship ioctl/ppoll assembly in `kernel/tests/fixtures/grow/`.
Tests/builds now default to subtree-local cache, output and work directories;
all historical area inputs, output paths and temporary-host defaults removed.
`JITK_VMM_BINARY` selects an explicitly built launcher; missing launcher fails
clearly. Byte scan of every kernel file finds no forbidden temporary-area or
`arch/NN-*` reference, including readiness metadata. README documents overrides.

FIXED F3: slots 93/94 both select `exit.rs`; build.rs emits shared modules once.
There is exactly one guest thread, so exit and exit_group have equal semantics.
Deleted `exit_group.rs`; missing-file dispatch remains slot-driven. The ioctl
fixture exits through 93, ppoll through 94; both run and their manifests assert
one registered handler/hash. Guest Rust+assembly is now 1,440 physical LOC.

Reproduction from workspace root (only an explicit VMM prerequisite):
```
cp -R arch/jitk /tmp/jitk-02/r4/anyname
JITK_VMM_BINARY=/tmp/jitk-01/r3/darwin/jitk-vmm \
  make -C /tmp/jitk-02/r4/anyname/kernel build test
JITK_VMM_BINARY=/tmp/jitk-01/r3/darwin/jitk-vmm \
  python3 /tmp/jitk-02/r4/anyname/kernel/tests/measure.py park 0
JITK_VMM_BINARY=/tmp/jitk-01/r3/darwin/jitk-vmm \
  python3 /tmp/jitk-02/r4/anyname/kernel/tests/measure.py integration
```
All commands exit 0. Source inventory matches the copied tested tree.
Image bytes unchanged by handler deduplication; current manifest updated.
Kernel SHA256: `a7c39ab5679e75d3242f6f318cd5367ff866380e8f509085e974a49f1b6a6364`.
VMM v2 SHA256: `276463d01ac6956a095814ed77053989d21bb52a7ef702f5c2698eb98daba20e`.
Manifest SHA256: `57571a7b7782fd0229dfd1354c85ea5602d06b6cba8b0e011c1fa3ffd44997bb`.

| Check | Result | Load 1/5/15, or per-sample load1 range |
|---|---|---|
| Copied build/test | PASS; packer 5/5, handler unit, VM regressions | 28.70/33.32/46.75 at regressions |
| Grow contract | 4/4, including both exits and deleted ioctl | 24.90/32.35/46.25 |
| G1 idle | 10.001s; observed 0.00 CPU-s / 0.00% core | 20.33/30.98/45.52 |
| G1 exchanges | 1000/1000, no stalls; RTT p50/p90/p99 57.542/89.583/123.083 us | 20.33/30.98/45.52 |
| G2 | 30/30 VMs, 1920 calls; all 64 pending before reverse replies | load1 13.69–15.54 |
| G2 batch | p50/p90/p99 2.242/2.571/2.772 ms | load1 13.69–15.54 |
| Parked one call | 30/30; p50/p90/p99 0.432/0.571/0.581 ms | load1 13.69–15.54 |
| Isolation | 9/9; per-variant image hashes and sandbox stderr saved | load1 24.90–26.80 |
| Clock origin | 30/30; worst bound 0.979374 ms | 28.70/33.32/46.75 |

Idle CPU is below ps's 0.01 CPU-s resolution, not proof of zero instructions.
Every G1/G2 quiet-load gate timed out: functional recertification only.
Maximum one owned VM live; every launch terminated and reaped. No foreign job
or owner subtree changed. All assigned F1/F3 checks are complete.

Evidence: [receipt](r4/receipt.json), [source hashes](r4/source-inventory.json),
[build/test log](r4/build-test.log), [G1](r4/parking-0.json),
[G2](r4/integration.json), [isolation](r4/probe-results.json),
[grow](r4/grow-contract.json). `.R4` binds main, probe and grow image hashes.
Open outside this task: quiet-host performance and production Linux/metal
recertification. Lua was not rerun in R4; historical R3 Lua evidence is separate.
