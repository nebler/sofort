"""Verify the installed Lua ENOSYS profile; no Linux signal emulation claim."""
from pathlib import Path
import os,json,hashlib,subprocess,time
from measure import quant,load_gate,ROOT
kernel=Path(__file__).resolve().parents[1]
grow=kernel.parent/'grow'
work=Path(os.environ.get('JITK_LUA_PROFILE_WORK',str(kernel/'test-work/lua-profile'))).resolve();work.mkdir(parents=True,exist_ok=True)
payload=grow/'payload/lua-static'
assert hashlib.sha256(payload.read_bytes()).hexdigest()=='6d825f225d7beff5a9707ec10db63cf3347524dc3ba183b16d0f6d809d2f0929'
argv=['lua','-e',(grow/'fixtures.lua').read_text()]
env={**os.environ,'JITK_ELF':str(payload.resolve()),'JITK_ARGV_JSON':json.dumps(argv),
     'CARGO_TARGET_DIR':str(work/'target'),'JITK_OUT_DIR':str(work/'out')}
subprocess.run(['sh',str(kernel/'build.sh'),'--features','grow-trace'],env=env,check=True)
image=work/'out/kernel.bin'
host=os.environ.get('JITK_TEST_HOST',str(Path(__file__).resolve().parent/'host.sh'))
oracle=(grow/'results/canonical-r3/lua-linux-normal/linux-00.stdout').read_bytes()
assert oracle==b'{"count":5,"sum":23,"max":9}\n'
samples=[];times=[]
for i in range(30):
    gate=load_gate();before=subprocess.check_output(['uptime'],text=True).strip();start=time.perf_counter_ns()
    r=subprocess.run([host,str(image)],input=b'',capture_output=True,timeout=10)
    elapsed=(time.perf_counter_ns()-start)/1e6
    assert r.returncode==0 and not r.stderr,(r.returncode,r.stderr)
    records=[];stdout=bytearray()
    for line in r.stdout.split(b'\n'):
        if line.startswith(b'\x1e'): records.append(json.loads(line[1:]))
        elif line: stdout.extend(line+b'\n')
    assert bytes(stdout)==oracle,(stdout,oracle)
    assert not any(x['kind']=='missing' for x in records),records
    signal_sequences={x['seq'] for x in records if x['kind']=='sys.enter' and x['nr'] in (134,135)}
    assert {x['nr'] for x in records if x['kind']=='sys.enter' and x['seq'] in signal_sequences}=={134,135}
    assert all(x['ret']==-38 for x in records if x['kind']=='sys.exit' and x['seq'] in signal_sequences)
    assert records[-1]['kind']=='done' and records[-1]['code']==0
    times.append(elapsed);samples.append(dict(gate=gate,uptime=before,ms=elapsed,signals_enosys=len(signal_sequences),status='PASS'))
result=dict(status='PASS',profile='always ENOSYS, no signal state or user-pointer access',n=30,
            image_sha256=hashlib.sha256(image.read_bytes()).hexdigest(),stdout=oracle.decode(),
            whole_process_ms=quant(times),samples=samples)
(ROOT/'lua-profile.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='samples'},indent=2))
