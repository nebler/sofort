#!/bin/sh
# Builds the reference QuickJS driver (ws.c) natively: Bellard QuickJS
# 2026-06-04, the guest payload's pinned archive (kernel/payload/ring-rng/build.sh),
# unpatched. Output: ../../.work/quickjs-ref/ws. Needs curl (or JITK_QJS_ARCHIVE) and cc.
set -eu
here=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
work=$here/../../.work/quickjs-ref
mkdir -p "$work"
cd "$work"
if [ ! -f source.tar.xz ]; then
  if [ -n "${JITK_QJS_ARCHIVE:-}" ]; then cp "$JITK_QJS_ARCHIVE" source.tar.xz
  else curl -fL https://bellard.org/quickjs/quickjs-2026-06-04.tar.xz -o source.tar.xz; fi
fi
echo 'b376e839b322978313d929fd20663b11ba58b75df5a46c126dd19ea2fa70ad2a  source.tar.xz' | shasum -a 256 -c - >/dev/null
rm -rf src && mkdir src && tar -xf source.tar.xz -C src
q=src/quickjs-2026-06-04
${CC:-cc} -O2 -fwrapv -fno-strict-aliasing -D_GNU_SOURCE -DCONFIG_VERSION='"2026-06-04"' -I"$q" \
  "$q/quickjs.c" "$q/dtoa.c" "$q/libregexp.c" "$q/libunicode.c" "$q/cutils.c" "$q/quickjs-libc.c" "$here/ws.c" \
  -lm -lpthread -o ws
rm -rf src
echo "$work/ws"
