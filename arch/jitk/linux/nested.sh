#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=$(cd "$(dirname "$0")" && pwd)
WORK=${JITK_WORK:-$ROOT/.work}
python3 -c 'from pathlib import Path; import sys; (Path(sys.argv[1])/".READY").unlink(missing_ok=True)' "$ROOT"
rm -f "$ROOT/out/report.json" "$ROOT/out/report.md"
[[ -s $WORK/kernel.bin && -s $WORK/jitk-vmm ]]
BACKEND=${JITK_NESTED_BACKEND:-ssh}
if [[ $BACKEND == qemu ]]; then
[[ -s $WORK/vmlinuz && -s $WORK/base.cpio.gz ]]
"$ROOT/nested/prepare-stdlib.sh"
mkdir -p "$WORK/stage/work"
cp -R "$WORK/stdlib/usr" "$WORK/stage/"
cp "$ROOT/nested/init" "$WORK/stage/init"
cp "$ROOT/suite.py" "$WORK/stage/work/"
cp "$WORK/"{jitk-vmm,spawn-cg,kernel.bin} "$WORK/stage/work/"
cp "$WORK/"*.bin "$WORK/stage/work/"
printf 'export JITK_HOST_UPTIME=%q\n' "$(uptime)" > "$WORK/stage/work/env.sh"
cp "$WORK/seccomp-probe" "$WORK/"*.bpf "$WORK/stage/work/"
# macOS ships cpio; use it directly rather than installing a packer in another VM.
(cd "$WORK/stage"; find . | cpio -o -H newc 2>/dev/null | gzip -1) > "$WORK/overlay.cpio.gz"
cat "$WORK/base.cpio.gz" "$WORK/overlay.cpio.gz" > "$WORK/test.cpio.gz"
python3 "$ROOT/nested/run-qemu.py" "$WORK" "$ROOT/out/nested.log"
elif [[ $BACKEND == ssh ]]; then
 python3 "$ROOT/nested/run-ssh.py" "$WORK" "$ROOT/out/nested.log"
else
 echo 'JITK_NESTED_BACKEND must be ssh or qemu' >&2; exit 1
fi
python3 - "$ROOT/out" <<'PY'
import json,sys
from pathlib import Path
out=Path(sys.argv[1]);s=(out/'nested.log').read_text(errors='replace');reports=[l[len('JITK_REPORT '):] for l in s.splitlines() if l.startswith('JITK_REPORT ')]
assert reports,'no report from nested guest'
d=json.loads(reports[-1]);loads=json.loads((out/'host-load.json').read_text())
# Annotate only source records, never recurse into the annotations themselves.
for gate in d['gates'].values():
 for k in ['started_unix','ended_unix']:
  if k in gate and loads:gate['outer_host_'+k]=min(loads,key=lambda x:abs(x['unix']-gate[k]))
 for row in gate.get('rows',[])+gate.get('samples',[]):
  if 'unix' in row and loads:row['outer_host']=min(loads,key=lambda x:abs(x['unix']-row['unix']))
(out/'report.json').write_text(json.dumps(d,separators=(',',':'))+'\n')
assert d['status']=='PASS',d.get('error')
PY

python3 "$ROOT/cpu-analysis.py" > "$ROOT/out/cpu-analysis.log"
python3 "$ROOT/summarize.py"
python3 - "$ROOT" "$WORK" <<'PYREADY'
from pathlib import Path
import datetime,hashlib,json,sys
root=Path(sys.argv[1]);w=Path(sys.argv[2]);r=json.loads((root/'out/report.json').read_text())
assert r['status']=='PASS' and r['children_remaining']==0
assert r['gates']['boot']['completed']>=100
assert r['gates']['one_tool']['completed']>=30
assert r['gates']['density']['completed_after_park']>=256
assert all(r['gates'][f'concurrency_{c}']['completed']>=100 for c in range(1,9))
assert {x['parked'] for x in r['gates']['density']['rows']} >= {1,32,64,128,256}
assert {x['mode']:x['n'] for x in r['gates']['cpu_controls']['rows']} == {'setup_only':100,'bare_vm':100}
assert r['gates']['seccomp_kill']['completed']==720
assert r['gates']['fault_guests']['completed']==180
assert r['gates']['parking']['pass'] and r['gates']['parking']['exchanges']==1000
assert r['gates']['seccomp_kill']['pass'] and r['gates']['fault_guests']['pass']
(root/'.READY').write_text(json.dumps({'created_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'label':'NESTED','performance':False,'backend':__import__('os').environ.get('JITK_NESTED_BACKEND','ssh'),'outer_linux_vcpus':r['online_cpus'],'parking_image_sha256':r['gates']['parking']['image_sha256'],'limitations':['nested non-performance only','second QEMU/HVF assertion spin remains; SSH replacement used by default','shared VM guest CPU attribution unverified; see out/cpu-analysis.json'],'report':'out/report.json','report_sha256':hashlib.sha256((root/'out/report.json').read_bytes()).hexdigest(),'artifacts':r['hashes'],'canonical_build':json.loads((w/'build.json').read_text())},indent=2)+'\n')
PYREADY
