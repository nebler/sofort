#include <Hypervisor/Hypervisor.h>
#include <stdio.h>
#include <unistd.h>
int main(void) {
  hv_return_t r=hv_vm_create(NULL);
  printf("0x%x\n",r); fflush(stdout);
  if(r!=HV_SUCCESS)return 2;
  // No RAM mapping, vCPU, libkrun, or guest. EOF releases this address space.
  char c; while(read(0,&c,1)>0){}
  hv_vm_destroy(); return 0;
}
