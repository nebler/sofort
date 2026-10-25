#!/bin/sh
# Same raw guest image. QEMU RAM begins at 0x40000000, unlike libkrun's 0x80000000.
set -eu
cd "$(dirname "$0")"
K=/tmp/jitk-02
if [ "${1:-}" = setup ]; then
 qemu-system-aarch64 -M virt,dumpdtb=$K/qemu.dtb -cpu max -accel tcg -m 1152M -display none -serial none -monitor none -kernel $K/target/aarch64-unknown-none/release/jitk-02 -append jitk.seed=0123456789abcdef0123456789abcdef -device virtio-serial-device -chardev null,id=c -device virtconsole,chardev=c -global virtio-mmio.force-legacy=false
 clang --target=aarch64-none-elf -c qemu-shim.S -o $K/shim.o
 /opt/homebrew/bin/ld.lld -Ttext=0x41000000 $K/shim.o -o $K/shim.elf
 /opt/homebrew/opt/llvm@22/bin/llvm-objcopy -O binary $K/shim.elf $K/shim.bin
 exit
fi
exec qemu-system-aarch64 -M virt -cpu "${QEMU_CPU:-max}" -accel "${QEMU_ACCEL:-tcg}" -m 1152M -display none -serial none -monitor none -device loader,file=$K/kernel.bin,addr=0x80000000 -device loader,file=$K/shim.bin,addr=0x41000000,cpu-num=0 -device loader,file=$K/qemu.dtb,addr=0x83e00000 -device virtio-serial-device -chardev stdio,id=c -device virtconsole,chardev=c -global virtio-mmio.force-legacy=false "$@"
