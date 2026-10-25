"""Offline harness lock composition; the full shard runner already holds it."""
import os

def locked(command, wait=None):
    if os.environ.get('JITK_BENCH_LOCK_HELD') == '1':
        return command
    prefix = ['flock']
    if wait is not None:
        prefix += ['-w', str(wait)]
    return prefix + ['/home/dev/bench.lock'] + command
