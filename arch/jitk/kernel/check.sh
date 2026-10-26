#!/bin/sh
set -eu
cd "$(dirname "$0")"
cargo +1.95.0 fmt --check
make -s .work/bin/format .work/bin/build-checks .work/bin/prepare .work/bin/build-args
.work/bin/format --check
.work/bin/build-checks
cargo +1.95.0 clippy --locked --offline --release --target aarch64-unknown-none -- -D warnings -D clippy::undocumented_unsafe_blocks
cargo +1.95.0 clippy --locked --offline --release --target aarch64-unknown-none --features transport-ring -- -D warnings -D clippy::undocumented_unsafe_blocks
