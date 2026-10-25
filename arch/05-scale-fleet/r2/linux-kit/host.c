// Benchmark-only Linux variant of 02 host.c: one process, vCPU, inout port.
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <unistd.h>
#include <time.h>
#include <libkrun.h>
static void check(KrunError e,const char *phase){if(e){fprintf(stderr,"libkrun error: %s\n",phase);exit(3);}}
int main(int argc,char **argv){
 if(argc!=2){fprintf(stderr,"usage: jitk-launch KERNEL\n");return 2;}
 const char *cg=getenv("JITK_CGROUP");
 if(cg){char path[4096];snprintf(path,sizeof(path),"%s/cgroup.procs",cg);FILE *f=fopen(path,"w");if(!f){perror(path);return 4;}fprintf(f,"%d\n",getpid());if(fclose(f)){perror("cgroup.procs");return 4;}}
 KrunError err=NULL;krun_init_log(-1,KRUN_LOG_LEVEL_OFF,KRUN_LOG_STYLE_AUTO,0,&err);check(err,"log");
 KrunMmioDeviceManager devices=krun_mmio_device_manager_new();KrunConsoleBuilder cb=krun_console_device_builder();uint32_t port;
 krun_console_builder_add_inout_port(cb,KRUN_STR("jitk"),0,1,&port,&err);check(err,"port");
 KrunConsoleDevice dev=krun_console_builder_build(cb,&err);check(err,"console");krun_mmio_device_manager_add(devices,dev);
 unsigned char entropy[16];arc4random_buf(entropy,sizeof(entropy));char cmdline[256]="jitk.seed=";
 for(int i=0;i<16;i++)snprintf(cmdline+10+2*i,3,"%02x",entropy[i]);
 struct timespec ts;clock_gettime(CLOCK_REALTIME,&ts);uint64_t counter;asm volatile("mrs %0,cntvct_el0":"=r"(counter));
 snprintf(cmdline+42,sizeof(cmdline)-42," jitk.epoch_ns=%llu jitk.counter=%llu jitk.tick_us=%s",(unsigned long long)ts.tv_sec*1000000000ULL+ts.tv_nsec,(unsigned long long)counter,getenv("JITK_TICK_US")?getenv("JITK_TICK_US"):"0");
 KrunPayload payload=krun_payload_load_external(KRUN_STR(argv[1]),KRUN_KERNEL_FORMAT_RAW,KRUN_STR(NULL),KRUN_STR(cmdline),&err);check(err,"payload");
 KrunVmmBuilder b=krun_vmm_builder_new();krun_vmm_builder_vcpus(&b,1,&err);check(err,"vcpus");krun_vmm_builder_ram_mib(&b,32,&err);check(err,"ram");
 krun_vmm_builder_nested_virt(&b,false);krun_vmm_builder_shutdown_support(&b,false);krun_vmm_builder_payload(&b,payload);krun_vmm_builder_devices(&b,devices);KrunVmm v=krun_vmm_builder_build(&b,&err);check(err,"build");krun_vmm_run(v);return 0;
}
