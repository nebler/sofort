"""Fresh-VM tests of actual syscall files, v2 emitter and absent-file dispatch."""
import os,sys,json,shutil,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
area=Path(os.environ.get('JITK_TEST_OUTPUT',str(root/('test-results' if os.getenv('JITK_RECORD') == '1' else '.work/test-results')))).resolve();area.mkdir(parents=True,exist_ok=True)
from scratch import workspace
work = workspace('JITK_GROW_CONTRACT_WORK', 'grow-contract')
copy=work/'kernel'
shutil.copytree(root,copy,dirs_exist_ok=True,ignore=shutil.ignore_patterns('.work','dist','target','test-results','test-work','__pycache__','.READY','.R4'))
link=work/'probe.ld';link.write_text('''ENTRY(_start)
PHDRS { text PT_LOAD FILEHDR PHDRS FLAGS(5); data PT_LOAD FLAGS(6); }
SECTIONS { . = 0x400000 + SIZEOF_HEADERS;
.text : { *(.text*) } :text .rodata : { *(.rodata*) } :text
. = ALIGN(4096); .data : { *(.data*) } :data .bss : { *(.bss*) } :data
/DISCARD/ : { *(.comment*) *(.eh_frame*) } }
''')
host=os.environ.get('JITK_TEST_HOST',str(Path(__file__).resolve().parent/'host.sh'))
results={'load':subprocess.check_output(['uptime'],text=True).strip()}
def build(name,asm):
    source=work/(name+'.S');source.write_text(asm)
    obj=work/(name+'.o');elf=work/(name+'.elf')
    subprocess.run(['clang','--target=aarch64-none-elf','-c',str(source),'-o',str(obj)],check=True)
    subprocess.run(['/opt/homebrew/bin/ld.lld','-T',str(link),str(obj),'-o',str(elf)],check=True)
    env={**os.environ,'JITK_ELF':str(elf),'JITK_ARGV_JSON':'["probe"]',
         'CARGO_TARGET_DIR':str(work/'target'),'JITK_OUT_DIR':str(work/name)}
    subprocess.run(['sh',str(copy/'build.sh'),'--features','grow-trace'],env=env,check=True,stdout=subprocess.PIPE)
    return work/name/'kernel.bin'
def run(image,data=b''):
    r=subprocess.run([host,str(image)],input=data,capture_output=True,timeout=10)
    assert r.returncode==0,(r.returncode,r.stderr,r.stdout)
    raw=r.stdout;records=[];app=[]
    for line in raw.split(b'\n'):
        if line.startswith(b'\x1e'):records.append(json.loads(line[1:]))
        elif line:app.append(line)
    assert records[-1]['kind']=='done' and records[-1]['code']==0,(raw,r.stderr)
    return records,b'\n'.join(app)
base=root/'tests/fixtures/grow'
for name,data in [('ioctl',b''),('ppoll',b'ping\n')]:
    image=build(name,(base/(name+'.S')).read_text());rr,app=run(image,data)
    assert not any(r['kind']=='missing' for r in rr),rr
    assert name.encode()+b' OK' in app,app
    manifest=json.loads((image.parent/'manifest.json').read_text())
    exits=[s for s in manifest['syscalls'] if s['nr'] in (93,94)]
    assert len(exits)==2 and all(s['registered'] and s['name']=='exit' for s in exits)
    assert exits[0]['sha256']==exits[1]['sha256']
    results[name]={'status':'PASS','records':len(rr),'stdout':app.decode(),
                   'exit_slot':93 if name=='ioctl' else 94}
# This calls registered ioctl/mremap returning ENOSYS, plus a truly unknown slot.
asm='''.text
.global _start
_start:
 mov x0,#1
 mov x1,#0xdead
 mov x2,#0
 mov x8,#29
 svc #0
 cmn x0,#38
 b.ne fail
 mov x8,#216
 svc #0
 cmn x0,#38
 b.ne fail
 mov x0,#-1
 mov x1,#-1
 mov x2,#-1
 mov x3,#-1
 mov x8,#134
 svc #0
 cmn x0,#38
 b.ne fail
 mov x8,#135
 svc #0
 cmn x0,#38
 b.ne fail
 mov x8,#511
 svc #0
 cmn x0,#38
 b.ne fail
 mov x0,#0
 b done
fail: mov x0,#1
done: mov x8,#94
 svc #0
.data
.quad 0
'''
image=build('registered-enosys',asm);rr,_=run(image)
assert [r['nr'] for r in rr if r['kind']=='missing']==[511],rr
results['registered_enosys']={'status':'PASS','missing':[511],'registered_enosys':[29,134,135,216]}
(copy/'src/syscalls/ioctl.rs').unlink()
image=build('deleted-ioctl',asm);rr,_=run(image)
assert [r['nr'] for r in rr if r['kind']=='missing']==[29,511],rr
m=json.loads((image.parent/'manifest.json').read_text())
assert next(r for r in m['syscalls'] if r['nr']==29)['registered'] is False
results['deleted_ioctl']={'status':'PASS','missing':[29,511],'manifest_registered':False}
results['status']='PASS'
(area/'grow-contract.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results,indent=2))
