#!/bin/sh
set -eu
cd "$(dirname "$0")"
TASK_NODE=${JITK_NODE:?Set JITK_NODE to an absolute Node >=24 executable}
case "$TASK_NODE" in /*) ;; *) echo 'JITK_NODE must be an absolute Node >=24 executable (PATH node may be a Vite+ shim)' >&2; exit 2;; esac
"$TASK_NODE" -e 'if(Number(process.versions.node.split(".")[0])<24)throw Error("Node >=24 required")'
"$TASK_NODE" node_modules/typescript/bin/tsc -p tsconfig.json
"$TASK_NODE" build.mjs
case "${1:-test}" in
 build) ;;
 test|check)
  "$TASK_NODE" build/pool-check.js
  "$TASK_NODE" build/resolve-check.js
  "$TASK_NODE" build/sandbox-check.js
  "$TASK_NODE" build/transport-check.js
  "$TASK_NODE" build/watchdog-check.js
  "$TASK_NODE" build/verify.js
  "$TASK_NODE" build/wrapper-conformance.js
  "$TASK_NODE" build/api-check.js
  "$TASK_NODE" build/policy-check.js
  "$TASK_NODE" build/hyperlight-check.js
  ;;
 certify) "$TASK_NODE" certify.mjs ;;
 demo) "$TASK_NODE" build/demo.js ;;
 bench) "$TASK_NODE" build/breakdown.js ;;
 *) echo 'usage: run.sh [build|test|demo|bench]' >&2; exit 2;;
esac
