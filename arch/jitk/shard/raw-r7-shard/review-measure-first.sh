#!/bin/sh
set -eu
cd /home/dev/r7-shard
export JITK_SHARD_THREADS=4
export JITK_R7_OUTPUT=/home/dev/r7-shard/raw-review
real=arch/jitk/shard/target/release/real
for fixture in return2 one_tool promise10 canary; do
  "$real" bench arena-review "$fixture" 200 >"raw-review/bench-$fixture.jsonl" 2>"raw-review/bench-$fixture.stderr"
done
for fixture in bomb arena_attack json64k; do
  "$real" hostile arena-review "$fixture" 100 >"raw-review/hostile-$fixture.jsonl" 2>"raw-review/hostile-$fixture.stderr"
done
"$real" stress arena-review mixed 10000 >raw-review/stress-10000.jsonl 2>raw-review/stress-10000.stderr
arch/jitk/shard/tool.sh wait-r7 /home/dev/r7-shard "$real" 1024 arena-review >raw-review/wait-1024.json
for n in 1 16 64; do
  for rep in 0 1 2 3 4; do
    "$real" deadlines arena-review spin "$n" >"raw-review/deadlines-$n-$rep.jsonl" 2>"raw-review/deadlines-$n-$rep.stderr"
  done
done
for rep in 0 1 2 3 4; do
  "$real" deadlines arena-review staggered 8 >"raw-review/staggered-$rep.jsonl" 2>"raw-review/staggered-$rep.stderr"
done
arch/jitk/shard/tool.sh escalation-r7 /home/dev/r7-shard "$real" arena-review >raw-review/escalation.json
sudo -n env JITK_SHARD_THREADS=4 JITK_LEDGER_ROOT=/home/dev/r7-shard JITK_LEDGER_CGROUP=/sys/fs/cgroup/r7-shard-review JITK_LEDGER_SNAPSHOT=arena-review JITK_LEDGER_OUTPUT=/home/dev/r7-shard/raw-review JITK_LEDGER_FIXTURES='ready return2 one_tool promise10 json64k bomb attack_hold' arch/jitk/shard/tool.sh ledger-r6 >raw-review/ledger.log 2>raw-review/ledger.stderr
