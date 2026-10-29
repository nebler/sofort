#!/bin/sh
# HVF spike build (macOS arm64): the glue-2m ring kernel image, built exactly
# like kernel/build-ring.sh but into this directory, plus the signed spike
# engine. Nothing outside hvf-spike/ is written except kernel/.work/bin (the
# kernel's own ignored build tools).
#   build.sh            kernel image (plain ring-bootstrap.js) + engine
set -eu
here=$(cd "$(dirname "$0")" && pwd)
jitk=$(cd "$here/.." && pwd)
pin=$(sh "$jitk/tools/rust-toolchain.sh")
mkdir -p "$here/out"
make -s -C "$jitk/kernel" .work/bin/prepare .work/bin/build-args
script=$(cat "$jitk/kernel/ring-bootstrap.js")
(
  cd "$jitk/kernel"
  CARGO_TARGET_DIR="$here/target-kernel" \
  JITK_ELF="$jitk/kernel/payload/qjs-ring" \
  JITK_SCRIPT="$script" \
  JITK_TOOLS_DIR="$jitk/kernel/.work/bin" \
  RUSTFLAGS="--check-cfg=cfg(ring_glue_4m)" \
    cargo "+$pin" build --locked --offline --release --target aarch64-unknown-none --features transport-ring
)
${OBJCOPY:-llvm-objcopy} -O binary "$here/target-kernel/aarch64-unknown-none/release/jitk-02" "$here/out/kernel-ring.bin"
(cd "$here" && CARGO_TARGET_DIR="$here/target" cargo "+$pin" build --release)
codesign --force --sign - --entitlements "$jitk/shard/hypervisor.entitlements" "$here/target/release/hvf-spike"
ls -la "$here/out/kernel-ring.bin" "$here/target/release/hvf-spike"
