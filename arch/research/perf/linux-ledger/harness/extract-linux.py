#!/usr/bin/env python3
"""Extract the source needed for tiny arm64, plus every Kconfig/Makefile.
Avoid writing the multi-GiB all-platform tree to the shared Mac backing disk.
"""
import tarfile
from pathlib import Path
ROOT = Path('/home/dev/a5-linux-ledger')
drivers = {'base','char','tty','irqchip','clocksource','of','firmware','clk',
           'cpuidle','cpufreq','acpi','regulator','reset','bus','amba','iommu',
           'rtc','virtio','pinctrl','gpio','power','dma','soc','nvmem','pci','input'}
def keep(name):
    p = Path(name).parts[1:]
    if not p: return True
    if p[-1].startswith(('Kconfig', 'Makefile', 'Kbuild')): return True
    if p[:3] == ('tools','include','tools'): return True
    if p[0] == 'arch': return len(p) < 2 or p[1] in {'arm64','arm','Kconfig'}
    if p[0] == 'drivers': return len(p) < 2 or p[1] in drivers
    return p[0] not in {'Documentation','tools','samples','sound','net'}
with tarfile.open(ROOT/'downloads/linux-6.1.128.tar.xz') as tf:
    tf.extractall(ROOT/'src', members=(m for m in tf if keep(m.name)), filter='data')
