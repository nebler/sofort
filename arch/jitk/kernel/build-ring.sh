#!/bin/sh
set -eu
cd "$(dirname "$0")"
# The deps.json pin; callers building a copy of this tree outside arch/jitk pass it.
RUST_TOOLCHAIN=${RUST_TOOLCHAIN:-$(sh ../tools/rust-toolchain.sh)}
export CARGO_TARGET_DIR=${CARGO_TARGET_DIR:-$PWD/target-ring}
export JITK_ELF=${JITK_ELF:-$PWD/payload/qjs-ring}
if [ ! -f "$JITK_ELF" ]; then
  echo 'Build the ring-only payload in a Linux VM: payload/ring-rng/build.sh NEW_EMPTY_WORK' >&2
  exit 1
fi
# Native images contain only a tool profile. No argv or tenant files are packed.
if [ "${JITK_RING_NATIVE:-0}" = 1 ]; then
  export JITK_ARGV_JSON='["@ring-native"]'
  unset JITK_RESOURCES
else
  export JITK_SCRIPT="$(cat ring-bootstrap.js)"
fi
case "${JITK_RING_CLASS:-glue-2m}" in
  glue-2m) class_flags= ;;
  glue-4m) class_flags='--cfg ring_glue_4m' ;;
  *) echo "unsupported ring memory class: $JITK_RING_CLASS" >&2; exit 1 ;;
esac
export RUSTFLAGS="${RUSTFLAGS:-} --check-cfg=cfg(ring_glue_4m) $class_flags -C link-arg=--defsym=__ring_arena=0x81800000"
mkdir -p dist/ring
cargo "+$RUST_TOOLCHAIN" build --locked --offline --release --target aarch64-unknown-none --features transport-ring
OBJCOPY=${OBJCOPY:-llvm-objcopy}
"$OBJCOPY" -O binary "$CARGO_TARGET_DIR/aarch64-unknown-none/release/jitk-02" "${JITK_RING_OUT:-dist/kernel-ring.bin}"
