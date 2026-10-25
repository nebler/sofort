#include <stdio.h>
#include <unistd.h>
#include <time.h>
#include <mach/mach_time.h>
#ifdef KRUN
#include <libkrun.h>
#endif
int main(int argc,char**argv){
 uint64_t raw=clock_gettime_nsec_np(CLOCK_MONOTONIC_RAW),t=mach_absolute_time();mach_timebase_info_data_t b;mach_timebase_info(&b);
 printf("MAIN %llu %llu\n",(unsigned long long)raw,(unsigned long long)(t*b.numer/b.denom));
#ifdef KRUN
 if(argc==17){KrunError e=NULL;krun_init_log(-1,KRUN_LOG_LEVEL_OFF,KRUN_LOG_STYLE_AUTO,0,&e);}
#endif
 return 0;
}
