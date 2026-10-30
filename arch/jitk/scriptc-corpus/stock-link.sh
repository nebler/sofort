#!/bin/sh
# scriptc's own `zig cc` link (the pinned zig, ../tools/zig-cc.sh; the same
# bytes as scriptc's default link) without debug sections, as zig-link.sh.
set -eu
exec "$(dirname -- "$0")/../tools/zig-cc.sh" "$@" -Wl,--strip-debug
