#!/bin/sh
set -eu
cd "$(dirname "$0")"
out=/tmp/jitk-01/r2
up=/tmp/jitk-spike/libkrun
export RUSTUP_TOOLCHAIN=1.95.0
rustc --edition=2024 -O -C panic=abort --cfg bench --cfg dynamic measured-main.rs \
    -L "native=$out" -o "$out/dynamic"
install_name_tool -change libkrun.2.dylib "$out/libkrun.2.dylib" "$out/dynamic"
for kind in static-baseline static-lto static-minimal; do
    lib="$up"
    set --
    if [ "$kind" != static-baseline ]; then set -- -C lto=fat -C embed-bitcode=yes; fi
    if [ "$kind" = static-minimal ]; then lib="$out/libkrun"; fi
    rustc --edition=2024 -O -C panic=abort --cfg bench "$@" measured-main.rs \
        --extern "krun=$lib/target/release/deps/libkrun.rlib" \
        -L "dependency=$lib/target/release/deps" -o "$out/$kind"
done
cp "$out/static-baseline" "$out/static-strip"
strip -x "$out/static-strip" "$out/static-minimal"
for kind in dynamic static-baseline static-lto static-minimal static-strip; do
    codesign --force --sign - --entitlements ../hypervisor.entitlements "$out/$kind"
done
