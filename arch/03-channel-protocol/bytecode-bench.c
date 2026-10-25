// Isolate source compilation vs trusted-bytecode decoding, excluding process boot.
#include "quickjs-libc.h"
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
static double now_us(void) {
    struct timespec t; clock_gettime(CLOCK_MONOTONIC,&t);
    return t.tv_sec*1e6+t.tv_nsec/1e3;
}
static int cmp(const void *a,const void *b) {
    double x=*(const double*)a,y=*(const double*)b;return (x>y)-(x<y);
}
int main(int argc,char **argv) {
    if(argc!=3)return 2;
    size_t sizes[2]; unsigned char *buffers[2];
    for(int mode=0;mode<2;mode++) {
        FILE *f=fopen(argv[mode+1],"rb");if(!f)return 3;
        fseek(f,0,SEEK_END);sizes[mode]=ftell(f);rewind(f);
        buffers[mode]=malloc(sizes[mode]+1);
        if(fread(buffers[mode],1,sizes[mode],f)!=sizes[mode])return 4;
        buffers[mode][sizes[mode]]=0;fclose(f);
    }
    double samples[2][1000];
    for(int i=0;i<1000;i++)for(int j=0;j<2;j++) {
        int mode=(i+j)%2; // Alternate order.
        JSRuntime *rt=JS_NewRuntime();JSContext *ctx=JS_NewContext(rt);
        js_std_init_handlers(rt);js_init_module_std(ctx,"std");js_init_module_os(ctx,"os");
        double start=now_us();
        JSValue v=mode?JS_ReadObject(ctx,buffers[1],sizes[1],JS_READ_OBJ_BYTECODE):
            JS_Eval(ctx,(char*)buffers[0],sizes[0],"bootstrap.js",JS_EVAL_TYPE_MODULE|JS_EVAL_FLAG_COMPILE_ONLY);
        samples[mode][i]=now_us()-start;
        if(JS_IsException(v)){js_std_dump_error(ctx);return 5;}
        JS_FreeValue(ctx,v);js_std_free_handlers(rt);JS_FreeContext(ctx);JS_FreeRuntime(rt);
    }
    for(int mode=0;mode<2;mode++) {
        qsort(samples[mode],1000,sizeof(double),cmp);
        printf("%s bytes=%zu n=1000 median_us=%.3f p90_us=%.3f\n",mode?"bytecode_decode":"source_compile",sizes[mode],samples[mode][500],samples[mode][900]);
        free(buffers[mode]);
    }
    return 0;
}
