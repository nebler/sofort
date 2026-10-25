#!/bin/sh
set -eu
cd "$(dirname "$0")"
out=/tmp/jitk-01/r2
lib="$out/libkrun"
if [ ! -f "$lib/Cargo.toml" ]; then
    mkdir -p "$lib"
    rsync -a --exclude .git --exclude target --exclude examples /tmp/jitk-spike/libkrun/ "$lib/"
fi
python3 - "$lib/Makefile" <<'PY_BUILD'
from pathlib import Path
import sys
p=Path(sys.argv[1]);s=p.read_text()
s=s.replace('cargo build --release $(FEATURE_FLAGS)', 'cargo build --release -p libkrun $(FEATURE_FLAGS)')
s=s.replace('\tcargo build --release -p krun-init-blob --features ffi\n', '')
s=s.replace('\tcp target/release/$(KRUN_INIT_BASE_$(OS)) target/release/$(KRUN_INIT_BINARY_$(OS))', '')
p.write_text(s)
PY_BUILD
# Private source copy must be pinned to a1d8616; no installed library/toolchain changes.
# The private Makefile recipe selects -p libkrun and omits unrelated init-blob builds.
RUSTUP_TOOLCHAIN=1.95.0 CARGO_NET_OFFLINE=true CARGO_PROFILE_RELEASE_PANIC=abort \
    make -C "$lib" -B FFI=0 target/release/libkrun.2.0.0.dylib
RUSTUP_TOOLCHAIN=1.95.0 rustc --edition=2024 -O -C lto=fat -C panic=abort main.rs \
    --extern krun="$lib/target/release/deps/libkrun.rlib" \
    -L "dependency=$lib/target/release/deps" -o "$out/jitk-vmm"
strip -x "$out/jitk-vmm"
codesign --force --sign - --entitlements ../hypervisor.entitlements "$out/jitk-vmm"
