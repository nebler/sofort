#!/bin/sh
# tools/ci.sh PART...: the CI entrypoint (`make ci`, `ci-host`, `ci-kvm`,
# `ci-mac`; .github/workflows/jitk-ci.yml). Parts:
#   host  Linux arm64, no KVM: every host suite, build and lint
#   kvm   Linux arm64 with a usable /dev/kvm: the shard, executor and MCP
#         suites on the KVM engine and `make test-linux`, each under the
#         bench lock
#   mac   macOS arm64: the HVF engine suites (shard test-hvf with
#         `hvf confine`, the executor's shard suite on HVF, parity)
# Every run starts with doctor and deps (a failure there stops it) and ends
# by checking that the checkout is still clean (tests write only ignored
# paths). Every step runs; the run exits 1 when any failed.
#
# Skips: a step that cannot run here fails the run unless its name is listed
# in JITK_ALLOW_SKIP (comma- or space-separated; tools/skip.sh). Steps that
# do not apply to a platform by design are listed as n/a with the reason.
# Report-only steps (`report`) print their findings and never fail the run.
#
# Logs: each step's output also goes to $JITK_CI_LOGS/NN-name.log (default
# tools/.work/ci-logs, emptied per run) with summary.txt; the summary ends
# with the tail of every failed step's log. CI uploads the directory.
#   JITK_BENCH_LOCK   lock held around the KVM suites; default
#                     ~/bench.lock when present (kvm-dev), else
#                     $TMPDIR/jitk-bench.lock
set -u
JITK=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
[ $# -gt 0 ] || set -- host kvm
for part in "$@"; do
  case $part in
    host | kvm) want=Linux-aarch64 ;;
    mac) want=Darwin-arm64 ;;
    *) echo "usage: ci.sh host|kvm|mac... (unknown part $part)" >&2; exit 2 ;;
  esac
  if [ "$(uname -s)-$(uname -m)" != "$want" ]; then
    echo "jitk ci: part $part needs a $want host (this is $(uname -s)-$(uname -m))" >&2
    exit 2
  fi
done
PATH=$PATH:${CARGO_HOME:-$HOME/.cargo}/bin
export PATH
LOGS=${JITK_CI_LOGS:-$JITK/tools/.work/ci-logs}
rm -rf "$LOGS"
mkdir -p "$LOGS"
summary=$LOGS/summary.txt
: >"$summary"
failed=0
failed_logs=
count=0
started=$(date +%s)

gh() { [ -n "${GITHUB_ACTIONS:-}" ]; }

row() { printf '%-5s %-36s %s\n' "$1" "$2" "$3" >>"$summary"; }

# run_logged NAME COMMAND...: run with output to the terminal and to the
# step's log; sets rc, dt and log.
run_logged() {
  count=$((count + 1))
  log=$LOGS/$(printf '%02d' "$count")-$(printf '%s' "$1" | tr -c 'A-Za-z0-9._-' '-').log
  shift
  t0=$(date +%s)
  { ("$@") 2>&1; echo "$?" >"$log.rc"; } | tee "$log"
  rc=$(cat "$log.rc")
  rm -f "$log.rc"
  dt=$(($(date +%s) - t0))
}

# step NAME COMMAND...: one check; a failure fails the run.
step() {
  name=$1
  gh && echo "::group::$name"
  echo "jitk ci: >> $name"
  run_logged "$@"
  gh && echo '::endgroup::'
  if [ "$rc" = 0 ]; then
    echo "jitk ci: ok   $name (${dt}s)"
    row ok "$name" "${dt}s"
  else
    echo "jitk ci: FAIL $name (exit $rc, ${dt}s; log $log)"
    gh && echo "::error title=jitk ci::$name failed (exit $rc)"
    row FAIL "$name" "${dt}s, exit $rc"
    failed=$((failed + 1))
    failed_logs="$failed_logs $log"
  fi
  return "$rc"
}

# report NAME COMMAND...: findings are printed and logged, never a failure.
report() {
  name=$1
  gh && echo "::group::$name (report only)"
  echo "jitk ci: >> $name (report only)"
  run_logged "$@"
  gh && echo '::endgroup::'
  if [ "$rc" = 0 ]; then
    row ok "$name" "${dt}s"
  else
    echo "jitk ci: findings in $name (report only; log $log)"
    gh && echo "::warning title=jitk ci::$name has findings (report only)"
    row warn "$name" "${dt}s, findings (report only)"
  fi
}

# skip NAME REASON: allowed by JITK_ALLOW_SKIP, else a failure.
skip() {
  if sh "$JITK/tools/skip.sh" "$1" "$2"; then
    row skip "$1" "$2"
  else
    gh && echo "::error title=jitk ci::$1 skipped: $2 (not in JITK_ALLOW_SKIP)"
    row FAIL "$1" "skipped: $2 (not in JITK_ALLOW_SKIP)"
    failed=$((failed + 1))
  fi
}

# na NAME REASON: not applicable on this platform by design.
na() {
  echo "jitk ci: n/a  $1: $2"
  row n/a "$1" "$2"
}

finish() {
  total=$(($(date +%s) - started))
  {
    echo
    echo "jitk ci $* on $(uname -n): ${total}s, $failed failed"
  } >>"$summary"
  for log in $failed_logs; do
    { echo; echo "--- last 60 lines of $log"; tail -n 60 "$log"; } >>"$summary"
  done
  echo
  cat "$summary"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    { echo "### jitk ci $*"; echo; echo '```'; cat "$summary"; echo '```'; } >>"$GITHUB_STEP_SUMMARY"
  fi
  [ "$failed" -eq 0 ] || exit 1
  exit 0
}

# --- doctor and pinned deps (every part) --------------------------------------
step doctor make -s -C "$JITK" doctor || finish "$@"
step deps make -s -C "$JITK" deps || finish "$@"
if ! deps_env=$("$JITK/tools/.work/bin/deps" env); then
  row FAIL 'deps env' 'tools/.work/bin/deps env failed'
  failed=$((failed + 1))
  finish "$@"
fi
eval "$deps_env"
export JITK_NODE JITK_NPM_CLI JITK_ZIG JITK_SHARD_BINARY
export JITK_NPM_CACHE="${JITK_NPM_CACHE:-${TMPDIR:-/tmp}/jitk-npm-cache}"
export OBJCOPY="${OBJCOPY:-llvm-objcopy}"

if [ -z "${JITK_BENCH_LOCK:-}" ]; then
  if [ -e "$HOME/bench.lock" ]; then JITK_BENCH_LOCK=$HOME/bench.lock; else JITK_BENCH_LOCK=${TMPDIR:-/tmp}/jitk-bench.lock; fi
fi
export JITK_BENCH_LOCK
locked() { flock -w "${JITK_SHARD_LOCK_WAIT:-900}" "$JITK_BENCH_LOCK" "$@"; }

# --- shared builds --------------------------------------------------------------
executor_build() {
  "$JITK_NODE" "$JITK_NPM_CLI" ci --prefix "$JITK/executor" --ignore-scripts --no-audit --no-fund --prefer-offline --cache "$JITK_NPM_CACHE" &&
    make -s -C "$JITK/executor" build tools
}
built_executor=
build_executor() {
  [ -n "$built_executor" ] && return 0
  built_executor=1
  step 'executor build' executor_build
}
built_mcp=
build_mcp() {
  [ -n "$built_mcp" ] && return 0
  built_mcp=1
  step 'mcp build' make -s -C "$JITK/mcp" build
}
# The prepared snapshot (`shard snapshot`) for the ring-engine suites.
shard_snapshot_env() {
  JITK_SHARD_SNAPSHOT=$("$JITK/tools/.work/bin/deps" path JITK_SHARD_SNAPSHOT) || return 1
  export JITK_SHARD_SNAPSHOT
}

# --- host: Linux suites and builds without KVM ----------------------------------
kernel_checks() {
  cd "$JITK/kernel" || return 1
  make -s tools bench-gate || return 1
  .work/bin/tests/test_packer && .work/bin/tests/test_handlers && .work/bin/tests/test_fs &&
    "$JITK_NODE" tests/ring-bootstrap-check.mjs
}
# The Linux-built default image is byte-identical to the promoted Mac image
# (kernel/ARCH.md "Image identity"), so kernel/.READY's gates (run on the Mac)
# cover this build.
kernel_identity() {
  "$JITK_NODE" -e '
    const { createHash } = require("node:crypto"), { readFileSync } = require("node:fs");
    const [ready, image] = process.argv.slice(1);
    const want = JSON.parse(readFileSync(ready, "utf8")).sha256;
    const got = createHash("sha256").update(readFileSync(image)).digest("hex");
    console.log("kernel/dist/kernel.bin " + got + (got === want ? " = " : " != ") + "kernel/.READY " + want);
    if (got !== want) process.exit(1);
  ' "$JITK/kernel/.READY" "$JITK/kernel/dist/kernel.bin"
}
# The executor checks that need no engine (run.sh test's list minus the ones
# on the shard in the kvm part). transport-check and watchdog-check run the
# process backend with the shard binary's `real process-watchdog`.
executor_checks() {
  for check in abi-check prepared-check pool-check resolve-check transport-check shard-sandbox-check ipc-decoder-check watchdog-check; do
    echo "executor: $check"
    "$JITK_NODE" "$JITK/executor/build/$check.js" || return 1
  done
}
policy_checks() {
  "$JITK_NODE" "$JITK/executor/policy/policy-test.mjs" && "$JITK_NODE" "$JITK/executor/policy/policy-hostile.mjs"
}
# grow's scriptc programs (build/oracle-root is the Rust launcher for the
# Docker oracle and needs the musl target), then its host test.
grow_checks() {
  make -s -C "$JITK/grow" kernel-tools build/grow build/oracle-profile build/experiments build/parity build/sqlite-checks build/test &&
    make -s -C "$JITK/grow" test
}

part_host() {
  step layering "$JITK/tools/.work/bin/layering" --self-test
  step 'abi test' make -s -C "$JITK/abi" test
  step 'kernel build' make -s -C "$JITK/kernel" build
  step 'kernel image = .READY' kernel_identity
  step 'kernel check' make -s -C "$JITK/kernel" check
  step 'kernel host checks' kernel_checks
  na 'kernel regression, fs_diff' 'boot the console kernel on the HVF engine (hvf console) and link probes with Homebrew ld.lld: Mac make test'
  step 'docs test' make -s -C "$JITK/docs" test
  step 'shard test' make -s -C "$JITK/shard" test
  step 'shard clippy' make -s -C "$JITK/shard" clippy
  step 'shard fuzz-smoke' make -s -C "$JITK/shard" fuzz-smoke
  step 'protocol test' make -s -C "$JITK/protocol" test tools
  build_executor
  step 'executor checks' executor_checks
  na 'executor hyperlight-check' 'the Hyperlight worker and snapshot are macOS deps'
  step 'executor/policy test' policy_checks
  build_mcp
  step 'mcp native-test' "$JITK_NODE" "$JITK/mcp/native-test.mjs"
  step 'tslib test' make -s -C "$JITK/tslib" test
  step 'scriptc builds' make -s -C "$JITK" tools
  step 'scriptc linux builds' make -s -C "$JITK/kernel" linux-tools
  step 'shard tools' make -s -C "$JITK/shard" build
  step 'bench build, test' make -s -C "$JITK/bench" test
  step 'grow build, test' grow_checks
  na 'bench/hyperlight' 'macOS only (Hyperlight on Hypervisor.framework)'
  report 'ts lint' make -s -C "$JITK" lint
}

# --- kvm: the KVM engine suites -------------------------------------------------
executor_shard_checks() {
  shard_snapshot_env || return 1
  for check in verify wrapper-conformance api-check policy-check; do
    echo "executor: $check"
    locked "$JITK_NODE" "$JITK/executor/build/$check.js" || return 1
  done
}
# mcp test on the shard: its default config parks two sessions, and a parking
# gate exists for the HVF engine only, so on Linux it runs unwarmed.
mcp_shard_test() {
  shard_snapshot_env && locked make -s -C "$JITK/mcp" test
}

part_kvm() {
  if [ ! -c /dev/kvm ]; then
    skip kvm 'no /dev/kvm on this host (GitHub-hosted arm64 runners have none)'
    return
  elif [ ! -r /dev/kvm ] || [ ! -w /dev/kvm ]; then
    skip kvm "/dev/kvm is not read/writable by $(id -un)"
    return
  fi
  build_executor
  build_mcp
  step 'shard snapshot' make -s -C "$JITK/shard" snapshot
  # shard-host.sh takes the bench lock itself around the executor suite.
  step 'shard-host.sh' sh "$JITK/executor/ipc/shard-host.sh"
  step 'executor verify/api/policy/wrapper' executor_shard_checks
  step 'kernel test-ring' make -s -C "$JITK/kernel" test-ring
  step 'mcp test' mcp_shard_test
  # The parity corpus, shard test, the executor's shard-check and shard
  # test-kvm, then the native census regression, each locked as it needs.
  step 'test-linux' make -s -C "$JITK" test-linux
}

# --- mac: the HVF engine suites -------------------------------------------------
mcp_hvf_test() {
  shard_snapshot_env && make -s -C "$JITK/mcp" test
}
part_mac() {
  build_executor
  build_mcp
  step 'shard snapshot' make -s -C "$JITK/shard" snapshot
  step 'shard test-hvf, hvf confine' make -s -C "$JITK/shard" test-hvf
  step 'executor shard-check (hvf)' make -s -C "$JITK/executor" test-shard
  step 'kernel test-ring (hvf)' make -s -C "$JITK/kernel" test-ring
  step 'executor parity (darwin)' make -s -C "$JITK/executor" parity
  # MCP's warm pools need the engine's parking gate; the snapshot path is read
  # after `shard snapshot`, which may have just built the default class's.
  step 'executor hvf-parking-gate' make -s -C "$JITK/executor" hvf-parking-gate
  step 'mcp test (warm)' mcp_hvf_test
}

for part in "$@"; do
  "part_$part"
done

# --- the checkout stays clean -------------------------------------------------------
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
  skip checkout-clean 'not a git checkout'
fi
finish "$@"
