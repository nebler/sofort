from pathlib import Path
import struct,hashlib,json
p=Path(__file__).parent
b=(p.parent/'qjs-stripped').read_bytes()
assert b[:7] == b'\x7fELF\x02\x01\x01' and struct.unpack_from('<HH',b,16)==(2,183)
u=lambda o:struct.unpack_from('<Q',b,o)[0]
ph=u(32); num=struct.unpack_from('<H',b,56)[0]
assert 0<num<=16 and ph+num*56<=len(b)
segments=[]; end=0
for i in range(num):
 h=ph+i*56; typ,flags,off,va,_,fs,ms,al=struct.unpack_from('<IIQQQQQQ',b,h)
 assert typ not in (2,3)
 if typ!=1:continue
 assert va>=0x400000 and va+ms<=0x680000 and flags&3!=3 and fs<=ms
 assert off+fs<=len(b)
 assert not any((va&~4095)<((e+4095)&~4095) and ((va+ms+4095)&~4095)>(s&~4095) for s,e,_ in segments)
 segments.append((va,va+ms,flags));end=max(end,va+ms)
flat=bytearray((end-0x400000+4095)&~4095)
for i in range(num):
 typ,flags,off,va,_,fs,ms,al=struct.unpack_from('<IIQQQQQQ',b,ph+i*56)
 if typ==1:flat[va-0x400000:va-0x400000+fs]=b[off:off+fs]
Path('qjs.flat').write_bytes(flat)
s=f'pub const ENTRY: usize = {u(24)};\npub const PHDR: usize = {0x400000+ph};\npub const PHNUM: usize = {num};\npub const SEGMENTS: &[(usize,usize,bool,bool)] = &'+repr([(s,e,bool(f&2),bool(f&1)) for s,e,f in segments]).replace('True','true').replace('False','false')+';\n'
(p/'src/packed.rs').write_text(s)

(p/'packed.json').write_text(json.dumps(dict(source_sha256=hashlib.sha256(b).hexdigest(),flat_bytes=len(flat),flat_sha256=hashlib.sha256(flat).hexdigest(),physical_base="0x80080000",segments=segments),indent=2)+"\n")
