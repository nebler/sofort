#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=$(cd "$(dirname "$0")" && pwd)
WORK=${JITK_WORK:-$ROOT/.work}
mkdir -p "$WORK"
docker run --rm -v "$ROOT:/kit:ro" -v "$ROOT/../vmm:/vmm:ro" -v "$WORK:/work" -e JITK_WORK=/work -e CARGO_HOME=/work/cargo-linux -e DEBIAN_FRONTEND=noninteractive rust:1.95-slim bash -c '
set -e
apt-get update -qq && apt-get install -y -qq --no-install-recommends python3 make gcc git ca-certificates >/dev/null
cd /kit
./build-linux.sh
'
