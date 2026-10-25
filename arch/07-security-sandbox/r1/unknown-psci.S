.global _start
_start:
    mov x0, #0x1234
    hvc #0
1:  wfi
    b 1b
