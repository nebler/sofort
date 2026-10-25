#!/usr/bin/env python3
import sys,json,pathlib,hashlib,tarfile,urllib.request,zipfile
sys.path.insert(0,'/home/dev/r6-census');from acquire import get
R=pathlib.Path('/home/dev/r6-census')
# Repair the DuckDB asset selector using the already fetched release catalog.
d=R/'artifacts/duckdb';j=json.loads((d/'release.json').read_text());a=next(x for x in j['assets'] if x['name']=='duckdb-cli-linux-arm64-musl.tar.gz');b=get(a['browser_download_url']);p=d/a['name'];p.write_bytes(b);h=hashlib.sha256(b).hexdigest();assert a['digest']=='sha256:'+h
with tarfile.open(p) as t:t.extractall(d/'unpacked',filter='data')
(d/'receipt.json').write_text(json.dumps(dict(name='duckdb',version=j['tag_name'],release_url=j['html_url'],asset_url=a['browser_download_url'],asset_sha256=h,verified=True),indent=2))
# Official Go toolchain, needed for source-rebuilt gron and musl net tools.
d=R/'toolchain/go';d.mkdir(exist_ok=False);j=json.loads(get('https://go.dev/dl/?mode=json'));a=next(x for x in j[0]['files'] if x['os']=='linux' and x['arch']=='arm64' and x['kind']=='archive');b=get('https://go.dev/dl/'+a['filename']);h=hashlib.sha256(b).hexdigest();assert h==a['sha256'];(d/a['filename']).write_bytes(b);(d/'receipt.json').write_text(json.dumps(dict(file=a,sha256=h),indent=2))
with tarfile.open(d/a['filename']) as t:t.extractall(d,filter='data')
