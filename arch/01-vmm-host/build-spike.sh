#!/bin/sh
# Reuse the supplied, immutable libkrun rlib; write all binaries to our private temp.
set -eu
cd "$(dirname "$0")"
mkdir -p /tmp/jitk-01
L=/tmp/jitk-spike/libkrun
RUSTUP_TOOLCHAIN=1.95.0 rustc --edition=2024 -O -C panic=abort src/main.rs \
  --extern krun="$L/target/release/deps/libkrun.rlib" \
  -L "dependency=$L/target/release/deps" -o /tmp/jitk-01/jitk-vmm
cp "$L/target/release/libkrun.2.0.0.dylib" /tmp/jitk-01/libkrun.2.dylib
for c in host-baseline two-vms; do
  out=$c
  if [ "$c" = host-baseline ]; then out=host-c; fi
  clang -O2 -I"$L/include" "$c.c" -L"$L/target/release" -lkrun -o "/tmp/jitk-01/$out"
  install_name_tool -change libkrun.2.dylib /tmp/jitk-01/libkrun.2.dylib "/tmp/jitk-01/$out"
done
clang -O2 hvf-two.c -framework Hypervisor -o /tmp/jitk-01/hvf-two
clang -O2 sandbox-probe.c -o /tmp/jitk-01/sandbox-probe
codesign --force --sign - --entitlements hypervisor.entitlements \
  /tmp/jitk-01/jitk-vmm /tmp/jitk-01/host-c /tmp/jitk-01/two-vms /tmp/jitk-01/hvf-two
clang --target=aarch64-none-elf -c probe-start.S -o /tmp/jitk-01/start.o
for kind in probe park; do
  flag=
  if [ "$kind" = park ]; then flag=-DPARK; fi
  clang --target=aarch64-none-elf $flag -O2 -ffreestanding -fno-builtin -nostdlib \
    -c guest-probe.c -o "/tmp/jitk-01/$kind.o"
  ld.lld -T probe.ld /tmp/jitk-01/start.o "/tmp/jitk-01/$kind.o" \
    --oformat=binary -o "/tmp/jitk-01/$kind.bin"
done
clang --target=aarch64-none-elf -c fault.S -o /tmp/jitk-01/fault.o
ld.lld -T guest.ld /tmp/jitk-01/fault.o --oformat=binary -o /tmp/jitk-01/fault.bin
cp /tmp/jitk-spike/sc/qjs-static /tmp/jitk-01/qjs-static
clang --target=aarch64-none-elf -O2 -DEMBED_QJS -ffreestanding -fno-builtin -nostdlib \
  -c guest-probe.c -o /tmp/jitk-01/embed-probe.o
clang --target=aarch64-none-elf -c embed-qjs.S -o /tmp/jitk-01/qjs.o
ld.lld -T probe.ld /tmp/jitk-01/start.o /tmp/jitk-01/embed-probe.o /tmp/jitk-01/qjs.o \
  --oformat=binary -o /tmp/jitk-01/embed-probe.bin
