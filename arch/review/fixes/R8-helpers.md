# R8 helpers — P02 / review item 14

**Headline: shard-private + measured kernel density passes ≤0.6 MiB/slot
(0.578–0.584); the full integrated cgroup including Node does not
(0.632–0.655).** These are incremental slopes, not single-slot totals.
Nested memory accounting is valid; timing is indicative only.

## Change and regression evidence

- `0b4af59` — prepare codec/base64 and carrier helpers before QuickJS CHECKPOINT,
  using the existing `JITK_SCRIPT` build input. Only the JS profile preparer and
  executor change; **no edits to `kernel/` or `shard/src/`**. The separate image
  contains 3,984 B of shared helper source. A one-tool run sends **250 B instead
  of 3,677 B**, including late-bound user source and provider descriptors.
  Provider preludes also stay late-bound; policy and credentials remain in Node.
- Version-1 `.identity` binds SHA-256 of the actual helper source and each
  `.mem/.regs/.layout` file. `ShardBackend` verifies it before spawning/loading;
  old/mismatched helpers say `stale shard snapshot: prepared helper identity
  mismatch; re-run shard/harness/prepare-helpers.mjs`. Modified snapshot files
  also fail closed. The Rust/native layout format remains unchanged.
- `ipc/regression-helpers.mjs` runs unchanged against baseline/new executor builds:
  stale identity rejection and mutation of a helper function's property, `btoa`,
  and a global across **two generations of the same physical slot**.
  **Checked both regressions fail before and pass after**; receipts:
  [before](raw-r8-helpers/kvm/before/regressions.jsonl),
  [after](raw-r8-helpers/kvm/after/regressions.jsonl).
  `prepared-check.ts` additionally rejects a different helper hash and a changed
  memory file, and verifies legacy versus prepared source assembly.
- Default backend selection and legacy body are unchanged. Default image remains
  `75b2abe26021d9d0624b0555a64ed589d251cb7d30aa2965754974f3716d1732`.
- **P04 left unchanged:** `Dispatcher.feed/send/encode` couple canonical validation,
  wire budgets and transitions. Removing internal wire conversions safely needs
  an object-frame dispatcher API outside this scope, not a local parse bypass.

## Measurements

Baseline `35aeaad`, new `0b4af59`; **identical Rust shard binary** and version-2
2-MiB arena layout. kvm-dev: Ubuntu arm64, kernel 7.0.0-38, 6 vCPU / 9 GiB,
Node v24.13.0, nested HVF → KVM. All measurements hold `/home/dev/bench.lock`.
Memory load1: before 0.14–0.45; after 0.16–0.75. Environment and artifact hashes:
[environment.txt](raw-r8-helpers/kvm/environment.txt).

Real `MicroVMExecutor.execute('return (await codemode.echo(41))+1', ...)`, with
Node policy/provider/IPC enabled. Retain successful stopped slots immediately
before retirement/reset by overriding the offline harness pool's `retire`.
For each of two independent series, N=1,16,32,64; fresh Node/shard/watchdog cgroup
per point. Warm snapshot files outside that cgroup; settle 1 s; collect three
samples 200 ms apart, reduce by median, then least-squares fit across N.
No forced Node GC. Cgroup current includes Node, watchdog, KVM/kernel and charged
file cache. Shard `smaps_rollup` private dirty excludes Node and kernel charges.

| Incremental slope | Before, repeats 0 / 1 | After, repeats 0 / 1 |
|---|---:|---:|
| Shard private dirty, KiB/slot | 460.00 / 489.15 | 366.31 / 359.91 |
| Cgroup kernel, KiB/slot | 232.06 / 232.00 | 232.20 / 232.28 |
| Private + kernel, MiB/slot | 0.676 / 0.704 | **0.584 / 0.578** |
| Full cgroup current, MiB/slot | 0.756 / 0.770 | **0.655 / 0.632** |

| N slots | Before private dirty KiB, repeats 0 / 1 | After private dirty KiB, repeats 0 / 1 |
|---:|---:|---:|
| 1 | 9,380 / 9,380 | 9,292 / 9,292 |
| 16 | 16,280 / 15,856 | 14,872 / 16,896 |
| 32 | 23,640 / 23,300 | 20,824 / 20,392 |
| 64 | 38,360 / 40,032 | 32,380 / 32,728 |

Execute wall p50: **30.544 → 28.527 ms** (−6.60%); p99 39.686 → 34.922 ms.
N=100 serial runs per build after five warmups, one slot, retirement drained
between runs. Timing start load1 0.38 / 0.63. This is one indicative nested pair,
not a metal or statistically isolated latency claim.

All samples, cgroup stats, process rollups, load/uptime and timing observations:
[before](raw-r8-helpers/kvm/before/), [after](raw-r8-helpers/kvm/after/),
[reduced data](raw-r8-helpers/summary.json). No raw artifact exceeds 1 MiB.
A second eight-cell after-only collector validation (timeout handling in the offline
collector) is retained under `kvm/harness-check/`; it is excluded from the paired
summary above. The observed private saving is 94–129 KiB/slot, not the whole 172-KiB opportunity.
Further Node/all-in density work remains; this change alone does not certify the
full-service ≤0.6-MiB gate.

## Verification and reproduction

Mac executor suite PASS (including 14 prepared checks, 20 executor cases,
wrappers, policy, transport, watchdog and Hyperlight); MCP PASS (13 native
framing cases + 27 integration checks). IPC SSH PASS, 121 assertions; kvm-dev
`make -C arch/jitk/shard test` PASS, 19 Rust tests, 41 native cases twice,
fd/region probes. Logs: [Mac executor](raw-r8-helpers/mac-executor.log),
[Mac MCP](raw-r8-helpers/mac-mcp.log), [SSH](raw-r8-helpers/ssh/ssh-test.log),
[shard](raw-r8-helpers/kvm/after/make-shard-test.log).

```sh
# kvm-dev, sources staged under /home/dev/r8-helpers, PATH includes ~/.cargo/bin:
cd /home/dev/r8-helpers
export JITK_NODE=/home/dev/r7-ipc/node/node-v24.13.0-linux-arm64/bin/node
export JITK_SHARD_BINARY=$PWD/arch/jitk/shard/target/release/real
cargo +stable build --release --locked --offline --manifest-path arch/jitk/shard/Cargo.toml --bin real
"$JITK_NODE" arch/jitk/shard/harness/prepare-helpers.mjs "$JITK_SHARD_BINARY" "$PWD/helpers"
export JITK_SHARD_SNAPSHOT=$PWD/helpers
JITK_BACKEND=shard sh arch/jitk/executor/run.sh build
flock /home/dev/bench.lock sudo env PHASE=after JITK_NODE="$JITK_NODE" \
  JITK_SHARD_BINARY="$JITK_SHARD_BINARY" JITK_SHARD_SNAPSHOT="$JITK_SHARD_SNAPSHOT" \
  python3 arch/jitk/executor/ipc/measure-helpers.py
flock /home/dev/bench.lock "$JITK_NODE" arch/jitk/executor/ipc/measure-helpers.mjs bench 100
# Before: baseline executor build plus old prepared snapshot; PHASE=before.
# Copy raw/{before,after} into raw-r8-helpers/kvm, then:
python3 arch/jitk/executor/ipc/summarize-helpers.py arch/review/fixes/raw-r8-helpers
```

SSH reproduction uses `JITK_SHARD_TEST=ssh`,
`JITK_SHARD_REMOTE_ROOT=/home/dev/r8-helpers`,
`JITK_SHARD_REMOTE_SNAPSHOT=/home/dev/r8-helpers/helpers` with
`python3 arch/jitk/docs/delegate.py executor test-shard`.
The exact staged-source hashes/command are in
[ssh-command.json](raw-r8-helpers/ssh/ssh-command.json).
Mac commands use `JITK_NODE=/tmp/jitk-09/node-real`,
`JITK_VMM_BINARY=/tmp/jitk-01/r3/darwin/jitk-vmm`,
`JITK_KERNEL_IMAGE=/Users/noah/code/sofort/arch/jitk/kernel/dist/kernel.bin`,
`HYPERLIGHT_WORKER=/tmp/jitk-09/adapter-target/release/r2-worker`,
`HYPERLIGHT_SNAPSHOT=/tmp/jitk-09/r3-snapshot`, with
`lockf -k /tmp/sofort-bench.lock python3 arch/jitk/docs/delegate.py executor test`
(and `mcp test`). Scratch peaked at 545 MiB in kvm-dev; scratch build output was
removed after copying receipts. No VM lifecycle or kernel changes.
