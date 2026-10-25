#!/usr/bin/python3
"""Independent deadline: never loads credentials or parses guest output."""
import os, select, signal, sys
pid, seconds = int(sys.argv[1]), float(sys.argv[2])
ready, _, _ = select.select([0], [], [], seconds)
# Parent closes this pipe after kill/reap. A deadline or parent crash kills VMM.
try:
    os.killpg(pid, signal.SIGKILL)
except ProcessLookupError:
    pass
