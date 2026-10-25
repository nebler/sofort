#!/usr/bin/env python3
"""Check raw census consistency and retained artifacts; not a Linux ABI test suite."""
import csv,hashlib,json,pathlib,re,sys
R=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path('/home/dev/r6-census');RAW=R/'raw';j=json.loads((RAW/'summary.json').read_text());rows=j['rows'];checks=[]
def check(name,ok):
 checks.append({'check':name,'pass':bool(ok)})
 if not ok:raise AssertionError(name)
check('32 primary artifact/workload rows',len(rows)==32)
check('31 native workload oracles accepted; only musl DuckDB unavailable',sum(r['native_ok'] for r in rows)==31 and [r['name'] for r in rows if not r['native_ok']]==['duckdb'])
check('Git child exec stays in syscall inventory', 'execve' in next(r for r in rows if r['name']=='git-shell')['syscalls'])
check('25 executable static reference rows',sum(r['native_ok'] and not r['interpreter'] for r in rows)==25)
check('15 current-kernel baseline runs',sum(r['jitk']['status']=='ran' for r in rows)==15)
check('9 exact-output guest successes',sum(r['jitk'].get('runs_today',False) for r in rows)==9)
for r in rows:
 d=RAW/r['name'];n=json.loads((d/'native.json').read_text());w=n['workload'];check(r['name']+' two trace-mode stdout match',n['stdout_same'])
 for mode in ('full','count'):
  check(r['name']+' '+mode+' trace exists',bool((d/(mode+'.strace')).read_text()))
  check(r['name']+' '+mode+' no timeout',not json.loads((d/(mode+'.json')).read_text())['timeout'])
 check(r['name']+' no header counted as syscall','syscall' not in r['syscalls'])
 p=pathlib.Path(w['binary'])
 if p.exists():check(r['name']+' retained binary SHA256',hashlib.sha256(p.read_bytes()).hexdigest()==r['sha256'])
 k=r['jitk']
 if k['status']=='ran':
  b=(d/'jitk.stdout').read_bytes();rs=[]
  for line in b.split(b'\n'):
   if b'\x1e' in line:
    try:rs.append(json.loads(line.split(b'\x1e',1)[1]))
    except ValueError:pass
  done=[x['code'] for x in rs if x.get('kind')=='done']
  check(r['name']+' recorded guest exit matches raw',(done[-1] if done else None)==k['guest_exit'])
  check(r['name']+' sandbox ack',k['sandbox_ack'] and (d/'jitk.stderr').read_bytes()==b'{"sandbox":"ok"}\n')
  if k.get('runs_today'):check(r['name']+' output match and guest exit0',k['native_stdout_equal'] and k['guest_exit']==0 and not k['timeout'])
  image=R/'images'/r['name']/'kernel.bin'
  if image.exists():check(r['name']+' retained image SHA256',hashlib.sha256(image.read_bytes()).hexdigest()==k['kernel_sha256'])
s=json.loads((RAW/'sensitivity.json').read_text());check('36 real ENOSYS sensitivity injections',len(s)==36 and all(x['injected'] for x in s));check('injections bounded',all(not x['timeout'] for x in s))
for n in ('rg','fd'):
 b=(RAW/n/'wide.stdout').read_bytes();check(n+' wide diagnostic really reaches Rust SIGPIPE assertion',b'666174616c2072756e74696d65206572726f72' in b and b'\x1eFAULT' in b)
for n in ('rg-mmap','rg-recursive'):
 n=json.loads((RAW/'profiles'/n/'native.json').read_text());check(n['workload']['name']+' accepted native oracle',n['oracle_ok'] and n['stdout_same'])
check('explicit rg MAP_SHARED file mapping',bool(re.search(r'mmap\(NULL, 23, PROT_READ, MAP_SHARED, 3<', (RAW/'profiles/rg-mmap/full.strace').read_text())))
if (R/'kernel').exists():
 provenance=json.loads((RAW/'provenance.json').read_text())
 check('copied source files unchanged from provenance',all(hashlib.sha256((R/'kernel'/p).read_bytes()).hexdigest()==h for p,h in provenance['kernel_source_hashes'].items()))
 (RAW/'validation-vm.json').write_text(json.dumps({'pass':True,'checks':checks},indent=2)+'\n')
else:
 for name in ('MATRIX','ARTIFACTS','FEATURES'):
  with (R/(name+'.csv')).open() as f:check(name+' CSV has all rows',len(list(csv.DictReader(f)))==32)
 for link in re.findall(r'\]\(([^)]+)\)',(R/'RESULTS.md').read_text()):
  if '://' not in link and link!='raw/validation.json':check('report link '+link,(R/link.split('#')[0]).exists())
 (RAW/'validation.json').write_text(json.dumps({'pass':True,'checks':checks},indent=2)+'\n')
print('PASS',len(checks),'evidence consistency checks; not semantic conformance certification')
