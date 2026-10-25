#!/usr/bin/env python3
"""Published marginal prices, no free tiers; host dollars/hour is a scenario input."""
import json, math
n=1_000_000; cpu_ms=10; wall_s=1; host_hour=2.32
print(json.dumps({
 'assumptions':dict(executions=n,cpu_ms=cpu_ms,wall_s=wall_s,host_hour_UNVERIFIED=host_hour),
 'jitk_or_firecracker_host_only_1000eps':host_hour*n/(3600*1000),
 'jitk_or_firecracker_host_only_100eps':host_hour*n/(3600*100),
 'jitk_or_firecracker_host_only_198_2eps':host_hour*n/(3600*198.2),
 'cloudflare_reused_one_code_and_id_day':.002+.30+.02*cpu_ms,
 'cloudflare_unique_snippet_each_execution':.002*n+.30+.02*cpu_ms,
 'lambda_arm_128mib_one_second':.20+n*.125*wall_s*.0000133334,
 'e2b_1vcpu_1gib_one_second':n*math.ceil(wall_s)*(.000014+.0000045),
 'e2b_default_2vcpu_4gib_one_second':n*math.ceil(wall_s)*(2*.000014+4*.0000045)
},indent=2))
