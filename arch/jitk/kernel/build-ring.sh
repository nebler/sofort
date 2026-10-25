#!/bin/sh
set -eu
cd "$(dirname "$0")"
export CARGO_TARGET_DIR=${CARGO_TARGET_DIR:-$PWD/target-ring}
export JITK_ELF=${JITK_ELF:-$PWD/payload/qjs-ring}
if [ ! -f "$JITK_ELF" ]; then
  echo 'Build the ring-only payload in a Linux VM: payload/ring-rng/build.sh NEW_EMPTY_WORK' >&2
  exit 1
fi
export JITK_SCRIPT="$(cat ring-bootstrap.js)"
export RUSTFLAGS="${RUSTFLAGS:-} -C link-arg=--defsym=__ring_arena=0x81800000"
mkdir -p dist/ring
cargo build --locked --offline --release --target aarch64-unknown-none --features transport-ring
OBJCOPY=${OBJCOPY:-llvm-objcopy}
"$OBJCOPY" -O binary "$CARGO_TARGET_DIR/aarch64-unknown-none/release/jitk-02" dist/kernel-ring.bin
