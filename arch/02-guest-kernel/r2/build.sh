#!/bin/sh
set -eu
cd "$(dirname "$0")"
export CARGO_TARGET_DIR=/tmp/jitk-02/r2/target
if [ ! -f /tmp/jitk-02/qjs-stripped ]; then
 cp /tmp/jitk-spike/sc/qjs-static /tmp/jitk-02/qjs-stripped
 /opt/homebrew/opt/llvm@22/bin/llvm-strip /tmp/jitk-02/qjs-stripped
fi
python3 prepare.py
export RUSTFLAGS="-C link-arg=-T$PWD/link.ld"
cargo +1.95.0 build --release --target aarch64-unknown-none "$@"
/opt/homebrew/opt/llvm@22/bin/llvm-objcopy -O binary "$CARGO_TARGET_DIR/aarch64-unknown-none/release/jitk-02" /tmp/jitk-02/r2/kernel.bin
sh build-host.sh
cp /tmp/jitk-02/r2/host-native /tmp/jitk-02/r2/host
cp launch.py /tmp/jitk-02/r2/launch
