#!/bin/sh
set -eu
cd /tmp/jitk-01/r2/libkrun
# Makefile owns platform plumbing; FFI disabled for the native minimal build.
RUSTUP_TOOLCHAIN=1.95.0 CARGO_NET_OFFLINE=true CARGO_PROFILE_RELEASE_PANIC=abort make FFI=0 target/release/libkrun.2.0.0.dylib
