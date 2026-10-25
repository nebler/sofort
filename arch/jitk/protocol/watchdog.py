#!/usr/bin/env python3
"""Independent deadline and parent-pipe lifetime. SIGKILL only the owned group."""
import os,select,signal,sys
pid=int(sys.argv[1]); timeout=float(sys.argv[2])
ready,_,_=select.select([sys.stdin],[],[],timeout)
# EOF means the supervisor died/closed; a deadline must also kill the VM.
if not ready: print('WATCHDOG',flush=True)
try: os.killpg(pid,signal.SIGKILL)
except ProcessLookupError: pass
