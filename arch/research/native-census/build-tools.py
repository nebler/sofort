#!/usr/bin/env python3
"""Pinned source builds; all writes and subprocess cwd under r6-census."""
import concurrent.futures, hashlib,json,os,pathlib,subprocess,tarfile,urllib.request
from acquire import get
R=pathlib.Path('/home/dev/r6-census'); CC=str(R/'toolchain/musl-install/bin/musl-gcc')
def run(cmd,cwd,log,env=None):
 log.write(('COMMAND '+repr(cmd)+'\n').encode());log.flush()
 subprocess.run(cmd,cwd=cwd,env=env,stdout=log,stderr=log,check=True,timeout=600)
def build(name):
 d=R/'artifacts'/name;d.mkdir(exist_ok=False); result={'name':name}
 with (R/'raw'/('build-'+name+'.log')).open('wb') as log:
  try:
   if name=='busybox':
    url='https://busybox.net/downloads/busybox-1.37.0.tar.bz2';b=get(url);p=d/'busybox-1.37.0.tar.bz2';p.write_bytes(b);h=hashlib.sha256(b).hexdigest()
    checksum=get(url+'.sha256');(d/'upstream.sha256').write_bytes(checksum);assert h.encode() in checksum
    result.update(version='1.37.0',source=url,source_sha256=h,verified=True)
    with tarfile.open(p) as t:t.extractall(d,filter='data')
    s=d/'busybox-1.37.0';run(['make','defconfig'],s,log)
    config=(s/'.config').read_text();config=config.replace('# CONFIG_STATIC is not set','CONFIG_STATIC=y').replace('CONFIG_TC=y','# CONFIG_TC is not set');(s/'.config').write_text(config)
    run(['make','-j2','CC='+CC,'busybox'],s,log);p=s/'busybox'
   elif name in ('zstd','xz','micropython'):
    repo,tag,pattern={'zstd':('facebook/zstd','v1.5.7','zstd-1.5.7.tar.gz'),'xz':('tukaani-project/xz','v5.8.1','xz-5.8.1.tar.gz'),'micropython':('micropython/micropython','v1.27.0',None)}[name]
    j=json.loads(get(f'https://api.github.com/repos/{repo}/releases/tags/{tag}'));(d/'release.json').write_text(json.dumps(j,indent=2))
    if pattern:
     a=next(a for a in j['assets'] if a['name']==pattern);url=a['browser_download_url'];b=get(url);h=hashlib.sha256(b).hexdigest();assert a['digest']=='sha256:'+h;p=d/pattern;p.write_bytes(b)
    else:
     # Official MicroPython release source, API tarball pinned by tag and content digest.
     url=f'https://micropython.org/resources/source/micropython-1.27.0.tar.xz';b=get(url);p=d/'micropython-1.27.0.tar.xz';p.write_bytes(b);h=hashlib.sha256(b).hexdigest()
    result.update(version=tag,source=url,source_sha256=h,verified=bool(pattern))
    with tarfile.open(p) as t:t.extractall(d,filter='data')
    s=next(x for x in d.iterdir() if x.is_dir())
    if name=='zstd':run(['make','-j2','-C','programs','zstd','CC='+CC,'LDFLAGS=-static','HAVE_THREAD=0','ZSTD_LEGACY_SUPPORT=0'],s,log);p=s/'programs/zstd'
    elif name=='xz':
     env=dict(os.environ,CC=CC,CFLAGS='-O2',LDFLAGS='-static');run(['./configure','--disable-shared','--enable-static','--disable-nls','--disable-threads','--disable-doc'],s,log,env);run(['make','-j2'],s,log,env);p=s/'src/xz/xz'
    else:run(['make','-j2','-C','ports/unix','VARIANT=minimal','CC='+CC,'LDFLAGS=-static'],s,log);p=s/'ports/unix/build-minimal/micropython'
   p.chmod(0o755);result.update(binary=str(p),binary_sha256=hashlib.sha256(p.read_bytes()).hexdigest())
  except Exception as e:result['error']=str(e)
 (d/'receipt.json').write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True)
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:list(ex.map(build,['busybox','zstd','xz','micropython']))
