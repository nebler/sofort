/* Narrow POSIX bridge for APIs absent from scriptc's Node compatibility layer. */
#include <signal.h>
#include <sys/resource.h>
#include <unistd.h>
#ifdef __linux__
#include <fcntl.h>
#include <sys/ioctl.h>
#endif
int jitk_ignore_hup(void) {
    return signal(SIGHUP, SIG_IGN) == SIG_ERR ? -1 : 0;
}
double jitk_usage(int children, int system) {
    struct rusage usage;
    if (getrusage(children ? RUSAGE_CHILDREN : RUSAGE_SELF, &usage)) return -1;
    struct timeval value = system ? usage.ru_stime : usage.ru_utime;
    return (double)value.tv_sec + (double)value.tv_usec / 1000000.0;
}
double jitk_clock_ticks(void) {
    return (double)sysconf(_SC_CLK_TCK);
}
int jitk_kvm_probe(void) {
#ifdef __linux__
    int fd = open("/dev/kvm", O_RDWR);
    if (fd < 0) return -1;
    int version = ioctl(fd, 0xae00, 0);
    int vm = version == 12 ? ioctl(fd, 0xae01, 0) : -1;
    if (vm >= 0) close(vm);
    close(fd);
    return vm >= 0 ? version : -1;
#else
    return -1;
#endif
}
