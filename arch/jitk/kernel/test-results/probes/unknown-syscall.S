.text
.global _start
_start:
mov x8,#511
svc #0
cmn x0,#38
b.ne fail
mov x0,#0
mov x8,#94
svc #0
fail:
mov x0,#1
mov x8,#94
svc #0
