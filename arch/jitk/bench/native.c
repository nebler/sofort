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
#include <sys/select.h>
#include <math.h>
static volatile sig_atomic_t interrupted = 0;
static void interrupt_handler(int signo) { interrupted = signo; }
void bench_init(void) {
    signal(SIGPIPE, SIG_IGN);
    signal(SIGINT, interrupt_handler);
    signal(SIGTERM, interrupt_handler);
}
static int take_interrupt(void) {
    if (!interrupted) return 0;
    int signal_number = interrupted;
    interrupted = 0;
    return signal_number;
}
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
    for (int i = 0; i < 2; ++i) {
        fcntl(in[i], F_SETFD, FD_CLOEXEC);
        fcntl(stdout_pipe[i], F_SETFD, FD_CLOEXEC);
        fcntl(err[i], F_SETFD, FD_CLOEXEC);
    }
    pid_t pid = fork();
    if (!pid) {
        signal(SIGINT, SIG_DFL);
        signal(SIGTERM, SIG_DFL);
        signal(SIGPIPE, SIG_DFL);
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
    int signal_number = take_interrupt();
    if (signal_number) return -(128 + signal_number);
    fd_set fds;
    FD_ZERO(&fds);
    if (a >= 0) FD_SET(a, &fds);
    if (b >= 0) FD_SET(b, &fds);
    double micros = ceil(fmax(0., seconds) * 1e6);
    struct timeval timeout = {(time_t)(micros / 1e6), (suseconds_t)fmod(micros, 1e6)};
    int result = select((a > b ? a : b) + 1, &fds, NULL, NULL, &timeout);
    signal_number = take_interrupt();
    if (signal_number) return -(128 + signal_number);
    if (result < 0) return errno == EINTR ? 0 : -1;
    return (a >= 0 && FD_ISSET(a, &fds) ? 1 : 0) | (b >= 0 && FD_ISSET(b, &fds) ? 2 : 0);
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
    pid_t result;
    do { result = wait4(pid, &status, flags, &r); } while (result < 0 && errno == EINTR);
    if (result <= 0 || n < 32) return result;
    double values[] = {WIFSIGNALED(status) ? -WTERMSIG(status) : WEXITSTATUS(status),
        (r.ru_utime.tv_sec + r.ru_utime.tv_usec / 1e6) * 1000.,
        (r.ru_stime.tv_sec + r.ru_stime.tv_usec / 1e6) * 1000.,
        ((r.ru_utime.tv_sec + r.ru_utime.tv_usec / 1e6) + (r.ru_stime.tv_sec + r.ru_stime.tv_usec / 1e6)) * 1000.};
    memcpy(out, values, sizeof(values));
    return result;
}
double bench_children_cpu(void) {
    struct rusage r; getrusage(RUSAGE_CHILDREN, &r);
    return (r.ru_utime.tv_sec + r.ru_utime.tv_usec / 1e6) + (r.ru_stime.tv_sec + r.ru_stime.tv_usec / 1e6);
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
#ifdef __APPLE__
struct bench_template { char name[32], group[32], units[32]; };
struct bench_entry { int64_t balance, credit, debit, limit, refill, last; };
extern int ledger(int, void *, void *, void *);
#endif
int32_t bench_templates(uint8_t *out, size_t n) {
#ifdef __APPLE__
    struct bench_template t[256] = {0}; int count = 256;
    if (ledger(2, t, &count, NULL)) return -errno;
    if (n < (size_t)count * sizeof(*t)) return -1;
    memcpy(out, t, count * sizeof(*t)); return count;
#else
    return 0;
#endif
}
int32_t bench_ledgers(int32_t pid, uint8_t *out, size_t n) {
#ifdef __APPLE__
    struct bench_entry entries[256] = {0}; int count = 256;
    if (ledger(1, (void *)(intptr_t)pid, entries, &count)) return -errno;
    if (n < (size_t)count * 8) return -1;
    for (int i = 0; i < count; ++i) memcpy(out + i * 8, &entries[i].balance, 8);
    return count;
#else
    return 0;
#endif
}
double bench_timebase(void) {
#ifdef __APPLE__
    mach_timebase_info_data_t tb; mach_timebase_info(&tb);
    return (double)tb.numer / tb.denom;
#else
    return 1.;
#endif
}
int32_t bench_poll_many(const uint8_t *fds, size_t n, double seconds) {
    int signal_number = take_interrupt();
    if (signal_number) return -(128 + signal_number);
    fd_set set;
    FD_ZERO(&set);
    int high = -1;
    for (size_t i = 0; i < n / 4; ++i) {
        int32_t fd;
        memcpy(&fd, fds + i * 4, 4);
        if (fd >= 0) {
            FD_SET(fd, &set);
            if (fd > high) high = fd;
        }
    }
    double micros = ceil(fmax(0., seconds) * 1e6);
    struct timeval timeout = {(time_t)(micros / 1e6), (suseconds_t)fmod(micros, 1e6)};
    int result = select(high + 1, &set, NULL, NULL, &timeout);
    signal_number = take_interrupt();
    if (signal_number) return -(128 + signal_number);
    return result < 0 && errno != EINTR ? -1 : 0;
}
