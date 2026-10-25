// Experiment: apply Seatbelt before libkrun setup; never continue on failure.
#include <sandbox.h>
#include <stdlib.h>
#include <errno.h>
#include <fcntl.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <arpa/inet.h>
#include <time.h>
#include <string.h>
// Minimal libkrun host: boot a raw kernel, 1 vCPU, small RAM, a console on stdio.
#include <stdio.h>
#include <unistd.h>
#include <libkrun.h>
int main(int argc, char **argv) {
    const char *profile_path = getenv("SB_PROFILE");
    if (profile_path) {
        FILE *f = fopen(profile_path, "rb");
        if (!f) return 90;
        char profile[8192];
        size_t n = fread(profile, 1, sizeof(profile)-1, f);
        if (!feof(f)) return 91;
        fclose(f); profile[n] = 0;
        char *error = NULL;
        struct timespec a,b;
        clock_gettime(CLOCK_MONOTONIC, &a);
        if (sandbox_init(profile, 0, &error)) {
            fprintf(stderr, "sandbox_init: %s\n", error ? error : "failure");
            sandbox_free_error(error); return 92;
        }
        clock_gettime(CLOCK_MONOTONIC, &b);
        if (getenv("REPORT_SB_TIME"))
            fprintf(stderr, "sandbox_init_ns=%lld\n",
                (long long)(b.tv_sec-a.tv_sec)*1000000000LL+b.tv_nsec-a.tv_nsec);
    }
    if (getenv("PROBE")) {
        const char *paths[] = { "/etc/passwd", "/Users/noah/.ssh",
            "/private/tmp/jitk-07/forbidden.txt", argv[1] };
        for (size_t i=0; i<sizeof(paths)/sizeof(paths[0]); i++) {
            errno=0; int fd=open(paths[i],O_RDONLY);
            printf("open[%s]=%d errno=%d\n",paths[i], fd, errno);
            if (fd>=0) close(fd);
        }
        errno=0;
        int fd=open("/private/tmp/jitk-07/write-probe",O_WRONLY|O_CREAT,0600);
        printf("create=%d errno=%d\n", fd,errno); if (fd>=0) close(fd);
        errno=0; int s=socket(AF_INET,SOCK_STREAM,0);
        printf("socket=%d errno=%d\n",s,errno);
        if (s>=0) {
            struct sockaddr_in dst={.sin_family=AF_INET,.sin_port=htons(18707)};
            dst.sin_addr.s_addr=htonl(INADDR_LOOPBACK); errno=0;
            int rc=connect(s,(struct sockaddr *)&dst,sizeof(dst));
            printf("connect=%d errno=%d\n",rc,errno); close(s);
        }
        fflush(stdout);
    }
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
    if (err) { fprintf(stderr, "vmm build failed\n"); return 3; }
    krun_vmm_run(vmm);
    return 0;
}
