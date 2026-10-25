import pathlib,tarfile,json,hashlib
root=pathlib.Path(__file__).resolve().parent
if not (root/'summary.json').exists():root=root.parent
summary=json.loads((root/'summary.json').read_text())
cells={}
for filename in ['raw-evidence.tar.gz','memory-raw.tar.gz','timing-raw.tar.gz','interleaved-raw.tar.gz']:
    path=root/filename
    if not path.exists():continue
    with tarfile.open(path,'r:gz') as tf:
        for member in tf:
            name=pathlib.PurePosixPath(member.name).name
            if not member.isfile() or not name.endswith('.jsonl') or name.startswith(('ranges-','debug-','smoke-','validated-')):continue
            handle=tf.extractfile(member);first=handle.readline()
            if not first:continue
            env=json.loads(first)
            if env.get('event')!='environment':continue
            counts={kind:0 for kind in ['result','init','failure','bad_child']}
            for ln in handle:
                e=json.loads(ln)
                if e['event'] in counts:counts[e['event']]+=1
            cells[name[:-6]]=dict(environment=env,counts=counts)
errors=[]
for k,r in summary['runs'].items():
    cell=cells.get(k)
    if cell is None:errors.append((k,'missing raw cell'));continue
    if cell['environment']!=r['environment']:errors.append((k,'environment mismatch'))
    counts=cell['counts']
    expect=cell['environment']['n'];mode=cell['environment']['mode'];kind='init' if mode.endswith('init') else 'result'
    if counts[kind]!=expect:errors.append((k,counts,expect))
    if counts['failure'] or counts['bad_child']:errors.append((k,'failed child'))
if summary['validation']['mismatches']:errors.append('pagemap/smaps mismatch')
assert not errors,errors
report=dict(raw_cells=len(cells),summary_cells=len(summary['runs']),sampled_point_reconciliations=summary['validation']['points'],mismatches=0,baseline_children={w:v['union4']['n'] for w,v in summary['baseline'].items()},interleaved_cpu_children={k:v['cpu_ns']['n'] for k,v in summary.get('interleaved',{}).items()},archive_sha256={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in root.glob('*.tar.gz')})
(root/'verification.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k not in ['interleaved_cpu_children','archive_sha256']},indent=2))
