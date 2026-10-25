#!/bin/sh
set -eu
cd /home/dev/w3-qjs-mem
python3 prepare.py > input-hashes.json
CC=$PWD/musl/bin/musl-gcc
SRC=$PWD/quickjs-2026-06-04
for cfg in O2 Os; do
  mkdir -p build-$cfg
  for c in quickjs dtoa libregexp libunicode cutils quickjs-libc; do
    if [ ! -s build-$cfg/$c.o ]; then
      "$CC" -$cfg -g -fwrapv -fno-strict-aliasing -D_GNU_SOURCE '-DCONFIG_VERSION="2026-06-04"' -I"$SRC" -c "$SRC/$c.c" -o build-$cfg/$c.o
    fi
  done
  "$CC" -$cfg -g -static -no-pie -I"$SRC" census.c build-$cfg/*.o -lm -lpthread -ldl -o bin/$cfg
done
# --gc-sections can remove quickjs-libc entirely only when no symbol is referenced.
"$CC" -O2 -g -DMINIMAL -static -no-pie -I"$SRC" census.c build-O2/quickjs.o build-O2/dtoa.o build-O2/libregexp.o build-O2/libunicode.o build-O2/cutils.o -lm -lpthread -ldl -o bin/minimal
file bin/* > binary-types.txt
sha256sum bin/* qjs quickjs-2026-06-04.tar.xz downloads/musl-1.2.5.tar.gz > binary-hashes.txt
