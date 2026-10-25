#!/usr/bin/env python3
import json,pathlib,census
R=census.R;(R/'raw/profiles').mkdir(exist_ok=True)
w=json.loads((R/'raw/rg/native.json').read_text())['workload']
cases=[dict(w,name='profiles/rg-mmap',argv=[a if a!='--no-mmap' else '--mmap' for a in w['argv']]),dict(w,name='profiles/rg-recursive',argv=['--no-config','--color=never','--no-ignore','--no-mmap','-j1','--sort','path','alpha','data'],expected_hex=None)]
for w in cases:census.native(w)
census.dump(R/'raw/extra-workloads.json',cases)
