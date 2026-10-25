.global _start
_start:
mov x0, #0xdead
hvc #0
ldr x0, =0x84000008
hvc #0
1: wfi
b 1b
