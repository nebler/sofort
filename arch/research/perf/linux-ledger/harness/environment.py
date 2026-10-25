#!/usr/bin/env python3
import hashlib, json, os, platform, subprocess, time
from pathlib import Path
D=Path('/home/dev/a5-linux-ledger')
paths=['/proc/version','/proc/cpuinfo','/proc/meminfo','/proc/cmdline','/proc/loadavg',
       '/sys/kernel/mm/transparent_hugepage/enabled','/sys/kernel/mm/transparent_hugepage/defrag',
       '/sys/fs/cgroup/cgroup.controllers','/sys/fs/cgroup/cgroup.subtree_control',
       '/sys/fs/cgroup/a5-linux-ledger/memory.max','/sys/fs/cgroup/a5-linux-ledger/memory.swap.max']
data={'unix':time.time(),'label':'NESTED HVF -> KVM','uname':list(platform.uname()),'cpu_count':os.cpu_count(),'page_size':os.sysconf('SC_PAGE_SIZE'),'tick_hz':os.sysconf('SC_CLK_TCK'),'uptime':subprocess.check_output(['uptime'],text=True).strip(),'files':{p:Path(p).read_text() for p in paths if Path(p).exists()},'binary_hashes':{str(p.relative_to(D)):{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in [*(D/'bin').iterdir(),D/'firecracker/release-v1.17.0-aarch64/firecracker-v1.17.0-aarch64'] if p.is_file()},'tools':{name:subprocess.check_output(args,text=True,stderr=subprocess.STDOUT).strip() for name,args in {'glibc':['ldd','--version'],'clang':['clang','--version'],'cc':['cc','--version']}.items()}}
(D/'raw/environment.json').write_text(json.dumps(data,indent=2)+'\n')
