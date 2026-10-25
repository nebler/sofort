#!/usr/bin/env python3
"""Causal before-states and failure-class diagnostics using controller helpers.

This does not accept/promote handlers. loop.py owns the sole acceptance gate.
"""
import argparse, json, pathlib
from runtime import *
from loop import oracle
from observations import observe, outcome
from sqlite_profile import SQLITE_SHA, DB_SHA


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--run-id',required=True)
    ap.add_argument('--sqlite-elf',type=pathlib.Path,required=True)
    ap.add_argument('--database',type=pathlib.Path,required=True)
    a=ap.parse_args();assert sha(a.sqlite_elf)==SQLITE_SHA and sha(a.database)==DB_SHA
    out=ROOT/'results'/a.run_id;out.mkdir();select_host()
    resources=out/'resources';(resources/'dev').mkdir(parents=True)
    (resources/'demo.db').write_bytes(a.database.read_bytes());(resources/'dev/null').write_bytes(b'')
    argv=['sqlite3','-batch','-init','/dev/null','file:/demo.db?mode=ro&immutable=1',
          "SELECT json_object('count',count(*),'sum',sum(v),'max',max(v)) FROM n;"]
    report={'uptime':load(),'binary_sha256':sha(a.sqlite_elf),'database_sha256':sha(a.database)}
    with scratch() as temporary:
        work=pathlib.Path(temporary)/'kernel';src,hashes=copy_kernel(work)
        manifest=json.loads((work/'syscalls.manifest.json').read_text())
        manifest['contracts']=[c for c in manifest['contracts'] if c['name'] not in ('fstat','pread64')]
        dump(work/'syscalls.manifest.json',manifest)
        for name in ('fstat','pread64'): (work/f'src/syscalls/{name}.rs').unlink()
        for label,missing in [('without-both',80),('without-pread64',67)]:
            if missing==67: (work/'src/syscalls/fstat.rs').write_bytes((src/'src/syscalls/fstat.rs').read_bytes())
            image=build(work,out/label,a.sqlite_elf,argv,resources)
            info,raw,err=process(host_command(image),out/(label+'-run'),data=b'');check_host(info,err)
            value=observe(raw);dump(out/(label+'.observations.json'),value)
            assert value['trace_complete'] and value['exit']==1 and value['stdout_hex']==''
            assert missing in {r['nr'] for r in value['missing']}
            report[label]=dict(outcome(value),missing=sorted({r['nr'] for r in value['missing']}))
        normal=oracle(a.sqlite_elf,argv,out/'linux-normal',None,resources=resources,data=b'')[0]
        for name in ('fstat','pread64'):
            value=oracle(a.sqlite_elf,argv,out/('linux-'+name),None,
                         injections=[name+':error=ENOSYS'],resources=resources,data=b'')[0]
            assert value['exit']==1 and value['stdout_hex']==''
            report['injected-'+name]=outcome(value)
        combined=oracle(a.sqlite_elf,argv,out/'linux-combined',None,
                        injections=[n+':error=ENOSYS' for n in ('faccessat','getpid','rt_sigaction','rt_sigprocmask')],
                        resources=resources,data=b'')[0]
        assert outcome(combined)==outcome(normal)
        report['combined-enosys']=dict(status='PASS',**outcome(combined))
        # Real invalid ELF, rejected by the loader before a guest is launched.
        bad=out/'dynamic.elf';data=bytearray(a.sqlite_elf.read_bytes());data[16:18]=(3).to_bytes(2,'little');bad.write_bytes(data)
        try: build(work,out/'loader-rejection',bad,argv,resources)
        except RuntimeError:
            failure=json.loads((out/'loader-rejection/failure.json').read_text())
            assert 'static ET_EXEC' in failure['detail']
            report['loader-rejection']=failure['class']
        else: raise AssertionError('loader accepted ET_DYN')
        # Actual fatal stdout control byte, captured even though it is not JSON.
        source=out/'fatal.S';source.write_text('''.global _start
.text
_start:
 mov x0,1
 adr x1,byte
 mov x2,1
 mov x8,64
 svc 0
 mov x0,0
 mov x8,94
 svc 0
.section .rodata
byte: .byte 9
''')
        obj=out/'fatal.o';elf=out/'fatal.elf'
        run(['clang','--target=aarch64-none-elf','-c',source,'-o',obj])
        run(['/opt/homebrew/bin/ld.lld','-T',ROOT/'probe.ld',obj,'-o',elf])
        image=build(work,out/'fatal-output',elf,['fatal'])
        info,raw,err=process(host_command(image),out/'fatal-run',data=b'');check_host(info,err)
        value=observe(raw);dump(out/'fatal.observations.json',value)
        assert value['fatal_protocol'] and not value['trace_complete']
        report['fatal-output']='recorded and rejected'
        assert tree_hashes(src)==hashes
    dump(out/'report.json',dict(report,status='PASS'))


if __name__=='__main__': main()
