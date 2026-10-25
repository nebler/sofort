// PSCI SYSTEM_RESET: a VM must never reboot into a second life (single-use).
.global _start
_start:
 ldr x0, =0x84000009
 hvc #0
1: b 1b
