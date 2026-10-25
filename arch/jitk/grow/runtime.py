"""Copy-only build/VM helpers. All subprocesses have bounded watchdogs and reap."""
import hashlib, json, math, os, pathlib, shutil, signal, statistics, subprocess, tempfile, time
IGNORED = ('.git','target','__pycache__','dist','test-work','test-results','.READY','.R4')
ROOT = pathlib.Path(__file__).resolve().parent
CANONICAL = ROOT.parent/'kernel'
def scratch(prefix='jitk-grow-'):
    # Optional parent only; every invocation gets a new, automatically cleaned dir.
    return tempfile.TemporaryDirectory(prefix=prefix, dir=os.environ.get('JITK_GROW_TMPDIR'))
SAFE_ENV = {k:v for k,v in os.environ.items() if k in ('PATH','HOME','USER','LOGNAME','SHELL','TMPDIR','RUSTUP_HOME','CARGO_HOME')}

def sha(path): return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
def dump(path, value): pathlib.Path(path).write_text(json.dumps(value,indent=2)+'\n')
def load(): return subprocess.check_output(['uptime'],text=True).strip()
def kill_reap(p):
    if p.poll() is None:
        try: os.killpg(p.pid,signal.SIGKILL)
        except ProcessLookupError: pass
        except PermissionError:
            # macOS can deny a group signal even when the owned child is killable.
            try: p.kill()
            except ProcessLookupError: pass
    p.wait()

def run(cmd, cwd=ROOT, env=None, timeout=180, input_data=None):
    p=subprocess.Popen([str(x) for x in cmd],cwd=cwd,env=env or SAFE_ENV,
        stdin=subprocess.PIPE if input_data is not None else None,
        stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    try: stdout,stderr=p.communicate(input=input_data,timeout=timeout)
    except BaseException:
        kill_reap(p);p.communicate();raise
    result=subprocess.CompletedProcess(cmd,p.returncode,stdout,stderr)
    if p.returncode: raise RuntimeError(f'{cmd}: rc={p.returncode}\n'+(stdout+stderr).decode(errors='replace'))
    return result

LOAD_GATE = None
GATE_PROVENANCE = 'local load annotations; canonical bench unavailable'

def select_gate():
    global LOAD_GATE,GATE_PROVENANCE
    bench=ROOT.parent/'bench'
    if (bench/'.READY').is_file():
        import importlib.util
        spec=importlib.util.spec_from_file_location('jitk_bench_gate',bench/'run.py')
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        LOAD_GATE=module.gate;GATE_PROVENANCE=str(bench/'run.py')+' sha256='+sha(bench/'run.py')

def process(cmd, destination, data=b'ping\n', timeout=10):
    gate=LOAD_GATE(6,0) if LOAD_GATE else {'threshold':6,'budget_s':0,'passed':os.getloadavg()[0]<6,'load':list(os.getloadavg())}
    before=load(); start=time.perf_counter()
    with open(str(destination)+'.stdout','wb') as so:
        p=subprocess.Popen([str(x) for x in cmd],stdin=subprocess.PIPE,stdout=so,stderr=subprocess.PIPE,
                           start_new_session=True,env=SAFE_ENV)
        try:
            if data: p.stdin.write(data); p.stdin.flush()
            p.wait(timeout=timeout)
        except BaseException:
            kill_reap(p); raise
        finally:
            p.stdin.close()
            stderr=p.stderr.read();p.stderr.close()
            pathlib.Path(str(destination)+'.stderr').write_bytes(stderr)
    elapsed=time.perf_counter()-start
    stdout=pathlib.Path(str(destination)+'.stdout').read_bytes()
    stderr=pathlib.Path(str(destination)+'.stderr').read_bytes()
    item={'load_gate':gate,'seconds':elapsed,'returncode':p.returncode,'uptime_before':before,'uptime_after':load()}
    dump(str(destination)+'.json',item)
    return item,stdout,stderr

def tree_hashes(root):
    return {str(p.relative_to(root)):sha(p) for p in sorted(root.rglob('*')) if p.is_file()
            and not any(x in p.relative_to(root).parts for x in IGNORED)}

def source():
    assert (CANONICAL/'.READY').is_file(), 'canonical kernel/.READY is required'
    return CANONICAL
def copy_kernel(destination):
    src=source(); before=tree_hashes(src)
    shutil.copytree(src,destination,ignore=shutil.ignore_patterns(*IGNORED))
    assert tree_hashes(src)==before, 'source changed while copying; retry from a stable READY tree'
    return src,before

def probe_source(name):
    return CANONICAL/'tests/fixtures/grow/ppoll.S' if name=='ppoll' else ROOT/(name+'.S')

def build(work, out, elf, argv):
    work=pathlib.Path(work).resolve(); out=pathlib.Path(out).resolve(); out.mkdir(parents=True,exist_ok=True)
    assert work!=CANONICAL.resolve() and CANONICAL.resolve() not in work.parents
    assert (work/'build.sh').is_file(), 'canonical kernel build.sh is required'
    env=dict(SAFE_ENV,JITK_OUT_DIR=str(out),CARGO_TARGET_DIR=str(work.parent/'target'),
             JITK_ELF=str(elf),JITK_ARGV_JSON=json.dumps(argv))
    p=run(['sh',work/'build.sh','--features','qjs,grow-trace'],cwd=work,env=env)
    (out/'build.log').write_bytes(p.stdout+p.stderr)
    assert (out/'kernel.bin').is_file()
    return out/'kernel.bin'

SELECTED_HOST = None

def select_host():
    global SELECTED_HOST
    value=os.environ.get('JITK_VMM_BINARY')
    if not value: raise RuntimeError('Set JITK_VMM_BINARY to the built canonical v2 jitk-vmm executable')
    SELECTED_HOST=pathlib.Path(value).resolve(strict=True)
    assert os.access(SELECTED_HOST,os.X_OK), 'JITK_VMM_BINARY must be executable'

def host():
    if SELECTED_HOST is None: select_host()
    return SELECTED_HOST

def host_command(image):
    # VMM compiles the canonical sandbox profile for this image's directory.
    return [host(),'--image',pathlib.Path(image).resolve()]

def check_host(info,stderr):
    assert info['returncode']==0, (info,stderr)
    assert stderr==b'{"sandbox":"ok"}\n', ('missing/unexpected host-only sandbox ack',stderr)


def records(raw):
    result=[]; app=bytearray()
    for line in raw.splitlines(keepends=True):
        # splitlines treats RS as a line boundary on text but not bytes.
        if b'\x1e' in line:
            prefix,record=line.split(b'\x1e',1); app.extend(prefix)
            result.append(json.loads(record))
        elif line.startswith(b'hello jitk fdt=') or line.startswith(b'exit='): continue
        else: app.extend(line)
    return result,bytes(app)

def boot(image, dest, data=b'ping\n'):
    info,raw,err=process(host_command(image),dest,data=data)
    check_host(info,err)
    rec,app=records(raw)
    assert not any(x.get('kind')=='fatal' for x in rec),rec
    done=[x for x in rec if x.get('kind')=='done']
    assert done and done[-1]['code']==0,(rec,app)
    return info,rec,app

def distribution(samples):
    a=sorted(samples); return {'n':len(a),'unit':'ms','median':statistics.median(a),
      'p90':a[math.ceil(.9*len(a))-1],'p99':a[math.ceil(.99*len(a))-1],'samples':samples}
