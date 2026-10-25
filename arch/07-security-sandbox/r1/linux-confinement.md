# Linux launcher sketch — UNVERIFIED on libkrun/KVM

Provision fixed slots once at daemon startup, not per VM. Root supervisor owns
immutable empty root + /kernel + VMM binaries/libraries, an empty network namespace
(no veth; loopback down), a read-only mount namespace with no /proc or host mounts,
a dedicated unprivileged UID/GID per simultaneously live slot, and cgroup-v2 leaf.
UID slot is not reusable until pidfd confirms exit and cgroup.events populated=0.
Do not use the Firecracker jailer binary for libkrun: its docs explicitly limit it
to matching Firecracker builds. Reproduce the relevant constraints in our launcher.

For each fresh process (one VM, never reuse process or fork an initialized KVM/HVF):
1. Join provisioned namespaces before dropping privileges; place child in cgroup
   before allocating guest memory. Configure memory.max=128MiB (measure headroom
   beyond 64MiB guest), memory.swap.max=0, memory.oom.group=1, pids.max=16,
   cpu.max="100000 100000"; include daemon/slot totals to prevent fleet oversubscription.
2. chroot immutable root, chdir("/"); open /dev/kvm before closing all unrelated FDs.
   Keep only explicitly inventoried KVM/VM/vCPU FDs, eventfds, console pipes; close
   namespace/directory/ruleset handles after use; no sockets capable of SCM_RIGHTS.
   Never leak host tokens, env, inherited log files, cwd or directory handles.
3. setgroups(0,NULL); setresgid(slot_gid,...); setresuid(slot_uid,...);
   capset(empty); verify effective/permitted/inheritable/ambient caps empty;
   prctl(PR_SET_DUMPABLE,0); prctl(PR_SET_NO_NEW_PRIVS,1).
   RLIMIT_CORE=0, RLIMIT_FSIZE=0, RLIMIT_NOFILE=64, RLIMIT_CPU=1s (coarse fallback).
   RLIMIT_AS is not a guest-RAM limit; use cgroup memory.max. Defaults are tuning
   examples, not verified density limits. Supervisor enforces monotonic wall deadline.
4. Landlock BEFORE creating libkrun threads. Query ABI with
   landlock_create_ruleset(NULL,0,LANDLOCK_CREATE_RULESET_VERSION); require >=3
   (TRUNCATE and REFER covered). Create a ruleset handling every filesystem right
   supported at that ABI, with zero allow rules after payloads are loaded; apply
   landlock_restrict_self(ruleset_fd,0); close it. If libkrun still needs kernel
   reads, instead grant read-only /kernel until a preload patch exists. Include
   ABI>=4 TCP bind/connect rights with zero allows, and ABI>=6 abstract UNIX-socket
   and signal scopes when supported. Landlock does not revoke pre-opened FDs.
   Fail closed if required ABI unavailable; do not silently run unrestricted.
5. PATCH libkrun to stop before first vCPU Resume, precreate fixed console RX/TX
   workers and event registrations. Each installs its own generated BPF using
   seccomp(SECCOMP_SET_MODE_FILTER,0,&prog); check return, acknowledge barrier.
   A shared deny-dangerous baseline with TSYNC may precede role filters, but
   TSYNC does not create role differences. Acknowledge ALL current threads.
6. Only now release vCPU barrier. Main loop/worker filters include no process
   creation, new FDs, filesystem, networking, arbitrary ioctls, new filters.
   Fixed FD ABI in linux-seccomp.c requires plumbing through libkrun; main/RX/TX
   roles may need extra eventfds found by tracing. Never widen ioctl wholesale.
7. Completion, hang, malformed protocol, lost worker: external supervisor uses
   pidfd_send_signal(SIGKILL), waitid(P_PIDFD), drains bounded logs, clears slot.
   Guest shutdown must notify host completion before kill; no VMM destructor path
   is assumed to work with the minimal steady-state filter.

Performance: reuse namespace FDs/mounts/cgroup leaves/UID slots and embed precompiled
BPF per role. Only syscalls to enter confinement remain per process. Landlock and
seccomp install latency, memory caps and pool refill throughput are UNVERIFIED;
a warm VM pool hides latency, but does not remove CPU cost. No per-VM shell/mount/
useradd/profile compilation. Slot provisioning is bounded and off request path.

Exact KVM test plan (native Linux arm64 with CONFIG_KVM, SECCOMP_FILTER, LANDLOCK):
- Build pinned libkrun and jitk-vmm in release; copy read-only artifacts into slot.
- Verify `test -c /dev/kvm` and VM boot under the intended unprivileged UID.
- `strace -ff -ttt -T -yy -o /tmp/jitk-07/trace -e trace=all ./jitk-vmm fixture.bin`
  (testing policy permits ptrace; production does not). Mark first Resume and
  each worker filter boundary with a dedicated preopened diagnostic pipe.
- Exercise boot, console activation, malformed/repeated control messages, actual
  JS/tools, timers, pipe EAGAIN/EPIPE, CPU spin, aborts and shutdown; partition
  traces by TID and setup/steady state. Enumerate concrete ioctl numbers and FDs.
- Feed each observed steady-state syscall into review of linux-seccomp.c, not an
  automatic union. Generate BPF per architecture/libc/build. Negative tests try
  openat("/etc/shadow"), socket/connect, execve, clone3, arbitrary ioctl; each must
  kill the entire process (SIGSYS), never only a worker. Confirm sibling VMs survive.
- Run same fixtures with enforcing filters + Landlock; test per-thread inherited
  restrictions and that no guest instruction precedes barrier acknowledgement.
- Alternate 30 launches with/without confinement; report median/p90 launch,
  sandbox installation CPU time and steady-state calls/s; include 100+ concurrency.
