#!/bin/sh
# Native, Node-free entrypoint. On Linux an uploaded Mac cross-build
# (make build-linux, then copy build/linux/ and kernel/.work/linux/) wins;
# otherwise this host builds shard-tools and the kernel's tools natively.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
JITK_NATIVE_ROOT=${JITK_NATIVE_ROOT:-$(CDPATH= cd -- "$ROOT/../../.." && pwd)}
export JITK_NATIVE_ROOT
KERNEL=$JITK_NATIVE_ROOT/arch/jitk/kernel
if [ "$(uname -s)" = Linux ] && [ -z "${JITK_TOOLS_DIR:-}" ]; then
  if [ -x "$KERNEL/.work/linux/prepare" ]; then
    JITK_TOOLS_DIR=$KERNEL/.work/linux
  else
    make -s -C "$KERNEL" .work/bin/prepare .work/bin/build-args
    JITK_TOOLS_DIR=$KERNEL/.work/bin
  fi
  export JITK_TOOLS_DIR
fi
if [ -n "${JITK_SHARD_TOOLS:-}" ]; then
  exec "$JITK_SHARD_TOOLS" "$@"
fi
case $(uname -s) in
  Darwin) make -s -C "$ROOT" build; binary=$ROOT/build/mac/shard-tools ;;
  Linux)
    binary=$ROOT/build/linux/shard-tools
    if [ ! -x "$binary" ]; then
      make -s -C "$ROOT" build
      binary=$ROOT/build/native/shard-tools
    fi
    ;;
  *) echo 'unsupported shard tools platform' >&2; exit 1 ;;
esac
exec "$binary" "$@"
