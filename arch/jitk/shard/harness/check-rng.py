#!/usr/bin/env python3
"""Offline restore RNG gate; accepts both old/new rng_negative fixtures."""
import json, math, pathlib, statistics, sys

path=pathlib.Path(sys.argv[1])
rows=[json.loads(s) for s in path.read_text().splitlines()]
samples=[r for r in rows if r['event']=='sample']
summary=next(r for r in rows if r['event']=='summary')
canary=summary['fixture']=='canary'
values=[r['result']['ok'][2] if canary else r['result']['ok'] for r in samples]
n=len(values)
ordered=sorted(values)
ks=max(max((i+1)/n-x,x-i/n) for i,x in enumerate(ordered))
mean=statistics.mean(values)
variance=statistics.pvariance(values)
bins=[sum(i/20<=v<(i+1)/20 for v in values) for i in range(20)]
chi2=sum((b-n/20)**2/(n/20) for b in bins)
serial=sum((a-mean)*(b-mean) for a,b in zip(values,values[1:]))/sum((a-mean)**2 for a in values) if variance else 1
checks=dict(complete=n==summary['n'],distinct=len(set(values))==n,
            range=all(0<=x<1 for x in values),
            fresh_host_entropy=summary['fresh_entropy_count']==n,
            math_summary=summary['math_random_distinct']==len(set(values)))
if n>=1000:
    # Conservative predeclared sanity thresholds, not a cryptographic test.
    checks.update(ks=ks<1.95/math.sqrt(n),mean=abs(mean-.5)<5/math.sqrt(12*n),
                  variance=abs(variance-1/12)<.01,chi_square=chi2<60,
                  serial_correlation=abs(serial)<5/math.sqrt(n))
if canary:
    checks.update(libc_distinct=len({r['result']['ok'][3] for r in samples})==n,
                  saved_function_distinct=len({r['result']['ok'][4] for r in samples})==n,
                  entropy_distinct=len({r['result']['ok'][1] for r in samples})==n,
                  generations_distinct=len({r['result']['ok'][0] for r in samples})==n,
                  libc_summary=summary['libc_random_distinct']==n)
result=dict(path=str(path),n=n,distinct=len(set(values)),mean=mean,variance=variance,
            ks=ks,chi_square_19df=chi2,bins=bins,serial_correlation=serial,checks=checks,
            summary=summary,passed=all(checks.values()))
print(json.dumps(result,indent=2))
sys.exit(0 if result['passed'] else 1)
