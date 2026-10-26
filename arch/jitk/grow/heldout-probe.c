// Controller-only differential variants. Never copied into the proposal repo.
typedef unsigned long U;
static long sys(long n, long a, long b, long c, long d, long e) {
    register long x8 __asm__("x8") = n, x0 __asm__("x0") = a,
        x1 __asm__("x1") = b, x2 __asm__("x2") = c,
        x3 __asm__("x3") = d, x4 __asm__("x4") = e;
    __asm__ volatile("svc #0" : "+r"(x0) : "r"(x8), "r"(x1), "r"(x2), "r"(x3), "r"(x4) : "memory");
    return x0;
}
#define open(p, f) sys(56, -100, (long)(p), f, 0, 0)
#define close(f) sys(57, f, 0, 0, 0, 0)
#define seek(f, o, w) sys(62, f, o, w, 0, 0)
#define stat(f, p) sys(80, f, (long)(p), 0, 0, 0)
#define pread(f, p, n, o) sys(67, f, (long)(p), n, o, 0)
static char output[65536]; static unsigned used;
static unsigned char buf[8192], st[512], other[128];
static const char readonly[] = "held-out immutable bytes";
static void text(const char *p) { while (*p) output[used++] = *p++; }
static void number(long v) {
    char b[24]; unsigned i = 0; U u = v < 0 ? -(U)v : (U)v;
    if (v < 0) output[used++] = '-';
    do { b[i++] = '0' + u % 10; } while ((u /= 10));
    while (i) output[used++] = b[--i];
}
static void result(const char *s, long v) { text(s); text("="); number(v); text("\n"); }
static void bytes(const char *s, long n) {
    text(s); text("="); number(n); text(":");
    if (n > 0 && n <= 8192) for (long i = 0; i < n; i++) {
        output[used++] = "0123456789abcdef"[buf[i] >> 4];
        output[used++] = "0123456789abcdef"[buf[i] & 15];
    }
    text("\n");
}
static U word(const unsigned char *p, unsigned n) {
    U v = 0; for (unsigned i = 0; i < n; i++) v |= (U)p[i] << (8*i); return v;
}
static int equal(const unsigned char *a, const unsigned char *b, unsigned n) {
    for (unsigned i = 0; i < n; i++) if (a[i] != b[i]) return 0; return 1;
}
struct pollfd { int fd; short events, revents; };
struct timespec { long sec, ns; };
static struct pollfd fds[16];
static struct timespec zero, negative = {-1, 0}, invalid = {0, 1000000000};
static const struct pollfd ro_poll = {1, 4, 0};
#define poll(p,n,t) sys(73, (long)(p), n, (long)(t), 0, 8)
void _start(void) {
    long fd = open("/data.bin", 0);
    result("open", fd);
#if TARGET == 80
    unsigned offsets[] = {1, 63, 127, 256};
    for (unsigned k = 0; k < 4; k++) {
        unsigned at = offsets[k];
        for (unsigned j = 0; j < 512; j++) st[j] = 0xa7;
        result("stat.unaligned", stat(fd, st + at));
        result("stat.mode", word(st + at + 16, 4));
        result("stat.size", word(st + at + 48, 8));
        result("stat.links", word(st + at + 20, 4));
        result("stat.blocksize", word(st + at + 56, 4));
        result("stat.blocks", word(st + at + 64, 8) >= (10241 + 511) / 512);
        result("stat.canary-before", st[at-1]);
        result("stat.canary-after", st[at+128]);
        result("stat.path", sys(79, -100, (long)"/data.bin", (long)other, 0, 0));
        result("stat.all-bytes-path", equal(st+at, other, 128));
    }
    seek(fd, 997, 0); stat(fd, other);
    result("stat.offset", seek(fd, 0, 1));
    result("stat.fd-truncation", stat(fd + (1UL<<32), other));
    result("stat.null", stat(fd, 0));
    result("stat.unmapped", stat(fd, (void *)0xdead0000));
    result("stat.readonly", stat(fd, readonly));
    result("stat.wrap", stat(fd, (void *)(~0UL-31)));
    result("stat.bad", stat(314, other));
    result("stat.bad-null", stat(314, 0));
    long dir = open("/", 0); result("stat.directory", stat(dir, other));
    result("stat.directory-type", word(other+16,4) & 0170000); close(dir);
    for (long i=0; i<3; i++) {
        result("stat.pipe", stat(i, other));
        result("stat.pipe-type", word(other+16,4) & 0170000);
    }
    close(fd); result("stat.closed", stat(fd, other));
#elif TARGET == 67
    seek(fd, 997, 0);
    long lengths[] = {0,1,7,127,128,255,256,4095,4096};
    for (unsigned i=0; i<9; i++) bytes("pread.length", pread(fd,buf,lengths[i],253));
    long offsets[] = {1,254,4095,8190,9000,10240,10241,10242};
    for (unsigned i=0; i<8; i++) bytes("pread.offset", pread(fd,buf,37,offsets[i]));
    bytes("pread.fd-truncation", pread(fd+(1UL<<32),buf,3,101));
    result("pread.position-success", seek(fd,0,1));
    result("pread.null", pread(fd,0,3,7));
    result("pread.unmapped", pread(fd,(void *)0xdead0000,3,7));
    result("pread.readonly", pread(fd,readonly,3,7));
    result("pread.wrap", pread(fd,(void *)(~0UL-1),3,7));
    result("pread.negative", pread(fd,buf,3,-13));
    result("pread.bad", pread(314,buf,3,7));
    result("pread.bad-null", pread(314,0,3,7));
    result("pread.negative-first", pread(314,0,3,-13));
    result("pread.count-boundary", pread(fd,buf,1UL<<63,7));
    result("pread.offset-boundary", pread(fd,buf,3,0x7ffffffffffffffeUL));
    result("pread.zero-null", pread(fd,0,0,7));
    result("pread.eof-null", pread(fd,0,3,10241));
    long dir=open("/",0); result("pread.directory",pread(dir,buf,3,7));close(dir);
    for(long i=0;i<3;i++)result("pread.pipe",pread(i,buf,3,7));
    long unreadable=open("/data.bin",3);result("pread.unreadable",pread(unreadable,buf,3,7));close(unreadable);
    result("pread.position-errors",seek(fd,0,1));
    bytes("pread.read-after",sys(63,fd,(long)buf,3,0,0));
    long fd2=open("/data.bin",0);pread(fd2,buf,3,4197);
    result("pread.independent",seek(fd2,0,1));close(fd2);
    close(fd);result("pread.closed",pread(fd,buf,3,7));
#else
    // Both sides support bounded console polling. Archive readiness is outside
    // this helper API; closed archive fds still exercise POLLNVAL independently.
    close(fd);
    for (unsigned i=0;i<16;i++) { fds[i].fd=-7; fds[i].events=5; fds[i].revents=0x777; }
    fds[0].fd=0;fds[0].events=1;fds[3].fd=2;fds[3].events=4;fds[9].fd=fd;fds[15].fd=314;
    result("poll.sixteen",poll(fds,16,&zero));
    for(unsigned i=0;i<16;i++)result("poll.revents",fds[i].revents);
    fds[0].fd=1;fds[0].events=1;fds[0].revents=0x777;
    result("poll.wrong-direction",poll(fds,1,&zero));result("poll.cleared",fds[0].revents);
    result("poll.empty",poll(0,0,&zero));
    result("poll.null",poll(0,2,&zero));
    result("poll.unmapped",poll((void*)0xdead0000,2,&zero));
    result("poll.readonly",poll(&ro_poll,1,&zero));
    result("poll.wrap",poll((void*)(~0UL-3),2,&zero));
    result("poll.negative-time",poll(0,0,&negative));
    result("poll.invalid-nsec",poll(0,0,&invalid));
    result("poll.bad-time",poll(0,0,(void*)0xdead0000));
    result("poll.readonly-time",poll(0,0,(void*)&readonly));
#endif
    sys(64,1,(long)output,used,0,0);sys(94,0,0,0,0,0);
}
