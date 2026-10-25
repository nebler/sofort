from measure import one
import random
configs=[('O2','default'),('O2','gc-before'),('O2','no-gc'),('O2','gc-before,no-gc'),('O2','bump'),('O2','bump,detach'),('O2','bytecode'),('Os','default'),('minimal','minimal')]
rng=random.Random(20261025)
for round in range(3):
    jobs=[(b,opt,w) for b,opt in configs for w in ['one_tool','json64k','json1m']]
    rng.shuffle(jobs)
    for b,opt,w in jobs:
        one(b,'cpu',w,20,opt,f'interleaved-{round}-{b}-{opt.replace(",","-")}-{w}-cpu')
