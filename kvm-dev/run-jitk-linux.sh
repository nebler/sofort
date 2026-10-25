#!/usr/bin/env bash
# Runs the jitk Linux kit (metal code path) inside the nested Ubuntu VM, labelled NESTED (no perf claims).
set -Eeuo pipefail
D=$(cd "$(dirname "$0")" && pwd); J=$D/../arch/jitk
rsync -a --delete -e "ssh -i $D/id_ed25519 -p 2222 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR" \
  --exclude .work --exclude node_modules --exclude target --exclude 'linux/out' "$J/" dev@127.0.0.1:jitk/
"$D/ssh.sh" "JITK_HOST_UPTIME='$(uptime)' bash -s" <<'IN'
set -Eeuo pipefail
cd ~/jitk/linux; mkdir -p out; export JITK_WORK=$HOME/jitk-work; mkdir -p $JITK_WORK
export CARGO_HOME=$JITK_WORK/cargo RUSTUP_HOME=$JITK_WORK/rustup PATH=$JITK_WORK/cargo/bin:$PATH
if [[ ! -x $CARGO_HOME/bin/rustup ]]; then curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path --profile minimal --default-toolchain 1.95.0 >/dev/null; fi
rustup toolchain install 1.95.0 --profile minimal --component rustfmt >/dev/null 2>&1; rustup target add --toolchain 1.95.0 aarch64-unknown-none >/dev/null 2>&1
echo "== build $(date -u +%T) $(uptime)"
./build-linux.sh > out/build.log 2>&1 || { tail -30 out/build.log; exit 1; }
python3 build-kernel.py > out/kernel-build.log 2>&1 || { tail -30 out/kernel-build.log; exit 1; }
python3 build-faults.py
sha256sum $JITK_WORK/jitk-vmm $JITK_WORK/kernel.bin
echo "== suite $(date -u +%T) $(uptime)"
sudo bash -c "ulimit -n 65536; exec \"\$@\"" _ env JITK_BIN=$JITK_WORK JITK_REPORT=$PWD/out/report.json JITK_LABEL=NESTED JITK_HOST_UPTIME="$JITK_HOST_UPTIME" \
  JITK_BOOT_N=${BOOT_N:-300} JITK_SWEEP_N=${SWEEP_N:-200} JITK_MAX_CONCURRENCY=${MAXC:-16} JITK_DENSITY=${DENS:-1,32,64,128,256} \
  python3 suite.py > out/suite.log 2>&1 && rc=0 || rc=$?
echo "== suite rc=$rc $(date -u +%T) $(uptime)"
python3 cpu-analysis.py > out/cpu-analysis.log 2>&1 || true
python3 summarize.py 2>&1 | tail -40 || true
exit $rc
IN
