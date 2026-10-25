#!/bin/sh
set -eu
cd "$(dirname "$0")"
export CARGO_TARGET_DIR=/tmp/jitk-02/target
if [ ! -f /tmp/jitk-02/qjs-stripped ]; then
 cp /tmp/jitk-spike/sc/qjs-static /tmp/jitk-02/qjs-stripped
 /opt/homebrew/opt/llvm@22/bin/llvm-strip /tmp/jitk-02/qjs-stripped
fi
export RUSTFLAGS="-C link-arg=-T$PWD/link.ld"
cargo +1.95.0 build --release --target aarch64-unknown-none "$@"
/opt/homebrew/opt/llvm@22/bin/llvm-objcopy -O binary "$CARGO_TARGET_DIR/aarch64-unknown-none/release/jitk-02" /tmp/jitk-02/kernel.bin
L=/tmp/jitk-spike/libkrun
clang -Wl,-headerpad_max_install_names host.c -I"$L/include" -L"$L/target/release" -lkrun -Wl,-rpath,"$L/target/release" -o /tmp/jitk-02/host
ln -sf "$L/target/release/libkrun.2.0.0.dylib" /tmp/jitk-02/libkrun.2.dylib
install_name_tool -change libkrun.2.dylib "$L/target/release/libkrun.2.0.0.dylib" /tmp/jitk-02/host
codesign --force --sign - --entitlements "$L/examples/chroot_vm.entitlements" /tmp/jitk-02/host
