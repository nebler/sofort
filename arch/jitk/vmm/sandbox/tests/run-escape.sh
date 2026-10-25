#!/bin/sh
# Sandbox escape suite. usage: run-escape.sh ESCAPE_BIN IMAGE [PROFILE_BLOB]
# Each attack runs twice: control (unconfined; expect ESCAPED) and confined (expect BLOCKED or SIGSYS).
B=$1; IMG=$2; PROF=${3:-}
case "$(uname)" in
  Darwin) A="read-etc-passwd read-home-ssh read-sibling write-tmp socket-connect socket-unix exec-sh fork signal-parent mmap-exec sysctl-hostname mach-lookup";;
  *) A="read-etc-passwd read-sibling write-tmp socket-connect socket-unix exec-sh fork signal-parent mmap-exec open-dev-kvm ioctl-create-vm ptrace-parent unshare-user io-uring bpf seccomp-listener vcpu:open-dev-kvm vcpu:socket-connect vcpu:exec-sh";;
esac
fail=0
for a in $A; do
  c=$(JITK_ESCAPE_CONTROL=1 "$B" "$IMG" "$a" $PROF 2>&1 </dev/null | grep -E "^(ESCAPED|BLOCKED)" | head -1 | sed 's/ rc=[^ ]*//;s/^\([A-Z]*\) [^ ]*/\1/')
  out=$("$B" "$IMG" "$a" $PROF 2>&1 </dev/null); st=$?
  v=$(printf '%s\n' "$out" | grep -E "^(ESCAPED|BLOCKED)" | head -1 | sed 's/ rc=[^ ]*//;s/^\([A-Z]*\) [^ ]*/\1/')
  [ -z "$v" ] && [ $st -eq 159 ] && v=SIGSYS
  [ -z "$v" ] && v="status=$st"
  ok=PASS; case "$v" in BLOCKED*|SIGSYS) ;; *) ok=FAIL; fail=1;; esac
  rm -f /tmp/jitk-07-escape-write
  echo "$ok $a control=${c:-n/a} confined=$v"
done
exit $fail
