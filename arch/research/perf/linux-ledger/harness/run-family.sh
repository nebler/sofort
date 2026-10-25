#!/usr/bin/env bash
set -Eeuo pipefail
D=/home/dev/a5-linux-ledger
cd "$D"
kind=$1
exec sudo flock /home/dev/bench.lock "$D/bin/spawn-cg" /sys/fs/cgroup/a5-linux-ledger/control /usr/bin/python3 "$D/harness/ledger.py" sweep --kinds "$kind" --reps 2 --ram "${2:-16}"
