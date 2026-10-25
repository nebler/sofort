#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
ROOT=$PWD
mkdir -p .work out
STAGE=preflight
on_error() {
  rc=$?
  if [[ $STAGE != benchmarks || ! -s "$ROOT/out/report.json" ]]; then
  printf '{"status":"FAILED","stage":"%s","exit_code":%d,"kvm_results":"UNVERIFIED"}\n' "$STAGE" "$rc" > "$ROOT/out/report.json"
  printf '# Linux kit\n\nFAILED at %s (exit %d). KVM-dependent results UNVERIFIED. See out/build.log.\n' "$STAGE" "$rc" > "$ROOT/out/report.md"
  fi
  exit "$rc"
}
trap on_error ERR
exec > >(tee out/build.log) 2>&1
[[ $(uname -s) == Linux && $(uname -m) == aarch64 ]]
if [[ ${1:-} != --skip-deps ]]; then
  STAGE=dependencies
  SUDO=(); if [[ $EUID != 0 ]]; then SUDO=(sudo); fi
  "${SUDO[@]}" apt-get update
  "${SUDO[@]}" env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends build-essential curl ca-certificates git pkg-config clang llvm lld libclang-dev libssl-dev python3 python3-venv libseccomp-dev
fi
STAGE=rust-toolchain
export CARGO_HOME="$ROOT/.work/cargo" RUSTUP_HOME="$ROOT/.work/rustup"
export PATH="$CARGO_HOME/bin:$PATH"
if [[ ! -x $CARGO_HOME/bin/rustup ]]; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o .work/rustup-init.sh
  sh .work/rustup-init.sh -y --no-modify-path --profile minimal --default-toolchain 1.95.0
fi
rustup toolchain install 1.95.0 --profile minimal --component rustfmt
rustup target add --toolchain 1.95.0 aarch64-unknown-none
export RUSTUP_TOOLCHAIN=1.95.0
export CARGO_BUILD_JOBS=${JITK_BUILD_JOBS:-4}
STAGE=libkrun-fetch
REV=a1d8616765da03980f3be1bb8714bfdd3842f33c
if [[ ! -d .work/libkrun/.git ]]; then
  git init .work/libkrun
  git -C .work/libkrun remote add origin https://github.com/libkrun/libkrun
fi
if ! git -C .work/libkrun cat-file -e "$REV^{commit}" 2>/dev/null; then git -C .work/libkrun fetch --depth 1 origin "$REV"; fi
git -C .work/libkrun checkout --detach "$REV"
[[ $(git -C .work/libkrun rev-parse HEAD) == "$REV" ]]
STAGE=libkrun-build
# No init blob, filesystem, network, GPU, vsock, or production sandbox additions.
(cd .work/libkrun; CARGO_PROFILE_RELEASE_PANIC=abort cargo build --locked --release -p libkrun --no-default-features --features ffi)
ln -sf libkrun.so .work/libkrun/target/release/libkrun.so.2
STAGE=launcher-build
clang -O2 -Wall -Wextra -Werror host.c -I.work/libkrun/include -L.work/libkrun/target/release -lkrun -Wl,-rpath,"$ROOT/.work/libkrun/target/release" -o .work/jitk-launch
STAGE=kernel-build
python3 - <<'PY'
import hashlib,json
from pathlib import Path
m=json.loads(Path('sources.json').read_text())
assert hashlib.sha256(Path('qjs-stripped').read_bytes()).hexdigest()==m['qjs_sha256']
PY
(cd kernel; python3 prepare.py; CARGO_TARGET_DIR="$ROOT/.work/kernel-target" RUSTFLAGS="-C link-arg=-T$ROOT/kernel/link.ld" cargo build --locked --release --target aarch64-unknown-none --features qjs)
llvm-objcopy -O binary .work/kernel-target/aarch64-unknown-none/release/jitk-02 .work/kernel.bin
STAGE=benchmarks
if [[ ${JITK_BUILD_ONLY:-0} == 1 ]]; then
  python3 bench.py --build-only
else
  # A disposable bare-metal host and root/delegated cgroup v2 are required.
  # Python owns every PID, watchdog and cgroup cleanup, including SIGTERM/INT.
  python3 bench.py
fi
