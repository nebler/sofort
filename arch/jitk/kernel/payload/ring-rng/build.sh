#!/bin/sh
# Run only inside a Linux arm64 VM. WORK must not already exist.
set -eu
test "$(uname -s)" = Linux && test "$(uname -m)" = aarch64
recipe=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
work=$1
mkdir "$work"
cd "$work"
mkdir quickjs musl
if [ -n "${JITK_QJS_ARCHIVE:-}" ]; then cp "$JITK_QJS_ARCHIVE" quickjs/source.tar.xz
else curl -fL https://bellard.org/quickjs/quickjs-2026-06-04.tar.xz -o quickjs/source.tar.xz; fi
if [ -n "${JITK_MUSL_ARCHIVE:-}" ]; then cp "$JITK_MUSL_ARCHIVE" musl/source.tar.gz
else curl -fL https://musl.libc.org/releases/musl-1.2.5.tar.gz -o musl/source.tar.gz; fi
cat >sources.sha256 <<'EOF'
b376e839b322978313d929fd20663b11ba58b75df5a46c126dd19ea2fa70ad2a  quickjs/source.tar.xz
a9a118bbe84d8764da0ea0d28b3ab3fae8477fc7e4085d90102b8596fc7c75e4  musl/source.tar.gz
EOF
sha256sum -c sources.sha256
# Independently published Alpine 3.21 musl source checksum (APKBUILD receipt in
# shard/raw-r7-rng/alpine-musl-APKBUILD); QuickJS has no published signature here.
echo '7bb7f7833923cd69c7a1a9b8a5f1784bfd5289663eb6061dcd43d583e45987df8a68a1be05d75cc1c88a3f5b610653d1a70f4a9cff4d8f7fd41ae73ee058c17c  musl/source.tar.gz' | sha512sum -c -
tar -xf quickjs/source.tar.xz -C quickjs
tar -xf musl/source.tar.gz -C musl
qjs=$work/quickjs/quickjs-2026-06-04
musl=$work/musl/musl-1.2.5
test "$(cat "$qjs/VERSION")" = 2026-06-04
test "$(cat "$musl/VERSION")" = 1.2.5
cat "$recipe/musl-reseed.inc" >>"$musl/src/malloc/mallocng/malloc.c"
cp "$recipe/checkpoint.h" "$recipe/chacha.h" "$qjs/"
python3 - "$qjs" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
f=p/'quickjs.c';s=f.read_text()
marker='static void js_random_init(JSContext *ctx)'
assert s.count(marker)==1
s=s.replace(marker,'''/* R7: overwrite the existing context, including saved Math.random references. */
void JS_SetSnapshotRandomSeed(JSContext *ctx, uint64_t seed)
{
    ctx->random_state = seed ? seed : 1;
}

'''+marker);f.write_text(s)
f=p/'quickjs-libc.c';s=f.read_text()
marker='static const JSCFunctionListEntry js_os_funcs[] = {'
assert s.count(marker)==1
s=s.replace(marker,'#include "checkpoint.h"\n\n'+marker+'\n    JS_CFUNC_DEF("snapshotCheckpoint", 0, js_os_snapshot_checkpoint ),')
f.write_text(s)
PY
(
 cd "$musl"
 CFLAGS='-O2 -fno-stack-protector' ./configure --prefix="$work/musl-install" --disable-shared
 make -j3
 make install
) >musl-build.log 2>&1
(
 cd "$qjs"
 make -j3 qjs CC="$work/musl-install/bin/musl-gcc" \
   CFLAGS='-O2 -g -Wall -fwrapv -fno-strict-aliasing -fno-stack-protector -D_GNU_SOURCE -DCONFIG_VERSION=\"2026-06-04\"' \
   LDFLAGS='-static -no-pie -Wl,-z,max-page-size=4096' LDEXPORT=
) >quickjs-build.log 2>&1
cp "$qjs/qjs" qjs-ring.debug
strip -o qjs-ring qjs-ring.debug
sha256sum qjs-ring qjs-ring.debug "$recipe"/* >build-hashes.txt
cc --version >compiler.txt
readelf -l qjs-ring >elf.txt
nm qjs-ring.debug >symbols.txt
