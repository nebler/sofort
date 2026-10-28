#!/bin/sh
set -eu
cd "${JITK_R6_ROOT:-$HOME/r6-shard}"
mkdir -p raw
export GLIBC_TUNABLES=glibc.malloc.hugetlb=0
for f in return2 one_tool promise10 json64k; do
  arch/jitk/shard/target/release/real bench final-r6 "$f" 200 >"raw/bench-$f.jsonl" 2>"raw/bench-$f.stderr"
done
arch/jitk/shard/target/release/real bench final-r6 canary 10000 >raw/canary-10000.jsonl 2>raw/canary-10000.stderr
arch/jitk/shard/target/release/real hold final-r6 wait 1024 2 >raw/wait-1024.jsonl 2>raw/wait-1024.stderr
