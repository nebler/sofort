#!/bin/sh
set -eu
cd "$(dirname "$0")"
make -s -C .. build/hyperlight-build
exec ../build/hyperlight-build
