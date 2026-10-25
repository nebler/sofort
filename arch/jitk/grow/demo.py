#!/usr/bin/env python3
"""Explicit replay/live growth presentation, followed by two fresh v2 VM boots."""
import argparse, sys, time
from runtime import *

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--fast',action='store_true')
    ap.add_argument('--live',action='store_true',help='generate via real headless CLI and run all fresh growth gates first')
    args=ap.parse_args()
    mode='live' if args.live else 'replay'
    print('DEMO PROPOSALS: '+('LIVE — real headless CLI; fresh growth gates run now.' if args.live else
          'REPLAY — recorded accepted proposals; no model call. Fresh VM executions follow.'),flush=True)
    if args.live:
        run_id='live-demo-'+str(time.time_ns())
        from loop import execute
        options=argparse.Namespace(run_id=run_id,samples=30,live=True,validate_only=True)
        with scratch() as temporary:
            execute(options,pathlib.Path(temporary))
        out=ROOT/'results'/run_id
    else:
        out=ROOT/'results'/json.loads((ROOT/'release.json').read_text())['run']
    report=json.loads((out/'report.json').read_text());select_host();select_gate()
    if args.live: assert report['mode']=='live'
    dest=out/('demo-'+str(time.time_ns()));dest.mkdir()
    start=time.perf_counter();before=load();events=[]
    label='GENERATED THIS RUN' if args.live else 'RECORDED REPLAY'
    def at(second,text):
        if not args.fast: time.sleep(max(0,start+second-time.perf_counter()))
        elapsed=time.perf_counter()-start;print(f'[{elapsed:06.3f}s] {text}',flush=True)
        events.append({'scheduled_seconds':second,'actual_seconds':elapsed,'text':text})
    at(0,f'{label}: canonical kernel copied; ppoll and signal handlers deleted only in the disposable repository.')
    at(3,label+' QuickJS miss:\n'+(out/'qjs-before.missing.json').read_text())
    pp=report['transactions'][0]
    at(7,f'{label} ppoll: Linux oracle → one-file proposal → rebuild → {pp["benchmark"]["n"]} fresh complete probe matches.\n'
          f'Transaction {pp["seconds"]:.3f}s; stage loads saved in report. WFI wait helper retained.')
    at(12,'EXECUTING fresh QuickJS VM on canonical v2 VMM.')
    qinfo,qrec,qout=boot(out/'qjs-after/kernel.bin',dest/'qjs',data=b'ping\n')
    assert qout==b'reply:ping\n' and not any(x['kind']=='missing' for x in qrec)
    at(13,qout.decode().rstrip()+f' (spawn→reap {qinfo["seconds"]:.6f}s; {qinfo["uptime_before"]})')
    at(18,label+' Lua startup miss:\n'+(out/'lua-before-0-run.missing.json').read_text())
    sig=report['transactions'][1]
    at(22,f'{label} {sig["name"]}: explicit ENOSYS profile; no signal state or pointer access.\n'+
          json.loads((out/('tx-'+sig['name'])/'agent.json').read_text())['source'])
    at(25,label+' second miss:\n'+(out/'lua-before-1-run.missing.json').read_text())
    at(28,f'{label}: both signal profiles pass 30 fresh probe VMs each against explicitly ENOSYS-injected Linux.')
    at(31,'EXECUTING fresh Lua VM: sort {9,1,5,3,5}; compute count/sum/max.')
    linfo,lrec,lout=boot(out/'lua-after/kernel.bin',dest/'lua',data=b'')
    assert lout==(out/'lua-linux-normal/linux-00.stdout').read_bytes()
    assert not any(x['kind']=='missing' for x in lrec)
    at(32,lout.decode().rstrip()+f' (spawn→reap {linfo["seconds"]:.6f}s; {linfo["uptime_before"]})')
    at(38,f'{label}: Lua output matches normal Linux, {report["lua_vm"]["n"]}/{report["lua_vm"]["n"]} fresh VMs. '
          f'Explicit Lua profile: {report["kernel_delta_lines"]} LOC. Lua already computes with missing-slot ENOSYS; growth verifies that contract.')
    at(43,f'All VMs reaped. Preparation {report["seconds"]:.3f}s; stage loads saved. '
          'Presentation time excludes preparation. Full Lua syscall equivalence UNVERIFIED.')
    if not args.fast: time.sleep(max(0,start+45-time.perf_counter()))
    receipt={'proposal_mode':mode,'elapsed_seconds':time.perf_counter()-start,'uptime_before':before,'uptime_after':load(),
      'events':events,'qjs_live':qinfo,'lua_live':linfo,'source_run':out.name,
      'kernel_baseline_sha256':report['kernel_baseline_sha256'],
      'qjs_image_sha256':sha(out/'qjs-after/kernel.bin'),'lua_image_sha256':sha(out/'lua-after/kernel.bin'),
      'vmm_sha256':sha(host()),'lua_elf_sha256':sha(ROOT/'payload/lua-static'),
      'qjs_output_hex':qout.hex(),'lua_output_hex':lout.hex(),'all_vms_reaped':True}
    dump(dest/'report.json',receipt)
    dump(ROOT/'demo-release.json',{'report':str((dest/'report.json').relative_to(ROOT))})
if __name__=='__main__': main()
