#!/bin/sh
# ex.sh: executor-side before/after. Phase 1 (no lock held by caller):
# shard-host.sh per tree = deps + snapshot + `cargo test --bin real` + executor
# build + build/shard-check.js under the bench lock. Phase 2 (takes the lock):
# shard-bench (3 x 300), R9 exloop (3 x 500 per case), R9 exconc cells (3 reps).
set -eu
R=/home/dev/r10-reset
# The executor's npm install scripts call bare `node`: use the pinned one.
export JITK_CACHE=$R/cache PATH=$R/cache/node/v24.22.1-linux-arm64/bin:$PATH:$HOME/.cargo/bin
O=$R/out/ex; mkdir -p $O
if [ "${SKIP_HOST:-}" != 1 ]; then
  for t in before after; do
    echo "== shard-host $t"
    sh $R/$t/arch/jitk/executor/ipc/shard-host.sh > $O/$t-host.log 2>&1 || { echo "FAIL $t"; tail -20 $O/$t-host.log; exit 1; }
    grep -E '"suite"|PASS|status|assertions' $O/$t-host.log | tail -3
  done
fi
for t in before after; do
  cp $R/before/arch/review/raw-r9-perf/prototypes/exloop.mjs $R/$t/arch/jitk/executor/build/
  cp $R/before/arch/review/raw-r9-perf/prototypes/exconc.mjs $R/$t/arch/jitk/executor/build/
done
# Explicit per-tree shard binaries: the cache entries each tree's make deps built.
JITK_NODE=$R/cache/node/v24.22.1-linux-arm64/bin/node
export JITK_SHARD_SNAPSHOT=$R/cache/shard-snapshot/linux-arm64-glue-2m-6b051eae939501e5/helpers
envof() {
  case $1 in
    before) echo "export JITK_SHARD_BINARY=$R/cache/shard/linux-arm64-c99473fa8ea35bb4/real" ;;
    after) echo "export JITK_SHARD_BINARY=$R/cache/shard/linux-arm64-9093502f2c402988/real" ;;
  esac
}
grep -q copy_resets $R/cache/shard/linux-arm64-9093502f2c402988/real
! grep -q copy_resets $R/cache/shard/linux-arm64-c99473fa8ea35bb4/real
exec 9</home/dev/bench.lock
flock 9
for rep in 1 2 3; do
  for t in before after; do
    eval "$(envof $t)"; export JITK_SHARD_BINARY JITK_SHARD_SNAPSHOT
    cd $R/$t/arch/jitk/executor
    JITK_SHARD_BENCH_N=300 $JITK_NODE build/shard-bench.js 2>/dev/null | grep '"summary"' | sed "s/^/{\"rep\":$rep,\"variant\":\"$t\",\"row\":/; s/\$/}/" >> $O/exbench.jsonl
    for c in one_tool return2; do
      if [ $c = one_tool ]; then code='return (await codemode.echo(41))+1'; ex=42; else code='return 2'; ex=2; fi
      r=$(N=500 CODE="$code" EXPECT=$ex $JITK_NODE build/exloop.mjs 2>/dev/null | tail -1)
      echo "{\"rep\":$rep,\"variant\":\"$t\",\"case\":\"$c\",\"r\":$r}" >> $O/exloop.jsonl
    done
  done
done
for rep in 1 2 3; do
  for t in before after; do
    eval "$(envof $t)"; export JITK_SHARD_BINARY JITK_SHARD_SNAPSHOT
    cd $R/$t/arch/jitk/executor
    for cell in 1/1 16/8 64/32 64/64; do
      s=${cell%/*}; c=${cell#*/}
      m=3000; [ $t = before ] && m=${BEFORE_M:-600}
      r=$(SLOTS=$s CONC=$c M=$m OWNERS=4 $JITK_NODE build/exconc.mjs 2>&1 | tail -1)
      echo "{\"rep\":$rep,\"variant\":\"$t\",\"bin\":\"$JITK_SHARD_BINARY\",\"r\":$r}" >> $O/exconc.jsonl
    done
  done
done
tail -4 $O/exbench.jsonl; tail -4 $O/exloop.jsonl; tail -8 $O/exconc.jsonl
