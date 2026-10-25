#!/bin/sh
set -eu
cd /Users/noah/.t3/worktrees/sofort/t3-4b56eaaf
uptime
export JITK_NODE=/tmp/jitk-09/node-real
export JITK_NPM_CLI=/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js
export JITK_VMM_BINARY=/tmp/jitk-01/r3/darwin/jitk-vmm
export HYPERLIGHT_WORKER=/tmp/jitk-09/adapter-target/release/r2-worker
export HYPERLIGHT_SNAPSHOT=/tmp/jitk-09/r3-snapshot
export HYPERLIGHT_JS_SRC=/tmp/jitk-09/hyperlight-js
export JITK_KERNEL_IMAGE="$PWD/arch/jitk/kernel/dist/kernel.bin"
for t in executor executor/policy mcp grow bench bench/hyperlight; do
  python3 arch/jitk/docs/delegate.py "$t" test
done
uptime
