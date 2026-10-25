// Separate the framework's process-global VM contract from libkrun's lifecycle.
#include <Hypervisor/Hypervisor.h>
#include <stdio.h>
int main(void) {
    hv_vm_config_t config = hv_vm_config_create();
    printf("create1=0x%x\n", hv_vm_create(config));
    printf("create2_without_destroy=0x%x\n", hv_vm_create(config));
    printf("destroy1=0x%x\n", hv_vm_destroy());
    printf("create3_after_destroy=0x%x\n", hv_vm_create(config));
    printf("destroy3=0x%x\n", hv_vm_destroy());
}
