#!/usr/bin/env bash
D=$(cd "$(dirname "$0")" && pwd)
"$D/ssh.sh" sudo poweroff 2>/dev/null || kill "$(cat "$D/qemu.pid")"
