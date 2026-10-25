#!/bin/sh
set -eu
cd /work/lua-5.4.8/src
make -j2 posix MYCFLAGS='-O2 -fno-pie' MYLDFLAGS='-static -no-pie'
cp lua /work/lua-static
cd /work/sqlite-amalgamation-3500400
gcc -O2 -static -no-pie shell.c sqlite3.c -lpthread -ldl -lm -o /work/sqlite3-static
gcc -O2 /review/oracle/no-vdso.c -o /work/no-vdso
strip /work/lua-static /work/sqlite3-static
readelf -h -l /work/lua-static > /work/lua-elf.txt
readelf -h -l /work/sqlite3-static > /work/sqlite-elf.txt
gcc --version
apk info -v musl gcc binutils strace
sha256sum /work/lua-static /work/sqlite3-static
