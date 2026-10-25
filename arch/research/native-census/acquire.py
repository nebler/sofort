#!/usr/bin/env python3
"""Offline census acquisition in own VM directory; official release digest verification."""
import concurrent.futures, hashlib, json, os, pathlib, re, tarfile, urllib.request, zipfile
ROOT=pathlib.Path('/home/dev/r6-census'); A=ROOT/'artifacts'
SPECS={
'jq':('jqlang/jq',r'^jq-linux-arm64$'),
'gojq':('itchyny/gojq',r'linux_arm64.tar.gz$'),
'yq':('mikefarah/yq',r'^yq_linux_arm64.tar.gz$'),
'miller':('johnkerl/miller',r'linux-arm64.tar.gz$'),
'dasel':('TomWright/dasel',r'^dasel_linux_arm64$'),
'gron':('tomnomnom/gron',r'linux-arm64.*tar.gz$'),
'rg':('BurntSushi/ripgrep',r'aarch64-unknown-linux-musl.tar.gz$'),
'fd':('sharkdp/fd',r'aarch64-unknown-linux-musl.tar.gz$'),
'sd':('chmln/sd',r'aarch64-unknown-linux-musl.tar.gz$'),
'duckdb':('duckdb/duckdb',r'^duckdb_cli-linux-arm64.zip$'),
'pandoc':('jgm/pandoc',r'linux-arm64.tar.gz$'),
'qsv':('dathere/qsv',r'aarch64-unknown-linux-musl.*zip$'),
}
def get(url):
 req=urllib.request.Request(url,headers={'User-Agent':'sofort-native-census'})
 return urllib.request.urlopen(req,timeout=120).read()
def one(item):
 name,(repo,pattern)=item; d=A/name; d.mkdir(exist_ok=False)
 try:
  release=json.loads(get(f'https://api.github.com/repos/{repo}/releases/latest'))
  (d/'release.json').write_text(json.dumps(release,indent=2))
  assets=[a for a in release['assets'] if re.search(pattern,a['name'])]
  if len(assets)!=1:raise ValueError('asset selection '+str([a['name'] for a in assets])+'; available '+str([a['name'] for a in release['assets']]))
  a=assets[0]; content=get(a['browser_download_url']); p=d/a['name'];p.write_bytes(content)
  digest=hashlib.sha256(content).hexdigest(); published=a.get('digest'); verified=published=='sha256:'+digest
  # Pre-digest release APIs may have checksum companion assets.
  if published and not verified:raise ValueError('digest mismatch')
  checks=[x for x in release['assets'] if x['name'] in (a['name']+'.sha256',a['name']+'.sha256sum') or re.search(r'^(checksums.*|sha256sum.*|.*checksums.txt)$',x['name'],re.I)]
  for c in checks[:2]:
   b=get(c['browser_download_url']);(d/c['name']).write_bytes(b)
   if digest.encode() in b:verified=True
  if not verified:raise ValueError('no matching published SHA256; do not execute')
  if tarfile.is_tarfile(p):
   with tarfile.open(p) as t:t.extractall(d/'unpacked',filter='data')
  elif zipfile.is_zipfile(p):
   with zipfile.ZipFile(p) as z:z.extractall(d/'unpacked')
  else:p.chmod(0o755)
  result=dict(name=name,version=release['tag_name'],release_url=release['html_url'],asset_url=a['browser_download_url'],asset_sha256=digest,verified=verified)
 except Exception as e:result=dict(name=name,error=str(e))
 (d/'receipt.json').write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True);return result
if __name__=='__main__':
 A.mkdir(exist_ok=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:result=list(ex.map(one,SPECS.items()))
 (ROOT/'raw/acquisition.json').write_text(json.dumps(result,indent=2))
