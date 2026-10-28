#!/bin/sh
# `make -C arch/jitk ci`: everything a Linux arm64 host can check without the
# Mac, in one run (.github/workflows/jitk-ci.yml calls this). Order:
#   1. doctor, deps                       (a failure here stops the run)
#   2. host suites and builds, no KVM     (every step runs; failures collected)
#   3. KVM suites, when /dev/kvm is rw    (shard snapshot/test-kvm/shard-host,
#      the Linux VMM test, `make test-linux` once that target exists)
#   4. the checkout is still clean        (tests write only ignored paths)
# Each skipped step prints why. Exit 1 when any step failed.
#   JITK_CI_KVM=auto|0|1   auto (default): KVM steps when /dev/kvm is usable;
#                          0: skip them; 1: require KVM (missing = failure)
#   JITK_BENCH_LOCK        lock held around KVM suites; default
#                          /home/dev/bench.lock when present (kvm-dev), else
#                          $TMPDIR/jitk-bench.lock
# On Linux only: the Mac suites (libkrun console path, Hyperlight, HVF) stay
# in `make test` on the Mac.
set -u
JITK=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if [ "$(uname -s)-$(uname -m)" != Linux-aarch64 ]; then
  echo "jitk ci: needs a Linux arm64 host (this is $(uname -s) $(uname -m)); on the Mac run make test" >&2
  exit 2
fi
PATH=$PATH:${CARGO_HOME:-$HOME/.cargo}/bin
export PATH
summary=$(mktemp "${TMPDIR:-/tmp}/jitk-ci.XXXXXX")
trap 'rm -f "$summary"' EXIT HUP INT TERM
failed=0
started=$(date +%s)

gh() { [ -n "${GITHUB_ACTIONS:-}" ]; }

# step NAME COMMAND...: run, time and record one check.
step() {
  name=$1
  shift
  gh && echo "::group::$name"
  echo "jitk ci: >> $name"
  t0=$(date +%s)
  ("$@")
  rc=$?
  dt=$(($(date +%s) - t0))
  gh && echo '::endgroup::'
  if [ "$rc" = 0 ]; then
    echo "jitk ci: ok   $name (${dt}s)"
    printf 'ok    %-34s %5ss\n' "$name" "$dt" >>"$summary"
  else
    echo "jitk ci: FAIL $name (exit $rc, ${dt}s)"
    gh && echo "::error title=jitk ci::$name failed (exit $rc)"
    printf 'FAIL  %-34s %5ss  exit %s\n' "$name" "$dt" "$rc" >>"$summary"
    failed=$((failed + 1))
  fi
  return "$rc"
}

# skip NAME WHY
skip() {
  echo "jitk ci: skip $1: $2"
  printf 'skip  %-34s        %s\n' "$1" "$2" >>"$summary"
}

finish() {
  total=$(($(date +%s) - started))
  echo
  echo "jitk ci summary ($(uname -n), ${total}s):"
  cat "$summary"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    { echo '### jitk ci'; echo; echo '```'; cat "$summary"; echo '```'; } >>"$GITHUB_STEP_SUMMARY"
  fi
  if [ "$failed" -gt 0 ]; then
    echo "jitk ci: $failed step(s) failed"
    exit 1
  fi
  echo 'jitk ci: all run steps passed'
  exit 0
}

# --- 1. host check and pinned deps ------------------------------------------
step doctor make -s -C "$JITK" doctor || finish
step deps make -s -C "$JITK" deps || finish
deps_env=$("$JITK/tools/.work/bin/deps" env) || { echo 'jitk ci: deps env failed' >&2; failed=$((failed + 1)); finish; }
eval "$deps_env"
export JITK_NODE JITK_NPM_CLI JITK_ZIG JITK_VMM_BINARY JITK_SHARD_BINARY
export JITK_NPM_CACHE="${JITK_NPM_CACHE:-${TMPDIR:-/tmp}/jitk-npm-cache}"
export OBJCOPY="${OBJCOPY:-llvm-objcopy}"

# --- 2. host suites and builds (no KVM) -------------------------------------
kernel_checks() {
  cd "$JITK/kernel" || return 1
  make -s tools bench-gate || return 1
  .work/bin/build-checks && .work/bin/arch-lint --self-test &&
    .work/bin/tests/test_packer && .work/bin/tests/test_handlers && .work/bin/tests/test_fs &&
    "$JITK_NODE" tests/ring-bootstrap-check.mjs
}
executor_build() {
  "$JITK_NODE" "$JITK_NPM_CLI" ci --prefix "$JITK/executor" --ignore-scripts --no-audit --no-fund --prefer-offline --cache "$JITK_NPM_CACHE" &&
    make -s -C "$JITK/executor" build tools
}
# The executor checks that need no VMM backend (run.sh test's list minus the
# libkrun/Hyperlight ones skipped below).
executor_checks() {
  for check in abi-check prepared-check pool-check resolve-check sandbox-check transport-check shard-sandbox-check watchdog-check; do
    echo "executor: $check"
    "$JITK_NODE" "$JITK/executor/build/$check.js" || return 1
  done
}
policy_checks() {
  "$JITK_NODE" "$JITK/executor/policy/policy-test.mjs" && "$JITK_NODE" "$JITK/executor/policy/policy-hostile.mjs"
}
mcp_checks() {
  make -s -C "$JITK/mcp" build && "$JITK_NODE" "$JITK/mcp/native-test.mjs"
}
sandbox_unit() {
  JITK_VMM_BUILD=$(dirname "$JITK_VMM_BINARY") sh "$JITK/vmm/sandbox/tests/run-unit.sh"
}
# grow's scriptc programs (build/oracle-root is the Rust launcher for the
# Docker oracle and needs the musl target), then its host test.
grow_checks() {
  make -s -C "$JITK/grow" kernel-tools build/grow build/oracle-profile build/experiments build/parity build/sqlite-checks build/test &&
    make -s -C "$JITK/grow" test
}

step layering "$JITK/tools/.work/bin/layering" --self-test
step 'abi test' make -s -C "$JITK/abi" test
step 'kernel build' make -s -C "$JITK/kernel" build
step 'kernel host checks' kernel_checks
skip 'kernel regression, fs_diff' 'boots the libkrun console kernel and links probes with /opt/homebrew ld.lld; Mac make test'
step 'docs test' make -s -C "$JITK/docs" test
step 'shard test' make -s -C "$JITK/shard" test
step 'protocol test' make -s -C "$JITK/protocol" test tools
step 'executor build' executor_build
step 'executor checks' executor_checks
skip 'executor verify/api/policy/wrapper' 'libkrun console backend pinned by kernel/.READY to the Mac-built image; Mac make test'
skip 'executor hyperlight-check' 'Hyperlight worker and snapshot are macOS deps'
step 'executor/policy test' policy_checks
step 'mcp build, native-test' mcp_checks
skip 'mcp test' 'drives the libkrun console backend (same kernel/.READY pin); Mac make test'
step 'vmm/sandbox unit' sandbox_unit
step 'tslib test' make -s -C "$JITK/tslib" test
step 'scriptc builds' make -s -C "$JITK" tools
step 'scriptc linux builds' make -s -C "$JITK/kernel" linux-tools
step 'vmm tools' make -s -C "$JITK/vmm" tools
step 'shard tools' make -s -C "$JITK/shard" build
step 'bench build, test' make -s -C "$JITK/bench" test
step 'grow build, test' grow_checks
skip 'bench/hyperlight, hvf-spike' 'macOS only (Hyperlight on HVF, Hypervisor.framework)'
skip 'linux suite' 'the libkrun-on-Linux nested kit runs from the Mac over JITK_NESTED_SSH (R10 #6 deletes it)'

# --- 3. KVM suites ------------------------------------------------------------
kvm_why=
case "${JITK_CI_KVM:-auto}" in
  0) kvm_why='JITK_CI_KVM=0' ;;
  1 | auto)
    if [ ! -c /dev/kvm ]; then
      kvm_why='no /dev/kvm on this host (GitHub-hosted arm64 runners have none)'
    elif [ ! -r /dev/kvm ] || [ ! -w /dev/kvm ]; then
      kvm_why='/dev/kvm is not read/writable by this user'
    fi
    if [ -n "$kvm_why" ] && [ "${JITK_CI_KVM:-auto}" = 1 ]; then
      echo "jitk ci: FAIL kvm: JITK_CI_KVM=1 but $kvm_why"
      printf 'FAIL  %-34s        %s\n' kvm "JITK_CI_KVM=1 but $kvm_why" >>"$summary"
      failed=$((failed + 1))
    fi
    ;;
  *) kvm_why="unknown JITK_CI_KVM=${JITK_CI_KVM}" ;;
esac
if [ -z "${JITK_BENCH_LOCK:-}" ]; then
  if [ -e /home/dev/bench.lock ]; then JITK_BENCH_LOCK=/home/dev/bench.lock; else JITK_BENCH_LOCK=${TMPDIR:-/tmp}/jitk-bench.lock; fi
fi
export JITK_BENCH_LOCK
locked() { flock -w "${JITK_SHARD_LOCK_WAIT:-900}" "$JITK_BENCH_LOCK" "$@"; }
kvm_steps='shard snapshot|shard test-kvm|shard-host.sh|vmm test|test-linux'
if [ -n "$kvm_why" ]; then
  echo "$kvm_steps" | tr '|' '\n' | while read -r name; do skip "$name" "$kvm_why"; done
else
  step 'shard snapshot' make -s -C "$JITK/shard" snapshot
  step 'shard test-kvm' locked make -s -C "$JITK/shard" test-kvm
  # shard-host.sh takes the bench lock itself around the executor suite.
  step 'shard-host.sh' sh "$JITK/executor/ipc/shard-host.sh"
  step 'vmm test' locked make -s -C "$JITK/vmm" test
  # The backend-parity target (R10 #7) lands separately; run it once present.
  if make -s -C "$JITK" -n test-linux >/dev/null 2>&1; then
    step 'test-linux' make -s -C "$JITK" test-linux
  else
    skip test-linux 'no test-linux target in this checkout yet'
  fi
fi

# --- 4. the checkout stays clean ------------------------------------------------
tree_clean() {
  changes=$(git -C "$JITK" status --porcelain --untracked-files=all -- .) || return 1
  if [ -n "$changes" ]; then
    echo 'tests changed or added files outside ignored build directories:'
    echo "$changes" | head -40
    return 1
  fi
}
if git -C "$JITK" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  step 'checkout clean' tree_clean
else
  skip 'checkout clean' 'not a git checkout'
fi
finish
