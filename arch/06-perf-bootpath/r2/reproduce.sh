#!/bin/sh
set -eu
# Run from the shared scratch root. R1 private libkrun and 01's built artifacts
# are read/copy inputs, as documented in ../commands.txt. No global installs.
D="$PWD/arch/06-perf-bootpath/r2"
python3 "$D/prepare.py"
python3 "$D/patch-lib.py"
RUSTUP_TOOLCHAIN=1.95.0 CARGO_BUILD_JOBS=2 CARGO_PROFILE_RELEASE_PANIC=abort make -C /tmp/jitk-06/libkrun target/release/libkrun.2.0.0.dylib
sh "$D/build-host.sh"
python3 "$D/build-kernel.py"
python3 "$D/spawn.py"
/tmp/jitk-09/node-real "$D/spawn-node.cjs"
python3 "$D/resign.py"
# Main r2 evidence; READY is explicitly checked before source/image copying.
python3 "$D/prepare-r2.py"
python3 "$D/build-r2.py"
if [ ! -d /tmp/jitk-06/r2/libkrun ]; then
 cp -cR /tmp/jitk-01/r2/libkrun /tmp/jitk-06/r2/libkrun
 python3 "$D/instrument-static.py"
fi
sh "$D/build-static.sh"
python3 "$D/bench-r2.py" 100
python3 "$D/refine-clocks.py"
python3 "$D/parking-gate.py"
python3 "$D/startup-final.py"
BENCH_OUT=spawn-node-final.json /tmp/jitk-09/node-real "$D/spawn-node.cjs" control control-hvf control-krun vmm-final vmm-dynamic
python3 "$D/environment.py"
python3 "$D/write-report.py"
