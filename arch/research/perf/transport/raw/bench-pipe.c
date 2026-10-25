#include <sys/types.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
static uint64_t ns(){struct timespec t;clock_gettime(CLOCK_MONOTONIC_RAW,&t);return (uint64_t)t.tv_sec*1000000000+t.tv_nsec;}
static int transfer(int fd,char*b,size_t n,int writing,uint64_t*c){while(n){ssize_t x=writing?write(fd,b,n):read(fd,b,n);if(c)(*c)++;if(x<=0)return -1;b+=x;n-=x;}return 0;}
int main(){char b[70000];memset(b,'x',sizeof(b));puts("{\"method\":\"two anonymous pipes, persistent fork child, request61 bytes, reply27 or65564 bytes, CLOCK_MONOTONIC_RAW\",\"rows\":[");int first=1;for(int scenario=0;scenario<3;scenario++){
 int a[2],d[2];pipe(a);pipe(d);int batch=scenario==1?10:1,reply=scenario==2?65564:27,iters=scenario==2?100:1000;
 pid_t p=fork();if(!p){close(a[1]);close(d[0]);for(;;){for(int j=0;j<batch;j++)if(transfer(a[0],b,61,0,0))_exit(0);for(int j=0;j<batch;j++)if(transfer(d[1],b,reply,1,0))_exit(1);}}
 close(a[0]);close(d[1]);for(int sample=-3;sample<31;sample++){uint64_t reads=0,writes=0,t=ns();for(int i=0;i<iters;i++){for(int j=0;j<batch;j++)transfer(a[1],b,61,1,&writes);for(int j=0;j<batch;j++)transfer(d[0],b,reply,0,&reads);}double us=(ns()-t)/1000.0/iters;if(sample>=0){printf("%s{\"scenario\":%d,\"sample\":%d,\"batch\":%d,\"reply\":%d,\"iterations\":%d,\"batchUs\":%.6f,\"parentReads\":%llu,\"parentWrites\":%llu}",first?"":",\n",scenario,sample,batch,reply,iters,us,(unsigned long long)reads,(unsigned long long)writes);first=0;}}close(a[1]);close(d[0]);waitpid(p,0,0);
 }puts("]}");}
