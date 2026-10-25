#!/usr/bin/env python3
"""Build-time only ELF64/AArch64 -> flat image + trusted segment manifest.
Sketch: production must add overlap/page-permission checks before signing output.
"""
import hashlib, json, pathlib, struct, sys

def pack(source, directory):
    raw = pathlib.Path(source).read_bytes()
    assert raw[:7] == b'\x7fELF\x02\x01\x01', 'ELF64 little endian required'
    kind, machine, version, entry, phoff, _, _, ehsize, phsize, phnum = struct.unpack_from('<HHIQQQIHHH', raw, 16)
    assert kind == 2 and machine == 183 and version == 1, 'static AArch64 ET_EXEC required'
    assert ehsize == 64 and phsize == 56 and 0 < phnum <= 64
    assert phoff + phsize*phnum <= len(raw)
    segments=[]
    for n in range(phnum):
        typ, flags, off, va, _, filesz, memsz, align = struct.unpack_from('<IIQQQQQQ',raw,phoff+n*phsize)
        assert typ not in (2,3), 'dynamic linking unsupported'
        if typ != 1: continue
        assert filesz <= memsz and off+filesz <= len(raw)
        assert va+memsz < 1<<48 and (flags & 3) != 3, 'W^X required'
        segments.append(dict(va=va,offset=off,filesz=filesz,memsz=memsz,flags=flags))
    assert segments and any(s['flags']&1 and s['va']<=entry<s['va']+s['memsz'] for s in segments)
    base=min(s['va'] for s in segments) & ~4095
    end=max(s['va']+s['memsz'] for s in segments)
    assert end-base <= 32*1024*1024, 'image budget'
    image=bytearray(end-base)
    for s in segments: image[s['va']-base:s['va']-base+s['filesz']]=raw[s['offset']:s['offset']+s['filesz']]
    out=pathlib.Path(directory);out.mkdir(parents=True,exist_ok=True)
    (out/'qjs.flat').write_bytes(image)
    info=dict(entry=entry,base=base,bytes=len(image),sha256=hashlib.sha256(image).hexdigest(),segments=segments)
    (out/'qjs.json').write_text(json.dumps(info,indent=2)+'\n')
    print(json.dumps(info))

if __name__ == '__main__': pack(*sys.argv[1:])
