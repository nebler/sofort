#!/usr/bin/env python3
"""Remove only this task's build outputs, after all measurement processes exit."""
import hashlib,json,shutil,subprocess,time
from pathlib import Path
D=Path('/home/dev/a5-linux-ledger');CG=Path('/sys/fs/cgroup/a5-linux-ledger')
def du():return int(subprocess.check_output(['du','-s',str(D)],text=True).split()[0])*1024
live={str(p):p.read_text().strip() for p in CG.rglob('cgroup.procs') if p.read_text().strip()}
assert not live,live
snapshot=json.loads((D/'raw/snapshot.json').read_text())
hashes={name:hashlib.sha256((D/'bin'/name).read_bytes()).hexdigest() for name in snapshot['files']}
assert all(hashes[n]==v['sha256'] for n,v in snapshot['files'].items()),'snapshot backing file changed'
data={'unix':time.time(),'disk_bytes_before':du(),'cgroup_memory_peak':int((CG/'memory.peak').read_text()),'cgroup_memory_events':(CG/'memory.events').read_text(),'live_measurement_cgroups':live,'snapshot_hashes_after_all_restores':hashes,'removed':[]}
for suffix in ['src/linux-6.1.128','src/hl-ledger/target','cargo','harness/__pycache__']:
    p=D/suffix
    assert p.resolve().is_relative_to(D)
    if p.exists():shutil.rmtree(p);data['removed'].append(str(p))
data.update(disk_bytes_after=du(),cgroup_memory_current_after=int((CG/'memory.current').read_text()),uptime_after=subprocess.check_output(['uptime'],text=True).strip())
(D/'raw/cleanup.json').write_text(json.dumps(data,indent=2)+'\n')
print(json.dumps(data,indent=2))
