#!/bin/sh
set -eu
cd "$(dirname "$0")"
# First invocation only: create a private reflink copy, then patch it once.
# cp -cR /tmp/jitk-01/r2/libkrun /tmp/jitk-06/r2/libkrun
# python3 instrument-static.py
RUSTUP_TOOLCHAIN=1.95.0 CARGO_BUILD_JOBS=2 CARGO_PROFILE_RELEASE_PANIC=abort make -C /tmp/jitk-06/r2/libkrun FFI=0 target/release/libkrun.2.0.0.dylib
RUSTUP_TOOLCHAIN=1.95.0 rustc --edition=2024 -O -C lto=fat -C panic=abort host-static.rs --extern krun=/tmp/jitk-06/r2/libkrun/target/release/deps/libkrun.rlib -L dependency=/tmp/jitk-06/r2/libkrun/target/release/deps -o /tmp/jitk-06/r2/host-static
codesign -f -s - --entitlements /tmp/jitk-06/lib/chroot_vm.entitlements /tmp/jitk-06/r2/host-static
