/* OS ABI only. Benchmark policy, protocol, statistics and accounting live in TS. */
#include <sys/types.h>
#include <sys/wait.h>
#include <sys/resource.h>
#include <unistd.h>
#include <fcntl.h>
#include <poll.h>
#include <signal.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#ifdef __APPLE__
#include <libproc.h>
#include <mach/mach_time.h>
#endif
static char **split(const uint8_t *s, size_t n) {
    char **v = calloc(n + 1, sizeof(char *));
    size_t k = 0;
    for (size_t i = 0; i < n; i += strlen((const char *)s + i) + 1) v[k++] = (char *)s + i;
    return v;
}
int32_t bench_spawn(const uint8_t *args, size_t an, const uint8_t *env, size_t en, uint8_t *out, size_t on) {
    if (on < 16) return -1;
    char **av = split(args, an), **ev = split(env, en);
    int in[2], stdout_pipe[2], err[2];
    if (pipe(in) || pipe(stdout_pipe) || pipe(err)) { free(av); free(ev); return -1; }
    pid_t pid = fork();
    if (!pid) {
        setsid();
        dup2(in[0], 0); dup2(stdout_pipe[1], 1); dup2(err[1], 2);
        close(in[0]); close(in[1]); close(stdout_pipe[0]); close(stdout_pipe[1]); close(err[0]); close(err[1]);
        execve(av[0], av, ev);
        _exit(127);
    }
    free(av); free(ev);
    close(in[0]); close(stdout_pipe[1]); close(err[1]);
    int32_t values[] = {pid, in[1], stdout_pipe[0], err[0]};
    memcpy(out, values, sizeof(values));
    return pid;
}
int32_t bench_poll(int32_t a, int32_t b, double seconds) {
    struct pollfd p[2] = {{a, POLLIN, 0}, {b, POLLIN, 0}};
    int r = poll(p, 2, (int)(seconds * 1000 + .5));
    if (r < 0) return errno == EINTR ? 0 : -1;
    return (p[0].revents ? 1 : 0) | (p[1].revents ? 2 : 0);
}
int32_t bench_read(int32_t fd, uint8_t *out, size_t n) { return (int32_t)read(fd, out, n); }
int32_t bench_write(int32_t fd, const uint8_t *bytes, size_t n) {
    size_t off = 0;
    while (off < n) {
        ssize_t r = write(fd, bytes + off, n - off);
        if (r < 0) { if (errno == EINTR) continue; return -1; }
        off += r;
    }
    return (int32_t)off;
}
int32_t bench_close(int32_t fd) { return close(fd); }
int32_t bench_wait(int32_t pid, int32_t flags, uint8_t *out, size_t n) {
    struct rusage r = {0}; int status = 0;
    pid_t result = wait4(pid, &status, flags, &r);
    if (result <= 0 || n < 24) return result;
    double values[] = {WIFSIGNALED(status) ? -WTERMSIG(status) : WEXITSTATUS(status),
        r.ru_utime.tv_sec * 1000. + r.ru_utime.tv_usec / 1000.,
        r.ru_stime.tv_sec * 1000. + r.ru_stime.tv_usec / 1000.};
    memcpy(out, values, sizeof(values));
    return result;
}
double bench_children_cpu(void) {
    struct rusage r; getrusage(RUSAGE_CHILDREN, &r);
    return (r.ru_utime.tv_sec + r.ru_stime.tv_sec) * 1000. + (r.ru_utime.tv_usec + r.ru_stime.tv_usec) / 1000.;
}
int32_t bench_usage(int32_t pid, int32_t version, uint8_t *out, size_t n) {
#ifdef __APPLE__
    struct rusage_info_v4 r = {0};
    if (proc_pid_rusage(pid, version, (rusage_info_t *)&r)) return -1;
    if (n < sizeof(r)) return -1;
    memcpy(out, &r, sizeof(r));
    return 0;
#else
    return -1;
#endif
}
