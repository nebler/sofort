// Bare EL1 guest: dump actual FDT + MMIO identities over the one console port.
#include <stdint.h>
#include <stddef.h>
struct Desc { uint64_t addr; uint32_t len; uint16_t flags, next; };
struct Avail { uint16_t flags, idx, ring[8], event; };
struct Used { uint16_t flags, idx; struct { uint32_t id,len; } ring[8]; uint16_t event; };
struct Q { struct Desc d[8] __attribute__((aligned(16))); struct Avail a __attribute__((aligned(2))); struct Used u __attribute__((aligned(4))); };
static volatile struct Q qs[4];
#ifdef CLI_BUF_ECHO
#define RX_COUNT 1000
#else
#define RX_COUNT 1
#endif
static unsigned char rx[1024], ctrl_rx[8][256];
static struct { uint32_t id; uint16_t event,value; } ctrl[3] = {{0,0,1},{0,3,1},{0,6,1}};
static uint64_t gicd, gicr; static unsigned intc;
static char report[8192]; static unsigned len; static uint64_t base;
static void bar(void) { __asm__ volatile("dsb sy" ::: "memory"); }
static uint32_t rd(uint64_t p) { uint32_t v; __asm__ volatile("ldr %w0, [%1]" : "=r"(v) : "r"(p) : "memory"); return v; }
static void wr(unsigned off, uint32_t v) { __asm__ volatile("str %w0, [%1]" :: "r"(v), "r"(base+off) : "memory"); bar(); }
static void pair(unsigned off,uint64_t v) { wr(off,(uint32_t)v); wr(off+4,v>>32); }
static void put(char c) { if(len<sizeof(report)) report[len++]=c; }
static void str(const char *s) { while(*s) put(*s++); }
static void hex(uint64_t v) { for(int i=60;i>=0;i-=4) put("0123456789abcdef"[(v>>i)&15]); }
static uint32_t be(const unsigned char *p) { return (uint32_t)p[0]<<24|(uint32_t)p[1]<<16|(uint32_t)p[2]<<8|p[3]; }
static int equal(const char *a,const char *b) { while(*a&&*a==*b) {a++;b++;} return *a==*b; }
static void fdt(const unsigned char *f) {
    str("FDT magic=");hex(be(f));str(" bytes=");hex(be(f+4));put('\n');
    if(be(f)!=0xd00dfeed) return;
    unsigned p=be(f+8), end=p+be(f+36), strings=be(f+12);
    while(p<end) {
        unsigned token=be(f+p);p+=4;
        if(token==1) { intc=equal((const char*)f+p,"intc"); str("node ");while(f[p])put(f[p++]);p=(p+4)&~3;put('\n'); }
        else if(token==3) {
            unsigned n=be(f+p),name=be(f+p+4);p+=8;
            const char *s=(const char*)f+strings+name;
            if(intc && equal(s,"reg") && n>=32) {
                gicd=((uint64_t)be(f+p)<<32)|be(f+p+4);
                gicr=((uint64_t)be(f+p+16)<<32)|be(f+p+20);
            }
            if(equal(s,"compatible")||equal(s,"reg")||equal(s,"bootargs")) {
                str("  ");str(s);str("=");
                for(unsigned i=0;i<n;i++) {
                    if(equal(s,"reg")) { put("0123456789abcdef"[f[p+i]>>4]);put("0123456789abcdef"[f[p+i]&15]); }
                    else put(f[p+i]?f[p+i]:'|');
                }
                put('\n');
            }
            p=(p+n+3)&~3;
        } else if(token==9) break;
        else if(token!=2&&token!=4) { str("bad token\n");break; }
    }
}
static void desc(unsigned q,unsigned i,void *p,unsigned n,unsigned flags) {
    qs[q].d[i]=(struct Desc){(uint64_t)p,n,flags,0};qs[q].a.ring[i]=i;
}
void probe(const unsigned char *tree, uint64_t first_ticks) {
    str("GUEST_TICKS ");hex(first_ticks);put('\n');
    fdt(tree);
#ifdef EMBED_QJS
    extern const unsigned char qjs_start[], qjs_end[];
    str("embedded-qjs bytes=");hex((uintptr_t)qjs_end-(uintptr_t)qjs_start);
    str(" ELF-header=");hex(be(qjs_start));put('\n');
#endif

    unsigned devices=0;
    for(unsigned i=0;i<128;i++) {
        uint64_t p=0x0a000000ull+0x200*i;
        if(rd(p)==0x74726976) {
            str("virtio @");hex(p);str(" DeviceID=");hex(rd(p+8));put('\n');
            devices++;if(rd(p+8)==3)base=p;
        }
    }
    str("virtio-count=");hex(devices);put('\n');
    if(!base) { register uint64_t x0 __asm__("x0")=0xbad00000|devices;__asm__ volatile("hvc #0"::"r"(x0));return; }
    wr(0x70,0);wr(0x70,1);wr(0x70,3);
    wr(0x24,0);wr(0x20,2); // MULTIPORT; VERSION_1 in page 1
    wr(0x24,1);wr(0x20,1);wr(0x70,11);
    desc(0,0,rx,RX_COUNT,2);qs[0].a.idx=1;
    desc(1,0,report,len,0);qs[1].a.idx=1;
    for(unsigned i=0;i<8;i++)desc(2,i,ctrl_rx[i],256,2);
    qs[2].a.idx=8;
    for(unsigned i=0;i<3;i++)desc(3,i,&ctrl[i],8,0);
    qs[3].a.idx=3;
    for(unsigned i=0;i<4;i++) {
        wr(0x30,i);wr(0x38,8);
        pair(0x80,(uint64_t)&qs[i].d);pair(0x90,(uint64_t)&qs[i].a);pair(0xa0,(uint64_t)&qs[i].u);wr(0x44,1);
    }
    wr(0x70,15);wr(0x50,2);wr(0x50,3);wr(0x50,1);wr(0x50,0);
    while(!qs[1].u.idx) __asm__ volatile("yield");
#ifdef PARK
    uint64_t save=base;
#ifndef TIMER_ONLY
    base=gicr;wr(0x14,rd(gicr+0x14)&~2u);wr(0x10080,0xffffffff);
    base=gicd;wr(0,0);wr(0x84,0xffffffff);wr(0x420,0x80808080);
    wr(0xc08,rd(gicd+0xc08)|(2u<<2));wr(0x104,2);__asm__ volatile("str xzr,[%0]" :: "r"(gicd+0x6108) : "memory");wr(0,0x12);
    __asm__ volatile("msr ICC_SRE_EL1,%0; isb; msr ICC_PMR_EL1,%1; msr ICC_IGRPEN1_EL1,%0; isb" :: "r"(1ull),"r"(255ull));
#endif
    base=save;
#endif
#ifdef PARK
    // Mask IRQ exceptions; consume pending IDs explicitly after WFI.
    __asm__ volatile("msr daifset, #2; msr cntv_ctl_el0, xzr; isb");
    for(unsigned iter=0;iter<(1000/RX_COUNT);iter++) {
        uint16_t want=iter+1;
        while(qs[0].u.idx != want) {
#ifdef CLI_BUF_ECHO
            // CLI byte preservation probe: isolate fd handoff from native GIC parking.
            __asm__ volatile("yield"); continue;
#endif
#ifndef TIMER
            uint64_t irq;
            do {
                __asm__ volatile("mrs %0, ICC_IAR1_EL1" : "=r"(irq));
                if(irq<1020) __asm__ volatile("msr ICC_EOIR1_EL1, %0" :: "r"(irq));
            } while(irq<1020);
#endif
            if(qs[0].u.idx == want) break;
#ifdef TIMER
            uint64_t ticks, hz;
            __asm__ volatile("mrs %0,cntvct_el0; mrs %1,cntfrq_el0" : "=r"(ticks),"=r"(hz));
            uint64_t deadline=ticks+hz/1000;
            __asm__ volatile("msr cntv_cval_el0,%0; msr cntv_ctl_el0,%1; isb" :: "r"(deadline),"r"(1ull));
#endif
#ifdef USE_WFE
            __asm__ volatile("dsb sy; wfe; isb" ::: "memory");
#else
            __asm__ volatile("dsb sy; wfi; isb" ::: "memory");
#endif
        }
        // Drain control completions and keep their RX ring supplied.
        static uint16_t control_used;
        while(control_used!=qs[2].u.idx) {
            unsigned id=qs[2].u.ring[control_used%8].id;
            qs[2].a.ring[qs[2].a.idx%8]=id;bar();qs[2].a.idx++;control_used++;
        }
        wr(0x50,2);
        wr(0x64,rd(base+0x60));
        qs[1].d[0]=(struct Desc){(uint64_t)rx,RX_COUNT,0,0};
        qs[1].a.ring[qs[1].a.idx%8]=0;bar();qs[1].a.idx++;wr(0x50,1);
        while(qs[1].u.idx!=(uint16_t)(iter+2)) __asm__ volatile("yield");
        qs[0].a.ring[qs[0].a.idx%8]=0;bar();qs[0].a.idx++;wr(0x50,0);
    }
#endif
    register uint64_t x0 __asm__("x0")=0x84000008;
    __asm__ volatile("hvc #0"::"r"(x0));
}

void fault_report(uint64_t pc,uint64_t esr,uint64_t far) {
    len=0;str("FAULT pc=");hex(pc);str(" esr=");hex(esr);str(" far=");hex(far);put('\n');
    qs[1].d[0]=(struct Desc){(uint64_t)report,len,0,0};
    qs[1].a.ring[qs[1].a.idx%8]=0;bar();qs[1].a.idx++;wr(0x50,1);
    while(qs[1].u.idx!=qs[1].a.idx)__asm__ volatile("yield");
    register uint64_t x0 __asm__("x0")=0x84000008;__asm__ volatile("hvc #0"::"r"(x0));
}
