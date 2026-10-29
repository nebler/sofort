#!/bin/sh
# Prints a pinned Rust toolchain from tools/deps.json: "rust_toolchain" (the
# default), the one source for every `cargo +TOOLCHAIN` / RUSTUP_TOOLCHAIN in
# arch/jitk, or the key given as $1 (fuzz_toolchain: the shard's libFuzzer
# builds). Shell and make read it here; TypeScript reads pins() in
# ../tslib/deps.ts.
set -eu
key=${1:-rust_toolchain}
pin=$(sed -n "s/^ *\"$key\": *\"\\([^\"]*\\)\".*/\\1/p" "$(dirname -- "$0")/deps.json")
if [ -z "$pin" ]; then
  echo "tools/deps.json has no \"$key\"" >&2
  exit 1
fi
printf '%s\n' "$pin"
