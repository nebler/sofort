"""Minimal churn reproducer; run as root on Linux with suite.py and JITK_BIN."""
import suite

suite.BASE.parent.joinpath('cgroup.subtree_control').write_text('+memory +cpu')
suite.BASE.mkdir()
(suite.BASE / 'cgroup.subtree_control').write_text('+memory +cpu')
try:
    for i in range(200):
        print('REPRO_START', i, flush=True)
        vm = suite.VM()
        try:
            vm.ready()
            vm.run()
        finally:
            vm.close()
        print('REPRO_DONE', i, flush=True)
finally:
    for vm in list(suite.LIVE):
        vm.close()
    suite.BASE.rmdir()
