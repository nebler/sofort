#!/bin/sh
# The pinned `zig cc` (../tools/zig-cc.sh) with only the jitk image base added.
set -eu
exec "$(dirname -- "$0")/../tools/zig-cc.sh" "$@" -Wl,--image-base=0x400000
