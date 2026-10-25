// Freestanding read-only filesystem probe: raw syscalls, no libc. The same
// static binary runs under Linux (Docker, tree bind-mounted :ro) and jitk.
// Output is printable ASCII; fields compared are Linux-observable and
// deterministic (no inode, device, time, nlink, block or ordering fields).
typedef unsigned long u64;
#define AT_FDCWD (-100)
static long sys(long n, long a, long b, long c, long d) {
    register long x8 __asm__("x8") = n, x0 __asm__("x0") = a, x1 __asm__("x1") = b,
        x2 __asm__("x2") = c, x3 __asm__("x3") = d;
    __asm__ volatile("svc #0" : "+r"(x0) : "r"(x8), "r"(x1), "r"(x2), "r"(x3) : "memory");
    return x0;
}
#define openat(d, p, f) sys(56, d, (long)(p), f, 0)
#define close(fd) sys(57, fd, 0, 0, 0)
#define lseek(fd, o, w) sys(62, fd, o, w, 0)
#define read(fd, b, n) sys(63, fd, (long)(b), n, 0)
#define readv(fd, v, n) sys(65, fd, (long)(v), n, 0)
#define fstatat(d, p, s, f) sys(79, d, (long)(p), (long)(s), f)
#define getdents(fd, b, n) sys(61, fd, (long)(b), n, 0)
#define fcntl(fd, c, a) sys(25, fd, c, a, 0)
#define readlinkat(d, p, b, n) sys(78, d, (long)(p), (long)(b), n)

static char out[65536];
static unsigned outn;
static void s(const char *t) { while (*t) out[outn++] = *t++; }
static void num(long v) {
    char b[24]; int i = 0; u64 u = v < 0 ? -(u64)v : (u64)v;
    if (v < 0) out[outn++] = '-';
    do b[i++] = '0' + u % 10; while (u /= 10);
    while (i) out[outn++] = b[--i];
}
static void r(const char *label, long v) { s(label); s(" = "); num(v); s("\n"); }
static unsigned hash(const unsigned char *p, long n) {
    unsigned h = 2166136261u;
    for (long i = 0; i < n; i++) h = (h ^ p[i]) * 16777619u;
    return h;
}
static void text(const unsigned char *p, long n) {
    for (long i = 0; i < n; i++) {
        unsigned char c = p[i];
        if (c >= 32 && c < 127 && c != '\\') out[outn++] = c;
        else { s("\\x"); out[outn++] = "0123456789abcdef"[c >> 4]; out[outn++] = "0123456789abcdef"[c & 15]; }
    }
    s("\n");
}
static unsigned char buf[131072];
static char longpath[4200];
struct iov { void *base; u64 len; } iv[2];
struct ent { char name[64]; int type; } ents[64];
static int order[64];

static void stat_line(const char *label, int dirfd, const char *path, int flags) {
    unsigned char st[128];
    long v = fstatat(dirfd, path, st, flags);
    s(label); s(" = "); num(v);
    if (v == 0) s(" mode="), num(*(unsigned *)(st + 16));
    if (v == 0 && (*(unsigned *)(st + 16) & 0xf000) == 0x8000) s(" size="), num(*(long *)(st + 48));
    s("\n");
}
static void list(const char *label, const char *path) {
    long fd = openat(AT_FDCWD, path, 0x24000 | 0x80000), n, total = 0, count = 0;
    s(label); s(" open = "); num(fd); s("\n");
    while ((n = getdents(fd, buf, 4096)) > 0)
        for (long off = 0; off < n; off += *(unsigned short *)(buf + off + 16)) {
            struct ent *e = &ents[count++];
            int i = 0;
            for (const char *p = (const char *)buf + off + 19; *p && i < 63; p++) e->name[i++] = *p;
            e->name[i] = 0; e->type = buf[off + 18]; total++;
        }
    r("getdents end", n);
    for (long i = 0; i < count; i++) order[i] = i;
    for (long i = 1; i < count; i++)  // insertion sort: Linux order is fs-specific
        for (long j = i; j > 0; j--) {
            const char *a = ents[order[j - 1]].name, *b = ents[order[j]].name;
            while (*a && *a == *b) a++, b++;
            if ((unsigned char)*a <= (unsigned char)*b) break;
            int t = order[j]; order[j] = order[j - 1]; order[j - 1] = t;
        }
    for (long i = 0; i < count; i++) { s("  "); s(ents[order[i]].name); s(" type="); num(ents[order[i]].type); s("\n"); }
    r("rewind", lseek(fd, 0, 0));
    n = getdents(fd, buf, 4096); r("after rewind has entries", n > 0);
    r("close", close(fd));
}

void _start(void) {
    long fd, n, dfd;
    // openat: success, normalization, and Linux error precedence on a ro mount.
    static const char *const ok[] = {"/skills/readme.md", "//skills//./readme.md", "/../../skills/readme.md",
                        "skills/readme.md", "../skills/sub/../readme.md", "/skills/", "/", "/.", "/.."};
    for (int i = 0; i < 9; i++) { fd = openat(AT_FDCWD, ok[i], 0); s(ok[i]); s(" open = "); num(fd); s(" close = "); num(close(fd)); s("\n"); }
    static const char *const bad[] = {"/nope", "/skills/nope/x", "/skills/readme.md/x", "/skills/readme.md/",
                         "/skills/readme.md/.", "/skills/readme.md/..", "", "/skills/empty.txt/../readme.md"};
    for (int i = 0; i < 8; i++) { s("'"); s(bad[i]); s("'"); r(" open", openat(AT_FDCWD, bad[i], 0)); }
    r("open NULL", openat(AT_FDCWD, 0, 0));
    r("open unmapped", openat(AT_FDCWD, 16, 0));
    for (int i = 0; i < 4200; i++) longpath[i] = 'a';
    r("open no NUL in 4096", openat(AT_FDCWD, longpath, 0));
    longpath[0] = '/'; longpath[257] = 0;
    r("open 256-byte component", openat(AT_FDCWD, longpath, 0));
    for (int i = 0; i < 4094; i += 2) longpath[i] = '/', longpath[i + 1] = '.';
    longpath[4094] = 0;
    r("open 4094-byte path", fd = openat(AT_FDCWD, longpath, 0)); close(fd);
    longpath[4094] = '/'; longpath[4095] = 0;
    r("open 4095-byte path", fd = openat(AT_FDCWD, longpath, 0)); close(fd);
    longpath[4095] = '.'; longpath[4096] = 0;
    r("open 4096-byte path", openat(AT_FDCWD, longpath, 0));
    static const struct { const char *path; long flags; const char *label; } f[] = {
        {"/skills/readme.md", 1, "file O_WRONLY"}, {"/skills/readme.md", 2, "file O_RDWR"},
        {"/skills/readme.md", 3, "file accmode 3"}, {"/skills", 3, "dir accmode 3"}, {"/skills/readme.md", 0x203, "file accmode 3|O_TRUNC"}, {"/skills/readme.md", 0x200, "file O_TRUNC"},
        {"/skills/readme.md", 0x400, "file O_APPEND"}, {"/skills/readme.md", 0x40, "file O_CREAT"},
        {"/skills/readme.md", 0xc0, "file O_CREAT|O_EXCL"}, {"/skills/new.txt", 0x41, "new O_CREAT|O_WRONLY"},
        {"/skills/new.txt", 0x40, "new O_CREAT"}, {"/skills/new.txt", 1, "new O_WRONLY"},
        {"/nodir/new.txt", 0x40, "missing-dir O_CREAT"}, {"/skills/readme.md", 0x4000, "file O_DIRECTORY"},
        {"/skills", 0x4000, "dir O_DIRECTORY"}, {"/skills", 1, "dir O_WRONLY"}, {"/skills", 0x40, "dir O_CREAT"},
        {"/skills", 0x200, "dir O_TRUNC"}, {"/skills", 0x4040, "dir O_CREAT|O_DIRECTORY"},
        {"/skills/readme.md", 0x28800, "file NONBLOCK|LARGEFILE|NOFOLLOW"}, {"/skills", 0x404002, "dir O_TMPFILE|O_RDWR"}};
    for (unsigned i = 0; i < sizeof f / sizeof *f; i++) { fd = openat(AT_FDCWD, f[i].path, f[i].flags); r(f[i].label, fd); if (fd >= 0) close(fd); }
    // dirfd-relative lookup.
    dfd = openat(AT_FDCWD, "/skills", 0x24000);
    r("dirfd", dfd);
    r("rel readme", fd = openat(dfd, "readme.md", 0)); close(fd);
    r("rel ../scripts/x.lua", fd = openat(dfd, "../scripts/x.lua", 0)); close(fd);
    r("rel sub/deep.txt", fd = openat(dfd, "sub/deep.txt", 0));
    r("rel from file fd", openat(fd, "x", 0)); close(fd);
    r("rel from bad fd", openat(99, "x", 0));
    r("abs from bad fd", fd = openat(99, "/skills/readme.md", 0)); close(fd);
    // read / lseek / readv.
    fd = openat(AT_FDCWD, "/skills/readme.md", 0);
    n = read(fd, buf, 7); r("read 7", n); text(buf, n);
    r("read len 0", read(fd, buf, 0));
    r("read NULL", read(fd, 0, 4));
    r("lseek cur", lseek(fd, 0, 1));
    r("lseek set 2", lseek(fd, 2, 0));
    r("lseek cur -1", lseek(fd, -1, 1));
    n = read(fd, buf, 4096); r("read rest", n); text(buf, n);
    r("read eof", read(fd, buf, 4096));
    r("read eof NULL", read(fd, 0, 4096));
    r("lseek end", lseek(fd, 0, 2));
    r("lseek end+10", lseek(fd, 10, 2));
    r("read past end", read(fd, buf, 10));
    r("lseek cur after past-end read", lseek(fd, 0, 1));
    r("lseek negative", lseek(fd, -1, 0));
    r("lseek cur after negative", lseek(fd, 0, 1));
    r("lseek whence 7", lseek(fd, 0, 7));
    lseek(fd, 0, 0);
    iv[0].base = buf; iv[0].len = 3; iv[1].base = buf + 100; iv[1].len = 5;
    r("readv 3+5", readv(fd, iv, 2)); text(buf, 3); text(buf + 100, 5);
    iv[0].len = 0; iv[1].len = 4096;
    n = readv(fd, iv, 2); r("readv 0+4096", n); text(buf + 100, n);
    r("readv eof", readv(fd, iv, 2));
    r("readv iovcnt 1025", readv(fd, iv, 1025));
    r("readv bad iov", readv(fd, 16, 1));
    r("write ro fd", sys(64, fd, (long)buf, 1, 0));
    r("fcntl getfd", fcntl(fd, 1, 0));
    r("fcntl setfd", fcntl(fd, 2, 1));
    r("fcntl getfd after", fcntl(fd, 1, 0));
    r("close", close(fd));
    r("close again", close(fd));
    r("read closed", read(fd, buf, 1));
    r("lseek closed", lseek(fd, 0, 0));
    r("fcntl closed", fcntl(fd, 1, 0));
    fd = openat(AT_FDCWD, "/skills/readme.md", 0x80000); r("O_CLOEXEC getfd", fcntl(fd, 1, 0)); close(fd);
    fd = openat(AT_FDCWD, "/skills/readme.md", 3); r("accmode 3 read", read(fd, buf, 1)); r("accmode 3 lseek", lseek(fd, 1, 0)); close(fd);
    fd = openat(AT_FDCWD, "/skills/empty.txt", 0); r("empty read", read(fd, buf, 10)); r("empty end", lseek(fd, 0, 2)); close(fd);
    fd = openat(AT_FDCWD, "/data/big.bin", 0);
    n = read(fd, buf, sizeof buf); r("big read", n); r("big hash", hash(buf, n));
    lseek(fd, 65530, 0); n = read(fd, buf, 12); r("big read at 65530", n); text(buf, n); close(fd);
    // Directories: read/getdents/stat.
    r("read dir", read(dfd, buf, 10));
    r("getdents small buffer", getdents(dfd, buf, 8));
    r("getdents NULL", getdents(dfd, 0, 4096));
    fd = openat(AT_FDCWD, "/skills/readme.md", 0);
    r("getdents file", getdents(fd, buf, 4096));
    r("getdents bad fd", getdents(77, buf, 4096));
    stat_line("stat file", AT_FDCWD, "/skills/readme.md", 0);
    stat_line("stat dir", AT_FDCWD, "/skills/sub", 0);
    stat_line("stat nofollow", AT_FDCWD, "/data/big.bin", 0x100);
    stat_line("stat rel", dfd, "sub/deep.txt", 0);
    stat_line("stat empty path", fd, "", 0);
    stat_line("stat AT_EMPTY_PATH file", fd, "", 0x1000);
    stat_line("stat AT_EMPTY_PATH dir", dfd, "", 0x1000);
    stat_line("stat missing", AT_FDCWD, "/skills/nope", 0);
    stat_line("stat notdir", AT_FDCWD, "/skills/readme.md/", 0);
    stat_line("stat bad flags", AT_FDCWD, "/skills/readme.md", 4);
    r("stat NULL buf", fstatat(AT_FDCWD, "/skills/readme.md", 0, 0));
    r("readlink file", readlinkat(AT_FDCWD, "/skills/readme.md", buf, 64));
    r("readlink missing", readlinkat(AT_FDCWD, "/nope", buf, 64));
    r("readlink bufsiz 0", readlinkat(AT_FDCWD, "/skills/readme.md", buf, 0));
    r("readlink notdir", readlinkat(AT_FDCWD, "/skills/readme.md/x", buf, 64));
    close(fd); close(dfd);
    list("/skills", "/skills");
    list("/skills/sub", "/skills/sub");
    list("/data", "/data/");
    // Descriptor table bound (Linux run uses ulimit -n 64).
    long first = -1, last = -1, opened = 0;
    for (int i = 0; i < 70; i++) {
        fd = openat(AT_FDCWD, "/skills/readme.md", 0);
        if (fd < 0) { r("exhausted errno", fd); break; }
        if (first < 0) first = fd;
        last = fd; opened++;
    }
    r("first", first); r("last", last); r("opened", opened);
    r("close 10", close(10));
    r("reuse lowest", openat(AT_FDCWD, "/scripts/x.lua", 0));
    sys(64, 1, (long)out, outn, 0);
    sys(94, 0, 0, 0, 0);
}
