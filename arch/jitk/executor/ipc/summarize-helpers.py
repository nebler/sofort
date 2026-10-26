"""Reduce measure-helpers.py receipts: python3 summarize-helpers.py RAW_ROOT."""
import json,pathlib,re,statistics,sys
root=pathlib.Path(sys.argv[1]);output={}
def slope(rows,key):
    xm=statistics.mean(x['n'] for x in rows);ym=statistics.mean(x[key] for x in rows)
    return sum((x['n']-xm)*(x[key]-ym) for x in rows)/sum((x['n']-xm)**2 for x in rows)
for phase in ['before','after']:
    rows=[]
    for p in sorted((root/'kvm'/phase).glob('[01]-*.json')):
        d=json.loads(p.read_text());pid=str(d['events'][0]['shard']);samples=d['samples']
        stat=[dict((k,int(v)) for k,v in (line.split() for line in x['memory_stat'].splitlines())) for x in samples]
        rows.append(dict(n=d['n'],rep=d['rep'],
          privateKiB=statistics.median(int(re.search(r'Private_Dirty:\s+(\d+)',x['smaps'][pid])[1]) for x in samples),
          cgroupKiB=statistics.median(x['memory_current']/1024 for x in samples),
          kernelKiB=statistics.median(x['kernel']/1024 for x in stat)))
    slopes={str(rep):{key:slope([x for x in rows if x['rep']==rep],key) for key in ['privateKiB','cgroupKiB','kernelKiB']} for rep in [0,1]}
    for v in slopes.values():
        v['privatePlusKernelMiB']=(v['privateKiB']+v['kernelKiB'])/1024
        v['allInMiB']=v['cgroupKiB']/1024
    timing=json.loads((root/'kvm'/phase/'timing.jsonl').read_text().splitlines()[1])
    output[phase]=dict(rows=rows,slopes=slopes,timing=timing)
(root/'summary.json').write_text(json.dumps(output,indent=2)+'\n')
