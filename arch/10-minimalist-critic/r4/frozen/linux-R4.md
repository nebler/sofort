# 05 R4 — Linux final cleanup and v2 recertification

## FIXED

- F3: deleted all six duplicate Linux assembly fixtures. `build-faults.py` reads
  only `../vmm/tests/fixtures/`; all resulting images match their R3 bytes.
- F1: defaults derive from script location (`linux/.work`); removed fixed area
  scratch paths and the implicit sibling-owner base. Optional external inputs
  use documented `JITK_NESTED_BASE` / `JITK_CANONICAL_VMM`, with validation.
- F4: fresh canonical VMM build, pinned libkrun plus all current v2 patches,
  sandbox ready, panic=abort; rebuilt current kernel. Parking now uses this
  same kernel instead of the older pinned parking image.
- R3 raw evidence moved to `r3/linux-out/`; current portable evidence is in
  `../jitk/linux/out/`. Exported log path prefixes are normalized; exact raw
  logs are in `r4/raw-out/`. Test data and report SHA are unchanged.

## Reproduction and hashes

Ran from `cp -R arch/jitk /tmp/jitk-05/r4/anyname`, default work directory,
`JITK_NESTED_VCPUS=1`, reusing only our Debian base / stdlib cache via the
documented input. Fresh VMM/kernel builds and full nested H3 exit **0**.
Exact commands and external-input hashes: `r4/reproduction.json`.

- Tested VMM: `b6361878d4334b4f617f37a464305c2f2605c1f6f98f4aa5981e10c8f265fce3`.
- Tested kernel: `a7c39ab5679e75d3242f6f318cd5367ff866380e8f509085e974a49f1b6a6364`.
- Producer v2: `4445e2ccf6e2446b5d8ab03a5794cb4d94101516037f7328863308a95b16f028`.
- Rebuild bytes differ from producer; revision, patch hashes, compiler and build
  settings match (`r4/build-provenance.json`). This receipt certifies the
  rebuilt binary only. Full source/artifact hashes are in `linux/.R4` and
  `linux/out/source-inputs.json`, relative to the integrated kit.

## H3 PASS — NESTED functional, no performance claim

One outer vCPU; sampled Mac load1 32.99–140.85.
Every result below is PASS; load column is inner Linux / outer Mac load1.

| Gate | Result | Load1 range (inner / outer) |
|---|---|---|
| Current-image parking | 1000/1000, zero stalls; idle 0.0115% core | 0.24–0.48 / 114.79–120.56 |
| Boot / return 2 | 100/100 | 0.48–1.54 / 120.56–134.85 |
| Real tool call | 30/30 | 1.54–1.58 / 134.85–137.97 |
| Concurrency 1..8 | 800/800 | 1.54–6.42 / 100.13–140.81 |
| Density | 256 held, 256 returned | 4.17–6.42 / 77.52–100.13 |
| CPU controls | 100 setup + 100 bare VM | 4.08–4.08 / 74.67–74.67 |
| Seccomp | 720/720 | 3.83–4.08 / 74.67–74.67 |
| Fault guests | 180/180; 30 watchdog, 150 clean | 1.64–3.83 / 42.86–74.67 |

Cleanup: inner children **0**, QEMU exited and was reaped, build container gone;
final outer load1 32.99. Only our outer VM ran; density guests were nested KVM.
The bad-sysreg outcomes are explicit external 3 s watchdog SIGKILLs, all reaped.
Source/copy hash audit, syntax, missing-input error, dedup and path audits PASS
(load readings in `r4/static-checks.json` and source manifest).

## Still open

- Nested SMP4 lockup cause; precise guest/host-user CPU split; arm64 metal
  performance / 5 CPU-ms criterion. No cloud resource provisioned.
- Full PID/CPU cgroup limits and empty-netns coverage remain unclaimed.
- `linux/.R4` and refreshed `.READY` bind the tested artifacts and report.
