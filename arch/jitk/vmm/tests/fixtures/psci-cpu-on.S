// PSCI CPU_ON for a nonexistent CPU 1 (we run 1 vCPU), then SYSTEM_OFF.
.global _start
_start:
 ldr x0, =0xC4000003
 mov x1, #1
 adr x2, _start
 mov x3, #0
 hvc #0
 ldr x0, =0x84000008
 hvc #0
1: b 1b
