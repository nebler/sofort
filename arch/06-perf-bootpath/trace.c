// Copy of spike host.c, with buffered timestamps and dyld interposition.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdatomic.h>
#include <time.h>
#include <unistd.h>
#include <Hypervisor/Hypervisor.h>
#include <libkrun.h>
struct event { const char *name; uint64_t ns; };
static struct event events[256];
static _Atomic unsigned count;
static uint64_t now(void) { return clock_gettime_nsec_np(CLOCK_MONOTONIC_RAW); }
void mark(const char *name) {
    unsigned i = atomic_fetch_add(&count, 1);
    if (i < 256) events[i] = (struct event){name, now()};
}
__attribute__((constructor)) static void loaded(void) { mark("constructor"); }
#define INTERPOSE(new, old) \
    __attribute__((used)) static struct { const void *replacement, *original; } \
    ip_##old __attribute__((section("__DATA,__interpose"))) = {(const void *)&new, (const void *)&old}
static hv_return_t timed_vm_create(hv_vm_config_t c) {
    mark("vm_create_begin"); hv_return_t r = hv_vm_create(c); mark("vm_create_end"); return r;
}
static hv_return_t timed_vm_map(void *p, hv_ipa_t a, size_t n, hv_memory_flags_t f) {
    mark("vm_map_begin"); hv_return_t r = hv_vm_map(p,a,n,f); mark("vm_map_end"); return r;
}
static hv_return_t timed_vcpu_create(hv_vcpu_t *c, hv_vcpu_exit_t **e, hv_vcpu_config_t f) {
    mark("vcpu_create_begin"); hv_return_t r = hv_vcpu_create(c,e,f); mark("vcpu_create_end"); return r;
}
static hv_return_t timed_vcpu_run(hv_vcpu_t c) {
    mark("vcpu_run_begin"); hv_return_t r = hv_vcpu_run(c); mark("vcpu_run_end"); return r;
}
__attribute__((noreturn)) void timed_exit(int code) {
    mark("exit_begin");
    // One buffered write, after all measured VM work. Parent accounts for its cost.
    char b[16384]; int n = 0; unsigned total = atomic_load(&count);
    n += snprintf(b+n,sizeof(b)-n,"{\"events\":[");
    for (unsigned i=0; i<total && i<256; ++i)
        n += snprintf(b+n,sizeof(b)-n,"%s[\"%s\",%llu]",i?",":"",events[i].name,(unsigned long long)events[i].ns);
    n += snprintf(b+n,sizeof(b)-n,"]}\n");
    write(2,b,n); _exit(code);
}
INTERPOSE(timed_vm_create,hv_vm_create);
INTERPOSE(timed_vm_map,hv_vm_map);
INTERPOSE(timed_vcpu_create,hv_vcpu_create);
INTERPOSE(timed_vcpu_run,hv_vcpu_run);
INTERPOSE(timed_exit,_exit);
