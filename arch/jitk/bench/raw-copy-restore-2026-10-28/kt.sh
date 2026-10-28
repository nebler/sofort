#!/bin/sh
# kt.sh TREE [cargo test args...]: shard KVM lib tests under the bench lock.
set -eu
T=$1; shift
cd /home/dev/r10-reset/$T/arch/jitk/shard
export PATH=$PATH:$HOME/.cargo/bin JITK_CACHE=/home/dev/r10-reset/cache
eval "$(/home/dev/r10-reset/cache/node/v24.22.1-linux-arm64/bin/node snapshot.ts env)"
cargo +1.95.0 build --release --locked --offline --bin real 2>&1 | grep -E "^(error|warning)" || true
JITK_SHARD_TEST_BINARY=$PWD/target/release/real flock /home/dev/bench.lock timeout ${KT_TIMEOUT:-300} cargo +1.95.0 test --locked --offline --lib -- --ignored --nocapture "$@" 2>&1 | grep -vE "^\s+(Compiling|Finished|Running)"
