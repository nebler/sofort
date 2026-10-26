#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
make -C "$root" .work/linux/build
mkdir -p /tmp/jitk-01/r3/linux /tmp/jitk-01/r3/cargo-linux
# All writable Docker mounts are area 01-owned. The shared source is read-only.
docker run --rm --name jitk-01-r3-build --platform linux/arm64 \
  -v "$root:/vmm:ro" -v /tmp/jitk-01:/tmp/jitk-01 \
  -v "${LIBKRUN_SOURCE:-/tmp/jitk-spike/libkrun}:/source:ro" \
  -e LIBKRUN_SOURCE=/source -e JITK_VMM_BUILD=/tmp/jitk-01/r3/linux \
  -e CARGO_HOME=/tmp/jitk-01/r3/cargo-linux \
  -e DEBIAN_FRONTEND=noninteractive \
  rust:1.95-slim sh -eu -c '
    apt-get update -qq
    apt-get install -y -qq --no-install-recommends make gcc git ca-certificates
    JITK_VMM_ROOT=/vmm /vmm/.work/linux/build
  '
