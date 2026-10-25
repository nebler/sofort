#!/usr/bin/env python3
import concurrent.futures,hashlib,json,os,pathlib,subprocess,tarfile
from acquire import get
R=pathlib.Path('/home/dev/r6-census');CC=str(R/'toolchain/musl-install/bin/musl-gcc')
def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def run(cmd,cwd,log,env=None):
 log.write(('COMMAND '+repr(cmd)+'\n').encode());log.flush();subprocess.run(cmd,cwd=cwd,env=env,stdout=log,stderr=log,check=True,timeout=600)
def fetch_release(name,repo,tag,filename):
 d=R/'artifacts'/name;d.mkdir(exist_ok=True);j=json.loads(get(f'https://api.github.com/repos/{repo}/releases/{"latest" if tag is None else "tags/"+tag}'));(d/'release-final.json').write_text(json.dumps(j,indent=2));a=next(a for a in j['assets'] if a['name']==(filename or 'xz-'+j['tag_name'].lstrip('v')+'.tar.gz'));b=get(a['browser_download_url']);p=d/a['name'];p.write_bytes(b);hash=h(p)
 verified=a.get('digest')=='sha256:'+hash
 if not verified:
  c=next(a for a in j['assets'] if a['name']==p.name+'.sha256');cbytes=get(c['browser_download_url']);(d/c['name']).write_bytes(cbytes);assert hash.encode() in cbytes;verified=True
 assert verified
 with tarfile.open(p) as t:t.extractall(d,filter='data')
 return d,dict(name=name,version=j['tag_name'],source=a['browser_download_url'],source_sha256=hash,verified=True),d/p.name.removesuffix('.tar.gz')
def one(name):
 result={'name':name};d=R/'artifacts'/name;d.mkdir(exist_ok=True)
 with (R/'raw'/('finish-'+name+'.log')).open('wb') as log:
  try:
   if name=='zstd':
    d,result,s=fetch_release(name,'facebook/zstd','v1.5.7','zstd-1.5.7.tar.gz');run(['make','-j2','-C','programs','zstd','CC='+CC,'LDFLAGS=-static','HAVE_THREAD=0','ZSTD_LEGACY_SUPPORT=0'],s,log);p=s/'programs/zstd'
   elif name=='xz':
    d,result,s=fetch_release(name,'tukaani-project/xz',None,None);e=dict(os.environ,CC=CC,CFLAGS='-O2',LDFLAGS='-static');run(['./configure','--disable-shared','--enable-static','--disable-nls','--disable-threads','--disable-doc'],s,log,e);run(['make','-j2'],s,log,e);p=s/'src/xz/xz'
   elif name=='gron':
    e=dict(os.environ,PATH=str(R/'toolchain/go/go/bin')+':/usr/bin:/bin',GOBIN=str(d),GOPATH=str(R/'toolchain/gopath'),GOCACHE=str(R/'toolchain/gocache'),CGO_ENABLED='0',GOTOOLCHAIN='local',GOMAXPROCS='2');run(['go','install','-trimpath','-ldflags=-s -w -buildid=','github.com/tomnomnom/gron@v0.7.1'],R,log,e);p=d/'gron';result.update(version='v0.7.1',source='https://github.com/tomnomnom/gron/tree/v0.7.1',verified='Go module checksum database; see go.sum/module cache')
   elif name=='esbuild':
    j=json.loads(get('https://registry.npmjs.org/@esbuild/linux-arm64/latest'));b=get(j['dist']['tarball']);import base64
    alg,expected=j['dist']['integrity'].split('-',1);assert base64.b64encode(hashlib.new(alg,b).digest()).decode()==expected;p=d/'package.tgz';p.write_bytes(b);(d/'npm-release.json').write_text(json.dumps(j,indent=2))
    with tarfile.open(p) as t:t.extractall(d,filter='data')
    p=d/'package/bin/esbuild';result.update(version=j['version'],source=j['dist']['tarball'],source_sha256=h(d/'package.tgz'),verified=j['dist']['integrity'])
   elif name=='busybox':
    result=json.loads((d/'receipt.json').read_text());result.pop('error',None);p=d/'busybox-1.37.0/busybox';assert p.exists()
   elif name=='micropython':
    result=json.loads((d/'receipt.json').read_text());result.pop('error',None);p=d/'micropython-1.27.0/ports/unix/build-minimal/micropython';assert p.exists()
   result.update(binary=str(p),binary_sha256=h(p));p.chmod(0o755)
  except Exception as ex:result['error']=repr(ex)
 (d/'receipt.json').write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True)
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:list(ex.map(one,['zstd','xz','gron','esbuild','busybox','micropython']))
