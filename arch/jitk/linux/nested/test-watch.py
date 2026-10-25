#!/usr/bin/env python3
"""Failure-injection checks for the external watchdog (no VM prerequisites)."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('watch', Path(__file__).with_name('watch.py'))
watch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(watch)


class WatchTests(unittest.TestCase):
    def invoke(self, source, **limits):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / 'test.log'
            env = {'JITK_STARTUP_TIMEOUT_S': '.6', 'JITK_GATE_TIMEOUT_S': '.6',
                   'JITK_GATE_DEADLINE_S': '3', 'JITK_NESTED_TIMEOUT': '5', **limits}
            with patch.dict(os.environ, env), contextlib.redirect_stderr(io.StringIO()):
                try:
                    rc = watch.run([sys.executable, '-u', '-c', source], log, sample_load=False)
                    error = None
                except TimeoutError as exc:
                    rc, error = None, str(exc)
            return rc, error, json.loads((log.parent / 'run-timing.json').read_text())

    def test_stall_ignores_heartbeats_and_duplicate_progress(self):
        rc, error, receipt = self.invoke('''
import time
print('JITK_GATE {"gate":"boot","event":"start"}', flush=True)
for i in range(100):
 print('heartbeat', flush=True)
 print('JITK_GATE {"gate":"boot","event":"progress","completed":1}', flush=True)
 time.sleep(.1)
''')
        self.assertIsNone(rc)
        self.assertIn('gate boot: no completed-work progress', error)
        self.assertLess(receipt['wall_s'], 2)
        self.assertLess(receipt['returncode'], 0)

    def test_absolute_gate_deadline_despite_real_progress(self):
        _, error, receipt = self.invoke('''
import time
print('JITK_GATE {"gate":"density","event":"start"}', flush=True)
for i in range(100):
 print('JITK_GATE {"gate":"density","event":"progress","completed":%d}' % i, flush=True)
 time.sleep(.1)
''', JITK_GATE_DEADLINE_S='.7')
        self.assertIn('gate density: exceeded absolute', error)
        self.assertLess(receipt['wall_s'], 2)

    def test_silent_startup(self):
        _, error, receipt = self.invoke('import time; time.sleep(10)')
        self.assertIn('gate startup', error)
        self.assertLess(receipt['wall_s'], 2)

    def test_suite_deadline_across_gate_transitions(self):
        _, error, receipt = self.invoke('''
import json,time
for i in range(100):
 print('JITK_GATE '+json.dumps({'gate':str(i),'event':'start'}), flush=True)
 time.sleep(.1)
 print('JITK_GATE '+json.dumps({'gate':str(i),'event':'end'}), flush=True)
''', JITK_NESTED_TIMEOUT='.7')
        self.assertIn('suite exceeded', error)
        self.assertLess(receipt['wall_s'], 2)

    def test_success_and_nonzero_exit_propagate(self):
        for code in [0, 7]:
            rc, error, receipt = self.invoke(f'''
import sys
print('JITK_GATE {{"gate":"smoke","event":"start"}}', flush=True)
print('JITK_GATE {{"gate":"smoke","event":"end"}}', flush=True)
sys.exit({code})
''')
            self.assertEqual(rc, code)
            self.assertIsNone(error)
            self.assertEqual(receipt['returncode'], code)


if __name__ == '__main__':
    unittest.main()
