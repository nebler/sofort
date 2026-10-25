// Build-time constants from installed Linux UAPI headers, not a runtime shim.
#include <linux/kvm.h>
#include <stddef.h>
#include <stdio.h>
#define C(x) printf("pub const " #x ": u64 = %llu;\n", (unsigned long long)(x))
#define O(name, field) printf("pub const " #name ": usize = %zu;\n", offsetof(struct kvm_run, field))
int main(void) {
 C(KVM_GET_API_VERSION); C(KVM_CREATE_VM); C(KVM_CREATE_VCPU);
 C(KVM_GET_VCPU_MMAP_SIZE); C(KVM_SET_USER_MEMORY_REGION); C(KVM_RUN);
 C(KVM_ARM_PREFERRED_TARGET); C(KVM_ARM_VCPU_INIT); C(KVM_GET_ONE_REG); C(KVM_SET_ONE_REG);
 C(KVM_MEM_READONLY); C(KVM_GET_REG_LIST); C(KVM_EXIT_MMIO); C(KVM_ARM_VCPU_PSCI_0_2);
 O(EXIT_REASON, exit_reason); O(IMMEDIATE_EXIT, immediate_exit);
 O(MMIO_ADDR, mmio.phys_addr); O(MMIO_DATA, mmio.data); O(MMIO_LEN, mmio.len); O(MMIO_WRITE, mmio.is_write);
 printf("pub const REG_X0: u64 = %llu;\n", (unsigned long long)(KVM_REG_ARM64 | KVM_REG_SIZE_U64 | KVM_REG_ARM_CORE));
 printf("pub const REG_PC: u64 = %llu;\n", (unsigned long long)(KVM_REG_ARM64 | KVM_REG_SIZE_U64 | KVM_REG_ARM_CORE | (offsetof(struct kvm_regs, regs.pc)/4)));
 printf("pub const REG_PSTATE: u64 = %llu;\n", (unsigned long long)(KVM_REG_ARM64 | KVM_REG_SIZE_U64 | KVM_REG_ARM_CORE | (offsetof(struct kvm_regs, regs.pstate)/4)));
 printf("pub const REG_SCTLR: u64 = %llu;\n", (unsigned long long)ARM64_SYS_REG(3,0,1,0,0));
 return 0;
}
