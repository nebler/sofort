#include <node_api.h>
#include <sys/resource.h>
#include <libproc.h>
#include <mach/mach_time.h>
static napi_value obj(napi_env env,double user,double system){napi_value o,a,b;napi_create_object(env,&o);napi_create_double(env,user,&a);napi_create_double(env,system,&b);napi_set_named_property(env,o,"user",a);napi_set_named_property(env,o,"system",b);return o;}
static napi_value read_usage(napi_env env,napi_callback_info info){struct rusage u;getrusage(RUSAGE_CHILDREN,&u);return obj(env,u.ru_utime.tv_sec*1e6+u.ru_utime.tv_usec,u.ru_stime.tv_sec*1e6+u.ru_stime.tv_usec);}
static napi_value pid_usage(napi_env env,napi_callback_info info){size_t n=1;napi_value args[1];int32_t pid;napi_get_cb_info(env,info,&n,args,0,0);napi_get_value_int32(env,args[0],&pid);struct rusage_info_v0 u;if(proc_pid_rusage(pid,0,(rusage_info_t*)&u)){napi_value x;napi_get_null(env,&x);return x;}mach_timebase_info_data_t tb;mach_timebase_info(&tb);double scale=(double)tb.numer/tb.denom/1000;return obj(env,u.ri_user_time*scale,u.ri_system_time*scale);}
static napi_value clock_now(napi_env env,napi_callback_info info){mach_timebase_info_data_t tb;mach_timebase_info(&tb);napi_value v;napi_create_double(env,(double)mach_absolute_time()*tb.numer/tb.denom/1000,&v);return v;}
static napi_value init(napi_env env,napi_value exports){napi_value f;napi_create_function(env,"children",8,read_usage,0,&f);napi_set_named_property(env,exports,"children",f);napi_create_function(env,"pid",3,pid_usage,0,&f);napi_set_named_property(env,exports,"pid",f);napi_create_function(env,"now",3,clock_now,0,&f);napi_set_named_property(env,exports,"now",f);return exports;}NAPI_MODULE(NODE_GYP_MODULE_NAME,init)
