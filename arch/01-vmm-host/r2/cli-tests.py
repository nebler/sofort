import hashlib,json,pathlib,subprocess,time
root=pathlib.Path(__file__).resolve().parent
tmp=pathlib.Path('/tmp/jitk-01/r2');binary=str(tmp/'jitk-vmm')
r={'uptime':subprocess.check_output(['uptime'],text=True).strip(),'checks':{}}
def run(args,data=None):
 return subprocess.run([binary,*args],input=data,capture_output=True,timeout=30)
for name,args in [('no-image',[]),('bad-mem',['--image',str(tmp/'first.bin'),'--mem-mib','33']),('bad-seed',['--image',str(tmp/'first.bin'),'--seed','ab']),('unknown',['--whatever'])]:
 p=run(args);assert p.returncode==70 and not p.stdout,(name,p.returncode,p.stdout,p.stderr);r['checks'][name]=True
seed='00112233445566778899AABBCCDDEEFF';epoch='1792800000000000000'
p=run(['--image',str(tmp/'first.bin'),'--seed',seed,'--epoch-ns',epoch])
assert p.returncode==0,(p.returncode,p.stdout,p.stderr)
assert b'jitk.seed='+seed.lower().encode() in p.stdout and b'jitk.epoch_ns='+epoch.encode() in p.stdout and b'jitk.counter=' in p.stdout
assert p.stdout.count(b'node virtio_mmio@')==1 and b'virtio-count=0000000000000001' in p.stdout
assert b'JITK_GIC' not in p.stderr and b'MAIN_TICKS' not in p.stderr
r['checks']['seed-epoch-counter-single-console']=True;r['probe_stdout']=p.stdout.decode();r['probe_stderr']=p.stderr.decode()
payload=bytes(33+i%90 for i in range(1000))
p=run(['--image',str(tmp/'parking.bin'),'--wait-go'],b'g'+payload)
assert p.returncode==0 and p.stdout.endswith(payload),(p.returncode,p.stdout[-80:],p.stderr)
assert b'WAIT_GO' in p.stderr;r['checks']['wait-go-preserves-1000-following-bytes']=True
p=run(['--image',str(tmp/'first.bin'),'--wait-go'],b'');assert p.returncode==70 and not p.stdout;r['checks']['eof-before-go']=True
p=run(['--image',str(tmp/'qjs-r1.bin'),'--mem-mib','64']);assert p.returncode==0 and b'READY\n' in p.stdout,(p.returncode,p.stdout,p.stderr);r['checks']['real-r1-qjs-ready']=True
p=run(['--image','/tmp/jitk-01/fault.bin']);assert p.returncode==-6,(p.returncode,p.stderr);r['checks']['invalid-hvc-aborts']=True
r['binary_sha256']=hashlib.sha256((tmp/'jitk-vmm').read_bytes()).hexdigest();r['source_lines']=len((root/'main.rs').read_text().splitlines());assert r['source_lines']<=200
r['checks']['loc-under-200']=True
r['otool']=subprocess.check_output(['otool','-L',binary],text=True);assert 'libkrun' not in r['otool'];r['checks']['no-libkrun-dylib']=True
subprocess.run(['codesign','--verify','--strict',binary],check=True,capture_output=True);r['checks']['signature']=True
r['uptime_end']=subprocess.check_output(['uptime'],text=True).strip()
(root/'cli-results.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r['checks'],indent=2))
