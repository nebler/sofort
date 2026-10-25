// Minimal libkrun host: boot a raw kernel, 1 vCPU, small RAM, a console on stdio.
#include <stdio.h>
#include <unistd.h>
#include <libkrun.h>
int main(int argc, char **argv) {
    KrunError err = NULL;
    krun_init_log(-1, KRUN_LOG_LEVEL_OFF, KRUN_LOG_STYLE_AUTO, 0, &err);
    KrunMmioDeviceManager devices = krun_mmio_device_manager_new();
    KrunConsoleBuilder cb = krun_console_device_builder();
    krun_console_builder_add_default_console(cb, STDIN_FILENO, STDOUT_FILENO, STDERR_FILENO, &err);
    krun_mmio_device_manager_add(devices, krun_console_builder_build(cb, &err));
    KrunPayload payload = krun_payload_load_external(KRUN_STR(argv[1]), KRUN_KERNEL_FORMAT_RAW,
        KRUN_STR(argc > 2 ? argv[2] : NULL), KRUN_STR(NULL), &err);
    if (err) { fprintf(stderr, "payload load failed\n"); return 2; }
    KrunVmmBuilder b = krun_vmm_builder_new();
    krun_vmm_builder_vcpus(&b, 1, &err);
    krun_vmm_builder_ram_mib(&b, 64, &err);
    krun_vmm_builder_payload(&b, payload);
    krun_vmm_builder_devices(&b, devices);
    KrunVmm vmm = krun_vmm_builder_build(&b, &err);
    if (err) { fprintf(stderr, "vmm build failed code=%u result=%llu\n", krun_error_code(err), (unsigned long long)krun_error_result(err)); return 3; }
    fprintf(stderr, "READY\n");
    krun_vmm_run(vmm);
    return 0;
}
