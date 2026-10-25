// Minimal libkrun host: boot a raw kernel, 1 vCPU, small RAM, a console on stdio.
#include <stdio.h>
#include <unistd.h>
#include <libkrun.h>
#include <sandbox.h>
#include <stdlib.h>
#include <time.h>
static void confine(const char *profile) {
    char *err = NULL;
    if (sandbox_init(profile, 0, &err) != 0) {
        fprintf(stderr,"sandbox_init failed: %s\n",err ? err : "unknown");
        sandbox_free_error(err); exit(70);
    }
}

int main(int argc, char **argv) {
    char profile[8192] = {0};
    if (argc > 2) {
        FILE *f=fopen(argv[2],"r"); if (!f) return 71;
        size_t n=fread(profile,1,sizeof(profile)-1,f); fclose(f);
        if (n==sizeof(profile)-1) return 72;
    }
    KrunError err = NULL;
    krun_init_log(-1, KRUN_LOG_LEVEL_OFF, KRUN_LOG_STYLE_AUTO, 0, &err);
    KrunMmioDeviceManager devices = krun_mmio_device_manager_new();
    KrunConsoleBuilder cb = krun_console_device_builder();
    krun_console_builder_add_default_console(cb, STDIN_FILENO, STDOUT_FILENO, STDERR_FILENO, &err);
    krun_mmio_device_manager_add(devices, krun_console_builder_build(cb, &err));
    KrunPayload payload = krun_payload_load_external(KRUN_STR(argv[1]), KRUN_KERNEL_FORMAT_RAW,
        KRUN_STR(NULL), KRUN_STR(NULL), &err);
    if (err) { fprintf(stderr, "payload load failed\n"); return 2; }
    KrunVmmBuilder b = krun_vmm_builder_new();
    krun_vmm_builder_vcpus(&b, 1, &err);
    krun_vmm_builder_ram_mib(&b, 64, &err);
    krun_vmm_builder_payload(&b, payload);
    krun_vmm_builder_devices(&b, devices);
    // Public build starts vCPUs: apply BEFORE this call.
    if (argc > 2 && argc < 4) confine(profile);
    KrunVmm vmm = krun_vmm_builder_build(&b, &err);
    if (err) { fprintf(stderr, "vmm build failed\n"); return 3; }
    // Experiment only: post-build is too late for security.
    if (argc > 3) confine(profile);
    krun_vmm_run(vmm);
    return 0;
}
