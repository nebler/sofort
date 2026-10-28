#!/bin/sh
# BPF decision tests + profile shape; pure logic, runs on macOS and Linux.
# Linux compiles the seccomp/rlimit paths, which need the VMM build's libc and libkrun utils rlibs.
# Those are panic=abort, so the Linux test binary is too (test-only use of -Zpanic_abort_tests).
set -e; out=${TMPDIR:-/tmp}/jitk-sandbox-unit.$$
trap 'rm -f "$out"' EXIT HUP INT TERM
if [ "$(uname -s)" = Linux ]; then
 deps=${JITK_VMM_BUILD:-/tmp/jitk-01/r3/linux}/libkrun/target/release/deps
 l=$(ls "$deps"/liblibc-*.rlib 2>/dev/null) && u=$(ls "$deps"/libkrun_utils-*.rlib 2>/dev/null) || { echo "run-unit: build the VMM first (missing rlibs in $deps; set JITK_VMM_BUILD)" >&2; exit 1; }
 set -- -Zpanic_abort_tests -C panic=abort --extern "libc=$l" --extern "utils=$u" -L "dependency=$deps"
 export RUSTC_BOOTSTRAP=1
fi
RUSTUP_TOOLCHAIN=${RUSTUP_TOOLCHAIN:-$(sh "$(dirname "$0")/../../../tools/rust-toolchain.sh")} rustc --edition=2024 --test --crate-name jitk_sandbox -A dead_code "$@" "$(dirname "$0")/../mod.rs" -o "$out"
"$out"; rm -f "$out"
