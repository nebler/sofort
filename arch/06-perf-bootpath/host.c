// Instrumented copy of spike host.c; timestamps shared with trace.c.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <libkrun.h>
extern void jitk_trace_mark(const char *);
extern void jitk_trace_dump(void);
#define mark jitk_trace_mark
__attribute__((constructor)) static void loaded(void) { mark("constructor"); }

int main(int argc, char **argv) {
    mark("main");
    if (argc > 1 && !strcmp(argv[1],"--noop")) { mark("exit_begin"); jitk_trace_dump(); _exit(0); }
    KrunError err = NULL;
    krun_init_log(-1, KRUN_LOG_LEVEL_OFF, KRUN_LOG_STYLE_AUTO, 0, &err);
    KrunMmioDeviceManager devices = krun_mmio_device_manager_new();
    KrunConsoleBuilder cb = krun_console_device_builder();
    krun_console_builder_add_default_console(cb, STDIN_FILENO, STDOUT_FILENO, STDERR_FILENO, &err);
    krun_mmio_device_manager_add(devices, krun_console_builder_build(cb, &err));
    mark("payload_api_begin");
    KrunPayload payload = krun_payload_load_external(KRUN_STR(argv[1]), KRUN_KERNEL_FORMAT_RAW,
        KRUN_STR(argc > 2 && argv[2][0] ? argv[2] : NULL), KRUN_STR(NULL), &err);
    mark("payload_api_end");
    if (err) { fprintf(stderr,"payload load failed\n"); return 2; }
    KrunVmmBuilder b = krun_vmm_builder_new();
    krun_vmm_builder_vcpus(&b, 1, &err);
    krun_vmm_builder_ram_mib(&b, argc > 3 ? atoi(argv[3]) : 64, &err);
    krun_vmm_builder_payload(&b, payload);
    krun_vmm_builder_devices(&b, devices);
    mark("build_begin");
    KrunVmm vmm = krun_vmm_builder_build(&b, &err);
    mark("build_end");
    if (err) { fprintf(stderr,"vmm build failed\n"); return 3; }
    mark("run_api_begin");
    krun_vmm_run(vmm);
    mark("run_api_end");
    return 0;
}
