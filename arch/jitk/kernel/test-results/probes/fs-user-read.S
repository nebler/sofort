.text
.global _start
_start:
ldr x0,=0x64a000
ldr x1,[x0]
mov x0,#0
mov x8,#94
svc #0
fail:
mov x0,#1
mov x8,#94
svc #0
