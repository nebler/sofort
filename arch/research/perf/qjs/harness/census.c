#define _GNU_SOURCE
#include "quickjs.h"
#include "quickjs-libc.h"
#include <sys/mman.h>
#include <sys/wait.h>
#include <sys/resource.h>
#include <sys/stat.h>
#include <time.h>
#include <signal.h>
#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <malloc.h>

extern void bench_ranges(JSRuntime *, int);
extern void bench_detach(JSRuntime *);
#ifdef BENCH_TRACE
extern void bench_trace_init(void),bench_trace_start(void),bench_trace_dump(int);
#endif
static int reportfd, observe, finished, failed, result_ok, snapgc, nogc, bump, detach, minimal, bytecode, peakhooks, measuring;
static uint64_t pauses;
static JSRuntime *rt;
static JSContext *ctx;
#ifdef MINIMAL
void js_std_dump_error(JSContext *c) {JSValue e=JS_GetException(c);const char*s=JS_ToCString(c,e);fprintf(stderr,"%s\n",s?s:"exception");JS_FreeCString(c,s);JS_FreeValue(c,e);}
#endif
static unsigned char *arena;
static size_t arena_used;
#define ARENASIZE (128UL<<20)
static uint64_t ns(clockid_t c) {struct timespec t; clock_gettime(c,&t);return (uint64_t)t.tv_sec*1000000000+t.tv_nsec;}
static void checkpoint(const char *phase) {
    if (!observe) return;
    uint64_t t=ns(CLOCK_MONOTONIC);
    dprintf(reportfd,"{\"event\":\"point\",\"pid\":%d,\"phase\":\"%s\"}\n",getpid(),phase);
    raise(SIGSTOP);
    pauses+=ns(CLOCK_MONOTONIC)-t;
}
static JSValue js_live(JSContext *c, JSValueConst th, int ac, JSValueConst *av) {checkpoint("live");return JS_UNDEFINED;}
static JSValue js_finish(JSContext *c, JSValueConst th, int ac, JSValueConst *av) {finished=1;JS_ToInt32(c,&failed,av[0]);return JS_UNDEFINED;}
static JSValue js_result(JSContext *c, JSValueConst th, int ac, JSValueConst *av) {result_ok=JS_ToBool(c,av[0]);return JS_UNDEFINED;}
static size_t ausable(const void *p) {return p?((size_t*)p)[-2]:0;}
static void *amalloc(JSMallocState *s,size_t n) {
    size_t sz=(n+15)&~15UL;
    if (sz+16>ARENASIZE-arena_used || s->malloc_size+sz>s->malloc_limit) return NULL;
    size_t *h=(size_t*)(arena+arena_used); h[0]=sz; h[1]=0; arena_used+=sz+16;
    s->malloc_count++; s->malloc_size+=sz; return h+2;
}
static void afree(JSMallocState *s,void *p) {if(p){s->malloc_count--;s->malloc_size-=ausable(p);}}
static void *arealloc(JSMallocState*s,void*p,size_t n) {
    if(!n){afree(s,p);return NULL;} if(!p)return amalloc(s,n);
    size_t old=ausable(p); if(n<=old)return p;
    void*q=amalloc(s,n);if(q){memcpy(q,p,old);afree(s,p);}return q;
}
static const JSMallocFunctions amf={amalloc,afree,arealloc,ausable};
/* Stock Linux callbacks, with observation before large buffers can disappear. */
static size_t musable(const void*p){return malloc_usable_size((void*)p);}
static void *mmalloc(JSMallocState*s,size_t n){if(s->malloc_size+n>s->malloc_limit)return NULL;void*p=malloc(n);if(p){s->malloc_count++;s->malloc_size+=musable(p)+8;}return p;}
static void mfree(JSMallocState*s,void*p){if(!p)return;if(measuring&&musable(p)>=16384)checkpoint("allocator-free");s->malloc_count--;s->malloc_size-=musable(p)+8;free(p);}
static void *mrealloc(JSMallocState*s,void*p,size_t n){if(!p)return n?mmalloc(s,n):NULL;size_t old=musable(p);if(measuring&&old>=16384)checkpoint("allocator-realloc");if(!n){mfree(s,p);return NULL;}if(s->malloc_size+n-old>s->malloc_limit)return NULL;p=realloc(p,n);if(p)s->malloc_size+=musable(p)-old;return p;}
static const JSMallocFunctions mmf={mmalloc,mfree,mrealloc,musable};
typedef struct {const char *p;size_t n;} Buf;
static Buf bc_bs,bc_codec;
static Buf compile(Buf b) {
    rt=JS_NewRuntime();ctx=JS_NewContext(rt);
    JSValue v=JS_Eval(ctx,b.p,b.n,"prepared",JS_EVAL_TYPE_GLOBAL|JS_EVAL_FLAG_COMPILE_ONLY);
    if(JS_IsException(v))exit(7);size_t n;uint8_t*p=JS_WriteObject(ctx,&n,v,JS_WRITE_OBJ_BYTECODE);
    if(!p)exit(7);void*q=mmap(NULL,n,PROT_READ|PROT_WRITE,MAP_PRIVATE|MAP_ANONYMOUS,-1,0);memcpy(q,p,n);mprotect(q,n,PROT_READ);
    js_free(ctx,p);JS_FreeValue(ctx,v);JS_FreeContext(ctx);JS_FreeRuntime(rt);return (Buf){q,n};
}
static void evbc(Buf b) {JSValue v=JS_ReadObject(ctx,(const uint8_t*)b.p,b.n,JS_READ_OBJ_BYTECODE);if(JS_IsException(v))exit(7);v=JS_EvalFunction(ctx,v);if(JS_IsException(v)){js_std_dump_error(ctx);exit(7);}JS_FreeValue(ctx,v);}
static Buf load(const char *name) {
    int f=open(name,O_RDONLY);if(f<0){perror(name);exit(2);}struct stat st;fstat(f,&st);
    char*p=mmap(NULL,st.st_size+1,PROT_READ,MAP_PRIVATE,f,0);close(f);if(p==MAP_FAILED)exit(2);
    return (Buf){p,st.st_size};
}
static void ev(Buf b,const char*name,int flags) {
    JSValue v=JS_Eval(ctx,b.p,b.n,name,flags);
    if(JS_IsException(v)){js_std_dump_error(ctx);exit(3);}JS_FreeValue(ctx,v);
}
static void text(const char*s) {ev((Buf){s,strlen(s)},"bench",JS_EVAL_TYPE_GLOBAL);}
static void jobs(void) {JSContext*c;int r,lim=0;while((r=JS_ExecutePendingJob(rt,&c))>0){if(++lim>100000)exit(4);}if(r<0){js_std_dump_error(c);exit(4);}}
static JSContext *custom(JSRuntime*r) {JSContext*c=JS_NewContext(r);
#ifndef MINIMAL
if(!minimal){js_init_module_std(c,"std");js_init_module_os(c,"os");}
#endif
return c;}
static void initialise(Buf bs,Buf codec) {
    arena_used=0;
    rt=bump?JS_NewRuntime2(&amf,NULL):peakhooks?JS_NewRuntime2(&mmf,NULL):JS_NewRuntime();if(!rt)exit(2);
    JS_SetMemoryLimit(rt,16<<20);JS_SetMaxStackSize(rt,1<<20);
#ifndef MINIMAL
    if(!minimal)js_std_init_handlers(rt);
#endif
    ctx=custom(rt);if(!ctx)exit(2);
    JSValue g=JS_GetGlobalObject(ctx);
    JS_SetPropertyStr(ctx,g,"__bench_finish",JS_NewCFunction(ctx,js_finish,"__bench_finish",1));
    JS_SetPropertyStr(ctx,g,"__bench_live",JS_NewCFunction(ctx,js_live,"__bench_live",0));
    JS_SetPropertyStr(ctx,g,"__bench_result",JS_NewCFunction(ctx,js_result,"__bench_result",1));
    JS_FreeValue(ctx,g);
#ifndef MINIMAL
    if(!minimal){
        JS_SetModuleLoaderFunc2(rt,NULL,js_module_loader,js_module_check_attributes,NULL);
        JS_SetHostPromiseRejectionTracker(rt,js_std_promise_rejection_tracker,NULL);
        char *av[]={"qjs"};js_std_add_helpers(ctx,1,av);
        const char *modules="import * as std from 'std'; import * as os from 'os'; globalThis.std=std;globalThis.os=os;";
        ev((Buf){modules,strlen(modules)},"std",JS_EVAL_TYPE_MODULE);
        jobs();
    }else
#endif
    {
        text("globalThis.std={out:{puts(s){},flush(){},error(){return false}},exit:__bench_finish};globalThis.os={setReadHandler(){},setTimeout(){},clearTimeout(){},read(){throw Error('unused')}};");
    }
    if(bytecode)evbc(bc_bs);else ev(bs,"bootstrap.js",JS_EVAL_TYPE_GLOBAL);jobs();
    if(codec.n){if(bytecode)evbc(bc_codec);else ev(codec,"prepared-codec.js",JS_EVAL_TYPE_GLOBAL);}
    if(snapgc)JS_RunGC(rt);
    if(nogc)JS_SetGCThreshold(rt,(size_t)-1);
}
static void destroy(void){JS_FreeContext(ctx);
#ifndef MINIMAL
if(!minimal)js_std_free_handlers(rt);
#endif
JS_FreeRuntime(rt);}
int main(int argc,char**argv) {
    // argv: root mode workload repetitions init-options. Each process is one fresh template.
    if(argc<6)return 2;char path[1024];const char*root=argv[1],*mode=argv[2],*w=argv[3];int reps=atoi(argv[4]);
    const char*opt=argv[5];snapgc=strstr(opt,"gc-before")!=NULL;nogc=strstr(opt,"no-gc")!=NULL;
    bump=strstr(opt,"bump")!=NULL;detach=strstr(opt,"detach")!=NULL;minimal=strstr(opt,"minimal")!=NULL;
    bytecode=strstr(opt,"bytecode")!=NULL;
    peakhooks=strstr(opt,"peak-hooks")!=NULL;
    observe=!strcmp(mode,"census");reportfd=dup(1);int null=open("/dev/null",O_WRONLY);dup2(null,1);close(null);
#ifdef BENCH_TRACE
    bench_trace_init();
#endif
    if(bump){arena=mmap(NULL,ARENASIZE,PROT_READ|PROT_WRITE,MAP_PRIVATE|MAP_ANONYMOUS|MAP_NORESERVE,-1,0);if(arena==MAP_FAILED)return 2;}
    snprintf(path,sizeof(path),"%s/bootstrap-bench.js",root);Buf bs=load(path);
    snprintf(path,sizeof(path),"%s/codec-prepared.js",root);Buf codec=load(path);if(strstr(opt,"per-run-codec"))codec.n=0;
    if(bytecode){bc_bs=compile(bs);if(codec.n)bc_codec=compile(codec);}
    snprintf(path,sizeof(path),"%s/fixtures/%s.run",root,w);Buf run=load(path);
    snprintf(path,sizeof(path),"%s/fixtures/%s.json",root,w);Buf input=load(path);
    if(!strcmp(mode,"core-init")){
        for(int i=0;i<reps;i++){uint64_t a=ns(CLOCK_MONOTONIC),b=ns(CLOCK_PROCESS_CPUTIME_ID);JSRuntime*r=JS_NewRuntime();JSContext*c=JS_NewContext(r);uint64_t d=ns(CLOCK_PROCESS_CPUTIME_ID),e=ns(CLOCK_MONOTONIC);dprintf(reportfd,"{\"event\":\"init\",\"i\":%d,\"cpu_ns\":%lu,\"wall_ns\":%lu}\n",i,d-b,e-a);JS_FreeContext(c);JS_FreeRuntime(r);}return 0;
    }
    if(!strcmp(mode,"init")){
        for(int i=0;i<reps;i++){uint64_t a=ns(CLOCK_MONOTONIC),b=ns(CLOCK_PROCESS_CPUTIME_ID);initialise(bs,codec);uint64_t c=ns(CLOCK_PROCESS_CPUTIME_ID),d=ns(CLOCK_MONOTONIC);dprintf(reportfd,"{\"event\":\"init\",\"i\":%d,\"cpu_ns\":%lu,\"wall_ns\":%lu}\n",i,c-b,d-a);destroy();}return 0;
    }
    uint64_t a=ns(CLOCK_MONOTONIC);initialise(bs,codec);uint64_t init=ns(CLOCK_MONOTONIC)-a;
    if(observe){
        snprintf(path,sizeof(path),"%s/raw/ranges-%d.jsonl",root,getpid());int f=open(path,O_WRONLY|O_CREAT|O_TRUNC,0644);bench_ranges(rt,f);close(f);
        JSMemoryUsage mu;JS_ComputeMemoryUsage(rt,&mu);
        dprintf(reportfd,"{\"event\":\"template\",\"pid\":%d,\"init_ns\":%lu,\"malloc_size\":%ld,\"memory_used\":%ld,\"atoms\":%ld,\"arena_used\":%lu}\n",getpid(),init,mu.malloc_size,mu.memory_used_size,mu.atom_count,arena_used);
        raise(SIGSTOP);
    }
    for(int i=0;i<reps;i++){
        uint64_t before=ns(CLOCK_MONOTONIC);pid_t p=fork();
        if(p<0)return 5;
        if(!p){
            uint64_t restored=ns(CLOCK_MONOTONIC);checkpoint("start");pauses=0;finished=failed=0;result_ok=-1;measuring=1;
#ifdef BENCH_TRACE
            bench_trace_start();
#endif
            struct rusage ru0,ru1;getrusage(RUSAGE_SELF,&ru0);uint64_t cpu0=ns(CLOCK_PROCESS_CPUTIME_ID),wall0=ns(CLOCK_MONOTONIC);
            if(detach)bench_detach(rt);
            if(strcmp(w,"empty")){
                JSValue g=JS_GetGlobalObject(ctx);JS_SetPropertyStr(ctx,g,"__input",JS_NewStringLen(ctx,input.p,input.n));JS_SetPropertyStr(ctx,g,"__run",JS_NewStringLen(ctx,run.p,run.n));JS_FreeValue(ctx,g);
                text("receive(parse(__run));");jobs();
                if(!finished){checkpoint("waiting");text("for(let id=1;id<next;id++)receive(parse(JSON.stringify({t:'ret',id,ok:{value:id,text:'reply',binary:{__codemode_binary_v1__:'Uint8Array',data:'AQIDBA=='}}}))); ");jobs();}
                if(!finished||failed||result_ok!=1){dprintf(reportfd,"{\"event\":\"failure\",\"pid\":%d,\"finished\":%d,\"status\":%d,\"result_ok\":%d}\n",getpid(),finished,failed,result_ok);_exit(6);}
            }
            uint64_t wall1=ns(CLOCK_MONOTONIC),cpu1=ns(CLOCK_PROCESS_CPUTIME_ID);getrusage(RUSAGE_SELF,&ru1);
            dprintf(reportfd,"{\"event\":\"result\",\"pid\":%d,\"i\":%d,\"restore_ns\":%lu,\"cpu_ns\":%lu,\"wall_ns\":%lu,\"minflt\":%ld,\"maxrss_kib\":%ld,\"arena_used\":%lu}\n",getpid(),i,restored-before,cpu1-cpu0,wall1-wall0-pauses,ru1.ru_minflt-ru0.ru_minflt,ru1.ru_maxrss,arena_used);
            checkpoint("end");
#ifdef BENCH_TRACE
            bench_trace_dump(reportfd);
#endif
            _exit(0);
        }
        int st;waitpid(p,&st,0);if(!WIFEXITED(st)||WEXITSTATUS(st)){dprintf(reportfd,"{\"event\":\"bad_child\",\"status\":%d}\n",st);return 6;}
    }
    return 0;
}
