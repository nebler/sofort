#!/usr/bin/env python3
"""Watch actual gate progress outside the tested VM/process, not heartbeats."""
import argparse
import json
import os
from pathlib import Path
import selectors
import signal
import subprocess
import sys
import time


def run(command, log, *, relay=False, sample_load=True, progress_timeout=None,
        startup_allowance=0, suite_allowance=0):
    limits = {
        'startup_s': float(os.getenv('JITK_STARTUP_TIMEOUT_S', '90')),
        'progress_s': float(os.getenv('JITK_GATE_TIMEOUT_S', '60')),
        'gate_s': float(os.getenv('JITK_GATE_DEADLINE_S', '300')),
        'suite_s': float(os.getenv('JITK_NESTED_TIMEOUT', '900')),
    }
    if progress_timeout is not None:
        limits['progress_s'] = progress_timeout
    limits['startup_s'] += startup_allowance
    limits['suite_s'] += suite_allowance
    if any(value <= 0 for value in limits.values()):
        raise ValueError('watchdog deadlines must be positive')
    log.parent.mkdir(parents=True, exist_ok=True)
    started = last_progress = gate_started = time.monotonic()
    gate = 'startup'
    completed = -1
    loads, events = [], []
    error = None
    pending = b''
    process = None
    last_load = 0
    try:
        with log.open('wb') as output, selectors.DefaultSelector() as selector:
            process = subprocess.Popen(command, stdin=subprocess.DEVNULL,
                                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                       start_new_session=True)
            selector.register(process.stdout, selectors.EVENT_READ)
            while selector.get_map():
                now = time.monotonic()
                if sample_load and now - last_load >= 1:
                    loads.append({'unix': time.time(), 'loadavg': list(os.getloadavg()),
                                  'uptime': subprocess.check_output(['uptime'], text=True).strip()})
                    last_load = now
                for key, _ in selector.select(.2):
                    chunk = os.read(key.fileobj.fileno(), 65536)
                    if not chunk:
                        selector.unregister(key.fileobj)
                        continue
                    output.write(chunk)
                    output.flush()
                    if relay:
                        sys.stdout.buffer.write(chunk)
                        sys.stdout.buffer.flush()
                    pending += chunk
                    while b'\n' in pending:
                        line, pending = pending.split(b'\n', 1)
                        if not line.startswith(b'JITK_GATE '):
                            continue
                        event = json.loads(line[len(b'JITK_GATE '):])
                        event['observer_elapsed_s'] = time.monotonic() - started
                        events.append(event)
                        if event['event'] == 'start':
                            gate = event['gate']
                            gate_started = last_progress = time.monotonic()
                            completed = -1
                        elif event['gate'] == gate:
                            if event['event'] == 'end':
                                gate = 'between gates / report / shutdown'
                                gate_started = last_progress = time.monotonic()
                                completed = -1
                            elif event.get('completed', -1) > completed:
                                completed = event['completed']
                                last_progress = time.monotonic()
                now = time.monotonic()
                idle_limit = limits['startup_s'] if gate == 'startup' else limits['progress_s']
                if now - last_progress > idle_limit:
                    raise TimeoutError(f'gate {gate}: no completed-work progress for {idle_limit:g}s (last completed={completed})')
                if now - gate_started > limits['gate_s'] and gate != 'startup':
                    raise TimeoutError(f'gate {gate}: exceeded absolute {limits["gate_s"]:g}s deadline')
                if now - started > limits['suite_s']:
                    raise TimeoutError(f'suite exceeded {limits["suite_s"]:g}s deadline at gate {gate}')
            return process.wait(timeout=5)
    except BaseException as exc:
        error = repr(exc)
        print(f'JITK_TIMEOUT {error}; log={log}', file=sys.stderr, flush=True)
        raise
    finally:
        if process is not None:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait(timeout=5)
            process.stdout.close()
        receipt = {'wall_s': time.monotonic() - started, 'limits': limits,
                   'error': error, 'returncode': process.returncode if process else None,
                   'events': events}
        (log.parent / 'run-timing.json').write_text(json.dumps(receipt, indent=2) + '\n')
        if sample_load:
            (log.parent / 'host-load.json').write_text(json.dumps(loads, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--log', required=True, type=Path)
    parser.add_argument('command', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ['--'] else args.command
    try:
        # On SSH this is emitted only after acquiring the shared bench lock.
        # The Mac can now enforce progress independently of the queue allowance.
        print('JITK_GATE '+json.dumps({'gate':'suite_startup','event':'start'}), flush=True)
        sys.exit(run(command, args.log, relay=True, sample_load=False))
    except (TimeoutError, ValueError):
        sys.exit(124)
