#!/usr/bin/env python3
import json, time, traceback
import ledger as l
data={'label':'NESTED','before':l.system(),'samples':[]}
def test(ram):
    cg=l.mkdircg(f'ram-{ram}-{time.monotonic_ns()}');v=None
    row={'ram_mib':ram,'unix':time.time()}
    try:
        v=l.VM('fc-boot',cg,ram);time.sleep(.2)
        row.update(passed=True,timing=v.timing(),measurement=l.sample([v],cg,1),console=v.out.decode(errors='replace'))
    except Exception as e:
        row.update(passed=False,error=repr(e))
    finally:
        for vm in list(l.LIVE):vm.close()
        row['cgroup_final']=l.cgstate(cg);l.rmcg(cg)
        data['samples'].append(row);l.save(l.D/'raw/fc-ram-search.json',data)
    print(json.dumps({'ram_mib':ram,'passed':row['passed'],'error':row.get('error')}),flush=True)
    return row['passed']
low,high=0,16
while not test(high):
    low,high=high,high*2
    assert high<=128,'small Linux guest did not boot within 128 MiB'
while high-low>1:
    mid=(low+high)//2
    if test(mid):high=mid
    else:low=mid
data['minimum_booted_integer_mib']=high
for _ in range(2):assert test(high)
if low:
    for _ in range(2):assert not test(low)
data['after']=l.system();l.save(l.D/'raw/fc-ram-search.json',data)
(l.D/'bin/fc-ram-mib').write_text(str(high)+'\n')
print(f'MINIMUM_RAM_MIB={high}',flush=True)
