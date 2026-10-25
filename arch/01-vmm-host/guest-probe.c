// Bare EL1 guest: dump actual FDT + MMIO identities over the one console port.
#include <stdint.h>
#include <stddef.h>
struct Desc { uint64_t addr; uint32_t len; uint16_t flags, next; };
struct Avail { uint16_t flags, idx, ring[8], event; };
struct Used { uint16_t flags, idx; struct { uint32_t id,len; } ring[8]; uint16_t event; };
struct Q { struct Desc d[8] __attribute__((aligned(16))); struct Avail a __attribute__((aligned(2))); struct Used u __attribute__((aligned(4))); };
static volatile struct Q qs[4];
static unsigned char rx[1024], ctrl_rx[8][256];
static struct { uint32_t id; uint16_t event,value; } ctrl[3] = {{0,0,1},{0,3,1},{0,6,1}};
static char report[8192]; static unsigned len; static uint64_t base;
static void bar(void) { __asm__ volatile("dsb sy" ::: "memory"); }
static uint32_t rd(uint64_t p) { return *(volatile uint32_t*)p; }
static void wr(unsigned off, uint32_t v) { *(volatile uint32_t*)(base+off)=v; bar(); }
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
        if(token==1) { str("node ");while(f[p])put(f[p++]);p=(p+4)&~3;put('\n'); }
        else if(token==3) {
            unsigned n=be(f+p),name=be(f+p+4);p+=8;
            const char *s=(const char*)f+strings+name;
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
void probe(const unsigned char *tree) {
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
    desc(0,0,rx,sizeof(rx),2);qs[0].a.idx=1;
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
    // Read the first byte on the same console; supports waiting/kill experiments.
    while(!qs[0].u.idx) __asm__ volatile("yield");
#endif
    register uint64_t x0 __asm__("x0")=0x84000008;
    __asm__ volatile("hvc #0"::"r"(x0));
}
