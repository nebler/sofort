#!/bin/sh
set -eu
exec "${ZIG:-/Users/noah/.local/share/zig-0.16.0/zig}" cc "$@"
