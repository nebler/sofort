// Supervisor-side helper: spawn jitk-vmm directly INTO a pre-created cgroup leaf
// (clone3 CLONE_INTO_CGROUP, Linux >= 5.7) instead of migrating via cgroup.procs.
#define _GNU_SOURCE
#include <fcntl.h>
#include <linux/sched.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <sys/syscall.h>
#include <sys/wait.h>
#include <unistd.h>
int main(int argc, char **argv) { // spawn-cg CGROUP_DIR PROG ARGS...
    int cg = open(argv[1], O_RDONLY | O_DIRECTORY | O_CLOEXEC);
    if (cg < 0) { perror("cgroup"); return 2; }
    struct clone_args a; memset(&a, 0, sizeof a);
    a.flags = CLONE_INTO_CGROUP; a.exit_signal = SIGCHLD; a.cgroup = (uint64_t)cg;
    long pid = syscall(SYS_clone3, &a, sizeof a);
    if (pid < 0) { perror("clone3"); return 3; }
    if (pid == 0) { execv(argv[2], argv + 2); _exit(127); }
    int st; waitpid(pid, &st, 0);
    return WIFEXITED(st) ? WEXITSTATUS(st) : 128 + WTERMSIG(st);
}
