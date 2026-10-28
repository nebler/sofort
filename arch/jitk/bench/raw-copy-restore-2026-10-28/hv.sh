#!/bin/sh
# hv.sh: hostile + stress + idle checks of the after tree's real binary (bench lock held).
set -eu
cd /home/dev/r10-reset/after/arch/jitk/shard
export PATH=$PATH:$HOME/.cargo/bin JITK_CACHE=/home/dev/r10-reset/cache
eval "$(/home/dev/r10-reset/cache/node/v24.22.1-linux-arm64/bin/node snapshot.ts env)"
R=$PWD/target/release/real
S=$JITK_SHARD_TEST_SNAPSHOT
O=/home/dev/r10-reset/out; mkdir -p $O
run() { name=$1; shift; echo "== $name"; "$@" > $O/$name.jsonl 2> $O/$name.err || { echo "FAIL $name"; tail -5 $O/$name.err; exit 1; }; grep -E '"event":"(stress|summary|idle)"' $O/$name.jsonl | tail -1 || true; grep -c contained $O/$name.jsonl || true; }
for p in "verify" "copy-limit=0,verify"; do
  tag=$(echo $p | tr ',=' '__')
  for f in arena_attack bomb json64k; do
    JITK_SHARD_RESET=$p run hostile-$f-$tag $R hostile $S $f 50
  done
done
JITK_SHARD_RESET=verify run stress-verify $R stress $S x ${STRESS_N:-10240}
JITK_SHARD_RESET=copy-limit=0,verify run stress-discard-verify $R stress $S x 2048
JITK_SHARD_RESET=idle-trim-ms=500 run idle-trim $R idle $S one_tool 64
JITK_SHARD_RESET=idle-trim-ms=off run idle-off $R idle $S one_tool 64
JITK_SHARD_RESET=copy-limit=0,idle-trim-ms=off run idle-discard $R idle $S one_tool 64
