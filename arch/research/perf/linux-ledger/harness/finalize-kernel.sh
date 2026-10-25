#!/usr/bin/env bash
set -Eeuo pipefail
D=/home/dev/a5-linux-ledger
for ((i=0;i<300;i++)); do
    if test -f "$D/bin/linux-6.1.128-Image"; then break; fi
    sleep 2
done
test -f "$D/bin/linux-6.1.128-Image"
export PATH="$D/src/build-tools/usr/bin:$PATH" BISON_PKGDATADIR="$D/src/build-tools/usr/share/bison" M4="$D/src/build-tools/usr/bin/m4"
cd "$D/src/linux-6.1.128"
scripts/config --enable NO_HZ_IDLE --enable HIGH_RES_TIMERS --disable HZ_PERIODIC --enable HZ_100 --disable HZ_250 --set-val HZ 100
scripts/config --disable VT --disable VT_CONSOLE
scripts/config --disable INPUT --disable HID --disable SERIO --disable USB_SUPPORT
make LLVM=1 ARCH=arm64 olddefconfig
make LLVM=1 ARCH=arm64 -j2 Image
cp arch/arm64/boot/Image "$D/bin/linux-6.1.128-Image"
cp .config "$D/raw/linux.config"
sha256sum "$D/bin/linux-6.1.128-Image" "$D/bin/tiny-init" "$D/downloads/linux-6.1.128.tar.xz" > "$D/raw/linux-sha256.txt"
touch "$D/bin/linux-final.ready"
