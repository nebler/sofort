#!/bin/sh
set -eu
cd "$(dirname "$0")"
mkdir -p /tmp/jitk-08/r2
export CARGO_TARGET_DIR=/tmp/jitk-08/r2/target
export JITK_ELF=${JITK_ELF:-/tmp/jitk-08/r2/qjs-stripped}
if [ ! -f "$JITK_ELF" ]; then
 cp /tmp/jitk-spike/sc/qjs-static "$JITK_ELF"
 /opt/homebrew/opt/llvm@22/bin/llvm-strip "$JITK_ELF"
fi
export RUSTFLAGS="-C link-arg=-T$PWD/kernel/link.ld"
cargo +1.95.0 build --manifest-path kernel/Cargo.toml --locked --offline --release --target aarch64-unknown-none "$@"
/opt/homebrew/opt/llvm@22/bin/llvm-objcopy -O binary "$CARGO_TARGET_DIR/aarch64-unknown-none/release/jitk-02" /tmp/jitk-08/r2/kernel.bin
