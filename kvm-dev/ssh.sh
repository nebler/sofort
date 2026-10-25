#!/usr/bin/env bash
D=$(cd "$(dirname "$0")" && pwd)
exec ssh -i "$D/id_ed25519" -p 2222 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR dev@127.0.0.1 "$@"
