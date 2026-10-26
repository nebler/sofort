#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ -n "${JITK_LINUX_TOOLS:-}" ]; then
  exec "$JITK_LINUX_TOOLS" "$@"
fi
JITK_LINUX_ROOT=${JITK_LINUX_ROOT:-$ROOT}
export JITK_LINUX_ROOT
case $(uname -s) in
  Darwin) make -s -C "$ROOT" build build-linux; binary=$ROOT/build/mac/linux-tools ;;
  Linux) binary=$ROOT/build/linux/linux-tools ;;
  *) echo 'unsupported linux tools platform' >&2; exit 1 ;;
esac
if [ ! -x "$binary" ]; then
  echo 'build Linux tools on the Mac with make build-linux, then copy build/linux/' >&2
  exit 1
fi
exec "$binary" "$@"
