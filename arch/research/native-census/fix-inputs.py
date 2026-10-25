#!/usr/bin/env python3
import pathlib,json,subprocess,os,hashlib,concurrent.futures,tarfile
from acquire import get
R=pathlib.Path('/home/dev/r6-census');CC=str(R/'toolchain/musl-install/bin/musl-gcc')
def run(cmd,cwd,log,e=None,data=None):
 log.write(('COMMAND '+repr(cmd)+'\n').encode());log.flush();subprocess.run(cmd,cwd=cwd,env=e,stdout=log,stderr=log,input=data,check=True,timeout=600)
def one(n):
 d=R/'artifacts'/n; result={'name':n}
 with (R/'raw'/('final-build-'+n+'.log')).open('wb') as log:
  try:
   if n=='busybox':
    s=d/'busybox-1.37.0';run(['make','allnoconfig'],s,log);c=(s/'.config').read_text()
    for key in ['STATIC','AWK','SED','GREP','SORT','WC','TAR','GZIP','FEATURE_AWK_LIBM','FEATURE_GREP_CONTEXT','FEATURE_FANCY_GREP','LONG_OPTS']:
     c=c.replace('# CONFIG_'+key+' is not set','CONFIG_'+key+'=y')
    (s/'.config').write_text(c);run(['make','oldconfig'],s,log,data=b'\n'*1000);run(['make','-j2','CC='+CC,'busybox'],s,log);p=s/'busybox';result=json.loads((d/'receipt.json').read_text());result.pop('error',None);result['config']='minimal applet config; raw/busybox.config'
    (R/'raw/busybox.config').write_bytes((s/'.config').read_bytes())
   elif n=='micropython':
    s=d/'micropython-1.27.0';run(['make','-j2','-C','ports/unix','VARIANT=standard','CC='+CC,'LDFLAGS_EXTRA=-static','MICROPY_PY_SSL=0','MICROPY_PY_FFI=0','MICROPY_PY_BTREE=0','FROZEN_MANIFEST='],s,log);p=s/'ports/unix/build-standard/micropython';result=json.loads((d/'receipt.json').read_text());result.pop('error',None);result['config']='standard; SSL/FFI/btree off; frozen manifest empty'
   elif n=='jq-musl':
    d.mkdir(exist_ok=False);j=json.loads((R/'artifacts/jq/release.json').read_text());a=next(a for a in j['assets'] if a['name']=='jq-1.8.2.tar.gz');p=d/a['name'];p.write_bytes(get(a['browser_download_url']));h=hashlib.sha256(p.read_bytes()).hexdigest();assert a['digest']=='sha256:'+h
    with tarfile.open(p) as t:t.extractall(d,filter='data')
    s=d/'jq-1.8.2';e=dict(os.environ,CC=CC,CFLAGS='-O2',LDFLAGS='-static');run(['./configure','--disable-maintainer-mode','--disable-docs','--enable-all-static','--with-oniguruma=builtin'],s,log,e);run(['make','-j2'],s,log,e);p=s/'jq';result.update(version='jq-1.8.2',source=a['browser_download_url'],source_sha256=h,verified=True,config='upstream source; musl all-static, builtin oniguruma')
   result.update(binary=str(p),binary_sha256=hashlib.sha256(p.read_bytes()).hexdigest());p.chmod(0o755)
  except Exception as e:result['error']=repr(e)
 (d/'receipt.json').write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True)
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:list(ex.map(one,['busybox','micropython','jq-musl']))
