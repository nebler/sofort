// Adapted from owner 07: clone3(CLONE_INTO_CGROUP), never post-spawn migration.
#define _GNU_SOURCE
#include <fcntl.h>
#include <linux/sched.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/resource.h>
#include <sys/syscall.h>
#include <sys/wait.h>
#include <unistd.h>
int main(int argc, char **argv) {
    if (argc < 4) return 2;
    int cg = open(argv[1], O_RDONLY | O_DIRECTORY | O_CLOEXEC);
    if (cg < 0) { perror("cgroup"); return 2; }
    struct clone_args a = {0}; a.flags = CLONE_INTO_CGROUP;
    a.exit_signal = SIGCHLD; a.cgroup = (uint64_t)cg;
    long pid = syscall(SYS_clone3, &a, sizeof a);
    if (pid < 0) { perror("clone3"); return 3; }
    if (!pid) {
        prctl(PR_SET_PDEATHSIG, SIGKILL);
        if (getppid() == 1) _exit(127);
        execv(argv[2], argv + 2); _exit(127);
    }
    close(cg); dprintf(2, "P %ld\n", pid);
    siginfo_t info = {0};
    if (waitid(P_PID, pid, &info, WEXITED | WNOWAIT)) return 4;
    char path[80], line[8192]; snprintf(path, sizeof path, "/proc/%ld/stat", pid);
    FILE *f = fopen(path, "r"); unsigned long long guest = 0;
    if (f && fgets(line, sizeof line, f)) {
        char *s = strrchr(line, ')') + 2, *save = NULL;
        for (int field = 3; s; field++, s = strtok_r(NULL, " ", &save)) {
            if (field == 3) s = strtok_r(s, " ", &save);
            if (field == 43) { guest = strtoull(s, NULL, 10); break; }
        }
    }
    if (f) fclose(f);
    struct rusage u; int st; wait4(pid, &st, 0, &u);
    dprintf(2, "R {\"user_ms_including_guest\":%.6f,\"system_ms\":%.6f,\"guest_ticks\":%llu,\"tick_hz\":%ld}\n",
      u.ru_utime.tv_sec*1000.+u.ru_utime.tv_usec/1000.,
      u.ru_stime.tv_sec*1000.+u.ru_stime.tv_usec/1000., guest, sysconf(_SC_CLK_TCK));
    return WIFEXITED(st) ? WEXITSTATUS(st) : 128 + WTERMSIG(st);
}
