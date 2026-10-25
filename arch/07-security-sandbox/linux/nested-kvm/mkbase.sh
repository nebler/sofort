#!/bin/sh
# Build the nested-KVM test environment (Debian 13 arm64 kernel 6.12.113, KVM=y, Landlock ABI 6)
# Outputs to /tmp/jitk-07/kvm. Requires Docker Desktop + QEMU >= 11.1 (HVF nested virt on M3+/macOS 15+).
set -e; K=/tmp/jitk-07/kvm; mkdir -p $K/bin; cp "$(dirname "$0")/init" $K/init; cp /tmp/jitk-spike/boot/kk.bin /tmp/jitk-01/probe.bin /tmp/jitk-01/park.bin $K/bin/
docker run --rm -v $K:/out debian:trixie sh -c 'apt-get update -qq && apt-get install -y -qq --no-install-recommends linux-image-arm64 >/dev/null 2>&1; cp /boot/vmlinuz-* /out/vmlinuz; cp /boot/config-* /out/config'
docker run --rm -v $K:/out debian:trixie sh -c '
apt-get update -qq >/dev/null && apt-get install -y -qq --no-install-recommends strace cpio gzip python3-minimal util-linux >/dev/null 2>&1
mkdir -p /work && cp /out/init /init
cd / && find . -xdev \( -path ./proc -o -path ./sys -o -path ./out -o -path ./usr/share/doc -o -path ./usr/share/locale -o -path ./var/lib/apt -o -path ./var/cache \) -prune -o -print | cpio -o -H newc 2>/dev/null | gzip -1 > /out/base.cpio.gz'
# Then: put jitk-vmm (built in rust:1.95-slim against libkrun Linux rlib), kk.bin/probe.bin/park.bin,
# run.sh into $K/bin, ./mkwork.sh, ./boot.sh $K/test.cpio.gz  (guest prints KVMCHECK: /dev/kvm ...)
