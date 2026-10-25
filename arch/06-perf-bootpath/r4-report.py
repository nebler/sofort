#!/usr/bin/env python3
"""Publish the completed recertification receipt without changing the R3 table."""
import hashlib,json,os,re,shlex,shutil,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'jitk'
BENCH=ROOT/'bench'
raw=Path(sys.argv[1]);d=json.loads(raw.read_text())
assert d.get('finished_at') and 'summary' in d
assert not d['active_owned_pids']
assert len(d['samples']) in (480,960)
assert all(r['status']=='PASS' for r in d['samples'])
for group in d['summary'].values():assert all(r['pairs']==60 for r in group)
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
for selection in d['selection'].values():
 for artifact in ('vmm','image'):
  assert sha(selection[artifact])==selection[artifact+'_sha256']
 for file,expected in selection['harness_sha256'].items():assert sha(BENCH/file)==expected
assert d['selection']['v2']['vmm_sha256']=='276463d01ac6956a095814ed77053989d21bb52a7ef702f5c2698eb98daba20e'
assert d['selection']['baseline']['vmm_sha256']=='73df1ad31afa79274feda85cf386185141e5a08860b513891dc681ad6b91338e'
assert d['selection']['baseline']['image_sha256']==d['selection']['v2']['image_sha256']
# Recheck only our exact frozen VM paths, never any foreign job.
owned={s['vmm'] for s in d['selection'].values()}
survivors=[]
for line in subprocess.check_output(['/bin/ps','-axo','pid=,ppid=,command='],text=True).splitlines():
 fields=line.strip().split(None,2)
 if len(fields)!=3:continue
 try:argv=shlex.split(fields[2])
 except ValueError:continue
 if argv and argv[0] in owned:survivors.append(line)
assert not survivors,survivors
hits=[]
for p in BENCH.rglob('*'):
 if not p.is_file() or any(x in p.parts for x in ('__pycache__','build','target')) or p.suffix not in ('.py','.mjs','.js','.ts','.sh','.rs','.toml','.c','.S'):continue
 for n,line in enumerate(p.read_text().splitlines(),1):
  if re.search(r'/tmp/jitk-\d+|arch/\d\d-',line):hits.append([str(p.relative_to(BENCH)),n,line])
assert not hits,hits
shutil.copy2(raw,BENCH/'r4-raw.json')
smoke=json.loads(Path(sys.argv[2]).read_text())
assert len(smoke['samples'])==8 and all(r['status']=='PASS' for r in smoke['samples'])
receipt={'status':'PASS','finished_at':d['finished_at'],'load_at_verification':list(os.getloadavg()),
 'portable_smoke':{'samples':8,'failures':0,'load1_range':[min(r['load_before'][0] for r in smoke['samples']),max(r['load_before'][0] for r in smoke['samples'])]},
 'historical_provenance':'R3 raw and smoke paths retained as immutable evidence; no executable-source external-area references',
 'external_area_source_references':hits,'surviving_owned_vm_paths':survivors,
 'harness_sha256':d['selection']['v2']['harness_sha256'],'recertify_sha256':sha(BENCH/'recertify.py'),
 'raw_sha256':sha(BENCH/'r4-raw.json')}
(BENCH/'r4-verification.json').write_text(json.dumps(receipt,indent=2)+'\n')
lines=['','---','','## v2 recertification','',f"Run: {d['started_at']} → {d['finished_at']}. Same machine and harness boundaries as R3.",
 f"**{len(d['samples'])}/{len(d['samples'])} validated, zero failures; n=60 per build/case/pass.**",
 'Both builds run in adjacent randomized order within every case/block; cases are also randomized (seed 604).',
 'Gate unchanged from canonical R3: load1 < 6, 1 s/sample budget, 1 s poll. Cold = spawn→validated done;',
 'parked = READY + 5 ms idle, then RUN→validated done; memory = median of five libproc readings before one_tool.',
 'Host sandbox ack and guest READY required for both builds. Each sample uses a fresh VM, killed and reaped.',
 'CI95 is a 2,000-resample percentile bootstrap of complete paired differences (seed 601).',
 'Δ = median(v2_i − baseline_i); positive values favor the R3 build. Marginal medians are shown separately.',
 'Intervals describe this contended run; pairing/bootstrap do not eliminate contention or serial dependence.','',
 f"Continuous setup/collection monitor (0.5 s): load1 **{d['load1_monitor_range'][0]:.2f}–{d['load1_monitor_range'][1]:.2f}**.",
 '**'+d['quiet_pass']+'**','']
units={'latency_ms':'ms','footprint_mib':'MiB footprint','rss_mib':'MiB RSS','cpu_ms_vm':'CPU-ms/VM'}
for name,rows in d['summary'].items():
 lines+=['### '+('Paired contended pass' if name=='paired' else 'Quiet-triggered pass'),'',
 '| Case / metric | R3-build median | v2 median | Paired Δ [CI95] | pairs | load1 range | gated / timed-out |',
 '|---|---:|---:|---:|---:|---:|---:|']
 for r in rows:
  lo,hi=r['paired_ci95'];a,b=r['load1_range'];g=r['gate_passed']
  lines.append(f"| {r['case']} · {units[r['metric']]} | {r['baseline_median']:.3f} | {r['v2_median']:.3f} | {r['paired_median_difference']:+.3f} [{lo:+.3f}, {hi:+.3f}] | {r['pairs']} | {a:.2f}–{b:.2f} | {g} / {r['samples']-g} |")
lines+=['','Artifacts:',
 '- v2 VMM: `'+d['selection']['v2']['vmm_sha256']+'`.',
 '- R3 VMM: `'+d['selection']['baseline']['vmm_sha256']+'`.',
 '- Shared kernel: `'+d['selection']['v2']['image_sha256']+'`.',
 '- Harness/runtime/profile hashes, timestamps, load histories and all samples: [r4-raw.json](r4-raw.json).',
 '- Renamed-copy smoke, unchanged hashes, source-path audit and zero surviving owned VMs: [r4-verification.json](r4-verification.json).','',
 'HEADLINE_PLACEHOLDER','']
p=BENCH/'RESULTS.md';s=p.read_text();assert '## v2 recertification' not in s;p.write_text(s+'\n'.join(lines))
print(json.dumps(d['summary'],indent=2))
