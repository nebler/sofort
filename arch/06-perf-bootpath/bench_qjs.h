// Included after quickjs headers, in qjs and qjsc-generated main.
#include <time.h>
#include <sys/resource.h>
#include <stdlib.h>
#include <stdio.h>
#include <stdint.h>
#include <string.h>
static uint64_t bench_start;
static uint64_t bench_ns(void) {
    struct timespec t; clock_gettime(CLOCK_MONOTONIC,&t);
    return (uint64_t)t.tv_sec*1000000000+t.tv_nsec;
}
static JSValue bench_stamp(JSContext *ctx, JSValueConst self, int argc, JSValueConst *argv) {
    uint64_t t=bench_ns();
    const char *label=argc?JS_ToCString(ctx,argv[0]):"first";
    struct rusage r; getrusage(RUSAGE_SELF,&r);
    long hwm=0, rss=0, peak=0;
    FILE *status=fopen("/proc/self/status","r"); char line[256];
    while (status && fgets(line,sizeof(line),status)) {
        if (!strncmp(line,"VmHWM:",6)) sscanf(line+6,"%ld",&hwm);
        if (!strncmp(line,"VmRSS:",6)) sscanf(line+6,"%ld",&rss);
        if (!strncmp(line,"VmPeak:",7)) sscanf(line+7,"%ld",&peak);
    }
    if(status) fclose(status);
    JSMemoryUsage m; JS_ComputeMemoryUsage(JS_GetRuntime(ctx),&m);
    fprintf(stderr,"BENCH {\"stage\":\"%s\",\"elapsed_us\":%.3f,\"hwm_kib\":%ld,\"rusage_kib\":%ld,\"rss_kib\":%ld,\"vmpeak_kib\":%ld,\"js_malloc_bytes\":%lld,\"js_used_bytes\":%lld}\n",
            label,(double)(t-bench_start)/1000,hwm,r.ru_maxrss,rss,peak,(long long)m.malloc_size,(long long)m.memory_used_size);
    if(argc) JS_FreeCString(ctx,label);
    return JS_UNDEFINED;
}
static void bench_install(JSContext *ctx) {
    JSValue g=JS_GetGlobalObject(ctx);
    JS_SetPropertyStr(ctx,g,"__benchStamp",JS_NewCFunction(ctx,bench_stamp,"__benchStamp",1));
    JS_FreeValue(ctx,g);
}
