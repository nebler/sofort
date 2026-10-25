#!/usr/bin/env python3
"""Paired bootstrap CIs are descriptive of these 30 interleaved local blocks."""
import json,math,random,statistics
from pathlib import Path
P=Path(__file__).resolve().parent
rows=[json.loads(s) for s in (P/'raw.jsonl').read_text().splitlines()]
def q(a):
    s=sorted(a)
    return {'n':len(s),'median':statistics.median(s),'p90':s[math.ceil(.9*len(s))-1],'p99':s[math.ceil(.99*len(s))-1]}
out=[]
for case in sorted(set(r['case'] for r in rows)):
    a=sorted([r for r in rows if r['case']==case and r['mode']=='jitk-cold'],key=lambda r:r['iteration'])
    if not a:continue
    for mode in ['hl-strict','hl-fresh-inprocess','hl-snapshot-logical']:
        b=sorted([r for r in rows if r['case']==case and r['mode']==mode],key=lambda r:r['iteration'])
        av=[r['latency_ms'] for r in a];bv=[r['latency_ms'] for r in b]
        assert len(av)==len(bv)==30
        rng=random.Random(9009);diff=[];ratio=[]
        for _ in range(10000):
            idx=[rng.randrange(30) for _ in range(30)]
            am=statistics.median(av[i] for i in idx);bm=statistics.median(bv[i] for i in idx)
            diff.append(am-bm);ratio.append(am/bm)
        diff.sort();ratio.sort()
        lo,hi=diff[249],diff[9749]
        out.append({'case':case,'mode':mode,'jitk_ms':statistics.median(av),
            'other_ms':statistics.median(bv),'jitk_minus_other_ms':statistics.median(av)-statistics.median(bv),
            'difference_95ci_ms':[lo,hi],'jitk_over_other_ratio':statistics.median(av)/statistics.median(bv),
            'ratio_95ci':[ratio[249],ratio[9749]],'local_winner':'jitk' if hi<0 else mode if lo>0 else 'inconclusive'})
(P/'verdict.json').write_text(json.dumps(out,indent=2)+'\n')
memory=[]
for mode,case in sorted(set((r['mode'],r['case']) for r in rows)):
    a=[r for r in rows if (r['mode'],r['case'])==(mode,case)]
    memory.append({'mode':mode,'case':case,
        'baseline_footprint_mib':q([r['memory_baseline_bytes']['footprint']/2**20 for r in a]),
        'increment_footprint_mib':q([r['memory_increment_bytes']['footprint']/2**20 for r in a]),
        'increment_rss_mib':q([r['memory_increment_bytes']['rss']/2**20 for r in a]),
        'observed_sample_gap_us':q([r['memory_max_sample_gap_us'] for r in a])})
(P/'memory-details.json').write_text(json.dumps(memory,indent=2)+'\n')
for r in out:
    if r['mode']=='hl-strict':print(r['case'],r['local_winner'],round(r['jitk_minus_other_ms'],3),[round(x,3) for x in r['difference_95ci_ms']])
