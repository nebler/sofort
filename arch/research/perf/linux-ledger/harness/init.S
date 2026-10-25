// Tiny PID 1. No libc, no filesystems beyond the built-in initramfs.
.global _start
.text
_start:
    mov x0, #-100
    adr x1, console
    mov x2, #2
    mov x3, #0
    mov x8, #56 // openat
    svc #0
    mov x19, x0
    mov x1, #0
1:  mov x0, x19
    mov x2, #0
    mov x8, #24 // dup3
    svc #0
    add x1, x1, #1
    cmp x1, #3
    b.ne 1b
    mov x0, #1
    adr x1, ready
    mov x2, #12
    mov x8, #64
    svc #0
2:  mov x0, #0
    adr x1, buffer
    mov x2, #1
    mov x8, #63 // read; console is in canonical mode
    svc #0
    cmp x0, #1
    b.ne 2b
    mov x0, #1
    adr x1, alive
    mov x2, #12
    mov x8, #64
    svc #0
    b 2b
.section .rodata
console: .asciz "/dev/console"
ready: .ascii "LEDGER_READY"
alive: .ascii "LEDGER_ALIVE"
.bss
.balign 16
buffer: .skip 16
