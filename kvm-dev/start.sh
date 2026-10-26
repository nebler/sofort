#!/usr/bin/env bash
# Persistent nested-KVM dev VM: Ubuntu 26.04 LTS arm64 under QEMU HVF with EL2 (virtualization=on).
# discard=unmap: guest fstrim returns freed space to the Mac. monitor.sock: if the Mac
# disk fills, QEMU pauses the guest; free space, then resume with
#   echo cont | nc -U kvm-dev/monitor.sock
# Direct kernel boot (UEFI stalls under virtualization=on); kernel/initrd come from the image (boot/).
set -euo pipefail
D=$(cd "$(dirname "$0")" && pwd)
exec qemu-system-aarch64 -M virt,virtualization=on,gic-version=3 -accel hvf -cpu host \
  -smp "${KVM_DEV_VCPUS:-6}" -m "${KVM_DEV_MEM:-9216}" \
  -kernel "$D/boot/Image" -initrd "$D/boot/initrd.img" -append "root=LABEL=cloudimg-rootfs rw console=ttyAMA0" \
  -drive if=virtio,file="$D/disk.qcow2",discard=unmap,detect-zeroes=unmap -drive if=virtio,format=raw,file="$D/seed.iso",readonly=on \
  -nic user,model=virtio-net-pci,hostfwd=tcp:127.0.0.1:2222-:22 \
  -display none -monitor unix:"$D/monitor.sock",server,nowait -serial file:"$D/serial.log" -daemonize -pidfile "$D/qemu.pid"
