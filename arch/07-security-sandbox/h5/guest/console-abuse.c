// Hostile EL1 guest: abuses the virtio-console control queue / descriptors, then proves the
// device still works by sending "ALIVE <mode>\n" on port 0 and calling PSCI SYSTEM_OFF.
// Build with -DMODE=n. Based on 01's guest-probe.c (FDT-free: console found by MMIO scan).
#include <stdint.h>
struct Desc { uint64_t addr; uint32_t len; uint16_t flags, next; };
struct Avail { uint16_t flags, idx, ring[8], event; };
struct Used { uint16_t flags, idx; struct { uint32_t id,len; } ring[8]; uint16_t event; };
struct Q { struct Desc d[8] __attribute__((aligned(16))); struct Avail a __attribute__((aligned(2))); struct Used u __attribute__((aligned(4))); };
static volatile struct Q qs[4];
static unsigned char rx[1024], ctrl_rx[8][256];
struct Ctl { uint32_t id; uint16_t event, value; };
static struct Ctl ctrl[8];
static char msg[64]; static uint64_t base;
static void bar(void) { __asm__ volatile("dsb sy" ::: "memory"); }
static uint32_t rd(uint64_t p) { return *(volatile uint32_t*)p; }
static void wr(unsigned off, uint32_t v) { *(volatile uint32_t*)(base+off)=v; bar(); }
static void pair(unsigned off,uint64_t v) { wr(off,(uint32_t)v); wr(off+4,v>>32); }
static void off(void) { register uint64_t x0 __asm__("x0")=0x84000008; __asm__ volatile("hvc #0"::"r"(x0)); }
static void spin(unsigned long n) { while(n--) __asm__ volatile("yield"); }
static void d(unsigned q,unsigned i,uint64_t p,unsigned n,unsigned flags,unsigned next) {
    qs[q].d[i]=(struct Desc){p,n,flags,next}; qs[q].a.ring[i%8]=i;
}
#define M_BADID 1
#define M_REOPEN 2
#define M_SPAM 3
#define M_TXOOB 4
#define M_TXPARTIAL 5
#define M_LOOP 6
#define M_EOFWAIT 7
#define M_RXOOB 8
#define M_RXZERO 9
void probe(const unsigned char *tree) {
    (void)tree;
    for(unsigned i=0;i<128 && !base;i++) { uint64_t p=0x0a000000ull+0x200*i; if(rd(p)==0x74726976 && rd(p+8)==3) base=p; }
    if(!base) { off(); return; }
    wr(0x70,0);wr(0x70,1);wr(0x70,3);
    wr(0x24,0);wr(0x20,2); wr(0x24,1);wr(0x20,1);wr(0x70,11);
    unsigned n=0;
    ctrl[n++]=(struct Ctl){0,0,1};                         // DEVICE_READY
#if MODE==M_BADID
    ctrl[n++]=(struct Ctl){99,3,1}; ctrl[n++]=(struct Ctl){0xffffffff,6,1}; // PORT_READY/OPEN bad ids
#endif
    ctrl[n++]=(struct Ctl){0,3,1}; ctrl[n++]=(struct Ctl){0,6,1}; // PORT_READY 0, PORT_OPEN 0
#if MODE==M_REOPEN
    ctrl[n++]=(struct Ctl){0,6,1}; ctrl[n++]=(struct Ctl){0,6,0}; ctrl[n++]=(struct Ctl){0,6,1};
#endif
    for(unsigned i=0;i<8;i++) d(2,i,(uint64_t)ctrl_rx[i],256,2,0);
    qs[2].a.idx=8;
    for(unsigned i=0;i<n;i++) d(3,i,(uint64_t)&ctrl[i],8,0,0);
    qs[3].a.idx=n;
#if MODE==M_RXOOB
    d(0,0,0x0001000000000000ull,1024,2,0); qs[0].a.idx=1;   // RX buffer outside RAM; host then sends input
#elif MODE==M_RXZERO
    d(0,0,(uint64_t)rx,0,2,0); qs[0].a.idx=1;               // zero-length RX buffer
#else
    d(0,0,(uint64_t)rx,sizeof(rx),2,0); qs[0].a.idx=1;
#endif
    for(unsigned i=0;i<4;i++) {
        wr(0x30,i);wr(0x38,8);
        pair(0x80,(uint64_t)&qs[i].d);pair(0x90,(uint64_t)&qs[i].a);pair(0xa0,(uint64_t)&qs[i].u);wr(0x44,1);
    }
    wr(0x70,15);wr(0x50,2);wr(0x50,3);
    spin(2000000);
#if MODE==M_SPAM
    // 20000 extra control-TX kicks, each re-offering a PORT_OPEN for port 0 (8-slot ring wraps).
    ctrl[7]=(struct Ctl){0,6,1};
    for(unsigned k=0;k<20000;k++) { d(3,7,(uint64_t)&ctrl[7],8,0,0); qs[3].a.ring[(qs[3].a.idx)%8]=7; qs[3].a.idx++; bar(); wr(0x50,3); }
    spin(2000000);
#endif
#if MODE==M_RXOOB || MODE==M_RXZERO
    d(0,1,(uint64_t)rx,sizeof(rx),2,0); qs[0].a.ring[1]=1; qs[0].a.idx=2; wr(0x50,0);
    while(qs[0].u.idx<2) __asm__ volatile("yield");      // bad chain consumed AND host byte received
#endif
    const char *m="ALIVE ";
    unsigned l=0; while(m[l]) { msg[l]=m[l]; l++; } msg[l++]='0'+MODE; msg[l++]='\n';
    unsigned slot=0;
#if MODE==M_TXOOB
    d(1,slot,0x0001000000000000ull,4096,0,0); qs[1].a.idx=++slot; wr(0x50,1); spin(1000000); // outside RAM
#endif
#if MODE==M_TXPARTIAL
    d(1,slot,0x80000000ull+(32ull<<20)-16,4096,0,0); qs[1].a.idx=++slot; wr(0x50,1); spin(1000000); // straddles RAM end
#endif
#if MODE==M_LOOP
    d(1,slot,(uint64_t)msg,4,1,slot+1); d(1,slot+1,(uint64_t)msg,4,1,slot); qs[1].a.idx=++slot; slot++; wr(0x50,1); spin(1000000);
#endif
    d(1,slot,(uint64_t)msg,l,0,0); qs[1].a.ring[slot%8]=slot; qs[1].a.idx=slot+1; wr(0x50,1);
    while(qs[1].u.idx<=0) __asm__ volatile("yield");
    spin(1000000);
#if MODE==M_EOFWAIT
    while(!qs[0].u.idx) __asm__ volatile("wfi");   // idle-waits for host input; host sends EOF instead (guest CPU ~0, so CPU = host-side work)
#endif
    off();
}
