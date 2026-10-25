.text
.global _start
_start:
mov x0,#1
mov x1,#0x80000000
mov x2,#16
mov x8,#64
svc #0
cmn x0,#14
b.ne fail
mov x0,#0
mov x8,#94
svc #0
fail:
mov x0,#1
mov x8,#94
svc #0
