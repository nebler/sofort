// Adjacent virtual RO/data pages have nonadjacent physical backing in jitk.
// The same ELF tests byte buffers and an iovec descriptor spanning that seam.
static const unsigned char ro[4096] __attribute__((section(".boundary_ro"), used)) = {
    [4088]=0x40, [4089]=0xf0, [4090]=0x67 // iov_base = 0x67f040
};
static unsigned char rw[4096] __attribute__((section(".boundary_rw"), used)) = {'W'};
static long call(long n, long a, long b, long c, long d) {
    register long x8 __asm__("x8")=n, x0 __asm__("x0")=a, x1 __asm__("x1")=b,
                  x2 __asm__("x2")=c, x3 __asm__("x3")=d;
    __asm__ volatile("svc #0":"+r"(x0):"r"(x8),"r"(x1),"r"(x2),"r"(x3):"memory");
    return x0;
}
static void check(int ok) { if (!ok) { call(93,99,0,0,0); for (;;) {} } }
__attribute__((noreturn)) void _start(void) {
    long fd=call(56,-100,(long)"data/input",0,0); check(fd==3);
    unsigned char *buf=rw+64;
    check(call(63,fd,(long)buf,32,0)==32);
    for (int i=0;i<32;i++) check(buf[i]==(unsigned char)i);
    check(call(64,1,(long)buf,32,0)==32);
    check(call(64,1,(long)ro+4095,2,0)==2);
    // iov_base occupies the last eight RO bytes; iov_len the first eight RW.
    *(volatile unsigned long *)rw=32;
    check(call(66,2,(long)ro+4088,1,0)==32);
    check(call(62,fd,0,0,0)==0);
    check(call(65,fd,(long)ro+4088,1,0)==32);
    // Complete validation must reject the RO prefix and unmapped tail.
    check(call(67,fd,(long)ro+4095,2,0)==-14);
    check(call(64,1,(long)rw+4095,2,0)==-14);
    call(93,37,0,0,0); for (;;) {}
}
