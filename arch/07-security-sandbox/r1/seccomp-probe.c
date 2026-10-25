#define _GNU_SOURCE
#include <linux/filter.h>
#include <linux/seccomp.h>
#include <linux/kvm.h>
#include <sys/prctl.h>
#include <sys/syscall.h>
#include <unistd.h>
#include <fcntl.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
int main(int argc,char **argv) {
  if(argc!=3) return 2;
  int f=open(argv[1],O_RDONLY); if(f<0) return 3;
  struct sock_filter insns[4096]; ssize_t n=read(f,insns,sizeof insns); close(f);
  if(n<=0 || n%sizeof(*insns)) return 4;
  struct sock_fprog prog={.len=n/sizeof(*insns),.filter=insns};
  if(prctl(PR_SET_NO_NEW_PRIVS,1,0,0,0)) return 5;
  if(syscall(SYS_seccomp,SECCOMP_SET_MODE_FILTER,0,&prog)) return 6;
  if(!strcmp(argv[2],"exit")) syscall(SYS_gettid);
  else if(!strcmp(argv[2],"socket")) syscall(SYS_socket,2,1,0);
  else if(!strcmp(argv[2],"openat")) syscall(SYS_openat,AT_FDCWD,"/etc/passwd",O_RDONLY,0);
  else if(!strcmp(argv[2],"bad-ioctl")) syscall(SYS_ioctl,7,0xdead,0);
  else if(!strcmp(argv[2],"kvm-run")) syscall(SYS_ioctl,7,KVM_RUN,0);
  else return 7;
  syscall(SYS_exit_group,0); __builtin_unreachable();
}
