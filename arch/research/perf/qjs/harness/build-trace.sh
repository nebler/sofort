#!/bin/sh
set -eu
cd /home/dev/w3-qjs-mem
CC=$PWD/musl/bin/musl-gcc
python3 make-trace.py
"$CC" -O1 -g -fwrapv -fno-strict-aliasing -D_GNU_SOURCE '-DCONFIG_VERSION="2026-06-04"' -Itrace-src -c trace-src/quickjs.c -o trace-quickjs.o
"$CC" -O1 -g -DBENCH_TRACE -static -no-pie -Itrace-src census.c trace.c trace-quickjs.o build-O2/dtoa.o build-O2/libregexp.o build-O2/libunicode.o build-O2/cutils.o build-O2/quickjs-libc.o -lm -lpthread -ldl -o bin/trace
"$CC" -O2 -g -static -no-pie -Iquickjs-2026-06-04 census-wire.c build-O2/*.o -lm -lpthread -ldl -o bin/wire
