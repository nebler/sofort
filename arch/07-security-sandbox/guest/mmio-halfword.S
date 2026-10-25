.global _start
_start:
mov x1, #0x0a000000
strh wzr, [x1]
ldr x0, =0x84000008
hvc #0
1: wfi
b 1b
