#include <sys/resource.h>
double jitk_children_cpu(void) {
    struct rusage r;
    if (getrusage(RUSAGE_CHILDREN, &r) != 0) return -1;
    return r.ru_utime.tv_sec + r.ru_stime.tv_sec + (r.ru_utime.tv_usec + r.ru_stime.tv_usec) / 1000000.0;
}
