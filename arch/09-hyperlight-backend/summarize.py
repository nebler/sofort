import json, math, statistics, sys
from collections import defaultdict
rows=[json.loads(line) for line in open(sys.argv[1]) if line.startswith('{')]
groups=defaultdict(list)
for r in rows:
    if 'ns' in r:
        # Preserve true first creation separately; discard only ten warm-call warmups.
        if r['metric'] in ('add','host','batch','await') and r['i']<10: continue
        groups[r['metric']].append(r['ns']/1000)
for key, vals in groups.items():
    v=sorted(vals)
    print(f'{key}: n={len(v)} median={statistics.median(v):.3f} us p90={v[math.ceil(.9*len(v))-1]:.3f} us')
mem=[r for r in rows if r['metric']=='memory' and 'iteration' not in r]
if mem:
    for key in ('rss','footprint','wired'):
        # First sandbox includes one-time HVF/code costs. Later 31 marginal increments.
        d=[(b[key]-a[key])/1048576 for a,b in zip(mem[1:],mem[2:])]
        print(f'{key}: baseline={mem[0][key]/1048576:.3f} MiB first={mem[1][key]/1048576:.3f} MiB '
              f'last={mem[-1][key]/1048576:.3f} MiB marginal n={len(d)} '
              f'median={statistics.median(d):.3f} p90={sorted(d)[math.ceil(.9*len(d))-1]:.3f} MiB')

fresh=[r for r in rows if r['metric']=='memory' and 'iteration' in r]
if fresh:
    base={r['iteration']:r for r in fresh if r['n']==0}
    for key in ('rss','footprint'):
        d=[(r[key]-base[r['iteration']][key])/1048576 for r in fresh if r['n']==1]
        totals=[r[key]/1048576 for r in fresh if r['n']==1]
        print(f'{key}: fresh n={len(d)} delta median={statistics.median(d):.3f} '
              f'p90={sorted(d)[math.ceil(.9*len(d))-1]:.3f} MiB '
              f'total median={statistics.median(totals):.3f} MiB')
