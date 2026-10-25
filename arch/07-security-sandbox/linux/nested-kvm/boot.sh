#!/bin/sh
# usage: boot.sh initrd [accel] -> runs QEMU nested-virt guest, kills after 300 s
ACC=${2:-hvf}; CPU=host; [ "$ACC" = tcg ] && CPU=max
qemu-system-aarch64 -M virt,virtualization=on,gic-version=3 -accel $ACC -cpu $CPU -smp 4 -m 3072 \
  -kernel /tmp/jitk-07/kvm/vmlinuz -initrd "$1" -append "console=ttyAMA0 rdinit=/init quiet" \
  -nographic -no-reboot & Q=$!
( sleep ${BOOT_TIMEOUT:-300}; kill $Q 2>/dev/null ) & W=$!
wait $Q; kill $W 2>/dev/null
