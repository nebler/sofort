#!/usr/bin/env bash
set -Eeuo pipefail
D=/home/dev/a5-linux-ledger
export PATH="$D/src/build-tools/usr/bin:$PATH"
export BISON_PKGDATADIR="$D/src/build-tools/usr/share/bison"
export M4="$D/src/build-tools/usr/bin/m4"
cd "$D/src/linux-6.1.128"
clang -nostdlib -static -fuse-ld=lld -Wl,--build-id=none -Wl,-e,_start "$D/harness/init.S" -o "$D/bin/tiny-init"
cat > "$D/src/initramfs.list" <<EOF
dir /dev 0755 0 0
nod /dev/console 0600 0 0 c 5 1
file /init $D/bin/tiny-init 0755 0 0
EOF
make LLVM=1 ARCH=arm64 tinyconfig
scripts/config --enable EXPERT --enable PRINTK --enable TTY --enable SERIAL_AMBA_PL011 --enable SERIAL_AMBA_PL011_CONSOLE --enable BINFMT_ELF --enable BLK_DEV_INITRD --enable RD_GZIP --enable DEVTMPFS --enable ARM_PSCI_FW --enable ARM_GIC_V3 --enable ARCH_VIRT --disable SMP --disable MODULES --disable NET --disable BLOCK --disable ACPI --disable EFI --disable RANDOMIZE_BASE --disable RELOCATABLE --disable DEBUG_KERNEL --disable KALLSYMS --disable COMPAT --disable SOUND --disable PCI --disable HW_PERF_EVENTS --set-str INITRAMFS_SOURCE "$D/src/initramfs.list" --set-str CONFIG_LOCALVERSION '-ledger'
scripts/config --enable NO_HZ_IDLE --enable HIGH_RES_TIMERS --disable HZ_PERIODIC --enable HZ_100 --disable HZ_250 --set-val HZ 100
scripts/config --disable VT --disable VT_CONSOLE
scripts/config --disable INPUT --disable HID --disable SERIO --disable USB_SUPPORT
scripts/config --disable SERIAL_AMBA_PL011 --disable SERIAL_AMBA_PL011_CONSOLE --enable SERIAL_8250 --enable SERIAL_8250_CONSOLE --enable SERIAL_OF_PLATFORM --set-val SERIAL_8250_NR_UARTS 1 --set-val SERIAL_8250_RUNTIME_UARTS 1
make LLVM=1 ARCH=arm64 olddefconfig
make LLVM=1 ARCH=arm64 -j2 Image
cp arch/arm64/boot/Image "$D/bin/linux-6.1.128-Image"
cp .config "$D/raw/linux.config"
sha256sum "$D/bin/linux-6.1.128-Image" "$D/bin/tiny-init" "$D/downloads/linux-6.1.128.tar.xz" > "$D/raw/linux-sha256.txt"
