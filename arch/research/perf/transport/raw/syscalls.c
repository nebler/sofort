#define _DARWIN_C_SOURCE
#include <unistd.h>
#include <sys/uio.h>
#include <sys/event.h>
#include <poll.h>
#include <stdatomic.h>
#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include <dlfcn.h>
static _Atomic int active=0;static _Atomic uint64_t counts[24];
void a4_sys_mark(int n){if(n==1){for(int i=0;i<24;i++)atomic_store(&counts[i],0);atomic_store(&active,1);}else atomic_store(&active,0);}
uint64_t a4_sys_get(int i){return i>=0&&i<24?atomic_load(&counts[i]):0;}
void a4_sys_dump(void){char b[2048];int n=snprintf(b,sizeof(b),"A4SYS {\"c\":[");for(int i=0;i<24;i++)n+=snprintf(b+n,sizeof(b)-n,"%s%llu",i?",":"",(unsigned long long)atomic_load(&counts[i]));n+=snprintf(b+n,sizeof(b)-n,"]}\n");write(2,b,n);}
#define ADD(i,n) if(atomic_load(&active))atomic_fetch_add(&counts[i],(n))
ssize_t a4_read(int f,void*b,size_t n){ssize_t r=read(f,b,n);ADD(0,1);if(r>0){ADD(1,1);ADD(2,r);}else if(r<0){ADD(3,1);}return r;}
ssize_t a4_write(int f,const void*b,size_t n){ssize_t r=write(f,b,n);ADD(4,1);if(r>0){ADD(5,r);}return r;}
ssize_t a4_readv(int f,const struct iovec*v,int n){ssize_t r=readv(f,v,n);ADD(6,1);if(r>0){ADD(7,r);}return r;}
ssize_t a4_writev(int f,const struct iovec*v,int n){ssize_t r=writev(f,v,n);ADD(8,1);if(r>0){ADD(9,r);}return r;}
int a4_poll(struct pollfd *p,nfds_t n,int t){ADD(10,1);int r=poll(p,n,t);ADD(11,1);return r;}
int a4_kevent(int f,const struct kevent*c,int n,struct kevent*e,int k,const struct timespec*t){ADD(12,1);int r=kevent(f,c,n,e,k,t);if(r>0){ADD(13,r);}return r;}
int a4_kevent64(int f,const struct kevent64_s*c,int n,struct kevent64_s*e,int k,unsigned int flags,const struct timespec*t){ADD(14,1);int r=kevent64(f,c,n,e,k,flags,t);if(r>0){ADD(15,r);}return r;}
#define INTERPOSE(repl,orig) __attribute__((used)) static struct{const void* replacement;const void* replacee;} _i_##orig __attribute__((section("__DATA,__interpose")))={(const void*)repl,(const void*)orig}
INTERPOSE(a4_read,read);INTERPOSE(a4_write,write);INTERPOSE(a4_readv,readv);INTERPOSE(a4_writev,writev);INTERPOSE(a4_poll,poll);INTERPOSE(a4_kevent,kevent);INTERPOSE(a4_kevent64,kevent64);
