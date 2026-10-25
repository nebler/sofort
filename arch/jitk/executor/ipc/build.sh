#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
[ "$(uname -s)" = Linux ] || { echo 'shared-memory bridge requires Linux' >&2; exit 1; }
: "${JITK_NODE:?absolute Node executable required}"
NODE_INCLUDE=${JITK_NODE_INCLUDE:-$(dirname "$JITK_NODE")/../include/node}
mkdir -p build
${CC:-cc} -std=c11 -O2 -Wall -Wextra -Werror -Wno-unused-parameter -fPIC -shared \
  -I"$NODE_INCLUDE" ipc/bridge.c -o build/shard-ipc.node
