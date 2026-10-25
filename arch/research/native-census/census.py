#!/usr/bin/env python3
"""Workload-bounded native syscall census and unchanged-jitk-copy probes."""
import argparse,collections,hashlib,importlib.util,io,json,os,pathlib,re,signal,sqlite3,struct,subprocess,tarfile,time,resource
R=pathlib.Path('/home/dev/r6-census');RAW=R/'raw';FIX=R/'fixtures';A=R/'artifacts'
def dump(p,x):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,indent=2)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def env():return dict(PATH='/usr/bin:/bin',HOME='/nonexistent',LC_ALL='C',LANG='C',TZ='UTC',GOMAXPROCS='1',NO_COLOR='1')
def proc(cmd,data=b'',cwd=FIX,timeout=30,e=None):
 p=subprocess.Popen([str(x) for x in cmd],cwd=cwd,env=e or env(),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,preexec_fn=lambda:resource.setrlimit(resource.RLIMIT_CORE,(0,0)))
 timed=False
 try:o,er=p.communicate(data,timeout=timeout)
 except subprocess.TimeoutExpired:
  timed=True;os.killpg(p.pid,signal.SIGKILL);o,er=p.communicate()
 return dict(returncode=p.returncode,timeout=timed,stdout_hex=o.hex(),stderr_hex=er.hex(),uptime=pathlib.Path('/proc/uptime').read_text().strip(),load=list(os.getloadavg()))
def prepare():
 (FIX/'data/sub').mkdir(parents=True,exist_ok=True);(FIX/'dev').mkdir(exist_ok=True)
 (FIX/'dev/null').write_bytes(b'');(FIX/'data/input.json').write_text('{"items":[{"name":"alpha","n":2},{"name":"beta","n":5}]}\n')
 (FIX/'data/input.yaml').write_text('items:\n  - name: alpha\n    n: 2\n  - name: beta\n    n: 5\n')
 (FIX/'data/input.csv').write_text('name,n\nalpha,2\nbeta,5\n')
 (FIX/'data/input.txt').write_text('alpha 2\nbeta 5\nalpha 3\n');(FIX/'data/sub/notes.txt').write_text('agent alpha\n')
 (FIX/'data/doc.md').write_text('# Agent note\n\nA **small** document.\n')
 (FIX/'data/build.js').write_text('export const answer = (x) => x + 1;\n')
 db=FIX/'data/demo.db'
 if not db.exists():
  c=sqlite3.connect(db);c.execute('create table n(v)');c.executemany('insert into n values(?)',[(9,),(1,),(5,),(3,),(5,)]);c.commit();c.close()
 with tarfile.open(FIX/'data/fixture.tar','w',format=tarfile.USTAR_FORMAT) as t:
  b=(FIX/'data/input.txt').read_bytes();info=tarfile.TarInfo('input.txt');info.size=len(b);info.mode=0o444;info.mtime=0;t.addfile(info,io.BytesIO(b))
 dump(RAW/'fixtures.json',{str(p.relative_to(FIX)):dict(bytes=p.stat().st_size,sha256=sha(p)) for p in FIX.rglob('*') if p.is_file()})
def find(name):
 exact={'jq':'jq-linux-arm64','dasel':'dasel_linux_arm64','yq':'yq_linux_arm64','gojq':'gojq','miller':'mlr','rg':'rg','fd':'fd','sd':'sd','duckdb':'duckdb','pandoc':'pandoc','qsv':'qsvlite'}
 if name in ('lua','sqlite3'):return R/('lua-static' if name=='lua' else 'sqlite3-static')
 d=A/name
 receipt=d/'receipt.json'
 if receipt.exists():
  j=json.loads(receipt.read_text())
  if j.get('binary'):return pathlib.Path(j['binary'])
  if j.get('error'):return None
 hits=[p for p in d.rglob(exact.get(name,name)) if p.is_file()]
 return hits[0] if hits else None
def workloads():
 # stdin is deliberately a pipe, output is a pipe; files live in a read-only guest archive.
 specs=[('jq','data',['-c','[.items[].n] | add','data/input.json'],b'',b'7\n'),
 ('gojq','data',['-c','[.items[].n] | add','data/input.json'],b'',b'7\n'),
 ('yq','data',['-o=json','-I=0','.items[0].n + .items[1].n','data/input.yaml'],b'',b'7\n'),
 ('miller','data',['--csv','stats1','-a','sum','-f','n','data/input.csv'],b'',b'n_sum\n7\n'),
 ('dasel','data',['-i','json','-o','json','--compact','items'],(FIX/'data/input.json').read_bytes(),None),
 ('gron','data',['data/input.json'],b'',None),
 ('qsv','data',['select','name','data/input.csv'],b'',b'name\nalpha\nbeta\n'),
 ('rg','search',['--no-config','--color=never','--no-ignore','--no-mmap','-j1','alpha','data/input.txt'],b'',b'alpha 2\nalpha 3\n'),
 ('fd','search',['--threads','1','--color','never','--no-ignore','--hidden','notes','data'],b'',b'data/sub/notes.txt\n'),
 ('sd','text',['alpha','agent'],b'alpha 2\nbeta 5\n',b'agent 2\nbeta 5\n'),
 ('sqlite3','database',['-batch','-init','dev/null','file:data/demo.db?mode=ro&immutable=1',"SELECT json_object('count',count(*),'sum',sum(v),'max',max(v)) FROM n;"],b'',b'{"count":5,"sum":23,"max":9}\n'),
 ('duckdb','database',['-batch','-csv','-c','SELECT sum(n) FROM read_csv(\'data/input.csv\');'],b'',b'sum(n)\n7\n'),
 ('lua','language',['-e','local s=0; for l in io.lines("data/input.txt") do s=s+tonumber(l:match("%d+")) end; print(s)'],b'',b'10\n'),
 ('micropython','language',['-c','print(sum(int(x.split()[1]) for x in open("data/input.txt")))'],b'',b'10\n'),
 ('pandoc','documents',['-f','markdown','-t','html','data/doc.md'],b'',None),
 ('zstd','compression',['-q','-c','-T1','data/input.txt'],b'',None),
 ('xz','compression',['-c','-T1','data/input.txt'],b'',None),
 ('esbuild','language',['--minify','--loader=js'],b'export const answer = (x) => x + 1;\n',None),
 ('git','hard',['--no-pager','diff','--no-index','--','data/input.txt','data/sub/notes.txt'],b'',None),
 ('curl','hard',['--silent','--show-error','--max-time','2','http://127.0.0.1:18086/data/input.json'],b'',None)]
 specs.append(('jq-musl','data',['-c','[.items[].n] | add','data/input.json'],b'',b'7\n'))
 for app,args,out in [('sed',['s/alpha/agent/g'],b'agent 2\nbeta 5\nalpha 3\n'),('awk',['{s+=$2} END {print s}'],b'10\n'),('grep',['alpha'],b'alpha 2\nalpha 3\n'),('sort',[],b'alpha 2\nalpha 3\nbeta 5\n'),('wc',['-l'],b'3\n'),('tar',['-tf','data/fixture.tar'],b'input.txt\n'),('gzip',['-c'],None)]:
  data=b'alpha 2\nbeta 5\nalpha 3\n' if app!='tar' else b''
  if app=='sed':out=b'agent 2\nbeta 5\nagent 3\n'
  specs.append(('bb-'+app,'text' if app not in ('tar','gzip') else 'compression',[app]+args,data,out))
 return [dict(name=n,category=c,binary=str(find('busybox' if n.startswith('bb-') else n)) if find('busybox' if n.startswith('bb-') else n) else None,argv=a,stdin_hex=d.hex(),expected_hex=o.hex() if o is not None else None) for n,c,a,d,o in specs]
def metadata(w):
 p=pathlib.Path(w['binary']);b=p.read_bytes();p.chmod(p.stat().st_mode|0o111)
 entry,off=struct.unpack_from('<QQ',b,24);sz,n=struct.unpack_from('<HH',b,54);headers=[]
 for i in range(n):
  typ,fl,o,va,pa,fs,ms,al=struct.unpack_from('<IIQQQQQQ',b,off+i*sz);headers.append(dict(type=typ,flags=fl,offset=o,vaddr=va,filesz=fs,memsz=ms,align=al))
 spec=importlib.util.spec_from_file_location('packer',R/'kernel/prepare.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
 try:flat,packed=mod.pack(b);pack_error=None
 except Exception as e:packed=None;pack_error=str(e)
 elf=proc(['readelf','-hlWd',p],cwd=R);(RAW/w['name']/'elf.txt').write_bytes(bytes.fromhex(elf['stdout_hex']))
 return dict(binary=str(p),sha256=sha(p),bytes=len(b),elf_type=struct.unpack_from('<H',b,16)[0],machine=struct.unpack_from('<H',b,18)[0],entry=entry,headers=headers,interpreter=any(h['type']==3 for h in headers),dynamic=any(h['type']==2 for h in headers),tls=[h for h in headers if h['type']==7],pack_error=pack_error,packed=packed)
def native(w):
 d=RAW/w['name'];d.mkdir(exist_ok=True);m=metadata(w);dump(d/'metadata.json',m)
 results=[]
 for label,flags in [('full',['-f','-qq','-v','-s','0','-yy']),('count',['-f','-c'])]:
  r=proc(['strace']+flags+['-o',d/(label+'.strace'),w['binary']]+w['argv'],bytes.fromhex(w['stdin_hex']),timeout=30,e=dict(env(),**w.get('env',{})));dump(d/(label+'.json'),r);results.append(r)
 expected=w['expected_hex'];ok=all(r['returncode']==w.get('expected_returncode',0) and not r['timeout'] and (expected is None or r['stdout_hex']==expected) for r in results)
 # Compare deterministic stdout across the independent trace modes.
 same=results[0]['stdout_hex']==results[1]['stdout_hex']
 dump(d/'native.json',dict(workload=w,metadata=m,oracle_ok=ok,stdout_same=same,results=results))
 print(w['name'],'native',results[0]['returncode'],'oracle',ok,'pack',m['pack_error'],flush=True)
def jitk(w):
 d=RAW/w['name'];native=json.loads((d/'native.json').read_text());m=native['metadata']
 if m['pack_error']:dump(d/'jitk.json',dict(status='loader-rejected',reason=m['pack_error']));return
 out=R/'images'/w['name'];out.mkdir(parents=True,exist_ok=True)
 e=dict(os.environ,PATH='/home/dev/.cargo/bin:/usr/bin:/bin',JITK_ELF=w['binary'],JITK_ARGV_JSON=json.dumps([('busybox' if w['name'].startswith('bb-') else w['name'])]+w['argv']),JITK_RESOURCES=str(FIX),CARGO_TARGET_DIR=str(R/'kernel-target'),JITK_OUT_DIR=str(out),OBJCOPY='/usr/bin/llvm-objcopy')
 # Snapshot build.sh hard-pins 1.95; installed VM Rust is recorded stable 1.99.1. Invoke identical cargo/artifact steps explicitly.
 with (d/'build.log').open('wb') as f:
  p=subprocess.run(['cargo','+stable','build','--locked','--offline','--release','--target','aarch64-unknown-none','--features','grow-trace'],cwd=R/'kernel',env=e,stdout=f,stderr=f)
 if p.returncode:dump(d/'jitk.json',dict(status='build-failed'));return
 subprocess.run(['llvm-objcopy','-O','binary',R/'kernel-target/aarch64-unknown-none/release/jitk-02',out/'kernel.bin'],check=True)
 subprocess.run(['python3',R/'kernel/artifact.py',R/'kernel-target/aarch64-unknown-none/release/jitk-02',out],cwd=R/'kernel',env=e,check=True,stdout=subprocess.DEVNULL)
 r=proc([R/'bin/jitk-vmm','--image',out/'kernel.bin'],bytes.fromhex(w['stdin_hex']),timeout=5,e=dict(os.environ,GLIBC_TUNABLES='glibc.malloc.hugetlb=0'))
 raw=bytes.fromhex(r.pop('stdout_hex'));err=bytes.fromhex(r.pop('stderr_hex'));(d/'jitk.stdout').write_bytes(raw);(d/'jitk.stderr').write_bytes(err)
 records=[];app=bytearray();unparsed=[]
 for l in raw.split(b'\n'):
  if b'\x1e' in l:
   a,b=l.split(b'\x1e',1);app.extend(a)
   try:records.append(json.loads(b))
   except Exception:unparsed.append(b.decode(errors='replace'))
  elif l and not l.startswith((b'hello jitk fdt=',b'exit=')):app.extend(l+b'\n')
 done=[x for x in records if x.get('kind')=='done'];missing=[x['nr'] for x in records if x.get('kind')=='missing']
 r.update(status='ran',kernel_sha256=sha(out/'kernel.bin'),guest_exit=done[-1]['code'] if done else None,missing=sorted(set(missing)),first_missing=missing[0] if missing else None,app_hex=app.hex(),native_stdout_equal=app.hex()==native['results'][0]['stdout_hex'],unparsed=unparsed,sandbox_ack=err==b'{"sandbox":"ok"}\n',trace_records=len(records))
 r['runs_today']=not r['timeout'] and r['guest_exit']==0 and r['native_stdout_equal'] and r['sandbox_ack']
 dump(d/'jitk.json',r);print(w['name'],'jitk',r['guest_exit'],'missing',r['missing'],'ok',r['runs_today'],flush=True)
def main():
 ap=argparse.ArgumentParser();ap.add_argument('mode',choices=['native','jitk','list']);ap.add_argument('names',nargs='*');a=ap.parse_args();prepare();ws=workloads();dump(RAW/'workloads.json',ws)
 for w in ws:
  if a.names and w['name'] not in a.names:continue
  if not w['binary']:continue
  if a.mode=='native':native(w)
  elif a.mode=='jitk':jitk(w)
  else:print(w['name'],w['binary'])
if __name__=='__main__':main()
