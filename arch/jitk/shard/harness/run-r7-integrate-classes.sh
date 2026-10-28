#!/bin/sh
# Offline larger-class certification. Invoke under the bench lock
# (${JITK_BENCH_LOCK:-/home/dev/bench.lock}) after
# preparing qjs-glue-4m with the selected linked layouts.
set -eu
cd "${JITK_R7_ROOT:-$HOME/r7-integrate}"
export JITK_SHARD_THREADS=4
out=${JITK_R7_CLASS_OUTPUT:-$PWD/raw-classes}
mkdir -p "$out"
real=arch/jitk/shard/target/release/real
for class in glue-4m; do
  for fixture in return2 one_tool promise10 canary json64k; do
    "$real" bench "qjs-$class" "$fixture" 3 >"$out/bench-$class-$fixture.jsonl" 2>"$out/bench-$class-$fixture.stderr"
  done
  for fixture in bomb arena_attack; do
    "$real" hostile "qjs-$class" "$fixture" 100 >"$out/hostile-$class-$fixture.jsonl" 2>"$out/hostile-$class-$fixture.stderr"
  done
  sudo -n env JITK_SHARD_THREADS=4 JITK_LEDGER_ROOT="$PWD" \
    JITK_LEDGER_CGROUP="/sys/fs/cgroup/r7-integrate-$class" \
    JITK_LEDGER_SNAPSHOT="qjs-$class" JITK_LEDGER_FIXTURES=attack_hold \
    JITK_LEDGER_OUTPUT="$out/$class" \
    arch/jitk/shard/tool.sh ledger-r6 >"$out/ledger-$class.log" 2>&1
done
