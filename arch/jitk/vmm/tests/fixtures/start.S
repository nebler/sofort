.global _start
_start:
    mrs x21, cntvct_el0
    msr daifset, #15
    mov x19, x0
    mrs x1, CurrentEL
    cmp x1, #8
    b.ne 9f
    mov x1, #(1 << 31)
    msr hcr_el2, x1
    mov x1, #3
    msr cnthctl_el2, x1
    msr cntvoff_el2, xzr
    msr cptr_el2, xzr
    mov x1, #0x3c5
    msr spsr_el2, x1
    adr x1, 9f
    msr elr_el2, x1
    eret
9:
    mov x1, #(3 << 20)
    msr cpacr_el1, x1
    isb
    ldr x1, =__stack_top
    mov sp, x1
    ldr x1, =__bss_start
    ldr x2, =__bss_end
1:  cmp x1, x2
    b.hs 2f
    str xzr, [x1], #8
    b 1b
2:  mov x1, x21
    mov x0, x19
    adr x2, vectors
    msr vbar_el1,x2
    isb
    bl probe
3:  wfi
    b 3b

.balign 2048
vectors:
.rept 16
    b fault
    .balign 128
.endr
fault:
    mrs x0,elr_el1
    mrs x1,esr_el1
    mrs x2,far_el1
    hvc #0
    b .
