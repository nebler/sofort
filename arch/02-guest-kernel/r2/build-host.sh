#!/bin/sh
set -eu
cd "$(dirname "$0")"
K=${JITK_KRUN_BUILD:-/tmp/jitk-01/r2/libkrun/target/release}
rustc +1.95.0 --edition=2024 -C opt-level=3 -C panic=abort -L dependency="$K/deps" --extern krun="$K/libkrun.rlib" host.rs -o /tmp/jitk-02/r2/host-native
codesign --force --sign - --entitlements /tmp/jitk-spike/libkrun/examples/chroot_vm.entitlements /tmp/jitk-02/r2/host-native
