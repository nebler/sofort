/* UNVERIFIED on libkrun/KVM: proposed steady-state arm64 filter generator.
 * cc linux-seccomp.c -lseccomp -o filter-gen
 * Build/run --export in CI; embed raw BPF. Runtime loads with seccomp(2).
 * Requires PATCH: precreate console workers; freeze this FD layout; all threads
 * parked until each role installs its own filter; no guest instruction before it.
 * Numbers below are an explicit proposed ABI, NOT current libkrun FD numbers.
 */
#include <seccomp.h>
#include <linux/kvm.h>
#include <linux/futex.h>
#include <sys/mman.h>
#include <signal.h>
#include <time.h>
#include <unistd.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <errno.h>

enum { MAIN, VCPU, RX, TX };
enum { INPUT=3, OUTPUT=4, DIAG=5, EPOLL=6, VCPUFD=7,
       QUEUE=8, IRQ=9, STOP=10, EXIT_EVENT=11 };
static void require(int rc) { if (rc<0) { errno=-rc; perror("seccomp"); exit(1); } }
static void simple(scmp_filter_ctx c, const char *name) {
    int nr=seccomp_syscall_resolve_name(name);
    if(nr==__NR_SCMP_ERROR) { fprintf(stderr,"missing syscall %s\n",name); exit(1); }
    require(seccomp_rule_add(c,SCMP_ACT_ALLOW,nr,0));
}
static void fd(scmp_filter_ctx c, int nr, int n) {
    require(seccomp_rule_add(c,SCMP_ACT_ALLOW,nr,1,SCMP_A0(SCMP_CMP_EQ,n,0)));
}
scmp_filter_ctx filter(int role) {
    scmp_filter_ctx c=seccomp_init(SCMP_ACT_KILL_PROCESS);
    if (!c) exit(1);
    // Native arch only; libseccomp kills mismatched syscall architectures.
    const char *common[]={"exit","exit_group","rt_sigreturn","rt_sigprocmask",
      "sigaltstack","gettid","brk","munmap","sched_yield"};
    for(size_t i=0;i<sizeof(common)/sizeof(*common);i++) simple(c,common[i]);
    int futex_ops[]={FUTEX_WAIT_PRIVATE,FUTEX_WAKE_PRIVATE,
      FUTEX_WAIT_BITSET_PRIVATE,FUTEX_WAIT_BITSET_PRIVATE|FUTEX_CLOCK_REALTIME};
    for(size_t i=0;i<sizeof(futex_ops)/sizeof(*futex_ops);i++)
      require(seccomp_rule_add(c,SCMP_ACT_ALLOW,SCMP_SYS(futex),1,
        SCMP_A1(SCMP_CMP_EQ,futex_ops[i],0)));
    int clocks[]={CLOCK_MONOTONIC,CLOCK_REALTIME};
    for(size_t i=0;i<2;i++) require(seccomp_rule_add(c,SCMP_ACT_ALLOW,
      SCMP_SYS(clock_gettime),1,SCMP_A0(SCMP_CMP_EQ,clocks[i],0)));
    require(seccomp_rule_add(c,SCMP_ACT_ALLOW,SCMP_SYS(mmap),3,
      SCMP_A2(SCMP_CMP_MASKED_EQ,PROT_EXEC,0),
      SCMP_A3(SCMP_CMP_MASKED_EQ,MAP_ANONYMOUS,MAP_ANONYMOUS),
      SCMP_A4(SCMP_CMP_EQ,(scmp_datum_t)-1,0)));
    require(seccomp_rule_add(c,SCMP_ACT_ALLOW,SCMP_SYS(mprotect),1,
      SCMP_A2(SCMP_CMP_MASKED_EQ,PROT_EXEC,0)));
    int advice[]={MADV_DONTNEED,MADV_FREE};
    for(size_t i=0;i<2;i++) require(seccomp_rule_add(c,SCMP_ACT_ALLOW,
      SCMP_SYS(madvise),1,SCMP_A2(SCMP_CMP_EQ,advice[i],0)));
    fd(c,SCMP_SYS(write),DIAG); // rate-limited collector, never a terminal.
    if(role==MAIN) {
      fd(c,SCMP_SYS(epoll_pwait),EPOLL); // arm64 libc epoll_wait wrapper.
      fd(c,SCMP_SYS(read),QUEUE); fd(c,SCMP_SYS(read),EXIT_EVENT);
      fd(c,SCMP_SYS(write),STOP);
    } else if(role==VCPU) {
      require(seccomp_rule_add(c,SCMP_ACT_ALLOW,SCMP_SYS(ioctl),2,
        SCMP_A0(SCMP_CMP_EQ,VCPUFD,0),SCMP_A1(SCMP_CMP_EQ,KVM_RUN,0)));
      fd(c,SCMP_SYS(write),QUEUE); fd(c,SCMP_SYS(write),EXIT_EVENT);
    } else if(role==RX || role==TX) {
      simple(c,"ppoll"); // pointer args cannot be inspected; no network FDs exist.
      fd(c,SCMP_SYS(write),IRQ); fd(c,SCMP_SYS(read),STOP);
      if(role==RX) fd(c,SCMP_SYS(read),INPUT);
      else fd(c,SCMP_SYS(write),OUTPUT);
    } else { fprintf(stderr,"invalid role\n"); exit(1); }
    // No open/openat, execve, clone/clone3, socket/connect, ptrace, bpf,
    // io_uring, ioctl wildcard, dup, recvmsg/SCM_RIGHTS, namespace or credential APIs.
    // No teardown protocol: supervisor kills/reaps process on completion.
    // PATCH: shutdown uses supervisor pidfd kill; avoids unrestricted tgkill.
    return c;
}
int main(int argc,char **argv) {
    if(argc!=2) return 2;
    const char *names[]={"main","vcpu","rx","tx"};
    for(int i=0;i<4;i++) if(!strcmp(argv[1],names[i])) {
      scmp_filter_ctx c=filter(i);
      require(seccomp_export_bpf(c,STDOUT_FILENO)); seccomp_release(c); return 0;
    }
    return 2;
}
