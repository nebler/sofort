#!/bin/sh
set -eu
cd /home/dev/r7-shard
export JITK_SHARD_THREADS=4
export JITK_R7_OUTPUT=/home/dev/r7-shard/raw-review
real=arch/jitk/shard/target/release/real
"$real" stress arena-review mixed 10000 >raw-review/stress-10000.jsonl 2>raw-review/stress-10000.stderr
python3 arch/jitk/shard/harness/wait-r7.py /home/dev/r7-shard "$real" 1024 arena-review >raw-review/wait-1024.json
for n in 1 16 64; do
  for rep in 0 1 2 3 4; do
    "$real" deadlines arena-review spin "$n" >"raw-review/deadlines-$n-$rep.jsonl" 2>"raw-review/deadlines-$n-$rep.stderr"
  done
done
for rep in 0 1 2 3 4; do
  "$real" deadlines arena-review staggered 8 >"raw-review/staggered-$rep.jsonl" 2>"raw-review/staggered-$rep.stderr"
done
python3 arch/jitk/shard/harness/escalation-r7.py /home/dev/r7-shard "$real" arena-review >raw-review/escalation.json
sudo -n env JITK_SHARD_THREADS=4 JITK_LEDGER_ROOT=/home/dev/r7-shard JITK_LEDGER_CGROUP=/sys/fs/cgroup/r7-shard-review JITK_LEDGER_SNAPSHOT=arena-review JITK_LEDGER_OUTPUT=/home/dev/r7-shard/raw-review JITK_LEDGER_FIXTURES='ready return2 one_tool promise10 json64k bomb attack_hold' python3 arch/jitk/shard/harness/ledger-r6.py >raw-review/ledger.log 2>raw-review/ledger.stderr
