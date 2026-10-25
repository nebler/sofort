// Linux/aarch64 sketch. Fail closed; install after precreating ALL workers,
// allocating guest RAM/KVM state, and closing every ambient descriptor.
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <linux/audit.h>
#include <linux/filter.h>
#include <linux/kvm.h>
#include <linux/landlock.h>
#include <linux/seccomp.h>
#include <sched.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/mman.h>
#include <sys/prctl.h>
#include <sys/resource.h>
#include <sys/socket.h>
#include <sys/syscall.h>
#include <unistd.h>

static void must(int ok, const char *what) { if (!ok) { perror(what); _exit(111); } }
static void limit(int resource, rlim_t value) {
    struct rlimit r={value,value}; must(setrlimit(resource,&r)==0,"setrlimit");
}
// Privileged launcher only: use a precreated, shared EMPTY netns per worker
// shard, mount no host files, then setgroups(0,NULL), setresgid/setresuid,
// capset(empty), clear env, and close all FDs except pipes + KVM/event FDs.
void enter_empty_netns(int nsfd) { must(setns(nsfd,CLONE_NEWNET)==0,"setns"); }
void resource_caps(void) {
    limit(RLIMIT_CORE,0); limit(RLIMIT_NOFILE,64); limit(RLIMIT_CPU,2);
    // Linux: also cgroup v2 memory.max, memory.swap.max=0, pids.max, cpu.max.
    // Do not use RLIMIT_NPROC with a shared UID as a per-VM thread limit.
}
int landlock_abi(void) {
    return syscall(SYS_landlock_create_ruleset,NULL,0,LANDLOCK_CREATE_RULESET_VERSION);
}
void lock_filesystem(void) {
    int abi=landlock_abi(); must(abi>=4,"Landlock ABI >=4 required");
    // Handle every filesystem right through ABI 3; ABI 5 IOCTL_DEV is omitted
    // because live KVM descriptors must remain usable. Seccomp limits ioctls.
    struct landlock_ruleset_attr a={
        .handled_access_fs=(1ULL<<15)-1,
        .handled_access_net=LANDLOCK_ACCESS_NET_BIND_TCP|LANDLOCK_ACCESS_NET_CONNECT_TCP,
    };
    int fd=syscall(SYS_landlock_create_ruleset,&a,sizeof(a),0);
    must(fd>=0,"Landlock create");
    must(prctl(PR_SET_NO_NEW_PRIVS,1,0,0,0)==0,"no_new_privs");
    // No allow rules: deny new filesystem opens and TCP operations.
    // Existing FDs are NOT revoked; close ambient FDs before this call.
    must(syscall(SYS_landlock_restrict_self,fd,0)==0,"Landlock restrict");
    close(fd);
}

#define ST(code,k) ((struct sock_filter)BPF_STMT(code,k))
#define JP(code,k,t,f) ((struct sock_filter)BPF_JUMP(code,k,t,f))
static struct sock_filter filter[256]; static size_t n;
static void put(struct sock_filter i) { must(n<256,"BPF capacity"); filter[n++]=i; }
static void allow_nr(int nr) {
    put(JP(BPF_JMP|BPF_JEQ|BPF_K,nr,0,1));
    put(ST(BPF_RET|BPF_K,SECCOMP_RET_ALLOW));
}
// Exact (fd, ioctl request) match; rejects upper halves on the 64-bit ABI.
static void allow_ioctl(int fd, unsigned request) {
    put(JP(BPF_JMP|BPF_JEQ|BPF_K,SYS_ioctl,0,10));
    put(ST(BPF_LD|BPF_W|BPF_ABS,offsetof(struct seccomp_data,args[0])+4));
    put(JP(BPF_JMP|BPF_JEQ|BPF_K,0,0,7));
    put(ST(BPF_LD|BPF_W|BPF_ABS,offsetof(struct seccomp_data,args[0])));
    put(JP(BPF_JMP|BPF_JEQ|BPF_K,fd,0,5));
    put(ST(BPF_LD|BPF_W|BPF_ABS,offsetof(struct seccomp_data,args[1])+4));
    put(JP(BPF_JMP|BPF_JEQ|BPF_K,0,0,3));
    put(ST(BPF_LD|BPF_W|BPF_ABS,offsetof(struct seccomp_data,args[1])));
    put(JP(BPF_JMP|BPF_JEQ|BPF_K,request,0,1));
    put(ST(BPF_RET|BPF_K,SECCOMP_RET_ALLOW));
    // Every failed branch reloads nr before testing subsequent rules.
    put(ST(BPF_LD|BPF_W|BPF_ABS,offsetof(struct seccomp_data,nr)));
}
void install_filter(int vcpu_fd, int vm_fd) {
    n=0;
    put(ST(BPF_LD|BPF_W|BPF_ABS,offsetof(struct seccomp_data,arch)));
    put(JP(BPF_JMP|BPF_JEQ|BPF_K,AUDIT_ARCH_AARCH64,1,0));
    put(ST(BPF_RET|BPF_K,SECCOMP_RET_KILL_PROCESS));
    put(ST(BPF_LD|BPF_W|BPF_ABS,offsetof(struct seccomp_data,nr)));
    // Source-derived CANDIDATE: actual libkrun KVM runtime UNVERIFIED.
    int calls[]={SYS_read,SYS_readv,SYS_write,SYS_writev,SYS_close,
        SYS_futex,SYS_clock_gettime,SYS_rt_sigreturn,SYS_rt_sigprocmask,
        SYS_sigaltstack,SYS_ppoll,SYS_epoll_pwait,SYS_sched_yield,
        SYS_munmap,SYS_madvise,SYS_exit,SYS_exit_group};
    for (size_t i=0;i<sizeof(calls)/sizeof(calls[0]);i++) allow_nr(calls[i]);
    // No mappings backed by new files, executable pages, or MAP_FIXED.
    put(JP(BPF_JMP|BPF_JEQ|BPF_K,SYS_mmap,0,9));
    put(ST(BPF_LD|BPF_W|BPF_ABS,offsetof(struct seccomp_data,args[2])));
    put(JP(BPF_JMP|BPF_JSET|BPF_K,~(PROT_READ|PROT_WRITE),6,0));
    put(ST(BPF_LD|BPF_W|BPF_ABS,offsetof(struct seccomp_data,args[3])));
    put(JP(BPF_JMP|BPF_JEQ|BPF_K,MAP_PRIVATE|MAP_ANONYMOUS,0,4));
    put(ST(BPF_LD|BPF_W|BPF_ABS,offsetof(struct seccomp_data,args[4])));
    put(JP(BPF_JMP|BPF_JEQ|BPF_K,(uint32_t)-1,0,2));
    put(ST(BPF_RET|BPF_K,SECCOMP_RET_ALLOW));
    put(ST(BPF_RET|BPF_K,SECCOMP_RET_KILL_PROCESS));
    put(ST(BPF_LD|BPF_W|BPF_ABS,offsetof(struct seccomp_data,nr)));
    allow_ioctl(vcpu_fd,KVM_RUN);
    allow_ioctl(vm_fd,KVM_IRQ_LINE);
    // No openat/socket/connect/execve/clone/ptrace/bpf/io_uring or fd creation.
    put(ST(BPF_RET|BPF_K,SECCOMP_RET_KILL_PROCESS));
    struct sock_fprog p={.len=n,.filter=filter};
    must(prctl(PR_SET_NO_NEW_PRIVS,1,0,0,0)==0,"no_new_privs");
    must(syscall(SYS_seccomp,SECCOMP_SET_MODE_FILTER,SECCOMP_FILTER_FLAG_TSYNC,&p)==0,"seccomp TSYNC");
}
#ifdef PROBE
#include <string.h>
int main(int argc,char **argv) {
    int abi=landlock_abi(); printf("Landlock ABI=%d errno=%d\n",abi,errno); fflush(stdout);
    if (argc>1 && !strcmp(argv[1],"landlock")) {
        lock_filesystem(); errno=0; int f=open("/etc/passwd",O_RDONLY);
        printf("post-Landlock open=%d errno=%d\n",f,errno); return f>=0;
    }
    if (argc>1 && !strcmp(argv[1],"netns")) {
        int r=unshare(CLONE_NEWNET); printf("unshare netns=%d errno=%d\n",r,errno); return r<0;
    }
    install_filter(40,41);
    if (argc>1 && !strcmp(argv[1],"open")) syscall(SYS_openat,AT_FDCWD,"/etc/passwd",O_RDONLY,0);
    if (argc>1 && !strcmp(argv[1],"socket")) syscall(SYS_socket,AF_INET,SOCK_STREAM,0);
    if (argc>1 && !strcmp(argv[1],"bad-ioctl")) syscall(SYS_ioctl,40,KVM_CREATE_VM,0);
    if (argc>1 && !strcmp(argv[1],"good-ioctl")) {
        errno=0; int r=syscall(SYS_ioctl,40,KVM_RUN,0);
        char b[80]; int len=snprintf(b,sizeof(b),"allowed KVM_RUN rc=%d errno=%d\n",r,errno); write(1,b,len);
    }
    if (argc>1 && !strcmp(argv[1],"mmap")) {
        void *p=mmap(NULL,16384,PROT_READ|PROT_WRITE,MAP_PRIVATE|MAP_ANONYMOUS,-1,0);
        if(p==MAP_FAILED) _exit(2); munmap(p,16384);
    }
    write(1,"filter allowed IO/exit\n",23); _exit(0);
}
#endif
