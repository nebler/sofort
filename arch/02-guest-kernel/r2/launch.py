#!/usr/bin/env python3
"""External SIGKILL watchdog; console bytes pass directly on stdin/stdout."""
import os,subprocess,sys
from pathlib import Path
base=Path('/tmp/jitk-02/r2')
p=subprocess.Popen([str(base/'host'),sys.argv[1] if len(sys.argv)>1 else str(base/'kernel.bin')])
try:
 sys.exit(p.wait(timeout=float(os.environ.get('JITK_TIMEOUT_SECONDS','30'))))
except subprocess.TimeoutExpired:
 p.kill();p.wait();sys.exit(124)
except BaseException:
 p.kill();p.wait();raise
