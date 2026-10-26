#!/usr/bin/env bash
# Whole-process benchmark driver, never invoked on a runtime/call path.
set -euo pipefail
cd "$(dirname "$0")"
export PATH=/home/dev/.cargo/bin:"$PATH"
cargo build --release --offline
mkdir -p results
sudo flock /home/dev/bench.lock bash -euo pipefail -c '
  ./target/release/jitk-shard selftest > results/selftest.jsonl
  ./target/release/jitk-shard density > results/density.jsonl
  ./target/release/jitk-shard reset 1000 > results/reset-1000.jsonl
  ./target/release/jitk-shard reset 10000 > results/reset-10000.jsonl
  ./target/release/jitk-shard wait 1024 > results/wait-1024.jsonl
  ./target/release/jitk-shard wait 1 > results/promise-1.jsonl
'
./tool.sh summarize results
