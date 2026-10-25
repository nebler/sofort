// Same trigger as 07's bad-sysreg.S, with a portable guest UNDEF handler.
.global _start
_start:
adr x0, vectors
msr vbar_el1, x0
isb
mrs x0, S3_0_C15_C0_0
b unexpected
.balign 2048
vectors:
.rept 16
b fault
.balign 128
.endr
fault:
mrs x1, esr_el1
lsr x1, x1, #26
cbnz x1, unexpected // EC=0 is the expected undefined-instruction exception.
ldr x0, =0x84000008
hvc #0
unexpected:
wfi
b unexpected
