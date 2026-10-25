#include <stdint.h>
#include <stddef.h>
#include <unistd.h>
#include <sys/mman.h>
#include <stdio.h>
#include <string.h>
#define N (1<<18)
static uint64_t *tab;
static int active;
void bench_trace_init(void){tab=mmap(0,(N+1)*8,PROT_READ|PROT_WRITE,MAP_SHARED|MAP_ANONYMOUS,-1,0);memset(tab,0,(N+1)*8);}
void bench_trace_start(void){memset(tab,0,(N+1)*8);active=1;}
void bench_touch(const void*p,int kind){
 if(!active)return;
 if(kind==5){tab[N]++;return;}
 uintptr_t page=(uintptr_t)p>>12;unsigned i=(page*11400714819323198485ull)>>(64-18);
 while(tab[i]&&(tab[i]>>8)!=page)i=(i+1)&(N-1);
 tab[i]=(page<<8)|(tab[i]&255)|(1u<<kind);
}
void bench_trace_dump(int fd){active=0;dprintf(fd,"{\"event\":\"gc_count\",\"pid\":%d,\"count\":%lu}\n",getpid(),tab[N]);for(int i=0;i<N;i++)if(tab[i])dprintf(fd,"{\"event\":\"write_site\",\"pid\":%d,\"page\":%lu,\"mask\":%lu}\n",getpid(),(tab[i]>>8)*4096,tab[i]&255);}
