# kvm-dev: persistent nested-KVM Linux dev VM (macOS, Apple Silicon)

Debian 13 arm64 (cloud image 6.12.113, SHA512-verified) under QEMU HVF with `virtualization=on`,
so `/dev/kvm` works inside. 4 vCPU / 8 GiB / 30 GiB thin disk; user `dev` (in `kvm`), passwordless sudo.
Toolchain inside: Rust stable + aarch64-unknown-none, clang/lld/llvm, build-essential, strace, perf.

    ./start.sh          # boot (daemonized; serial -> serial.log); KVM_DEV_VCPUS / KVM_DEV_MEM override
    ./ssh.sh [cmd]      # ssh dev@127.0.0.1:2222 with the local key
    ./stop.sh           # poweroff

Direct kernel boot from `boot/` (extracted from the image) because edk2 stalled under virtualization=on.
After a kernel upgrade inside the VM, re-extract boot/vmlinuz + boot/initrd.img.
`smoke/kvm-smoke.c`: create VM -> MMIO exit -> PSCI SYSTEM_OFF; note `KVM_ARM_VCPU_PSCI_0_2` is required.
All timings here are NESTED (HVF -> KVM), not performance claims.
