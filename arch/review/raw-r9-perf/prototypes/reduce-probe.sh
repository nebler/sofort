#!/bin/sh
# R9: medians of r9-vmprobe JSONL files. Usage: reduce-probe.sh FILE... (one mode per call)
cat "$@" | jq -s -c '{mode:.[0].mode, case:.[0].case, n:length,
  cpu_ms:(map((.utime_us+.stime_us)/1000)|sort|.[length/2|floor]),
  user_ms:(map(.utime_us/1000)|sort|.[length/2|floor]),
  sys_ms:(map(.stime_us/1000)|sort|.[length/2|floor]),
  minflt:(map(.minflt)|sort|.[length/2|floor]),
  ready_or_waitgo_ms:(map(.ready_ns//.wait_go_ns//0)|sort|.[length/2|floor]/1e6),
  done_ms:(map(.done_ns//0)|sort|.[length/2|floor]/1e6),
  reaped_ms:(map(.reaped_ns)|sort|.[length/2|floor]/1e6),
  mac_main_thread_ms:(map([.threads[]|select(.name=="main")|((.user_ns//0)+(.sys_ns//0))/1e6]|add//0)|sort|.[length/2|floor]),
  mac_vcpu_thread_ms:(map([.threads[]|select(.name|startswith("fc_vcpu"))|((.user_ns//0)+(.sys_ns//0))/1e6]|add//0)|sort|.[length/2|floor]),
  linux_vcpu_ticks:(map([.threads[]|select(.name|startswith("fc_vcpu"))|((.utime_ticks//"0"|tonumber)+(.stime_ticks//"0"|tonumber))]|add//0)|sort|.[length/2|floor]),
  mac_footprint_mib:(map(.footprint_or_private_dirty)|sort|.[length/2|floor]/1048576)}'
