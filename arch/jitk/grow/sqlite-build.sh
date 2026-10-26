#!/bin/sh
# Run only inside kvm-dev, in a NEW task-owned directory. The acceptance corpus
# reuses the unchanged census binary; this separately verifies its source recipe.
set -eu
TASK_SQLITE_DIR=${1:?new directory under /home/dev/r7-grow required}
case "$TASK_SQLITE_DIR" in /home/dev/r7-grow/*) ;; *) exit 2;; esac
test ! -e "$TASK_SQLITE_DIR"
mkdir -p "$TASK_SQLITE_DIR"
cd "$TASK_SQLITE_DIR"
curl -fsSLo sqlite.zip https://sqlite.org/2025/sqlite-amalgamation-3500400.zip
if command -v unzip >/dev/null 2>&1; then
  unzip -q sqlite.zip
else
  busybox unzip -q sqlite.zip
fi
source_hash=$(openssl dgst -sha3-256 -r sqlite-amalgamation-3500400/sqlite3.c)
source_hash=${source_hash%% *}
test "$source_hash" = 9145255e83da6529e70121ee4d7a4c88fe83ca4511da0c9ed13d10842df36782
printf 'sqlite3.c SHA3-256 %s\n' "$source_hash"
archive_hash=$(sha256sum sqlite.zip)
printf 'archive SHA256 %s\n' "${archive_hash%% *}"
cd sqlite-amalgamation-3500400
"${JITK_MUSL_CC:?absolute musl-gcc required}" -O2 -static -no-pie shell.c sqlite3.c -lpthread -ldl -lm -o sqlite3-static
strip sqlite3-static
# Recreate the census fixture in this private output directory only.
./sqlite3-static demo.db 'CREATE TABLE n(v); INSERT INTO n VALUES(9),(1),(5),(3),(5);'
sha256sum sqlite3-static demo.db
printf '%s\n' \
  '005073a6c1c0e71c22ad8b752f1ffb6c35c8d913fe91f5795038c7d52cf639ff  sqlite3-static' \
  'f3d4180cd07ad9eed5a674c7ff4e5f6d817eb517029c185f66af862a30eac059  demo.db' \
  | sha256sum --check -
