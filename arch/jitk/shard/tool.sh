#!/bin/sh
# Native, Node-free entrypoint. Cross-build Linux tools on the Mac before upload.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ -n "${JITK_SHARD_TOOLS:-}" ]; then
  exec "$JITK_SHARD_TOOLS" "$@"
fi
JITK_NATIVE_ROOT=${JITK_NATIVE_ROOT:-$(CDPATH= cd -- "$ROOT/../../.." && pwd)}
export JITK_NATIVE_ROOT
case $(uname -s) in
  Darwin) make -s -C "$ROOT" build; binary=$ROOT/build/mac/shard-tools ;;
  Linux) binary=$ROOT/build/linux/shard-tools ;;
  *) echo 'unsupported shard tools platform' >&2; exit 1 ;;
esac
if [ ! -x "$binary" ]; then
  echo 'build shard Linux tools on the Mac with make build-linux, then copy build/linux/' >&2
  exit 1
fi
exec "$binary" "$@"
