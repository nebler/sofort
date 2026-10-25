#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>
#include <poll.h>
#include <libkrun.h>
extern void jitk_trace_mark(const char*);
extern int sandbox_init(const char*, unsigned long, char**);
int main(int argc,char**argv){
 jitk_trace_mark("main");
 char image[4096];realpath(argv[1],image);
 KrunError err=NULL;
 krun_init_log(-1,KRUN_LOG_LEVEL_OFF,KRUN_LOG_STYLE_AUTO,0,&err);
 KrunMmioDeviceManager d=krun_mmio_device_manager_new();
 KrunConsoleBuilder c=krun_console_device_builder();uint32_t port;
 krun_console_builder_add_inout_port(c,KRUN_STR("jitk"),0,1,&port,&err);
 krun_mmio_device_manager_add(d,krun_console_builder_build(c,&err));
 KrunPayload p=krun_payload_load_external(KRUN_STR(image),KRUN_KERNEL_FORMAT_RAW,KRUN_STR(NULL),KRUN_STR("jitk.seed=00000000000000000000000000000000"),&err);
 KrunVmmBuilder b=krun_vmm_builder_new();
 krun_vmm_builder_vcpus(&b,1,&err);krun_vmm_builder_ram_mib(&b,64,&err);krun_vmm_builder_payload(&b,p);krun_vmm_builder_devices(&b,d);
 char profile[4096];snprintf(profile,sizeof(profile),"(version 1)(deny default)(allow file-read* (subpath \"/System\") (subpath \"/usr/lib\") (literal \"%s\"))(allow file-read-metadata)(allow file-read-data (literal \"/\"))(allow file-map-executable)(allow sysctl-read)(allow iokit-open-user-client (iokit-user-client-class \"AppleHVClient\"))",image);
 char*error=NULL;if(sandbox_init(profile,0,&error)) {fprintf(stderr,"sandbox: %s\n",error);return 4;}
 if(argc>2){fprintf(stderr,"WAIT_GO\n");char byte;struct pollfd fd={0,POLLIN,0};if(poll(&fd,1,-1)<0||read(0,&byte,1)!=1)return 5; jitk_trace_mark("go");}
 jitk_trace_mark("build_begin");KrunVmm v=krun_vmm_builder_build(&b,&err);jitk_trace_mark("build_end");
 if(err){fprintf(stderr,"build error code: %u\n",krun_error_code(err));return 3;}krun_vmm_run(v);return 0;
}
