#!/usr/bin/env python3
"""Offline exact Linux/ring differential for the owned native fd probe."""
import importlib.util,json,os,pathlib,struct,subprocess
ROOT=pathlib.Path(os.environ.get('JITK_NATIVE_ROOT',str(pathlib.Path(__file__).resolve().parents[4]))).resolve()
RUN=pathlib.Path(os.environ.get('JITK_NATIVE_RUN_DIR',str(ROOT))).resolve()
def main():
    env=dict(os.environ,PATH='/home/dev/.cargo/bin:'+os.environ['PATH'],RUSTUP_TOOLCHAIN='stable')
    source=ROOT/'arch/jitk/shard/harness/native-fd-r7.c'
    obj=RUN/'native-fd.o';elf=RUN/'native-fd';base=RUN/'images/native-fd'
    subprocess.run(['clang','--target=aarch64-unknown-none','-ffreestanding','-nostdlib','-fno-stack-protector','-O1','-c',str(source),'-o',str(obj)],check=True)
    subprocess.run(['ld.lld','-T',str(ROOT/'arch/jitk/grow/probe.ld'),str(obj),'-o',str(elf)],check=True)
    with (RUN/'raw/build-native-fd.log').open('wb') as log:
        subprocess.run(['sh','build-ring.sh'],cwd=ROOT/'arch/jitk/kernel',env=dict(env,JITK_RING_NATIVE='1',JITK_ELF=str(elf),JITK_RING_OUT=str(base.with_suffix('.bin'))),stdout=log,stderr=log,check=True)
    real=ROOT/'arch/jitk/shard/target/release/real'
    with (RUN/'raw/prepare-native-fd.jsonl').open('wb') as log:
        subprocess.run(['flock','/home/dev/bench.lock',str(real),'prepare',str(base.with_suffix('.bin')),str(base)],stdout=log,check=True)
    spec=importlib.util.spec_from_file_location('corpus',source.parent/'native-corpus-r7.py');corpus=importlib.util.module_from_spec(spec);spec.loader.exec_module(corpus)
    data=bytes([0,255,128,65,90]);oracle=RUN/'fd-oracle';(oracle/'data').mkdir(parents=True,exist_ok=True)
    (oracle/'data/input').write_bytes(data)
    linux=subprocess.run([str(elf)],cwd=oracle,capture_output=True,timeout=10)
    worker=subprocess.run(['flock','/home/dev/bench.lock',str(real),'native-worker',f'fd={base}'],input=corpus.request('fd',['fd'],{'data/input':data}),capture_output=True,timeout=60)
    n=struct.unpack_from('<I',worker.stdout)[0];assert n+4==len(worker.stdout)
    status,code,olen,elen,limited=struct.unpack_from('<5I',worker.stdout,4)
    out=worker.stdout[24:24+olen];err=worker.stdout[24+olen:]
    result=dict(status=status,exit_code=code,stdout_hex=out.hex(),stderr_hex=err.hex(),linux_exit=linux.returncode,
                linux_stdout_hex=linux.stdout.hex(),linux_stderr_hex=linux.stderr.hex(),pass_exact=status==0 and (code,out,err)==(linux.returncode,linux.stdout,linux.stderr))
    (RUN/'raw/native-fd.json').write_text(json.dumps(result,indent=2)+'\n');assert result['pass_exact'],result
if __name__=='__main__':main()
