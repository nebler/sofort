.global _start
_start:
 ldr x0, =0x12345678
 hvc #0
1: wfi
 b 1b
