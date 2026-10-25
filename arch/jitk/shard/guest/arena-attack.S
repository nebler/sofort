// EL1 fixture: MMU disabled; read all RAM, dirty every class arena/ring page, then RO write.
.text
.global _start
_start:
    mov x0, #0x80000000
    mov x1, #0x82000000
0:  ldr x3, [x0]
    add x0, x0, #4096
    cmp x0, x1
    b.lo 0b
    mov x0, x4
    mov x1, x5
    mov x2, #0x55
1:  str x2, [x0, #2048]
    add x0, x0, #4096
    cmp x0, x1
    b.lo 1b
    mov x0, #0x81d00000
    mov x1, #0x81d00000
    add x1, x1, #0x14000
2:  str x2, [x0, #2048]
    add x0, x0, #4096
    cmp x0, x1
    b.lo 2b
    mov x0, #0x80000000
    str x2, [x0]
3:  b 3b
