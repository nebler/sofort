#!/bin/sh
set -e
apk add -q build-base git strace >/dev/null
cd /tmp && git clone -q --depth 1 https://github.com/bellard/quickjs.git && cd quickjs
make -s CONFIG_LTO= LDFLAGS=-static qjs >/dev/null 2>&1 || make -s LDFLAGS=-static qjs
file ./qjs 2>/dev/null || true; ls -la qjs
cp qjs /sc/qjs-static
cd /sc
trace() { name=$1; shift
  strace -f -qq -o /tmp/$name.trace "$@" > /tmp/$name.out 2>&1 || true
  echo "== $name: output"; head -c 400 /tmp/$name.out; echo
  sed -E 's/^[0-9]+ +//' /tmp/$name.trace | grep -oE '^[a-z_0-9]+\(' | tr -d '(' | sort | uniq -c | sort -rn > /sc/$name.syscalls
  echo "== $name: $(wc -l < /sc/$name.syscalls) unique syscalls, $(wc -l < /tmp/$name.trace) total calls"; cat /sc/$name.syscalls
  grep -E 'ENOSYS|= -1' /tmp/$name.trace | head -5
}
trace hello ./qjs-static hello.js
sh host.sh > /tmp/resp.txt
trace codemode sh -c './qjs-static --module codemode.js < /tmp/resp.txt'
