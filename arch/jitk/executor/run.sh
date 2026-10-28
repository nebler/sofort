#!/bin/sh
set -eu
cd "$(dirname "$0")"
# Unset artifact variables (node, VMM, Hyperlight) default to the deps cache.
if [ -x ../tools/.work/bin/deps ]; then eval "$(../tools/.work/bin/deps env)"; fi
TASK_NODE=${JITK_NODE:?Set JITK_NODE to an absolute Node >=24 executable, or run make -C arch/jitk deps}
case "$TASK_NODE" in /*) ;; *) echo 'JITK_NODE must be an absolute Node >=24 executable (PATH node may be a Vite+ shim)' >&2; exit 2;; esac
"$TASK_NODE" -e 'if(Number(process.versions.node.split(".")[0])<24)throw Error("Node >=24 required")'
"$TASK_NODE" node_modules/typescript/bin/tsc -p tsconfig.json
"$TASK_NODE" build.mjs
if [ "$(uname -s)" = Linux ] && { [ "${JITK_BACKEND:-}" = shard ] || [ "${1:-}" = shard-test ] || [ "${1:-}" = parity ] || [ -n "${JITK_SHARD_SNAPSHOT:-}" ]; }; then
  JITK_NODE="$TASK_NODE" sh ipc/build.sh
fi
case "${1:-test}" in
 build) ;;
 test|check)
  "$TASK_NODE" build/abi-check.js
  "$TASK_NODE" build/prepared-check.js
  "$TASK_NODE" build/pool-check.js
  "$TASK_NODE" build/resolve-check.js
  "$TASK_NODE" build/sandbox-check.js
  "$TASK_NODE" build/transport-check.js
  "$TASK_NODE" build/shard-sandbox-check.js
  "$TASK_NODE" build/native-check.js
  "$TASK_NODE" build/watchdog-check.js
  "$TASK_NODE" build/verify.js
  "$TASK_NODE" build/wrapper-conformance.js
  "$TASK_NODE" build/api-check.js
  "$TASK_NODE" build/policy-check.js
  if [ "${JITK_SHARD_TEST:-}" = ssh ]; then
    make -s .work/bin/ipc/run-ssh .work/bin/fixtures/shard-peer; .work/bin/ipc/run-ssh
  elif [ -n "${JITK_SHARD_SNAPSHOT:-}" ] && { [ "$(uname -s)" = Linux ] || [ "$(uname -sm)" = 'Darwin arm64' ]; }; then
    # The ring engine's suite: the KVM shard on Linux, the HVF engine on macOS.
    "$TASK_NODE" build/shard-check.js
  fi
  ;;
 shard-test)
  if [ "${JITK_SHARD_TEST:-}" = ssh ]; then make -s .work/bin/ipc/run-ssh .work/bin/fixtures/shard-peer; .work/bin/ipc/run-ssh; else "$TASK_NODE" build/shard-check.js; fi
  ;;
 parity) "$TASK_NODE" build/parity-check.js ;;
 parity-compare) "$TASK_NODE" build/parity-check.js compare .work/parity/*.json ;;
 certify) "$TASK_NODE" certify.mjs ;;
 hvf-parking-gate) "$TASK_NODE" build/hvf-parking-gate.js ;;
 demo) "$TASK_NODE" build/demo.js ;;
 bench) "$TASK_NODE" build/breakdown.js ;;
 *) echo 'usage: run.sh [build|test|shard-test|parity|parity-compare|demo|bench|hvf-parking-gate]' >&2; exit 2;;
esac
