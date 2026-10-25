#!/usr/bin/env python3
"""All fleet inputs are scenario assumptions, not Linux benchmark measurements."""
import argparse, json, math
p=argparse.ArgumentParser()
p.add_argument('--rate',type=float,default=1000)
p.add_argument('--wall',type=float,default=1)
p.add_argument('--cpu-ms',type=float,default=15)
p.add_argument('--boot-ms',type=float,default=10)
p.add_argument('--replenish-window',type=float,default=.02)
p.add_argument('--burst',type=int,default=32)
p.add_argument('--host-hour',type=float,default=2.32)
a=p.parse_args()
cores=60; mem_mib=112*1024; guest=32; overhead=8
idle=max(64,math.ceil(a.rate*a.replenish_window+3*math.sqrt(a.rate*a.replenish_window))+a.burst)
active=a.rate*a.wall
cpu_ceiling=cores*.7/(a.cpu_ms/1000)
mem_ceiling=(min(2048,mem_mib//(guest+overhead))-idle)/a.wall
sustainable=min(cpu_ceiling,mem_ceiling) # ALSO bounded by unmeasured VM construction throughput
print(json.dumps(dict(assumptions=vars(a),idle_target=idle,active_mean=active,mean_vms=active+idle,
    mean_reserved_gib=(active+idle)*(guest+overhead)/1024,refill_parallelism=math.ceil(a.rate*a.boot_ms/1000),
    cpu_upper_eps=cpu_ceiling,memory_upper_eps=mem_ceiling,
    scenario_upper_eps=sustainable,construction_bound='UNVERIFIED',
    host_dollars_million_at_requested_rate=a.host_hour*1e6/(a.rate*3600),
    host_dollars_million_with_25pct_spare=a.host_hour*1.25*1e6/(a.rate*3600)),indent=2))
