#!/bin/sh
set -eu
cd /home/dev/r7-shard
PATH=/home/dev/.cargo/bin:$PATH cargo +stable test --offline --manifest-path arch/jitk/shard/Cargo.toml >raw-review/final-unit-tests.log 2>&1
arch/jitk/shard/target/release/jitk-shard selftest >raw-review/final-assembly-selftest.jsonl 2>raw-review/final-assembly-selftest.stderr
for fixture in bomb arena_attack json64k; do
  arch/jitk/shard/target/release/real hostile arena-review "$fixture" 3 >"raw-review/final-hostile-$fixture.jsonl" 2>"raw-review/final-hostile-$fixture.stderr"
done
sha256sum arch/jitk/kernel/dist/kernel-ring.bin arch/jitk/kernel/payload/qjs-ring arch/jitk/shard/target/release/real arena-review.mem arena-review.regs arena-review.layout >raw-review/final-artifact-hashes.txt
readelf -sW arch/jitk/kernel/target-ring/aarch64-unknown-none/release/jitk-02 >raw-review/kernel-symbols.txt
sudo -n rmdir /sys/fs/cgroup/r7-shard-review
