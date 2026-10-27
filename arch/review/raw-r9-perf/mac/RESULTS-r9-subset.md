# Canonical benchmark results

Run: 2026-10-27T21:35:48.377000+00:00 → 2026-10-27T21:38:23.393000+00:00. Platform: darwin-25.6.0-arm64.
Start: `22:35  up 4 days, 49 mins, 1 user, load averages: 4.56 4.65 4.41`. End: `22:38  up 4 days, 52 mins, 1 user, load averages: 7.02 5.74 4.91`.

Gate: load1 < 6; 2 s budget/sample. Randomized complete blocks; seed 603.
Cold = spawn → validated done; parked = RUN → validated done after READY and 5 ms idle. Tools return asynchronously after 0 or 5 ms as named. JSON case parses/stringifies exactly 1 MiB internally, returns its length (not a 1 MiB protocol frame).
Executor = execute() → validated result; Node startup/pool preparation excluded. Refill = READY + kill/reap, 4 waves per sample. CPU = child user+system through reap; watchdog/supervisor excluded. Parked memory = process RSS/physical footprint, excludes HVF kernel allocations. Sandbox on/off = precompiled sandbox_apply versus clock-only baseline, no VM; not an end-to-end subtraction.
Cached binary/image/signature runs; first validation excluded. Single-use hardware VM except explicitly shared-HW Hyperlight logical clones. No nested-KVM performance.

Values and brackets: estimate [95% bootstrap CI], 2,000 IID resamples. Quantiles interpolate order statistics. n=30 p99 is poorly resolved; CI does not remove contention or serial dependence.
**Quiet credibility requires ≥30 gate-passed samples per row. A timed-out gate remains a contended sample; no idle-host conclusion follows. Latency percentiles are conditional on validated results; failures are counted separately and never treated as zero-latency successes.**

| Case / metric | n / fail | p50 [CI95] | p90 [CI95] | p99 [CI95] | load1 range | gated / timed-out |
|---|---:|---:|---:|---:|---:|---:|
| jitk-cold/return2 · ms · all | 30 / 0 | 8.499 [8.315, 8.710] | 9.525 [8.858, 10.206] | 10.289 [9.438, 10.329] | 4.37–7.94 | 24 / 6 |
| jitk-cold/return2 · CPU-ms/VM · all | 30 / 0 | 7.190 [7.028, 7.388] | 7.978 [7.453, 8.143] | 8.165 [7.934, 8.176] | 4.37–7.94 | 24 / 6 |
| jitk-cold/return2 · ms · gate-passed only · UNVERIFIED n<30 | 24 / 0 | 8.451 [8.227, 8.653] | 9.178 [8.676, 10.102] | 10.155 [8.837, 10.329] | 4.37–4.74 | 24 / 0 |
| jitk-cold/return2 · CPU-ms/VM · gate-passed only · UNVERIFIED n<30 | 24 / 0 | 7.114 [6.993, 7.277] | 7.630 [7.345, 8.165] | 8.167 [7.484, 8.176] | 4.37–4.74 | 24 / 0 |
| jitk-cold/one_tool · ms · all | 30 / 0 | 8.482 [8.181, 8.719] | 9.766 [8.945, 11.993] | 12.640 [9.562, 12.948] | 4.37–8.02 | 24 / 6 |
| jitk-cold/one_tool · CPU-ms/VM · all | 30 / 0 | 7.184 [7.032, 7.553] | 8.054 [7.727, 10.092] | 10.266 [7.844, 10.349] | 4.37–8.02 | 24 / 6 |
| jitk-cold/one_tool · ms · gate-passed only · UNVERIFIED n<30 | 24 / 0 | 8.212 [8.108, 8.531] | 9.216 [8.539, 9.507] | 9.520 [8.898, 9.562] | 4.37–4.74 | 24 / 0 |
| jitk-cold/one_tool · CPU-ms/VM · gate-passed only · UNVERIFIED n<30 | 24 / 0 | 7.049 [6.970, 7.274] | 7.686 [7.336, 7.794] | 7.798 [7.581, 7.809] | 4.37–4.74 | 24 / 0 |
| jitk-refill/8 · VM/s · all | 30 / 0 | 548.807 [514.587, 598.652] | 615.077 [603.784, 624.484] | 638.975 [614.622, 645.864] | 4.37–8.02 | 24 / 6 |
| jitk-refill/8 · CPU-ms/VM · all | 30 / 0 | 7.297 [7.067, 7.640] | 8.035 [7.807, 8.896] | 9.078 [7.985, 9.164] | 4.37–8.02 | 24 / 6 |
| jitk-refill/8 · VM/s · gate-passed only · UNVERIFIED n<30 | 24 / 0 | 586.708 [520.850, 604.869] | 617.415 [608.827, 638.738] | 640.401 [614.636, 645.864] | 4.37–4.74 | 24 / 0 |
| jitk-refill/8 · CPU-ms/VM · gate-passed only · UNVERIFIED n<30 | 24 / 0 | 7.142 [7.014, 7.424] | 7.816 [7.546, 8.843] | 8.918 [7.795, 9.164] | 4.37–4.74 | 24 / 0 |
| jitk-parked-memory/one_tool · ms · all | 30 / 0 | 0.468 [0.424, 0.495] | 0.609 [0.586, 0.807] | 1.460 [0.602, 1.770] | 4.37–7.57 | 24 / 6 |
| jitk-parked-memory/one_tool · CPU-ms/VM · all | 30 / 0 | 7.565 [7.307, 8.019] | 8.417 [8.122, 9.201] | 12.163 [8.383, 13.571] | 4.37–7.57 | 24 / 6 |
| jitk-parked-memory/one_tool · MiB RSS · all | 30 / 0 | 12.547 [12.531, 12.562] | 12.564 [12.562, 12.609] | 12.609 [12.562, 12.609] | 4.37–7.57 | 24 / 6 |
| jitk-parked-memory/one_tool · MiB footprint · all | 30 / 0 | 7.860 [7.852, 7.875] | 7.893 [7.875, 7.938] | 7.938 [7.891, 7.938] | 4.37–7.57 | 24 / 6 |
| jitk-parked-memory/one_tool · ms · gate-passed only · UNVERIFIED n<30 | 24 / 0 | 0.431 [0.407, 0.480] | 0.598 [0.488, 0.671] | 0.678 [0.596, 0.700] | 4.37–4.74 | 24 / 0 |
| jitk-parked-memory/one_tool · CPU-ms/VM · gate-passed only · UNVERIFIED n<30 | 24 / 0 | 7.407 [7.213, 7.692] | 8.354 [7.698, 8.645] | 8.661 [8.257, 8.715] | 4.37–4.74 | 24 / 0 |
| jitk-parked-memory/one_tool · MiB RSS · gate-passed only · UNVERIFIED n<30 | 24 / 0 | 12.547 [12.531, 12.562] | 12.573 [12.562, 12.609] | 12.609 [12.562, 12.609] | 4.37–4.74 | 24 / 0 |
| jitk-parked-memory/one_tool · MiB footprint · gate-passed only · UNVERIFIED n<30 | 24 / 0 | 7.875 [7.844, 7.875] | 7.902 [7.875, 7.938] | 7.938 [7.891, 7.938] | 4.37–4.74 | 24 / 0 |
| hl-strict/return2 · ms · all | 30 / 0 | 7.148 [6.875, 7.393] | 9.461 [7.891, 19.244] | 22.996 [9.166, 24.780] | 4.37–8.02 | 24 / 6 |
| hl-strict/return2 · CPU-ms/VM · all | 30 / 0 | 5.636 [5.318, 5.804] | 6.907 [5.838, 9.279] | 9.325 [6.569, 9.346] | 4.37–8.02 | 24 / 6 |
| hl-strict/return2 · ms · gate-passed only · UNVERIFIED n<30 | 24 / 0 | 7.053 [6.654, 7.197] | 7.788 [7.200, 8.521] | 8.537 [7.476, 8.591] | 4.37–4.74 | 24 / 0 |
| hl-strict/return2 · CPU-ms/VM · gate-passed only · UNVERIFIED n<30 | 24 / 0 | 5.358 [5.261, 5.667] | 5.816 [5.746, 6.481] | 6.519 [5.813, 6.645] | 4.37–4.74 | 24 / 0 |
| hl-strict/one_tool · ms · all | 30 / 0 | 7.333 [7.132, 7.687] | 16.451 [8.678, 24.319] | 24.465 [14.176, 24.535] | 4.37–7.66 | 24 / 6 |
| hl-strict/one_tool · CPU-ms/VM · all | 30 / 0 | 5.591 [5.370, 5.832] | 7.433 [6.816, 9.651] | 10.122 [7.312, 10.346] | 4.37–7.66 | 24 / 6 |
| hl-strict/one_tool · ms · gate-passed only · UNVERIFIED n<30 | 24 / 0 | 7.186 [6.841, 7.446] | 8.499 [7.475, 19.289] | 20.300 [7.998, 23.622] | 4.37–4.74 | 24 / 0 |
| hl-strict/one_tool · CPU-ms/VM · gate-passed only · UNVERIFIED n<30 | 24 / 0 | 5.486 [5.336, 5.706] | 6.786 [5.719, 7.256] | 7.273 [6.528, 7.329] | 4.37–4.74 | 24 / 0 |
| executor-cold/return2 · ms · all | 30 / 0 | 13.034 [12.933, 13.129] | 13.977 [13.235, 15.262] | 15.380 [13.852, 15.436] | 4.37–7.66 | 24 / 6 |
| executor-cold/return2 · ms done→resolve · all | 30 / 0 | 0.124 [0.121, 0.132] | 0.149 [0.136, 0.155] | 0.164 [0.147, 0.168] | 4.37–7.66 | 24 / 6 |
| executor-cold/return2 · ms · gate-passed only · UNVERIFIED n<30 | 24 / 0 | 13.016 [12.926, 13.080] | 13.846 [13.119, 15.378] | 15.392 [13.577, 15.436] | 4.37–4.74 | 24 / 0 |
| executor-cold/return2 · ms done→resolve · gate-passed only · UNVERIFIED n<30 | 24 / 0 | 0.123 [0.120, 0.131] | 0.146 [0.133, 0.153] | 0.153 [0.139, 0.153] | 4.37–4.74 | 24 / 0 |
| executor-cold/one_tool · ms · all | 30 / 0 | 14.174 [13.868, 14.543] | 16.535 [14.844, 17.337] | 17.876 [16.129, 18.133] | 4.37–7.57 | 25 / 5 |
| executor-cold/one_tool · ms done→resolve · all | 30 / 0 | 0.081 [0.076, 0.085] | 0.099 [0.088, 0.157] | 0.170 [0.099, 0.176] | 4.37–7.57 | 25 / 5 |
| executor-cold/one_tool · ms · gate-passed only · UNVERIFIED n<30 | 25 / 0 | 14.008 [13.774, 14.325] | 15.141 [14.549, 16.583] | 16.598 [15.072, 16.621] | 4.37–4.74 | 25 / 0 |
| executor-cold/one_tool · ms done→resolve · gate-passed only · UNVERIFIED n<30 | 25 / 0 | 0.081 [0.075, 0.086] | 0.097 [0.087, 0.133] | 0.142 [0.093, 0.155] | 4.37–4.74 | 25 / 0 |
| executor-parked/return2 · ms · all | 30 / 0 | 3.935 [3.761, 4.087] | 4.241 [4.123, 4.471] | 5.092 [4.222, 5.387] | 4.37–7.93 | 24 / 6 |
| executor-parked/return2 · ms done→resolve · all | 30 / 0 | 0.116 [0.109, 0.126] | 0.134 [0.129, 0.149] | 0.152 [0.134, 0.153] | 4.37–7.93 | 24 / 6 |
| executor-parked/return2 · ms · gate-passed only · UNVERIFIED n<30 | 24 / 0 | 3.862 [3.733, 4.081] | 4.136 [4.081, 4.222] | 4.225 [4.115, 4.235] | 4.37–4.74 | 24 / 0 |
| executor-parked/return2 · ms done→resolve · gate-passed only · UNVERIFIED n<30 | 24 / 0 | 0.112 [0.102, 0.126] | 0.133 [0.127, 0.136] | 0.136 [0.132, 0.136] | 4.37–4.74 | 24 / 0 |
| executor-parked/one_tool · ms · all | 30 / 0 | 4.734 [4.594, 4.843] | 5.084 [4.884, 5.791] | 5.912 [5.080, 5.970] | 4.37–7.62 | 24 / 6 |
| executor-parked/one_tool · ms done→resolve · all | 30 / 0 | 0.078 [0.071, 0.085] | 0.096 [0.087, 0.104] | 0.118 [0.095, 0.125] | 4.37–7.62 | 24 / 6 |
| executor-parked/one_tool · ms · gate-passed only · UNVERIFIED n<30 | 24 / 0 | 4.669 [4.580, 4.810] | 5.039 [4.825, 5.084] | 5.084 [4.948, 5.084] | 4.37–4.74 | 24 / 0 |
| executor-parked/one_tool · ms done→resolve · gate-passed only · UNVERIFIED n<30 | 24 / 0 | 0.078 [0.073, 0.085] | 0.095 [0.086, 0.102] | 0.102 [0.093, 0.102] | 4.37–4.74 | 24 / 0 |

Source selection (frozen at run start):

```json
{
  "kernel_source": "explicit override",
  "vmm_source": "explicit override",
  "source_image": "/private/tmp/r9s/mac/img/kernel.bin",
  "image_sha256": "e3d774eb844f2cca9f1ba2b28c5b732c7ebc659e01dbafb0505d0d0f1d08b1f6",
  "image": "/Users/noah/sofort-local-evidence/perf-r9-2026-10-27/mac/bench-scratch/jitk-bench-hkbGdM/kernel.bin",
  "source_vmm": "/private/tmp/r9s/mac/jitk-vmm",
  "vmm_sha256": "b15a7db1f172c9af56217dde7ff116dedb22b2633e601007fc9c9f3472af17b6",
  "vmm": "/Users/noah/sofort-local-evidence/perf-r9-2026-10-27/mac/bench-scratch/jitk-bench-hkbGdM/jitk-vmm",
  "argv": [
    "/Users/noah/sofort-local-evidence/perf-r9-2026-10-27/mac/bench-scratch/jitk-bench-hkbGdM/jitk-vmm",
    "--image",
    "/Users/noah/sofort-local-evidence/perf-r9-2026-10-27/mac/bench-scratch/jitk-bench-hkbGdM/kernel.bin",
    "--mem-mib",
    "32",
    "--sandbox-profile",
    "/Users/noah/sofort-local-evidence/perf-r9-2026-10-27/mac/bench-scratch/jitk-bench-hkbGdM/jitk.sbbin"
  ],
  "require_sandbox_ack": true,
  "sandbox_profile": "/Users/noah/sofort-local-evidence/perf-r9-2026-10-27/mac/bench-scratch/jitk-bench-hkbGdM/jitk.sbbin",
  "sandbox_profile_sha256": "daecf83de32b0e3f8190c4b9c3fc73dab454d3d8ebfcb561d464877f029107a0",
  "sandbox_probe": {
    "binary": "/Users/noah/sofort-local-evidence/perf-r9-2026-10-27/mac/bench-scratch/jitk-bench-hkbGdM/sandbox-probe",
    "profile": "/Users/noah/sofort-local-evidence/perf-r9-2026-10-27/mac/bench-scratch/jitk-bench-hkbGdM/jitk.sbbin",
    "profile_sha256": "daecf83de32b0e3f8190c4b9c3fc73dab454d3d8ebfcb561d464877f029107a0",
    "source": "canonical precompiled profile; sandbox_apply call only, no VM"
  },
  "hyperlight": {
    "strict_argv": [
      "/Users/noah/sofort-local-evidence/perf-r9-2026-10-27/mac/bench-scratch/jitk-bench-hkbGdM/hyperlight-worker",
      "strict",
      "/Users/noah/sofort-local-evidence/perf-r9-2026-10-27/mac/bench-scratch/jitk-bench-hkbGdM/hyperlight-snapshot"
    ],
    "clone_argv": [
      "/Users/noah/sofort-local-evidence/perf-r9-2026-10-27/mac/bench-scratch/jitk-bench-hkbGdM/hyperlight-worker",
      "clone",
      "/Users/noah/sofort-local-evidence/perf-r9-2026-10-27/mac/bench-scratch/jitk-bench-hkbGdM/hyperlight-snapshot"
    ],
    "env": {},
    "provenance": "Paths relative to this descriptor; build.sh generates absolute paths for the selected outputs. Hyperlight host 0.18.0; strict fresh single-use HW VM; clone shared HW VM; panic=abort",
    "files": [
      "/Users/noah/code/sofort/.claude/worktrees/agent-a6dc7948bc1e511c4/arch/jitk/bench/hyperlight/worker.rs",
      "/Users/noah/code/sofort/.claude/worktrees/agent-a6dc7948bc1e511c4/arch/jitk/bench/hyperlight/bootstrap.js",
      "/Users/noah/code/sofort/.claude/worktrees/agent-a6dc7948bc1e511c4/arch/jitk/bench/hyperlight/Cargo.lock",
      "/Users/noah/.cache/jitk/hyperlight/darwin-arm64-23528b093ceda08f/r2-worker",
      "/Users/noah/.cache/jitk/hyperlight/darwin-arm64-23528b093ceda08f/snapshot/index.json"
    ],
    "descriptor_sha256": "cac716f4070c46159b1e07379b7505a9464f17cd59d505c36f6c1db16611a2f1",
    "hashes": {
      "/Users/noah/.cache/jitk/hyperlight/darwin-arm64-23528b093ceda08f/r2-worker": "af1176bcf41765a9b41635adf806e08d5dd7cf74e08af683c62c2e5544a08a29",
      "/Users/noah/.cache/jitk/hyperlight/darwin-arm64-23528b093ceda08f/snapshot/index.json": "4c0f11144f5329d518046e98fd030ebe68f55f3082251e63584e2e47b63839dc"
    },
    "source_argv": {
      "strict_argv": [
        "/Users/noah/.cache/jitk/hyperlight/darwin-arm64-23528b093ceda08f/r2-worker",
        "strict",
        "/Users/noah/.cache/jitk/hyperlight/darwin-arm64-23528b093ceda08f/snapshot"
      ],
      "clone_argv": [
        "/Users/noah/.cache/jitk/hyperlight/darwin-arm64-23528b093ceda08f/r2-worker",
        "clone",
        "/Users/noah/.cache/jitk/hyperlight/darwin-arm64-23528b093ceda08f/snapshot"
      ]
    },
    "frozen_snapshot_hashes": {
      "blobs/sha256/2fd2c2bbd6d6e60f4e6f631dbc96c7b26b73270648c33fda7f9cf868509f82e7": "2fd2c2bbd6d6e60f4e6f631dbc96c7b26b73270648c33fda7f9cf868509f82e7",
      "blobs/sha256/58ab856911e7d5964b593fd828e4c272ffcfea520d80113ea36ddf5a1a21e0af": "58ab856911e7d5964b593fd828e4c272ffcfea520d80113ea36ddf5a1a21e0af",
      "blobs/sha256/627f136679a0415afb5b5f6e2bc4462a239386bf8669a13afa8f316b870d38be": "627f136679a0415afb5b5f6e2bc4462a239386bf8669a13afa8f316b870d38be",
      "blobs/sha256/bd70c43a2919f91b20d94808626e74499797ebfb5bca760b91f0f930ee7451b0": "bd70c43a2919f91b20d94808626e74499797ebfb5bca760b91f0f930ee7451b0",
      "index.json": "4c0f11144f5329d518046e98fd030ebe68f55f3082251e63584e2e47b63839dc",
      "oci-layout": "18f0797eab35a4597c1e9624aa4f15fd91f6254e5538c1e0d193b2a95dd4acc6"
    }
  },
  "executor": {
    "source": "/Users/noah/code/sofort/arch/jitk/executor",
    "integrated": true,
    "build": "/Users/noah/sofort-local-evidence/perf-r9-2026-10-27/mac/bench-scratch/jitk-bench-hkbGdM/executor/build",
    "node_modules": "/Users/noah/code/sofort/arch/jitk/executor/node_modules",
    "runtime_sha256": {
      ".work/cloudflare-binary.generated.mjs": "f4480e16e698c82ae58b544dde477f126160b3c900e4b3e7d21047c35fe7d860",
      ".work/cloudflare-github.generated.mjs": "bd8e51a8f4af8ece7e8e623f11292d73e3fb6c3acd2ab20d15807d86f1df9289",
      "build/api-check.js": "8c5c0c3e6219715fde22edb3cb3c9ab4b5328c41271b50c9ac3b2e77d222ae44",
      "build/backend.js": "1c6da4ddda1648250d4c52412998a4e4b419d2df80dac584b0d0187a0d0daa2b",
      "build/breakdown.js": "2f225eb2e4f0e0eb224e866a87fd315dc8134fa0e397b1d21d674bddc3132311",
      "build/code.js": "094acec6ca38d93cc72a2a15f92dba0bd3f4d7176ca3ef05d2619d0e25ac5370",
      "build/codec-source.js": "21b6d88d49c06b86c6ed48e58378abca5f95b1b7f1aa1a1bc623efae89acd85a",
      "build/codec.mjs": "731af9e407afbaf004de467ec7eb802036cb70e420818f8c155cad7f39a48b7e",
      "build/demo.js": "07e066c0a4c68c0f778d219b491b404fcce966b2814445b47ee05c176b2c4aac",
      "build/executor.js": "36ee6c91522c3b0d9e1ee4922bb007ff45c886ca5ca1976d83a8b3c91592bc18",
      "build/hyperlight-check.js": "33d2508003a384b50857e68ddd22c96b667feb555891710693bce5f69a42be44",
      "build/lib.js": "c40e3990e0811df36d337dc90de1507414e234f8ea91e41a0ace890d12e55fd0",
      "build/policy-adapter.js": "6a0c8660cf3fcb545db264db27560b671c1fede91a705b81e78e15c47b2834a8",
      "build/policy-check.js": "6bd375f1760bdd0caef605eb99c77ebefa022ec9704773dc14d59fa5a691f83b",
      "build/pool-check.js": "51fa432b0359c31b5a3d95996bf1de3977e6c62969c77e10cae0ec5e4aaddfed",
      "build/pool.js": "f30b81b9b7beccd50cb53bf64f41878b68acd25639fd2a41d73da61425216524",
      "build/preparation-check.js": "a76798f46abe4f2f323d6ac6f0b6886982ae5c7e231b6f98adc3ffd138cfdda5",
      "build/prepared-check.js": "72c6ac741c625a8e045ef7addc77623d565988c1cfd4db36f503bfc8357b7830",
      "build/prepared-helpers.mjs": "d87ae16599a3ce9085e631a32b91c8dcf100ed8ebe96d897b719467d2b11a7b5",
      "build/providers.js": "689f0ecb60589b2fb2ca6ab68a874a839a7dfc3fbfb19ee55afd242608366a28",
      "build/receipt-path.js": "6ee64e0e1a0625b5c33b716bfcae70cb51b0ba1057014716076f1c04066328f0",
      "build/resolve-check.js": "120af2ad04c28e18189fff46fbc928fdcbf281294d88baeb9ea49bac29f98016",
      "build/ring-bootstrap.js": "230fd3c073ccb54f907fca33f1f05a8ca45ee5933bfe27ee304ffc54821986a3",
      "build/sandbox-check.js": "20cb09f32e63ffac09951375b4ba544cc3ddd2f224d10c47524e08d22f84ab31",
      "build/select-backend.js": "9f391d395c0c33d9327fe6e5cefd0598baadf6bb2a97403e909e5343238bff6d",
      "build/shard-backend.js": "c483d5a0f7b2f58abb7ea4cde1f47ff006dbee91d5260b233a44be14d5308ec9",
      "build/shard-bench.js": "33936133ea3233fd49b739721e5af0f18a069a910ef6654d6f0e61f8298eca61",
      "build/shard-check.js": "dd781abe358c0c6e90d116ef7fad8f76386ee343d2d6454f5d3253ff2cce0d2a",
      "build/shard-helpers.js": "1807a0b5e2c315d063b00c78e8c6938b94df36f9afa14574061467d4fb288a4a",
      "build/shard-ipc-check.js": "b809958ba74ea935203fb657cbfd6370be3297eaa731a0afe8e54e54b40524f5",
      "build/shard-ipc.js": "00563013a28cf74762b8c1fef2ab85c62c3f6fd75147354c7322bd54dd6a3dad",
      "build/shard-source-check.js": "40cc6de8d0b8585dd7ce5065043ebc5909fd6eae5e55b0f298c8052545284117",
      "build/transport-check.js": "9bfa32c17a9f9696e461b871c2b77ba65257fee50b77980ea2d3a38533a512b6",
      "build/upstream.js": "2e1b114d980f334ff9d0aeb97fa26f3fa91e36004294c21ad87634970e9302fc",
      "build/verify.js": "4afa8bf881726f72391cf7d3d6c0357a45d273593647ebff15af62ce607fb130",
      "build/watchdog-check.js": "442c691c46c50b5d1ca8904e335e724142733d4c1a3f0e2d831b49c9b7afd0f0",
      "build/wrapper-conformance.js": "60035f601af67fe4295bd071436000eccd1b7499d4ed7abfbdbf7bdf71624277",
      "build.mjs": "7d8fa0b5e37394e915a8992fd2293bf2a0dd41f9914d1965ca9c52eba5c6ccca",
      "certify.mjs": "73c16e3b16909760b02d692f11ca3e61500d420f3492434fc6337fda7ed71d78",
      "codec.mjs": "731af9e407afbaf004de467ec7eb802036cb70e420818f8c155cad7f39a48b7e",
      "fixtures/ack-peer.mjs": "8696aaf17f2c4ed2159ccaf03a4ad86698a4f44437daa5743dffcf7d0ed992c0",
      "fixtures/protocol-peer.mjs": "9e0ca4b0c0c2638af9d99d27bbd10b237d92fb852bc2e36cf8e63fd9c18c413c",
      "ipc/measure-helpers.mjs": "73a5dd51b74b0adfab5d6d5b149f8f1ce0d04c10684c1be0eeab8a2e29a7d484",
      "ipc/regression-helpers.mjs": "0b7bec1ad8c91158dd7d660c7f1da34e7f4cd3d0598b33ab325648c98ef8e07a",
      "policy/policy-hostile.mjs": "da3bda12a752d21073b01cdec53c94accbb8d8b9135c35b9cc9528c58ab88f99",
      "policy/policy-test.mjs": "29e341d449ad9e8a1ebe18eab186ddb52a1bc6af234bc8958d9646221671a09c",
      "policy/policy.mjs": "ca082e55f8cc8f2ea6944e5d18d95fd39f0d3ecebf02a780bfc0b055bce168a0",
      "prepared-helpers.mjs": "d87ae16599a3ce9085e631a32b91c8dcf100ed8ebe96d897b719467d2b11a7b5",
      "shard-helpers.js": "1807a0b5e2c315d063b00c78e8c6938b94df36f9afa14574061467d4fb288a4a",
      "vendor/codemode.mjs": "79091b106e34cbf8fd972d43b7c46d3a3a0c5b732f1fbfbc6cab5191cdd241db"
    }
  },
  "node": "/Users/noah/.cache/jitk/node/v24.22.1-darwin-arm64/bin/node",
  "node_runtime": "{\"execPath\":\"/Users/noah/.cache/jitk/node/v24.22.1-darwin-arm64/bin/node-real\",\"version\":\"v24.22.1\"}",
  "harness_sha256": {
    "run.ts": "f71f126b4250f1ae762f943965142f064964aa8efbdda1d03c5a810214331c8d",
    "controller.ts": "ac1b0b0703d833e5ad4df8d10d955dc508ccd46f8cf9349249c9890b1de4d1f4",
    "lib.ts": "077dea6bc71f3f433b23fb1bb306851685591e4bccd2d0af399cc29626a74532",
    "native.ts": "4dd1c0db76f5f18f57fd7e51c854b8b8578bfaebb6cb32097878d62c3f55eb28",
    "native.c": "4505a55c9e56c72f033a546d1ca4b5cbfd49509b6d053768b8685b5b033f0222",
    "ffi.json": "12d1a4e3eceed03a327d7b83d493fddab5be281b7d4f1ca06e05e189fe064d80",
    "cases.json": "c00e3f14ac67000f7645a930c487a02123ea63c697dd05cd71e4186fc0034b46",
    "executor.mjs": "afba25fa20eb329c6e9feacb969ea501fff0eb2e797fefb980fc9b48e4d00b73",
    "watchdog.ts": "1486171499bf746a3b1945b46ec687c8bed74c416ad90f4ece77b2b0955c6170",
    "sandbox_probe.c": "4ed83ff4c0e19e320d062f8b4b2e70c6b2bbae99d473c25f5a0a13be95667fbb",
    "processes.ts": "deeab956ad61e83db2450002b71b1175253c1d1a99a517f6b22cdc2001a4a941"
  }
}
```

Missing integrations: .
Raw observations, timestamps, gate histories, result assertions, machine state, hashes and failures: [bench-raw.json](bench-raw.json).
All external performance claims must cite this table. R2 tables are historical contended measurements.
