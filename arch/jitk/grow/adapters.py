"""G4 ABI adapter v2: fail-closed, single-process ioctl/ppoll/read/write/exit.

No general QuickJS trace equivalence claim. Raw records retain every register;
canonical events retain the ABI's meaningful arguments and defined buffer bytes.
"""
import json, re, struct

ERRNO = {9:'EBADF',14:'EFAULT',22:'EINVAL',25:'ENOTTY',38:'ENOSYS'}
NAMES = {29:'ioctl',63:'read',64:'write',73:'ppoll',134:'rt_sigaction',135:'rt_sigprocmask',94:'exit_group'}
def signed(x,bits=64):
    return x-(1<<bits) if x & (1<<(bits-1)) else x
def pollfds(data, n):
    if n==0: return []
    if data is None: return None
    b=bytes.fromhex(data)
    assert len(b)==n*8
    return [list(struct.unpack_from('<ihh',b,i*8)) for i in range(n)]
def guest(raw, allow_missing=False):
    records=[]; app=bytearray()
    for line in raw.split(b'\n'):
        if b'\x1e' in line:
            prefix,line=line.split(b'\x1e',1);app.extend(prefix)
            rec=json.loads(line)
            assert rec['v']==2
            records.append(rec)
        elif line:
            if re.fullmatch(b'hello jitk fdt=[0-9a-f]{16}|exit=[0-9a-f]{16}',line): continue
            app.extend(line+b'\n')
    events=[];pending=None;done=None
    for r in records:
        kind=r['kind']
        if kind in ('sys.enter','missing'):
            assert pending is None and done is None
            assert r['seq']==len(events)+1
            assert kind!='missing' or allow_missing, 'unregistered syscall'
            pending=r
        elif kind=='sys.exit':
            assert pending and r['seq']==pending['seq']
            n=pending['nr'];a=pending['args'];ret=r['ret']
            assert n in NAMES, f'unsupported ABI {n}'
            e={'nr':n,'name':NAMES[n],'ret':ret}
            if n in (134,135):
                e['args']=[a[0], 'NULL' if a[1]==0 else 'PTR', 'NULL' if a[2]==0 else 'PTR',a[3]]
            elif n==29:
                e['args']=[signed(a[0],64),a[1],'PTR' if a[2] else 'NULL']
                # Canaries are compared through following write bytes and guest assertions.
                assert r['output'] in ('4141414141414141',None)
            elif n in (63,64):
                data=pending['input'] if n==64 else r['output']
                assert data is not None or ret<=0, 'missing/truncated buffer'
                e['args']=[a[0],data,a[2]]
            elif n==73:
                inp=pollfds(pending['input'],a[1]);out=pollfds(r['output'],a[1])
                timeout=None if a[2]==0 else list(struct.unpack('<qq',bytes.fromhex(pending['timeout'])))
                e['args']=[inp,a[1],timeout,'NULL' if a[3]==0 else 'MASK',a[4]]
                e['output']=out
            events.append(e);pending=None
        elif kind=='done':
            assert pending and pending['nr']==94 and r['seq']==pending['seq']
            assert r['code']==pending['args'][0]
            events.append({'nr':94,'name':'exit_group','args':[r['code']],'ret':None})
            done=r['code'];pending=None
        else: raise AssertionError('unknown/fatal record '+kind)
    assert pending is None and done is not None, 'incomplete guest trace'
    return {'events':events,'stdout_hex':app.hex(),'stderr_hex':'','exit':done}

def linux(raw,stdout,stderr,code):
    events=[]
    def data(s):
        assert re.fullmatch(r'"(?:\\x[0-9a-f]{2})*"',s), s
        return bytes(int(x,16) for x in re.findall(r'\\x([0-9a-f]{2})',s)).hex()
    def scalar(s): return int(s,0)
    def fds(s,output=False):
        if s in ('NULL','0x0'): return None
        if s=='[]': return []
        assert s.startswith('[') and s.endswith(']'), s
        fs=[]
        for part in re.findall(r'\{([^}]+)\}',s):
            m=re.fullmatch(r'fd=(-?\d+)(?:, (?:events|revents)=(0x[0-9a-f]+|0))?',part)
            assert m, part
            fs.append([int(m[1]),int(m[2] or '0',0)])
        assert fs,s
        return fs
    # Import the existing strict tokenizer, not its lossy pointer identities.
    import sys, pathlib
    sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent/'oracle'))
    from normalize import split_args
    for line in raw.splitlines():
        line=re.sub(r'^\d+\s+','',line)
        m=re.fullmatch(r'(\w+)\((.*)\)\s+=\s+(.*)',line); assert m,line
        name,aa,rr=m.groups();a=split_args(aa)
        if name=='execve':
            assert not events and rr=='0';continue # oracle process loader only
        assert name in NAMES.values(),name
        n=next(k for k,v in NAMES.items() if v==name)
        ret=None if rr=='?' else (-next(k for k,v in ERRNO.items() if v==rr.split()[1]) if rr.startswith('-1 ') else int(rr.split()[0],0))
        e={'nr':n,'name':name,'ret':ret}
        if n in (134,135): e['args']=[int(a[0],0),'NULL' if a[1]=='NULL' else 'PTR','NULL' if a[2]=='NULL' else 'PTR',int(a[3],0)]
        elif n==29: e['args']=[int(a[0]),int(a[1],0),'NULL' if a[2]=='NULL' else 'PTR']
        elif n in (63,64): e['args']=[int(a[0]),data(a[1]),int(a[2])]
        elif n==94: e['args']=[int(a[0])]
        elif n==73:
            nfds=int(a[1]); infds=fds(a[0])
            inp=[] if nfds==0 else (None if infds is None else [[fd,ev,0] for fd,ev in infds])
            timeout=None
            if a[2]!='NULL':
                tm=re.fullmatch(r'\{tv_sec=(-?\d+), tv_nsec=(-?\d+)\}',a[2]);assert tm,a[2]
                timeout=[signed(int(v)) if int(v)>=0 else int(v) for v in tm.groups()]
            e['args']=[inp,nfds,timeout,a[3],int(a[4])]
            out=None if inp is None else [list(x) for x in inp]
            if ret and ret>0:
                rm=re.search(r'\(\[(.*?)\]',rr);assert rm,rr
                ready=fds('['+rm[1]+']')
                for fd,ev in ready:
                    matches=[i for i,x in enumerate(out) if x[0]==fd];assert len(matches)==1
                    out[matches[0]][2]=ev
            e['output']=out
        events.append(e)
    assert events and events[-1]=={'nr':94,'name':'exit_group','args':[code],'ret':None}
    return {'events':events,'stdout_hex':stdout.hex(),'stderr_hex':stderr.hex(),'exit':code}

def compare(a,b):
    assert a==b, json.dumps({'linux':a,'guest':b},indent=2)
