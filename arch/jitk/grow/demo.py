#!/usr/bin/env python3
"""Present a fresh accepted run; live/replay both use the single controller."""
import argparse, json, pathlib, time
from runtime import ROOT, scratch
from loop import execute


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--live',action='store_true')
    ap.add_argument('--fast',action='store_true',help='retained for CLI compatibility; no artificial pauses')
    ap.add_argument('--target',action='append')
    ap.add_argument('--sqlite-elf',type=pathlib.Path)
    ap.add_argument('--database',type=pathlib.Path)
    a=ap.parse_args()
    a.run_id='demo-'+str(time.time_ns());a.samples=30;a.validate_only=True
    print('LIVE generation' if a.live else 'REPLAY canonical source; no model call',flush=True)
    with scratch() as temporary: execute(a,pathlib.Path(temporary))
    report=json.loads((ROOT/'results'/a.run_id/'report.json').read_text())
    for tx in report['transactions']:
        gate=tx['acceptance']
        print(f'{tx["name"]}: semantic/error/state cases PASS; '
              f'{len(gate["mutations"])} rejected mutations; unchanged integration {gate["unchanged_integration"]}')
    print('Receipts: '+str(ROOT/'results'/a.run_id))


if __name__=='__main__': main()
