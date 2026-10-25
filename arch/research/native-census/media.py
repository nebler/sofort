#!/usr/bin/env python3
import pathlib,json,hashlib,tarfile,wave,math,struct
from acquire import get
import census
R=census.R;d=R/'artifacts/ffmpeg';d.mkdir(exist_ok=False)
j=json.loads(get('https://api.github.com/repos/BtbN/FFmpeg-Builds/releases/latest'));(d/'release.json').write_text(json.dumps(j,indent=2));a=next(x for x in j['assets'] if x['name']=='ffmpeg-master-latest-linuxarm64-lgpl.tar.xz');b=get(a['browser_download_url']);p=d/a['name'];p.write_bytes(b);h=hashlib.sha256(b).hexdigest();assert a['digest']=='sha256:'+h
c=next(x for x in j['assets'] if x['name']=='checksums.sha256');checks=get(c['browser_download_url']);(d/c['name']).write_bytes(checks);assert h.encode() in checks
with tarfile.open(p) as t:t.extractall(d/'unpacked',filter='data')
p=next((d/'unpacked').rglob('ffmpeg'));(d/'receipt.json').write_text(json.dumps(dict(name='ffmpeg',version=j['tag_name'],source=a['browser_download_url'],source_sha256=h,verified=True,binary=str(p),note='BtbN build, not FFmpeg upstream binary; check actual PT_INTERP'),indent=2))
frames=b''.join(struct.pack('<h',int(8000*math.sin(2*math.pi*1000*i/8000))) for i in range(80))
with wave.open(str(census.FIX/'data/tone.wav'),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(8000);w.writeframes(frames)
w=dict(name='ffmpeg',category='media',binary=str(p),argv=['-nostdin','-hide_banner','-loglevel','error','-threads','1','-i','data/tone.wav','-threads','1','-f','s16le','-ac','1','-ar','8000','pipe:1'],stdin_hex='',expected_hex=frames.hex())
census.dump(R/'raw/media-workloads.json',[w]);census.native(w);census.jitk(w)
