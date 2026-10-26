#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=$(cd "$(dirname "$0")" && pwd)
cd "$ROOT"
if [[ $(uname -s) == Darwin ]]; then
 make -s -C "$ROOT" build build-linux
fi
source "$ROOT/output.sh"
rm -f "$JITK_LINUX_READY"
if [[ ${1:-} == --nested ]]; then
 export JITK_WORK=${JITK_WORK:-$ROOT/.work}
 export JITK_NESTED_BACKEND=${JITK_NESTED_BACKEND:-ssh}
 case $JITK_NESTED_BACKEND in
  qemu) ./prepare-nested.sh ;;
  ssh) mkdir -p "$JITK_WORK" ;;
  *) echo 'JITK_NESTED_BACKEND must be ssh or qemu' >&2; exit 1 ;;
 esac
 if [[ -n ${JITK_CANONICAL_VMM:-} ]]; then
  ./tool.sh stage-canonical "$JITK_CANONICAL_VMM" | tee "$JITK_LINUX_OUT/build.log"
  CC="${CC:-zig cc -target aarch64-linux-musl}" ./tool.sh build-probes
  ${CC:-zig cc -target aarch64-linux-musl} -O2 -Wall -Wextra -Werror spawn-cg.c -o "$JITK_WORK/spawn-cg"
 else
  ./docker-build.sh 2>&1 | tee "$JITK_LINUX_OUT/build.log"
 fi
 ./tool.sh build-kernel 2>&1 | tee "$JITK_LINUX_OUT/kernel-build.log"
 ./tool.sh build-faults
 ./nested.sh
else
 [[ $(uname -s) == Linux && $(uname -m) == aarch64 ]]
 export JITK_WORK=${JITK_WORK:-$ROOT/.work}
 mkdir -p "$JITK_WORK" "$JITK_LINUX_OUT"
 SUDO=(); [[ $EUID == 0 ]] || SUDO=(sudo)
 "${SUDO[@]}" apt-get update -qq
 "${SUDO[@]}" apt-get install -y -qq --no-install-recommends build-essential curl ca-certificates git clang llvm lld libclang-dev pkg-config libssl-dev
 export CARGO_HOME="$JITK_WORK/cargo" RUSTUP_HOME="$JITK_WORK/rustup"
 export PATH="$CARGO_HOME/bin:$PATH"
 if [[ ! -x $CARGO_HOME/bin/rustup ]]; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o "$JITK_WORK/rustup-init.sh"
  sh "$JITK_WORK/rustup-init.sh" -y --no-modify-path --profile minimal --default-toolchain 1.95.0
 fi
 rustup toolchain install 1.95.0 --profile minimal --component rustfmt
 rustup target add --toolchain 1.95.0 aarch64-unknown-none
 ./build-linux.sh 2>&1 | tee "$JITK_LINUX_OUT/build.log"
 ./tool.sh build-kernel 2>&1 | tee "$JITK_LINUX_OUT/kernel-build.log"
 ./tool.sh build-faults
 # Full metal profile. No provisioning or AWS API calls.
 export JITK_LABEL=METAL JITK_BOOT_N=1000 JITK_SWEEP_N=512 JITK_MAX_CONCURRENCY=64 JITK_DENSITY=1,32,64,128,256,512,1024,1536,2048
 "${SUDO[@]}" env JITK_BIN="$JITK_WORK" JITK_REPORT="$JITK_LINUX_OUT/report.json" JITK_LABEL="$JITK_LABEL" JITK_BOOT_N="$JITK_BOOT_N" JITK_SWEEP_N="$JITK_SWEEP_N" JITK_MAX_CONCURRENCY="$JITK_MAX_CONCURRENCY" JITK_DENSITY="$JITK_DENSITY" ./tool.sh suite 2>&1 | tee "$JITK_LINUX_OUT/metal.log"
 ./tool.sh cpu-analysis > "$JITK_LINUX_OUT/cpu-analysis.log"
 ./tool.sh summarize
fi
