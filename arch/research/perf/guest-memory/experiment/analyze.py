#!/usr/bin/env python3
"""Offline census analysis: 4 KiB guest first writes and 16 KiB host-page projection."""
import json,re,statistics,sys
from pathlib import Path
root=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/sofort-a1/raw')
ranges=[('kernel',0x80000000,0x80080000),('payload_rw',0x80080000,0x80300000),('brk',0x80300000,0x80480000),('mmap',0x80480000,0x81a80000),('user_stack',0x81c60000,0x81c80000)]
allrows=[]
for variant in ['final-census','final-nozero']:
 d=root/variant
 for f in sorted(d.glob('*.stdout.txt')):
  phases={}
  for line in f.read_bytes().splitlines():
   if not line.startswith(b'\x1eaudit '):continue
   s=line.decode();page_text=s.split(' pages=')[1];pages={int(v,16) for v in page_text.split(',') if v}
   phase=s.split()[1];fields={k:int(v,16) for k,v in re.findall(r'(\w+)=([0-9a-f]+)',s.split(' pages=')[0])}
   phases[phase]=(pages,fields)
  assert set(phases)=={'ready','done','exit'},(f,phases.keys())
  for phase in ['ready','done','exit','ready_to_exit']:
   pages,fields=phases[phase] if phase!='ready_to_exit' else (phases['done'][0]|phases['exit'][0],phases['done'][1])
   row={'variant':variant,'case':f.name.split('-')[0],'file':f.name,'phase':phase,'bytes4k':len(pages)*4096,'bytes16k':len({x//16384 for x in pages})*16384,'fields':fields,'categories':{}}
   for name,lo,hi in ranges:
    ps={x for x in pages if lo<=x<hi};row['categories'][name]={'bytes4k':len(ps)*4096,'bytes16k':len({x//16384 for x in ps})*16384,'pages':sorted(hex(x) for x in ps)}
   assert sum(c['bytes4k'] for c in row['categories'].values())==row['bytes4k']
   allrows.append(row)
(root/'samples.json').write_text(json.dumps(allrows,indent=2)+'\n')
summary=[]
for variant in ['final-census','final-nozero']:
 for case in ['return2','one_tool']:
  for phase in ['ready','done','exit','ready_to_exit']:
   rows=[r for r in allrows if r['variant']==variant and r['case']==case and r['phase']==phase]
   if not rows:continue
   q={'variant':variant,'case':case,'phase':phase,'n':len(rows)}
   for key in ['bytes4k','bytes16k']:
    vs=[r[key] for r in rows];q[key]={'min':min(vs),'median':statistics.median(vs),'max':max(vs)}
   q['category_values']={name:{key:sorted({r['categories'][name][key] for r in rows}) for key in ['bytes4k','bytes16k']} for name,_,_ in ranges}
   q['field_values']={key:sorted({r['fields'][key] for r in rows}) for key in rows[0]['fields']}
   summary.append(q)
(root/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
for q in summary:print(q['variant'],q['case'],q['phase'],q['n'],q['bytes4k'],q['bytes16k'],q['field_values'])
