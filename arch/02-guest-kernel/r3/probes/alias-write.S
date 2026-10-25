.text
.global _start
_start:
mov x8,#12346
svc #0
mov x0,#0
mov x8,#94
svc #0
fail:
mov x0,#1
mov x8,#94
svc #0
