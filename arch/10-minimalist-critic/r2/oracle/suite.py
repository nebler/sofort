#!/usr/bin/env python3
import json, pathlib, subprocess, sys
root=pathlib.Path(__file__).resolve().parents[1]
binary=sys.argv[1]
outbase=root/'results'/(sys.argv[2] if len(sys.argv)>2 else '.')
names=['hello','codemode','json-heavy','time-random','loadfile-arrays','codemode-deterministic']
for name in names:
    source=root/(sys.argv[3] if len(sys.argv)>3 else 'workloads')
    args=['--module',name+'.js'] if name in ['codemode','codemode-deterministic','loadfile-arrays'] else [name+'.js']
    stdin=source/('codemode.stdin' if name.startswith('codemode') else 'empty.stdin')
    subprocess.run([str(root/'oracle/run.sh'),binary,str(source),str(outbase/name),str(stdin),*args],check=True,timeout=60)
rows=[dict(name=name,**json.loads((outbase/name/'meta.json').read_text())) for name in names]
union=sorted(set().union(*(r['syscalls'] for r in rows)))
summary={'workloads':rows,'union':union,'count':len(union)}
(outbase/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
