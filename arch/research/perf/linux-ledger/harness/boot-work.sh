#!/usr/bin/env bash
set -Eeuo pipefail
D=/home/dev/a5-linux-ledger
cd "$D"
for ((i=0;i<900;i++)); do
    if test -f raw/snapshot.json; then break; fi
    sleep 2
done
test -f raw/snapshot.json
ram=$(cat bin/fc-ram-mib)
for kind in jitk jitk-no-thp jitk-malloc-no-thp fc-boot fc-snapshot hl-process hl-shared bare-process bare-shared; do
    sudo flock /home/dev/bench.lock bin/spawn-cg /sys/fs/cgroup/a5-linux-ledger/control /usr/bin/python3 "$D/harness/ledger.py" boot --kinds "$kind" --ram "$ram" --n 30 > "raw/boot-$kind.log" 2>&1
done
