#!/bin/sh
# The pinned `zig cc` (../tools/zig-cc.sh) with the jitk image base, without
# debug sections: those name zig's install directory and vary with its global
# cache, so the same inputs would link to different bytes (README.md).
set -eu
exec "$(dirname -- "$0")/../tools/zig-cc.sh" "$@" -Wl,--image-base=0x400000 -Wl,--strip-debug
