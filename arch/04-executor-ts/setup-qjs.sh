#!/bin/sh
set -eu
mkdir -p /tmp/jitk-04
curl -fL https://bellard.org/quickjs/quickjs-2026-06-04.tar.xz -o /tmp/jitk-04/quickjs.tar.xz
printf '%s  %s\n' b376e839b322978313d929fd20663b11ba58b75df5a46c126dd19ea2fa70ad2a /tmp/jitk-04/quickjs.tar.xz | shasum -a 256 -c -
tar -xf /tmp/jitk-04/quickjs.tar.xz -C /tmp/jitk-04
make -C /tmp/jitk-04/quickjs-2026-06-04 -j4 qjs
# Optional supplied static guest for the Docker compatibility experiments.
cp /tmp/jitk-spike/sc/qjs-static /tmp/jitk-04/qjs-static
