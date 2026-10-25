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
python3 -m zipfile -e sqlite.zip .
python3 - <<'PY'
import hashlib, pathlib
p=pathlib.Path('sqlite-amalgamation-3500400/sqlite3.c')
h=hashlib.sha3_256(p.read_bytes()).hexdigest()
assert h=='9145255e83da6529e70121ee4d7a4c88fe83ca4511da0c9ed13d10842df36782',h
print('sqlite3.c SHA3-256',h)
print('archive SHA256',hashlib.sha256(pathlib.Path('sqlite.zip').read_bytes()).hexdigest())
PY
cd sqlite-amalgamation-3500400
"${JITK_MUSL_CC:?absolute musl-gcc required}" -O2 -static -no-pie shell.c sqlite3.c -lpthread -ldl -lm -o sqlite3-static
strip sqlite3-static
sha256sum sqlite3-static
