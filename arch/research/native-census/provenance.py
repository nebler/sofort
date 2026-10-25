#!/usr/bin/env python3
import pathlib,json,hashlib,subprocess,shutil
R=pathlib.Path('/home/dev/r6-census');D=R/'raw/provenance';D.mkdir(exist_ok=True)
for d in (R/'artifacts').iterdir():
 if not d.is_dir():continue
 dest=D/d.name;dest.mkdir(exist_ok=True)
 for pattern in ('receipt.json','release.json','release-final.json','npm-release.json','apt-package.txt','*.sha256','upstream.sha256'):
  for p in d.glob(pattern):shutil.copyfile(p,dest/p.name)
for name in ('musl','go'):
 d=R/'toolchain'/name;dest=D/('toolchain-'+name);dest.mkdir(exist_ok=True)
 for p in d.glob('*'):
  if p.is_file() and p.suffix not in ('.gz','.xz'):shutil.copyfile(p,dest/p.name)
receipt={'source_tar_sha256':hashlib.sha256((R/'kernel.tar.gz').read_bytes()).hexdigest(),'vmm_sha256':hashlib.sha256((R/'bin/jitk-vmm').read_bytes()).hexdigest(),'kernel_source_hashes':{str(p.relative_to(R/'kernel')):hashlib.sha256(p.read_bytes()).hexdigest() for p in (R/'kernel').rglob('*') if p.is_file() and '__pycache__' not in p.parts},'scripts':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in R.glob('*.py')},'disk_use':subprocess.check_output(['du','-sh',str(R)],text=True).strip()}
for name,cmd in {'ffmpeg':[next((R/'artifacts/ffmpeg/unpacked').rglob('ffmpeg')),'-version'],'git':[R/'artifacts/git-distro/git','--version'],'curl':[R/'artifacts/curl-distro/curl','--version'],'go':[R/'toolchain/go/go/bin/go','version'],'musl':[R/'toolchain/musl-install/bin/musl-gcc','--version']}.items():
 p=subprocess.run([str(x) for x in cmd],capture_output=True);(D/(name+'-version.txt')).write_bytes(p.stdout+p.stderr)
(R/'raw/provenance.json').write_text(json.dumps(receipt,indent=2)+'\n')
