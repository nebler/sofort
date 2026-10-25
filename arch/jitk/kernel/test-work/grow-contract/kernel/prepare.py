#!/usr/bin/env python3
"""Validate/pack a static little-endian AArch64 ELF; no guest ELF parsing."""
from pathlib import Path
import hashlib, json, os, stat, struct, sys
BASE, LIMIT, STACK = 0x400000, 0x680000, 0x1e00000

def archive(root):
    """Read-only resource index: 16-byte header, 24-byte entries, names, data.
    Entry = u32 name_off,name_len,parent,is_dir,a,b; dir: a,b = first child,count
    (children contiguous, byte-sorted); file: a,b = data offset,size. Entry 0 is /."""
    nodes = [(b'', 0, None)]  # (name, parent, path or None for directory)
    dirs, i = [(root, 0)], 0
    while i < len(dirs):  # breadth-first, so each directory's children are contiguous
        path, me = dirs[i]; i += 1
        kids = sorted(os.listdir(path) if path else [], key=os.fsencode)
        first = len(nodes); nodes[me] += (first, len(kids))
        for name in kids:
            raw, full = os.fsencode(name), os.path.join(path, name)
            mode = os.lstat(full).st_mode
            if not (stat.S_ISDIR(mode) or stat.S_ISREG(mode)) or len(raw) > 255:
                raise ValueError(f'unsupported resource (symlink/special/name): {full}')
            nodes.append((raw, me, None if stat.S_ISDIR(mode) else full))
            if stat.S_ISDIR(mode): dirs.append((full, len(nodes) - 1))
    if len(nodes) > 65536: raise ValueError('more than 65536 resource entries')
    names = 16 + 24 * len(nodes); data = names + sum(len(n[0]) for n in nodes)
    table, blob, body = bytearray(), bytearray(), bytearray()
    for node in nodes:
        name, parent, path = node[:3]
        if path is None: a, b, d = node[3], node[4], 1
        else:
            content = open(path, 'rb').read(); a, b, d = data + len(body), len(content), 0; body += content
        table += struct.pack('<6I', names + len(blob), len(name), parent, d, a, b); blob += name
    return b'JITKFS01' + struct.pack('<II', len(nodes), 0) + table + blob + body, len(nodes)

def pack(b):
    def require(ok, why):
        if not ok: raise ValueError(why)
    require(len(b) >= 64 and b[:7] == b'\x7fELF\x02\x01\x01', 'ELF64 little-endian required')
    require(struct.unpack_from('<HH', b, 16) == (2, 183), 'static ET_EXEC AArch64 required')
    entry, ph = struct.unpack_from('<QQ', b, 24)
    entsz, num = struct.unpack_from('<HH', b, 54)
    require(entsz == 56 and 0 < num <= 16 and ph + num * 56 <= len(b), 'invalid program headers')
    segments, loads = [], []
    for i in range(num):
        typ, flags, off, va, _, fs, ms, align = struct.unpack_from('<IIQQQQQQ', b, ph + i*56)
        require(typ not in (2, 3), 'dynamic ELF/interpreter forbidden')
        if typ != 1: continue
        require(flags & 3 != 3, 'W+X segment forbidden')
        require(BASE <= va <= va+ms <= LIMIT and fs <= ms and off+fs <= len(b), 'segment outside payload arena')
        require(align in (0, 1) or (align & (align-1) == 0 and (va-off) % align == 0), 'invalid segment alignment')
        if ms == 0: continue
        lo, hi = va & ~4095, (va+ms+4095) & ~4095
        # Reject even byte-disjoint RX/RW segments when page-rounded extents overlap.
        require(not any(lo < (e+4095)&~4095 and hi > s&~4095 for s,e,_ in segments), 'PT_LOAD segments share a page')
        segments.append((va, va+ms, flags)); loads.append((off,va,fs))
    require(segments and any(s <= entry < e and f & 1 for s,e,f in segments), 'entry must be in executable segment')
    phdr = next((va+ph-off for off,va,fs in loads if off <= ph and ph+num*56 <= off+fs), None)
    require(phdr is not None, 'program header table must be loaded')
    flat = bytearray((max(e for _,e,_ in segments)-BASE+4095)&~4095)
    for off,va,fs in loads: flat[va-BASE:va-BASE+fs] = b[off:off+fs]
    meta = dict(source_sha256=hashlib.sha256(b).hexdigest(), flat_bytes=len(flat),
                flat_sha256=hashlib.sha256(flat).hexdigest(), physical_base='0x80080000',
                segments=segments, entry=entry, phdr=phdr, phnum=num)
    return flat, meta

def main():
    source, out = Path(sys.argv[1]), Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
    flat, meta = pack(source.read_bytes())
    resources = os.environ.get('JITK_RESOURCES')
    fs, entries = archive(resources)
    fs_va = BASE + len(flat)
    heap = max(LIMIT, (fs_va + len(fs) + 4095) & ~4095)
    if heap + 0x180000 + 0x400000 > STACK: raise ValueError('resources leave <4 MiB mmap arena')
    meta.update(resources=dict(dir=resources, sha256=hashlib.sha256(fs).hexdigest(), bytes=len(fs),
                               entries=entries, va=hex(fs_va), heap=hex(heap)))
    (out/'payload.flat').write_bytes(flat + fs)
    s = f'pub const FS: usize = {fs_va};\npub const FS_LEN: usize = {len(fs)};\npub const HEAP: usize = {heap};\n'
    s += ''.join(f'pub const {name}: usize = {meta[key]};\n' for name,key in [('ENTRY','entry'),('PHDR','phdr'),('PHNUM','phnum')])
    s += 'pub const SEGMENTS: &[(usize,usize,bool,bool)] = &[' + ','.join(f'({a},{b},{str(bool(f&2)).lower()},{str(bool(f&1)).lower()})' for a,b,f in meta['segments']) + '];\n'
    (out/'packed.rs').write_text(s)
    (out/'packed.json').write_text(json.dumps(meta, indent=2)+'\n')
if __name__ == '__main__': main()
