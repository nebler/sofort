// Timing instrumentation only; the precompiled profile is supplied by owner 07.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
struct profile { const char *builtin; const void *data; size_t size; };
extern int sandbox_apply(const struct profile *);
static double now(void) { struct timespec t; clock_gettime(CLOCK_MONOTONIC, &t); return t.tv_sec*1000.0+t.tv_nsec/1e6; }
int main(int argc, char **argv) {
    if(argc!=3) return 2;
    double prepare_start=now();
    FILE *f=fopen(argv[1],"rb"); if(!f) return 3;
    fseek(f,0,SEEK_END);long n=ftell(f);rewind(f);
    if(n<=0 || n>1048576) return 4;
    void *buf=malloc((size_t)n);if(!buf || fread(buf,1,(size_t)n,f)!=(size_t)n) return 5;
    fclose(f);struct profile p={NULL,buf,(size_t)n};
    double start=now();int rc=strcmp(argv[2],"on")==0?sandbox_apply(&p):0;double elapsed=now()-start;
    if(rc) return 6;
    printf("{\"t\":\"measurement\",\"sandbox_apply_ms\":%.9f,\"sandbox_prepare_apply_ms\":%.9f}\n",elapsed,now()-prepare_start);
    return 0;
}
