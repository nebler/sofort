#!/bin/sh
# `zig cc` with the pinned zig (deps.json "zig"); the SCRIPTC_LINKER for the
# static aarch64 Linux builds. $ZIG wins, then $JITK_ZIG, then the cache entry
# `make -C arch/jitk deps` builds (zigPath() in ../tslib/deps.ts).
set -eu
zig=${ZIG:-${JITK_ZIG:-}}
if [ -z "$zig" ]; then
  deps=$(dirname -- "$0")/.work/bin/deps
  if [ ! -x "$deps" ]; then
    echo "zig-cc.sh: ZIG and JITK_ZIG are unset and $deps is not built; run \`make -C arch/jitk deps\`" >&2
    exit 1
  fi
  zig=$("$deps" path JITK_ZIG)
fi
exec "$zig" cc "$@"
