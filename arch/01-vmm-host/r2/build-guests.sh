#!/bin/sh
set -eu
cd "$(dirname "$0")"
out=/tmp/jitk-01/r2
clang --target=aarch64-none-elf -c start.S -o "$out/start.o"
for kind in first parking timer wfe; do
    case "$kind" in
        first) set -- ;;
        parking) set -- -DPARK ;;
        timer) set -- -DPARK -DTIMER -DTIMER_ONLY ;;
        wfe) set -- -DPARK -DUSE_WFE ;;
    esac
    clang --target=aarch64-none-elf "$@" -O2 -mstrict-align -mgeneral-regs-only \
        -ffreestanding -fno-builtin -nostdlib -c parking-guest.c -o "$out/$kind.o"
    ld.lld -T ../probe.ld "$out/start.o" "$out/$kind.o" --oformat=binary -o "$out/$kind.bin"
done
