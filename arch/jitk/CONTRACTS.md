# Cross-subtree contracts

Agreements between subtrees that no single README owns. Read the one you
touch before changing either side.

## Console runner (`hvf console`) ↔ GrowOS, kernel and protocol tests

`hvf console --image KERNEL [--seed HEX] [--epoch-ns NS]`
([`shard/src/hvf/console.rs`](shard/src/hvf/console.rs)) boots the console
kernel profile for GrowOS, `scriptc-corpus`, the kernel suite and the
protocol VM tests:

- stdin/stdout are the guest's virtio console;
- exactly `{"sandbox":"ok"}\n` on stderr after `jitk.sb` is applied and
  before the VM exists;
- exit 0 at PSCI SYSTEM_OFF, 70 with a message on an error.

The kernel side of the launcher contract (RAM, FDT, bootargs, framing) is in
[`kernel/README.md`](kernel/README.md) "Console launcher contract".

## Seatbelt confinement ↔ the HVF engine

- The HVF engine owns the Seatbelt profile
  [`shard/src/hvf/jitk.sb`](shard/src/hvf/jitk.sb) (`seatbelt::PROFILE`).
  The zygote compiles `jitk.sb` + `shard/src/hvf/zygote.sb`
  (`(allow process-fork)`, `(allow signal (target children))`) with
  `IMAGES` = the prepared snapshot's directory, through libsandbox's
  compile/apply entry points (`shard/src/hvf/seatbelt.rs`), and applies it to
  itself before its first fork. It then forks the engine template
  (`shard/src/hvf/template.rs`), which keeps the profile and forks every
  engine process, so none inherits tenant bytes from the zygote.
- macOS refuses a second `sandbox_apply` in a sandboxed process (EPERM, also
  with `system-mac-syscall` allowed), so engine processes cannot enter
  `jitk.sb` on top. They inherit the zygote's profile and, before creating a
  VM, take the fork grant away with RLIMIT_NPROC 0/0 (`child::confine`). An
  unprivileged process cannot raise it again; root is not bound by it, so the
  engine refuses to run as root.
- What the engine relies on, checked by `hvf confine` (run by
  `make -C shard test-hvf`): under the zygote's profile, fork, SIGKILL and
  reap of a child, its own task info, socketpair, passing a descriptor over
  it (SCM_RIGHTS, zygote to template) and reads in `IMAGES` work.
  In an engine process additionally `hv_vm_create`/`hv_vcpu_run` and mmap of
  the inherited snapshot descriptor work, and fork fails (EAGAIN). In both,
  file reads elsewhere, writes, TCP/UDP and exec fail with EPERM. The engine
  reads `hw.cachelinesize` before confinement (the profile allows only
  `hw.pagesize_compat`).
- The native worker and `hvf console` enter `jitk.sb` alone (no zygote) and
  drop fork the same way.
- A change to `jitk.sb` (any file under `shard/src`) rebuilds the engine
  (`tslib/deps.ts` `shardInputs`).

On Linux, `real ipc` and `real native-worker` confine themselves before
any guest runs: user, network and IPC namespaces, Landlock, `no_new_privs`
and a per-process seccomp allowlist (`shard/src/confine/policy.rs`: `shard`,
`native_worker`, `watchdog`); `real confine [--native]` probes each layer.
A kernel without a layer is reported on stderr and the engine refuses to
serve (exits before READY) unless `JITK_ALLOW_DEGRADED_CONFINEMENT=1`, which
Node passes only with `allowDegradedConfinement`
(`arch/review/2026-10-29-SECURITY-CORRECTNESS-REVIEW.md`, F1).

## Executor ↔ shard IPC on macOS

- `ShardBackend` spawns `hvf ipc SNAPSHOT SLOTS` with fd 3 a stream socket
  (spawn's `pipe` stdio entry). Records are
  [`executor/ipc/ABI.md`](executor/ipc/ABI.md)'s (32-byte header, ≤16,384
  payload bytes) back to back; kinds, generations, ordering, bounds and
  READY's ABI version are the same as on Linux. No memfd/eventfd, no addon.
- Deadlines and STATS times: Node `process.hrtime` = the engine's
  `CLOCK_MONOTONIC_RAW` (mach_continuous_time), not macOS `CLOCK_MONOTONIC`,
  which has another base.
- Closing the socket ends the engine; the zygote's template reaps its engine
  processes. Node SIGKILLs it after 1 s otherwise.
- Process tree: the zygote (the spawned `hvf ipc`) has one child, the
  template; the engine processes, one per slot, are the template's children
  (`pgrep -P` of the template).
- Capacity: a QUARANTINED slot is re-forked (by the template) and reported
  RESTORED (same generation) once its new engine process is READY; an engine
  process that dies while its slot is idle is replaced without a message.
  More than `restore_budget(slots)` = max(4, 2 × slots) re-forks within 60 s
  fails the engine closed (Node sees the socket close).
  `ShardBackend.capacity` is `{slots, lost}` with `lost` = quarantined and not
  yet restored; on HVF Node never fails the engine for having every slot
  lost, waiters wait for RESTORED or the engine's exit.

The libkrun-era contracts (`vmm` ↔ `vmm/sandbox`, the `jitk-vmm` CLI ↔
executor) went with libkrun: `git show 61bfba5e^:arch/jitk/CONTRACTS.md`.
