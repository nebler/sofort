# vmm/sandbox — jitk-vmm confinement (owner: 07)

One file, `mod.rs`, is included by `vmm/src/confinement.rs` through `#[path = "../sandbox/mod.rs"]`.
Its dependencies are `libc` and `utils`, the latter coming from libkrun with `patches/thread-hook.diff`. On macOS it also links `-l sandbox`.

## API (confirmed by 07; see CONTRACTS.md "07 response")
```rust
Sandbox::prepare(image: &Path /*canonical*/, profile: Option<&Path>, netns_fd: Option<i32>) -> Result<Sandbox>
sandbox.before_build()?;   // macOS: Seatbelt.  Linux: rlimits+prctl, setns, Landlock, register thread hook
let vm = builder.build()?; // vCPU starts here (runs only the trusted image)
sandbox.after_build()?;    // Linux: seccomp (per-role if the vCPU hook ran, else union+TSYNC). macOS: no-op
// caller writes exactly {"sandbox":"ok"}\n to stderr (01's main.rs does)
compile_profile(images_dir: &Path, out: &Path) -> Result<()>   // macOS, once per supervisor start
```

## Policy
- **macOS** (`jitk.sb`): `(deny default)`, `file-read-data` limited to the image directory, and `sysctl-read hw.pagesize_compat`.
  - Applying the precompiled blob costs 0.063 ms.
  - When `profile` is `None`, the profile is compiled in-process (about 5 ms) with the same policy.
- **Linux**:
  - rlimits: `RLIMIT_CORE=0`, `RLIMIT_FSIZE=0`, `RLIMIT_NOFILE=64`.
  - prctl: `NO_NEW_PRIVS`, `DUMPABLE=0`, `PDEATHSIG=SIGKILL`.
  - An optional `setns` into a pre-created empty netns; the fd is closed afterwards.
  - Landlock ABI ≥4, required:
    - all filesystem rights are handled; the image gets `READ_FILE` and `/dev/kvm` gets `READ|WRITE|IOCTL_DEV`;
    - TCP bind/connect is handled with no allows;
    - on ABI ≥6, abstract-unix sockets and signals are scoped.
  - seccomp roles (aarch64), applied as `KILL_PROCESS`:

    | Role | Allowed syscalls |
    |---|---|
    | vCPU | `KVM_RUN` and 8-byte eventfd writes |
    | console | read, write, ppoll, close |
    | main | epoll, eventfd, `clone` with exactly the pthread flags (`clone3` returns ENOSYS), `seccomp` that can only narrow |

    Never allowed: open*, socket*, exec*, fork, kill/tgkill, ptrace, bpf, io_uring, other ioctls, and `PROT_EXEC`.
- **Linux stderr must be a pipe.** With `RLIMIT_FSIZE=0`, writing to a regular file raises SIGXFSZ.
- **cgroups (supervisor side).** Use `clone3(CLONE_INTO_CGROUP)` (see `07-security-sandbox/linux/spawn-cg.c`) or mount cgroup2 with `favordynmods`.
  - Never place the VMM by writing `cgroup.procs`: that costs 36–50 ms per VM.
  - Leaf limits: `memory.max=128M`, `memory.swap.max=0`, `pids.max=16`, `cpu.max="100000 100000"`.

## Tests
```sh
tests/run-unit.sh            # 9 BPF/profile decision tests (any OS)
# escape suite: attacker with code exec inside the confined VMM, plus unconfined controls
rustc --edition=2024 -O -C panic=abort tests/escape.rs --extern krun=… --extern libc=… --extern utils=… -o escape
tests/run-escape.sh ./escape /canonical/images/kernel.bin [compiled-profile]   # PASS = BLOCKED or SIGSYS
```
Results are in `arch/07-security-sandbox/R3.md`: macOS 12/12, Linux (nested KVM) per R3.md.
