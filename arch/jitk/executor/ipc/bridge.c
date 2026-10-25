// Linux-only, N-API stable ABI. Never expose the writable mmap to JavaScript.
#define _GNU_SOURCE
#include <node_api.h>
#include <uv.h>
#include <stdatomic.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>
#include <fcntl.h>
#include <sys/mman.h>
#include <sys/eventfd.h>
#include <time.h>

#define CAP 64u
#define PAYLOAD 16384u
#define RECORD (32u + PAYLOAD)
#define REGION (CAP * RECORD)
#define BYTES (4096u + 2u * REGION)
_Static_assert(ATOMIC_LLONG_LOCK_FREE == 2, "IPC requires lock-free u64 atomics");
typedef struct {
  napi_env env;
  napi_ref callback, self;
  uv_poll_t poll;
  int fd[3], closed;
  uint8_t *mem;
  uint64_t tx, peer, rx;
} Bridge;
static napi_value fail(napi_env env, const char *message) {
  napi_throw_error(env, "SHARD_IPC", message); return NULL;
}
static napi_value undefined(napi_env env) {
  napi_value v; napi_get_undefined(env, &v); return v;
}
static uint32_t word(const uint8_t *p) { uint32_t v; memcpy(&v,p,4); return v; }
static _Atomic uint64_t *cursor(Bridge *b, size_t off) { return (_Atomic uint64_t *)(b->mem+off); }
static void signal_peer(Bridge *b) {
  uint64_t one=1; ssize_t n;
  do { n=write(b->fd[1], &one, 8); } while(n<0 && errno==EINTR);
  // EAGAIN means a wake is already pending; other errors are detected by the child lifecycle.
}
static Bridge *receiver(napi_env env, napi_callback_info info, size_t *argc, napi_value *args) {
  napi_value self; Bridge *b=NULL;
  napi_get_cb_info(env,info,argc,args,&self,NULL); napi_unwrap(env,self,(void **)&b);
  if(!b || b->closed) { fail(env,"closed shared-memory endpoint"); return NULL; }
  return b;
}
static napi_value send_record(napi_env env, napi_callback_info info) {
  napi_value arg, out; size_t argc=1,n=0; void *data=NULL;
  Bridge *b=receiver(env,info,&argc,&arg); if(!b)return NULL;
  if(argc!=1)return fail(env,"IPC send requires Buffer");
  bool buffer=false; napi_is_buffer(env,arg,&buffer);
  if(!buffer)return fail(env,"IPC send requires Buffer");
  napi_get_buffer_info(env,arg,&data,&n);
  const uint8_t *p=data;
  if(n<32 || n>RECORD || word(p+20)!=n-32 || word(p+24) || word(p+28))return fail(env,"invalid local IPC record");
  uint64_t consumed=atomic_load_explicit(cursor(b,128),memory_order_acquire);
  if(consumed<b->peer || consumed>b->tx || b->tx-consumed>CAP || b->tx==UINT64_MAX)return fail(env,"invalid peer IPC consumer");
  b->peer=consumed;
  bool ok=b->tx-consumed<CAP;
  if(ok) {
    uint8_t *slot=b->mem+4096+(b->tx%CAP)*RECORD;
    memcpy(slot,p,n); // length is private and checked; unpublished bytes are irrelevant
    atomic_store_explicit(cursor(b,64),++b->tx,memory_order_release);
    signal_peer(b);
  }
  napi_get_boolean(env,ok,&out); return out;
}
static napi_value drain(napi_env env, napi_callback_info info) {
  size_t argc=0; Bridge *b=receiver(env,info,&argc,NULL); if(!b)return NULL;
  napi_value out; napi_create_array(env,&out);
  uint64_t produced=atomic_load_explicit(cursor(b,192),memory_order_acquire);
  if(produced<b->rx || produced-b->rx>CAP)return fail(env,"invalid peer IPC producer");
  uint32_t count=0;
  while(b->rx<produced) {
    // Copy the entire bounded slot before interpreting any hostile field (TOCTOU safe).
    uint8_t copy[RECORD];
    memcpy(copy,b->mem+4096+REGION+(b->rx%CAP)*RECORD,RECORD);
    uint32_t n=word(copy+20);
    if(n>PAYLOAD || word(copy+24) || word(copy+28))return fail(env,"invalid peer IPC record");
    napi_value bytes; napi_create_buffer_copy(env,32+n,copy,NULL,&bytes);
    napi_set_element(env,out,count++,bytes); b->rx++;
  }
  if(count) { atomic_store_explicit(cursor(b,256),b->rx,memory_order_release); signal_peer(b); }
  return out;
}
static void poll_closed(uv_handle_t *handle) {
  Bridge *b=handle->data;
  napi_delete_reference(b->env,b->callback); napi_delete_reference(b->env,b->self);
}
static void shutdown_bridge(Bridge *b) {
  if(b->closed)return;
  b->closed=1; uv_poll_stop(&b->poll); uv_close((uv_handle_t *)&b->poll,poll_closed);
  for(int i=0;i<3;i++)close(b->fd[i]);
  munmap(b->mem,BYTES);
}
static napi_value close_bridge(napi_env env,napi_callback_info info) {
  napi_value self; size_t argc=0; Bridge *b=NULL;
  napi_get_cb_info(env,info,&argc,NULL,&self,NULL); napi_unwrap(env,self,(void **)&b);
  if(b)shutdown_bridge(b);
  return undefined(env);
}
static void finalize(napi_env env,void *data,void *hint) { (void)env; (void)hint; free(data); }
static void readable(uv_poll_t *poll,int status,int events) {
  Bridge *b=poll->data; (void)events;
  uint64_t count; ssize_t n;
  do { n=read(b->fd[2],&count,8); } while(n<0 && errno==EINTR);
  napi_handle_scope scope; napi_open_handle_scope(b->env,&scope);
  napi_value callback,global,out;
  napi_get_reference_value(b->env,b->callback,&callback); napi_get_global(b->env,&global);
  if(status<0)napi_throw_error(b->env,"SHARD_IPC","eventfd poll failed");
  else napi_call_function(b->env,global,callback,0,NULL,&out);
  napi_close_handle_scope(b->env,scope);
}
static napi_value now(napi_env env,napi_callback_info info) {
  (void)info; struct timespec ts; clock_gettime(CLOCK_MONOTONIC,&ts);
  napi_value out; napi_create_bigint_uint64(env,(uint64_t)ts.tv_sec*1000000000ull+ts.tv_nsec,&out); return out;
}
static napi_value create(napi_env env,napi_callback_info info) {
  size_t argc=1; napi_value callback,self; napi_get_cb_info(env,info,&argc,&callback,NULL,NULL);
  if(argc!=1)return fail(env,"IPC create requires callback");
  napi_valuetype type; napi_typeof(env,callback,&type);
  if(type!=napi_function)return fail(env,"IPC create requires callback");
  Bridge *b=calloc(1,sizeof(*b)); if(!b)return fail(env,"IPC allocation failed");
  b->env=env; for(int i=0;i<3;i++)b->fd[i]=-1;
  b->fd[0]=memfd_create("jitk-policy",MFD_CLOEXEC|MFD_ALLOW_SEALING);
  b->fd[1]=eventfd(0,EFD_CLOEXEC|EFD_NONBLOCK); b->fd[2]=eventfd(0,EFD_CLOEXEC|EFD_NONBLOCK);
  if(b->fd[0]<0 || b->fd[1]<0 || b->fd[2]<0 || ftruncate(b->fd[0],BYTES) ||
     fcntl(b->fd[0],F_ADD_SEALS,F_SEAL_SHRINK|F_SEAL_GROW|F_SEAL_SEAL)<0)goto error;
  b->mem=mmap(NULL,BYTES,PROT_READ|PROT_WRITE,MAP_SHARED,b->fd[0],0);
  if(b->mem==MAP_FAILED)goto error;
  uv_loop_t *loop; napi_get_uv_event_loop(env,&loop);
  if(uv_poll_init(loop,&b->poll,b->fd[2])) { munmap(b->mem,BYTES); goto error; }
  b->poll.data=b;
  napi_create_object(env,&self); napi_wrap(env,self,b,finalize,NULL,NULL);
  napi_create_reference(env,callback,1,&b->callback); napi_create_reference(env,self,1,&b->self);
  napi_property_descriptor methods[]={
    {"send",NULL,send_record,NULL,NULL,NULL,napi_default,NULL},
    {"drain",NULL,drain,NULL,NULL,NULL,napi_default,NULL},
    {"close",NULL,close_bridge,NULL,NULL,NULL,napi_default,NULL}};
  napi_define_properties(env,self,3,methods);
  napi_value fds; napi_create_array_with_length(env,3,&fds);
  for(uint32_t i=0;i<3;i++) { napi_value v; napi_create_int32(env,b->fd[i],&v); napi_set_element(env,fds,i,v); }
  napi_set_named_property(env,self,"fds",fds);
  uv_poll_start(&b->poll,UV_READABLE,readable);
  return self;
error:
  for(int i=0;i<3;i++)if(b->fd[i]>=0)close(b->fd[i]);
  free(b);
  return fail(env,"cannot create sealed shared-memory queues");
}
NAPI_MODULE_INIT() {
  napi_property_descriptor methods[]={
    {"create",NULL,create,NULL,NULL,NULL,napi_default,NULL},
    {"now",NULL,now,NULL,NULL,NULL,napi_default,NULL}};
  napi_define_properties(env,exports,2,methods); return exports;
}
