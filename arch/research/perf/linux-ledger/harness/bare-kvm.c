// Derived from kvm-dev/smoke/kvm-smoke.c. Park at a verified MMIO exit.
#define _GNU_SOURCE
#include <fcntl.h>
#include <stddef.h>
#include <linux/kvm.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/mman.h>
#include <sys/prctl.h>
#include <signal.h>
#include <unistd.h>
#define CHK(x) do { if ((x)<0) { perror(#x); exit(1); } } while(0)
int main(int argc,char **argv) {
    prctl(PR_SET_PDEATHSIG,SIGKILL);
    int n=argc>1?atoi(argv[1]):1;
    int kvm=open("/dev/kvm",O_RDWR|O_CLOEXEC); CHK(kvm);
    uint32_t code[]={0xd2800540,0xd2a20001,0xf9000020,0x14000000};
    for(int i=0;i<n;i++) {
        int vm=ioctl(kvm,KVM_CREATE_VM,0); CHK(vm);
        void *mem=mmap(0,65536,PROT_READ|PROT_WRITE,MAP_PRIVATE|MAP_ANONYMOUS,-1,0);
        if(mem==MAP_FAILED) { perror("mmap"); return 1; }
        memcpy(mem,code,sizeof code);
        struct kvm_userspace_memory_region r={.slot=0,.guest_phys_addr=0x80000000,.memory_size=65536,.userspace_addr=(uint64_t)mem};
        CHK(ioctl(vm,KVM_SET_USER_MEMORY_REGION,&r));
        int cpu=ioctl(vm,KVM_CREATE_VCPU,0); CHK(cpu);
        struct kvm_vcpu_init init; CHK(ioctl(vm,KVM_ARM_PREFERRED_TARGET,&init));
        init.features[0]|=1u<<KVM_ARM_VCPU_PSCI_0_2;
        CHK(ioctl(cpu,KVM_ARM_VCPU_INIT,&init));
        struct kvm_run *run=mmap(0,ioctl(kvm,KVM_GET_VCPU_MMAP_SIZE,0),PROT_READ|PROT_WRITE,MAP_SHARED,cpu,0);
        if(run==MAP_FAILED) { perror("kvm_run mmap"); return 1; }
        uint64_t pc=0x80000000;
        struct kvm_one_reg reg={.id=KVM_REG_ARM64|KVM_REG_SIZE_U64|KVM_REG_ARM_CORE|(offsetof(struct kvm_regs,regs.pc)/4),.addr=(uint64_t)&pc};
        CHK(ioctl(cpu,KVM_SET_ONE_REG,&reg));
        CHK(ioctl(cpu,KVM_RUN,0));
        uint64_t value=0; memcpy(&value,run->mmio.data,8);
        if(run->exit_reason!=KVM_EXIT_MMIO || !run->mmio.is_write || run->mmio.phys_addr!=0x10000000 || value!=42) {
            fprintf(stderr,"bad guest exit %u value %lu\n",run->exit_reason,value); return 1;
        }
    }
    printf("{\"ready\":true,\"n\":%d}\n",n); fflush(stdout);
    char c;
    while(read(0,&c,1)>0) { if(c=='q') break; }
    return 0; // process teardown releases all fds/mappings
}
