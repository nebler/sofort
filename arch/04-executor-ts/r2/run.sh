#!/bin/sh
set -eu
cd "$(dirname "$0")"
TASK_NODE=${JITK_NODE:-/tmp/jitk-09/node-real}
if [ -f node_modules/typescript/bin/tsc ]; then
  TASK_TSC=node_modules/typescript/bin/tsc
else
  TASK_TSC=../node_modules/typescript/bin/tsc
fi
if [ "${1:-check}" = typecheck ]; then
  exec "$TASK_NODE" "$TASK_TSC" -p tsconfig.json --noEmit
fi
"$TASK_NODE" "$TASK_TSC" -p tsconfig.json
case "${1:-check}" in
  build) : ;;
  check)
    "$TASK_NODE" protocol-test.mjs
    "$TASK_NODE" build/pool-check.js
    "$TASK_NODE" build/transport-check.js
    "$TASK_NODE" build/watchdog-check.js
    "$TASK_NODE" build/verify.js
    "$TASK_NODE" build/wrapper-conformance.js
    "$TASK_NODE" build/api-check.js
    ;;
  bench) "$TASK_NODE" build/bench.js ;;
  idle) "$TASK_NODE" build/idle.js ;;
  plumbing) "$TASK_NODE" build/plumbing.js ;;
  *) echo 'usage: run.sh [check|bench|idle|plumbing|build|typecheck]' >&2; exit 2 ;;
esac
