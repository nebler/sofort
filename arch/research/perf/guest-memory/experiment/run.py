#!/usr/bin/env python3
import argparse,hashlib,json,os,platform,selectors,subprocess,time
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--n',type=int,default=1);p.add_argument('--out',default='/tmp/sofort-a1/raw/first');p.add_argument('--image',default='/tmp/sofort-a1/instrumented/kernel.bin');p.add_argument('--wait-audit',action='store_true');a=p.parse_args()
out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
meta={'date':time.strftime('%Y-%m-%d %H:%M:%S %z'),'uname':platform.uname()._asdict(),'image':a.image,'image_sha256':hashlib.sha256(Path(a.image).read_bytes()).hexdigest(),'vmm_sha256':hashlib.sha256(Path('/tmp/sofort-a1/bin/jitk-vmm').read_bytes()).hexdigest(),'n':a.n,'uptime_start':subprocess.check_output(['uptime'],text=True).strip(),'samples':[]}
for case,code in [('return2','return 2;'),('one_tool','return await test.echo(2);')]:
 for i in range(a.n):
  started=time.monotonic();run=False;done=False;buf=b'';logs={'stdout':bytearray(),'stderr':bytearray()}
  proc=subprocess.Popen(['/tmp/sofort-a1/bin/jitk-vmm','--image',a.image,'--seed','00112233445566778899aabbccddeeff','--epoch-ns','1700000000000000000'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  sel=selectors.DefaultSelector()
  for name in ['stdout','stderr']:sel.register(getattr(proc,name),selectors.EVENT_READ,name)
  try:
   while sel.get_map():
    if time.monotonic()-started>25:raise TimeoutError('guest timeout')
    for key,_ in sel.select(.25):
     data=os.read(key.fd,65536)
     if not data:sel.unregister(key.fileobj);continue
     logs[key.data].extend(data)
     if key.data!='stdout':continue
     buf+=data
     while b'\n' in buf:
      line,buf=buf.split(b'\n',1)
      if not run and (line.startswith(b'\x1eaudit ready ') if a.wait_audit else line.startswith(b'{"t":"ready"')):
       proc.stdin.write((json.dumps({'t':'run','code':code,'ns':{'test':['echo']}})+'\n').encode());proc.stdin.flush();run=True
      if line.startswith(b'{'):
       m=json.loads(line)
       if m.get('t')=='call':proc.stdin.write((json.dumps({'t':'ret','id':m['id'],'ok':m['args'][0]})+'\n').encode());proc.stdin.flush()
       if m.get('t')=='done':assert m.get('ok')==2,m;done=True
   rc=proc.wait(timeout=2)
   if not done or rc!=0:raise RuntimeError(f'case={case} done={done} rc={rc}')
  except Exception:
   proc.kill();proc.wait()
   print(bytes(logs['stdout']).decode(errors='replace'));print(bytes(logs['stderr']).decode(errors='replace'));raise
  finally:
   for name,b in logs.items():(out/f'{case}-{i}.{name}.txt').write_bytes(b)
  meta['samples'].append({'case':case,'i':i,'pid':proc.pid,'returncode':rc,'elapsed_s_instrumented_not_latency':time.monotonic()-started,'uptime':subprocess.check_output(['uptime'],text=True).strip()})
meta['uptime_end']=subprocess.check_output(['uptime'],text=True).strip();(out/'metadata.json').write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps({'out':str(out),'samples':len(meta['samples'])}))
