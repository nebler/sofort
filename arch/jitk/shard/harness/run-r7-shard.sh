#!/bin/sh
# Offline measurements only. Invoke under flock "${JITK_BENCH_LOCK:-$HOME/bench.lock}".
set -eu
cd "${JITK_R7_ROOT:-$HOME/r7-shard}"
export JITK_SHARD_THREADS=4
export JITK_R7_OUTPUT="${JITK_R7_OUTPUT:-$PWD/raw-review}"
mkdir -p "$JITK_R7_OUTPUT"
# This runner is invoked under flock. Native subchecks share that outer lock.
export JITK_BENCH_LOCK_HELD=1 JITK_NATIVE_ROOT="$PWD"
JITK_NATIVE_CHECK_OUTPUT="$JITK_R7_OUTPUT/native" make -C arch/jitk/shard test >"$JITK_R7_OUTPUT/native-regression.log" 2>&1
real=arch/jitk/shard/target/release/real
snapshot=${JITK_R7_SNAPSHOT:-arena-review}
for fixture in return2 one_tool promise10 canary; do
  "$real" bench "$snapshot" "$fixture" 200 >"$JITK_R7_OUTPUT/bench-$fixture.jsonl" 2>"$JITK_R7_OUTPUT/bench-$fixture.stderr"
done
for fixture in bomb arena_attack json64k; do
  "$real" hostile "$snapshot" "$fixture" 100 >"$JITK_R7_OUTPUT/hostile-$fixture.jsonl" 2>"$JITK_R7_OUTPUT/hostile-$fixture.stderr"
done
"$real" stress "$snapshot" mixed 10000 >"$JITK_R7_OUTPUT/stress-10000.jsonl" 2>"$JITK_R7_OUTPUT/stress-10000.stderr"
arch/jitk/shard/tool.sh wait-r7 "$PWD" "$real" 1024 "$snapshot" >"$JITK_R7_OUTPUT/wait-1024.json"
for n in 1 16 64; do
  for rep in 0 1 2 3 4; do
    "$real" deadlines "$snapshot" spin "$n" >"$JITK_R7_OUTPUT/deadlines-$n-$rep.jsonl" 2>"$JITK_R7_OUTPUT/deadlines-$n-$rep.stderr"
  done
done
for rep in 0 1 2 3 4; do
  "$real" deadlines "$snapshot" staggered 8 >"$JITK_R7_OUTPUT/staggered-$rep.jsonl" 2>"$JITK_R7_OUTPUT/staggered-$rep.stderr"
done
arch/jitk/shard/tool.sh escalation-r7 "$PWD" "$real" "$snapshot" >"$JITK_R7_OUTPUT/escalation.json"
sudo -n env JITK_SHARD_THREADS=4 JITK_LEDGER_ROOT="$PWD" \
  JITK_LEDGER_CGROUP="${JITK_LEDGER_CGROUP:-/sys/fs/cgroup/r7-shard-replay}" \
  JITK_LEDGER_SNAPSHOT="$snapshot" JITK_LEDGER_OUTPUT="$JITK_R7_OUTPUT" \
  JITK_LEDGER_FIXTURES='ready return2 one_tool promise10 json64k bomb attack_hold' \
  arch/jitk/shard/tool.sh ledger-r6 >"$JITK_R7_OUTPUT/ledger.log" 2>"$JITK_R7_OUTPUT/ledger.stderr"
arch/jitk/shard/tool.sh analyze-r7-shard "$JITK_R7_OUTPUT"
