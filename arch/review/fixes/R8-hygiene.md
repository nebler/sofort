# R8 hygiene implementation — 2026-10-26

Worktree `/Users/noah/.t3/worktrees/sofort/t3-f2168179`; branch `t3/dead-code-scratch-vmm-hygiene`; base `35aeaad`. All requested changes are committed; no push. Durable validation receipt: [R8-hygiene-validation.json](R8-hygiene-validation.json).

| Finding | Change / commits | Verification |
|---|---|---|
| D04, D07–D12 | `be2da83`: remove obsolete bootstrap/helper/fallbacks, unused TS bindings and stale outputs/pointer; fix `grow/DEMO.md` to name each fresh run's `report.json`. | Benchmark unit suite; TypeScript compile; seven before/after dispatcher command comparisons identical; generic Bash dispatch and missing-entrypoint errors verified. |
| D01–D03 / scratch | `e14fb30`: delete generated trees; five kernel generators use disposable temporary workspaces; explicit overrides survive writable. Tests run in disposable source copies so tracked receipts are preserved. `31cae7f`, `d1da00e`: publish needed build products while preserving tracked manifests. `d8019f8`: ignore dependency symlinks/generated wrapper dumps. | Three scratch regressions and full Mac suites pass; clean Git status after the run. Isolation regression **checked failing before** against pre-fix delegate; manifest regression **checked failing before** against `31cae7f`. Exception cleanup removes read-only temporary trees; retained override becomes writable. |
| SSH scratch | `a4f4e44`: optional `JITK_NESTED_SSH_DIR`, quoted remote paths; this run uses `/home/dev/r8-hygiene/suites/`. | Full `linux test` PASS; its temporary remote run directory was removed. |
| A01–A06, K14 | `38f6177`, `d8019f8`: [ARCHIVE-PLAN.md](ARCHIVE-PLAN.md) inventories paths, sizes, citations and proposed actions. | **7,145 files / 211,710,821 bytes** of A01–A06 evidence preserved. Lead chooses archival storage/action; nothing moved or deleted. |
| R10 | `987f43c`: format all VMM Rust; dependency-free Cargo tooling manifest/lockfile. | `cargo +1.95.0 fmt --manifest-path arch/jitk/vmm/Cargo.toml --check`; explicit `rustfmt --check` for the nested escape harness: PASS. |
| R17 | `c645021`: named Prepared/BeforeBuild/Confined/Failed states; success advances only after all fallible operations succeed; partial failure poisons the object. | Malformed profile regression **checked failing before**: old `after_build()` incorrectly succeeded after failed `before_build()`; now rejected. |
| R15 | `8e8737f`: read compiled profiles through `Read::take(65537)` before validating the 64 KiB limit. | Boundary unit test; FIFO regression **checked failing before** against original VMM (`23ffc411…`, timeout after 3 s while writer withheld EOF); rebuilt VMM immediately rejects oversize with exit 70. |
| R06, R16 | `14dd124`, `30c3816`, `70e432e`: `OwnedFd` for namespace/ruleset/path/pidfd/kqueue ownership, borrowed syscall handles, errno captured before destruction; narrow production unsafe blocks with SAFETY contracts; iterator-based BPF jump patching. One-shot escape harness's broad block is explicitly documented. | Strict Mac **and Linux** Rust 1.95.0 Clippy: **zero warnings**, including `-D clippy::undocumented_unsafe_blocks`. Sandbox units **11 Mac / 10 Linux** pass; watchdog/lifecycle, VMM faults and certification pass. The only added lint suppression covers the seccomp test probe’s imported launcher-only APIs. |
| Reproduction | `728da2c`, `5c80316`: retained reproduction tooling (R8-receipts later moved the relinker to `arch/jitk/vmm/relink.py` and replaced the suite driver with `make -C arch/jitk test`). | Validation commands and environment below; no third-party source rebuild or shared checkout mutation on the Mac. |

Whole-file removals: **173 files / 28,796,917 bytes / 13,728 Git text lines** (`git diff --no-renames` from the base; binary lines excluded). D01–D03 alone: **168 files / 28,722,317 bytes**. These are gross deletions, excluding retained-file edits and formatting additions. Real fixtures, default `wait.rs` and D05/D06 wrappers remain; C01/C02 conditional retirements remain.

All eleven required subtrees passed: `kernel`, `vmm`, `vmm/sandbox`, `protocol`, `executor`, `executor/policy`, `mcp`, `grow`, `bench`, `bench/hyperlight`, `linux`. Hyperlight was enabled: adapter 13/13; executor conformance 6/6. MCP: native framing 13 and server 27 checks. Grow: 22 + 4 tests. Linux: 100 boots; 30 one-tool; eight concurrency levels ×100; 256 parked VMs; 1,000 parking exchanges; 720 seccomp and 180 fault cases; **zero remaining children**. Linux ran serially under `/home/dev/bench.lock` in the existing Ubuntu arm64 VM (nested HVF→KVM); these are functional results, not metal performance claims.

The VMM binary changed: Mac SHA-256 `23ffc4114cff036370bf30b10f727da7fbb23774e3f23c05eb4baeb26c4f1616` → `af5ccbb372e00d44215cfcc9e5ec4adc9eb4f09bd38db6e01c62c30bebaf20b8`; Linux rebuilt SHA-256 `601de56eb183904f46a307203c45c48db78dec9a84d425ba6a7b1f1a34b85f8c`. Executor certification **PASS**, including n=50 breakdown, under `/usr/bin/lockf -k /tmp/sofort-bench.lock`; MCP also passed. Default image unchanged: `75b2abe26021d9d0624b0555a64ed589d251cb7d30aa2965754974f3716d1732`. No `.READY` changes were needed or committed; new certification receipts are isolated evidence.

Reproduce using the receipt's `environment` map (absolute Node, VMM/image paths and enabled Hyperlight worker/snapshot). `JITK_VMM_BUILD/libkrun/target/release/deps` must contain the pinned existing patched rlibs; the relinker uses production flags and signs on macOS. Linux relinking/linting used a private Rust 1.95.0 toolchain under the assigned directory.

```sh
python3 arch/jitk/vmm/relink.py
python3 arch/jitk/vmm/lint.py
cargo +1.95.0 fmt --manifest-path arch/jitk/vmm/Cargo.toml --check
python3 arch/jitk/kernel/tests/test_scratch.py
python3 arch/jitk/vmm/tests/profile-bound.py --binary "$JITK_VMM_BINARY" --image "$JITK_KERNEL_IMAGE"
make -C arch/jitk test  # suite driver replaced by the aggregate target in R8-receipts
```

Raw local evidence: `.work/validation/*.log` and `certify-*`; `.work/linux-receipts/{report.json,nested.log,host-load.json,run-timing.json,nested-command.json}`; `.work/{stage-before,stage-after,profile-before,profile-after,manifest-before,generic-dispatch}.log`; `.work/linux-build-logs/`; `.work/vm-cleanup.log`. Final clean Mac run recorded uptime/load `6:16 … load averages: 6.79 6.43 6.21`; contended functional checks only. VM scratch observed at **1.3 GiB** (`du -sh`), then build, toolchain, copied sources and suite trees removed: **16 KiB of logs remain**. Mac retained scratch was 35 MiB before collecting the Linux report; transient trees are removed automatically.

Write scope honored: no edits to canonical `kernel/src/`, `kernel/build.rs` or `shard/`; executor changes only D09–D11. The extra SSH test-runner edit is listed above. Archive execution and D05/D06 belong to the lead/kernel owner. Git status was clean after all suites and certification; the final report commit is documentation only.
