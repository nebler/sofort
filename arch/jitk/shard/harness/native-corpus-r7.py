#!/usr/bin/env python3
"""Offline kvm-dev corpus; never a runtime helper. Run under bench.lock."""
import hashlib, io, json, os, pathlib, struct, subprocess, tarfile, time
ROOT = pathlib.Path('/home/dev/r7-bytes')
CENSUS = pathlib.Path('/home/dev/r6-census')
RAW = ROOT / 'raw'
REAL = ROOT / 'arch/jitk/shard/target/release/real'

def dump(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n')
def text(s):
    b=s.encode(); return struct.pack('<H',len(b))+b

def request(tool, args, files):
    b=b'JNR7'+text(tool)+struct.pack('<H',len(args))+b''.join(map(text,args))+struct.pack('<H',len(files))
    for path,data in files.items():b+=text(path)+struct.pack('<I',len(data))+data
    return struct.pack('<I',len(b))+b

def main():
    RAW.mkdir(exist_ok=True)
    dump(RAW/'environment.json', dict(uname=list(os.uname()),load=list(os.getloadavg()),uptime=pathlib.Path('/proc/uptime').read_text(),nested=True))
    profiles=json.loads((ROOT/'profiles.json').read_text())
    for name,profile in profiles.items():
        assert hashlib.sha256(pathlib.Path(profile['binary']).read_bytes()).hexdigest()==profile['sha256']
    fixture={'data/input.txt':b'alpha 2\nbeta 5\nalpha 3\n','data/input.json':b'{"items":[{"n":2},{"n":5}]}\n',
             'dev/null':b'','data/demo.db':(CENSUS/'fixtures/data/demo.db').read_bytes()}
    tar=io.BytesIO()
    with tarfile.open(fileobj=tar,mode='w',format=tarfile.USTAR_FORMAT) as t:
        data=fixture['data/input.txt'];info=tarfile.TarInfo('input.txt');info.size=len(data);info.mode=0o444;info.mtime=0;t.addfile(info,io.BytesIO(data))
    fixture['data/fixture.tar']=tar.getvalue()
    # Large incompressible bytes are deterministic, include NUL/invalid UTF-8,
    # and force many record wraps/credit returns in gzip/zstd and cat.
    fixture['data/binary']=b''.join(hashlib.sha256(str(i).encode()).digest() for i in range(5000))
    cases=[]
    def case(tool,label,args,files=None):cases.append(dict(tool=tool,case=label,args=[tool]+args,files=fixture if files is None else files))
    case('jq-musl','aggregate',['-c','[.items[].n] | add','data/input.json'])
    case('jq-musl','binary',['-j','"a\\u0000b"','data/input.json'])
    case('jq-musl','bad-json',['.','data/bad.json'],{'data/bad.json':b'{bad\n'})
    case('jq-musl','partial-error',['-c','.','data/partial.json'],{'data/partial.json':b'1\n{bad\n'})
    case('jq-musl','missing',['.','data/missing'])
    sqlbase=['-batch','-init','dev/null','file:data/demo.db?mode=ro&immutable=1']
    for label,sql in [('aggregate','SELECT sum(v) FROM n;'),('ordered','SELECT v FROM n ORDER BY v;'),('integrity','PRAGMA integrity_check;'),
                      ('bad-query','SELEC v FROM n;'),('missing-table','SELECT * FROM missing_table;'),('readonly','INSERT INTO n VALUES(42);')]:
        case('sqlite3',label,sqlbase+[sql])
    for app,args in [('sed',['s/alpha/agent/g','data/input.txt']),('awk',['{s+=$2} END {print s}','data/input.txt']),
                     ('grep',['alpha','data/input.txt']),('sort',['data/input.txt']),('wc',['-l','data/input.txt']),('tar',['-tf','data/fixture.tar'])]:
        case('busybox',app,[app]+args)
    for app,args in [('sed',['[','data/input.txt']),('awk',['{','data/input.txt']),('grep',['[','data/input.txt']),
                     ('sort',['data/missing']),('wc',['data/missing']),('tar',['-tf','data/input.txt'])]:
        case('busybox',app+'-error',[app]+args)
    case('busybox','grep-nomatch',['grep','absent','data/input.txt'])
    case('busybox','gzip-text',['gzip','-c','data/input.txt'])
    case('busybox','gzip-binary',['gzip','-c','data/binary'])
    case('busybox','gzip-invalid-option',['gzip','-d','-c','data/input.txt'])
    case('zstd','compress-text',['-q','-c','-T1','data/input.txt'])
    case('zstd','compress-binary',['-q','-c','-T1','data/binary'])
    case('zstd','corrupt',['-q','-d','-c','data/input.txt'])
    case('lua','sum',['-e','local s=0; for l in io.lines("data/input.txt") do s=s+tonumber(l:match("%d+")) end; print(s)'])
    case('lua','file-binary',['-e','io.write(io.open("data/binary"):read("*a"))'])
    case('lua','binary-status',['-e','io.write(string.char(0,255,128)); io.flush(); io.stderr:write("err\\n"); os.exit(42)'])
    case('lua','error',['-e','error("bad")'])
    case('lua','exit255',['-e','os.exit(511)'])
    case('lua','stdin-eof',['-e','print(io.read("*a"))'])
    case('lua','late-bind-a',['-e','io.write(io.open("data/value"):read("*a"))'],{'data/value':b'first\0\xff'})
    case('lua','late-bind-b',['-e','io.write(io.open("data/value"):read("*a"))'],{'data/value':b'second\x80'})
    case('micropython','sum',['-c','print(sum(int(x.split()[1]) for x in open("data/input.txt")))'])
    case('micropython','binary-status',['-c','import sys; sys.stdout.buffer.write(bytes([0,255,128])); sys.stderr.write("err\\n"); sys.exit(7)'])
    case('micropython','error',['-c','raise ValueError("bad")'])
    worker=subprocess.Popen([str(REAL),'native-worker']+[f'{p}={ROOT}/images/{p}-r7' for p in profiles],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=(RAW/'worker.stderr').open('wb'))
    oracle=ROOT/'oracle';oracle.mkdir(exist_ok=True)
    results=[]
    try:
        for i,c in enumerate(cases):
            for p in sorted(oracle.rglob('*'),reverse=True):
                if p.is_file():p.unlink()
            for path,data in c['files'].items():
                p=oracle/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data);p.chmod(0o444);os.utime(p,(0,0))
            env=dict(PATH='/usr/bin:/bin',HOME='/nonexistent',LC_ALL='C',LANG='C',TZ='UTC')
            native=subprocess.run(c['args'],executable=profiles[c['tool']]['binary'],cwd=oracle,stdin=subprocess.DEVNULL,capture_output=True,env=env,timeout=10)
            wire=request(c['tool'],c['args'],c['files'])
            if c['tool']=='lua' and c['case']=='sum':
                (ROOT/'ledger.request').write_bytes(request(c['tool'],c['args'],{'data/input.txt':c['files']['data/input.txt']})[4:])
            start=time.monotonic_ns();worker.stdin.write(wire);worker.stdin.flush()
            header=worker.stdout.read(4);assert len(header)==4,(c,worker.poll())
            n=struct.unpack('<I',header)[0];out=worker.stdout.read(n);assert len(out)==n
            status,exitcode,olen,elen,limited=struct.unpack_from('<5I',out)
            o,e=out[20:20+olen],out[20+olen:20+olen+elen]
            passed=status==0 and (o,e,exitcode)==(native.stdout,native.stderr,native.returncode)
            r=dict(i=i,tool=c['tool'],case=c['case'],argv=c['args'],pass_exact=passed,worker_status=status,exit_code=exitcode,limited=limited,
                   stdout_hex=o.hex(),stderr_hex=e.hex(),linux_stdout_hex=native.stdout.hex(),linux_stderr_hex=native.stderr.hex(),linux_exit=native.returncode,
                   elapsed_ns=time.monotonic_ns()-start,load=list(os.getloadavg()),error=out[20:].decode(errors='replace') if status else None,
                   inputs={p:dict(bytes=len(d),sha256=hashlib.sha256(d).hexdigest()) for p,d in c['files'].items()})
            # Binary streams live in separate <1 MiB files; JSON has digests/lengths.
            for key,value in [('stdout',o),('stderr',e),('linux_stdout',native.stdout),('linux_stderr',native.stderr)]:
                (RAW/f'{i:02}-{key}.bin').write_bytes(value);r[key+'_sha256']=hashlib.sha256(value).hexdigest();r[key+'_bytes']=len(value)
                if len(value)>8192:r[key+'_hex']=None
            results.append(r);dump(RAW/'corpus.json',results)
            print(c['tool'],c['case'],'PASS' if passed else 'FAIL',olen,elen,exitcode,flush=True)
    finally:
        worker.stdin.close();worker.wait(timeout=5)
    assert all(r['pass_exact'] for r in results)
if __name__=='__main__':main()
