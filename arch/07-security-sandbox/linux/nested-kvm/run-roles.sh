#!/bin/sh
cd /work
for mode in 1 0; do
  echo "== ROLES=$mode kk"; JITK_ROLES=$mode ./jitk-vmm kk.bin 2>&1 | cat; echo "kk status=$?"
  JITK_ROLES=$mode ./jitk-vmm probe.bin 2>&1 | tail -1; 
  (sleep 1; printf x) | JITK_ROLES=$mode ./jitk-vmm park.bin 2>&1 | tail -1
done
r() { "$@" 2>&1 | grep -v "^S$" | tr '\n' ' '; }
echo "EVIL-VCPU: $(JITK_ROLES=1 JITK_EVIL_VCPU=1 sh -c './jitk-vmm kk.bin; echo status=$?' 2>&1 | tr '\n' ' ')"
echo "EVIL-CONSOLE: $( (sleep 1; printf x) | JITK_ROLES=1 JITK_EVIL_CONSOLE=1 sh -c './jitk-vmm park.bin >/dev/null; echo status=$?' 2>&1 | tr '\n' ' ')"
for e in openat socket execve kvm-create-vm mmap-exec kill; do echo "EVIL-MAIN-$e: $(JITK_ROLES=1 JITK_EVIL=$e sh -c './jitk-vmm kk.bin; echo status=$?' 2>&1 | tr '\n' ' ')"; done
echo "MAIN-eventfd-allowed (ROLES=1): $(JITK_ROLES=1 JITK_EVIL=vcpu-role-eventfd sh -c './jitk-vmm kk.bin; echo status=$?' 2>&1 | tr '\n' ' ')"
for i in $(seq 1 11); do JITK_ROLES=1 JITK_TIME=1 ./jitk-vmm kk.bin 2>&1 | grep "^T seccomp-install" ; done | sort -k3 -n | sed -n 6p | sed 's/^/median-of-11 ROLES=1 /'
for i in $(seq 1 11); do JITK_TIME=1 ./jitk-vmm kk.bin 2>&1 | grep "^T seccomp-install" ; done | sort -k3 -n | sed -n 6p | sed 's/^/median-of-11 union /'
echo "bpf_jit_enable=$(cat /proc/sys/net/core/bpf_jit_enable)"; echo 0 > /proc/sys/net/core/bpf_jit_enable
for i in $(seq 1 11); do JITK_TIME=1 ./jitk-vmm kk.bin 2>&1 | grep "^T seccomp-install" ; done | sort -k3 -n | sed -n 6p | sed 's/^/median-of-11 union-nojit /'
