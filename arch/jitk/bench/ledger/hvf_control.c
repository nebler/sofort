/* Offline HVF allocation control; does not run a guest or replace the measured VMM. */
#include <Hypervisor/Hypervisor.h>
#include <sys/mman.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <fcntl.h>
#include <string.h>
#include <libkern/OSCacheControl.h>
__attribute__((naked)) static void guest_zero(void) {
  __asm__("movz x0,#0x8100,lsl #16\n"
          "movz x1,#0x8130,lsl #16\n"
          "1: str xzr,[x0],#8\n"
          "cmp x0,x1\n"
          "b.lo 1b\n"
          "hvc #0\n");
}
static void stage(const char *s,unsigned r) {
  printf("{\"stage\":\"%s\",\"hv_result\":%u}\n",s,r);fflush(stdout);
  if(r)exit(1);char c;if(read(0,&c,1)!=1)exit(2);
}
int main(int argc,char **argv) {
  stage("process",0);
  stage("vm_create",hv_vm_create(NULL));
  size_t n=32*1024*1024;
  void *p=mmap(NULL,n,PROT_READ|PROT_WRITE,MAP_PRIVATE|MAP_ANON,-1,0);
  if(p==MAP_FAILED)return 3;
  stage("ram_reserved",0);
  int fd=open(argv[1],O_RDONLY);if(fd<0)return 4;ssize_t off=0,k;
  while((k=read(fd,(char *)p+off,n-off))>0)off+=k;
  close(fd);stage("image_loaded",0);
  stage("vm_map",hv_vm_map(p,0x80000000,n,HV_MEMORY_READ|HV_MEMORY_WRITE|HV_MEMORY_EXEC));
  hv_vcpu_t cpu;hv_vcpu_exit_t *exit;
  stage("vcpu_create",hv_vcpu_create(&cpu,&exit,NULL));
  memcpy(p,(void *)guest_zero,24);sys_icache_invalidate(p,24);
  if(hv_vcpu_set_reg(cpu,HV_REG_PC,0x80000000))return 5;
  if(hv_vcpu_set_reg(cpu,HV_REG_CPSR,0x3c5))return 6;
  hv_return_t run_result=hv_vcpu_run(cpu);uint64_t end=0;
  if(hv_vcpu_get_reg(cpu,HV_REG_X0,&end)||end!=0x81300000)return 7;
  stage("guest_zero_3mib",run_result);
  hv_vcpu_destroy(cpu);hv_vm_unmap(0x80000000,n);hv_vm_destroy();munmap(p,n);
  return 0;
}
