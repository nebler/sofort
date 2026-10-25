// Minimal libkrun host: boot a raw kernel, 1 vCPU, small RAM, a console on stdio.
#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>
#include <libkrun.h>
#include <time.h>
#include <mach/mach_time.h>
int main(int argc, char **argv) {
    KrunError err = NULL;
    krun_init_log(-1, KRUN_LOG_LEVEL_OFF, KRUN_LOG_STYLE_AUTO, 0, &err);
    KrunMmioDeviceManager devices = krun_mmio_device_manager_new();
    KrunConsoleBuilder cb = krun_console_device_builder();
    uint32_t port;
    krun_console_builder_add_inout_port(cb, KRUN_STR("jitk"), STDIN_FILENO, STDOUT_FILENO, &port, &err);
    krun_mmio_device_manager_add(devices, krun_console_builder_build(cb, &err));
    unsigned char entropy[16]; arc4random_buf(entropy, sizeof(entropy));
    char cmdline[256] = "jitk.seed=";
    for (int i=0;i<16;i++) snprintf(cmdline+10+2*i,3,"%02x",entropy[i]);
    struct timespec ts; mach_timebase_info_data_t tb; mach_timebase_info(&tb);
    clock_gettime(CLOCK_REALTIME,&ts); unsigned long long counter=mach_absolute_time();
    snprintf(cmdline+42,sizeof(cmdline)-42," jitk.epoch_ns=%llu jitk.counter=%llu jitk.tick_us=%s",
        (unsigned long long)ts.tv_sec*1000000000ULL+ts.tv_nsec,counter,getenv("JITK_TICK_US")?getenv("JITK_TICK_US"):"0");
    KrunPayload payload = krun_payload_load_external(KRUN_STR(argv[1]), KRUN_KERNEL_FORMAT_RAW,
        KRUN_STR(argc > 2 ? argv[2] : NULL), KRUN_STR(cmdline), &err);
    if (err) { fprintf(stderr, "payload load failed\n"); return 2; }
    KrunVmmBuilder b = krun_vmm_builder_new();
    krun_vmm_builder_vcpus(&b, 1, &err);
    krun_vmm_builder_ram_mib(&b, 32, &err);
    krun_vmm_builder_payload(&b, payload);
    krun_vmm_builder_devices(&b, devices);
    KrunVmm vmm = krun_vmm_builder_build(&b, &err);
    if (err) { fprintf(stderr, "vmm build failed\n"); return 3; }
    krun_vmm_run(vmm);
    return 0;
}
