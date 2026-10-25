.text
.global _start
_start:
msr sctlr_el1,xzr
mov x0,#0
mov x8,#94
svc #0
fail:
mov x0,#1
mov x8,#94
svc #0
