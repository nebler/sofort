#include <libkrun.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
static KrunVmm build(const char *path) {
    KrunError err = NULL;
    KrunMmioDeviceManager dm = krun_mmio_device_manager_new();
    KrunConsoleBuilder cb = krun_console_device_builder();
    uint32_t port;
    krun_console_builder_add_inout_port(cb, KRUN_STR("jitk"), 0, 1, &port, &err);
    krun_mmio_device_manager_add(dm, krun_console_builder_build(cb, &err));
    KrunPayload p = krun_payload_load_external(KRUN_STR(path), KRUN_KERNEL_FORMAT_RAW, KRUN_STR(NULL), KRUN_STR(""), &err);
    KrunVmmBuilder b = krun_vmm_builder_new();
    krun_vmm_builder_vcpus(&b, 1, &err);
    krun_vmm_builder_ram_mib(&b, 64, &err);
    krun_vmm_builder_payload(&b, p);
    krun_vmm_builder_devices(&b, dm);
    KrunVmm vm = krun_vmm_builder_build(&b, &err);
    fprintf(stderr, "build vm=%p error=%p\n", vm, err);
    return err ? NULL : vm;
}
int main(int argc, char **argv) {
    if (argc != 3) return 64;
    KrunError e = NULL;
    krun_init_log(2, KRUN_LOG_LEVEL_DEBUG, KRUN_LOG_STYLE_NEVER, 0, &e);
    KrunVmm a = build(argv[2]);
    if (!a) return 71;
    if (!strcmp(argv[1], "concurrent")) {
        fprintf(stderr, "first built (vCPU started); building second\n");
        return build(argv[2]) ? 0 : 72;
    }
    if (!strcmp(argv[1], "drop")) {
        krun_vmm_destroy(a);
        fprintf(stderr, "first destroyed; building second\n");
        return build(argv[2]) ? 0 : 73;
    }
    fprintf(stderr, "running first; second must be built after return\n");
    krun_vmm_run(a);
    fprintf(stderr, "FIRST_RETURNED\n");
    return build(argv[2]) ? 0 : 74;
}
