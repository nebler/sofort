#!/bin/sh
set -eu
cd "$(dirname "$0")"
out=/tmp/jitk-06/r2
mkdir -p "$out"
cp /tmp/jitk-06/libkrun/target/release/libkrun.2.0.0.dylib "$out/libkrun.2.dylib"
codesign -f -s - "$out/libkrun.2.dylib"
clang -O2 -Wl,-headerpad_max_install_names host.c -I/tmp/jitk-06/lib -L"$out" -lkrun.2 -o "$out/host"
install_name_tool -change libkrun.2.dylib "$out/libkrun.2.dylib" "$out/host"
codesign -f -s - --entitlements /tmp/jitk-06/lib/chroot_vm.entitlements "$out/host"
clang -O2 control.c -o "$out/control"
clang -O2 control.c -framework Hypervisor -o "$out/control-hvf"
clang -O2 -DKRUN -Wl,-headerpad_max_install_names control.c -I/tmp/jitk-06/lib -L"$out" -lkrun.2 -framework Hypervisor -o "$out/control-krun"
install_name_tool -change libkrun.2.dylib "$out/libkrun.2.dylib" "$out/control-krun"
codesign -f -s - "$out/control-krun"
rustc +1.95.0 -O -C panic=abort control.rs -o "$out/control-rust"
# 01's final libkrun is read-only input; no rebuilding its checkout here.
cp /tmp/jitk-01/r2/jitk-vmm "$out/jitk-vmm"
RUSTUP_TOOLCHAIN=1.95.0 rustc --edition=2024 -O -C lto=fat -C panic=abort --cfg bench final-host.rs --extern krun=/tmp/jitk-01/r2/libkrun/target/release/deps/libkrun.rlib -L dependency=/tmp/jitk-01/r2/libkrun/target/release/deps -o "$out/vmm-final"
strip -x "$out/vmm-final"
codesign -f -s - --entitlements /tmp/jitk-06/lib/chroot_vm.entitlements "$out/vmm-final"
