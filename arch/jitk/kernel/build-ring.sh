#!/bin/sh
set -eu
cd "$(dirname "$0")"
export CARGO_TARGET_DIR=${CARGO_TARGET_DIR:-$PWD/target-ring}
export JITK_SCRIPT="$(cat ring-bootstrap.js)"
mkdir -p dist/ring
cargo build --locked --offline --release --target aarch64-unknown-none --features transport-ring
OBJCOPY=${OBJCOPY:-llvm-objcopy}
"$OBJCOPY" -O binary "$CARGO_TARGET_DIR/aarch64-unknown-none/release/jitk-02" dist/kernel-ring.bin
