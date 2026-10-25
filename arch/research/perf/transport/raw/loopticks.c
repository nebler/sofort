#include <node_api.h>
#include <uv.h>
#include <stdint.h>
#include <dlfcn.h>
static uv_prepare_t watcher;static uint64_t ticks=0;
static void prepare(uv_prepare_t *h){ticks++;}
static napi_value read_ticks(napi_env env,napi_callback_info info){napi_value out;napi_create_double(env,(double)ticks,&out);return out;}
static napi_value mark(napi_env env,napi_callback_info info){size_t n=1;napi_value a;napi_get_cb_info(env,info,&n,&a,0,0);int32_t x=0;napi_get_value_int32(env,a,&x);void(*f)(int)=dlsym(RTLD_DEFAULT,"a4_sys_mark");if(f)f(x);napi_value out;napi_get_undefined(env,&out);return out;}
static napi_value sys(napi_env env,napi_callback_info info){uint64_t(*f)(int)=dlsym(RTLD_DEFAULT,"a4_sys_get");napi_value out;napi_create_array_with_length(env,24,&out);for(int i=0;i<24;i++){napi_value v;napi_create_double(env,f?(double)f(i):-1,&v);napi_set_element(env,out,i,v);}return out;}
static napi_value init(napi_env env,napi_value exports){uv_loop_t *loop;napi_get_uv_event_loop(env,&loop);uv_prepare_init(loop,&watcher);uv_prepare_start(&watcher,prepare);uv_unref((uv_handle_t*)&watcher);napi_value f;napi_create_function(env,"ticks",5,read_ticks,0,&f);napi_set_named_property(env,exports,"ticks",f);napi_create_function(env,"mark",4,mark,0,&f);napi_set_named_property(env,exports,"mark",f);napi_create_function(env,"sys",3,sys,0,&f);napi_set_named_property(env,exports,"sys",f);return exports;}
NAPI_MODULE(NODE_GYP_MODULE_NAME,init)
