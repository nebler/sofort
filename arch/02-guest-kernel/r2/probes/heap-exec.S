.text
.global _start
_start:
mov x0,#0x680000
add x0,x0,#4096
mov x8,#214
svc #0
mov x0,#0x680000
br x0
mov x0,#0
mov x8,#94
svc #0
fail:
mov x0,#1
mov x8,#94
svc #0
