#!/bin/sh
apk add -q strace >/dev/null
cd /sc && sh host.sh > /tmp/resp.txt
strace -f -qq -o /tmp/cm.trace ./qjs-static --module codemode.js < /tmp/resp.txt > /tmp/cm.out 2>&1
cat /tmp/cm.out
sed -E 's/^[0-9]+ +//' /tmp/cm.trace | grep -oE '^[a-z_0-9]+\(' | tr -d '(' | sort | uniq -c | sort -rn > /sc/codemode.syscalls
echo "== codemode (qjs only): $(wc -l < /sc/codemode.syscalls) unique, $(wc -l < /tmp/cm.trace) total"; cat /sc/codemode.syscalls
echo "== union hello+codemode:"; cat /sc/hello.syscalls /sc/codemode.syscalls | awk '{print $2}' | sort -u | tr '\n' ' '; echo
echo "== non-mmap failures:"; grep -E '= -1' /tmp/cm.trace
# vDSO-hidden calls: find time symbol usage in the binary
echo "== vdso/time symbols referenced:"; strings -a qjs-static | grep -E '^__vdso_|clock_gettime|gettimeofday' | sort -u | head
