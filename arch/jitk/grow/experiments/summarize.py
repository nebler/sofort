"""Derive experiment tables from receipts, including failures and invalid trials."""
from collections import Counter, defaultdict
import csv
import json
import re
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
EXP = ROOT/'experiments'


def read(path, default=None):
    return json.loads(path.read_text()) if path.exists() else default


def phase(name):
    meta=read(EXP/(name+'.json'), {})
    transactions=[]
    for cell in meta.get('design', []):
        run_id,target,spec,model,rep=cell
        out=ROOT/'results'/run_id
        tx=read(out/('tx-'+target)/'report.json')
        run=read(out/'experiment.json')
        if tx and run:
            transactions.append(dict(run_id=run_id,target=target,spec=spec,model=model,
                accepted=tx['accepted'],at1=tx['acceptance_at_1'],calls=tx['cli_calls'],
                seconds=run['wall_s'],attempts=tx['attempts'],paused=run['paused']))
    return meta,transactions


def cell_table(transactions):
    lines=['| Model | Target | Spec | N | Accepted @1 | Accepted @3 | CLI calls | Wall s |',
           '|---|---|---|---:|---:|---:|---:|---:|']
    for model in ('old','new'):
        for target in ('ppoll','fstat','pread64'):
            for spec in ('full','terse','none'):
                rows=[t for t in transactions if (t['model'],t['target'],t['spec'])==(model,target,spec)]
                lines.append(f"| {model} | {target} | {spec} | {len(rows)} | {sum(t['at1'] for t in rows)} | {sum(t['accepted'] for t in rows)} | {sum(t['calls'] for t in rows)} | {sum(t['seconds'] for t in rows):.1f} |")
    return '\n'.join(lines)


def pooled_table(transactions):
    lines=['| Model | Spec (targets pooled) | N | Accepted @1 | Accepted @3 |',
           '|---|---|---:|---:|---:|']
    for model in ('old','new'):
        for spec in ('full','terse','none'):
            rows=[t for t in transactions if (t['model'],t['spec'])==(model,spec)]
            lines.append(f"| {model} | {spec} | {len(rows)} | {sum(t['at1'] for t in rows)} | {sum(t['accepted'] for t in rows)} |")
    return '\n'.join(lines)


def main():
    env=read(EXP/'E0-environment.json')
    e0=list(csv.DictReader((EXP/'E0.csv').open()))
    pilot_meta,pilot=phase('E1-pilot');main_meta,main=phase('E1')
    invalid=read(EXP/'pilot-invalid-v1/invalidated.json',{})
    parts=['# GrowOS experiments — 2026-10-26',
        'Functional runs on macOS/HVF only. Wall times describe experiment cost, including CLI latency; no VM performance claim is made.',
        '## Step 0 and pins',
        f"Baseline: 22 grow + 4 oracle tests passed. Current suite: 31 grow + 4 oracle tests passed. Branch: `growos/e0-e1`. Old = `gpt-6-sol`; new = `gpt-6.1-sol`; both use `{env['cli']}` with ignored user config, ephemeral auth and the same CLI flags. No reasoning-effort override is supplied.",
        f"Oracle: `{env['oracle_image']}`. VMM: `{env['vmm_sha256']}`. Per-run kernel file hashes, oracle inspections, prompt hashes and controller hashes are retained in receipts. The SQLite binary/database match the full pinned hashes in README.md.",
        '## E0 — passed 4/5',
        'Four complete original-target runs accepted; ppoll accepted 4/5. The failed run timed out in the 240 s CLI gate before a handler was returned. Its signal targets were not reached. Every returned handler passed its original visible, mutant and integration gates. No held-out split existed for E0.',
        '| Run | Whole run | ppoll wall s | Total CLI calls | Whole-run wall s |',
        '|---|---|---:|---:|---:|']
    for run in sorted({r['run_id'] for r in e0}):
        rows=[r for r in e0 if r['run_id']==run];r=read(ROOT/'results'/run/'experiment.json')
        parts.append(f"| {run[-2:]} | {'PASS' if r['returncode']==0 else 'CLI timeout'} | {float(next(v['wall_s'] for v in rows if v['target']=='ppoll')):.1f} | {sum(int(v['cli_calls']) for v in rows)} | {r['wall_s']:.1f} |")
    parts += ['The failed row’s wall_s is whole-run elapsed time because the original controller did not persist failed-transaction elapsed time. Successful rows use transaction elapsed time. E0 human minutes were not measured. Partial CLI progress was lost on that timeout; later runs now preserve it. No subscription-limit cause is established for E0.',
        '## Visible / held-out prerequisite',
        'Original visible probes are unchanged. A controller-only C probe uses a different archive size, offsets/lengths, bad/closed/directory/unreadable/pipe fds, NULL/unmapped/read-only/wrapping pointers, unaligned stat outputs, 0/16-fd poll boundaries, timeout errors and seek/reopen state checks. Linux runs each variant before proposal generation. Sources, binaries, resource bytes and reference output are hashed. `sealed-inputs.json` explicitly indexes the integration corpus and other trusted source hashes from the pinned Git commit; these inventories are postprocessed and checked against the unchanged files. Held-out sources and host tests stay outside the proposal Git repo and never enter prompts; the CLI has read-only access and proposal calls reject tool invocations.',
        'The canonical handlers pass both sets. All 13 existing mutants still compile, complete and fail semantic checks: ppoll 2, signals 2+2, fstat 3, pread64 4. The 9 real-target mutants fail visible and held-out probes independently. SQLite integrations pass all ten cases for both filesystem targets. See `experiments/split-validation.json` and `results/split-replay-*`.',
        'This is the E2 split prerequisite only. No E2 lint/red-team run, E3, E4 or E5 was performed.',
        '## E1 method and pilot',
        'Each transaction gets up to three fresh proposal calls. full retains the original hand-written spec; terse supplies one sentence; none supplies only the syscall name alongside the visible strace/probe and helper API. Each retry includes the previous candidate source and a rejecting-gate message. Hidden observations, host assertion values, mutants and integration corpus details are withheld from feedback. Acceptance requires every gate, including held-out Linux agreement. Thirty visible repetitions remain; held-out variants run once per candidate. Repetition is not treated as independent semantic coverage.',
        'Pilot and main samples are separate, with N=2 and N=10 per cell respectively, randomized with seed 20261026. The pilot used three concurrent functional transactions. Main completed 22 transactions at concurrency three, then resumed at six after draining all active work; the same seeded design and all samples were retained. A pilot is operational when the matrix and gate accounting work without a known harness defect; low acceptance is a result, not a reason to shrink or select samples. Model comparison is pooled across targets; both terse-only and all-spec pooling are reported. No claim is made that these familiar syscalls are learned from the oracle.',
        f"The first pilot was invalidated by a host-harness module-layout bug: handlers compiled in the real kernel and passed both VM probes but valid `super::` helper imports failed in the host harness. {len(invalid.get('runs',[]))} transactions started and {sum(r['cli_calls'] for r in invalid.get('runs',[]))} CLI calls were spent. Three active transactions were interrupted with cleanup; all v1 samples, including passes, are excluded. A fresh v2 pilot uses the corrected layout. The previously rejected live candidate and a regression test pass the corrected harness. Raw receipts and interrupted logs are retained under the original run IDs.",
        f"Corrected pilot completed: {len(pilot)}/36; accepted: {sum(t['accepted'] for t in pilot)}.",
        cell_table(pilot),pooled_table(pilot),
        '## E1 main',f"Completed: {len(main)}/180; accepted: {sum(t['accepted'] for t in main)}.",
        cell_table(main),pooled_table(main),
        '## Rejections and cost']
    for label,transactions in [('Pilot v2',pilot),('Main',main)]:
        gates=Counter(a['gate'] for t in transactions for a in t['attempts'] if not a['accepted'])
        final=Counter(t['attempts'][-1]['gate'] for t in transactions if not t['accepted'])
        parts.append(f"{label}: {sum(t['calls'] for t in transactions)} CLI calls; {sum(t['seconds'] for t in transactions):.1f} summed transaction wall seconds (concurrent, not elapsed batch time). All rejecting attempts: `{dict(gates)}`. Final transaction failures: `{dict(final)}`.")
    analysis=read(EXP/'failure-analysis.json',{})
    for key,label in [('pilot','Pilot v2'),('main','Main')]:
        parts.append(f"{label} diagnostic categories: `{analysis.get(key,{}).get('counts',{})}`.")
    parts.append('Real build failures include cast/comparison syntax and incorrect helper/module imports, including super::fs where the real filesystem module is crate::fs. The retained prompt labels the syscall parent helpers but does not explicitly label the filesystem module location; first-attempt results include that API-layout inference. Held-out failures include fd argument narrowing and validation/errno precedence. Guest fatal/incomplete protocols and CLI response failures remain failures in the CSV. The invalidated host-only module-layout defect is accounted separately above.')
    for label,transactions in [('Pilot v2',pilot),('Main',main)]:
        usage=Counter();metered=0
        for tx in transactions:
            for path in (ROOT/'results'/tx['run_id']).glob('tx-*/attempt-*/agent-usage.json'):
                for entry in read(path,[]):
                    if isinstance(entry,dict):
                        metered+=1;usage.update({k:v for k,v in entry.items() if isinstance(v,int)})
        parts.append(f"{label} CLI-reported token totals ({metered} metered calls): `{dict(usage)}`. Cached/reasoning fields are subsets, not additional tokens or a subscription balance. No dollar-cost estimate is inferred.")
    parts.append('`semantic_error_state_i` means the visible differential; `heldout_candidate` means the sealed differential; `build_candidate` is Rust compilation; `independent_full_stat_and_state` is the host ABI/state harness. CSV labels are retained exactly.')
    parts += ['Every attempt is in the CSV and its `rejection.json`; raw diagnostic details remain outside prompts. Raw artifacts remain locally in results; large generated binaries/bundles are git-ignored and covered by per-run `artifacts.json` hashes. CLI JSON usage, where returned, is retained in `agent-usage.json`.',
        'Sampling human_minutes=0 / human_lines=0 means no interactive human coding or coaching occurred during those calls. Prior human profile/spec/API work and brief preparation were not measured, so an amortized human-minutes-per-accepted-syscall headline is unavailable. The implementation agent also wrote gate/runner changes and repaired the host harness; this authoring effort is separate from candidate generation and must not be described as zero-cost oracle preparation.',
        '## Decision',]
    if len(main)==180 and not any(t['paused'] for t in main):
        def score(model,spec=None):
            rows=[t for t in main if t['model']==model and (spec is None or t['spec']==spec)]
            return sum(t['accepted'] for t in rows),len(rows)
        old,new=score('old'),score('new');old_terse,new_terse=score('old','terse'),score('new','terse')
        parts.append(f"New terse @3: {new_terse[0]}/{new_terse[1]}; old terse @3: {old_terse[0]}/{old_terse[1]}. All-spec pooled @3: new {new[0]}/{new[1]}, old {old[0]}/{old[1]}. Terse threshold (new model ≥50%): {'PASS' if new_terse[0]*2>=new_terse[1] else 'FAIL'}. Newer strictly higher, pooling all specs/targets: {'PASS' if new[0]>old[0] else 'FAIL'}; pooling targets at terse only: {'PASS' if new_terse[0]>old_terse[0] else 'FAIL'}.")
        passed=new_terse[0]*2>=new_terse[1] and new[0]>old[0]
        parts.append('E1 pass predicate (all-spec pooled comparison): '+('PASS.' if passed else 'NOT MET.')+' E2 as a whole and E3 remain untested, so no positive GrowOS decision-table row is established. The terse-only model comparison is tied. The observed all-spec improvement is only two transactions out of 90 per model; this sample does not support a strong or statistically resolved amplifier claim. The near-zero-without-full kill condition is not met.')
        parts.append('Both final failures are older-model pread64 transactions. The none-spec transaction copied 9000 bytes for an invalid oversized count, corrupting probe memory and producing a guest fault on all three attempts. The full-spec transaction failed visible protocol checks twice, then passed the visible probe but rejected a valid fd after missing Linux’s 32-bit fd argument narrowing. No other main transaction exhausted three attempts.')
    else:
        parts.append('E1 is incomplete; no E1 decision-table outcome or amplifier claim is established yet.')
    parts += ['## Scope, portability and limitations',
        '`profiles.py`: explicit visible/heldout paths; mutants derive from canonical known bugs rather than candidate formatting. `loop.py`: optional probe source, external held-out/reference builds, tests removed from proposal copies, host-harness layout adapter and passed/failed stage receipts. `agent.py`: spec levels, feedback, JSON usage/tool audit, timeout progress retention and an isolated Claude adapter. `retries.py`: bounded attempts and sanitized public messages. No kernel or grow-ts code was changed. Claude flags/schema/auth handling are unit tested only and are not part of the two-Codex-model comparison.',
        'This measures generation of restricted leaf handlers using substantial existing helper code and human-authored visible probes/specs. It does not establish general Linux ABI equivalence, oracle learning, an automatically generated oracle, multi-file kernel growth, transfer to unseen programs, production isolation or runtime performance. Repeated prompts may yield duplicate handlers; these are repeated CLI trials, not distinct semantic discoveries.',
        f"Disk at initial step 0: 88 GiB free; E0 batch before/after: {env['disk_before'].splitlines()[-1]} / {env['disk_after'].splitlines()[-1]}. Latest: {subprocess.check_output(['df','-h','/System/Volumes/Data'],text=True).splitlines()[-1]}. Each batch/run checks the 15 GiB stop threshold.",
        'All experiments use --validate-only. grow/release.json and grow/.READY retain their initial hashes. No push or promotion was performed.']
    history=subprocess.check_output(['git','log','--reverse','--format=%h %s','793d2c3..HEAD'],text=True).strip()
    parts += ['## Pre-report commits', '```text\n'+history+'\n```', 'The final receipts/report commit is identified by the head SHA in the thread reply.']
    document=re.sub(r'(?m)(^\|.*\|)\n\n(?=\|)',r'\1\n','\n\n'.join(parts))
    (ROOT/'EXPERIMENTS-2026-10-26.md').write_text(document+'\n')
    (EXP/'summary.json').write_text(json.dumps({'pilot':pilot,'main':main},indent=2)+'\n')
    print('pilot',len(pilot),sum(t['accepted'] for t in pilot),'main',len(main),sum(t['accepted'] for t in main))


if __name__=='__main__':
    main()
