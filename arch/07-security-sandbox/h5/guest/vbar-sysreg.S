// Portable bad-sysreg: install a vector table whose every entry calls SYSTEM_OFF, then touch
// an IMPLEMENTATION DEFINED sysreg. HVF: VMM exit 75 or UNDEF->vector->off; KVM: UNDEF->vector->off.
.global _start
_start:
 adr x1, vectors
 msr vbar_el1, x1
 isb
 mrs x0, S3_0_C15_C0_0
 ldr x0, =0x84000008
 hvc #0
1: b 1b
.balign 2048
vectors:
.rept 16
 ldr x0, =0x84000008
 hvc #0
 b .
.balign 128
.endr
