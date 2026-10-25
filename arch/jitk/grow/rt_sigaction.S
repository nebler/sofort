// Profile probe: ENOSYS even for inaccessible input/output. No memory touched.
.global _start
.text
_start:
    mov x0, 2
    adr x1, buffer
    mov x2, 0
    mov x3, 8
    mov x8, 134
    svc 0
    cmn x0, 38
    b.ne fail
    mov x0, 2
    mov x1, 1
    mov x2, 1
    mov x3, 8
    mov x8, 134
    svc 0
    cmn x0, 38
    b.ne fail
    mov x0, 1
    adr x1, message
    mov x2, 11
    mov x8, 64
    svc 0
    mov x0, 0
    b exit
fail:
    mov x0, 1
exit:
    mov x8, 94
    svc 0
.section .rodata
message: .ascii "signals:ok\n"
.section .data
.balign 8
buffer: .quad 0,0,0,0
