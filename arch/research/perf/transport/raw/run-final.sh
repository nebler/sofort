#!/bin/sh
set -eu
DYLD_INSERT_LIBRARIES=/tmp/sofort-a4/bin/syscalls.dylib A4_N=31 A4_DISABLE_GUEST_JSON=1 A4_INTERPOSE=1 A4_IMAGE=/tmp/sofort-a4/census-images/kernel.bin A4_OUT=/tmp/sofort-a4/raw/transport-final.json /tmp/jitk-09/node-real /tmp/sofort-a4/run-transport.mjs > /tmp/sofort-a4/raw/transport-final.log 2>&1
A4_N=31 A4_BASELINE=1 A4_VMM=/tmp/sofort-a4/bin/jitk-vmm-base A4_IMAGE=/tmp/sofort-a4/baseline-images/kernel.bin A4_OUT=/tmp/sofort-a4/raw/transport-baseline.json /tmp/jitk-09/node-real /tmp/sofort-a4/run-transport.mjs > /tmp/sofort-a4/raw/transport-baseline.log 2>&1
A4_N=11 A4_BASELINE=1 A4_CASES=sequential100 A4_VMM=/tmp/sofort-a4/bin/jitk-vmm-base A4_IMAGE=/tmp/sofort-a4/baseline-images/kernel.bin A4_OUT=/tmp/sofort-a4/raw/transport-sequential100.json /tmp/jitk-09/node-real /tmp/sofort-a4/run-transport.mjs > /tmp/sofort-a4/raw/transport-sequential100.log 2>&1
