// Independent Linux ABI probe. No handler code or expected implementation is
// imported. Each observation has a semantic/error/state label; byte output is
// hex so the current printable-output transport can carry every test value.
typedef unsigned long U;
static long sys(long n, long a, long b, long c, long d) {
    register long x8 __asm__("x8") = n, x0 __asm__("x0") = a,
        x1 __asm__("x1") = b, x2 __asm__("x2") = c, x3 __asm__("x3") = d;
    __asm__ volatile("svc #0" : "+r"(x0) : "r"(x8), "r"(x1), "r"(x2), "r"(x3) : "memory");
    return x0;
}
#define open(p, f) sys(56, -100, (long)(p), f, 0)
#define close(f) sys(57, f, 0, 0, 0)
#define seek(f, o, w) sys(62, f, o, w, 0)
#define stat(f, p) sys(80, f, (long)(p), 0, 0)
#define pread(f, p, n, o) sys(67, f, (long)(p), n, o)
static char output[8192]; static unsigned used;
static unsigned char buf[256], st[128], other[128];
static void text(const char *p) { while (*p) output[used++] = *p++; }
static void number(long v) {
    char b[24]; unsigned i = 0; U u = v < 0 ? -(U)v : (U)v;
    if (v < 0) output[used++] = '-';
    do { b[i++] = '0' + u % 10; } while ((u /= 10));
    while (i) output[used++] = b[--i];
}
static void result(const char *s, long v) { text(s); text("="); number(v); text("\n"); }
static int equal(const unsigned char *a, const unsigned char *b, unsigned n) {
    for (unsigned i = 0; i < n; i++) if (a[i] != b[i]) return 0;
    return 1;
}
static void bytes(const char *s, long n) {
    text(s); text("="); number(n); text(":");
    if (n > 0 && n <= 256) for (long i = 0; i < n; i++) {
        output[used++] = "0123456789abcdef"[buf[i] >> 4];
        output[used++] = "0123456789abcdef"[buf[i] & 15];
    }
    text("\n");
}
void _start(void) {
    long fd = open("/data.bin", 0);
    result("semantic.open", fd);
#if TARGET == 80
    result("semantic.fstat", stat(fd, st));
    result("semantic.mode", *(unsigned *)(st + 16));
    result("semantic.size", *(long *)(st + 48));
    result("semantic.blksize", *(unsigned *)(st + 56));
    // Device/inode/times are filesystem-specific. Compare with the independent
    // pathname operation, and require a nonzero inode and sufficient blocks.
    result("semantic.inode", *(U *)(st + 8) != 0);
    result("semantic.blocks", *(U *)(st + 64) >= (9000 + 511) / 512);
    result("state.path-stat", sys(79, -100, (long)"/data.bin", (long)other, 0));
    result("state.same-metadata", equal(st, other, 128));
    seek(fd, 17, 0); stat(fd, other);
    result("state.stat-offset", seek(fd, 0, 1));
    result("state.repeat", equal(st, other, 128));
    long fd2 = open("/data.bin", 0); stat(fd2, other);
    result("state.reopen", equal(st, other, 128)); close(fd2);
    result("error.bad-fd", stat(999, st));
    result("error.fd-before-pointer", stat(999, 0));
    result("error.negative-fd", stat(-1, st));
    result("error.null", stat(fd, 0));
    result("error.unmapped", stat(fd, 1));
    result("error.readonly", stat(fd, "/data.bin"));
    result("error.overflow", stat(fd, (void *)(~0UL - 63)));
    long dir = open("/", 0); result("semantic.directory", stat(dir, other));
    result("semantic.directory-type", *(unsigned *)(other + 16) & 0170000); close(dir);
    for (long i = 0; i < 3; i++) {
        result("semantic.pipe", stat(i, other));
        result("semantic.pipe-type", *(unsigned *)(other + 16) & 0170000);
    }
    long unreadable = open("/data.bin", 3);
    result("semantic.unreadable-metadata", stat(unreadable, other)); close(unreadable);
    result("semantic.truncated-fd", stat(fd + (1UL << 32), other));
    close(fd); result("error.closed", stat(fd, st));
#else
    seek(fd, 17, 0);
    bytes("semantic.header", pread(fd, buf, 16, 0));
    bytes("semantic.offset", pread(fd, buf, 23, 4091));
    bytes("semantic.tail", pread(fd, buf, 32, 8993));
    result("semantic.eof", pread(fd, buf, 8, 9000));
    result("semantic.beyond", pread(fd, buf, 8, 10000));
    result("semantic.zero", pread(fd, 0, 0, 0));
    result("semantic.eof-null", pread(fd, 0, 32, 9000));
    result("state.success-offset", seek(fd, 0, 1));
    result("error.negative", pread(fd, buf, 8, -1));
    result("error.negative-before-fd", pread(999, 0, 0, -1));
    result("error.bad-fd", pread(999, buf, 8, 0));
    result("error.fd-before-pointer", pread(999, 0, 8, 0));
    result("error.null", pread(fd, 0, 8, 0));
    result("error.readonly", pread(fd, "/data.bin", 8, 0));
    result("error.overflow-pointer", pread(fd, (void *)(~0UL - 3), 8, 0));
    result("error.count-overflow", pread(fd, buf, ~0UL, 0));
    result("error.offset-overflow", pread(fd, buf, 8, 0x7ffffffffffffffeUL));
    result("semantic.max-offset", pread(fd, buf, 0, 0x7fffffffffffffffUL));
    long dir = open("/", 0); result("error.directory", pread(dir, buf, 8, 0));
    result("error.directory-zero", pread(dir, 0, 0, 0)); close(dir);
    result("error.pipe", pread(0, buf, 8, 0));
    result("error.pipe-zero", pread(1, 0, 0, 0));
    long unreadable = open("/data.bin", 3);
    result("error.unreadable", pread(unreadable, buf, 8, 0)); close(unreadable);
    result("state.error-offset", seek(fd, 0, 1));
    bytes("state.read-after-pread", sys(63, fd, (long)buf, 9, 0));
    result("state.read-offset", seek(fd, 0, 1));
    long fd2 = open("/data.bin", 0); pread(fd2, buf, 8, 5000);
    result("state.independent-open", seek(fd2, 0, 1)); close(fd2);
    close(fd); result("error.closed", pread(fd, buf, 8, 0));
#endif
    sys(64, 1, (long)output, used, 0); sys(94, 0, 0, 0, 0);
}
