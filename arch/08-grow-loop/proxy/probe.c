#include <sys/syscall.h>
#include <unistd.h>
#include <errno.h>
#include <stdio.h>
int main(void) {
  int fds[]={-1,0,1,2,3};
  for(int i=0;i<5;i++) {
    errno=0;long r=syscall(SYS_ioctl,fds[i],0x5413,0);
    printf("fd=%d ret=%ld errno=%d\n",fds[i],r,errno);
  }
}
