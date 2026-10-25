.global _start
.text
_start:
 mov x0,1
 adr x1,byte
 mov x2,1
 mov x8,64
 svc 0
 mov x0,0
 mov x8,94
 svc 0
.section .rodata
byte: .byte 9
