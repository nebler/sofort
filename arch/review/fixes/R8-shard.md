R8 shard handoff, 2026-10-26. Worktree `/Users/noah/.t3/worktrees/sofort/t3-57feba22`, branch `t3/shard-guest-protocol-reset`, base `35aeaad`. No push. All implementation edits stay in shard `src/` and its Makefile; this report is the requested deliverable.

| Finding | Commit | Change and regression proof |
|---|---|---|
| R02 | `27c8f6e` | Convert failed F_GET_SEALS to an I/O error before testing SEAL/SHRINK/GROW. `rejects_regular_files_and_missing_seals` rejects an exact-size ext4 regular file, then tests incomplete and complete memfd seals. |
| R03 / A05, shard | `01142a5` | Typed `RunError::GuestProtocol` for hostile exits, doorbells, TX/RX cursors, headers, lengths, padding, kinds, identities, UTF-8/JSON, completion ordering, repair and policy schema. Owner resets only the failed run. Reply notification count uses the host bitmap, never guest arithmetic. Tests: `malformed_guest_records_are_run_errors`, `guest_reply_credit_is_checked`, `reply_notifications_use_host_shadow_not_guest_counter`, and KVM `guest_protocol_error_resets_only_its_run` (neighbor completes; bad slot resets and reuses cleanly). |
| A03 | `2bbf2ac` | Verify Glue2m support before creating the IPC endpoint/owners or publishing READY; derive START charge from that verified class. `ipc_rejects_unsupported_snapshot_classes` rejects Glue4m; malformed-admission tests retain charge validation. |
| R05, shard | `f4f1a9d` | Guest bytes copy into an owned Vec through volatile reads. No RAM slice escapes either mapping implementation; checked arithmetic/alignment and SAFETY contracts cover the access primitives. `guest_ram_reads_are_owned_copies` retains a read across a host write and proves it stays unchanged. |
| R13 | `33c7a36` | Snapshot load returns `io::Result`; checked register headers/data, architecture/encoded widths, duplicate IDs and count. Errors propagate through IPC/native/CLI. `snapshot_registers_reject_truncation_and_corrupt_widths` checks every truncated prefix, bad widths, unsupported width, duplicate ID and bad magic. |
| R15 | `195545b` | Read layout (72 B), registers (8 + 2048×272 B), and offline native requests through `Read::take(limit+1)` before parsing. `snapshot_metadata_reads_are_bounded_before_allocation` uses an endless reader that detects over-reading. |
| R08 | `95951e7` | Explicit Slot/Pool/Watchdog and fixture shutdown returns drain/join/process errors; normal harness/native EOF uses it. Drop is best effort. Keep independent escalation alive for unacknowledged leases. Shutdown repeatedly expedites leases so a queued Start cannot escape cancellation. `drop_does_not_panic_when_mmio_drain_fails`, `watchdog_drop_tolerates_unreset_leases_and_reaped_child`, and KVM `shutdown_interrupts_queued_spins_and_is_idempotent`. |
| P01 | `d05050f` | Discard precisely the writable regions from the verified class catalogue. Both classes: write every arena/ring page, reset, compare all 32 MiB pristine, and prove an immutable PTE stays present. Separate child processes verify immutable host stores SIGSEGV; hostile EL1 writes also fault. `make test-kvm` exposes the prepared-snapshot regressions. |
| Hygiene | `29e684f` | Behavior-preserving owner argument/error cleanup, standard divisibility/chunk idioms, and mapping safety comments. No crate restructure. |

Every bug regression above was checked failing against its prior behavior before the fix. Logs are `/home/dev/r8-shard/raw/{r02,r03,a03,r05,r13,r15,r08,p01}-before.log`; additional failing-before receipts: `r03-isolation-before.log`, `r03-counter-before.log`, and `r08-spin-before.log` (five-second timeout waiting on the original 30-second lease). Matching after logs and final suites remain alongside them. The immutable-store test already passed before P01; the new PTE-preservation assertion is what fails with full-RAM discard.

Remaining panics concern host setup/unsupported KVM operations, internal owner routing/admitted generations, trusted fixture expectations, and a broker answering an unrequested/already answered call. Fixed-length header conversions follow checked 32-/16-byte copies. A failed checked reset still fails the shard closed; an ordinary guest protocol error uses the successful reset path and does not abort it.

Validation on kvm-dev (Ubuntu 26.04 arm64, Linux 7.0.0-38-generic, Rust stable 1.99.1, 6 vCPU/9 GiB, HVF → nested KVM):

- Final `make -C arch/jitk/shard test`: **29 Rust tests, 82/82 native exact tuples**, fd/region probes and mismatched-layout rejection pass. `make test-kvm`: **5/5 targets** pass (four regressions plus their subprocess helper).
- IPC SSH runner: **119 assertions / 32 metrics**, PASS; final source rerun also PASS (`raw/ipc-final.log`). Runner executed without editing executor: only its scratch/output paths were redirected in memory into this task's directories.
- P01 conformance: **10,000/10,000 restores**, 64 slots, zero canary leaks/cross-talk, 10,000 fresh roots; **200/200** distinct Math.random and libc receipts; **100 hostile all-dirty/reset/reuse runs per class**; **64/64** deadline slots reused; eight staggered leases preserve unrelated spins. Logs: `stress-10000.jsonl`, `canary-200.jsonl`, `hostile-qjs-glue-{2m,4m}.jsonl`, `deadlines.jsonl`, `staggered.jsonl` under the raw directory.
- `cargo fmt --check` on Mac and Linux; Linux `cargo +stable clippy --all-targets -- -D warnings`: clean. `git diff --check`: clean.
- All ten Mac subtree suites pass in disposable `/tmp/r8-shard-mac` (no edits to kernel/executor working files): kernel, vmm, vmm/sandbox, protocol, executor, executor/policy, mcp, grow, bench, bench/hyperlight (13/13). Logs in this worktree's ignored `arch/jitk/shard/test-results/mac-suites{,-remaining}.log`. MCP initially lacked its dependency link; correcting the disposable copy and rerunning MCP plus remaining suites passed. Default libkrun image remains SHA-256 `75b2abe26021d9d0624b0555a64ed589d251cb7d30aa2965754974f3716d1732`.

Paired nested measurements use identical `/home/dev/r7-ipc/prepared`, return2, one slot/four owners, warm snapshot cache, and `flock /home/dev/bench.lock`. These timings are indicative, not metal results. Before/after load1: **0.00 / 0.39**; full load/uptime is recorded in `before-uptime`, `after-uptime` and each JSONL environment row.

| Measurement | Full 32-MiB discard | Writable-only discard |
|---|---:|---:|
| Reset p50 / p99, n=200, nearest rank | 1.721 / 2.784 ms | 0.715 / 0.998 ms |
| KVM guest fault events, n=100 | 37,200 | 20,865 |
| Events/run, including first cold entry | 372.00 | 208.65 |

Steady state is 372 → 207 faults/run (165 avoided); the writable batch includes one 372-event cold run. Raw files: `before-bench.jsonl`, `after-bench.jsonl`, `{before,after}-fault-bench.jsonl`, `{before,after}-perf.txt`. Baseline is `35aeaad`; the measured P01 source before subsequent shutdown/counter/format cleanup is archived in `raw/p01-measured-source.tar`. Final correctness suites use the final source. The report does not attribute a metal latency improvement.

Reproduction in `/home/dev/r8-shard` after copying this commit's `arch/jitk`:

```sh
export PATH=$HOME/.cargo/bin:$PATH JITK_NATIVE_ROOT=$PWD
make -C arch/jitk/shard test
export JITK_SHARD_TEST_SNAPSHOT=/home/dev/r7-ipc/prepared
export JITK_SHARD_TEST_SNAPSHOTS=/home/dev/r7-integrate/qjs-glue-2m:/home/dev/r7-integrate/qjs-glue-4m
flock /home/dev/bench.lock make -C arch/jitk/shard test-kvm
real=$PWD/arch/jitk/shard/target/release/real
flock /home/dev/bench.lock "$real" stress "$JITK_SHARD_TEST_SNAPSHOT" mixed 10000
flock /home/dev/bench.lock "$real" bench "$JITK_SHARD_TEST_SNAPSHOT" return2 200
sudo -n flock /home/dev/bench.lock perf stat -e kvm:kvm_guest_fault \
  "$real" bench "$JITK_SHARD_TEST_SNAPSHOT" return2 100
cargo +stable fmt --manifest-path arch/jitk/shard/Cargo.toml --check
cargo +stable clippy --offline --manifest-path arch/jitk/shard/Cargo.toml --all-targets -- -D warnings
```

**Outside-scope dependency:** A05's bootstrap bug remains in `kernel/ring-bootstrap.js:20`: encode/check the 1,024-byte limit **before** incrementing `next`; remove pending state when a write fails, and leave the ID available on an uncommitted failed write. The kernel owner must supply that change and rebuild prepared QuickJS snapshots. This branch's mock probe confirms oversized-then-small still tries fd130 instead of fd129 (`arch/jitk/shard/test-results/bootstrap-call-id.json`). No kernel or executor files were edited. The only prepare/checkpoint call-site adaptations are handling the newly fallible `exit()` and borrowing the owned RAM dump for `write_all`; no helper inputs or checkpoint semantics change.

No Tier 2 lifecycle/lease-authority/sandboxing/atomic snapshot identity work is claimed. Scratch build output and the 306-MiB disposable Mac copy were removed after validation. VM scratch fell from 518 MiB to 4.1 MiB of raw receipts/source archives under `/home/dev/r8-shard/raw/` (`cleanup.txt`).
