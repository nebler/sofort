// Same freestanding binary on Linux and the ring: shared dup3 description,
// read/readv/pread/lseek/fstat, descriptor flags, close lifetime, binary output.
static long call(long n,long a,long b,long c,long d) {
    register long x8 __asm__("x8")=n,x0 __asm__("x0")=a,x1 __asm__("x1")=b,x2 __asm__("x2")=c,x3 __asm__("x3")=d;
    __asm__ volatile("svc #0":"+r"(x0):"r"(x8),"r"(x1),"r"(x2),"r"(x3):"memory");return x0;
}
static void check(int ok) {if(!ok){call(93,99,0,0,0);for(;;){}}}
struct iov {void *p;unsigned long n;};
__attribute__((noreturn)) void _start(void) {
    unsigned char b[8]={0},st[128]={0};
    long fd=call(56,-100,(long)"data/input",0,0);check(fd==3);
    check(call(24,fd,0,0x80000,0)==0);
    check(call(25,0,1,0,0)==1);check(call(25,fd,1,0,0)==0);
    check(call(63,0,(long)b,2,0)==2 && b[0]==0 && b[1]==255);
    check(call(62,fd,0,1,0)==2);
    struct iov v[3]={{0,0},{b,1},{b+1,1}};
    check(call(65,0,(long)v,3,0)==2 && b[0]==128 && b[1]==65);
    check(call(62,fd,0,1,0)==4);
    check(call(67,0,(long)b,2,0)==2 && b[0]==0 && b[1]==255);
    check(call(62,fd,0,1,0)==4);
    check(call(80,0,(long)st,0,0)==0 && *(unsigned long*)(st+48)==5);
    check(call(57,fd,0,0,0)==0);
    check(call(63,0,(long)b,8,0)==1 && b[0]==90);
    check(call(57,0,0,0,0)==0);
    check(call(24,99,0,0,0)==-9);check(call(24,99,0,1,0)==-22);
    unsigned char out[]={0,255,128,65,90};
    struct iov w[3]={{0,0},{out,2},{out+2,3}};
    check(call(66,1,(long)w,3,0)==5);
    check(call(64,2,(long)out,5,0)==5);
    call(93,37,0,0,0);for(;;){}
}
