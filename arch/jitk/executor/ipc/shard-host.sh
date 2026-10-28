#!/bin/sh
# The executor's Linux shard check from a clean checkout on a Linux arm64 KVM
# host. Every input comes from the jitk cache: `make deps` (pinned Node, shard
# binary built from this tree) and `make -C shard snapshot` (prepared helper
# snapshots); explicit JITK_* variables still win. Then the shard binary's own
# tests and the executor shard suite under the bench lock. run-ssh.ts runs
# this on kvm-dev; on a Linux host run it directly. JITK_SHARD_BENCH=1 adds
# the benchmark.
set -eu
JITK=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
make -C "$JITK" deps
make -C "$JITK/shard" snapshot
eval "$("$JITK/tools/.work/bin/deps" env)"
: "${JITK_SHARD_SNAPSHOT:?no prepared shard snapshot; run make -C arch/jitk/shard snapshot}"
export JITK_NODE JITK_NPM_CLI JITK_SHARD_BINARY JITK_SHARD_SNAPSHOT
cd "$JITK/shard"
PATH=$PATH:${CARGO_HOME:-$HOME/.cargo}/bin cargo "+$(sh ../tools/rust-toolchain.sh)" test --locked --offline --bin real
cd "$JITK/executor"
"$JITK_NODE" "$JITK_NPM_CLI" ci --ignore-scripts --no-audit --no-fund
sh run.sh build
suite='"$JITK_NODE" build/shard-check.js'
if [ "${JITK_SHARD_BENCH:-}" = 1 ]; then
  suite="$suite"' && "$JITK_NODE" build/shard-bench.js'
fi
flock -w "${JITK_SHARD_LOCK_WAIT:-600}" "${JITK_BENCH_LOCK:-/home/dev/bench.lock}" sh -c "$suite"
