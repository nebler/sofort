#!/bin/sh
set -eu
cd "$(dirname "$0")"
# All launchers used here have been inspected. Never substitute PATH's node.
export RUSTUP_TOOLCHAIN=nightly-2026-10-20
export CARGO_TARGET_DIR=/tmp/jitk-09/adapter-target
export PATH=/Users/noah/.rustup/toolchains/nightly-2026-10-20-aarch64-apple-darwin/bin:/opt/homebrew/opt/llvm/bin:/usr/bin:/bin
/Users/noah/.rustup/toolchains/nightly-2026-10-20-aarch64-apple-darwin/bin/cargo build --offline --locked --release --manifest-path Cargo.toml
codesign --force --sign - --entitlements /tmp/jitk-spike/libkrun/examples/chroot_vm.entitlements /tmp/jitk-09/adapter-target/release/r2-worker
codesign --force --sign - --entitlements /tmp/jitk-spike/libkrun/examples/chroot_vm.entitlements /tmp/jitk-09/adapter-target/release/r2-load-linux
/usr/bin/python3 - <<'PY'
import shutil,subprocess
shutil.rmtree('/tmp/jitk-09/r2-snapshot',ignore_errors=True)
subprocess.run(['/tmp/jitk-09/adapter-target/release/r2-worker','save','/tmp/jitk-09/r2-snapshot'],check=True,timeout=30)
PY
/tmp/jitk-09/node-real --experimental-transform-types adapter-test.ts
# Requires 04's R2 build output; no writes are made to 04's directory.
/tmp/jitk-09/node-real --experimental-transform-types executor-test.mjs
/usr/bin/python3 -u bench.py 30
