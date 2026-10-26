#!/bin/sh
set -eu
cd "$(dirname "$0")"
cargo +1.95.0 fmt --check
python3 format.py --check
python3 build-checks.py
cargo +1.95.0 clippy --locked --offline --release --target aarch64-unknown-none -- -D warnings -D clippy::undocumented_unsafe_blocks
cargo +1.95.0 clippy --locked --offline --release --target aarch64-unknown-none --features transport-ring -- -D warnings -D clippy::undocumented_unsafe_blocks
