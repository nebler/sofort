#!/usr/bin/env python3
"""Measured macOS inputs; every Linux extrapolation is explicitly conditional."""
import json, math
from pathlib import Path
p=Path(__file__).parent
raw=json.loads((p/'results/refill-r2.json').read_text())['runs']
c4=[r for r in raw if r['concurrency']==4]
cpu=max(r['children_cpu_ms_vm'] for r in c4) # conservative observed pass, not statistical confidence bound
p99=max(r['latency_ms']['p99'] for r in c4)/1000
refill=min(r['completed_vms_s'] for r in c4)
rows=[]
for host,cores,slots,W in [('macOS available slots at test',12,117,1),('Linux c7g.metal projected',60,2048,1),('Linux c7g.metal projected long waits',60,2048,10)]:
    linux=host.startswith('Linux');busy=4 if not linux else 64;burst=32
    cpu_bound=.7*cores/((cpu+10)/1000) # 10ms execution workload added to measured trivial qjs startup
    occupancy=(slots-burst-busy)/(W+p99)
    rate=min(cpu_bound,occupancy,refill*.7) if not linux else min(cpu_bound,occupancy)
    rows.append(dict(host=host,status='UNVERIFIED projection' if linux else 'conditional capacity estimate, not sustained mixed workload measurement',cores=cores,vm_slots=slots,execution_cpu_ms_assumed=10,mean_wall_s_assumed=W,build_reservations=busy,burst_reserve=burst,ready_at_rate=math.ceil(rate*p99)+burst,cpu_upper_eps=cpu_bound,occupancy_upper_eps=occupancy,refill_upper_eps='UNVERIFIED Linux' if linux else refill,estimated_eps=math.floor(rate),linux_condition='requires measured KVM replacement >= estimated_eps, G1, broker and mixed-workload validation' if linux else '02 macOS G1 passed; mixed-workload validation and RAM reservations still required; slots change with other VM users'))
out={'measured_mac_refill_cpu_ms_vm_conservative':cpu,'measured_mac_refill_p99_s':p99,'measured_mac_c4_refill_vms_s_conservative':refill,'scope':'child getrusage excludes Python broker and work charged outside VMM. Linux CPU is a Mac-input sensitivity scenario, not portable measurement.','scenarios':rows}
(p/'results/capacity.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
