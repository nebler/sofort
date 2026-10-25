#!/usr/bin/env bash
# 07's base has python3-minimal; suite uses the standard-library thread pool/math.
set -Eeuo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
WORK=${JITK_WORK:-$ROOT/.work}
if [[ ! -f $WORK/stdlib/usr/lib/python3.13/concurrent/futures/thread.py ]]; then
 docker run --rm -v "$WORK:/work" debian:trixie sh -c '
 set -e
 apt-get update -qq
 mkdir -p /work/python-debs /work/stdlib
 cd /work/python-debs
 apt-get download libpython3.13-stdlib >/dev/null
 for f in *.deb; do dpkg-deb -x "$f" /work/stdlib; done'
fi
