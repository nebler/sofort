#!/bin/sh
# Prints the pinned Rust toolchain, tools/deps.json "rust_toolchain": the one
# source for every `cargo +TOOLCHAIN` / RUSTUP_TOOLCHAIN in arch/jitk. Shell
# and make read it here; TypeScript reads pins() in ../tslib/deps.ts.
set -eu
pin=$(sed -n 's/^ *"rust_toolchain": *"\([^"]*\)".*/\1/p' "$(dirname -- "$0")/deps.json")
if [ -z "$pin" ]; then
  echo 'tools/deps.json has no "rust_toolchain"' >&2
  exit 1
fi
printf '%s\n' "$pin"
