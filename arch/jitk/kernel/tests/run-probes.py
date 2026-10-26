from pathlib import Path
import subprocess,os,json,hashlib,sys
p=Path(__file__).resolve().parents[1]
evidence=Path(os.environ.get('JITK_TEST_OUTPUT',str(p/'test-results'))).resolve()
from scratch import workspace
work = workspace('JITK_PROBE_WORK', 'probes')
(evidence/'probes').mkdir(parents=True,exist_ok=True)
cases={'kernel-write':'mov x0,#0x80000000\nstr xzr,[x0]', 'text-write':'mov x0,#0x400000\nstr xzr,[x0]', 'heap-exec':'mov x0,#0x800000\nmov x1,#4096\nmov x8,#214\nsvc #0\nmov x0,#0x680000\nbr x0', 'privileged':'msr sctlr_el1,xzr', 'el0-hvc':'hvc #0', 'bad-pointer':'mov x0,#1\nmov x1,#0x80000000\nmov x2,#16\nmov x8,#64\nsvc #0\ncmn x0,#14\nb.ne fail', 'pan':'mov x8,#12345\nsvc #0'}
# heap is allocated through brk (query/grow to 0x681000) before execute.
cases['heap-exec']='mov x0,#0x680000\nadd x0,x0,#4096\nmov x8,#214\nsvc #0\nmov x0,#0x680000\nbr x0'
cases.update({'alias-write':'mov x8,#12346\nsvc #0','fs-alias-write':'mov x8,#12347\nsvc #0','unknown-syscall':'mov x8,#511\nsvc #0\ncmn x0,#38\nb.ne fail'})
# The packed resource archive (directly after qjs) is never mapped at EL0.
sys.path.insert(0,str(p));from prepare import pack
fs_va=0x400000+len(pack((p/'payload/qjs').read_bytes())[0])
cases['fs-user-read']=f'ldr x0,=0x{fs_va:x}\nldr x1,[x0]'
results={'load':subprocess.check_output(['uptime'],text=True).strip()}
for name,body in cases.items():
 source=evidence/'probes'/f'{name}.S';source.write_text('.text\n.global _start\n_start:\n'+body+'\nmov x0,#0\nmov x8,#94\nsvc #0\nfail:\nmov x0,#1\nmov x8,#94\nsvc #0\n')
 obj=str(work/f'{name}.o');binary=str(work/f'{name}.bin')
 subprocess.run(['clang','--target=aarch64-none-elf','-c',str(source),'-o',obj],check=True)
 subprocess.run(['/opt/homebrew/bin/ld.lld','-Ttext=0x400000',obj,'-o',obj+'.elf'],check=True)
 subprocess.run(['/opt/homebrew/opt/llvm@22/bin/llvm-objcopy','-O','binary',obj+'.elf',binary],check=True)
 env=os.environ.copy();env['JITK_PROBE']=binary
 env['CARGO_TARGET_DIR']=str(work/'target')
 env.pop('RUSTFLAGS',None)
 subprocess.run(['cargo','+1.95.0','build','--manifest-path',str(p/'Cargo.toml'),'--release','--target','aarch64-unknown-none','--features','probe'],check=True,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 subprocess.run(['/opt/homebrew/opt/llvm@22/bin/llvm-objcopy','-O','binary',str(work/'target/aarch64-unknown-none/release/jitk-02'),str(work/'probe-kernel.bin')],check=True)
 r=subprocess.run([os.environ.get('JITK_TEST_HOST',str(Path(__file__).resolve().parent/'host.sh')),str(work/'probe-kernel.bin')],capture_output=True,timeout=5)
 results[name]={'returncode':r.returncode,'output':r.stdout.decode(),'stderr':r.stderr.decode(),
                'image_sha256':hashlib.sha256((work/'probe-kernel.bin').read_bytes()).hexdigest(),
                'load':subprocess.check_output(['uptime'],text=True).strip()}
 expected={'alias-write':'esr=000000009600004f','fs-alias-write':'esr=000000009600004f','fs-user-read':f'esr=0000000092000007 far={fs_va:016x}','unknown-syscall':'exit=0000000000000000','kernel-write':'far=0000000080000000','text-write':'far=0000000000400000','heap-exec':'esr=000000008200000f','privileged':'esr=0000000002000000','el0-hvc':'esr=0000000002000000','bad-pointer':'exit=0000000000000000','pan':'esr=000000009600000f'}
 results[name]['status']='PASS' if expected[name] in results[name]['output'] and r.returncode==0 else 'FAIL'
 assert results[name]['status']=='PASS',results[name]
 print(name,results[name],flush=True)
(evidence/'probe-results.json').write_text(json.dumps(results,indent=2))
