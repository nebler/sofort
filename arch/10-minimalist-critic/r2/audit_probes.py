#!/usr/bin/env python3
"""Counterexample to the R1 packer's segment-only W^X check; layout arithmetic."""
import contextlib, io, json, pathlib, runpy, struct
root = pathlib.Path('/tmp/jitk-10/r2/audit'); root.mkdir(exist_ok=True)
pack = runpy.run_path(str(pathlib.Path(__file__).resolve().parent.parent/'pack_elf.py'))['pack']
raw = bytearray(4096)
raw[:16] = b'\x7fELF\x02\x01\x01'+bytes(9)
struct.pack_into('<HHIQQQIHHH', raw, 16, 2, 183, 1, 0x400100, 64, 0, 0, 64, 56, 2)
struct.pack_into('<IIQQQQQQ', raw, 64, 1, 5, 0, 0x400000, 0, 0x800, 0x800, 4096)
struct.pack_into('<IIQQQQQQ', raw, 120, 1, 6, 0x800, 0x400800, 0, 0x800, 0x800, 4096)
elf = root/'shared-page.elf'; elf.write_bytes(raw)
with contextlib.redirect_stdout(io.StringIO()): pack(str(elf), str(root/'packed'))
manifest = json.loads((root/'packed/qjs.json').read_text())
result = dict(r1_packer_accepts_same_page_rx_rw=True, manifest=manifest,
    user_stack_pa_end=hex(0x81000000+0x2000000-0x400000),
    guest_32m_pa_end=hex(0x80000000+32*1024*1024),
    old_user_va_limit_pa_end=hex(0x81000000+0x2400000-0x400000),
    note='RX/RW byte ranges are disjoint but require conflicting 4-KiB page permissions. 32-MiB RAM ends before the old stack.')
pathlib.Path(__file__).with_name('audit-probes.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(result, indent=2))
