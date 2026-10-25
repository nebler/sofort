#!/bin/sh
# Run only after preserving the existing /tmp/sofort-a4 evidence elsewhere.
# Uses existing local sources, dependency caches and Node headers; no downloads.
set -eu
TASK_ROOT=/tmp/sofort-a4
PROJECT_ROOT=/Users/noah/code/sofort
EVIDENCE="$PROJECT_ROOT/arch/research/perf/transport/raw"
NODE_BIN=/tmp/jitk-09/node-real
UPSTREAM=/tmp/jitk-01/r3/darwin/libkrun
FROZEN=58ab4435ebd450db9754b2b1ece39789805b94b5
if [ -e "$TASK_ROOT/head" ]; then
  echo 'Refusing to overwrite existing measurement source: preserve /tmp/sofort-a4 first.' >&2
  exit 1
fi
mkdir -p "$TASK_ROOT/head" "$TASK_ROOT/clean" "$TASK_ROOT/raw" "$TASK_ROOT/bin"
cp "$EVIDENCE"/*.mjs "$EVIDENCE"/*.py "$EVIDENCE"/*.sh "$EVIDENCE"/*.c "$TASK_ROOT/"
(cd "$PROJECT_ROOT" && git archive "$FROZEN" arch/jitk/kernel arch/jitk/protocol arch/jitk/executor arch/jitk/vmm arch/jitk/bench/hyperlight) | tar -x -C "$TASK_ROOT/head"
(cd "$PROJECT_ROOT" && git archive "$FROZEN" arch/jitk/kernel arch/jitk/protocol) | tar -x -C "$TASK_ROOT/clean"
(cd "$TASK_ROOT/head" && git apply "$EVIDENCE/guest-node-instrumentation.patch")
ln -s "$PROJECT_ROOT/arch/jitk/executor/node_modules" "$TASK_ROOT/head/arch/jitk/executor/node_modules"
(cd "$TASK_ROOT/head/arch/jitk/executor" && "$NODE_BIN" build.mjs) > "$TASK_ROOT/raw/executor-build.log" 2>&1
# Fresh source with only the five frozen patches before building the baseline.
git clone --shared --no-checkout "$UPSTREAM" "$TASK_ROOT/libkrun"
git -C "$TASK_ROOT/libkrun" checkout --detach a1d8616765da03980f3be1bb8714bfdd3842f33c
while IFS= read -r patch; do
  [ -z "$patch" ] || git -C "$TASK_ROOT/libkrun" apply "$TASK_ROOT/head/arch/jitk/vmm/patches/$patch"
done < "$TASK_ROOT/head/arch/jitk/vmm/patches/series"
# APFS clone into this experiment; never use or write the shared cache in place.
cp -cR "$UPSTREAM/target" "$TASK_ROOT/libkrun/target"
(cd "$TASK_ROOT/libkrun" && RUSTUP_TOOLCHAIN=1.95.0 CARGO_PROFILE_RELEASE_PANIC=abort make FFI=0 target/release/libkrun.2.0.0.dylib) > "$TASK_ROOT/raw/base-libkrun-build.log" 2>&1
A4_VMM_OUT="$TASK_ROOT/bin/jitk-vmm-base" python3 "$TASK_ROOT/link-vmm.py" > "$TASK_ROOT/raw/base-link.log" 2>&1
git -C "$TASK_ROOT/libkrun" apply "$EVIDENCE/libkrun-instrumentation.patch"
(cd "$TASK_ROOT/libkrun" && RUSTUP_TOOLCHAIN=1.95.0 CARGO_PROFILE_RELEASE_PANIC=abort make FFI=0 target/release/libkrun.2.0.0.dylib) > "$TASK_ROOT/raw/libkrun-build.log" 2>&1
python3 "$TASK_ROOT/link-vmm.py" > "$TASK_ROOT/raw/link.log" 2>&1
NODE_HEADERS=/Users/noah/Library/Caches/node-gyp/24.22.1/include/node
clang -O2 -dynamiclib "$TASK_ROOT/syscalls.c" -o "$TASK_ROOT/bin/syscalls.dylib"
clang -O2 -shared -undefined dynamic_lookup -I "$NODE_HEADERS" "$TASK_ROOT/loopticks.c" -o "$TASK_ROOT/bin/loopticks.node"
clang -O2 "$TASK_ROOT/bench-pipe.c" -o "$TASK_ROOT/bin/bench-pipe"
(cd "$TASK_ROOT/clean/arch/jitk/kernel" && CARGO_TARGET_DIR="$TASK_ROOT/clean-kernel-target" JITK_OUT_DIR="$TASK_ROOT/baseline-images" sh build.sh) > "$TASK_ROOT/raw/clean-kernel-build.log" 2>&1
(cd "$TASK_ROOT/head/arch/jitk/kernel" && sh build.sh) > "$TASK_ROOT/raw/kernel-build.log" 2>&1
python3 "$TASK_ROOT/build-census.py"
# Supplemental guest JSON/String counts, separate from the authoritative census.
/usr/bin/lockf -k /tmp/sofort-bench.lock env DYLD_INSERT_LIBRARIES="$TASK_ROOT/bin/syscalls.dylib" A4_N=31 A4_INTERPOSE=1 A4_OUT="$TASK_ROOT/raw/transport-node-syscalls.json" "$NODE_BIN" "$TASK_ROOT/run-transport.mjs"
echo 'Ready: run-final.sh, component scripts and analyze.py (see RESULTS.md).'
