#!/usr/bin/env bash
# Owner 01's canonical source/build only; all output is area 05-owned.
set -Eeuo pipefail
ROOT=$(cd "$(dirname "$0")" && pwd)
WORK=${JITK_WORK:-$ROOT/.work}
mkdir -p "$WORK"
export JITK_VMM_BUILD="$WORK/vmm"
[[ -f "$ROOT/../vmm/sandbox/.READY" ]] || { echo "canonical sandbox not READY" >&2; exit 1; }
python3 "$ROOT/../vmm/build.py"
cp "$JITK_VMM_BUILD/jitk-vmm" "$WORK/jitk-vmm"
cp "$JITK_VMM_BUILD/build.json" "$WORK/build.json"
cc -O2 -Wall -Wextra -Werror "$ROOT/spawn-cg.c" -o "$WORK/spawn-cg"
python3 "$ROOT/build-probes.py"
