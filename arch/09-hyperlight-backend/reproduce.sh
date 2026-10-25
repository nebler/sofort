#!/bin/bash
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p /tmp/jitk-09
if [ ! -d /tmp/jitk-09/hyperlight ]; then git clone https://github.com/hyperlight-dev/hyperlight /tmp/jitk-09/hyperlight; fi
if [ ! -d /tmp/jitk-09/hyperlight-js ]; then git clone https://github.com/hyperlight-dev/hyperlight-js /tmp/jitk-09/hyperlight-js; fi
git -C /tmp/jitk-09/hyperlight checkout 8a7e6b8794fea050ce287eed614088f0beb6b973
git -C /tmp/jitk-09/hyperlight-js checkout 8d208af8ac3ca53f2069c9ef0ca6a45d89e032d7
export RUSTUP_TOOLCHAIN=nightly-2026-10-20
export CARGO_TARGET_DIR=/tmp/jitk-09/adapter-target
export PATH=/tmp/jitk-09/tools/bin:/opt/homebrew/opt/llvm/bin:$PATH
rustup target add aarch64-unknown-none --toolchain "$RUSTUP_TOOLCHAIN"
cargo build --release --locked --manifest-path "$HERE/Cargo.toml"
BIN=$CARGO_TARGET_DIR/release/jitk-hyperlight-spike
codesign -f -s - --entitlements /tmp/jitk-09/hyperlight-js/dev/macos-entitlements.plist "$BIN"
"$BIN" bench > "$HERE/bench.jsonl"
"$BIN" memory > "$HERE/memory.jsonl"
python3 "$HERE/fresh.py" "$BIN" > "$HERE/fresh.jsonl"
python3 "$HERE/summarize.py" "$HERE/bench.jsonl"
python3 "$HERE/summarize.py" "$HERE/memory.jsonl"
python3 "$HERE/summarize.py" "$HERE/fresh.jsonl"
node --experimental-transform-types "$HERE/backend-smoke.ts"
S=$CARGO_TARGET_DIR/release/snapshot_clone
codesign -f -s - --entitlements /tmp/jitk-09/hyperlight-js/dev/macos-entitlements.plist "$S"
"$S" > "$HERE/clone.jsonl"
"$S" save > "$HERE/disk-save.json"
python3 "$HERE/fresh.py" "$S" load > "$HERE/disk-fresh.jsonl"
python3 "$HERE/summarize.py" "$HERE/clone.jsonl"
python3 "$HERE/summarize.py" "$HERE/disk-fresh.jsonl"
# Optional native Node comparison: pass a real Node executable, not a launcher.
if [ -n "${JITK_NODE_BINARY:-}" ]; then
  cargo build --release --locked --manifest-path /tmp/jitk-09/hyperlight-js/Cargo.toml -p js-host-api
  cp "$CARGO_TARGET_DIR/release/libjs_host_api.dylib" /tmp/jitk-09/js-host-api.node
  cp "$JITK_NODE_BINARY" /tmp/jitk-09/node-real
  codesign -f -s - --entitlements /tmp/jitk-09/hyperlight-js/dev/macos-entitlements.plist /tmp/jitk-09/node-real
  /tmp/jitk-09/node-real "$HERE/napi-bench.cjs" > "$HERE/napi.jsonl"
  python3 "$HERE/summarize.py" "$HERE/napi.jsonl"
fi
