#!/usr/bin/env bash
set -Eeuo pipefail
D=/home/dev/a5-linux-ledger
cd "$D"
for ((i=0;i<450;i++)); do
    if test -f bin/linux-final.ready; then break; fi
    sleep 2
done
test -f bin/linux-final.ready
sudo flock /home/dev/bench.lock bin/spawn-cg /sys/fs/cgroup/a5-linux-ledger/control /usr/bin/python3 "$D/harness/ram-search.py" > raw/fc-ram-search.log 2>&1
ram=$(cat bin/fc-ram-mib)
sudo flock /home/dev/bench.lock bin/spawn-cg /sys/fs/cgroup/a5-linux-ledger/control /usr/bin/python3 "$D/harness/ledger.py" snapshot --ram "$ram" > raw/fc-snapshot-create.log 2>&1
bash harness/run-family.sh fc-boot "$ram" > raw/sweep-fc-boot.log 2>&1
bash harness/run-family.sh fc-snapshot "$ram" > raw/sweep-fc-snapshot.log 2>&1
