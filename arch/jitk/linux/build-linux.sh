#!/usr/bin/env bash
# Native Linux arm64 build of the suite's binaries into $JITK_WORK: the
# canonical libkrun VMM (owner 01's vmm/build.ts, jitk cache entry keyed by its
# inputs, so unchanged sources are not rebuilt), spawn-cg and the seccomp
# probes. All output is area 05-owned. The Mac runs this on kvm-dev over ssh
# (tool.sh build-ssh, nested/build.ts) with JITK_VMM_BUILDER set to the
# shipped builder; on a Linux host the builder is compiled here.
set -Eeuo pipefail
ROOT=$(cd "$(dirname "$0")" && pwd)
WORK=${JITK_WORK:-$ROOT/.work}
mkdir -p "$WORK"
[[ -f "$ROOT/../vmm/sandbox/.READY" ]] || { echo "canonical sandbox not READY" >&2; exit 1; }
export JITK_VMM_ROOT=${JITK_VMM_ROOT:-$ROOT/../vmm}
BUILDER=${JITK_VMM_BUILDER:-}
if [[ -z $BUILDER ]]; then
 make -s -C "$JITK_VMM_ROOT" .work/bin/build
 BUILDER=$JITK_VMM_ROOT/.work/bin/build
fi
"$BUILDER"
VMM=$("$BUILDER" --print-binary)
cp "$VMM" "$WORK/jitk-vmm"
cp "$(dirname "$VMM")/build.json" "$WORK/build.json"
cc -O2 -Wall -Wextra -Werror "$ROOT/spawn-cg.c" -o "$WORK/spawn-cg"
"$ROOT/tool.sh" build-probes
