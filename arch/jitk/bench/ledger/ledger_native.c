/* Offline instrumentation only. Node-API is ABI stable; no runtime helper process. */
#include <node_api.h>
#include <sys/resource.h>
#include <stdint.h>
#include <unistd.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#ifdef __APPLE__
#include <libproc.h>
#include <mach/mach_time.h>
#endif
static void number(napi_env e,napi_value o,const char *k,double x) {
  napi_value v; napi_create_double(e,x,&v); napi_set_named_property(e,o,k,v);
}
static napi_value usage(napi_env e,napi_callback_info info) {
  size_t n=1; napi_value a[1],o; int32_t pid=0;
  napi_get_cb_info(e,info,&n,a,0,0); if(n)napi_get_value_int32(e,a[0],&pid);
  napi_create_object(e,&o);
#ifdef __APPLE__
  struct rusage_info_v4 r={0};
  if(proc_pid_rusage(pid,RUSAGE_INFO_V4,(rusage_info_t *)&r))return o;
  mach_timebase_info_data_t tb; mach_timebase_info(&tb);
  double scale=(double)tb.numer/tb.denom/1e6;
  number(e,o,"user_ms",r.ri_user_time*scale); number(e,o,"system_ms",r.ri_system_time*scale);
  number(e,o,"footprint",r.ri_phys_footprint);number(e,o,"rss",r.ri_resident_size);
  number(e,o,"footprint_peak",r.ri_lifetime_max_phys_footprint);
  number(e,o,"user_ticks",r.ri_user_time);number(e,o,"system_ticks",r.ri_system_time);
#else
  char path[80],buf[4096];snprintf(path,sizeof(path),"/proc/%d/stat",pid);
  FILE *f=fopen(path,"r");if(!f)return o;
  if(!fgets(buf,sizeof(buf),f)){fclose(f);return o;}fclose(f);
  char *rest=strrchr(buf,')');if(!rest)return o;rest+=2;
  char *save=0,*token=strtok_r(rest," ",&save);int i=0;
  for(;token;token=strtok_r(0," ",&save),i++) {
    if(i==11)number(e,o,"user_ms",strtod(token,0)*1000./sysconf(_SC_CLK_TCK));
    if(i==12)number(e,o,"system_ms",strtod(token,0)*1000./sysconf(_SC_CLK_TCK));
    if(i==21)number(e,o,"rss",strtod(token,0)*sysconf(_SC_PAGESIZE));
  }
#endif
  return o;
}
static napi_value ru(napi_env e,napi_callback_info info) {
  size_t n=1;napi_value a[1],o;int32_t children=0;struct rusage r;
  napi_get_cb_info(e,info,&n,a,0,0);if(n)napi_get_value_int32(e,a[0],&children);
  getrusage(children?RUSAGE_CHILDREN:RUSAGE_SELF,&r);napi_create_object(e,&o);
  number(e,o,"user_ms",r.ru_utime.tv_sec*1000.+r.ru_utime.tv_usec/1000.);
  number(e,o,"system_ms",r.ru_stime.tv_sec*1000.+r.ru_stime.tv_usec/1000.);
  return o;
}
NAPI_MODULE_INIT() {
  napi_value f;napi_create_function(env,"usage",NAPI_AUTO_LENGTH,usage,0,&f);napi_set_named_property(env,exports,"usage",f);
  napi_create_function(env,"rusage",NAPI_AUTO_LENGTH,ru,0,&f);napi_set_named_property(env,exports,"rusage",f);
  return exports;
}
