# Cross-subtree contracts (lead-maintained; owners: read before integrating)

## vmm ↔ sandbox (01 ↔ 07) — proposed by 01, 07 to confirm/adapt
Rust module at `vmm/sandbox/` (owned by 07), consumed by `vmm/` (01) without modification:
```rust
Sandbox::prepare(image: &Path, profile: Option<&Path>, netns_fd: Option<i32>) -> Result<Sandbox>
fn before_build(&mut self) -> Result<()>   // macOS: apply precompiled Seatbelt profile
fn after_build(&mut self) -> Result<()>    // Linux: seccomp/Landlock after libkrun threads exist (or per-thread hook)
fn compile_profile(images: &Path, out: &Path) -> Result<()>   // macOS, run once by supervisor
```

## vmm CLI ↔ executor / linux (01 → 04, 05)
- Existing flags stay: `--image --mem-mib --seed --epoch-ns --wait-go`.
- macOS: supervisor compiles the profile once with `jitk-vmm --compile-profile OUT --images DIR`, then passes `--sandbox-profile PATH` to every worker.
- **Host-only sandbox ack:** exactly `{"sandbox":"ok"}\n` on **stderr**. It is emitted after `before_build` on macOS and after `after_build` on Linux.
- **Executor rule (04, 05):** send `run` only after **both** the stderr sandbox ack **and** the guest's `{"t":"ready","v":1}` on stdout. A missing ack means kill the worker; never run.

### Update from 01 (VMM)
- The concrete adapter is in `vmm/src/confinement.rs` and `vmm/src/main.rs`.
- Once `vmm/sandbox/.READY` exists, `vmm/` re-exports the real implementation via `#[path="../sandbox/mod.rs"]`. **07: expose a `mod.rs` at `vmm/sandbox/mod.rs`.**
- 01 will adapt to 07's preferred signatures.
- **Linux:** stderr must stay a **pipe**, because RLIMIT_FSIZE=0 forbids regular-file writes. The ack goes over that pipe.

### 07 response (vmm ↔ sandbox): API confirmed, no signature change; `vmm/sandbox/.READY` exists
- `vmm/sandbox/mod.rs` exports exactly the items 01's `confinement.rs` expects:
  - `Sandbox::prepare(&Path, Option<&Path>, Option<i32>)`
  - `before_build(&mut self)`
  - `after_build(&mut self)`
  - the free function `compile_profile(&Path, &Path)`

  The error type is `Box<dyn Error>`.
- Verified: 01's `src/main.rs` builds with `--cfg sandbox_ready` against the patched series (`build.py`, with `JITK_VMM_BUILD` set to a 07 temp dir). On macOS it boots `/tmp/jitk-02/r2/kernel.bin` and completes `ready → run → call → ret → done(2)`, printing exactly one `{"sandbox":"ok"}`.
- Semantics that 01 and 05 rely on:
  1. `image` must be **canonical**. `prepare` rejects any other path. The profile and Landlock rules name the resolved path; on macOS, `/tmp` itself is a symlink.
  2. macOS rejects `netns_fd`, and Linux rejects `profile`. If `profile` is `None` on macOS, the profile is compiled in-process (~5 ms, same policy).
  3. **The per-thread hook is internal.** On Linux, `before_build` calls `utils::thread_hook::set(enter_thread)`. This needs `thread-hook.diff`, which is already in `patches/series`. The vCPU confines itself before its first `KVM_RUN`. If the hook did not run, `after_build` falls back to one union filter with TSYNC. The thread timing is safe because `start_threaded` waits for TLS init, which runs after the hook. 01 does not need to register anything.
  4. The module does **not** print the ack. 01's `main.rs` prints it at the right place for each OS. Keep the ack directly after `after_build()` on Linux and directly after `before_build()` on macOS, and never after `--wait-go`.
  5. Linux: `netns_fd` is closed after `setns`. stderr must be a pipe (`RLIMIT_FSIZE=0`). `PDEATHSIG=SIGKILL` is set.
- **Patches:** `patches/series` (robustness → thread-hook → control-rx → native-build) applies cleanly, in order, to a1d8616. 02's control-RX one-liner touches only `event_handler.rs`, which neither 07 patch touches, so no combined patch is needed.
- **Supervisor (04/05):** place workers in cgroups only through `clone3(CLONE_INTO_CGROUP)` or a `favordynmods` mount; see `vmm/sandbox/README.md`.

### 07 response (H5 fault-guest classification + patch v2)
- **bad-sysreg.S on KVM:** classify it as **"contained by external watchdog (expected on KVM)"**. This is a separate outcome class from "clean exit", and both count as contained when there is no host effect. Keep the original fixture: an EL1 guest spinning in exceptions is a legitimate runaway-CPU attack. 01's VBAR→SYSTEM_OFF variant is the right clean-exit comparison; 07 has the same fixture as `07-security-sandbox/h5/guest/vbar-sysreg.S`.
- **New finding:** stock and v1 libkrun `undo_pop()` a console chain that yields 0 bytes. A guest that offers one TX descriptor outside RAM or of zero length, or one unusable RX descriptor while host input is pending, re-pops that chain forever. That pins a host thread at 100% CPU even while the vCPU sits idle in WFI.
  - **Observed** on the integrated macOS build: `console-abuse-4` (TX descriptor outside RAM) hung until it was killed (rc 137).
  - **Fix:** `07-security-sandbox/patches/libkrun-robustness-v2.diff` replaces `libkrun-robustness.diff`. It is a superset that also consumes such chains in `process_tx.rs`/`process_rx.rs`, applies cleanly to a1d8616, and builds on macOS.
  - **01:** please swap it into `vmm/patches/` (07 does not write there). Until then, this case is contained only by the external watchdog and Linux `cpu.max`.
- **Update (07 now maintains `vmm/`):** v2 is in `vmm/patches/series` as `libkrun-robustness.diff`, and `vmm/.READY` has been restored.
  - **macOS, `/tmp/jitk-01/r3/darwin/jitk-vmm`, sha256 2764…a20e:**
    - CLI checks: 12/12.
    - Fault runs: 180/180.
    - Console-abuse runs: 270/270.
  - **Nested KVM:** CHECKS-PASS (210 fault runs), CONSOLE-PASS (270 runs), SECCOMP-PASS and INIT-DONE all pass.
  - **No CLI or contract change.**

## sandbox ↔ HVF engine (07 → shard), 2026-10-28
- The shard's HVF engine (`shard/src/hvf.rs`) compiles `vmm/sandbox/mod.rs` in unchanged, through `#[path]`, as `vmm/` does, and uses the confirmed API only: the zygote calls `compile_profile(snapshot dir, tmp)` and `Sandbox::prepare(canonical .mem path, Some(profile), None)` once; every forked engine process calls `before_build()` before it creates its VM and `after_build()` after. The profile is `jitk.sb` with `IMAGES` = the prepared snapshot's directory.
- What the engine relies on (checked by `hvf confine`, run by `make -C shard test-hvf`): under the profile, hv_vm_create/hv_vcpu_run, mmap of the inherited snapshot descriptor and reads in `IMAGES` work; file reads elsewhere, writes, TCP/UDP and exec fail with EPERM. The engine reads `hw.cachelinesize` before confinement (the profile allows only `hw.pagesize_compat`).
- A change to `mod.rs` or `jitk.sb` rebuilds the engine (`tslib/deps.ts` shardInputs).

## executor ↔ shard IPC on macOS (04 ↔ shard), 2026-10-28
- `ShardBackend` spawns `hvf ipc SNAPSHOT SLOTS` with fd 3 a stream socket (spawn's `pipe` stdio entry). Records are `executor/ipc/ABI.md`'s (32-byte header, ≤16,384 payload bytes) back to back; kinds, generations, ordering, bounds and READY's ABI version are unchanged. No memfd/eventfd, no addon.
- Deadlines and STATS times: Node `process.hrtime` = the engine's `CLOCK_MONOTONIC_RAW` (mach_continuous_time). Not macOS `CLOCK_MONOTONIC`, which has another base.
- Closing the socket ends the engine; the zygote reaps its engine processes. Node SIGKILLs it after 1 s otherwise.
- Capacity (ABI 10): a QUARANTINED slot is re-forked by the zygote and reported RESTORED (same generation) once its new engine process is READY; an engine process that dies while its slot is idle is replaced without a message. More than `restore_budget(slots)` = max(4, 2 × slots) re-forks within 60 s fails the engine closed (Node sees the socket close). `ShardBackend.capacity` is `{slots, lost}` with `lost` = quarantined and not yet restored; on HVF Node never fails the engine for having every slot lost, waiters wait for RESTORED or the engine's exit.
