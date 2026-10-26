#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=$(cd "$(dirname "$0")" && pwd)
WORK=${JITK_WORK:-$ROOT/.work}
mkdir -p "$WORK"
if [[ -s $WORK/base.cpio.gz && -s $WORK/vmlinuz ]]; then exit 0; fi
# An existing Debian harness is an explicit, optional external input.
if [[ -n ${JITK_NESTED_BASE:-} ]]; then
 [[ -s $JITK_NESTED_BASE/base.cpio.gz && -s $JITK_NESTED_BASE/vmlinuz ]] || { echo "JITK_NESTED_BASE must contain base.cpio.gz and vmlinuz" >&2; exit 1; }
 cp "$JITK_NESTED_BASE/"{base.cpio.gz,vmlinuz} "$WORK/"
else
 docker run --rm -v "$WORK:/out" debian:trixie sh -c '
 set -e
 apt-get update -qq
 apt-get install -y -qq --no-install-recommends linux-image-arm64 strace cpio gzip util-linux >/dev/null
 cp /boot/vmlinuz-* /out/vmlinuz
 cd /
 find . -xdev \( -path ./proc -o -path ./sys -o -path ./out -o -path ./usr/share/doc -o -path ./usr/share/locale -o -path ./var/lib/apt -o -path ./var/cache \) -prune -o -print | cpio -o -H newc 2>/dev/null | gzip -1 > /out/base.cpio.gz'
fi
