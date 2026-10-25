.global _start
_start:
mrs x0, S3_0_C15_C0_0
ldr x0, =0x84000008
hvc #0
1: wfi
b 1b
