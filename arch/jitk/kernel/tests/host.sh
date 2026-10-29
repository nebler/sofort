#!/bin/sh
# Integrated test CLI adapter: the console kernel on the HVF engine's console
# runner (`hvf console`, shard/src/hvf/console.rs); JITK_TEST_HOST can select
# another positional host.
set -eu
ENGINE=${JITK_SHARD_BINARY:-}
if [ ! -x "$ENGINE" ]; then
 echo 'Set JITK_SHARD_BINARY to the signed hvf engine (make -C arch/jitk deps; macOS arm64).' >&2
 exit 70
fi
exec "$ENGINE" console --image "$@"
