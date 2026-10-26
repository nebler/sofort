R8 shard library handoff, 2026-10-26. Worktree `/Users/noah/.t3/worktrees/sofort/t3-671e3337`, branch `t3/refactor-shard-library-1`, base `e17025f`. Implementation and available Mac verification are complete; **KVM acceptance remains pending**. kvm-dev paused during the disk incident and SSH times out during banner exchange. Per the lead's follow-up, no VM restart, resume, transfer or other mutation was attempted.

| Finding | Change | Commits / verification |
|---|---|---|
| R11 / A13 | Ordinary `jitk_shard` library with portable protocol/snapshot modules, Linux VM/platform/owner/IPC modules, explicit imports and crate visibility. Both entry files are thin. Offline preparation, ledger/probe drivers, JS and assembly fixtures belong to the binaries. Building the library no longer assembles fixture payloads. | `bed024f` recovers `31a82ce` by cherry-pick after the requested fast-forward failed; `f630a7b`, `df36419`. Mac build/tests and Linux cross-build pass. No `#[path]` or `use super::*` remains. |
| R12, shard | `Worker` owns its dependencies; command handling and slot driving are named methods. `Activity`, `Behavior`, `DriveUntil` and `Retention` replace the active/policy/canary bundle and boolean execution arguments. IPC's reactor separates messages, owner events and flushing. Offline scenarios and watchdog escalation are named functions with a `Stopping` record. | `f630a7b`, `e729877`. All 34 existing Rust test functions still compile/link; Linux execution pending. The reactor already had its typed `Phase` from wave 1; shared lease-word encoding is preserved. |
| R06, shard | Contracts at every unsafe boundary; checked KVM field access; `Running<'a>` borrows the signal-visible exit byte and cannot cross threads. Raw libc declarations/structs are replaced by libc's types. No lint suppression added. | `f630a7b`, `e729877`, `df36419`. Strict Mac and Linux cross-clippy pass, including crate-level `deny(clippy::undocumented_unsafe_blocks)`. |
| R09, shard | One local `constants` module holds UAPI, runtime/synthetic geometry, control offsets, record kinds, doorbells and GPAs. libc names replace syscall/fcntl/seal/mmap/poll/clock numbers. libc is pinned to the cached VMM kit's `0.2.186`. | `f630a7b`, `e729877`. Existing UAPI extraction remains local to shard; no cross-crate generation or wire changes. |
| R20 | JS fixtures, including the remaining small test sources, use named `.js` files with `include_str!`. Fixture bytes are unchanged. | `bed024f`, `f630a7b`. Assembly section/symbol changes also preserve the exact 380-byte stub and 92-byte attack payload. |

No intentional ABI, wire, guest layout, CLI or execution-policy change. The new structs/enums and borrowed guard add no hot-path allocation. Native scheduling, lease authority, sandboxing and shared ABI generation remain outside scope. This refactor does not claim a bug fix or a failing-before regression.

Before/after measurements compare `e17025f` with implementation head `df36419`:

| Measurement | Before | After |
|---|---:|---:|
| Rust physical lines under `src/`, including tests and both harnesses | 5,772 | 6,501 |
| Runtime module lines, including their unit tests | 4,258 | 4,645 |
| Unsafe blocks / impls / fn definitions, all Rust source | 111 | 99 |
| Same unsafe count, runtime modules | 91 | 76 |
| Default Rust/clippy warning sites, Linux cross-check | 0 | 0 |
| Additional undocumented-unsafe warning sites, deduplicated | 87 | 0 |
| Largest function, all Rust source | 255 lines (`real_harness::run`) | 120 (`streams::drain`, `ipc_json::value`) |
| Largest runtime function | 234 lines (`ipc_service::run`) | 120 |
| Owner worker loop | 162 lines | 63 (`Worker::run`) |
| Module graph | Two bin-owned trees, path aliases and implicit parent imports; no library | Explicit library plus two binary-owned harness trees, below |

Counts exclude comments/string contents when identifying unsafe and function braces; unsafe extern declarations are not executable unsafe sites. Function lengths include physical lines from `fn` through its closing brace. Runtime “before” includes the real backend, native adapter and shared modules; “after” includes the library, excluding both binary trees. Line growth reflects local safety contracts, named constants and module/interface declarations. Raw metrics and the scanner are in `arch/jitk/shard/test-results/shardlib/{source-metrics.json,metrics.py}`.

```text
jitk_shard
  portable: constants, arena, snapshot, entropy, inputs, ipc_json, streams
  Linux: clock, lease, ipc, kvm::{platform,native}, owner, ipc_service
  ipc_service -> owner -> kvm -> platform / native / lease
  lease -> clock; snapshot -> arena -> constants; streams / ipc -> constants
  owner / kvm / native also use the portable protocol modules
real -> harness::{driver,prepare,probe,native_hold} -> jitk_shard
jitk-shard -> synthetic::vm -> jitk_shard::constants
```

**Completed verification.** Apple M4 Pro/macOS, Rust `1.95.0`; all test batches checked Data-volume free space first (minimum observed about 59 GiB). One Cargo target directory peaked below 0.6 GiB; total observed task output stayed below 1.1 GiB even counting the entire shared Zig cache. The disposable baseline source copy and Cargo target were removed after validation. No kvm-dev disk writes were made.

- Mac `cargo +1.95.0 build/test --locked --offline`: **14 portable tests pass**. `cargo +1.95.0 clippy --locked --offline --all-targets -- -D warnings`, `cargo +1.95.0 fmt --check`, and `git diff --check`: clean.
- Linux arm64 musl **cross-build and strict all-target cross-clippy**: pass, both binaries and test executables link. This uses installed Zig Linux headers to evaluate `abi.c`, a temporary restored-after-use build-script shim, and installed clang/rust-lld. It is compilation evidence, not native Linux/KVM execution. Cargo uses the same sole target directory. Scripts/logs: `test-results/shardlib/{cross_check.py,linux-build.log,linux-clippy.log}`. Baseline audit: `baseline-clippy.jsonl` (0 default plus 87 undocumented sites).
- All **eight authorized Mac subtree suites pass**: VMM, VMM sandbox, protocol, executor, executor policy, MCP, bench, Hyperlight. Examples: VMM 180 fault runs, MCP 27 checks, Hyperlight 13 adapter checks. The first VMM attempt lacked its local built image; temporary dependency/image links to existing verified artifacts fixed that prerequisite and the rerun passed. These links were removed afterward. Kernel, grow and Linux Docker suites were deliberately excluded as instructed.
- Mac suites ran under `lockf -k /tmp/sofort-bench.lock`, recording uptime/load. Raw logs and exact environment: `test-results/shardlib/{mac-suites.json,mac-vmm-rerun.json,mac_suites.py,*.log}`. They used the existing kernel `.READY` image, SHA-256 `e3d774eb844f2cca9f1ba2b28c5b732c7ebc659e01dbafb0505d0d0f1d08b1f6`; no kernel source/image was rebuilt or changed by this task.
- Exact fixture comparison: `test-results/shardlib/fixture-bytes.json`; stub SHA-256 `81ed3ee53d9a28eb0871ba651457a4999118484bd8191edec84c00dedcb4c05f`, attack `9fea72e5234b3fba1c10e6c254e62258a42d80ce09d44103c98cd0cb7aa257b6`.

**Still pending when kvm-dev is available.** Transfer committed `arch/jitk` into `/home/dev/r8-shardlib/`, retain a single reusable target where practical, check the Mac disk before batches and keep new VM data below 5 GiB. The pinned libc crate must be present in the VM's offline Cargo cache (the existing VMM kit uses the same version).

```sh
cd /home/dev/r8-shardlib
export PATH=$HOME/.cargo/bin:$PATH JITK_NATIVE_ROOT=$PWD
make -C arch/jitk/shard test  # NO outer flock: harness acquires its own lock
# Required acceptance: 29 ordinary Rust tests, 41 native tuples exact twice,
# fd/region probes and mismatched-layout rejection.
export JITK_SHARD_TEST_SNAPSHOT=/home/dev/r7-ipc/prepared
export JITK_SHARD_TEST_SNAPSHOTS=/home/dev/r7-integrate/qjs-glue-2m:/home/dev/r7-integrate/qjs-glue-4m
flock /home/dev/bench.lock make -C arch/jitk/shard test-kvm
real=$PWD/arch/jitk/shard/target/release/real
flock /home/dev/bench.lock "$real" stress "$JITK_SHARD_TEST_SNAPSHOT" mixed 10000
# New helper snapshot base; preparer intentionally refuses existing artifacts.
flock /home/dev/bench.lock /home/dev/r7-ipc/node/node-v24.13.0-linux-arm64/bin/node \
  arch/jitk/shard/harness/prepare-helpers.mjs "$real" /home/dev/r8-shardlib/helpers
```

Then, from this Mac worktree:

```sh
JITK_NODE=/tmp/jitk-09/node-real JITK_SHARD_TEST=ssh \
JITK_SHARD_REMOTE_ROOT=/home/dev/r8-shardlib \
JITK_SHARD_REMOTE_SNAPSHOT=/home/dev/r8-shardlib/helpers \
JITK_NESTED_SSH=/Users/noah/code/sofort/kvm-dev/ssh.sh \
python3 arch/jitk/docs/delegate.py executor test-shard  # expected 121 assertions
```

Also pending: paired **main versus this branch** nested runs using identical snapshots, four owners, warm snapshot cache and `flock /home/dev/bench.lock`: reset p50 from `bench ... return2 200`, plus per-slot private-dirty slope from completed `hold ... return2` at N=1/64. Record uptime/load and raw receipts. **No latency, private-dirty or 10,000-restore non-regression result is claimed yet.** Do not stop/restart the VM; its recovery remains with the user/lead.

All implementation changes are confined to `arch/jitk/shard/`. The only tracked outside-scope change is this explicitly requested report. No PR or push was requested or created.
