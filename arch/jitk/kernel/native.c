#include <time.h>
#ifdef __APPLE__
#include <mach/mach_time.h>
#include <libproc.h>
#include <sys/resource.h>
#endif

double jitk_realtime_ms(void) {
    struct timespec t;
    clock_gettime(CLOCK_REALTIME, &t);
    return (double)t.tv_sec * 1000.0 + (double)t.tv_nsec / 1000000.0;
}
double jitk_counter_ms(void) {
#ifdef __APPLE__
    mach_timebase_info_data_t t;
    mach_timebase_info(&t);
    return (double)mach_absolute_time() * t.numer / t.denom / 1000000.0;
#else
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return (double)t.tv_sec * 1000.0 + (double)t.tv_nsec / 1000000.0;
#endif
}
double jitk_usage(int pid, int field) {
#ifdef __APPLE__
    struct rusage_info_v0 r;
    if (proc_pid_rusage(pid, RUSAGE_INFO_V0, (rusage_info_t *)&r) != 0) return -1;
    return field == 0 ? (double)r.ri_resident_size : (double)r.ri_phys_footprint;
#else
    (void)pid; (void)field;
    return -1;
#endif
}
