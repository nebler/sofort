#!/bin/sh
set -eu
export JITK_NODE=/tmp/jitk-09/node-real
export JITK_NPM_CLI=/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js
export JITK_VMM_BINARY=/tmp/jitk-01/r3/darwin/jitk-vmm
export JITK_KERNEL_IMAGE="$PWD/arch/jitk/kernel/dist/kernel.bin"
uptime
for t in kernel vmm vmm/sandbox protocol executor executor/policy mcp grow bench bench/hyperlight; do
 python3 arch/jitk/docs/delegate.py "$t" test || exit $?
done
uptime
