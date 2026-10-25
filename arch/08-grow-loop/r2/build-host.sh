#!/bin/sh
set -eu
cd "$(dirname "$0")"
L=/tmp/jitk-spike/libkrun
mkdir -p /tmp/jitk-08/r2
clang -Wl,-headerpad_max_install_names host.c -I"$L/include" -L"$L/target/release" -lkrun -Wl,-rpath,"$L/target/release" -o /tmp/jitk-08/r2/host
install_name_tool -change libkrun.2.dylib "$L/target/release/libkrun.2.0.0.dylib" /tmp/jitk-08/r2/host
codesign --force --sign - --entitlements "$L/examples/chroot_vm.entitlements" /tmp/jitk-08/r2/host
