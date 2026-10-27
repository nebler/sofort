// Shared-tree launcher for the Linux oracle (static aarch64 musl, mounted into the
// unchanged jitk-oracle:08 image). usage: oracle-root ROOT PROGRAM ARG0 [ARG...]
// Opens PROGRAM, makes ROOT (the materialised jitk archive, bind-mounted
// read-only) the process root and cwd, drops to uid/gid 65534 with no
// supplementary groups, then executes PROGRAM through its descriptor. The payload
// therefore sees exactly the guest's file tree: no /payload, /tmp, /proc or /dev.
// The container keeps --cap-drop ALL except SYS_CHROOT/SETUID/SETGID and
// no-new-privileges. Exit 125-127 are launcher failures (oracle-profile rejects).
#define _GNU_SOURCE
#include <fcntl.h>
#include <grp.h>
#include <stdio.h>
#include <sys/syscall.h>
#include <unistd.h>

extern char **environ;

int main(int argc, char **argv) {
  if (argc < 4) {
    fputs("usage: oracle-root ROOT PROGRAM ARG0 [ARG...]\n", stderr);
    return 125;
  }
  int fd = open(argv[2], O_PATH | O_CLOEXEC);
  if (fd < 0) { perror("oracle-root: open program"); return 126; }
  if (chroot(argv[1]) != 0 || chdir("/") != 0) { perror("oracle-root: chroot"); return 126; }
  if (setgroups(0, NULL) != 0 || setgid(65534) != 0 || setuid(65534) != 0) { perror("oracle-root: drop"); return 126; }
  if (getuid() != 65534 || geteuid() != 65534 || getgid() != 65534 || getegid() != 65534) { fputs("oracle-root: still privileged\n", stderr); return 126; }
  syscall(SYS_execveat, fd, "", argv + 3, environ, AT_EMPTY_PATH);
  perror("oracle-root: execveat");
  return 127;
}
