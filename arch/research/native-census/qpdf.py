#!/usr/bin/env python3
import pathlib,json,subprocess,hashlib
import census
R=census.R;parts=[b'%PDF-1.4\n'];offsets=[]
for i,body in enumerate([b'<< /Type /Catalog /Pages 2 0 R >>',b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>'],1):
 offsets.append(sum(map(len,parts)));parts.append(str(i).encode()+b' 0 obj\n'+body+b'\nendobj\n')
x=sum(map(len,parts));parts.append(b'xref\n0 4\n0000000000 65535 f \n'+b''.join(f'{o:010d} 00000 n \n'.encode() for o in offsets));parts.append(b'trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n'+str(x).encode()+b'\n%%EOF\n');(census.FIX/'data/doc.pdf').write_bytes(b''.join(parts))
lib=':'.join(str(R/'artifacts'/n/'unpacked/usr/lib/aarch64-linux-gnu') for n in ('libqpdf-distro','libjpeg-distro'))
w=dict(name='qpdf',category='documents',binary=str(R/'artifacts/qpdf-distro/unpacked/usr/bin/qpdf'),argv=['--show-npages','data/doc.pdf'],stdin_hex='',expected_hex=b'1\n'.hex(),env={'LD_LIBRARY_PATH':lib})
census.dump(R/'raw/qpdf-workloads.json',[w]);census.native(w);census.jitk(w)
receipts=[]
for name,pkg in [('qpdf-distro','qpdf'),('libqpdf-distro','libqpdf30'),('libjpeg-distro','libjpeg-turbo8')]:
 d=R/'artifacts'/name;p=next(d.glob('*.deb'));info=subprocess.check_output(['apt-cache','show',pkg],text=True);(d/'apt-package.txt').write_text(info);h=hashlib.sha256(p.read_bytes()).hexdigest();assert '\nSHA256: '+h in info;receipts.append(dict(package=pkg,deb=p.name,sha256=h,verified=True))
census.dump(R/'raw/qpdf-packages.json',receipts)
