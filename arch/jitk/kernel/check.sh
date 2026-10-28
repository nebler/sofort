#!/bin/sh
set -eu
cd "$(dirname "$0")"
RUST_TOOLCHAIN=$(sh ../tools/rust-toolchain.sh)
cargo "+$RUST_TOOLCHAIN" fmt --check
make -s .work/bin/format .work/bin/build-checks .work/bin/arch-lint .work/bin/prepare .work/bin/build-args
.work/bin/format --check
.work/bin/build-checks
.work/bin/arch-lint --self-test
cargo "+$RUST_TOOLCHAIN" clippy --locked --offline --release --target aarch64-unknown-none -- -D warnings -D clippy::undocumented_unsafe_blocks
cargo "+$RUST_TOOLCHAIN" clippy --locked --offline --release --target aarch64-unknown-none --features transport-ring -- -D warnings -D clippy::undocumented_unsafe_blocks
