#!/bin/sh
set -eu
# --resources DIR packs DIR read-only as the guest's / (same as JITK_RESOURCES=DIR).
if [ "${1:-}" = --resources ]; then JITK_RESOURCES=$(cd "$2" && pwd); export JITK_RESOURCES; shift 2; fi
cd "$(dirname "$0")"
# The deps.json pin; callers building a copy of this tree outside arch/jitk pass it.
RUST_TOOLCHAIN=${RUST_TOOLCHAIN:-$(sh ../tools/rust-toolchain.sh)}
if [ -z "${JITK_TOOLS_DIR:-}" ]; then
  make -s .work/bin/prepare .work/bin/build-args .work/bin/artifact
  JITK_TOOLS_DIR=$PWD/.work/bin
fi
export JITK_TOOLS_DIR
export CARGO_TARGET_DIR=${CARGO_TARGET_DIR:-$PWD/target}
export JITK_OUT_DIR=${JITK_OUT_DIR:-$PWD/dist}
mkdir -p "$JITK_OUT_DIR"
cargo "+$RUST_TOOLCHAIN" build --locked --offline --release --target aarch64-unknown-none "$@"
OBJCOPY=${OBJCOPY:-/opt/homebrew/opt/llvm@22/bin/llvm-objcopy}
"$OBJCOPY" -O binary "$CARGO_TARGET_DIR/aarch64-unknown-none/release/jitk-02" "$JITK_OUT_DIR/kernel.bin"
JITK_ARTIFACT_ROOT="$PWD" "$JITK_TOOLS_DIR/artifact" "$CARGO_TARGET_DIR/aarch64-unknown-none/release/jitk-02" "$JITK_OUT_DIR"
