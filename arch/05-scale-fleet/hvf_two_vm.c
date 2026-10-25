#include <Hypervisor/Hypervisor.h>
#include <stdio.h>
int main(void) {
    hv_return_t a=hv_vm_create(NULL), b=hv_vm_create(NULL);
    printf("first=0x%x second=0x%x success=0x%x busy=0x%x\n",a,b,HV_SUCCESS,HV_BUSY);
    if (a==HV_SUCCESS) hv_vm_destroy();
    return a==HV_SUCCESS && b!=HV_SUCCESS ? 0 : 1;
}
