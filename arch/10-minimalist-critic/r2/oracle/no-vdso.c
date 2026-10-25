// Dev probe: disable AT_SYSINFO_EHDR after exec, count native aarch64 syscalls.
#include <sys/ptrace.h>
#include <sys/wait.h>
#include <sys/uio.h>
#include <unistd.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <errno.h>
static uint64_t peek(pid_t p, uint64_t a) {
  errno=0; long v=ptrace(PTRACE_PEEKDATA,p,(void*)a,0);
  if(errno){perror("peek");exit(1);}return (uint64_t)v;
}
static void regs(pid_t p,uint64_t r[34]) {
  struct iovec v={r,34*8};
  if(ptrace(PTRACE_GETREGSET,p,(void*)1,&v)){perror("regs");exit(1);}
}
int main(int argc,char **argv) {
  if(argc<2)return 2;
  pid_t p=fork();
  if(p==0){ptrace(PTRACE_TRACEME,0,0,0);execv(argv[1],argv+1);_exit(127);}
  int s;waitpid(p,&s,0);if(!WIFSTOPPED(s))return 3;
  uint64_t r[34];regs(p,r);uint64_t a=r[31];
  uint64_t n=peek(p,a);a+=8*(n+2); // skip argc, argv[], NULL
  while(peek(p,a))a+=8;a+=8; // env[], NULL
  int cleared=0;
  for(;peek(p,a);a+=16)if(peek(p,a)==33){
    if(ptrace(PTRACE_POKEDATA,p,(void*)(a+8),0)){perror("poke");return 4;}cleared++;
  }
  ptrace(PTRACE_SETOPTIONS,p,0,(void*)PTRACE_O_TRACESYSGOOD);
  unsigned long count[512]={0};int entering=1;
  for(;;){
    if(ptrace(PTRACE_SYSCALL,p,0,0)){perror("resume");return 5;}
    if(waitpid(p,&s,0)<0)return 6;
    if(WIFEXITED(s)||WIFSIGNALED(s))break;
    if(WSTOPSIG(s)!=(SIGTRAP|0x80)){fprintf(stderr,"unexpected stop %d\n",WSTOPSIG(s));kill(p,SIGKILL);return 7;}
    regs(p,r);if(entering&&r[8]<512)count[r[8]]++;entering=!entering;
  }
  fprintf(stderr,"AT_SYSINFO_EHDR cleared=%d exit=%d\n",cleared,WIFEXITED(s)?WEXITSTATUS(s):-1);
  for(int i=0;i<512;i++)if(count[i])fprintf(stderr,"nr=%d count=%lu\n",i,count[i]);
  return !WIFEXITED(s)||WEXITSTATUS(s);
}
