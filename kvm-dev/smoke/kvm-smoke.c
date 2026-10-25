// Minimal KVM arm64 smoke test: create VM, map 64 KiB, run guest that stores to MMIO and hvcs.
#include <fcntl.h>
#include <stddef.h>
#include <linux/kvm.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/mman.h>
#include <time.h>
#include <unistd.h>
static double now(void){struct timespec t;clock_gettime(CLOCK_MONOTONIC,&t);return t.tv_sec*1e3+t.tv_nsec/1e6;}
#define CHK(x) do{if((x)<0){perror(#x);exit(1);}}while(0)
int main(int argc,char**argv){
 int n=argc>1?atoi(argv[1]):1; int kvm=open("/dev/kvm",O_RDWR); CHK(kvm);
 // guest: movz x0,#42; movz x1,#0x1000,lsl #16; str x0,[x1] (MMIO exit); x0=PSCI SYSTEM_OFF; hvc #0; b .
 uint32_t code[]={0xd2800540,0xd2a20001,0xf9000020,0xd2800100,0xf2b08000,0xd4000002,0x14000000};
 double t0=now(),create=0,first=0;
 for(int i=0;i<n;i++){
  double a=now(); int vm=ioctl(kvm,KVM_CREATE_VM,0); CHK(vm);
  void*mem=mmap(0,1<<16,PROT_READ|PROT_WRITE,MAP_SHARED|MAP_ANONYMOUS,-1,0); memcpy(mem,code,sizeof code);
  struct kvm_userspace_memory_region r={.slot=0,.guest_phys_addr=0x80000000,.memory_size=1<<16,.userspace_addr=(uint64_t)mem}; CHK(ioctl(vm,KVM_SET_USER_MEMORY_REGION,&r));
  int cpu=ioctl(vm,KVM_CREATE_VCPU,0); CHK(cpu); struct kvm_vcpu_init init; CHK(ioctl(vm,KVM_ARM_PREFERRED_TARGET,&init)); init.features[0]|=1u<<KVM_ARM_VCPU_PSCI_0_2; CHK(ioctl(cpu,KVM_ARM_VCPU_INIT,&init));
  struct kvm_run*run=mmap(0,ioctl(kvm,KVM_GET_VCPU_MMAP_SIZE,0),PROT_READ|PROT_WRITE,MAP_SHARED,cpu,0);
  uint64_t pc=0x80000000; struct kvm_one_reg reg={.id=KVM_REG_ARM64|KVM_REG_SIZE_U64|KVM_REG_ARM_CORE|(offsetof(struct kvm_regs,regs.pc)/4),.addr=(uint64_t)&pc}; CHK(ioctl(cpu,KVM_SET_ONE_REG,&reg));
  double b=now(); int mmio=0,hvc=0;
  for(;;){ CHK(ioctl(cpu,KVM_RUN,0));
   if(run->exit_reason==KVM_EXIT_MMIO){ if(run->mmio.is_write&&run->mmio.phys_addr==0x10000000&&*(uint64_t*)run->mmio.data==42) mmio=1; continue; }
   if(run->exit_reason==KVM_EXIT_HYPERCALL||run->exit_reason==KVM_EXIT_SYSTEM_EVENT){hvc=1;break;}
   fprintf(stderr,"unexpected exit %d\n",run->exit_reason); return 1; }
  double c=now(); create+=b-a; first+=c-b;
  if(!mmio||!hvc){fprintf(stderr,"guest failed mmio=%d hvc=%d\n",mmio,hvc);return 1;}
  close(cpu); close(vm); munmap(mem,1<<16);
 }
 printf("ok n=%d  vm+vcpu setup avg %.3f ms  run-to-hvc avg %.3f ms  total %.1f ms\n",n,create/n,first/n,now()-t0);
}
